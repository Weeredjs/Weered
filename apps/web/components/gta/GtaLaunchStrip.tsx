"use client";

// The GTA 6 lobby's launch strip (2026-11-01, James: "GTA [VI]. like 19 days.
// What can we do about that?"): the countdown to the 19th, then the two things to
// do before it — file your rap sheet (app/rap), claim your crew's tag (the dock's
// Crew tab; api lib/crewTag.ts) — and the crews already here.
import React, { useEffect, useState } from "react";
import { crewPath } from "../../lib/rapSheet";
import { onAccent, safeAccent } from "../../lib/brandSafe";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

/** Midnight on the 19th, wherever the viewer is. */
const LAUNCH = new Date(2026, 10, 19, 0, 0, 0).getTime();

type CrewChip = { id: string; name: string; tag: string; recruiting?: boolean };

function left(ms: number): string {
  const m = Math.max(0, Math.floor(ms / 60000));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  return `${d}d ${String(h).padStart(2, "0")}h ${String(m % 60).padStart(2, "0")}m`;
}

export default function GtaLaunchStrip({ lobbyId, accent }: { lobbyId: string; accent?: string }) {
  const a = safeAccent(accent, "#ff4d9d");
  const [now, setNow] = useState<number | null>(null);
  const [crews, setCrews] = useState<CrewChip[]>([]);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    fetch(`${API}/lobbies/${encodeURIComponent(lobbyId)}/crews`)
      .then((r) => r.json())
      .then((j) => setCrews(Array.isArray(j?.crews) ? j.crews.slice(0, 8) : []))
      .catch(() => {});
  }, [lobbyId]);

  // The dock's Crew tab, where a crew is established (components/dock/CrewTab.tsx).
  const claimTag = () => {
    try {
      window.dispatchEvent(new CustomEvent("weered:dock:open", { detail: { tab: "crew" } }));
    } catch {}
  };

  const out = now !== null && now >= LAUNCH;
  const btn: React.CSSProperties = {
    padding: "8px 14px",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
    textDecoration: "none",
    whiteSpace: "nowrap",
  };

  return (
    <div
      style={{
        flexShrink: 0,
        margin: "10px 12px 0",
        padding: "12px 14px",
        borderRadius: 14,
        border: `1px solid ${a}55`,
        background: `linear-gradient(110deg, ${a}26 0%, ${a}0d 45%, transparent 100%)`,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px 16px", flexWrap: "wrap" }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "2px 10px",
            flex: "1 1 220px",
            minWidth: 0,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{ fontWeight: 900, fontSize: 15, letterSpacing: ".04em", whiteSpace: "nowrap" }}
          >
            {out ? "GTA VI is out." : "GTA VI drops in"}
          </span>
          {!out && now !== null && (
            <span
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontWeight: 800,
                fontSize: 16,
                color: a,
                whiteSpace: "nowrap",
              }}
            >
              {left(LAUNCH - now)}
            </span>
          )}
          <span style={{ fontSize: 12, opacity: 0.6 }}>
            {out ? "Find your crew." : "Get set before the doors open."}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a
            href="/rap"
            style={{ ...btn, background: a, color: onAccent(a), border: `1px solid ${a}` }}
          >
            Make your rap sheet
          </a>
          <button
            type="button"
            onClick={claimTag}
            style={{
              ...btn,
              background: "rgba(255,255,255,.06)",
              color: "inherit",
              border: "1px solid rgba(255,255,255,.16)",
            }}
          >
            Claim your crew tag
          </button>
        </div>
      </div>
      {crews.length > 0 && (
        <div
          style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 12 }}
        >
          <span style={{ opacity: 0.55, fontWeight: 700, marginRight: 2 }}>Crews here</span>
          {crews.map((c) => (
            <a
              key={c.id}
              href={crewPath(c)}
              title={c.recruiting ? "Recruiting" : undefined}
              style={{
                padding: "3px 9px",
                borderRadius: 999,
                textDecoration: "none",
                color: "inherit",
                fontWeight: 700,
                background: "rgba(255,255,255,.05)",
                border: `1px solid ${c.recruiting ? `${a}66` : "rgba(255,255,255,.12)"}`,
              }}
            >
              {c.tag ? (
                <span style={{ color: a, fontFamily: "ui-monospace, monospace" }}>[{c.tag}] </span>
              ) : null}
              {c.name}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
