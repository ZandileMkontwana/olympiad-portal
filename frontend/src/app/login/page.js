'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SignIn, useAuth } from '@clerk/nextjs';
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

export default function LoginPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [errorMessage, setErrorMessage] = useState('');

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
        {errorMessage ? (
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {errorMessage}
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
