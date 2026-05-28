'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import { useFormatDate } from '@/lib/date';
import Modal from '@/components/ui/modal';
import SearchableSelect from '@/components/ui/searchable-select';
import DatePicker from '@/components/ui/date-picker';

interface CaseInSeries {
  id: number;
  series_suffix: string | null;
  case_number: string | null;
  title: string;
  our_reference: string | null;
  status: string;
  assigned_to?: { id: number; first_name: string; last_name: string } | null;
  client?: { id: number; first_name: string | null; last_name: string | null; business_name: string | null } | null;
}

interface SeriesDetail {
  id: number;
  reference: string;
  name: string;
  common_parties: string | null;
  notes: string | null;
  last_suffix: string;
  active_cases_count: number;
  parent_series?: { id: number; reference: string; name: string } | null;
  child_series?: { id: number; parent_series_id: number; reference: string; name: string }[];
  created_by_user?: { id: number; first_name: string; last_name: string } | null;
  active_cases: CaseInSeries[];
}

interface ClientLite { id: number; first_name: string | null; last_name: string | null; business_name: string | null }
interface UserLite { id: number; first_name: string; last_name: string }
interface OcLite { id: number; name: string }

const statusColors: Record<string, string> = {
  Open: 'bg-blue-50 text-blue-700',
  'In Progress': 'bg-yellow-50 text-yellow-700',
  Closed: 'bg-green-50 text-green-700',
};

export default function SeriesDetailPage() {
  const { token, can, isOwner } = useAuth();
  const canCreate = isOwner || can('case.create');
  const canUpdate = isOwner || can('case.update');
  const { toast } = useToast();
  const formatDate = useFormatDate();
  const params = useParams();
  const id = params.id as string;

  const [series, setSeries] = useState<SeriesDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const [showCaseModal, setShowCaseModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showProceedingModal, setShowProceedingModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [clients, setClients] = useState<ClientLite[]>([]);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [counsels, setCounsels] = useState<OcLite[]>([]);

  const [caseForm, setCaseForm] = useState({
    title: '', client_id: '', client_reference: '', opposing_counsel_id: '',
    assigned_to: '', case_number: '', court: '', court_number_filed: '',
    judge: '', case_type: 'Defendant', filed_date: '', description: '',
  });

  const [eventForm, setEventForm] = useState({ event_type: 'Mention', event_date: '', exclude_case_ids: [] as number[] });
  const [proceedingForm, setProceedingForm] = useState({
    before_court_no: '', magistrate: '', instruction: '', directions: '', time_spent: '', exclude_case_ids: [] as number[],
  });

  const fetchSeries = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api.get<{ series: SeriesDetail }>(`/case-series/${id}`, token);
      setSeries(res.series);
    } catch { toast('Failed to load series', 'error'); }
    finally { setLoading(false); }
  }, [token, id]); // eslint-disable-line

  useEffect(() => { fetchSeries(); }, [fetchSeries]);

  const loadFormData = async () => {
    if (!token) return;
    try {
      const [cRes, uRes, oRes] = await Promise.all([
        api.get<{ clients: ClientLite[] }>('/clients?per_page=500', token),
        api.get<{ users: UserLite[] }>('/users?per_page=500', token),
        api.get<{ opposing_counsels: OcLite[] }>('/opposing-counsels?per_page=500', token),
      ]);
      setClients(cRes.clients);
      setUsers(uRes.users);
      setCounsels(oRes.opposing_counsels);
    } catch { /* ignore */ }
  };

  const openCreateCase = () => {
    setCaseForm({ title: '', client_id: '', client_reference: '', opposing_counsel_id: '', assigned_to: '', case_number: '', court: '', court_number_filed: '', judge: '', case_type: 'Defendant', filed_date: '', description: '' });
    setError('');
    setShowCaseModal(true);
    loadFormData();
  };

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(caseForm)) {
        payload[k] = v || null;
      }
      await api.post(`/case-series/${id}/cases`, payload, token);
      toast('Case created in series', 'success');
      setShowCaseModal(false);
      fetchSeries();
    } catch (err: unknown) {
      const e = err as { errors?: Record<string, string[]>; message?: string };
      setError(e.errors ? Object.values(e.errors).flat().join(', ') : e.message || 'Failed to create');
    } finally { setSaving(false); }
  };

  const handleBulkEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError('');
    try {
      const res = await api.post<{ message: string }>(`/case-series/${id}/bulk-event`, eventForm, token);
      toast(res.message, 'success');
      setShowEventModal(false);
      fetchSeries();
    } catch (err: unknown) {
      const e = err as { errors?: Record<string, string[]>; message?: string };
      setError(e.errors ? Object.values(e.errors).flat().join(', ') : e.message || 'Failed');
    } finally { setSaving(false); }
  };

  const handleBulkProceeding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError('');
    try {
      const res = await api.post<{ message: string }>(`/case-series/${id}/bulk-proceeding`, proceedingForm, token);
      toast(res.message, 'success');
      setShowProceedingModal(false);
    } catch (err: unknown) {
      const e = err as { errors?: Record<string, string[]>; message?: string };
      setError(e.errors ? Object.values(e.errors).flat().join(', ') : e.message || 'Failed');
    } finally { setSaving(false); }
  };

  const detachCase = async (caseId: number) => {
    if (!confirm('Detach this case from the series? The case and its data will be preserved.')) return;
    try {
      await api.delete(`/case-series/${id}/cases/${caseId}`, token!);
      toast('Case detached', 'success');
      fetchSeries();
    } catch { toast('Failed to detach', 'error'); }
  };

  const toggleExclude = (caseId: number, formType: 'event' | 'proceeding') => {
    if (formType === 'event') {
      setEventForm(prev => ({
        ...prev,
        exclude_case_ids: prev.exclude_case_ids.includes(caseId)
          ? prev.exclude_case_ids.filter(id => id !== caseId)
          : [...prev.exclude_case_ids, caseId],
      }));
    } else {
      setProceedingForm(prev => ({
        ...prev,
        exclude_case_ids: prev.exclude_case_ids.includes(caseId)
          ? prev.exclude_case_ids.filter(id => id !== caseId)
          : [...prev.exclude_case_ids, caseId],
      }));
    }
  };

  const clientName = (c: CaseInSeries['client']) => {
    if (!c) return '-';
    return c.business_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || '-';
  };

  const inputClass = 'w-full px-3.5 py-2.5 bg-card-bg border border-border rounded-xl focus:outline-none focus:border-primary focus:ring-0 text-sm transition-colors';

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (!series) return <div className="text-center py-16 text-muted">Series not found.</div>;

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-muted mb-3">
        <Link href="/dashboard/series" className="hover:text-foreground transition-colors">Case Series</Link>
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        <span className="text-foreground font-medium">{series.reference}</span>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">{series.name}</h1>
          <p className="text-sm text-muted mt-1 font-mono">{series.reference}</p>
          {series.common_parties && <p className="text-sm text-muted mt-1">Parties: {series.common_parties}</p>}
          {series.parent_series && (
            <p className="text-xs text-muted mt-1">
              Parent: <Link href={`/dashboard/series/${series.parent_series.id}`} className="text-primary hover:underline">{series.parent_series.reference}</Link>
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {canCreate && (
            <button onClick={openCreateCase} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark text-sm font-medium">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add Case
            </button>
          )}
          {canUpdate && series.active_cases.length > 0 && (
            <>
              <button onClick={() => { setEventForm({ event_type: 'Mention', event_date: '', exclude_case_ids: [] }); setError(''); setShowEventModal(true); }} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-accent/10 border border-accent/30 text-accent rounded-lg hover:bg-accent/20 text-sm font-medium">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                Bulk Event
              </button>
              <button onClick={() => { setProceedingForm({ before_court_no: '', magistrate: '', instruction: '', directions: '', time_spent: '', exclude_case_ids: [] }); setError(''); setShowProceedingModal(true); }} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-secondary/10 border border-secondary/30 text-secondary rounded-lg hover:bg-secondary/20 text-sm font-medium">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Bulk Proceeding
              </button>
            </>
          )}
        </div>
      </div>

      {series.child_series && series.child_series.length > 0 && (
        <div className="mb-4 p-3 bg-primary/5 border border-primary/20 rounded-xl">
          <p className="text-xs font-medium text-muted uppercase tracking-wider mb-2">Sub-Series</p>
          <div className="flex flex-wrap gap-2">
            {series.child_series.map(cs => (
              <Link key={cs.id} href={`/dashboard/series/${cs.id}`} className="text-xs px-2.5 py-1.5 bg-card-bg border border-border rounded-lg hover:border-primary/30 text-primary font-mono">
                {cs.reference}
              </Link>
            ))}
          </div>
        </div>
      )}

      {series.notes && (
        <div className="mb-4 p-3 bg-gray-50 border border-border rounded-xl text-sm text-muted">{series.notes}</div>
      )}

      <div className="bg-card-bg rounded-xl border border-border overflow-visible">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <p className="text-sm font-medium">{series.active_cases.length} Case{series.active_cases.length !== 1 ? 's' : ''} in Series</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider w-16">Suffix</th>
              <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider">Our Reference</th>
              <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider hidden sm:table-cell">Case Number</th>
              <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider hidden md:table-cell">Plaintiff</th>
              <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider hidden lg:table-cell">Assigned To</th>
              <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider w-24">Status</th>
              <th className="text-right px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider w-28">Actions</th>
            </tr>
          </thead>
          <tbody>
            {series.active_cases.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted">No cases in this series yet. Add one to get started.</td></tr>
            )}
            {series.active_cases.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold">{c.series_suffix || '-'}</span>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{c.our_reference || '-'}</td>
                <td className="px-4 py-3 hidden sm:table-cell text-xs">{c.case_number || '-'}</td>
                <td className="px-4 py-3 hidden md:table-cell">{clientName(c.client)}</td>
                <td className="px-4 py-3 hidden lg:table-cell text-muted">
                  {c.assigned_to ? `${c.assigned_to.first_name} ${c.assigned_to.last_name || ''}`.trim() : '-'}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[c.status] || 'bg-gray-100 text-gray-700'}`}>{c.status}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex gap-1 justify-end">
                    <Link href={`/dashboard/cases/${c.id}`} className="text-xs font-medium px-2 py-1.5 bg-primary/5 border border-primary/20 rounded-lg hover:bg-primary/10 text-primary">View</Link>
                    {canUpdate && (
                      <button onClick={() => detachCase(c.id)} className="text-xs font-medium px-2 py-1.5 bg-danger/5 border border-danger/20 rounded-lg hover:bg-danger/10 text-danger">Detach</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Case Modal */}
      <Modal open={showCaseModal} onClose={() => setShowCaseModal(false)} title="Add Case to Series" size="xl">
        <form onSubmit={handleCreateCase} className="space-y-4">
          {error && <div className="bg-danger/5 border border-danger/20 text-danger text-sm px-4 py-3 rounded-lg">{error}</div>}
          <div className="flex items-start gap-2.5 px-4 py-3 bg-primary/5 border border-primary/20 rounded-xl text-sm text-primary">
            <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Our Reference will be auto-generated as <strong className="mx-1">{series.reference.replace(/\/[^/]*$/, '')}-{series.last_suffix ? String.fromCharCode(series.last_suffix.charCodeAt(series.last_suffix.length - 1) + 1) : 'A'}/{series.reference.split('/').pop()}</strong>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Case Title *</label>
              <input value={caseForm.title} onChange={(e) => setCaseForm({ ...caseForm, title: e.target.value })} className={inputClass} placeholder="Plaintiff name v. Easy Coach" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Case Number</label>
              <input value={caseForm.case_number} onChange={(e) => setCaseForm({ ...caseForm, case_number: e.target.value })} className={inputClass} placeholder="Court case number" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SearchableSelect
              label="Plaintiff (Client)"
              value={caseForm.client_id}
              onChange={(v) => setCaseForm({ ...caseForm, client_id: v })}
              options={[{ value: '', label: 'None' }, ...clients.map(c => ({ value: String(c.id), label: c.business_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() }))]}
              placeholder="Search client..."
            />
            <SearchableSelect
              label="Opposing Counsel"
              value={caseForm.opposing_counsel_id}
              onChange={(v) => setCaseForm({ ...caseForm, opposing_counsel_id: v })}
              options={[{ value: '', label: 'None' }, ...counsels.map(o => ({ value: String(o.id), label: o.name }))]}
              placeholder="Search counsel..."
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SearchableSelect
              label="Assigned To"
              value={caseForm.assigned_to}
              onChange={(v) => setCaseForm({ ...caseForm, assigned_to: v })}
              options={[{ value: '', label: 'None' }, ...users.map(u => ({ value: String(u.id), label: `${u.first_name} ${u.last_name || ''}`.trim() }))]}
              placeholder="Search user..."
            />
            <div>
              <label className="block text-sm font-medium mb-1">Filed Date</label>
              <DatePicker value={caseForm.filed_date} onChange={(v) => setCaseForm({ ...caseForm, filed_date: v })} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Court</label>
              <input value={caseForm.court} onChange={(e) => setCaseForm({ ...caseForm, court: e.target.value })} className={inputClass} placeholder="e.g. Nakuru CMCC" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Court No. Filed</label>
              <input value={caseForm.court_number_filed} onChange={(e) => setCaseForm({ ...caseForm, court_number_filed: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Judge</label>
              <input value={caseForm.judge} onChange={(e) => setCaseForm({ ...caseForm, judge: e.target.value })} className={inputClass} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button type="button" onClick={() => setShowCaseModal(false)} className="px-5 py-2.5 text-sm font-medium border border-border rounded-xl hover:bg-background transition-colors text-muted">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2.5 text-sm font-medium bg-primary text-white rounded-xl hover:bg-primary-dark disabled:opacity-50 transition-colors">
              {saving ? 'Creating...' : 'Create Case'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Bulk Event Modal */}
      <Modal open={showEventModal} onClose={() => setShowEventModal(false)} title="Add Event to All Cases" size="lg">
        <form onSubmit={handleBulkEvent} className="space-y-4">
          {error && <div className="bg-danger/5 border border-danger/20 text-danger text-sm px-4 py-3 rounded-lg">{error}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Event Type *</label>
              <select value={eventForm.event_type} onChange={(e) => setEventForm({ ...eventForm, event_type: e.target.value })} className={inputClass}>
                <option value="Mention">Mention</option>
                <option value="Hearing">Hearing</option>
                <option value="Bring Up">Bring Up</option>
                <option value="Ruling">Ruling</option>
                <option value="Judgement">Judgement</option>
                <option value="Hearing of Application">Hearing of Application</option>
                <option value="Mention of Application">Mention of Application</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Event Date *</label>
              <DatePicker value={eventForm.event_date} onChange={(v) => setEventForm({ ...eventForm, event_date: v })} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Include Cases</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {series.active_cases.map(c => {
                const excluded = eventForm.exclude_case_ids.includes(c.id);
                return (
                  <label key={c.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors ${excluded ? 'border-border/60 bg-background/50 text-muted' : 'border-primary/30 bg-primary/5'}`}>
                    <input type="checkbox" checked={!excluded} onChange={() => toggleExclude(c.id, 'event')} className="w-4 h-4 rounded text-primary" />
                    <span className="font-mono text-xs">{c.series_suffix || '?'}</span>
                    <span className="truncate">{c.our_reference || c.title}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button type="button" onClick={() => setShowEventModal(false)} className="px-5 py-2.5 text-sm font-medium border border-border rounded-xl hover:bg-background transition-colors text-muted">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2.5 text-sm font-medium bg-primary text-white rounded-xl hover:bg-primary-dark disabled:opacity-50 transition-colors">
              {saving ? 'Adding...' : `Add Event to ${series.active_cases.length - eventForm.exclude_case_ids.length} Case(s)`}
            </button>
          </div>
        </form>
      </Modal>

      {/* Bulk Proceeding Modal */}
      <Modal open={showProceedingModal} onClose={() => setShowProceedingModal(false)} title="Add Proceeding to All Cases" size="lg">
        <form onSubmit={handleBulkProceeding} className="space-y-4">
          {error && <div className="bg-danger/5 border border-danger/20 text-danger text-sm px-4 py-3 rounded-lg">{error}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Before Court No.</label>
              <input value={proceedingForm.before_court_no} onChange={(e) => setProceedingForm({ ...proceedingForm, before_court_no: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Magistrate</label>
              <input value={proceedingForm.magistrate} onChange={(e) => setProceedingForm({ ...proceedingForm, magistrate: e.target.value })} className={inputClass} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Instructions</label>
            <textarea value={proceedingForm.instruction} onChange={(e) => setProceedingForm({ ...proceedingForm, instruction: e.target.value })} rows={2} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Directions</label>
            <textarea value={proceedingForm.directions} onChange={(e) => setProceedingForm({ ...proceedingForm, directions: e.target.value })} rows={2} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Time Spent</label>
            <input value={proceedingForm.time_spent} onChange={(e) => setProceedingForm({ ...proceedingForm, time_spent: e.target.value })} className={inputClass} placeholder="e.g. 2 hours" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Include Cases</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {series.active_cases.map(c => {
                const excluded = proceedingForm.exclude_case_ids.includes(c.id);
                return (
                  <label key={c.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors ${excluded ? 'border-border/60 bg-background/50 text-muted' : 'border-primary/30 bg-primary/5'}`}>
                    <input type="checkbox" checked={!excluded} onChange={() => toggleExclude(c.id, 'proceeding')} className="w-4 h-4 rounded text-primary" />
                    <span className="font-mono text-xs">{c.series_suffix || '?'}</span>
                    <span className="truncate">{c.our_reference || c.title}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button type="button" onClick={() => setShowProceedingModal(false)} className="px-5 py-2.5 text-sm font-medium border border-border rounded-xl hover:bg-background transition-colors text-muted">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2.5 text-sm font-medium bg-primary text-white rounded-xl hover:bg-primary-dark disabled:opacity-50 transition-colors">
              {saving ? 'Adding...' : `Add to ${series.active_cases.length - proceedingForm.exclude_case_ids.length} Case(s)`}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
