'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import PageHeader from '@/components/ui/page-header';
import Modal from '@/components/ui/modal';

interface Client {
  id: number;
  client_type: string;
  client_id: string;
  prefix: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  business_name: string | null;
  email: string | null;
  phone: string | null;
  alternative_contact: string | null;
  tax_number: string | null;
  opening_balance: number;
  address: string | null;
  street: string | null;
  building: string | null;
  city: string | null;
  country: string | null;
  zip_code: string | null;
  is_active: boolean;
}

const defaultForm = {
  client_type: 'individual',
  client_id: '',
  prefix: '',
  first_name: '',
  middle_name: '',
  last_name: '',
  business_name: '',
  phone: '',
  alternative_contact: '',
  email: '',
  tax_number: '',
  opening_balance: 0,
  address: '',
  street: '',
  building: '',
  city: '',
  country: '',
  zip_code: '',
};

export default function ClientsPage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);

  useEffect(() => {
    if (openDropdown === null) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.dropdown-menu')) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openDropdown]);

  const fetchClients = async () => {
    if (!token) return;
    setLoading(true);
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    const res = await api.get<{ clients: Client[] }>(`/clients${params}`, token);
    setClients(res.clients);
    setLoading(false);
  };

  useEffect(() => { fetchClients(); }, [token, user?.active_location?.id]); // eslint-disable-line

  useEffect(() => {
    const timer = setTimeout(fetchClients, 300);
    return () => clearTimeout(timer);
  }, [search]); // eslint-disable-line

  const openCreate = () => { setForm(defaultForm); setError(''); setShowModal(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError('');
    try {
      await api.post('/clients', form, token);
      setShowModal(false);
      fetchClients();
    } catch (err: unknown) {
      const e = err as { errors?: Record<string, string[]>; message?: string };
      setError(e.errors ? Object.values(e.errors).flat().join(', ') : e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const viewClient = (id: number) => {
    setOpenDropdown(null);
    router.push(`/dashboard/clients/${id}`);
  };

  const editClient = (c: Client) => {
    setOpenDropdown(null);
    // TODO: Implement edit client
  };

  const deleteClient = async (id: number) => {
    setOpenDropdown(null);
    if (!confirm('Delete this client?')) return;
    try { await api.delete(`/clients/${id}`, token!); fetchClients(); } catch { console.error('Failed to delete client') }
  };

  const toggleActive = async (id: number) => {
    setOpenDropdown(null);
    try { await api.post(`/clients/${id}/toggle-active`, undefined, token!); fetchClients(); } catch { console.error('Failed to toggle active') }
  };

  const inputClass = 'w-full px-3.5 py-2.5 bg-card-bg border border-border rounded-xl focus:outline-none focus:border-primary focus:ring-0 text-sm transition-colors';

  return (
    <>
      <PageHeader
        title="Clients"
        description="Manage Clients"
        action={
          <button onClick={openCreate} className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark text-sm font-medium">
            + Add Client
          </button>
        }
      />

      <div className="mb-4 relative">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          placeholder="Search clients by name, email, phone or company..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-card-bg border border-border rounded-xl focus:outline-none focus:border-primary text-sm transition-colors"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>
      ) : clients.length === 0 ? (
        <div className="text-center py-16 text-muted">
          {search ? 'No clients match your search.' : 'No clients yet. Add your first client.'}
        </div>
      ) : (
        <div className="bg-card-bg rounded-xl border border-border overflow-visible">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-gray-50">
                <th className="w-24 px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider">Actions</th>
                <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider">Client ID</th>
                <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider hidden sm:table-cell">Email</th>
                <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider hidden md:table-cell">Phone</th>
                <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider hidden lg:table-cell">Type</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 relative">
                    <button
                      onClick={() => setOpenDropdown(openDropdown === c.id ? null : c.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors shadow-sm"
                    >
                      Action
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {openDropdown === c.id && (
                      <div className="dropdown-menu absolute right-0 top-full mt-1 w-44 bg-white rounded-lg shadow-lg border border-border z-50 py-1 text-left">
                        <button onClick={() => viewClient(c.id)} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-primary hover:bg-primary/5 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          View
                        </button>
                        <button onClick={() => editClient(c)} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-accent hover:bg-accent/5 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          Edit
                        </button>
                        <button onClick={() => toggleActive(c.id)} className={`flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors ${c.is_active ? 'text-warning hover:bg-warning/5' : 'text-success hover:bg-success/5'}`}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                          {c.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <hr className="my-1 border-border" />
                        <button onClick={() => deleteClient(c.id)} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-danger hover:bg-danger/5 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-muted">{c.client_id || '-'}</td>
                  <td className="px-4 py-3 font-medium">{c.client_type === 'business' ? c.business_name : [c.prefix, c.first_name, c.middle_name, c.last_name].filter(Boolean).join(' ')}</td>
                  <td className="px-4 py-3 text-muted hidden sm:table-cell">{c.email || '-'}</td>
                  <td className="px-4 py-3 text-muted hidden md:table-cell">{c.phone || '-'}</td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${c.client_type === 'business' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-600'}`}>
                      {c.client_type === 'business' ? 'Business' : 'Individual'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 text-xs text-muted border-t border-border bg-gray-50/50">
            Showing {clients.length} client{clients.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Client" size="xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && <div className="bg-danger/5 border border-danger/20 text-danger text-sm px-4 py-3 rounded-lg">{error}</div>}

          <div>
            <label className="block text-sm font-medium mb-2">Client Type</label>
            <div className="flex gap-4">
              <label className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border cursor-pointer transition-all text-sm flex-1 ${form.client_type === 'individual' ? 'bg-primary/5 border-primary/30' : 'border-border hover:bg-gray-50'}`}>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${form.client_type === 'individual' ? 'border-primary' : 'border-gray-300'}`}>
                  {form.client_type === 'individual' && <div className="w-2 h-2 rounded-full bg-primary" />}
                  <input type="radio" name="client_type" value="individual" checked={form.client_type === 'individual'} onChange={(e) => setForm({ ...form, client_type: e.target.value })} className="absolute opacity-0" />
                </div>
                <span className="font-medium">Individual</span>
              </label>
              <label className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border cursor-pointer transition-all text-sm flex-1 ${form.client_type === 'business' ? 'bg-primary/5 border-primary/30' : 'border-border hover:bg-gray-50'}`}>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${form.client_type === 'business' ? 'border-primary' : 'border-gray-300'}`}>
                  {form.client_type === 'business' && <div className="w-2 h-2 rounded-full bg-primary" />}
                  <input type="radio" name="client_type" value="business" checked={form.client_type === 'business'} onChange={(e) => setForm({ ...form, client_type: e.target.value })} className="absolute opacity-0" />
                </div>
                <span className="font-medium">Business</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Client ID</label>
              <input value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} className={inputClass} placeholder="Leave blank to auto-generate" />
              <p className="text-xs text-muted mt-1">Leave blank to auto-generate</p>
            </div>
          </div>

          {form.client_type === 'individual' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Prefix</label>
                <input value={form.prefix} onChange={(e) => setForm({ ...form, prefix: e.target.value })} className={inputClass} placeholder="Mr/Ms" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">First Name *</label>
                <input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value.toUpperCase() })} required className={inputClass} placeholder="John" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Middle Name</label>
                <input value={form.middle_name} onChange={(e) => setForm({ ...form, middle_name: e.target.value.toUpperCase() })} className={inputClass} placeholder="Middle name" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Last Name</label>
                <input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value.toUpperCase() })} className={inputClass} placeholder="Doe" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Business Name *</label>
                <input value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value.toUpperCase() })} required className={inputClass} placeholder="Business name" />
              </div>
            </div>
          )}

          <div className="border-t border-border pt-4">
            <h4 className="text-sm font-semibold mb-3">Contact Information</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Mobile Number *</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required className={inputClass} placeholder="+254 XXX XXX XXX" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Alternative Contact</label>
                <input value={form.alternative_contact} onChange={(e) => setForm({ ...form, alternative_contact: e.target.value })} className={inputClass} placeholder="Alternative phone" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} placeholder="client@example.com" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tax Number</label>
                <input value={form.tax_number} onChange={(e) => setForm({ ...form, tax_number: e.target.value })} className={inputClass} placeholder="P051234567Z" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Opening Balance</label>
                <input type="number" step="0.01" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: Number(e.target.value) })} className={inputClass} placeholder="0.00" />
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <h4 className="text-sm font-semibold mb-3">Address</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Address</label>
                <textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} className={inputClass} placeholder="Street address" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Country</label>
                  <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className={inputClass} placeholder="Kenya" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">City</label>
                  <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className={inputClass} placeholder="Nairobi" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Street Name</label>
                  <input value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} className={inputClass} placeholder="Street name" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Building Name/No.</label>
                  <input value={form.building} onChange={(e) => setForm({ ...form, building: e.target.value })} className={inputClass} placeholder="Building name" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Zip Code</label>
                  <input value={form.zip_code} onChange={(e) => setForm({ ...form, zip_code: e.target.value })} className={inputClass} placeholder="00100" />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 text-sm font-medium border border-border rounded-xl hover:bg-background transition-colors text-muted hover:text-foreground">Cancel</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-primary text-white rounded-xl hover:bg-primary-dark disabled:opacity-50 transition-colors">
              {saving ? 'Saving...' : 'Add Client'}
            </button>
          </div>
        </form>
      </Modal>


    </>
  );
}
