'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { fetchCurrentUser, fetchArchivedPapers } from '@/lib/api';

export default function ArchivePage() {
  const router = useRouter();
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const [papers, setPapers] = useState([]);
  const [status, setStatus] = useState('loading');
  const [user, setUser] = useState(null);

  // Wait for Clerk to finish loading, then redirect to login if not signed in.
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.replace('/login');
    }
  }, [isLoaded, isSignedIn, router]);

  // Once Clerk confirms the user is signed in, fetch their profile and the archive.
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

  useEffect(() => {
    if (!user) return;

    fetchArchivedPapers()
      .then((data) => {
        setPapers(data);
        setStatus(data.length === 0 ? 'empty' : 'ready');
      })
      .catch(() => setStatus('error'));
  }, [user]);

  if (!user) {
    return (
      <main className="round-page">
        <p>Loading…</p>
      </main>
    );
  }

  return (
    <main className="round-page">
      <h1>Paper Archive</h1>
      <p className="description">
        Past papers from closed and released rounds, available for download.
      </p>

      {status === 'loading' && <p className="description">Loading archive…</p>}

      {status === 'error' && (
        <p className="message">Couldn&apos;t load the archive. Try refreshing the page.</p>
      )}

      {status === 'empty' && (
        <p className="description">
          No archived papers yet. Papers appear here once their round closes.
        </p>
      )}

      {status === 'ready' && (
        <ul style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {papers.map((paper) => (
            <li key={paper.id}>
              <div
                className="card"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  gap: '16px',
                }}
              >
                <div>
                  <strong>{paper.roundName}</strong>
                  <br />
                  <span className="description">{paper.olympiadName}</span>
                  <br />
                  <span className="description" style={{ fontSize: '0.85em' }}>
                    Closed {new Date(paper.closeTime).toLocaleDateString()}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <a
                    href={paper.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="button"
                    style={{ padding: '6px 12px', fontSize: '0.9em' }}
                  >
                    Paper
                  </a>
                  {paper.memoUrl && (
                    <a
                      href={paper.memoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="button"
                      style={{ padding: '6px 12px', fontSize: '0.9em' }}
                    >
                      Memo
                    </a>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p style={{ marginTop: '24px' }}>
        <Link href={user.role === 'organiser' ? '/organiser' : '/educator'} className="button">
          ← Back to dashboard
        </Link>
      </p>
    </main>
  );
}
