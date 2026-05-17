'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import PageHeader from '@/components/ui/page-header';

const inputClass = 'w-full px-3.5 py-2.5 bg-card-bg border border-border rounded-xl focus:outline-none focus:border-primary focus:ring-0 text-sm transition-colors';

export default function CaseSettingsPage() {
  const { token } = useAuth();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    case_number_format: '{FI}/{CP}/{CT}/{N}/{Y}',
  });

  useEffect(() => {
    if (!token) return;
    api.get<{ business: Record<string, unknown> }>('/business', token).then((res) => {
      const b = res.business;
      const refPrefixes = (b.ref_no_prefixes as Record<string, string>) || {};
      setForm({
        case_number_format: refPrefixes.case_number_format || '{FI}/{CP}/{CT}/{N}/{Y}',
      });
    }).catch(() => {});
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setSaved(false);
    try {
      await api.put('/business', {
        ref_no_prefixes: { case_number_format: form.case_number_format },
      }, token);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch { console.error('Failed to save settings') } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Case Settings" description="Configure case management defaults" />

      <div className="max-w-2xl bg-card-bg rounded-xl border border-border p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1">Our Reference Format</label>
            <input value={form.case_number_format} onChange={(e) => setForm({ ...form, case_number_format: e.target.value })} className={inputClass} placeholder="{FI}/{CP}/{CT}/{N}/{Y}" />
            <div className="mt-2 text-xs text-muted space-y-0.5">
              <p><code className="bg-gray-100 px-1 rounded">{'{FI}'}</code> Firm initials (e.g. WWW)</p>
              <p><code className="bg-gray-100 px-1 rounded">{'{BI}'}</code> Business ID (e.g. 2)</p>
              <p><code className="bg-gray-100 px-1 rounded">{'{CP}'}</code> Client prefix (e.g. MTCL)</p>
              <p><code className="bg-gray-100 px-1 rounded">{'{CT}'}</code> City abbreviation (e.g. NRB)</p>
              <p><code className="bg-gray-100 px-1 rounded">{'{N}'}</code> Sequential number (e.g. 001)</p>
              <p><code className="bg-gray-100 px-1 rounded">{'{Y}'}</code> Year (e.g. 2026)</p>
            </div>
          </div>


          <div className="flex items-center gap-3 pt-4 border-t border-border">
            <button type="submit" disabled={saving} className="px-5 py-2.5 text-sm font-medium bg-primary text-white rounded-xl hover:bg-primary-dark disabled:opacity-50 transition-colors">
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
            {saved && <span className="text-sm text-emerald-600 font-medium">Settings saved</span>}
          </div>
        </form>
      </div>
    </>
  );
}
