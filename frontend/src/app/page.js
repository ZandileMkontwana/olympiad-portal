"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const round = {
    name: "Round 1 – Mathematics",
    openingTime: new Date("2026-08-10T08:00:00"),
    closingTime: new Date("2026-08-15T17:00:00"),
    paperName: "Round 1 Mathematics Paper",
    paperType: "Multiple Choice Questionnaire",
  };

  const [status, setStatus] = useState("");

  useEffect(() => {
    function updateStatus() {
      const now = new Date();

      if (now < round.openingTime) {
        setStatus("UPCOMING");
      } else if (now < round.closingTime) {
        setStatus("OPEN");
      } else {
        setStatus("CLOSED");
      }
    }

    updateStatus();

    const timer = setInterval(updateStatus, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <main className="round-page">

      <div className="round-header">
        <h1>{round.name}</h1>

        <span className={`status ${status.toLowerCase()}`}>
          {status}
        </span>
      </div>

      <section className="round-information">

        <div>
          <strong>Opening</strong>
          <p>{round.openingTime.toLocaleString()}</p>
        </div>

        <div>
          <strong>Closing</strong>
          <p>{round.closingTime.toLocaleString()}</p>
        </div>

      </section>

      <section className="card">

        <h2>Test Paper</h2>

        <p>{round.paperName}</p>

        <p className="description">
          {round.paperType}
        </p>

        {status === "UPCOMING" && (
          <div className="message">
            The paper will be available when the round opens.
          </div>
        )}

        {status === "OPEN" && (
          <button className="button">
            Download Paper
          </button>
        )}

        {status === "CLOSED" && (
          <div className="message">
            This round has closed.
          </div>
        )}

      </section>

      <section className="card">

        <h2>Submit Results</h2>

        {status === "OPEN" && (
          <>
            <p>
              Upload the results for your entrants while this
              round is open.
            </p>

            <button className="button">
              Upload Results
            </button>
          </>
        )}

        {status === "UPCOMING" && (
          <p>
            Results cannot be submitted until the round opens.
          </p>
        )}

        {status === "CLOSED" && (
          <p>
            This round is closed and no more results can be
            submitted.
          </p>
        )}

      </section>

    </main>
  );
}