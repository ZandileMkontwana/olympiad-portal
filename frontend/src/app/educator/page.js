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
  Trophy,
  Users,
  CalendarDays,
  ChevronDown,
} from 'lucide-react';

// Olympiad-first board for educators. The persistent sidebar lives in
// app/educator/layout.js; students are managed on the School Dashboard
// (/educator/school), never from this page. Olympiads are the top-level
// cards — clicking one expands its rounds, or an info card with a
// Request-access button for olympiads the school isn't part of yet.

/* ── helpers ──────────────────────────────────────────────────────────── */

const STATE_STYLES = {
  scheduled: { bg: 'rgba(139,92,246,0.08)', color: 'var(--c-t-6d3fd1)', label: 'Scheduled' },
  open: { bg: 'rgba(63,174,122,0.1)', color: 'var(--c-t-2b7854)', label: 'Open now' },
  closed: { bg: 'rgba(139,92,246,0.06)', color: 'var(--c-t-706391)', label: 'Closed' },
  released: { bg: 'rgba(224,168,62,0.12)', color: 'var(--c-t-85661e)', label: 'Released' },
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

function todayFormatted() {
  return new Date().toLocaleDateString('en-ZA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const ACCESS_BADGES = {
  pending: { label: 'Requested', bg: 'rgba(245,158,11,0.12)', color: 'var(--c-t-aa4f09)' },
  declined: { label: 'Declined', bg: 'rgba(224,97,95,0.1)', color: 'var(--c-t-b42318)' },
};

const META_CHIP_STYLE = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  background: 'var(--t-surface)',
  border: '1px solid rgba(139,92,246,0.1)',
  borderRadius: '20px',
  padding: '4px 12px',
  fontSize: '0.75em',
  fontWeight: 600,
  color: 'var(--c-t-4a4360)',
};

/* ── Stat card ────────────────────────────────────────────────────────── */

function StatCard({ icon: Icon, label, value, detail, tone }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${tone || 'purple'}`}>
        <Icon />
      </div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{detail}</span>
      </div>
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
        background: 'var(--t-surface)',
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
      <span style={{ flex: 1, fontSize: '0.88em', fontWeight: 600, color: 'var(--c-t-2d2640)' }}>
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
        <span style={{ fontSize: '0.7em', color: 'var(--c-t-706391)', flexShrink: 0 }}>
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
        background: 'var(--c-bg-fbfaff)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <p style={{ margin: 0, color: 'var(--c-t-4a4360)', fontSize: '0.88em', lineHeight: 1.5 }}>
        {olympiad.description || 'No description yet.'}
      </p>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <span style={META_CHIP_STYLE}>
          {'\ud83d\udcc5'} {dateRange}
        </span>
        <span style={META_CHIP_STYLE}>
          {'\ud83c\udf93'} {olympiad.grades || 'TBC'}
        </span>
      </div>

      <div>
        <p
          style={{
            margin: '0 0 6px',
            fontSize: '0.68em',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontWeight: 700,
            color: 'var(--c-t-706391)',
          }}
        >
          Learners per school
        </p>
        {counts.length === 0 ? (
          <p style={{ margin: 0, fontSize: '0.82em', color: 'var(--c-t-706391)' }}>
            No learners registered yet.
          </p>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              background: 'var(--t-surface)',
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
                  color: 'var(--c-t-4a4360)',
                }}
              >
                <span style={{ fontWeight: 600 }}>{entry.schoolName}</span>
                <span style={{ color: 'var(--c-t-706391)' }}>
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
            color: 'var(--c-t-92600a)',
            fontSize: '0.8em',
          }}
        >
          {'\u23f3'} Access requested — waiting for the organiser to approve.
        </p>
      ) : (
        <div>
          {declined && (
            <p style={{ margin: '0 0 6px', fontSize: '0.78em', color: 'var(--c-t-b42318)' }}>
              Your previous request was declined — you can ask again.
            </p>
          )}
          <button
            type="button"
            onClick={() => onRequestAccess(olympiad)}
            disabled={requesting}
            style={{
              background: requesting ? 'var(--c-bg-c9bdf0)' : 'linear-gradient(135deg, #8b5cf6, #6d3fd1)',
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
            {requesting ? 'Requesting\u2026' : declined ? 'Request access again' : 'Request access'}
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
        className="round-row"
        style={{ cursor: 'pointer', position: 'relative', padding: '13px 0', border: 'none' }}
        onClick={onToggle}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        <div className={`round-status ${olympiadTone(index)}`}>
          <Trophy />
        </div>
        <div className="test-main">
          <strong>
            {olympiad.name}
            {isUpcoming && (
              <span
                style={{
                  background: 'rgba(245,158,11,0.1)',
                  color: 'var(--c-t-aa4f09)',
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
                  color: 'var(--c-t-277751)',
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
          <span>
            {dateRange ? dateRange : 'Dates TBC'}
            {' · '}
            {rounds.length} round{rounds.length !== 1 ? 's' : ''}
            {openCount > 0 && ` · ${openCount} open`}
            {scheduledCount > 0 && ` · ${scheduledCount} scheduled`}
          </span>
          <div className="round-meta">
            {dateRange && (
              <span>
                <CalendarDays /> {dateRange}
              </span>
            )}
            <span>
              <Users /> {rounds.length} round{rounds.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        {badge && (
          <span
            style={{
              background: badge.bg,
              color: badge.color,
              padding: '3px 10px',
              borderRadius: '20px',
              fontSize: '12px',
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
            color: 'var(--c-t-716583)',
            transform: expanded ? 'rotate(90deg)' : 'none',
            transition: 'transform 0.15s ease',
            flexShrink: 0,
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
              background: 'var(--c-bg-faf8ff)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {rounds.length === 0 ? (
              <p style={{ margin: 0, color: 'var(--c-t-706391)', fontSize: '0.85em', padding: '6px 4px' }}>
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
        console.error('Failed to fetch olympiads:', err);
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
    return <div style={{ padding: '48px 0', fontSize: '14px', color: 'var(--c-t-6d667c)' }}>Loading...</div>;
  }

  const openCount = roundsByState.open.length;
  const scheduledCount = roundsByState.scheduled.length;
  const releasedCount = roundsByState.released.length;
  const firstName = (user?.name || user?.email || 'Educator').split(/[\s@]/)[0];

  return (
    <>
      {/* Welcome row */}
      <section className="welcome-row">
        <div>
          <p className="eyebrow">{todayFormatted()}</p>
          <h1>
            {greetingFor()}, {firstName} <span>&#10022;</span>
          </h1>
          <p className="subheading">
            Here&apos;s what&apos;s happening across your Olympiads today.
          </p>
        </div>
      </section>

      {/* Educator banner */}
      <section className="educator-banner">
        <div>
          <div className="hero-kicker">
            <Sparkles /> Educator workspace
          </div>
          <h2>Make every learner count.</h2>
          <p>Track participation, share feedback, and help your students find their edge.</p>
        </div>
        <div className="banner-stat">
          <strong>{memberOlympiads.length}</strong>
          <span>olympiads joined</span>
          <div>
            <i />
          </div>
        </div>
      </section>

      {/* Section heading */}
      <div className="section-heading">
        <div>
          <h2>School overview</h2>
          <p>Your programme at a glance.</p>
        </div>
      </div>

      {/* Stats grid */}
      <section className="stats-grid">
        <StatCard
          icon={Radio}
          label="Open rounds"
          value={openCount}
          detail={openCount > 0 ? 'Need attention' : 'None right now'}
          tone="green"
        />
        <StatCard
          icon={Trophy}
          label="Olympiads joined"
          value={memberOlympiads.length}
          detail={
            olympiads.length > memberOlympiads.length
              ? `${olympiads.length - memberOlympiads.length} pending access`
              : 'All approved'
          }
          tone="amber"
        />
        <StatCard
          icon={FileText}
          label="Released"
          value={releasedCount}
          detail={scheduledCount > 0 ? `${scheduledCount} scheduled` : 'No scheduled rounds'}
          tone="blue"
        />
        <StatCard
          icon={ClipboardList}
          label="Total rounds"
          value={allRounds.length}
          detail={`${openCount} currently active`}
          tone="purple"
        />
      </section>

      {/* Content grid */}
      <section className="content-grid">
        {/* Olympiad activity panel */}
        <div className="panel" data-tour="educator-rounds">
          <div className="panel-heading">
            <div>
              <h2>Olympiad activity</h2>
              <p>Monitor rounds and learner participation.</p>
            </div>
            {status === 'ready' && (
              <span
                style={{
                  background: 'rgba(139,92,246,0.08)',
                  color: 'var(--c-t-6d3fd1)',
                  padding: '3px 10px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 700,
                }}
              >
                {olympiads.length}
              </span>
            )}
          </div>

          {status === 'loading' && (
            <p style={{ color: 'var(--c-t-6d667c)', fontSize: '13px', marginTop: '18px' }}>
              Loading olympiads...
            </p>
          )}

          {status === 'empty' && (
            <p style={{ color: 'var(--c-t-6f667d)', fontSize: '12px', marginTop: '18px' }}>
              No olympiads available yet.
            </p>
          )}

          {status === 'error' && (
            <p role="alert" style={{ color: 'var(--c-t-b42318)', fontSize: '13px', marginTop: '18px' }}>
              Couldn&apos;t load olympiads. Try refreshing.
            </p>
          )}

          {status === 'ready' && (
            <>
              {accessError && (
                <p style={{ color: 'var(--c-t-b42318)', margin: '12px 0 0', fontSize: '12px' }}>
                  {accessError}
                </p>
              )}
              <div className="round-list">
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
        </div>
      </section>
    </>
  );
}
