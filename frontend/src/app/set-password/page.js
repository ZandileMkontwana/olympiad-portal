'use client';

// Student account activation — opened from the invitation email link
// (/set-password?token=…). Sets the student's password and signs them in.

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { setStudentPassword } from '@/lib/api';
import { setStudentSession } from '@/lib/studentSession';

function Watermark() {
  return (
    <img
      src="/tree-mark.png"
      alt=""
      aria-hidden="true"
      className="watermark pointer-events-none absolute left-1/2 top-1/2 w-[700px] max-w-none -translate-x-1/2 -translate-y-1/2 object-contain"
    />
  );
}

function SetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState('idle'); // idle | submitting | error
  const [errorMessage, setErrorMessage] = useState('');

  // Missing token = bad link; derived at render time (no effect needed) —
  // show the error up front instead of a form that can never succeed.
  const missingToken = !token;
  const showFormError = status === 'error' || missingToken;
  const formError =
    status === 'error'
      ? errorMessage
      : 'This invitation link is missing its token. Ask your educator to send a new one.';

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage('');

    if (password.length < 8) {
      setStatus('error');
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirm) {
      setStatus('error');
      setErrorMessage('Passwords do not match.');
      return;
    }

    setStatus('submitting');
    try {
      const data = await setStudentPassword({ token, password });
      setStudentSession({ token: data.token, user: data.user });
      router.push('/student');
    } catch (err) {
      setStatus('error');
      setErrorMessage(err.message || 'Could not set your password. Please try again.');
    }
  }

  return (
    <div className="relative">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-ink text-center">
        Set your password
      </h1>
      <div className="mx-auto mt-3 h-px w-12 bg-lavender" aria-hidden="true" />
      <p className="mt-4 text-center text-base text-ink-soft">
        Your educator registered you for the Olympiad Portal. Choose a password to activate your
        account — you&apos;ll use it with your student email to sign in.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
        <div>
          <label htmlFor="new-password" className="block text-sm font-medium text-ink">
            Password <span className="text-gold">*</span>
          </label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby="password-hint"
            className="mt-2 block w-full rounded-md border border-lavender/30 bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-lavender/50"
          />
          <p id="password-hint" className="mt-1 text-xs text-ink-soft">
            At least 8 characters.
          </p>
        </div>

        <div>
          <label htmlFor="confirm-password" className="block text-sm font-medium text-ink">
            Confirm password <span className="text-gold">*</span>
          </label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-2 block w-full rounded-md border border-lavender/30 bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-lavender/50"
          />
        </div>

        {showFormError && (
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {formError}
          </div>
        )}

        <button
          type="submit"
          disabled={status === 'submitting' || missingToken}
          className="w-full rounded-md bg-lavender-deep px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === 'submitting' ? 'Saving…' : 'Set password and sign in'}
        </button>
      </form>
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="relative mx-auto max-w-md px-8 py-24 overflow-hidden"
    >
      <Watermark />
      <Suspense fallback={<p className="text-center text-base text-ink-soft">Loading…</p>}>
        <SetPasswordContent />
      </Suspense>
    </main>
  );
}
