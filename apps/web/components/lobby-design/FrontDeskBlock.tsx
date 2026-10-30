"use client";

// The front desk on a lobby's Home (James 2026-10-30: "Full reception area and
// digital offices... make it easy"; the Digital office template puts one up
// front). A visitor rings it; the lobby's owner and staff (moderators and up)
// get a notification that links to the room the visitor waits in.
// POST /lobbies/:id/ring (apps/api/src/routes/frontDesk.ts).
import React, { useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

function authHeaders(): Record<string, string> {
  try {
    const t = localStorage.getItem("weered_token") || "";
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

type Room = { id: string; name: string; onlineCount?: number };

export default function FrontDeskBlock({
  lobbyId,
  props,
  accent,
  font,
  rooms,
  designing,
}: {
  lobbyId: string;
  props: Record<string, any>;
  accent: string;
  font: string;
  rooms: Room[];
  designing?: boolean;
}) {
  const [state, setState] = useState<"idle" | "busy" | "rung" | "signin" | "wait" | "error">(
    "idle",
  );
  const [msg, setMsg] = useState("");
  const room = rooms.find((r) => r.id === props.roomId);

  async function ring() {
    if (designing || state === "busy") return;
    setState("busy");
    try {
      const r = await fetch(`${API}/lobbies/${encodeURIComponent(lobbyId)}/ring`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ roomId: room?.id || "" }),
      });
      if (r.status === 401) return setState("signin");
      const j = await r.json().catch(() => ({}));
      if (j?.ok) {
        setState("rung");
        setMsg(
          j.notified
            ? `Rung. ${j.notified === 1 ? "Someone has" : `${j.notified} people have`} been told you're here.`
            : "Rung. Nobody is on the desk right now; try again a little later.",
        );
      } else if (r.status === 429) {
        setState("wait");
        setMsg("You rang a moment ago. Hang tight, someone's on the way.");
      } else {
        setState("error");
        setMsg(j?.message || "The bell didn't ring. Try again.");
      }
    } catch {
      setState("error");
      setMsg("No connection. Try again.");
    }
  }

  return (
    <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10, height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          aria-hidden
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            display: "grid",
            placeItems: "center",
            fontSize: 20,
            background: `${accent}26`,
            border: `1px solid ${accent}55`,
          }}
        >
          🛎
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: font, fontSize: 18, fontWeight: 900, color: "#fff" }}>
            {props.title || "Front desk"}
          </div>
          {props.note && (
            <div style={{ fontSize: 13, opacity: 0.7, lineHeight: 1.45 }}>{props.note}</div>
          )}
        </div>
      </div>

      {state === "signin" ? (
        <a
          href={`/login?next=${encodeURIComponent(`/lobby/${lobbyId}`)}`}
          style={{ ...bell(accent, true), textDecoration: "none", textAlign: "center" }}
        >
          Sign in to ring
        </a>
      ) : (
        <button
          type="button"
          onClick={() => void ring()}
          disabled={state === "busy" || state === "rung" || state === "wait"}
          style={bell(accent, state === "idle" || state === "error")}
        >
          {state === "busy"
            ? "Ringing…"
            : state === "rung" || state === "wait"
              ? "🛎 Rung"
              : "🛎 Ring the desk"}
        </button>
      )}
      {msg && <div style={{ fontSize: 12.5, opacity: 0.75, lineHeight: 1.45 }}>{msg}</div>}
      {room && (
        <a
          href={`/room/${encodeURIComponent(room.id)}`}
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: accent,
            textDecoration: "none",
            marginTop: "auto",
          }}
        >
          Wait in {room.name}
          {room.onlineCount ? ` · ${room.onlineCount} there` : ""} →
        </a>
      )}
    </div>
  );
}

function bell(accent: string, on: boolean): React.CSSProperties {
  return {
    display: "block",
    width: "100%",
    padding: "11px 14px",
    borderRadius: 12,
    border: 0,
    cursor: on ? "pointer" : "default",
    fontFamily: "inherit",
    fontSize: 14.5,
    fontWeight: 900,
    color: "#fff",
    background: on ? accent : "rgba(255,255,255,.1)",
    boxShadow: on ? `0 12px 26px -12px ${accent}` : "none",
  };
}
