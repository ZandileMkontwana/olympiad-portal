'use client';

// Standalone archive page for organisers and students. Educators browse the
// archive at /educator/archive instead, inside their persistent shell.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { fetchCurrentUser } from '@/lib/api';
import ArchiveBrowser from '@/components/ArchiveBrowser';

export default function ArchivePage() {
  const router = useRouter();
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.replace('/login');
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    async function loadUser() {
      const token = await getToken();
      const fetchedUser = await fetchCurrentUser(token);
      if (cancelled) return;
      if (!fetchedUser) {
        router.replace('/login');
        return;
      }
      setUser(fetchedUser);
    }
    loadUser();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken, router]);

  if (!user) {
    return (
      <div
        style={{
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--background)',
        }}
      >
        <p style={{ color: 'var(--c-t-706391)' }}>Loading...</p>
      </div>
    );
  }

  return (
    <main
      id="main-content"
      tabIndex={-1}
      style={{
        maxWidth: '1000px',
        margin: '0 auto',
        padding: '32px 24px 60px',
        background: 'var(--background)',
        minHeight: '100vh',
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
        }}
      >
        <Link
          href={
            user.role === 'organiser'
              ? '/organiser'
              : user.role === 'student'
                ? '/student'
                : '/educator'
          }
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: '1px solid rgba(139,92,246,0.25)',
            textDecoration: 'none',
            color: 'var(--c-t-6d3fd1)',
            fontSize: '0.85em',
            fontWeight: 600,
          }}
        >
          ← Back to dashboard
        </Link>
      </div>

      <ArchiveBrowser />
    </main>
  );
}
