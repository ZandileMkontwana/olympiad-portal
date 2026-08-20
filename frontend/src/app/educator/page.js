"use client";
 
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRequireRole } from "@/hooks/useRequireRole";
import { logout, listRounds, ApiError } from "@/lib/api";

export default function EducatorDashboard() {
  const { user, checking } = useRequireRole("educator");
  const router = useRouter();

  const [rounds, setRounds] = useState([]);
  const [roundsStatus, setRoundsStatus] = useState("loading");

  useEffect(() => {
    if (checking) return;

    async function fetchRounds() {
      try {
        const data = await listRounds();
        setRounds(data);
        setRoundsStatus(data.length === 0 ? "empty" : "ready");
      } catch (err) {
        setRoundsStatus("error");
      }
    }

    fetchRounds();
  }, [checking]);

  if (checking) {
    return <main className="round-page"><p>Loading...</p></main>;
  }

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <main className="round-page">
      <h1>Educator Portal</h1>
      <p className="description">
        Logged in as <strong>{user.email}</strong> ({user.role})
      </p>

      <div className="card" style={{ display: "flex", gap: "12px" }}>
        <button onClick={handleLogout} className="button">
          Log out
        </button>
      </div>

      <h2 style={{ marginTop: "24px" }}>Rounds</h2>

      {roundsStatus === "loading" && (
        <p className="description">Loading rounds...</p>
      )}

      {roundsStatus === "empty" && (
        <p className="description">No rounds yet.</p>
      )}

      {roundsStatus === "error" && (
        <p className="message">Couldn't load rounds. Try refreshing the page.</p>
      )}

      {roundsStatus === "ready" && (
        <ul style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
          {rounds.map((round) => (
            <li key={round.id}>
             <Link
                href={`/educator/round_view?id=${round.id}`}
                className="card"
                style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px" }}
                >
                <span>{round.name}</span>
                <span style={{ textTransform: "capitalize" }}>{round.state}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}