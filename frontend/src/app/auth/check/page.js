'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth, useClerk } from '@clerk/nextjs';
import { fetchCurrentUser, dashboardPathForRole } from '@/lib/api';

function AuthCheckContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { signOut } = useClerk();
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const expectedRole = searchParams.get('expectedRole');

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

        if (!user || !user.role) {
          if (expectedRole === 'organiser') {
            setError(
              'Organiser access must be set up by an administrator. If you are an educator, complete your educator profile below.'
            );
          } else {
            router.replace('/complete-profile');
          }
          return;
        }

        if (expectedRole && user.role !== expectedRole) {
          router.replace(
            `/login?error=role_mismatch&expected=${encodeURIComponent(expectedRole)}&actual=${encodeURIComponent(user.role)}`
          );
          return;
        }

        router.replace(dashboardPathForRole(user.role));
      } catch (err) {
        if (cancelled) return;
        setError(err.message || 'Could not load your account. Please try again.');
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken, router, expectedRole, attempt]);

  return (
    <main
      id="main-content"
      tabIndex={-1}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      <h1 className="sr-only">{error ? 'Account access' : 'Signing you in'}</h1>
      {error ? (
        <>
          <p role="alert" style={{ maxWidth: '440px', padding: '0 20px', textAlign: 'center' }}>
            {error}
          </p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setAttempt((value) => value + 1);
            }}
          >
            Try again
          </button>
          {expectedRole === 'organiser' && (
            <Link href="/complete-profile">Complete educator profile</Link>
          )}
          <button type="button" onClick={() => signOut({ redirectUrl: '/login' })}>
            Sign in with a different account
          </button>
        </>
      ) : (
        <>
          <div
            aria-hidden="true"
            style={{
              width: '40px',
              height: '40px',
              border: '3px solid var(--c-bd-f0edf6)',
              borderTopColor: '#6c4fd8',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
          <p role="status" style={{ color: 'var(--c-t-6d667f)', fontSize: '14px' }}>
            Signing you in...
          </p>
        </>
      )}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </main>
  );
}

export default function AuthCheckPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
          }}
        >
          <p style={{ color: 'var(--c-t-6d667f)', fontSize: '14px' }}>Loading...</p>
        </div>
      }
    >
      <AuthCheckContent />
    </Suspense>
  );
}
