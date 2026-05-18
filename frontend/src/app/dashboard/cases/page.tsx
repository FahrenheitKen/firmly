'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import PageHeader from '@/components/ui/page-header';
import Modal from '@/components/ui/modal';
import SearchableSelect from '@/components/ui/searchable-select';
import DatePicker from '@/components/ui/date-picker';

interface OpposingCounsel {
  id: number;
  name: string;
  firm: string | null;
  phone: string | null;
  email: string | null;
}

interface CaseItem {
  id: number;
  case_number: string;
  our_reference: string | null;
  client_reference: string | null;
  title: string;
  description: string | null;
  case_type: string;
  status: string;
  priority: string;
  is_recovery: boolean | null;
  client_id: number | null;
  client?: { id: number; first_name?: string; last_name?: string; business_name?: string } | null;
  assigned_to: { id: number; first_name: string; last_name: string } | null;
  created_by?: { id: number; first_name: string; last_name: string } | null;
  opposing_counsel_id: number | null;
  opposing_counsel?: { id: number; name: string; firm: string | null } | null;
  court: string | null;
  judge: string | null;
  filed_date: string | null;
  closed_date: string | null;
  outcome: string | null;
  created_at: string;
}

interface Client {
  id: number;
  first_name: string | null;
  last_name: string | null;
  business_name: string | null;
  client_type: string;
  client_id?: string | null;
  client_prefix?: string | null;
  city?: string | null;
}

interface User {
  id: number;
  first_name: string;
  last_name: string;
}

const statusColors: Record<string, string> = {
  'Open': 'bg-blue-50 text-blue-700',
  'In Progress': 'bg-yellow-50 text-yellow-700',
  'Closed': 'bg-gray-100 text-gray-600',
  'On Hold': 'bg-orange-50 text-orange-700',
};

export default function CasesPage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const { toast: showToast } = useToast();
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCaseId, setEditingCaseId] = useState<number | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [businessName, setBusinessName] = useState('');
  const [businessId, setBusinessId] = useState(0);
  const [caseFormat, setCaseFormat] = useState('');
  const [caseCounter, setCaseCounter] = useState(0);

  const [step, setStep] = useState<1 | 2>(1);
  const [opposingCounsels, setOpposingCounsels] = useState<OpposingCounsel[]>([]);
  const [showAddOC, setShowAddOC] = useState(false);
  const [newOC, setNewOC] = useState({ name: '', firm: '', phone: '', email: '' });
  const [savingOC, setSavingOC] = useState(false);

  const [showEventModal, setShowEventModal] = useState(false);
  const [eventCaseId, setEventCaseId] = useState<number | null>(null);
  const [eventForm, setEventForm] = useState({ event_type: 'Bring Up', event_date: '' });

  const [showAddFileModal, setShowAddFileModal] = useState(false);
  const [addFileCaseId, setAddFileCaseId] = useState<number | null>(null);
  const [addFileForm, setAddFileForm] = useState({ document_name: '', document_date: '' });
  const [addFileFile, setAddFileFile] = useState<File | null>(null);
  const [addFileSaving, setAddFileSaving] = useState(false);

  const [form, setForm] = useState<{
    title: string;
    client_id: string;
    client_reference: string;
    parties: string;
    our_reference: string;
    case_number: string;
    assigned_to: string;
    court: string;
    filed_date: string;
    is_recovery: boolean | null;
    case_type: string;
    opposing_counsel_id: string;
  }>({
    title: '',
    client_id: '',
    client_reference: '',
    parties: '',
    our_reference: '',
    case_number: '',
    assigned_to: '',
    court: '',
    filed_date: '',
    is_recovery: null,
    case_type: 'Plaintiff',
    opposing_counsel_id: '',
  });

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

  const fetchCases = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    const res = await api.get<{ cases: CaseItem[] }>(`/cases${params}`, token);
    setCases(res.cases);
    setLoading(false);
  }, [token, search, user?.active_location?.id]); // eslint-disable-line

  useEffect(() => { fetchCases(); }, [token, fetchCases]);

  useEffect(() => {
    const timer = setTimeout(fetchCases, 300);
    return () => clearTimeout(timer);
  }, [search, fetchCases]);

  const getInitials = (name?: string | null) => {
    if (!name) return '';
    const skip = ['&', 'and', 'company', 'advocates', 'ltd', 'limited', 'inc', 'llc', 'plc', 'corporation', 'corp', 'co'];
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

  const generateOurRef = (bizName: string, bizId: number, clientId: string, fmt: string, counter: number, isRecovery: boolean | null, locationCity?: string | null) => {
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
    return isRecovery ? `${ref}(R)` : ref;
  };

  const openCreate = () => {
    setForm({ title: '', client_id: '', client_reference: '', parties: '', our_reference: '', case_number: '', assigned_to: '', court: '', filed_date: '', is_recovery: null, case_type: 'Plaintiff', opposing_counsel_id: '' });
    setFiles([]);
    setError('');
    setStep(1);
    setShowAddOC(false);
    setNewOC({ name: '', firm: '', phone: '', email: '' });
    setShowModal(true);
    if (!token) return;
    Promise.all([
      api.get<{ clients: Client[] }>('/clients', token),
      api.get<{ users: User[] }>('/users', token),
      api.get<{ business: Record<string, unknown> }>('/business', token),
      api.get<{ opposing_counsels: OpposingCounsel[] }>('/opposing-counsels', token).catch(() => ({ opposing_counsels: [] })),
    ]).then(([cRes, uRes, bRes, ocRes]) => {
      setOpposingCounsels(ocRes.opposing_counsels);
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
      setForm((prev) => ({ ...prev, our_reference: generateOurRef(b.name as string, b.id as number, '', fmt, counter, false, user?.active_location?.city) }));
    }).catch(() => {});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError('');
    if (form.is_recovery === null) {
      setError('Please select if this is a recovery or not');
      setSaving(false);
      return;
    }
    try {
      const hasFiles = files.some((f) => f.size > 0 || f.name);
      if (hasFiles) {
        const fd = new FormData();
        Object.entries(form).forEach(([k, v]) => { if (v !== null && v !== '') fd.append(k, String(v)); });
        fd.set('description', form.parties);
        fd.delete('parties');
        fd.set('is_recovery', String(form.is_recovery));
        files.forEach((f) => { if (f.size > 0 || f.name) fd.append('documents[]', f); });
        await api.post('/cases', fd, token);
      } else {
        const payload: Record<string, unknown> = {
          title: form.title,
          client_id: form.client_id || null,
          client_reference: form.client_reference || null,
          opposing_counsel_id: form.opposing_counsel_id || null,
          description: form.parties || null,
          our_reference: form.our_reference || null,
          assigned_to: form.assigned_to || null,
          court: form.court || null,
          filed_date: form.filed_date || null,
          is_recovery: form.is_recovery === true ? true : false,
          case_type: form.case_type,
        };
        if (form.case_number) payload.case_number = form.case_number;
        await api.post('/cases', payload, token);
      }
      setShowModal(false);
      fetchCases();
      showToast('Case created successfully', 'success');
    } catch (err: unknown) {
      const e = err as { errors?: Record<string, string[]>; message?: string };
      setError(e.errors ? Object.values(e.errors).flat().join(', ') : e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const [editForm, setEditForm] = useState({
    title: '',
    client_id: '',
    client_reference: '',
    parties: '',
    our_reference: '',
    case_number: '',
    assigned_to: '',
    court: '',
    judge: '',
    opposing_counsel_id: '',
    filed_date: '',
    closed_date: '',
    outcome: '',
    is_recovery: null as boolean | null,
    case_type: 'Plaintiff',
    status: 'Open',
    priority: 'Medium',
  });

  const openEdit = (caseItem: CaseItem) => {
    setOpenDropdown(null);
    setEditingCaseId(caseItem.id);
    setError('');
    setEditForm({
      title: caseItem.title || '',
      client_id: caseItem.client_id ? String(caseItem.client_id) : '',
      client_reference: caseItem.client_reference || '',
      parties: caseItem.description || '',
      our_reference: caseItem.our_reference || '',
      case_number: caseItem.case_number || '',
      assigned_to: caseItem.assigned_to?.id ? String(caseItem.assigned_to.id) : '',
      court: caseItem.court || '',
      judge: caseItem.judge || '',
      opposing_counsel_id: caseItem.opposing_counsel_id ? String(caseItem.opposing_counsel_id) : '',
      filed_date: caseItem.filed_date ? caseItem.filed_date.split('T')[0] : '',
      closed_date: caseItem.closed_date ? caseItem.closed_date.split('T')[0] : '',
      outcome: caseItem.outcome || '',
      is_recovery: caseItem.is_recovery ?? null,
      case_type: caseItem.case_type || 'Plaintiff',
      status: caseItem.status || 'Open',
      priority: caseItem.priority || 'Medium',
    });
    setShowAddOC(false);
    setNewOC({ name: '', firm: '', phone: '', email: '' });
    setShowEditModal(true);
    if (!token) return;
    Promise.all([
      api.get<{ clients: Client[] }>('/clients', token),
      api.get<{ users: User[] }>('/users', token),
      api.get<{ opposing_counsels: OpposingCounsel[] }>('/opposing-counsels', token).catch(() => ({ opposing_counsels: [] })),
    ]).then(([cRes, uRes, ocRes]) => {
      setClients(cRes.clients);
      setUsers(uRes.users);
      setOpposingCounsels(ocRes.opposing_counsels);
    }).catch(() => {});
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editingCaseId) return;
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, unknown> = {
        title: editForm.title,
        client_id: editForm.client_id || '',
        client_reference: editForm.client_reference,
        description: editForm.parties,
        assigned_to: editForm.assigned_to || '',
        court: editForm.court,
        judge: editForm.judge,
        opposing_counsel_id: editForm.opposing_counsel_id || null,
        filed_date: editForm.filed_date || null,
        closed_date: editForm.closed_date || null,
        outcome: editForm.outcome,
        is_recovery: editForm.is_recovery,
        case_type: editForm.case_type,
        case_number: editForm.case_number || null,
        status: editForm.status,
        priority: editForm.priority,
      };
      await api.put(`/cases/${editingCaseId}`, payload, token);
      setShowEditModal(false);
      setEditingCaseId(null);
      fetchCases();
      showToast('Case updated successfully', 'success');
    } catch (err: unknown) {
      const e = err as { errors?: Record<string, string[]>; message?: string };
      setError(e.errors ? Object.values(e.errors).flat().join(', ') : e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const saveOpposingCounsel = async (onSaved: (id: string) => void) => {
    if (!token || !newOC.name.trim()) return;
    setSavingOC(true);
    try {
      const res = await api.post<{ opposing_counsel: OpposingCounsel }>('/opposing-counsels', newOC, token);
      const created = res.opposing_counsel;
      setOpposingCounsels((prev) => [...prev, created]);
      setShowAddOC(false);
      setNewOC({ name: '', firm: '', phone: '', email: '' });
      onSaved(String(created.id));
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Failed to save opposing counsel');
    } finally {
      setSavingOC(false);
    }
  };

  const addFile = () => setFiles((prev) => [...prev, new File([], '')]);
  const removeFile = (i: number) => setFiles((prev) => prev.filter((_, idx) => idx !== i));
  const updateFile = (i: number, file: File | null) => {
    const updated = [...files];
    if (file) updated[i] = file;
    setFiles(updated);
  };

  const clientName = (c: CaseItem) => {
    if (!c.client) return '-';
    return c.client.business_name || `${c.client.first_name || ''} ${c.client.last_name || ''}`.trim() || '-';
  };

  const deleteCase = async (id: number) => {
    setOpenDropdown(null);
    if (!confirm('Delete this case?')) return;
    try {
      await api.delete(`/cases/${id}`, token!);
      fetchCases();
      showToast('Case deleted', 'success');
    } catch {
      showToast('Failed to delete case', 'error');
    }
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !eventCaseId) return;
    setSaving(true);
    setError('');
    const eventCase = cases.find((c) => c.id === eventCaseId);
    const caseLabel = eventCase?.our_reference || eventCase?.case_number || `Case #${eventCaseId}`;
    const eventTypeLabel = eventForm.event_type;
    const eventMessages: Record<string, string> = {
      'Bring Up': 'Bring up date updated',
      'Mention': 'Mention date updated',
      'Hearing': 'Hearing date updated',
      'Ruling': 'Ruling date updated',
      'Judgement': 'Judgement date updated',
    };
    const successMsg = eventMessages[eventTypeLabel] || `${eventTypeLabel} date updated`;
    try {
      await api.post(`/cases/${eventCaseId}/events`, eventForm, token);
      setShowEventModal(false);
      setEventCaseId(null);
      showToast(`${successMsg} — ${caseLabel}`, 'success');
    } catch (err: unknown) {
      const errObj = err as { errors?: Record<string, string[]>; message?: string };
      const msg = errObj.errors ? Object.values(errObj.errors).flat().join(', ') : errObj.message || 'Failed to add event';
      setError(msg);
      showToast(`Failed to add ${eventTypeLabel.toLowerCase()} event for ${caseLabel}: ${msg}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !addFileCaseId || !addFileFile) return;
    setAddFileSaving(true);
    const caseItem = cases.find((c) => c.id === addFileCaseId);
    const caseLabel = caseItem?.our_reference || caseItem?.case_number || `Case #${addFileCaseId}`;
    try {
      const fd = new FormData();
      fd.append('documents[]', addFileFile);
      if (addFileForm.document_name) fd.append('document_names[]', addFileForm.document_name);
      if (addFileForm.document_date) fd.append('document_date', addFileForm.document_date);
      await api.post(`/cases/${addFileCaseId}/documents`, fd, token);
      setShowAddFileModal(false);
      setAddFileCaseId(null);
      setAddFileFile(null);
      setAddFileForm({ document_name: '', document_date: '' });
      showToast(`File uploaded successfully — ${caseLabel}`, 'success');
    } catch (err: unknown) {
      const errObj = err as { errors?: Record<string, string[]>; message?: string };
      const msg = errObj.errors ? Object.values(errObj.errors).flat().join(', ') : errObj.message || 'Upload failed';
      showToast(`Upload failed: ${msg}`, 'error');
    } finally {
      setAddFileSaving(false);
    }
  };

  const inputClass = 'w-full px-3.5 py-2.5 bg-card-bg border border-border rounded-xl focus:outline-none focus:border-primary focus:ring-0 text-sm transition-colors';

  return (
    <>
      <PageHeader
        title="Cases"
        description="Manage firm cases"
        action={
          <button onClick={openCreate} className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark text-sm font-medium">
            + Add Case
          </button>
        }
      />

      <div className="mb-4 relative">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          placeholder="Search cases by title, number, or type..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-card-bg border border-border rounded-xl focus:outline-none focus:border-primary text-sm transition-colors"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>
      ) : cases.length === 0 ? (
        <div className="text-center py-16 text-muted">
          {search ? 'No cases match your search.' : 'No cases yet. Add your first case.'}
        </div>
      ) : (
        <div className="bg-card-bg rounded-xl border border-border overflow-visible">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-gray-50">
                <th className="w-24 px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider">Action</th>
                <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider">Our Reference</th>
                <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider">Client</th>
                <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider hidden sm:table-cell">Client Ref</th>
                <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider hidden sm:table-cell">Case Number</th>
                <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 relative">
                    <button
                      onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === c.id ? null : c.id); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors shadow-sm"
                    >
                      Action
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {openDropdown === c.id && (
                      <div className="dropdown-menu absolute right-0 top-full mt-1 w-44 bg-white rounded-lg shadow-lg border border-border z-50 py-1 text-left">
                        <button onClick={() => { setOpenDropdown(null); router.push(`/dashboard/cases/${c.id}`); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-primary hover:bg-primary/5 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          View
                        </button>
                        <button onClick={() => openEdit(c)} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-accent hover:bg-accent/5 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          Edit
                        </button>
                        <button onClick={() => { setOpenDropdown(null); setAddFileCaseId(c.id); setAddFileForm({ document_name: '', document_date: '' }); setAddFileFile(null); setShowAddFileModal(true); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-primary/5 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2zM12 11v4m-2-2h4" /></svg>
                          Add File
                        </button>
                        <button onClick={() => { setOpenDropdown(null); setEventCaseId(c.id); setEventForm({ event_type: 'Bring Up', event_date: '' }); setShowEventModal(true); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-primary/5 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          Add Event
                        </button>
                        <hr className="my-1 border-border" />
                        <button onClick={() => deleteCase(c.id)} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-danger hover:bg-danger/5 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-muted">{c.our_reference || c.case_number}</td>
                  <td className="px-4 py-3 text-muted">{clientName(c)}</td>
                  <td className="px-4 py-3 text-xs text-muted hidden sm:table-cell">{c.client_reference || '-'}</td>
                  <td className="px-4 py-3 text-muted hidden sm:table-cell">{c.case_number}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[c.status] || ''}`}>{c.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 text-xs text-muted border-t border-border bg-gray-50/50">
            Showing {cases.length} case{cases.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      <Modal open={showModal} onClose={() => { setShowModal(false); setStep(1); }} title="Add Case" size="lg">
        {/* Step indicator */}
        <div className="flex items-center mb-6">
          <div className={`flex items-center gap-2 text-sm font-medium ${step === 1 ? 'text-primary' : 'text-muted'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step === 1 ? 'bg-primary text-white' : 'bg-primary/20 text-primary'}`}>1</div>
            Case Details
          </div>
          <div className="flex-1 h-px bg-border mx-3" />
          <div className={`flex items-center gap-2 text-sm font-medium ${step === 2 ? 'text-primary' : 'text-muted'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step === 2 ? 'bg-primary text-white' : 'bg-border text-muted'}`}>2</div>
            Opposing Counsel &amp; Documents
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="bg-danger/5 border border-danger/20 text-danger text-sm px-4 py-3 rounded-lg mb-4">{error}</div>}

          {/* Step 1: Case Details */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Subject *</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value.toUpperCase() })} className={inputClass} placeholder="Case subject" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SearchableSelect
                  label="Client"
                  value={form.client_id}
                  onChange={(v) => {
                    setForm((prev) => ({ ...prev, client_id: v, our_reference: generateOurRef(businessName, businessId, v, caseFormat, caseCounter, prev.is_recovery ?? false, user?.active_location?.city) }));
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

              <div>
                <label className="block text-sm font-medium mb-1">Client Reference</label>
                <input value={form.client_reference} onChange={(e) => setForm({ ...form, client_reference: e.target.value.toUpperCase() })} className={inputClass} placeholder="Client's reference number" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Parties</label>
                <textarea value={form.parties} onChange={(e) => setForm({ ...form, parties: e.target.value })} rows={3} className={inputClass} placeholder="List the parties involved" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Is this a recovery? *</label>
                  <div className="flex gap-4">
                    <label className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer transition-all text-sm ${form.is_recovery === true ? 'bg-primary/5 border-primary/30' : 'border-border hover:bg-gray-50'}`}>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${form.is_recovery === true ? 'border-primary' : 'border-gray-300'}`}>
                        {form.is_recovery === true && <div className="w-2 h-2 rounded-full bg-primary" />}
                        <input type="radio" name="is_recovery" checked={form.is_recovery === true} onChange={() => setForm((prev) => ({ ...prev, is_recovery: true, our_reference: generateOurRef(businessName, businessId, prev.client_id, caseFormat, caseCounter, true, user?.active_location?.city) }))} className="absolute opacity-0" />
                      </div>
                      <span>Yes</span>
                    </label>
                    <label className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer transition-all text-sm ${form.is_recovery === false ? 'bg-primary/5 border-primary/30' : 'border-border hover:bg-gray-50'}`}>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${form.is_recovery === false ? 'border-primary' : 'border-gray-300'}`}>
                        {form.is_recovery === false && <div className="w-2 h-2 rounded-full bg-primary" />}
                        <input type="radio" name="is_recovery" checked={form.is_recovery === false} onChange={() => setForm((prev) => ({ ...prev, is_recovery: false, our_reference: generateOurRef(businessName, businessId, prev.client_id, caseFormat, caseCounter, false, user?.active_location?.city) }))} className="absolute opacity-0" />
                      </div>
                      <span>No</span>
                    </label>
                  </div>
                  {form.is_recovery === null && <p className="text-xs text-danger mt-1">Please select Yes or No</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Case Type</label>
                  <div className="flex gap-4">
                    {['Plaintiff', 'Defendant'].map((type) => (
                      <label key={type} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer transition-all text-sm ${form.case_type === type ? 'bg-primary/5 border-primary/30' : 'border-border hover:bg-gray-50'}`}>
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${form.case_type === type ? 'border-primary' : 'border-gray-300'}`}>
                          {form.case_type === type && <div className="w-2 h-2 rounded-full bg-primary" />}
                          <input type="radio" name="case_type" checked={form.case_type === type} onChange={() => setForm((prev) => ({ ...prev, case_type: type }))} className="absolute opacity-0" />
                        </div>
                        <span>{type}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Our Reference</label>
                  <input value={form.our_reference} readOnly className={`${inputClass} bg-gray-50 cursor-not-allowed`} placeholder="Auto-generated" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Case Number</label>
                  <input value={form.case_number} onChange={(e) => setForm({ ...form, case_number: e.target.value.toUpperCase() })} className={inputClass} placeholder="Leave blank to auto-generate" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Station</label>
                <input value={form.court} onChange={(e) => setForm({ ...form, court: e.target.value })} className={inputClass} placeholder="Station name" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Filed Date</label>
                <input type="date" value={form.filed_date} onChange={(e) => setForm({ ...form, filed_date: e.target.value })} className={inputClass} />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 text-sm font-medium border border-border rounded-xl hover:bg-background transition-colors text-muted hover:text-foreground">Cancel</button>
                <button
                  type="button"
                  onClick={() => {
                    if (!form.title.trim()) { setError('Subject is required'); return; }
                    if (form.is_recovery === null) { setError('Please select if this is a recovery or not'); return; }
                    setError('');
                    setStep(2);
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-primary text-white rounded-xl hover:bg-primary-dark transition-colors"
                >
                  Next
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Opposing Counsel & Documents */}
          {step === 2 && (
            <div className="space-y-5">
              {/* Opposing Counsel */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium">Opposing Counsel</label>
                  {!showAddOC && (
                    <button type="button" onClick={() => setShowAddOC(true)} className="text-xs text-primary hover:underline font-medium">+ Add New</button>
                  )}
                </div>
                <SearchableSelect
                  value={form.opposing_counsel_id}
                  onChange={(v) => setForm({ ...form, opposing_counsel_id: v })}
                  options={[
                    { value: '', label: 'Select opposing counsel' },
                    ...opposingCounsels.map((oc) => ({ value: String(oc.id), label: oc.firm || oc.name })),
                  ]}
                  placeholder="Search opposing counsel..."
                />
                {showAddOC && (
                  <div className="mt-3 p-4 bg-gray-50 border border-border rounded-xl space-y-3">
                    <p className="text-xs font-medium text-muted uppercase tracking-wider">New Opposing Counsel</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-muted mb-1">Name *</label>
                        <input value={newOC.name} onChange={(e) => setNewOC({ ...newOC, name: e.target.value })} className={inputClass} placeholder="Full name" />
                      </div>
                      <div>
                        <label className="block text-xs text-muted mb-1">Firm</label>
                        <input value={newOC.firm} onChange={(e) => setNewOC({ ...newOC, firm: e.target.value })} className={inputClass} placeholder="Law firm" />
                      </div>
                      <div>
                        <label className="block text-xs text-muted mb-1">Phone</label>
                        <input value={newOC.phone} onChange={(e) => setNewOC({ ...newOC, phone: e.target.value })} className={inputClass} placeholder="Phone number" />
                      </div>
                      <div>
                        <label className="block text-xs text-muted mb-1">Email</label>
                        <input type="email" value={newOC.email} onChange={(e) => setNewOC({ ...newOC, email: e.target.value })} className={inputClass} placeholder="Email address" />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => { setShowAddOC(false); setNewOC({ name: '', firm: '', phone: '', email: '' }); }} className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-background transition-colors text-muted">Cancel</button>
                      <button type="button" disabled={savingOC || !newOC.name.trim()} onClick={() => saveOpposingCounsel((id) => setForm((prev) => ({ ...prev, opposing_counsel_id: id })))} className="px-3 py-1.5 text-xs bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors">
                        {savingOC ? 'Saving...' : 'Save & Select'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Documents */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium">Documents</label>
                  <button type="button" onClick={addFile} className="text-xs text-primary hover:underline font-medium">+ Add File</button>
                </div>
                {files.length === 0 ? (
                  <button
                    type="button"
                    onClick={addFile}
                    className="w-full border-2 border-dashed border-border rounded-xl py-8 text-center text-sm text-muted hover:border-primary/40 hover:text-primary transition-colors"
                  >
                    <svg className="w-6 h-6 mx-auto mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2zM12 11v4m-2-2h4" /></svg>
                    Click to attach documents (optional)
                  </button>
                ) : (
                  <div className="space-y-2">
                    {files.map((_, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input type="file" onChange={(e) => updateFile(i, e.target.files?.[0] || null)} className="flex-1 text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-primary/5 file:text-primary hover:file:bg-primary/10" />
                        <button type="button" onClick={() => removeFile(i)} className="p-1.5 text-danger hover:bg-danger/5 rounded-lg transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-between gap-3 pt-4 border-t border-border">
                <button type="button" onClick={() => { setStep(1); setError(''); }} className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium border border-border rounded-xl hover:bg-background transition-colors text-muted hover:text-foreground">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  Back
                </button>
                <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-primary text-white rounded-xl hover:bg-primary-dark disabled:opacity-50 transition-colors">
                  {saving ? 'Creating...' : 'Create Case'}
                </button>
              </div>
            </div>
          )}
        </form>
      </Modal>

      <Modal open={showEditModal} onClose={() => { setShowEditModal(false); setEditingCaseId(null); }} title="Edit Case" size="lg">
        <form onSubmit={handleEditSubmit} className="space-y-4">
          {error && <div className="bg-danger/5 border border-danger/20 text-danger text-sm px-4 py-3 rounded-lg">{error}</div>}

          <div>
            <label className="block text-sm font-medium mb-1">Subject *</label>
            <input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value.toUpperCase() })} required className={inputClass} placeholder="Case subject" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SearchableSelect
              label="Client"
              value={editForm.client_id}
              onChange={(v) => setEditForm((prev) => ({ ...prev, client_id: v }))}
              options={[{ value: '', label: 'Select client' }, ...clients.map((c) => ({ value: String(c.id), label: c.client_type === 'business' ? c.business_name || '' : `${c.first_name || ''} ${c.last_name || ''}`.trim() }))]}
              placeholder="Search client..."
            />
            <div>
              <label className="block text-sm font-medium mb-1">Assigned To</label>
              <input
                value={(() => { const u = users.find((u) => String(u.id) === editForm.assigned_to); return u ? `${u.first_name} ${u.last_name}`.trim() : editForm.assigned_to || ''; })()}
                readOnly
                className={`${inputClass} bg-gray-50 cursor-not-allowed`}
                placeholder="Not assigned"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Client Reference</label>
              <input value={editForm.client_reference} onChange={(e) => setEditForm({ ...editForm, client_reference: e.target.value.toUpperCase() })} className={inputClass} placeholder="Client's reference number" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium">Opposing Counsel</label>
                {!showAddOC && (
                  <button type="button" onClick={() => setShowAddOC(true)} className="text-xs text-primary hover:underline font-medium">+ Add New</button>
                )}
              </div>
              <SearchableSelect
                value={editForm.opposing_counsel_id}
                onChange={(v) => setEditForm({ ...editForm, opposing_counsel_id: v })}
                options={[
                  { value: '', label: 'Select opposing counsel' },
                  ...opposingCounsels.map((oc) => ({ value: String(oc.id), label: oc.firm || oc.name })),
                ]}
                placeholder="Search opposing counsel..."
              />
            </div>
          </div>

          {showAddOC && (
            <div className="p-4 bg-gray-50 border border-border rounded-xl space-y-3">
              <p className="text-xs font-medium text-muted uppercase tracking-wider">New Opposing Counsel</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted mb-1">Name *</label>
                  <input value={newOC.name} onChange={(e) => setNewOC({ ...newOC, name: e.target.value })} className={inputClass} placeholder="Full name" />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Firm</label>
                  <input value={newOC.firm} onChange={(e) => setNewOC({ ...newOC, firm: e.target.value })} className={inputClass} placeholder="Law firm" />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Phone</label>
                  <input value={newOC.phone} onChange={(e) => setNewOC({ ...newOC, phone: e.target.value })} className={inputClass} placeholder="Phone number" />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Email</label>
                  <input type="email" value={newOC.email} onChange={(e) => setNewOC({ ...newOC, email: e.target.value })} className={inputClass} placeholder="Email address" />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => { setShowAddOC(false); setNewOC({ name: '', firm: '', phone: '', email: '' }); }} className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-background transition-colors text-muted">Cancel</button>
                <button type="button" disabled={savingOC || !newOC.name.trim()} onClick={() => saveOpposingCounsel((id) => setEditForm((prev) => ({ ...prev, opposing_counsel_id: id })))} className="px-3 py-1.5 text-xs bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors">
                  {savingOC ? 'Saving...' : 'Save & Select'}
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Parties</label>
            <textarea value={editForm.parties} onChange={(e) => setEditForm({ ...editForm, parties: e.target.value })} rows={3} className={inputClass} placeholder="List the parties involved" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Is this a recovery?</label>
              <div className="flex gap-4">
                <label className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer transition-all text-sm ${editForm.is_recovery === true ? 'bg-primary/5 border-primary/30' : 'border-border hover:bg-gray-50'}`}>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${editForm.is_recovery === true ? 'border-primary' : 'border-gray-300'}`}>
                    {editForm.is_recovery === true && <div className="w-2 h-2 rounded-full bg-primary" />}
                    <input type="radio" name="edit_is_recovery" checked={editForm.is_recovery === true} onChange={() => setEditForm((prev) => ({ ...prev, is_recovery: true }))} className="absolute opacity-0" />
                  </div>
                  <span>Yes</span>
                </label>
                <label className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer transition-all text-sm ${editForm.is_recovery === false ? 'bg-primary/5 border-primary/30' : 'border-border hover:bg-gray-50'}`}>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${editForm.is_recovery === false ? 'border-primary' : 'border-gray-300'}`}>
                    {editForm.is_recovery === false && <div className="w-2 h-2 rounded-full bg-primary" />}
                    <input type="radio" name="edit_is_recovery" checked={editForm.is_recovery === false} onChange={() => setEditForm((prev) => ({ ...prev, is_recovery: false }))} className="absolute opacity-0" />
                  </div>
                  <span>No</span>
                </label>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Case Type</label>
              <div className="flex gap-4">
                {['Plaintiff', 'Defendant'].map((type) => (
                  <label key={type} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer transition-all text-sm ${editForm.case_type === type ? 'bg-primary/5 border-primary/30' : 'border-border hover:bg-gray-50'}`}>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${editForm.case_type === type ? 'border-primary' : 'border-gray-300'}`}>
                      {editForm.case_type === type && <div className="w-2 h-2 rounded-full bg-primary" />}
                      <input type="radio" name="edit_case_type" checked={editForm.case_type === type} onChange={() => setEditForm((prev) => ({ ...prev, case_type: type }))} className="absolute opacity-0" />
                    </div>
                    <span>{type}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Our Reference</label>
              <input value={editForm.our_reference} readOnly className={`${inputClass} bg-gray-50 cursor-not-allowed`} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Case Number</label>
              <input value={editForm.case_number} onChange={(e) => setEditForm({ ...editForm, case_number: e.target.value.toUpperCase() })} className={inputClass} placeholder="Case number" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Station</label>
            <input value={editForm.court} onChange={(e) => setEditForm({ ...editForm, court: e.target.value })} className={inputClass} placeholder="Station name" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Filed Date</label>
            <input type="date" value={editForm.filed_date} onChange={(e) => setEditForm({ ...editForm, filed_date: e.target.value })} className={inputClass} />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button type="button" onClick={() => { setShowEditModal(false); setEditingCaseId(null); }} className="px-5 py-2.5 text-sm font-medium border border-border rounded-xl hover:bg-background transition-colors text-muted hover:text-foreground">Cancel</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-primary text-white rounded-xl hover:bg-primary-dark disabled:opacity-50 transition-colors">
              {saving ? 'Saving...' : 'Update Case'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={showAddFileModal} onClose={() => { setShowAddFileModal(false); setAddFileCaseId(null); setAddFileFile(null); setAddFileForm({ document_name: '', document_date: '' }); }} title="Add File" size="sm">
        <form onSubmit={handleAddFile} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">File Name</label>
            <input
              value={addFileForm.document_name}
              onChange={(e) => setAddFileForm({ ...addFileForm, document_name: e.target.value })}
              className={inputClass}
              placeholder="Enter document name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">File *</label>
            <input
              type="file"
              required
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setAddFileFile(file);
                if (file && !addFileForm.document_name) {
                  setAddFileForm((prev) => ({ ...prev, document_name: file.name.replace(/\.[^/.]+$/, '') }));
                }
              }}
              className="w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-primary/5 file:text-primary hover:file:bg-primary/10"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Date</label>
            <input
              type="date"
              value={addFileForm.document_date}
              onChange={(e) => setAddFileForm({ ...addFileForm, document_date: e.target.value })}
              className={inputClass}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button type="button" onClick={() => { setShowAddFileModal(false); setAddFileCaseId(null); setAddFileFile(null); setAddFileForm({ document_name: '', document_date: '' }); }} className="px-5 py-2.5 text-sm font-medium border border-border rounded-xl hover:bg-background transition-colors text-muted hover:text-foreground">Cancel</button>
            <button type="submit" disabled={addFileSaving || !addFileFile} className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-primary text-white rounded-xl hover:bg-primary-dark disabled:opacity-50 transition-colors">
              {addFileSaving ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={showEventModal} onClose={() => { setShowEventModal(false); setEventCaseId(null); setError(''); }} title="Add Event" size="sm">
        <form onSubmit={handleAddEvent} className="space-y-4">
          {error && <div className="bg-danger/5 border border-danger/20 text-danger text-sm px-4 py-3 rounded-lg">{error}</div>}

          <div>
            <label className="block text-sm font-medium mb-1">Event Type</label>
            <select
              value={eventForm.event_type}
              onChange={(e) => setEventForm({ ...eventForm, event_type: e.target.value })}
              className="w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-white focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all"
            >
              <option value="Bring Up">Bring Up</option>
              <option value="Mention">Mention</option>
              <option value="Hearing">Hearing</option>
              <option value="Ruling">Ruling</option>
              <option value="Judgement">Judgement</option>
              <option value="Application">Application</option>
            </select>
          </div>

          <DatePicker label="Event Date" value={eventForm.event_date} onChange={(v) => setEventForm({ ...eventForm, event_date: v })} />

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button type="button" onClick={() => { setShowEventModal(false); setEventCaseId(null); setError(''); }} className="px-5 py-2.5 text-sm font-medium border border-border rounded-xl hover:bg-background transition-colors text-muted hover:text-foreground">Cancel</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-primary text-white rounded-xl hover:bg-primary-dark disabled:opacity-50 transition-colors">
              {saving ? 'Adding...' : 'Add Event'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
