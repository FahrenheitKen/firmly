'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { api } from '@/lib/api';
import PageHeader from '@/components/ui/page-header';
import Modal from '@/components/ui/modal';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import PermissionsPicker from '@/components/roles/permissions-picker';

interface Role {
  id: number;
  name: string;
  full_name: string;
  permissions: string[];
}

export default function RolesPage() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editRole, setEditRole] = useState<Role | null>(null);
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = async () => {
    if (!token) return;
    const res = await api.get<{ roles: Role[] }>('/roles', token);
    setRoles(res.roles);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [token]); // eslint-disable-line

  const openEdit = (role: Role) => {
    setEditRole(role);
    setSelectedPerms([...role.permissions]);
    setError('');
    setShowModal(true);
  };

  const togglePerm = (perm: string) => {
    setSelectedPerms((prev) => prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRole) return;
    setSaving(true);
    setError('');
    try {
      await api.put(`/roles/${editRole.id}`, { permissions: selectedPerms }, token!);
      setShowModal(false);
      fetchData();
    } catch (err: unknown) {
      setError((err as { message?: string }).message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const deleteRole = async () => {
    if (deleteTarget === null) return;
    setDeleting(true);
    try { await api.delete(`/roles/${deleteTarget}`, token!); setDeleteTarget(null); fetchData(); } catch (err: unknown) { const msg = (err as { message?: string }).message || 'Failed to delete role'; toast(msg, 'error'); } finally { setDeleting(false); }
  };

  return (
    <>
      <PageHeader
        title="Roles & Permissions"
        description="Manage user roles and their permissions"
        action={<Link href="/dashboard/roles/create" className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark text-sm font-medium">+ Add Role</Link>}
      />

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>
      ) : (
        <div className="bg-card-bg rounded-xl border border-border overflow-hidden shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-gray-50 to-white border-b border-border">
                <th className="text-left px-3 sm:px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted">Role</th>
                <th className="text-right px-3 sm:px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted">Action</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role, i) => (
                <tr key={role.id} className={`border-b border-border last:border-0 transition-colors hover:bg-gray-50/80 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                  <td className="px-3 sm:px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold">
                        {role.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-gray-900">{role.name}</div>
                        <div className="text-xs text-muted mt-0.5">{role.permissions.length} permission{role.permissions.length !== 1 ? 's' : ''}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-4">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => openEdit(role)} className="inline-flex items-center gap-1.5 text-xs font-medium px-2 sm:px-3.5 py-2 bg-accent/10 border border-accent/20 rounded-lg hover:bg-accent/20 hover:border-accent/30 transition-all text-accent shadow-sm">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        <span className="hidden sm:inline">Edit</span>
                      </button>
                      <button onClick={() => setDeleteTarget(role.id)} className="inline-flex items-center gap-1.5 text-xs font-medium px-2 sm:px-3.5 py-2 bg-danger/5 border border-danger/20 rounded-lg hover:bg-danger/10 hover:border-danger/30 transition-all text-danger shadow-sm">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        <span className="hidden sm:inline">Delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Edit Permissions" size="lg">
        <form onSubmit={handleUpdate} className="space-y-4">
          {error && <div className="bg-red-50 text-danger text-sm px-4 py-3 rounded-lg">{error}</div>}

          {editRole && (
            <div>
              <label className="block text-sm font-medium mb-1">Role</label>
              <input value={editRole.name} disabled className="w-full px-3 py-2 border border-border rounded-lg bg-gray-50 text-sm text-muted" />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium">Permissions</label>
            </div>

            <PermissionsPicker selectedPerms={selectedPerms} onToggle={togglePerm} token={token!} />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50">
              {saving ? 'Saving...' : 'Update'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={deleteRole}
        title="Delete Role"
        message="Are you sure you want to delete this role? This action cannot be undone."
        confirmLabel="Delete"
        loading={deleting}
      />
    </>
  );
}
