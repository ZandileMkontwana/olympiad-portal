'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SignIn, useAuth, useClerk } from '@clerk/nextjs';
import { dashboardPathForRole, studentLogin } from '@/lib/api';
import { setStudentSession, getStudentSession } from '@/lib/studentSession';

/* ── Branding panel ───────────────────────────────────────────────────── */

function BrandPanel() {
  const features = [
    { icon: '⏱️', text: 'Rounds open and close automatically, right on schedule' },
    { icon: '⚡', text: 'Multiple-choice papers marked the moment they land' },
    { icon: '📊', text: 'Live dashboards for schools, educators, and students' },
  ];

  return (
    <div
      style={{
        flex: '1 1 46%',
        height: '100vh',
        position: 'sticky',
        top: 0,
        background: 'linear-gradient(150deg, #7c3aed 0%, #6028c9 55%, #4c1d95 100%)',
        color: 'white',
        padding: '56px 56px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          right: '-80px',
          top: '-80px',
          width: '280px',
          height: '280px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '-60px',
          bottom: '-60px',
          width: '220px',
          height: '220px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.04)',
        }}
      />

      <img
        src="/tree-mark.png"
        alt=""
        aria-hidden="true"
        style={{
          position: 'absolute',
          right: '-140px',
          bottom: '-100px',
          width: '560px',
          opacity: 0.1,
          mixBlendMode: 'soft-light',
          filter: 'grayscale(1) brightness(2)',
          pointerEvents: 'none',
          transform: 'rotate(-8deg)',
        }}
      />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '11px',
              background: 'rgba(255,255,255,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '1.1em',
            }}
          >
            O
          </div>
          <span style={{ fontWeight: 700, fontSize: '1.1em' }}>Olympiad Portal</span>
        </div>

        <h1
          style={{
            marginTop: '64px',
            fontSize: '2.6em',
            fontWeight: 800,
            lineHeight: 1.15,
            maxWidth: '420px',
          }}
        >
          Where papers become results.
        </h1>
        <p
          style={{
            marginTop: '16px',
            fontSize: '1em',
            opacity: 0.85,
            maxWidth: '380px',
            lineHeight: 1.6,
          }}
        >
          One portal for organisers, educators, and students to run the whole olympiad — from
          opening a round to releasing the marks.
        </p>
      </div>

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
        }}
      >
        {features.map((f) => (
          <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span style={{ fontSize: '1.3em', width: '32px', textAlign: 'center' }}>{f.icon}</span>
            <p style={{ margin: 0, fontSize: '0.9em', opacity: 0.9 }}>{f.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Student tab: email + password sign-in (no Clerk) ─────────────────── */

function StudentLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('idle');
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
    <form
      onSubmit={handleSubmit}
      noValidate
      style={{ marginTop: '28px', display: 'flex', flexDirection: 'column', gap: '18px' }}
    >
      <div>
        <label
          htmlFor="student-email"
          style={{ display: 'block', fontSize: '0.85em', fontWeight: 600, color: '#2d2640' }}
        >
          Student email <span style={{ color: '#c99a2e' }}>*</span>
        </label>
        <input
          id="student-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            marginTop: '7px',
            width: '100%',
            boxSizing: 'border-box',
            padding: '11px 14px',
            borderRadius: '10px',
            border: '1px solid rgba(139,92,246,0.28)',
            fontSize: '0.92em',
            outline: 'none',
          }}
          onFocus={(e) => {
            e.target.style.borderColor = '#8b5cf6';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'rgba(139,92,246,0.28)';
          }}
        />
      </div>

      <div>
        <label
          htmlFor="student-password"
          style={{ display: 'block', fontSize: '0.85em', fontWeight: 600, color: '#2d2640' }}
        >
          Password <span style={{ color: '#c99a2e' }}>*</span>
        </label>
        <input
          id="student-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            marginTop: '7px',
            width: '100%',
            boxSizing: 'border-box',
            padding: '11px 14px',
            borderRadius: '10px',
            border: '1px solid rgba(139,92,246,0.28)',
            fontSize: '0.92em',
            outline: 'none',
          }}
          onFocus={(e) => {
            e.target.style.borderColor = '#8b5cf6';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'rgba(139,92,246,0.28)';
          }}
        />
      </div>

      {status === 'error' && (
        <div
          role="alert"
          style={{
            borderRadius: '10px',
            border: '1px solid #fca5a5',
            background: '#fef2f2',
            padding: '12px 14px',
            fontSize: '0.85em',
            color: '#991b1b',
          }}
        >
          {errorMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={status === 'submitting'}
        style={{
          width: '100%',
          padding: '12px',
          borderRadius: '10px',
          border: 'none',
          background: 'linear-gradient(135deg, #8b5cf6, #6d3fd1)',
          color: 'white',
          fontWeight: 700,
          fontSize: '0.94em',
          cursor: status === 'submitting' ? 'not-allowed' : 'pointer',
          opacity: status === 'submitting' ? 0.7 : 1,
          boxShadow: '0 6px 16px rgba(109,63,209,0.28)',
        }}
      >
        {status === 'submitting' ? 'Signing in...' : 'Sign in'}
      </button>

      <p style={{ textAlign: 'center', fontSize: '0.78em', color: '#8b7fa8', margin: 0 }}>
        Don&apos;t have a password yet? Your educator registers you and emails an invitation link to
        set one.
      </p>
    </form>
  );
}

/* ── Educator/organiser tab: Clerk sign-in ────────────────────────────── */

function ClerkSignInPanel({ notFound, errorMessage, onSignOut }) {
  return (
    <div style={{ marginTop: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <SignIn routing="hash" signUpUrl="/register" fallbackRedirectUrl="/login" />
      </div>
      {notFound && (
        <div
          role="alert"
          style={{
            marginTop: '16px',
            borderRadius: '10px',
            border: '1px solid #fcd34d',
            background: '#fffbeb',
            padding: '14px',
            fontSize: '0.85em',
            color: '#92400e',
          }}
        >
          <p style={{ fontWeight: 700, margin: '0 0 4px' }}>Account not set up yet</p>
          <p style={{ margin: 0 }}>
            You&apos;re signed in, but your profile hasn&apos;t been completed yet.
          </p>
        </div>
      )}
      {errorMessage && (
        <div
          role="alert"
          style={{
            marginTop: '16px',
            borderRadius: '10px',
            border: '1px solid #fca5a5',
            background: '#fef2f2',
            padding: '12px 14px',
            fontSize: '0.85em',
            color: '#991b1b',
          }}
        >
          {errorMessage}
        </div>
      )}
      {(notFound || errorMessage) && (
        <button
          onClick={onSignOut}
          style={{
            marginTop: '10px',
            border: 'none',
            background: 'none',
            color: '#6d3fd1',
            fontSize: '0.85em',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Sign out and try again
        </button>
      )}
    </div>
  );
}

/* ── Login page ───────────────────────────────────────────────────────── */

export default function LoginPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { signOut } = useClerk();
  const [tab, setTab] = useState('student');
  const [errorMessage, setErrorMessage] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (getStudentSession()) router.replace('/student');
  }, [router]);

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

  const shellStyle = { display: 'flex', minHeight: '100vh', background: '#faf9fc' };
  const cardWrapStyle = {
    flex: '1 1 54%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 24px',
  };
  const cardStyle = { width: '100%', maxWidth: '400px' };

  if (!isLoaded) {
    return (
      <div style={shellStyle}>
        <BrandPanel />
        <div style={cardWrapStyle}>
          <p style={{ color: '#8b7fa8' }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (isSignedIn) {
    return (
      <div style={shellStyle}>
        <BrandPanel />
        <div style={cardWrapStyle}>
          <div style={cardStyle}>
            {notFound ? (
              <div>
                <div
                  role="alert"
                  style={{
                    borderRadius: '12px',
                    border: '1px solid #fcd34d',
                    background: '#fffbeb',
                    padding: '18px',
                    fontSize: '0.88em',
                    color: '#92400e',
                    marginBottom: '18px',
                  }}
                >
                  <p style={{ fontWeight: 700, margin: '0 0 4px' }}>Account not set up yet</p>
                  <p style={{ margin: 0 }}>
                    You&apos;re signed in, but your profile hasn&apos;t been completed yet.
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <button
                    onClick={() => router.push('/register')}
                    style={{
                      padding: '12px',
                      borderRadius: '10px',
                      border: 'none',
                      background: 'linear-gradient(135deg, #8b5cf6, #6d3fd1)',
                      color: 'white',
                      fontWeight: 700,
                      fontSize: '0.92em',
                      cursor: 'pointer',
                    }}
                  >
                    Complete your profile
                  </button>
                  <button
                    onClick={() => signOut({ redirectUrl: '/login' })}
                    style={{
                      border: 'none',
                      background: 'none',
                      color: '#6d3fd1',
                      fontSize: '0.85em',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Sign out and use a different account
                  </button>
                </div>
              </div>
            ) : errorMessage ? (
              <div>
                <div
                  role="alert"
                  style={{
                    borderRadius: '12px',
                    border: '1px solid #fca5a5',
                    background: '#fef2f2',
                    padding: '14px',
                    fontSize: '0.88em',
                    color: '#991b1b',
                    marginBottom: '14px',
                  }}
                >
                  {errorMessage}
                </div>
                <button
                  onClick={() => signOut({ redirectUrl: '/login' })}
                  style={{
                    border: 'none',
                    background: 'none',
                    color: '#6d3fd1',
                    fontSize: '0.85em',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Sign out and try again
                </button>
              </div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    border: '3px solid rgba(139,92,246,0.2)',
                    borderTopColor: '#8b5cf6',
                    borderRadius: '50%',
                    margin: '0 auto 14px',
                    animation: 'spin 0.8s linear infinite',
                  }}
                />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                <p style={{ color: '#8b7fa8', fontSize: '0.9em' }}>
                  {signingIn ? 'Signing you in...' : 'Loading...'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={shellStyle}>
      <BrandPanel />
      <div style={cardWrapStyle}>
        <div style={cardStyle}>
          <h1
            style={{
              fontSize: '1.7em',
              fontWeight: 800,
              color: '#2d2640',
              textAlign: 'center',
              margin: 0,
            }}
          >
            Welcome back
          </h1>
          <p
            style={{ textAlign: 'center', fontSize: '0.88em', color: '#8b7fa8', marginTop: '8px' }}
          >
            Sign in to continue to your dashboard
          </p>

          <div
            role="tablist"
            aria-label="Sign in as"
            style={{
              marginTop: '28px',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '4px',
              borderRadius: '12px',
              border: '1px solid rgba(139,92,246,0.22)',
              background: 'rgba(139,92,246,0.05)',
              padding: '4px',
            }}
          >
            <button
              role="tab"
              aria-selected={tab === 'student'}
              onClick={() => setTab('student')}
              style={{
                padding: '10px 12px',
                borderRadius: '9px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.88em',
                background: tab === 'student' ? 'white' : 'transparent',
                color: tab === 'student' ? '#6d3fd1' : '#8b7fa8',
                boxShadow: tab === 'student' ? '0 2px 8px rgba(139,92,246,0.15)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              🎓 Student
            </button>
            <button
              role="tab"
              aria-selected={tab === 'staff'}
              onClick={() => setTab('staff')}
              style={{
                padding: '10px 12px',
                borderRadius: '9px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.88em',
                background: tab === 'staff' ? 'white' : 'transparent',
                color: tab === 'staff' ? '#6d3fd1' : '#8b7fa8',
                boxShadow: tab === 'staff' ? '0 2px 8px rgba(139,92,246,0.15)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              🏫 Educator / Organiser
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
      </div>
    </div>
  );
}
