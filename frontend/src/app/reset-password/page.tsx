'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [token] = useState(() => searchParams.get('token') || '');
  const [email] = useState(() => searchParams.get('email') || '');

  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== passwordConfirmation) { setError('Passwords do not match'); return; }
    setError('');
    setLoading(true);
    try {
      await api.post('/reset-password', { token, email, password, password_confirmation: passwordConfirmation });
      setSuccess(true);
      setTimeout(() => router.push('/login'), 3000);
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  if (!token || !email) {
    return (
      <div className="text-center space-y-4">
        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-7 h-7 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-foreground">Invalid Reset Link</h2>
        <p className="text-sm text-muted">This password reset link is invalid or has expired.</p>
        <Link href="/forgot-password" className="text-primary hover:underline text-sm">Request a new reset link</Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="text-center space-y-4">
        <div className="w-14 h-14 bg-success/10 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-7 h-7 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-foreground">Password Reset!</h2>
        <p className="text-sm text-muted">Your password has been reset successfully. Redirecting you to sign in...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="bg-red-50 text-danger text-sm px-4 py-3 rounded-lg">{error}</div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1.5">Email</label>
        <input
          type="email"
          value={email}
          disabled
          className="w-full px-3 py-2.5 border border-border rounded-lg bg-[#F4F6F9] text-sm text-muted"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">New Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          className="w-full px-3 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-sm"
          placeholder="Min. 8 characters"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Confirm Password</label>
        <input
          type="password"
          value={passwordConfirmation}
          onChange={(e) => setPasswordConfirmation(e.target.value)}
          required
          className="w-full px-3 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-sm"
          placeholder="Repeat password"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors font-medium text-sm disabled:opacity-50"
      >
        {loading ? 'Resetting...' : 'Reset Password'}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary">Firmly</h1>
          <p className="text-muted mt-2">Set a new password</p>
        </div>

        <div className="bg-card-bg rounded-xl shadow-lg p-6 sm:p-8 border border-border">
          <Suspense fallback={<div className="text-center text-muted text-sm py-8">Loading...</div>}>
            <ResetPasswordForm />
          </Suspense>
        </div>

        <p className="text-center text-sm text-muted mt-6">
          <Link href="/login" className="text-primary hover:underline">Back to Sign In</Link>
        </p>
      </div>
    </div>
  );
}
