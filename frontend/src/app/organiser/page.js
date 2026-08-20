"use client";

//THIS IS THE ORGANISER'S PAGE

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRequireRole } from "@/hooks/useRequireRole";
import { logout, listRounds, ApiError } from "@/lib/api";

export default function OrganiserDashboard() {
  const { user, checking } = useRequireRole("organiser");
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
      <h1>Organiser Console</h1>
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
        <p className="description">No rounds yet. Create one to get started.</p>
      )}

      {roundsStatus === "error" && (
        <p className="message">Couldn't load rounds. Try refreshing the page.</p>
      )}

      {roundsStatus === "ready" && (
        <ul style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
          {rounds.map((round) => {
            // Open rounds go to the upload page; closed rounds go to the
            // closed-round explanation page; anything else (scheduled,
            // released) falls back to the educator round_view for now.
            let href = `/educator/round_view?id=${round.id}`;
            if (round.state === "open") {
              href = `/rounds/${round.id}/papers`;
            } else if (round.state === "closed") {
              href = `/rounds/${round.id}/closed_round`;
            }

            return (
              <li key={round.id}>
                <Link
                  href={href}
                  className="card"
                  style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px" }}
                >
                  <span>{round.name}</span>
                  <span style={{ textTransform: "capitalize" }}>{round.state}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

//THIS IS THE EORGANISER'S PAGE