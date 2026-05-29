'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import PageHeader from '@/components/ui/page-header';
import Modal from '@/components/ui/modal';
import TablePagination from '@/components/ui/table-pagination';

interface SeriesItem {
  id: number;
  reference: string;
  name: string;
  common_parties: string | null;
  notes: string | null;
  active_cases_count: number;
  parent_series?: { id: number; reference: string; name: string } | null;
  child_series?: { id: number; reference: string; name: string }[];
  created_by_user?: { id: number; first_name: string; last_name: string } | null;
  created_at: string;
}

export default function SeriesPage() {
  const { token, can, isOwner } = useAuth();
  const canCreate = isOwner || can('case.create');
  const canUpdate = isOwner || can('case.update');
  const canDelete = isOwner || can('case.delete');
  const { toast } = useToast();
  const router = useRouter();

  const [series, setSeries] = useState<SeriesItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, per_page: 25, total: 0 });

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ reference: '', name: '', common_parties: '', notes: '', parent_series_id: '' });
  const [allSeries, setAllSeries] = useState<{ id: number; reference: string; name: string }[]>([]);
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);

  useEffect(() => {
    if (openDropdown === null) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.dropdown-menu')) setOpenDropdown(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openDropdown]);

  const fetchSeries = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    params.set('page', String(page));
    params.set('per_page', String(perPage));
    try {
      const res = await api.get<{ series: SeriesItem[]; pagination: typeof pagination }>(`/case-series?${params}`, token);
      setSeries(res.series);
      if (res.pagination) setPagination(res.pagination);
    } catch { toast('Failed to load series', 'error'); }
    finally { setLoading(false); }
  }, [token, search, page, perPage]); // eslint-disable-line

  useEffect(() => {
    const timer = setTimeout(fetchSeries, 300);
    return () => clearTimeout(timer);
  }, [fetchSeries]);

  const loadAllSeries = async () => {
    if (!token) return;
    try {
      const res = await api.get<{ series: { id: number; reference: string; name: string }[] }>('/case-series?per_page=100', token);
      setAllSeries(res.series);
    } catch { /* ignore */ }
  };

  const openCreate = async () => {
    setEditingId(null);
    setForm({ reference: '', name: '', common_parties: '', notes: '', parent_series_id: '' });
    setError('');
    setShowModal(true);
    loadAllSeries();
  };

  const viewSeries = (id: number) => {
    setOpenDropdown(null);
    router.push(`/dashboard/series/${id}`);
  };

  const openEdit = (s: SeriesItem) => {
    setOpenDropdown(null);
    setEditingId(s.id);
    setForm({
      reference: s.reference,
      name: s.name,
      common_parties: s.common_parties ?? '',
      notes: s.notes ?? '',
      parent_series_id: s.parent_series?.id ? String(s.parent_series.id) : '',
    });
    setError('');
    setShowModal(true);
    loadAllSeries();
  };

  const deleteSeries = async (id: number) => {
    setOpenDropdown(null);
    if (!confirm('Delete this series? Its cases will be detached but not deleted.')) return;
    try {
      await api.delete(`/case-series/${id}`, token!);
      toast('Series deleted', 'success');
      fetchSeries();
    } catch (err: unknown) {
      toast((err as { message?: string }).message || 'Failed to delete series', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError('');
    const payload = { ...form, parent_series_id: form.parent_series_id || null };
    try {
      if (editingId) {
        await api.put(`/case-series/${editingId}`, payload, token);
        toast('Series updated', 'success');
      } else {
        await api.post('/case-series', payload, token);
        toast('Series created', 'success');
      }
      setShowModal(false);
      fetchSeries();
    } catch (err: unknown) {
      const errObj = err as { errors?: Record<string, string[]>; message?: string };
      setError(errObj.errors ? Object.values(errObj.errors).flat().join(', ') : errObj.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const inputClass = 'w-full px-3.5 py-2.5 bg-card-bg border border-border rounded-xl focus:outline-none focus:border-primary focus:ring-0 text-sm transition-colors';

  return (
    <>
      <PageHeader
        title="Series Cases"
        description="Group related cases for bulk actions"
        action={canCreate ? (
          <button onClick={openCreate} className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark text-sm font-medium">
            + New Series
          </button>
        ) : null}
      />

      {!loading && (
        <div className="mb-4 relative max-w-md">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            placeholder="Search by reference or name..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 bg-card-bg border border-border rounded-xl focus:outline-none focus:border-primary text-sm"
          />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>
      ) : series.length === 0 ? (
        <div className="text-center py-16 text-muted">{search ? 'No series match your search.' : 'No case series yet. Create one to group related cases.'}</div>
      ) : (
        <div className="bg-card-bg rounded-xl border border-border overflow-visible">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-gray-50">
                <th className="w-16 sm:w-24 px-2 sm:px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider text-left">Actions</th>
                <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider">Reference</th>
                <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider hidden sm:table-cell">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider hidden md:table-cell">Defendant</th>
                <th className="text-center px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider w-20">Cases</th>
              </tr>
            </thead>
            <tbody>
              {series.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0 hover:bg-gray-50">
                  <td className="px-2 sm:px-4 py-3 relative">
                    <button
                      onClick={() => setOpenDropdown(openDropdown === s.id ? null : s.id)}
                      className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors shadow-sm"
                    >
                      <span className="hidden sm:inline">Action</span>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {openDropdown === s.id && (
                      <div className="dropdown-menu absolute left-0 top-full mt-1 w-44 bg-white rounded-lg shadow-lg border border-border z-50 py-1 text-left">
                        <button onClick={() => viewSeries(s.id)} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-primary hover:bg-primary/5 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          View
                        </button>
                        {canUpdate && (
                          <button onClick={() => openEdit(s)} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-accent hover:bg-accent/5 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            Edit
                          </button>
                        )}
                        {canDelete && (
                          <>
                            <hr className="my-1 border-border" />
                            <button onClick={() => deleteSeries(s.id)} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-danger hover:bg-danger/5 transition-colors">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/series/${s.id}`} className="font-medium text-primary hover:underline font-mono text-xs">{s.reference}</Link>
                    <div className="text-xs text-muted sm:hidden mt-0.5">{s.name}</div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">{s.name}</td>
                  <td className="px-4 py-3 text-muted hidden md:table-cell truncate max-w-[200px]">{s.common_parties || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold">{s.active_cases_count}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <TablePagination
            currentPage={pagination.current_page}
            lastPage={pagination.last_page}
            perPage={pagination.per_page}
            total={pagination.total}
            onPageChange={(p) => setPage(p)}
            onPerPageChange={(pp) => { setPerPage(pp); setPage(1); }}
          />
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingId ? 'Edit Case Series' : 'New Case Series'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="bg-danger/5 border border-danger/20 text-danger text-sm px-4 py-3 rounded-lg">{error}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Series Reference *</label>
              <input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className={inputClass} placeholder="e.g. WWA/GA/NKU/532/25" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Series Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder="e.g. Easy Coach Accident Series" required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Common Parties (Defendant Side)</label>
            <input value={form.common_parties} onChange={(e) => setForm({ ...form, common_parties: e.target.value })} className={inputClass} placeholder="e.g. Easy Coach Ltd & Anor" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Parent Series (for nesting)</label>
            <select value={form.parent_series_id} onChange={(e) => setForm({ ...form, parent_series_id: e.target.value })} className={inputClass}>
              <option value="">None (top-level)</option>
              {allSeries.filter(s => s.id !== editingId).map(s => <option key={s.id} value={s.id}>{s.reference} — {s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className={inputClass} placeholder="Optional notes about this series" />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 text-sm font-medium border border-border rounded-xl hover:bg-background transition-colors text-muted hover:text-foreground">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2.5 text-sm font-medium bg-primary text-white rounded-xl hover:bg-primary-dark disabled:opacity-50 transition-colors">
              {saving ? 'Saving...' : (editingId ? 'Save Changes' : 'Create Series')}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
