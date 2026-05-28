'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useFormatDate } from '@/lib/date';
import { api } from '@/lib/api';
import { useCurrency } from '@/lib/use-currency';

interface ClientCase {
  id: number;
  case_number: string;
  our_reference: string | null;
  client_reference: string | null;
  title: string;
  status: string;
  filed_date: string | null;
  created_at: string;
}

const statusColors: Record<string, string> = {
  'Open': 'bg-blue-50 text-blue-700',
  'In Progress': 'bg-yellow-50 text-yellow-700',
  'Closed': 'bg-gray-100 text-gray-600',
  'On Hold': 'bg-orange-50 text-orange-700',
};

interface Client {
  id: number;
  client_type: string;
  client_id: string;
  prefix: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  business_name: string | null;
  email: string | null;
  phone: string | null;
  alternative_contact: string | null;
  tax_number: string | null;
  opening_balance: number;
  address: string | null;
  street: string | null;
  building: string | null;
  city: string | null;
  country: string | null;
  zip_code: string | null;
  is_active: boolean;
}

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted font-medium uppercase tracking-wider">{label}</p>
      <p className="text-sm mt-0.5">{value || '-'}</p>
    </div>
  );
}

export default function ClientDetailPage() {
  const { token } = useAuth();
  const { formatMoney } = useCurrency();
  const formatDate = useFormatDate();
  const params = useParams();
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [cases, setCases] = useState<ClientCase[]>([]);
  const [casesLoading, setCasesLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'cases' | 'invoices' | 'payments'>('cases');

  useEffect(() => {
    if (!token) return;
    api.get<{ client: Client }>(`/clients/${params.id}`, token)
      .then((res) => { setClient(res.client); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token, params.id]);

  useEffect(() => {
    if (!token || !params.id || tab !== 'cases') return;
    setCasesLoading(true);
    api.get<{ cases: ClientCase[] }>(`/cases?client_id=${params.id}`, token)
      .then((res) => setCases(res.cases))
      .catch(() => {})
      .finally(() => setCasesLoading(false));
  }, [token, params.id, tab]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full" />
          <p className="text-sm text-muted">Loading client details...</p>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-16 text-muted">
        <p className="text-lg font-medium">Client not found</p>
        <Link href="/dashboard/clients" className="text-primary text-sm mt-2 inline-block hover:underline">Back to Clients</Link>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-bold">
            {client.client_type === 'business' ? client.business_name : `${client.prefix ? client.prefix + ' ' : ''}${client.first_name} ${client.middle_name} ${client.last_name}`}
          </h1>
          <p className="text-sm text-muted">Client Details · {client.client_id}</p>
        </div>
      </div>

      <div className="bg-card-bg rounded-xl border border-border p-6">
        {client.client_type === 'individual' ? (
          <div className="flex items-center gap-4 pb-4 border-b border-border mb-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-xl font-bold text-primary">
                {(client.first_name?.[0] || '') + (client.last_name?.[0] || '')}
              </span>
            </div>
            <div>
              <h3 className="text-lg font-semibold">
                {client.prefix ? client.prefix + ' ' : ''}
                {client.first_name} {client.middle_name} {client.last_name}
              </h3>
              <p className="text-sm text-muted">Individual Client</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4 pb-4 border-b border-border mb-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-xl font-bold text-primary">{(client.business_name?.[0] || 'B')}</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold">{client.business_name}</h3>
              <p className="text-sm text-muted">Business Client</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <DetailField label="Email" value={client.email} />
          <DetailField label="Phone" value={client.phone} />
          <DetailField label="Alternative Contact" value={client.alternative_contact} />
          <DetailField label="Tax Number" value={client.tax_number} />
          <DetailField label="Opening Balance" value={formatMoney(client.opening_balance || 0)} />
          <DetailField label="Status" value={client.is_active ? 'Active' : 'Inactive'} />
        </div>

        <div className="border-t border-border pt-4">
          <h4 className="text-sm font-semibold mb-3">Address</h4>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <DetailField label="Address" value={client.address} />
            <DetailField label="Country" value={client.country} />
            <DetailField label="City" value={client.city} />
            <DetailField label="Street" value={client.street} />
            <DetailField label="Building" value={client.building} />
            <DetailField label="Zip Code" value={client.zip_code} />
          </div>
        </div>
      </div>

      <div className="bg-card-bg rounded-xl border border-border p-6 mt-4">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {(['cases', 'invoices', 'payments'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg capitalize transition-colors ${
                tab === t ? 'bg-white text-foreground shadow-sm' : 'text-muted hover:text-foreground'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {tab === 'cases' && (
            casesLoading ? (
              <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 border-[3px] border-primary border-t-transparent rounded-full" /></div>
            ) : cases.length === 0 ? (
              <div className="text-center py-8 text-muted">
                <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm font-medium">No cases yet</p>
                <p className="text-xs mt-1">Client cases will appear here once created.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-gray-50">
                      <th className="text-left px-4 py-2.5 font-medium text-muted text-xs uppercase tracking-wider">Our Reference</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted text-xs uppercase tracking-wider">Client Ref</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted text-xs uppercase tracking-wider">Subject</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted text-xs uppercase tracking-wider">Status</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted text-xs uppercase tracking-wider hidden sm:table-cell">Filed Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cases.map((c) => (
                      <tr key={c.id} className="border-b border-border last:border-0 hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/dashboard/cases/${c.id}`)}>
                        <td className="px-4 py-2.5 text-xs font-mono text-muted">{c.our_reference || c.case_number}</td>
                        <td className="px-4 py-2.5 text-xs text-muted">{c.client_reference || '-'}</td>
                        <td className="px-4 py-2.5">{c.title}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[c.status] || ''}`}>{c.status}</span>
                        </td>
                        <td className="px-4 py-2.5 text-muted hidden sm:table-cell">{formatDate(c.filed_date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-4 py-2 text-xs text-muted border-t border-border bg-gray-50/50">
                  {cases.length} case{cases.length !== 1 ? 's' : ''}
                </div>
              </div>
            )
          )}
          {tab === 'invoices' && (
            <div className="text-center py-8 text-muted">
              <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              <p className="text-sm font-medium">No invoices yet</p>
              <p className="text-xs mt-1">Client invoices will appear here once created.</p>
            </div>
          )}
          {tab === 'payments' && (
            <div className="text-center py-8 text-muted">
              <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-medium">No payments yet</p>
              <p className="text-xs mt-1">Client payments will appear here once recorded.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
