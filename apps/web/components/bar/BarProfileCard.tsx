"use client";

import React from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

type Summary = {
  games: number;
  wins: number;
  losses: number;
  winRate: number | null;
  topMap: string | null;
  lastPlayed: string | null;
  avgMinutes: number | null;
  vsBots: number;
};

function ago(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 60 ? `${d}d ago` : `${Math.floor(d / 30)}mo ago`;
}

/**
 * The numbers a linked Beyond All Reason name earns on a profile. Drawn from
 * the player's recent PUBLIC matches only — private and room-launched games
 * never reach BAR's replay service.
 */
export default function BarProfileCard({
  name,
  section,
  label,
}: {
  name?: string | null;
  section: React.CSSProperties;
  label: React.CSSProperties;
}) {
  const [summary, setSummary] = React.useState<Summary | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    if (!name) return;
    let alive = true;
    setSummary(null);
    setFailed(false);
    fetch(`${API}/bar/players/${encodeURIComponent(name)}`)
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (j?.ok) setSummary(j.summary);
        else setFailed(true);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [name]);

  if (!name) return null;

  const stat = (k: string, v: React.ReactNode) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <span
        style={{
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: ".6px",
          opacity: 0.5,
          textTransform: "uppercase",
        }}
      >
        {k}
      </span>
      <span
        style={{
          fontSize: 13,
          fontWeight: 700,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {v}
      </span>
    </div>
  );

  return (
    <div style={{ ...section, marginTop: 10 }}>
      <div style={label}>Beyond All Reason</div>
      <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>{name}</div>
      {failed ? (
        <div style={{ fontSize: 11, opacity: 0.55, marginTop: 6 }}>
          BAR's stats are unreachable right now.
        </div>
      ) : !summary ? (
        <div style={{ fontSize: 11, opacity: 0.45, marginTop: 6 }}>Loading…</div>
      ) : summary.games === 0 ? (
        <div style={{ fontSize: 11, opacity: 0.55, marginTop: 6 }}>No recent public matches.</div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(84px, 1fr))",
            gap: 10,
            marginTop: 8,
          }}
        >
          {stat("Recent games", summary.games)}
          {stat("W–L", `${summary.wins}–${summary.losses}`)}
          {stat("Win rate", summary.winRate === null ? "—" : `${summary.winRate}%`)}
          {stat("Top map", summary.topMap || "—")}
          {stat("Last played", ago(summary.lastPlayed))}
        </div>
      )}
    </div>
  );
}
