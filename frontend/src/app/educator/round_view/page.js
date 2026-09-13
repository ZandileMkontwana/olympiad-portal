'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { listRoundSubmissions, requestRemark, ApiError } from '@/lib/api';

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

  const [submissions, setSubmissions] = useState([]);
  const [submissionsStatus, setSubmissionsStatus] = useState('loading'); // loading | ready | error
  const [remarkTargetId, setRemarkTargetId] = useState(null);
  const [remarkReason, setRemarkReason] = useState('');
  const [remarkStatus, setRemarkStatus] = useState('idle'); // idle | submitting | error
  const [remarkError, setRemarkError] = useState('');

  const loadSubmissions = useCallback(async () => {
    if (!roundId) return;
    try {
      const data = await listRoundSubmissions(roundId);
      setSubmissions(data);
      setSubmissionsStatus('ready');
    } catch {
      setSubmissionsStatus('error');
    }
  }, [roundId]);

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

  useEffect(() => {
    // Deferring via .then() so loadSubmissions' setState calls don't run
    // synchronously within the effect body itself (react-hooks/set-state-in-effect).
    Promise.resolve().then(loadSubmissions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundId]);

  function openRemarkForm(submissionId) {
    setRemarkTargetId(submissionId);
    setRemarkReason('');
    setRemarkStatus('idle');
    setRemarkError('');
  }

  async function handleSubmitRemark(e) {
    e.preventDefault();
    if (!remarkTargetId || !remarkReason.trim()) return;

    setRemarkStatus('submitting');
    setRemarkError('');
    try {
      const token = await getToken();
      await requestRemark(remarkTargetId, remarkReason.trim(), token);
      setRemarkTargetId(null);
      await loadSubmissions();
    } catch (err) {
      setRemarkStatus('error');
      setRemarkError(err instanceof ApiError ? err.message : 'Could not submit remark request.');
    }
  }

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

            <Link href={`/student/sit?id=${roundId}`} className="button">
              Sit Paper Online
            </Link>

            <p className="description">Submissions are open. Closes in {timeRemaining}.</p>

            <Link href={`/educator/submit?id=${roundId}`} className="button">
              Submit Results
            </Link>
          </>
        )}
      </div>

      <div className="card">
        <h2>Submissions &amp; Remarks</h2>

        {submissionsStatus === 'loading' && <p className="description">Loading submissions...</p>}
        {submissionsStatus === 'error' && (
          <p className="message">Couldn&apos;t load submissions for this round.</p>
        )}
        {submissionsStatus === 'ready' && submissions.length === 0 && (
          <p className="description">No submissions yet for this round.</p>
        )}

        {submissionsStatus === 'ready' && submissions.length > 0 && (
          <ul style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {submissions.map((submission) => {
              const hasPendingRemark = (submission.remarkRequests || []).some(
                (r) => r.status === 'pending'
              );
              return (
                <li
                  key={submission.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid var(--lavender, #e5e5e5)',
                    paddingBottom: '8px',
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontWeight: 600 }}>
                      {submission.entrant?.name || 'Unknown entrant'}
                    </p>
                    <p className="description" style={{ margin: '2px 0 0 0', fontSize: '0.85em' }}>
                      {submission.result ? `Score: ${submission.result.score}` : 'Not yet marked'}
                      {hasPendingRemark && ' · Remark pending'}
                    </p>
                  </div>
                  {submission.result && !hasPendingRemark && (
                    <button className="button" onClick={() => openRemarkForm(submission.id)}>
                      Request Remark
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {remarkTargetId && (
          <form
            onSubmit={handleSubmitRemark}
            style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}
          >
            <label htmlFor="remark-reason">Why are you requesting a remark?</label>
            <textarea
              id="remark-reason"
              value={remarkReason}
              onChange={(e) => setRemarkReason(e.target.value)}
              rows={3}
              required
              className="block rounded-md border border-lavender/30 bg-white px-3 py-2 text-sm"
            />
            {remarkStatus === 'error' && (
              <p style={{ color: 'red', fontSize: '0.9em' }}>{remarkError}</p>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" disabled={remarkStatus === 'submitting'} className="button">
                {remarkStatus === 'submitting' ? 'Submitting...' : 'Submit Remark Request'}
              </button>
              <button
                type="button"
                onClick={() => setRemarkTargetId(null)}
                className="button"
                style={{ background: 'transparent', color: 'inherit' }}
              >
                Cancel
              </button>
            </div>
          </form>
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
