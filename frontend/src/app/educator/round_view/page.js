'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { releaseResults, unreleaseResults } from '@/lib/api';

function formatRemaining(ms) {
  if (ms <= 0) return 'closing any moment';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function RoundViewContent() {
  const searchParams = useSearchParams();
  const roundId = searchParams.get('id');
  const { getToken } = useAuth();

  const [round, setRound] = useState(null);
  const [loading, setLoading] = useState(!!roundId);
  const [error, setError] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const [timeRemaining, setTimeRemaining] = useState('');
  const [certificateEntrants, setCertificateEntrants] = useState([]);
  const [certificateError, setCertificateError] = useState('');
  const [certificateLoading, setCertificateLoading] = useState(false);
  const [releaseStatus, setReleaseStatus] = useState('idle'); // idle | releasing | released | unreleasing | error
  const [releaseMessage, setReleaseMessage] = useState('');

  useEffect(() => {
    if (!roundId) return;

    async function fetchRound() {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/rounds/${roundId}`
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch round');
        }

        setRound(data);
        setError('');
        // Detect release state from fresh round data
        if (data.hasReleasedResults) {
          setReleaseStatus('released');
          setReleaseMessage('Results have been released to students.');
        }
      } catch (error) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    }

    fetchRound();

    const interval = setInterval(fetchRound, 15000);

    return () => clearInterval(interval);
  }, [roundId]);

  // Live countdown to closeTime, ticking every second independent of the 15s poll
  useEffect(() => {
    if (!round?.closeTime) return;

    function tick() {
      const remainingMs = new Date(round.closeTime).getTime() - Date.now();
      setTimeRemaining(formatRemaining(remainingMs));
    }

    tick();
    const countdownInterval = setInterval(tick, 1000);
    return () => clearInterval(countdownInterval);
  }, [round?.closeTime]);

  // Fetch school entrants + submissions when round is released
  useEffect(() => {
    if (!roundId || round?.state !== 'released') return;

    async function loadCertificateData() {
      setCertificateLoading(true);
      setCertificateError('');
      try {
        const token = await getToken();

        const [entrantsRes, submissionsRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/entrants`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/rounds/${roundId}/submissions`),
        ]);

        if (!entrantsRes.ok) throw new Error('Could not load school entrants');
        if (!submissionsRes.ok) throw new Error('Could not load submissions');

        const [entrants, submissions] = await Promise.all([
          entrantsRes.json(),
          submissionsRes.json(),
        ]);

        // Build a lookup: entrantId -> score (only for submissions with a result)
        const resultsByEntrant = new Map();
        for (const sub of submissions) {
          if (sub.result) {
            resultsByEntrant.set(sub.entrantId, sub.result.score);
          }
        }

        // Only show entrants who have a result
        const withResults = entrants
          .filter((e) => resultsByEntrant.has(e.id))
          .map((e) => ({ ...e, score: resultsByEntrant.get(e.id) }));

        setCertificateEntrants(withResults);
      } catch (err) {
        setCertificateError(err.message);
      } finally {
        setCertificateLoading(false);
      }
    }

    loadCertificateData();
  }, [roundId, round?.state, getToken]);

  async function handleDownload() {
    setDownloadError('');
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/rounds/${roundId}/papers`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch paper');
      }

      window.location.href = `${process.env.NEXT_PUBLIC_API_BASE_URL}${data.fileUrl}`;
    } catch (error) {
      setDownloadError(error.message);
    }
  }

  async function handleCertificateDownload(entrantId) {
    try {
      const token = await getToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/rounds/${roundId}/certificates/${entrantId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to download certificate');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = response.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="?([^"]+)"?/);
      a.download = match ? match[1] : 'certificate.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setCertificateError(err.message);
    }
  }

  if (!roundId) {
    return (
      <main className="round-page">
        <div className="message">No round ID was provided.</div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="round-page">
        <p>Loading round...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="round-page">
        <div className="message">{error}</div>
      </main>
    );
  }

  return (
    <main className="round-page">
      <div className="round-header">
        <h1>{round.name}</h1>

        <span className={`status ${round.state}`}>{round.state}</span>
      </div>

      <div className="round-information">
        <div>
          <strong>Opening Time</strong>
          <p>{new Date(round.openTime).toLocaleString()}</p>
        </div>

        <div>
          <strong>Closing Time</strong>
          <p>{new Date(round.closeTime).toLocaleString()}</p>
        </div>
      </div>

      <div className="card">
        <h2>Round Details</h2>

        <p className="description">This round is currently {round.state}.</p>

        {round.state === 'open' && (
          <>
            <button className="button" onClick={handleDownload}>
              Download Paper
            </button>
            {downloadError && <p className="message">{downloadError}</p>}

            <p className="description">Submissions are open. Closes in {timeRemaining}.</p>

            <Link href={`/educator/submit?id=${roundId}`} className="button">
              Submit Results
            </Link>
          </>
        )}

        {round.state === 'released' && (
          <>
            <h3 style={{ marginTop: '16px' }}>Certificates</h3>

            {certificateLoading && (
              <p className="description">Loading results...</p>
            )}

            {certificateError && (
              <p className="message">{certificateError}</p>
            )}

            {!certificateLoading && certificateEntrants.length === 0 && !certificateError && (
              <p className="description">
                No certificates available yet — results have not been recorded for your students.
              </p>
            )}

            {certificateEntrants.length > 0 && (
              <ul style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px', padding: 0, listStyle: 'none' }}>
                {certificateEntrants.map((entrant) => (
                  <li
                    key={entrant.id}
                    className="card"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                    }}
                  >
                    <div>
                      <strong>{entrant.name}</strong>
                      <span style={{ marginLeft: '12px', color: '#6b7280', fontSize: '0.9em' }}>
                        Score: {entrant.score}
                      </span>
                    </div>
                    <button
                      className="button"
                      onClick={() => handleCertificateDownload(entrant.id)}
                    >
                      Download Certificate
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {round.state === 'closed' && (
          <div style={{ marginTop: '12px' }}>
            {releaseStatus === 'released' ? (
              <div>
                <div className="message" style={{ background: '#e8f5e9', color: '#2e7d32', border: '1px solid #a5d6a7' }}>
                  {releaseMessage}
                </div>
                <button
                  className="button"
                  style={{ marginTop: '8px', background: 'transparent', color: '#e0615f', border: '1px solid rgba(224,97,95,0.3)' }}
                  disabled={releaseStatus === 'unreleasing'}
                  onClick={async () => {
                    if (!window.confirm(
                      'Are you sure you want to hide results? Students will no longer be able to see their marks.'
                    )) return;
                    setReleaseStatus('unreleasing');
                    try {
                      const token = await getToken();
                      const data = await unreleaseResults(roundId, token);
                      setReleaseStatus('idle');
                      setReleaseMessage('');
                      // Force re-fetch to update hasReleasedResults
                      const response = await fetch(
                        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/rounds/${roundId}`
                      );
                      const freshRound = await response.json();
                      if (response.ok) setRound(freshRound);
                    } catch (err) {
                      setReleaseStatus('error');
                      setReleaseMessage(err.message || 'Could not unrelease results.');
                    }
                  }}
                >
                  {releaseStatus === 'unreleasing' ? 'Hiding\u2026' : 'Hide Results from Students'}
                </button>
              </div>
            ) : (
              <>
                <button
                  className="button"
                  disabled={releaseStatus === 'releasing'}
                  onClick={async () => {
                    if (!window.confirm(
                      'Are you sure you want to release results? Students will immediately be able to see their marks.'
                    )) return;
                    setReleaseStatus('releasing');
                    setReleaseMessage('');
                    try {
                      const token = await getToken();
                      const data = await releaseResults(roundId, token);
                      setReleaseStatus('released');
                      setReleaseMessage(
                        data.releasedCount > 0
                          ? `Released ${data.releasedCount} result${data.releasedCount !== 1 ? 's' : ''}. Students can now view their marks.`
                          : 'No unreleased results found for this round.'
                      );
                      // Force re-fetch to update hasReleasedResults
                      const response = await fetch(
                        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/rounds/${roundId}`
                      );
                      const freshRound = await response.json();
                      if (response.ok) setRound(freshRound);
                    } catch (err) {
                      setReleaseStatus('error');
                      setReleaseMessage(err.message || 'Could not release results.');
                    }
                  }}
                >
                  {releaseStatus === 'releasing' ? 'Releasing\u2026' : 'Release Results to Students'}
                </button>
                {releaseStatus === 'error' && (
                  <p className="message" style={{ marginTop: '8px' }}>{releaseMessage}</p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
export default function RoundViewPage() {
  return (
    <Suspense fallback={<main className="round-page">Loading round...</main>}>
      <RoundViewContent />
    </Suspense>
  );
}
