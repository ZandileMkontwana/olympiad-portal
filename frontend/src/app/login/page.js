'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SignIn, useAuth, useClerk } from '@clerk/nextjs';
import { dashboardPathForRole } from '@/lib/api';

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

function LoginRoleSelector({ onSelect }) {
  return (
    <div className="relative">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink text-center">
        Log in to the Olympiad Portal
      </h1>
      <div className="mx-auto mt-3 h-px w-12 bg-lavender" aria-hidden="true" />
      <p className="mt-4 text-center text-sm text-ink-soft">
        Choose how you&apos;ll log in.
      </p>

      <div className="mt-8 flex flex-col gap-4">
        <button
          type="button"
          onClick={() => onSelect('educator')}
          className="flex items-center gap-4 rounded-lg border border-lavender/30 bg-surface p-5 text-left transition-colors hover:border-lavender/60 hover:bg-lavender/5"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-lavender/10 text-2xl">
            🎓
          </span>
          <div>
            <p className="font-display text-lg font-semibold text-ink">I&apos;m an Educator</p>
            <p className="mt-1 text-sm text-ink-soft">
              Manage students, rounds, and results for your school.
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onSelect('student')}
          className="flex items-center gap-4 rounded-lg border border-lavender/30 bg-surface p-5 text-left transition-colors hover:border-lavender/60 hover:bg-lavender/5"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-lavender/10 text-2xl">
            📝
          </span>
          <div>
            <p className="font-display text-lg font-semibold text-ink">I&apos;m a Student</p>
            <p className="mt-1 text-sm text-ink-soft">
              Take tests and view your results.
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { signOut } = useClerk();
  const [role, setRole] = useState(null); // null | 'educator' | 'student'
  const [errorMessage, setErrorMessage] = useState('');
  const [notFound, setNotFound] = useState(false);

  // If signed in with a profile, redirect to the appropriate dashboard.
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    async function redirectToDashboard() {
      try {
        const token = await getToken();
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        if (!res.ok) {
          if (res.status === 404) {
            setNotFound(true);
            return;
          }
          throw new Error(data.error || 'Could not load your account.');
        }

        router.push(dashboardPathForRole(data.user.role));
      } catch (err) {
        setErrorMessage(err.message || 'Something went wrong loading your account.');
      }
    }

    redirectToDashboard();
  }, [isLoaded, isSignedIn, getToken, router]);

  if (!isLoaded) {
    return <main className="mx-auto max-w-md px-8 py-24 text-center">Loading…</main>;
  }

  // Signed in but profile not yet completed — show role selector to finish setup
  if (isSignedIn && notFound) {
    return (
      <main className="relative mx-auto max-w-md px-8 py-24 overflow-hidden">
        <Watermark />
        <div className="relative">
          <div
            role="alert"
            className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
          >
            <p className="font-semibold mb-1">Account not set up yet</p>
            <p>
              You&apos;re signed in, but your profile hasn&apos;t been completed.
              Choose your role below to finish setting up your account.
            </p>
          </div>
          <LoginRoleSelector
            onSelect={(selected) =>
              router.push(selected === 'student' ? '/register/student' : '/register')
            }
          />
          <div className="mt-6 text-center">
            <button
              onClick={() => signOut({ redirectUrl: '/login' })}
              className="text-sm text-lavender hover:text-lavender-deep"
            >
              Sign out and use a different account
            </button>
          </div>
        </div>
      </main>
    );
  }

  // Signed in with a profile — redirecting to dashboard
  if (isSignedIn) {
    return (
      <main className="mx-auto max-w-md px-8 py-24 text-center">
        {errorMessage ? (
          <div>
            <div
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 mb-4"
            >
              {errorMessage}
            </div>
            <button
              onClick={() => signOut({ redirectUrl: '/login' })}
              className="text-sm text-lavender hover:text-lavender-deep"
            >
              Sign out and try again
            </button>
          </div>
        ) : (
          <p className="text-sm text-ink-soft">Signing you in…</p>
        )}
      </main>
    );
  }

  // Not signed in + role selected → show the appropriate Clerk SignIn
  if (role === 'educator') {
    return (
      <main className="relative mx-auto max-w-md px-8 py-24 overflow-hidden">
        <Watermark />
        <div className="relative">
          <button
            type="button"
            onClick={() => setRole(null)}
            className="mb-4 text-sm text-lavender hover:text-lavender-deep"
          >
            &larr; Back
          </button>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink text-center">
            Educator login
          </h1>
          <div className="mx-auto mt-3 h-px w-12 bg-lavender" aria-hidden="true" />
          <div className="mt-6 flex justify-center">
            <SignIn routing="hash" signUpUrl="/register" fallbackRedirectUrl="/login" />
          </div>
        </div>
      </main>
    );
  }

  if (role === 'student') {
    return (
      <main className="relative mx-auto max-w-md px-8 py-24 overflow-hidden">
        <Watermark />
        <div className="relative">
          <button
            type="button"
            onClick={() => setRole(null)}
            className="mb-4 text-sm text-lavender hover:text-lavender-deep"
          >
            &larr; Back
          </button>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink text-center">
            Student login
          </h1>
          <div className="mx-auto mt-3 h-px w-12 bg-lavender" aria-hidden="true" />
          <div className="mt-6 flex justify-center">
            <SignIn routing="hash" signUpUrl="/register/student" fallbackRedirectUrl="/login" />
          </div>
        </div>
      </main>
    );
  }

  // Not signed in + no role → show the role selector
  return (
    <main className="relative mx-auto max-w-md px-8 py-24 overflow-hidden">
      <Watermark />
      <LoginRoleSelector onSelect={setRole} />
    </main>
  );
}
