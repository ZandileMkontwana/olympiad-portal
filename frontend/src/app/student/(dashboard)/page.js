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
  ArrowRight,
  ClipboardList,
  ClipboardCheck,
  CheckCircle2,
  Clock3,
  LineChart,
  Search,
  Sparkles,
  Trophy,
  CalendarDays,
} from 'lucide-react';

// Student dashboard — uses the unified dashboard UI design with
// welcome-row, hero-card, stats-grid, content-grid, and panel classes.

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

function todayFormatted() {
  return new Date().toLocaleDateString('en-ZA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const STATUS_STYLES = {
  'in-progress': {
    bg: 'rgba(76,175,125,0.1)',
    color: '#2b7854',
    label: 'In progress',
    tone: 'green',
  },
  'not-started': {
    bg: 'rgba(224,168,62,0.12)',
    color: '#85661e',
    label: 'Not started',
    tone: 'amber',
  },
  completed: { bg: 'rgba(139,92,246,0.08)', color: '#6d3fd1', label: 'Completed', tone: 'purple' },
  expired: { bg: 'rgba(139,127,168,0.1)', color: '#706391', label: 'Expired', tone: 'blue' },
  locked: { bg: 'rgba(139,127,168,0.06)', color: '#6a6a6a', label: 'Locked', tone: 'blue' },
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

/* ── Performance trend chart (SVG polyline) ──────────────────────────── */

function TrendChart({ results }) {
  const sorted = useMemo(
    () => [...results].sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt)),
    [results]
  );

  if (sorted.length < 2) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0' }}>
        <BarChart3 size={24} style={{ color: '#706391', marginBottom: '8px' }} />
        <p style={{ color: '#706391', fontSize: '12px', margin: 0 }}>
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
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
        }}
      >
        <span style={{ fontSize: '11px', color: '#706391' }}>Last {sorted.length} results</span>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        style={{ width: '100%' }}
        role="img"
        aria-label={`Line chart of your last ${sorted.length} results, from ${Math.round(points[0].score)} percent to ${Math.round(points[points.length - 1].score)} percent`}
      >
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
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 130px), 1fr))', gap: '8px', marginTop: '4px' }}>
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
          <p style={{ margin: 0, fontSize: '11px', fontWeight: 600, color: '#241f38' }}>
            {b.label}
          </p>
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

  return (
    <div>
      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <ClipboardList size={24} style={{ color: '#706391', marginBottom: '8px' }} />
          <p style={{ color: '#706391', fontSize: '12px', margin: 0 }}>
            No tests yet. They will appear here once a round opens.
          </p>
        </div>
      ) : (
        <div className="test-list">
          {items.map((item) => {
            const isSitting = item.kind === 'sitting';
            const style = STATUS_STYLES[item.status] || STATUS_STYLES.completed;
            const dateLabel = isSitting
              ? `Started ${formatDate(item.test.startedAt)}`
              : `Closes ${formatDate(item.round.closeTime)}`;

            return (
              <div className="test-row" key={item.id}>
                <div className={`test-symbol ${style.tone}`}>
                  <ClipboardCheck />
                </div>
                <div className="test-main">
                  <strong>{item.name}</strong>
                  <span>{dateLabel}</span>
                  {item.status === 'in-progress' && (
                    <div className="progress-line">
                      <i style={{ width: '68%' }} />
                    </div>
                  )}
                </div>
                <div className="test-side">
                  <span className={`status-badge ${style.tone}`}>{style.label}</span>
                  <small>
                    {item.status === 'in-progress' ? timeLeft(item.test.expiresAt) : ''}
                  </small>
                </div>
                {item.status === 'in-progress' && (
                  <Link
                    href={`/student/sit?id=${item.test.roundId}`}
                    onClick={(e) => {
                      if (!window.confirm('Continue this test? Your answers are saved.'))
                        e.preventDefault();
                    }}
                  >
                    <ArrowRight className="row-arrow" />
                  </Link>
                )}
                {item.status === 'not-started' && (
                  <Link
                    href={`/student/sit?id=${item.round.id}`}
                    onClick={(e) => {
                      if (!window.confirm(`Start "${item.name}"? Once started, your time begins.`))
                        e.preventDefault();
                    }}
                  >
                    <ArrowRight className="row-arrow" />
                  </Link>
                )}
                {item.status === 'locked' && item.lockedReason && (
                  <span style={{ fontSize: '10px', color: '#6a6a6a', fontStyle: 'italic' }}>
                    {item.lockedReason}
                  </span>
                )}
                {item.status !== 'in-progress' &&
                  item.status !== 'not-started' &&
                  item.status !== 'locked' && <ArrowRight className="row-arrow" />}
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
            <Search size={14} style={{ color: '#706391' }} />
            <input
              aria-label="Search tests by round name"
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
          <Trophy size={24} style={{ color: '#706391', marginBottom: '8px' }} />
          <p style={{ color: '#706391', fontSize: '12px', margin: 0 }}>No results released yet.</p>
        </div>
      ) : (
        <div className="test-list">
          {filtered.map((result, idx) => {
            const tone = olympiadTone(idx);
            const toneColorMap = { violet: 'purple', amber: 'amber', blue: 'blue' };
            return (
              <Link
                href={`/student/result?id=${result.id}`}
                key={result.id}
                className="test-row"
                style={{ textDecoration: 'none', cursor: 'pointer' }}
              >
                <div className={`test-symbol ${toneColorMap[tone] || 'purple'}`}>
                  <ClipboardCheck />
                </div>
                <div className="test-main">
                  <strong>{result.round.name}</strong>
                  <span>Submitted {formatDate(result.submittedAt)}</span>
                </div>
                <div className="test-side">
                  <span
                    style={{ fontSize: '16px', fontWeight: 700, color: scoreColor(result.score) }}
                  >
                    {Math.round(result.score)}%
                  </span>
                </div>
                <ArrowRight className="row-arrow" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Up-next cards ────────────────────────────────────────────────────── */

function UpNextSection({ rounds, sittings }) {
  const notStarted = rounds
    .filter((r) => !r.sitting && !r.locked)
    .sort((a, b) => new Date(a.round.closeTime) - new Date(b.round.closeTime))
    .slice(0, 2);

  const inProgress = sittings
    .filter((s) => testStatus(s) === 'in-progress')
    .sort((a, b) => new Date(a.expiresAt) - new Date(b.expiresAt))
    .slice(0, 1);

  const upcoming = [
    ...inProgress.map((s) => ({
      name: s.round.name,
      subtitle: `Test in progress`,
      date: new Date(s.expiresAt),
      timeLabel: timeLeft(s.expiresAt),
      day: new Date(s.expiresAt).getDate(),
      month: new Date(s.expiresAt).toLocaleDateString('en-ZA', { month: 'short' }).toUpperCase(),
    })),
    ...notStarted.map((r) => ({
      name: r.round.name,
      subtitle: `Round opens soon`,
      date: new Date(r.round.openTime),
      timeLabel: '',
      day: new Date(r.round.openTime).getDate(),
      month: new Date(r.round.openTime)
        .toLocaleDateString('en-ZA', { month: 'short' })
        .toUpperCase(),
    })),
  ].slice(0, 2);

  if (upcoming.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <CalendarDays size={20} style={{ color: '#706391', marginBottom: '6px' }} />
        <p style={{ color: '#706391', fontSize: '12px', margin: 0 }}>No upcoming deadlines.</p>
      </div>
    );
  }

  return (
    <>
      {upcoming.map((item, idx) => (
        <div className={`calendar-card${idx > 0 ? ' muted-card' : ''}`} key={idx}>
          <div className="calendar-date">
            <strong>{item.day}</strong>
            <span>{item.month}</span>
          </div>
          <div>
            <strong>{item.name}</strong>
            <span>{item.subtitle}</span>
            {item.timeLabel && (
              <small>
                <Clock3 /> {item.timeLabel}
              </small>
            )}
          </div>
        </div>
      ))}
    </>
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

  if (checking || !user || status === 'loading') {
    return <div style={{ padding: '48px 0', fontSize: '14px', color: '#6d667c' }}>Loading...</div>;
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
  const heroTest = inProgress[0] || null;

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
            {inProgress.length > 0
              ? `You have ${inProgress.length} test${inProgress.length > 1 ? 's' : ''} in progress — keep going!`
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
            className="button primary"
          >
            Resume test <ArrowRight />
          </Link>
        )}
      </section>

      {/* Hero card — in-progress test */}
      {heroTest && (
        <section className="hero-card">
          <div className="hero-copy">
            <div className="hero-kicker">
              <Sparkles /> Your next milestone
            </div>
            <h2>Finish strong</h2>
            <p>{heroTest.round.name}</p>
            <div className="hero-meta">
              <span>
                <Clock3 /> {timeLeft(heroTest.expiresAt)}
              </span>
              <span>
                <ClipboardCheck /> In progress
              </span>
            </div>
            <Link
              href={resumeHref}
              onClick={(e) => {
                if (!window.confirm('Continue this test? Your answers are saved.'))
                  e.preventDefault();
              }}
              className="button light"
            >
              Continue test <ArrowRight />
            </Link>
          </div>
          <div className="hero-ring">
            <div>
              <strong>68%</strong>
              <span>complete</span>
            </div>
          </div>
        </section>
      )}

      {status === 'error' && (
        <div
          role="alert"
          className="panel"
          style={{
            marginTop: '20px',
            padding: '16px',
            borderColor: '#f3c2c2',
            background: '#fdf0f0',
          }}
        >
          <p style={{ color: '#8f2f2f', fontSize: '13px', margin: 0 }}>
            Couldn&apos;t load your tests or results. Try refreshing the page.
          </p>
        </div>
      )}

      {status === 'ready' && (
        <>
          {/* Section heading */}
          <div className="section-heading">
            <div>
              <h2>Your overview</h2>
              <p>A quick look at your Olympiad journey.</p>
            </div>
          </div>

          {/* Stats grid */}
          <section className="stats-grid">
            <StatCard
              icon={ClipboardCheck}
              label="Tests completed"
              value={completed}
              detail={sittings.length > 0 ? `${sittings.length} total started` : 'No tests yet'}
              tone="purple"
            />
            <StatCard
              icon={Trophy}
              label="Average score"
              value={avgScore !== null ? `${avgScore}%` : '\u2014'}
              detail={avgScore !== null ? `Best: ${bestScore}` : 'Take a test to see stats'}
              tone="amber"
            />
            <StatCard
              icon={Clock3}
              label="Tests available"
              value={availableCount}
              detail={availableCount > 0 ? 'Ready to start' : 'None right now'}
              tone="blue"
            />
            <StatCard
              icon={Sparkles}
              label="Best score"
              value={bestScore}
              detail={
                results.length > 0
                  ? `${results.length} result${results.length !== 1 ? 's' : ''} released`
                  : 'No results yet'
              }
              tone="green"
            />
          </section>

          {/* Content grid */}
          <section className="content-grid">
            {/* My tests panel */}
            <div className="panel" id="tests">
              <div className="panel-heading">
                <div>
                  <h2>My tests</h2>
                  <p>Stay on top of your active and upcoming challenges.</p>
                </div>
                {inProgress.length > 0 && (
                  <span
                    style={{
                      background: 'rgba(76,175,125,0.1)',
                      color: '#2b7854',
                      padding: '3px 10px',
                      borderRadius: '20px',
                      fontSize: '10px',
                      fontWeight: 700,
                    }}
                  >
                    {inProgress.length} active
                  </span>
                )}
              </div>
              <TestsSection tests={sittings} rounds={rounds} />
              <Link href="/student" className="full-link">
                View all tests <ArrowRight />
              </Link>
            </div>

            {/* Up next panel */}
            <div className="panel calendar-panel">
              <div className="panel-heading">
                <div>
                  <h2>Up next</h2>
                  <p>Your upcoming deadlines.</p>
                </div>
                <CalendarDays className="heading-icon" />
              </div>
              <UpNextSection rounds={rounds} sittings={sittings} />
            </div>
          </section>

          {/* Trend & achievements + Results (second row) */}
          <section className="content-grid">
            <div className="panel" id="results">
              <div className="panel-heading">
                <div>
                  <h2>My results</h2>
                  <p>
                    {results.length > 0
                      ? `Best score: ${bestScore}`
                      : 'Your released results will appear here.'}
                  </p>
                </div>
                {results.length > 0 && (
                  <Link href={`/student/result?id=${results[0]?.id}`} className="text-button">
                    View latest <ArrowRight />
                  </Link>
                )}
              </div>
              <ResultsSection results={results} />
            </div>

            <div className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Performance</h2>
                  <p>Track your progress over time.</p>
                </div>
                <Award className="heading-icon" />
              </div>
              <TrendChart results={results} />
              <div
                style={{ marginTop: '16px', borderTop: '1px solid #f0edf6', paddingTop: '14px' }}
              >
                <span
                  style={{
                    color: '#626b7e',
                    fontSize: '10px',
                    fontWeight: 700,
                    letterSpacing: '.12em',
                    textTransform: 'uppercase',
                    display: 'block',
                    marginBottom: '10px',
                  }}
                >
                  Badges
                </span>
                <AchievementBadges results={results} sittings={sittings} />
              </div>
            </div>
          </section>
        </>
      )}
    </>
  );
}
