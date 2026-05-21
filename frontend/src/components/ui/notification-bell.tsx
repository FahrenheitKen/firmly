'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useNotifications, type NotificationItem } from '@/lib/notifications-context';

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function notificationTitle(n: NotificationItem): string {
  if (n.data.type === 'task.assigned') return `Task assigned: ${n.data.title ?? ''}`;
  if (n.data.type === 'case.assigned') {
    const num = n.data.case_number ? `${n.data.case_number} — ` : '';
    return `Case assigned: ${num}${n.data.title ?? ''}`;
  }
  return n.data.title ?? 'Notification';
}

function notificationIcon(type: string) {
  if (type === 'task.assigned') {
    return (
      <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

export default function NotificationBell() {
  const router = useRouter();
  const { notifications, unreadCount, loading, permission, canDesktop, requestPermission, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleClick = async (n: NotificationItem) => {
    if (!n.read_at) await markRead(n.id);
    setOpen(false);
    if (n.data.url) router.push(n.data.url);
  };

  const recent = notifications.slice(0, 8);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-[#F4F6F9] transition-colors"
        aria-label="Notifications"
      >
        <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-danger text-white text-[10px] font-semibold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-[360px] max-w-[calc(100vw-2rem)] bg-card-bg border border-border rounded-xl shadow-xl z-50 overflow-hidden animate-[fadeIn_0.12s_ease]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <p className="text-sm font-semibold">Notifications</p>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-primary hover:underline">Mark all read</button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading && recent.length === 0 ? (
              <div className="flex justify-center py-8"><div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" /></div>
            ) : recent.length === 0 ? (
              <div className="text-center py-10 px-4 text-muted">
                <svg className="w-8 h-8 mx-auto mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <p className="text-sm font-medium">You're all caught up</p>
                <p className="text-xs mt-1">New assignments will show up here.</p>
              </div>
            ) : (
              recent.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors border-b border-border last:border-0 ${
                    !n.read_at ? 'bg-primary/[0.02]' : ''
                  }`}
                >
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    {notificationIcon(n.data.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground leading-snug">{notificationTitle(n)}</p>
                    {n.data.actor_name && (
                      <p className="text-xs text-muted mt-0.5">by {n.data.actor_name}</p>
                    )}
                    <p className="text-[11px] text-muted mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                  {!n.read_at && <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />}
                </button>
              ))
            )}
          </div>

          {canDesktop && permission === 'default' && (
            <div className="px-4 py-3 border-t border-border bg-gray-50/60">
              <button onClick={requestPermission} className="text-xs text-primary font-medium hover:underline">
                Enable desktop alerts
              </button>
              <p className="text-[11px] text-muted mt-0.5">Get notified outside the tab.</p>
            </div>
          )}
          {canDesktop && permission === 'denied' && (
            <div className="px-4 py-2 border-t border-border bg-gray-50/60">
              <p className="text-[11px] text-muted">Desktop alerts are blocked in your browser settings.</p>
            </div>
          )}

          <div className="border-t border-border bg-gray-50/60 px-4 py-2.5">
            <Link href="/dashboard/notifications" onClick={() => setOpen(false)} className="text-xs text-primary font-medium hover:underline">
              View all notifications →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
