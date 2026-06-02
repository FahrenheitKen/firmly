'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from './api';
import { useAuth } from './auth-context';

export interface NotificationItem {
  id: string;
  type: string;
  data: {
    type: 'task.assigned' | 'case.assigned' | string;
    title?: string;
    case_id?: number | null;
    task_id?: number;
    case_number?: string;
    actor_id?: number | null;
    actor_name?: string | null;
    url?: string;
  };
  read_at: string | null;
  created_at: string;
}

interface ContextValue {
  notifications: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  permission: NotificationPermission;
  canDesktop: boolean;
  requestPermission: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  refresh: () => Promise<void>;
}

const NotificationsContext = createContext<ContextValue | null>(null);

const POLL_INTERVAL_MS = 60_000;

const sessionKey = (userId: number | string) => `firmly.notif.lastSeenId:${userId}`;

// ---------- Sound ----------
//
// Browsers (Chrome, Safari) block AudioContext from producing sound until a
// user gesture occurs. The previous implementation created a fresh context per
// ding, so polled notifications consistently arrived in `suspended` state —
// the oscillator ran but produced silence. Fix: keep ONE context, warm it on
// the first click/keypress anywhere in the app, and resume() if it ever falls
// back to suspended.
let sharedAudioCtx: AudioContext | null = null;
let audioUnlocked = false;

function unlockAudio(): void {
  if (audioUnlocked || typeof window === 'undefined') return;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  try {
    if (!sharedAudioCtx) sharedAudioCtx = new AC();
    if (sharedAudioCtx.state === 'suspended') sharedAudioCtx.resume().catch(() => {});
    audioUnlocked = true;
  } catch {
    // ignore
  }
}

if (typeof window !== 'undefined') {
  const handler = () => {
    unlockAudio();
    window.removeEventListener('pointerdown', handler);
    window.removeEventListener('keydown', handler);
  };
  window.addEventListener('pointerdown', handler, { once: true });
  window.addEventListener('keydown', handler, { once: true });
}

function playDing(): void {
  if (typeof window === 'undefined') return;
  unlockAudio();
  if (!sharedAudioCtx) return;
  try {
    const ctx = sharedAudioCtx;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const t = ctx.currentTime;

    // First beep — high pitch
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, t);
    gain1.gain.setValueAtTime(0.0001, t);
    gain1.gain.exponentialRampToValueAtTime(0.6, t + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    osc1.connect(gain1).connect(ctx.destination);
    osc1.start(t);
    osc1.stop(t + 0.2);

    // Second beep — higher pitch, after short gap
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1100, t + 0.25);
    gain2.gain.setValueAtTime(0.0001, t + 0.25);
    gain2.gain.exponentialRampToValueAtTime(0.6, t + 0.27);
    gain2.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    osc2.connect(gain2).connect(ctx.destination);
    osc2.start(t + 0.25);
    osc2.stop(t + 0.5);
  } catch {
    // ignore
  }
}

function fireDesktopNotification(item: NotificationItem): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  const d = item.data;
  const prefix = d.type === 'task.assigned' ? 'New task' : d.type === 'case.assigned' ? 'New case' : 'New notification';
  const title = d.title ? `${prefix}: ${d.title}` : prefix;
  const body = d.actor_name ? `Assigned by ${d.actor_name}` : '';
  try {
    const n = new Notification(title, {
      body,
      tag: `firmly-${item.id}-${Date.now()}`,
      icon: '/favicon.ico',
      requireInteraction: true,
    });
    if (d.url) {
      n.onclick = () => { window.focus(); window.location.href = d.url!; n.close(); };
    } else {
      n.onclick = () => { window.focus(); n.close(); };
    }
  } catch {
    // ignore — some browsers block Notification constructor in certain contexts
  }
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { token, user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );

  const lastSeenCountRef = useRef(0);
  const lastSeenIdRef = useRef<string | null>(null);

  const canDesktop = typeof window !== 'undefined' && 'Notification' in window;

  const fetchList = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api.get<{ notifications: NotificationItem[] }>('/notifications?per_page=20', token);
      setNotifications(res.notifications);
      const unread = res.notifications.filter((n) => !n.read_at).length;
      setUnreadCount(unread);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [token]);

  const checkUnread = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.get<{ unread_count: number }>('/notifications/unread-count', token);
      const next = res.unread_count;
      if (next > lastSeenCountRef.current) {
        // Something new arrived — refresh the list, then play sound + desktop notif for the newest item.
        const full = await api.get<{ notifications: NotificationItem[] }>('/notifications?per_page=20', token);
        setNotifications(full.notifications);
        const newest = full.notifications[0];
        if (newest && newest.id !== lastSeenIdRef.current) {
          playDing();
          fireDesktopNotification(newest);
          lastSeenIdRef.current = newest.id;
          if (user && typeof window !== 'undefined') {
            sessionStorage.setItem(sessionKey(user.id), newest.id);
          }
        }
      }
      setUnreadCount(next);
      lastSeenCountRef.current = next;
    } catch {
      // silent — network blips shouldn't blow up the bell
    }
  }, [token, user]);

  // Reset state when the user logs out or switches accounts so we don't
  // briefly leak the previous user's notifications. Restore lastSeenId from
  // sessionStorage so a page reload in the same tab stays quiet.
  useEffect(() => {
    if (!token || !user) {
      setNotifications([]);
      setUnreadCount(0);
      lastSeenIdRef.current = null;
      lastSeenCountRef.current = 0;
      return;
    }
    const stored =
      typeof window !== 'undefined' ? sessionStorage.getItem(sessionKey(user.id)) : null;
    lastSeenIdRef.current = stored;
    lastSeenCountRef.current = 0;
    fetchList();
  }, [token, user?.id, fetchList]); // eslint-disable-line react-hooks/exhaustive-deps

  // After the first list lands: a brand-new tab session (no stored lastSeenId)
  // with existing unread items should ding once for the newest unread, so the
  // user notices on fresh login. Page reloads in the same tab hit the stored
  // id branch and stay quiet.
  useEffect(() => {
    if (notifications.length === 0) return;
    const newest = notifications[0];
    if (lastSeenIdRef.current === null) {
      const newestUnread = notifications.find((n) => !n.read_at);
      if (newestUnread) {
        playDing();
        fireDesktopNotification(newestUnread);
      }
      lastSeenIdRef.current = newest.id;
      if (user && typeof window !== 'undefined') {
        sessionStorage.setItem(sessionKey(user.id), newest.id);
      }
    }
    lastSeenCountRef.current = unreadCount;
  }, [notifications, unreadCount, user]);

  // Polling + immediate check when tab regains focus (background tabs throttle timers)
  useEffect(() => {
    if (!token || !user) return;
    const id = setInterval(checkUnread, POLL_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') checkUnread();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [token, user, checkUnread]);

  const markRead = useCallback(async (id: string) => {
    if (!token) return;
    try {
      await api.post(`/notifications/${id}/read`, undefined, token);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
      lastSeenCountRef.current = Math.max(0, lastSeenCountRef.current - 1);
    } catch {
      // silent
    }
  }, [token]);

  const markAllRead = useCallback(async () => {
    if (!token) return;
    try {
      await api.post('/notifications/read-all', undefined, token);
      const now = new Date().toISOString();
      setNotifications((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
      setUnreadCount(0);
      lastSeenCountRef.current = 0;
    } catch {
      // silent
    }
  }, [token]);

  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      const res = await Notification.requestPermission();
      setPermission(res);
      if (res === 'granted') {
        new Notification('Firmly', { body: 'Desktop notifications enabled!', icon: '/favicon.ico' });
      }
    } catch {
      // ignore
    }
  }, []);

  // Sync permission state if user changes it via browser settings
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const sync = () => setPermission(Notification.permission);
    window.addEventListener('focus', sync);
    return () => window.removeEventListener('focus', sync);
  }, []);

  const refresh = useCallback(async () => {
    await fetchList();
  }, [fetchList]);

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, loading, permission, canDesktop, requestPermission, markRead, markAllRead, refresh }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}
