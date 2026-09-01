'use client';

// Student test-taking page (Story A2: Start an online sitting).
// Loads an open round's paper and lets a registered entrant answer
// questions directly in the browser.

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { createSitting, saveSittingAnswers, fetchRoundEntrants, ApiError } from '@/lib/api';

function SitContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const roundId = searchParams.get('id');

  const { isLoaded, isSignedIn, getToken } = useAuth();

  const [entrants, setEntrants] = useState([]);
  const [selectedEntrantId, setSelectedEntrantId] = useState('');
  const [phase, setPhase] = useState('picking'); // 'picking' | 'sitting'
  const [sittingData, setSittingData] = useState(null);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved | error
  const dirtyRef = useRef(false);

  // Require sign-in
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.replace('/login');
    }
  }, [isLoaded, isSignedIn, router]);

  // Live countdown to the sitting's expiry (round close time)
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Load the round's entrants so the student can pick who they are.
  // (Until D3 links Clerk accounts to entrant records, the student
  // identifies themselves by name.)
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !roundId) return;

    let cancelled = false;
    fetchRoundEntrants(roundId)
      .then((data) => {
        if (cancelled) return;
        setEntrants(data);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load entrants for this round.');
      });

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, roundId]);

  const questions = useMemo(
    () => (sittingData ? sittingData.paper.questions.sort((a, b) => Number(a) - Number(b)) : []),
    [sittingData]
  );

  const timeRemaining = useMemo(() => {
    if (!sittingData) return null;
    const remainingMs = new Date(sittingData.sitting.expiresAt).getTime() - now;
    if (remainingMs <= 0) return 'expired';
    const hours = Math.floor(remainingMs / 3600000);
    const minutes = Math.floor((remainingMs % 3600000) / 60000);
    const seconds = Math.floor((remainingMs % 60000) / 1000);
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, [sittingData, now]);

  // Auto-save (Story A3): a second of quiet after an answer change sends the
  // current answers to the server, so a refresh never loses progress.
  useEffect(() => {
    if (phase !== 'sitting' || !sittingData || !dirtyRef.current) return;

    const timer = setTimeout(async () => {
      dirtyRef.current = false;
      setSaveState('saving');
      try {
        const token = await getToken();
        await saveSittingAnswers(sittingData.sitting.id, answers, token);
        setSaveState('saved');
      } catch {
        dirtyRef.current = true;
        setSaveState('error');
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [answers, phase, sittingData, getToken]);

  async function handleStartSitting() {
    if (!selectedEntrantId) return;

    setLoading(true);
    setError('');

    try {
      const token = await getToken();
      const data = await createSitting(roundId, selectedEntrantId, token);
      setSittingData(data);
      setAnswers(data.sitting.answers || {});
      setPhase('sitting');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start the sitting.');
    } finally {
      setLoading(false);
    }
  }

  function updateAnswer(questionId, value) {
    dirtyRef.current = true;
    setSaveState('idle');
    setAnswers((prev) => ({ ...prev, [questionId]: value.toUpperCase() }));
  }

  const answeredCount = questions.filter((q) => answers[q]).length;

  if (!isLoaded || !isSignedIn) {
    return (
      <main className="round-page">
        <p>Loading...</p>
      </main>
    );
  }

  if (!roundId) {
    return (
      <main className="round-page">
        <div className="message">No round ID was provided.</div>
      </main>
    );
  }

  return (
    <main className="round-page">
      <h1>{phase === 'sitting' && sittingData ? sittingData.round.name : 'Take a Test'}</h1>

      {error && <p className="message">{error}</p>}

      {phase === 'picking' && (
        <>
          <p className="description">
            Select your name to start. You must be registered for this round, and the round must be
            open.
          </p>

          {entrants.length === 0 && !error && (
            <p className="description">
              No entrants registered for this round yet. Ask your educator to register you.
            </p>
          )}

          {entrants.length > 0 && (
            <div className="card" style={{ padding: '16px' }}>
              <label htmlFor="entrant-select" style={{ display: 'block', marginBottom: '8px' }}>
                Who are you?
              </label>
              <select
                id="entrant-select"
                value={selectedEntrantId}
                onChange={(e) => setSelectedEntrantId(e.target.value)}
                style={{ width: '100%', padding: '8px', marginBottom: '12px' }}
              >
                <option value="">— Select your name —</option>
                {entrants.map((entrant) => (
                  <option key={entrant.id} value={entrant.id}>
                    {entrant.name} (Grade {entrant.grade})
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleStartSitting}
                disabled={!selectedEntrantId || loading}
                className="button"
              >
                {loading ? 'Starting…' : 'Start sitting'}
              </button>
            </div>
          )}
        </>
      )}

      {phase === 'sitting' && sittingData && (
        <>
          <p className="description" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <span>
              Time remaining:{' '}
              <strong style={{ color: timeRemaining === 'expired' ? '#dc2626' : undefined }}>
                {timeRemaining === 'expired' ? 'EXPIRED' : timeRemaining}
              </strong>
            </span>
            <span>
              Answered: <strong>{answeredCount}</strong> / {questions.length}
            </span>
            {saveState !== 'idle' && (
              <span>
                {saveState === 'saving' && 'Saving…'}
                {saveState === 'saved' && 'Saved'}
                {saveState === 'error' && 'Not saved — will retry on next answer'}
              </span>
            )}
          </p>

          {timeRemaining === 'expired' && (
            <p className="message">
              This sitting has expired — the round has closed. Your saved answers remain on record.
            </p>
          )}

          {questions.length === 0 ? (
            <p className="message">
              No answerable questions found for this paper yet. You can still view the paper below.
            </p>
          ) : (
            <div className="card" style={{ padding: '16px' }}>
              {questions.map((q) => (
                <div
                  key={q}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 0',
                    borderBottom: '1px solid rgba(139, 92, 246, 0.15)',
                  }}
                >
                  <strong style={{ minWidth: '40px' }}>Q{q}</strong>
                  <input
                    type="text"
                    maxLength={1}
                    placeholder="—"
                    value={answers[q] || ''}
                    onChange={(e) => updateAnswer(q, e.target.value)}
                    disabled={timeRemaining === 'expired'}
                    style={{
                      width: '48px',
                      textAlign: 'center',
                      padding: '8px',
                    }}
                    aria-label={`Answer for question ${q}`}
                  />
                </div>
              ))}
            </div>
          )}

          <p className="description" style={{ marginTop: '16px' }}>
            Questions come from the paper&apos;s memo. Open the paper for full question text:
          </p>
          <p>
            <a
              href={sittingData.paper.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="button"
            >
              View paper (PDF)
            </a>
          </p>

          <p className="description" style={{ marginTop: '16px', fontStyle: 'italic' }}>
            Your answers auto-save as you type. Submitting the sitting (A5) comes next.
          </p>
        </>
      )}

      <p style={{ marginTop: '24px' }}>
        <Link href={`/educator/round_view?id=${roundId}`} className="button">
          ← Back to round
        </Link>
      </p>
    </main>
  );
}

export default function SitPage() {
  return (
    <Suspense fallback={<main className="round-page">Loading...</main>}>
      <SitContent />
    </Suspense>
  );
}
