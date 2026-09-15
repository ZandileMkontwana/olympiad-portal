'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth, useClerk } from '@clerk/nextjs';
import { useRequireRole } from '@/hooks/useRequireRole';
import {
  listOlympiads,
  createOlympiad,
  updateOlympiad,
  fetchAccessRequests,
  approveAccessRequest,
  declineAccessRequest,
  ApiError,
} from '@/lib/api';

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function OrganiserDashboard() {
  const { user, checking } = useRequireRole('organiser');
  const { signOut } = useClerk();
  const { getToken } = useAuth();

  const [olympiads, setOlympiads] = useState([]);
  const [status, setStatus] = useState('loading');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTimezone, setNewTimezone] = useState('Africa/Johannesburg');
  const [newDescription, setNewDescription] = useState('');
  const [newGrades, setNewGrades] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [createStatus, setCreateStatus] = useState('idle');
  const [createError, setCreateError] = useState('');

  // Inline "Edit details" editor — one olympiad at a time.
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editTimezone, setEditTimezone] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editGrades, setEditGrades] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editStatus, setEditStatus] = useState('idle');
  const [editError, setEditError] = useState('');

  // School access requests awaiting a decision.
  const [accessRequests, setAccessRequests] = useState([]);
  const [accessStatus, setAccessStatus] = useState('loading');
  const [decidingId, setDecidingId] = useState(null);
  const [decisionError, setDecisionError] = useState('');

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

  useEffect(() => {
    if (checking) return;

    async function loadAccessRequests() {
      try {
        const token = await getToken();
        const data = await fetchAccessRequests(token);
        setAccessRequests(data);
        setAccessStatus('ready');
      } catch {
        setAccessStatus('error');
      }
    }

    loadAccessRequests();
  }, [checking, getToken]);

  async function handleCreateOlympiad(e) {
    e.preventDefault();
    if (!newName.trim()) return;

    setCreateStatus('submitting');
    setCreateError('');

    try {
      const created = await createOlympiad({
        name: newName.trim(),
        timezone: newTimezone.trim(),
        description: newDescription.trim() || null,
        grades: newGrades.trim() || null,
        startDate: newStartDate || null,
        endDate: newEndDate || null,
      });
      // Add the new olympiad to the list (with empty rounds)
      setOlympiads((prev) => [...prev, { ...created, rounds: [] }]);
      setStatus('ready');
      setNewName('');
      setNewTimezone('Africa/Johannesburg');
      setNewDescription('');
      setNewGrades('');
      setNewStartDate('');
      setNewEndDate('');
      setShowCreateForm(false);
      setCreateStatus('idle');
    } catch (err) {
      setCreateStatus('error');
      setCreateError(err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  }

  function toggleEdit(olympiad) {
    if (editingId === olympiad.id) {
      setEditingId(null);
      return;
    }
    setEditingId(olympiad.id);
    setEditName(olympiad.name || '');
    setEditTimezone(olympiad.timezone || '');
    setEditDescription(olympiad.description || '');
    setEditGrades(olympiad.grades || '');
    // Date inputs want YYYY-MM-DD; the API returns full ISO timestamps.
    setEditStartDate(olympiad.startDate ? olympiad.startDate.slice(0, 10) : '');
    setEditEndDate(olympiad.endDate ? olympiad.endDate.slice(0, 10) : '');
    setEditStatus('idle');
    setEditError('');
  }

  async function handleUpdateOlympiad(e, olympiad) {
    e.preventDefault();
    setEditStatus('submitting');
    setEditError('');

    try {
      const token = await getToken();
      const updated = await updateOlympiad(
        olympiad.id,
        {
          name: editName.trim(),
          timezone: editTimezone.trim(),
          description: editDescription.trim() || null,
          grades: editGrades.trim() || null,
          startDate: editStartDate || null,
          endDate: editEndDate || null,
        },
        token
      );
      setOlympiads((prev) =>
        prev.map((o) => (o.id === olympiad.id ? { ...o, ...updated, rounds: o.rounds } : o))
      );
      setEditingId(null);
      setEditStatus('idle');
    } catch (err) {
      setEditStatus('error');
      setEditError(err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  }

  async function handleAccessDecision(requestId, decision) {
    setDecidingId(requestId);
    setDecisionError('');

    try {
      const token = await getToken();
      if (decision === 'approve') {
        await approveAccessRequest(requestId, token);
      } else {
        await declineAccessRequest(requestId, token);
      }
      setAccessRequests((prev) => prev.filter((request) => request.id !== requestId));
    } catch (err) {
      setDecisionError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setDecidingId(null);
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
          <div style={{ marginBottom: '12px' }}>
            <label
              htmlFor="olympiad-description"
              style={{ display: 'block', marginBottom: '4px', fontSize: '0.9em' }}
            >
              Description (optional)
            </label>
            <textarea
              id="olympiad-description"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="What the olympiad is about — shown to educators"
              rows={3}
              className="block w-full rounded-md border border-lavender/30 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label
              htmlFor="olympiad-grades"
              style={{ display: 'block', marginBottom: '4px', fontSize: '0.9em' }}
            >
              Grades (optional)
            </label>
            <input
              id="olympiad-grades"
              type="text"
              value={newGrades}
              onChange={(e) => setNewGrades(e.target.value)}
              placeholder="e.g. Grade 8–12"
              className="block w-full rounded-md border border-lavender/30 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
            <div style={{ flex: 1 }}>
              <label
                htmlFor="olympiad-start-date"
                style={{ display: 'block', marginBottom: '4px', fontSize: '0.9em' }}
              >
                Start date (optional)
              </label>
              <input
                id="olympiad-start-date"
                type="date"
                value={newStartDate}
                onChange={(e) => setNewStartDate(e.target.value)}
                className="block w-full rounded-md border border-lavender/30 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div style={{ flex: 1 }}>
              <label
                htmlFor="olympiad-end-date"
                style={{ display: 'block', marginBottom: '4px', fontSize: '0.9em' }}
              >
                End date (optional)
              </label>
              <input
                id="olympiad-end-date"
                type="date"
                value={newEndDate}
                onChange={(e) => setNewEndDate(e.target.value)}
                className="block w-full rounded-md border border-lavender/30 bg-white px-3 py-2 text-sm"
              />
            </div>
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
                  gap: '8px',
                  marginBottom: '8px',
                }}
              >
                <h3 style={{ margin: 0, fontSize: '1.1em' }}>{olympiad.name}</h3>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => toggleEdit(olympiad)}
                    className="button"
                    style={{ fontSize: '0.8em', padding: '4px 10px' }}
                  >
                    {editingId === olympiad.id ? 'Close' : 'Edit details'}
                  </button>
                  <Link
                    href={`/rounds/new?olympiadId=${olympiad.id}&olympiadName=${encodeURIComponent(olympiad.name)}`}
                    className="button"
                    style={{ fontSize: '0.8em', padding: '4px 10px' }}
                  >
                    + Add Round
                  </Link>
                </div>
              </div>
              <p className="description" style={{ margin: '0 0 12px 0', fontSize: '0.85em' }}>
                {olympiad.timezone} · {olympiad.rounds.length} round
                {olympiad.rounds.length !== 1 ? 's' : ''}
              </p>

              {(olympiad.description ||
                olympiad.grades ||
                olympiad.startDate ||
                olympiad.endDate) && (
                <div style={{ marginBottom: '12px' }}>
                  {olympiad.description && (
                    <p className="description" style={{ margin: '0 0 4px', fontSize: '0.85em' }}>
                      {olympiad.description}
                    </p>
                  )}
                  {olympiad.grades && (
                    <p className="description" style={{ margin: 0, fontSize: '0.85em' }}>
                      🎓 Grades: {olympiad.grades}
                    </p>
                  )}
                  {(olympiad.startDate || olympiad.endDate) && (
                    <p className="description" style={{ margin: 0, fontSize: '0.85em' }}>
                      📅 {olympiad.startDate ? formatDate(olympiad.startDate) : 'TBC'} →{' '}
                      {olympiad.endDate ? formatDate(olympiad.endDate) : 'TBC'}
                    </p>
                  )}
                </div>
              )}

              {editingId === olympiad.id && (
                <form
                  onSubmit={(e) => handleUpdateOlympiad(e, olympiad)}
                  style={{
                    marginBottom: '12px',
                    padding: '12px',
                    border: '1px solid rgba(139, 92, 246, 0.2)',
                    borderRadius: '8px',
                  }}
                >
                  <div style={{ marginBottom: '12px' }}>
                    <label
                      htmlFor={`edit-name-${olympiad.id}`}
                      style={{ display: 'block', marginBottom: '4px', fontSize: '0.9em' }}
                    >
                      Olympiad name
                    </label>
                    <input
                      id={`edit-name-${olympiad.id}`}
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="block w-full rounded-md border border-lavender/30 bg-white px-3 py-2 text-sm"
                      required
                    />
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label
                      htmlFor={`edit-timezone-${olympiad.id}`}
                      style={{ display: 'block', marginBottom: '4px', fontSize: '0.9em' }}
                    >
                      Timezone
                    </label>
                    <input
                      id={`edit-timezone-${olympiad.id}`}
                      type="text"
                      value={editTimezone}
                      onChange={(e) => setEditTimezone(e.target.value)}
                      className="block w-full rounded-md border border-lavender/30 bg-white px-3 py-2 text-sm"
                      required
                    />
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label
                      htmlFor={`edit-description-${olympiad.id}`}
                      style={{ display: 'block', marginBottom: '4px', fontSize: '0.9em' }}
                    >
                      Description
                    </label>
                    <textarea
                      id={`edit-description-${olympiad.id}`}
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={3}
                      className="block w-full rounded-md border border-lavender/30 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label
                      htmlFor={`edit-grades-${olympiad.id}`}
                      style={{ display: 'block', marginBottom: '4px', fontSize: '0.9em' }}
                    >
                      Grades
                    </label>
                    <input
                      id={`edit-grades-${olympiad.id}`}
                      type="text"
                      value={editGrades}
                      onChange={(e) => setEditGrades(e.target.value)}
                      placeholder="e.g. Grade 8–12"
                      className="block w-full rounded-md border border-lavender/30 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <label
                        htmlFor={`edit-start-date-${olympiad.id}`}
                        style={{ display: 'block', marginBottom: '4px', fontSize: '0.9em' }}
                      >
                        Start date
                      </label>
                      <input
                        id={`edit-start-date-${olympiad.id}`}
                        type="date"
                        value={editStartDate}
                        onChange={(e) => setEditStartDate(e.target.value)}
                        className="block w-full rounded-md border border-lavender/30 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label
                        htmlFor={`edit-end-date-${olympiad.id}`}
                        style={{ display: 'block', marginBottom: '4px', fontSize: '0.9em' }}
                      >
                        End date
                      </label>
                      <input
                        id={`edit-end-date-${olympiad.id}`}
                        type="date"
                        value={editEndDate}
                        onChange={(e) => setEditEndDate(e.target.value)}
                        className="block w-full rounded-md border border-lavender/30 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  {editStatus === 'error' && (
                    <p style={{ color: 'red', fontSize: '0.9em', marginBottom: '8px' }}>
                      {editError}
                    </p>
                  )}
                  <button type="submit" disabled={editStatus === 'submitting'} className="button">
                    {editStatus === 'submitting' ? 'Saving...' : 'Save details'}
                  </button>
                </form>
              )}

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

      {/* Access requests section */}
      <h2 style={{ marginTop: '32px' }}>Access requests</h2>

      {accessStatus === 'loading' && <p className="description">Loading access requests...</p>}

      {accessStatus === 'error' && (
        <p className="message">Couldn&apos;t load access requests. Try refreshing the page.</p>
      )}

      {accessStatus === 'ready' &&
        (accessRequests.length === 0 ? (
          <p className="description">No pending access requests.</p>
        ) : (
          <ul style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {accessRequests.map((request) => (
              <li key={request.id} className="card" style={{ padding: '16px' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontWeight: 700 }}>
                      {request.school.name} — {request.olympiad.name}
                    </p>
                    <p className="description" style={{ margin: '4px 0 0', fontSize: '0.85em' }}>
                      Requested by{' '}
                      {request.requestedBy
                        ? `${request.requestedBy.name} (${request.requestedBy.email})`
                        : 'an educator'}{' '}
                      on {formatDate(request.requestedAt)}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => handleAccessDecision(request.id, 'approve')}
                      disabled={decidingId === request.id}
                      className="button"
                      style={{ fontSize: '0.85em', padding: '6px 14px' }}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAccessDecision(request.id, 'decline')}
                      disabled={decidingId === request.id}
                      className="button"
                      style={{ fontSize: '0.85em', padding: '6px 14px' }}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ))}

      {decisionError && <p className="message">{decisionError}</p>}
    </main>
  );
}
