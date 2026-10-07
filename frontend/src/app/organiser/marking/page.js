'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRequireRole } from '@/hooks/useRequireRole';
import { listMarkingQueue, assignMarkingTask, submitMarking, ApiError } from '@/lib/api';

function questionIdsFromAnswers(answers) {
  if (!answers) return [];
  return Object.keys(answers);
}

export default function MarkingPage() {
  const { user, checking } = useRequireRole('organiser');
  const { getToken } = useAuth();

  const [tasks, setTasks] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | empty | ready | error
  const [selectedTask, setSelectedTask] = useState(null);

  // Marking form state
  const [breakdown, setBreakdown] = useState({});
  const [formStatus, setFormStatus] = useState('idle'); // idle | submitting | error
  const [formError, setFormError] = useState('');

  const loadQueue = useCallback(async () => {
    setStatus('loading');
    try {
      const token = await getToken();
      const data = await listMarkingQueue(token);
      setTasks(data);
      setStatus(data.length === 0 ? 'empty' : 'ready');
    } catch {
      setStatus('error');
    }
  }, [getToken]);

  useEffect(() => {
    if (checking) return;
    // Deferring via .then() so loadQueue's setState calls don't run
    // synchronously within the effect body itself (react-hooks/set-state-in-effect).
    Promise.resolve().then(loadQueue);
    // Intentionally omitting `loadQueue` from deps: it's recreated whenever
    // getToken's reference changes, and re-running this effect every time
    // that happens would re-fetch the queue on every render instead of
    // just once when the role check finishes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checking]);

  async function handleSelectTask(task) {
    setFormError('');
    setFormStatus('idle');

    // Claim it for marking if nobody has it yet
    if (task.status === 'unassigned') {
      try {
        const token = await getToken();
        const updated = await assignMarkingTask(task.id, token);
        task = { ...task, ...updated };
        setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
      } catch (err) {
        setFormError(err instanceof ApiError ? err.message : 'Could not assign this task.');
        return;
      }
    }

    const questionIds = questionIdsFromAnswers(task.submission?.answers);
    const initialBreakdown = {};
    questionIds.forEach((qId) => {
      initialBreakdown[qId] = '';
    });

    setBreakdown(initialBreakdown);
    setSelectedTask(task);
  }

  function updateBreakdownValue(questionId, value) {
    setBreakdown((prev) => ({ ...prev, [questionId]: value }));
  }

  function totalScore() {
    return Object.values(breakdown).reduce((sum, val) => {
      const n = parseFloat(val);
      return sum + (Number.isNaN(n) ? 0 : n);
    }, 0);
  }

  async function handleSubmitMarking(e) {
    e.preventDefault();
    if (!selectedTask) return;

    setFormStatus('submitting');
    setFormError('');

    const numericBreakdown = {};
    for (const [qId, val] of Object.entries(breakdown)) {
      const n = parseFloat(val);
      if (val !== '' && Number.isNaN(n)) {
        setFormStatus('error');
        setFormError(`"${val}" is not a valid mark for question ${qId}.`);
        return;
      }
      numericBreakdown[qId] = Number.isNaN(n) ? 0 : n;
    }

    try {
      const token = await getToken();
      await submitMarking(
        selectedTask.id,
        { score: totalScore(), breakdown: numericBreakdown },
        token
      );
      setSelectedTask(null);
      setFormStatus('idle');
      await loadQueue();
    } catch (err) {
      setFormStatus('error');
      setFormError(err instanceof ApiError ? err.message : 'Could not save this marking.');
    }
  }

  if (checking) {
    return (
      <p style={{ padding: '48px', fontSize: '14px', color: 'var(--c-t-6d667c)' }}>Loading...</p>
    );
  }

  return (
    <>
      <div className="organiser-page-heading">
        <h1>Marking Queue</h1>
        <p>Review and mark submissions assigned to you.</p>
      </div>

      {status === 'loading' && <p className="description">Loading marking queue...</p>}
      {status === 'error' && (
        <p className="message" role="alert">
          Couldn&apos;t load the marking queue. Try refreshing.
        </p>
      )}
      {status === 'empty' && <p className="description">No submissions waiting to be marked.</p>}

      {status === 'ready' && !selectedTask && (
        <ul style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {tasks.map((task) => (
            <li key={task.id} className="card" style={{ padding: '14px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <p style={{ margin: 0, fontWeight: 600 }}>
                    {task.submission?.entrant?.name || 'Unknown entrant'}
                  </p>
                  <p className="description" style={{ margin: '2px 0 0 0', fontSize: '0.85em' }}>
                    {task.submission?.round?.name || 'Unknown round'} · status:{' '}
                    <span style={{ textTransform: 'capitalize' }}>{task.status}</span>
                  </p>
                </div>
                <button onClick={() => handleSelectTask(task)} className="button">
                  Mark
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {selectedTask && (
        <form
          onSubmit={handleSubmitMarking}
          className="card"
          style={{ marginTop: '16px', padding: '16px' }}
        >
          <h2 style={{ marginTop: 0 }}>
            Marking: {selectedTask.submission?.entrant?.name || 'Unknown entrant'}
          </h2>
          <p className="description" style={{ marginTop: 0 }}>
            {selectedTask.submission?.round?.name || 'Unknown round'}
          </p>

          {Object.keys(breakdown).length === 0 && (
            <p className="description" style={{ fontStyle: 'italic' }}>
              This submission has no answers to mark individually — enter a total score below.
            </p>
          )}

          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' }}
          >
            {Object.keys(breakdown).map((qId) => (
              <div
                key={qId}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}
              >
                <label htmlFor={`q-${qId}`} style={{ minWidth: '100px', fontSize: '0.9em' }}>
                  Question {qId}
                </label>
                <span className="description" style={{ flex: 1, fontSize: '0.85em' }}>
                  {String(selectedTask.submission?.answers?.[qId] ?? '')}
                </span>
                <input
                  id={`q-${qId}`}
                  type="number"
                  step="0.5"
                  value={breakdown[qId]}
                  onChange={(e) => updateBreakdownValue(qId, e.target.value)}
                  placeholder="marks"
                  className="block rounded-md border border-lavender/30 bg-white px-3 py-2 text-sm"
                  style={{ width: '80px' }}
                />
              </div>
            ))}
          </div>

          <p style={{ fontWeight: 600 }}>Total: {totalScore()}</p>

          {formStatus === 'error' && (
            <p
              role="alert"
              style={{ color: 'var(--c-t-b42318)', fontSize: '0.9em', marginBottom: '8px' }}
            >
              {formError}
            </p>
          )}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="submit" disabled={formStatus === 'submitting'} className="button">
              {formStatus === 'submitting' ? 'Saving...' : 'Submit Marking'}
            </button>
            <button
              type="button"
              onClick={() => setSelectedTask(null)}
              className="button"
              style={{ background: 'transparent', color: 'inherit' }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </>
  );
}
