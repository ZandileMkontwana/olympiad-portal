'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useClerk } from '@clerk/nextjs';
import { useRequireRole } from '@/hooks/useRequireRole';
import { listOlympiads, createOlympiad, ApiError } from '@/lib/api';

export default function OrganiserDashboard() {
  const { user, checking } = useRequireRole('organiser');
  const { signOut } = useClerk();

  const [olympiads, setOlympiads] = useState([]);
  const [status, setStatus] = useState('loading');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTimezone, setNewTimezone] = useState('Africa/Johannesburg');
  const [createStatus, setCreateStatus] = useState('idle');
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    if (checking) return;

    async function fetchOlympiads() {
      try {
        const data = await listOlympiads();
        setOlympiads(data);
        setStatus(data.length === 0 ? 'empty' : 'ready');
      } catch {
        setStatus('error');
      }
    }

    fetchOlympiads();
  }, [checking]);

  async function handleCreateOlympiad(e) {
    e.preventDefault();
    if (!newName.trim()) return;

    setCreateStatus('submitting');
    setCreateError('');

    try {
      const created = await createOlympiad({
        name: newName.trim(),
        timezone: newTimezone.trim(),
      });
      // Add the new olympiad to the list (with empty rounds)
      setOlympiads((prev) => [...prev, { ...created, rounds: [] }]);
      setStatus('ready');
      setNewName('');
      setNewTimezone('Africa/Johannesburg');
      setShowCreateForm(false);
      setCreateStatus('idle');
    } catch (err) {
      setCreateStatus('error');
      setCreateError(err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  }

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

  return (
    <main className="round-page">
      <h1>Organiser Console</h1>
      <p className="description">
        Logged in as <strong>{user.email}</strong> ({user.role})
      </p>
      <div className="card" style={{ display: 'flex', gap: '12px' }}>
        <Link href="/organiser/marking" className="button">
          Marking
        </Link>

        <Link href="/organiser/remarks" className="button">
          Remarks
        </Link>

        <button onClick={handleLogout} className="button">
          Log out
        </button>
      </div>

      {/* Olympiads section */}
      <h2
        style={{
          marginTop: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        Olympiads
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="button"
          style={{ fontSize: '0.85em', padding: '6px 14px' }}
        >
          {showCreateForm ? 'Cancel' : '+ New Olympiad'}
        </button>
      </h2>

      {/* Create olympiad form */}
      {showCreateForm && (
        <form
          onSubmit={handleCreateOlympiad}
          className="card"
          style={{ marginTop: '12px', padding: '16px' }}
        >
          <div style={{ marginBottom: '12px' }}>
            <label
              htmlFor="olympiad-name"
              style={{ display: 'block', marginBottom: '4px', fontSize: '0.9em' }}
            >
              Olympiad name
            </label>
            <input
              id="olympiad-name"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Wits Computing Olympiad 2026"
              className="block w-full rounded-md border border-lavender/30 bg-white px-3 py-2 text-sm"
              required
            />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label
              htmlFor="timezone"
              style={{ display: 'block', marginBottom: '4px', fontSize: '0.9em' }}
            >
              Timezone
            </label>
            <input
              id="timezone"
              type="text"
              value={newTimezone}
              onChange={(e) => setNewTimezone(e.target.value)}
              placeholder="Africa/Johannesburg"
              className="block w-full rounded-md border border-lavender/30 bg-white px-3 py-2 text-sm"
              required
            />
          </div>
          {createStatus === 'error' && (
            <p style={{ color: 'red', fontSize: '0.9em', marginBottom: '8px' }}>{createError}</p>
          )}
          <button type="submit" disabled={createStatus === 'submitting'} className="button">
            {createStatus === 'submitting' ? 'Creating...' : 'Create Olympiad'}
          </button>
        </form>
      )}

      {status === 'loading' && <p className="description">Loading olympiads...</p>}

      {status === 'empty' && !showCreateForm && (
        <p className="description">
          No olympiads yet.{' '}
          <button
            onClick={() => setShowCreateForm(true)}
            style={{
              textDecoration: 'underline',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'inherit',
            }}
          >
            Create one
          </button>{' '}
          to get started.
        </p>
      )}

      {status === 'error' && (
        <p className="message">Couldn&apos;t load olympiads. Try refreshing the page.</p>
      )}

      {status === 'ready' && (
        <ul style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {olympiads.map((olympiad) => (
            <li key={olympiad.id} className="card" style={{ padding: '16px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px',
                }}
              >
                <h3 style={{ margin: 0, fontSize: '1.1em' }}>{olympiad.name}</h3>
                <Link
                  href={`/rounds/new?olympiadId=${olympiad.id}&olympiadName=${encodeURIComponent(olympiad.name)}`}
                  className="button"
                  style={{ fontSize: '0.8em', padding: '4px 10px' }}
                >
                  + Add Round
                </Link>
              </div>
              <p className="description" style={{ margin: '0 0 12px 0', fontSize: '0.85em' }}>
                {olympiad.timezone} · {olympiad.rounds.length} round
                {olympiad.rounds.length !== 1 ? 's' : ''}
              </p>

              {olympiad.rounds.length === 0 ? (
                <p className="description" style={{ fontSize: '0.85em', fontStyle: 'italic' }}>
                  No rounds yet. Click &quot;+ Add Round&quot; to create one.
                </p>
              ) : (
                <ul style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {olympiad.rounds.map((round) => {
                    let href = `/educator/round_view?id=${round.id}`;
                    if (round.state === 'open' || round.state === 'scheduled') {
                      href = `/rounds/${round.id}/papers`;
                    } else if (round.state === 'closed' || round.state === 'released') {
                      // The educator round view gates certificates on the
                      // educator role and would fail for organisers — the
                      // closed-round info page is the safe target for both
                      // terminal states.
                      href = `/rounds/${round.id}/closed_round`;
                    }

                    return (
                      <li
                        key={round.id}
                        style={{ display: 'flex', alignItems: 'stretch', gap: '6px' }}
                      >
                        <Link
                          href={href}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            border: '1px solid rgba(139, 92, 246, 0.2)',
                            textDecoration: 'none',
                            fontSize: '0.9em',
                            flex: 1,
                          }}
                        >
                          <span>{round.name}</span>
                          <span style={{ textTransform: 'capitalize', opacity: 0.7 }}>
                            {round.state}
                          </span>
                        </Link>
                        <Link
                          href={`/rounds/${round.id}/notifications`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            border: '1px solid rgba(139, 92, 246, 0.2)',
                            textDecoration: 'none',
                            fontSize: '0.85em',
                            color: 'rgba(139, 92, 246, 0.9)',
                          }}
                        >
                          Notifications
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
