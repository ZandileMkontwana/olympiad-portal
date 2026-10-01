'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useClerk } from '@clerk/nextjs';
import { fetchCurrentUser, dashboardPathForRole } from '@/lib/api';

export default function AuthCheckPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { signOut } = useClerk();
  const [error, setError] = useState(null);
  const [noProfile, setNoProfile] = useState(false);

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
          setNoProfile(true);
          setError('Your account is not registered in the system yet.');
        }
      } catch (err) {
        if (cancelled) return;
        setError('An error occurred. Please try again.');
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken, router]);

  async function handleSignOut() {
    await signOut();
    router.replace('/login');
  }

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
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <p style={{ color: noProfile ? '#b45309' : '#e0615f', fontSize: '14px', marginBottom: '16px' }}>
            {error}
          </p>
          {noProfile && (
            <p style={{ color: '#766e89', fontSize: '13px', marginBottom: '20px' }}>
              Please contact your administrator to register your account, or sign in with a different account.
            </p>
          )}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={handleSignOut}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: '1px solid #e5e1ed',
                background: '#fff',
                color: '#6c4fd8',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Sign in with different account
            </button>
          </div>
        </div>
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
