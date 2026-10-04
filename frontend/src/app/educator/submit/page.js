// app/rounds/[id]/submit/page.js
'use client';

import { Suspense, useEffect, useState, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import * as XLSX from 'xlsx';
import TableScroll from '@/components/TableScroll';

function SubmissionTableContent() {
  const searchParams = useSearchParams();
  const roundId = searchParams.get('id');
  const { getToken } = useAuth();

  const [round, setRound] = useState(null);
  const [entrants, setEntrants] = useState([]);
  const [memoAnswers, setMemoAnswers] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadError, setUploadError] = useState('');

  const [answers, setAnswers] = useState({});
  const [rowStatus, setRowStatus] = useState({});
  const [idempotencyKeys, setIdempotencyKeys] = useState({});
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [receipt, setReceipt] = useState([]);

  const [toast, setToast] = useState(null);
  const toastTimeoutRef = useRef(null);

  function showToast(type, message) {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ type, message });
    toastTimeoutRef.current = setTimeout(() => setToast(null), 5000);
  }

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  const questions = useMemo(() => {
    if (!memoAnswers) return [];
    return Object.keys(memoAnswers).sort((a, b) => Number(a) - Number(b));
  }, [memoAnswers]);

  useEffect(() => {
    async function fetchData() {
      try {
        const token = await getToken();
        const authHeaders = token
          ? { Authorization: `Bearer ${token}` }
          : {};

        const [roundRes, entrantsRes, paperRes, submissionsRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/rounds/${roundId}`, {
            credentials: 'include',
          }),
          fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/rounds/${roundId}/entrants`, {
            credentials: 'include',
            headers: authHeaders,
          }),
          fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/rounds/${roundId}/papers`, {
            credentials: 'include',
          }),
          fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/rounds/${roundId}/submissions`, {
            credentials: 'include',
            headers: authHeaders,
          }),
        ]);

        const roundData = await roundRes.json();
        if (!roundRes.ok) throw new Error(roundData.error || 'Failed to fetch round');
        setRound(roundData);

        const entrantsData = await entrantsRes.json();
        if (!entrantsRes.ok) throw new Error(entrantsData.error || 'Failed to fetch entrants');
        setEntrants(entrantsData);

        if (paperRes.ok) {
          const paperData = await paperRes.json();
          setMemoAnswers(paperData.memoAnswers || null);
        }

        const existingSubmissions = submissionsRes.ok ? await submissionsRes.json() : [];
        const submissionByEntrant = {};
        existingSubmissions.forEach((s) => {
          submissionByEntrant[s.entrantId] = s;
        });

        const keys = {};
        const restoredAnswers = {};
        const restoredStatus = {};
        const restoredReceipt = [];

        entrantsData.forEach((entrant) => {
          const existing = submissionByEntrant[entrant.id];
          if (existing) {
            keys[entrant.id] = existing.idempotencyKey;
            restoredAnswers[entrant.id] = existing.answers;
            restoredStatus[entrant.id] = {
              state: 'success',
              score: existing.result ? existing.result.score : null,
            };
            restoredReceipt.push({
              entrantId: entrant.id,
              entrantName: entrant.name,
              answers: existing.answers,
              score: existing.result ? existing.result.score : null,
              submittedAt: existing.submittedAt,
              submissionId: existing.id,
            });
          } else {
            keys[entrant.id] = crypto.randomUUID();
          }
        });

        setIdempotencyKeys(keys);
        setAnswers(restoredAnswers);
        setRowStatus(restoredStatus);
        setReceipt(restoredReceipt);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [roundId]);

  function updateAnswer(entrantId, questionId, value) {
    setAnswers((prev) => ({
      ...prev,
      [entrantId]: { ...prev[entrantId], [questionId]: value.toUpperCase() },
    }));
  }

  function computeLiveScore(entrantId) {
    if (!memoAnswers || questions.length === 0) return null;
    const entrantAnswers = answers[entrantId] || {};
    let correctCount = 0;
    for (const q of questions) {
      if (entrantAnswers[q] === memoAnswers[q]) correctCount++;
    }
    return (correctCount / questions.length) * 100;
  }

  function downloadTemplate() {
    const header = ['Entrant Name', 'Entrant ID', ...questions.map((q) => `Q${q}`)];
    const rows = entrants.map((entrant) => [entrant.name, entrant.id, ...questions.map(() => '')]);

    const worksheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Answers');
    XLSX.writeFile(workbook, `round-${roundId}-answer-sheet.xlsx`);
  }

  function handleFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadError('');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target.result, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        const [header, ...dataRows] = rows;
        const idCol = header.indexOf('Entrant ID');
        if (idCol === -1) {
          throw new Error(
            "Couldn't find an 'Entrant ID' column — use the downloaded template as-is."
          );
        }
        const questionCols = questions.map((q) => ({
          question: q,
          col: header.indexOf(`Q${q}`),
        }));

        const newAnswers = {};
        for (const row of dataRows) {
          const entrantId = row[idCol];
          if (!entrantId) continue;
          newAnswers[entrantId] = {};
          for (const { question, col } of questionCols) {
            if (col !== -1 && row[col]) {
              newAnswers[entrantId][question] = String(row[col]).trim().toUpperCase();
            }
          }
        }

        setAnswers((prev) => ({ ...prev, ...newAnswers }));
        showToast('success', 'Answer sheet loaded — review the table, then submit.');
      } catch (err) {
        setUploadError(err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function submitRow(entrantId, { silent = false } = {}) {
    setRowStatus((prev) => ({ ...prev, [entrantId]: { state: 'submitting' } }));
    const entrantAnswers = answers[entrantId] || {};
    const entrant = entrants.find((e) => e.id === entrantId);
    const entrantName = entrant ? entrant.name : entrantId;

    try {
      // The backend scopes submissions to the educator's own school, so
      // this POST must carry the same Clerk token as the GET requests.
      const token = await getToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/rounds/${roundId}/submissions`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            entrantId,
            answers: entrantAnswers,
            idempotencyKey: idempotencyKeys[entrantId],
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Submission failed');

      setRowStatus((prev) => ({
        ...prev,
        [entrantId]: { state: 'success', score: data.result ? data.result.score : null },
      }));

      setReceipt((prev) => [
        ...prev.filter((r) => r.entrantId !== entrantId),
        {
          entrantId,
          entrantName,
          answers: entrantAnswers,
          score: data.result ? data.result.score : null,
          submittedAt: data.submission ? data.submission.submittedAt : new Date().toISOString(),
          submissionId: data.submission ? data.submission.id : null,
        },
      ]);

      if (!silent) {
        const scoreText = data.result ? ` — scored ${data.result.score.toFixed(1)}%` : '';
        showToast('success', `${entrantName}'s submission was accepted${scoreText}.`);
      }

      return true;
    } catch (err) {
      setRowStatus((prev) => ({
        ...prev,
        [entrantId]: { state: 'error', message: err.message },
      }));

      if (!silent) {
        showToast('error', `${entrantName}'s submission failed: ${err.message}`);
      }

      return false;
    }
  }

  async function handleSubmitAll() {
    setBulkSubmitting(true);
    let succeeded = 0;
    let failed = 0;

    for (const entrant of entrants) {
      const alreadyDone = rowStatus[entrant.id]?.state === 'success';
      if (!alreadyDone) {
        const ok = await submitRow(entrant.id, { silent: true });
        if (ok) succeeded++;
        else failed++;
      }
    }

    setBulkSubmitting(false);

    if (succeeded === 0 && failed === 0) {
      showToast('success', 'Everything was already submitted.');
    } else if (failed === 0) {
      showToast(
        'success',
        `${succeeded} submission${succeeded === 1 ? '' : 's'} accepted successfully.`
      );
    } else {
      showToast(
        'error',
        `${succeeded} accepted, ${failed} failed — check the highlighted row${failed === 1 ? '' : 's'} below.`
      );
    }
  }

  if (loading) {
    return (
      <div className="round-page">
        <p>Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="round-page">
        <div className="message">{error}</div>
      </div>
    );
  }

  if (round.state !== 'open') {
    return (
      <div className="round-page">
        <h1>Submit Results</h1>
        <div className="card">
          <p className="description">
            Submissions are not being accepted right now — this round is currently{' '}
            <strong>{round.state}</strong>.
          </p>
          <p className="description">
            {round.state === 'scheduled' &&
              "This round hasn't opened yet. Results can be submitted once it does."}
            {round.state === 'closed' &&
              'This round has closed. Results can no longer be submitted for it.'}
            {round.state === 'released' &&
              'This round has closed and results have been released. Submissions are no longer accepted.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="round-page" style={{ position: 'relative' }}>
      {toast && (
        <div
          role="alert"
          style={{
            position: 'fixed',
            top: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            padding: '12px 20px',
            borderRadius: '8px',
            color: 'white',
            fontWeight: 500,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            backgroundColor: toast.type === 'success' ? '#16a34a' : '#dc2626',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            maxWidth: '90vw',
          }}
        >
          <span>
            {toast.type === 'success' ? '✓' : '⚠'} {toast.message}
          </span>
          <button
            type="button"
            onClick={() => setToast(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              fontSize: '16px',
              lineHeight: 1,
            }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      <h1>Submit Results — {round.name}</h1>

      {!memoAnswers && (
        <p className="message">
          No memo answer key found for this round yet — the paper needs a memo uploaded before
          results can be scored.
        </p>
      )}

      {entrants.length === 0 && (
        <p className="message">No entrants are registered for this round yet.</p>
      )}

      {entrants.length > 0 && memoAnswers && (
        <>
          <div className="card" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button type="button" onClick={downloadTemplate} className="button">
              Download answer sheet ({questions.length} questions, {entrants.length} students)
            </button>

            <label className="button" style={{ cursor: 'pointer' }}>
              Upload completed sheet
              <input
                type="file"
                accept=".xlsx,.csv"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </label>

            <button
              type="button"
              onClick={handleSubmitAll}
              disabled={bulkSubmitting}
              className="button"
            >
              {bulkSubmitting ? 'Submitting all…' : 'Submit All'}
            </button>
          </div>

          {uploadError && <p className="message">{uploadError}</p>}

          <TableScroll label="Entrant answers">
          <table className="card" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ padding: '8px 16px', textAlign: 'left' }}>Entrant</th>
                {questions.map((q) => (
                  <th key={q} style={{ padding: '8px 16px', textAlign: 'center' }}>
                    Q{q}
                  </th>
                ))}
                <th style={{ padding: '8px 16px' }}>Score</th>
                <th style={{ padding: '8px 16px' }}></th>
              </tr>
            </thead>
            <tbody>
              {entrants.map((entrant) => {
                const status = rowStatus[entrant.id] || { state: 'idle' };
                const liveScore = computeLiveScore(entrant.id);
                const displayScore = status.state === 'success' ? status.score : liveScore;
                const isFailed = status.state === 'error';

                return (
                  <tr
                    key={entrant.id}
                    style={isFailed ? { backgroundColor: '#fef2f2' } : undefined}
                  >
                    <td style={{ padding: '8px 16px' }}>{entrant.name}</td>
                    {questions.map((q) => (
                      <td key={q} style={{ padding: '8px 16px', textAlign: 'center' }}>
                        <input
                          type="text"
                          maxLength={1}
                          placeholder="—"
                          value={(answers[entrant.id] && answers[entrant.id][q]) || ''}
                          onChange={(e) => updateAnswer(entrant.id, q, e.target.value)}
                          style={{ width: '36px', textAlign: 'center' }}
                          disabled={status.state === 'submitting'}
                        />
                      </td>
                    ))}
                    <td style={{ padding: '8px 16px', textAlign: 'center' }}>
                      {displayScore !== null ? `${displayScore.toFixed(1)}%` : '—'}
                      {status.state === 'idle' && liveScore !== null && (
                        <span style={{ fontSize: '0.75em', opacity: 0.6 }}> (preview)</span>
                      )}
                      {status.state === 'success' && (
                        <span style={{ fontSize: '0.75em', opacity: 0.6 }}> ✓ saved</span>
                      )}
                    </td>
                    <td style={{ padding: '8px 16px' }}>
                      <button
                        type="button"
                        onClick={() => submitRow(entrant.id)}
                        disabled={status.state === 'submitting'}
                        className="button"
                      >
                        {status.state === 'submitting'
                          ? '…'
                          : status.state === 'success'
                            ? 'Resubmit'
                            : 'Submit'}
                      </button>
                      {status.state === 'error' && <p className="message">{status.message}</p>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </TableScroll>
        </>
      )}

      {receipt.length > 0 && (
        <div className="card" role="status">
          <h2>
            Receipt — {receipt.length} of {entrants.length} accepted
          </h2>
          <TableScroll label="Submission receipt">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ padding: '4px 12px', textAlign: 'left' }}>Entrant</th>
                <th style={{ padding: '4px 12px', textAlign: 'left' }}>Answers</th>
                <th style={{ padding: '4px 12px', textAlign: 'center' }}>Score</th>
                <th style={{ padding: '4px 12px', textAlign: 'left' }}>Accepted at</th>
                <th style={{ padding: '4px 12px', textAlign: 'left' }}>Submission ID</th>
              </tr>
            </thead>
            <tbody>
              {receipt.map((entry) => (
                <tr key={entry.entrantId}>
                  <td style={{ padding: '4px 12px' }}>{entry.entrantName}</td>
                  <td
                    style={{
                      padding: '4px 12px',
                      fontFamily: 'monospace',
                      maxWidth: '300px',
                      whiteSpace: 'normal',
                    }}
                  >
                    {questions.map((q) => `Q${q}:${entry.answers[q] || '-'}`).join('  ')}
                  </td>
                  <td style={{ padding: '4px 12px', textAlign: 'center' }}>
                    {entry.score !== null ? `${entry.score.toFixed(1)}%` : '—'}
                  </td>
                  <td style={{ padding: '4px 12px' }}>
                    {new Date(entry.submittedAt).toLocaleString()}
                  </td>
                  <td style={{ padding: '4px 12px', fontFamily: 'monospace', fontSize: '0.85em' }}>
                    {entry.submissionId || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </TableScroll>
        </div>
      )}
    </div>
  );
}

export default function SubmissionTablePage() {
  return (
    <Suspense fallback={<div className="round-page">Loading...</div>}>
      <SubmissionTableContent />
    </Suspense>
  );
}
