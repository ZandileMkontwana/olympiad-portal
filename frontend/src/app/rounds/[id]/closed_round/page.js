'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getRound, ApiError } from '@/lib/api';

export default function ClosedRoundPage() {
  const { id: roundId } = useParams();

  const [status, setStatus] = useState('loading');
  const [round, setRound] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

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
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-xl px-8 py-24">
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

      <Link
        href="/organiser"
        className="mt-6 inline-block rounded-md border border-lavender/40 px-4 py-2 text-sm font-medium text-lavender-deep transition-colors hover:bg-lavender/10"
      >
        Back to rounds
      </Link>
    </main>
  );
}
