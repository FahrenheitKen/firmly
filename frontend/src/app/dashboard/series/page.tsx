'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import PageHeader from '@/components/ui/page-header';
import Modal from '@/components/ui/modal';
import SearchableSelect from '@/components/ui/searchable-select';
import TablePagination from '@/components/ui/table-pagination';

interface Client {
  id: number;
  first_name: string | null;
  last_name: string | null;
  business_name: string | null;
  client_type: string;
  client_prefix?: string | null;
  city?: string | null;
}

interface User {
  id: number;
  first_name: string;
  last_name: string;
}

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
  const { token, user, can, isOwner } = useAuth();
  const canCreate = isOwner || can('case.create');
  const { toast } = useToast();

  const [series, setSeries] = useState<SeriesItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, per_page: 25, total: 0 });

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title: '', client_id: '', assigned_to: '', client_reference: '', our_reference: '', common_parties: '',
    court: '', court_number_filed: '', judge: '',
  });
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [businessName, setBusinessName] = useState('');
  const [businessId, setBusinessId] = useState(0);
  const [caseFormat, setCaseFormat] = useState('');
  const [caseCounter, setCaseCounter] = useState(0);

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

  const getInitials = (name?: string | null) => {
    if (!name) return '';
    const skip = ['&', 'and', 'company', 'advocate', 'advocates', 'attorney', 'attorneys', 'associate', 'associates', 'law', 'legal', 'firm', 'partners', 'partnership', 'llp', 'ltd', 'limited', 'inc', 'llc', 'plc', 'corporation', 'corp', 'co', 'group'];
    return name.trim().split(/\s+/).filter(w => !skip.includes(w.toLowerCase())).map(w => w[0]).join('').toUpperCase();
  };

  const getCityAbbrev = (city?: string | null) => {
    if (!city) return '';
    const c = city.toUpperCase().trim();
    const map: Record<string, string> = {
      'NAIROBI': 'NRB', 'MOMBASA': 'MSA', 'KISUMU': 'KSM',
      'NAKURU': 'NKU', 'ELDORET': 'ELD', 'THIKA': 'THK',
      'MACHAKOS': 'MCK', 'MALINDI': 'MYD', 'NANYUKI': 'NYK',
      'NYERI': 'NYR', 'KAKAMEGA': 'KKM', 'KITALE': 'KTL',
      'MERU': 'MRU', 'EMBU': 'EMB', 'KISII': 'KSI',
    };
    return map[c] || c.slice(0, 3);
  };

  const generateOurRef = (bizName: string, bizId: number, clientId: string, fmt: string, counter: number, locationCity?: string | null) => {
    const fi = getInitials(bizName);
    const client = clients.find(c => String(c.id) === clientId);
    const cp = client
      ? (client.client_type === 'individual'
          ? [client.first_name, client.last_name].filter(Boolean).map((n) => (n as string)[0].toUpperCase()).join('')
          : (client.client_prefix || (client.business_name ? getInitials(client.business_name) : '')))
      : '';
    const ct = getCityAbbrev(locationCity);
    const seq = String(counter + 1).padStart(3, '0');
    const yr = new Date().getFullYear().toString();
    const ref = fmt.replace(/\{(\w+)\}/g, (_, key) => {
      const map: Record<string, string> = { FI: fi, BI: String(bizId), CP: cp, CT: ct, N: seq, Y: yr };
      return map[key] || '';
    });
    return ref;
  };

  const openCreate = () => {
    setForm({ title: '', client_id: '', assigned_to: '', client_reference: '', our_reference: '', common_parties: '', court: '', court_number_filed: '', judge: '' });
    setError('');
    setShowModal(true);
    if (!token) return;
    Promise.all([
      api.get<{ clients: Client[] }>('/clients?per_page=500', token),
      api.get<{ users: User[] }>('/users?per_page=500', token),
      api.get<{ business: Record<string, unknown> }>('/business', token),
    ]).then(([cRes, uRes, bRes]) => {
      setClients(cRes.clients);
      setUsers(uRes.users);
      const b = bRes.business;
      const refPrefixes = (b.ref_no_prefixes as Record<string, string>) || {};
      const fmt = refPrefixes.case_number_format || '{FI}/{CP}/{CT}/{N}/{Y}';
      const counter = (b.case_counter as number) || 0;
      setBusinessName(b.name as string);
      setBusinessId(b.id as number);
      setCaseFormat(fmt);
      setCaseCounter(counter);
      setForm((prev) => ({ ...prev, our_reference: generateOurRef(b.name as string, b.id as number, '', fmt, counter, user?.active_location?.city) }));
    }).catch(() => {});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!form.title.trim()) { setError('Subject is required'); return; }
    setSaving(true);
    setError('');
    try {
      const seriesRes = await api.post<{ series: { id: number } }>('/case-series', {
        reference: form.our_reference,
        name: form.title,
        common_parties: form.common_parties || null,
      }, token);
      const seriesId = seriesRes.series.id;

      await api.post(`/case-series/${seriesId}/cases`, {
        title: form.title,
        client_id: form.client_id || null,
        assigned_to: form.assigned_to || null,
        client_reference: form.client_reference || null,
        court: form.court || null,
        court_number_filed: form.court_number_filed || null,
        judge: form.judge || null,
      }, token);

      setShowModal(false);
      fetchSeries();
      toast('Series case created successfully', 'success');
    } catch (err: unknown) {
      const errObj = err as { errors?: Record<string, string[]>; message?: string };
      setError(errObj.errors ? Object.values(errObj.errors).flat().join(', ') : errObj.message || 'Failed to create series case');
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
        <div className="bg-card-bg rounded-xl border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider">Reference</th>
                <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider hidden sm:table-cell">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider hidden md:table-cell">Defendant</th>
                <th className="text-center px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider w-20">Cases</th>
                <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider hidden lg:table-cell">Parent</th>
                <th className="text-right px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {series.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/series/${s.id}`} className="font-medium text-primary hover:underline font-mono text-xs">{s.reference}</Link>
                    <div className="text-xs text-muted sm:hidden mt-0.5">{s.name}</div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">{s.name}</td>
                  <td className="px-4 py-3 text-muted hidden md:table-cell truncate max-w-[200px]">{s.common_parties || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold">{s.active_cases_count}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {s.parent_series ? (
                      <Link href={`/dashboard/series/${s.parent_series.id}`} className="text-xs text-primary hover:underline">{s.parent_series.reference}</Link>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/dashboard/series/${s.id}`} className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 bg-primary/5 border border-primary/20 rounded-lg hover:bg-primary/10 transition-all text-primary">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      View
                    </Link>
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

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Series Case" size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="bg-danger/5 border border-danger/20 text-danger text-sm px-4 py-3 rounded-lg">{error}</div>}

          <div>
            <label className="block text-sm font-medium mb-1">Subject *</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value.toUpperCase() })} className={inputClass} placeholder="Series case subject" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Defendant (Common Party)</label>
            <input value={form.common_parties} onChange={(e) => setForm({ ...form, common_parties: e.target.value.toUpperCase() })} className={inputClass} placeholder="Defendant (Common Party)" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SearchableSelect
              label="Client"
              value={form.client_id}
              onChange={(v) => {
                setForm((prev) => ({ ...prev, client_id: v, our_reference: generateOurRef(businessName, businessId, v, caseFormat, caseCounter, user?.active_location?.city) }));
              }}
              options={[{ value: '', label: 'Select client' }, ...clients.map((c) => ({ value: String(c.id), label: c.client_type === 'business' ? c.business_name || '' : `${c.first_name || ''} ${c.last_name || ''}`.trim() }))]}
              placeholder="Search client..."
            />
            <SearchableSelect
              label="Assigned To"
              value={form.assigned_to}
              onChange={(v) => setForm((prev) => ({ ...prev, assigned_to: v }))}
              options={[{ value: '', label: 'Select user' }, ...users.map((u) => ({ value: String(u.id), label: `${u.first_name} ${u.last_name}`.trim() }))]}
              placeholder="Search user..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Client Reference</label>
              <input value={form.client_reference} onChange={(e) => setForm({ ...form, client_reference: e.target.value.toUpperCase() })} className={inputClass} placeholder="Client's reference number" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Our Reference</label>
              <input value={form.our_reference} onChange={(e) => setForm({ ...form, our_reference: e.target.value })} className={inputClass} placeholder="Our reference" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Station</label>
              <input value={form.court} onChange={(e) => setForm({ ...form, court: e.target.value })} className={inputClass} placeholder="Station name" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Before Court No</label>
              <input value={form.court_number_filed} onChange={(e) => setForm({ ...form, court_number_filed: e.target.value.toUpperCase() })} className={inputClass} placeholder="Before court no" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Magistrate/Judge</label>
              <input value={form.judge} onChange={(e) => setForm({ ...form, judge: e.target.value })} className={inputClass} placeholder="Magistrate or Judge name" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 text-sm font-medium border border-border rounded-xl hover:bg-background transition-colors text-muted hover:text-foreground">Cancel</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-primary text-white rounded-xl hover:bg-primary-dark disabled:opacity-50 transition-colors">
              {saving ? 'Creating...' : 'Create Series Case'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
