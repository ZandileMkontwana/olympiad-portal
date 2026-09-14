'use client';

import { useEffect, useState } from 'react';
import { SignUp, useAuth } from '@clerk/nextjs';
import { listSchools, completeStudentProfile } from '@/lib/api';

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
  const [schools, setSchools] = useState(null); // null while loading
  const [schoolsFailed, setSchoolsFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listSchools()
      .then((list) => {
        if (!cancelled) setSchools(list);
      })
      .catch(() => {
        // Backend unreachable — fall back to a plain text input so
        // registration still works (matching is case-insensitive).
        if (!cancelled) setSchoolsFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
      const data = await completeStudentProfile(
        { name: name.trim(), schoolName: schoolName.trim() },
        token
      );

      setProfile(data.user);
      setStatus('success');
    } catch (err) {
      setStatus('error');
      if (err.status === 409) {
        setErrorMessage(
          'This account already has a profile. Each person can only have one role per account. ' +
            'If you need a student account, please sign out and create a separate Clerk account for the student.'
        );
      } else if (err.status === 404) {
        setErrorMessage(
          'No student record found matching your name and school. ' +
            'Your educator must add you to the school before you can create an account.'
        );
      } else {
        setErrorMessage(err.message || 'Something went wrong.');
      }
    }
  }

  if (status === 'success' && profile) {
    return (
      <div
        role="status"
        className="relative rounded-lg border border-lavender/20 bg-surface p-6 shadow-sm"
      >
        <div className="flex items-center justify-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-sage" aria-hidden="true" />
          <h1 className="font-display text-2xl font-semibold text-ink">Account created</h1>
        </div>
        <p className="mt-3 text-base text-ink-soft">
          Welcome, {profile.name}. You&apos;re registered as a student at{' '}
          {profile.school?.name ?? profile.school}.
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-ink text-center">
        Finish setting up your account
      </h1>
      <div className="mx-auto mt-3 h-px w-12 bg-lavender" aria-hidden="true" />
      <p className="mt-4 text-center text-base text-ink-soft">
        You&apos;re signed in — just need your name and school to finish. Your name and school must
        match an entrant record your educator already registered.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-6">
        <div>
          <label htmlFor="name" className="block text-base font-medium text-ink">
            Name <span className="text-gold">*</span>
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={Boolean(fieldErrors.name)}
            aria-describedby={fieldErrors.name ? 'name-error' : undefined}
            className="mt-2 block w-full rounded-md border border-lavender/30 bg-surface px-4 py-3 text-base text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-lavender/50"
          />
          {fieldErrors.name && (
            <p id="name-error" role="alert" className="mt-1.5 text-base text-red-600">
              {fieldErrors.name}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="schoolName" className="block text-base font-medium text-ink">
            School <span className="text-gold">*</span>
          </label>
          {schoolsFailed ? (
            <input
              id="schoolName"
              type="text"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              aria-invalid={Boolean(fieldErrors.schoolName)}
              aria-describedby={fieldErrors.schoolName ? 'schoolName-error' : undefined}
              className="mt-2 block w-full rounded-md border border-lavender/30 bg-surface px-4 py-3 text-base text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-lavender/50"
            />
          ) : (
            <select
              id="schoolName"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              aria-invalid={Boolean(fieldErrors.schoolName)}
              aria-describedby={fieldErrors.schoolName ? 'schoolName-error' : undefined}
              className="mt-2 block w-full rounded-md border border-lavender/30 bg-surface px-4 py-3 text-base text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-lavender/50"
            >
              <option value="" disabled>
                {schools === null ? 'Loading schools…' : 'Select your school'}
              </option>
              {(schools ?? []).map((school) => (
                <option key={school.id} value={school.name}>
                  {school.name}
                </option>
              ))}
            </select>
          )}
          {fieldErrors.schoolName && (
            <p id="schoolName-error" role="alert" className="mt-1.5 text-base text-red-600">
              {fieldErrors.schoolName}
            </p>
          )}
        </div>

        {status === 'error' && (
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 p-4 text-base text-red-800"
          >
            {errorMessage}
          </div>
        )}

        <button
          type="submit"
          disabled={status === 'submitting'}
          className="w-full rounded-md bg-lavender-deep px-5 py-3 text-base font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === 'submitting' ? 'Saving…' : 'Finish setup'}
        </button>
      </form>
    </div>
  );
}

export default function RegisterStudentPage() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    return <main className="mx-auto max-w-md px-8 py-24 text-center">Loading…</main>;
  }

  return (
    <main className="relative mx-auto max-w-md px-8 py-24 overflow-hidden">
      <Watermark />
      {isSignedIn ? (
        <CompleteProfileForm />
      ) : (
        <div className="relative flex justify-center">
          <SignUp routing="hash" signInUrl="/login" fallbackRedirectUrl="/register/student" />
        </div>
      )}
    </main>
  );
}
