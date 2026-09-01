'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useClerk } from '@clerk/nextjs';
import { useRequireRole } from '@/hooks/useRequireRole';
import { listOlympiads } from '@/lib/api';

export default function EducatorDashboard() {
  const { user, checking } = useRequireRole('educator');
  const { signOut } = useClerk();

  const [olympiads, setOlympiads] = useState([]);
  const [roundsStatus, setRoundsStatus] = useState('loading');

  useEffect(() => {
    if (checking) return;

    async function fetchOlympiads() {
      try {
        const data = await listOlympiads();
        setOlympiads(data);
        setRoundsStatus(data.some((o) => o.rounds.length > 0) ? 'ready' : 'empty');
      } catch (err) {
        setRoundsStatus('error');
      }
    }

    fetchOlympiads();
  }, [checking]);

  if (checking) {
    return (
      <main className="round-page">
        <p>Loading...</p>
      </main>
    );
  }

  async function handleLogout() {
    await signOut({ redirectUrl: '/login' });
  }

  // Educators work with rounds - only show olympiads that have at least one.
  const olympiadsWithRounds = olympiads.filter((olympiad) => olympiad.rounds.length > 0);

  return (
    <main className="round-page">
      <h1>Educator Portal</h1>
      <p className="description">
        Logged in as <strong>{user.email}</strong> ({user.role})
      </p>

      <div className="card" style={{ display: 'flex', gap: '12px' }}>
        <button onClick={handleLogout} className="button">
          Log out
        </button>
      </div>

      <h2 style={{ marginTop: '24px' }}>Rounds</h2>

      {roundsStatus === 'loading' && <p className="description">Loading rounds...</p>}

      {roundsStatus === 'empty' && <p className="description">No rounds yet.</p>}

      {roundsStatus === 'error' && (
        <p className="message">Couldn&apos;t load rounds. Try refreshing the page.</p>
      )}

      {roundsStatus === 'ready' && (
        <ul style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {olympiadsWithRounds.map((olympiad) => (
            <li key={olympiad.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ background: 'var(--lavender)', padding: '10px 16px' }}>
                <h3 style={{ margin: 0, fontSize: '1.05em', color: 'white' }}>{olympiad.name}</h3>
              </div>
              <div style={{ padding: '12px 16px 16px' }}>
                <p className="description" style={{ margin: '0 0 12px 0', fontSize: '0.85em' }}>
                  {olympiad.timezone} · {olympiad.rounds.length} round
                  {olympiad.rounds.length !== 1 ? 's' : ''}
                </p>
                <ul style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {olympiad.rounds.map((round) => (
                    <li key={round.id}>
                      <Link
                        href={`/educator/round_view?id=${round.id}`}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid rgba(139, 92, 246, 0.2)',
                          textDecoration: 'none',
                          fontSize: '0.9em',
                        }}
                      >
                        <span>{round.name}</span>
                        <span style={{ textTransform: 'capitalize', opacity: 0.7 }}>
                          {round.state}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
