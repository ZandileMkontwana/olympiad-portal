'use client';

// Self-service student password reset — the student enters their email and
// receives a reset link. Mirrors the set-password page layout.

import { useState } from 'react';
import Link from 'next/link';
import { requestStudentPasswordReset } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | submitting | sent | error
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage('');

    if (!email.trim()) {
      setStatus('error');
      setErrorMessage('Please enter your email address.');
      return;
    }

    setStatus('submitting');
    try {
      await requestStudentPasswordReset({ email: email.trim() });
      setStatus('sent');
    } catch (err) {
      setStatus('error');
      setErrorMessage(err.message || 'Could not process your request. Please try again.');
    }
  }

  return (
    <main id="main-content" tabIndex={-1} className="relative mx-auto max-w-md px-8 py-24">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-ink text-center">
        Reset your password
      </h1>
      <div className="mx-auto mt-3 h-px w-12 bg-lavender" aria-hidden="true" />
      <p className="mt-4 text-center text-base text-ink-soft">
        Enter the email address you use to sign in. If your account is registered, we&apos;ll send
        you a link to choose a new password.
      </p>

      {status === 'sent' ? (
        <div className="mt-8 space-y-4">
          <div
            role="status"
            className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800"
          >
            <strong>Check your email</strong>
            <p className="mt-1">
              If that email is registered, a reset link is on its way. The link expires in 48 hours.
            </p>
          </div>
          <p className="text-center text-sm text-ink-soft">
            <Link href="/login" className="text-lavender-deep hover:underline">
              Back to sign in
            </Link>
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
          <div>
            <label htmlFor="reset-email" className="block text-sm font-medium text-ink">
              Email address
            </label>
            <input
              id="reset-email"
              type="email"
              autoComplete="email"
              placeholder="you@school.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 block w-full rounded-md border border-lavender/30 bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-lavender/50"
              required
              disabled={status === 'submitting'}
            />
          </div>

          {status === 'error' && (
            <div
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={status === 'submitting'}
            className="w-full rounded-md bg-lavender-deep px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === 'submitting' ? 'Sending…' : 'Send reset link'}
          </button>

          <p className="text-center text-sm text-ink-soft">
            Remember your password?{' '}
            <Link href="/login" className="text-lavender-deep hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      )}
    </main>
  );
}
