"use client";

import React from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

export default function SteamLobbyHeader({
  appId,
  accentColor,
}: {
  appId: string;
  accentColor?: string;
}) {
  const accent = accentColor || "#FFD700";
  const [count, setCount] = React.useState<number | null>(null);
  const [errored, setErrored] = React.useState(false);
  const [owned, setOwned] = React.useState<{
    owned: boolean;
    hoursPlayed: number;
    lastPlayed: number | null;
  } | null>(null);

  React.useEffect(() => {
    if (!appId) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      try {
        const r = await fetch(`${API}/steam/players/${encodeURIComponent(appId)}`, {
          cache: "no-store",
        });
        if (!r.ok) throw new Error(String(r.status));
        const j = await r.json();
        if (!alive) return;
        if (j?.ok && typeof j.count === "number") {
          setCount(j.count);
          setErrored(false);
        } else setErrored(true);
      } catch {
        if (alive) setErrored(true);
      }
      if (alive) timer = setTimeout(tick, 60_000);
    };
    tick();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [appId]);

  React.useEffect(() => {
    if (!appId) return;
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
        if (!tok) return;
        const r = await fetch(`${API}/steam/owned/${encodeURIComponent(appId)}`, {
          cache: "no-store",
          headers: { Authorization: `Bearer ${tok}` },
        });
        if (!r.ok) return;
        const j = await r.json();
        if (!alive) return;
        if (j?.ok && j.linked && j.owned)
          setOwned({
            owned: true,
            hoursPlayed: Number(j.hoursPlayed || 0),
            lastPlayed: j.lastPlayed || null,
          });
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, [appId]);

  const display = (() => {
    if (count === null) return "…";
    if (count >= 1_000_000) return (count / 1_000_000).toFixed(1) + "M";
    if (count >= 1_000) return (count / 1_000).toFixed(1) + "k";
    return String(count);
  })();

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <a
        href={`steam://run/${appId}`}
        title="Launch via Steam (requires Steam desktop client)"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "3px 9px",
          borderRadius: 6,
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          background: `linear-gradient(135deg, ${accent}28, ${accent}12)`,
          border: `1px solid ${accent}55`,
          color: accent,
          textDecoration: "none",
          whiteSpace: "nowrap",
          flexShrink: 0,
          cursor: "pointer",
          transition: "all .15s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background =
            `linear-gradient(135deg, ${accent}40, ${accent}1a)`;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background =
            `linear-gradient(135deg, ${accent}28, ${accent}12)`;
        }}
      >
        <SteamGlyph color={accent} />
        Launch
      </a>

      {!(errored && count === null) && (
        <span
          title={
            count !== null
              ? `${count.toLocaleString()} players online via Steam`
              : "Loading concurrent player count…"
          }
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "2px 8px",
            borderRadius: 6,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.04em",
            background: `${accent}18`,
            border: `1px solid ${accent}38`,
            color: accent,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              background: accent,
              boxShadow: `0 0 6px ${accent}`,
              animation: "pulse 2s ease-in-out infinite",
            }}
          />
          {display} ACTIVE
        </span>
      )}

      {owned?.owned && (
        <span
          title={`You own this game on Steam${owned.hoursPlayed > 0 ? ` — ${owned.hoursPlayed.toLocaleString()} hours played` : ""}${owned.lastPlayed ? ` · last played ${new Date(owned.lastPlayed).toLocaleDateString()}` : ""}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "2px 8px",
            borderRadius: 6,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.04em",
            background: "rgba(34,197,94,.10)",
            border: "1px solid rgba(34,197,94,.40)",
            color: "#22c55e",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          <span aria-hidden style={{ fontSize: 10 }}>
            ✓
          </span>
          OWNED{owned.hoursPlayed > 0 ? ` · ${formatHours(owned.hoursPlayed)}` : ""}
        </span>
      )}
    </span>
  );
}

function formatHours(h: number): string {
  if (h >= 1000) return (h / 1000).toFixed(1) + "K H";
  return h.toLocaleString() + "H";
}

function SteamGlyph({ color }: { color: string }) {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="7" stroke={color} strokeWidth="1.4" />
      <circle cx="10.5" cy="6" r="1.6" stroke={color} strokeWidth="1.2" fill="none" />
      <path
        d="M3.5 9.2 L6.4 10.4 M6.4 10.4 L8.6 7.5"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
