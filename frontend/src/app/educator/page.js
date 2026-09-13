'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth, useClerk } from '@clerk/nextjs';
import { useRequireRole } from '@/hooks/useRequireRole';
import { listOlympiads, listSchoolEntrants, createEntrant } from '@/lib/api';

export default function EducatorDashboard() {
  const { user, checking } = useRequireRole('educator');
  const { signOut } = useClerk();
  const { getToken } = useAuth();

  const [olympiads, setOlympiads] = useState([]);
  const [roundsStatus, setRoundsStatus] = useState('loading');

  const [students, setStudents] = useState([]);
  const [studentsStatus, setStudentsStatus] = useState('loading');
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('');
  const [adding, setAdding] = useState(false);
  const [studentsError, setStudentsError] = useState('');

  async function fetchStudents(token) {
    try {
      const list = await listSchoolEntrants(token);
      setStudents(list);
      setStudentsStatus('ready');
    } catch (err) {
      setStudentsStatus('error');
    }
  }

  useEffect(() => {
    if (checking) return;

    async function fetchOlympiads() {
      try {
        const data = await listOlympiads();
        setOlympiads(data);
        setRoundsStatus(data.some((o) => o.rounds.length > 0) ? 'ready' : 'empty');
      } catch (err) {
        setRoundsStatus('error');
      }
    }

    async function loadStudents() {
      const token = await getToken();
      await fetchStudents(token);
    }

    fetchOlympiads();
    loadStudents();
  }, [checking, getToken]);

  if (checking) {
    return (
      <main className="round-page">
        <p>Loading...</p>
      </main>
    );
  }

  async function handleLogout() {
    await signOut({ redirectUrl: '/login' });
  }

  async function handleAddStudent(event) {
    event.preventDefault();
    setStudentsError('');

    if (!name.trim() || !grade.trim()) {
      setStudentsError('Name and grade are required.');
      return;
    }

    setAdding(true);
    try {
      const token = await getToken();
      await createEntrant({ name: name.trim(), grade: grade.trim() }, token);
      setName('');
      setGrade('');
      await fetchStudents(token);
    } catch (err) {
      setStudentsError(err.message || 'Could not add student.');
    } finally {
      setAdding(false);
    }
  }

  // Educators work with rounds - only show olympiads that have at least one.
  const olympiadsWithRounds = olympiads.filter((olympiad) => olympiad.rounds.length > 0);

  return (
    <main className="round-page">
      <h1>Educator Portal</h1>
      <p className="description">
        Logged in as <strong>{user.email}</strong> ({user.role})
      </p>

      <div className="card" style={{ display: 'flex', gap: '12px' }}>
        <button onClick={handleLogout} className="button">
          Log out
        </button>
      </div>

      <h2 style={{ marginTop: '24px' }}>My Students</h2>

      {studentsStatus === 'loading' && <p className="description">Loading students...</p>}

      {studentsStatus === 'error' && (
        <p className="message">Couldn&apos;t load students. Try refreshing the page.</p>
      )}

      {studentsStatus === 'ready' && (
        <div className="card" style={{ marginTop: '12px' }}>
          {students.length === 0 ? (
            <p className="description" style={{ margin: 0 }}>
              No students yet. Add a student below so they can register and sit rounds.
            </p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              {students.map((student) => (
                <li key={student.id} className="description" style={{ marginBottom: '4px' }}>
                  {student.name} — Grade {student.grade}
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={handleAddStudent} style={{ marginTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Student name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                flex: '1 1 160px',
                padding: '10px 12px',
                border: '1px solid var(--border-lavender)',
                borderRadius: '8px',
                fontSize: '15px',
              }}
            />
            <input
              type="text"
              placeholder="Grade"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              style={{
                flex: '0 1 90px',
                padding: '10px 12px',
                border: '1px solid var(--border-lavender)',
                borderRadius: '8px',
                fontSize: '15px',
              }}
            />
            <button type="submit" disabled={adding} className="button">
              {adding ? 'Adding...' : 'Add student'}
            </button>
          </form>

          {studentsError && (
            <p className="message" style={{ marginTop: '8px', marginBottom: 0 }}>
              {studentsError}
            </p>
          )}
        </div>
      )}

      <h2 style={{ marginTop: '24px' }}>Rounds</h2>

      {roundsStatus === 'loading' && <p className="description">Loading rounds...</p>}

      {roundsStatus === 'empty' && <p className="description">No rounds yet.</p>}

      {roundsStatus === 'error' && (
        <p className="message">Couldn&apos;t load rounds. Try refreshing the page.</p>
      )}

      {roundsStatus === 'ready' && (
        <ul style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {olympiadsWithRounds.map((olympiad) => (
            <li key={olympiad.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ background: 'var(--lavender)', padding: '10px 16px' }}>
                <h3 style={{ margin: 0, fontSize: '1.05em', color: 'white' }}>{olympiad.name}</h3>
              </div>
              <div style={{ padding: '12px 16px 16px' }}>
                <p className="description" style={{ margin: '0 0 12px 0', fontSize: '0.85em' }}>
                  {olympiad.timezone} · {olympiad.rounds.length} round
                  {olympiad.rounds.length !== 1 ? 's' : ''}
                </p>
                <ul style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {olympiad.rounds.map((round) => (
                    <li key={round.id}>
                      <Link
                        href={`/educator/round_view?id=${round.id}`}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid rgba(139, 92, 246, 0.2)',
                          textDecoration: 'none',
                          fontSize: '0.9em',
                        }}
                      >
                        <span>{round.name}</span>
                        <span style={{ textTransform: 'capitalize', opacity: 0.7 }}>
                          {round.state}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
