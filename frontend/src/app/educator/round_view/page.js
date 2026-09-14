'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function formatRemaining(ms) {
  if (ms <= 0) return 'closing any moment';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function RoundViewContent() {
  const searchParams = useSearchParams();
  const roundId = searchParams.get('id');

  const [round, setRound] = useState(null);
  const [loading, setLoading] = useState(!!roundId);
  const [error, setError] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const [timeRemaining, setTimeRemaining] = useState('');

  useEffect(() => {
    if (!roundId) return;

    async function fetchRound() {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/rounds/${roundId}`
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch round');
        }

        setRound(data);
        setError('');
      } catch (error) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    }

    fetchRound();

    const interval = setInterval(fetchRound, 15000);

    return () => clearInterval(interval);
  }, [roundId]);

  // Live countdown to closeTime, ticking every second independent of the 15s poll
  useEffect(() => {
    if (!round?.closeTime) return;

    function tick() {
      const remainingMs = new Date(round.closeTime).getTime() - Date.now();
      setTimeRemaining(formatRemaining(remainingMs));
    }

    tick();
    const countdownInterval = setInterval(tick, 1000);
    return () => clearInterval(countdownInterval);
  }, [round?.closeTime]);

  async function handleDownload() {
    setDownloadError('');
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/rounds/${roundId}/papers`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch paper');
      }

      // External API URL (paper file download), not an internal Next.js route,
      // so window.location is intentional here.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = `${process.env.NEXT_PUBLIC_API_BASE_URL}${data.fileUrl}`;
    } catch (error) {
      setDownloadError(error.message);
    }
  }

  if (!roundId) {
    return (
      <main className="round-page">
        <div className="message">No round ID was provided.</div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="round-page">
        <p>Loading round...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="round-page">
        <div className="message">{error}</div>
      </main>
    );
  }

  return (
    <main className="round-page">
      <div className="round-header">
        <h1>{round.name}</h1>

        <span className={`status ${round.state}`}>{round.state}</span>
      </div>

      <div className="round-information">
        <div>
          <strong>Opening Time</strong>
          <p>{new Date(round.openTime).toLocaleString()}</p>
        </div>

        <div>
          <strong>Closing Time</strong>
          <p>{new Date(round.closeTime).toLocaleString()}</p>
        </div>
      </div>

      <div className="card">
        <h2>Round Details</h2>

        <p className="description">This round is currently {round.state}.</p>

        {round.state === 'open' && (
          <>
            <button className="button" onClick={handleDownload}>
              Download Paper
            </button>
            {downloadError && <p className="message">{downloadError}</p>}

            <Link href={`/student/sit?id=${roundId}`} className="button">
              Sit Paper Online
            </Link>

            <p className="description">Submissions are open. Closes in {timeRemaining}.</p>

            <Link href={`/educator/submit?id=${roundId}`} className="button">
              Submit Results
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
export default function RoundViewPage() {
  return (
    <Suspense fallback={<main className="round-page">Loading round...</main>}>
      <RoundViewContent />
    </Suspense>
  );
}
