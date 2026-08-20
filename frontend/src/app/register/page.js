"use client";

import { useState } from 'react';
import { register, ApiError } from '@/lib/api';

function validateForm(email, password) {
  const errors = {};

  if (!email.trim()) {
    errors.email = 'Email is required.';
  } else if (!/^\S+@\S+\.\S+$/.test(email)) {
    errors.email = 'Enter a valid email address.';
  }
  if (!password) {
    errors.password = 'Password is required.';
  } else if (password.length < 8) {
    errors.password = 'Password must be at least 8 characters.';
  }

  return errors;
}

export default function RegisterPage() {
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
      const result = await register({ email: email.trim(), password });
      // Store the token now so it's ready once protected routes exist —
      // where a logged-in educator actually lands is Person 4's redirect
      // logic (not built yet), so we just confirm success here.
      window.localStorage.setItem('authToken', result.token);
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMessage(
        err instanceof ApiError ? err.message : 'Something went wrong.'
      );
    }
  }

  if (status === 'success') {
    return (
      <main className="mx-auto max-w-md px-8 py-24 text-center">
        <div role="status" className="rounded-lg border border-lavender/20 bg-surface p-6 shadow-sm">
          <div className="flex items-center justify-center gap-2">
            <span className="h-2 w-2 rounded-full bg-sage" aria-hidden="true" />
            <h1 className="font-display text-xl font-semibold text-ink">
              Account created
            </h1>
          </div>
          <p className="mt-2 text-sm text-ink-soft">
            You&apos;re registered as an educator. Log in to continue.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-8 py-24">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink text-center">
        Create an account
      </h1>
      <div className="mx-auto mt-3 h-px w-12 bg-lavender" aria-hidden="true" />

      <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
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
          <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {errorMessage}
          </div>
        )}

        <button
          type="submit"
          disabled={status === 'submitting'}
          className="w-full rounded-md bg-lavender-deep px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === 'submitting' ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </main>
  );
}