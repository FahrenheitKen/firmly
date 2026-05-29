'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import PageHeader from '@/components/ui/page-header';
import Modal from '@/components/ui/modal';
import TablePagination from '@/components/ui/table-pagination';
import Link from 'next/link';

interface LinkedCase {
  id: number;
  our_reference: string | null;
  title: string;
  status: string;
}

interface OpposingCounsel {
  id: number;
  name: string;
  firm: string | null;
  phone: string | null;
  email: string | null;
  cases: LinkedCase[];
}

const statusColors: Record<string, string> = {
  'Open': 'bg-blue-50 text-blue-700',
  'In Progress': 'bg-yellow-50 text-yellow-700',
  'Closed': 'bg-gray-100 text-gray-600',
  'On Hold': 'bg-orange-50 text-orange-700',
};

export default function OpposingCounselPage() {
  const { token, can } = useAuth();
  const canUpdate = can('case.update');
  const { toast: showToast } = useToast();
  const [counsels, setCounsels] = useState<OpposingCounsel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', firm: '', phone: '', email: '' });

  const fetchCounsels = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api.get<{ opposing_counsels: OpposingCounsel[] }>('/opposing-counsels', token);
      setCounsels(res.opposing_counsels);
    } catch {
      showToast('Failed to load opposing counsels', 'error');
    } finally {
      setLoading(false);
    }
  }, [token]); // eslint-disable-line

  useEffect(() => {
    fetchCounsels();
  }, [fetchCounsels]);

  const allFiltered = search
    ? counsels.filter((oc) => {
        const q = search.toLowerCase();
        return (
          oc.name.toLowerCase().includes(q) ||
          (oc.firm && oc.firm.toLowerCase().includes(q)) ||
          (oc.email && oc.email.toLowerCase().includes(q)) ||
          oc.cases.some((c) => (c.our_reference || '').toLowerCase().includes(q) || c.title.toLowerCase().includes(q))
        );
      })
    : counsels;
  const totalFiltered = allFiltered.length;
  const lastPage = Math.max(1, Math.ceil(totalFiltered / perPage));
  const safePage = Math.min(page, lastPage);
  const filtered = allFiltered.slice((safePage - 1) * perPage, safePage * perPage);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || (!form.name.trim() && !form.firm.trim())) return;
    setSaving(true);
    setError('');
    try {
      await api.post('/opposing-counsels', form, token);
      setShowModal(false);
      setForm({ name: '', firm: '', phone: '', email: '' });
      fetchCounsels();
      showToast('Opposing counsel added', 'success');
    } catch (err: unknown) {
      const e = err as { errors?: Record<string, string[]>; message?: string };
      setError(e.errors ? Object.values(e.errors).flat().join(', ') : e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full px-3.5 py-2.5 bg-card-bg border border-border rounded-xl focus:outline-none focus:border-primary focus:ring-0 text-sm transition-colors';

  return (
    <>
      <PageHeader
        title="Opposing Counsel"
        description="Manage opposing counsels and linked cases"
        action={
          canUpdate ? (
            <button onClick={() => { setForm({ name: '', firm: '', phone: '', email: '' }); setError(''); setShowModal(true); }} className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark text-sm font-medium">
              + Add Opposing Counsel
            </button>
          ) : null
        }
      />

      <div className="mb-4 relative">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          placeholder="Search by name, firm, or linked case..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full pl-10 pr-4 py-2.5 bg-card-bg border border-border rounded-xl focus:outline-none focus:border-primary text-sm transition-colors"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>
      ) : allFiltered.length === 0 ? (
        <div className="text-center py-16 text-muted">
          {search ? 'No opposing counsels match your search.' : 'No opposing counsels yet.'}
        </div>
      ) : (
        <div className="bg-card-bg rounded-xl border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider">Firm</th>
                <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider hidden md:table-cell">Phone</th>
                <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider hidden md:table-cell">Email</th>
                <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider">Linked Cases</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((oc) => (
                <tr key={oc.id} className="border-b border-border last:border-0 hover:bg-gray-50 align-top">
                  <td className="px-4 py-3 font-medium">{oc.firm || oc.name || '-'}</td>
                  <td className="px-4 py-3 text-muted hidden md:table-cell">{oc.phone || '-'}</td>
                  <td className="px-4 py-3 text-muted hidden md:table-cell">{oc.email || '-'}</td>
                  <td className="px-4 py-3">
                    {oc.cases.length === 0 ? (
                      <span className="text-muted">-</span>
                    ) : (
                      <div className="space-y-1">
                        {oc.cases.map((c) => (
                          <Link key={c.id} href={`/dashboard/cases/${c.id}`} className="flex items-center gap-2 group">
                            <span className="text-xs font-mono text-primary group-hover:underline">{c.our_reference || c.title}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${statusColors[c.status] || ''}`}>{c.status}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <TablePagination
            currentPage={safePage}
            lastPage={lastPage}
            perPage={perPage}
            total={totalFiltered}
            onPageChange={(p) => setPage(p)}
            onPerPageChange={(pp) => { setPerPage(pp); setPage(1); }}
          />
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Opposing Counsel" size="sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="bg-danger/5 border border-danger/20 text-danger text-sm px-4 py-3 rounded-lg">{error}</div>}
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder="Full name" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Firm</label>
            <input value={form.firm} onChange={(e) => setForm({ ...form, firm: e.target.value })} className={inputClass} placeholder="Law firm" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClass} placeholder="Phone number" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} placeholder="Email address" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 text-sm font-medium border border-border rounded-xl hover:bg-background transition-colors text-muted hover:text-foreground">Cancel</button>
            <button type="submit" disabled={saving || (!form.name.trim() && !form.firm.trim())} className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-primary text-white rounded-xl hover:bg-primary-dark disabled:opacity-50 transition-colors">
              {saving ? 'Saving...' : 'Add Counsel'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
