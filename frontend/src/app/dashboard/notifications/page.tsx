'use client';

import { useRouter } from 'next/navigation';
import { useNotifications, type NotificationItem } from '@/lib/notifications-context';
import PageHeader from '@/components/ui/page-header';
import { useFormatDate } from '@/lib/date';

function notificationTitle(n: NotificationItem): string {
  if (n.data.type === 'task.assigned') return `Task assigned: ${n.data.title ?? ''}`;
  if (n.data.type === 'case.assigned') {
    const num = n.data.case_number ? `${n.data.case_number} — ` : '';
    return `Case assigned: ${num}${n.data.title ?? ''}`;
  }
  return n.data.title ?? 'Notification';
}

export default function NotificationsPage() {
  const router = useRouter();
  const { notifications, unreadCount, loading, markRead, markAllRead } = useNotifications();
  const formatDate = useFormatDate();

  const handleClick = async (n: NotificationItem) => {
    if (!n.read_at) await markRead(n.id);
    if (n.data.url) router.push(n.data.url);
  };

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Tasks and cases assigned to you"
        action={
          unreadCount > 0 ? (
            <button onClick={markAllRead} className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-background transition-colors">
              Mark all read
            </button>
          ) : null
        }
      />

      {loading && notifications.length === 0 ? (
        <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16 text-muted">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <p className="text-sm font-medium">No notifications yet</p>
          <p className="text-xs mt-1">When someone assigns you a task or case, you'll see it here.</p>
        </div>
      ) : (
        <div className="bg-card-bg rounded-xl border border-border overflow-hidden">
          {notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors border-b border-border last:border-0 ${
                !n.read_at ? 'bg-primary/[0.02]' : ''
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{notificationTitle(n)}</p>
                {n.data.actor_name && <p className="text-xs text-muted mt-0.5">by {n.data.actor_name}</p>}
                <p className="text-[11px] text-muted mt-1">{formatDate(n.created_at)}</p>
              </div>
              {!n.read_at && <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
