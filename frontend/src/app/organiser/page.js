'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { useRequireRole } from '@/hooks/useRequireRole';
import ActivityFeed from '@/components/ActivityFeed';
import {
  listOlympiads,
  createOlympiad,
  updateOlympiad,
  fetchAccessRequests,
  approveAccessRequest,
  declineAccessRequest,
  listOlympiadOrganisers,
  addOlympiadOrganiser,
  removeOlympiadOrganiser,
  listAllOrganisers,
  ApiError,
} from '@/lib/api';
import {
  CalendarDays,
  ChevronRight,
  ClipboardList,
  History,
  Plus,
  Sparkles,
  UserPlus,
} from 'lucide-react';

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function greetingFor() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function olympiadTone(index) {
  const tones = ['violet', 'amber', 'blue'];
  return tones[index % tones.length];
}

function initialsFor(name) {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function OrganiserDashboard() {
  const { user, checking } = useRequireRole('organiser');
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

  // Co-organiser management: per-olympiad organiser lists and add/remove.
  const [organisersByOlympiad, setOrganisersByOlympiad] = useState({});
  const [showAddOrganiser, setShowAddOrganiser] = useState(null); // olympiadId
  const [selectedOrganiserId, setSelectedOrganiserId] = useState('');
  const [allOrganisers, setAllOrganisers] = useState([]);
  const [organiserStatus, setOrganiserStatus] = useState('idle');
  const [organiserError, setOrganiserError] = useState('');

  useEffect(() => {
    if (checking) return;

    async function fetchOlympiads() {
      try {
        // The token scopes the response to this organiser's own olympiads.
        const token = await getToken();
        const data = await listOlympiads(token);
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

  // Load co-organisers for each olympiad once the olympiad list is ready.
  useEffect(() => {
    if (olympiads.length === 0) return;

    async function loadOrganisers() {
      const token = await getToken();
      const map = {};
      for (const olympiad of olympiads) {
        try {
          const organisers = await listOlympiadOrganisers(olympiad.id, token);
          map[olympiad.id] = organisers;
        } catch {
          map[olympiad.id] = [];
        }
      }
      setOrganisersByOlympiad(map);
    }

    loadOrganisers();
  }, [olympiads, getToken]);

  // Load all organiser-role users for the "Add organiser" dropdown.
  useEffect(() => {
    async function loadAllOrganisers() {
      try {
        const token = await getToken();
        const data = await listAllOrganisers(token);
        setAllOrganisers(data);
      } catch {
        // Non-critical — the dropdown will just be empty.
      }
    }
    if (checking) return;
    loadAllOrganisers();
  }, [checking, getToken]);

  async function handleCreateOlympiad(e) {
    e.preventDefault();
    if (!newName.trim()) return;

    setCreateStatus('submitting');
    setCreateError('');

    try {
      const token = await getToken();
      const created = await createOlympiad(
        {
          name: newName.trim(),
          timezone: newTimezone.trim(),
          description: newDescription.trim() || null,
          grades: newGrades.trim() || null,
          startDate: newStartDate || null,
          endDate: newEndDate || null,
        },
        token
      );
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

  async function handleAddOrganiser(e, olympiadId) {
    e.preventDefault();
    if (!selectedOrganiserId) return;

    setOrganiserStatus('submitting');
    setOrganiserError('');

    try {
      const token = await getToken();
      const added = await addOlympiadOrganiser(olympiadId, selectedOrganiserId, token);
      setOrganisersByOlympiad((prev) => ({
        ...prev,
        [olympiadId]: [...(prev[olympiadId] || []), added],
      }));
      setShowAddOrganiser(null);
      setSelectedOrganiserId('');
      setOrganiserStatus('idle');
    } catch (err) {
      setOrganiserStatus('error');
      setOrganiserError(err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  }

  async function handleRemoveOrganiser(olympiadId, organiserId) {
    setOrganiserError('');
    try {
      const token = await getToken();
      await removeOlympiadOrganiser(olympiadId, organiserId, token);
      setOrganisersByOlympiad((prev) => ({
        ...prev,
        [olympiadId]: (prev[olympiadId] || []).filter((o) => o.organiserId !== organiserId),
      }));
    } catch (err) {
      setOrganiserError(err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  }

  if (checking) {
    return (
      <p style={{ padding: '48px', fontSize: '14px', color: 'var(--c-t-6d667c)' }}>Loading...</p>
    );
  }

  const firstName = (user?.name || user?.email || 'Organiser').split(/[\s@]/)[0];

  return (
    <>
      {/* Welcome row */}
      <div className="organiser-welcome-row">
        <div>
          <p className="organiser-eyebrow">
            <Sparkles size={14} /> Your organiser space
          </p>
          <h1>
            {greetingFor()}, {firstName}.
          </h1>
          <p className="organiser-subtitle">Here is what is happening across your Olympiads.</p>
        </div>
        <button
          className="primary-action"
          data-tour="organiser-create"
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          <Plus size={17} /> {showCreateForm ? 'Close form' : 'Create Olympiad'}
        </button>
      </div>

      {/* Create olympiad form (inline) */}
      {showCreateForm && (
        <form
          onSubmit={handleCreateOlympiad}
          className="dashboard-panel"
          style={{ marginTop: '20px', padding: '21px' }}
        >
          <span className="command-eyebrow">
            <Plus size={13} /> New Olympiad
          </span>
          <h2 style={{ fontSize: '18px', letterSpacing: '-0.04em', margin: '8px 0 16px' }}>
            Set up a new Olympiad
          </h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
              gap: '12px',
            }}
          >
            <div>
              <label
                htmlFor="olympiad-name"
                style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}
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
            <div>
              <label
                htmlFor="timezone"
                style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}
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
          </div>

          <div style={{ marginTop: '12px' }}>
            <label
              htmlFor="olympiad-description"
              style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}
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

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
              gap: '12px',
              marginTop: '12px',
            }}
          >
            <div>
              <label
                htmlFor="olympiad-grades"
                style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}
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
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <label
                  htmlFor="olympiad-start-date"
                  style={{
                    display: 'block',
                    marginBottom: '4px',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  Start date
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
                  style={{
                    display: 'block',
                    marginBottom: '4px',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  End date
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
          </div>

          {createStatus === 'error' && (
            <p
              role="alert"
              style={{ color: 'var(--c-t-b42318)', fontSize: '12px', marginTop: '10px' }}
            >
              {createError}
            </p>
          )}

          <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
            <button
              type="submit"
              disabled={createStatus === 'submitting'}
              className="primary-action"
            >
              {createStatus === 'submitting' ? 'Creating...' : 'Create Olympiad'}
            </button>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              style={{
                background: 'transparent',
                border: '1px solid var(--c-bd-ebe7f4)',
                borderRadius: '9px',
                padding: '12px 16px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                color: 'var(--c-t-6d667f)',
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Dashboard grid: Olympiads + Access requests */}
      <section className="organiser-dashboard-grid" aria-label="Organiser dashboard overview">
        {/* Olympiads panel */}
        <article className="dashboard-panel olympiad-panel" data-tour="organiser-olympiads">
          <div className="dashboard-panel-heading">
            <div>
              <span className="command-eyebrow">
                <ClipboardList size={13} /> Your workspace
              </span>
              <h2>Olympiads you&apos;ve posted</h2>
              <p>Manage events, rounds, and registration windows.</p>
            </div>
            {status === 'ready' && (
              <span className="nav-count" style={{ flex: '0 0 auto' }}>
                {olympiads.length}
              </span>
            )}
          </div>

          {status === 'loading' && (
            <p style={{ color: 'var(--c-t-6d667c)', fontSize: '13px', marginTop: '18px' }}>
              Loading olympiads...
            </p>
          )}

          {status === 'error' && (
            <p
              role="alert"
              style={{ color: 'var(--c-t-b42318)', fontSize: '13px', marginTop: '18px' }}
            >
              Couldn&apos;t load olympiads. Try refreshing.
            </p>
          )}

          {status === 'empty' && !showCreateForm && (
            <div style={{ marginTop: '18px' }}>
              <p style={{ color: 'var(--c-t-6d667c)', fontSize: '13px' }}>
                No olympiads yet. Create one to get started.
              </p>
              <button
                onClick={() => setShowCreateForm(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--violet)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: '12px',
                  padding: 0,
                  marginTop: '6px',
                }}
              >
                + Create your first Olympiad
              </button>
            </div>
          )}

          {status === 'ready' && (
            <div className="mini-event-list">
              {olympiads.map((olympiad, idx) => (
                <div key={olympiad.id}>
                  <div
                    className="mini-event"
                    style={{ cursor: 'pointer', position: 'relative' }}
                    onClick={() => toggleEdit(olympiad)}
                    role="button"
                    tabIndex={0}
                    aria-expanded={editingId === olympiad.id}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleEdit(olympiad);
                      }
                    }}
                  >
                    <span className={`event-dot ${olympiadTone(idx)}`} />
                    <span>
                      <strong>{olympiad.name}</strong>
                      <small>
                        {olympiad.timezone} &middot; {olympiad.rounds.length} round
                        {olympiad.rounds.length !== 1 ? 's' : ''}
                        {olympiad.startDate ? ` · from ${formatDate(olympiad.startDate)}` : ''}
                      </small>
                    </span>
                    <ChevronRight size={15} />
                  </div>

                  {/* Expanded edit form */}
                  {editingId === olympiad.id && (
                    <form
                      onSubmit={(e) => handleUpdateOlympiad(e, olympiad)}
                      style={{
                        margin: '8px 0 12px',
                        padding: '14px',
                        border: '1px solid rgba(139, 92, 246, 0.15)',
                        borderRadius: '10px',
                        background: 'var(--c-bg-faf8ff)',
                      }}
                    >
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
                          gap: '10px',
                        }}
                      >
                        <div>
                          <label
                            htmlFor={`edit-name-${olympiad.id}`}
                            style={{
                              display: 'block',
                              marginBottom: '4px',
                              fontSize: '13px',
                              fontWeight: 600,
                            }}
                          >
                            Name
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
                        <div>
                          <label
                            htmlFor={`edit-timezone-${olympiad.id}`}
                            style={{
                              display: 'block',
                              marginBottom: '4px',
                              fontSize: '13px',
                              fontWeight: 600,
                            }}
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
                      </div>

                      <div style={{ marginTop: '10px' }}>
                        <label
                          htmlFor={`edit-description-${olympiad.id}`}
                          style={{
                            display: 'block',
                            marginBottom: '4px',
                            fontSize: '13px',
                            fontWeight: 600,
                          }}
                        >
                          Description
                        </label>
                        <textarea
                          id={`edit-description-${olympiad.id}`}
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          rows={2}
                          className="block w-full rounded-md border border-lavender/30 bg-white px-3 py-2 text-sm"
                        />
                      </div>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
                          gap: '10px',
                          marginTop: '10px',
                        }}
                      >
                        <div>
                          <label
                            htmlFor={`edit-grades-${olympiad.id}`}
                            style={{
                              display: 'block',
                              marginBottom: '4px',
                              fontSize: '13px',
                              fontWeight: 600,
                            }}
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
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <div style={{ flex: 1 }}>
                            <label
                              htmlFor={`edit-start-date-${olympiad.id}`}
                              style={{
                                display: 'block',
                                marginBottom: '4px',
                                fontSize: '13px',
                                fontWeight: 600,
                              }}
                            >
                              Start
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
                              style={{
                                display: 'block',
                                marginBottom: '4px',
                                fontSize: '13px',
                                fontWeight: 600,
                              }}
                            >
                              End
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
                      </div>

                      {editStatus === 'error' && (
                        <p
                          role="alert"
                          style={{ color: 'var(--c-t-b42318)', fontSize: '13px', marginTop: '8px' }}
                        >
                          {editError}
                        </p>
                      )}

                      <div
                        style={{
                          marginTop: '12px',
                          display: 'flex',
                          gap: '8px',
                          alignItems: 'center',
                        }}
                      >
                        <button
                          type="submit"
                          disabled={editStatus === 'submitting'}
                          className="button"
                          style={{ fontSize: '13px', padding: '6px 14px' }}
                        >
                          {editStatus === 'submitting' ? 'Saving...' : 'Save details'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--c-t-6d667f)',
                            fontSize: '13px',
                            cursor: 'pointer',
                          }}
                        >
                          Cancel
                        </button>
                      </div>

                      {/* Rounds list */}
                      {olympiad.rounds.length > 0 && (
                        <div style={{ marginTop: '14px' }}>
                          <p
                            style={{
                              fontSize: '13px',
                              fontWeight: 700,
                              marginBottom: '6px',
                              color: 'var(--c-t-6d667f)',
                            }}
                          >
                            Rounds
                          </p>
                          <ul style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {olympiad.rounds.map((round) => {
                              let href = `/educator/round_view?id=${round.id}`;
                              if (round.state === 'open' || round.state === 'scheduled') {
                                href = `/rounds/${round.id}/papers`;
                              } else if (round.state === 'closed' || round.state === 'released') {
                                href = `/rounds/${round.id}/closed_round`;
                              }
                              return (
                                <li
                                  key={round.id}
                                  style={{ display: 'flex', gap: '4px', alignItems: 'stretch' }}
                                >
                                  <Link
                                    href={href}
                                    style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      padding: '6px 10px',
                                      borderRadius: '6px',
                                      border: '1px solid rgba(139, 92, 246, 0.15)',
                                      textDecoration: 'none',
                                      fontSize: '12px',
                                      flex: 1,
                                      background: 'var(--c-bg-ffffff)',
                                    }}
                                  >
                                    <span>{round.name}</span>
                                    <span
                                      style={{
                                        textTransform: 'capitalize',
                                        opacity: 0.6,
                                        fontSize: '13px',
                                      }}
                                    >
                                      {round.state}
                                    </span>
                                  </Link>
                                  <Link
                                    href={`/rounds/${round.id}/notifications`}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      padding: '6px 10px',
                                      borderRadius: '6px',
                                      border: '1px solid rgba(139, 92, 246, 0.15)',
                                      textDecoration: 'none',
                                      fontSize: '13px',
                                      color: 'rgba(139, 92, 246, 0.9)',
                                      background: 'var(--c-bg-ffffff)',
                                    }}
                                  >
                                    Notifications
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}

                      {olympiad.rounds.length === 0 ? (
                        <div style={{ marginTop: '12px' }}>
                          <Link
                            href={`/organiser/rounds/new?olympiadId=${olympiad.id}&olympiadName=${encodeURIComponent(olympiad.name)}`}
                            className="panel-create"
                            style={{ fontSize: '13px' }}
                          >
                            <Plus size={13} /> Add a round
                          </Link>
                        </div>
                      ) : (
                        <div style={{ marginTop: '8px' }}>
                          <Link
                            href={`/organiser/rounds/new?olympiadId=${olympiad.id}&olympiadName=${encodeURIComponent(olympiad.name)}`}
                            style={{
                              fontSize: '12px',
                              color: 'rgba(139, 92, 246, 0.9)',
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Plus size={12} /> Add another round
                          </Link>
                        </div>
                      )}

                      {/* Co-organisers section */}
                      <div
                        style={{
                          marginTop: '14px',
                          borderTop: '1px solid var(--c-bd-f0edf6)',
                          paddingTop: '12px',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '6px',
                          }}
                        >
                          <strong style={{ fontSize: '13px', color: 'var(--c-t-6d667f)' }}>
                            Co-organisers
                          </strong>
                          <button
                            type="button"
                            onClick={() =>
                              setShowAddOrganiser(
                                showAddOrganiser === olympiad.id ? null : olympiad.id
                              )
                            }
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--violet)',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            {showAddOrganiser === olympiad.id ? 'Cancel' : '+ Add'}
                          </button>
                        </div>

                        {(organisersByOlympiad[olympiad.id] || []).length === 0 ? (
                          <p
                            style={{
                              fontSize: '13px',
                              fontStyle: 'italic',
                              color: 'var(--c-t-6f667d)',
                              margin: '2px 0',
                            }}
                          >
                            No organisers yet.
                          </p>
                        ) : (
                          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 4px 0' }}>
                            {(organisersByOlympiad[olympiad.id] || []).map((org) => (
                              <li
                                key={org.id}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  padding: '3px 0',
                                  fontSize: '13px',
                                  borderBottom: '1px solid rgba(139, 92, 246, 0.08)',
                                }}
                              >
                                <span>
                                  {org.name} ({org.email})
                                  {org.isCreator && (
                                    <span
                                      style={{
                                        marginLeft: '4px',
                                        fontSize: '12px',
                                        color: 'rgba(139, 92, 246, 0.6)',
                                      }}
                                    >
                                      creator
                                    </span>
                                  )}
                                </span>
                                {!org.isCreator && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleRemoveOrganiser(olympiad.id, org.organiserId)
                                    }
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: 'var(--c-t-b42318)',
                                      cursor: 'pointer',
                                      fontSize: '12px',
                                    }}
                                  >
                                    Remove
                                  </button>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}

                        {showAddOrganiser === olympiad.id && (
                          <form
                            onSubmit={(e) => handleAddOrganiser(e, olympiad.id)}
                            style={{
                              display: 'flex',
                              gap: '6px',
                              alignItems: 'center',
                              marginTop: '6px',
                            }}
                          >
                            <select
                              aria-label="Organiser to add as co-organiser"
                              value={selectedOrganiserId}
                              onChange={(e) => setSelectedOrganiserId(e.target.value)}
                              style={{
                                flex: 1,
                                padding: '4px 6px',
                                borderRadius: '6px',
                                border: '1px solid rgba(139, 92, 246, 0.25)',
                                fontSize: '13px',
                              }}
                              required
                            >
                              <option value="">Select an organiser...</option>
                              {allOrganisers
                                .filter(
                                  (o) =>
                                    !(organisersByOlympiad[olympiad.id] || []).some(
                                      (existing) => existing.organiserId === o.id
                                    )
                                )
                                .map((o) => (
                                  <option key={o.id} value={o.id}>
                                    {o.name} ({o.email})
                                  </option>
                                ))}
                            </select>
                            <button
                              type="submit"
                              disabled={organiserStatus === 'submitting'}
                              className="button"
                              style={{ fontSize: '12px', padding: '4px 10px' }}
                            >
                              {organiserStatus === 'submitting' ? 'Adding...' : 'Add'}
                            </button>
                          </form>
                        )}

                        {organiserError && (
                          <p
                            role="alert"
                            style={{
                              color: 'var(--c-t-b42318)',
                              fontSize: '12px',
                              margin: '4px 0 0',
                            }}
                          >
                            {organiserError}
                          </p>
                        )}
                      </div>
                    </form>
                  )}
                </div>
              ))}
            </div>
          )}

          {status === 'ready' && olympiads.length > 0 && (
            <Link
              href="/organiser"
              className="panel-create"
              onClick={(e) => {
                e.preventDefault();
                setShowCreateForm(true);
              }}
            >
              <Plus size={15} /> Post a new Olympiad
            </Link>
          )}
        </article>

        {/* Access requests panel */}
        <article className="dashboard-panel requests-panel">
          <div className="dashboard-panel-heading">
            <div>
              <span className="command-eyebrow">
                <UserPlus size={13} /> Access requests{' '}
                {accessStatus === 'ready' && accessRequests.length > 0 && (
                  <b className="request-count">{accessRequests.length}</b>
                )}
              </span>
              <h2>Educators waiting to join</h2>
              <p>Review school requests for your Olympiads.</p>
            </div>
          </div>

          {accessStatus === 'loading' && (
            <p style={{ color: 'var(--c-t-6d667c)', fontSize: '13px', marginTop: '18px' }}>
              Loading access requests...
            </p>
          )}

          {accessStatus === 'error' && (
            <p
              role="alert"
              style={{ color: 'var(--c-t-b42318)', fontSize: '13px', marginTop: '18px' }}
            >
              Couldn&apos;t load requests.
            </p>
          )}

          {accessStatus === 'ready' && accessRequests.length === 0 && (
            <p style={{ color: 'var(--c-t-6f667d)', fontSize: '12px', marginTop: '18px' }}>
              No pending access requests.
            </p>
          )}

          {accessStatus === 'ready' && accessRequests.length > 0 && (
            <div className="request-list">
              {accessRequests.map((request) => (
                <div className="request-row" key={request.id}>
                  <span className="request-avatar">
                    {initialsFor(request.school?.name || request.requestedBy?.name || '??')}
                  </span>
                  <span>
                    <strong>{request.school?.name}</strong>
                    <small>
                      {request.olympiad?.name}
                      {request.requestedBy ? ` · ${request.requestedBy.name}` : ''}
                      {` · ${formatDate(request.requestedAt)}`}
                    </small>
                  </span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      type="button"
                      onClick={() => handleAccessDecision(request.id, 'approve')}
                      disabled={decidingId === request.id}
                      className="request-review"
                      style={{ background: 'var(--c-bg-e6f7ed)', color: 'var(--c-t-1a7a3a)' }}
                    >
                      {decidingId === request.id ? '...' : 'Approve'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAccessDecision(request.id, 'decline')}
                      disabled={decidingId === request.id}
                      className="request-review"
                    >
                      {decidingId === request.id ? '...' : 'Decline'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {decisionError && (
            <p
              role="alert"
              style={{ color: 'var(--c-t-b42318)', fontSize: '13px', marginTop: '8px' }}
            >
              {decisionError}
            </p>
          )}
        </article>
      </section>

      {/* Activity panel */}
      <section
        className="organiser-activity-panel"
        aria-label="Recent activity"
        data-tour="organiser-activity"
      >
        <div className="dashboard-panel-heading">
          <div>
            <span className="command-eyebrow">
              <History size={13} /> Recent activity
            </span>
            <h2>What&apos;s moving across your workspace</h2>
          </div>
          <Link href="/organiser/replay" className="panel-link">
            Open Replay <ChevronRight size={14} />
          </Link>
        </div>

        <ActivityFeed />
      </section>
    </>
  );
}
