'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import PageHeader from '@/components/ui/page-header';
import Modal from '@/components/ui/modal';

interface SubCategory { id: number; name: string; code: string | null }
interface Category { id: number; name: string; code: string | null; sub_categories: SubCategory[] }

export default function ExpenseCategoriesPage() {
  const { token, isOwner, can } = useAuth();
  const hasAccess = isOwner || can('business_settings.access');
  const { toast } = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', code: '', parent_id: '' });

  const fetchCategories = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api.get<{ categories: Category[] }>('/expense-categories', token);
      setCategories(res.categories);
    } catch { toast('Failed to load categories', 'error'); }
    finally { setLoading(false); }
  }, [token]); // eslint-disable-line

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const openCreate = (parentId?: number) => {
    setForm({ name: '', code: '', parent_id: parentId ? String(parentId) : '' });
    setEditingId(null);
    setError('');
    setShowModal(true);
  };

  const openEdit = (cat: SubCategory | Category) => {
    setForm({ name: cat.name, code: cat.code || '', parent_id: '' });
    setEditingId(cat.id);
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !form.name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, unknown> = { name: form.name, code: form.code || null };
      if (form.parent_id) payload.parent_id = Number(form.parent_id);
      if (editingId) {
        await api.put(`/expense-categories/${editingId}`, payload, token);
        toast('Category updated', 'success');
      } else {
        await api.post('/expense-categories', payload, token);
        toast('Category created', 'success');
      }
      setShowModal(false);
      fetchCategories();
    } catch (err: unknown) {
      const errObj = err as { errors?: Record<string, string[]>; message?: string };
      setError(errObj.errors ? Object.values(errObj.errors).flat().join(', ') : errObj.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const deleteCategory = async (id: number, isSub = false) => {
    if (!confirm(`Delete this ${isSub ? 'sub-' : ''}category? ${isSub ? '' : 'All sub-categories will also be deleted.'}`)) return;
    try {
      await api.delete(`/expense-categories/${id}`, token!);
      fetchCategories();
      toast('Category deleted', 'success');
    } catch { toast('Failed to delete', 'error'); }
  };

  const inputClass = 'w-full px-3.5 py-2.5 bg-card-bg border border-border rounded-xl focus:outline-none focus:border-primary focus:ring-0 text-sm transition-colors';

  if (!hasAccess) {
    return <div className="text-center py-16 text-muted">You do not have access to this page.</div>;
  }

  return (
    <>
      <PageHeader
        title="Expense Categories"
        description="Manage expense categories and sub-categories"
        action={
          <button onClick={() => openCreate()} className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark text-sm font-medium">
            + Add Category
          </button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>
      ) : categories.length === 0 ? (
        <div className="text-center py-16 text-muted">No expense categories yet. Add your first category.</div>
      ) : (
        <div className="bg-card-bg rounded-xl border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider">Category</th>
                <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider hidden sm:table-cell">Code</th>
                <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider hidden md:table-cell">Sub-Categories</th>
                <th className="text-right px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <>
                  <tr key={cat.id} className="border-b border-border hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{cat.name}</td>
                    <td className="px-4 py-3 text-muted font-mono text-xs hidden sm:table-cell">{cat.code || '-'}</td>
                    <td className="px-4 py-3 text-muted hidden md:table-cell">{cat.sub_categories.length}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openCreate(cat.id)} className="text-xs text-primary hover:underline font-medium">+ Sub</button>
                        <button onClick={() => openEdit(cat)} className="text-xs text-accent hover:underline font-medium">Edit</button>
                        <button onClick={() => deleteCategory(cat.id)} className="text-xs text-danger hover:underline font-medium">Delete</button>
                      </div>
                    </td>
                  </tr>
                  {cat.sub_categories.map((sub) => (
                    <tr key={`sub-${sub.id}`} className="border-b border-border last:border-0 bg-gray-50/50 hover:bg-gray-100/50">
                      <td className="px-4 py-2.5 pl-8 text-muted">
                        <span className="text-muted mr-1.5">--</span>
                        {sub.name}
                      </td>
                      <td className="px-4 py-2.5 text-muted font-mono text-xs hidden sm:table-cell">{sub.code || '-'}</td>
                      <td className="px-4 py-2.5 hidden md:table-cell"></td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openEdit(sub)} className="text-xs text-accent hover:underline font-medium">Edit</button>
                          <button onClick={() => deleteCategory(sub.id, true)} className="text-xs text-danger hover:underline font-medium">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 text-xs text-muted border-t border-border bg-gray-50/50">
            {categories.length} categor{categories.length !== 1 ? 'ies' : 'y'}, {categories.reduce((sum, c) => sum + c.sub_categories.length, 0)} sub-categories
          </div>
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingId ? 'Edit Category' : (form.parent_id ? 'Add Sub-Category' : 'Add Category')} size="sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="bg-danger/5 border border-danger/20 text-danger text-sm px-4 py-3 rounded-lg">{error}</div>}
          <div>
            <label className="block text-sm font-medium mb-1">Name *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder="Category name" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Code</label>
            <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className={inputClass} placeholder="Short code (optional)" maxLength={50} />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 text-sm font-medium border border-border rounded-xl hover:bg-background transition-colors text-muted hover:text-foreground">Cancel</button>
            <button type="submit" disabled={saving || !form.name.trim()} className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-primary text-white rounded-xl hover:bg-primary-dark disabled:opacity-50 transition-colors">
              {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
