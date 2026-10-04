'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useRequireRole } from '@/hooks/useRequireRole';
import {
  fetchNotificationRules,
  updateNotificationRule,
  testNotificationTrigger,
  ApiError,
} from '@/lib/api';

const TRIGGER_LABELS = {
  before_open: 'Before round opens',
  before_close: 'Before round closes',
  missing_submission: 'Missing submission',
  results_released: 'Results released',
};

const RECIPIENT_OPTIONS = [
  { value: 'educator', label: 'Educators' },
  { value: 'organiser', label: 'Organisers' },
  { value: 'all', label: 'Everyone' },
];

export default function NotificationsConfigPage() {
  const { id: roundId } = useParams();
  const { user, checking } = useRequireRole('organiser');
  const { getToken } = useAuth();

  const [rules, setRules] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [errorMessage, setErrorMessage] = useState('');
  const [savingTrigger, setSavingTrigger] = useState(null);
  const [testingTrigger, setTestingTrigger] = useState(null);
  const [testResults, setTestResults] = useState({});

  useEffect(() => {
    if (checking) return;

    async function loadRules() {
      try {
        const data = await fetchNotificationRules(roundId);
        setRules(data);
        setStatus('ready');
      } catch (err) {
        setStatus('error');
        setErrorMessage(err instanceof ApiError ? err.message : 'Something went wrong.');
      }
    }

    loadRules();
  }, [checking, roundId]);

  async function handleToggle(triggerType, enabled) {
    setSavingTrigger(triggerType);
    try {
      const token = await getToken();
      const updated = await updateNotificationRule(roundId, triggerType, { enabled }, token);
      setRules((prev) =>
        prev.map((r) => (r.triggerType === triggerType ? { ...r, ...updated } : r))
      );
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : 'Could not update rule.');
    } finally {
      setSavingTrigger(null);
    }
  }

  async function handleRecipientChange(triggerType, recipientRole) {
    setSavingTrigger(triggerType);
    try {
      const token = await getToken();
      const updated = await updateNotificationRule(roundId, triggerType, { recipientRole }, token);
      setRules((prev) =>
        prev.map((r) => (r.triggerType === triggerType ? { ...r, ...updated } : r))
      );
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : 'Could not update rule.');
    } finally {
      setSavingTrigger(null);
    }
  }

  async function handleTest(triggerType) {
    setTestingTrigger(triggerType);
    try {
      const token = await getToken();
      const result = await testNotificationTrigger(roundId, triggerType, token);
      setTestResults((prev) => ({ ...prev, [triggerType]: result }));
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : 'Could not run test.');
    } finally {
      setTestingTrigger(null);
    }
  }

  if (checking || status === 'loading') {
    return (
      <main id="main-content" tabIndex={-1} className="round-page">
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main id="main-content" tabIndex={-1} className="round-page">
      <h1>Notification Rules</h1>
      <p className="description">
        Round <strong>{roundId}</strong> — configure which automatic emails are sent, and to whom.
      </p>

      {status === 'error' && (
        <p className="message" role="alert">
          {errorMessage}
        </p>
      )}

      {status === 'ready' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
          {rules.map((rule) => {
            const testResult = testResults[rule.triggerType];
            const isTesting = testingTrigger === rule.triggerType;
            const isSaving = savingTrigger === rule.triggerType;

            return (
              <div key={rule.triggerType}>
                <div
                  className="card"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px',
                  }}
                >
                  <div>
                    <strong>{TRIGGER_LABELS[rule.triggerType] || rule.triggerType}</strong>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <select
                      aria-label={`Recipients for ${TRIGGER_LABELS[rule.triggerType] || rule.triggerType}`}
                      value={rule.recipientRole}
                      disabled={!rule.enabled || isSaving}
                      onChange={(e) => handleRecipientChange(rule.triggerType, e.target.value)}
                    >
                      {RECIPIENT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>

                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        disabled={isSaving}
                        onChange={(e) => handleToggle(rule.triggerType, e.target.checked)}
                      />
                      {rule.enabled ? 'Enabled' : 'Disabled'}
                    </label>

                    <button
                      type="button"
                      onClick={() => handleTest(rule.triggerType)}
                      disabled={isTesting}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '4px',
                        border: '1px solid #ccc',
                        background: '#fff',
                        cursor: isTesting ? 'wait' : 'pointer',
                        fontSize: '0.85rem',
                      }}
                    >
                      {isTesting ? 'Testing...' : 'Test'}
                    </button>
                  </div>
                </div>

                {testResult && (
                  <div
                    className="card"
                    style={{
                      marginTop: '4px',
                      padding: '16px',
                      background: '#f9fafb',
                      borderLeft: '3px solid #3b82f6',
                      fontSize: '0.9rem',
                    }}
                  >
                    <div style={{ marginBottom: '8px' }}>
                      <strong>Status: </strong>
                      {testResult.enabled ? (
                        <span style={{ color: '#117b38' }}>Enabled</span>
                      ) : (
                        <span style={{ color: '#cf2121' }}>Disabled</span>
                      )}
                    </div>

                    <div style={{ marginBottom: '8px' }}>
                      <strong>Recipients: </strong>
                      {testResult.recipients.length === 0 ? (
                        <span style={{ color: '#646b78' }}>None</span>
                      ) : (
                        <span>{testResult.recipients.length} recipient(s)</span>
                      )}
                    </div>

                    {testResult.recipients.length > 0 && (
                      <ul style={{ margin: '0 0 12px 0', paddingLeft: '20px', color: '#374151' }}>
                        {testResult.recipients.map((r, i) => (
                          <li key={i}>
                            {r.email}
                            {r.entrantName && (
                              <span style={{ color: '#646b78' }}> (re: {r.entrantName})</span>
                            )}
                            {r.alreadyNotified && (
                              <span
                                style={{
                                  color: '#a05804',
                                  fontSize: '0.8rem',
                                  marginLeft: '6px',
                                }}
                              >
                                [already notified]
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}

                    {testResult.emailPreview && (
                      <div
                        style={{
                          marginTop: '8px',
                          padding: '12px',
                          background: '#fff',
                          borderRadius: '4px',
                          border: '1px solid #e5e7eb',
                        }}
                      >
                        <div style={{ marginBottom: '6px' }}>
                          <strong>Subject: </strong>
                          {testResult.emailPreview.subject}
                        </div>
                        <pre
                          style={{
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            margin: 0,
                            fontSize: '0.85rem',
                            color: '#4b5563',
                          }}
                        >
                          {testResult.emailPreview.text}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {errorMessage && status === 'ready' && (
        <p className="message" role="alert" style={{ marginTop: '12px' }}>
          {errorMessage}
        </p>
      )}
    </main>
  );
}
