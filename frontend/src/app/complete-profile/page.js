'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, useClerk } from '@clerk/nextjs';
import { completeEducatorProfile, dashboardPathForRole, fetchCurrentUser } from '@/lib/api';
import '../auth.css';

export default function CompleteProfilePage() {
  const router = useRouter();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { signOut } = useClerk();
  const [checking, setChecking] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [name, setName] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace('/login');
      return;
    }
    let cancelled = false;
    async function check() {
      try {
        const token = await getToken();
        const user = await fetchCurrentUser(token, { throwOnError: true });
        if (cancelled) return;
        if (user) {
          router.replace(dashboardPathForRole(user.role));
        } else {
          setChecking(false);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load your account. Please try again.');
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken, router, attempt]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    if (!name.trim() || !schoolName.trim()) {
      setError('Enter your name and school name to continue.');
      return;
    }
    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Your session has expired. Please sign in again.');
      const user = await completeEducatorProfile(token, {
        name: name.trim(),
        schoolName: schoolName.trim(),
      });
      router.replace(dashboardPathForRole(user.role));
    } catch (err) {
      setError(err.message || 'Could not save your profile. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="auth-page"
      style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}
    >
      <section
        className="auth-form-side"
        style={{ width: '100%', minHeight: '100vh' }}
        aria-label="Complete your educator profile"
      >
        <div className="auth-form-inner">
          <Link href="/" className="auth-mobile-brand" style={{ display: 'flex' }}>
            Olympiad Portal
          </Link>
          <h1>Complete your educator profile</h1>
          <p className="auth-embed-note">
            Your sign-in account is ready. Add your name and school to finish joining the portal.
          </p>
          {error && (
            <div className="auth-alert auth-alert-error" role="alert">
              {error}
            </div>
          )}
          {checking ? (
            error ? (
              <button
                type="button"
                className="auth-submit"
                onClick={() => {
                  setError(null);
                  setAttempt((value) => value + 1);
                }}
              >
                Try again
              </button>
            ) : (
              <p role="status">Checking your account...</p>
            )
          ) : (
            <form className="auth-form" onSubmit={handleSubmit}>
              <label htmlFor="educator-name">Full name</label>
              <div className="auth-input-wrap">
                <input
                  id="educator-name"
                  autoComplete="name"
                  required
                  maxLength={200}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  disabled={submitting}
                />
              </div>
              <label htmlFor="school-name">School name</label>
              <div className="auth-input-wrap">
                <input
                  id="school-name"
                  autoComplete="organization"
                  required
                  maxLength={200}
                  value={schoolName}
                  onChange={(event) => setSchoolName(event.target.value)}
                  disabled={submitting}
                />
              </div>
              <button type="submit" className="auth-submit" disabled={submitting}>
                {submitting ? 'Saving your profile...' : 'Save and continue'}
              </button>
            </form>
          )}
          <p className="auth-embed-note">
            Organiser accounts are set up by an administrator. Students join using their
            educator&apos;s invitation.
          </p>
          <button
            type="button"
            className="auth-embed-note"
            onClick={() => signOut({ redirectUrl: '/login' })}
          >
            Sign in with a different account
          </button>
        </div>
      </section>
    </main>
  );
}
