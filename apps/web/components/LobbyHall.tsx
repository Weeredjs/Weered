"use client";

// Mplayer Mode: the lobby's default view. A compact room stack on the left,
// the lobby CHAT as the centrepiece on the right — you land in a room list
// with the conversation already running beside it, the way Mplayer worked.
// The slide-out drawer stays available (default closed) for the other tabs;
// "Dial In" hands the chat the whole stage.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import LobbyRoomDirectory, { type LobbyPresenceUser } from "./LobbyRoomDirectory";
import LobbyChatPanel from "./LobbyChatPanel";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

function authHeaders(): Record<string, string> {
  try {
    const t = localStorage.getItem("weered_token") || "";
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

export default function LobbyHall({
  lobbyId,
  lobbyName,
  accentColor,
  bannerUrl,
  moduleType,
  style,
}: {
  lobbyId: string;
  lobbyName?: string;
  accentColor?: string;
  bannerUrl?: string;
  moduleType?: string;
  hasModules?: boolean;
  onOpenModules?: () => void;
  style?: React.CSSProperties;
}) {
  const accent = accentColor || "#5800E5";
  const [presence, setPresence] = useState<LobbyPresenceUser[]>([]);

  const loadPresence = useCallback(() => {
    fetch(`${API}/lobbies/${encodeURIComponent(lobbyId)}/presence`, {
      headers: authHeaders() as any,
    })
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok && Array.isArray(j.users)) setPresence(j.users);
      })
      .catch(() => {});
  }, [lobbyId]);

  useEffect(() => {
    loadPresence();
    const iv = setInterval(loadPresence, 30_000);
    let t: ReturnType<typeof setTimeout> | null = null;
    const onActivity = () => {
      if (t) clearTimeout(t);
      t = setTimeout(loadPresence, 800);
    };
    const events = [
      "weered:lobby:activity",
      "weered:presence:join",
      "weered:presence:leave",
      "weered:presence:state",
    ];
    for (const e of events) window.addEventListener(e, onActivity);
    return () => {
      clearInterval(iv);
      if (t) clearTimeout(t);
      for (const e of events) window.removeEventListener(e, onActivity);
    };
  }, [loadPresence]);

  const hereCount = useMemo(() => presence.filter((u) => !u.isAway).length, [presence]);

  function dialIn() {
    try {
      window.dispatchEvent(new CustomEvent("weered:chat:dialin"));
    } catch {}
  }

  return (
    <div
      className="weered-lobby-hall"
      style={{ display: "flex", gap: 14, alignItems: "stretch", minHeight: 0, ...style }}
    >
      <LobbyRoomDirectory
        lobbyId={lobbyId}
        accentColor={accentColor}
        bannerUrl={bannerUrl}
        moduleType={moduleType}
        presenceUsers={presence}
        compact
        style={{ flex: "0 1 420px", minWidth: 0, minHeight: 0 }}
      />

      <div
        className="weered-lobby-chatstage"
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          borderRadius: 14,
          border: `1px solid ${accent}22`,
          background: "rgba(10,10,18,.55)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "9px 12px",
            borderBottom: "1px solid rgba(255,255,255,.06)",
            background: `linear-gradient(135deg, ${accent}14, rgba(255,255,255,.02))`,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: ".08em",
              textTransform: "uppercase",
              color: "rgba(243,244,246,.9)",
            }}
          >
            {lobbyName || "Lobby"} · Chat
          </span>
          {hereCount > 0 && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 10,
                fontFamily: "monospace",
                color: "rgba(148,163,184,.65)",
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#22c55e",
                  boxShadow: "0 0 6px #22c55e88",
                }}
              />
              {hereCount} here
            </span>
          )}
          <button
            onClick={dialIn}
            title="Dial In — fullscreen the chat"
            style={{
              marginLeft: "auto",
              padding: "4px 11px",
              borderRadius: 7,
              cursor: "pointer",
              border: `1px solid ${accent}66`,
              background: `${accent}1f`,
              color: "rgba(243,244,246,.92)",
              fontSize: 10.5,
              fontWeight: 800,
              letterSpacing: ".04em",
              fontFamily: "inherit",
              flexShrink: 0,
            }}
          >
            ⤢ DIAL IN
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          {/* embedded: the stage header above already names the chat, and the
              panel's own title + "Open Dock" CTA don't belong inline (the Dock
              stays the subtle slide-out it always was). */}
          <LobbyChatPanel roomId={lobbyId} embedded />
        </div>
      </div>

      <style>{`
        @media (max-width: 1100px) {
          .weered-lobby-hall { flex-direction: column !important; }
          .weered-lobby-chatstage { min-height: 420px; }
        }
      `}</style>
    </div>
  );
}
