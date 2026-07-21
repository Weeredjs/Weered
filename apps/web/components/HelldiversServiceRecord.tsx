"use client";

// Service Record — the user's real Helldivers 2 history off their linked
// Steam account, themed as a personnel file. Rides the existing per-user
// steam routes; no HD2-specific server surface needed.

import React, { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
const HD2_APP = 553850;
const GOLD = "#FFD700";

function authHeaders(): Record<string, string> {
  try {
    const t = localStorage.getItem("weered_token") || "";
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

// Honorary rank by hours on the front. These are the game's rank titles, but
// the mapping is ours (in-game rank is level-based, which Steam doesn't expose)
// — hence "honorary."
const RANKS: [number, string][] = [
  [0, "Cadet"],
  [10, "Space Cadet"],
  [25, "Sergeant"],
  [50, "Master Sergeant"],
  [75, "Chief"],
  [100, "Space Chief Prime"],
  [150, "Death Captain"],
  [200, "Marshal"],
  [300, "Star Marshal"],
  [400, "Chief Marshal"],
  [500, "Space Marshal"],
  [750, "Admirable Admiral"],
  [1000, "Hell Commander"],
];
function rankFor(hours: number): string {
  let title = RANKS[0][1];
  for (const [min, t] of RANKS) if (hours >= min) title = t;
  return title;
}

export default function HelldiversServiceRecord({
  accent = GOLD,
  currentUserId,
}: {
  accent?: string;
  currentUserId?: string;
}) {
  const [owned, setOwned] = useState<any>(null);
  const [ach, setAch] = useState<any>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!currentUserId) {
      setLoaded(true);
      return;
    }
    Promise.all([
      fetch(`${API}/steam/owned/${HD2_APP}`, { headers: authHeaders() })
        .then((r) => r.json())
        .catch(() => null),
      fetch(`${API}/steam/achievements/${HD2_APP}`, { headers: authHeaders() })
        .then((r) => r.json())
        .catch(() => null),
    ]).then(([o, a]) => {
      setOwned(o);
      setAch(a);
      setLoaded(true);
    });
  }, [currentUserId]);

  const kick: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: ".22em",
    color: "rgba(148,163,184,.7)",
  };
  const card: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,.1)",
    borderRadius: 12,
    padding: 16,
    background: "rgba(0,0,0,.25)",
  };

  if (!loaded)
    return (
      <div style={{ padding: 12, color: "rgba(148,163,184,.7)", fontSize: 13 }}>
        Pulling your file…
      </div>
    );

  if (!currentUserId)
    return (
      <div style={{ ...card, margin: 6, textAlign: "center", color: "rgba(236,242,250,.9)" }}>
        <div style={{ ...kick, color: accent, marginBottom: 8 }}>SERVICE RECORD</div>
        <p style={{ fontSize: 13, color: "rgba(148,163,184,.85)" }}>
          Sign in and link your Steam account, and this becomes your personnel file: hours on the
          front, commendations, honorary rank.
        </p>
      </div>
    );

  const linked = owned?.ok !== false && owned?.linked !== false;
  const hours = Math.round(((owned?.hoursPlayed ?? 0) as number) * 10) / 10;
  const hasGame = !!owned?.owned;
  const unlocked = Number(ach?.unlocked ?? 0);
  const total = Number(ach?.total ?? 0);
  const recent = Array.isArray(ach?.achievements)
    ? ach.achievements.filter((a: any) => a?.achieved).slice(0, 6)
    : [];

  if (!linked)
    return (
      <div style={{ ...card, margin: 6, textAlign: "center", color: "rgba(236,242,250,.9)" }}>
        <div style={{ ...kick, color: accent, marginBottom: 8 }}>SERVICE RECORD</div>
        <p
          style={{ fontSize: 13, color: "rgba(148,163,184,.85)", maxWidth: 380, margin: "0 auto" }}
        >
          No Steam account linked. Add your SteamID64 in Settings and your deployment history
          reports here automatically. Your Steam game details need to be public for the record to
          pull.
        </p>
      </div>
    );

  return (
    <div
      style={{
        padding: 6,
        color: "rgba(236,242,250,.95)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ ...card, textAlign: "center" }}>
        <div style={{ ...kick, color: accent, marginBottom: 4 }}>SERVICE RECORD</div>
        {hasGame ? (
          <>
            <div style={{ fontSize: 44, fontWeight: 900, color: accent, lineHeight: 1.1 }}>
              {hours.toLocaleString()}h
            </div>
            <div style={{ fontSize: 12, color: "rgba(148,163,184,.75)" }}>time on the front</div>
            <div style={{ marginTop: 10, fontSize: 15, fontWeight: 800 }}>{rankFor(hours)}</div>
            <div style={{ fontSize: 10.5, color: "rgba(148,163,184,.6)" }}>
              honorary rank · by hours
            </div>
          </>
        ) : (
          <p style={{ fontSize: 13, color: "rgba(148,163,184,.85)" }}>
            Helldivers 2 not found on this Steam account (or game details are private). Democracy
            needs you.
          </p>
        )}
      </div>

      {hasGame && total > 0 && (
        <div style={card}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 8,
            }}
          >
            <span style={kick}>COMMENDATIONS</span>
            <span style={{ fontWeight: 800, color: accent, fontVariantNumeric: "tabular-nums" }}>
              {unlocked}/{total}
            </span>
          </div>
          <div
            style={{
              height: 5,
              borderRadius: 3,
              background: "rgba(255,255,255,.1)",
              overflow: "hidden",
              marginBottom: 10,
            }}
          >
            <div
              style={{
                width: `${Math.min(100, (unlocked / total) * 100)}%`,
                height: "100%",
                background: accent,
              }}
            />
          </div>
          {recent.map((a: any, i: number) => (
            <div
              key={i}
              style={{ fontSize: 12.5, padding: "3px 0", color: "rgba(236,242,250,.85)" }}
            >
              ★ {a?.displayName || a?.name || a?.apiname}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
