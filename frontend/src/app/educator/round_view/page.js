'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import {
  listRoundSubmissions,
  requestRemark,
  ApiError,
  releaseResults,
  unreleaseResults,
  fetchCurrentUser,
  fetchSchoolAnalytics,
} from '@/lib/api';
import ParticipationChart from '@/components/charts/ParticipationChart';
import ScoreDistributionChart from '@/components/charts/ScoreDistributionChart';
import QuestionPerformanceChart from '@/components/charts/QuestionPerformanceChart';

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
  const [releaseStatus, setReleaseStatus] = useState('idle'); // idle | releasing | unreleasing | error
  const [releaseMessage, setReleaseMessage] = useState('');

  const [schoolId, setSchoolId] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsStatus, setAnalyticsStatus] = useState('idle'); // idle | loading | ready | error
  const [analyticsError, setAnalyticsError] = useState('');

  const [submissions, setSubmissions] = useState([]);
  const [submissionsStatus, setSubmissionsStatus] = useState('loading'); // loading | ready | error
  const [remarkTargetId, setRemarkTargetId] = useState(null);
  const [remarkReason, setRemarkReason] = useState('');
  const [remarkStatus, setRemarkStatus] = useState('idle'); // idle | submitting | error
  const [remarkError, setRemarkError] = useState('');

  const loadSubmissions = useCallback(async () => {
    if (!roundId) return;
    try {
      const token = await getToken();
      const data = await listRoundSubmissions(roundId, token);
      setSubmissions(data);
      setSubmissionsStatus('ready');
    } catch {
      setSubmissionsStatus('error');
    }
  }, [roundId, getToken]);

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
    const reason = remarkReason.trim();

    if (!remarkTargetId) return;
    if (!reason) {
      setRemarkStatus('error');
      setRemarkError('Enter a reason for the appeal.');
      return;
    }

    setRemarkStatus('submitting');
    setRemarkError('');
    try {
      const token = await getToken();
      await requestRemark(remarkTargetId, reason, token);
      setRemarkTargetId(null);
      await loadSubmissions();
    } catch (err) {
      setRemarkStatus('error');
      setRemarkError(err instanceof ApiError ? err.message : 'Could not submit remark request.');
    }
  }
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
          fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/rounds/${roundId}/submissions`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
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

  // Resolve the signed-in educator's own school once, so the analytics
  // fetch below can scope the request to it (GET
  // /analytics/rounds/:roundId/schools/:schoolId — backend/src/routes/analytics.js).
  useEffect(() => {
    let cancelled = false;

    async function loadSchoolId() {
      const token = await getToken();
      const user = await fetchCurrentUser(token);
      if (!cancelled && user?.school?.id) {
        setSchoolId(user.school.id);
      }
    }

    loadSchoolId();

    return () => {
      cancelled = true;
    };
  }, [getToken]);

  // School-level analytics only make sense once the round has stopped
  // taking submissions — same gating as the organiser view in
  // rounds/[id]/closed_round/page.js (#278).
  useEffect(() => {
    if (!roundId || !schoolId) return;
    if (round?.state !== 'closed' && round?.state !== 'released') return;

    let cancelled = false;

    async function loadAnalytics() {
      setAnalyticsStatus('loading');
      setAnalyticsError('');
      try {
        const token = await getToken();
        const data = await fetchSchoolAnalytics(roundId, schoolId, token);
        if (!cancelled) {
          setAnalytics(data);
          setAnalyticsStatus('ready');
        }
      } catch (err) {
        if (!cancelled) {
          setAnalyticsStatus('error');
          setAnalyticsError(
            err instanceof ApiError ? err.message : 'Could not load your school’s analytics.'
          );
        }
      }
    }

    loadAnalytics();

    return () => {
      cancelled = true;
    };
  }, [roundId, schoolId, round?.state, getToken]);

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

      // fileUrl is already a full Supabase URL, so use it directly
      window.location.href = data.fileUrl;
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

  async function handleRelease() {
    if (
      !window.confirm(
        'Are you sure you want to release results? Students will immediately be able to see their marks.'
      )
    )
      return;
    setReleaseStatus('releasing');
    setReleaseMessage('');
    try {
      const token = await getToken();
      await releaseResults(roundId, token);
      // Force re-fetch: the round flips to 'released', which switches this
      // view over to the certificates section.
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/rounds/${roundId}`);
      const freshRound = await response.json();
      if (response.ok) setRound(freshRound);
      setReleaseStatus('idle');
    } catch (err) {
      setReleaseStatus('error');
      setReleaseMessage(err.message || 'Could not release results.');
    }
  }

  async function handleUnrelease() {
    if (
      !window.confirm(
        'Are you sure you want to hide results? Students will no longer be able to see their marks.'
      )
    )
      return;
    setReleaseStatus('unreleasing');
    try {
      const token = await getToken();
      await unreleaseResults(roundId, token);
      // Force re-fetch: the round drops back to 'closed', restoring the
      // release controls.
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/rounds/${roundId}`);
      const freshRound = await response.json();
      if (response.ok) setRound(freshRound);
      setReleaseStatus('idle');
    } catch (err) {
      setReleaseStatus('error');
      setReleaseMessage(err.message || 'Could not unrelease results.');
    }
  }

  if (!roundId) {
    return (
      <div className="round-page">
        <div className="message">No round ID was provided.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="round-page">
        <p style={{ color: 'var(--c-t-6d667c)', fontSize: '14px' }}>Loading round...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="round-page">
        <div className="message" role="alert">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="round-page">
      <div className="round-header">
        <h1>{round.name}</h1>

        <span className={`status ${round.state}`}>{round.state}</span>
      </div>

      <div className="round-information">
        <div>
          <strong>Opening Time</strong>
          <p>
            {new Date(round.openTime).toLocaleString('en-ZA', {
              timeZone: round.olympiad?.timezone || undefined,
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
            {round.olympiad?.timezone && (
              <small style={{ marginLeft: '6px', color: 'var(--c-t-706391)' }}>
                ({round.olympiad.timezone})
              </small>
            )}
          </p>
        </div>

        <div>
          <strong>Closing Time</strong>
          <p>
            {new Date(round.closeTime).toLocaleString('en-ZA', {
              timeZone: round.olympiad?.timezone || undefined,
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
            {round.olympiad?.timezone && (
              <small style={{ marginLeft: '6px', color: 'var(--c-t-706391)' }}>
                ({round.olympiad.timezone})
              </small>
            )}
          </p>
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
            {downloadError && (
              <p className="message" role="alert">
                {downloadError}
              </p>
            )}

            <p className="description">Submissions are open. Closes in {timeRemaining}.</p>

            <Link href={`/educator/submit?id=${roundId}`} className="button">
              Submit Results
            </Link>
          </>
        )}

        {round.state === 'released' && (
          <>
            <h3 style={{ marginTop: '16px' }}>Certificates</h3>

            {certificateLoading && <p className="description">Loading results...</p>}

            {certificateError && (
              <p className="message" role="alert">
                {certificateError}
              </p>
            )}

            {!certificateLoading && certificateEntrants.length === 0 && !certificateError && (
              <p className="description">
                No certificates available yet — results have not been recorded for your students.
              </p>
            )}

            {certificateEntrants.length > 0 && (
              <ul
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  marginTop: '8px',
                  padding: 0,
                  listStyle: 'none',
                }}
              >
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
                      <span
                        style={{
                          marginLeft: '12px',
                          color: 'var(--c-t-646b78)',
                          fontSize: '0.9em',
                        }}
                      >
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

            <button
              className="button"
              style={{
                marginTop: '16px',
                background: 'transparent',
                color: 'var(--c-t-b42318)',
                border: '1px solid rgba(224,97,95,0.3)',
              }}
              disabled={releaseStatus === 'unreleasing'}
              onClick={handleUnrelease}
            >
              {releaseStatus === 'unreleasing' ? 'Hiding\u2026' : 'Hide Results from Students'}
            </button>
            {releaseStatus === 'error' && (
              <p className="message" role="alert" style={{ marginTop: '8px' }}>
                {releaseMessage}
              </p>
            )}
          </>
        )}

        {round.state === 'closed' && (
          <div style={{ marginTop: '12px' }}>
            <button
              className="button"
              disabled={releaseStatus === 'releasing'}
              onClick={handleRelease}
            >
              {releaseStatus === 'releasing' ? 'Releasing\u2026' : 'Release Results to Students'}
            </button>
            {releaseStatus === 'error' && (
              <p className="message" role="alert" style={{ marginTop: '8px' }}>
                {releaseMessage}
              </p>
            )}
          </div>
        )}
      </div>

      {(round.state === 'closed' || round.state === 'released') && (
        <div className="card" aria-label="Your school's analytics">
          <h2>Your School&apos;s Analytics</h2>

          {analyticsStatus === 'loading' && (
            <p className="description">Loading your school&apos;s analytics...</p>
          )}

          {analyticsStatus === 'error' && (
            <p className="message" role="alert">
              {analyticsError}
            </p>
          )}

          {analyticsStatus === 'ready' && analytics && (
            <>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '16px',
                  marginTop: '8px',
                  marginBottom: '16px',
                }}
              >
                <div className="card" style={{ flex: '1 1 160px' }}>
                  <strong>Average Score</strong>
                  <p style={{ fontSize: '1.4em', margin: '4px 0 0 0' }}>
                    {analytics.scores.average.toFixed(1)} / {analytics.round.maxScore}
                  </p>
                </div>
                <div className="card" style={{ flex: '1 1 160px' }}>
                  <strong>Median Score</strong>
                  <p style={{ fontSize: '1.4em', margin: '4px 0 0 0' }}>
                    {analytics.scores.median.toFixed(1)} / {analytics.round.maxScore}
                  </p>
                </div>
                <div className="card" style={{ flex: '1 1 160px' }}>
                  <strong>Completion Rate</strong>
                  <p style={{ fontSize: '1.4em', margin: '4px 0 0 0' }}>
                    {Math.round(analytics.participation.completionRate * 100)}%
                  </p>
                </div>
              </div>

              <div className="card" style={{ marginBottom: '16px' }}>
                <ParticipationChart
                  totalEntrants={analytics.participation.totalEntrants}
                  completedSubmissions={analytics.participation.completedSubmissions}
                />
              </div>

              <div className="card" style={{ marginBottom: '16px' }}>
                <ScoreDistributionChart
                  data={analytics.scores.distribution}
                  maxScore={analytics.round.maxScore}
                />
              </div>

              <div className="card">
                <QuestionPerformanceChart questions={analytics.questions} />
              </div>
            </>
          )}
        </div>
      )}

      <div className="card">
        <h2>Submissions &amp; Remarks</h2>

        {submissionsStatus === 'loading' && <p className="description">Loading submissions...</p>}
        {submissionsStatus === 'error' && (
          <p className="message" role="alert">
            Couldn&apos;t load submissions for this round.
          </p>
        )}
        {submissionsStatus === 'ready' && submissions.length === 0 && (
          <p className="description">No submissions yet for this round.</p>
        )}

        {submissionsStatus === 'ready' && submissions.length > 0 && (
          <ul style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {submissions.map((submission) => {
              const activeRemark = (submission.remarkRequests || []).find((remark) =>
                ['pending', 'assigned'].includes(remark.status)
              );
              const activeRemarkLabel =
                activeRemark?.status === 'assigned' ? 'Remark under review' : 'Remark pending';

              return (
                <li
                  key={submission.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid var(--lavender, var(--c-bd-e5e5e5))',
                    paddingBottom: '8px',
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontWeight: 600 }}>
                      {submission.entrant?.name || 'Unknown entrant'}
                    </p>
                    <p className="description" style={{ margin: '2px 0 0 0', fontSize: '0.85em' }}>
                      {submission.result ? `Score: ${submission.result.score}` : 'Not yet marked'}
                      {activeRemark && ` · ${activeRemarkLabel}`}
                    </p>
                  </div>
                  {submission.result && !activeRemark && (
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
              onChange={(e) => {
                setRemarkReason(e.target.value);
                if (remarkStatus === 'error') {
                  setRemarkStatus('idle');
                  setRemarkError('');
                }
              }}
              rows={3}
              required
              aria-describedby={remarkStatus === 'error' ? 'remark-error' : undefined}
              className="block rounded-md border border-lavender/30 px-3 py-2 text-sm"
              style={{ background: 'var(--t-surface, #fff)', color: 'var(--ink, #241f38)' }}
            />
            {remarkStatus === 'error' && (
              <p
                id="remark-error"
                role="alert"
                style={{ color: 'var(--c-t-b42318)', fontSize: '0.9em' }}
              >
                {remarkError}
              </p>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="submit"
                disabled={remarkStatus === 'submitting' || !remarkReason.trim()}
                className="button"
              >
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
    </div>
  );
}
export default function RoundViewPage() {
  return (
    <Suspense
      fallback={
        <div className="round-page">
          <p style={{ color: 'var(--c-t-6d667c)', fontSize: '14px' }}>Loading round...</p>
        </div>
      }
    >
      <RoundViewContent />
    </Suspense>
  );
}
