'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import PermissionsPicker from '@/components/roles/permissions-picker';

export default function CreateRolePage() {
  const { token } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const togglePerm = (perm: string) => {
    setSelectedPerms((prev) => prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError('');
    try {
      await api.post('/roles', { name, permissions: selectedPerms }, token);
      router.push('/dashboard/roles');
    } catch (err: unknown) {
      setError((err as { message?: string }).message || 'Failed to create role');
    } finally {
      setSaving(false);
    }
  };

  const sectionClass = 'bg-card-bg rounded-2xl border border-border/60 p-6';

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-muted mb-3">
        <Link href="/dashboard/roles" className="hover:text-foreground transition-colors">Roles</Link>
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        <span className="text-foreground font-medium">Create Role</span>
      </div>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Create Role</h1>
          <p className="text-sm text-muted mt-1">Add a new role with custom permissions</p>
        </div>
        <Link href="/dashboard/roles" className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-muted bg-card-bg border border-border rounded-xl hover:bg-background hover:text-foreground transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Back
        </Link>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {error && (
              <div className="bg-danger/5 border border-danger/20 text-danger text-sm px-5 py-3.5 rounded-2xl flex items-center gap-3">
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {error}
              </div>
            )}

            <div className={sectionClass}>
              <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border/50">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">Role Information</h2>
                  <p className="text-xs text-muted">Give your role a descriptive name</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground/80 mb-1">
                  Role Name <span className="text-danger">*</span>
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="e.g. Managing Partner"
                  className="w-full px-3.5 py-2.5 bg-card-bg border border-border rounded-xl focus:outline-none focus:border-primary focus:ring-0 text-sm transition-colors placeholder:text-muted/50"
                />
              </div>
            </div>

            <div className={sectionClass}>
              <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border/50">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">Permissions</h2>
                  <p className="text-xs text-muted">Select the permissions for this role — {selectedPerms.length} selected</p>
                </div>
              </div>
              <PermissionsPicker selectedPerms={selectedPerms} onToggle={togglePerm} token={token!} />
            </div>

            <div className="flex justify-end gap-3">
              <Link href="/dashboard/roles" className="px-5 py-2.5 text-sm font-medium border border-border rounded-xl hover:bg-background transition-colors text-muted hover:text-foreground">
                Cancel
              </Link>
              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium bg-primary text-white rounded-xl hover:bg-primary-dark disabled:opacity-50 transition-colors"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    Creating...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                    Create Role
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-card-bg rounded-2xl border border-border/60 p-5">
              <h3 className="text-xs font-semibold text-muted uppercase tracking-widest mb-4">Summary</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 px-3 bg-primary/5 rounded-lg">
                  <span className="text-sm text-muted">Role Name</span>
                  <span className="text-sm font-medium text-foreground">{name || '—'}</span>
                </div>
                <div className="flex items-center justify-between py-2 px-3 bg-primary/5 rounded-lg">
                  <span className="text-sm text-muted">Permissions</span>
                  <span className="text-sm font-medium text-foreground">{selectedPerms.length}</span>
                </div>
              </div>
            </div>
            <div className="bg-card-bg rounded-2xl border border-border/60 p-5">
              <h3 className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">Tips</h3>
              <ul className="space-y-2.5 text-sm text-muted">
                <li className="flex items-start gap-2.5"><span className="text-muted/50 mt-0.5">•</span>Choose a descriptive role name</li>
                <li className="flex items-start gap-2.5"><span className="text-muted/50 mt-0.5">•</span>Select only relevant permissions</li>
                <li className="flex items-start gap-2.5"><span className="text-muted/50 mt-0.5">•</span>Permissions can be edited later</li>
              </ul>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}
