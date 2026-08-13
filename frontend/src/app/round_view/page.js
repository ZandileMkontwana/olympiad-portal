"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function RoundView() {
  const searchParams = useSearchParams();
  const roundId = searchParams.get("id");

  const [round, setRound] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!roundId) {
      setError("No round ID was provided.");
      setLoading(false);
      return;
    }

    async function fetchRound() {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/rounds/${roundId}`
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch round");
        }

        setRound(data);
        setError("");
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

        <p className="description">
          This round is currently {round.state}.
        </p>

       {round.state === "open" && round.paper && (
          <a href={`${process.env.NEXT_PUBLIC_API_URL}${round.paper.fileUrl}`} className="button" download>Download Paper</a>
        )}

        {round.state === "open" && !round.paper && (
          <p className="message">
            No paper has been uploaded for this round yet.
          </p>
        )}
      </div>
    </main>
  );
}