'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { fetchCurrentUser, dashboardPathForRole } from '@/lib/api';

export default function AuthCheckPage() {
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
          // No profile in backend - redirect to login with error
          router.replace('/login?error=not_registered');
          return;
        }
        
        // Validate that the user's role matches the expected role
        if (expectedRole && user.role !== expectedRole) {
          // Role mismatch - redirect to login with error
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
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      flexDirection: 'column',
      gap: '16px',
    }}>
      <div style={{
        width: '40px',
        height: '40px',
        border: '3px solid #f0edf6',
        borderTopColor: '#6c4fd8',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }} />
      <p style={{ color: '#766e89', fontSize: '14px' }}>Signing you in...</p>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
