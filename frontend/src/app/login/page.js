'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SignIn, useAuth, useClerk } from '@clerk/nextjs';
import { dashboardPathForRole } from '@/lib/api';
import Link from 'next/link';

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

export default function LoginPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { signOut } = useClerk();
  const [errorMessage, setErrorMessage] = useState('');
  const [notFound, setNotFound] = useState(false);

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
              <p>You&apos;re signed in, but your profile hasn&apos;t been completed. Choose an option below to finish setting up your account.</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <Link href="/register" className="button" style={{ textDecoration: 'none', textAlign: 'center' }}>
                Complete Educator Profile
              </Link>
              <Link href="/register/student" className="button" style={{ textDecoration: 'none', textAlign: 'center' }}>
                Complete Student Profile
              </Link>
              <button
                onClick={() => signOut({ redirectUrl: '/login' })}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid rgba(224,97,95,0.3)', background: 'transparent', color: '#e0615f', fontWeight: 600, cursor: 'pointer', fontSize: '0.9em' }}
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
              style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid rgba(224,97,95,0.3)', background: 'transparent', color: '#e0615f', fontWeight: 600, cursor: 'pointer', fontSize: '0.9em' }}
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

  return (
    <main className="relative mx-auto max-w-md px-8 py-24 overflow-hidden">
      <Watermark />
      <div className="relative flex justify-center">
        <SignIn routing="hash" signUpUrl="/register" fallbackRedirectUrl="/login" />
      </div>
    </main>
  );
}
