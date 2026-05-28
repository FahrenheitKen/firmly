'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { NotificationsProvider } from '@/lib/notifications-context';
import { LocationsProvider } from '@/lib/locations-context';
import Sidebar from '@/components/ui/sidebar';
import NotificationBell from '@/components/ui/notification-bell';

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-[#F4F6F9] transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
          {user?.first_name?.[0]}{user?.last_name?.[0]}
        </div>
        <div className="hidden sm:block text-left">
          <p className="text-sm font-medium text-foreground leading-tight">{user?.first_name} {user?.last_name}</p>
          <p className="text-[11px] text-muted leading-tight">{user?.email}</p>
        </div>
        <svg className={`w-3.5 h-3.5 text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-48 bg-card-bg border border-border rounded-xl shadow-xl z-50 py-1 animate-[fadeIn_0.12s_ease]">
          <div className="px-3 py-2 border-b border-border sm:hidden">
            <p className="text-sm font-medium text-foreground">{user?.first_name} {user?.last_name}</p>
            <p className="text-xs text-muted">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            className="w-full text-left px-3 py-2.5 text-sm text-danger hover:bg-red-50 transition-colors flex items-center gap-2 rounded-lg mx-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, mustChangePassword } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
    if (!loading && user && mustChangePassword) {
      router.replace('/login');
    }
  }, [user, loading, mustChangePassword, router]);

  const ready = !loading && !!user;

  return (
    <NotificationsProvider>
      <LocationsProvider>
        <div className="min-h-screen bg-background">
          <Sidebar />
          <div className="lg:pl-64">
            <header className="sticky top-0 z-30 bg-card-bg border-b border-border">
              <div className="flex items-center justify-end gap-1 px-4 sm:px-6 lg:px-8 h-14">
                {ready && <NotificationBell />}
                {ready && <UserMenu />}
              </div>
            </header>
            <main className="p-4 sm:p-6 lg:p-8">
              {ready ? (
                children
              ) : (
                <div className="flex items-center justify-center min-h-[60vh]">
                  <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
                </div>
              )}
            </main>
          </div>
        </div>
      </LocationsProvider>
    </NotificationsProvider>
  );
}
