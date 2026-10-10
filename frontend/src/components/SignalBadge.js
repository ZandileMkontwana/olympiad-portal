const SEVERITY_COLORS = {
  high: { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
  medium: { bg: '#fff7ed', color: '#9a3412', border: '#fdba74' },
  low: { bg: '#fefce8', color: '#854d0e', border: '#fde047' },
};

const TYPE_LABELS = {
  speed_anomaly: 'Speed',
  identical_answers: 'Identical',
  submission_cluster: 'Cluster',
  rapid_submit: 'Rapid',
};

export default function SignalBadge({ type, severity, onClick }) {
  const colors = SEVERITY_COLORS[severity] || SEVERITY_COLORS.low;
  const label = TYPE_LABELS[type] || type;

  return (
    <span
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick(e);
              }
            }
          : undefined
      }
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '9999px',
        fontSize: '0.75em',
        fontWeight: 600,
        lineHeight: '1.4',
        backgroundColor: colors.bg,
        color: colors.color,
        border: `1px solid ${colors.border}`,
        cursor: onClick ? 'pointer' : 'default',
        whiteSpace: 'nowrap',
      }}
      title={`Cheating signal: ${type} (${severity})`}
    >
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: colors.color,
        }}
      />
      {label}
    </span>
  );
}
