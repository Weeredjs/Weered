"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

// Lobbies opened for public, logged-out, read-only viewing (launch surfaces).
const PUBLIC_LAUNCH_LOBBIES = new Set(["helldivers2", "cowork", "windrose"]);

// Per-lobby "what signing up gets you" line. Keep it in the lobby's own
// vocabulary; the default covers game lobbies.
const GUEST_ACTION_COPY: Record<string, string> = {
  helldivers2: "Sign up to chat, seed rallies, and drop into voice.",
  cowork: "Sign up to join the sprint, post on the day board, and sit in Deep Work.",
  windrose: "Sign up to chat, share builds, and drop into voice.",
};

// Ephemeral anon viewer count for a launch lobby: ping every 20s with a
// per-session id and reflect the live "N viewing" total. No-op when disabled.
function usePublicViewers(lobbyId: string, enabled: boolean): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let sid = "";
    try {
      sid = sessionStorage.getItem("weered_vsid") || "";
      if (!sid) {
        sid = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.round(performance.now())}`;
        sessionStorage.setItem("weered_vsid", sid);
      }
    } catch {
      sid = String(Date.now());
    }
    let alive = true;
    const ping = async () => {
      try {
        const r = await fetch(`${API}/lobbies/${encodeURIComponent(lobbyId)}/viewing`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sid }),
        });
        const j = await r.json();
        if (alive && typeof j?.count === "number") setCount(j.count);
      } catch {}
    };
    ping();
    const iv = setInterval(ping, 20_000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [lobbyId, enabled]);
  return count;
}

// Slim top bar shown to logged-out visitors on a public launch lobby: live
// viewer count + a single sign-up CTA. Read-only is enforced server-side (no
// token → every action 401s); this just makes it intentional and converts.
// Renders nothing for logged-in users or non-launch lobbies.
export default function GuestLaunchBar({
  lobbyId,
  lobbyName,
  loggedIn,
}: {
  lobbyId: string;
  lobbyName: string;
  loggedIn: boolean;
}) {
  const active = PUBLIC_LAUNCH_LOBBIES.has(lobbyId) && !loggedIn;
  const viewing = usePublicViewers(lobbyId, active);
  if (!active) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        padding: "10px 16px",
        background: "linear-gradient(90deg, rgba(201,162,39,.14), rgba(201,162,39,.03))",
        borderBottom: "1px solid rgba(201,162,39,.25)",
        fontSize: 13,
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          color: "rgba(240,232,214,.92)",
          fontWeight: 700,
        }}
      >
        <span aria-hidden>👁</span>
        {viewing > 0 ? `${viewing} viewing` : "Viewing"}
      </span>
      <span style={{ color: "rgba(200,190,170,.75)", flex: 1, minWidth: 180 }}>
        You&rsquo;re exploring {lobbyName} as a guest.{" "}
        {GUEST_ACTION_COPY[lobbyId] || "Sign up to chat and drop into voice."}
      </span>
      <a
        href={`/login?next=${encodeURIComponent("/lobby/" + lobbyId)}`}
        style={{
          padding: "7px 16px",
          borderRadius: 6,
          background: "#C9A227",
          color: "#1a1a1a",
          fontWeight: 800,
          textDecoration: "none",
          whiteSpace: "nowrap",
        }}
      >
        Sign up free
      </a>
    </div>
  );
}
