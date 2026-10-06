'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { getRound, fetchRoundAnalytics, ApiError } from '@/lib/api';
import ScoreDistributionChart from '@/components/charts/ScoreDistributionChart';
import QuestionPerformanceChart from '@/components/charts/QuestionPerformanceChart';
import ParticipationChart from '@/components/charts/ParticipationChart';

export default function ClosedRoundPage() {
  const { id: roundId } = useParams();
  const { getToken } = useAuth();

  const [status, setStatus] = useState('loading');
  const [round, setRound] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const [analytics, setAnalytics] = useState(null);
  const [analyticsStatus, setAnalyticsStatus] = useState('loading');
  const [analyticsError, setAnalyticsError] = useState('');

  useEffect(() => {
    async function fetchRound() {
      try {
        const data = await getRound(roundId);
        setRound(data);
        setStatus('ready');
      } catch (err) {
        setStatus('error');
        setErrorMessage(err instanceof ApiError ? err.message : 'Failed to load round.');
      }
    }

    fetchRound();
  }, [roundId]);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const token = await getToken();
        const data = await fetchRoundAnalytics(roundId, token);
        setAnalytics(data);
        setAnalyticsStatus('ready');
      } catch (err) {
        setAnalyticsStatus('error');
        setAnalyticsError(err instanceof ApiError ? err.message : 'Failed to load analytics.');
      }
    }

    fetchAnalytics();
  }, [roundId, getToken]);

  if (status === 'loading') {
    return (
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-xl px-8 py-24 text-center">
        <p className="text-sm text-ink-soft">Loading round…</p>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-xl px-8 py-24 text-center">
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {errorMessage}
        </div>
        <Link
          href="/organiser"
          className="mt-6 inline-block rounded-md border border-lavender/40 px-4 py-2 text-sm font-medium text-lavender-deep transition-colors hover:bg-lavender/10"
        >
          Back to rounds
        </Link>
      </main>
    );
  }

  return (
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-4xl px-8 py-24">
      <div role="status" className="rounded-lg border border-gold/30 bg-gold/5 p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-gold" aria-hidden="true" />
          <h1 className="font-display text-xl font-semibold text-ink">{round.name}</h1>
        </div>

        <p className="mt-2 text-sm text-ink-soft">
          This round closed on{' '}
          <span className="text-ink">{new Date(round.closeTime).toLocaleString()}</span>. Papers can
          no longer be uploaded or replaced.
        </p>

        <dl className="mt-4 space-y-1 text-sm">
          <div className="flex gap-2">
            <dt className="font-medium text-ink-soft">Opened</dt>
            <dd className="text-ink">{new Date(round.openTime).toLocaleString()}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium text-ink-soft">Closed</dt>
            <dd className="text-ink">{new Date(round.closeTime).toLocaleString()}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium text-ink-soft">Round ID</dt>
            <dd className="font-mono text-ink">{round.id}</dd>
          </div>
        </dl>
      </div>

      {/* Analytics */}
      <section className="mt-8" aria-label="Round analytics">
        <h2 className="font-display text-lg font-semibold text-ink mb-4">Analytics</h2>

        {analyticsStatus === 'loading' && (
          <p className="text-sm text-ink-soft">Loading analytics…</p>
        )}

        {analyticsStatus === 'error' && (
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {analyticsError}
          </div>
        )}

        {analyticsStatus === 'ready' && analytics && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-8">
              <div className="rounded-lg border border-lavender/20 bg-white p-4 text-center">
                <div className="text-2xl font-bold text-ink">
                  {analytics.scores.average.toFixed(1)}
                </div>
                <div className="text-sm text-ink-soft">Average score</div>
              </div>
              <div className="rounded-lg border border-lavender/20 bg-white p-4 text-center">
                <div className="text-2xl font-bold text-ink">{analytics.scores.median}</div>
                <div className="text-sm text-ink-soft">Median score</div>
              </div>
              <div className="rounded-lg border border-lavender/20 bg-white p-4 text-center">
                <div className="text-2xl font-bold text-ink">
                  {analytics.timing.averageCompletionMinutes.toFixed(0)} min
                </div>
                <div className="text-sm text-ink-soft">Average completion time</div>
              </div>
            </div>

            <div className="rounded-lg border border-lavender/20 bg-white p-6 mb-6">
              <ParticipationChart
                totalEntrants={analytics.participation.totalEntrants}
                completedSubmissions={analytics.participation.completedSubmissions}
              />
            </div>

            <div className="rounded-lg border border-lavender/20 bg-white p-6 mb-6">
              <ScoreDistributionChart
                data={analytics.scores.distribution}
                maxScore={analytics.round.maxScore}
              />
            </div>

            <div className="rounded-lg border border-lavender/20 bg-white p-6">
              <QuestionPerformanceChart questions={analytics.questions} />
            </div>
          </>
        )}
      </section>

      <Link
        href="/organiser"
        className="mt-6 inline-block rounded-md border border-lavender/40 px-4 py-2 text-sm font-medium text-lavender-deep transition-colors hover:bg-lavender/10"
      >
        Back to rounds
      </Link>
    </main>
  );
}
