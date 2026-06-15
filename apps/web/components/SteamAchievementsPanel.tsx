"use client";

import React from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

type Achievement = {
  name: string;
  displayName: string;
  description: string;
  icon: string | null;
  achieved: boolean;
  unlockTime: number | null;
  hidden: boolean;
};

type State =
  | { status: "loading" }
  | { status: "no-data" }
  | {
      status: "ok";
      gameName: string | null;
      total: number;
      unlocked: number;
      achievements: Achievement[];
    };

export default function SteamAchievementsPanel({
  appId,
  userId,
  gameDisplayName,
  accentColor = "#FFD700",
}: {
  appId: string;
  userId?: string;
  gameDisplayName?: string;
  accentColor?: string;
}) {
  const [state, setState] = React.useState<State>({ status: "loading" });
  const [expanded, setExpanded] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const tok = (() => {
          try {
            return localStorage.getItem("weered_token") || "";
          } catch {
            return "";
          }
        })();
        if (!tok) {
          if (alive) setState({ status: "no-data" });
          return;
        }
        const url = userId
          ? `${API}/steam/achievements/${encodeURIComponent(appId)}?userId=${encodeURIComponent(userId)}`
          : `${API}/steam/achievements/${encodeURIComponent(appId)}`;
        const r = await fetch(url, { headers: { Authorization: `Bearer ${tok}` } });
        if (!r.ok) {
          if (alive) setState({ status: "no-data" });
          return;
        }
        const j = await r.json();
        if (!alive) return;
        if (!j?.ok || !j.linked || !Array.isArray(j.achievements) || j.achievements.length === 0) {
          setState({ status: "no-data" });
          return;
        }
        setState({
          status: "ok",
          gameName: j.gameName || gameDisplayName || null,
          total: Number(j.total || 0),
          unlocked: Number(j.unlocked || 0),
          achievements: j.achievements,
        });
      } catch {
        if (alive) setState({ status: "no-data" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [appId, userId, gameDisplayName]);

  if (state.status === "loading") return null;
  if (state.status === "no-data") return null;

  const { gameName, total, unlocked, achievements } = state;
  const pct = total > 0 ? Math.round((unlocked / total) * 100) : 0;

  const sorted = [...achievements].sort((a, b) => {
    if (a.achieved !== b.achieved) return a.achieved ? -1 : 1;
    return (b.unlockTime || 0) - (a.unlockTime || 0);
  });
  const visible = expanded ? sorted : sorted.slice(0, 6);

  return (
    <div
      style={{
        borderRadius: 10,
        border: `1px solid ${accentColor}1f`,
        background: "rgba(255,255,255,.02)",
        padding: 12,
        marginBottom: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: "1.4px",
              textTransform: "uppercase",
              color: accentColor,
              opacity: 0.7,
            }}
          >
            Achievements
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "rgba(243,244,246,.95)",
              marginTop: 2,
            }}
          >
            {gameName || "Steam game"}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: accentColor, lineHeight: 1 }}>
            {unlocked}
            <span style={{ fontSize: 11, opacity: 0.55, fontWeight: 700 }}>/{total}</span>
          </div>
          <div style={{ fontSize: 9, fontWeight: 700, opacity: 0.5, marginTop: 2 }}>
            {pct}% complete
          </div>
        </div>
      </div>

      <div
        style={{
          height: 4,
          borderRadius: 2,
          background: "rgba(255,255,255,.06)",
          overflow: "hidden",
          marginBottom: 12,
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: accentColor,
            boxShadow: `0 0 8px ${accentColor}55`,
            transition: "width .4s",
          }}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(56px, 1fr))",
          gap: 6,
        }}
      >
        {visible.map((a) => (
          <div
            key={a.name}
            title={`${a.displayName}${a.description ? "\n" + a.description : ""}${a.unlockTime ? "\nUnlocked " + new Date(a.unlockTime).toLocaleDateString() : ""}`}
            style={{
              aspectRatio: "1",
              borderRadius: 6,
              border: `1px solid ${a.achieved ? `${accentColor}44` : "rgba(255,255,255,.06)"}`,
              background: a.achieved
                ? `linear-gradient(135deg, ${accentColor}10, transparent 60%), rgba(255,255,255,.02)`
                : "rgba(0,0,0,.25)",
              overflow: "hidden",
              position: "relative",
              opacity: a.achieved ? 1 : 0.45,
              filter: a.achieved ? "none" : "grayscale(0.85)",
            }}
          >
            {a.icon ? (
              <img
                src={a.icon}
                alt={a.displayName}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                loading="lazy"
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                  fontWeight: 900,
                  color: a.achieved ? accentColor : "rgba(255,255,255,.25)",
                }}
              >
                ★
              </div>
            )}
            {a.achieved && (
              <span
                style={{
                  position: "absolute",
                  bottom: 2,
                  right: 2,
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  background: accentColor,
                  boxShadow: "0 0 4px rgba(0,0,0,.6)",
                  fontSize: 7,
                  fontWeight: 900,
                  color: "#000",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  lineHeight: 1,
                }}
              >
                ✓
              </span>
            )}
          </div>
        ))}
      </div>

      {achievements.length > 6 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{
            marginTop: 10,
            padding: "5px 10px",
            background: "transparent",
            border: `1px solid ${accentColor}33`,
            color: accentColor,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            borderRadius: 4,
            cursor: "pointer",
            width: "100%",
          }}
        >
          {expanded ? "Collapse" : `Show all ${achievements.length}`}
        </button>
      )}
    </div>
  );
}
