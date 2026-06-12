'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import { useFormatDate } from '@/lib/date';
import PageHeader from '@/components/ui/page-header';
import SearchableSelect from '@/components/ui/searchable-select';
import DatePicker from '@/components/ui/date-picker';
import Link from 'next/link';

interface LogEntry {
  id: number;
  action: string;
  subject_type: string;
  subject_id: number | null;
  subject_label: string | null;
  ip_address: string | null;
  properties: Record<string, unknown> | null;
  created_at: string;
  causer?: { id: number; first_name: string; last_name: string } | null;
}

interface Pagination {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

const actionColors: Record<string, string> = {
  created: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  updated: 'bg-blue-50 text-blue-700 border-blue-200',
  deleted: 'bg-red-50 text-red-600 border-red-200',
  duplicated: 'bg-violet-50 text-violet-700 border-violet-200',
  login: 'bg-amber-50 text-amber-700 border-amber-200',
  logout: 'bg-gray-100 text-gray-600 border-gray-200',
};

const subjectIcons: Record<string, string> = {
  case: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  task: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  client: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  expense: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
  series: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
  user: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
  document: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z',
  proceeding: 'M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3',
};

const subjectLinks: Record<string, string> = {
  case: '/dashboard/cases/',
  task: '/dashboard/tasks',
  client: '/dashboard/clients/',
  series: '/dashboard/series/',
};

export default function ActivityLogPage() {
  const { token, isOwner, can } = useAuth();
  const { toast } = useToast();
  const formatDate = useFormatDate();

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const [filterAction, setFilterAction] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [search, setSearch] = useState('');

  const [users, setUsers] = useState<Array<{ id: number; first_name: string; last_name: string }>>([]);

  const canAccess = isOwner || can('activity_log.view');

  const fetchLogs = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: '25' });
      if (filterAction) params.set('action', filterAction);
      if (filterSubject) params.set('subject_type', filterSubject);
      if (filterUser) params.set('causer_id', filterUser);
      if (filterFrom) params.set('from', filterFrom);
      if (filterTo) params.set('to', filterTo);
      if (search.trim()) params.set('search', search.trim());

      const res = await api.get<{ logs: LogEntry[]; pagination: Pagination }>(`/activity-logs?${params}`, token);
      setLogs(res.logs);
      setPagination(res.pagination);
    } catch {
      toast('Failed to load activity logs', 'error');
    } finally {
      setLoading(false);
    }
  }, [token, page, filterAction, filterSubject, filterUser, filterFrom, filterTo, search]); // eslint-disable-line

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  useEffect(() => {
    if (!token) return;
    api.get<{ users: Array<{ id: number; first_name: string; last_name: string }> }>('/users?per_page=500', token)
      .then(res => setUsers(res.users))
      .catch(() => {});
  }, [token]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [filterAction, filterSubject, filterUser, filterFrom, filterTo, search]);

  const clearFilters = () => {
    setFilterAction('');
    setFilterSubject('');
    setFilterUser('');
    setFilterFrom('');
    setFilterTo('');
    setSearch('');
  };

  const hasFilters = filterAction || filterSubject || filterUser || filterFrom || filterTo || search;

  if (!canAccess) {
    return <div className="text-center py-16 text-muted">You do not have permission to view activity logs.</div>;
  }

  return (
    <>
      <PageHeader title="Activity Log" description="Track all actions performed" />

      {/* Search */}
      <div className="mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by label..."
          className="w-full px-3 py-2 bg-card-bg border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
        />
      </div>

      {/* Filters */}
      <div className="bg-card-bg rounded-xl border border-border p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">User</label>
            <SearchableSelect
              value={filterUser}
              onChange={(v) => setFilterUser(v)}
              options={[{ value: '', label: 'All users' }, ...users.map(u => ({ value: String(u.id), label: `${u.first_name} ${u.last_name}` }))]}
              placeholder="Filter by user..."
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Entity Type</label>
            <select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)} className="w-full px-3 py-2 bg-card-bg border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors">
              <option value="">All types</option>
              <option value="case">Case</option>
              <option value="task">Task</option>
              <option value="client">Client</option>
              <option value="expense">Expense</option>
              <option value="series">Series</option>
              <option value="user">User</option>
              <option value="document">Document</option>
              <option value="proceeding">Proceeding</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">From</label>
            <DatePicker value={filterFrom} onChange={setFilterFrom} placeholder="Start date" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">To</label>
            <DatePicker value={filterTo} onChange={setFilterTo} placeholder="End date" />
          </div>
          <div className="flex items-end">
            {hasFilters && (
              <button onClick={clearFilters} className="px-4 py-2 text-xs font-medium text-muted border border-border rounded-xl hover:bg-background transition-colors">
                Clear Filters
              </button>
            )}
          </div>
          <div className="flex items-end justify-end">
            {pagination && (
              <span className="text-xs text-muted">{pagination.total} record{pagination.total !== 1 ? 's' : ''}</span>
            )}
          </div>
        </div>
      </div>

      {/* Log entries */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 text-muted bg-card-bg rounded-xl border border-border">
          {hasFilters ? 'No activity matches your filters.' : 'No activity recorded yet.'}
        </div>
      ) : (
        <div className="bg-card-bg rounded-xl border border-border divide-y divide-border">
          {logs.map((log) => {
            const time = new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const icon = subjectIcons[log.subject_type] || subjectIcons.case;
            const linkBase = subjectLinks[log.subject_type];
            const canLink = linkBase && log.subject_id && log.action !== 'deleted';

            return (
              <div key={log.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50/50 transition-colors">
                {/* Icon */}
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-4.5 h-4.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
                  </svg>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-medium text-foreground">
                      {log.causer ? `${log.causer.first_name} ${log.causer.last_name}` : 'System'}
                    </span>
                    <span className={`text-[11px] px-1.5 py-0.5 rounded border font-medium ${actionColors[log.action] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                      {log.action}
                    </span>
                    <span className="text-sm text-muted">
                      {log.subject_type}
                    </span>
                    {log.subject_label && (
                      canLink ? (
                        <Link href={`${linkBase}${log.subject_id}`} className="text-sm font-medium text-primary hover:underline truncate max-w-[200px]">
                          {log.subject_label}
                        </Link>
                      ) : (
                        <span className="text-sm font-medium text-foreground truncate max-w-[200px]">{log.subject_label}</span>
                      )
                    )}
                  </div>

                  {/* Properties preview */}
                  {log.properties && Object.keys(log.properties).length > 0 && (
                    <div className="mt-1 text-xs text-muted truncate max-w-md">
                      {Object.entries(log.properties).slice(0, 3).map(([k, v]) => (
                        <span key={k} className="mr-3">{k}: <span className="text-foreground/70">{String(v)}</span></span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Timestamp + IP */}
                <div className="text-right shrink-0 hidden sm:block">
                  <p className="text-xs text-muted">{formatDate(log.created_at)}</p>
                  <p className="text-[11px] text-muted/60">{time}</p>
                  {log.ip_address && <p className="text-[10px] text-muted/40 font-mono mt-0.5">{log.ip_address}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.last_page > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-muted">
            Page {pagination.current_page} of {pagination.last_page}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={pagination.current_page <= 1}
              className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-background disabled:opacity-40 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(pagination.last_page, p + 1))}
              disabled={pagination.current_page >= pagination.last_page}
              className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-background disabled:opacity-40 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </>
  );
}
