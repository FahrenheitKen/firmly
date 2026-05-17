'use client';

import { useAuth } from '@/lib/auth-context';
import PageHeader from '@/components/ui/page-header';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <>
      <PageHeader
        title={`Welcome, ${user?.first_name}!`}
        description="Manage your firm settings, locations, invoices, and users."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {[
          { title: 'Firm Settings', desc: 'Configure your firm profile and preferences', href: '/dashboard/business', color: 'bg-blue-500' },
          { title: 'Locations', desc: 'Manage firm locations', href: '/dashboard/locations', color: 'bg-green-500' },
          { title: 'Cases', desc: 'Manage firm cases', href: '/dashboard/cases', color: 'bg-amber-500' },
          { title: 'Users', desc: 'Manage user accounts and access', href: '/dashboard/users', color: 'bg-pink-500' },
          { title: 'Roles & Permissions', desc: 'Configure roles and permissions', href: '/dashboard/roles', color: 'bg-teal-500' },
        ].map((card) => (
          <a
            key={card.href}
            href={card.href}
            className="bg-card-bg rounded-xl border border-border p-5 hover:shadow-lg transition-shadow group"
          >
            <div className={`w-10 h-10 ${card.color} rounded-lg flex items-center justify-center mb-3`}>
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
            <h3 className="font-semibold group-hover:text-primary transition-colors">{card.title}</h3>
            <p className="text-sm text-muted mt-1">{card.desc}</p>
          </a>
        ))}
      </div>
    </>
  );
}
