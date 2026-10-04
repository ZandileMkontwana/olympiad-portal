'use client';

// Student test-taking page (Story A2: Start an online sitting).
// Uses the student JWT session (email + password login) and starts the
// sitting directly — no name dropdown needed.

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { createSitting, saveSittingAnswers, submitSitting, ApiError } from '@/lib/api';

function SitContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const roundId = searchParams.get('id');

  const { user, checking, getToken } = useStudentAuth();

  const [phase, setPhase] = useState('loading'); // 'loading' | 'sitting' | 'error'
  const [sittingData, setSittingData] = useState(null);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved | error
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const dirtyRef = useRef(false);

  // Require a student session
  useEffect(() => {
    if (!checking && !user) {
      router.replace('/login');
    }
  }, [checking, user, router]);

  // Live countdown to the sitting's expiry (round close time)
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Start the sitting directly for the signed-in student's entrant record.
  useEffect(() => {
    if (checking || !user || !roundId) return;

    let cancelled = false;

    async function start() {
      try {
        const token = await getToken();

        if (!user.entrantId) {
          if (!cancelled) {
            setError(
              'Your account is not linked to a student record. Please contact your educator.'
            );
            setPhase('error');
          }
          return;
        }

        // Try to create (or resume) the sitting directly
        const data = await createSitting(roundId, user.entrantId, token);
        if (!cancelled) {
          setSittingData(data);
          setAnswers(data.sitting.answers || {});
          setPhase('sitting');
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Sit page error:', err);
          const message =
            err instanceof ApiError
              ? err.message
              : err?.message || 'Could not start the test. Please contact your educator.';
          setError(message);
          setPhase('error');
        }
      }
    }

    start();

    return () => {
      cancelled = true;
    };
  }, [checking, user, roundId, getToken]);

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

  function updateAnswer(questionId, value) {
    dirtyRef.current = true;
    setSaveState('idle');
    setAnswers((prev) => ({ ...prev, [questionId]: value.toUpperCase() }));
  }

  // Submit (Story A5): flush any unsaved answers first so the server marks
  // what the student sees on screen, then submit the test for marking.
  async function handleSubmitSitting() {
    if (
      !window.confirm(
        `Submit your answers? You answered ${answeredCount} of ${questions.length} questions. This can't be undone.`
      )
    ) {
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const token = await getToken();

      if (dirtyRef.current) {
        dirtyRef.current = false;
        await saveSittingAnswers(sittingData.sitting.id, answers, token);
      }

      await submitSitting(sittingData.sitting.id, token);
      setSubmitted(true);
    } catch (err) {
      dirtyRef.current = true;
      setError(err instanceof ApiError ? err.message : 'Could not submit the test.');
    } finally {
      setSubmitting(false);
    }
  }

  const answeredCount = questions.filter((q) => answers[q]).length;

  if (checking || !user) {
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

  if (phase === 'loading') {
    return (
      <main className="round-page">
        <h1>Take a Test</h1>
        <p className="description" style={{ fontSize: '1.1rem' }}>
          Loading your test…
        </p>
      </main>
    );
  }

  if (phase === 'error') {
    return (
      <main className="round-page">
        <h1>Take a Test</h1>
        <div
          role="alert"
          className="message"
          style={{
            border: '1px solid rgba(224,97,95,0.3)',
            borderRadius: '8px',
            padding: '16px',
            background: 'rgba(224,97,95,0.05)',
            color: '#e0615f',
          }}
        >
          {error}
        </div>
        <p style={{ marginTop: '24px' }}>
          <Link href="/student" className="button">
            &larr; Back to dashboard
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="round-page">
      <h1>{sittingData ? sittingData.round.name : 'Take a Test'}</h1>

      {error && <p className="message">{error}</p>}

      {sittingData && !submitted && (
        <>
          <p
            className="description sit-status"
            style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '1.1rem' }}
          >
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
              This test has expired — the round has closed. Your saved answers remain on record.
            </p>
          )}

          {questions.length === 0 ? (
            <p className="message">
              No answerable questions found for this paper yet. You can still view the paper below.
            </p>
          ) : (
            <div className="card" style={{ padding: '24px' }}>
              {questions.map((q) => (
                <div
                  key={q}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '14px 0',
                    borderBottom: '1px solid rgba(139, 92, 246, 0.15)',
                  }}
                >
                  <strong style={{ minWidth: '56px', fontSize: '1.15rem' }}>Q{q}</strong>
                  <input
                    type="text"
                    className="sit-answer"
                    autoComplete="off"
                    autoCapitalize="characters"
                    maxLength={1}
                    placeholder="—"
                    value={answers[q] || ''}
                    onChange={(e) => updateAnswer(q, e.target.value)}
                    disabled={timeRemaining === 'expired'}
                    style={{
                      width: '60px',
                      textAlign: 'center',
                      padding: '10px',
                      fontSize: '1.15rem',
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
            Your answers auto-save as you type — nothing is final until you submit.
          </p>

          <button
            type="button"
            onClick={handleSubmitSitting}
            disabled={submitting || timeRemaining === 'expired'}
            className="button"
            style={{ marginTop: '8px', fontSize: '17px' }}
          >
            {submitting ? 'Submitting…' : 'Submit test'}
          </button>
        </>
      )}

      {sittingData && submitted && (
        <div className="card" style={{ padding: '24px' }}>
          <h2 style={{ marginTop: 0 }}>Submission received</h2>
          <p className="description">
            Your answers for {sittingData.round.name} have been submitted —{' '}
            {questions.length > 0
              ? `${answeredCount} of ${questions.length} questions answered.`
              : 'no questions were answerable for this paper.'}
          </p>
          <p className="description">
            Results are released after the round closes and marking completes — your educator will
            have them.
          </p>
        </div>
      )}

      <p style={{ marginTop: '24px' }}>
        <Link href="/student" className="button">
          &larr; Back to dashboard
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
