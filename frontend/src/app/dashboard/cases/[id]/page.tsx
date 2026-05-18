'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import Modal from '@/components/ui/modal';
import SearchableSelect from '@/components/ui/searchable-select';
import EmailTab from '@/components/cases/email-tab';

interface CaseEvent {
  id: number;
  event_type: string;
  event_date: string;
  created_by: number;
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
}

interface User {
  id: number;
  first_name: string;
  last_name: string;
}

const statuses = ['Open', 'In Progress', 'Closed', 'On Hold'];
const priorities = ['Low', 'Medium', 'High', 'Urgent'];

function formatDate(date: string | null): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

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
  const { token } = useAuth();
  const { toast: showToast } = useToast();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [caseItem, setCaseItem] = useState<CaseItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'activities' | 'files' | 'activity_logs' | 'emails'>('activities');
  const [documents, setDocuments] = useState<CaseDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState('');
  const [events, setEvents] = useState<CaseEvent[]>([]);
  const [merging, setMerging] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editSaveStatus, setEditSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [editForm, setEditForm] = useState({
    title: '', client_id: '', client_reference: '', parties: '',
    our_reference: '', case_number: '', assigned_to: '', court: '',
    opposing_counsel_id: '',
    filed_date: '', closed_date: '', outcome: '',
    is_recovery: null as boolean | null, case_type: 'Plaintiff',
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

  useEffect(() => {
    if (tab === 'files') fetchDocuments();
    if (tab === 'activities') fetchEvents();
  }, [tab, fetchDocuments, fetchEvents]);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'files' || tabParam === 'activity_logs' || tabParam === 'emails') {
      setTab(tabParam);
    }
  }, [searchParams]);

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !token || !params.id) return;
    setUploadSaving(true);
    const fd = new FormData();
    fd.append('documents[]', uploadFile);
    if (uploadForm.document_name) fd.append('document_names[]', uploadForm.document_name);
    if (uploadForm.document_date) fd.append('document_date', uploadForm.document_date);
    try {
      await api.post(`/cases/${params.id}/documents`, fd, token);
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
      opposing_counsel_id: c.opposing_counsel_id ? String(c.opposing_counsel_id) : '',
      filed_date: c.filed_date ? c.filed_date.split('T')[0] : '',
      closed_date: c.closed_date ? c.closed_date.split('T')[0] : '',
      outcome: c.outcome || '',
      is_recovery: c.is_recovery ?? null,
      case_type: c.case_type || 'Plaintiff',
      status: c.status || 'Open',
      priority: c.priority || 'Medium',
    });
    setEditSaveStatus('idle');
    setShowAddOC(false);
    setNewOC({ name: '', firm: '', phone: '', email: '' });
    await Promise.all([
      clients.length === 0 ? api.get<{ clients: Client[] }>('/clients', token).then((r) => setClients(r.clients)).catch(() => {}) : Promise.resolve(),
      users.length === 0 ? api.get<{ users: User[] }>('/users', token).then((r) => setUsers(r.users)).catch(() => {}) : Promise.resolve(),
      api.get<{ opposing_counsels: OpposingCounsel[] }>('/opposing-counsels', token).then((r) => setOpposingCounsels(r.opposing_counsels)).catch(() => {}),
    ]);
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !caseItem) return;
    setEditSaving(true);
    setEditSaveStatus('idle');
    try {
      const res = await api.put<{ case: CaseItem }>(`/cases/${caseItem.id}`, {
        title: editForm.title,
        client_id: editForm.client_id || null,
        client_reference: editForm.client_reference || null,
        description: editForm.parties || null,
        our_reference: editForm.our_reference || null,
        case_number: editForm.case_number || null,
        assigned_to: editForm.assigned_to || null,
        court: editForm.court || null,
        opposing_counsel_id: editForm.opposing_counsel_id || null,
        filed_date: editForm.filed_date || null,
        closed_date: editForm.closed_date || null,
        outcome: editForm.outcome || null,
        is_recovery: editForm.is_recovery,
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
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{caseItem.title}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[caseItem.status] || ''}`}>{caseItem.status}</span>
              {caseItem.case_type && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">{caseItem.case_type}</span>
              )}
            </div>
            <p className="text-sm text-muted">{caseItem.case_number}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openEditModal} className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-gray-50 transition-colors">
            Edit
          </button>
          <button onClick={deleteCase} className="px-4 py-2 text-sm font-medium text-danger border border-danger/20 rounded-lg hover:bg-danger/5 transition-colors">
            Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-card-bg rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">Case Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted font-medium uppercase tracking-wider">Our Reference</p>
              <p className="text-sm mt-0.5 font-mono">{caseItem.our_reference || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted font-medium uppercase tracking-wider">Client Reference</p>
              <p className="text-sm mt-0.5">{caseItem.client_reference || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted font-medium uppercase tracking-wider">Filed Date</p>
              <p className="text-sm mt-0.5">{formatDate(caseItem.filed_date)}</p>
            </div>
            <div>
              <p className="text-xs text-muted font-medium uppercase tracking-wider">Station</p>
              <p className="text-sm mt-0.5">{caseItem.court || '-'}</p>
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
              <p className="text-xs text-muted font-medium uppercase tracking-wider">Assigned To</p>
              <p className="text-sm mt-0.5">{caseItem.assigned_to ? `${caseItem.assigned_to.first_name} ${caseItem.assigned_to.last_name}` : 'Unassigned'}</p>
            </div>
            <div>
              <p className="text-xs text-muted font-medium uppercase tracking-wider">Created By</p>
              <p className="text-sm mt-0.5">{caseItem.created_by ? `${caseItem.created_by.first_name} ${caseItem.created_by.last_name}` : '-'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card-bg rounded-xl border border-border p-6 mt-5">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {([
            { key: 'activities', label: 'Activities' },
            { key: 'files', label: 'Files' },
            { key: 'activity_logs', label: 'Activity Logs' },
            { key: 'emails', label: 'Emails' },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                tab === t.key ? 'bg-white text-foreground shadow-sm' : 'text-muted hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {tab === 'activities' && (function () {
            const steps: { label: string; date: string | null; done: boolean; key: string }[] = [
              { label: 'Case Created', date: caseItem.created_at, done: true, key: 'created' },
              { label: 'Case Filed', date: caseItem.filed_date, done: !!caseItem.filed_date, key: 'filed' },
              { label: 'In Progress', date: null, done: caseItem.status === 'In Progress' || caseItem.status === 'Closed', key: 'progress' },
              { label: 'Case Closed', date: caseItem.closed_date, done: caseItem.status === 'Closed', key: 'closed' },
              ...events.map((e) => ({ label: e.event_type, date: e.event_date, done: true, key: `event-${e.id}` })),
            ].sort((a, b) => {
              if (!a.date && !b.date) return 0;
              if (!a.date) return 1;
              if (!b.date) return -1;
              return new Date(a.date).getTime() - new Date(b.date).getTime();
            });
            return (
              <div className="py-4 pl-2">
                {steps.length === 0 && (
                  <p className="text-sm text-muted text-center py-8">No activities yet.</p>
                )}
                {steps.map((step, i) => (
                  <div key={step.key} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${step.done ? 'bg-primary border-primary' : 'bg-white border-gray-300'}`} />
                      {i < steps.length - 1 && (
                        <div className={`w-0.5 flex-1 min-h-[40px] ${steps[i + 1].done ? 'bg-primary' : 'bg-gray-200'}`} />
                      )}
                    </div>
                    <div className="pb-6">
                      <p className={`text-sm font-medium ${step.done ? 'text-foreground' : 'text-muted'}`}>{step.label}</p>
                      <p className="text-xs text-muted mt-0.5">{step.date ? formatDate(step.date) : 'Pending'}</p>
                    </div>
                  </div>
                ))}
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
                  <button
                    onClick={() => { setUploadFile(null); setUploadForm({ document_name: '', document_date: '' }); setShowUploadModal(true); }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Add File
                  </button>
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
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
                          <button onClick={() => deleteDocument(doc.id)} className="p-1.5 text-danger hover:bg-danger/5 rounded-lg transition-colors" title="Delete">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {tab === 'emails' && token && (
            <EmailTab caseId={params.id as string} token={token} />
          )}
          {tab === 'activity_logs' && (
            <div className="text-center py-8 text-muted">
              <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-medium">No activity logs yet</p>
              <p className="text-xs mt-1">Changes and updates to this case will be logged here.</p>
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
            <input
              type="date"
              value={uploadForm.document_date}
              onChange={(e) => setUploadForm({ ...uploadForm, document_date: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-card-bg border border-border rounded-xl focus:outline-none focus:border-primary focus:ring-0 text-sm transition-colors"
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
          const assignedUser = users.find((u) => String(u.id) === editForm.assigned_to);
          return (
            <form onSubmit={handleEditSubmit} className="space-y-5">
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
                    value={assignedUser ? `${assignedUser.first_name} ${assignedUser.last_name}`.trim() : editForm.assigned_to || ''}
                    readOnly
                    className={`${inputClass} bg-gray-50 cursor-not-allowed`}
                    placeholder="Not assigned"
                  />
                </div>
              </div>

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
                      <button type="button" disabled={savingOC || !newOC.name.trim()} onClick={() => saveOpposingCounsel((id) => setEditForm((prev) => ({ ...prev, opposing_counsel_id: id })))} className="px-3 py-1.5 text-xs bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors">
                        {savingOC ? 'Saving...' : 'Save & Select'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Parties</label>
                <textarea value={editForm.parties} onChange={(e) => setEditForm({ ...editForm, parties: e.target.value })} rows={3} className={inputClass} placeholder="List the parties involved" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Is this a recovery?</label>
                  <div className="flex gap-4">
                    {[{ label: 'Yes', value: true }, { label: 'No', value: false }].map(({ label, value }) => (
                      <label key={label} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer transition-all text-sm ${editForm.is_recovery === value ? 'bg-primary/5 border-primary/30' : 'border-border hover:bg-gray-50'}`}>
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${editForm.is_recovery === value ? 'border-primary' : 'border-gray-300'}`}>
                          {editForm.is_recovery === value && <div className="w-2 h-2 rounded-full bg-primary" />}
                          <input type="radio" name="edit_is_recovery" checked={editForm.is_recovery === value} onChange={() => setEditForm((prev) => ({ ...prev, is_recovery: value }))} className="absolute opacity-0" />
                        </div>
                        <span>{label}</span>
                      </label>
                    ))}
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
