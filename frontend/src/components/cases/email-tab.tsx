'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast-context';

interface EmailAccount {
  provider: string;
}

interface CaseEmail {
  id: number;
  message_id: string;
  thread_id: string | null;
  direction: 'inbound' | 'outbound';
  from_address: string;
  to_addresses: string[];
  cc_addresses: string[];
  subject: string;
  snippet: string;
  has_attachments: boolean;
  attachment_names: string[];
  sent_at: string;
  provider_url: string | null;
  email_account: EmailAccount | null;
}

interface ThreadMessage {
  message_id: string;
  from_address: string;
  to_addresses: string[];
  subject: string | null;
  sent_at: string | null;
  html: string | null;
  text: string | null;
}

interface EmailBody {
  html: string | null;
  text: string | null;
  thread: ThreadMessage[];
}

interface Props {
  caseId: number | string;
  token: string;
}

function formatEmailDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max) + '…';
}

function providerBadgeClass(provider?: string): string {
  const key = (provider ?? '').toLowerCase();
  if (key === 'gmail') return 'bg-red-50 text-red-600';
  if (key === 'outlook') return 'bg-blue-50 text-blue-600';
  if (key === 'zoho') return 'bg-orange-50 text-orange-600';
  return 'bg-gray-100 text-gray-600';
}

function providerLabel(provider?: string): string {
  const key = (provider ?? '').toLowerCase();
  if (key === 'gmail') return 'Gmail';
  if (key === 'outlook') return 'Outlook';
  if (key === 'zoho') return 'Zoho';
  return provider ?? 'Email';
}

// ── Email Detail Slide-Over ─────────────────────────────────────────────────

interface EmailDrawerProps {
  email: CaseEmail;
  token: string;
  onClose: () => void;
}

function EmailDrawer({ email, token, onClose }: EmailDrawerProps) {
  const [body, setBody] = useState<EmailBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedThread, setExpandedThread] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setBody(null);
    api.get<{ data: EmailBody }>(`/emails/${email.id}/body`, token)
      .then((res) => setBody(res.data))
      .catch(() => setError('Could not load email content. The email may have expired or your session token may need refreshing.'))
      .finally(() => setLoading(false));
  }, [email.id, token]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const mainHtml = body?.html ?? null;
  const thread = body?.thread ?? [];
  // Exclude the current message — it's already shown as the main body
  const otherThreadMessages = thread.filter((m) => m.message_id !== email.message_id);
  // Whether this email is part of a thread that hasn't fully synced yet
  const hasUnloadedThread = !loading && !error && email.thread_id && otherThreadMessages.length === 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl flex flex-col bg-background shadow-2xl border-l border-border">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold truncate">{email.subject || '(No subject)'}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${providerBadgeClass(email.email_account?.provider)}`}>
                {providerLabel(email.email_account?.provider)}
              </span>
              <span className="text-xs text-muted">{email.direction === 'inbound' ? 'From' : 'To'}:</span>
              <span className="text-xs font-medium">
                {email.direction === 'inbound' ? email.from_address : (email.to_addresses?.[0] ?? '')}
              </span>
              <span className="text-xs text-muted">{formatDateTime(email.sent_at)}</span>
            </div>
            {email.to_addresses?.length > 0 && email.direction === 'inbound' && (
              <p className="text-xs text-muted mt-0.5">To: {email.to_addresses.join(', ')}</p>
            )}
            {email.cc_addresses?.length > 0 && (
              <p className="text-xs text-muted mt-0.5">Cc: {email.cc_addresses.join(', ')}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {email.provider_url && (
              <a
                href={email.provider_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-muted border border-border rounded-lg hover:bg-gray-50 transition-colors"
                title="Open in provider"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open
              </a>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-muted hover:text-foreground hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex justify-center py-12">
              <div className="animate-spin w-6 h-6 border-[3px] border-primary border-t-transparent rounded-full" />
            </div>
          )}

          {error && (
            <div className="mx-5 mt-5 p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          {!loading && !error && (
            <>
              {/* Main email body */}
              <div className="px-5 py-4">
                {mainHtml ? (
                  <iframe
                    ref={iframeRef}
                    srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;line-height:1.6;color:#1a1a1a;margin:0;padding:0;word-break:break-word;}img{max-width:100%;height:auto;}a{color:#2563eb;}blockquote{border-left:3px solid #e5e7eb;margin:0;padding-left:1rem;color:#6b7280;}</style></head><body>${mainHtml}</body></html>`}
                    sandbox="allow-same-origin"
                    className="w-full border-0 min-h-[300px]"
                    style={{ height: 'auto' }}
                    onLoad={(e) => {
                      const iframe = e.currentTarget;
                      try {
                        const h = iframe.contentDocument?.documentElement?.scrollHeight;
                        if (h) iframe.style.height = h + 'px';
                      } catch {}
                    }}
                    title="Email body"
                  />
                ) : (
                  <p className="text-sm text-muted whitespace-pre-wrap">
                    {body?.text || '(No content)'}
                  </p>
                )}
              </div>

              {/* Thread — missing sent messages hint */}
              {hasUnloadedThread && (
                <div className="mx-5 mb-4 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2">
                  <svg className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-amber-700">
                    This is part of a conversation. To see the full thread, reconnect your Zoho account in{' '}
                    <a href="/dashboard/settings/email" className="font-medium underline">Email Settings</a>{' '}
                    so the Sent folder can also be synced.
                  </p>
                </div>
              )}

              {/* Thread */}
              {otherThreadMessages.length > 0 && (
                <div className="border-t border-border mx-5 mb-5">
                  <p className="text-xs font-medium text-muted pt-4 pb-2">
                    Thread — {otherThreadMessages.length} other message{otherThreadMessages.length !== 1 ? 's' : ''}
                  </p>
                  <div className="space-y-2">
                    {otherThreadMessages.map((msg) => {
                      const isOpen = expandedThread === msg.message_id;
                      return (
                        <div key={msg.message_id} className="border border-border rounded-lg overflow-hidden">
                          <button
                            className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                            onClick={() => setExpandedThread(isOpen ? null : msg.message_id)}
                          >
                            <svg
                              className={`w-4 h-4 text-muted mt-0.5 shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                              fill="none" stroke="currentColor" viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium truncate">{msg.from_address}</span>
                                {msg.sent_at && (
                                  <span className="text-xs text-muted shrink-0 ml-auto">{formatDateTime(msg.sent_at)}</span>
                                )}
                              </div>
                              {!isOpen && msg.text && (
                                <p className="text-xs text-muted mt-0.5 truncate">{truncate(msg.text, 100)}</p>
                              )}
                            </div>
                          </button>
                          {isOpen && (
                            <div className="px-4 pb-4 border-t border-border bg-gray-50/40">
                              {msg.html ? (
                                <iframe
                                  srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;line-height:1.6;color:#1a1a1a;margin:0;padding:12px 0;word-break:break-word;}img{max-width:100%;height:auto;}a{color:#2563eb;}blockquote{border-left:3px solid #e5e7eb;margin:0;padding-left:1rem;color:#6b7280;}</style></head><body>${msg.html}</body></html>`}
                                  sandbox="allow-same-origin"
                                  className="w-full border-0 min-h-[120px]"
                                  style={{ height: 'auto' }}
                                  onLoad={(e) => {
                                    const iframe = e.currentTarget;
                                    try {
                                      const h = iframe.contentDocument?.documentElement?.scrollHeight;
                                      if (h) iframe.style.height = h + 'px';
                                    } catch {}
                                  }}
                                  title={`Thread message from ${msg.from_address}`}
                                />
                              ) : (
                                <p className="text-sm text-muted whitespace-pre-wrap pt-3">{msg.text || '(No content)'}</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ── Main EmailTab ────────────────────────────────────────────────────────────

export default function EmailTab({ caseId, token }: Props) {
  const { toast } = useToast();
  const [emails, setEmails] = useState<CaseEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [noAccount, setNoAccount] = useState(false);
  const [openEmail, setOpenEmail] = useState<CaseEmail | null>(null);

  const fetchEmails = useCallback(() => {
    setLoading(true);
    api.get<{ data: CaseEmail[] }>(`/cases/${caseId}/emails`, token)
      .then((res) => {
        setEmails(res.data ?? []);
        setNoAccount(false);
      })
      .catch((err: { status?: number }) => {
        if (err?.status === 401) setNoAccount(true);
        setEmails([]);
      })
      .finally(() => setLoading(false));
  }, [caseId, token]);

  useEffect(() => { fetchEmails(); }, [fetchEmails]);

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      await api.post(`/cases/${caseId}/emails/sync`, {}, token);
      toast('Sync started successfully', 'success');
      fetchEmails();
    } catch {
      toast('Failed to sync emails', 'error');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="animate-spin w-6 h-6 border-[3px] border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (noAccount) {
    return (
      <div className="rounded-xl border border-border bg-blue-50/50 p-5 flex items-start gap-3">
        <svg className="w-5 h-5 text-primary mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="text-sm font-medium text-foreground">No email account connected</p>
          <p className="text-xs text-muted mt-0.5">
            Connect your email account in{' '}
            <Link href="/dashboard/settings/email" className="text-primary hover:underline font-medium">
              Email Settings
            </Link>{' '}
            to sync emails to this case.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-medium text-muted">
            {emails.length} email{emails.length !== 1 ? 's' : ''}
          </p>
          <button
            onClick={handleSyncNow}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors"
          >
            {syncing ? (
              <>
                <div className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
                Syncing...
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync Now
              </>
            )}
          </button>
        </div>

        {emails.length === 0 ? (
          <div className="text-center py-10 text-muted">
            <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <p className="text-sm font-medium">No emails synced yet</p>
            <p className="text-xs mt-1">
              Connect your email in{' '}
              <Link href="/dashboard/settings/email" className="text-primary hover:underline">
                Email Settings
              </Link>{' '}
              to start syncing.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {emails.map((email) => (
              <button
                key={email.id}
                onClick={() => setOpenEmail(email)}
                className="w-full flex items-start gap-3 py-3 group hover:bg-gray-50/50 rounded-lg px-1 -mx-1 transition-colors text-left"
              >
                <div className="flex-shrink-0 mt-0.5">
                  {email.direction === 'inbound' ? (
                    <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${providerBadgeClass(email.email_account?.provider)}`}>
                      {providerLabel(email.email_account?.provider)}
                    </span>
                    <span className="text-xs text-muted truncate max-w-[160px]">{email.from_address}</span>
                    {email.has_attachments && (
                      <svg className="w-3.5 h-3.5 text-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                    )}
                    {email.thread_id && (
                      <svg className="w-3 h-3 text-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    )}
                  </div>
                  <p className="text-sm font-medium mt-0.5 truncate">{truncate(email.subject || '(No subject)', 60)}</p>
                  {email.snippet && (
                    <p className="text-xs text-muted mt-0.5 truncate">{email.snippet}</p>
                  )}
                </div>
                <div className="flex-shrink-0 text-xs text-muted whitespace-nowrap mt-0.5">
                  {formatEmailDate(email.sent_at)}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Email detail drawer */}
      {openEmail && (
        <EmailDrawer
          email={openEmail}
          token={token}
          onClose={() => setOpenEmail(null)}
        />
      )}
    </>
  );
}
