'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { fetchMySittings, fetchMyResults, fetchMyRounds } from '@/lib/api';
import '@/app/auth.css';
import {
  Award,
  BarChart3,
  ChevronRight,
  ClipboardList,
  CheckCircle2,
  LineChart,
  Search,
  Sparkles,
  Trophy,
} from 'lucide-react';

// Student dashboard. The persistent sidebar lives in the (dashboard) layout;
// this page shows everything in one scroll — a single unified "My tests" list
// (started tests plus rounds not yet started) and one results list.

/* ── helpers ──────────────────────────────────────────────────────────── */

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('en-ZA', {
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

function testStatus(test) {
  if (test.completedAt) return 'completed';
  if (new Date(test.expiresAt) < new Date()) return 'expired';
  return 'in-progress';
}

function scoreHex(score) {
  if (score >= 70) return '#4caf7d';
  if (score >= 50) return '#c99a2e';
  return '#dc2626';
}

function scoreColor(score) {
  if (score >= 70) return '#4caf7d';
  if (score >= 50) return '#c99a2e';
  return '#dc2626';
}

function timeLeft(expiresAt) {
  const ms = new Date(expiresAt) - new Date();
  if (ms <= 0) return 'Expired';
  const mins = Math.floor(ms / 60000);
  const hrs = Math.floor(mins / 60);
  if (hrs > 0) return `${hrs}h ${mins % 60}m left`;
  return `${mins}m left`;
}

function olympiadTone(index) {
  const tones = ['violet', 'amber', 'blue'];
  return tones[index % tones.length];
}

const STATUS_STYLES = {
  'in-progress': { bg: 'rgba(76,175,125,0.1)', color: '#3fae7a', label: 'In progress' },
  'not-started': { bg: 'rgba(224,168,62,0.12)', color: '#c99a2e', label: 'Not started' },
  completed: { bg: 'rgba(139,92,246,0.08)', color: '#6d3fd1', label: 'Completed' },
  expired: { bg: 'rgba(139,127,168,0.1)', color: '#8b7fa8', label: 'Expired' },
  locked: { bg: 'rgba(139,127,168,0.06)', color: '#999', label: 'Locked' },
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

/* ── Performance trend chart (SVG polyline) ──────────────────────────── */

function TrendChart({ results }) {
  const sorted = useMemo(
    () => [...results].sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt)),
    [results]
  );

  if (sorted.length < 2) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0' }}>
        <BarChart3 size={24} style={{ color: '#8b7fa8', marginBottom: '8px' }} />
        <p style={{ color: '#8b7fa8', fontSize: '12px', margin: 0 }}>
          Your performance trend will appear here once you have at least two released results.
        </p>
      </div>
    );
  }

  const w = 480,
    h = 160,
    pad = 24;
  const maxScore = 100;
  const points = sorted.map((r, i) => {
    const x = pad + (i / (sorted.length - 1)) * (w - pad * 2);
    const y = h - pad - (r.score / maxScore) * (h - pad * 2);
    return { x, y, score: r.score, name: r.round.name };
  });
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${path} L ${points[points.length - 1].x} ${h - pad} L ${points[0].x} ${h - pad} Z`;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ fontSize: '11px', color: '#8b7fa8' }}>Last {sorted.length} results</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%' }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 25, 50, 75, 100].map((v) => (
          <line
            key={v}
            x1={pad}
            x2={w - pad}
            y1={h - pad - (v / 100) * (h - pad * 2)}
            y2={h - pad - (v / 100) * (h - pad * 2)}
            stroke="rgba(139,92,246,0.08)"
          />
        ))}
        <path d={areaPath} fill="url(#trendFill)" />
        <path
          d={path}
          fill="none"
          stroke="#7c3aed"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r="4"
              fill="white"
              stroke={scoreHex(p.score)}
              strokeWidth="2.5"
            />
            <title>{`${p.name}: ${Math.round(p.score)}%`}</title>
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ── Achievement badges ───────────────────────────────────────────────── */

function AchievementBadges({ results, sittings }) {
  const completed = sittings.filter((s) => testStatus(s) === 'completed').length;
  const best = results.length > 0 ? Math.max(...results.map((r) => r.score)) : 0;

  const badges = [
    {
      id: 'first',
      icon: '🎯',
      label: 'First Test',
      earned: completed >= 1,
      desc: 'Complete your first test',
    },
    {
      id: 'five',
      icon: '🔥',
      label: '5 Tests Done',
      earned: completed >= 5,
      desc: 'Complete 5 tests',
    },
    {
      id: 'excellent',
      icon: '⭐',
      label: 'Excellent Score',
      earned: best >= 75,
      desc: 'Score 75% or higher',
    },
    {
      id: 'perfect',
      icon: '💯',
      label: 'Perfect Score',
      earned: best === 100,
      desc: 'Score 100% on a test',
    },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
      {badges.map((b) => (
        <div
          key={b.id}
          title={b.desc}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            padding: '12px 8px',
            borderRadius: '10px',
            border: b.earned ? '1px solid rgba(224,168,62,0.4)' : '1px solid rgba(139,92,246,0.1)',
            background: b.earned ? 'rgba(224,168,62,0.05)' : 'transparent',
            opacity: b.earned ? 1 : 0.4,
            filter: b.earned ? 'none' : 'grayscale(1)',
            textAlign: 'center',
          }}
        >
          <span style={{ fontSize: '1.5em' }}>{b.icon}</span>
          <p style={{ margin: 0, fontSize: '11px', fontWeight: 600, color: '#241f38' }}>{b.label}</p>
        </div>
      ))}
    </div>
  );
}

/* ── My tests: one unified list ───────────────────────────────────────── */

function TestsSection({ tests, rounds }) {
  const items = useMemo(() => {
    const started = tests.map((t) => ({
      kind: 'sitting',
      id: t.id,
      name: t.round.name,
      status: testStatus(t),
      test: t,
    }));
    const notStarted = rounds
      .filter((r) => !r.sitting)
      .map((r) => ({
        kind: 'available',
        id: r.round.id,
        name: r.round.name,
        status: r.locked ? 'locked' : 'not-started',
        round: r.round,
        lockedReason: r.lockedReason,
      }));
    // Urgent first: in-progress, then tests waiting to be started (both by
    // their deadline), then finished/expired ones by most recent.
    const order = { 'in-progress': 0, 'not-started': 1, completed: 2, expired: 3 };
    return [...started, ...notStarted].sort((a, b) => {
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
      if (a.status === 'in-progress')
        return new Date(a.test.expiresAt) - new Date(b.test.expiresAt);
      if (a.status === 'not-started')
        return new Date(a.round.closeTime) - new Date(b.round.closeTime);
      return new Date(b.test.startedAt) - new Date(a.test.startedAt);
    });
  }, [tests, rounds]);

  const inProgress = items.filter((i) => i.status === 'in-progress').length;

  return (
    <div>
      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <ClipboardList size={24} style={{ color: '#8b7fa8', marginBottom: '8px' }} />
          <p style={{ color: '#8b7fa8', fontSize: '12px', margin: 0 }}>
            No tests yet. They will appear here once a round opens.
          </p>
        </div>
      ) : (
        <div className="mini-event-list" style={{ marginTop: '14px' }}>
          {items.map((item, idx) => {
            const isSitting = item.kind === 'sitting';
            const style = STATUS_STYLES[item.status] || STATUS_STYLES.completed;
            return (
              <div key={item.id}>
                <div className="mini-event" style={{ position: 'relative' }}>
                  <span className={`event-dot ${olympiadTone(idx)}`} />
                  <span>
                    <strong>{item.name}</strong>
                    <small>
                      {isSitting
                        ? `Started ${formatDate(item.test.startedAt)}`
                        : `Closes ${formatDate(item.round.closeTime)}`}
                      {item.status === 'in-progress' ? ` · ${timeLeft(item.test.expiresAt)}` : ''}
                    </small>
                  </span>
                  <span
                    style={{
                      background: style.bg,
                      color: style.color,
                      padding: '3px 10px',
                      borderRadius: '20px',
                      fontSize: '10px',
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {style.label}
                  </span>
                  {item.status === 'in-progress' && (
                    <Link
                      href={`/student/sit?id=${item.test.roundId}`}
                      onClick={(e) => {
                        if (!window.confirm('Continue this test? Your answers are saved.'))
                          e.preventDefault();
                      }}
                      className="request-review"
                      style={{ background: '#6c4fd8', color: '#fff', textDecoration: 'none', fontSize: '10px' }}
                    >
                      Resume
                    </Link>
                  )}
                  {item.status === 'not-started' && (
                    <Link
                      href={`/student/sit?id=${item.round.id}`}
                      onClick={(e) => {
                        if (
                          !window.confirm(`Start "${item.name}"? Once started, your time begins.`)
                        )
                          e.preventDefault();
                      }}
                      className="request-review"
                      style={{ background: '#6c4fd8', color: '#fff', textDecoration: 'none', fontSize: '10px' }}
                    >
                      Start test
                    </Link>
                  )}
                  {item.status === 'locked' && item.lockedReason && (
                    <span style={{ fontSize: '10px', color: '#999', fontStyle: 'italic' }}>{item.lockedReason}</span>
                  )}
                  {(item.status !== 'in-progress' && item.status !== 'not-started' && item.status !== 'locked') && (
                    <ChevronRight size={15} style={{ color: '#aaa1b7' }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── My results ───────────────────────────────────────────────────────── */

function ResultsSection({ results }) {
  const [search, setSearch] = useState('');
  const best = results.reduce((max, r) => Math.max(max, r.score), 0);
  const filtered = results.filter((r) => r.round.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      {results.length > 3 && (
        <div style={{ marginBottom: '12px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              border: '1px solid rgba(139,92,246,0.15)',
              borderRadius: '9px',
              padding: '8px 12px',
              background: '#fff',
            }}
          >
            <Search size={14} style={{ color: '#8b7fa8' }} />
            <input
              type="text"
              placeholder="Search by round name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                border: 'none',
                outline: 'none',
                flex: 1,
                fontSize: '12px',
                color: '#241f38',
                background: 'transparent',
              }}
            />
          </div>
        </div>
      )}

      {results.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <Trophy size={24} style={{ color: '#8b7fa8', marginBottom: '8px' }} />
          <p style={{ color: '#8b7fa8', fontSize: '12px', margin: 0 }}>No results released yet.</p>
        </div>
      ) : (
        <div className="mini-event-list" style={{ marginTop: '14px' }}>
          {filtered.map((result, idx) => (
            <Link
              href={`/student/result?id=${result.id}`}
              key={result.id}
              className="mini-event"
              style={{ textDecoration: 'none', cursor: 'pointer' }}
            >
              <span className={`event-dot ${olympiadTone(idx)}`} />
              <span>
                <strong>{result.round.name}</strong>
                <small>Submitted {formatDate(result.submittedAt)}</small>
              </span>
              <span
                style={{
                  fontSize: '16px',
                  fontWeight: 700,
                  color: scoreColor(result.score),
                  flexShrink: 0,
                }}
              >
                {Math.round(result.score)}%
              </span>
              <ChevronRight size={15} style={{ color: '#aaa1b7' }} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────────────────── */

export default function StudentDashboard() {
  const { user, checking, getToken } = useStudentAuth();

  const [sittings, setSittings] = useState([]);
  const [results, setResults] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    if (checking || !user) return;
    async function load() {
      try {
        const token = await getToken();
        const [mySittings, myResults, myRounds] = await Promise.all([
          fetchMySittings(token),
          fetchMyResults(token),
          fetchMyRounds(token),
        ]);
        setSittings(mySittings);
        setResults(myResults);
        setRounds(myRounds);
        setStatus('ready');
      } catch (err) {
        setStatus('error');
      }
    }
    load();
  }, [checking, user, getToken]);

  // `!user` covers the window after sign-out clears the session but before
  // the redirect away finishes — otherwise user.name below would crash.
  if (checking || !user || status === 'loading') {
    return (
      <div style={{ padding: '48px 0', fontSize: '14px', color: '#817a91' }}>
        Loading...
      </div>
    );
  }

  const completed = sittings.filter((s) => testStatus(s) === 'completed').length;
  const inProgress = sittings.filter((s) => testStatus(s) === 'in-progress');
  const resumeHref = inProgress.length > 0 ? `/student/sit?id=${inProgress[0].roundId}` : null;
  const bestScore =
    results.length > 0 ? `${Math.round(Math.max(...results.map((r) => r.score)))}%` : '\u2014';
  const avgScore =
    results.length > 0
      ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length)
      : null;

  const firstName = (user?.name || user?.email || 'Student').split(/[\s@]/)[0];
  const availableCount = rounds.filter((r) => !r.sitting && !r.locked).length;

  return (
    <>
      {/* Welcome row */}
      <div className="organiser-welcome-row">
        <div>
          <p className="organiser-eyebrow">
            <Sparkles size={14} /> Your student space
          </p>
          <h1>
            {greetingFor()}, {firstName}.
          </h1>
          <p className="organiser-subtitle">
            {inProgress.length > 0
              ? `You have ${inProgress.length} test${inProgress.length > 1 ? 's' : ''} in progress — ${timeLeft(inProgress[0].expiresAt)}.`
              : availableCount > 0
              ? `You have ${availableCount} test${availableCount > 1 ? 's' : ''} ready to take.`
              : 'All caught up — nothing due right now.'}
          </p>
        </div>
        {resumeHref && (
          <Link
            href={resumeHref}
            onClick={(e) => {
              if (!window.confirm('Continue this test? Your answers are saved.'))
                e.preventDefault();
            }}
            className="primary-action"
            style={{ textDecoration: 'none' }}
          >
            Resume test <ChevronRight size={15} />
          </Link>
        )}
      </div>

      {status === 'error' && (
        <div
          role="alert"
          className="dashboard-panel"
          style={{ marginTop: '20px', padding: '16px', borderColor: '#f3c2c2', background: '#fdf0f0' }}
        >
          <p style={{ color: '#8f2f2f', fontSize: '13px', margin: 0 }}>
            Couldn&apos;t load your tests or results. Try refreshing the page.
          </p>
        </div>
      )}

      {status === 'ready' && (
        <>
          {/* Stats row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '14px',
              marginTop: '24px',
            }}
          >
            <StatCard
              icon={<ClipboardList size={16} color="#fff" />}
              label="Tests"
              value={sittings.length}
            />
            <StatCard
              icon={<CheckCircle2 size={16} color="#fff" />}
              label="Completed"
              value={completed}
              accent="linear-gradient(135deg, #4caf7d, #2d8a5e)"
            />
            <StatCard
              icon={<BarChart3 size={16} color="#fff" />}
              label="Average"
              value={avgScore !== null ? `${avgScore}%` : '\u2014'}
              accent={avgScore !== null ? `linear-gradient(135deg, ${scoreColor(avgScore)}, ${scoreColor(avgScore)}dd)` : undefined}
            />
            <StatCard
              icon={<Trophy size={16} color="#fff" />}
              label="Best score"
              value={bestScore}
              accent={
                results.length > 0
                  ? `linear-gradient(135deg, ${scoreColor(Math.max(...results.map((r) => r.score)))}, ${scoreColor(Math.max(...results.map((r) => r.score)))}dd)`
                  : undefined
              }
            />
          </div>

          {/* Dashboard grid: Tests + Achievements/Trend */}
          <section className="organiser-dashboard-grid" aria-label="Student dashboard overview" style={{ marginTop: '20px' }}>
            {/* My tests panel */}
            <article className="dashboard-panel">
              <div className="dashboard-panel-heading">
                <div>
                  <span className="command-eyebrow">
                    <ClipboardList size={13} /> Assessments
                  </span>
                  <h2>My tests</h2>
                  <p>Start, resume, and review your test sittings.</p>
                </div>
                {inProgress.length > 0 && (
                  <span className="nav-count" style={{ flex: '0 0 auto' }}>
                    {inProgress.length} active
                  </span>
                )}
              </div>
              <TestsSection tests={sittings} rounds={rounds} />
            </article>

            {/* Right column: Trend + Achievements */}
            <article className="dashboard-panel">
              <div className="dashboard-panel-heading">
                <div>
                  <span className="command-eyebrow">
                    <LineChart size={13} /> Performance
                  </span>
                  <h2>Trend &amp; achievements</h2>
                  <p>Track your progress over time.</p>
                </div>
              </div>
              <TrendChart results={results} />
              <div style={{ marginTop: '16px', borderTop: '1px solid #f0edf6', paddingTop: '14px' }}>
                <span className="command-eyebrow" style={{ marginBottom: '10px', display: 'inline-flex' }}>
                  <Award size={13} /> Badges
                </span>
                <AchievementBadges results={results} sittings={sittings} />
              </div>
            </article>
          </section>

          {/* Results panel (full width) */}
          <section style={{ marginTop: '16px' }}>
            <article className="dashboard-panel">
              <div className="dashboard-panel-heading">
                <div>
                  <span className="command-eyebrow">
                    <CheckCircle2 size={13} /> Results
                  </span>
                  <h2>My results</h2>
                  <p>
                    {results.length > 0
                      ? `Best score: ${bestScore}`
                      : 'Your released results will appear here.'}
                  </p>
                </div>
                {results.length > 0 && (
                  <Link href={`/student/result?id=${results[0]?.id}`} className="panel-link">
                    View latest <ChevronRight size={14} />
                  </Link>
                )}
              </div>
              <ResultsSection results={results} />
            </article>
          </section>
        </>
      )}
    </>
  );
}
