'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import PageHeader from '@/components/ui/page-header';
import Modal from '@/components/ui/modal';
import SearchableSelect from '@/components/ui/searchable-select';
import DatePicker from '@/components/ui/date-picker';
import TablePagination from '@/components/ui/table-pagination';
import { getKenyaHoliday } from '@/lib/kenya-holidays';

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
  court_number_filed: string | null;
  judge: string | null;
  filed_date: string | null;
  closed_date: string | null;
  outcome: string | null;
  created_at: string;
  case_series_id: number | null;
  series?: { id: number; reference: string; name: string } | null;
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
  const { token, user, can } = useAuth();
  const canCreate = can('case.create');
  const canUpdate = can('case.update');
  const canDelete = can('case.delete');
  const canReassign = can('case.reassign');
  const canViewAll = can('case.view_all') || can('case.view');
  const canViewOwn = can('case.view_own');
  const router = useRouter();
  const { toast: showToast } = useToast();
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, per_page: 25, total: 0 });
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCaseId, setEditingCaseId] = useState<number | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number>(-1);
  const [businessName, setBusinessName] = useState('');
  const [businessId, setBusinessId] = useState(0);
  const [caseFormat, setCaseFormat] = useState('');
  const [caseCounter, setCaseCounter] = useState(0);
  const [filterClient, setFilterClient] = useState('');
  const [filterAssigned, setFilterAssigned] = useState('');
  const [filterClients, setFilterClients] = useState<Client[]>([]);
  const [filterUsers, setFilterUsers] = useState<User[]>([]);
  const [sortDir, setSortDir] = useState<'' | 'asc' | 'desc'>('');
  const [openSeriesDropdown, setOpenSeriesDropdown] = useState<number | null>(null);
  const [expandedSeries, setExpandedSeries] = useState<Set<number>>(new Set());

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
    court_number_filed: string;
    judge: string;
    filed_date: string;
    is_recovery: boolean | null;
    case_type: string;
    is_filed_in_court: boolean;
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
    court_number_filed: '',
    judge: '',
    filed_date: '',
    is_recovery: null,
    case_type: 'Plaintiff',
    is_filed_in_court: false,
    opposing_counsel_id: '',
  });

  useEffect(() => {
    if (openDropdown === null && openSeriesDropdown === null) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.dropdown-menu')) {
        setOpenDropdown(null);
        setOpenSeriesDropdown(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openDropdown, openSeriesDropdown]);

  useEffect(() => {
    if (!token || (!canViewAll && !canViewOwn)) return;
    api.get<{ clients: Client[] }>('/clients?per_page=500', token)
      .then((cRes) => setFilterClients(cRes.clients))
      .catch(() => {});
    if (canViewAll) {
      api.get<{ users: User[] }>('/users?per_page=500', token)
        .then((uRes) => setFilterUsers(uRes.users))
        .catch(() => {});
    }
  }, [token, canViewAll, canViewOwn]); // eslint-disable-line

  const fetchCases = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (filterClient) params.set('client_id', filterClient);
    if (filterAssigned) params.set('assigned_to', filterAssigned);
    if (sortDir) { params.set('sort_by', 'our_reference'); params.set('sort_dir', sortDir); }
    params.set('page', String(page));
    params.set('per_page', String(perPage));
    const qs = params.toString();
    const res = await api.get<{ cases: CaseItem[]; pagination: typeof pagination }>(`/cases?${qs}`, token);
    setCases(res.cases);
    if (res.pagination) setPagination(res.pagination);
    setLoading(false);
  }, [token, search, filterClient, filterAssigned, sortDir, page, perPage, user?.active_location?.id]); // eslint-disable-line

  useEffect(() => {
    const timer = setTimeout(fetchCases, 300);
    return () => clearTimeout(timer);
  }, [fetchCases]);

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
    setForm({ title: '', client_id: '', client_reference: '', parties: '', our_reference: '', case_number: '', assigned_to: '', court: '', court_number_filed: '', judge: '', filed_date: '', is_recovery: null, case_type: 'Plaintiff', is_filed_in_court: false, opposing_counsel_id: '' });
    setFiles([]);
    setError('');
    setStep(1);
    setShowAddOC(false);
    setNewOC({ name: '', firm: '', phone: '', email: '' });
    setShowModal(true);
    if (!token) return;
    Promise.all([
      api.get<{ clients: Client[] }>('/clients?per_page=500', token),
      api.get<{ users: User[] }>('/users?per_page=500', token),
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
    setUploadProgress(-1);
    const effectiveIsRecovery = form.case_type === 'Plaintiff' ? (form.is_recovery === true) : false;
    const effectiveCaseNumber = form.is_filed_in_court ? form.case_number : '';
    const effectiveFiledDate = form.is_filed_in_court ? form.filed_date : '';
    const effectiveCourt = form.is_filed_in_court ? form.court : '';
    const effectiveCourtNumberFiled = form.is_filed_in_court ? form.court_number_filed : '';
    const effectiveJudge = form.is_filed_in_court ? form.judge : '';
    try {
      if (files.length > 0) {
        const fd = new FormData();
        Object.entries(form).forEach(([k, v]) => {
          if (k === 'is_recovery' || k === 'case_number' || k === 'filed_date' || k === 'is_filed_in_court' || k === 'court' || k === 'court_number_filed' || k === 'judge') return;
          if (v !== null && v !== '') fd.append(k, String(v));
        });
        fd.set('description', form.parties);
        fd.delete('parties');
        fd.set('is_recovery', String(effectiveIsRecovery));
        if (effectiveCaseNumber) fd.set('case_number', effectiveCaseNumber);
        if (effectiveFiledDate) fd.set('filed_date', effectiveFiledDate);
        if (effectiveCourt) fd.set('court', effectiveCourt);
        if (effectiveCourtNumberFiled) fd.set('court_number_filed', effectiveCourtNumberFiled);
        if (effectiveJudge) fd.set('judge', effectiveJudge);
        files.forEach((f) => fd.append('documents[]', f));
        setUploadProgress(0);
        await api.upload('/cases', fd, token, (loaded, total) => {
          setUploadProgress(Math.round((loaded / total) * 100));
        });
        setUploadProgress(100);
        await new Promise((r) => setTimeout(r, 600));
      } else {
        const payload: Record<string, unknown> = {
          title: form.title,
          client_id: form.client_id || null,
          client_reference: form.client_reference || null,
          opposing_counsel_id: form.opposing_counsel_id || null,
          description: form.parties || null,
          our_reference: form.our_reference || null,
          assigned_to: form.assigned_to || null,
          court: effectiveCourt || null,
          court_number_filed: effectiveCourtNumberFiled || null,
          judge: effectiveJudge || null,
          filed_date: effectiveFiledDate || null,
          is_recovery: effectiveIsRecovery,
          case_type: form.case_type,
        };
        if (effectiveCaseNumber) payload.case_number = effectiveCaseNumber;
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
      setUploadProgress(-1);
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
    court_number_filed: '',
    judge: '',
    opposing_counsel_id: '',
    filed_date: '',
    closed_date: '',
    outcome: '',
    is_recovery: null as boolean | null,
    case_type: 'Plaintiff',
    is_filed_in_court: false,
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
      court_number_filed: caseItem.court_number_filed || '',
      judge: caseItem.judge || '',
      opposing_counsel_id: caseItem.opposing_counsel_id ? String(caseItem.opposing_counsel_id) : '',
      filed_date: caseItem.filed_date ? caseItem.filed_date.split('T')[0] : '',
      closed_date: caseItem.closed_date ? caseItem.closed_date.split('T')[0] : '',
      outcome: caseItem.outcome || '',
      is_recovery: caseItem.is_recovery ?? null,
      case_type: caseItem.case_type || 'Plaintiff',
      is_filed_in_court: Boolean(caseItem.case_number) || Boolean(caseItem.filed_date) || Boolean(caseItem.court) || Boolean(caseItem.court_number_filed) || Boolean(caseItem.judge),
      status: caseItem.status || 'Open',
      priority: caseItem.priority || 'Medium',
    });
    setShowAddOC(false);
    setNewOC({ name: '', firm: '', phone: '', email: '' });
    setShowEditModal(true);
    if (!token) return;
    Promise.all([
      api.get<{ clients: Client[] }>('/clients?per_page=500', token),
      api.get<{ users: User[] }>('/users?per_page=500', token),
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
    const effectiveIsRecovery = editForm.case_type === 'Plaintiff' ? (editForm.is_recovery === true) : false;
    const effectiveCaseNumber = editForm.is_filed_in_court ? editForm.case_number : '';
    const effectiveFiledDate = editForm.is_filed_in_court ? editForm.filed_date : '';
    const effectiveCourt = editForm.is_filed_in_court ? editForm.court : '';
    const effectiveCourtNumberFiled = editForm.is_filed_in_court ? editForm.court_number_filed : '';
    const effectiveJudge = editForm.is_filed_in_court ? editForm.judge : '';
    try {
      const payload: Record<string, unknown> = {
        title: editForm.title,
        client_id: editForm.client_id || '',
        client_reference: editForm.client_reference,
        our_reference: editForm.our_reference || null,
        description: editForm.parties,
        assigned_to: editForm.assigned_to || '',
        court: effectiveCourt || null,
        court_number_filed: effectiveCourtNumberFiled || null,
        judge: effectiveJudge || null,
        opposing_counsel_id: editForm.opposing_counsel_id || null,
        filed_date: effectiveFiledDate || null,
        closed_date: editForm.closed_date || null,
        outcome: editForm.outcome,
        is_recovery: effectiveIsRecovery,
        case_type: editForm.case_type,
        case_number: effectiveCaseNumber || null,
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
    if (!token || (!newOC.name.trim() && !newOC.firm.trim())) return;
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const addFiles = (newFiles: FileList | File[]) => {
    const valid = Array.from(newFiles).filter((f) => f.name && f.size > 0);
    if (valid.length > 0) setFiles((prev) => [...prev, ...valid]);
  };
  const removeFile = (i: number) => setFiles((prev) => prev.filter((_, idx) => idx !== i));

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

  const deleteSeries = async (id: number) => {
    setOpenSeriesDropdown(null);
    if (!confirm('Delete this series? Cases will be detached but not deleted.')) return;
    try {
      await api.delete(`/case-series/${id}`, token!);
      fetchCases();
      showToast('Series deleted', 'success');
    } catch {
      showToast('Failed to delete series', 'error');
    }
  };

  const duplicateCase = async (id: number) => {
    setOpenDropdown(null);
    if (!confirm('Duplicate this case with all its files?')) return;
    try {
      await api.post(`/cases/${id}/duplicate`, {}, token!);
      fetchCases();
      showToast('Case duplicated successfully', 'success');
    } catch {
      showToast('Failed to duplicate case', 'error');
    }
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !eventCaseId) return;
    const holiday = getKenyaHoliday(eventForm.event_date);
    if (holiday) {
      const msg = `Cannot schedule on a public holiday (${holiday})`;
      setError(msg);
      showToast(msg, 'error');
      return;
    }
    setSaving(true);
    setError('');
    const eventCase = cases.find((c) => c.id === eventCaseId);
    const caseLabel = eventCase?.our_reference || eventCase?.case_number || `Case #${eventCaseId}`;
    const eventTypeLabel = eventForm.event_type;
    const eventMessages: Record<string, string> = {
      'Bring Up': 'Bring up date updated',
      'Mention': 'Mention date updated',
      'Mention of Application': 'Mention of Application date updated',
      'Hearing': 'Hearing date updated',
      'Hearing of Application': 'Hearing of Application date updated',
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

  // --- Series Case modal ---
  const [showSeriesModal, setShowSeriesModal] = useState(false);
  const [seriesForm, setSeriesForm] = useState({
    title: '', client_id: '', assigned_to: '', client_reference: '', our_reference: '', common_parties: '',
    court: '', court_number_filed: '', judge: '',
  });
  const [savingSeries, setSavingSeries] = useState(false);

  // --- Bulk Upload for Series ---
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [bulkUploadSeriesId, setBulkUploadSeriesId] = useState<number | null>(null);
  const [bulkUploadSeriesRef, setBulkUploadSeriesRef] = useState('');
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkUploadProgress, setBulkUploadProgress] = useState(-1);
  const [bulkExcludeCaseIds, setBulkExcludeCaseIds] = useState<number[]>([]);
  const [bulkSeriesCases, setBulkSeriesCases] = useState<{ id: number; series_suffix: string | null; our_reference: string | null; title: string }[]>([]);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  // --- Attach to Series modal ---
  const [showAttachSeriesModal, setShowAttachSeriesModal] = useState(false);
  const [attachCaseId, setAttachCaseId] = useState<number | null>(null);
  const [attachSeriesId, setAttachSeriesId] = useState('');
  const [seriesList, setSeriesList] = useState<{ id: number; reference: string; name: string; active_cases_count: number }[]>([]);
  const [attachingSeries, setAttachingSeries] = useState(false);

  const openAttachToSeries = async (caseId: number) => {
    setOpenDropdown(null);
    setAttachCaseId(caseId);
    setAttachSeriesId('');
    setAttachingSeries(false);
    setError('');
    setShowAttachSeriesModal(true);
    if (token) {
      try {
        const res = await api.get<{ series: { id: number; reference: string; name: string; active_cases_count: number }[] }>('/case-series?per_page=500', token);
        setSeriesList(res.series);
      } catch { /* ignore */ }
    }
  };

  const handleAttachToSeries = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !attachCaseId || !attachSeriesId) return;
    setAttachingSeries(true);
    setError('');
    try {
      await api.post(`/case-series/${attachSeriesId}/link-case`, { case_id: attachCaseId }, token);
      setShowAttachSeriesModal(false);
      setAttachCaseId(null);
      fetchCases();
      showToast('Case attached to series', 'success');
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      const msg = errObj.message || 'Failed to attach case to series';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setAttachingSeries(false);
    }
  };

  const openBulkUpload = async (seriesId: number, seriesRef: string) => {
    setOpenSeriesDropdown(null);
    setBulkUploadSeriesId(seriesId);
    setBulkUploadSeriesRef(seriesRef);
    setBulkFiles([]);
    setBulkUploadProgress(-1);
    setBulkExcludeCaseIds([]);
    setBulkSeriesCases([]);
    setError('');
    setShowBulkUploadModal(true);
    if (token) {
      try {
        const res = await api.get<{ series: { active_cases: typeof bulkSeriesCases } }>(`/case-series/${seriesId}`, token);
        setBulkSeriesCases(res.series.active_cases || []);
      } catch { /* ignore */ }
    }
  };

  const handleBulkUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !bulkUploadSeriesId || bulkFiles.length === 0) return;
    setBulkUploading(true);
    setBulkUploadProgress(0);
    try {
      const fd = new FormData();
      bulkFiles.forEach((f) => fd.append('documents[]', f));
      bulkExcludeCaseIds.forEach((cid) => fd.append('exclude_case_ids[]', String(cid)));
      await api.upload(`/case-series/${bulkUploadSeriesId}/bulk-document`, fd, token, (loaded, total) => {
        setBulkUploadProgress(Math.round((loaded / total) * 100));
      });
      setBulkUploadProgress(100);
      await new Promise((r) => setTimeout(r, 600));
      setShowBulkUploadModal(false);
      const includedCount = bulkSeriesCases.length - bulkExcludeCaseIds.length;
      showToast(`Files uploaded to ${includedCount} case${includedCount !== 1 ? 's' : ''} in ${bulkUploadSeriesRef}`, 'success');
    } catch (err: unknown) {
      const errObj = err as { errors?: Record<string, string[]>; message?: string };
      const msg = errObj.errors ? Object.values(errObj.errors).flat().join(', ') : errObj.message || 'Upload failed';
      setError(msg);
      showToast(`Bulk upload failed: ${msg}`, 'error');
    } finally {
      setBulkUploading(false);
      setBulkUploadProgress(-1);
    }
  };

  const openSeriesCreate = () => {
    setSeriesForm({ title: '', client_id: '', assigned_to: '', client_reference: '', our_reference: '', common_parties: '', court: '', court_number_filed: '', judge: '' });
    setError('');
    setShowSeriesModal(true);
    if (!token) return;
    api.get<{ clients: Client[] }>('/clients?per_page=500', token).then((r) => setClients(r.clients || [])).catch(() => {});
    api.get<{ users: User[] }>('/users?per_page=500', token).then((r) => setUsers(r.users || [])).catch(() => {});
    api.get<{ business: Record<string, unknown> }>('/business', token).then((bRes) => {
      const b = bRes.business;
      const refPrefixes = (b.ref_no_prefixes as Record<string, string>) || {};
      const fmt = refPrefixes.case_number_format || '{FI}/{CP}/{CT}/{N}/{Y}';
      const counter = (b.case_counter as number) || 0;
      setBusinessName(b.name as string);
      setBusinessId(b.id as number);
      setCaseFormat(fmt);
      setCaseCounter(counter);
      setSeriesForm((prev) => ({ ...prev, our_reference: generateOurRef(b.name as string, b.id as number, '', fmt, counter, false, user?.active_location?.city) }));
    }).catch(() => {});
  };

  const handleSeriesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!seriesForm.title.trim()) { setError('Subject is required'); return; }
    setSavingSeries(true);
    setError('');
    try {
      await api.post('/case-series', {
        reference: seriesForm.our_reference,
        name: seriesForm.title,
        client_id: seriesForm.client_id ? Number(seriesForm.client_id) : null,
        assigned_to: seriesForm.assigned_to ? Number(seriesForm.assigned_to) : null,
        client_reference: seriesForm.client_reference || null,
        common_parties: seriesForm.common_parties || null,
        station: seriesForm.court || null,
        judge: seriesForm.judge || null,
      }, token);

      setShowSeriesModal(false);
      fetchCases();
      showToast('Series created successfully', 'success');
    } catch (err: unknown) {
      const e = err as { errors?: Record<string, string[]>; message?: string };
      setError(e.errors ? Object.values(e.errors).flat().join(', ') : e.message || 'Failed to create series');
    } finally {
      setSavingSeries(false);
    }
  };

  const inputClass = 'w-full px-3.5 py-2.5 bg-card-bg border border-border rounded-xl focus:outline-none focus:border-primary focus:ring-0 text-sm transition-colors';

  return (
    <>
      <PageHeader
        title="Cases"
        description="Manage firm cases"
        action={
          canCreate ? (
            <div className="flex items-center gap-2">
              <button onClick={openCreate} className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark text-sm font-medium">
                + Add Case
              </button>
              <button onClick={openSeriesCreate} className="inline-flex items-center gap-1.5 px-4 py-2 border border-primary text-primary rounded-lg hover:bg-primary/5 text-sm font-medium">
                + Series Case
              </button>
            </div>
          ) : null
        }
      />

      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            placeholder="Search cases by title, number, or type..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 bg-card-bg border border-border rounded-xl focus:outline-none focus:border-primary text-sm transition-colors"
          />
        </div>
        {canViewAll && (
          <div className="min-w-[180px]">
            <SearchableSelect
              value={filterAssigned}
              onChange={(v) => { setFilterAssigned(v); setPage(1); }}
              options={[{ value: '', label: 'All Assigned To' }, ...filterUsers.map((u) => ({ value: String(u.id), label: `${u.first_name} ${u.last_name}`.trim() }))]}
              placeholder="Search user..."
            />
          </div>
        )}
        {(canViewAll || canViewOwn) && (
          <div className="min-w-[180px]">
            <SearchableSelect
              value={filterClient}
              onChange={(v) => { setFilterClient(v); setPage(1); }}
              options={[{ value: '', label: 'All Clients' }, ...filterClients.map((c) => ({ value: String(c.id), label: c.client_type === 'business' ? c.business_name || '' : `${c.first_name || ''} ${c.last_name || ''}`.trim() }))]}
              placeholder="Search client..."
            />
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>
      ) : cases.length === 0 ? (
        <div className="text-center py-16 text-muted">
          {search || filterClient || filterAssigned ? 'No cases match your filters.' : 'No cases yet. Add your first case.'}
        </div>
      ) : (
        <div className="bg-card-bg rounded-xl border border-border overflow-visible">
          <table className="w-full text-sm table-fixed sm:table-auto">
            <thead>
              <tr className="border-b border-border bg-gray-50">
                <th className="w-16 sm:w-24 px-2 sm:px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider">Action</th>
                <th className="text-left px-2 sm:px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider">
                  <button
                    type="button"
                    onClick={() => { setSortDir((d) => (d === '' ? 'asc' : d === 'asc' ? 'desc' : '')); setPage(1); }}
                    className="inline-flex items-center gap-1 font-medium uppercase tracking-wider hover:text-foreground transition-colors"
                    title="Sort by reference"
                  >
                    Ref
                    <span className="flex flex-col -space-y-1.5">
                      <svg className={`w-3 h-3 ${sortDir === 'asc' ? 'text-primary' : 'text-muted/40'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" /></svg>
                      <svg className={`w-3 h-3 ${sortDir === 'desc' ? 'text-primary' : 'text-muted/40'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                    </span>
                  </button>
                </th>
                <th className="text-left px-2 sm:px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider hidden sm:table-cell">Client</th>
                <th className="text-left px-2 sm:px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider hidden md:table-cell">Client Ref</th>
                <th className="text-left px-2 sm:px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider hidden md:table-cell">Case Number</th>
                <th className="text-left px-2 sm:px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider w-20 sm:w-auto">Status</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                // Group cases: series cases grouped under their series, standalone cases shown flat
                const seriesMap = new Map<number, { series: { id: number; reference: string; name: string }; cases: CaseItem[] }>();
                const standaloneCases: CaseItem[] = [];
                const rows: Array<{ type: 'series-header'; seriesId: number; series: { id: number; reference: string; name: string }; count: number } | { type: 'case'; case: CaseItem; indent: boolean }> = [];

                cases.forEach((c) => {
                  if (c.case_series_id && c.series) {
                    const group = seriesMap.get(c.case_series_id);
                    if (group) {
                      group.cases.push(c);
                    } else {
                      seriesMap.set(c.case_series_id, { series: c.series, cases: [c] });
                    }
                  } else {
                    standaloneCases.push(c);
                  }
                });

                // Build row list: standalone cases first, then series groups
                standaloneCases.forEach((c) => rows.push({ type: 'case', case: c, indent: false }));
                seriesMap.forEach((group, seriesId) => {
                  rows.push({ type: 'series-header', seriesId, series: group.series, count: group.cases.length });
                  if (expandedSeries.has(seriesId)) {
                    group.cases.forEach((c) => rows.push({ type: 'case', case: c, indent: true }));
                  }
                });

                return rows.map((row) => {
                  if (row.type === 'series-header') {
                    return (
                      <tr
                        key={`series-${row.seriesId}`}
                        className="border-b border-border bg-primary/5"
                      >
                        <td className="px-2 sm:px-4 py-3 relative">
                          <button
                            onClick={(e) => { e.stopPropagation(); setOpenSeriesDropdown(openSeriesDropdown === row.seriesId ? null : row.seriesId); setOpenDropdown(null); }}
                            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors shadow-sm"
                          >
                            <span className="hidden sm:inline">Action</span>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          {openSeriesDropdown === row.seriesId && (
                            <div className="dropdown-menu absolute left-0 top-full mt-1 w-44 bg-white rounded-lg shadow-lg border border-border z-50 py-1 text-left">
                              <button onClick={() => { setOpenSeriesDropdown(null); router.push(`/dashboard/series/${row.seriesId}`); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-primary hover:bg-primary/5 transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                View
                              </button>
                              {canUpdate && (
                                <button onClick={() => { setOpenSeriesDropdown(null); router.push(`/dashboard/series/${row.seriesId}`); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-accent hover:bg-accent/5 transition-colors">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                  Edit
                                </button>
                              )}
                              {canUpdate && (
                                <button onClick={() => openBulkUpload(row.seriesId, row.series.reference)} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-primary/5 transition-colors">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                  Bulk Upload
                                </button>
                              )}
                              {canDelete && (
                                <>
                                  <hr className="my-1 border-border" />
                                  <button onClick={() => deleteSeries(row.seriesId)} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-danger hover:bg-danger/5 transition-colors">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    Delete
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </td>
                        <td
                          className="px-2 sm:px-4 py-3 cursor-pointer select-none"
                          colSpan={3}
                          onClick={() => setExpandedSeries((prev) => {
                            const next = new Set(prev);
                            if (next.has(row.seriesId)) next.delete(row.seriesId);
                            else next.add(row.seriesId);
                            return next;
                          })}
                        >
                          <div className="flex items-center gap-2">
                            <svg className={`w-4 h-4 text-primary shrink-0 transition-transform ${expandedSeries.has(row.seriesId) ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            <svg className="w-4 h-4 text-primary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            <span className="text-sm font-semibold text-primary font-mono">{row.series.reference}</span>
                            <span className="text-xs text-muted">{row.series.name}</span>
                          </div>
                        </td>
                        <td className="px-2 sm:px-4 py-3 hidden md:table-cell" />
                        <td className="px-2 sm:px-4 py-3">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{row.count} case{row.count !== 1 ? 's' : ''}</span>
                        </td>
                      </tr>
                    );
                  }

                  const c = row.case;
                  return (
                    <tr key={c.id} className={`border-b border-border last:border-0 hover:bg-gray-50 ${row.indent ? 'bg-gray-50/50' : ''}`}>
                  <td className="px-2 sm:px-4 py-3 relative">
                    <button
                      onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === c.id ? null : c.id); }}
                      className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors shadow-sm"
                    >
                      <span className="hidden sm:inline">Action</span>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {openDropdown === c.id && (
                      <div className="dropdown-menu absolute left-0 top-full mt-1 w-44 bg-white rounded-lg shadow-lg border border-border z-50 py-1 text-left">
                        <button onClick={() => { setOpenDropdown(null); router.push(`/dashboard/cases/${c.id}`); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-primary hover:bg-primary/5 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          View
                        </button>
                        {canUpdate && (
                          <button onClick={() => openEdit(c)} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-accent hover:bg-accent/5 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            Edit
                          </button>
                        )}
                        {canUpdate && (
                          <button onClick={() => { setOpenDropdown(null); setAddFileCaseId(c.id); setAddFileForm({ document_name: '', document_date: '' }); setAddFileFile(null); setShowAddFileModal(true); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-primary/5 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2zM12 11v4m-2-2h4" /></svg>
                            Add File
                          </button>
                        )}
                        {canUpdate && (
                          <button onClick={() => { setOpenDropdown(null); setEventCaseId(c.id); setEventForm({ event_type: 'Bring Up', event_date: '' }); setShowEventModal(true); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-primary/5 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            Add Event
                          </button>
                        )}
                        {canUpdate && !c.case_series_id && (
                          <button onClick={() => openAttachToSeries(c.id)} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-primary/5 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                            Attach to Series
                          </button>
                        )}
                        {canDelete && (
                          <>
                            <hr className="my-1 border-border" />
                            <button onClick={() => deleteCase(c.id)} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-danger hover:bg-danger/5 transition-colors">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-2 sm:px-4 py-3">
                    <div className={`text-xs font-mono text-muted truncate ${row.indent ? 'pl-5' : ''}`}>
                      {row.indent && <span className="text-primary/40 mr-1">&#x2514;</span>}
                      {c.our_reference || c.case_number}
                    </div>
                    <div className="text-xs text-muted truncate sm:hidden mt-0.5">{clientName(c)}</div>
                  </td>
                  <td className="px-2 sm:px-4 py-3 text-muted break-words hidden sm:table-cell">{clientName(c)}</td>
                  <td className="px-2 sm:px-4 py-3 text-xs text-muted hidden md:table-cell">{c.client_reference || '-'}</td>
                  <td className="px-2 sm:px-4 py-3 text-muted hidden md:table-cell">{c.case_number}</td>
                  <td className="px-2 sm:px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[c.status] || ''}`}>{c.status}</span>
                  </td>
                    </tr>
                  );
                });
              })()}
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
                <div>
                  <label className="block text-sm font-medium mb-2">Case Type *</label>
                  <div className="flex gap-4">
                    {['Plaintiff', 'Defendant'].map((type) => (
                      <label key={type} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer transition-all text-sm ${form.case_type === type ? 'bg-primary/5 border-primary/30' : 'border-border hover:bg-gray-50'}`}>
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${form.case_type === type ? 'border-primary' : 'border-gray-300'}`}>
                          {form.case_type === type && <div className="w-2 h-2 rounded-full bg-primary" />}
                          <input type="radio" name="case_type" checked={form.case_type === type} onChange={() => setForm((prev) => {
                            const nextRecovery = type === 'Plaintiff' ? null : false;
                            return { ...prev, case_type: type, is_recovery: nextRecovery, our_reference: generateOurRef(businessName, businessId, prev.client_id, caseFormat, caseCounter, false, user?.active_location?.city) };
                          })} className="absolute opacity-0" />
                        </div>
                        <span>{type}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {form.case_type === 'Plaintiff' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Is this a recovery?</label>
                    <div className="flex gap-4">
                      <label className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer transition-all text-sm ${form.is_recovery === true ? 'bg-primary/5 border-primary/30' : 'border-border hover:bg-gray-50'}`}>
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${form.is_recovery === true ? 'border-primary' : 'border-gray-300'}`}>
                          {form.is_recovery === true && <div className="w-2 h-2 rounded-full bg-primary" />}
                          <input type="radio" name="is_recovery_top" checked={form.is_recovery === true} onChange={() => setForm((prev) => ({ ...prev, is_recovery: true, our_reference: generateOurRef(businessName, businessId, prev.client_id, caseFormat, caseCounter, true, user?.active_location?.city) }))} className="absolute opacity-0" />
                        </div>
                        <span>Yes</span>
                      </label>
                      <label className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer transition-all text-sm ${form.is_recovery === false ? 'bg-primary/5 border-primary/30' : 'border-border hover:bg-gray-50'}`}>
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${form.is_recovery === false ? 'border-primary' : 'border-gray-300'}`}>
                          {form.is_recovery === false && <div className="w-2 h-2 rounded-full bg-primary" />}
                          <input type="radio" name="is_recovery_top" checked={form.is_recovery === false} onChange={() => setForm((prev) => ({ ...prev, is_recovery: false, our_reference: generateOurRef(businessName, businessId, prev.client_id, caseFormat, caseCounter, false, user?.active_location?.city) }))} className="absolute opacity-0" />
                        </div>
                        <span>No</span>
                      </label>
                    </div>
                  </div>
                )}
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

              <div>
                <label className="block text-sm font-medium mb-1">Parties</label>
                <textarea value={form.parties} onChange={(e) => setForm({ ...form, parties: e.target.value })} rows={3} className={inputClass} placeholder="List the parties involved" />
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.is_filed_in_court}
                    onChange={(e) => setForm((prev) => ({ ...prev, is_filed_in_court: e.target.checked, case_number: e.target.checked ? prev.case_number : '', filed_date: e.target.checked ? prev.filed_date : '', court: e.target.checked ? prev.court : '', court_number_filed: e.target.checked ? prev.court_number_filed : '', judge: e.target.checked ? prev.judge : '' }))}
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm font-medium">Is the case filed in court?</span>
                </label>
              </div>

              {form.is_filed_in_court && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Station</label>
                      <input value={form.court} onChange={(e) => setForm({ ...form, court: e.target.value })} className={inputClass} placeholder="Station name" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Case Number</label>
                      <input value={form.case_number} onChange={(e) => setForm({ ...form, case_number: e.target.value.toUpperCase() })} className={inputClass} placeholder="Case number" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Before Court No</label>
                      <input value={form.court_number_filed} onChange={(e) => setForm({ ...form, court_number_filed: e.target.value.toUpperCase() })} className={inputClass} placeholder="Before court no" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Magistrate/Judge</label>
                      <input value={form.judge} onChange={(e) => setForm({ ...form, judge: e.target.value })} className={inputClass} placeholder="Magistrate or Judge name" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Date Filed in Court</label>
                    <DatePicker value={form.filed_date} onChange={(v) => setForm({ ...form, filed_date: v })} />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 text-sm font-medium border border-border rounded-xl hover:bg-background transition-colors text-muted hover:text-foreground">Cancel</button>
                <button
                  type="button"
                  onClick={() => {
                    if (!form.title.trim()) { setError('Subject is required'); return; }
                    if (!form.case_type) { setError('Please select a case type'); return; }
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
                        <label className="block text-xs text-muted mb-1">Name</label>
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
                      <button type="button" disabled={savingOC || (!newOC.name.trim() && !newOC.firm.trim())} onClick={() => saveOpposingCounsel((id) => setForm((prev) => ({ ...prev, opposing_counsel_id: id })))} className="px-3 py-1.5 text-xs bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors">
                        {savingOC ? 'Saving...' : 'Save & Select'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Documents */}
              <div>
                <label className="block text-sm font-medium mb-2">Documents</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      addFiles(e.target.files);
                    }
                    e.target.value = '';
                  }}
                  className="hidden"
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-primary', 'bg-primary/5'); }}
                  onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-primary', 'bg-primary/5'); }}
                  onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-primary', 'bg-primary/5'); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); }}
                  className="flex flex-col items-center justify-center w-full border-2 border-dashed border-border rounded-xl py-6 cursor-pointer hover:border-primary/40 hover:text-primary transition-colors text-center"
                >
                  <svg className="w-6 h-6 mb-1.5 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2zM12 11v4m-2-2h4" /></svg>
                  <span className="text-sm text-muted">Click or drag files here to attach (optional)</span>
                  <span className="text-xs text-muted mt-0.5">You can select multiple files at once</span>
                </div>
                {files.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {files.map((f, i) => {
                      const sizeKB = f.size / 1024;
                      const sizeLabel = sizeKB >= 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB.toFixed(0)} KB`;
                      return (
                        <div key={i} className="bg-gray-50 border border-border rounded-lg overflow-hidden">
                          <div className="flex items-center gap-2 px-3 py-2">
                            <svg className="w-4 h-4 text-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            <span className="flex-1 text-sm truncate">{f.name}</span>
                            <span className="text-xs text-muted shrink-0">{sizeLabel}</span>
                            {uploadProgress >= 0 ? (
                              <span className="text-xs font-medium text-primary shrink-0">{uploadProgress < 100 ? `${uploadProgress}%` : 'Done'}</span>
                            ) : (
                              <button type="button" onClick={() => removeFile(i)} className="p-1 text-danger hover:bg-danger/5 rounded transition-colors shrink-0">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                            )}
                          </div>
                          {uploadProgress >= 0 && (
                            <div className="h-1 bg-gray-200">
                              <div className={`h-1 transition-all duration-300 ${uploadProgress >= 100 ? 'bg-emerald-500' : 'bg-primary'}`} style={{ width: `${Math.min(uploadProgress, 100)}%` }} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {files.length > 1 && (
                      <div className="text-xs text-muted text-right">{files.length} files &middot; {(() => { const total = files.reduce((s, f) => s + f.size, 0) / 1024; return total >= 1024 ? `${(total / 1024).toFixed(1)} MB` : `${total.toFixed(0)} KB`; })()}</div>
                    )}
                  </div>
                )}
              </div>

              {uploadProgress >= 0 && (
                <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium">{uploadProgress < 100 ? 'Uploading files...' : 'Processing...'}</span>
                    <span className="text-sm font-medium text-primary">{uploadProgress}%</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className={`h-2 rounded-full transition-all duration-300 ${uploadProgress >= 100 ? 'bg-emerald-500' : 'bg-primary'}`} style={{ width: `${Math.min(uploadProgress, 100)}%` }} />
                  </div>
                </div>
              )}

              <div className="flex justify-between gap-3 pt-4 border-t border-border">
                <button type="button" disabled={saving} onClick={() => { setStep(1); setError(''); }} className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium border border-border rounded-xl hover:bg-background transition-colors text-muted hover:text-foreground disabled:opacity-50">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  Back
                </button>
                <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-primary text-white rounded-xl hover:bg-primary-dark disabled:opacity-50 transition-colors">
                  {saving ? (uploadProgress >= 0 ? `Uploading ${uploadProgress}%` : 'Creating...') : 'Create Case'}
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
            {canReassign ? (
              <SearchableSelect
                label="Assigned To"
                value={editForm.assigned_to}
                onChange={(v) => setEditForm((prev) => ({ ...prev, assigned_to: v }))}
                options={[{ value: '', label: 'Not assigned' }, ...users.map((u) => ({ value: String(u.id), label: `${u.first_name} ${u.last_name}`.trim() }))]}
                placeholder="Search user..."
              />
            ) : (
              <div>
                <label className="block text-sm font-medium mb-1">Assigned To</label>
                <input
                  value={(() => { const u = users.find((u) => String(u.id) === editForm.assigned_to); return u ? `${u.first_name} ${u.last_name}`.trim() : editForm.assigned_to || ''; })()}
                  readOnly
                  className={`${inputClass} bg-gray-50 cursor-not-allowed`}
                  placeholder="Not assigned"
                />
              </div>
            )}
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
                  <label className="block text-xs text-muted mb-1">Name</label>
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
                <button type="button" disabled={savingOC || (!newOC.name.trim() && !newOC.firm.trim())} onClick={() => saveOpposingCounsel((id) => setEditForm((prev) => ({ ...prev, opposing_counsel_id: id })))} className="px-3 py-1.5 text-xs bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors">
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
              <label className="block text-sm font-medium mb-2">Case Type *</label>
              <div className="flex gap-4">
                {['Plaintiff', 'Defendant'].map((type) => (
                  <label key={type} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer transition-all text-sm ${editForm.case_type === type ? 'bg-primary/5 border-primary/30' : 'border-border hover:bg-gray-50'}`}>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${editForm.case_type === type ? 'border-primary' : 'border-gray-300'}`}>
                      {editForm.case_type === type && <div className="w-2 h-2 rounded-full bg-primary" />}
                      <input type="radio" name="edit_case_type" checked={editForm.case_type === type} onChange={() => setEditForm((prev) => ({ ...prev, case_type: type, is_recovery: type === 'Plaintiff' ? prev.is_recovery : false }))} className="absolute opacity-0" />
                    </div>
                    <span>{type}</span>
                  </label>
                ))}
              </div>
            </div>

            {editForm.case_type === 'Plaintiff' && (
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
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Our Reference</label>
            <input value={editForm.our_reference} onChange={(e) => setEditForm({ ...editForm, our_reference: e.target.value })} className={inputClass} placeholder="Our reference" />
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={editForm.is_filed_in_court}
                onChange={(e) => setEditForm((prev) => ({ ...prev, is_filed_in_court: e.target.checked, case_number: e.target.checked ? prev.case_number : '', filed_date: e.target.checked ? prev.filed_date : '', court: e.target.checked ? prev.court : '', court_number_filed: e.target.checked ? prev.court_number_filed : '', judge: e.target.checked ? prev.judge : '' }))}
                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-sm font-medium">Is the case filed in court?</span>
            </label>
          </div>

          {editForm.is_filed_in_court && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Station</label>
                  <input value={editForm.court} onChange={(e) => setEditForm({ ...editForm, court: e.target.value })} className={inputClass} placeholder="Station name" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Case Number</label>
                  <input value={editForm.case_number} onChange={(e) => setEditForm({ ...editForm, case_number: e.target.value.toUpperCase() })} className={inputClass} placeholder="Case number" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Before Court No</label>
                  <input value={editForm.court_number_filed} onChange={(e) => setEditForm({ ...editForm, court_number_filed: e.target.value.toUpperCase() })} className={inputClass} placeholder="Before court no" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Magistrate/Judge</label>
                  <input value={editForm.judge} onChange={(e) => setEditForm({ ...editForm, judge: e.target.value })} className={inputClass} placeholder="Magistrate or Judge name" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Date Filed in Court</label>
                <DatePicker value={editForm.filed_date} onChange={(v) => setEditForm({ ...editForm, filed_date: v })} />
              </div>
            </div>
          )}

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
            <DatePicker
              value={addFileForm.document_date}
              onChange={(v) => setAddFileForm({ ...addFileForm, document_date: v })}
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
              <option value="Mention of Application">Mention of Application</option>
              <option value="Hearing">Hearing</option>
              <option value="Hearing of Application">Hearing of Application</option>
              <option value="Ruling">Ruling</option>
              <option value="Judgement">Judgement</option>
            </select>
          </div>

          <DatePicker blockHolidays label="Event Date" value={eventForm.event_date} onChange={(v) => setEventForm({ ...eventForm, event_date: v })} />

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button type="button" onClick={() => { setShowEventModal(false); setEventCaseId(null); setError(''); }} className="px-5 py-2.5 text-sm font-medium border border-border rounded-xl hover:bg-background transition-colors text-muted hover:text-foreground">Cancel</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-primary text-white rounded-xl hover:bg-primary-dark disabled:opacity-50 transition-colors">
              {saving ? 'Adding...' : 'Add Event'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={showSeriesModal} onClose={() => setShowSeriesModal(false)} title="New Series" size="lg">
        <form onSubmit={handleSeriesSubmit} className="space-y-4">
          {error && <div className="bg-danger/5 border border-danger/20 text-danger text-sm px-4 py-3 rounded-lg">{error}</div>}

          <div>
            <label className="block text-sm font-medium mb-1">Subject *</label>
            <input value={seriesForm.title} onChange={(e) => setSeriesForm({ ...seriesForm, title: e.target.value.toUpperCase() })} className={inputClass} placeholder="Series subject" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <SearchableSelect
              label="Client"
              value={seriesForm.client_id}
              onChange={(v) => setSeriesForm((prev) => ({ ...prev, client_id: v, our_reference: generateOurRef(businessName, businessId, v, caseFormat, caseCounter, false, user?.active_location?.city) }))}
              options={clients.map((c) => ({
                value: String(c.id),
                label: c.client_type === 'individual'
                  ? [c.first_name, c.last_name].filter(Boolean).join(' ')
                  : (c.business_name || ''),
              }))}
              placeholder="Select client..."
            />
            <SearchableSelect
              label="Assigned to"
              value={seriesForm.assigned_to}
              onChange={(v) => setSeriesForm({ ...seriesForm, assigned_to: v })}
              options={users.map((u) => ({ value: String(u.id), label: `${u.first_name} ${u.last_name}` }))}
              placeholder="Select user..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Client Reference</label>
              <input value={seriesForm.client_reference} onChange={(e) => setSeriesForm({ ...seriesForm, client_reference: e.target.value })} className={inputClass} placeholder="Client reference" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Our Reference</label>
              <input value={seriesForm.our_reference} onChange={(e) => setSeriesForm({ ...seriesForm, our_reference: e.target.value })} className={inputClass} placeholder="Our reference" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Defendant (Common Party)</label>
            <input value={seriesForm.common_parties} onChange={(e) => setSeriesForm({ ...seriesForm, common_parties: e.target.value.toUpperCase() })} className={inputClass} placeholder="Defendant (Common Party)" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Station</label>
              <input value={seriesForm.court} onChange={(e) => setSeriesForm({ ...seriesForm, court: e.target.value })} className={inputClass} placeholder="e.g. Nairobi" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Magistrate / Judge</label>
              <input value={seriesForm.judge} onChange={(e) => setSeriesForm({ ...seriesForm, judge: e.target.value })} className={inputClass} placeholder="Magistrate or Judge name" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button type="button" onClick={() => setShowSeriesModal(false)} className="px-5 py-2.5 text-sm font-medium border border-border rounded-xl hover:bg-background transition-colors text-muted hover:text-foreground">Cancel</button>
            <button type="submit" disabled={savingSeries} className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-primary text-white rounded-xl hover:bg-primary-dark disabled:opacity-50 transition-colors">
              {savingSeries ? 'Creating...' : 'Create Series'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={showBulkUploadModal} onClose={() => { setShowBulkUploadModal(false); setBulkUploadSeriesId(null); setBulkFiles([]); setBulkUploadProgress(-1); setError(''); }} title={`Bulk Upload — ${bulkUploadSeriesRef}`} size="md">
        <form onSubmit={handleBulkUpload} className="space-y-4">
          {error && <div className="bg-danger/5 border border-danger/20 text-danger text-sm px-4 py-3 rounded-lg">{error}</div>}

          {bulkSeriesCases.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">Include Cases</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {bulkSeriesCases.map(c => {
                  const excluded = bulkExcludeCaseIds.includes(c.id);
                  return (
                    <label key={c.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors ${excluded ? 'border-border/60 bg-background/50 text-muted' : 'border-primary/30 bg-primary/5'}`}>
                      <input type="checkbox" checked={!excluded} onChange={() => setBulkExcludeCaseIds(prev => prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id])} className="w-4 h-4 rounded text-primary" />
                      <span className="font-mono text-xs">{c.series_suffix || '?'}</span>
                      <span className="truncate">{c.our_reference || c.title}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <input
              ref={bulkFileInputRef}
              type="file"
              multiple
              onChange={(e) => {
                const selected = Array.from(e.target.files || []).filter((f) => f.name && f.size > 0);
                if (selected.length > 0) {
                  setBulkFiles((prev) => [...prev, ...selected]);
                }
                e.target.value = '';
              }}
              className="hidden"
            />
            <div
              onClick={(e) => { e.stopPropagation(); bulkFileInputRef.current?.click(); }}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-primary', 'bg-primary/5'); }}
              onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-primary', 'bg-primary/5'); }}
              onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-primary', 'bg-primary/5'); if (e.dataTransfer.files.length) setBulkFiles((prev) => [...prev, ...Array.from(e.dataTransfer.files).filter((f) => f.name && f.size > 0)]); }}
              className="flex flex-col items-center justify-center w-full border-2 border-dashed border-border rounded-xl py-6 cursor-pointer hover:border-primary/40 hover:text-primary transition-colors text-center"
            >
              <svg className="w-6 h-6 mb-1.5 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              <span className="text-sm text-muted">Click or drag files here</span>
              <span className="text-xs text-muted mt-0.5">Files will be added to every case in the series</span>
            </div>
            {bulkFiles.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {bulkFiles.map((f, i) => {
                  const sizeKB = f.size / 1024;
                  const sizeLabel = sizeKB >= 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB.toFixed(0)} KB`;
                  return (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-border rounded-lg">
                      <svg className="w-4 h-4 text-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      <span className="flex-1 text-sm truncate">{f.name}</span>
                      <span className="text-xs text-muted shrink-0">{sizeLabel}</span>
                      {!bulkUploading && (
                        <button type="button" onClick={() => setBulkFiles((prev) => prev.filter((_, idx) => idx !== i))} className="p-1 text-danger hover:bg-danger/5 rounded transition-colors shrink-0">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      )}
                    </div>
                  );
                })}
                <div className="text-xs text-muted text-right">{bulkFiles.length} file{bulkFiles.length !== 1 ? 's' : ''} &middot; {(() => { const total = bulkFiles.reduce((s, f) => s + f.size, 0) / 1024; return total >= 1024 ? `${(total / 1024).toFixed(1)} MB` : `${total.toFixed(0)} KB`; })()}</div>
              </div>
            )}
          </div>

          {bulkUploadProgress >= 0 && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium">{bulkUploadProgress < 100 ? 'Uploading to all cases...' : 'Done!'}</span>
                <span className="text-sm font-medium text-primary">{bulkUploadProgress}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className={`h-2 rounded-full transition-all duration-300 ${bulkUploadProgress >= 100 ? 'bg-emerald-500' : 'bg-primary'}`} style={{ width: `${Math.min(bulkUploadProgress, 100)}%` }} />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button type="button" onClick={() => { setShowBulkUploadModal(false); setBulkUploadSeriesId(null); setBulkFiles([]); setBulkUploadProgress(-1); setError(''); }} className="px-5 py-2.5 text-sm font-medium border border-border rounded-xl hover:bg-background transition-colors text-muted hover:text-foreground">Cancel</button>
            <button type="submit" disabled={bulkUploading || bulkFiles.length === 0} className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-primary text-white rounded-xl hover:bg-primary-dark disabled:opacity-50 transition-colors">
              {bulkUploading ? `Uploading ${bulkUploadProgress}%` : `Upload to ${bulkSeriesCases.length - bulkExcludeCaseIds.length} Case${(bulkSeriesCases.length - bulkExcludeCaseIds.length) !== 1 ? 's' : ''}`}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={showAttachSeriesModal} onClose={() => { setShowAttachSeriesModal(false); setAttachCaseId(null); setSeriesList([]); setError(''); }} title="Attach to Series" size="sm">
        <form onSubmit={handleAttachToSeries} className="space-y-4">
          {error && <div className="bg-danger/5 border border-danger/20 text-danger text-sm px-4 py-3 rounded-lg">{error}</div>}

          <p className="text-sm text-muted">
            Select a series to attach this case to. If the series has no cases, this will become <strong>Series-A</strong>. Otherwise it takes the next letter.
          </p>

          <SearchableSelect
            label="Series *"
            value={attachSeriesId}
            onChange={(v) => setAttachSeriesId(v)}
            options={[{ value: '', label: 'Select a series...' }, ...seriesList.map((s) => ({ value: String(s.id), label: `${s.reference} — ${s.name} (${s.active_cases_count} case${s.active_cases_count !== 1 ? 's' : ''})` }))]}
            placeholder="Search series..."
          />

          {attachSeriesId && (() => {
            const selected = seriesList.find((s) => String(s.id) === attachSeriesId);
            if (!selected) return null;
            return (
              <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 text-sm">
                <span className="font-medium">{selected.reference}</span>
                <span className="text-muted ml-2">
                  {selected.active_cases_count === 0
                    ? '— No cases yet. This case will become suffix A.'
                    : `— ${selected.active_cases_count} existing case${selected.active_cases_count !== 1 ? 's' : ''}. This case will get the next suffix.`}
                </span>
              </div>
            );
          })()}

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button type="button" onClick={() => { setShowAttachSeriesModal(false); setAttachCaseId(null); setSeriesList([]); setError(''); }} className="px-5 py-2.5 text-sm font-medium border border-border rounded-xl hover:bg-background transition-colors text-muted hover:text-foreground">Cancel</button>
            <button type="submit" disabled={attachingSeries || !attachSeriesId} className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-primary text-white rounded-xl hover:bg-primary-dark disabled:opacity-50 transition-colors">
              {attachingSeries ? 'Attaching...' : 'Attach to Series'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
