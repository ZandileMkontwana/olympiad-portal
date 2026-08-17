'use client';

import { useEffect, useState } from 'react';
import { listRounds, ApiError} from '@/lib/api';



export default function RoundsDashboardPage() {
  const [status, setStatus] = useState('loading');
  const [rounds, setRounds] = useState([]);

  useEffect(() => {
    async function fetchRounds() {
      try {
        const data = await listRounds();
        if (data.length === 0) {
          setStatus('empty');
        } else {
          setRounds(data);
          setStatus('ready');
        }
      } catch (err) {
        setStatus('error');
      }
    }

    fetchRounds();
  }, []);



  return (
    <main className="mx-auto max-w-3xl px-8 py-12">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
        Rounds
      </h1>
      <div className="mt-3 h-px w-12 bg-lavender" aria-hidden="true" />

      {status === 'loading' && (
        <p className="mt-8 text-sm text-ink-soft">Loading rounds…</p>
      )}

      {status === 'empty' && (
        <p className="mt-8 text-sm text-ink-soft">
          No rounds yet. Create one to get started.
        </p>
      )}

      {status === 'error' && (
        <div
          role="alert"
          className="mt-8 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          Couldn&apos;t load rounds. Try refreshing the page.
        </div>
      )}

{status === 'ready' && (
  <ul className="mt-8 space-y-3">
    {rounds.map((round) => {
      const stateStyles = {
        scheduled: 'bg-slate/10 text-slate',
        open: 'bg-sage/10 text-sage',
        closed: 'bg-gold/10 text-gold',
        released: 'bg-lavender/10 text-lavender-deep',
      };

      return (
        <li
          key={round.id}
          className="flex items-center justify-between rounded-lg border border-lavender/20 bg-surface p-4 shadow-sm"
        >
          <div>
            <p className="font-medium text-ink">{round.name}</p>
            <p className="mt-1 text-xs text-ink-soft">
              Opens {new Date(round.openTime).toLocaleString()} · Closes{' '}
              {new Date(round.closeTime).toLocaleString()}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
              stateStyles[round.state] ?? 'bg-ink-soft/10 text-ink-soft'
            }`}
          >
            {round.state}
          </span>
        </li>
      );
    })}
  </ul>
)}
      
    </main>
  );
}