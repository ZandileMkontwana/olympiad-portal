'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth, useClerk } from '@clerk/nextjs';
import { useRequireRole } from '@/hooks/useRequireRole';
import { fetchMySittings, fetchMyResults } from '@/lib/api';

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

// A sitting is completed once submitted, expired when its window passed
// without submitting, otherwise it can still be resumed.
function sittingStatus(sitting) {
  if (sitting.completedAt) return 'completed';
  if (new Date(sitting.expiresAt) < new Date()) return 'expired';
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

function StatCard({ label, value, accent }) {
  return (
    <div className="rounded-lg border border-lavender/20 bg-surface p-4 text-center shadow-sm">
      <p className={`font-display text-2xl font-semibold ${accent || 'text-ink'}`}>{value}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-ink-soft">{label}</p>
    </div>
  );
}

function SittingsSection({ sittings }) {
  const inProgress = sittings.filter((s) => sittingStatus(s) === 'in-progress').length;

  return (
    <section aria-labelledby="sittings-heading" className="relative">
      <div className="flex items-baseline justify-between">
        <h2 id="sittings-heading" className="font-display text-xl font-semibold text-ink">
          My sittings
        </h2>
        {inProgress > 0 && (
          <span className="text-xs font-medium text-sage">{inProgress} to finish</span>
        )}
      </div>

      {sittings.length === 0 ? (
        <div className="mt-4 rounded-lg border border-lavender/20 bg-surface p-6 shadow-sm">
          <p className="text-sm text-ink-soft">
            No sittings yet. Once your teacher registers you for a round and it opens,
            you&apos;ll sit it from here.
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {sittings.map((sitting) => {
            const status = sittingStatus(sitting);
            return (
              <li
                key={sitting.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-lavender/20 bg-surface p-4 shadow-sm"
              >
                <div>
                  <p className="font-medium text-ink">{sitting.round.name}</p>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    Started {formatDate(sitting.startedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLES[status]}`}
                  >
                    {STATUS_LABELS[status]}
                  </span>
                  {status === 'in-progress' && (
                    <Link
                      href={`/student/sit?id=${sitting.roundId}`}
                      className="rounded-md bg-lavender-deep px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
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

function ResultsSection({ results }) {
  const best = results.reduce((max, r) => Math.max(max, r.score), 0);

  return (
    <section aria-labelledby="results-heading" className="relative">
      <div className="flex items-baseline justify-between">
        <h2 id="results-heading" className="font-display text-xl font-semibold text-ink">
          My results
        </h2>
        {results.length > 0 && (
          <span className="text-xs font-medium text-ink-soft">
            Best: <span className={scoreStyle(best)}>{Math.round(best)}%</span>
          </span>
        )}
      </div>

      {results.length === 0 ? (
        <div className="mt-4 rounded-lg border border-lavender/20 bg-surface p-6 shadow-sm">
          <p className="text-sm text-ink-soft">
            No results released yet. Marks appear here as soon as your teacher releases them.
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {results.map((result) => (
            <li
              key={result.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-lavender/20 bg-surface p-4 shadow-sm"
            >
              <div>
                <p className="font-medium text-ink">{result.round.name}</p>
                <p className="mt-0.5 text-xs text-ink-soft">
                  Submitted {formatDate(result.submittedAt)}
                </p>
              </div>
              <p className={`font-display text-2xl font-semibold ${scoreStyle(result.score)}`}>
                {Math.round(result.score)}%
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function StudentDashboard() {
  const { user, checking } = useRequireRole('student');
  const { signOut } = useClerk();
  const { getToken } = useAuth();

  const [sittings, setSittings] = useState([]);
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error

  useEffect(() => {
    if (checking) return;

    async function load() {
      try {
        const token = await getToken();
        const [mySittings, myResults] = await Promise.all([
          fetchMySittings(token),
          fetchMyResults(token),
        ]);
        setSittings(mySittings);
        setResults(myResults);
        setStatus('ready');
      } catch (err) {
        setStatus('error');
      }
    }

    load();
  }, [checking, getToken]);

  async function handleLogout() {
    await signOut({ redirectUrl: '/login' });
  }

  if (checking || status === 'loading') {
    return (
      <main className="mx-auto max-w-2xl px-8 py-24 text-center text-sm text-ink-soft">
        Loading…
      </main>
    );
  }

  const completed = sittings.filter((s) => sittingStatus(s) === 'completed').length;

  return (
    <main className="relative mx-auto max-w-2xl overflow-hidden px-8 py-16">
      <Watermark />

      <header className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-lavender">
            Student dashboard
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">
            Welcome back, {user.name}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">{user.school}</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-md border border-lavender/30 bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-lavender/10"
        >
          Log out
        </button>
      </header>

      <div className="relative mt-3 h-px w-12 bg-lavender" aria-hidden="true" />

      {status === 'error' && (
        <div
          role="alert"
          className="relative mt-8 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          Couldn&apos;t load your sittings or results. Try refreshing the page.
        </div>
      )}

      {status === 'ready' && (
        <>
          <div className="relative mt-8 grid grid-cols-3 gap-3">
            <StatCard label="Sittings" value={sittings.length} />
            <StatCard label="Completed" value={completed} />
            <StatCard
              label="Best score"
              value={results.length > 0 ? `${Math.round(Math.max(...results.map((r) => r.score)))}%` : '—'}
            />
          </div>

          <div className="relative mt-10 space-y-10">
            <SittingsSection sittings={sittings} />
            <ResultsSection results={results} />
          </div>
        </>
      )}
    </main>
  );
}
