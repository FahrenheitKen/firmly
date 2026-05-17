'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import PageHeader from '@/components/ui/page-header';

interface EmailAccount {
  provider: string;
  email_address: string;
  last_synced_at: string | null;
  sync_enabled: boolean;
}

interface ProviderOAuthSetting {
  client_id: string | null;
  redirect_uri: string | null;
  configured: boolean;
}

const providers = [
  {
    key: 'gmail',
    name: 'Gmail / G Suite',
    description: 'Connect Gmail or Google Workspace',
    bgClass: 'bg-red-50',
    dotClass: 'bg-[#EA4335]',
    docsUrl: 'https://console.cloud.google.com/apis/credentials',
    docsLabel: 'Google Cloud Console',
  },
  {
    key: 'outlook',
    name: 'Microsoft Outlook',
    description: 'Connect Outlook or Microsoft 365',
    bgClass: 'bg-blue-50',
    dotClass: 'bg-[#0078D4]',
    docsUrl: 'https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps',
    docsLabel: 'Azure App Registrations',
  },
  {
    key: 'zoho',
    name: 'Zoho Mail',
    description: 'Connect Zoho Mail',
    bgClass: 'bg-orange-50',
    dotClass: 'bg-[#E42527]',
    docsUrl: 'https://api-console.zoho.com/',
    docsLabel: 'Zoho API Console',
  },
];

function providerLabel(key: string) {
  return providers.find((p) => p.key === key.toLowerCase())?.name || key;
}
function providerDotClass(key: string) {
  return providers.find((p) => p.key === key.toLowerCase())?.dotClass || 'bg-gray-400';
}
function providerBadgeClass(key: string) {
  if (key === 'gmail') return 'bg-red-50 text-red-700';
  if (key === 'outlook') return 'bg-blue-50 text-blue-700';
  if (key === 'zoho') return 'bg-orange-50 text-orange-700';
  return 'bg-gray-100 text-gray-600';
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? 's' : ''} ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const apiBase = (process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:8000');
function defaultRedirectUri(providerKey: string) {
  return `${apiBase}/api/email-accounts/oauth/${providerKey}/callback`;
}

export default function EmailSettingsPage() {
  const { token, user } = useAuth();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  const [account, setAccount] = useState<EmailAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);

  // OAuth credentials state
  const [oauthSettings, setOauthSettings] = useState<Record<string, ProviderOAuthSetting>>({});
  const [oauthLoading, setOauthLoading] = useState(true);
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [form, setForm] = useState({ client_id: '', client_secret: '', redirect_uri: '' });
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState<string | null>(null);

  useEffect(() => {
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    if (connected === '1') toast('Email account connected successfully', 'success');
    if (error === 'auth_failed') {
      const detail = searchParams.get('detail');
      toast(detail ? `Authentication failed: ${detail}` : 'Email authentication failed. Please try again.', 'error');
    }
  }, [searchParams, toast]);

  const fetchAccount = () => {
    if (!token) return;
    setLoading(true);
    api.get<{ data: EmailAccount | null }>('/email-account', token)
      .then((res) => setAccount(res.data))
      .catch(() => setAccount(null))
      .finally(() => setLoading(false));
  };

  const fetchOAuthSettings = () => {
    if (!token) return;
    setOauthLoading(true);
    api.get<{ data: Record<string, ProviderOAuthSetting> }>('/email-accounts/oauth-settings', token)
      .then((res) => setOauthSettings(res.data))
      .catch(() => {})
      .finally(() => setOauthLoading(false));
  };

  useEffect(() => {
    fetchAccount();
    fetchOAuthSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.active_location?.id]);

  const handleSyncNow = async () => {
    if (!token) return;
    setSyncing(true);
    try {
      await api.post('/email-account/sync', {}, token);
      toast('Sync started successfully', 'success');
      fetchAccount();
    } catch {
      toast('Failed to sync emails', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect your email account? Synced emails will remain on your cases.')) return;
    if (!token) return;
    setDisconnecting(true);
    try {
      await api.delete('/email-account', token);
      setAccount(null);
      toast('Email account disconnected', 'success');
    } catch {
      toast('Failed to disconnect account', 'error');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleConnectProvider = async (providerKey: string) => {
    if (!token) return;
    setConnecting(providerKey);
    try {
      const res = await api.get<{ url: string }>(`/email-accounts/oauth/${providerKey}`, token);
      window.location.href = res.url;
    } catch {
      toast('Failed to initiate connection. Please try again.', 'error');
      setConnecting(null);
    }
  };

  const openCredentialForm = (providerKey: string) => {
    if (expandedProvider === providerKey) {
      setExpandedProvider(null);
      return;
    }
    const existing = oauthSettings[providerKey];
    setForm({
      client_id: existing?.client_id || '',
      client_secret: '',
      redirect_uri: existing?.redirect_uri || defaultRedirectUri(providerKey),
    });
    setExpandedProvider(providerKey);
  };

  const handleSaveCredentials = async () => {
    if (!token || !expandedProvider) return;
    const isNew = !oauthSettings[expandedProvider]?.configured;
    if (!form.client_id || (isNew && !form.client_secret) || !form.redirect_uri) {
      toast(isNew ? 'All fields are required' : 'Client ID and Redirect URI are required', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.put(`/email-accounts/oauth-settings/${expandedProvider}`, form, token);
      toast(`${providerLabel(expandedProvider)} credentials saved`, 'success');
      setExpandedProvider(null);
      fetchOAuthSettings();
    } catch {
      toast('Failed to save credentials', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleClearCredentials = async (providerKey: string) => {
    if (!token) return;
    if (!confirm(`Remove custom credentials for ${providerLabel(providerKey)}? It will revert to the platform default.`)) return;
    setClearing(providerKey);
    try {
      await api.delete(`/email-accounts/oauth-settings/${providerKey}`, token);
      toast('Credentials removed', 'success');
      fetchOAuthSettings();
    } catch {
      toast('Failed to remove credentials', 'error');
    } finally {
      setClearing(null);
    }
  };

  return (
    <>
      <PageHeader title="Email Settings" description="Connect your email for automatic sync to cases" />

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : account ? (
        <div className="max-w-2xl">
          <div className="bg-card-bg rounded-xl border border-border p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${providerBadgeClass(account.provider).split(' ')[0]}`}>
                  <div className={`w-4 h-4 rounded-sm ${providerDotClass(account.provider)}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{account.email_address}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${providerBadgeClass(account.provider)}`}>
                      {providerLabel(account.provider)}
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    Last synced: {formatRelativeTime(account.last_synced_at)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleSyncNow}
                  disabled={syncing}
                  className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-xl hover:bg-primary-dark disabled:opacity-50 transition-colors"
                >
                  {syncing ? 'Syncing...' : 'Sync Now'}
                </button>
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="px-4 py-2 text-sm font-medium text-danger border border-danger/20 rounded-xl hover:bg-danger/5 disabled:opacity-50 transition-colors"
                >
                  {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                </button>
              </div>
            </div>
            <div className="pt-3 border-t border-border flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${account.sync_enabled ? 'bg-emerald-500' : 'bg-gray-300'}`} />
              <p className="text-xs text-muted">
                Automatic sync is {account.sync_enabled ? 'enabled' : 'disabled'}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-3xl">
          <p className="text-sm text-muted mb-5">
            Choose an email provider to connect. Emails from connected accounts will be automatically synced to your cases.
          </p>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6">
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-3">How to connect</p>
            <ol className="space-y-2.5">
              {[
                {
                  text: 'Set up your OAuth app credentials.',
                  note: 'If your organisation uses its own OAuth app, scroll down to the OAuth App Credentials section and configure your Client ID and Client Secret before connecting. Skip this step if using the platform default.',
                },
                {
                  text: 'Click the Connect button for your email provider below.',
                  note: null,
                },
                {
                  text: "Sign in on your provider's page.",
                  note: "You'll be redirected to Google, Microsoft, or Zoho. Log in with the email address you want to sync to your cases.",
                },
                {
                  text: 'Grant read access when prompted.',
                  note: 'Firmly only requests read permission — it cannot send, delete, or modify your emails.',
                },
                {
                  text: "You'll be returned here automatically once connected.",
                  note: 'Emails will begin syncing and matching to your cases shortly after.',
                },
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-blue-200 text-blue-700 font-semibold flex items-center justify-center text-[10px] mt-0.5">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-xs text-blue-800 font-medium">{step.text}</p>
                    {step.note && <p className="text-xs text-blue-700/70 mt-0.5">{step.note}</p>}
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-3 pt-3 border-t border-blue-100 flex flex-col gap-1">
              <p className="text-xs text-blue-600">Only one email account can be connected at a time. Disconnect at any point to switch to a different account.</p>
              <p className="text-xs text-blue-600">Having trouble? Check that your OAuth app credentials are saved correctly in the section below.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {providers.map((provider) => (
              <div key={provider.key} className="bg-card-bg rounded-xl border border-border p-5 flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${provider.bgClass}`}>
                    <div className={`w-4 h-4 rounded-sm ${provider.dotClass}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{provider.name}</p>
                  </div>
                </div>
                <p className="text-xs text-muted">{provider.description}</p>
                <button
                  onClick={() => handleConnectProvider(provider.key)}
                  disabled={connecting === provider.key}
                  className="px-4 py-2 text-sm font-medium border border-border rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  {connecting === provider.key ? 'Connecting...' : 'Connect'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── OAuth App Credentials ─────────────────────────────────── */}
      <div className="max-w-3xl mt-10">
        <div className="mb-4">
          <p className="text-sm font-semibold">OAuth App Credentials</p>
          <p className="text-xs text-muted mt-0.5">
            Configure your own OAuth app credentials for each provider. When set, your business uses these instead of the platform defaults — giving you full control over the consent screen and API quotas.
          </p>
        </div>

        {oauthLoading ? (
          <div className="flex items-center gap-2 py-4">
            <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
            <span className="text-xs text-muted">Loading…</span>
          </div>
        ) : (
          <div className="space-y-3">
            {providers.map((provider) => {
              const setting = oauthSettings[provider.key];
              const isOpen = expandedProvider === provider.key;

              return (
                <div key={provider.key} className="bg-card-bg rounded-xl border border-border overflow-hidden">
                  {/* Row header */}
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${provider.bgClass}`}>
                        <div className={`w-3 h-3 rounded-sm ${provider.dotClass}`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{provider.name}</p>
                        <p className="text-xs text-muted mt-0.5">
                          {setting?.configured
                            ? `Custom app · Client ID: ${setting.client_id}`
                            : 'Using platform default'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {setting?.configured && (
                        <button
                          onClick={() => handleClearCredentials(provider.key)}
                          disabled={clearing === provider.key}
                          className="text-xs text-danger hover:underline disabled:opacity-50"
                        >
                          {clearing === provider.key ? 'Removing…' : 'Remove'}
                        </button>
                      )}
                      <button
                        onClick={() => openCredentialForm(provider.key)}
                        className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        {isOpen ? 'Cancel' : setting?.configured ? 'Edit' : 'Configure'}
                      </button>
                    </div>
                  </div>

                  {/* Expandable form */}
                  {isOpen && (
                    <div className="border-t border-border px-4 pb-4 pt-3 space-y-3 bg-gray-50/50">
                      <p className="text-xs text-muted">
                        Register a <strong>Server-based Application</strong> at{' '}
                        <a href={provider.docsUrl} target="_blank" rel="noreferrer" className="text-primary underline">
                          {provider.docsLabel}
                        </a>{' '}
                        and paste the credentials below.
                      </p>

                      <div className="space-y-2">
                        <label className="block">
                          <span className="text-xs font-medium text-gray-700">Client ID</span>
                          <input
                            type="text"
                            value={form.client_id}
                            onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}
                            placeholder="Paste your client ID"
                            className="mt-1 w-full text-xs px-3 py-2 border border-border rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </label>

                        <label className="block">
                          <span className="text-xs font-medium text-gray-700">Client Secret</span>
                          <input
                            type="password"
                            value={form.client_secret}
                            onChange={(e) => setForm((f) => ({ ...f, client_secret: e.target.value }))}
                            placeholder={setting?.configured ? '••••••••  (leave blank to keep existing)' : 'Paste your client secret'}
                            className="mt-1 w-full text-xs px-3 py-2 border border-border rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </label>

                        <label className="block">
                          <span className="text-xs font-medium text-gray-700">Redirect URI</span>
                          <p className="text-[11px] text-muted mb-1">Copy this exactly into your OAuth app&apos;s allowed redirect URIs.</p>
                          <input
                            type="text"
                            value={form.redirect_uri}
                            onChange={(e) => setForm((f) => ({ ...f, redirect_uri: e.target.value }))}
                            className="w-full text-xs px-3 py-2 border border-border rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                          />
                        </label>
                      </div>

                      <div className="flex justify-end pt-1">
                        <button
                          onClick={handleSaveCredentials}
                          disabled={saving}
                          className="px-4 py-2 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors"
                        >
                          {saving ? 'Saving…' : 'Save Credentials'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
