'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth, useClerk } from '@clerk/nextjs';
import { useRequireRole } from '@/hooks/useRequireRole';
import { fetchMySittings, fetchMyResults, fetchMyRounds } from '@/lib/api';

function Watermark() {
  return (
    <img
      src="/tree-mark.png"
      alt=""
      aria-hidden="true"
      className="watermark pointer-events-none absolute left-1/2 top-1/2 w-[700px] max-w-none -translate-x-1/2 -translate-y-1/2 object-contain"
    />
  );
}

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// A test is completed once submitted, expired when its window passed
// without submitting, otherwise it can still be resumed.
function testStatus(test) {
  if (test.completedAt) return 'completed';
  if (new Date(test.expiresAt) < new Date()) return 'expired';
  return 'in-progress';
}

const STATUS_STYLES = {
  'in-progress': 'bg-sage/10 text-sage border border-sage/30',
  completed: 'bg-lavender/10 text-lavender-deep border border-lavender/30',
  expired: 'bg-slate/10 text-slate border border-slate/30',
};

const STATUS_LABELS = {
  'in-progress': 'In progress',
  completed: 'Completed',
  expired: 'Expired',
};

function scoreStyle(score) {
  if (score >= 70) return 'text-sage';
  if (score >= 50) return 'text-gold';
  return 'text-red-600';
}

function StatCard({ icon, label, value, accent }) {
  return (
    <div className="rounded-xl border border-lavender/20 bg-surface p-6 text-center shadow-sm">
      <span className="text-3xl" aria-hidden="true">
        {icon}
      </span>
      <p className={`mt-2 font-display text-3xl font-semibold ${accent || 'text-ink'}`}>
        {value}
      </p>
      <p className="mt-1 text-sm font-medium uppercase tracking-wide text-ink-soft">{label}</p>
    </div>
  );
}

function HeroBanner({ name, school, inProgressCount, availableCount, resumeHref }) {
  return (
    <section className="relative mt-8 overflow-hidden rounded-2xl bg-gradient-to-br from-lavender-deep to-lavender px-8 py-10 text-white shadow-md sm:px-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-16 -left-6 h-40 w-40 rounded-full bg-white/5"
      />
      <p className="text-sm font-semibold uppercase tracking-widest text-white/75">
        Student dashboard
      </p>
      <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
        Welcome back, {name}
      </h1>
      {school && <p className="mt-2 text-lg font-medium text-white/85">{school.name ?? school}</p>}

      <div className="mt-6 flex flex-wrap items-center gap-4">
        {inProgressCount > 0 ? (
          <>
            <p className="text-lg font-medium">
              You have {inProgressCount} test{inProgressCount > 1 ? 's' : ''} to finish — keep
              going!
            </p>
            {resumeHref && (
              <Link
                href={resumeHref}
                onClick={(e) => {
                  if (!window.confirm('Continue this test? Your answers are saved.')) {
                    e.preventDefault();
                  }
                }}
                className="rounded-lg bg-white px-5 py-2.5 text-base font-semibold text-lavender-deep transition-opacity hover:opacity-90"
              >
                Resume test →
              </Link>
            )}
          </>
        ) : availableCount > 0 ? (
          <p className="text-lg font-medium text-white/90">
            You have {availableCount} test{availableCount > 1 ? 's' : ''} ready to take — scroll down to start.
          </p>
        ) : (
          <p className="text-lg font-medium text-white/90">
            All tests submitted — marks appear here once your teacher releases them.
          </p>
        )}
      </div>
    </section>
  );
}

function TestsSection({ tests }) {
  const inProgress = tests.filter((t) => testStatus(t) === 'in-progress').length;

  return (
    <section aria-labelledby="tests-heading" className="relative">
      <div className="flex items-baseline justify-between">
        <h2 id="tests-heading" className="font-display text-2xl font-semibold text-ink">
          My tests
        </h2>
        {inProgress > 0 && (
          <span className="text-sm font-medium text-sage">{inProgress} to finish</span>
        )}
      </div>

      {tests.length === 0 ? (
        <div className="mt-4 rounded-xl border border-lavender/20 bg-surface p-8 text-center shadow-sm">
          <span className="text-3xl" aria-hidden="true">
            📝
          </span>
          <p className="mt-2 text-base text-ink-soft">
            No tests yet. Once your teacher registers you for a round and it opens,
            you&apos;ll take the test from here.
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
                        if (!window.confirm('Continue this test? Your answers are saved.')) {
                          e.preventDefault();
                        }
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
  // Only show rounds that don't have a sitting yet (not started)
  const available = rounds.filter((r) => !r.sitting);

  return (
    <section aria-labelledby="available-heading" className="relative">
      <h2 id="available-heading" className="font-display text-2xl font-semibold text-ink">
        Available tests
      </h2>

      {available.length === 0 ? (
        <div className="mt-4 rounded-xl border border-lavender/20 bg-surface p-8 text-center shadow-sm">
          <span className="text-3xl" aria-hidden="true">
            📋
          </span>
          <p className="mt-2 text-base text-ink-soft">
            No new tests available right now. Check back when your educator opens a round.
          </p>
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
                    !window.confirm(
                      `Start "${item.round.name}"? Once started, your time begins.`
                    )
                  ) {
                    e.preventDefault();
                  }
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
  const best = results.reduce((max, r) => Math.max(max, r.score), 0);

  return (
    <section aria-labelledby="results-heading" className="relative">
      <div className="flex items-baseline justify-between">
        <h2 id="results-heading" className="font-display text-2xl font-semibold text-ink">
          My results
        </h2>
        {results.length > 0 && (
          <span className="text-sm font-medium text-ink-soft">
            Best: <span className={scoreStyle(best)}>{Math.round(best)}%</span>
          </span>
        )}
      </div>

      {results.length === 0 ? (
        <div className="mt-4 rounded-xl border border-lavender/20 bg-surface p-8 text-center shadow-sm">
          <span className="text-3xl" aria-hidden="true">
            🏆
          </span>
          <p className="mt-2 text-base text-ink-soft">
            No results released yet. Marks appear here as soon as your teacher releases them.
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {results.map((result) => (
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

function HowItWorks() {
  const steps = [
    {
      icon: '👤',
      title: 'Get registered',
      text: 'Your teacher registers you for a round at your school.',
    },
    {
      icon: '✍️',
      title: 'Take the test',
      text: 'When the round opens, take the test here — answers save automatically as you go.',
    },
    {
      icon: '📈',
      title: 'See your marks',
      text: 'Once marks are released, review every question and answer right here.',
    },
  ];

  return (
    <section aria-labelledby="how-it-works-heading" className="relative">
      <h2
        id="how-it-works-heading"
        className="font-display text-2xl font-semibold text-ink"
      >
        How it works
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {steps.map((step, index) => (
          <div
            key={step.title}
            className="rounded-xl border border-lavender/20 bg-surface p-6 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl" aria-hidden="true">
                {step.icon}
              </span>
              <span className="font-display text-lg font-semibold text-lavender-deep">
                Step {index + 1}
              </span>
            </div>
            <p className="mt-3 text-base font-semibold text-ink">{step.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">{step.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function StudentDashboard() {
  const { user, checking } = useRequireRole('student');
  const { signOut } = useClerk();
  const { getToken } = useAuth();

  const [sittings, setSittings] = useState([]);
  const [results, setResults] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error

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
      <main className="mx-auto max-w-5xl px-8 py-24 text-center text-lg text-ink-soft">
        Loading…
      </main>
    );
  }

  const completed = sittings.filter((s) => testStatus(s) === 'completed').length;
  const inProgress = sittings.filter((s) => testStatus(s) === 'in-progress');
  const resumeHref =
    inProgress.length > 0 ? `/student/sit?id=${inProgress[0].roundId}` : null;
  const bestScore =
    results.length > 0 ? `${Math.round(Math.max(...results.map((r) => r.score)))}%` : '—';

  return (
    <main className="relative mx-auto max-w-5xl overflow-hidden px-8 py-12">
      <Watermark />

      <header className="relative flex flex-wrap items-center justify-end gap-4">
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-lg border border-lavender/30 bg-surface px-5 py-2.5 text-base font-medium text-ink transition-colors hover:bg-lavender/10"
        >
          Log out
        </button>
      </header>

      <HeroBanner
        name={user.name}
        school={user.school}
        inProgressCount={inProgress.length}
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
          <div className="relative mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard icon="📝" label="Tests" value={sittings.length} />
            <StatCard icon="✅" label="Completed" value={completed} />
            <StatCard
              icon="🏆"
              label="Best score"
              value={bestScore}
              accent={results.length > 0 ? scoreStyle(Math.max(...results.map((r) => r.score))) : undefined}
            />
          </div>

          <div className="relative mt-12 grid gap-12 lg:grid-cols-2">
            <TestsSection tests={sittings} />
            <ResultsSection results={results} />
          </div>

          <div className="relative mt-12">
            <AvailableRoundsSection rounds={rounds} />
          </div>

          <div className="relative mt-12">
            <HowItWorks />
          </div>
        </>
      )}
    </main>
  );
}
