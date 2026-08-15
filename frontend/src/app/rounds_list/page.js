"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function RoundsList() {
  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchRounds() {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/rounds`
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to fetch rounds");
        setRounds(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchRounds();
  }, []);

  if (loading) return <main className="round-page"><p>Loading rounds...</p></main>;
  if (error) return <main className="round-page"><div className="message">{error}</div></main>;

  return (
    <main className="round-page">
      <h1>All Rounds</h1>
      <ul className="round-list">
        {rounds.map((round) => (
          <li key={round.id} className="card">
            <Link href={`/round_view?id=${round.id}`}>
              <strong>{round.name}</strong>
              <span className={`status ${round.state}`}>{round.state}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}