'use client';

// Student result review page — shows a released result in full: the score,
// every question with the student's answer next to the correct answer,
// and a link back to the original paper.

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { fetchMyResult } from '@/lib/api';

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function scoreMessage(score) {
  if (score >= 80) return 'Excellent work!';
  if (score >= 60) return 'Well done!';
  if (score >= 40) return 'Good effort — keep practising!';
  return 'Keep going — every round makes you stronger!';
}

function QuestionRow({ question, index }) {
  return (
    <li
      className={`flex flex-wrap items-center gap-4 rounded-xl border p-5 shadow-sm sm:gap-6 ${
        question.isCorrect
          ? 'border-sage/25 bg-sage/[0.04]'
          : 'border-red-200 bg-red-50/60'
      }`}
    >
      <p className="font-display text-xl font-semibold text-ink">
        Q{index + 1}
      </p>

      <div className="flex flex-1 flex-wrap items-center gap-x-6 gap-y-2">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-ink-soft">
            Your answer
          </p>
          <p className="mt-0.5 font-mono text-2xl font-semibold text-ink">
            {question.studentAnswer ?? '—'}
          </p>
        </div>

        {!question.isCorrect && (
          <>
            <span aria-hidden="true" className="text-2xl text-ink-soft">
              →
            </span>
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-ink-soft">
                Correct answer
              </p>
              <p className="mt-0.5 font-mono text-2xl font-semibold text-sage">
                {question.correctAnswer}
              </p>
            </div>
          </>
        )}
      </div>

      <span
        className={`rounded-full px-4 py-1.5 text-base font-semibold ${
          question.isCorrect
            ? 'bg-sage/10 text-sage'
            : 'bg-red-100 text-red-700'
        }`}
      >
        {question.isCorrect ? '✓ Correct' : '✗ Incorrect'}
      </span>
    </li>
  );
}

function ResultContent() {
  const searchParams = useSearchParams();
  const resultId = searchParams.get('id');

  const { user, checking, getToken } = useStudentAuth();

  const [result, setResult] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (checking || !resultId) return;

    let cancelled = false;
    async function load() {
      try {
        const token = await getToken();
        const data = await fetchMyResult(resultId, token);
        if (!cancelled) {
          setResult(data);
          setStatus('ready');
        }
      } catch (err) {
        if (!cancelled) {
          setErrorMessage(err.message || 'Could not load this result.');
          setStatus('error');
        }
      }
    }
    load();

    return () => {
      cancelled = true;
    };
  }, [checking, resultId, getToken]);

  // Check for a missing id before the loading state — otherwise a bad URL
  // would show "Loading…" forever because the effect never runs.
  if (!checking && !resultId) {
    return (
      <main className="mx-auto max-w-3xl px-8 py-24">
        <p className="message text-lg">No result was selected.</p>
        <Link href="/student" className="button mt-6">
          ← Back to dashboard
        </Link>
      </main>
    );
  }

  if (checking || status === 'loading') {
    return (
      <main className="mx-auto max-w-3xl px-8 py-24 text-center text-lg text-ink-soft">
        Loading…
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main className="mx-auto max-w-3xl px-8 py-24">
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-6 text-lg text-red-800"
        >
          {errorMessage}
        </div>
        <Link href="/student" className="button mt-6">
          ← Back to dashboard
        </Link>
      </main>
    );
  }

  const correctCount = result.questions.filter((q) => q.isCorrect).length;
  const roundedScore = Math.round(result.score);

  return (
    <main className="mx-auto max-w-3xl px-8 py-14">
      <Link
        href="/student"
        className="text-base font-medium text-lavender-deep transition-colors hover:opacity-80"
      >
        ← Back to dashboard
      </Link>

      {/* Score hero */}
      <section className="mt-6 overflow-hidden rounded-2xl border border-lavender/25 bg-surface shadow-sm">
        <div className="bg-gradient-to-br from-lavender-deep to-lavender px-8 py-10 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-white/80">
            {result.round.name}
          </p>
          <p className="font-display text-7xl font-semibold leading-tight text-white">
            {roundedScore}%
          </p>
          <p className="mt-1 text-lg font-medium text-white/90">
            {scoreMessage(result.score)}
          </p>
        </div>

        <div className="grid gap-4 px-8 py-6 text-center sm:grid-cols-3">
          <div>
            <p className="font-display text-2xl font-semibold text-ink">
              {correctCount} / {result.questions.length}
            </p>
            <p className="mt-1 text-sm font-medium uppercase tracking-wide text-ink-soft">
              Correct answers
            </p>
          </div>
          <div>
            <p className="font-display text-2xl font-semibold text-ink">
              {formatDate(result.submittedAt)}
            </p>
            <p className="mt-1 text-sm font-medium uppercase tracking-wide text-ink-soft">
              Submitted
            </p>
          </div>
          <div>
            <p className="font-display text-2xl font-semibold text-ink">
              {formatDate(result.releasedAt)}
            </p>
            <p className="mt-1 text-sm font-medium uppercase tracking-wide text-ink-soft">
              Marks released
            </p>
          </div>
        </div>
      </section>

      {result.paperFileUrl && (
        <p className="mt-6">
          <a
            href={result.paperFileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="button"
          >
            View the paper (PDF)
          </a>
        </p>
      )}

      {/* Question-by-question review */}
      <section aria-labelledby="review-heading" className="mt-10">
        <h2
          id="review-heading"
          className="font-display text-2xl font-semibold text-ink"
        >
          Your answers, question by question
        </h2>

        {result.questions.length === 0 ? (
          <div className="mt-4 rounded-xl border border-lavender/20 bg-surface p-6 shadow-sm">
            <p className="text-base text-ink-soft">
              This test wasn&apos;t marked with an answer key, so a
              question-by-question review isn&apos;t available. Check the paper
              above or ask your teacher for feedback.
            </p>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {result.questions.map((question, index) => (
              <QuestionRow key={question.questionId} question={question} index={index} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

export default function StudentResultPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-3xl px-8 py-24 text-center text-lg text-ink-soft">
          Loading…
        </main>
      }
    >
      <ResultContent />
    </Suspense>
  );
}
