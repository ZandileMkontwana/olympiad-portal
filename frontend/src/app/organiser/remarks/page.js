'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRequireRole } from '@/hooks/useRequireRole';
import { listRemarkQueue, reviewRemarkRequest, ApiError } from '@/lib/api';

export default function RemarksPage() {
  const { user, checking } = useRequireRole('organiser');
  const { getToken } = useAuth();

  const [requests, setRequests] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | empty | ready | error
  const [selected, setSelected] = useState(null);

  // Review form state
  const [decision, setDecision] = useState('approved'); // approved | rejected
  const [newScore, setNewScore] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [formStatus, setFormStatus] = useState('idle'); // idle | submitting | error
  const [formError, setFormError] = useState('');

  const loadQueue = useCallback(async () => {
    setStatus('loading');
    try {
      const token = await getToken();
      const data = await listRemarkQueue(token);
      setRequests(data);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checking]);

  function openReviewForm(remarkRequest) {
    setSelected(remarkRequest);
    setDecision('approved');
    setNewScore(
      remarkRequest.submission?.result?.score !== undefined
        ? String(remarkRequest.submission.result.score)
        : ''
    );
    setReviewNotes('');
    setFormStatus('idle');
    setFormError('');
  }

  async function handleSubmitReview(e) {
    e.preventDefault();
    if (!selected) return;

    if (decision === 'approved' && newScore.trim() === '') {
      setFormStatus('error');
      setFormError('Enter the new score to approve this remark.');
      return;
    }

    setFormStatus('submitting');
    setFormError('');

    try {
      const token = await getToken();
      await reviewRemarkRequest(
        selected.id,
        {
          status: decision,
          newScore: decision === 'approved' ? Number(newScore) : undefined,
          reviewNotes: reviewNotes.trim() || undefined,
        },
        token
      );
      setSelected(null);
      setFormStatus('idle');
      await loadQueue();
    } catch (err) {
      setFormStatus('error');
      setFormError(err instanceof ApiError ? err.message : 'Could not submit this review.');
    }
  }

  if (checking) {
    return (
      <main className="round-page">
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main className="round-page">
      <h1>Remark Requests</h1>
      <p className="description">
        Logged in as <strong>{user.email}</strong> ({user.role})
      </p>

      {status === 'loading' && <p className="description">Loading remark requests...</p>}
      {status === 'error' && (
        <p className="message">Couldn&apos;t load remark requests. Try refreshing.</p>
      )}
      {status === 'empty' && <p className="description">No pending remark requests. 🎉</p>}

      {status === 'ready' && !selected && (
        <ul style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {requests.map((r) => (
            <li key={r.id} className="card" style={{ padding: '14px' }}>
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div>
                  <p style={{ margin: 0, fontWeight: 600 }}>
                    {r.submission?.entrant?.name || 'Unknown entrant'}
                  </p>
                  <p className="description" style={{ margin: '2px 0 0 0', fontSize: '0.85em' }}>
                    {r.submission?.round?.name || 'Unknown round'} · current score:{' '}
                    {r.submission?.result?.score ?? 'unmarked'}
                  </p>
                  <p className="description" style={{ margin: '4px 0 0 0', fontSize: '0.85em' }}>
                    &ldquo;{r.reason}&rdquo; — requested by {r.requestedBy?.name || 'unknown'}
                  </p>
                </div>
                <button onClick={() => openReviewForm(r)} className="button">
                  Review
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <form
          onSubmit={handleSubmitReview}
          className="card"
          style={{ marginTop: '16px', padding: '16px' }}
        >
          <h2 style={{ marginTop: 0 }}>
            Reviewing: {selected.submission?.entrant?.name || 'Unknown entrant'}
          </h2>
          <p className="description" style={{ marginTop: 0 }}>
            &ldquo;{selected.reason}&rdquo;
          </p>

          <div style={{ display: 'flex', gap: '16px', margin: '12px 0' }}>
            <label>
              <input
                type="radio"
                name="decision"
                value="approved"
                checked={decision === 'approved'}
                onChange={() => setDecision('approved')}
              />{' '}
              Approve
            </label>
            <label>
              <input
                type="radio"
                name="decision"
                value="rejected"
                checked={decision === 'rejected'}
                onChange={() => setDecision('rejected')}
              />{' '}
              Reject
            </label>
          </div>

          {decision === 'approved' && (
            <div style={{ marginBottom: '12px' }}>
              <label htmlFor="new-score">New score</label>
              <input
                id="new-score"
                type="number"
                step="0.5"
                value={newScore}
                onChange={(e) => setNewScore(e.target.value)}
                className="block rounded-md border border-lavender/30 bg-white px-3 py-2 text-sm"
                style={{ width: '120px' }}
              />
            </div>
          )}

          <div style={{ marginBottom: '12px' }}>
            <label htmlFor="review-notes">Notes (optional)</label>
            <textarea
              id="review-notes"
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              rows={2}
              className="block w-full rounded-md border border-lavender/30 bg-white px-3 py-2 text-sm"
            />
          </div>

          {formStatus === 'error' && (
            <p style={{ color: 'red', fontSize: '0.9em', marginBottom: '8px' }}>{formError}</p>
          )}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="submit" disabled={formStatus === 'submitting'} className="button">
              {formStatus === 'submitting' ? 'Saving...' : 'Submit Review'}
            </button>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="button"
              style={{ background: 'transparent', color: 'inherit' }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
