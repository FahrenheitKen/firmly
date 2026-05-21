'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useLocations } from '@/lib/locations-context';
import { api } from '@/lib/api';
import PageHeader from '@/components/ui/page-header';
import DatePicker from '@/components/ui/date-picker';

interface Role {
  id: number;
  name: string;
  full_name: string;
}

const Input = ({ label, required, ...props }: { label: string; required?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) => (
  <div>
    <label className="block text-sm font-medium text-foreground/80 mb-1">
      {label} {required && <span className="text-danger">*</span>}
    </label>
    <input
      {...props}
      className="w-full px-3.5 py-2.5 bg-card-bg border border-border rounded-xl focus:outline-none focus:border-primary focus:ring-0 text-sm transition-colors placeholder:text-muted/50"
    />
  </div>
);

const Select = ({ label, required, children, ...props }: { label: string; required?: boolean } & React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <div>
    <label className="block text-sm font-medium text-foreground/80 mb-1">
      {label} {required && <span className="text-danger">*</span>}
    </label>
    <select
      {...props}
      className="w-full px-3.5 py-2.5 bg-card-bg border border-border rounded-xl focus:outline-none focus:border-primary focus:ring-0 text-sm transition-colors appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2395a5a6%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem] bg-[right_0.75rem_center] bg-no-repeat pr-10"
    >
      {children}
    </select>
  </div>
);

const CheckCard = ({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) => (
  <label className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border cursor-pointer hover:border-primary/30 transition-colors group">
    <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0 ${checked ? 'bg-primary border-primary' : 'border-border group-hover:border-primary/50'}`}>
      {checked && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="absolute opacity-0" />
    </div>
    <div>
      <span className="text-sm font-medium text-foreground">{label}</span>
      {description && <p className="text-xs text-muted mt-0.5">{description}</p>}
    </div>
  </label>
);

export default function CreateUserPage() {
  const { token } = useAuth();
  const { locations } = useLocations();
  const router = useRouter();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Record<string, unknown>>({
    surname: '', first_name: '', last_name: '', email: '',
    password: '', role_id: '', allow_login: true, contact_no: '',
    dob: '', gender: '', marital_status: '', blood_group: '',
    language: 'en', max_sales_discount_percent: '', location_permissions: [] as number[],
    account_holder_name: '', account_number: '', bank_name: '',
    bank_identification_code: '', branch: '', tax_payer_id: '',
    basic_salary: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);

  useEffect(() => {
    if (!token) return;
    api.get<{ roles: Role[] }>('/roles', token)
      .then((rolesRes) => setRoles(rolesRes.roles))
      .finally(() => setLoading(false));
  }, [token]);

  const toggleLocation = (locId: number) => {
    const current = (form.location_permissions as number[]) || [];
    const updated = current.includes(locId) ? current.filter((id) => id !== locId) : [...current, locId];
    setForm({ ...form, location_permissions: updated });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError('');
    try {
      await api.post('/users', form, token);
      router.push('/dashboard/users?created=1');
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

  const steps = [
    { num: 1, label: 'Personal Info', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
    { num: 2, label: 'Account', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
    { num: 3, label: 'Bank', icon: 'M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3' },
    { num: 4, label: 'Locations', icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z' },
  ];

  const sectionClass = 'bg-card-bg rounded-2xl border border-border/60 p-6';

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-muted mb-3">
        <Link href="/dashboard/users" className="hover:text-foreground transition-colors">Users</Link>
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        <span className="text-foreground font-medium">Add User</span>
      </div>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Add User</h1>
          <p className="text-sm text-muted mt-1">Create a new user account</p>
        </div>
        <Link href="/dashboard/users" className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-muted bg-card-bg border border-border rounded-xl hover:bg-background hover:text-foreground transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Back
        </Link>
      </div>

      <div className="flex gap-4 mb-8">
        {steps.map((s) => (
          <button
            key={s.num}
            onClick={() => setStep(s.num)}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              step === s.num
                ? 'bg-primary text-white shadow-sm'
                : step > s.num
                ? 'bg-primary/10 text-foreground'
                : 'bg-card-bg text-muted border border-border'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={s.icon} />
            </svg>
            {s.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {error && (
              <div className="bg-danger/5 border border-danger/20 text-danger text-sm px-5 py-3.5 rounded-2xl flex items-center gap-3">
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {error}
              </div>
            )}

            {step === 1 && (
              <div className={sectionClass}>
                <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border/50">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  </div>
                  <div>
                    <h2 className="font-semibold text-foreground">Personal Information</h2>
                    <p className="text-xs text-muted">Basic details about the user</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input label="Prefix" placeholder="Mr/Mrs" value={form.surname as string} onChange={(e) => setForm({ ...form, surname: e.target.value })} />
                  <Input label="First Name" required placeholder="John" value={form.first_name as string} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
                  <Input label="Last Name" placeholder="Doe" value={form.last_name as string} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
                  <Input label="Email" type="email" placeholder="john@lawfirm.com" value={form.email as string} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  <Input label="Phone" placeholder="+1 (555) 000-0000" value={form.contact_no as string} onChange={(e) => setForm({ ...form, contact_no: e.target.value })} />
                  <DatePicker label="Date of Birth" value={form.dob as string} onChange={(v) => setForm({ ...form, dob: v })} />
                  <Select label="Gender" value={form.gender as string} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </Select>
                  <Select label="Marital Status" value={form.marital_status as string} onChange={(e) => setForm({ ...form, marital_status: e.target.value })}>
                    <option value="">Select</option>
                    <option value="married">Married</option>
                    <option value="unmarried">Unmarried</option>
                    <option value="divorced">Divorced</option>
                  </Select>
                </div>
                <div className="flex justify-end mt-6 pt-4 border-t border-border/50">
                  <button type="button" onClick={() => setStep(2)} className="px-5 py-2.5 text-sm font-medium bg-primary text-white rounded-xl hover:bg-primary-dark transition-colors">
                    Continue →
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className={sectionClass}>
                <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border/50">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg>
                  </div>
                  <div>
                    <h2 className="font-semibold text-foreground">Account Settings</h2>
                    <p className="text-xs text-muted">Login credentials and role assignment</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input label="Password" required type="password" placeholder="Min. 8 characters" value={form.password as string} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={8} />
                  <Select label="Role" required value={form.role_id as string} onChange={(e) => setForm({ ...form, role_id: Number(e.target.value) })}>
                    <option value="">Select Role</option>
                    {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </Select>
                </div>
                <div className="mt-4">
                  <CheckCard checked={form.allow_login as boolean} onChange={(v) => setForm({ ...form, allow_login: v })} label="Allow Login" description="User can sign in to the system" />
                </div>
                <div className="flex justify-between mt-6 pt-4 border-t border-border/50">
                  <button type="button" onClick={() => setStep(1)} className="px-5 py-2.5 text-sm font-medium text-muted hover:text-foreground transition-colors">← Back</button>
                  <button type="button" onClick={() => setStep(3)} className="px-5 py-2.5 text-sm font-medium bg-primary text-white rounded-xl hover:bg-primary-dark transition-colors">Continue →</button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className={sectionClass}>
                <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border/50">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>
                  </div>
                  <div>
                    <h2 className="font-semibold text-foreground">Bank Details</h2>
                    <p className="text-xs text-muted">Employee banking and tax information</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input label="Account Holder Name" value={form.account_holder_name as string} onChange={(e) => setForm({ ...form, account_holder_name: e.target.value })} placeholder="John Doe" />
                  <Input label="Account Number" value={form.account_number as string} onChange={(e) => setForm({ ...form, account_number: e.target.value })} placeholder="1234567890" />
                  <Input label="Bank Name" value={form.bank_name as string} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} placeholder="Equity Bank" />
                  <Input label="Bank Identification Code" value={form.bank_identification_code as string} onChange={(e) => setForm({ ...form, bank_identification_code: e.target.value })} placeholder="EQBLKENA" />
                  <Input label="Branch" value={form.branch as string} onChange={(e) => setForm({ ...form, branch: e.target.value })} placeholder="Nakuru" />
                  <Input label="Tax Payer ID" value={form.tax_payer_id as string} onChange={(e) => setForm({ ...form, tax_payer_id: e.target.value })} placeholder="P051234567Z" />
                  <Input label="Basic Salary" type="number" step="0.01" value={form.basic_salary as string} onChange={(e) => setForm({ ...form, basic_salary: e.target.value })} placeholder="0.00" />
                </div>
                <div className="flex justify-between mt-6 pt-4 border-t border-border/50">
                  <button type="button" onClick={() => setStep(2)} className="px-5 py-2.5 text-sm font-medium text-muted hover:text-foreground transition-colors">← Back</button>
                  <button type="button" onClick={() => setStep(4)} className="px-5 py-2.5 text-sm font-medium bg-primary text-white rounded-xl hover:bg-primary-dark transition-colors">Continue →</button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className={sectionClass}>
                <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border/50">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                  </div>
                  <div>
                    <h2 className="font-semibold text-foreground">Location Access</h2>
                    <p className="text-xs text-muted">Control which locations the user can access</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {locations.map((loc) => {
                      const checked = ((form.location_permissions as number[]) || []).includes(loc.id);
                      return (
                        <label key={loc.id} className={`flex items-center gap-2.5 px-3.5 py-3 rounded-xl border cursor-pointer transition-all text-sm ${checked ? 'bg-primary/5 border-primary/30' : 'border-border/60 hover:border-border bg-background/50'}`}>
                          <div className={`w-4.5 h-4.5 rounded border flex items-center justify-center transition-colors shrink-0 ${checked ? 'bg-primary border-primary' : 'border-border'}`}>
                            {checked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                            <input type="checkbox" checked={checked} onChange={() => toggleLocation(loc.id)} className="absolute opacity-0" />
                          </div>
                          {loc.name} ({loc.city})
                        </label>
                      );
                    })}
                  </div>
                <div className="flex justify-between mt-6 pt-4 border-t border-border/50">
                  <button type="button" onClick={() => setStep(3)} className="px-5 py-2.5 text-sm font-medium text-muted hover:text-foreground transition-colors">← Back</button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium bg-primary text-white rounded-xl hover:bg-primary-dark disabled:opacity-50 transition-colors"
                  >
                    {saving ? (
                      <>
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                        Creating...
                      </>
                    ) : (
                      'Create User →'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="bg-card-bg rounded-2xl border border-border/60 p-5">
              <h3 className="text-xs font-semibold text-muted uppercase tracking-widest mb-4">Progress</h3>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted">Step</span>
                <span className="text-sm font-medium text-foreground">{step} of 4</span>
              </div>
              <div className="w-full h-1.5 bg-background rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${(step / 4) * 100}%` }} />
              </div>
              <div className="mt-4 space-y-2">
                {[
                  { label: 'Personal Info', step: 1 },
                  { label: 'Account Settings', step: 2 },
                  { label: 'Bank Details', step: 3 },
                  { label: 'Location Access', step: 4 },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2.5 text-sm">
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${step > item.step ? 'bg-primary border-primary' : step === item.step ? 'border-primary border-2' : 'border-border'}`}>
                      {step > item.step && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <span className={step >= item.step ? 'text-foreground font-medium' : 'text-muted'}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-card-bg rounded-2xl border border-border/60 p-5">
              <h3 className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">Tips</h3>
              <ul className="space-y-2.5 text-sm text-muted">
                <li className="flex items-start gap-2.5"><span className="text-muted/50 mt-0.5">•</span>Use a real email for password recovery</li>
                <li className="flex items-start gap-2.5"><span className="text-muted/50 mt-0.5">•</span>Assign the appropriate role carefully</li>
                <li className="flex items-start gap-2.5"><span className="text-muted/50 mt-0.5">•</span>Location access can be changed later</li>
              </ul>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}
