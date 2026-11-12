"use client";

// The slim bar across the top of a lobby for anyone who isn't in it yet
// (James 2026-11-12: "Take down." the wall). It replaces two things:
// - the full-screen "Unlock the <lobby> experience" card, which blurred the
//   lobby an invited friend had come to see behind four generic perks, when
//   the lobby's own welcome is the better pitch; and
// - the signed-out strip whose "Sign up free" opened Sign in and forgot the
//   join.
// Now the lobby shows, and this bar asks. Signed out, Join leads to a free
// account and back, joined (app/lobby/[id]/useJoinLobby.ts). A lobby with its
// own front door, approval or a password keeps that way in: here it only
// offers the account.

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

// "What joining gets you", in the lobby's own words where it has some.
const JOIN_COPY: Record<string, string> = {
  helldivers2: "chat, seed rallies and drop into voice",
  cowork: "take part in the sprint, post on the day board and sit in Deep Work",
  windrose: "chat, share builds and drop into voice",
};

/** The line beside the button. Exported for its test. */
export function joinLine(o: {
  lobbyId: string;
  lobbyName: string;
  signedIn: boolean;
  canJoin: boolean;
  themeable: boolean;
}): string {
  const does = JOIN_COPY[o.lobbyId] || "chat and drop into voice";
  const look = o.themeable ? `, and get the full ${o.lobbyName} look` : "";
  if (!o.signedIn)
    return o.canJoin
      ? `You're looking round ${o.lobbyName}. Join free to ${does}${look}.`
      : `You're looking round ${o.lobbyName}. Make a free account to ${does}.`;
  return `You're looking round ${o.lobbyName}. Join to ${does}${look}.`;
}

// Signed-out visitors on a lobby: a live "N viewing", pinged every 20 s with a
// per-tab id. Off for members and for anyone signed in.
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
    void ping();
    const iv = setInterval(ping, 20_000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [lobbyId, enabled]);
  return count;
}

export default function LobbyJoinBar({
  lobbyId,
  lobbyName,
  signedIn,
  isMember,
  canJoin,
  themeable,
  onJoin,
}: {
  lobbyId: string;
  lobbyName: string;
  signedIn: boolean;
  /** Members, the owner and staff see no bar. */
  isMember: boolean;
  /** An open lobby with no front door: Join works from here. */
  canJoin: boolean;
  themeable: boolean;
  onJoin: () => Promise<void>;
}) {
  const viewing = usePublicViewers(lobbyId, !!lobbyId && !signedIn);
  const [joining, setJoining] = useState(false);
  if (!lobbyId || isMember) return null;
  // Signed in, and the lobby has its own way in: that way does the asking.
  if (signedIn && !canJoin) return null;

  const button: React.CSSProperties = {
    padding: "7px 16px",
    borderRadius: 6,
    border: 0,
    background: "#C9A227",
    color: "#1a1a1a",
    fontWeight: 800,
    fontSize: 13,
    textDecoration: "none",
    whiteSpace: "nowrap",
    cursor: "pointer",
    fontFamily: "inherit",
  };
  return (
    <div
      className="weered-joinbar"
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
      {!signedIn && (
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
      )}
      <span style={{ color: "rgba(214,205,186,.86)", flex: 1, minWidth: 180 }}>
        {joinLine({ lobbyId, lobbyName, signedIn, canJoin, themeable })}
      </span>
      {canJoin ? (
        <button
          type="button"
          style={{ ...button, opacity: joining ? 0.7 : 1 }}
          disabled={joining}
          onClick={async () => {
            setJoining(true);
            try {
              await onJoin();
            } finally {
              setJoining(false);
            }
          }}
        >
          {joining ? "Joining…" : `Join ${lobbyName}`}
        </button>
      ) : (
        <a
          href={`/login?mode=register&next=${encodeURIComponent("/lobby/" + encodeURIComponent(lobbyId))}`}
          style={button}
        >
          Join free
        </a>
      )}
    </div>
  );
}
