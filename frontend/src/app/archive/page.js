'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { fetchCurrentUser, fetchArchivedPapers } from '@/lib/api';

/* ── helpers ──────────────────────────────────────────────────────────── */

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function timeAgo(iso) {
  const days = Math.floor((new Date() - new Date(iso)) / 86400000);
  if (days < 1) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;
  return `${Math.floor(months / 12)} year${Math.floor(months / 12) > 1 ? 's' : ''} ago`;
}

/* ── Paper card ───────────────────────────────────────────────────────── */

function PaperCard({ paper }) {
  return (
    <div
      style={{
        background: 'white',
        borderRadius: '16px',
        padding: '18px 20px',
        border: '1px solid rgba(139,92,246,0.1)',
        boxShadow: '0 2px 10px rgba(139,92,246,0.06)',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        flexWrap: 'wrap',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 8px 20px rgba(139,92,246,0.14)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 2px 10px rgba(139,92,246,0.06)';
      }}
    >
      <div
        style={{
          width: '46px',
          height: '46px',
          borderRadius: '12px',
          flexShrink: 0,
          background: 'linear-gradient(135deg, #8b5cf6, #6d3fd1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.3em',
        }}
      >
        📄
      </div>

      <div style={{ flex: 1, minWidth: '200px' }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: '1em', color: '#2d2640' }}>
          {paper.roundName}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: '0.82em', color: '#8b7fa8' }}>
          {paper.olympiadName}
        </p>
        <div style={{ display: 'flex', gap: '10px', marginTop: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.72em', color: '#a89fc9' }}>
            Closed {formatDate(paper.closeTime)}
          </span>
          <span style={{ fontSize: '0.72em', color: '#a89fc9' }}>·</span>
          <span style={{ fontSize: '0.72em', color: '#a89fc9' }}>{timeAgo(paper.closeTime)}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
        <a
          href={paper.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            padding: '8px 16px',
            borderRadius: '9px',
            fontSize: '0.85em',
            fontWeight: 700,
            background: 'linear-gradient(135deg, #8b5cf6, #6d3fd1)',
            color: 'white',
            textDecoration: 'none',
          }}
        >
          📥 Paper
        </a>
        {paper.memoUrl && (
          <a
            href={paper.memoUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '8px 16px',
              borderRadius: '9px',
              fontSize: '0.85em',
              fontWeight: 700,
              background: 'rgba(139,92,246,0.08)',
              color: '#6d3fd1',
              textDecoration: 'none',
              border: '1px solid rgba(139,92,246,0.25)',
            }}
          >
            📝 Memo
          </a>
        )}
      </div>
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────────────────── */

export default function ArchivePage() {
  const router = useRouter();
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const [papers, setPapers] = useState([]);
  const [status, setStatus] = useState('loading');
  const [user, setUser] = useState(null);
  const [search, setSearch] = useState('');
  const [olympiadFilter, setOlympiadFilter] = useState('all');

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.replace('/login');
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    async function loadUser() {
      const token = await getToken();
      const fetchedUser = await fetchCurrentUser(token);
      if (cancelled) return;
      if (!fetchedUser) {
        router.replace('/login');
        return;
      }
      setUser(fetchedUser);
    }
    loadUser();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken, router]);

  useEffect(() => {
    if (!user) return;
    fetchArchivedPapers()
      .then((data) => {
        setPapers(data);
        setStatus(data.length === 0 ? 'empty' : 'ready');
      })
      .catch(() => setStatus('error'));
  }, [user]);

  const olympiadNames = useMemo(
    () => [...new Set(papers.map((p) => p.olympiadName))].sort(),
    [papers]
  );

  const filteredPapers = useMemo(() => {
    return papers
      .filter(
        (p) =>
          p.roundName.toLowerCase().includes(search.toLowerCase()) ||
          p.olympiadName.toLowerCase().includes(search.toLowerCase())
      )
      .filter((p) => olympiadFilter === 'all' || p.olympiadName === olympiadFilter)
      .sort((a, b) => new Date(b.closeTime) - new Date(a.closeTime));
  }, [papers, search, olympiadFilter]);

  const groupedByYear = useMemo(() => {
    const groups = {};
    filteredPapers.forEach((p) => {
      const year = new Date(p.closeTime).getFullYear();
      if (!groups[year]) groups[year] = [];
      groups[year].push(p);
    });
    return Object.entries(groups).sort((a, b) => b[0] - a[0]);
  }, [filteredPapers]);

  if (!user) {
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
        <p style={{ color: '#8b7fa8' }}>Loading...</p>
      </div>
    );
  }

  return (
    <main
      style={{
        maxWidth: '1000px',
        margin: '0 auto',
        padding: '32px 24px 60px',
        background: '#faf9fc',
        minHeight: '100vh',
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
        }}
      >
        <Link
          href={
            user.role === 'organiser'
              ? '/organiser'
              : user.role === 'student'
                ? '/student'
                : '/educator'
          }
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: '1px solid rgba(139,92,246,0.25)',
            textDecoration: 'none',
            color: '#6d3fd1',
            fontSize: '0.85em',
            fontWeight: 600,
          }}
        >
          ← Back to dashboard
        </Link>
      </div>

      {/* Hero */}
      <div
        style={{
          background: 'linear-gradient(120deg, #7c3aed 0%, #6028c9 50%, #4c1d95 100%)',
          borderRadius: '22px',
          padding: '34px 38px',
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 12px 32px rgba(91,33,182,0.3)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            right: '-40px',
            top: '-40px',
            width: '180px',
            height: '180px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)',
          }}
        />
        <p
          style={{
            margin: 0,
            fontSize: '0.75em',
            opacity: 0.75,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}
        >
          Paper Archive
        </p>
        <h1 style={{ margin: '8px 0 0', fontSize: '2em', fontWeight: 800 }}>Past Papers & Memos</h1>
        <p style={{ margin: '10px 0 0', fontSize: '0.9em', opacity: 0.85 }}>
          Browse and download papers from every closed or released round.
        </p>
        {status === 'ready' && (
          <div style={{ display: 'flex', gap: '24px', marginTop: '18px' }}>
            <div>
              <p style={{ margin: 0, fontSize: '1.6em', fontWeight: 800 }}>{papers.length}</p>
              <p style={{ margin: 0, fontSize: '0.72em', opacity: 0.8 }}>Papers</p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '1.6em', fontWeight: 800 }}>
                {olympiadNames.length}
              </p>
              <p style={{ margin: 0, fontSize: '0.72em', opacity: 0.8 }}>Olympiads</p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '1.6em', fontWeight: 800 }}>
                {groupedByYear.length}
              </p>
              <p style={{ margin: 0, fontSize: '0.72em', opacity: 0.8 }}>Years covered</p>
            </div>
          </div>
        )}
      </div>

      {status === 'loading' && (
        <p style={{ color: '#8b7fa8', textAlign: 'center', marginTop: '40px' }}>
          Loading archive...
        </p>
      )}
      {status === 'error' && (
        <div
          style={{
            marginTop: '32px',
            padding: '32px',
            textAlign: 'center',
            background: 'white',
            borderRadius: '16px',
            border: '1px solid rgba(224,97,95,0.2)',
          }}
        >
          <p style={{ fontSize: '2em', margin: '0 0 8px' }}>⚠️</p>
          <p style={{ color: '#e0615f', margin: 0 }}>
            Couldn&apos;t load the archive. Try refreshing the page.
          </p>
        </div>
      )}
      {status === 'empty' && (
        <div
          style={{
            marginTop: '32px',
            padding: '48px 32px',
            textAlign: 'center',
            background: 'white',
            borderRadius: '16px',
            border: '1px solid rgba(139,92,246,0.1)',
          }}
        >
          <p style={{ fontSize: '2.4em', margin: '0 0 8px' }}>📂</p>
          <p style={{ color: '#8b7fa8', margin: 0 }}>
            No archived papers yet. Papers appear here once their round closes.
          </p>
        </div>
      )}

      {status === 'ready' && (
        <>
          {/* Controls */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '28px', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="🔍  Search by round or olympiad..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                flex: '1 1 240px',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid rgba(139,92,246,0.25)',
                fontSize: '0.9em',
                outline: 'none',
              }}
            />
            <select
              value={olympiadFilter}
              onChange={(e) => setOlympiadFilter(e.target.value)}
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid rgba(139,92,246,0.25)',
                fontSize: '0.9em',
                background: 'white',
              }}
            >
              <option value="all">All olympiads</option>
              {olympiadNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* Timeline grouped by year */}
          {filteredPapers.length === 0 ? (
            <p style={{ color: '#8b7fa8', textAlign: 'center', marginTop: '32px' }}>
              No papers match your search.
            </p>
          ) : (
            <div style={{ marginTop: '28px' }}>
              {groupedByYear.map(([year, yearPapers]) => (
                <div key={year} style={{ marginBottom: '28px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      marginBottom: '14px',
                    }}
                  >
                    <span
                      style={{
                        padding: '4px 14px',
                        borderRadius: '20px',
                        fontSize: '0.85em',
                        fontWeight: 800,
                        background: 'linear-gradient(135deg, #8b5cf6, #6d3fd1)',
                        color: 'white',
                      }}
                    >
                      {year}
                    </span>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(139,92,246,0.15)' }} />
                    <span style={{ fontSize: '0.78em', color: '#a89fc9' }}>
                      {yearPapers.length} paper{yearPapers.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {yearPapers.map((paper) => (
                      <PaperCard key={paper.id} paper={paper} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
