'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { useFormatDate } from '@/lib/date';
import { api } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

type Status = 'Pending' | 'In Progress' | 'Completed' | 'Cancelled';

interface UserRef { id: number; first_name: string; last_name: string | null }
interface CaseRef { id: number; case_number: string; title: string }
interface TaskDocument {
  id: number;
  case_id: number;
  original_name: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}
interface TaskComment {
  id: number;
  body: string;
  created_at: string;
  user: UserRef | null;
}

interface TaskDetail {
  id: number;
  title: string;
  description: string | null;
  status: Status;
  priority: string | null;
  assigned_to: number | null;
  case_id: number | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  assignee: UserRef | null;
  created_by_user?: UserRef | null;
  createdBy?: UserRef | null;
  completedBy?: UserRef | null;
  case?: CaseRef | null;
  documents?: TaskDocument[];
  comments?: TaskComment[];
}

const statusClass = (s: Status) => ({
  Pending: 'bg-gray-100 text-gray-700',
  'In Progress': 'bg-blue-50 text-blue-700',
  Completed: 'bg-green-50 text-green-700',
  Cancelled: 'bg-gray-50 text-gray-500',
}[s]);

const fullName = (u: UserRef | null | undefined) =>
  u ? `${u.first_name}${u.last_name ? ` ${u.last_name}` : ''}` : '';

const formatBytes = (bytes: number) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const formatTimestamp = (iso: string) => {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

interface Props {
  taskId: number | null;
  onClose: () => void;
  onTaskChanged?: () => void;
}

export default function TaskDrawer({ taskId, onClose, onTaskChanged }: Props) {
  const { token, user, can, isOwner } = useAuth();
  const { toast } = useToast();
  const formatDate = useFormatDate();

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [commentBody, setCommentBody] = useState('');
  const [posting, setPosting] = useState(false);

  const canUpdate = isOwner || can('task.update');

  const loadTask = useCallback(async () => {
    if (!taskId || !token) return;
    setLoading(true);
    try {
      const res = await api.get<{ task: TaskDetail }>(`/tasks/${taskId}`, token);
      setTask(res.task);
    } catch {
      toast('Failed to load task', 'error');
      onClose();
    } finally {
      setLoading(false);
    }
  }, [taskId, token, toast, onClose]);

  useEffect(() => {
    if (taskId === null) {
      setTask(null);
      setCommentBody('');
      return;
    }
    loadTask();
  }, [taskId, loadTask]);

  useEffect(() => {
    if (taskId === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [taskId, onClose]);

  useEffect(() => {
    if (taskId === null) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [taskId]);

  const changeStatus = async (next: Status) => {
    if (!task || !token) return;
    setStatusUpdating(true);
    try {
      await api.put(`/tasks/${task.id}`, { status: next }, token);
      toast(`Marked as ${next}`, 'success');
      await loadTask();
      onTaskChanged?.();
    } catch {
      toast('Failed to update status', 'error');
    } finally {
      setStatusUpdating(false);
    }
  };

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !token || !commentBody.trim()) return;
    setPosting(true);
    try {
      const res = await api.post<{ comment: TaskComment }>(
        `/tasks/${task.id}/comments`,
        { body: commentBody.trim() },
        token,
      );
      setTask((prev) => prev ? { ...prev, comments: [...(prev.comments || []), res.comment] } : prev);
      setCommentBody('');
    } catch {
      toast('Failed to post comment', 'error');
    } finally {
      setPosting(false);
    }
  };

  const viewDocument = async (docId: number, caseId: number) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/cases/${caseId}/documents/${docId}/view`, {
        headers: { Authorization: `Bearer ${token}`, Accept: '*/*' },
      });
      if (!res.ok) { toast('Could not open document', 'error'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch {
      toast('Could not open document', 'error');
    }
  };

  if (taskId === null) return null;

  const isAssignee = task?.assigned_to === user?.id;
  const createdBy = task?.createdBy ?? task?.created_by_user;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-xl bg-card-bg shadow-2xl flex flex-col h-full animate-[slideIn_0.2s_ease-out]">
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-border">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted uppercase tracking-wider">Task</p>
            <h2 className="text-lg font-semibold truncate">{task?.title || 'Loading…'}</h2>
            {task?.case && (
              <Link
                href={`/dashboard/cases/${task.case.id}`}
                className="text-xs text-primary hover:underline font-mono mt-0.5 inline-block"
                onClick={onClose}
              >
                {task.case.case_number}
              </Link>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {loading || !task ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin w-7 h-7 border-3 border-primary border-t-transparent rounded-full" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusClass(task.status)}`}>{task.status}</span>
                {task.priority && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-purple-50 text-purple-700">{task.priority}</span>
                )}
                {isAssignee && <span className="text-[11px] px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">Assigned to you</span>}
              </div>

              {canUpdate && (
                <div className="flex flex-wrap gap-2">
                  {task.status === 'Pending' && (
                    <button onClick={() => changeStatus('In Progress')} disabled={statusUpdating}
                      className="px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors">
                      Start
                    </button>
                  )}
                  {task.status !== 'Completed' && task.status !== 'Cancelled' && (
                    <button onClick={() => changeStatus('Completed')} disabled={statusUpdating}
                      className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors">
                      Mark Completed
                    </button>
                  )}
                  {task.status === 'Completed' && (
                    <button onClick={() => changeStatus('In Progress')} disabled={statusUpdating}
                      className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
                      Reopen
                    </button>
                  )}
                  {task.status !== 'Cancelled' && task.status !== 'Completed' && (
                    <button onClick={() => changeStatus('Cancelled')} disabled={statusUpdating}
                      className="px-3 py-1.5 text-xs font-medium text-muted border border-border rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
                      Cancel
                    </button>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-xl p-4">
                <div>
                  <p className="text-[11px] text-muted uppercase tracking-wider font-medium">Assignee</p>
                  <p className="text-sm mt-1">{task.assignee ? fullName(task.assignee) : <span className="text-muted">Unassigned</span>}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted uppercase tracking-wider font-medium">Due Date</p>
                  <p className="text-sm mt-1">{task.due_date ? formatDate(task.due_date) : <span className="text-muted">—</span>}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted uppercase tracking-wider font-medium">Created By</p>
                  <p className="text-sm mt-1">{createdBy ? fullName(createdBy) : <span className="text-muted">—</span>}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted uppercase tracking-wider font-medium">Created</p>
                  <p className="text-sm mt-1">{formatDate(task.created_at)}</p>
                </div>
                {task.completed_at && (
                  <div className="col-span-2">
                    <p className="text-[11px] text-muted uppercase tracking-wider font-medium">Completed</p>
                    <p className="text-sm mt-1">{formatTimestamp(task.completed_at)}{task.completedBy ? ` · ${fullName(task.completedBy)}` : ''}</p>
                  </div>
                )}
              </div>

              {task.description && (
                <div>
                  <p className="text-[11px] text-muted uppercase tracking-wider font-medium mb-2">Description</p>
                  <p className="text-sm whitespace-pre-line text-foreground/90">{task.description}</p>
                </div>
              )}

              {task.documents && task.documents.length > 0 && (
                <div>
                  <p className="text-[11px] text-muted uppercase tracking-wider font-medium mb-2">Attachments ({task.documents.length})</p>
                  <ul className="space-y-1.5">
                    {task.documents.map((doc) => (
                      <li key={doc.id}>
                        <button
                          onClick={() => viewDocument(doc.id, doc.case_id)}
                          className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-border rounded-lg text-left transition-colors"
                        >
                          <svg className="w-4 h-4 text-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                          <span className="text-sm truncate flex-1">{doc.original_name}</span>
                          <span className="text-xs text-muted shrink-0">{formatBytes(doc.file_size)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <p className="text-[11px] text-muted uppercase tracking-wider font-medium mb-2">
                  Comments {task.comments && task.comments.length > 0 && `(${task.comments.length})`}
                </p>
                {!task.comments || task.comments.length === 0 ? (
                  <p className="text-sm text-muted py-2">No comments yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {task.comments.map((c) => (
                      <li key={c.id} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{c.user ? fullName(c.user) : 'Unknown'}</span>
                          <span className="text-[11px] text-muted">{formatTimestamp(c.created_at)}</span>
                        </div>
                        <p className="text-sm whitespace-pre-line text-foreground/90">{c.body}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>

        {task && (
          <form onSubmit={submitComment} className="border-t border-border px-5 py-3 bg-card-bg">
            <div className="flex items-end gap-2">
              <textarea
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder="Add a comment..."
                rows={2}
                className="flex-1 px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-sm resize-none"
              />
              <button
                type="submit"
                disabled={posting || !commentBody.trim()}
                className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors"
              >
                {posting ? 'Posting…' : 'Post'}
              </button>
            </div>
          </form>
        )}
      </div>

      <style jsx global>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
