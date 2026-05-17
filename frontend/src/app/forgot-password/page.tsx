'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/forgot-password', { email });
      setSent(true);
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Failed to send reset link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary">Firmly</h1>
          <p className="text-muted mt-2">Reset your password</p>
        </div>

        <div className="bg-card-bg rounded-xl shadow-lg p-6 sm:p-8 border border-border">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 bg-success/10 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-7 h-7 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-foreground">Check your email</h2>
              <p className="text-sm text-muted">
                We&apos;ve sent a password reset link to <strong className="text-foreground">{email}</strong>. Please check your inbox and follow the instructions.
              </p>
              <p className="text-xs text-muted">Didn&apos;t receive the email?{' '}
                <button onClick={() => { setSent(false); setLoading(false); }} className="text-primary hover:underline">Try again</button>
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-red-50 text-danger text-sm px-4 py-3 rounded-lg">{error}</div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-sm"
                  placeholder="Enter your email"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors font-medium text-sm disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>

              <p className="text-center text-sm text-muted">
                Remember your password?{' '}
                <Link href="/login" className="text-primary hover:underline">Sign In</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
