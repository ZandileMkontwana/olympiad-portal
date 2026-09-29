'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRequireRole } from '@/hooks/useRequireRole';
import OrganiserShell from '@/components/OrganiserShell';
import { listOlympiads, fetchRoundReplay, ApiError } from '@/lib/api';

const ACTION_STYLES = {
  round_opened: { color: '#16a34a', bg: '#f0fdf4', label: 'Round opened', icon: '▶' },
  round_closed: { color: '#dc2626', bg: '#fef2f2', label: 'Round closed', icon: '■' },
  auto_advanced: { color: '#2563eb', bg: '#eff6ff', label: 'Auto-advanced', icon: '→' },
  notification_sent: { color: '#9333ea', bg: '#faf5ff', label: 'Notification', icon: '✉' },
};

function actionMeta(action) {
  return ACTION_STYLES[action] || { color: '#6b7280', bg: '#f9fafb', label: action, icon: '•' };
}

function formatTimestamp(iso) {
  return new Date(iso).toLocaleString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function ReplayPage() {
  const { user, checking } = useRequireRole('organiser');
  const { getToken } = useAuth();

  const [olympiads, setOlympiads] = useState([]);
  const [selectedRoundId, setSelectedRoundId] = useState('');
  const [replay, setReplay] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error
  const [error, setError] = useState('');

  // Load olympiads with rounds for the dropdown.
  useEffect(() => {
    if (checking) return;

    async function load() {
      try {
        const token = await getToken();
        const data = await listOlympiads(token);
        setOlympiads(data);
      } catch {
        setError('Could not load olympiads.');
      }
    }

    load();
  }, [checking, getToken]);

  // Fetch replay data when a round is selected.
  useEffect(() => {
    if (!selectedRoundId) {
      return;
    }

    async function load() {
      setStatus('loading');
      setError('');
      try {
        const token = await getToken();
        const data = await fetchRoundReplay(selectedRoundId, token);
        setReplay(data);
        setStatus('ready');
      } catch (err) {
        setStatus('error');
        setError(err instanceof ApiError ? err.message : 'Could not load replay data.');
      }
    }

    load();
  }, [selectedRoundId, getToken]);

  if (checking) {
    return (
      <OrganiserShell activeNav="replay" breadcrumb="Replay" user={user}>
        <p>Loading...</p>
      </OrganiserShell>
    );
  }

  // Build a flat list of all rounds across olympiads for the dropdown.
  const allRounds = olympiads.flatMap((o) =>
    o.rounds.map((r) => ({ ...r, olympiadName: o.name, olympiadId: o.id }))
  );

  return (
    <OrganiserShell activeNav="replay" breadcrumb="Replay" user={user}>
      <div className="organiser-page-heading">
        <h1>Round Replay</h1>
        <p>View the timeline of automatic actions the scheduler performed on a round.</p>
      </div>

      {/* Round selector */}
      <div style={{ marginBottom: '24px' }}>
        <label
          htmlFor="round-select"
          style={{ display: 'block', marginBottom: '4px', fontSize: '0.9em', fontWeight: 600 }}
        >
          Select a round
        </label>
        <select
          id="round-select"
          value={selectedRoundId}
          onChange={(e) => setSelectedRoundId(e.target.value)}
          style={{
            width: '100%',
            maxWidth: '480px',
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            fontSize: '0.9em',
          }}
        >
          <option value="">Choose a round...</option>
          {allRounds.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} — {r.olympiadName} ({r.state})
            </option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {status === 'loading' && <p className="description">Loading replay data...</p>}

      {/* Error */}
      {status === 'error' && <p style={{ color: 'red', fontSize: '0.9em' }}>{error}</p>}

      {/* Replay timeline */}
      {status === 'ready' && replay && (
        <div>
          {/* Round info header */}
          <div className="card" style={{ padding: '16px', marginBottom: '20px' }}>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '1.15em' }}>{replay.round.name}</h2>
            <p className="description" style={{ margin: '0 0 4px', fontSize: '0.85em' }}>
              <strong>Olympiad:</strong> {replay.round.olympiadName}
            </p>
            <p className="description" style={{ margin: '0 0 4px', fontSize: '0.85em' }}>
              <strong>State:</strong>{' '}
              <span style={{ textTransform: 'capitalize' }}>{replay.round.state}</span>
            </p>
            <p className="description" style={{ margin: '0 0 4px', fontSize: '0.85em' }}>
              <strong>Opens:</strong> {formatTimestamp(replay.round.openTime)}
            </p>
            <p className="description" style={{ margin: 0, fontSize: '0.85em' }}>
              <strong>Closes:</strong> {formatTimestamp(replay.round.closeTime)}
            </p>
          </div>

          {/* Timeline */}
          {replay.timeline.length === 0 ? (
            <p className="description" style={{ fontStyle: 'italic' }}>
              No automatic actions have been recorded for this round yet.
            </p>
          ) : (
            <div>
              <h3 style={{ marginBottom: '12px', fontSize: '1em' }}>
                Timeline ({replay.timeline.length} event{replay.timeline.length !== 1 ? 's' : ''})
              </h3>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0',
                  position: 'relative',
                  paddingLeft: '28px',
                }}
              >
                {/* Vertical line */}
                <div
                  style={{
                    position: 'absolute',
                    left: '11px',
                    top: '8px',
                    bottom: '8px',
                    width: '2px',
                    backgroundColor: 'rgba(139, 92, 246, 0.2)',
                  }}
                />

                {replay.timeline.map((entry, index) => {
                  const meta = actionMeta(entry.action);
                  const isLast = index === replay.timeline.length - 1;

                  return (
                    <div
                      key={entry.id}
                      style={{
                        position: 'relative',
                        paddingBottom: isLast ? '0' : '20px',
                      }}
                    >
                      {/* Dot on the timeline */}
                      <div
                        style={{
                          position: 'absolute',
                          left: '-22px',
                          top: '6px',
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          backgroundColor: meta.color,
                          border: '2px solid white',
                          boxShadow: '0 0 0 2px rgba(139, 92, 246, 0.15)',
                        }}
                      />

                      {/* Event card */}
                      <div
                        style={{
                          padding: '10px 14px',
                          borderRadius: '8px',
                          backgroundColor: meta.bg,
                          border: `1px solid ${meta.color}22`,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '4px',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '0.8em',
                              fontWeight: 600,
                              color: meta.color,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <span>{meta.icon}</span> {meta.label}
                          </span>
                          <span
                            style={{
                              fontSize: '0.75em',
                              color: '#6b7280',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {formatTimestamp(entry.timestamp)}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.85em', color: '#374151' }}>
                          {entry.summary}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </OrganiserShell>
  );
}
