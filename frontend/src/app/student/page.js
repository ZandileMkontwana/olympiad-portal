'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useAuth, useClerk } from '@clerk/nextjs';
import { useRequireRole } from '@/hooks/useRequireRole';
import { fetchMySittings, fetchMyResults, fetchMyRounds } from '@/lib/api';

/* ── helpers ──────────────────────────────────────────────────────────── */

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function testStatus(test) {
  if (test.completedAt) return 'completed';
  if (new Date(test.expiresAt) < new Date()) return 'expired';
  return 'in-progress';
}

function scoreStyle(score) {
  if (score >= 70) return 'text-sage';
  if (score >= 50) return 'text-gold';
  return 'text-red-600';
}

function scoreHex(score) {
  if (score >= 70) return '#4caf7d';
  if (score >= 50) return '#c99a2e';
  return '#dc2626';
}

function initials(name) {
  return (name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

function timeLeft(expiresAt) {
  const ms = new Date(expiresAt) - new Date();
  if (ms <= 0) return 'Expired';
  const mins = Math.floor(ms / 60000);
  const hrs = Math.floor(mins / 60);
  if (hrs > 0) return `${hrs}h ${mins % 60}m left`;
  return `${mins}m left`;
}

const STATUS_STYLES = {
  'in-progress': 'bg-sage/10 text-sage border border-sage/30',
  completed: 'bg-lavender/10 text-lavender-deep border border-lavender/30',
  expired: 'bg-slate/10 text-slate border border-slate/30',
};
const STATUS_LABELS = { 'in-progress': 'In progress', completed: 'Completed', expired: 'Expired' };

/* ── Sidebar ──────────────────────────────────────────────────────────── */

function Sidebar({ user, onLogout, activeSection, setActiveSection }) {
  const sections = [
    { id: 'overview', icon: '🏠', label: 'Overview' },
    { id: 'tests', icon: '📝', label: 'My Tests' },
    { id: 'results', icon: '🏆', label: 'Results' },
  ];
  return (
    <aside className="fixed left-0 top-0 flex h-screen w-60 flex-shrink-0 flex-col border-r border-lavender/15 bg-surface px-4 py-6">
      <div className="flex items-center gap-2.5 px-2 pb-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-lavender to-lavender-deep font-display text-lg font-bold text-white">
          O
        </div>
        <div>
          <p className="font-display text-sm font-semibold text-ink">Olympiad Portal</p>
          <p className="text-xs text-ink-soft">Student</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-left text-sm font-semibold transition-colors ${
              activeSection === s.id
                ? 'bg-lavender/10 text-lavender-deep'
                : 'text-ink-soft hover:bg-lavender/5'
            }`}
          >
            <span className="text-base">{s.icon}</span>
            {s.label}
          </button>
        ))}
      </nav>

      <div className="flex items-center gap-2.5 border-t border-lavender/15 pt-4">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-lavender to-lavender-deep text-xs font-bold text-white">
          {initials(user.name || user.email)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{user.name || user.email}</p>
          <button onClick={onLogout} className="text-xs font-semibold text-red-500 hover:underline">
            Log out
          </button>
        </div>
      </div>
    </aside>
  );
}

/* ── Stat card ────────────────────────────────────────────────────────── */

function StatCard({ icon, label, value, accent }) {
  return (
    <div className="rounded-xl border border-lavender/20 bg-surface p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-2xl" aria-hidden="true">
          {icon}
        </span>
      </div>
      <p className={`mt-3 font-display text-2xl font-bold ${accent || 'text-ink'}`}>{value}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-ink-soft">{label}</p>
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
      <div className="flex h-full flex-col items-center justify-center rounded-xl border border-lavender/20 bg-surface p-6 text-center shadow-sm">
        <span className="text-2xl">📈</span>
        <p className="mt-2 text-sm text-ink-soft">
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
    <div className="rounded-xl border border-lavender/20 bg-surface p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-semibold text-ink">Performance trend</h3>
        <span className="text-xs font-medium text-ink-soft">Last {sorted.length} results</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-4 w-full">
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
    <div className="rounded-xl border border-lavender/20 bg-surface p-6 shadow-sm">
      <h3 className="font-display text-base font-semibold text-ink">Achievements</h3>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {badges.map((b) => (
          <div
            key={b.id}
            title={b.desc}
            className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-opacity ${
              b.earned ? 'border-gold/40 bg-gold/5' : 'border-lavender/15 opacity-40 grayscale'
            }`}
          >
            <span className="text-2xl">{b.icon}</span>
            <p className="text-xs font-semibold text-ink">{b.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Hero ─────────────────────────────────────────────────────────────── */

function HeroBanner({ name, school, inProgress, availableCount, resumeHref }) {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-lavender-deep to-lavender px-8 py-10 text-white shadow-md sm:px-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-16 -left-6 h-40 w-40 rounded-full bg-white/5"
      />
      <p className="text-sm font-semibold uppercase tracking-widest text-white/75">Welcome back</p>
      <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
        {name}
      </h1>
      {school && <p className="mt-2 text-lg font-medium text-white/85">{school.name ?? school}</p>}

      <div className="mt-6 flex flex-wrap items-center gap-4">
        {inProgress.length > 0 ? (
          <>
            <div className="rounded-lg bg-white/15 px-4 py-2">
              <p className="text-sm font-medium">
                {inProgress.length} test{inProgress.length > 1 ? 's' : ''} in progress -{' '}
                <span className="font-bold">{timeLeft(inProgress[0].expiresAt)}</span>
              </p>
            </div>
            {resumeHref && (
              <Link
                href={resumeHref}
                onClick={(e) => {
                  if (!window.confirm('Continue this test? Your answers are saved.'))
                    e.preventDefault();
                }}
                className="rounded-lg bg-white px-5 py-2.5 text-base font-semibold text-lavender-deep transition-opacity hover:opacity-90"
              >
                Resume test →
              </Link>
            )}
          </>
        ) : availableCount > 0 ? (
          <p className="text-lg font-medium text-white/90">
            You have {availableCount} test{availableCount > 1 ? 's' : ''} ready to take.
          </p>
        ) : (
          <p className="text-lg font-medium text-white/90">
            All caught up — nothing due right now.
          </p>
        )}
      </div>
    </section>
  );
}

/* ── Sections (tests / available / results) ──────────────────────────── */

function TestsSection({ tests }) {
  const inProgress = tests.filter((t) => testStatus(t) === 'in-progress').length;
  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-2xl font-semibold text-ink">My tests</h2>
        {inProgress > 0 && (
          <span className="text-sm font-medium text-sage">{inProgress} to finish</span>
        )}
      </div>
      {tests.length === 0 ? (
        <div className="mt-4 rounded-xl border border-lavender/20 bg-surface p-8 text-center shadow-sm">
          <span className="text-3xl">📝</span>
          <p className="mt-2 text-base text-ink-soft">
            No tests yet. They&apos;ll appear here once a round opens.
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {tests.map((test) => {
            const status = testStatus(test);
            return (
              <li
                key={test.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-lavender/20 bg-surface p-5 shadow-sm"
              >
                <div>
                  <p className="text-lg font-semibold text-ink">{test.round.name}</p>
                  <p className="mt-0.5 text-sm text-ink-soft">
                    Started {formatDate(test.startedAt)}
                  </p>
                  {status === 'in-progress' && (
                    <p className="mt-0.5 text-xs font-semibold text-sage">
                      {timeLeft(test.expiresAt)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${STATUS_STYLES[status]}`}
                  >
                    {STATUS_LABELS[status]}
                  </span>
                  {status === 'in-progress' && (
                    <Link
                      href={`/student/sit?id=${test.roundId}`}
                      onClick={(e) => {
                        if (!window.confirm('Continue this test? Your answers are saved.'))
                          e.preventDefault();
                      }}
                      className="rounded-lg bg-lavender-deep px-5 py-2.5 text-base font-medium text-white transition-opacity hover:opacity-90"
                    >
                      Resume
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function AvailableRoundsSection({ rounds }) {
  const available = rounds.filter((r) => !r.sitting);
  return (
    <section>
      <h2 className="font-display text-2xl font-semibold text-ink">Available tests</h2>
      {available.length === 0 ? (
        <div className="mt-4 rounded-xl border border-lavender/20 bg-surface p-8 text-center shadow-sm">
          <span className="text-3xl">📋</span>
          <p className="mt-2 text-base text-ink-soft">No new tests available right now.</p>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {available.map((item) => (
            <li
              key={item.round.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-lavender/20 bg-surface p-5 shadow-sm"
            >
              <div>
                <p className="text-lg font-semibold text-ink">{item.round.name}</p>
                <p className="mt-0.5 text-sm text-ink-soft">
                  Closes {formatDate(item.round.closeTime)}
                </p>
              </div>
              <Link
                href={`/student/sit?id=${item.round.id}`}
                onClick={(e) => {
                  if (
                    !window.confirm(`Start "${item.round.name}"? Once started, your time begins.`)
                  )
                    e.preventDefault();
                }}
                className="rounded-lg bg-lavender-deep px-5 py-2.5 text-base font-medium text-white transition-opacity hover:opacity-90"
              >
                Start test
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ResultsSection({ results }) {
  const [search, setSearch] = useState('');
  const best = results.reduce((max, r) => Math.max(max, r.score), 0);
  const filtered = results.filter((r) => r.round.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-2xl font-semibold text-ink">My results</h2>
        {results.length > 0 && (
          <span className="text-sm font-medium text-ink-soft">
            Best: <span className={scoreStyle(best)}>{Math.round(best)}%</span>
          </span>
        )}
      </div>

      {results.length > 3 && (
        <input
          type="text"
          placeholder="Search by round name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mt-3 w-full rounded-lg border border-lavender/30 bg-surface px-3.5 py-2 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-lavender/50"
        />
      )}

      {results.length === 0 ? (
        <div className="mt-4 rounded-xl border border-lavender/20 bg-surface p-8 text-center shadow-sm">
          <span className="text-3xl">🏆</span>
          <p className="mt-2 text-base text-ink-soft">No results released yet.</p>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {filtered.map((result) => (
            <li
              key={result.id}
              className="rounded-xl border border-lavender/20 bg-surface p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-ink">{result.round.name}</p>
                  <p className="mt-0.5 text-sm text-ink-soft">
                    Submitted {formatDate(result.submittedAt)}
                  </p>
                </div>
                <p className={`font-display text-3xl font-semibold ${scoreStyle(result.score)}`}>
                  {Math.round(result.score)}%
                </p>
              </div>
              <Link
                href={`/student/result?id=${result.id}`}
                className="mt-4 inline-block rounded-lg border border-lavender/40 px-5 py-2.5 text-base font-medium text-lavender-deep transition-colors hover:bg-lavender/10"
              >
                View test →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ── Main page ────────────────────────────────────────────────────────── */

export default function StudentDashboard() {
  const { user, checking } = useRequireRole('student');
  const { signOut } = useClerk();
  const { getToken } = useAuth();

  const [sittings, setSittings] = useState([]);
  const [results, setResults] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [status, setStatus] = useState('loading');
  const [activeSection, setActiveSection] = useState('overview');

  useEffect(() => {
    if (checking) return;
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
  }, [checking, getToken]);

  async function handleLogout() {
    if (!window.confirm('Log out of the Olympiad Portal?')) return;
    await signOut({ redirectUrl: '/login' });
  }

  if (checking || status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <p className="text-lg text-ink-soft">Loading...</p>
      </div>
    );
  }

  const completed = sittings.filter((s) => testStatus(s) === 'completed').length;
  const inProgress = sittings.filter((s) => testStatus(s) === 'in-progress');
  const resumeHref = inProgress.length > 0 ? `/student/sit?id=${inProgress[0].roundId}` : null;
  const bestScore =
    results.length > 0 ? `${Math.round(Math.max(...results.map((r) => r.score)))}%` : '—';
  const avgScore =
    results.length > 0
      ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length)
      : null;

  return (
    <div className="min-h-screen bg-canvas">
      <Sidebar
        user={user}
        onLogout={handleLogout}
        activeSection={activeSection}
        setActiveSection={setActiveSection}
      />

      <main className="relative ml-60 w-[calc(100%-15rem)] max-w-6xl overflow-hidden px-8 py-10">
        <HeroBanner
          name={user.name}
          school={user.school}
          inProgress={inProgress}
          availableCount={rounds.filter((r) => !r.sitting).length}
          resumeHref={resumeHref}
        />

        {status === 'error' && (
          <div
            role="alert"
            className="relative mt-8 rounded-lg border border-red-200 bg-red-50 p-5 text-base text-red-800"
          >
            Couldn&apos;t load your tests or results. Try refreshing the page.
          </div>
        )}

        {status === 'ready' && (
          <>
            <div className="relative mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard icon="📝" label="Tests" value={sittings.length} />
              <StatCard icon="✅" label="Completed" value={completed} />
              <StatCard
                icon="📊"
                label="Average"
                value={avgScore !== null ? `${avgScore}%` : '—'}
                accent={avgScore !== null ? scoreStyle(avgScore) : undefined}
              />
              <StatCard
                icon="🏆"
                label="Best score"
                value={bestScore}
                accent={
                  results.length > 0
                    ? scoreStyle(Math.max(...results.map((r) => r.score)))
                    : undefined
                }
              />
            </div>

            {activeSection === 'overview' && (
              <>
                <div className="relative mt-10 grid gap-6 lg:grid-cols-3">
                  <div className="lg:col-span-2">
                    <TrendChart results={results} />
                  </div>
                  <AchievementBadges results={results} sittings={sittings} />
                </div>

                <div className="relative mt-12 grid gap-12 lg:grid-cols-2">
                  <TestsSection tests={sittings} />
                  <ResultsSection results={results} />
                </div>

                <div className="relative mt-12">
                  <AvailableRoundsSection rounds={rounds} />
                </div>
              </>
            )}

            {activeSection === 'tests' && (
              <div className="relative mt-10 space-y-12">
                <TestsSection tests={sittings} />
                <AvailableRoundsSection rounds={rounds} />
              </div>
            )}

            {activeSection === 'results' && (
              <div className="relative mt-10">
                <ResultsSection results={results} />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
