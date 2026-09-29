'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRequireRole } from '@/hooks/useRequireRole';
import OrganiserShell from '@/components/OrganiserShell';
import {
  listAllOrganisers,
  listRemarkQueue,
  assignRemarkRequest,
  reviewRemarkRequest,
  ApiError,
} from '@/lib/api';

function AppealSummary({ remarkRequest }) {
  return (
    <div>
      <p style={{ margin: 0, fontWeight: 600 }}>
        {remarkRequest.submission?.entrant?.name || 'Unknown entrant'}
      </p>
      <p className="description" style={{ margin: '2px 0 0 0', fontSize: '0.85em' }}>
        {remarkRequest.submission?.round?.name || 'Unknown round'} · current score:{' '}
        {remarkRequest.submission?.result?.score ?? 'unmarked'}
      </p>
      <p className="description" style={{ margin: '4px 0 0 0', fontSize: '0.85em' }}>
        &ldquo;{remarkRequest.reason}&rdquo; — requested by{' '}
        {remarkRequest.requestedBy?.name || 'unknown'}
      </p>
    </div>
  );
}

export default function RemarksPage() {
  const { user, checking } = useRequireRole('organiser');
  const { getToken } = useAuth();

  // Pending appeals waiting to be routed to a reviewer.
  const [pendingRequests, setPendingRequests] = useState([]);
  const [pendingStatus, setPendingStatus] = useState('loading'); // loading | empty | ready | error
  // Appeals routed to the signed-in reviewer for a decision.
  const [myRequests, setMyRequests] = useState([]);
  const [myStatus, setMyStatus] = useState('loading'); // loading | empty | ready | error
  const [selected, setSelected] = useState(null);

  // Reviewer routing state: dropdown options, the per-appeal choice, the
  // in-flight assignment and its error.
  const [organisers, setOrganisers] = useState([]);
  const [reviewerChoices, setReviewerChoices] = useState({});
  const [assigningId, setAssigningId] = useState(null);
  const [assignError, setAssignError] = useState('');
  const [assignErrorId, setAssignErrorId] = useState(null);

  // Review form state
  const [decision, setDecision] = useState('approved'); // approved | rejected
  const [newScore, setNewScore] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [formStatus, setFormStatus] = useState('idle'); // idle | submitting | error
  const [formError, setFormError] = useState('');

  const loadQueues = useCallback(async () => {
    setPendingStatus('loading');
    setMyStatus('loading');
    try {
      const token = await getToken();
      const pending = await listRemarkQueue(token, { status: 'pending' });
      const mine = await listRemarkQueue(token, { assignedTo: 'me' });
      setPendingRequests(pending);
      setPendingStatus(pending.length === 0 ? 'empty' : 'ready');
      setMyRequests(mine);
      setMyStatus(mine.length === 0 ? 'empty' : 'ready');
    } catch {
      setPendingStatus('error');
      setMyStatus('error');
    }
  }, [getToken]);

  // Options for routing an appeal to a different organiser reviewer.
  const loadOrganisers = useCallback(async () => {
    try {
      const token = await getToken();
      setOrganisers(await listAllOrganisers(token));
    } catch {
      // Non-critical — routing to another reviewer stays unavailable.
    }
  }, [getToken]);

  useEffect(() => {
    if (checking) return;
    // Deferring via .then() so loadQueues' setState calls don't run
    // synchronously within the effect body itself (react-hooks/set-state-in-effect).
    Promise.resolve().then(loadQueues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checking]);

  useEffect(() => {
    if (checking) return;
    Promise.resolve().then(loadOrganisers);
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
      await loadQueues();
    } catch (err) {
      setFormStatus('error');
      setFormError(err instanceof ApiError ? err.message : 'Could not submit this review.');
    }
  }

  async function handleAssign(remarkRequest, assignedToId) {
    setAssigningId(remarkRequest.id);
    setAssignError('');
    setAssignErrorId(null);
    try {
      const token = await getToken();
      await assignRemarkRequest(remarkRequest.id, assignedToId ? { assignedToId } : {}, token);
      setReviewerChoices((prev) => {
        const next = { ...prev };
        delete next[remarkRequest.id];
        return next;
      });
      await loadQueues();
    } catch (err) {
      setAssignError(err instanceof ApiError ? err.message : 'Could not assign this appeal.');
      setAssignErrorId(remarkRequest.id);
    } finally {
      setAssigningId(null);
    }
  }

  if (checking) {
    return (
      <main className="organiser-shell">
        <p style={{ padding: '48px', fontSize: '14px', color: '#817a91' }}>Loading...</p>
      </main>
    );
  }

  return (
    <OrganiserShell activeNav="remarks" breadcrumb="Appeals" user={user}>
      <div className="organiser-page-heading">
        <h1>Appeals</h1>
        <p>
          Route pending appeals to a reviewer, then decide the ones assigned to you.
        </p>
      </div>

      <h2 style={{ marginBottom: '8px' }}>Pending appeals</h2>
      {pendingStatus === 'loading' && <p className="description">Loading pending appeals...</p>}
      {pendingStatus === 'error' && (
        <p className="message" role="alert">
          Couldn&apos;t load pending appeals. Try refreshing.
        </p>
      )}
      {pendingStatus === 'empty' && (
        <p className="description">No pending appeals are waiting to be routed.</p>
      )}

      {pendingStatus === 'ready' && (
        <ul style={{ marginTop: '0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {pendingRequests.map((r) => (
            <li key={r.id} className="card" style={{ padding: '14px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}
              >
                <AppealSummary remarkRequest={r} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => handleAssign(r)}
                    disabled={assigningId === r.id}
                    className="button"
                  >
                    {assigningId === r.id ? 'Assigning...' : 'Assign to me'}
                  </button>
                  <select
                    aria-label={`Reviewer for ${r.submission?.entrant?.name || 'Unknown entrant'}`}
                    value={reviewerChoices[r.id] || ''}
                    onChange={(e) =>
                      setReviewerChoices((prev) => ({ ...prev, [r.id]: e.target.value }))
                    }
                    className="block rounded-md border border-lavender/30 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Route to another reviewer…</option>
                    {organisers
                      .filter((o) => o.id !== user?.id)
                      .map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name || o.email}
                        </option>
                      ))}
                  </select>
                  {reviewerChoices[r.id] && (
                    <button
                      onClick={() => handleAssign(r, reviewerChoices[r.id])}
                      disabled={assigningId === r.id}
                      className="button"
                    >
                      {assigningId === r.id ? 'Assigning...' : 'Assign'}
                    </button>
                  )}
                </div>
              </div>
              {assignErrorId === r.id && (
                <p role="alert" style={{ color: 'red', fontSize: '0.9em', margin: '8px 0 0 0' }}>
                  {assignError}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <h2 style={{ marginTop: '24px', marginBottom: '8px' }}>Assigned to me</h2>
      {myStatus === 'loading' && <p className="description">Loading assigned appeals...</p>}
      {myStatus === 'error' && (
        <p className="message" role="alert">
          Couldn&apos;t load assigned appeals. Try refreshing.
        </p>
      )}
      {myStatus === 'empty' && <p className="description">No appeals are assigned to you.</p>}

      {myStatus === 'ready' && !selected && (
        <ul style={{ marginTop: '0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {myRequests.map((r) => (
            <li key={r.id} className="card" style={{ padding: '14px' }}>
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <AppealSummary remarkRequest={r} />
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

          {selected.submission?.answers && (
            <div style={{ marginBottom: '16px' }}>
              <p style={{ fontWeight: 600, marginBottom: '6px' }}>Submitted answers</p>
              <ul
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  paddingLeft: 0,
                  listStyle: 'none',
                }}
              >
                {Object.entries(selected.submission.answers).map(([qId, answer]) => {
                  const breakdown = selected.submission?.markingTask?.breakdown;
                  const questionMark = breakdown?.[qId];
                  return (
                    <li
                      key={qId}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '10px',
                        fontSize: '0.9em',
                        borderBottom: '1px solid #eee',
                        paddingBottom: '4px',
                      }}
                    >
                      <span style={{ minWidth: '80px', fontWeight: 500 }}>Q{qId}</span>
                      <span style={{ flex: 1 }}>{String(answer)}</span>
                      {questionMark !== undefined && (
                        <span className="description" style={{ whiteSpace: 'nowrap' }}>
                          originally: {questionMark}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

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
            <p role="alert" style={{ color: 'red', fontSize: '0.9em', marginBottom: '8px' }}>
              {formError}
            </p>
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
    </OrganiserShell>
  );
}
