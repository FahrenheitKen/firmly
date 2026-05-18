'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import PageHeader from '@/components/ui/page-header';
import SearchableSelect from '@/components/ui/searchable-select';

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
  assigned_to: { id: number; first_name: string; last_name: string } | null;
  court: string | null;
  judge: string | null;
  opposing_counsel: string | null;
  filed_date: string | null;
  closed_date: string | null;
  outcome: string | null;
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

export default function EditCasePage() {
  const { token } = useAuth();
  const params = useParams();
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    title: '',
    client_id: '',
    client_reference: '',
    parties: '',
    our_reference: '',
    case_number: '',
    assigned_to: '',
    court: '',
    judge: '',
    opposing_counsel: '',
    filed_date: '',
    closed_date: '',
    outcome: '',
    is_recovery: null as boolean | null,
    case_type: 'Plaintiff',
    status: 'Open',
    priority: 'Medium',
  });

  useEffect(() => {
    if (!token) return;
    Promise.all([
      api.get<{ case: CaseItem }>(`/cases/${params.id}`, token),
      api.get<{ clients: Client[] }>('/clients', token),
      api.get<{ users: User[] }>('/users', token),
    ]).then(([caseRes, clientRes, userRes]) => {
      const c = caseRes.case;
      setForm({
        title: c.title || '',
        client_id: c.client_id ? String(c.client_id) : '',
        client_reference: c.client_reference || '',
        parties: c.description || '',
        our_reference: c.our_reference || '',
        case_number: c.case_number || '',
        assigned_to: c.assigned_to?.id ? String(c.assigned_to.id) : '',
        court: c.court || '',
        judge: c.judge || '',
        opposing_counsel: c.opposing_counsel || '',
        filed_date: c.filed_date ? c.filed_date.split('T')[0] : '',
        closed_date: c.closed_date ? c.closed_date.split('T')[0] : '',
        outcome: c.outcome || '',
        is_recovery: c.is_recovery ?? null,
        case_type: c.case_type || 'Plaintiff',
        status: c.status || 'Open',
        priority: c.priority || 'Medium',
      });
      setClients(clientRes.clients);
      setUsers(userRes.users);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [token, params.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError('');
    try {
      await api.put(`/cases/${params.id}`, {
        title: form.title,
        client_id: form.client_id || null,
        client_reference: form.client_reference,
        description: form.parties || null,
        our_reference: form.our_reference || null,
        case_number: form.case_number || null,
        assigned_to: form.assigned_to || null,
        court: form.court || null,
        judge: form.judge || null,
        opposing_counsel: form.opposing_counsel || null,
        filed_date: form.filed_date || null,
        closed_date: form.closed_date || null,
        outcome: form.outcome || null,
        is_recovery: form.is_recovery,
        case_type: form.case_type,
        status: form.status,
        priority: form.priority,
      }, token);
      router.push(`/dashboard/cases/${params.id}`);
    } catch (err: unknown) {
      const e = err as { errors?: Record<string, string[]>; message?: string };
      setError(e.errors ? Object.values(e.errors).flat().join(', ') : e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  const inputClass = 'w-full px-3.5 py-2.5 bg-card-bg border border-border rounded-xl focus:outline-none focus:border-primary focus:ring-0 text-sm transition-colors';
  const assignedUser = users.find((u) => String(u.id) === form.assigned_to);

  return (
    <>
      <PageHeader title="Edit Case" description="Update case details" />
      <div className="max-w-3xl bg-card-bg rounded-xl border border-border p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && <div className="bg-danger/5 border border-danger/20 text-danger text-sm px-4 py-3 rounded-lg">{error}</div>}

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium mb-1">Subject *</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value.toUpperCase() })} required className={inputClass} placeholder="Case subject" />
          </div>

          {/* Client + Assigned To */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SearchableSelect
              label="Client"
              value={form.client_id}
              onChange={(v) => setForm((prev) => ({ ...prev, client_id: v }))}
              options={[{ value: '', label: 'Select client' }, ...clients.map((c) => ({ value: String(c.id), label: c.client_type === 'business' ? c.business_name || '' : `${c.first_name || ''} ${c.last_name || ''}`.trim() }))]}
              placeholder="Search client..."
            />
            <div>
              <label className="block text-sm font-medium mb-1">Assigned To</label>
              <input
                value={assignedUser ? `${assignedUser.first_name} ${assignedUser.last_name}`.trim() : form.assigned_to || ''}
                readOnly
                className={`${inputClass} bg-gray-50 cursor-not-allowed`}
                placeholder="Not assigned"
              />
            </div>
          </div>

          {/* Client Reference + Opposite Counsel */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Client Reference</label>
              <input value={form.client_reference} onChange={(e) => setForm({ ...form, client_reference: e.target.value.toUpperCase() })} className={inputClass} placeholder="Client's reference number" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Opposite Counsel</label>
              <input value={form.opposing_counsel} onChange={(e) => setForm({ ...form, opposing_counsel: e.target.value })} className={inputClass} placeholder="Opposing counsel name" />
            </div>
          </div>

          {/* Parties */}
          <div>
            <label className="block text-sm font-medium mb-1">Parties</label>
            <textarea value={form.parties} onChange={(e) => setForm({ ...form, parties: e.target.value })} rows={3} className={inputClass} placeholder="List the parties involved" />
          </div>

          {/* Is Recovery + Case Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Is this a recovery?</label>
              <div className="flex gap-4">
                {[{ label: 'Yes', value: true }, { label: 'No', value: false }].map(({ label, value }) => (
                  <label key={label} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer transition-all text-sm ${form.is_recovery === value ? 'bg-primary/5 border-primary/30' : 'border-border hover:bg-gray-50'}`}>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${form.is_recovery === value ? 'border-primary' : 'border-gray-300'}`}>
                      {form.is_recovery === value && <div className="w-2 h-2 rounded-full bg-primary" />}
                      <input type="radio" name="is_recovery" checked={form.is_recovery === value} onChange={() => setForm((prev) => ({ ...prev, is_recovery: value }))} className="absolute opacity-0" />
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

          {/* Our Reference + Case Number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Our Reference</label>
              <input value={form.our_reference} readOnly className={`${inputClass} bg-gray-50 cursor-not-allowed`} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Case Number</label>
              <input value={form.case_number} onChange={(e) => setForm({ ...form, case_number: e.target.value.toUpperCase() })} className={inputClass} placeholder="Case number" />
            </div>
          </div>

          {/* Station */}
          <div>
            <label className="block text-sm font-medium mb-1">Station</label>
            <input value={form.court} onChange={(e) => setForm({ ...form, court: e.target.value })} className={inputClass} placeholder="Station name" />
          </div>

          {/* Filed Date */}
          <div>
            <label className="block text-sm font-medium mb-1">Filed Date</label>
            <input type="date" value={form.filed_date} onChange={(e) => setForm({ ...form, filed_date: e.target.value })} className={inputClass} />
          </div>

          {/* Status + Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputClass}>
                {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Priority</label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className={inputClass}>
                {priorities.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* Judge */}
          <div>
            <label className="block text-sm font-medium mb-1">Judge</label>
            <input value={form.judge} onChange={(e) => setForm({ ...form, judge: e.target.value })} className={inputClass} placeholder="Judge name" />
          </div>

          {/* Closed Date + Outcome */}
          {form.status === 'Closed' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Closed Date</label>
                <input type="date" value={form.closed_date} onChange={(e) => setForm({ ...form, closed_date: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Outcome</label>
                <textarea value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value })} rows={2} className={inputClass} placeholder="Describe the case outcome" />
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button type="button" onClick={() => router.back()} className="px-5 py-2.5 text-sm font-medium border border-border rounded-xl hover:bg-background transition-colors text-muted hover:text-foreground">Cancel</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-primary text-white rounded-xl hover:bg-primary-dark disabled:opacity-50 transition-colors">
              {saving ? 'Saving...' : 'Update Case'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
