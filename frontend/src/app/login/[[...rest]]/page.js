'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SignIn, useAuth, useClerk } from '@clerk/nextjs';
import { studentLogin, dashboardPathForRole, fetchCurrentUser } from '@/lib/api';
import { getStudentSession, setStudentSession } from '@/lib/studentSession';
import '../../auth.css';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSignedIn, getToken } = useAuth();
  const { signOut } = useClerk();
  const [role, setRole] = useState('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(() => {
    const errorParam = searchParams.get('error');
    const expectedRole = searchParams.get('expected');
    const actualRole = searchParams.get('actual');
    if (errorParam === 'role_mismatch') {
      return `This account is registered as a ${actualRole}, not as a ${expectedRole}. Please select the correct role or sign in with a different account.`;
    }
    if (errorParam === 'not_registered') {
      return 'Your account is not registered in the system yet. Please contact your administrator.';
    }
    if (errorParam === 'unknown') {
      return 'An error occurred. Please try again.';
    }
    return null;
  });

  // Sign out from Clerk when redirected with an auth error
  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam === 'role_mismatch' || errorParam === 'not_registered' || errorParam === 'unknown') {
      signOut();
    }
  }, [searchParams, signOut]);

  // Redirect if there's already a stored student session
  useEffect(() => {
    const session = getStudentSession();
    if (session?.user?.role) {
      router.replace(dashboardPathForRole(session.user.role));
    }
  }, [router]);

  async function handleStudentSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const session = await studentLogin({
        email: email.trim(),
        password,
      });
      setStudentSession(session);
      router.push(dashboardPathForRole(session.user.role));
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const isNotActivated = error?.includes('not activated');

  return (
    <main className="auth-page auth-page-login">
      <aside className="auth-story" aria-label="Olympiad Portal introduction">
        <span className="auth-story-watermark" aria-hidden="true">
          <Image src="/tree-mark.png" alt="" width={360} height={360} />
        </span>
        <Link className="auth-story-brand" href="/" aria-label="Olympiad Portal home">
          <span className="auth-story-mark">
            <Image src="/tree-mark.png" alt="" width={30} height={30} />
          </span>
          <span>
            <strong>Olympiad</strong>
            <em>Portal</em>
          </span>
        </Link>
        <div className="auth-story-copy">
          <p className="auth-story-label">A place to keep growing</p>
          <h1>
            Return to your
            <br />
            <span>best thinking.</span>
          </h1>
          <p>Pick up your practice, revisit your progress, and keep moving toward the next challenge.</p>
        </div>
        <div className="auth-story-footer">
          <Image src="/tree-mark.png" alt="" width={46} height={46} />
          <span>
            Curiosity is a
            <br />
            <strong>daily practice.</strong>
          </span>
        </div>
      </aside>
      <section className="auth-form-side" aria-label="Log in to Olympiad Portal">
        <div className="auth-form-inner">
          <div className="auth-mobile-brand">
            <Image src="/tree-mark.png" alt="" width={27} height={27} />
            <span>
              Olympiad <em>Portal</em>
            </span>
          </div>
          <p className="auth-form-context">Continue your learning journey</p>
          <div className="auth-role-picker" aria-label="Choose your account type">
            <p className="auth-role-label">I&apos;m signing in as</p>
            <div className="auth-role-options" role="group">
              <button
                type="button"
                className={`auth-role-option ${role === 'student' ? 'is-selected' : ''}`}
                aria-pressed={role === 'student'}
                onClick={() => {
                  setRole('student');
                  setError(null);
                }}
              >
                <span className="auth-role-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </span>
                <span>
                  <strong>Student</strong>
                </span>
              </button>
              <button
                type="button"
                className={`auth-role-option ${role === 'educator' ? 'is-selected' : ''}`}
                aria-pressed={role === 'educator'}
                onClick={() => {
                  setRole('educator');
                  setError(null);
                }}
              >
                <span className="auth-role-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                    <path d="M6 12v5c3 3 9 3 12 0v-5" />
                  </svg>
                </span>
                <span>
                  <strong>Educator</strong>
                </span>
              </button>
              <button
                type="button"
                className={`auth-role-option ${role === 'organiser' ? 'is-selected' : ''}`}
                aria-pressed={role === 'organiser'}
                onClick={() => {
                  setRole('organiser');
                  setError(null);
                }}
              >
                <span className="auth-role-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                </span>
                <span>
                  <strong>Organiser</strong>
                </span>
              </button>
            </div>
          </div>

          {role === 'student' ? (
            <>
              <form className="auth-form" onSubmit={handleStudentSubmit}>
                <label htmlFor="student-email">Student email</label>
                <div className="auth-input-wrap">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                  <input
                    id="student-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@school.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={submitting}
                  />
                </div>

                <label htmlFor="student-password">Password</label>
                <div className="auth-input-wrap">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <input
                    id="student-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={submitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                        <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                        <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                        <line x1="2" x2="22" y1="2" y2="22" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>

                {error && !isNotActivated && (
                  <div className="auth-alert auth-alert-error" role="alert">
                    <strong>Couldn&apos;t sign you in</strong>
                    {error}
                  </div>
                )}

                {isNotActivated && (
                  <div className="auth-alert auth-alert-warning" role="alert">
                    <strong>Account not activated yet</strong>
                    {error}
                  </div>
                )}

                <button type="submit" className="auth-submit" disabled={submitting}>
                  {submitting ? 'Signing in…' : 'Sign in'}
                </button>
              </form>

              <p className="auth-embed-note">
                Your educator registers you and emails an invitation link to set your password.
              </p>
            </>
          ) : (
            <>
              {error && (
                <div className="auth-alert auth-alert-error" role="alert" style={{ marginBottom: '16px' }}>
                  <strong>Couldn&apos;t sign you in</strong>
                  {error}
                </div>
              )}
              <SignIn
                routing="path"
                path="/login"
                signUpUrl="/register"
                forceRedirectUrl={`/auth/check?expectedRole=${role}`}
                localization={{
                  signIn: {
                    start: {
                      title: 'Sign In',
                    },
                },
              }}
              appearance={{
                variables: {
                  colorPrimary: '#6c4fd8',
                  colorBackground: '#ffffff',
                  borderRadius: '10px',
                },
                options: {
                  logoImageUrl: '/tree-mark.png',
                  socialButtonsPlacement: 'bottom',
                },
                elements: {
                  rootBox: 'auth-clerk-root',
                  cardBox: 'auth-clerk-cardbox',
                  card: 'auth-clerk-card',
                  headerTitle: 'auth-clerk-title auth-clerk-login-title',
                  headerSubtitle: 'auth-clerk-subtitle',
                  logoBox: 'auth-clerk-logo',
                  formButtonPrimary: 'auth-clerk-primary',
                  socialButtonsBlockButton: 'auth-clerk-social',
                },
              }}
            />
            </>
          )}
        </div>
      </section>
    </main>
  );
}
