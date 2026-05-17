'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import PageHeader from '@/components/ui/page-header';
import Modal from '@/components/ui/modal';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import { useToast } from '@/lib/toast-context';

interface UserItem {
  id: number;
  username: string;
  first_name: string;
  last_name: string | null;
  surname: string | null;
  full_name: string;
  email: string | null;
  role: string;
  allow_login: boolean;
  contact_no: string | null;
  business_id: number;
}

interface Role {
  id: number;
  name: string;
  full_name: string;
}

interface Location {
  id: number;
  name: string;
  city: string;
}

export default function UsersPage() {
  const { token, user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('created') === '1') {
      setSuccessMsg('User created successfully');
      window.history.replaceState({}, '', '/dashboard/users');
      setTimeout(() => setSuccessMsg(''), 4000);
    }
  }, []);

  const fetchData = async () => {
    if (!token) return;
    try {
      const [usersRes, rolesRes, locsRes] = await Promise.all([
        api.get<{ users: UserItem[] }>('/users', token),
        api.get<{ roles: Role[] }>('/roles', token),
        api.get<{ locations: Location[] }>('/locations', token),
      ]);
      setUsers(usersRes.users);
      setRoles(rolesRes.roles);
      setLocations(locsRes.locations);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Failed to load users data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [token, user?.active_location?.id]); // eslint-disable-line

  const openEdit = async (userId: number) => {
    try {
      const res = await api.get<{ user: Record<string, unknown>; location_permissions: number[] }>(`/users/${userId}`, token!);
      const u = res.user;
      setEditId(userId);
      setEditForm({
        surname: u.surname || '', first_name: u.first_name || '', last_name: u.last_name || '',
        email: u.email || '', allow_login: u.allow_login, contact_no: u.contact_no || '',
        dob: u.dob || '', gender: u.gender || '', marital_status: u.marital_status || '',
        blood_group: u.blood_group || '', language: u.language || 'en',
        is_cmmsn_agnt: u.is_cmmsn_agnt, cmmsn_percent: u.cmmsn_percent || 0,
        max_sales_discount_percent: u.max_sales_discount_percent || '',
        role_id: (u.roles as Array<{ id: number }>)?.[0]?.id || '',
        location_permissions: res.location_permissions,
      });
      setError('');
      setShowModal(true);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Failed to load user details');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId) return;
    setSaving(true);
    setError('');
    try {
      await api.put(`/users/${editId}`, editForm, token!);
      setShowModal(false);
      fetchData();
    } catch (err: unknown) {
      const e = err as { errors?: Record<string, string[]>; message?: string };
      setError(e.errors ? Object.values(e.errors).flat().join(', ') : e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async () => {
    if (deleteTarget === null) return;
    setDeleting(true);
    try { await api.delete(`/users/${deleteTarget}`, token!); setDeleteTarget(null); fetchData(); } catch (err: unknown) { const msg = (err as { message?: string }).message || 'Failed to delete user'; toast(msg, 'error'); } finally { setDeleting(false); }
  };

  const toggleLocation = (locId: number) => {
    const current = (editForm.location_permissions as number[]) || [];
    const updated = current.includes(locId) ? current.filter((id) => id !== locId) : [...current, locId];
    setEditForm({ ...editForm, location_permissions: updated });
  };

  const inputClass = 'w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-sm';

  return (
    <>
      <PageHeader
        title="User Management"
        description="Manage user accounts and access control"
        action={<Link href="/dashboard/users/create" className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark text-sm font-medium">+ Add User</Link>}
      />

      {error && !showModal && (
        <div className="mb-4 bg-red-50 text-danger text-sm px-4 py-3 rounded-lg">{error}</div>
      )}

      {successMsg && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2.5 bg-success text-white text-sm px-5 py-3 rounded-xl shadow-lg animate-in slide-in-from-top-2">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          {successMsg}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>
      ) : (
        <div className="bg-card-bg rounded-xl border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-gray-50">
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Username</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Email</th>
                <th className="text-left px-4 py-3 font-medium">Role</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Status</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Business ID</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{u.full_name}</div>
                    <div className="text-xs text-muted sm:hidden">{u.username}</div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">{u.username}</td>
                  <td className="px-4 py-3 hidden md:table-cell">{u.email || '-'}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full">{u.role}</span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${u.allow_login ? 'bg-green-100 text-success' : 'bg-red-100 text-danger'}`}>
                      {u.allow_login ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs font-mono text-muted">{u.business_id}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-1.5 justify-end">
                      <Link href={`/dashboard/users/${u.id}`} className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 bg-primary/5 border border-primary/20 rounded-lg hover:bg-primary/10 hover:border-primary/30 transition-all text-primary shadow-sm">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        View
                      </Link>
                      <button onClick={() => openEdit(u.id)} className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 bg-accent/10 border border-accent/20 rounded-lg hover:bg-accent/20 hover:border-accent/30 transition-all text-accent shadow-sm">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        Edit
                      </button>
                      <button onClick={() => setDeleteTarget(u.id)} className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 bg-danger/5 border border-danger/20 rounded-lg hover:bg-danger/10 hover:border-danger/30 transition-all text-danger shadow-sm">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Edit User" size="xl">
        <form onSubmit={handleUpdate} className="space-y-5">
          {error && <div className="bg-red-50 text-danger text-sm px-4 py-3 rounded-lg">{error}</div>}

          <div>
            <h4 className="font-medium text-sm mb-3">Personal Information</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Prefix</label>
                <input value={editForm.surname as string} onChange={(e) => setEditForm({ ...editForm, surname: e.target.value })} className={inputClass} placeholder="Mr/Mrs" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">First Name *</label>
                <input value={editForm.first_name as string} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} required className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Last Name</label>
                <input value={editForm.last_name as string} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input type="email" value={editForm.email as string} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Phone</label>
                <input value={editForm.contact_no as string} onChange={(e) => setEditForm({ ...editForm, contact_no: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Date of Birth</label>
                <input type="date" value={editForm.dob as string} onChange={(e) => setEditForm({ ...editForm, dob: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Gender</label>
                <select value={editForm.gender as string} onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })} className={inputClass}>
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Marital Status</label>
                <select value={editForm.marital_status as string} onChange={(e) => setEditForm({ ...editForm, marital_status: e.target.value })} className={inputClass}>
                  <option value="">Select</option>
                  <option value="married">Married</option>
                  <option value="unmarried">Unmarried</option>
                  <option value="divorced">Divorced</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-medium text-sm mb-3">Account Settings</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Role *</label>
                <select value={editForm.role_id as string} onChange={(e) => setEditForm({ ...editForm, role_id: Number(e.target.value) })} required className={inputClass}>
                  <option value="">Select Role</option>
                  {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Language</label>
                <select value={editForm.language as string} onChange={(e) => setEditForm({ ...editForm, language: e.target.value })} className={inputClass}>
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="ar">Arabic</option>
                </select>
              </div>
              <label className="flex items-center gap-2 pt-6">
                <input type="checkbox" checked={editForm.allow_login as boolean} onChange={(e) => setEditForm({ ...editForm, allow_login: e.target.checked })} className="w-4 h-4 text-primary rounded" />
                <span className="text-sm">Allow Login</span>
              </label>
              <label className="flex items-center gap-2 pt-6">
                <input type="checkbox" checked={editForm.is_cmmsn_agnt as boolean} onChange={(e) => setEditForm({ ...editForm, is_cmmsn_agnt: e.target.checked })} className="w-4 h-4 text-primary rounded" />
                <span className="text-sm">Commission Agent</span>
              </label>
            </div>
          </div>

          <div>
            <h4 className="font-medium text-sm mb-3">Location Access</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {locations.map((loc) => (
                <label key={loc.id} className="flex items-center gap-2 p-2 rounded border border-border cursor-pointer hover:bg-gray-50 text-sm">
                  <input type="checkbox" checked={((editForm.location_permissions as number[]) || []).includes(loc.id)} onChange={() => toggleLocation(loc.id)} className="w-4 h-4 text-primary rounded" />
                  {loc.name} ({loc.city})
                </label>
              ))}
            </div>
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
        onConfirm={deleteUser}
        title="Delete User"
        message="Are you sure you want to delete this user? This action cannot be undone."
        confirmLabel="Delete"
        loading={deleting}
      />
    </>
  );
}
