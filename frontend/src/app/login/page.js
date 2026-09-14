'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SignIn, useAuth, useClerk } from '@clerk/nextjs';
import { dashboardPathForRole, studentLogin } from '@/lib/api';
import { setStudentSession, getStudentSession } from '@/lib/studentSession';

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

/* ── Student tab: email + password sign-in (no Clerk) ─────────────────── */

function StudentLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('idle'); // idle | submitting | error
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage('');
    setStatus('submitting');
    try {
      const data = await studentLogin({ email: email.trim(), password });
      setStudentSession({ token: data.token, user: data.user });
      router.push('/student');
    } catch (err) {
      setStatus('error');
      setErrorMessage(err.message || 'Could not sign in. Please try again.');
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
      <div>
        <label htmlFor="student-email" className="block text-sm font-medium text-ink">
          Student email <span className="text-gold">*</span>
        </label>
        <input
          id="student-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="mt-2 block w-full rounded-md border border-lavender/30 bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-lavender/50"
        />
      </div>

      <div>
        <label htmlFor="student-password" className="block text-sm font-medium text-ink">
          Password <span className="text-gold">*</span>
        </label>
        <input
          id="student-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="mt-2 block w-full rounded-md border border-lavender/30 bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-lavender/50"
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
        {status === 'submitting' ? 'Signing in…' : 'Sign in'}
      </button>

      <p className="text-center text-xs text-ink-soft">
        Don&apos;t have a password yet? Your educator registers you and emails an
        invitation link to set one — check your inbox.
      </p>
    </form>
  );
}

/* ── Educator/organiser tab: Clerk sign-in ────────────────────────────── */

function ClerkSignInPanel({ notFound, errorMessage, onSignOut }) {
  return (
    <>
      <div className="mt-6 flex justify-center">
        <SignIn routing="hash" signUpUrl="/register" fallbackRedirectUrl="/login" />
      </div>
      {notFound && (
        <div
          role="alert"
          className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
        >
          <p className="font-semibold mb-1">Account not set up yet</p>
          <p>You&apos;re signed in, but your profile hasn&apos;t been completed yet.</p>
        </div>
      )}
      {errorMessage && (
        <div
          role="alert"
          className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {errorMessage}
        </div>
      )}
      {(notFound || errorMessage) && (
        <button
          onClick={onSignOut}
          className="mt-3 text-sm text-lavender hover:text-lavender-deep"
        >
          Sign out and try again
        </button>
      )}
    </>
  );
}

/* ── Login page ───────────────────────────────────────────────────────── */

export default function LoginPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { signOut } = useClerk();
  const [tab, setTab] = useState('student'); // 'student' | 'staff'
  const [errorMessage, setErrorMessage] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  // Students with an active JWT session go straight to their dashboard.
  useEffect(() => {
    if (getStudentSession()) {
      router.replace('/student');
    }
  }, [router]);

  // Educators/organisers signed in via Clerk are routed to their dashboard.
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    async function redirectToDashboard() {
      try {
        setSigningIn(true);
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
      } finally {
        setSigningIn(false);
      }
    }

    redirectToDashboard();
  }, [isLoaded, isSignedIn, getToken, router]);

  if (!isLoaded) {
    return <main className="mx-auto max-w-md px-8 py-24 text-center">Loading…</main>;
  }

  if (isSignedIn) {
    return (
      <main className="mx-auto max-w-md px-8 py-24 text-center">
        {notFound ? (
          <div>
            <div
              role="alert"
              className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 mb-4"
            >
              <p className="font-semibold mb-1">Account not set up yet</p>
              <p>You&apos;re signed in, but your profile hasn&apos;t been completed yet.</p>
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => router.push('/register')}
                className="w-full rounded-md bg-lavender-deep px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                Complete your profile
              </button>
              <button
                onClick={() => signOut({ redirectUrl: '/login' })}
                className="text-sm text-lavender hover:text-lavender-deep"
              >
                Sign out and use a different account
              </button>
            </div>
          </div>
        ) : errorMessage ? (
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
          <p className="text-sm text-ink-soft">{signingIn ? 'Signing you in…' : 'Loading…'}</p>
        )}
      </main>
    );
  }

  return (
    <main className="relative mx-auto max-w-md px-8 py-24 overflow-hidden">
      <Watermark />
      <div className="relative">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink text-center">
          Welcome back
        </h1>
        <div className="mx-auto mt-3 h-px w-12 bg-lavender" aria-hidden="true" />

        {/* Tab selector — the two roles genuinely use different sign-in mechanisms:
            students authenticate with email + password, staff via Clerk. */}
        <div
          role="tablist"
          aria-label="Sign in as"
          className="mt-8 grid grid-cols-2 gap-1 rounded-lg border border-lavender/25 bg-lavender/5 p-1"
        >
          <button
            role="tab"
            aria-selected={tab === 'student'}
            onClick={() => setTab('student')}
            className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
              tab === 'student' ? 'bg-surface text-lavender-deep shadow-sm' : 'text-ink-soft'
            }`}
          >
            Student
          </button>
          <button
            role="tab"
            aria-selected={tab === 'staff'}
            onClick={() => setTab('staff')}
            className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
              tab === 'staff' ? 'bg-surface text-lavender-deep shadow-sm' : 'text-ink-soft'
            }`}
          >
            Educator / Organiser
          </button>
        </div>

        {tab === 'student' ? (
          <StudentLoginForm />
        ) : (
          <ClerkSignInPanel
            notFound={notFound}
            errorMessage={errorMessage}
            onSignOut={() => signOut({ redirectUrl: '/login' })}
          />
        )}
      </div>
    </main>
  );
}
