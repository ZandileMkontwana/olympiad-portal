'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { useRequireRole } from '@/hooks/useRequireRole';
import { listOlympiads, requestOlympiadAccess } from '@/lib/api';
import '@/app/auth.css';
import {
  ChevronRight,
  ClipboardList,
  Clock,
  FileText,
  Radio,
  Sparkles,
} from 'lucide-react';

// Olympiad-first board for educators. The persistent sidebar lives in
// app/educator/layout.js; students are managed on the School Dashboard
// (/educator/school), never from this page. Olympiads are the top-level
// cards — clicking one expands its rounds, or an info card with a
// Request-access button for olympiads the school isn't part of yet.

/* ── helpers ──────────────────────────────────────────────────────────── */

const STATE_STYLES = {
  scheduled: { bg: 'rgba(139,92,246,0.08)', color: '#6d3fd1', label: 'Scheduled' },
  open: { bg: 'rgba(63,174,122,0.1)', color: '#3fae7a', label: 'Open now' },
  closed: { bg: 'rgba(139,92,246,0.06)', color: '#8b7fa8', label: 'Closed' },
  released: { bg: 'rgba(224,168,62,0.12)', color: '#c99a2e', label: 'Released' },
};

function timeUntil(iso) {
  const ms = new Date(iso) - new Date();
  if (ms <= 0) return null;
  const hrs = Math.floor(ms / 3600000);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `${days}d ${hrs % 24}h`;
  return `${hrs}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

function formatDate(iso, tz) {
  const opts = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  };
  if (tz) opts.timeZone = tz;
  return new Date(iso).toLocaleDateString('en-ZA', opts);
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

const ACCESS_BADGES = {
  pending: { label: 'Requested', bg: 'rgba(245,158,11,0.12)', color: '#b45309' },
  declined: { label: 'Declined', bg: 'rgba(224,97,95,0.1)', color: '#e0615f' },
};

const META_CHIP_STYLE = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  background: 'white',
  border: '1px solid rgba(139,92,246,0.1)',
  borderRadius: '20px',
  padding: '4px 12px',
  fontSize: '0.75em',
  fontWeight: 600,
  color: '#4a4360',
};

/* ── Stat card (organiser-matched) ────────────────────────────────────── */

function StatCard({ icon, label, value, accent }) {
  return (
    <div className="dashboard-panel" style={{ padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
        <div
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '9px',
            background: accent || 'linear-gradient(135deg, #8b5cf6, #6d3fd1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <div>
          <p style={{ margin: 0, fontSize: '1.25em', fontWeight: 700, color: '#241f38', lineHeight: 1 }}>
            {value}
          </p>
          <p style={{ margin: '3px 0 0', fontSize: '0.72em', color: '#6f6690' }}>{label}</p>
        </div>
      </div>
    </div>
  );
}

/* ── Next-up focus card ───────────────────────────────────────────────── */

function NextUpCard({ round, olympiadName }) {
  if (!round) {
    return (
      <div
        style={{
          background: 'linear-gradient(135deg, #ede6f8, #f5effa)',
          borderRadius: '14px',
          padding: '18px 22px',
          border: '1px solid rgba(139,92,246,0.12)',
          textAlign: 'center',
        }}
      >
        <Sparkles size={20} style={{ color: '#8b7fa8', marginBottom: '6px' }} />
        <p style={{ margin: 0, color: '#6b6480', fontSize: '0.85em' }}>
          No rounds need your attention right now.
        </p>
      </div>
    );
  }
  const style = STATE_STYLES[round.state] || STATE_STYLES.scheduled;
  const target = round.state === 'open' ? round.closeTime : round.openTime;
  const countdown = timeUntil(target);
  const actionLabel =
    round.state === 'open' ? 'closes in' : round.state === 'scheduled' ? 'opens in' : null;

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
        borderRadius: '14px',
        padding: '18px 22px',
        color: 'white',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 8px 22px rgba(91,33,182,0.26)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          right: '-30px',
          top: '-30px',
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.07)',
        }}
      />
      <p
        style={{
          margin: 0,
          fontSize: '0.68em',
          opacity: 0.75,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          fontWeight: 600,
        }}
      >
        Next up
      </p>
      <h3 style={{ margin: '4px 0 0', fontSize: '1.15em', fontWeight: 800 }}>{round.name}</h3>
      <p style={{ margin: '3px 0 0', fontSize: '0.78em', opacity: 0.85 }}>{olympiadName}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px' }}>
        <span
          style={{
            background: 'rgba(255,255,255,0.15)',
            padding: '3px 10px',
            borderRadius: '20px',
            fontSize: '0.72em',
            fontWeight: 700,
          }}
        >
          {style.label}
        </span>
        {actionLabel && countdown && (
          <span style={{ fontSize: '0.78em', opacity: 0.9 }}>
            {actionLabel} <strong>{countdown}</strong>
          </span>
        )}
      </div>
      <Link
        href={`/educator/round_view?id=${round.id}`}
        style={{
          display: 'inline-block',
          marginTop: '12px',
          background: 'white',
          color: '#6d3fd1',
          padding: '7px 14px',
          borderRadius: '8px',
          textDecoration: 'none',
          fontWeight: 700,
          fontSize: '0.8em',
        }}
      >
        View round →
      </Link>
    </div>
  );
}

/* ── Round row ────────────────────────────────────────────────────────── */

function RoundRow({ round }) {
  const style = STATE_STYLES[round.state] || STATE_STYLES.scheduled;
  const target = round.state === 'open' ? round.closeTime : round.openTime;
  const countdown = timeUntil(target);
  const actionLabel =
    round.state === 'open' ? 'closes in' : round.state === 'scheduled' ? 'opens in' : null;

  return (
    <Link
      href={`/educator/round_view?id=${round.id}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 12px',
        borderRadius: '10px',
        background: 'white',
        border: '1px solid rgba(139,92,246,0.1)',
        textDecoration: 'none',
      }}
    >
      <span
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: style.color,
          flexShrink: 0,
        }}
      />
      <span style={{ flex: 1, fontSize: '0.88em', fontWeight: 600, color: '#2d2640' }}>
        {round.name}
      </span>
      <span
        style={{
          background: style.bg,
          color: style.color,
          padding: '3px 10px',
          borderRadius: '20px',
          fontSize: '0.7em',
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {style.label}
      </span>
      {actionLabel && countdown && (
        <span style={{ fontSize: '0.7em', color: '#8b7fa8', flexShrink: 0 }}>
          {actionLabel} {countdown}
        </span>
      )}
    </Link>
  );
}

/* ── Olympiad info panel (access request) ─────────────────────────────── */

function OlympiadInfoPanel({ olympiad, onRequestAccess, requesting }) {
  const counts = olympiad.schoolEntrantCounts || [];
  const tz = olympiad.timezone || null;
  const start = olympiad.startDate ? formatDate(olympiad.startDate, tz) : null;
  const end = olympiad.endDate ? formatDate(olympiad.endDate, tz) : null;
  const dateRange = start && end ? `${start} → ${end}` : start || end || 'TBC';
  const declined = olympiad.schoolAccess === 'declined';

  return (
    <div
      style={{
        borderTop: '1px solid rgba(139,92,246,0.08)',
        padding: '14px',
        background: '#fbfaff',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <p style={{ margin: 0, color: '#4a4360', fontSize: '0.88em', lineHeight: 1.5 }}>
        {olympiad.description || 'No description yet.'}
      </p>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <span style={META_CHIP_STYLE}>📅 {dateRange}</span>
        <span style={META_CHIP_STYLE}>🎓 {olympiad.grades || 'TBC'}</span>
      </div>

      <div>
        <p
          style={{
            margin: '0 0 6px',
            fontSize: '0.68em',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontWeight: 700,
            color: '#8b7fa8',
          }}
        >
          Learners per school
        </p>
        {counts.length === 0 ? (
          <p style={{ margin: 0, fontSize: '0.82em', color: '#8b7fa8' }}>
            No learners registered yet.
          </p>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              background: 'white',
              border: '1px solid rgba(139,92,246,0.1)',
              borderRadius: '10px',
              padding: '10px 12px',
            }}
          >
            {counts.map((entry, index) => (
              <div
                key={`${entry.schoolName}-${index}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '10px',
                  fontSize: '0.82em',
                  color: '#4a4360',
                }}
              >
                <span style={{ fontWeight: 600 }}>{entry.schoolName}</span>
                <span style={{ color: '#8b7fa8' }}>
                  {entry.entrantCount} learner{entry.entrantCount !== 1 ? 's' : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {olympiad.schoolAccess === 'pending' ? (
        <p
          style={{
            margin: 0,
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.25)',
            borderRadius: '8px',
            padding: '9px 12px',
            color: '#92600a',
            fontSize: '0.8em',
          }}
        >
          ⏳ Access requested — waiting for the organiser to approve.
        </p>
      ) : (
        <div>
          {declined && (
            <p style={{ margin: '0 0 6px', fontSize: '0.78em', color: '#e0615f' }}>
              Your previous request was declined — you can ask again.
            </p>
          )}
          <button
            type="button"
            onClick={() => onRequestAccess(olympiad)}
            disabled={requesting}
            style={{
              background: requesting ? '#c9bdf0' : 'linear-gradient(135deg, #8b5cf6, #6d3fd1)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 16px',
              fontWeight: 700,
              fontSize: '0.8em',
              cursor: requesting ? 'default' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {requesting ? 'Requesting…' : declined ? 'Request access again' : 'Request access'}
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Olympiad accordion card ──────────────────────────────────────────── */

function OlympiadCard({ olympiad, expanded, onToggle, onRequestAccess, requestingAccess, index }) {
  const rounds = olympiad.rounds || [];
  const openCount = rounds.filter((r) => r.state === 'open').length;
  const scheduledCount = rounds.filter((r) => r.state === 'scheduled').length;
  const badge = ACCESS_BADGES[olympiad.schoolAccess];
  const showsRounds = !olympiad.schoolAccess || olympiad.schoolAccess === 'approved';
  const tz = olympiad.timezone || null;

  const start = olympiad.startDate ? formatDate(olympiad.startDate, tz) : null;
  const end = olympiad.endDate ? formatDate(olympiad.endDate, tz) : null;
  const dateRange = start && end ? `${start} → ${end}` : start || end || null;
  const now = new Date();
  const isUpcoming = olympiad.startDate && new Date(olympiad.startDate) > now;
  const isOngoing =
    olympiad.startDate &&
    new Date(olympiad.startDate) <= now &&
    olympiad.endDate &&
    new Date(olympiad.endDate) >= now;

  return (
    <div>
      <div
        className="mini-event"
        style={{ cursor: 'pointer', position: 'relative', padding: '13px 0' }}
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onToggle();
        }}
      >
        <span className={`event-dot ${olympiadTone(index)}`} />
        <span>
          <strong>
            {olympiad.name}
            {isUpcoming && (
              <span
                style={{
                  background: 'rgba(245,158,11,0.1)',
                  color: '#b45309',
                  padding: '1px 8px',
                  borderRadius: '10px',
                  fontSize: '0.85em',
                  fontWeight: 700,
                  marginLeft: '8px',
                }}
              >
                Upcoming
              </span>
            )}
            {isOngoing && (
              <span
                style={{
                  background: 'rgba(63,174,122,0.1)',
                  color: '#2d8a5e',
                  padding: '1px 8px',
                  borderRadius: '10px',
                  fontSize: '0.85em',
                  fontWeight: 700,
                  marginLeft: '8px',
                }}
              >
                Active
              </span>
            )}
          </strong>
          <small>
            {dateRange ? dateRange : 'Dates TBC'}
            {' · '}
            {rounds.length} round{rounds.length !== 1 ? 's' : ''}
            {openCount > 0 && ` · ${openCount} open`}
            {scheduledCount > 0 && ` · ${scheduledCount} scheduled`}
          </small>
        </span>
        {badge && (
          <span
            style={{
              background: badge.bg,
              color: badge.color,
              padding: '3px 10px',
              borderRadius: '20px',
              fontSize: '10px',
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {badge.label}
          </span>
        )}
        <ChevronRight
          size={15}
          style={{
            color: '#aaa1b7',
            transform: expanded ? 'rotate(90deg)' : 'none',
            transition: 'transform 0.15s ease',
          }}
        />
      </div>

      {expanded &&
        (showsRounds ? (
          <div
            style={{
              margin: '4px 0 8px',
              padding: '14px',
              border: '1px solid rgba(139,92,246,0.15)',
              borderRadius: '10px',
              background: '#faf8ff',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {rounds.length === 0 ? (
              <p style={{ margin: 0, color: '#8b7fa8', fontSize: '0.85em', padding: '6px 4px' }}>
                No rounds in this olympiad yet.
              </p>
            ) : (
              rounds.map((round) => <RoundRow key={round.id} round={round} />)
            )}
          </div>
        ) : (
          <OlympiadInfoPanel
            olympiad={olympiad}
            onRequestAccess={onRequestAccess}
            requesting={requestingAccess}
          />
        ))}
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────────────────── */

export default function EducatorDashboard() {
  const { user, checking } = useRequireRole('educator');
  const { getToken } = useAuth();

  const [olympiads, setOlympiads] = useState([]);
  const [status, setStatus] = useState('loading');
  const [expandedId, setExpandedId] = useState(null);
  const [requestingId, setRequestingId] = useState(null);
  const [accessError, setAccessError] = useState(null);

  useEffect(() => {
    if (checking) return;
    async function fetchOlympiads() {
      try {
        const token = await getToken();
        const data = await listOlympiads(token);
        setOlympiads(data);
        setStatus(data.length > 0 ? 'ready' : 'empty');
      } catch (err) {
        setStatus('error');
      }
    }
    fetchOlympiads();
  }, [checking, getToken]);

  function setAccessState(olympiadId, schoolAccess) {
    setOlympiads((prev) => prev.map((o) => (o.id === olympiadId ? { ...o, schoolAccess } : o)));
  }

  async function handleRequestAccess(olympiad) {
    setRequestingId(olympiad.id);
    setAccessError(null);
    // Optimistic — flip the card to its waiting state right away; rolled
    // back if the request fails.
    setAccessState(olympiad.id, 'pending');
    try {
      const token = await getToken();
      await requestOlympiadAccess(olympiad.id, token);
    } catch (err) {
      setAccessState(olympiad.id, olympiad.schoolAccess);
      setAccessError(err.message || 'Could not request access.');
    } finally {
      setRequestingId(null);
    }
  }

  // Rounds of olympiads the school isn't part of don't count towards the
  // stats or the next-up card — the educator can't act on them yet.
  const memberOlympiads = useMemo(
    () => olympiads.filter((o) => !o.schoolAccess || o.schoolAccess === 'approved'),
    [olympiads]
  );

  const allRounds = useMemo(() => {
    return memberOlympiads.flatMap((o) => o.rounds.map((r) => ({ ...r, olympiadName: o.name })));
  }, [memberOlympiads]);

  const nextUpRound = useMemo(() => {
    const open = allRounds
      .filter((r) => r.state === 'open')
      .sort((a, b) => new Date(a.closeTime) - new Date(b.closeTime));
    if (open.length > 0) return open[0];
    const scheduled = allRounds
      .filter((r) => r.state === 'scheduled')
      .sort((a, b) => new Date(a.openTime) - new Date(b.openTime));
    return scheduled[0] || null;
  }, [allRounds]);

  const roundsByState = useMemo(() => {
    const groups = { open: [], scheduled: [], closed: [], released: [] };
    allRounds.forEach((r) => {
      (groups[r.state] || groups.scheduled).push(r);
    });
    return groups;
  }, [allRounds]);

  if (checking) {
    return (
      <div style={{ padding: '48px 0', fontSize: '14px', color: '#817a91' }}>
        Loading...
      </div>
    );
  }

  const openCount = roundsByState.open.length;
  const scheduledCount = roundsByState.scheduled.length;
  const releasedCount = roundsByState.released.length;
  const firstName = (user?.name || user?.email || 'Educator').split(/[\s@]/)[0];

  return (
    <>
      {/* Welcome row */}
      <div className="organiser-welcome-row">
        <div>
          <p className="organiser-eyebrow">
            <Sparkles size={14} /> Your educator space
          </p>
          <h1>
            {greetingFor()}, {firstName}.
          </h1>
          <p className="organiser-subtitle">
            Here is what is happening across your Olympiads.
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr 1.4fr',
          gap: '14px',
          alignItems: 'stretch',
          marginTop: '24px',
        }}
      >
        <StatCard
          icon={<Radio size={16} color="#fff" />}
          label="Open Rounds"
          value={openCount}
          accent="linear-gradient(135deg, #3fae7a, #2d8a5e)"
        />
        <StatCard
          icon={<Clock size={16} color="#fff" />}
          label="Scheduled"
          value={scheduledCount}
          accent="linear-gradient(135deg, #f59e0b, #d97706)"
        />
        <StatCard
          icon={<FileText size={16} color="#fff" />}
          label="Released"
          value={releasedCount}
          accent="linear-gradient(135deg, #c99a2e, #b07d1e)"
        />
        <div style={{ gridRow: 'span 1' }}>
          <NextUpCard round={nextUpRound} olympiadName={nextUpRound?.olympiadName} />
        </div>
      </div>

      {/* Olympiads panel */}
      <section style={{ marginTop: '20px' }}>
        <article className="dashboard-panel">
          <div className="dashboard-panel-heading">
            <div>
              <span className="command-eyebrow">
                <ClipboardList size={13} /> Your workspace
              </span>
              <h2>Olympiads</h2>
              <p>Manage rounds, track access, and view learner progress.</p>
            </div>
            {status === 'ready' && (
              <span className="nav-count" style={{ flex: '0 0 auto' }}>
                {olympiads.length}
              </span>
            )}
          </div>

          {status === 'loading' && (
            <p style={{ color: '#817a91', fontSize: '13px', marginTop: '18px' }}>
              Loading olympiads...
            </p>
          )}

          {status === 'empty' && (
            <p style={{ color: '#92899f', fontSize: '12px', marginTop: '18px' }}>
              No olympiads available yet.
            </p>
          )}

          {status === 'error' && (
            <p style={{ color: 'red', fontSize: '13px', marginTop: '18px' }}>
              Couldn&apos;t load olympiads. Try refreshing.
            </p>
          )}

          {status === 'ready' && (
            <>
              {accessError && (
                <p style={{ color: '#e0615f', margin: '12px 0 0', fontSize: '12px' }}>
                  {accessError}
                </p>
              )}
              <div className="mini-event-list">
                {olympiads.map((o, idx) => (
                  <OlympiadCard
                    key={o.id}
                    olympiad={o}
                    index={idx}
                    expanded={expandedId === o.id}
                    onToggle={() => setExpandedId(expandedId === o.id ? null : o.id)}
                    onRequestAccess={handleRequestAccess}
                    requestingAccess={requestingId === o.id}
                  />
                ))}
              </div>
            </>
          )}
        </article>
      </section>
    </>
  );
}
