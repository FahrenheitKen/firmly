'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
  assigned_to?: { id: number; first_name: string; last_name: string } | null;
  created_by_user?: { id: number; first_name: string; last_name: string } | null;
  collaborators?: Array<{ id: number; first_name: string; last_name: string }>;
  active_cases: CaseInSeries[];
}

interface ClientLite { id: number; first_name: string | null; last_name: string | null; business_name: string | null }
interface UserLite { id: number; first_name: string; last_name: string }
interface OcLite { id: number; name: string }
interface SeriesTask {
  id: number;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  due_date: string | null;
  assigned_to: number | null;
  assignee?: { id: number; first_name: string; last_name: string } | null;
  created_by_user?: { id: number; first_name: string; last_name: string } | null;
  case?: { id: number; case_number: string | null; title: string; series_suffix: string | null } | null;
}

const statusColors: Record<string, string> = {
  Open: 'bg-blue-50 text-blue-700',
  'In Progress': 'bg-yellow-50 text-yellow-700',
  Closed: 'bg-green-50 text-green-700',
};

export default function SeriesDetailPage() {
  const { token, can, isOwner, user } = useAuth();
  const canCreate = isOwner || can('case.create');
  const canUpdate = isOwner || can('case.update');
  const { toast } = useToast();
  const formatDate = useFormatDate();
  const router = useRouter();
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

  const [showAddOC, setShowAddOC] = useState(false);
  const [newOC, setNewOC] = useState({ name: '', firm: '', phone: '', email: '' });
  const [savingOC, setSavingOC] = useState(false);

  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkUploadProgress, setBulkUploadProgress] = useState(-1);
  const [bulkExcludeCaseIds, setBulkExcludeCaseIds] = useState<number[]>([]);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  const [openCaseDropdown, setOpenCaseDropdown] = useState<number | null>(null);

  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicatingCaseId, setDuplicatingCaseId] = useState<number | null>(null);
  const [duplicateForm, setDuplicateForm] = useState({ description: '', opposing_counsel_id: '' });
  const [duplicating, setDuplicating] = useState(false);
  const [showDupAddOC, setShowDupAddOC] = useState(false);
  const [dupNewOC, setDupNewOC] = useState({ name: '', firm: '', phone: '', email: '' });
  const [savingDupOC, setSavingDupOC] = useState(false);

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', priority: 'Medium', assigned_to: '', due_date: '', exclude_case_ids: [] as number[] });
  const [savingTask, setSavingTask] = useState(false);

  const [seriesTasks, setSeriesTasks] = useState<SeriesTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);
  const [bulkStatus, setBulkStatus] = useState('');
  const [updatingTasks, setUpdatingTasks] = useState(false);

  const [showCollabModal, setShowCollabModal] = useState(false);
  const [collabUserId, setCollabUserId] = useState('');
  const [collabSaving, setCollabSaving] = useState(false);
  const [collabUsers, setCollabUsers] = useState<UserLite[]>([]);

  const isSeriesLead = !!series?.assigned_to && series.assigned_to.id === user?.id;
  const canManageCollaborators = isOwner || isSeriesLead;

  const openCollabModal = async () => {
    if (!token) return;
    if (collabUsers.length === 0) {
      try {
        const r = await api.get<{ users: UserLite[] }>('/users?per_page=500', token);
        setCollabUsers(r.users);
      } catch { /* ignore */ }
    }
    setCollabUserId('');
    setShowCollabModal(true);
  };

  const addSeriesCollaborator = async () => {
    if (!token || !collabUserId || !series) return;
    setCollabSaving(true);
    try {
      const res = await api.post<{ collaborator: { id: number; first_name: string; last_name: string } }>(`/case-series/${series.id}/collaborators`, { user_id: Number(collabUserId) }, token);
      setSeries((prev) => prev ? { ...prev, collaborators: [...(prev.collaborators || []), res.collaborator] } : prev);
      setShowCollabModal(false);
      toast('Collaborator added', 'success');
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast(e.message || 'Failed to add collaborator', 'error');
    } finally {
      setCollabSaving(false);
    }
  };

  const removeSeriesCollaborator = async (userId: number) => {
    if (!token || !series || !confirm('Remove this collaborator?')) return;
    try {
      await api.delete(`/case-series/${series.id}/collaborators/${userId}`, token);
      setSeries((prev) => prev ? { ...prev, collaborators: (prev.collaborators || []).filter((c) => c.id !== userId) } : prev);
      toast('Collaborator removed', 'success');
    } catch {
      toast('Failed to remove collaborator', 'error');
    }
  };

  useEffect(() => {
    if (openCaseDropdown === null) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.case-dropdown-menu')) setOpenCaseDropdown(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openCaseDropdown]);

  const openDuplicateModal = (caseId: number) => {
    setOpenCaseDropdown(null);
    setDuplicatingCaseId(caseId);
    setDuplicateForm({ description: '', opposing_counsel_id: '' });
    setShowDupAddOC(false);
    setDupNewOC({ name: '', firm: '', phone: '', email: '' });
    setError('');
    setShowDuplicateModal(true);
    loadFormData();
  };

  const handleDuplicate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !duplicatingCaseId) return;
    setDuplicating(true);
    setError('');
    try {
      const payload: Record<string, unknown> = { series_id: Number(id) };
      if (duplicateForm.description.trim()) payload.description = duplicateForm.description;
      if (duplicateForm.opposing_counsel_id) payload.opposing_counsel_id = Number(duplicateForm.opposing_counsel_id);
      await api.post(`/cases/${duplicatingCaseId}/duplicate`, payload, token);
      toast('Case duplicated', 'success');
      setShowDuplicateModal(false);
      fetchSeries();
    } catch (err: unknown) {
      const e = err as { errors?: Record<string, string[]>; message?: string };
      setError(e.errors ? Object.values(e.errors).flat().join(', ') : e.message || 'Failed to duplicate case');
    } finally { setDuplicating(false); }
  };

  const saveDupOpposingCounsel = async () => {
    if (!token || (!dupNewOC.name.trim() && !dupNewOC.firm.trim())) return;
    setSavingDupOC(true);
    try {
      const res = await api.post<{ opposing_counsel: OcLite }>('/opposing-counsels', dupNewOC, token);
      const created = res.opposing_counsel;
      setCounsels((prev) => [...prev, created]);
      setDuplicateForm((prev) => ({ ...prev, opposing_counsel_id: String(created.id) }));
      setShowDupAddOC(false);
      setDupNewOC({ name: '', firm: '', phone: '', email: '' });
    } catch (err: unknown) {
      setError((err as { message?: string }).message || 'Failed to save opposing counsel');
    } finally { setSavingDupOC(false); }
  };

  const fetchSeriesTasks = useCallback(async () => {
    if (!token) return;
    setLoadingTasks(true);
    try {
      const res = await api.get<{ tasks: SeriesTask[] }>(`/case-series/${id}/tasks`, token);
      setSeriesTasks(res.tasks);
    } catch { /* ignore */ }
    finally { setLoadingTasks(false); }
  }, [token, id]);

  const openBulkTask = () => {
    setTaskForm({ title: '', description: '', priority: 'Medium', assigned_to: '', due_date: '', exclude_case_ids: [] });
    setError('');
    setShowTaskModal(true);
    loadFormData();
  };

  const handleBulkTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSavingTask(true);
    setError('');
    try {
      const payload: Record<string, unknown> = {
        title: taskForm.title,
        description: taskForm.description || null,
        priority: taskForm.priority,
        assigned_to: taskForm.assigned_to ? Number(taskForm.assigned_to) : null,
        due_date: taskForm.due_date || null,
        exclude_case_ids: taskForm.exclude_case_ids,
      };
      const res = await api.post<{ message: string }>(`/case-series/${id}/bulk-task`, payload, token);
      toast(res.message, 'success');
      setShowTaskModal(false);
      fetchSeriesTasks();
    } catch (err: unknown) {
      const e = err as { errors?: Record<string, string[]>; message?: string };
      setError(e.errors ? Object.values(e.errors).flat().join(', ') : e.message || 'Failed');
    } finally { setSavingTask(false); }
  };

  const toggleTaskSelect = (taskId: number) => {
    setSelectedTaskIds(prev => prev.includes(taskId) ? prev.filter(x => x !== taskId) : [...prev, taskId]);
  };

  const toggleAllTasks = () => {
    const activeTasks = seriesTasks.filter(t => t.status !== 'Completed' && t.status !== 'Cancelled');
    if (selectedTaskIds.length === activeTasks.length) {
      setSelectedTaskIds([]);
    } else {
      setSelectedTaskIds(activeTasks.map(t => t.id));
    }
  };

  const handleBulkUpdateStatus = async () => {
    if (!token || !bulkStatus || selectedTaskIds.length === 0) return;
    setUpdatingTasks(true);
    try {
      const res = await api.put<{ message: string }>(`/case-series/${id}/bulk-task-status`, { status: bulkStatus, task_ids: selectedTaskIds }, token);
      toast(res.message, 'success');
      setSelectedTaskIds([]);
      setBulkStatus('');
      fetchSeriesTasks();
    } catch (err: unknown) {
      toast((err as { message?: string }).message || 'Failed to update tasks', 'error');
    } finally { setUpdatingTasks(false); }
  };

  const fetchSeries = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api.get<{ series: SeriesDetail }>(`/case-series/${id}`, token);
      setSeries(res.series);
    } catch { toast('Failed to load series', 'error'); }
    finally { setLoading(false); }
  }, [token, id]); // eslint-disable-line

  useEffect(() => { fetchSeries(); fetchSeriesTasks(); }, [fetchSeries, fetchSeriesTasks]);

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

  const saveOpposingCounsel = async () => {
    if (!token || (!newOC.name.trim() && !newOC.firm.trim())) return;
    setSavingOC(true);
    try {
      const res = await api.post<{ opposing_counsel: OcLite }>('/opposing-counsels', newOC, token);
      const created = res.opposing_counsel;
      setCounsels((prev) => [...prev, created]);
      setCaseForm((prev) => ({ ...prev, opposing_counsel_id: String(created.id) }));
      setShowAddOC(false);
      setNewOC({ name: '', firm: '', phone: '', email: '' });
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Failed to save opposing counsel');
    } finally {
      setSavingOC(false);
    }
  };

  const openCreateCase = () => {
    setCaseForm({ title: '', client_id: '', client_reference: '', opposing_counsel_id: '', assigned_to: '', case_number: '', court: '', court_number_filed: '', judge: '', case_type: 'Defendant', filed_date: '', description: '' });
    setError('');
    setShowAddOC(false);
    setNewOC({ name: '', firm: '', phone: '', email: '' });
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

  const handleBulkUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || bulkFiles.length === 0) return;
    setBulkUploading(true);
    setBulkUploadProgress(0);
    try {
      const fd = new FormData();
      bulkFiles.forEach((f) => fd.append('documents[]', f));
      bulkExcludeCaseIds.forEach((cid) => fd.append('exclude_case_ids[]', String(cid)));
      await api.upload(`/case-series/${id}/bulk-document`, fd, token, (loaded, total) => {
        setBulkUploadProgress(Math.round((loaded / total) * 100));
      });
      setBulkUploadProgress(100);
      await new Promise((r) => setTimeout(r, 600));
      setShowBulkUploadModal(false);
      setBulkFiles([]);
      setBulkUploadProgress(-1);
      const includedCount = series!.active_cases.length - bulkExcludeCaseIds.length;
      toast(`Files uploaded to ${includedCount} case${includedCount !== 1 ? 's' : ''} in series`, 'success');
    } catch (err: unknown) {
      const errObj = err as { errors?: Record<string, string[]>; message?: string };
      const msg = errObj.errors ? Object.values(errObj.errors).flat().join(', ') : errObj.message || 'Upload failed';
      setError(msg);
      toast(`Bulk upload failed: ${msg}`, 'error');
    } finally {
      setBulkUploading(false);
      setBulkUploadProgress(-1);
    }
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
        <Link href="/dashboard/series" className="hover:text-foreground transition-colors">Series Cases</Link>
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
              <button onClick={() => { setBulkFiles([]); setBulkUploadProgress(-1); setBulkExcludeCaseIds([]); setError(''); setShowBulkUploadModal(true); }} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg hover:bg-emerald-100 text-sm font-medium">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                Bulk Upload
              </button>
              <button onClick={openBulkTask} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-violet-50 border border-violet-200 text-violet-700 rounded-lg hover:bg-violet-100 text-sm font-medium">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                Bulk Task
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

      <div className="mb-4 bg-card-bg rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">Collaborators</h3>
          {canManageCollaborators && (
            <button onClick={openCollabModal} className="text-xs text-primary hover:underline font-medium">+ Add</button>
          )}
        </div>
        {(series.collaborators && series.collaborators.length > 0) ? (
          <div className="flex flex-wrap gap-2">
            {series.collaborators.map((c) => (
              <div key={c.id} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 border border-blue-100 rounded-lg group">
                <div className="w-5 h-5 rounded-full bg-blue-200 text-blue-700 flex items-center justify-center text-[9px] font-bold shrink-0">
                  {c.first_name?.[0]}{c.last_name?.[0]}
                </div>
                <span className="text-xs font-medium text-blue-800">{c.first_name} {c.last_name}</span>
                {canManageCollaborators && (
                  <button onClick={() => removeSeriesCollaborator(c.id)} className="text-blue-400 hover:text-red-500 ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity" title="Remove">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No collaborators</p>
        )}
        {series.assigned_to && (
          <p className="text-xs text-muted mt-2">Lead Advocate: <span className="font-medium text-foreground">{series.assigned_to.first_name} {series.assigned_to.last_name}</span></p>
        )}
      </div>

      <div className="bg-card-bg rounded-xl border border-border overflow-visible">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <p className="text-sm font-medium">{series.active_cases.length} Case{series.active_cases.length !== 1 ? 's' : ''} in Series</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-gray-50">
              <th className="w-16 sm:w-24 px-2 sm:px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider text-left">Actions</th>
              <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider w-16">Series</th>
              <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider">Our Reference</th>
              <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider hidden sm:table-cell">Case Number</th>
              <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider hidden md:table-cell">Client</th>
              <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider hidden lg:table-cell">Assigned To</th>
              <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider w-24">Status</th>
            </tr>
          </thead>
          <tbody>
            {series.active_cases.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted">No cases in this series yet. Add one to get started.</td></tr>
            )}
            {series.active_cases.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0 hover:bg-gray-50">
                <td className="px-2 sm:px-4 py-3 relative">
                  <button
                    onClick={() => setOpenCaseDropdown(openCaseDropdown === c.id ? null : c.id)}
                    className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors shadow-sm"
                  >
                    <span className="hidden sm:inline">Action</span>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {openCaseDropdown === c.id && (
                    <div className="case-dropdown-menu absolute left-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-border z-50 py-1 text-left">
                      <button onClick={() => { setOpenCaseDropdown(null); router.push(`/dashboard/cases/${c.id}`); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-primary hover:bg-primary/5 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        View
                      </button>
                      {canUpdate && (
                        <button onClick={() => { setOpenCaseDropdown(null); router.push(`/dashboard/cases/${c.id}?edit=true`); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-accent hover:bg-accent/5 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          Edit
                        </button>
                      )}
                      <button onClick={() => { setOpenCaseDropdown(null); router.push(`/dashboard/cases/${c.id}?tab=files&action=upload`); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-gray-50 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        Add File
                      </button>
                      <button onClick={() => { setOpenCaseDropdown(null); router.push(`/dashboard/cases/${c.id}?tab=events&action=add`); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-gray-50 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        Add Event
                      </button>
                      <hr className="my-1 border-border" />
                      <button onClick={() => openDuplicateModal(c.id)} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-gray-50 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                        Duplicate
                      </button>
                    </div>
                  )}
                </td>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Series Tasks */}
      {(() => {
        const activeTasks = seriesTasks.filter(t => t.status !== 'Completed' && t.status !== 'Cancelled');
        return activeTasks.length > 0 && (
        <div className="mt-6 bg-card-bg rounded-xl border border-border overflow-visible">
          <div className="px-4 py-3 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <p className="text-sm font-medium">{activeTasks.length} Active Task{activeTasks.length !== 1 ? 's' : ''} Across Series</p>
            {selectedTaskIds.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">{selectedTaskIds.length} selected</span>
                <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} className="px-2.5 py-1.5 text-xs border border-border rounded-lg bg-card-bg focus:outline-none focus:border-primary">
                  <option value="">Change status to...</option>
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
                <button onClick={handleBulkUpdateStatus} disabled={!bulkStatus || updatingTasks} className="px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors">
                  {updatingTasks ? 'Updating...' : 'Apply'}
                </button>
              </div>
            )}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-gray-50">
                <th className="w-10 px-3 py-3">
                  <input type="checkbox" checked={selectedTaskIds.length > 0 && selectedTaskIds.length === activeTasks.length} onChange={toggleAllTasks} className="w-4 h-4 rounded text-primary" />
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider">Task</th>
                <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider w-16">Case</th>
                <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider hidden sm:table-cell">Assignee</th>
                <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider hidden md:table-cell">Due Date</th>
                <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider hidden lg:table-cell">Priority</th>
                <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider w-28">Status</th>
              </tr>
            </thead>
            <tbody>
              {activeTasks.map(t => {
                const taskStatusColors: Record<string, string> = {
                  Pending: 'bg-gray-100 text-gray-700',
                  'In Progress': 'bg-yellow-50 text-yellow-700',
                  Completed: 'bg-green-50 text-green-700',
                  Cancelled: 'bg-red-50 text-red-600',
                };
                const priorityColors: Record<string, string> = {
                  Low: 'text-gray-500',
                  Medium: 'text-blue-600',
                  High: 'text-orange-600',
                  Urgent: 'text-red-600 font-semibold',
                };
                return (
                  <tr key={t.id} className="border-b border-border last:border-0 hover:bg-gray-50">
                    <td className="px-3 py-3">
                      <input type="checkbox" checked={selectedTaskIds.includes(t.id)} onChange={() => toggleTaskSelect(t.id)} className="w-4 h-4 rounded text-primary" />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-sm">{t.title}</p>
                      {t.description && <p className="text-xs text-muted truncate max-w-xs mt-0.5">{t.description}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold">{t.case?.series_suffix || '-'}</span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-muted">
                      {t.assignee ? `${t.assignee.first_name} ${t.assignee.last_name || ''}`.trim() : <span className="text-muted/50">Unassigned</span>}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs text-muted">{t.due_date ? formatDate(t.due_date) : '-'}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className={`text-xs ${priorityColors[t.priority] || ''}`}>{t.priority}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${taskStatusColors[t.status] || 'bg-gray-100 text-gray-700'}`}>{t.status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        );
      })()}

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
              <label className="block text-sm font-medium mb-1">Subject *</label>
              <input value={caseForm.title} onChange={(e) => setCaseForm({ ...caseForm, title: e.target.value.toUpperCase() })} className={inputClass} placeholder="Case subject" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Case Number</label>
              <input value={caseForm.case_number} onChange={(e) => setCaseForm({ ...caseForm, case_number: e.target.value.toUpperCase() })} className={inputClass} placeholder="e.g. CMCC E070 OF 2025" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium">Opposing Counsel</label>
                {!showAddOC && (
                  <button type="button" onClick={() => setShowAddOC(true)} className="text-xs text-primary hover:underline font-medium">+ Add New</button>
                )}
              </div>
              <SearchableSelect
                value={caseForm.opposing_counsel_id}
                onChange={(v) => setCaseForm({ ...caseForm, opposing_counsel_id: v })}
                options={[{ value: '', label: 'None' }, ...counsels.map(o => ({ value: String(o.id), label: o.name }))]}
                placeholder="Search counsel..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Filed Date</label>
              <DatePicker value={caseForm.filed_date} onChange={(v) => setCaseForm({ ...caseForm, filed_date: v })} />
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
                <button type="button" disabled={savingOC || (!newOC.name.trim() && !newOC.firm.trim())} onClick={saveOpposingCounsel} className="px-3 py-1.5 text-xs bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors">
                  {savingOC ? 'Saving...' : 'Save & Select'}
                </button>
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">Parties</label>
            <textarea value={caseForm.description} onChange={(e) => setCaseForm({ ...caseForm, description: e.target.value })} rows={2} className={inputClass} placeholder="List the parties involved" />
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
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
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

      {/* Duplicate Case Modal */}
      <Modal open={showDuplicateModal} onClose={() => setShowDuplicateModal(false)} title="Duplicate Case" size="lg">
        <form onSubmit={handleDuplicate} className="space-y-4">
          {error && <div className="bg-danger/5 border border-danger/20 text-danger text-sm px-4 py-3 rounded-lg">{error}</div>}
          <div className="flex items-start gap-2.5 px-4 py-3 bg-primary/5 border border-primary/20 rounded-xl text-sm text-primary">
            <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            A new case will be created with all documents copied. You can optionally set parties and opposing counsel for the duplicate.
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Parties</label>
            <textarea value={duplicateForm.description} onChange={(e) => setDuplicateForm({ ...duplicateForm, description: e.target.value })} rows={3} className={inputClass} placeholder="List the parties involved (leave blank to copy from original)" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium">Opposing Counsel</label>
              {!showDupAddOC && (
                <button type="button" onClick={() => setShowDupAddOC(true)} className="text-xs text-primary hover:underline font-medium">+ Add New</button>
              )}
            </div>
            <SearchableSelect
              value={duplicateForm.opposing_counsel_id}
              onChange={(v) => setDuplicateForm({ ...duplicateForm, opposing_counsel_id: v })}
              options={[{ value: '', label: 'Keep from original' }, ...counsels.map(o => ({ value: String(o.id), label: o.name }))]}
              placeholder="Search counsel..."
            />
          </div>
          {showDupAddOC && (
            <div className="p-4 bg-gray-50 border border-border rounded-xl space-y-3">
              <p className="text-xs font-medium text-muted uppercase tracking-wider">New Opposing Counsel</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted mb-1">Name</label>
                  <input value={dupNewOC.name} onChange={(e) => setDupNewOC({ ...dupNewOC, name: e.target.value })} className={inputClass} placeholder="Full name" />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Firm</label>
                  <input value={dupNewOC.firm} onChange={(e) => setDupNewOC({ ...dupNewOC, firm: e.target.value })} className={inputClass} placeholder="Law firm" />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Phone</label>
                  <input value={dupNewOC.phone} onChange={(e) => setDupNewOC({ ...dupNewOC, phone: e.target.value })} className={inputClass} placeholder="Phone number" />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Email</label>
                  <input type="email" value={dupNewOC.email} onChange={(e) => setDupNewOC({ ...dupNewOC, email: e.target.value })} className={inputClass} placeholder="Email address" />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => { setShowDupAddOC(false); setDupNewOC({ name: '', firm: '', phone: '', email: '' }); }} className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-background transition-colors text-muted">Cancel</button>
                <button type="button" disabled={savingDupOC || (!dupNewOC.name.trim() && !dupNewOC.firm.trim())} onClick={saveDupOpposingCounsel} className="px-3 py-1.5 text-xs bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors">
                  {savingDupOC ? 'Saving...' : 'Save & Select'}
                </button>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button type="button" onClick={() => setShowDuplicateModal(false)} className="px-5 py-2.5 text-sm font-medium border border-border rounded-xl hover:bg-background transition-colors text-muted">Cancel</button>
            <button type="submit" disabled={duplicating} className="px-5 py-2.5 text-sm font-medium bg-primary text-white rounded-xl hover:bg-primary-dark disabled:opacity-50 transition-colors">
              {duplicating ? 'Duplicating...' : 'Duplicate Case'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Bulk Task Modal */}
      <Modal open={showTaskModal} onClose={() => setShowTaskModal(false)} title="Assign Task to Series" size="lg">
        <form onSubmit={handleBulkTask} className="space-y-4">
          {error && <div className="bg-danger/5 border border-danger/20 text-danger text-sm px-4 py-3 rounded-lg">{error}</div>}
          <div>
            <label className="block text-sm font-medium mb-1">Task Title *</label>
            <input value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} className={inputClass} placeholder="e.g. File response documents" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} rows={2} className={inputClass} placeholder="Task details..." />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Assign To</label>
              <SearchableSelect
                value={taskForm.assigned_to}
                onChange={(v) => setTaskForm({ ...taskForm, assigned_to: v })}
                options={[{ value: '', label: 'Unassigned' }, ...users.map(u => ({ value: String(u.id), label: `${u.first_name} ${u.last_name}` }))]}
                placeholder="Search user..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Priority</label>
              <select value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })} className={inputClass}>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Due Date</label>
              <DatePicker value={taskForm.due_date} onChange={(v) => setTaskForm({ ...taskForm, due_date: v })} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Include Cases</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {series.active_cases.map(c => {
                const excluded = taskForm.exclude_case_ids.includes(c.id);
                return (
                  <label key={c.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors ${excluded ? 'border-border/60 bg-background/50 text-muted' : 'border-primary/30 bg-primary/5'}`}>
                    <input type="checkbox" checked={!excluded} onChange={() => setTaskForm(prev => ({ ...prev, exclude_case_ids: prev.exclude_case_ids.includes(c.id) ? prev.exclude_case_ids.filter(x => x !== c.id) : [...prev.exclude_case_ids, c.id] }))} className="w-4 h-4 rounded text-primary" />
                    <span className="font-mono text-xs">{c.series_suffix || '?'}</span>
                    <span className="truncate">{c.our_reference || c.title}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button type="button" onClick={() => setShowTaskModal(false)} className="px-5 py-2.5 text-sm font-medium border border-border rounded-xl hover:bg-background transition-colors text-muted">Cancel</button>
            <button type="submit" disabled={savingTask} className="px-5 py-2.5 text-sm font-medium bg-primary text-white rounded-xl hover:bg-primary-dark disabled:opacity-50 transition-colors">
              {savingTask ? 'Assigning...' : `Assign to ${series.active_cases.length - taskForm.exclude_case_ids.length} Case(s)`}
            </button>
          </div>
        </form>
      </Modal>

      {/* Bulk Upload Modal */}
      <Modal open={showBulkUploadModal} onClose={() => { setShowBulkUploadModal(false); setBulkFiles([]); setBulkUploadProgress(-1); setError(''); }} title={`Bulk Upload — ${series.reference}`} size="md">
        <form onSubmit={handleBulkUpload} className="space-y-4">
          {error && <div className="bg-danger/5 border border-danger/20 text-danger text-sm px-4 py-3 rounded-lg">{error}</div>}

          <div>
            <label className="block text-sm font-medium mb-2">Include Cases</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {series.active_cases.map(c => {
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
            <button type="button" onClick={() => { setShowBulkUploadModal(false); setBulkFiles([]); setBulkUploadProgress(-1); setError(''); }} className="px-5 py-2.5 text-sm font-medium border border-border rounded-xl hover:bg-background transition-colors text-muted hover:text-foreground">Cancel</button>
            <button type="submit" disabled={bulkUploading || bulkFiles.length === 0 || bulkExcludeCaseIds.length >= series.active_cases.length} className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-primary text-white rounded-xl hover:bg-primary-dark disabled:opacity-50 transition-colors">
              {bulkUploading ? `Uploading ${bulkUploadProgress}%` : `Upload to ${series.active_cases.length - bulkExcludeCaseIds.length} Case${(series.active_cases.length - bulkExcludeCaseIds.length) !== 1 ? 's' : ''}`}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={showCollabModal} title="Add Series Collaborator" onClose={() => setShowCollabModal(false)}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Select Advocate</label>
            <SearchableSelect
              label="Advocate"
              value={collabUserId}
              onChange={setCollabUserId}
              options={collabUsers
                .filter((u) => u.id !== series?.assigned_to?.id && !(series?.collaborators || []).some((c) => c.id === u.id))
                .map((u) => ({ value: String(u.id), label: `${u.first_name} ${u.last_name}`.trim() }))}
              placeholder="Search advocates..."
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowCollabModal(false)} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-gray-50">Cancel</button>
            <button onClick={addSeriesCollaborator} disabled={!collabUserId || collabSaving} className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50">
              {collabSaving ? 'Adding...' : 'Add Collaborator'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
