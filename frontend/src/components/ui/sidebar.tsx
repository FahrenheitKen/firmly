'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import LocationSwitcher from './location-switcher';

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { label: 'Clients', href: '/dashboard/clients', icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2m8-10a4 4 0 100-8 4 4 0 000 8zm10-2l-3 3-1.5-1.5' },
  { label: 'Cases', href: '/dashboard/cases', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
];

const usersChildren = [
  { label: 'Users', href: '/dashboard/users' },
  { label: 'Roles', href: '/dashboard/roles' },
];

const settingsChildren = [
  { label: 'General Settings', href: '/dashboard/business' },
  { label: 'Firm Branches', href: '/dashboard/locations' },
  { label: 'Case Settings', href: '/dashboard/settings/cases' },
  { label: 'Email Settings', href: '/dashboard/settings/email' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [usersOpen, setUsersOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(true);

  const isUsersActive = usersChildren.some((c) => pathname === c.href || pathname.startsWith(c.href));
  const isSettingsActive = settingsChildren.some((c) => pathname === c.href || pathname.startsWith(c.href));

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-white/10 space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent/20 flex items-center justify-center">
            <span className="text-accent font-bold text-xs">F</span>
          </div>
          <h1 className="text-base font-bold text-white">Firmly</h1>
        </div>
        {user?.business && (
          <div className="text-[10px] text-sidebar-text/60 tracking-wider uppercase">
            <p className="truncate">{user.business.name}</p>
          </div>
        )}
        <LocationSwitcher />
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto mt-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-sidebar-active text-white'
                  : 'text-sidebar-text hover:bg-white/10 hover:text-white'
              }`}
            >
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
              </svg>
              <span>{item.label}</span>
            </Link>
          );
        })}

        <div className="pt-1">
          <button
            onClick={() => setUsersOpen(!usersOpen)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              isUsersActive
                ? 'bg-sidebar-active text-white'
                : 'text-sidebar-text hover:bg-white/10 hover:text-white'
            }`}
          >
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <span className="flex-1 text-left">User Management</span>
            <svg className={`w-3.5 h-3.5 transition-transform ${usersOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {usersOpen && (
            <div className="ml-3 mt-0.5 space-y-0.5 border-l border-white/10 pl-3">
              {usersChildren.map((child) => (
                <Link
                  key={child.href}
                  href={child.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-text/80 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <span>{child.label}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="pt-1">
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              isSettingsActive
                ? 'bg-sidebar-active text-white'
                : 'text-sidebar-text hover:bg-white/10 hover:text-white'
            }`}
          >
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="flex-1 text-left">Settings</span>
            <svg className={`w-3.5 h-3.5 transition-transform ${settingsOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {settingsOpen && (
            <div className="ml-3 mt-0.5 space-y-0.5 border-l border-white/10 pl-3">
              {settingsChildren.map((child) => (
                <Link
                  key={child.href}
                  href={child.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-text/80 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <span>{child.label}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </nav>
    </div>
  );

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-sidebar-bg rounded-lg text-white shadow-lg"
        aria-label="Open menu"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 h-full bg-sidebar-bg">
            <SidebarContent />
          </aside>
        </div>
      )}

      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-sidebar-bg">
        <SidebarContent />
      </aside>
    </>
  );
}
