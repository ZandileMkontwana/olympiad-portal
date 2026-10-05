'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { fetchStandings, getSchoolStandings, ApiError } from '@/lib/api';
import TableScroll from '@/components/TableScroll';

export default function StandingsPage() {
  const { id: roundId } = useParams();
  const { getToken } = useAuth();
  const [activeTab, setActiveTab] = useState('entrants'); // 'entrants' | 'schools'

  // Per-entrant standings (existing #126 logic, unchanged)
  const [standings, setStandings] = useState([]);
  const [status, setStatus] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadStandings() {
      try {
        const token = await getToken();
        const data = await fetchStandings(roundId, token);
        if (cancelled) return;
        setStandings(data);
        setStatus(data.length === 0 ? 'empty' : 'ready');
      } catch (err) {
        if (cancelled) return;
        setStatus('error');
        setErrorMessage(
          err instanceof ApiError ? err.message : 'Something went wrong loading standings.'
        );
      }
    }

    loadStandings();
    return () => {
      cancelled = true;
    };
  }, [roundId, getToken]);

  // Per-school standings — fetched lazily, only once the tab is first opened
  const [schoolStandings, setSchoolStandings] = useState([]);
  const [schoolStatus, setSchoolStatus] = useState('idle'); // idle | loading | empty | ready | error
  const [schoolErrorMessage, setSchoolErrorMessage] = useState('');
  const hasFetchedschools = useRef(false);

  useEffect(() => {
    if (activeTab !== 'schools' || hasFetchedschools.current) return;
    hasFetchedschools.current = true;

    let cancelled = false;
    setSchoolStatus('loading');

    async function loadSchoolStandings() {
      try {
        const token = await getToken();
        const data = await getSchoolStandings(roundId, token);
        if (cancelled) return;
        setSchoolStandings(data);
        setSchoolStatus(data.length === 0 ? 'empty' : 'ready');
      } catch (err) {
        if (cancelled) return;
        setSchoolStatus('error');
        setSchoolErrorMessage(
          err instanceof ApiError ? err.message : 'Something went wrong loading school standings.'
        );
      }
    }

    loadSchoolStandings();
    return () => {
      cancelled = true;
    };
  }, [activeTab, roundId, getToken]);

  return (
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-3xl px-8 py-12">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Standings</h1>
      <div className="mt-3 h-px w-12 bg-lavender" aria-hidden="true" />
      <p className="mt-3 text-sm text-ink-soft">
        Round <span className="font-mono text-ink">{roundId}</span>
      </p>

      {/* Tab switcher */}
      <div
        role="tablist"
        aria-label="Standings view"
        className="mt-6 inline-flex rounded-md border border-lavender/30 p-0.5"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'entrants'}
          onClick={() => setActiveTab('entrants')}
          className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
            activeTab === 'entrants'
              ? 'bg-lavender-deep text-white'
              : 'text-ink-soft hover:text-ink'
          }`}
        >
          By Entrant
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'schools'}
          onClick={() => setActiveTab('schools')}
          className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
            activeTab === 'schools' ? 'bg-lavender-deep text-white' : 'text-ink-soft hover:text-ink'
          }`}
        >
          Per School
        </button>
      </div>

      {activeTab === 'entrants' && (
        <>
          {status === 'loading' && <p className="mt-8 text-sm text-ink-soft">Loading standings…</p>}

          {status === 'error' && (
            <div
              role="alert"
              className="mt-8 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              {errorMessage}
            </div>
          )}

          {status === 'empty' && (
            <p className="mt-8 text-sm text-ink-soft">
              No scored submissions yet — standings will appear here once entrants&apos; results are
              marked.
            </p>
          )}

          {status === 'ready' && (
            <TableScroll
              label="Entrant standings"
              className="mt-8 rounded-lg border border-lavender/20"
            >
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-lavender/20 bg-surface">
                    <th scope="col" className="px-4 py-3 font-medium text-ink-soft">
                      Rank
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium text-ink-soft">
                      Entrant
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium text-ink-soft">
                      School
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-medium text-ink-soft">
                      Score
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((row) => (
                    <tr
                      key={row.entrantId}
                      className="border-b border-lavender/10 last:border-0 hover:bg-lavender/5"
                    >
                      <td className="px-4 py-3 font-mono text-ink-soft">{row.rank}</td>
                      <td className="px-4 py-3 font-medium text-ink">{row.entrantName}</td>
                      <td className="px-4 py-3 text-ink-soft">{row.schoolName}</td>
                      <td className="px-4 py-3 text-right font-mono text-ink">
                        {row.score.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          )}
        </>
      )}

      {activeTab === 'schools' && (
        <>
          {schoolStatus === 'loading' && (
            <p className="mt-8 text-sm text-ink-soft">Loading school standings…</p>
          )}

          {schoolStatus === 'error' && (
            <div
              role="alert"
              className="mt-8 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              {schoolErrorMessage}
            </div>
          )}

          {schoolStatus === 'empty' && (
            <p className="mt-8 text-sm text-ink-soft">
              No scored submissions yet — school standings will appear here once results are marked.
            </p>
          )}

          {schoolStatus === 'ready' && (
            <TableScroll
              label="School standings"
              className="mt-8 rounded-lg border border-lavender/20"
            >
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-lavender/20 bg-surface">
                    <th scope="col" className="px-4 py-3 font-medium text-ink-soft">
                      Rank
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium text-ink-soft">
                      School
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-medium text-ink-soft">
                      Entrants
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-medium text-ink-soft">
                      Total Score
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {schoolStandings.map((row) => (
                    <tr
                      key={row.schoolId}
                      className="border-b border-lavender/10 last:border-0 hover:bg-lavender/5"
                    >
                      <td className="px-4 py-3 font-mono text-ink-soft">{row.rank}</td>
                      <td className="px-4 py-3 font-medium text-ink">{row.schoolName}</td>
                      <td className="px-4 py-3 text-right font-mono text-ink-soft">
                        {row.entrantCount}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-ink">
                        {row.totalScore.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          )}
        </>
      )}
    </main>
  );
}
