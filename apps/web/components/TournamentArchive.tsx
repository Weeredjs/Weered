"use client";

import React from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
const ACCENT = "#f58220";

type ArchiveEntry = {
  id: string;
  title: string;
  description: string;
  format: string;
  startsAt: string;
  endsAt: string;
  updatedAt: string;
  _count: { entries: number };
  top: Array<{
    id: string;
    displayName: string;
    userId: string | null;
    rank: number;
    score: number;
  }>;
};

export default function TournamentArchive({ lobbyId }: { lobbyId: string }) {
  const [archive, setArchive] = React.useState<ArchiveEntry[]>([]);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    fetch(`${API}/tournaments/archive?lobbyId=${encodeURIComponent(lobbyId)}&limit=10`)
      .then((r) => r.json())
      .then((j) => {
        if (alive && j?.ok) setArchive(j.archive || []);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [lobbyId]);

  if (!loaded) return null;
  if (archive.length === 0) return null;

  return (
    <div style={{ marginTop: 18 }}>
      <div
        style={{
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: 1.4,
          color: "rgba(245,130,32,.7)",
          textTransform: "uppercase",
          marginBottom: 8,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        🏆 Hall of Fame
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {archive.map((t) => {
          const champion = t.top.find((e) => e.rank === 1);
          const runner = t.top.find((e) => e.rank === 2);
          const third = t.top.find((e) => e.rank === 3);
          return (
            <div
              key={t.id}
              style={{
                padding: "10px 14px",
                background: "rgba(20,14,8,.5)",
                border: "1px solid rgba(245,130,32,.15)",
                borderRadius: 4,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,.92)" }}>
                  {t.title}
                </span>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    padding: "1px 6px",
                    background: "rgba(255,255,255,.05)",
                    borderRadius: 999,
                    color: "rgba(255,255,255,.55)",
                    letterSpacing: 0.4,
                  }}
                >
                  {t.format.replace("_", " ")}
                </span>
                <span style={{ marginLeft: "auto", fontSize: 10, color: "rgba(255,255,255,.4)" }}>
                  {new Date(t.updatedAt).toLocaleDateString()} · {t._count.entries} entered
                </span>
              </div>
              <div style={{ display: "flex", gap: 10, fontSize: 11, flexWrap: "wrap" }}>
                {champion && (
                  <PodiumChip rank={1} name={champion.displayName} color="#fde68a" emoji="🥇" />
                )}
                {runner && (
                  <PodiumChip rank={2} name={runner.displayName} color="#e5e7eb" emoji="🥈" />
                )}
                {third && (
                  <PodiumChip rank={3} name={third.displayName} color="#d4a574" emoji="🥉" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PodiumChip({
  rank,
  name,
  color,
  emoji,
}: {
  rank: number;
  name: string;
  color: string;
  emoji: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 9px",
        background: `${color}14`,
        border: `1px solid ${color}38`,
        borderRadius: 999,
        color,
        fontWeight: 700,
      }}
    >
      <span aria-hidden style={{ fontSize: 12 }}>
        {emoji}
      </span>
      {name}
    </span>
  );
}
