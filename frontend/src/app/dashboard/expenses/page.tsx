'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import { useCurrency } from '@/lib/use-currency';
import PageHeader from '@/components/ui/page-header';
import Modal from '@/components/ui/modal';
import SearchableSelect from '@/components/ui/searchable-select';
import DatePicker from '@/components/ui/date-picker';
import TablePagination from '@/components/ui/table-pagination';
import Link from 'next/link';

interface Category {
  id: number;
  name: string;
  sub_categories: { id: number; name: string }[];
}

interface CaseLite { id: number; our_reference: string | null; title: string }
interface ClientLite { id: number; first_name: string | null; last_name: string | null; business_name: string | null }
interface UserLite { id: number; first_name: string; last_name: string }
interface TaxRateItem { id: number; name: string; amount: string }

interface ExpenseItem {
  id: number;
  expense_number: string;
  amount: string;
  expense_date: string;
  payment_status: string;
  payment_method: string | null;
  tax_id: number | null;
  tax_amount: string | null;
  is_billable: boolean;
  is_recurring: boolean;
  recur_interval: number | null;
  recur_interval_type: string | null;
  recur_repetitions: number | null;
  recur_repeat_on: number | null;
  description: string | null;
  expense_for: string | null;
  expense_for_user_id: number | null;
  status: string;
  category?: { id: number; name: string } | null;
  sub_category?: { id: number; name: string } | null;
  case?: { id: number; our_reference: string | null; title: string } | null;
  client?: { id: number; first_name: string | null; last_name: string | null; business_name: string | null } | null;
  expense_for_user?: { id: number; first_name: string; last_name: string } | null;
  created_by?: { id: number; first_name: string; last_name: string } | null;
  tax?: { id: number; name: string; amount: string } | null;
}

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

export default function ExpensesPage() {
  const { token, user, can, isOwner } = useAuth();
  const { formatMoney } = useCurrency();
  const canCreate = isOwner || can('expense.create');
  const canUpdate = isOwner || can('expense.update');
  const canDelete = isOwner || can('expense.delete');
  const canApprove = isOwner || can('expense.approve');
  const canViewReport = isOwner || can('expense_report.view');
  const { toast } = useToast();

  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, per_page: 25, total: 0 });
  const [categoryFilter, setCategoryFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');

  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<{ id: number; name: string }[]>([]);
  const [cases, setCases] = useState<CaseLite[]>([]);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRateItem[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);

  const defaultForm = {
    expense_category_id: '',
    expense_sub_category_id: '',
    case_id: '',
    expense_for: '',
    expense_for_user_id: '',
    amount: '',
    expense_date: new Date().toISOString().split('T')[0],
    payment_status: 'due',
    payment_method: '',
    tax_id: '',
    is_billable: false,
    description: '',
    is_recurring: false,
    recur_interval: '',
    recur_interval_type: 'months',
    recur_repetitions: '',
    recur_repeat_on: '',
  };
  const [form, setForm] = useState(defaultForm);

  useEffect(() => {
    if (openDropdown === null) return;
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.dropdown-menu')) setOpenDropdown(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openDropdown]);

  const fetchExpenses = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (categoryFilter) params.set('category_id', categoryFilter);
    if (paymentFilter) params.set('payment_status', paymentFilter);
    params.set('page', String(page));
    params.set('per_page', String(perPage));
    try {
      const res = await api.get<{ expenses: ExpenseItem[]; pagination: typeof pagination }>(`/expenses?${params}`, token);
      setExpenses(res.expenses);
      if (res.pagination) setPagination(res.pagination);
    } catch { toast('Failed to load expenses', 'error'); }
    finally { setLoading(false); }
  }, [token, search, categoryFilter, paymentFilter, page, perPage, user?.active_location?.id]); // eslint-disable-line

  useEffect(() => {
    const timer = setTimeout(fetchExpenses, 300);
    return () => clearTimeout(timer);
  }, [fetchExpenses]);

  const loadFormData = async () => {
    if (!token) return;
    try {
      const [catRes, caseRes, clientRes, usersRes, taxRes] = await Promise.all([
        api.get<{ categories: Category[] }>('/expense-categories', token),
        api.get<{ cases: CaseLite[] }>('/cases?per_page=500', token),
        api.get<{ clients: ClientLite[] }>('/clients?per_page=500', token),
        api.get<{ users: UserLite[] }>('/users?per_page=500', token),
        api.get<{ tax_rates: TaxRateItem[] }>('/tax-rates', token),
      ]);
      setCategories(catRes.categories);
      setCases(caseRes.cases);
      setClients(clientRes.clients);
      setUsers(usersRes.users);
      const activeTaxes = taxRes.tax_rates.filter((t: TaxRateItem & { is_active?: boolean }) => t.is_active !== false);
      setTaxRates(activeTaxes);
      if (activeTaxes.length === 1) {
        setForm(prev => prev.tax_id ? prev : { ...prev, tax_id: String(activeTaxes[0].id) });
      }
    } catch { /* ignore */ }
  };

  const openCreate = () => {
    setForm(defaultForm);
    setEditingId(null);
    setSubCategories([]);
    setDocumentFile(null);
    setError('');
    setShowModal(true);
    loadFormData();
  };

  const openEdit = (exp: ExpenseItem) => {
    setOpenDropdown(null);
    setEditingId(exp.id);
    setDocumentFile(null);
    setError('');
    setForm({
      expense_category_id: exp.category?.id ? String(exp.category.id) : '',
      expense_sub_category_id: exp.sub_category?.id ? String(exp.sub_category.id) : '',
      case_id: exp.case?.id ? String(exp.case.id) : '',
      expense_for: exp.expense_for || '',
      expense_for_user_id: exp.expense_for_user_id ? String(exp.expense_for_user_id) : '',
      amount: exp.amount,
      expense_date: exp.expense_date ? exp.expense_date.split('T')[0] : '',
      payment_status: exp.payment_status,
      payment_method: exp.payment_method || '',
      tax_id: exp.tax_id ? String(exp.tax_id) : '',
      is_billable: exp.is_billable,
      description: exp.description || '',
      is_recurring: exp.is_recurring,
      recur_interval: exp.recur_interval ? String(exp.recur_interval) : '',
      recur_interval_type: exp.recur_interval_type || 'months',
      recur_repetitions: exp.recur_repetitions ? String(exp.recur_repetitions) : '',
      recur_repeat_on: exp.recur_repeat_on ? String(exp.recur_repeat_on) : '',
    });
    setShowModal(true);
    loadFormData().then(() => {
      if (exp.category?.id) {
        const cat = categories.find(c => c.id === exp.category!.id);
        if (cat) setSubCategories(cat.sub_categories || []);
      }
    });
  };

  const handleCategoryChange = (v: string) => {
    setForm(prev => ({ ...prev, expense_category_id: v, expense_sub_category_id: '' }));
    const cat = categories.find(c => String(c.id) === v);
    setSubCategories(cat?.sub_categories || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError('');
    try {
      if (documentFile && !editingId) {
        const fd = new FormData();
        fd.append('expense_category_id', form.expense_category_id || '');
        fd.append('expense_sub_category_id', form.expense_sub_category_id || '');
        fd.append('case_id', form.case_id || '');
        if (form.expense_for) fd.append('expense_for', form.expense_for);
        if (form.expense_for_user_id) fd.append('expense_for_user_id', form.expense_for_user_id);
        fd.append('amount', form.amount);
        fd.append('expense_date', form.expense_date);
        fd.append('payment_status', form.payment_status);
        fd.append('payment_method', form.payment_method || '');
        fd.append('tax_id', form.tax_id || '');
        fd.append('is_billable', form.is_billable ? '1' : '0');
        fd.append('is_recurring', form.is_recurring ? '1' : '0');
        if (form.description) fd.append('description', form.description);
        if (form.is_recurring) {
          if (form.recur_interval) fd.append('recur_interval', form.recur_interval);
          fd.append('recur_interval_type', form.recur_interval_type);
          if (form.recur_repetitions) fd.append('recur_repetitions', form.recur_repetitions);
          if (form.recur_interval_type === 'months' && form.recur_repeat_on) fd.append('recur_repeat_on', form.recur_repeat_on);
        }
        fd.append('document', documentFile);
        await api.upload('/expenses', fd, token);
        toast('Expense created', 'success');
      } else {
        const payload: Record<string, unknown> = {
          expense_category_id: form.expense_category_id || null,
          expense_sub_category_id: form.expense_sub_category_id || null,
          case_id: form.case_id || null,
          expense_for: form.expense_for || null,
          expense_for_user_id: form.expense_for_user_id || null,
          amount: form.amount,
          expense_date: form.expense_date,
          payment_status: form.payment_status,
          payment_method: form.payment_method || null,
          tax_id: form.tax_id || null,
          is_billable: form.is_billable,
          description: form.description || null,
          is_recurring: form.is_recurring,
        };
        if (form.is_recurring) {
          payload.recur_interval = form.recur_interval ? Number(form.recur_interval) : null;
          payload.recur_interval_type = form.recur_interval_type;
          payload.recur_repetitions = form.recur_repetitions ? Number(form.recur_repetitions) : null;
          payload.recur_repeat_on = form.recur_interval_type === 'months' && form.recur_repeat_on ? Number(form.recur_repeat_on) : null;
        }
        if (editingId) {
          await api.put(`/expenses/${editingId}`, payload, token);
          toast('Expense updated', 'success');
        } else {
          await api.post('/expenses', payload, token);
          toast('Expense created', 'success');
        }
      }
      setShowModal(false);
      fetchExpenses();
    } catch (err: unknown) {
      const errObj = err as { errors?: Record<string, string[]>; message?: string };
      setError(errObj.errors ? Object.values(errObj.errors).flat().join(', ') : errObj.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const deleteExpense = async (id: number) => {
    setOpenDropdown(null);
    if (!confirm('Delete this expense?')) return;
    try {
      await api.delete(`/expenses/${id}`, token!);
      fetchExpenses();
      toast('Expense deleted', 'success');
    } catch { toast('Failed to delete', 'error'); }
  };

  const updateExpenseStatus = async (id: number, status: 'approved' | 'rejected') => {
    setOpenDropdown(null);
    try {
      await api.put(`/expenses/${id}`, { status }, token!);
      fetchExpenses();
      toast(`Expense ${status}`, 'success');
    } catch { toast(`Failed to ${status === 'approved' ? 'approve' : 'reject'}`, 'error'); }
  };

  const clientName = (c: ExpenseItem['client']) => {
    if (!c) return '-';
    return c.business_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || '-';
  };

  const formatAmount = (a: string) => formatMoney(a);

  const inputClass = 'w-full px-3.5 py-2.5 bg-card-bg border border-border rounded-xl focus:outline-none focus:border-primary focus:ring-0 text-sm transition-colors';

  return (
    <>
      <PageHeader
        title="Expenses"
        description="Track and manage firm expenses"
        action={
          canCreate ? (
            <button onClick={openCreate} className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark text-sm font-medium">
              + Add Expense
            </button>
          ) : null
        }
      />

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="flex-1 relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            placeholder="Search by number or description..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 bg-card-bg border border-border rounded-xl focus:outline-none focus:border-primary text-sm transition-colors"
          />
        </div>
        <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }} className={`${inputClass} sm:w-40`}>
          <option value="">All categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={paymentFilter} onChange={(e) => { setPaymentFilter(e.target.value); setPage(1); }} className={`${inputClass} sm:w-36`}>
          <option value="">All payments</option>
          <option value="due">Due</option>
          <option value="paid">Paid</option>
          <option value="partial">Partial</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>
      ) : expenses.length === 0 && !search && !categoryFilter && !paymentFilter ? (
        <div className="text-center py-16 text-muted">No expenses yet. Add your first expense.</div>
      ) : expenses.length === 0 ? (
        <div className="text-center py-16 text-muted">No expenses match your filters.</div>
      ) : (
        <div className="bg-card-bg rounded-xl border border-border overflow-visible">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-gray-50">
                <th className="w-16 sm:w-24 px-2 sm:px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider">Action</th>
                <th className="text-left px-2 sm:px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider">Date</th>
                <th className="text-left px-2 sm:px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider hidden sm:table-cell">Ref</th>
                <th className="text-left px-2 sm:px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider hidden md:table-cell">Category</th>
                <th className="text-left px-2 sm:px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider hidden lg:table-cell">Case</th>
                <th className="text-right px-2 sm:px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider">Amount</th>
                <th className="text-left px-2 sm:px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider w-20">Payment</th>
                <th className="text-left px-2 sm:px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider w-20 hidden sm:table-cell">Status</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((exp) => (
                <tr key={exp.id} className="border-b border-border last:border-0 hover:bg-gray-50">
                  <td className="px-2 sm:px-4 py-3 relative">
                    <button
                      onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === exp.id ? null : exp.id); }}
                      className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors shadow-sm"
                    >
                      <span className="hidden sm:inline">Action</span>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {openDropdown === exp.id && (
                      <div className="dropdown-menu absolute left-0 top-full mt-1 w-40 bg-white rounded-lg shadow-lg border border-border z-50 py-1 text-left">
                        {canUpdate && (
                          <button onClick={() => openEdit(exp)} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-accent hover:bg-accent/5 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            Edit
                          </button>
                        )}
                        {canApprove && exp.status !== 'approved' && (
                          <button onClick={() => updateExpenseStatus(exp.id, 'approved')} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-green-700 hover:bg-green-50 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            Approve
                          </button>
                        )}
                        {canApprove && exp.status !== 'rejected' && (
                          <button onClick={() => updateExpenseStatus(exp.id, 'rejected')} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-orange-700 hover:bg-orange-50 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            Reject
                          </button>
                        )}
                        {canDelete && (
                          <>
                            <hr className="my-1 border-border" />
                            <button onClick={() => deleteExpense(exp.id)} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-danger hover:bg-danger/5 transition-colors">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-2 sm:px-4 py-3">
                    <div className="text-sm">{exp.expense_date?.split('T')[0]}</div>
                    <div className="text-xs text-muted sm:hidden">{exp.expense_number}</div>
                  </td>
                  <td className="px-2 sm:px-4 py-3 hidden sm:table-cell">
                    <span className="text-xs font-mono text-muted">{exp.expense_number}</span>
                    {exp.is_recurring && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700">Recurring</span>}
                  </td>
                  <td className="px-2 sm:px-4 py-3 text-muted hidden md:table-cell">{exp.category?.name || '-'}</td>
                  <td className="px-2 sm:px-4 py-3 hidden lg:table-cell">
                    {exp.case ? (
                      <Link href={`/dashboard/cases/${exp.case.id}`} className="text-xs font-mono text-primary hover:underline">{exp.case.our_reference || exp.case.title}</Link>
                    ) : '-'}
                  </td>
                  <td className="px-2 sm:px-4 py-3 text-right font-medium">{formatAmount(exp.amount)}</td>
                  <td className="px-2 sm:px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${paymentStatusColors[exp.payment_status] || ''}`}>{exp.payment_status}</span>
                  </td>
                  <td className="px-2 sm:px-4 py-3 hidden sm:table-cell">
                    <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${statusColors[exp.status] || ''}`}>{exp.status}</span>
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

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingId ? 'Edit Expense' : 'Add Expense'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="bg-danger/5 border border-danger/20 text-danger text-sm px-4 py-3 rounded-lg">{error}</div>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select value={form.expense_category_id} onChange={(e) => handleCategoryChange(e.target.value)} className={inputClass}>
                <option value="">Select category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Expense Note</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClass} placeholder="Brief description of the expense" />
            </div>
          </div>

          {subCategories.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Sub-Category</label>
                <select value={form.expense_sub_category_id} onChange={(e) => setForm(prev => ({ ...prev, expense_sub_category_id: e.target.value }))} className={inputClass}>
                  <option value="">Select sub-category</option>
                  {subCategories.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Amount *</label>
              <input type="number" step="0.01" min="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={inputClass} placeholder="0.00" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Expense Date *</label>
              <DatePicker value={form.expense_date} onChange={(v) => setForm({ ...form, expense_date: v })} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SearchableSelect
              label="Expense For"
              value={form.expense_for_user_id}
              onChange={(v) => setForm({ ...form, expense_for_user_id: v })}
              options={[{ value: '', label: 'None' }, ...users.map(u => ({ value: String(u.id), label: `${u.first_name} ${u.last_name || ''}`.trim() }))]}
              placeholder="Search user..."
            />
            <SearchableSelect
              label="Case (optional)"
              value={form.case_id}
              onChange={(v) => setForm({ ...form, case_id: v })}
              options={[{ value: '', label: 'None' }, ...cases.map(c => ({ value: String(c.id), label: c.our_reference || c.title }))]}
              placeholder="Search case..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium mb-1">Applicable Tax</label>
              <select value={form.tax_id} onChange={(e) => setForm({ ...form, tax_id: e.target.value })} className={inputClass}>
                <option value="">None</option>
                {taxRates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.amount}%)</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 pb-0.5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={form.is_recurring} onChange={(e) => setForm({ ...form, is_recurring: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary" />
                <span className="text-sm font-medium">Is Recurring?</span>
              </label>
              <div className="relative group">
                <svg className="w-4 h-4 text-primary cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none">
                  Automatically generate this expense at regular intervals (e.g. monthly rent, subscriptions). A new expense entry with payment status &quot;due&quot; will be created on each recurrence.
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Attach Document</label>
            <div className={`relative ${inputClass} flex items-center gap-3 cursor-pointer`}>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <svg className="w-5 h-5 text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <span className="text-sm text-muted truncate">
                {documentFile ? documentFile.name : 'Receipt, invoice, or supporting document'}
              </span>
              {documentFile && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setDocumentFile(null); }}
                  className="ml-auto shrink-0 text-danger hover:text-danger/80"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>
            <p className="text-[11px] text-muted mt-1">PDF, JPG, PNG, DOC, XLS (max 64MB)</p>
          </div>

          {form.is_recurring && (
            <div className="p-4 bg-gray-50 border border-border rounded-xl space-y-4">
              <p className="text-xs font-medium text-muted uppercase tracking-wider">Recurring Schedule</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Repeat Every *</label>
                  <div className="flex gap-2">
                    <input type="number" min="1" value={form.recur_interval} onChange={(e) => setForm({ ...form, recur_interval: e.target.value })} className={`${inputClass} w-20`} placeholder="1" />
                    <select value={form.recur_interval_type} onChange={(e) => setForm({ ...form, recur_interval_type: e.target.value, recur_repeat_on: '' })} className={inputClass}>
                      <option value="days">Days</option>
                      <option value="months">Months</option>
                      <option value="years">Years</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">No. of Repetitions</label>
                  <input type="number" min="1" value={form.recur_repetitions} onChange={(e) => setForm({ ...form, recur_repetitions: e.target.value })} className={inputClass} placeholder="Unlimited" />
                  <p className="text-[11px] text-muted mt-0.5">Leave blank for unlimited</p>
                </div>
                {form.recur_interval_type === 'months' && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Repeat On (Day)</label>
                    <select value={form.recur_repeat_on} onChange={(e) => setForm({ ...form, recur_repeat_on: e.target.value })} className={inputClass}>
                      <option value="">Same day</option>
                      {Array.from({ length: 30 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}{d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th'}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Payment Status</label>
              <select value={form.payment_status} onChange={(e) => setForm({ ...form, payment_status: e.target.value })} className={inputClass}>
                <option value="due">Due</option>
                <option value="paid">Paid</option>
                <option value="partial">Partial</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Payment Method</label>
              <select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} className={inputClass}>
                <option value="">Select method</option>
                <option value="cash">Cash</option>
                <option value="mpesa">M-Pesa</option>
                <option value="bank">Bank Transfer</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 text-sm font-medium border border-border rounded-xl hover:bg-background transition-colors text-muted hover:text-foreground">Cancel</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-primary text-white rounded-xl hover:bg-primary-dark disabled:opacity-50 transition-colors">
              {saving ? 'Saving...' : editingId ? 'Update Expense' : 'Create Expense'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
