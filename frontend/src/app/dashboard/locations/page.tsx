'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useLocations, type Location } from '@/lib/locations-context';
import { api } from '@/lib/api';
import PageHeader from '@/components/ui/page-header';
import Modal from '@/components/ui/modal';

const emptyForm = {
  name: '', location_id: '', landmark: '', country: '', city: '',
  zip_code: '', mobile: '', alternate_number: '', email: '', website: '',
  custom_field1: '', custom_field2: '', custom_field3: '', custom_field4: '',
};

export default function LocationsPage() {
  const { token } = useAuth();
  const { locations, loading, refresh: fetchLocations } = useLocations();
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm);
    setError('');
    setShowModal(true);
  };

  const openEdit = (loc: Location) => {
    setEditId(loc.id);
    setForm({
      name: loc.name, location_id: loc.location_id || '', landmark: loc.landmark || '',
      country: loc.country, city: loc.city, zip_code: loc.zip_code,
      mobile: loc.mobile || '', alternate_number: loc.alternate_number || '',
      email: loc.email || '', website: loc.website || '',
      custom_field1: loc.custom_field1 || '', custom_field2: loc.custom_field2 || '',
      custom_field3: loc.custom_field3 || '', custom_field4: loc.custom_field4 || '',
    });
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) { setError('You must be logged in'); return; }
    setSaving(true);
    setError('');
    try {
      if (editId) {
        await api.put(`/locations/${editId}`, form, token);
      } else {
        await api.post('/locations', form, token);
      }
      setShowModal(false);
      fetchLocations();
    } catch (err: unknown) {
      const e = err as { errors?: Record<string, string[]>; message?: string };
      setError(e.errors ? Object.values(e.errors).flat().join(', ') : e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (id: number) => {
    await api.post(`/locations/${id}/toggle-active`, undefined, token!);
    fetchLocations();
  };

  const deleteLocation = async (id: number) => {
    if (!confirm('Delete this location?')) return;
    await api.delete(`/locations/${id}`, token!);
    fetchLocations();
  };

  const inputClass = 'w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-sm';

  return (
    <>
      <PageHeader
        title="Firm Locations"
        description="Manage your firm locations"
        action={
          <button onClick={openCreate} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark text-sm font-medium">
            + Add Location
          </button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>
      ) : locations.length === 0 ? (
        <div className="text-center py-12 text-muted">No locations found. Add your first location.</div>
      ) : (
        <div className="bg-card-bg rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-gray-50/50">
                <th className="w-12 px-4 py-3"></th>
                <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider">Location ID</th>
                <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider">Address</th>
                <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider">Contact</th>
                <th className="text-center px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {locations.map((loc) => (
                <tr key={loc.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 text-center relative">
                    <button
                      onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === loc.id ? null : loc.id); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors shadow-sm"
                    >
                      Action
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {openDropdown === loc.id && (
                      <div ref={dropdownRef} className="absolute left-0 top-full mt-1 w-44 bg-white rounded-lg shadow-lg border border-border z-50 py-1 text-left">
                        <button
                          onClick={() => { openEdit(loc); setOpenDropdown(null); }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit
                        </button>
                        <button
                          onClick={() => { toggleActive(loc.id); setOpenDropdown(null); }}
                          className={`flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors ${loc.is_active ? 'text-orange-600 hover:bg-orange-50' : 'text-green-600 hover:bg-green-50'}`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          {loc.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <hr className="my-1 border-border" />
                        <button
                          onClick={() => { deleteLocation(loc.id); setOpenDropdown(null); }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-danger hover:bg-red-50 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium">{loc.name}</td>
                  <td className="px-4 py-3 text-muted">{loc.location_id || '—'}</td>
                  <td className="px-4 py-3 text-muted max-w-[200px] truncate" title={[loc.landmark, loc.city, loc.country, loc.zip_code].filter(Boolean).join(', ')}>
                    {[loc.landmark, loc.city, loc.country, loc.zip_code].filter(Boolean).join(', ')}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {[loc.mobile, loc.email].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${loc.is_active ? 'bg-green-100 text-success' : 'bg-red-100 text-danger'}`}>
                      {loc.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editId ? 'Edit Location' : 'Add Location'} size="lg">
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {error && <div className="bg-red-50 text-danger text-sm px-4 py-3 rounded-lg">{error}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">Location Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Location ID</label>
              <input value={form.location_id} onChange={(e) => setForm({ ...form, location_id: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Country *</label>
              <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} required className={inputClass} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">City *</label>
              <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Zip Code *</label>
              <input value={form.zip_code} onChange={(e) => setForm({ ...form, zip_code: e.target.value })} required className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">Landmark</label>
              <input value={form.landmark} onChange={(e) => setForm({ ...form, landmark: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Mobile</label>
              <input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Alternate Number</label>
              <input value={form.alternate_number} onChange={(e) => setForm({ ...form, alternate_number: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Website</label>
              <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className={inputClass} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50">
              {saving ? 'Saving...' : editId ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
