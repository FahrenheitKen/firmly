'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

function SearchableSelect({ name, value, onChange, options, placeholder, className, groups }: {
  name: string; value: string; onChange: (name: string, value: string) => void;
  options: { value: string; label: string; group?: string }[]; placeholder: string; className?: string;
  groups?: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const filtered = query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative">
      <div
        onClick={() => { if (!open && !value) setQuery(''); setOpen(!open); }}
        className={`flex items-center justify-between cursor-pointer transition-all duration-200 ${
          className || 'w-full px-3 py-2.5 border border-border rounded-lg text-sm'
        } ${open ? 'ring-2 ring-primary/50 border-primary' : 'hover:border-primary/50'} ${!selected ? 'text-muted' : 'text-foreground'}`}
      >
        {selected ? (
          <span className="truncate flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-success shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            {selected.label}
          </span>
        ) : (
          <span className="truncate flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {placeholder}
          </span>
        )}
        <svg className={`w-4 h-4 shrink-0 ml-2 text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1.5 bg-card-bg border border-border rounded-xl shadow-xl max-h-80 flex flex-col animate-[fadeIn_0.15s_ease]">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type to search..."
                className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 bg-[#F4F6F9]"
              />
              {query && (
                <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-foreground rounded-md hover:bg-gray-200 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          <div className="overflow-y-auto flex-1 py-1">
            {filtered.length === 0 ? (
              <div className="px-4 py-8 text-sm text-muted text-center">
                <svg className="w-8 h-8 mx-auto mb-2 text-muted/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                No results found
              </div>
            ) : groups ? (
              (() => {
                const grouped: Record<string, typeof options> = {};
                filtered.forEach((o) => {
                  const g = o.group || '';
                  if (!grouped[g]) grouped[g] = [];
                  grouped[g].push(o);
                });
                return Object.entries(grouped).map(([g, items]) => (
                  <div key={g}>
                    <div className="px-4 py-1.5 text-[10px] font-semibold text-muted uppercase tracking-wider bg-[#F4F6F9] mx-1 rounded mt-1">{groups[g] || g}</div>
                    {items.map((o) => (
                      <div
                        key={o.value}
                        onClick={() => { onChange(name, o.value); setOpen(false); }}
                        className={`px-4 py-2.5 text-sm cursor-pointer transition-all duration-150 flex items-center justify-between mx-1 rounded-lg ${
                          o.value === value
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-foreground hover:bg-[#F4F6F9]'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          {o.value === value && (
                            <svg className="w-3.5 h-3.5 text-primary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                          {o.label}
                        </span>
                        <span className="text-[10px] text-muted">{o.group}</span>
                      </div>
                    ))}
                  </div>
                ));
              })()
            ) : (
              filtered.map((o) => (
                <div
                  key={o.value}
                  onClick={() => { onChange(name, o.value); setOpen(false); }}
                  className={`px-4 py-2.5 text-sm cursor-pointer transition-all duration-150 flex items-center justify-between mx-1 rounded-lg ${
                    o.value === value
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-foreground hover:bg-[#F4F6F9]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {o.value === value && (
                      <svg className="w-3.5 h-3.5 text-primary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {o.label}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="px-4 py-2 border-t border-border text-[10px] text-muted flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {filtered.length} of {options.length} options
          </div>
        </div>
      )}
    </div>
  );
}

function DatePicker({ value, onChange, name }: { value: string; onChange: (name: string, value: string) => void; name: string }) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = value ? new Date(value) : new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const today = new Date();
  const sel = value ? new Date(value) : null;

  const daysInMonth = new Date(viewMonth.year, viewMonth.month + 1, 0).getDate();
  const firstDow = new Date(viewMonth.year, viewMonth.month, 1).getDay();
  const prevMonthDays = new Date(viewMonth.year, viewMonth.month, 0).getDate();

  const grid: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) grid.push(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(d);
  while (grid.length % 7 !== 0) grid.push(null);

  const nav = (delta: number) => {
    const m = viewMonth.month + delta;
    if (m < 0) setViewMonth({ year: viewMonth.year - 1, month: 11 });
    else if (m > 11) setViewMonth({ year: viewMonth.year + 1, month: 0 });
    else setViewMonth({ ...viewMonth, month: m });
  };

  const pick = (day: number) => {
    const d = new Date(viewMonth.year, viewMonth.month, day);
    onChange(name, d.toISOString().split('T')[0]);
    setOpen(false);
  };

  const clear = () => { onChange(name, ''); setOpen(false); };

  const isToday = (d: number) => {
    return today.getDate() === d && today.getMonth() === viewMonth.month && today.getFullYear() === viewMonth.year;
  };
  const isSelected = (d: number) => {
    return sel && sel.getDate() === d && sel.getMonth() === viewMonth.month && sel.getFullYear() === viewMonth.year;
  };

  const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const inputClass = 'w-full px-3 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-sm transition-shadow duration-200';

  return (
    <div ref={ref} className="relative">
      <div
        onClick={() => setOpen(!open)}
        className={`${inputClass} cursor-pointer flex items-center justify-between ${!value ? 'text-muted' : 'text-foreground'}`}
      >
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4 text-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {value ? new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Select date'}
        </span>
        <div className="flex items-center gap-1">
          {value && (
            <button onClick={(e) => { e.stopPropagation(); clear(); }} className="p-0.5 text-muted hover:text-danger transition-colors" type="button">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <svg className={`w-4 h-4 text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1.5 bg-card-bg border border-border rounded-xl shadow-xl p-4 animate-[fadeIn_0.15s_ease]">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => nav(-1)} className="p-1.5 text-muted hover:text-foreground hover:bg-[#F4F6F9] rounded-lg transition-colors" type="button">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-foreground">{monthNames[viewMonth.month]} {viewMonth.year}</span>
            <button onClick={() => nav(1)} className="p-1.5 text-muted hover:text-foreground hover:bg-[#F4F6F9] rounded-lg transition-colors" type="button">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 mb-2">
            {dayNames.map((d) => (
              <div key={d} className="text-center text-[10px] font-semibold text-muted uppercase tracking-wider py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {grid.map((d, i) => (
              <div key={i}>
                {d ? (
                  <button
                    onClick={() => pick(d)}
                    type="button"
                    className={`w-9 h-9 text-xs rounded-lg transition-all duration-150 flex items-center justify-center ${
                      isSelected(d)
                        ? 'bg-primary text-white font-semibold shadow-sm shadow-primary/30'
                        : isToday(d)
                          ? 'border border-primary/50 text-primary font-medium'
                          : 'text-foreground hover:bg-[#F4F6F9]'
                    }`}
                  >
                    {d}
                  </button>
                ) : (
                  <div className="w-9 h-9" />
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
            <button onClick={clear} className="text-xs text-muted hover:text-danger transition-colors" type="button">Clear</button>
            <button onClick={() => { const t = new Date(); setViewMonth({ year: t.getFullYear(), month: t.getMonth() }); }} className="text-xs text-primary hover:underline transition-colors" type="button">Today</button>
          </div>
        </div>
      )}
    </div>
  );
}

const timezones = Intl.supportedValuesOf?.('timeZone') ?? [
  'Africa/Abidjan','Africa/Accra','Africa/Addis_Ababa','Africa/Algiers','Africa/Cairo',
  'Africa/Casablanca','Africa/Dar_es_Salaam','Africa/Harare','Africa/Johannesburg',
  'Africa/Kampala','Africa/Lagos','Africa/Nairobi','Africa/Tripoli','Africa/Tunis',
  'America/Adak','America/Anchorage','America/Araguaina','America/Argentina/Buenos_Aires',
  'America/Asuncion','America/Bahia','America/Bogota','America/Caracas','America/Chicago',
  'America/Costa_Rica','America/Denver','America/Edmonton','America/El_Salvador',
  'America/Fortaleza','America/Guatemala','America/Halifax','America/Indiana/Indianapolis',
  'America/La_Paz','America/Lima','America/Los_Angeles','America/Mazatlan',
  'America/Mexico_City','America/Montevideo','America/New_York','America/Noronha',
  'America/Panama','America/Phoenix','America/Regina','America/Santiago',
  'America/Sao_Paulo','America/St_Johns','America/Tijuana','America/Toronto',
  'America/Vancouver','America/Winnipeg','Asia/Almaty','Asia/Amman','Asia/Baghdad',
  'Asia/Baku','Asia/Bangkok','Asia/Beirut','Asia/Colombo','Asia/Dhaka','Asia/Dubai',
  'Asia/Ho_Chi_Minh','Asia/Hong_Kong','Asia/Jakarta','Asia/Jayapura','Asia/Jerusalem',
  'Asia/Kabul','Asia/Karachi','Asia/Kathmandu','Asia/Kolkata','Asia/Kuala_Lumpur',
  'Asia/Kuwait','Asia/Makassar','Asia/Manila','Asia/Muscat','Asia/Rangoon',
  'Asia/Riyadh','Asia/Seoul','Asia/Shanghai','Asia/Singapore','Asia/Taipei',
  'Asia/Tashkent','Asia/Tbilisi','Asia/Tehran','Asia/Tokyo','Asia/Ulaanbaatar',
  'Asia/Vientiane','Asia/Yangon','Atlantic/Cape_Verde','Atlantic/Reykjavik',
  'Australia/Adelaide','Australia/Brisbane','Australia/Darwin','Australia/Hobart',
  'Australia/Melbourne','Australia/Perth','Australia/Sydney','Europe/Amsterdam',
  'Europe/Athens','Europe/Berlin','Europe/Brussels','Europe/Budapest',
  'Europe/Copenhagen','Europe/Dublin','Europe/Helsinki','Europe/Istanbul',
  'Europe/Kiev','Europe/Lisbon','Europe/London','Europe/Madrid','Europe/Minsk',
  'Europe/Moscow','Europe/Oslo','Europe/Paris','Europe/Prague','Europe/Rome',
  'Europe/Stockholm','Europe/Vienna','Europe/Warsaw','Europe/Zurich',
  'Pacific/Auckland','Pacific/Fiji','Pacific/Guam','Pacific/Honolulu',
  'Pacific/Majuro','Pacific/Noumea','Pacific/Port_Moresby','Pacific/Tongatapu',
];

const tzGroups = timezones.reduce<Record<string, string[]>>((acc, tz) => {
  const region = tz.split('/')[0];
  if (!acc[region]) acc[region] = [];
  acc[region].push(tz);
  return acc;
}, {});

const currenciesList = [
  { id: 1, currency: 'US Dollar', code: 'USD', symbol: '$' },
  { id: 2, currency: 'Euro', code: 'EUR', symbol: '\u20AC' },
  { id: 3, currency: 'British Pound', code: 'GBP', symbol: '\u00A3' },
  { id: 4, currency: 'Indian Rupee', code: 'INR', symbol: '\u20B9' },
  { id: 5, currency: 'Canadian Dollar', code: 'CAD', symbol: 'C$' },
  { id: 6, currency: 'Australian Dollar', code: 'AUD', symbol: 'A$' },
  { id: 7, currency: 'Japanese Yen', code: 'JPY', symbol: '\u00A5' },
  { id: 8, currency: 'Chinese Yuan', code: 'CNY', symbol: '\u00A5' },
  { id: 9, currency: 'South African Rand', code: 'ZAR', symbol: 'R' },
  { id: 10, currency: 'Nigerian Naira', code: 'NGN', symbol: '\u20A6' },
  { id: 11, currency: 'Kenyan Shilling', code: 'KES', symbol: 'KSh' },
  { id: 12, currency: 'Brazilian Real', code: 'BRL', symbol: 'R$' },
  { id: 13, currency: 'Mexican Peso', code: 'MXN', symbol: 'MX$' },
  { id: 14, currency: 'UAE Dirham', code: 'AED', symbol: 'AED' },
  { id: 15, currency: 'Saudi Riyal', code: 'SAR', symbol: 'SAR' },
];

const countries = [
  'Afghanistan','Albania','Algeria','Andorra','Angola','Antigua and Barbuda','Argentina','Armenia','Australia','Austria','Azerbaijan',
  'Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bhutan','Bolivia','Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria','Burkina Faso','Burundi',
  'Cabo Verde','Cambodia','Cameroon','Canada','Central African Republic','Chad','Chile','China','Colombia','Comoros','Congo','Costa Rica','Croatia','Cuba','Cyprus','Czech Republic',
  'Denmark','Djibouti','Dominica','Dominican Republic','DRC',
  'Ecuador','Egypt','El Salvador','Equatorial Guinea','Eritrea','Estonia','Eswatini','Ethiopia',
  'Fiji','Finland','France',
  'Gabon','Gambia','Georgia','Germany','Ghana','Greece','Grenada','Guatemala','Guinea','Guinea-Bissau','Guyana',
  'Haiti','Honduras','Hungary',
  'Iceland','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy',
  'Ivory Coast',
  'Jamaica','Japan','Jordan',
  'Kazakhstan','Kenya','Kiribati','Kuwait','Kyrgyzstan',
  'Laos','Latvia','Lebanon','Lesotho','Liberia','Libya','Liechtenstein','Lithuania','Luxembourg',
  'Madagascar','Malawi','Malaysia','Maldives','Mali','Malta','Marshall Islands','Mauritania','Mauritius','Mexico','Micronesia','Moldova','Monaco','Mongolia','Montenegro','Morocco','Mozambique','Myanmar',
  'Namibia','Nauru','Nepal','Netherlands','New Zealand','Nicaragua','Niger','Nigeria','North Korea','North Macedonia','Norway',
  'Oman',
  'Pakistan','Palau','Palestine','Panama','Papua New Guinea','Paraguay','Peru','Philippines','Poland','Portugal',
  'Qatar',
  'Romania','Russia','Rwanda',
  'Saint Kitts and Nevis','Saint Lucia','Saint Vincent','Samoa','San Marino','Sao Tome and Principe','Saudi Arabia','Senegal','Serbia','Seychelles','Sierra Leone','Singapore','Slovakia','Slovenia','Solomon Islands','Somalia','South Africa','South Korea','South Sudan','Spain','Sri Lanka','Sudan','Suriname','Sweden','Switzerland','Syria',
  'Taiwan','Tajikistan','Tanzania','Thailand','Timor-Leste','Togo','Tonga','Trinidad and Tobago','Tunisia','Turkey','Turkmenistan','Tuvalu',
  'Uganda','Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay','Uzbekistan',
  'Vanuatu','Vatican City','Venezuela','Vietnam',
  'Yemen',
  'Zambia','Zimbabwe',
];

interface Currency {
  id: number;
  currency: string;
  code: string;
  symbol: string;
}

const steps = [
  { num: 1, label: 'Firm', desc: 'Company details' },
  { num: 2, label: 'Account', desc: 'Owner credentials' },
  { num: 3, label: 'Review', desc: 'Confirm & submit' },
];

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const handleField = (nameOrEvent: string | React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>, value?: string) => {
    if (typeof nameOrEvent === 'string') {
      setForm((prev) => ({ ...prev, [nameOrEvent]: value || '' }));
    } else {
      const target = nameOrEvent.target;
      setForm((prev) => ({ ...prev, [target.name]: target.value }));
    }
  };
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    business_name: '', start_date: '', currency_id: '', website: '', mobile: '', alternate_number: '',
    country: '', city: '', zip_code: '', landmark: '',
    time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    fy_start_month: '1', accounting_method: 'fifo',
    first_name: '', surname: '', last_name: '',
    email: '', password: '', password_confirmation: '',
  });
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const currencies = currenciesList;
  const logoUrlRef = useRef<string>('');

  const handleLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (logoUrlRef.current) URL.revokeObjectURL(logoUrlRef.current);
      const url = URL.createObjectURL(file);
      logoUrlRef.current = url;
      setLogo(file);
      setLogoPreview(url);
    }
  };

  const currencyOptions = currencies.map((c) => ({ value: String(c.id), label: `${c.currency} (${c.code} ${c.symbol})` }));
  const tzOptions = Object.entries(tzGroups).flatMap(([region, tzs]) =>
    tzs.map((tz) => ({
      value: tz,
      label: `${tz.split('/').slice(1).join(' / ').replace(/_/g, ' ')}`,
      group: region,
    }))
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) return;
    setError('');
    setLoading(true);
    try {
      const payload = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v) payload.append(k, v); });
      if (logo) payload.append('logo', logo);
      payload.set('currency_id', String(Number(form.currency_id)));
      payload.set('fy_start_month', String(Number(form.fy_start_month)));
      await api.post('/register', payload);
      router.push('/login?registered=1');
    } catch (err: unknown) {
      const e = err as { message?: string; errors?: Record<string, string[]> };
      setError(e.errors ? Object.values(e.errors).flat().join(', ') : e.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    setError('');
    if (step === 1) {
      if (!form.business_name) { setError('Firm name is required'); return; }
      if (!form.currency_id) { setError('Currency is required'); return; }
      if (!form.country) { setError('Country is required'); return; }

      if (!form.city) { setError('City is required'); return; }
      if (!form.zip_code) { setError('Zip code is required'); return; }
    }
    if (step === 2) {
      if (!form.first_name) { setError('First name is required'); return; }
      if (!form.email) { setError('Email is required'); return; }
      if (!form.password || form.password.length < 8) { setError('Password must be at least 8 characters'); return; }
      if (form.password !== form.password_confirmation) { setError('Passwords do not match'); return; }
    }
    setStep((s) => Math.min(s + 1, 3));
  };

  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  const inputClass = 'w-full px-3 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-sm transition-shadow duration-200';
  const labelClass = 'block text-sm font-medium text-foreground mb-1.5';

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-background">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary">Firmly</h1>
          <p className="text-muted mt-1">Set up your firm in minutes</p>
        </div>

        <div className="bg-card-bg rounded-xl shadow-lg border border-border overflow-hidden">
          <div className="px-6 sm:px-8 pt-8 pb-2">
            <div className="flex items-center justify-center">
              {steps.map((s, i) => (
                <div key={s.num} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                      step > s.num
                        ? 'bg-success text-white'
                        : step === s.num
                          ? 'bg-primary text-white shadow-md shadow-primary/30'
                          : 'bg-[#E8ECF1] text-muted'
                    }`}>
                      {step > s.num ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        s.num
                      )}
                    </div>
                    <span className={`text-xs mt-1.5 font-medium transition-colors duration-200 hidden sm:block ${
                      step === s.num ? 'text-primary' : 'text-muted'
                    }`}>{s.label}</span>
                    <span className={`text-[10px] hidden sm:block transition-colors duration-200 ${
                      step === s.num ? 'text-muted' : 'text-[#C0C6CC]'
                    }`}>{s.desc}</span>
                  </div>
                  {i < steps.length - 1 && (
                    <div className={`w-12 sm:w-16 h-0.5 mx-2 sm:mx-3 mt-[-1.5rem] rounded-full transition-colors duration-300 ${
                      step > s.num ? 'bg-success' : 'bg-[#E8ECF1]'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
            {error && (
              <div className="flex items-center gap-2 bg-red-50 text-danger text-sm px-4 py-3 rounded-lg border border-red-100">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            {step === 1 && (
              <div className="space-y-5 animate-[fadeIn_0.3s_ease]">
                <div className="flex items-center gap-3 pb-2 border-b border-border">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Firm Details</h3>
                    <p className="text-xs text-muted">Tell us about your firm</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Firm Name <span className="text-danger">*</span></label>
                    <input name="business_name" value={form.business_name} onChange={handleField} className={inputClass} placeholder="e.g. Acme Corp" />
                  </div>
                  <div>
                    <label className={labelClass}>Starting Date</label>
                    <DatePicker name="start_date" value={form.start_date} onChange={handleField} />
                  </div>
                  <div>
                    <label className={labelClass}>Currency <span className="text-danger">*</span></label>
                    <SearchableSelect
                      name="currency_id"
                      value={form.currency_id}
                      onChange={handleField}
                      options={currencyOptions}
                      placeholder="Select Currency"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Website</label>
                    <input name="website" value={form.website} onChange={handleField} className={inputClass} placeholder="https://example.com" />
                  </div>
                  <div>
                    <label className={labelClass}>Logo</label>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-lg cursor-pointer hover:bg-[#F4F6F9] transition-colors text-sm text-muted flex-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {logo ? 'Change Logo' : 'Upload Logo'}
                        <input type="file" accept="image/*" onChange={handleLogo} className="hidden" />
                      </label>
                      {logoPreview && (
                        <div className="relative w-10 h-10 shrink-0">
                          <img src={logoPreview} alt="logo preview" className="w-10 h-10 object-contain rounded-lg border border-border" />
                          <button onClick={() => { if (logoUrlRef.current) URL.revokeObjectURL(logoUrlRef.current); logoUrlRef.current = ''; setLogo(null); setLogoPreview(''); }} className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-danger text-white rounded-full flex items-center justify-center" type="button">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Firm Contact Number</label>
                    <input name="mobile" value={form.mobile} onChange={handleField} className={inputClass} placeholder="+254 712 345 678" />
                  </div>
                  <div>
                    <label className={labelClass}>Alternative Contact Number</label>
                    <input name="alternate_number" value={form.alternate_number} onChange={handleField} className={inputClass} placeholder="+254 712 345 679" />
                  </div>

                  <div className="sm:col-span-2 border-t border-border pt-4 mt-2">
                    <h4 className="text-sm font-semibold text-foreground mb-3">Firm Address</h4>
                  </div>
                  <div>
                    <label className={labelClass}>Country <span className="text-danger">*</span></label>
                    <SearchableSelect
                      name="country"
                      value={form.country}
                      onChange={handleField}
                      options={countries.map((c) => ({ value: c, label: c }))}
                      placeholder="Select Country"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>State <span className="text-danger">*</span></label>
                  </div>
                  <div>
                    <label className={labelClass}>City <span className="text-danger">*</span></label>
                    <input name="city" value={form.city} onChange={handleField} className={inputClass} placeholder="e.g. Nairobi City" />
                  </div>
                  <div>
                    <label className={labelClass}>Zip Code <span className="text-danger">*</span></label>
                    <input name="zip_code" value={form.zip_code} onChange={handleField} className={inputClass} placeholder="e.g. 00100" />
                  </div>
                  <div>
                    <label className={labelClass}>Landmark</label>
                    <input name="landmark" value={form.landmark} onChange={handleField} className={inputClass} placeholder="e.g. Near Kenyatta Market" />
                  </div>
                  <div>
                    <label className={labelClass}>Time Zone</label>
                    <SearchableSelect
                      name="time_zone"
                      value={form.time_zone}
                      onChange={handleField}
                      options={tzOptions}
                      placeholder="Select Time Zone"
                      className={inputClass}
                      groups={{ Africa: 'Africa', America: 'America', Asia: 'Asia', Atlantic: 'Atlantic', Australia: 'Australia', Europe: 'Europe', Pacific: 'Pacific' }}
                    />
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5 animate-[fadeIn_0.3s_ease]">
                <div className="flex items-center gap-3 pb-2 border-b border-border">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Owner Account</h3>
                    <p className="text-xs text-muted">Create your admin credentials</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>First Name <span className="text-danger">*</span></label>
                    <input name="first_name" value={form.first_name} onChange={handleField} className={inputClass} placeholder="e.g. John" />
                  </div>
                  <div>
                    <label className={labelClass}>Last Name</label>
                    <input name="last_name" value={form.last_name} onChange={handleField} className={inputClass} placeholder="e.g. Doe" />
                  </div>
                  <div>
                    <label className={labelClass}>Email <span className="text-danger">*</span></label>
                    <input type="email" name="email" value={form.email} onChange={handleField} className={inputClass} placeholder="john@example.com" />
                  </div>
                  <div>
                    <label className={labelClass}>Password <span className="text-danger">*</span></label>
                    <input type="password" name="password" value={form.password} onChange={handleField} minLength={8} className={inputClass} placeholder="Min. 8 characters" />
                  </div>
                  <div>
                    <label className={labelClass}>Confirm Password <span className="text-danger">*</span></label>
                    <input type="password" name="password_confirmation" value={form.password_confirmation} onChange={handleField} className={inputClass} placeholder="Repeat password" />
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5 animate-[fadeIn_0.3s_ease]">
                <div className="flex items-center gap-3 pb-2 border-b border-border">
                  <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                    <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Review & Confirm</h3>
                    <p className="text-xs text-muted">Please verify your information before submitting</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <h4 className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Firm</h4>
                    <div className="bg-[#F4F6F9] rounded-lg p-4 space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-muted">Name</span><span className="font-medium text-foreground">{form.business_name}</span></div>
                      {form.start_date && <div className="flex justify-between"><span className="text-muted">Started</span><span className="font-medium text-foreground">{form.start_date}</span></div>}
                      <div className="flex justify-between"><span className="text-muted">Currency</span><span className="font-medium text-foreground">{currencies.find((c) => String(c.id) === form.currency_id)?.currency || form.currency_id}</span></div>
                      {form.website && <div className="flex justify-between"><span className="text-muted">Website</span><span className="font-medium text-foreground">{form.website}</span></div>}
                      {form.mobile && <div className="flex justify-between"><span className="text-muted">Contact</span><span className="font-medium text-foreground">{form.mobile}</span></div>}
                      <div className="flex justify-between"><span className="text-muted">Country</span><span className="font-medium text-foreground">{form.country}</span></div>
                      <div className="flex justify-between"><span className="text-muted">City</span><span className="font-medium text-foreground">{form.city} {form.zip_code}</span></div>
                      {form.landmark && <div className="flex justify-between"><span className="text-muted">Landmark</span><span className="font-medium text-foreground">{form.landmark}</span></div>}
                      <div className="flex justify-between"><span className="text-muted">Time Zone</span><span className="font-medium text-foreground">{form.time_zone.replace(/_/g, ' ')}</span></div>
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <h4 className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Owner</h4>
                    <div className="bg-[#F4F6F9] rounded-lg p-4 space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-muted">Name</span><span className="font-medium text-foreground">{form.first_name} {form.last_name}</span></div>
                      <div className="flex justify-between"><span className="text-muted">Email</span><span className="font-medium text-foreground">{form.email}</span></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <div>
                {step > 1 ? (
                  <button type="button" onClick={prevStep} className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-muted hover:text-foreground transition-colors rounded-lg hover:bg-gray-100">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                  </button>
                ) : (
                  <div />
                )}
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-muted hidden sm:block">Step {step} of 3</span>
                {step < 3 ? (
                  <button type="button" onClick={nextStep} className="flex items-center gap-1.5 px-5 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm font-medium shadow-sm shadow-primary/20">
                    Continue
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ) : (
                  <button type="submit" disabled={loading} className="flex items-center gap-1.5 px-5 py-2.5 bg-success text-white rounded-lg hover:bg-[#3D6B42] transition-colors text-sm font-medium disabled:opacity-50 shadow-sm shadow-success/20">
                    {loading ? (
                      <>
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Registering...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Complete Registration
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>

        <p className="text-center text-sm text-muted mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-primary font-medium hover:underline">Sign In</Link>
        </p>
      </div>
    </div>
  );
}
