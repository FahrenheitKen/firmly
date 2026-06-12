'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useFormatDate } from '@/lib/date';
import { api } from '@/lib/api';
import { uploadDocuments } from '@/lib/document-upload';
import { useToast } from '@/lib/toast-context';
import Modal from '@/components/ui/modal';
import SearchableSelect from '@/components/ui/searchable-select';
import DatePicker from '@/components/ui/date-picker';
import TaskDrawer from '@/components/tasks/task-drawer';
import { getKenyaHoliday } from '@/lib/kenya-holidays';

interface CaseEvent {
  id: number;
  event_type: string;
  event_date: string;
  created_by: number | { id: number; first_name: string; last_name: string };
  created_at: string;
}

interface CaseDocument {
  id: number;
  original_name: string;
  file_size: number;
  mime_type: string | null;
  document_date: string | null;
  uploaded_by_user?: { id: number; first_name: string; last_name: string } | null;
  uploaded_by?: { id: number; first_name: string; last_name: string } | null;
  created_at: string;
}

interface OpposingCounsel {
  id: number;
  name: string;
  firm: string | null;
  phone: string | null;
  email: string | null;
}

interface CourtProceeding {
  id: number;
  before_court_no: string | null;
  magistrate: string | null;
  instruction: string | null;
  directions: string | null;
  time_spent: string | null;
  due_for_event: { id: number; event_type: string; event_date: string } | null;
  bring_up_event: { id: number; event_type: string; event_date: string } | null;
  created_by_user?: { id: number; first_name: string; last_name: string } | null;
  created_at: string;
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
  client_id?: number | null;
  client?: { id: number; first_name?: string; last_name?: string; business_name?: string } | null;
  assigned_to?: { id: number; first_name: string; last_name: string } | null;
  created_by?: { id: number; first_name: string; last_name: string } | null;
  opposing_counsel_id: number | null;
  opposing_counsel?: OpposingCounsel | null;
  court: string | null;
  court_number_filed: string | null;
  judge: string | null;
  filed_date: string | null;
  closed_date: string | null;
  outcome: string | null;
  case_series_id: number | null;
  series_suffix: string | null;
  series?: { id: number; reference: string; name: string; common_parties: string | null } | null;
  collaborators?: Array<{ id: number; first_name: string; last_name: string }>;
  created_at: string;
}

interface Client {
  id: number;
  first_name: string | null;
  last_name: string | null;
  business_name: string | null;
  client_type: string;
}

interface User {
  id: number;
  first_name: string;
  last_name: string;
}

const statuses = ['Open', 'In Progress', 'Closed', 'On Hold'];
const priorities = ['Low', 'Medium', 'High', 'Urgent'];

const statusColors: Record<string, string> = {
  'Open': 'bg-blue-50 text-blue-700',
  'In Progress': 'bg-yellow-50 text-yellow-700',
  'Closed': 'bg-gray-100 text-gray-600',
  'On Hold': 'bg-orange-50 text-orange-700',
};

const priorityColors: Record<string, string> = {
  'Low': 'bg-gray-50 text-gray-500',
  'Medium': 'bg-blue-50 text-blue-600',
  'High': 'bg-orange-50 text-orange-600',
  'Urgent': 'bg-red-50 text-red-600',
};

export default function CaseDetailPage() {
  const { token, can, user, isOwner } = useAuth();
  const formatDate = useFormatDate();
  const canUpdate = can('case.update');
  const canDelete = can('case.delete');
  const canReassign = can('case.reassign');
  const canCreateTask = can('task.create');
  const { toast: showToast } = useToast();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [caseItem, setCaseItem] = useState<CaseItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'activities' | 'files' | 'court_directions' | 'tasks'>('files');
  const [proceedings, setProceedings] = useState<CourtProceeding[]>([]);
  const [proceedingsLoading, setProceedingsLoading] = useState(false);
  const [showProceedingModal, setShowProceedingModal] = useState(false);
  const [proceedingSaving, setProceedingSaving] = useState(false);
  const [proceedingForm, setProceedingForm] = useState({
    before_court_no: '',
    magistrate: '',
    instruction: '',
    directions: '',
    due_for_type: '',
    due_for_date: '',
    bring_up_date: '',
  });
  const [proceedingStep, setProceedingStep] = useState<1 | 2>(1);
  const [editingProceedingId, setEditingProceedingId] = useState<number | null>(null);
  const [furtherActionForm, setFurtherActionForm] = useState({
    description: '',
    status: 'Pending' as 'Pending' | 'In Progress' | 'Completed' | 'Cancelled',
    assigned_to: '',
  });
  const [documents, setDocuments] = useState<CaseDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState('');
  const [events, setEvents] = useState<CaseEvent[]>([]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [eventForm, setEventForm] = useState<{ event_type: string; event_date: string }>({ event_type: 'Mention', event_date: '' });
  const [eventSaving, setEventSaving] = useState(false);
  const [deletingEventId, setDeletingEventId] = useState<number | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: '', description: '', status: 'Pending' as 'Pending' | 'In Progress' | 'Completed' | 'Cancelled',
    assigned_to: '', due_date: '',
  });
  const [taskFiles, setTaskFiles] = useState<File[]>([]);
  const [taskSaving, setTaskSaving] = useState(false);
  const [taskError, setTaskError] = useState('');
  const [caseTasks, setCaseTasks] = useState<Array<{
    id: number;
    title: string;
    status: 'Pending' | 'In Progress' | 'Completed' | 'Cancelled';
    due_date: string | null;
    assignee: { id: number; first_name: string; last_name: string | null } | null;
  }>>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [drawerTaskId, setDrawerTaskId] = useState<number | null>(null);
  const [merging, setMerging] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editSaveStatus, setEditSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [editForm, setEditForm] = useState({
    title: '', client_id: '', client_reference: '', parties: '',
    our_reference: '', case_number: '', assigned_to: '', court: '',
    court_number_filed: '', judge: '',
    opposing_counsel_id: '',
    filed_date: '', closed_date: '', outcome: '',
    is_recovery: null as boolean | null, case_type: 'Plaintiff',
    is_filed_in_court: false,
    status: 'Open', priority: 'Medium',
  });
  const [opposingCounsels, setOpposingCounsels] = useState<OpposingCounsel[]>([]);
  const [showAddOC, setShowAddOC] = useState(false);
  const [newOC, setNewOC] = useState({ name: '', firm: '', phone: '', email: '' });
  const [savingOC, setSavingOC] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadForm, setUploadForm] = useState({ document_name: '', document_date: '' });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadSaving, setUploadSaving] = useState(false);
  const [showCollabModal, setShowCollabModal] = useState(false);
  const [collabUserId, setCollabUserId] = useState('');
  const [collabSaving, setCollabSaving] = useState(false);
  const [collabUsers, setCollabUsers] = useState<User[]>([]);

  const isLeadAdvocate = !!caseItem?.assigned_to && caseItem.assigned_to.id === user?.id;
  const canManageCollaborators = isOwner || isLeadAdvocate;

  const openCollabModal = async () => {
    if (!token) return;
    if (collabUsers.length === 0) {
      try {
        const r = await api.get<{ users: User[] }>('/users?per_page=500', token);
        setCollabUsers(r.users);
      } catch { /* ignore */ }
    }
    setCollabUserId('');
    setShowCollabModal(true);
  };

  const addCollaborator = async () => {
    if (!token || !collabUserId || !caseItem) return;
    setCollabSaving(true);
    try {
      const res = await api.post<{ collaborator: { id: number; first_name: string; last_name: string } }>(`/cases/${caseItem.id}/collaborators`, { user_id: Number(collabUserId) }, token);
      setCaseItem((prev) => prev ? { ...prev, collaborators: [...(prev.collaborators || []), res.collaborator] } : prev);
      setShowCollabModal(false);
      showToast('Collaborator added', 'success');
    } catch (err: unknown) {
      const e = err as { message?: string };
      showToast(e.message || 'Failed to add collaborator', 'error');
    } finally {
      setCollabSaving(false);
    }
  };

  const removeCollaborator = async (userId: number) => {
    if (!token || !caseItem || !confirm('Remove this collaborator?')) return;
    try {
      await api.delete(`/cases/${caseItem.id}/collaborators/${userId}`, token);
      setCaseItem((prev) => prev ? { ...prev, collaborators: (prev.collaborators || []).filter((c) => c.id !== userId) } : prev);
      showToast('Collaborator removed', 'success');
    } catch {
      showToast('Failed to remove collaborator', 'error');
    }
  };

  useEffect(() => {
    if (!token) return;
    api.get<{ case: CaseItem }>(`/cases/${params.id}`, token)
      .then((res) => { setCaseItem(res.case); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token, params.id]);

  const fetchDocuments = useCallback(() => {
    if (!token || !params.id) return;
    setDocsLoading(true);
    api.get<{ documents: CaseDocument[] }>(`/cases/${params.id}/documents`, token)
      .then((res) => setDocuments(
        [...res.documents].sort((a, b) => {
          const dateA = new Date(a.document_date || a.created_at).getTime();
          const dateB = new Date(b.document_date || b.created_at).getTime();
          return dateB - dateA;
        })
      ))
      .catch(() => {})
      .finally(() => setDocsLoading(false));
  }, [token, params.id]);

  const fetchEvents = useCallback(() => {
    if (!token || !params.id) return;
    api.get<{ events: CaseEvent[] }>(`/cases/${params.id}/events`, token)
      .then((res) => setEvents(res.events))
      .catch(() => {});
  }, [token, params.id]);

  const fetchProceedings = useCallback(() => {
    if (!token || !params.id) return;
    setProceedingsLoading(true);
    api.get<{ proceedings: CourtProceeding[] }>(`/cases/${params.id}/proceedings`, token)
      .then((res) => setProceedings(res.proceedings))
      .catch(() => {})
      .finally(() => setProceedingsLoading(false));
  }, [token, params.id]);

  const fetchCaseTasks = useCallback(() => {
    if (!token || !params.id) return;
    setTasksLoading(true);
    api.get<{ tasks: typeof caseTasks }>(`/tasks?case_id=${params.id}`, token)
      .then((res) => setCaseTasks(res.tasks))
      .catch(() => {})
      .finally(() => setTasksLoading(false));
  }, [token, params.id]);

  useEffect(() => {
    if (tab === 'files') fetchDocuments();
    if (tab === 'activities') fetchEvents();
    if (tab === 'court_directions') fetchProceedings();
    if (tab === 'tasks') fetchCaseTasks();
  }, [tab, fetchDocuments, fetchEvents, fetchProceedings, fetchCaseTasks]);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'files' || tabParam === 'court_directions' || tabParam === 'activities' || tabParam === 'tasks') {
      setTab(tabParam);
    }
  }, [searchParams]);

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !token || !params.id) return;
    setUploadSaving(true);
    try {
      await uploadDocuments({
        caseId: String(params.id),
        files: [uploadFile],
        displayNames: uploadForm.document_name ? [uploadForm.document_name] : undefined,
        documentDate: uploadForm.document_date || undefined,
        token,
      });
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadForm({ document_name: '', document_date: '' });
      fetchDocuments();
      showToast('File uploaded successfully', 'success');
    } catch (err: unknown) {
      const errObj = err as { errors?: Record<string, string[]>; message?: string };
      const msg = errObj.errors ? Object.values(errObj.errors).flat().join(', ') : errObj.message || 'Upload failed';
      showToast(`Upload failed: ${msg}`, 'error');
    } finally {
      setUploadSaving(false);
    }
  };

  const deleteDocument = async (docId: number) => {
    if (!confirm('Delete this document?') || !token) return;
    try {
      await api.delete(`/cases/${params.id}/documents/${docId}`, token);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      showToast('Document deleted', 'success');
    } catch {
      showToast('Failed to delete document', 'error');
    }
  };

  const viewDocument = async (docId: number, name: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/cases/${params.id}/documents/${docId}/view`, {
        headers: { Authorization: `Bearer ${token}`, Accept: '*/*' },
      });
      if (!res.ok) { showToast('Could not open document', 'error'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPreviewName(name);
      setPreviewUrl(url);
    } catch {
      showToast('Could not open document', 'error');
    }
  };

  const mergeDocuments = async () => {
    if (!token || !params.id) return;
    setMerging(true);
    try {
      const res = await fetch(`${API_URL}/cases/${params.id}/documents/merge`, {
        headers: { Authorization: `Bearer ${token}`, Accept: '*/*' },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast((err as { message?: string }).message || 'Merge failed', 'error');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPreviewName('Merged Documents');
      setPreviewUrl(url);
    } catch {
      showToast('Merge failed', 'error');
    } finally { setMerging(false); }
  };

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewName('');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const getFileIcon = (mime: string | null) => {
    if (!mime) return 'doc';
    if (mime.startsWith('image/')) return 'img';
    if (mime.includes('pdf')) return 'pdf';
    if (mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('csv')) return 'xls';
    if (mime.includes('word') || mime.includes('document')) return 'doc';
    return 'doc';
  };

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

  const openEditModal = async () => {
    if (!caseItem || !token) return;
    const c = caseItem;
    setEditForm({
      title: c.title || '',
      client_id: c.client_id ? String(c.client_id) : (c.client?.id ? String(c.client.id) : ''),
      client_reference: c.client_reference || '',
      parties: c.description || '',
      our_reference: c.our_reference || '',
      case_number: c.case_number || '',
      assigned_to: c.assigned_to?.id ? String(c.assigned_to.id) : '',
      court: c.court || '',
      court_number_filed: c.court_number_filed || '',
      judge: c.judge || '',
      opposing_counsel_id: c.opposing_counsel_id ? String(c.opposing_counsel_id) : '',
      filed_date: c.filed_date ? c.filed_date.split('T')[0] : '',
      closed_date: c.closed_date ? c.closed_date.split('T')[0] : '',
      outcome: c.outcome || '',
      is_recovery: c.is_recovery ?? null,
      case_type: c.case_type || 'Plaintiff',
      is_filed_in_court: Boolean(c.case_number) || Boolean(c.filed_date) || Boolean(c.court) || Boolean(c.court_number_filed) || Boolean(c.judge),
      status: c.status || 'Open',
      priority: c.priority || 'Medium',
    });
    setEditSaveStatus('idle');
    setShowAddOC(false);
    setNewOC({ name: '', firm: '', phone: '', email: '' });
    await Promise.all([
      clients.length === 0 ? api.get<{ clients: Client[] }>('/clients?per_page=500', token).then((r) => setClients(r.clients)).catch(() => {}) : Promise.resolve(),
      users.length === 0 ? api.get<{ users: User[] }>('/users?per_page=500', token).then((r) => setUsers(r.users)).catch(() => {}) : Promise.resolve(),
      api.get<{ opposing_counsels: OpposingCounsel[] }>('/opposing-counsels', token).then((r) => setOpposingCounsels(r.opposing_counsels)).catch(() => {}),
    ]);
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !caseItem) return;
    setEditSaving(true);
    setEditSaveStatus('idle');
    const effectiveIsRecovery = editForm.case_type === 'Plaintiff' ? (editForm.is_recovery === true) : false;
    const effectiveCaseNumber = editForm.is_filed_in_court ? editForm.case_number : '';
    const effectiveFiledDate = editForm.is_filed_in_court ? editForm.filed_date : '';
    const effectiveCourt = editForm.is_filed_in_court ? editForm.court : '';
    const effectiveCourtNumberFiled = editForm.is_filed_in_court ? editForm.court_number_filed : '';
    const effectiveJudge = editForm.is_filed_in_court ? editForm.judge : '';
    try {
      const res = await api.put<{ case: CaseItem }>(`/cases/${caseItem.id}`, {
        title: editForm.title,
        client_id: editForm.client_id || null,
        client_reference: editForm.client_reference || null,
        description: editForm.parties || null,
        our_reference: editForm.our_reference || null,
        assigned_to: editForm.assigned_to || null,
        opposing_counsel_id: editForm.opposing_counsel_id || null,
        case_number: effectiveCaseNumber || null,
        court: effectiveCourt || null,
        court_number_filed: effectiveCourtNumberFiled || null,
        judge: effectiveJudge || null,
        filed_date: effectiveFiledDate || null,
        closed_date: editForm.closed_date || null,
        outcome: editForm.outcome || null,
        is_recovery: effectiveIsRecovery,
        case_type: editForm.case_type,
        status: editForm.status,
        priority: editForm.priority,
      }, token);
      setCaseItem(res.case);
      setEditSaveStatus('success');
      setTimeout(() => { setShowEditModal(false); setEditSaveStatus('idle'); }, 1200);
    } catch (err: unknown) {
      const e = err as { errors?: Record<string, string[]>; message?: string };
      const msg = e.errors ? Object.values(e.errors).flat().join(', ') : e.message || 'Failed to save';
      showToast(msg, 'error');
      setEditSaveStatus('error');
    } finally {
      setEditSaving(false);
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
    } catch {
      showToast('Failed to save opposing counsel', 'error');
    } finally {
      setSavingOC(false);
    }
  };

  const openProceedingModal = () => {
    setEditingProceedingId(null);
    setProceedingForm({
      before_court_no: caseItem?.court_number_filed || '',
      magistrate: caseItem?.judge || '',
      instruction: '',
      directions: '',
      due_for_type: '',
      due_for_date: '',
      bring_up_date: '',
    });
    setFurtherActionForm({ description: '', status: 'Pending', assigned_to: '' });
    setProceedingStep(1);
    setShowProceedingModal(true);
    // Lazy-fetch users so the Further Action assignee dropdown is populated.
    if (token && users.length === 0) {
      api.get<{ users: User[] }>('/users?per_page=500', token)
        .then((r) => setUsers(r.users))
        .catch(() => {});
    }
  };

  const submitProceeding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !caseItem) return;
    if (proceedingForm.due_for_type && !proceedingForm.due_for_date) {
      showToast('Pick a date for the next court event', 'error');
      return;
    }
    const bringUpHoliday = getKenyaHoliday(proceedingForm.bring_up_date);
    if (bringUpHoliday) {
      showToast(`Bring-up date falls on a public holiday (${bringUpHoliday})`, 'error');
      return;
    }
    const dueForHoliday = getKenyaHoliday(proceedingForm.due_for_date);
    if (dueForHoliday) {
      showToast(`Next court event falls on a public holiday (${dueForHoliday})`, 'error');
      return;
    }
    setProceedingSaving(true);
    const payload = {
      before_court_no: proceedingForm.before_court_no || null,
      magistrate: proceedingForm.magistrate || null,
      instruction: proceedingForm.instruction || null,
      directions: proceedingForm.directions || null,
      due_for_type: proceedingForm.due_for_type || null,
      due_for_date: proceedingForm.due_for_date || null,
      bring_up_date: proceedingForm.bring_up_date || null,
    };
    try {
      if (editingProceedingId) {
        await api.put(`/cases/${caseItem.id}/proceedings/${editingProceedingId}`, payload, token);
        showToast('Proceeding updated', 'success');
      } else {
        await api.post(`/cases/${caseItem.id}/proceedings`, payload, token);

        const actionDesc = furtherActionForm.description.trim();
        if (actionDesc) {
          try {
            await api.post('/tasks', {
              title: `Court proceeding follow-up — ${caseItem.case_number}`,
              description: actionDesc,
              status: furtherActionForm.status,
              assigned_to: furtherActionForm.assigned_to ? Number(furtherActionForm.assigned_to) : null,
              case_id: caseItem.id,
              due_date: null,
            }, token);
            showToast('Proceeding recorded and task created', 'success');
          } catch {
            showToast('Proceeding saved but follow-up task failed', 'warning');
          }
        } else {
          showToast('Proceeding recorded', 'success');
        }
      }

      setShowProceedingModal(false);
      fetchProceedings();
      fetchEvents();
    } catch (err: unknown) {
      const e = err as { errors?: Record<string, string[]>; message?: string };
      const msg = e.errors ? Object.values(e.errors).flat().join(', ') : e.message || 'Failed to save';
      showToast(msg, 'error');
    } finally {
      setProceedingSaving(false);
    }
  };

  const deleteProceeding = async (id: number) => {
    if (!token || !caseItem) return;
    if (!confirm('Delete this proceeding? The linked Due-For and Bring-Up events will also be removed.')) return;
    try {
      await api.delete(`/cases/${caseItem.id}/proceedings/${id}`, token);
      setProceedings((prev) => prev.filter((p) => p.id !== id));
      fetchEvents();
      showToast('Proceeding deleted', 'success');
    } catch {
      showToast('Failed to delete proceeding', 'error');
    }
  };

  const openEditProceeding = (p: CourtProceeding) => {
    setEditingProceedingId(p.id);
    setProceedingForm({
      before_court_no: p.before_court_no || '',
      magistrate: p.magistrate || '',
      instruction: p.instruction || '',
      directions: p.directions || '',
      due_for_type: p.due_for_event?.event_type || '',
      due_for_date: p.due_for_event?.event_date ? p.due_for_event.event_date.split('T')[0] : '',
      bring_up_date: p.bring_up_event?.event_date ? p.bring_up_event.event_date.split('T')[0] : '',
    });
    setProceedingStep(1);
    setShowProceedingModal(true);
  };

  const openCreateEvent = () => {
    setEditingEventId(null);
    setEventForm({ event_type: 'Mention', event_date: '' });
    setShowEventModal(true);
  };

  const openEditEvent = (ev: CaseEvent) => {
    setEditingEventId(ev.id);
    setEventForm({ event_type: ev.event_type, event_date: ev.event_date.slice(0, 10) });
    setShowEventModal(true);
  };

  const submitEventForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !caseItem) return;
    const holiday = getKenyaHoliday(eventForm.event_date);
    if (holiday) {
      showToast(`Cannot schedule on a public holiday (${holiday})`, 'error');
      return;
    }
    setEventSaving(true);
    try {
      if (editingEventId === null) {
        await api.post(`/cases/${caseItem.id}/events`, eventForm, token);
        showToast('Event created', 'success');
      } else {
        await api.put(`/cases/${caseItem.id}/events/${editingEventId}`, eventForm, token);
        showToast('Event updated', 'success');
      }
      setShowEventModal(false);
      setEditingEventId(null);
      fetchEvents();
    } catch (err: unknown) {
      const e = err as { errors?: Record<string, string[]>; message?: string };
      const msg = e.errors ? Object.values(e.errors).flat().join(', ') : e.message || 'Failed to save event';
      showToast(msg, 'error');
    } finally {
      setEventSaving(false);
    }
  };

  const deleteEvent = async (id: number) => {
    if (!token || !caseItem) return;
    if (!confirm('Delete this event?')) return;
    setDeletingEventId(id);
    try {
      await api.delete(`/cases/${caseItem.id}/events/${id}`, token);
      setEvents((prev) => prev.filter((ev) => ev.id !== id));
      showToast('Event deleted', 'success');
    } catch (err: unknown) {
      const e = err as { message?: string };
      console.error('deleteEvent failed', err);
      showToast(e.message || 'Failed to delete event', 'error');
    } finally {
      setDeletingEventId(null);
    }
  };

  const openCreateTask = () => {
    if (!caseItem) return;
    setTaskForm({
      title: '',
      description: '',
      status: 'Pending',
      assigned_to: caseItem.assigned_to?.id ? String(caseItem.assigned_to.id) : '',
      due_date: '',
    });
    setTaskFiles([]);
    setTaskError('');
    if (token && users.length === 0) {
      api.get<{ users: User[] }>('/users?per_page=500', token)
        .then((r) => setUsers(r.users))
        .catch(() => {});
    }
    setShowTaskModal(true);
  };

  const submitTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !caseItem) return;
    setTaskSaving(true);
    setTaskError('');
    try {
      const fd = new FormData();
      fd.append('title', taskForm.title);
      if (taskForm.description) fd.append('description', taskForm.description);
      fd.append('status', taskForm.status);
      if (taskForm.assigned_to) fd.append('assigned_to', taskForm.assigned_to);
      fd.append('case_id', String(caseItem.id));
      if (taskForm.due_date) fd.append('due_date', taskForm.due_date);
      taskFiles.forEach((file) => fd.append('documents[]', file));

      await api.post('/tasks', fd, token);
      setShowTaskModal(false);
      setTaskFiles([]);
      if (taskFiles.length > 0) {
        fetchDocuments();
      }
      if (tab === 'tasks') {
        fetchCaseTasks();
      }
      showToast(
        taskFiles.length > 0
          ? `Task created with ${taskFiles.length} attachment${taskFiles.length !== 1 ? 's' : ''}`
          : 'Task created',
        'success',
      );
    } catch (err: unknown) {
      const e = err as { errors?: Record<string, string[]>; message?: string };
      setTaskError(e.errors ? Object.values(e.errors).flat().join(', ') : e.message || 'Failed to create task');
    } finally {
      setTaskSaving(false);
    }
  };

  const deleteCase = async () => {
    if (!caseItem || !confirm('Delete this case?')) return;
    try {
      await api.delete(`/cases/${caseItem.id}`, token!);
      router.push('/dashboard/cases');
    } catch {
      showToast('Failed to delete case', 'error');
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  if (!caseItem) {
    return (
      <div className="text-center py-16 text-muted">
        <p className="text-lg font-medium">Case not found</p>
        <Link href="/dashboard/cases" className="text-primary text-sm mt-2 inline-block hover:underline">Back to Cases</Link>
      </div>
    );
  }

  const clientName = caseItem.client
    ? caseItem.client.business_name || `${caseItem.client.first_name || ''} ${caseItem.client.last_name || ''}`.trim() || 'Unknown'
    : 'Not assigned';

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold">{caseItem.title}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[caseItem.status] || ''}`}>{caseItem.status}</span>
              {caseItem.case_type && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">{caseItem.case_type}</span>
              )}
              {caseItem.series?.common_parties && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Defendant: {caseItem.series.common_parties}</span>
              )}
            </div>
            <p className="text-sm text-muted">{caseItem.case_number}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canUpdate && (
            <button onClick={openEditModal} className="px-3 sm:px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-gray-50 transition-colors">
              Edit
            </button>
          )}
          {canCreateTask && (
            <button onClick={openCreateTask} className="px-3 sm:px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors">
              Add Task
            </button>
          )}
          {canDelete && (
            <button onClick={deleteCase} className="px-3 sm:px-4 py-2 text-sm font-medium text-danger border border-danger/20 rounded-lg hover:bg-danger/5 transition-colors">
              Delete
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-card-bg rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">Case Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted font-medium uppercase tracking-wider">Our Reference</p>
              <p className="text-sm mt-0.5 font-mono">{caseItem.our_reference || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted font-medium uppercase tracking-wider">Client Reference</p>
              <p className="text-sm mt-0.5">{caseItem.client_reference || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted font-medium uppercase tracking-wider">Case Number</p>
              <p className="text-sm mt-0.5">{caseItem.case_number || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted font-medium uppercase tracking-wider">Station</p>
              <p className="text-sm mt-0.5">{caseItem.court || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted font-medium uppercase tracking-wider">Filed Date</p>
              <p className="text-sm mt-0.5">{formatDate(caseItem.filed_date)}</p>
            </div>
            <div>
              <p className="text-xs text-muted font-medium uppercase tracking-wider">Before Court No</p>
              <p className="text-sm mt-0.5">{caseItem.court_number_filed || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted font-medium uppercase tracking-wider">Magistrate/Judge</p>
              <p className="text-sm mt-0.5">{caseItem.judge || '-'}</p>
            </div>
          </div>
          {caseItem.opposing_counsel && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted font-medium uppercase tracking-wider mb-2">Opposing Counsel</p>
              <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                <p className="text-sm font-semibold">{caseItem.opposing_counsel.name}</p>
                {caseItem.opposing_counsel.firm && (
                  <p className="text-xs text-muted flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                    {caseItem.opposing_counsel.firm}
                  </p>
                )}
                {caseItem.opposing_counsel.phone && (
                  <p className="text-xs text-muted flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                    {caseItem.opposing_counsel.phone}
                  </p>
                )}
                {caseItem.opposing_counsel.email && (
                  <p className="text-xs text-muted flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    <a href={`mailto:${caseItem.opposing_counsel.email}`} className="hover:text-primary transition-colors">{caseItem.opposing_counsel.email}</a>
                  </p>
                )}
              </div>
            </div>
          )}
          {!caseItem.opposing_counsel && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted font-medium uppercase tracking-wider mb-1">Opposing Counsel</p>
              <p className="text-sm text-muted">-</p>
            </div>
          )}
          {caseItem.description && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted font-medium uppercase tracking-wider mb-1">Parties</p>
              <p className="text-sm whitespace-pre-line">{caseItem.description}</p>
            </div>
          )}
        </div>

        <div className="bg-card-bg rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">Related</h2>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-muted font-medium uppercase tracking-wider">Client</p>
              <p className="text-sm mt-0.5 font-medium">{clientName}</p>
              {caseItem.client && (
                <Link href={`/dashboard/clients/${caseItem.client.id}`} className="text-xs text-primary hover:underline mt-1 inline-block">View Client</Link>
              )}
            </div>
            <div>
              <p className="text-xs text-muted font-medium uppercase tracking-wider">Lead Advocate</p>
              <p className="text-sm mt-0.5">{caseItem.assigned_to ? `${caseItem.assigned_to.first_name} ${caseItem.assigned_to.last_name}` : 'Unassigned'}</p>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted font-medium uppercase tracking-wider">Collaborators</p>
                {canManageCollaborators && (
                  <button onClick={openCollabModal} className="text-xs text-primary hover:underline font-medium">+ Add</button>
                )}
              </div>
              {(caseItem.collaborators && caseItem.collaborators.length > 0) ? (
                <div className="mt-1.5 space-y-1.5">
                  {caseItem.collaborators.map((c) => (
                    <div key={c.id} className="flex items-center justify-between group">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                          {c.first_name?.[0]}{c.last_name?.[0]}
                        </div>
                        <span className="text-sm">{c.first_name} {c.last_name}</span>
                      </div>
                      {canManageCollaborators && (
                        <button onClick={() => removeCollaborator(c.id)} className="text-muted hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity" title="Remove collaborator">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted mt-0.5">None</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted font-medium uppercase tracking-wider">Created By</p>
              <p className="text-sm mt-0.5">{caseItem.created_by ? `${caseItem.created_by.first_name} ${caseItem.created_by.last_name}` : '-'}</p>
            </div>
          </div>
        </div>
      </div>

      {caseItem.series && (
        <div className="mt-5 flex items-center gap-3 px-4 py-3 bg-primary/5 border border-primary/20 rounded-xl">
          <svg className="w-5 h-5 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Part of series <Link href={`/dashboard/series/${caseItem.series.id}`} className="text-primary hover:underline font-mono">{caseItem.series.reference}</Link></p>
            <p className="text-xs text-muted">{caseItem.series.name} {caseItem.series_suffix ? `(Suffix: ${caseItem.series_suffix})` : ''}</p>
          </div>
          <Link href={`/dashboard/series/${caseItem.series.id}`} className="text-xs font-medium px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors shrink-0">View Series</Link>
        </div>
      )}

      <div className="bg-card-bg rounded-xl border border-border p-4 sm:p-6 mt-5">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 overflow-x-auto">
          {([
            { key: 'files', label: 'Files', shortLabel: 'Files' },
            { key: 'tasks', label: 'Tasks', shortLabel: 'Tasks' },
            { key: 'court_directions', label: 'Court Proceedings', shortLabel: 'Court' },
            { key: 'activities', label: 'Events', shortLabel: 'Events' },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                tab === t.key ? 'bg-white text-foreground shadow-sm' : 'text-muted hover:text-foreground'
              }`}
            >
              <span className="sm:hidden">{t.shortLabel}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        <div className="mt-4">
          {tab === 'activities' && (function () {
            type Step = { label: string; date: string | null; done: boolean; key: string; event?: CaseEvent };
            const steps: Step[] = [
              { label: 'Case Created', date: caseItem.created_at, done: true, key: 'created' },
              { label: 'Case Filed', date: caseItem.filed_date, done: !!caseItem.filed_date, key: 'filed' },
              { label: 'In Progress', date: null, done: caseItem.status === 'In Progress' || caseItem.status === 'Closed', key: 'progress' },
              { label: 'Case Closed', date: caseItem.closed_date, done: caseItem.status === 'Closed', key: 'closed' },
              ...events.map((e): Step => ({ label: e.event_type, date: e.event_date, done: true, key: `event-${e.id}`, event: e })),
            ].sort((a, b) => {
              if (!a.date && !b.date) return 0;
              if (!a.date) return 1;
              if (!b.date) return -1;
              return new Date(a.date).getTime() - new Date(b.date).getTime();
            });
            return (
              <div>
                {canUpdate && (
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-muted">{events.length} event{events.length !== 1 ? 's' : ''}</p>
                    <button
                      type="button"
                      onClick={openCreateEvent}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      Add Event
                    </button>
                  </div>
                )}
                <div className="py-4 pl-2">
                {steps.length === 0 && (
                  <p className="text-sm text-muted text-center py-8">No activities yet.</p>
                )}
                {steps.map((step, i) => (
                  <div key={step.key} className="flex gap-4 group">
                    <div className="flex flex-col items-center">
                      <div className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${step.done ? 'bg-primary border-primary' : 'bg-white border-gray-300'}`} />
                      {i < steps.length - 1 && (
                        <div className={`w-0.5 flex-1 min-h-[40px] ${steps[i + 1].done ? 'bg-primary' : 'bg-gray-200'}`} />
                      )}
                    </div>
                    <div className="pb-6 flex-1 flex items-start justify-between gap-3">
                      <div>
                        <p className={`text-sm font-medium ${step.done ? 'text-foreground' : 'text-muted'}`}>{step.label}</p>
                        <p className="text-xs text-muted mt-0.5">
                          {step.date ? formatDate(step.date) : 'Pending'}
                          {step.event?.created_by && typeof step.event.created_by === 'object' && (
                            <span> &middot; Added by {step.event.created_by.first_name} {step.event.created_by.last_name || ''}</span>
                          )}
                        </p>
                      </div>
                      {step.event && canUpdate && (
                        <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => openEditEvent(step.event!)}
                            className="p-1.5 text-accent hover:bg-accent/5 rounded-lg transition-colors"
                            title="Edit event"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteEvent(step.event!.id)}
                            disabled={deletingEventId === step.event.id}
                            className="p-1.5 text-danger hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Delete event"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                </div>
              </div>
            );
          })()}
          {tab === 'files' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium text-muted">{documents.length} document{documents.length !== 1 ? 's' : ''}</p>
                <div className="flex items-center gap-2">
                  {documents.length >= 2 && (
                    <button
                      onClick={mergeDocuments}
                      disabled={merging}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border text-foreground rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    >
                      {merging ? (
                        <><div className="animate-spin w-3 h-3 border-2 border-primary border-t-transparent rounded-full" /> Merging...</>
                      ) : (
                        <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> Merge All</>
                      )}
                    </button>
                  )}
                  {canUpdate && (
                    <button
                      onClick={() => { setUploadFile(null); setUploadForm({ document_name: '', document_date: '' }); setShowUploadModal(true); }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      Add File
                    </button>
                  )}
                </div>
              </div>
              {docsLoading ? (
                <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 border-[3px] border-primary border-t-transparent rounded-full" /></div>
              ) : documents.length === 0 ? (
                <div className="text-center py-8 text-muted">
                  <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm font-medium">No files yet</p>
                  <p className="text-xs mt-1">Upload documents using the button above.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {documents.map((doc) => {
                    const icon = getFileIcon(doc.mime_type);
                    const uploader = doc.uploaded_by || doc.uploaded_by_user;
                    return (
                      <div key={doc.id} className="flex items-center gap-3 py-3 group">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          icon === 'pdf' ? 'bg-red-50 text-red-500' :
                          icon === 'img' ? 'bg-purple-50 text-purple-500' :
                          icon === 'xls' ? 'bg-green-50 text-green-500' :
                          'bg-blue-50 text-blue-500'
                        }`}>
                          {icon === 'pdf' && <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM6 20V4h6v6h6v10H6z"/><path d="M8 14h2v2H8v-2zm3 0h2v2h-2v-2zm3 0h2v2h-2v-2z"/></svg>}
                          {icon === 'img' && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                          {icon === 'xls' && <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM6 20V4h6v6h6v10H6z"/><path d="M8 12h8v2H8v-2zm0 3h8v2H8v-2z"/></svg>}
                          {icon === 'doc' && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{doc.original_name}</p>
                          <p className="text-xs text-muted">
                            {formatFileSize(doc.file_size)}{uploader ? ` · ${uploader.first_name} ${uploader.last_name}` : ''}{doc.document_date ? ` · ${formatDate(doc.document_date)}` : ` · ${formatDate(doc.created_at)}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button onClick={() => viewDocument(doc.id, doc.original_name)} className="p-1.5 text-accent hover:bg-accent/5 rounded-lg transition-colors" title="View">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                const res = await fetch(`${API_URL}/cases/${params.id}/documents/${doc.id}/download`, {
                                  headers: { Authorization: `Bearer ${token}`, Accept: '*/*' },
                                });
                                if (!res.ok) return;
                                const blob = await res.blob();
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = doc.original_name;
                                a.click();
                                URL.revokeObjectURL(url);
                              } catch { showToast('Download failed', 'error'); }
                            }}
                            className="p-1.5 text-primary hover:bg-primary/5 rounded-lg transition-colors"
                            title="Download"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          </button>
                          {canUpdate && (
                            <button onClick={() => deleteDocument(doc.id)} className="p-1.5 text-danger hover:bg-danger/5 rounded-lg transition-colors" title="Delete">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {tab === 'court_directions' && (
            <div className="py-2">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium">Court Proceedings</p>
                  <p className="text-xs text-muted mt-0.5">A record of each court attendance with directions, next event, and bring-up date.</p>
                </div>
                {canUpdate && (
                  <button
                    onClick={openProceedingModal}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Add Proceeding
                  </button>
                )}
              </div>
              {proceedingsLoading ? (
                <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 border-[3px] border-primary border-t-transparent rounded-full" /></div>
              ) : proceedings.length === 0 ? (
                <div className="text-center py-10 text-muted">
                  <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                  </svg>
                  <p className="text-sm font-medium">No proceedings yet</p>
                  <p className="text-xs mt-1">Click &quot;Add Proceeding&quot; after a court session to record directions and the next event.</p>
                </div>
              ) : (
                <div className="bg-card-bg rounded-xl border border-border overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-gray-50">
                        <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider whitespace-nowrap">Date</th>
                        <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider whitespace-nowrap">Court / Magistrate</th>
                        <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider hidden sm:table-cell">Instruction</th>
                        <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider hidden md:table-cell">Directions / Orders</th>
                        <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider whitespace-nowrap hidden lg:table-cell">Time</th>
                        <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider whitespace-nowrap hidden sm:table-cell">Due For</th>
                        <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider whitespace-nowrap hidden md:table-cell">Bring Up</th>
                        {canUpdate && <th className="w-12 px-4 py-3"></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {proceedings.map((p) => (
                        <tr key={p.id} className="border-b border-border last:border-0 hover:bg-gray-50 group align-top">
                          <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">{formatDate(p.created_at)}</td>
                          <td className="px-4 py-3 text-xs whitespace-nowrap">
                            {p.before_court_no && <div className="font-medium">{p.before_court_no}</div>}
                            {p.magistrate && <div className="text-muted">{p.magistrate}</div>}
                            {!p.before_court_no && !p.magistrate && <span className="text-muted/50">—</span>}
                          </td>
                          <td className="px-4 py-3 text-xs hidden sm:table-cell max-w-xs">
                            {p.instruction ? (
                              <p className="whitespace-pre-line line-clamp-3" title={p.instruction}>{p.instruction}</p>
                            ) : <span className="text-muted/50">—</span>}
                          </td>
                          <td className="px-4 py-3 text-xs hidden md:table-cell max-w-md">
                            {p.directions ? (
                              <p className="whitespace-pre-line line-clamp-3" title={p.directions}>{p.directions}</p>
                            ) : <span className="text-muted/50">—</span>}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted whitespace-nowrap hidden lg:table-cell">
                            {p.time_spent ? p.time_spent.slice(0, 5) : <span className="text-muted/50">—</span>}
                          </td>
                          <td className="px-4 py-3 text-xs whitespace-nowrap hidden sm:table-cell">
                            {p.due_for_event ? (
                              <div>
                                <div className="font-medium">{p.due_for_event.event_type}</div>
                                <div className="text-muted">{formatDate(p.due_for_event.event_date)}</div>
                              </div>
                            ) : <span className="text-muted/50">—</span>}
                          </td>
                          <td className="px-4 py-3 text-xs whitespace-nowrap hidden md:table-cell">
                            {p.bring_up_event ? formatDate(p.bring_up_event.event_date) : <span className="text-muted/50">—</span>}
                          </td>
                          {canUpdate && (
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => openEditProceeding(p)}
                                  className="sm:opacity-0 sm:group-hover:opacity-100 p-1.5 text-accent hover:bg-accent/5 rounded-lg transition-all"
                                  title="Edit"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                </button>
                                <button
                                  onClick={() => deleteProceeding(p.id)}
                                  className="sm:opacity-0 sm:group-hover:opacity-100 p-1.5 text-danger hover:bg-danger/5 rounded-lg transition-all"
                                  title="Delete"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="px-4 py-3 text-xs text-muted border-t border-border bg-gray-50/50">
                    Showing {proceedings.length} proceeding{proceedings.length !== 1 ? 's' : ''}
                  </div>
                </div>
              )}
            </div>
          )}
          {tab === 'tasks' && (
            <div>
              {tasksLoading ? (
                <div className="flex justify-center py-12"><div className="animate-spin w-7 h-7 border-3 border-primary border-t-transparent rounded-full" /></div>
              ) : caseTasks.length === 0 ? (
                <div className="text-center py-10 text-muted">
                  <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  <p className="text-sm font-medium">No tasks for this case yet</p>
                  {canCreateTask && (
                    <button onClick={openCreateTask} className="mt-3 px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors">
                      Add Task
                    </button>
                  )}
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {caseTasks.map((t) => {
                    const statusBg = {
                      Pending: 'bg-gray-100 text-gray-700',
                      'In Progress': 'bg-blue-50 text-blue-700',
                      Completed: 'bg-green-50 text-green-700',
                      Cancelled: 'bg-gray-50 text-gray-500',
                    }[t.status];
                    return (
                      <li key={t.id}>
                        <button
                          onClick={() => setDrawerTaskId(t.id)}
                          className="w-full flex items-center justify-between gap-3 px-3 py-3 hover:bg-gray-50 transition-colors text-left"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{t.title}</p>
                            <p className="text-xs text-muted mt-0.5">
                              {t.assignee ? `${t.assignee.first_name} ${t.assignee.last_name ?? ''}`.trim() : 'Unassigned'}
                              {t.due_date && ` · Due ${formatDate(t.due_date)}`}
                            </p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${statusBg}`}>{t.status}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
      <Modal open={showUploadModal} onClose={() => { setShowUploadModal(false); setUploadFile(null); setUploadForm({ document_name: '', document_date: '' }); }} title="Add File" size="sm">
        <form onSubmit={handleUploadSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">File Name</label>
            <input
              value={uploadForm.document_name}
              onChange={(e) => setUploadForm({ ...uploadForm, document_name: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-card-bg border border-border rounded-xl focus:outline-none focus:border-primary focus:ring-0 text-sm transition-colors"
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
                setUploadFile(file);
                if (file && !uploadForm.document_name) {
                  setUploadForm((prev) => ({ ...prev, document_name: file.name.replace(/\.[^/.]+$/, '') }));
                }
              }}
              className="w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-primary/5 file:text-primary hover:file:bg-primary/10"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Date</label>
            <DatePicker
              value={uploadForm.document_date}
              onChange={(v) => setUploadForm({ ...uploadForm, document_date: v })}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button type="button" onClick={() => { setShowUploadModal(false); setUploadFile(null); setUploadForm({ document_name: '', document_date: '' }); }} className="px-5 py-2.5 text-sm font-medium border border-border rounded-xl hover:bg-background transition-colors text-muted hover:text-foreground">Cancel</button>
            <button type="submit" disabled={uploadSaving || !uploadFile} className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-primary text-white rounded-xl hover:bg-primary-dark disabled:opacity-50 transition-colors">
              {uploadSaving ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Case" size="lg">
        {(() => {
          const inputClass = 'w-full px-3.5 py-2.5 bg-card-bg border border-border rounded-xl focus:outline-none focus:border-primary focus:ring-0 text-sm transition-colors';
          return (
            <form onSubmit={handleEditSubmit} className="space-y-4">
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
                  <label className="block text-sm font-medium mb-2">Case Type *</label>
                  <div className="flex gap-4">
                    {['Plaintiff', 'Defendant'].map((type) => (
                      <label key={type} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer transition-all text-sm ${editForm.case_type === type ? 'bg-primary/5 border-primary/30' : 'border-border hover:bg-gray-50'}`}>
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${editForm.case_type === type ? 'border-primary' : 'border-gray-300'}`}>
                          {editForm.case_type === type && <div className="w-2 h-2 rounded-full bg-primary" />}
                          <input type="radio" name="detail_edit_case_type" checked={editForm.case_type === type} onChange={() => setEditForm((prev) => ({ ...prev, case_type: type, is_recovery: type === 'Plaintiff' ? prev.is_recovery : false }))} className="absolute opacity-0" />
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
                          <input type="radio" name="detail_edit_recovery" checked={editForm.is_recovery === true} onChange={() => setEditForm((prev) => ({ ...prev, is_recovery: true }))} className="absolute opacity-0" />
                        </div>
                        <span>Yes</span>
                      </label>
                      <label className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer transition-all text-sm ${editForm.is_recovery === false ? 'bg-primary/5 border-primary/30' : 'border-border hover:bg-gray-50'}`}>
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${editForm.is_recovery === false ? 'border-primary' : 'border-gray-300'}`}>
                          {editForm.is_recovery === false && <div className="w-2 h-2 rounded-full bg-primary" />}
                          <input type="radio" name="detail_edit_recovery" checked={editForm.is_recovery === false} onChange={() => setEditForm((prev) => ({ ...prev, is_recovery: false }))} className="absolute opacity-0" />
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
                <button type="button" onClick={() => setShowEditModal(false)} className="px-5 py-2.5 text-sm font-medium border border-border rounded-xl hover:bg-background transition-colors text-muted hover:text-foreground">Cancel</button>
                <button
                  type="submit"
                  disabled={editSaving || editSaveStatus === 'success'}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-xl disabled:opacity-70 transition-all ${
                    editSaveStatus === 'success'
                      ? 'bg-green-600 text-white'
                      : editSaveStatus === 'error'
                      ? 'bg-danger text-white hover:bg-danger/90'
                      : 'bg-primary text-white hover:bg-primary-dark'
                  }`}
                >
                  {editSaving ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</>
                  ) : editSaveStatus === 'success' ? (
                    <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg> Saved!</>
                  ) : editSaveStatus === 'error' ? (
                    'Try Again'
                  ) : (
                    'Update Case'
                  )}
                </button>
              </div>
            </form>
          );
        })()}
      </Modal>

      <Modal open={showProceedingModal} onClose={() => setShowProceedingModal(false)} title={editingProceedingId ? 'Edit Court Proceeding' : 'Add Court Proceeding'} size="lg">
        {(() => {
          const inputClass = 'w-full px-3.5 py-2.5 bg-card-bg border border-border rounded-xl focus:outline-none focus:border-primary focus:ring-0 text-sm transition-colors';
          const steps: { n: 1 | 2; label: string }[] = [
            { n: 1, label: 'Proceeding' },
            { n: 2, label: 'Further Action' },
          ];
          return (
            <form onSubmit={submitProceeding} className="space-y-4">
              <div className="flex items-center gap-2">
                {steps.map((s, i) => (
                  <div key={s.n} className="flex items-center gap-2 flex-1">
                    <button
                      type="button"
                      onClick={() => setProceedingStep(s.n)}
                      className={`flex items-center gap-2 text-sm font-medium ${proceedingStep === s.n ? 'text-primary' : 'text-muted hover:text-foreground'} transition-colors`}
                    >
                      <span className={`w-6 h-6 inline-flex items-center justify-center rounded-full text-xs font-semibold ${proceedingStep === s.n ? 'bg-primary text-white' : 'bg-gray-100 text-muted'}`}>{s.n}</span>
                      <span>{s.label}</span>
                    </button>
                    {i < steps.length - 1 && <div className="flex-1 h-px bg-border" />}
                  </div>
                ))}
              </div>

              {proceedingStep === 1 ? (
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Before Court No</label>
                      <input
                        value={proceedingForm.before_court_no}
                        readOnly={!!caseItem?.court_number_filed}
                        onChange={(e) => setProceedingForm({ ...proceedingForm, before_court_no: e.target.value })}
                        className={`${inputClass}${caseItem?.court_number_filed ? ' bg-gray-50 cursor-not-allowed' : ''}`}
                        placeholder="e.g. Court 5"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Magistrate/Judge</label>
                      <input
                        value={proceedingForm.magistrate}
                        readOnly={!!caseItem?.judge}
                        onChange={(e) => setProceedingForm({ ...proceedingForm, magistrate: e.target.value })}
                        className={`${inputClass}${caseItem?.judge ? ' bg-gray-50 cursor-not-allowed' : ''}`}
                        placeholder="Name of the magistrate or judge"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Instruction</label>
                    <textarea
                      value={proceedingForm.instruction}
                      onChange={(e) => setProceedingForm({ ...proceedingForm, instruction: e.target.value })}
                      rows={3}
                      className={`${inputClass} resize-y`}
                      placeholder="Type instruction..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Court Directions and Orders</label>
                    <textarea
                      value={proceedingForm.directions}
                      onChange={(e) => setProceedingForm({ ...proceedingForm, directions: e.target.value })}
                      rows={5}
                      className={`${inputClass} resize-y`}
                      placeholder="Type directions and orders issued by the court..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Bring Up Date</label>
                    <DatePicker
                      blockHolidays
                      value={proceedingForm.bring_up_date}
                      onChange={(v) => setProceedingForm({ ...proceedingForm, bring_up_date: v })}
                    />
                  </div>

                  <div className="pt-3 border-t border-border">
                    <p className="text-xs text-muted font-medium uppercase tracking-wider mb-2">Next Court Event</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Due For</label>
                        <select
                          value={proceedingForm.due_for_type}
                          onChange={(e) => {
                            const v = e.target.value;
                            setProceedingForm({
                              ...proceedingForm,
                              due_for_type: v,
                              due_for_date: v ? proceedingForm.due_for_date : '',
                            });
                          }}
                          className={inputClass}
                        >
                          <option value="">Select event type</option>
                          <option value="Mention">Mention</option>
                          <option value="Mention of Application">Mention of Application</option>
                          <option value="Hearing">Hearing</option>
                          <option value="Hearing of Application">Hearing of Application</option>
                          <option value="Ruling">Ruling</option>
                          <option value="Judgement">Judgement</option>
                        </select>
                      </div>
                      {proceedingForm.due_for_type && (
                        <div>
                          <label className="block text-sm font-medium mb-1">Date</label>
                          <DatePicker
                            blockHolidays
                            value={proceedingForm.due_for_date}
                            onChange={(v) => setProceedingForm({ ...proceedingForm, due_for_date: v })}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 pt-2">
                  <p className="text-xs text-muted">Optional — create a follow-up task for this case. Leave blank to save the proceeding only.</p>

                  <div>
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <textarea
                      value={furtherActionForm.description}
                      onChange={(e) => setFurtherActionForm({ ...furtherActionForm, description: e.target.value })}
                      rows={4}
                      className={`${inputClass} resize-y`}
                      placeholder="What needs to be done next?"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Status</label>
                      <select
                        value={furtherActionForm.status}
                        onChange={(e) => setFurtherActionForm({ ...furtherActionForm, status: e.target.value as typeof furtherActionForm.status })}
                        className={inputClass}
                      >
                        <option value="Pending">Pending</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </div>
                    <SearchableSelect
                      label="Assignee"
                      value={furtherActionForm.assigned_to}
                      onChange={(v) => setFurtherActionForm({ ...furtherActionForm, assigned_to: v })}
                      options={[
                        { value: '', label: 'Unassigned' },
                        ...users.map((u) => ({ value: String(u.id), label: `${u.first_name}${u.last_name ? ` ${u.last_name}` : ''}` })),
                      ]}
                      placeholder="Unassigned"
                      dropUp
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button type="button" onClick={() => setShowProceedingModal(false)} className="px-5 py-2.5 text-sm font-medium border border-border rounded-xl hover:bg-background transition-colors text-muted hover:text-foreground">Cancel</button>
                {proceedingStep === 1 ? (
                  <button
                    type="button"
                    onClick={() => setProceedingStep(2)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-primary text-white rounded-xl hover:bg-primary-dark transition-colors"
                  >
                    Next
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setProceedingStep(1)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium border border-border rounded-xl hover:bg-background transition-colors text-muted hover:text-foreground"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={proceedingSaving}
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-primary text-white rounded-xl hover:bg-primary-dark disabled:opacity-50 transition-colors"
                    >
                      {proceedingSaving ? (
                        <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</>
                      ) : editingProceedingId ? 'Update Proceeding' : 'Save Proceeding'}
                    </button>
                  </>
                )}
              </div>
            </form>
          );
        })()}
      </Modal>

      <Modal
        open={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        title={caseItem ? `Add Task — ${caseItem.case_number}` : 'Add Task'}
        size="lg"
      >
        <form onSubmit={submitTask} className="space-y-5">
          {taskError && (
            <div className="bg-danger/5 border border-danger/20 text-danger text-sm px-4 py-3 rounded-lg">{taskError}</div>
          )}
          {caseItem && (
            <div className="bg-gray-50 border border-border rounded-lg px-4 py-3">
              <p className="text-xs text-muted uppercase tracking-wider mb-1">Linked Case</p>
              <p className="text-sm font-medium">{caseItem.case_number} — {caseItem.title}</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">Title *</label>
            <input
              value={taskForm.title}
              onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
              required
              placeholder="e.g. Draft response to motion"
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={taskForm.description}
              onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
              rows={3}
              placeholder="Add notes, requirements, or context..."
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-sm"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SearchableSelect
              label="Assignee"
              value={taskForm.assigned_to}
              onChange={(v) => setTaskForm({ ...taskForm, assigned_to: v })}
              options={[{ value: '', label: 'Unassigned' }, ...users.map((u) => ({ value: String(u.id), label: `${u.first_name} ${u.last_name}`.trim() }))]}
              placeholder="Unassigned"
            />
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select
                value={taskForm.status}
                onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value as typeof taskForm.status })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-sm"
              >
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Due Date</label>
            <DatePicker value={taskForm.due_date} onChange={(v) => setTaskForm({ ...taskForm, due_date: v })} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Attachments</label>
            <label
              htmlFor="task-file-input"
              className="flex items-center justify-center gap-2 w-full px-3 py-3 border border-dashed border-border rounded-lg cursor-pointer hover:border-primary/40 hover:bg-gray-50 transition-colors text-sm text-muted"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 10-5.656-5.656L4.586 11.414a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <span>Click to add files (PDF, images, Office docs · max 10 MB each)</span>
            </label>
            <input
              id="task-file-input"
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx"
              className="hidden"
              onChange={(e) => {
                const incoming = Array.from(e.target.files || []);
                if (incoming.length > 0) {
                  setTaskFiles((prev) => [...prev, ...incoming]);
                }
                e.target.value = '';
              }}
            />
            {taskFiles.length > 0 && (
              <ul className="mt-2 space-y-1">
                {taskFiles.map((file, idx) => (
                  <li key={`${file.name}-${idx}`} className="flex items-center justify-between gap-2 px-3 py-2 bg-gray-50 border border-border rounded-lg text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <svg className="w-4 h-4 text-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                      <span className="truncate">{file.name}</span>
                      <span className="text-muted shrink-0">· {formatFileSize(file.size)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTaskFiles((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-danger hover:bg-red-50 p-1 rounded transition-colors shrink-0"
                      title="Remove"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[11px] text-muted mt-1">Files will be saved as case documents and linked to this task.</p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => setShowTaskModal(false)}
              className="px-5 py-2.5 text-sm font-medium border border-border rounded-xl hover:bg-background transition-colors text-muted hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={taskSaving || !taskForm.title}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-primary text-white rounded-xl hover:bg-primary-dark disabled:opacity-50 transition-colors"
            >
              {taskSaving ? 'Saving...' : 'Create Task'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={showEventModal}
        onClose={() => { setShowEventModal(false); setEditingEventId(null); }}
        title={editingEventId === null ? 'Add Event' : 'Edit Event'}
        size="sm"
      >
        <form onSubmit={submitEventForm} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Event Type</label>
            <select
              value={eventForm.event_type}
              onChange={(e) => setEventForm((f) => ({ ...f, event_type: e.target.value }))}
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-sm"
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
          <div>
            <label className="block text-sm font-medium mb-1">Event Date</label>
            <DatePicker
              blockHolidays
              value={eventForm.event_date}
              onChange={(v) => setEventForm((f) => ({ ...f, event_date: v }))}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => { setShowEventModal(false); setEditingEventId(null); }}
              className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={eventSaving || !eventForm.event_date}
              className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50"
            >
              {eventSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>

      <TaskDrawer
        taskId={drawerTaskId}
        onClose={() => setDrawerTaskId(null)}
        onTaskChanged={fetchCaseTasks}
      />

      <Modal open={showCollabModal} title="Add Collaborator" onClose={() => setShowCollabModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Select Advocate</label>
              <SearchableSelect
                label="Advocate"
                value={collabUserId}
                onChange={setCollabUserId}
                options={collabUsers
                  .filter((u) => u.id !== caseItem?.assigned_to?.id && !(caseItem?.collaborators || []).some((c) => c.id === u.id))
                  .map((u) => ({ value: String(u.id), label: `${u.first_name} ${u.last_name}`.trim() }))}
                placeholder="Search advocates..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCollabModal(false)} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={addCollaborator} disabled={!collabUserId || collabSaving} className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50">
                {collabSaving ? 'Adding...' : 'Add Collaborator'}
              </button>
            </div>
          </div>
      </Modal>

      {previewUrl && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/70" onClick={closePreview}>
          <div className="flex items-center justify-between px-4 py-3 bg-black/90 text-white" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-medium truncate">{previewName}</p>
            <div className="flex items-center gap-2">
              <a
                href={previewUrl}
                download={previewName}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                title="Download"
                onClick={(e) => e.stopPropagation()}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              </a>
              <button onClick={closePreview} className="p-2 hover:bg-white/10 rounded-lg transition-colors" title="Close">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4" onClick={(e) => e.stopPropagation()}>
            <iframe src={previewUrl} className="w-full h-full min-h-[80vh] bg-white rounded-lg" title={previewName} />
          </div>
        </div>
      )}
    </div>
  );
}
