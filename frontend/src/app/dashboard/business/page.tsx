'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import PageHeader from '@/components/ui/page-header';
import SearchableSelect from '@/components/ui/searchable-select';
import DatePicker from '@/components/ui/date-picker';

interface Business {
  id: number;
  name: string;
  start_date: string | null;
  tax_number_1: string | null;
  tax_number_2: string | null;
  time_zone: string;
  fy_start_month: number;
  accounting_method: string;
  date_format: string;
  time_format: string;
  currency_symbol_placement: string;
  currency_precision: number;
  theme_color: string | null;
  transaction_edit_days: number;
  stock_expiry_alert_days: number;
  logo: string | null;
  [key: string]: unknown;
}

const Input = ({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
  <div>
    <label className="block text-xs font-medium text-muted uppercase tracking-wider mb-1.5">{label}</label>
    <input
      {...props}
      className="w-full px-3.5 py-2.5 bg-card-bg border border-border rounded-xl focus:outline-none focus:border-primary focus:ring-0 text-sm transition-colors placeholder:text-muted/50"
    />
  </div>
);

const Select = ({ label, children, ...props }: { label: string; children: React.ReactNode } & React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <div>
    <label className="block text-xs font-medium text-muted uppercase tracking-wider mb-1.5">{label}</label>
    <select
      {...props}
      className="w-full px-3.5 py-2.5 bg-card-bg border border-border rounded-xl focus:outline-none focus:border-primary focus:ring-0 text-sm transition-colors appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2395a5a6%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem] bg-[right_0.75rem_center] bg-no-repeat pr-10"
    >
      {children}
    </select>
  </div>
);

export default function BusinessSettingsPage() {
  const { token } = useAuth();
  const [business, setBusiness] = useState<Business | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (logoUrlRef.current) URL.revokeObjectURL(logoUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (!token) return;
    api.get<{ business: Business }>('/business', token)
      .then((res) => setBusiness(res.business))
      .catch(() => {});
  }, [token]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (logoUrlRef.current) URL.revokeObjectURL(logoUrlRef.current);
      const url = URL.createObjectURL(file);
      logoUrlRef.current = url;
      setLogoFile(file);
      setLogoPreview(url);
    }
  };

  const handleSave = async () => {
    if (!token || !business) return;
    setSaving(true);
    setMessage('');
    try {
      const fd = new FormData();
      const editableFields: (keyof Business)[] = [
        'name', 'start_date', 'tax_number_1', 'tax_number_2', 'time_zone',
        'fy_start_month', 'accounting_method', 'date_format', 'time_format',
        'currency_symbol_placement', 'currency_precision', 'transaction_edit_days',
      ];
      editableFields.forEach((k) => {
        const v = business[k];
        if (v !== null && v !== undefined) {
          fd.append(k as string, String(v));
        }
      });
      if (logoFile) fd.append('logo', logoFile);
      fd.append('_method', 'PUT');
      const res = await api.post<{ business: Business }>('/business', fd, token);
      setBusiness(res.business);
      setMessage('Settings saved successfully');
      setLogoFile(null);
      setTimeout(() => setMessage(''), 3000);
    } catch { setMessage('Failed to save'); } finally { setSaving(false); }
  };

  const updateField = (field: string, value: unknown) => {
    if (business) setBusiness({ ...business, [field]: value });
  };

  if (!business) {
    return <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  return (
    <>
      <PageHeader
        title="Firm Settings"
        description="Configure your firm profile and preferences"
        action={
          <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-primary text-white rounded-xl hover:bg-primary-dark disabled:opacity-50 transition-colors shadow-sm">
            {saving ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                Saving...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Save Changes
              </>
            )}
          </button>
        }
      />

      {message && (
        <div className={`mb-4 px-5 py-3.5 rounded-2xl text-sm flex items-center gap-2.5 border ${
          message.includes('success')
            ? 'bg-success/5 border-success/20 text-success'
            : 'bg-danger/5 border-danger/20 text-danger'
        }`}>
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={message.includes('success') ? 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' : 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'} />
          </svg>
          {message}
        </div>
      )}

      <div className="bg-card-bg rounded-2xl border border-border/60 overflow-hidden shadow-sm">
        <div className="px-6 py-4 bg-primary/5 border-b border-border/60 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg>
          </div>
          <h2 className="font-semibold text-foreground">General Settings</h2>
        </div>
        <div className="p-6">
          <div className="mb-6 pb-6 border-b border-border/50">
            <label className="block text-xs font-medium text-muted uppercase tracking-wider mb-2">Firm Logo</label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl border border-border/60 bg-background/50 flex items-center justify-center overflow-hidden shrink-0">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo preview" className="w-full h-full object-cover" />
                ) : business.logo ? (
                  <img src={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:8000'}/storage/${business.logo}`} alt="Current logo" className="w-full h-full object-cover" />
                ) : (
                  <svg className="w-6 h-6 text-muted/40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                )}
              </div>
              <div>
                <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-card-bg border border-border rounded-xl hover:bg-background transition-colors">
                  <svg className="w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                  Choose Logo
                  <input type="file" accept="image/jpeg,image/png,image/gif" onChange={handleLogoChange} className="hidden" />
                </label>
                <p className="text-xs text-muted mt-1">PNG, JPG or GIF. Max 2MB.</p>
                <p className="text-xs text-warning mt-0.5">Previous logo (if exists) will be replaced</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <Input label="Firm Name" value={business.name} onChange={(e) => updateField('name', e.target.value)} />
            <DatePicker label="Start Date" value={business.start_date || ''} onChange={(v) => updateField('start_date', v)} />
            <SearchableSelect
              label="Time Zone"
              value={business.time_zone}
              onChange={(v) => updateField('time_zone', v)}
              options={[
                { value: 'Africa/Nairobi', label: 'Africa/Nairobi (EAT)' },
                { value: 'Africa/Dar_es_Salaam', label: 'Africa/Dar es Salaam (EAT)' },
                { value: 'Africa/Kampala', label: 'Africa/Kampala (EAT)' },
                { value: 'Africa/Addis_Ababa', label: 'Africa/Addis Ababa (EAT)' },
                { value: 'Africa/Kigali', label: 'Africa/Kigali (CAT)' },
                { value: 'Africa/Bujumbura', label: 'Africa/Bujumbura (CAT)' },
                { value: 'Africa/Johannesburg', label: 'Africa/Johannesburg (SAST)' },
                { value: 'Africa/Lagos', label: 'Africa/Lagos (WAT)' },
                { value: 'Africa/Accra', label: 'Africa/Accra (GMT)' },
                { value: 'Asia/Dubai', label: 'Asia/Dubai (GST)' },
                { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST)' },
                { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
                { value: 'America/New_York', label: 'America/New York (EST/EDT)' },
                { value: 'America/Chicago', label: 'America/Chicago (CST/CDT)' },
                { value: 'America/Denver', label: 'America/Denver (MST/MDT)' },
                { value: 'America/Los_Angeles', label: 'America/Los Angeles (PST/PDT)' },
                { value: 'UTC', label: 'UTC' },
              ]}
            />
            <Select label="Financial Year Start" value={business.fy_start_month} onChange={(e) => updateField('fy_start_month', Number(e.target.value))}>
              {['January','February','March','April','May','June','July','August','September','October','November','December']
                .map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </Select>
            <Select label="Accounting Method" value={business.accounting_method} onChange={(e) => updateField('accounting_method', e.target.value)}>
              <option value="fifo">FIFO</option>
              <option value="lifo">LIFO</option>
              <option value="avco">AVCO</option>
            </Select>
            <Select label="Date Format" value={business.date_format} onChange={(e) => updateField('date_format', e.target.value)}>
              <option value="m/d/Y">mm/dd/yyyy</option>
              <option value="d/m/Y">dd/mm/yyyy</option>
              <option value="Y-m-d">yyyy-mm-dd</option>
              <option value="m-d-Y">mm-dd-yyyy</option>
              <option value="d-m-Y">dd-mm-yyyy</option>
            </Select>
            <Select label="Time Format" value={business.time_format} onChange={(e) => updateField('time_format', e.target.value)}>
              <option value="12">12 Hour</option>
              <option value="24">24 Hour</option>
            </Select>
            <Select label="Currency Symbol Placement" value={business.currency_symbol_placement} onChange={(e) => updateField('currency_symbol_placement', e.target.value)}>
              <option value="before">Before Amount</option>
              <option value="after">After Amount</option>
            </Select>
            <Input label="Currency Precision" type="number" min={0} max={4} value={business.currency_precision} onChange={(e) => updateField('currency_precision', Number(e.target.value))} />
            <Input label="Tax Number 1" value={business.tax_number_1 || ''} onChange={(e) => updateField('tax_number_1', e.target.value)} />
            <Input label="Tax Number 2" value={business.tax_number_2 || ''} onChange={(e) => updateField('tax_number_2', e.target.value)} />
            <Input label="Transaction Edit Days" type="number" value={business.transaction_edit_days} onChange={(e) => updateField('transaction_edit_days', Number(e.target.value))} />
          </div>
        </div>
      </div>
    </>
  );
}
