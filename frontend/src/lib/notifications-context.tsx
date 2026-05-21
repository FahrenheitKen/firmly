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

const POLL_INTERVAL_MS = 15_000;

const sessionKey = (userId: number | string) => `firmly.notif.lastSeenId:${userId}`;

function playDing(): void {
  if (typeof window === 'undefined') return;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // ignore — autoplay may be blocked until a user gesture occurs
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
    new Notification(title, { body, tag: item.id });
  } catch {
    // ignore
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

  // Polling
  useEffect(() => {
    if (!token || !user) return;
    const id = setInterval(checkUnread, POLL_INTERVAL_MS);
    return () => clearInterval(id);
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
    } catch {
      // ignore
    }
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
