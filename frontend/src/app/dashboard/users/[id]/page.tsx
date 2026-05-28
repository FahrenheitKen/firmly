'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { useCurrency } from '@/lib/use-currency';

interface BankDetails {
  account_holder_name: string;
  account_number: string;
  bank_name: string;
  bank_identification_code: string;
  branch: string;
  tax_payer_id: string;
  basic_salary: string;
}

const Row = ({ label, value }: { label: string; value: string | number | boolean | null | undefined }) => (
  <div className="flex items-center justify-between py-2.5 px-4 odd:bg-background/40 rounded-lg">
    <span className="text-sm font-medium text-muted">{label}</span>
    <span className="text-sm font-semibold text-foreground text-right max-w-[60%]">{value ?? '—'}</span>
  </div>
);

export default function UserDetailPage() {
  const { token } = useAuth();
  const { formatMoney } = useCurrency();
  const params = useParams();
  const [user, setUser] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    api.get<{ user: Record<string, unknown> }>(`/users/${params.id}`, token)
      .then((res) => { setUser(res.user); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token, params.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full" />
          <p className="text-sm text-muted">Loading user details...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-16 h-16 rounded-2xl bg-danger/5 border border-danger/10 text-danger flex items-center justify-center mb-5">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <h2 className="text-lg font-bold text-foreground mb-1">User not found</h2>
        <p className="text-sm text-muted mb-5">The user you're looking for doesn't exist or has been removed.</p>
        <Link href="/dashboard/users" className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-primary text-white rounded-xl hover:bg-primary-dark transition-colors shadow-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Back to Users
        </Link>
      </div>
    );
  }

  const bank = (user.bank_details as BankDetails) || {};
  const roleName = (user.roles as Array<{ name: string }>)?.[0]?.name || '-';
  const initial = ((user.first_name as string) || '?').charAt(0).toUpperCase();
  const hasBank = bank.account_holder_name || bank.account_number || bank.bank_name;

  return (
    <>
      <div className="flex items-center gap-2.5 text-sm mb-6">
        <Link href="/dashboard/users" className="text-muted hover:text-foreground transition-colors font-medium flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" /></svg>
          Users
        </Link>
        <svg className="w-4 h-4 text-muted/50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        <span className="text-foreground font-semibold">{user.full_name as string}</span>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
        <div className="relative h-28 bg-gradient-to-r from-primary via-primary/85 to-primary-dark">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-40" />
        </div>
        <div className="px-6 sm:px-8 pb-6 relative">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between -mt-12">
            <div className="flex items-end gap-5">
              <div className="w-24 h-24 rounded-2xl bg-white shadow-lg flex items-center justify-center text-4xl font-bold text-primary shrink-0 ring-4 ring-white">
                {initial}
              </div>
              <div className="pb-1">
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{user.full_name as string}</h1>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                  <span className="text-sm text-gray-500">{user.email as string || ''}</span>
                  <span className="w-1 h-1 rounded-full bg-gray-300" />
                  <span className="text-sm font-semibold text-primary bg-primary/5 px-2.5 py-0.5 rounded-lg">{roleName}</span>
                  <span className="w-1 h-1 rounded-full bg-gray-300" />
                  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-lg ${
                    user.allow_login ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${user.allow_login ? 'bg-emerald-500' : 'bg-red-400'}`} />
                    {user.allow_login ? 'Active' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-4 sm:mt-0">
              <Link href={`/dashboard/users/${params.id}/edit`} className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-amber-400 text-white rounded-xl hover:bg-amber-500 transition-colors shadow-sm">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                Edit
              </Link>
              <Link href="/dashboard/users" className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-500 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:text-gray-700 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Back
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-5">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/5 text-primary flex items-center justify-center">
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">Personal Information</h2>
                <p className="text-xs text-gray-400">Basic details about the user</p>
              </div>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2">
                <Row label="Prefix" value={user.surname as string} />
                <Row label="First Name" value={user.first_name as string} />
                <Row label="Last Name" value={user.last_name as string} />
                <Row label="Email" value={user.email as string} />
                <Row label="Phone" value={user.contact_no as string} />
                <Row label="Date of Birth" value={user.dob as string} />
                <Row label="Gender" value={user.gender as string} />
                <Row label="Marital Status" value={user.marital_status as string} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/5 text-primary flex items-center justify-center">
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg>
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">Account Details</h2>
                <p className="text-xs text-gray-400">Login credentials and permissions</p>
              </div>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2">
                <Row label="Role" value={roleName} />
                <Row label="Login Status" value={user.allow_login ? 'Allowed' : 'Disabled'} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/5 text-primary flex items-center justify-center">
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">Bank Details</h2>
                <p className="text-xs text-gray-400">Banking and salary information</p>
              </div>
            </div>
            <div className="p-5">
              {hasBank ? (
                <div className="grid grid-cols-1 sm:grid-cols-2">
                  <Row label="Account Holder" value={bank.account_holder_name} />
                  <Row label="Account Number" value={bank.account_number} />
                  <Row label="Bank Name" value={bank.bank_name} />
                  <Row label="Bank Code" value={bank.bank_identification_code} />
                  <Row label="Branch" value={bank.branch} />
                  <Row label="Tax Payer ID" value={bank.tax_payer_id} />
                  <Row label="Basic Salary" value={bank.basic_salary ? formatMoney(bank.basic_salary) : '-'} />
                </div>
              ) : (
                <div className="flex flex-col items-center py-8 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-gray-50 text-gray-300 flex items-center justify-center mb-3">
                    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>
                  </div>
                  <p className="text-sm text-gray-400 mb-3">No bank details have been added yet.</p>
                  <Link href={`/dashboard/users/${params.id}/edit`} className="text-sm font-semibold text-amber-500 hover:text-amber-600 transition-colors">
                    + Add Bank Information
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-primary px-5 py-5 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/15 text-white flex items-center justify-center text-3xl font-bold mx-auto shadow-sm backdrop-blur-sm ring-2 ring-white/20 mb-3">
                {initial}
              </div>
              <h3 className="text-white font-bold text-base">{user.full_name as string}</h3>
              <p className="text-white/60 text-xs mt-0.5">{roleName}</p>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between py-1.5">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Status</span>
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-lg ${
                  user.allow_login ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${user.allow_login ? 'bg-emerald-500' : 'bg-red-400'}`} />
                  {user.allow_login ? 'Active' : 'Disabled'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Email</span>
                <span className="text-xs font-semibold text-gray-700 text-right max-w-[140px] truncate">{user.email as string || '-'}</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Phone</span>
                <span className="text-xs font-semibold text-gray-700">{user.contact_no as string || '-'}</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Gender</span>
                <span className="text-xs font-semibold text-gray-700 capitalize">{user.gender as string || '-'}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Quick Actions</h3>
            <div className="space-y-2">
              <Link href={`/dashboard/users/${params.id}/edit`} className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </div>
                Edit Profile
              </Link>
              <Link href="/dashboard/users" className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-gray-50 text-gray-400 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" /></svg>
                </div>
                All Users
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
