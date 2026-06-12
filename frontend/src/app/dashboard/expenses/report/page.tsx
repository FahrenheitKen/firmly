'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import { useFormatDate } from '@/lib/date';
import { useCurrency } from '@/lib/use-currency';
import PageHeader from '@/components/ui/page-header';
import SearchableSelect from '@/components/ui/searchable-select';
import DatePicker from '@/components/ui/date-picker';
import TablePagination from '@/components/ui/table-pagination';

interface Category { id: number; name: string }
interface ExpenseItem {
  id: number;
  expense_number: string;
  amount: string;
  expense_date: string;
  payment_status: string;
  payment_method: string | null;
  tax_amount: string | null;
  is_billable: boolean;
  description: string | null;
  expense_for: string | null;
  status: string;
  category?: { id: number; name: string } | null;
  sub_category?: { id: number; name: string } | null;
  case?: { id: number; our_reference: string | null; title: string } | null;
  client?: { id: number; first_name: string | null; last_name: string | null; business_name: string | null } | null;
  expense_for_user?: { id: number; first_name: string; last_name: string } | null;
  created_by?: { id: number; first_name: string; last_name: string } | null;
  tax?: { id: number; name: string; amount: string } | null;
}

interface Pagination { current_page: number; last_page: number; per_page: number; total: number }

const paymentStatusColors: Record<string, string> = {
  paid: 'bg-green-50 text-green-700',
  due: 'bg-red-50 text-red-700',
  partial: 'bg-yellow-50 text-yellow-700',
};

const statusColors: Record<string, string> = {
  approved: 'bg-green-50 text-green-700',
  pending: 'bg-yellow-50 text-yellow-700',
  rejected: 'bg-red-50 text-red-700',
};

export default function ExpenseReportPage() {
  const { token, isOwner, can } = useAuth();
  const { toast } = useToast();
  const formatDate = useFormatDate();
  const { formatMoney } = useCurrency();

  const canAccess = isOwner || can('expense_report.view');

  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);

  const [categories, setCategories] = useState<Category[]>([]);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [search, setSearch] = useState('');

  const fetchExpenses = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: String(perPage) });
      if (filterCategory) params.set('category_id', filterCategory);
      if (filterPaymentStatus) params.set('payment_status', filterPaymentStatus);
      if (filterStatus) params.set('status', filterStatus);
      if (filterFrom) params.set('date_from', filterFrom);
      if (filterTo) params.set('date_to', filterTo);
      if (search.trim()) params.set('search', search.trim());

      const res = await api.get<{ expenses: ExpenseItem[]; pagination: Pagination }>(`/expenses?${params}`, token);
      setExpenses(res.expenses);
      setPagination(res.pagination);
    } catch {
      toast('Failed to load expenses', 'error');
    } finally {
      setLoading(false);
    }
  }, [token, page, perPage, filterCategory, filterPaymentStatus, filterStatus, filterFrom, filterTo, search]); // eslint-disable-line

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  useEffect(() => {
    if (!token) return;
    api.get<{ categories: Category[] }>('/expense-categories', token)
      .then(res => setCategories(res.categories))
      .catch(() => {});
  }, [token]);

  useEffect(() => { setPage(1); }, [filterCategory, filterPaymentStatus, filterStatus, filterFrom, filterTo, search]);

  const clearFilters = () => {
    setFilterCategory('');
    setFilterPaymentStatus('');
    setFilterStatus('');
    setFilterFrom('');
    setFilterTo('');
    setSearch('');
  };

  const hasFilters = filterCategory || filterPaymentStatus || filterStatus || filterFrom || filterTo || search;

  const clientName = (c: ExpenseItem['client']) => {
    if (!c) return '-';
    return c.business_name || [c.first_name, c.last_name].filter(Boolean).join(' ') || '-';
  };

  // Totals for visible page
  const pageTotal = expenses.reduce((sum, e) => sum + parseFloat(e.amount || '0'), 0);

  if (!canAccess) {
    return <div className="text-center py-16 text-muted">You do not have permission to view expense reports.</div>;
  }

  return (
    <>
      <PageHeader title="Expense Report" />

      {/* Search */}
      <div className="mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by expense number or description..."
          className="w-full px-3 py-2 bg-card-bg border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
        />
      </div>

      {/* Filters */}
      <div className="bg-card-bg rounded-xl border border-border p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Category</label>
            <SearchableSelect
              value={filterCategory}
              onChange={setFilterCategory}
              options={[{ value: '', label: 'All categories' }, ...categories.map(c => ({ value: String(c.id), label: c.name }))]}
              placeholder="Filter by category..."
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Payment Status</label>
            <select value={filterPaymentStatus} onChange={(e) => setFilterPaymentStatus(e.target.value)} className="w-full px-3 py-2 bg-card-bg border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors">
              <option value="">All</option>
              <option value="paid">Paid</option>
              <option value="due">Due</option>
              <option value="partial">Partial</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Approval</label>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full px-3 py-2 bg-card-bg border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors">
              <option value="">All</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
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
        </div>
        <div className="flex items-center justify-between mt-3">
          <div>
            {hasFilters && (
              <button onClick={clearFilters} className="px-4 py-2 text-xs font-medium text-muted border border-border rounded-xl hover:bg-background transition-colors">
                Clear Filters
              </button>
            )}
          </div>
          {pagination && (
            <span className="text-xs text-muted">{pagination.total} record{pagination.total !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>
      ) : expenses.length === 0 ? (
        <div className="text-center py-16 text-muted bg-card-bg rounded-xl border border-border">
          {hasFilters ? 'No expenses match your filters.' : 'No expenses recorded yet.'}
        </div>
      ) : (
        <div className="bg-card-bg rounded-xl border border-border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-gray-50/50 text-left">
                  <th className="px-4 py-3 font-medium text-muted text-xs">#</th>
                  <th className="px-4 py-3 font-medium text-muted text-xs">Date</th>
                  <th className="px-4 py-3 font-medium text-muted text-xs">Category</th>
                  <th className="px-4 py-3 font-medium text-muted text-xs">Description</th>
                  <th className="px-4 py-3 font-medium text-muted text-xs">Case</th>
                  <th className="px-4 py-3 font-medium text-muted text-xs">Client</th>
                  <th className="px-4 py-3 font-medium text-muted text-xs">Created By</th>
                  <th className="px-4 py-3 font-medium text-muted text-xs text-right">Amount</th>
                  <th className="px-4 py-3 font-medium text-muted text-xs text-center">Payment</th>
                  <th className="px-4 py-3 font-medium text-muted text-xs text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 text-xs font-mono text-muted">{exp.expense_number}</td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">{formatDate(exp.expense_date)}</td>
                    <td className="px-4 py-3 text-xs">{exp.category?.name || '-'}</td>
                    <td className="px-4 py-3 text-xs max-w-[200px] truncate">{exp.description || '-'}</td>
                    <td className="px-4 py-3 text-xs">{exp.case?.our_reference || exp.case?.title || '-'}</td>
                    <td className="px-4 py-3 text-xs">{clientName(exp.client)}</td>
                    <td className="px-4 py-3 text-xs">{exp.created_by ? `${exp.created_by.first_name} ${exp.created_by.last_name}` : '-'}</td>
                    <td className="px-4 py-3 text-xs text-right font-medium">{formatMoney(exp.amount)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${paymentStatusColors[exp.payment_status] || 'bg-gray-100 text-gray-600'}`}>
                        {exp.payment_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${statusColors[exp.status] || 'bg-gray-100 text-gray-600'}`}>
                        {exp.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-gray-50/80">
                  <td colSpan={7} className="px-4 py-3 text-xs font-semibold text-muted text-right">Page Total</td>
                  <td className="px-4 py-3 text-xs text-right font-bold">{formatMoney(pageTotal)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
          {pagination && (
            <TablePagination
              currentPage={pagination.current_page}
              lastPage={pagination.last_page}
              perPage={pagination.per_page}
              total={pagination.total}
              onPageChange={setPage}
              onPerPageChange={(v) => { setPerPage(v); setPage(1); }}
            />
          )}
        </div>
      )}
    </>
  );
}
