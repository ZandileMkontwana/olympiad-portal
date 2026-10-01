'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { fetchCurrentUser, dashboardPathForRole } from '@/lib/api';

export default function AuthCheckPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn, getToken } = useAuth();
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
        const user = await fetchCurrentUser(token);
        
        if (cancelled) return;
        
        if (user && user.role) {
          router.replace(dashboardPathForRole(user.role));
        } else {
          setError('Unable to load your profile. Please try again.');
          setTimeout(() => router.replace('/login'), 2000);
        }
      } catch (err) {
        if (cancelled) return;
        setError('An error occurred. Redirecting you back...');
        setTimeout(() => router.replace('/login'), 2000);
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken, router]);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      flexDirection: 'column',
      gap: '16px',
    }}>
      {error ? (
        <>
          <p style={{ color: '#e0615f', fontSize: '14px' }}>{error}</p>
        </>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
