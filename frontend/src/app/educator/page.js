'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRequireRole } from '@/hooks/useRequireRole';
import { listOlympiads } from '@/lib/api';

// Rounds board for educators. The persistent sidebar lives in
// app/educator/layout.js; students are managed on the School Dashboard
// (/educator/school), never from this page.

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

/* ── Stat card ────────────────────────────────────────────────────────── */

function StatCard({ icon, label, value, accent }) {
  return (
    <div
      style={{
        flex: 1,
        background: 'white',
        borderRadius: '14px',
        padding: '18px 20px',
        boxShadow: '0 2px 10px rgba(139,92,246,0.08)',
        border: '1px solid rgba(139,92,246,0.1)',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        minWidth: '180px',
      }}
    >
      <div
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '12px',
          background: accent || 'linear-gradient(135deg, #8b5cf6, #6d3fd1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.3em',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <p
          style={{ margin: 0, fontSize: '1.5em', fontWeight: 700, color: '#2d2640', lineHeight: 1 }}
        >
          {value}
        </p>
        <p style={{ margin: '4px 0 0', fontSize: '0.8em', color: '#8b7fa8' }}>{label}</p>
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
          borderRadius: '18px',
          padding: '28px',
          border: '1px solid rgba(139,92,246,0.12)',
          textAlign: 'center',
        }}
      >
        <p style={{ fontSize: '2em', margin: '0 0 8px' }}>✨</p>
        <p style={{ margin: 0, color: '#6b6480', fontSize: '0.9em' }}>
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
        borderRadius: '18px',
        padding: '26px 28px',
        color: 'white',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 10px 28px rgba(91,33,182,0.28)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          right: '-30px',
          top: '-30px',
          width: '140px',
          height: '140px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.07)',
        }}
      />
      <p
        style={{
          margin: 0,
          fontSize: '0.72em',
          opacity: 0.75,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          fontWeight: 600,
        }}
      >
        Next up
      </p>
      <h3 style={{ margin: '6px 0 0', fontSize: '1.4em', fontWeight: 800 }}>{round.name}</h3>
      <p style={{ margin: '4px 0 0', fontSize: '0.82em', opacity: 0.85 }}>{olympiadName}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '16px' }}>
        <span
          style={{
            background: 'rgba(255,255,255,0.15)',
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '0.78em',
            fontWeight: 700,
          }}
        >
          {style.label}
        </span>
        {actionLabel && countdown && (
          <span style={{ fontSize: '0.82em', opacity: 0.9 }}>
            {actionLabel} <strong>{countdown}</strong>
          </span>
        )}
      </div>
      <Link
        href={`/educator/round_view?id=${round.id}`}
        style={{
          display: 'inline-block',
          marginTop: '18px',
          background: 'white',
          color: '#6d3fd1',
          padding: '9px 18px',
          borderRadius: '10px',
          textDecoration: 'none',
          fontWeight: 700,
          fontSize: '0.85em',
        }}
      >
        View round →
      </Link>
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────────────────── */

export default function EducatorDashboard() {
  const { user, checking } = useRequireRole('educator');

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

  const allRounds = useMemo(() => {
    return olympiads.flatMap((o) => o.rounds.map((r) => ({ ...r, olympiadName: o.name })));
  }, [olympiads]);

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
      <div
        style={{
          display: 'flex',
          minHeight: '60vh',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <p style={{ color: '#8b7fa8' }}>Loading...</p>
      </div>
    );
  }

  const openCount = roundsByState.open.length;
  const scheduledCount = roundsByState.scheduled.length;
  const releasedCount = roundsByState.released.length;

  return (
    <>
      {/* Hero */}
      <div
        style={{
          background: 'linear-gradient(120deg, #7c3aed 0%, #6028c9 50%, #4c1d95 100%)',
          borderRadius: '22px',
          padding: '32px 36px',
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 12px 34px rgba(91,33,182,0.3)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            right: '-50px',
            top: '-50px',
            width: '200px',
            height: '200px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)',
          }}
        />
        <p
          style={{
            margin: 0,
            fontSize: '0.75em',
            opacity: 0.75,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}
        >
          Educator Portal
        </p>
        <h1 style={{ margin: '8px 0 0', fontSize: '2em', fontWeight: 800 }}>
          Welcome back, {user.name || user.email}
        </h1>
        <p style={{ margin: '8px 0 0', fontSize: '0.88em', opacity: 0.85 }}>
          Manage your rounds here — head to the School Dashboard to manage students.
        </p>
      </div>

      {/* Stats + Next up */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr 1.4fr',
          gap: '16px',
          marginTop: '22px',
          alignItems: 'stretch',
        }}
      >
        <StatCard
          icon="🟢"
          label="Open Rounds"
          value={openCount}
          accent="linear-gradient(135deg, #3fae7a, #2d8a5e)"
        />
        <StatCard
          icon="🕒"
          label="Scheduled"
          value={scheduledCount}
          accent="linear-gradient(135deg, #f59e0b, #d97706)"
        />
        <StatCard
          icon="📄"
          label="Released"
          value={releasedCount}
          accent="linear-gradient(135deg, #c99a2e, #b07d1e)"
        />
        <div style={{ gridRow: 'span 1' }}>
          <NextUpCard round={nextUpRound} olympiadName={nextUpRound?.olympiadName} />
        </div>
      </div>

      {/* Rounds board */}
      <div style={{ marginTop: '36px' }}>
        <h2 style={{ margin: '0 0 16px', fontSize: '1.15em', fontWeight: 700, color: '#2d2640' }}>
          Rounds
        </h2>

        {roundsStatus === 'loading' && <p style={{ color: '#8b7fa8' }}>Loading rounds...</p>}
        {roundsStatus === 'empty' && (
          <div
            style={{
              padding: '32px',
              textAlign: 'center',
              background: 'white',
              borderRadius: '14px',
              border: '1px solid rgba(139,92,246,0.1)',
            }}
          >
            <p style={{ color: '#8b7fa8', margin: 0 }}>No rounds yet.</p>
          </div>
        )}
        {roundsStatus === 'error' && <p style={{ color: '#e0615f' }}>Couldn&apos;t load rounds.</p>}

        {roundsStatus === 'ready' && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '16px',
            }}
          >
            {['open', 'scheduled', 'closed', 'released'].map((state) =>
              roundsByState[state].length > 0 ? (
                <div
                  key={state}
                  style={{
                    background: 'white',
                    borderRadius: '16px',
                    padding: '18px',
                    border: '1px solid rgba(139,92,246,0.1)',
                    boxShadow: '0 2px 10px rgba(139,92,246,0.06)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '14px',
                    }}
                  >
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: STATE_STYLES[state].color,
                      }}
                    />
                    <h3 style={{ margin: 0, fontSize: '0.9em', fontWeight: 700, color: '#2d2640' }}>
                      {STATE_STYLES[state].label}
                    </h3>
                    <span style={{ marginLeft: 'auto', fontSize: '0.75em', color: '#a89fc9' }}>
                      {roundsByState[state].length}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {roundsByState[state].map((round) => (
                      <Link
                        key={round.id}
                        href={`/educator/round_view?id=${round.id}`}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          background: STATE_STYLES[state].bg,
                          textDecoration: 'none',
                        }}
                      >
                        <span style={{ fontSize: '0.88em', fontWeight: 600, color: '#2d2640' }}>
                          {round.name}
                        </span>
                        <span style={{ fontSize: '0.72em', color: '#8b7fa8' }}>
                          {round.olympiadName}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null
            )}
          </div>
        )}
      </div>
    </>
  );
}
