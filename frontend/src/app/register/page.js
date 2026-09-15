'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SignUp, useAuth } from '@clerk/nextjs';
import { fetchCurrentUser, dashboardPathForRole } from '@/lib/api';

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

function CompleteProfileForm() {
  const { getToken } = useAuth();
  const [name, setName] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [status, setStatus] = useState('idle'); // idle | submitting | success | error
  const [errorMessage, setErrorMessage] = useState('');
  const [profile, setProfile] = useState(null);

  function validate() {
    const errors = {};
    if (!name.trim()) errors.name = 'Name is required.';
    if (!schoolName.trim()) errors.schoolName = 'School name is required.';
    return errors;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage('');

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setStatus('submitting');
    try {
      const token = await getToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/educators/complete-profile`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ name: name.trim(), schoolName: schoolName.trim() }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong.');
      }

      setProfile(data.user);
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMessage(err.message || 'Something went wrong.');
    }
  }

  if (status === 'success' && profile) {
    return (
      <div
        role="status"
        className="relative rounded-lg border border-lavender/20 bg-surface p-6 shadow-sm"
      >
        <div className="flex items-center justify-center gap-2">
          <span className="h-2 w-2 rounded-full bg-sage" aria-hidden="true" />
          <h1 className="font-display text-xl font-semibold text-ink">Account created</h1>
        </div>
        <p className="mt-2 text-sm text-ink-soft">
          Welcome, {profile.name}. You&apos;re registered as an educator at {profile.school.name}.
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink text-center">
        Educator setup
      </h1>
      <div className="mx-auto mt-3 h-px w-12 bg-lavender" aria-hidden="true" />
      <p className="mt-4 text-center text-sm text-ink-soft">
        Enter your name and school to finish setting up your educator account.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
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
          {status === 'submitting' ? 'Saving…' : 'Finish setup'}
        </button>
      </form>
    </div>
  );
}

export default function RegisterPage() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  // Educator registration only — students are registered by their educator
  // and activate their account via an emailed invitation link.

  // Check if the signed-in user already has a completed profile.
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    async function check() {
      const token = await getToken();
      const user = await fetchCurrentUser(token);
      if (user) {
        // Profile already completed — go to their dashboard
        router.replace(dashboardPathForRole(user.role));
      } else {
        setChecking(false);
      }
    }
    check();
  }, [isLoaded, isSignedIn, getToken, router]);

  if (!isLoaded || (isSignedIn && checking)) {
    return <main className="mx-auto max-w-md px-8 py-24 text-center">Loading…</main>;
  }

  // Signed in with no profile — show the educator form directly
  if (isSignedIn && !checking) {
    return (
      <main className="relative mx-auto max-w-md px-8 py-24 overflow-hidden">
        <Watermark />
        <CompleteProfileForm />
      </main>
    );
  }

  // Not signed in — Clerk sign up, plus a note for students
  return (
    <main className="relative mx-auto max-w-md px-8 py-24 overflow-hidden">
      <Watermark />
      <div className="relative">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink text-center">
          Educator sign up
        </h1>
        <div className="mx-auto mt-3 h-px w-12 bg-lavender" aria-hidden="true" />
        <p className="mt-4 text-center text-sm text-ink-soft">
          Create your account to manage students and rounds for your school.
        </p>
        <div className="mt-6 flex justify-center">
          <SignUp routing="hash" signInUrl="/login" fallbackRedirectUrl="/register" />
        </div>
        <div className="mt-6 rounded-md border border-lavender/25 bg-lavender/5 p-4 text-sm text-ink-soft">
          <p className="font-semibold text-ink">Are you a student?</p>
          <p className="mt-1">
            You don&apos;t need to create an account — your educator registers you and emails you a
            link to set your password. Then just{' '}
            <a href="/login" className="font-medium text-lavender-deep hover:underline">
              sign in
            </a>{' '}
            with your student email.
          </p>
        </div>
      </div>
    </main>
  );
}
