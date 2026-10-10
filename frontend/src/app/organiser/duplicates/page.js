'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRequireRole } from '@/hooks/useRequireRole';
import { fetchAllDuplicates, ApiError } from '@/lib/api';

function DuplicateGroup({ group }) {
  const isHigh = group.confidence === 'high';
  const borderClass = isHigh ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50';
  const iconClass = isHigh ? 'text-red-600' : 'text-amber-600';
  const badgeClass = isHigh
    ? 'bg-red-200 text-red-900'
    : 'bg-amber-200 text-amber-900';
  const confidenceLabel = isHigh ? 'High confidence' : 'Low confidence';

  return (
    <div className={`rounded-lg border p-4 ${borderClass}`}>
      <div className="mb-3 flex items-center gap-2">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={iconClass}
          aria-hidden="true"
        >
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <p className={`font-semibold ${isHigh ? 'text-red-900' : 'text-amber-900'}`}>
          {group.entrants[0].name} — Grade {group.entrants[0].grade}
        </p>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass}`}>
          {group.entrants.length} accounts
        </span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass}`}>
          {confidenceLabel}
        </span>
      </div>
      <ul className="space-y-2">
        {group.entrants.map((entrant) => (
          <li
            key={entrant.id}
            className="flex items-center justify-between rounded-md bg-white p-3 text-sm"
          >
            <div>
              <p className="font-medium text-ink">{entrant.name}</p>
              <p className="text-xs text-ink-soft">
                {entrant.email || 'No email'} · {entrant.schoolName}
              </p>
            </div>
            <div className="text-right text-xs text-ink-soft">
              <p>Created {new Date(entrant.createdAt).toLocaleDateString()}</p>
              <p className="font-mono text-ink-soft/60">{entrant.id.slice(0, 8)}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function DuplicatesReviewPage() {
  const { user, checking } = useRequireRole('organiser');
  const { getToken } = useAuth();
  const [duplicates, setDuplicates] = useState([]);
  const [status, setStatus] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (checking || !user) return;

    let cancelled = false;

    async function loadDuplicates() {
      try {
        const token = await getToken();
        const data = await fetchAllDuplicates(token);
        if (cancelled) return;
        setDuplicates(data.duplicates || []);
        setStatus(data.duplicates?.length === 0 ? 'empty' : 'ready');
      } catch (err) {
        if (cancelled) return;
        setStatus('error');
        setErrorMessage(
          err instanceof ApiError ? err.message : 'Failed to load duplicate accounts.'
        );
      }
    }

    loadDuplicates();
    return () => {
      cancelled = true;
    };
  }, [checking, user, getToken]);

  if (checking) {
    return (
      <p className="text-sm text-ink-soft">Checking access…</p>
    );
  }

  if (!user) return null;

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
        Duplicate Accounts
      </h1>
      <div className="mt-3 h-px w-12 bg-lavender" aria-hidden="true" />
      <p className="mt-3 text-sm text-ink-soft">
        Potential duplicate student accounts detected across all schools. Review and merge as needed.
      </p>

      {status === 'loading' && <p className="mt-8 text-sm text-ink-soft">Loading duplicates…</p>}

      {status === 'error' && (
        <div
          role="alert"
          className="mt-8 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {errorMessage}
        </div>
      )}

      {status === 'empty' && (
        <div className="mt-8 rounded-lg border border-lavender/20 bg-surface p-8 text-center">
          <span className="text-3xl" aria-hidden="true">
            ✓
          </span>
          <p className="mt-2 text-base text-ink-soft">
            No duplicate accounts detected. All clear!
          </p>
        </div>
      )}

      {status === 'ready' && (
        <div className="mt-8 space-y-4">
          <p className="text-sm font-medium text-ink-soft">
            Found {duplicates.length} group{duplicates.length !== 1 ? 's' : ''} of potential
            duplicates
          </p>
          {duplicates.map((group, index) => (
            <DuplicateGroup key={index} group={group} />
          ))}
        </div>
      )}
    </>
  );
}
