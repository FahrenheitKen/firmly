'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import PageHeader from '@/components/ui/page-header';
import Modal from '@/components/ui/modal';

interface TaxRate { id: number; name: string; amount: string; is_active: boolean }

export default function TaxRatesPage() {
  const { token, isOwner, can } = useAuth();
  const hasAccess = isOwner || can('business_settings.access');
  const { toast } = useToast();

  const [rates, setRates] = useState<TaxRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', amount: '' });

  const fetchRates = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api.get<{ tax_rates: TaxRate[] }>('/tax-rates', token);
      setRates(res.tax_rates);
    } catch { toast('Failed to load tax rates', 'error'); }
    finally { setLoading(false); }
  }, [token]); // eslint-disable-line

  useEffect(() => { fetchRates(); }, [fetchRates]);

  const openCreate = () => {
    setForm({ name: '', amount: '' });
    setEditingId(null);
    setError('');
    setShowModal(true);
  };

  const openEdit = (rate: TaxRate) => {
    setForm({ name: rate.name, amount: rate.amount });
    setEditingId(rate.id);
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !form.name.trim() || !form.amount) return;
    setSaving(true);
    setError('');
    try {
      const payload = { name: form.name, amount: Number(form.amount) };
      if (editingId) {
        await api.put(`/tax-rates/${editingId}`, payload, token);
        toast('Tax rate updated', 'success');
      } else {
        await api.post('/tax-rates', payload, token);
        toast('Tax rate created', 'success');
      }
      setShowModal(false);
      fetchRates();
    } catch (err: unknown) {
      const errObj = err as { errors?: Record<string, string[]>; message?: string };
      setError(errObj.errors ? Object.values(errObj.errors).flat().join(', ') : errObj.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const toggleActive = async (rate: TaxRate) => {
    try {
      await api.put(`/tax-rates/${rate.id}`, { is_active: !rate.is_active }, token!);
      fetchRates();
      toast(rate.is_active ? 'Tax rate deactivated' : 'Tax rate activated', 'success');
    } catch { toast('Failed to update', 'error'); }
  };

  const deleteRate = async (id: number) => {
    if (!confirm('Delete this tax rate?')) return;
    try {
      await api.delete(`/tax-rates/${id}`, token!);
      fetchRates();
      toast('Tax rate deleted', 'success');
    } catch { toast('Failed to delete', 'error'); }
  };

  const inputClass = 'w-full px-3.5 py-2.5 bg-card-bg border border-border rounded-xl focus:outline-none focus:border-primary focus:ring-0 text-sm transition-colors';

  if (!hasAccess) {
    return <div className="text-center py-16 text-muted">You do not have access to this page.</div>;
  }

  return (
    <>
      <PageHeader
        title="Tax Rates"
        description="Manage applicable tax rates for expenses"
        action={
          <button onClick={openCreate} className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark text-sm font-medium">
            + Add Tax Rate
          </button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>
      ) : rates.length === 0 ? (
        <div className="text-center py-16 text-muted">No tax rates yet. Add your first tax rate.</div>
      ) : (
        <div className="bg-card-bg rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider">Rate (%)</th>
                <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rates.map((rate) => (
                <tr key={rate.id} className="border-b border-border last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{rate.name}</td>
                  <td className="px-4 py-3 text-muted">{rate.amount}%</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${rate.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {rate.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => toggleActive(rate)} className={`text-xs font-medium hover:underline ${rate.is_active ? 'text-muted' : 'text-green-600'}`}>
                        {rate.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button onClick={() => openEdit(rate)} className="text-xs text-accent hover:underline font-medium">Edit</button>
                      <button onClick={() => deleteRate(rate.id)} className="text-xs text-danger hover:underline font-medium">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 text-xs text-muted border-t border-border bg-gray-50/50">
            {rates.length} tax rate{rates.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingId ? 'Edit Tax Rate' : 'Add Tax Rate'} size="sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="bg-danger/5 border border-danger/20 text-danger text-sm px-4 py-3 rounded-lg">{error}</div>}
          <div>
            <label className="block text-sm font-medium mb-1">Name *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder="e.g. VAT, WHT" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Rate (%) *</label>
            <input type="number" step="0.01" min="0" max="100" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={inputClass} placeholder="e.g. 16" required />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 text-sm font-medium border border-border rounded-xl hover:bg-background transition-colors text-muted hover:text-foreground">Cancel</button>
            <button type="submit" disabled={saving || !form.name.trim() || !form.amount} className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-primary text-white rounded-xl hover:bg-primary-dark disabled:opacity-50 transition-colors">
              {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
