'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { useFormatDate } from '@/lib/date';
import { api } from '@/lib/api';
import PageHeader from '@/components/ui/page-header';
import Modal from '@/components/ui/modal';
import SearchableSelect from '@/components/ui/searchable-select';
import DatePicker from '@/components/ui/date-picker';
import TaskDrawer from '@/components/tasks/task-drawer';
import TablePagination from '@/components/ui/table-pagination';

type Status = 'Pending' | 'In Progress' | 'Completed' | 'Cancelled';

interface UserRef { id: number; first_name: string; last_name: string | null }
interface CaseRef { id: number; case_number: string; title: string }

interface Task {
  id: number;
  title: string;
  description: string | null;
  status: Status;
  assigned_to: number | null;
  case_id: number | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  assignee: UserRef | null;
  created_by_user?: UserRef | null;
  createdBy?: UserRef | null;
  case?: CaseRef | null;
}

interface CaseLite { id: number; case_number: string; title: string }
interface UserLite { id: number; first_name: string; last_name: string | null }

const STATUSES: Status[] = ['Pending', 'In Progress', 'Completed', 'Cancelled'];

const statusClass = (s: Status) => ({
  Pending: 'bg-gray-100 text-gray-700',
  'In Progress': 'bg-blue-50 text-blue-700',
  Completed: 'bg-green-50 text-green-700',
  Cancelled: 'bg-gray-50 text-gray-500',
}[s]);

const fullName = (u: { first_name: string; last_name: string | null } | null | undefined) =>
  u ? `${u.first_name}${u.last_name ? ` ${u.last_name}` : ''}` : '';

const defaultForm = {
  title: '',
  description: '',
  status: 'Pending' as Status,
  assigned_to: '',
  case_id: '',
  due_date: '',
};

export default function TasksPage() {
  const { token, user, can, isOwner } = useAuth();
  const { toast } = useToast();
  const formatDate = useFormatDate();

  const canCreate = isOwner || can('task.create');
  const canUpdate = isOwner || can('task.update');
  const canDelete = isOwner || can('task.delete');
  const canViewAll = isOwner || can('task.view_all');

  const [tasks, setTasks] = useState<Task[]>([]);
  const [cases, setCases] = useState<CaseLite[]>([]);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, per_page: 25, total: 0 });

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
  const [drawerTaskId, setDrawerTaskId] = useState<number | null>(null);

  const fetchTasks = useCallback(async () => {
    if (!token) return;
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);
    if (assigneeFilter) params.set('assigned_to', assigneeFilter);
    params.set('page', String(page));
    params.set('per_page', String(perPage));
    const qs = params.toString();
    setLoading(true);
    try {
      const res = await api.get<{ tasks: Task[]; pagination: typeof pagination }>(`/tasks?${qs}`, token);
      const filtered = canViewAll
        ? res.tasks
        : res.tasks.filter((t) => t.status === 'Pending' || t.status === 'In Progress');
      setTasks(filtered);
      if (res.pagination) setPagination(res.pagination);
    } catch {
      toast('Failed to load tasks', 'error');
    } finally {
      setLoading(false);
    }
  }, [token, search, statusFilter, assigneeFilter, page, perPage, canViewAll, toast]);

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      try {
        const [c, u] = await Promise.all([
          api.get<{ cases: CaseLite[] }>('/cases?per_page=500', token).catch(() => ({ cases: [] as CaseLite[] })),
          api.get<{ users: UserLite[] }>('/users?per_page=500', token).catch(() => ({ users: [] as UserLite[] })),
        ]);
        setCases(c.cases || []);
        setUsers(u.users || []);
      } catch {
        // silently degrade — dropdowns just stay empty
      }
    };
    load();
  }, [token]);

  // Debounced — `fetchTasks` changes whenever `search`/filters change, so
  // without this every keystroke fired an API call immediately.
  useEffect(() => {
    const timer = setTimeout(fetchTasks, 300);
    return () => clearTimeout(timer);
  }, [fetchTasks, user?.active_location?.id]);

  useEffect(() => {
    if (openDropdown === null) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.dropdown-menu')) setOpenDropdown(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openDropdown]);

  const openCreate = () => {
    setEditing(null);
    setForm(defaultForm);
    setError('');
    setShowModal(true);
  };

  const openEdit = (t: Task) => {
    setOpenDropdown(null);
    setEditing(t);
    setForm({
      title: t.title,
      description: t.description ?? '',
      status: t.status,
      assigned_to: t.assigned_to ? String(t.assigned_to) : '',
      case_id: t.case_id ? String(t.case_id) : '',
      due_date: t.due_date ? t.due_date.split('T')[0] : '',
    });
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError('');
    try {
      const payload = {
        title: form.title,
        description: form.description || null,
        status: form.status,
        assigned_to: form.assigned_to ? Number(form.assigned_to) : null,
        case_id: form.case_id ? Number(form.case_id) : null,
        due_date: form.due_date || null,
      };
      if (editing) {
        await api.put(`/tasks/${editing.id}`, payload, token);
        toast('Task updated', 'success');
      } else {
        await api.post('/tasks', payload, token);
        toast('Task created', 'success');
      }
      setShowModal(false);
      fetchTasks();
    } catch (err: unknown) {
      const e = err as { errors?: Record<string, string[]>; message?: string };
      setError(e.errors ? Object.values(e.errors).flat().join(', ') : e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (t: Task, status: Status) => {
    setOpenDropdown(null);
    if (!token) return;
    try {
      await api.put(`/tasks/${t.id}`, { status }, token);
      toast(`Marked as ${status}`, 'success');
      fetchTasks();
    } catch {
      toast('Failed to update status', 'error');
    }
  };

  const deleteTask = async (id: number) => {
    setOpenDropdown(null);
    if (!confirm('Delete this task?')) return;
    if (!token) return;
    try {
      await api.delete(`/tasks/${id}`, token);
      toast('Task deleted', 'success');
      fetchTasks();
    } catch {
      toast('Failed to delete task', 'error');
    }
  };

  const userOptions = [{ value: '', label: 'Unassigned' }, ...users.map(u => ({ value: String(u.id), label: fullName(u) }))];
  const caseOptions = [{ value: '', label: 'No case' }, ...cases.map(c => ({ value: String(c.id), label: c.case_number }))];

  const inputClass = 'w-full px-3.5 py-2.5 bg-card-bg border border-border rounded-xl focus:outline-none focus:border-primary focus:ring-0 text-sm transition-colors';

  return (
    <>
      <PageHeader
        title="Tasks"
        description="Assign tasks, set priorities, track completion, delegate work"
        action={
          canCreate ? (
            <button onClick={openCreate} className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark text-sm font-medium">
              + Add Task
            </button>
          ) : null
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        <div className="relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            placeholder="Search title or description..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 bg-card-bg border border-border rounded-xl focus:outline-none focus:border-primary text-sm transition-colors"
          />
        </div>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className={inputClass}>
          <option value="">All statuses</option>
          {(canViewAll ? STATUSES : (['Pending', 'In Progress'] as Status[])).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={assigneeFilter} onChange={(e) => { setAssigneeFilter(e.target.value); setPage(1); }} className={inputClass}>
          <option value="">All assignees</option>
          <option value="me">Assigned to me</option>
          {users.map(u => <option key={u.id} value={u.id}>{fullName(u)}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-16 text-muted">
          {search || statusFilter || assigneeFilter
            ? 'No tasks match your filters.'
            : 'No tasks yet. Create your first task.'}
        </div>
      ) : (
        <div className="bg-card-bg rounded-xl border border-border overflow-visible">
          <table className="w-full text-sm table-fixed sm:table-auto">
            <thead>
              <tr className="border-b border-border bg-gray-50">
                <th className="w-16 sm:w-24 px-2 sm:px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider">Actions</th>
                <th className="text-left px-2 sm:px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider">Title</th>
                <th className="text-left px-2 sm:px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider hidden md:table-cell">Case</th>
                <th className="text-left px-2 sm:px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider hidden sm:table-cell">Assignee</th>
                <th className="text-left px-2 sm:px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider w-20 sm:w-auto">Status</th>
                <th className="text-left px-2 sm:px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider hidden lg:table-cell">Due</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-border last:border-0 hover:bg-gray-50 cursor-pointer"
                  onClick={() => setDrawerTaskId(t.id)}
                >
                  <td className="px-2 sm:px-4 py-3 relative" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setOpenDropdown(openDropdown === t.id ? null : t.id)}
                      className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors shadow-sm"
                    >
                      <span className="hidden sm:inline">Action</span>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {openDropdown === t.id && (
                      <div className="dropdown-menu absolute left-0 top-full mt-1 w-52 bg-white rounded-lg shadow-lg border border-border z-50 py-1 text-left">
                        <button
                          onClick={() => { setOpenDropdown(null); setDrawerTaskId(t.id); }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-gray-50 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          View Task
                        </button>
                        {(canUpdate || canDelete) && <hr className="my-1 border-border" />}
                        {canUpdate && t.status !== 'Completed' && (
                          <button onClick={() => updateStatus(t, 'Completed')} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-success hover:bg-success/5 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            Mark Completed
                          </button>
                        )}
                        {canUpdate && t.status === 'Pending' && (
                          <button onClick={() => updateStatus(t, 'In Progress')} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-primary hover:bg-primary/5 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            Start
                          </button>
                        )}
                        {canUpdate && t.status === 'Completed' && (
                          <button onClick={() => updateStatus(t, 'In Progress')} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-warning hover:bg-warning/5 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            Reopen
                          </button>
                        )}
                        {canUpdate && (
                          <button onClick={() => openEdit(t)} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-accent hover:bg-accent/5 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            Edit / Delegate
                          </button>
                        )}
                        {canDelete && (
                          <>
                            <hr className="my-1 border-border" />
                            <button onClick={() => deleteTask(t.id)} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-danger hover:bg-danger/5 transition-colors">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-2 sm:px-4 py-3 font-medium">
                    <div className="truncate">{t.title}</div>
                    {t.description && <div className="text-xs text-muted line-clamp-1 mt-0.5">{t.description}</div>}
                  </td>
                  <td className="px-2 sm:px-4 py-3 text-muted hidden md:table-cell text-xs">
                    {t.case ? <span className="font-mono">{t.case.case_number}</span> : <span className="text-muted/50">—</span>}
                  </td>
                  <td className="px-2 sm:px-4 py-3 text-muted hidden sm:table-cell text-xs">
                    {t.assignee ? fullName(t.assignee) : <span className="text-muted/50">Unassigned</span>}
                  </td>
                  <td className="px-2 sm:px-4 py-3">
                    <span className={`text-xs px-1.5 sm:px-2 py-0.5 rounded-full whitespace-nowrap ${statusClass(t.status)}`}>{t.status}</span>
                  </td>
                  <td className="px-2 sm:px-4 py-3 text-muted hidden lg:table-cell text-xs">
                    {t.due_date ? formatDate(t.due_date) : <span className="text-muted/50">—</span>}
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

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Task' : 'New Task'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && <div className="bg-danger/5 border border-danger/20 text-danger text-sm px-4 py-3 rounded-lg">{error}</div>}

          <div>
            <label className="block text-sm font-medium mb-1">Title *</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required className={inputClass} placeholder="e.g. Draft response to motion" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className={inputClass} placeholder="Add notes, requirements, or context..." />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SearchableSelect
              label="Assignee"
              value={form.assigned_to}
              onChange={(v) => setForm({ ...form, assigned_to: v })}
              options={userOptions}
              placeholder="Unassigned"
            />
            <SearchableSelect
              label="Linked Case"
              value={form.case_id}
              onChange={(v) => setForm({ ...form, case_id: v })}
              options={caseOptions}
              placeholder="No case"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Status })} className={inputClass}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Due Date</label>
              <DatePicker value={form.due_date} onChange={(v) => setForm({ ...form, due_date: v })} />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 text-sm font-medium border border-border rounded-xl hover:bg-background transition-colors text-muted hover:text-foreground">Cancel</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-primary text-white rounded-xl hover:bg-primary-dark disabled:opacity-50 transition-colors">
              {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </Modal>

      <TaskDrawer
        taskId={drawerTaskId}
        onClose={() => setDrawerTaskId(null)}
        onTaskChanged={fetchTasks}
      />
    </>
  );
}
