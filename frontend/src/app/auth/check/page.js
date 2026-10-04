'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { fetchCurrentUser, dashboardPathForRole } from '@/lib/api';

function AuthCheckContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded, isSignedIn, getToken } = useAuth();

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
        const user = await fetchCurrentUser(token);
        const expectedRole = searchParams.get('expectedRole');

        if (cancelled) return;

        if (!user || !user.role) {
          router.replace('/login?error=not_registered');
          return;
        }

        if (expectedRole && user.role !== expectedRole) {
          router.replace(`/login?error=role_mismatch&expected=${expectedRole}&actual=${user.role}`);
          return;
        }

        router.replace(dashboardPathForRole(user.role));
      } catch (err) {
        if (cancelled) return;
        router.replace('/login?error=unknown');
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken, router, searchParams]);

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
      <h1 className="sr-only">Signing you in</h1>
      <div
        aria-hidden="true"
        style={{
          width: '40px',
          height: '40px',
          border: '3px solid #f0edf6',
          borderTopColor: '#6c4fd8',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}
      />
      <p role="status" style={{ color: '#6d667f', fontSize: '14px' }}>
        Signing you in...
      </p>
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
          <p style={{ color: '#6d667f', fontSize: '14px' }}>Loading...</p>
        </div>
      }
    >
      <AuthCheckContent />
    </Suspense>
  );
}
