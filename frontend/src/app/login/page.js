'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login, ApiError, dashboardPathForRole } from '@/lib/api';
import { useRedirectIfAuthenticated } from '@/hooks/useAuthRedirect';

function validateForm(email, password) {
  const errors = {};
  if (!email.trim()) errors.email = 'Email is required.';
  if (!password) errors.password = 'Password is required.';
  return errors;
}

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

export default function LoginPage() {
  const router = useRouter();
  const checking = useRedirectIfAuthenticated();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [status, setStatus] = useState('idle'); // idle | submitting | success | error
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage('');

    const errors = validateForm(email, password);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setStatus('submitting');
    try {
      const result = await login({ email: email.trim(), password });
      router.push(dashboardPathForRole(result.user.role));
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  }

  if (checking) {
    return <main className="mx-auto max-w-md px-8 py-24 text-center">Loading...</main>;
  }

  return (
    <main className="relative mx-auto max-w-md px-8 py-24 overflow-hidden">
      <Watermark />
      <h1 className="relative font-display text-2xl font-semibold tracking-tight text-ink text-center">
        Log in
      </h1>
      <div className="relative mx-auto mt-3 h-px w-12 bg-lavender" aria-hidden="true" />

      <form onSubmit={handleSubmit} noValidate className="relative mt-8 space-y-5">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-ink">
            Email <span className="text-gold">*</span>
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? 'email-error' : undefined}
            className="mt-2 block w-full rounded-md border border-lavender/30 bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-lavender/50"
          />
          {fieldErrors.email && (
            <p id="email-error" role="alert" className="mt-1 text-sm text-red-600">
              {fieldErrors.email}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-ink">
            Password <span className="text-gold">*</span>
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? 'password-error' : undefined}
            className="mt-2 block w-full rounded-md border border-lavender/30 bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-lavender/50"
          />
          {fieldErrors.password && (
            <p id="password-error" role="alert" className="mt-1 text-sm text-red-600">
              {fieldErrors.password}
            </p>
          )}
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
          {status === 'submitting' ? 'Logging in…' : 'Log in'}
        </button>
      </form>
    </main>
  );
}