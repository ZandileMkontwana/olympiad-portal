'use client';

import { useState } from 'react';
import { register, ApiError } from '@/lib/api';

function validateForm(name, email, password, schoolName) {
  const errors = {};

  if (!name.trim()) {
    errors.name = 'Name is required.';
  }
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
  if (!schoolName.trim()) {
    errors.schoolName = 'School name is required.';
  }

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

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [status, setStatus] = useState('idle'); // idle | submitting | success | error
  const [errorMessage, setErrorMessage] = useState('');
  const [registeredUser, setRegisteredUser] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage('');

    const errors = validateForm(name, email, password, schoolName);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setStatus('submitting');
    try {
      const result = await register({
        email: email.trim(),
        password,
        name: name.trim(),
        schoolName: schoolName.trim(),
      });
      window.localStorage.setItem('authToken', result.token);
      setRegisteredUser(result.user);
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  }

  if (status === 'success') {
    return (
      <main className="relative mx-auto max-w-md px-8 py-24 text-center overflow-hidden">
        <Watermark />
        <div role="status" className="relative rounded-lg border border-lavender/20 bg-surface p-6 shadow-sm">
          <div className="flex items-center justify-center gap-2">
            <span className="h-2 w-2 rounded-full bg-sage" aria-hidden="true" />
            <h1 className="font-display text-xl font-semibold text-ink">Account created</h1>
          </div>
          <p className="mt-2 text-sm text-ink-soft">
            {registeredUser?.name ? `Welcome, ${registeredUser.name}. ` : ''}
            You&apos;re registered as an educator
            {registeredUser?.school ? ` at ${registeredUser.school}` : ''}. Log in to continue.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative mx-auto max-w-md px-8 py-24 overflow-hidden">
      <Watermark />
      <h1 className="relative font-display text-2xl font-semibold tracking-tight text-ink text-center">
        Create an account
      </h1>
      <div className="relative mx-auto mt-3 h-px w-12 bg-lavender" aria-hidden="true" />

      <form onSubmit={handleSubmit} noValidate className="relative mt-8 space-y-5">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-ink">
            Name <span className="text-gold">*</span>
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={Boolean(fieldErrors.name)}
            aria-describedby={fieldErrors.name ? 'name-error' : undefined}
            className="mt-2 block w-full rounded-md border border-lavender/30 bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-lavender/50"
          />
          {fieldErrors.name && (
            <p id="name-error" role="alert" className="mt-1 text-sm text-red-600">
              {fieldErrors.name}
            </p>
          )}
        </div>

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

        <div>
          <label htmlFor="schoolName" className="block text-sm font-medium text-ink">
            School name <span className="text-gold">*</span>
          </label>
          <input
            id="schoolName"
            type="text"
            value={schoolName}
            onChange={(e) => setSchoolName(e.target.value)}
            aria-invalid={Boolean(fieldErrors.schoolName)}
            aria-describedby={fieldErrors.schoolName ? 'schoolName-error' : undefined}
            className="mt-2 block w-full rounded-md border border-lavender/30 bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-lavender/50"
          />
          {fieldErrors.schoolName && (
            <p id="schoolName-error" role="alert" className="mt-1 text-sm text-red-600">
              {fieldErrors.schoolName}
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
          {status === 'submitting' ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </main>
  );
}