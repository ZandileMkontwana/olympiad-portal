'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRequireRole } from '@/hooks/useRequireRole';
import { fetchSchoolDashboard, createEntrant, resendEntrantInvite, deleteEntrant } from '@/lib/api';
import { GRADE_OPTIONS } from '@/lib/grade';

/* ── helpers ──────────────────────────────────────────────────────────── */

function initials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}
function scoreColor(score) {
  if (score === null || score === undefined) return '#c9c3e0';
  if (score >= 75) return '#3fae7a';
  if (score >= 50) return '#e0a83e';
  return '#e0615f';
}
function scoreLabel(score) {
  if (score === null || score === undefined) return 'No score';
  if (score >= 75) return 'Excellent';
  if (score >= 50) return 'Good';
  if (score >= 25) return 'Developing';
  return 'Needs support';
}

/* ── Score ring ───────────────────────────────────────────────────────── */

function ScoreRing({ score, size = 52 }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = score === null || score === undefined ? 0 : Math.max(0, Math.min(100, score));
  const offset = circumference - (pct / 100) * circumference;
  const color = scoreColor(score);
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(139,92,246,0.1)"
          strokeWidth="6"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size < 60 ? '0.7em' : '0.8em',
          fontWeight: 700,
          color: score === null ? '#a89fc9' : '#2d2640',
        }}
      >
        {score === null ? '—' : `${score.toFixed(0)}%`}
      </div>
    </div>
  );
}

/* ── Stat card ────────────────────────────────────────────────────────── */

function StatCard({ icon, label, value, sub, accent, trend }) {
  return (
    <div
      style={{
        flex: 1,
        background: 'white',
        borderRadius: '16px',
        padding: '20px 22px',
        boxShadow: '0 2px 10px rgba(139,92,246,0.08)',
        border: '1px solid rgba(139,92,246,0.1)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        minWidth: '200px',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-3px)';
        e.currentTarget.style.boxShadow = '0 10px 24px rgba(139,92,246,0.16)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 2px 10px rgba(139,92,246,0.08)';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div
          style={{
            width: '46px',
            height: '46px',
            borderRadius: '13px',
            background: accent || 'linear-gradient(135deg, #8b5cf6, #6d3fd1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.4em',
          }}
        >
          {icon}
        </div>
        {trend && (
          <span
            style={{
              fontSize: '0.72em',
              fontWeight: 700,
              color: trend > 0 ? '#3fae7a' : '#8b7fa8',
              background: trend > 0 ? 'rgba(63,174,122,0.1)' : 'rgba(139,92,246,0.08)',
              padding: '3px 8px',
              borderRadius: '20px',
            }}
          >
            {trend > 0 ? '↑' : '•'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div>
        <p
          style={{ margin: 0, fontSize: '1.9em', fontWeight: 800, color: '#2d2640', lineHeight: 1 }}
        >
          {value}
        </p>
        <p style={{ margin: '6px 0 0', fontSize: '0.82em', color: '#8b7fa8', fontWeight: 500 }}>
          {label}
        </p>
        {sub && <p style={{ margin: 0, fontSize: '0.72em', color: '#a89fc9' }}>{sub}</p>}
      </div>
    </div>
  );
}

/* ── Grade comparison bar chart ──────────────────────────────────────── */

function GradeChart({ entrants }) {
  const gradeData = useMemo(() => {
    const map = {};
    entrants.forEach((e) => {
      if (!map[e.grade]) map[e.grade] = { count: 0, total: 0, scored: 0 };
      map[e.grade].count++;
      if (e.averageScore !== null) {
        map[e.grade].total += e.averageScore;
        map[e.grade].scored++;
      }
    });
    return Object.entries(map)
      .map(([grade, d]) => ({
        grade,
        count: d.count,
        avg: d.scored > 0 ? d.total / d.scored : null,
      }))
      .sort((a, b) => a.grade.localeCompare(b.grade, undefined, { numeric: true }));
  }, [entrants]);

  const max = Math.max(...gradeData.map((g) => g.avg || 0), 10);

  return (
    <div
      style={{
        background: 'white',
        borderRadius: '18px',
        padding: '26px',
        border: '1px solid rgba(139,92,246,0.1)',
        boxShadow: '0 2px 10px rgba(139,92,246,0.06)',
        height: '100%',
      }}
    >
      <h3 style={{ margin: '0 0 22px', fontSize: '1.05em', fontWeight: 700, color: '#2d2640' }}>
        Average Score by Grade
      </h3>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '20px',
          height: '200px',
          padding: '0 8px',
        }}
      >
        {gradeData.map((g) => (
          <div
            key={g.grade}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              height: '100%',
              justifyContent: 'flex-end',
              gap: '8px',
            }}
          >
            <span style={{ fontSize: '0.8em', fontWeight: 700, color: scoreColor(g.avg) }}>
              {g.avg !== null ? `${g.avg.toFixed(0)}%` : '—'}
            </span>
            <div
              style={{
                width: '100%',
                maxWidth: '56px',
                height: g.avg !== null ? `${(g.avg / max) * 140}px` : '4px',
                borderRadius: '10px 10px 4px 4px',
                background: `linear-gradient(180deg, ${scoreColor(g.avg)}, ${scoreColor(g.avg)}cc)`,
                transition: 'height 0.5s ease',
                minHeight: '4px',
              }}
            />
            <span
              style={{
                fontSize: '0.85em',
                fontWeight: 700,
                color: '#6d3fd1',
                background: 'rgba(139,92,246,0.08)',
                padding: '3px 10px',
                borderRadius: '8px',
              }}
            >
              {g.grade}
            </span>
            <span style={{ fontSize: '0.68em', color: '#a89fc9' }}>{g.count} students</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Performance distribution donut-ish bar ─────────────────────────── */

function DistributionPanel({ entrants }) {
  const bands = useMemo(() => {
    const scored = entrants.filter((e) => e.averageScore !== null);
    const total = scored.length || 1;
    return [
      {
        label: 'Excellent',
        color: '#3fae7a',
        count: scored.filter((e) => e.averageScore >= 75).length,
      },
      {
        label: 'Good',
        color: '#e0a83e',
        count: scored.filter((e) => e.averageScore >= 50 && e.averageScore < 75).length,
      },
      {
        label: 'Developing',
        color: '#d97855',
        count: scored.filter((e) => e.averageScore >= 25 && e.averageScore < 50).length,
      },
      {
        label: 'Needs support',
        color: '#e0615f',
        count: scored.filter((e) => e.averageScore < 25).length,
      },
    ].map((b) => ({ ...b, pct: (b.count / total) * 100 }));
  }, [entrants]);
  const unscored = entrants.filter((e) => e.averageScore === null).length;

  return (
    <div
      style={{
        background: 'white',
        borderRadius: '18px',
        padding: '26px',
        border: '1px solid rgba(139,92,246,0.1)',
        boxShadow: '0 2px 10px rgba(139,92,246,0.06)',
        height: '100%',
      }}
    >
      <h3 style={{ margin: '0 0 22px', fontSize: '1.05em', fontWeight: 700, color: '#2d2640' }}>
        Performance Distribution
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {bands.map((b) => (
          <div key={b.label}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.82em',
                marginBottom: '6px',
              }}
            >
              <span style={{ color: '#5e5478', fontWeight: 600 }}>{b.label}</span>
              <span style={{ color: '#2d2640', fontWeight: 700 }}>{b.count}</span>
            </div>
            <div
              style={{
                height: '10px',
                borderRadius: '6px',
                background: 'rgba(139,92,246,0.06)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${b.pct}%`,
                  height: '100%',
                  background: b.color,
                  borderRadius: '6px',
                  transition: 'width 0.6s ease',
                }}
              />
            </div>
          </div>
        ))}
        {unscored > 0 && (
          <p style={{ margin: '4px 0 0', fontSize: '0.75em', color: '#a89fc9' }}>
            +{unscored} entrant{unscored !== 1 ? 's' : ''} with no submissions yet
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Podium ───────────────────────────────────────────────────────────── */

function TopPodium({ entrants }) {
  const top3 = useMemo(
    () =>
      entrants
        .filter((e) => e.averageScore !== null)
        .sort((a, b) => b.averageScore - a.averageScore)
        .slice(0, 3),
    [entrants]
  );
  if (top3.length === 0)
    return (
      <div
        style={{
          background: 'white',
          borderRadius: '18px',
          padding: '26px',
          border: '1px solid rgba(139,92,246,0.1)',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <p style={{ color: '#a89fc9', fontSize: '0.85em' }}>No scores yet</p>
      </div>
    );
  const medals = ['🥇', '🥈', '🥉'];
  const heights = [110, 78, 58];
  return (
    <div
      style={{
        background: 'white',
        borderRadius: '18px',
        padding: '26px',
        border: '1px solid rgba(139,92,246,0.1)',
        boxShadow: '0 2px 10px rgba(139,92,246,0.06)',
        height: '100%',
      }}
    >
      <h3 style={{ margin: '0 0 24px', fontSize: '1.05em', fontWeight: 700, color: '#2d2640' }}>
        Top Performers
      </h3>
      <div
        style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '14px' }}
      >
        {[1, 0, 2].map((idx) => {
          const e = top3[idx];
          if (!e) return <div key={idx} style={{ flex: 1 }} />;
          return (
            <div
              key={e.id}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span style={{ fontSize: '1.7em' }}>{medals[idx]}</span>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background:
                    idx === 0
                      ? 'linear-gradient(135deg, #fbbf24, #f59e0b)'
                      : idx === 1
                        ? 'linear-gradient(135deg, #c4b5fd, #8b5cf6)'
                        : 'linear-gradient(135deg, #f5c78a, #d97706)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.82em',
                }}
              >
                {initials(e.name)}
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: '0.8em',
                  fontWeight: 600,
                  color: '#2d2640',
                  textAlign: 'center',
                  maxWidth: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {e.name.split(' ')[0]}
              </p>
              <div
                style={{
                  width: '100%',
                  borderRadius: '10px 10px 0 0',
                  height: `${heights[idx]}px`,
                  background:
                    idx === 0
                      ? 'linear-gradient(180deg, #8b5cf6, #6d3fd1)'
                      : idx === 1
                        ? 'linear-gradient(180deg, #c4b5fd, #a78bfa)'
                        : 'linear-gradient(180deg, #e0d4f5, #c4b5fd)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ fontWeight: 800, fontSize: '1.15em', color: 'white' }}>
                  {e.averageScore.toFixed(0)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────────────────── */

export default function SchoolDashboardPage() {
  const { user, checking } = useRequireRole('educator');
  const { getToken } = useAuth();

  const [dashboard, setDashboard] = useState(null);
  const [status, setStatus] = useState('loading');
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [sortOption, setSortOption] = useState('score');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newGrade, setNewGrade] = useState('');
  const [addMessage, setAddMessage] = useState(null);
  const [adding, setAdding] = useState(false);
  const [resendingId, setResendingId] = useState(null);
  const [resendMessage, setResendMessage] = useState(null);
  const [removingId, setRemovingId] = useState(null);

  const noSchool = !checking && user && !(user.school && user.school.id);

  useEffect(() => {
    if (checking || !user || noSchool) return;
    const schoolId = user.school.id;

    async function load() {
      try {
        const token = await getToken();
        const data = await fetchSchoolDashboard(schoolId, token);
        setDashboard(data);
        setStatus('ready');
      } catch (err) {
        setStatus('error');
      }
    }
    load();
  }, [checking, user, getToken]);

  const grades = useMemo(
    () =>
      !dashboard
        ? []
        : [...new Set(dashboard.entrants.map((e) => e.grade))].sort((a, b) =>
            a.localeCompare(b, undefined, { numeric: true })
          ),
    [dashboard]
  );

  const filteredEntrants = useMemo(() => {
    if (!dashboard) return [];
    let result = dashboard.entrants
      .filter((e) => e.name.toLowerCase().includes(search.toLowerCase()))
      .filter((e) => gradeFilter === 'all' || e.grade === gradeFilter);
    if (sortOption === 'name') result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    else if (sortOption === 'submissions')
      result = [...result].sort((a, b) => b.submissionCount - a.submissionCount);
    else result = [...result].sort((a, b) => (b.averageScore ?? -1) - (a.averageScore ?? -1));
    return result;
  }, [dashboard, search, gradeFilter, sortOption]);

  const schoolAverage = useMemo(() => {
    if (!dashboard) return null;
    const scored = dashboard.entrants.filter((e) => e.averageScore !== null);
    return scored.length > 0
      ? scored.reduce((s, e) => s + e.averageScore, 0) / scored.length
      : null;
  }, [dashboard]);

  const topPerformer = useMemo(() => {
    if (!dashboard) return null;
    const scored = dashboard.entrants.filter((e) => e.averageScore !== null);
    return scored.length > 0
      ? scored.reduce((b, e) => (e.averageScore > b.averageScore ? e : b))
      : null;
  }, [dashboard]);

  async function handleRefresh() {
    setStatus('loading');
    try {
      const token = await getToken();
      const schoolId = user.school && user.school.id;
      const data = await fetchSchoolDashboard(schoolId, token);
      setDashboard(data);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }

  async function handleAddStudent(e) {
    e.preventDefault();
    setAddMessage(null);
    if (!newName.trim() || !newGrade.trim() || !newEmail.trim()) {
      setAddMessage({ type: 'error', text: 'Name, email and grade are required.' });
      return;
    }
    if (
      !window.confirm(
        `Add "${newName.trim()}" (${newEmail.trim()}, Grade ${newGrade.trim()}) to your school? They'll be emailed a link to set their password.`
      )
    )
      return;
    setAdding(true);
    try {
      const token = await getToken();
      const result = await createEntrant(
        { name: newName.trim(), email: newEmail.trim(), grade: newGrade.trim() },
        token
      );
      const registeredInto = (result.registeredRounds || [])
        .map((round) => `${round.olympiadName} — ${round.name}`)
        .join(', ');
      setAddMessage({
        type: 'success',
        text:
          (result.invitationSent
            ? `${newName.trim()} has been added and emailed a link to set their password.`
            : `${newName.trim()} has been added, but the invitation email could not be sent — use "Resend invite" on their card.`) +
          (registeredInto
            ? ` Registered into: ${registeredInto}.`
            : ' No open rounds to register them into yet.'),
      });
      setNewName('');
      setNewEmail('');
      setNewGrade('');
      await handleRefresh();
    } catch (err) {
      setAddMessage({ type: 'error', text: err.message || 'Failed to add student.' });
    } finally {
      setAdding(false);
    }
  }

  async function handleResendInvite(entrant) {
    setResendMessage(null);
    let email = entrant.email;
    if (!email) {
      // Legacy entrant with no account yet — an email is needed to create one.
      const entered = window.prompt(
        `${entrant.name} has no account yet. Enter their student email to send the invitation:`
      );
      if (!entered || !entered.trim()) return;
      email = entered.trim();
    }
    if (!window.confirm(`Email ${entrant.name} a link to set their password (${email})?`)) return;
    setResendingId(entrant.id);
    try {
      const token = await getToken();
      const result = await resendEntrantInvite(entrant.id, token, entrant.email ? {} : { email });
      setResendMessage({
        type: result.invitationSent ? 'success' : 'error',
        text: result.invitationSent
          ? `Invitation emailed to ${email}.`
          : 'The invitation email could not be sent. Please try again later.',
      });
      // A legacy entrant just gained an account — refresh so the card reflects it.
      if (!entrant.email) await handleRefresh();
    } catch (err) {
      setResendMessage({ type: 'error', text: err.message || 'Failed to resend the invitation.' });
    } finally {
      setResendingId(null);
    }
  }

  async function handleRemoveEntrant(entrant) {
    setResendMessage(null);
    const submissionNote =
      entrant.submissionCount > 0
        ? ` This permanently deletes their ${entrant.submissionCount} submission${entrant.submissionCount !== 1 ? 's' : ''} and results.`
        : '';
    if (
      !window.confirm(
        `Remove ${entrant.name} from your school? Their account and records will be deleted — this can't be undone.${submissionNote}`
      )
    ) {
      return;
    }
    setRemovingId(entrant.id);
    try {
      const token = await getToken();
      await deleteEntrant(entrant.id, token);
      setResendMessage({
        type: 'success',
        text: `${entrant.name} has been removed from your school.`,
      });
      await handleRefresh();
    } catch (err) {
      setResendMessage({
        type: 'error',
        text: err.message || 'Could not remove the student. Please try again.',
      });
    } finally {
      setRemovingId(null);
    }
  }

  function handleClearFilters() {
    if (search || gradeFilter !== 'all') {
      if (window.confirm('Clear all filters?')) {
        setSearch('');
        setGradeFilter('all');
      }
    }
  }

  if (checking || (!noSchool && status === 'loading')) {
    return (
      <div
        style={{
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#faf9fc',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            border: '3px solid rgba(139,92,246,0.2)',
            borderTopColor: '#8b5cf6',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (noSchool || status === 'error') {
    return (
      <div
        style={{
          display: 'flex',
          minHeight: '60vh',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: '420px' }}>
          <p style={{ fontSize: '3em', margin: '0 0 12px' }}>{noSchool ? '🏫' : '⚠️'}</p>
          <h2 style={{ margin: '0 0 8px', color: '#2d2640' }}>
            {noSchool ? 'No School Linked' : 'Something went wrong'}
          </h2>
          <p style={{ color: '#8b7fa8' }}>
            {noSchool
              ? 'Complete your educator profile to link a school.'
              : "Couldn't load the dashboard. Try refreshing."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Hero */}
      <div
        style={{
          background: 'linear-gradient(120deg, #7c3aed 0%, #6028c9 45%, #4c1d95 100%)',
          borderRadius: '24px',
          padding: '40px 44px',
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 14px 40px rgba(91,33,182,0.32)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '24px',
        }}
      >
        <div
          style={{
            position: 'absolute',
            right: '-60px',
            top: '-60px',
            width: '240px',
            height: '240px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: '120px',
            bottom: '-90px',
            width: '180px',
            height: '180px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.04)',
          }}
        />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <p
            style={{
              margin: 0,
              fontSize: '0.78em',
              opacity: 0.75,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              fontWeight: 600,
            }}
          >
            School Dashboard
          </p>
          <h1 style={{ margin: '8px 0 0', fontSize: '2.4em', fontWeight: 800 }}>
            {dashboard.school.name}
          </h1>
          <p style={{ margin: '10px 0 0', fontSize: '0.92em', opacity: 0.85 }}>
            Welcome back, <strong>{user.name || user.email}</strong> — here&apos;s how your students
            are doing.
          </p>
        </div>
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            gap: '28px',
            alignItems: 'center',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '2em', fontWeight: 800 }}>{dashboard.entrantCount}</p>
            <p style={{ margin: 0, fontSize: '0.75em', opacity: 0.8 }}>Entrants</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '2em', fontWeight: 800 }}>
              {schoolAverage !== null ? `${schoolAverage.toFixed(0)}%` : '—'}
            </p>
            <p style={{ margin: 0, fontSize: '0.75em', opacity: 0.8 }}>Avg. Score</p>
          </div>
          <button
            onClick={handleRefresh}
            title="Refresh data"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              border: '2px solid rgba(255,255,255,0.3)',
              background: 'rgba(255,255,255,0.1)',
              color: 'white',
              fontSize: '1.2em',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
            }}
          >
            ↻
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'flex', gap: '18px', marginTop: '22px', flexWrap: 'wrap' }}>
        <StatCard
          icon="👥"
          label="Total Entrants"
          value={dashboard.entrantCount}
          sub="Registered at your school"
        />
        <StatCard
          icon="📝"
          label="Submissions"
          value={dashboard.totalSubmissions}
          sub="Across all rounds"
        />
        <StatCard
          icon="📊"
          label="School Average"
          value={schoolAverage !== null ? `${schoolAverage.toFixed(1)}%` : '—'}
          accent="linear-gradient(135deg, #3fae7a, #2d8a5e)"
          sub="Weighted across entrants"
        />
        {topPerformer && (
          <StatCard
            icon="🏆"
            label="Top Performer"
            value={topPerformer.name.split(' ')[0]}
            sub={`${topPerformer.averageScore.toFixed(1)}% avg`}
            accent="linear-gradient(135deg, #f59e0b, #d97706)"
          />
        )}
      </div>

      {dashboard.entrants.length === 0 ? (
        <div
          style={{
            marginTop: '32px',
            padding: '60px 32px',
            textAlign: 'center',
            borderRadius: '20px',
            background: 'white',
            border: '1px solid rgba(139,92,246,0.12)',
          }}
        >
          <p style={{ fontSize: '3em', margin: '0 0 12px' }}>🎓</p>
          <h2 style={{ margin: '0 0 8px', color: '#2d2640' }}>No Students Yet</h2>
          <p
            style={{ color: '#8b7fa8', maxWidth: '420px', margin: '0 auto 24px', lineHeight: 1.6 }}
          >
            Add your first student below and their performance will appear here.
          </p>
          <form
            onSubmit={handleAddStudent}
            style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'center',
              flexWrap: 'wrap',
              maxWidth: '560px',
              margin: '0 auto',
            }}
          >
            <input
              type="text"
              placeholder="Student name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              style={{
                flex: '1 1 150px',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid rgba(139,92,246,0.25)',
                fontSize: '0.88em',
                outline: 'none',
              }}
            />
            <input
              type="email"
              placeholder="Student email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              style={{
                flex: '1 1 180px',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid rgba(139,92,246,0.25)',
                fontSize: '0.88em',
                outline: 'none',
              }}
            />
            <select
              value={newGrade}
              onChange={(e) => setNewGrade(e.target.value)}
              style={{
                width: '130px',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid rgba(139,92,246,0.25)',
                fontSize: '0.88em',
                background: 'white',
              }}
            >
              <option value="" disabled>
                Grade
              </option>
              {GRADE_OPTIONS.map((g) => (
                <option key={g} value={g}>
                  Grade {g}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={adding}
              style={{
                padding: '10px 20px',
                borderRadius: '10px',
                border: 'none',
                cursor: adding ? 'not-allowed' : 'pointer',
                background: 'linear-gradient(135deg, #8b5cf6, #6d3fd1)',
                color: 'white',
                fontWeight: 600,
                fontSize: '0.88em',
                opacity: adding ? 0.7 : 1,
              }}
            >
              {adding ? 'Adding...' : 'Add Student'}
            </button>
          </form>
          <p
            style={{
              margin: '12px auto 0',
              fontSize: '0.75em',
              color: '#a89fc9',
              maxWidth: '480px',
            }}
          >
            The student is emailed a link to set their password — they then sign in with their email
            and password.
          </p>
          {addMessage && (
            <p
              style={{
                marginTop: '12px',
                fontSize: '0.85em',
                color: addMessage.type === 'success' ? '#3fae7a' : '#e0615f',
                fontWeight: 600,
              }}
            >
              {addMessage.text}
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Analytics row - 3 columns, fills the width */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.3fr 1fr 1fr',
              gap: '18px',
              marginTop: '24px',
              alignItems: 'stretch',
            }}
          >
            <GradeChart entrants={dashboard.entrants} />
            <DistributionPanel entrants={dashboard.entrants} />
            <TopPodium entrants={dashboard.entrants} />
          </div>

          {/* Entrant list */}
          <div
            style={{
              marginTop: '32px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '1.1em', fontWeight: 700, color: '#2d2640' }}>
              All Entrants ({filteredEntrants.length})
            </h3>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                style={{
                  padding: '10px 16px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #8b5cf6, #6d3fd1)',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '0.85em',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {showAddForm ? 'Cancel' : '+ Add Student'}
              </button>
              <input
                type="text"
                placeholder="🔍  Search by name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '240px',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid rgba(139,92,246,0.25)',
                  fontSize: '0.88em',
                  outline: 'none',
                }}
              />
              <select
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
                style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid rgba(139,92,246,0.25)',
                  fontSize: '0.88em',
                  background: 'white',
                }}
              >
                <option value="all">All grades</option>
                {grades.map((g) => (
                  <option key={g} value={g}>
                    Grade {g}
                  </option>
                ))}
              </select>
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
                style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid rgba(139,92,246,0.25)',
                  fontSize: '0.88em',
                  background: 'white',
                }}
              >
                <option value="score">Sort: Score</option>
                <option value="name">Sort: Name</option>
                <option value="submissions">Sort: Submissions</option>
              </select>
              <button
                onClick={handleClearFilters}
                style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid rgba(139,92,246,0.25)',
                  fontSize: '0.88em',
                  background: 'white',
                  color: '#6d3fd1',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Clear
              </button>
            </div>
          </div>

          {showAddForm && (
            <div
              style={{
                marginTop: '16px',
                padding: '20px 24px',
                borderRadius: '14px',
                background: 'white',
                border: '1px solid rgba(139,92,246,0.12)',
                boxShadow: '0 2px 10px rgba(139,92,246,0.06)',
              }}
            >
              <h4
                style={{
                  margin: '0 0 12px',
                  fontSize: '0.95em',
                  fontWeight: 700,
                  color: '#2d2640',
                }}
              >
                Add a New Student
              </h4>
              <form
                onSubmit={handleAddStudent}
                style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}
              >
                <input
                  type="text"
                  placeholder="Student name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  style={{
                    flex: '1 1 160px',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid rgba(139,92,246,0.25)',
                    fontSize: '0.88em',
                    outline: 'none',
                  }}
                />
                <input
                  type="email"
                  placeholder="Student email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  style={{
                    flex: '1 1 180px',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid rgba(139,92,246,0.25)',
                    fontSize: '0.88em',
                    outline: 'none',
                  }}
                />
                <select
                  value={newGrade}
                  onChange={(e) => setNewGrade(e.target.value)}
                  style={{
                    width: '130px',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid rgba(139,92,246,0.25)',
                    fontSize: '0.88em',
                    background: 'white',
                  }}
                >
                  <option value="" disabled>
                    Grade
                  </option>
                  {GRADE_OPTIONS.map((g) => (
                    <option key={g} value={g}>
                      Grade {g}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={adding}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '10px',
                    border: 'none',
                    cursor: adding ? 'not-allowed' : 'pointer',
                    background: 'linear-gradient(135deg, #8b5cf6, #6d3fd1)',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '0.88em',
                    opacity: adding ? 0.7 : 1,
                  }}
                >
                  {adding ? 'Adding...' : 'Add Student'}
                </button>
              </form>
              <p style={{ margin: '10px 0 0', fontSize: '0.75em', color: '#a89fc9' }}>
                The student is emailed a link to set their password — they then sign in with their
                email and password.
              </p>
              {addMessage && (
                <p
                  style={{
                    marginTop: '10px',
                    fontSize: '0.85em',
                    color: addMessage.type === 'success' ? '#3fae7a' : '#e0615f',
                    fontWeight: 600,
                  }}
                >
                  {addMessage.text}
                </p>
              )}
            </div>
          )}

          {filteredEntrants.length === 0 && dashboard.entrants.length > 0 && (
            <div
              style={{
                marginTop: '24px',
                padding: '40px',
                textAlign: 'center',
                borderRadius: '16px',
                background: 'white',
                border: '1px solid rgba(139,92,246,0.1)',
              }}
            >
              <p style={{ fontSize: '2em', margin: '0 0 8px' }}>🔍</p>
              <p style={{ margin: 0, color: '#8b7fa8', fontWeight: 600 }}>
                No students match your filters
              </p>
              <button
                onClick={handleClearFilters}
                style={{
                  marginTop: '12px',
                  padding: '8px 20px',
                  borderRadius: '8px',
                  border: '1px solid rgba(139,92,246,0.25)',
                  background: 'white',
                  color: '#6d3fd1',
                  fontWeight: 600,
                  fontSize: '0.85em',
                  cursor: 'pointer',
                }}
              >
                Clear filters
              </button>
            </div>
          )}
          {resendMessage && (
            <p
              role="status"
              style={{
                marginTop: '16px',
                fontSize: '0.85em',
                fontWeight: 600,
                color: resendMessage.type === 'success' ? '#3fae7a' : '#e0615f',
              }}
            >
              {resendMessage.text}
            </p>
          )}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '14px',
              marginTop: '16px',
            }}
          >
            {filteredEntrants.map((entrant) => (
              <div
                key={entrant.id}
                style={{
                  background: 'white',
                  borderRadius: '16px',
                  padding: '16px 18px',
                  border: '1px solid rgba(139,92,246,0.08)',
                  boxShadow: '0 2px 10px rgba(139,92,246,0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 18px rgba(139,92,246,0.14)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 10px rgba(139,92,246,0.06)';
                }}
              >
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #c4b5fd, #8b5cf6)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.85em',
                    flexShrink: 0,
                  }}
                >
                  {initials(entrant.name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      margin: 0,
                      fontWeight: 600,
                      color: '#2d2640',
                      fontSize: '0.92em',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {entrant.name}
                  </p>
                  <p
                    title={entrant.email || 'No account yet'}
                    style={{
                      margin: '2px 0 0',
                      fontSize: '0.72em',
                      color: '#a89fc9',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {entrant.email || 'No account yet'}
                  </p>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '5px', flexWrap: 'wrap' }}>
                    {(entrant.olympiads || []).map((olympiad) => (
                      <span
                        key={olympiad.id}
                        style={{
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '0.68em',
                          fontWeight: 600,
                          background: 'rgba(56,142,204,0.12)',
                          color: '#2c6cb0',
                        }}
                      >
                        {olympiad.name}
                      </span>
                    ))}
                    {(!entrant.olympiads || entrant.olympiads.length === 0) && (
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '0.68em',
                          fontWeight: 600,
                          background: 'rgba(139,92,246,0.05)',
                          color: '#8b7fa8',
                        }}
                      >
                        No olympiad yet
                      </span>
                    )}
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '0.68em',
                        fontWeight: 600,
                        background: 'rgba(139,92,246,0.08)',
                        color: '#6d3fd1',
                      }}
                    >
                      Grade {entrant.grade}
                    </span>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '0.68em',
                        fontWeight: 600,
                        background: 'rgba(139,92,246,0.05)',
                        color: '#8b7fa8',
                      }}
                    >
                      {entrant.submissionCount} sub{entrant.submissionCount !== 1 ? 's' : ''}
                    </span>
                    {entrant.averageScore !== null && (
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '0.68em',
                          fontWeight: 600,
                          background: `${scoreColor(entrant.averageScore)}18`,
                          color: scoreColor(entrant.averageScore),
                        }}
                      >
                        {scoreLabel(entrant.averageScore)}
                      </span>
                    )}
                    {entrant.accountStatus === 'active' && (
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '0.68em',
                          fontWeight: 600,
                          background: 'rgba(63,174,122,0.12)',
                          color: '#2d8a5e',
                        }}
                      >
                        Active
                      </span>
                    )}
                    {entrant.accountStatus === 'invite_pending' && (
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '0.68em',
                          fontWeight: 600,
                          background: 'rgba(224,168,62,0.15)',
                          color: '#b07d1e',
                        }}
                      >
                        Invite pending
                      </span>
                    )}
                    {entrant.accountStatus == null && (
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '0.68em',
                          fontWeight: 600,
                          background: 'rgba(139,92,246,0.05)',
                          color: '#8b7fa8',
                        }}
                      >
                        No account
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                    {entrant.accountStatus !== 'active' && (
                      <button
                        type="button"
                        onClick={() => handleResendInvite(entrant)}
                        disabled={resendingId === entrant.id || removingId === entrant.id}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '8px',
                          border: '1px solid rgba(139,92,246,0.3)',
                          background: 'rgba(139,92,246,0.06)',
                          color: '#6d3fd1',
                          fontWeight: 600,
                          fontSize: '0.72em',
                          cursor: resendingId === entrant.id ? 'wait' : 'pointer',
                        }}
                      >
                        {resendingId === entrant.id
                          ? 'Sending…'
                          : entrant.accountStatus === 'invite_pending'
                            ? 'Resend invite'
                            : 'Send invite'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveEntrant(entrant)}
                      disabled={removingId === entrant.id || resendingId === entrant.id}
                      style={{
                        padding: '5px 12px',
                        borderRadius: '8px',
                        border: '1px solid rgba(224,97,95,0.35)',
                        background: 'rgba(224,97,95,0.06)',
                        color: '#e0615f',
                        fontWeight: 600,
                        fontSize: '0.72em',
                        cursor: removingId === entrant.id ? 'wait' : 'pointer',
                      }}
                    >
                      {removingId === entrant.id ? 'Removing…' : 'Remove'}
                    </button>
                  </div>
                </div>
                <ScoreRing score={entrant.averageScore} />
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
