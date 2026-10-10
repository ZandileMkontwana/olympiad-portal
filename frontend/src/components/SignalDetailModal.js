import { useEffect, useRef } from 'react';

const SEVERITY_LABELS = {
  high: { text: 'High severity', color: '#991b1b', bg: '#fee2e2' },
  medium: { text: 'Medium severity', color: '#9a3412', bg: '#fff7ed' },
  low: { text: 'Low severity', color: '#854d0e', bg: '#fefce8' },
};

const TYPE_DESCRIPTIONS = {
  speed_anomaly:
    'This student completed the sitting significantly faster than the cohort average.',
  identical_answers:
    'This student\'s answers match another student\'s answers unusually closely, including identical wrong answers.',
  submission_cluster:
    'This student submitted at nearly the same time as several other students.',
  rapid_submit:
    'This student submitted extremely quickly after starting the sitting.',
};

function formatDetail(key, value) {
  if (typeof value === 'number') {
    if (key.toLowerCase().includes('minute') || key.toLowerCase().includes('duration')) {
      return `${value} min`;
    }
    if (key.toLowerCase().includes('second')) return `${value}s`;
    if (key.toLowerCase().includes('percent')) return `${value}%`;
    return String(value);
  }
  return String(value);
}

export default function SignalDetailModal({ signals, entrantName, onClose }) {
  const overlayRef = useRef(null);

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose?.();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (!signals || signals.length === 0) return null;

  return (
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose?.();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Signal details for ${entrantName || 'entrant'}`}
    >
      <div
        className="card"
        style={{
          maxWidth: '480px',
          width: '100%',
          padding: '20px',
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '16px',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '1.1em' }}>Signal Details</h2>
            {entrantName && (
              <p className="description" style={{ margin: '4px 0 0 0', fontSize: '0.9em' }}>
                {entrantName}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.2em',
              cursor: 'pointer',
              padding: '4px',
              color: '#666',
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {signals.map((signal, i) => {
            const sev = SEVERITY_LABELS[signal.severity] || SEVERITY_LABELS.low;
            return (
              <div
                key={`${signal.type}-${i}`}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #e5e5e5',
                  backgroundColor: '#fafafa',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '6px',
                  }}
                >
                  <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                    {signal.type.replace(/_/g, ' ')}
                  </span>
                  <span
                    style={{
                      fontSize: '0.75em',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      backgroundColor: sev.bg,
                      color: sev.color,
                    }}
                  >
                    {sev.text}
                  </span>
                </div>

                <p style={{ margin: '0 0 8px 0', fontSize: '0.85em', color: '#555' }}>
                  {TYPE_DESCRIPTIONS[signal.type] || 'A cheating signal was detected.'}
                </p>

                {signal.details && Object.keys(signal.details).length > 0 && (
                  <div style={{ fontSize: '0.8em', color: '#666' }}>
                    {Object.entries(signal.details).map(([key, value]) => (
                      <div
                        key={key}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '2px 0',
                        }}
                      >
                        <span style={{ textTransform: 'capitalize' }}>
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                        <span style={{ fontWeight: 500 }}>{formatDetail(key, value)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {signal.entrants && signal.entrants.length > 1 && (
                  <p style={{ margin: '8px 0 0 0', fontSize: '0.8em', color: '#666' }}>
                    Also involves:{' '}
                    {signal.entrants.map((e) => e.name || e.id).join(', ')}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={onClose}
          className="button"
          style={{ marginTop: '16px', width: '100%' }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
