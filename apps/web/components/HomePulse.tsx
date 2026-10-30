"use client";

// Home's Mplayer moment, done the home way: PEOPLE are the doors. Your
// friends and crew who are on, with where they are and a one-click Join.
// Shows only when someone is on. The Home Lobby's room list used to sit here
// too, mostly reading "quiet" (James 2026-10-30: "The active rooms is ...");
// rooms with people in them are under Live now, and every Home Lobby room is
// on /lobby.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { avatarBg } from "../lib/avatarColor";

const API = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";

function authHeaders(): Record<string, string> {
  try {
    const t = localStorage.getItem("weered_token") || "";
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

// Where "join them" goes: a lobby-shaped presence lands on the lobby page
// (where its rooms reveal themselves), a plain room goes straight in.
function joinHref(roomId?: string | null, roomIsLobby?: boolean): string | null {
  if (!roomId) return null;
  const clean = String(roomId).replace("room:", "");
  if (clean === "lobby" || roomIsLobby) return `/lobby/${encodeURIComponent(clean)}`;
  return `/room/${encodeURIComponent(clean)}`;
}

function Face({
  name,
  avatar,
  color,
  size = 30,
  dim,
  title,
}: {
  name: string;
  avatar?: string | null;
  color?: string | null;
  size?: number;
  dim?: boolean;
  title?: string;
}) {
  return (
    <div
      title={title || name}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        flexShrink: 0,
        border: "2px solid rgba(10,10,15,.9)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.38,
        fontWeight: 800,
        color: "#fff",
        background: avatar ? "rgba(255,255,255,.08)" : color || avatarBg(name),
        opacity: dim ? 0.45 : 1,
      }}
    >
      {avatar ? (
        <img
          src={avatar}
          alt={name + " avatar"}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        (name[0]?.toUpperCase() ?? "?")
      )}
    </div>
  );
}

export default function HomePulse({
  homeUsers: _homeUsers,
  onDm,
}: {
  homeUsers: any[];
  onDm: (u: any) => void;
}) {
  const [friends, setFriends] = useState<any[]>([]);

  const loadFriends = useCallback(() => {
    fetch(`${API}/friends`, { headers: authHeaders() as any })
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d?.friends)) setFriends(d.friends);
      })
      .catch(() => {});
  }, []);

  // Friends go LIVE: 60s poll + refetch on presence WS events (the old home
  // strip fetched once and quietly went stale for the whole session).
  useEffect(() => {
    const refresh = () => loadFriends();
    refresh();
    const iv = setInterval(refresh, 60_000);
    let t: ReturnType<typeof setTimeout> | null = null;
    const onActivity = () => {
      if (t) clearTimeout(t);
      t = setTimeout(refresh, 800);
    };
    const events = ["weered:presence:join", "weered:presence:leave", "weered:lobby:activity"];
    for (const e of events) window.addEventListener(e, onActivity);
    return () => {
      clearInterval(iv);
      if (t) clearTimeout(t);
      for (const e of events) window.removeEventListener(e, onActivity);
    };
  }, [loadFriends]);

  const online = useMemo(() => (friends || []).filter((u) => u?.online).slice(0, 16), [friends]);
  if (online.length === 0) return null;

  const label: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "1px",
    textTransform: "uppercase",
    color: "rgba(148,163,184,.55)",
    marginBottom: 8,
  };

  return (
    <div
      className="home-pulse"
      style={{
        marginTop: 14,
        display: "flex",
        gap: 14,
        flexWrap: "wrap",
        padding: "14px 16px",
        borderRadius: 2,
        border: "1px solid rgba(255,255,255,.07)",
        background: "linear-gradient(135deg, rgba(88,0,229,.07), rgba(255,255,255,.02))",
      }}
    >
      {online.length > 0 && (
        <div style={{ flex: 1, minWidth: 260 }}>
          <div className="home-pulse-label" style={label}>
            Friends & crew · {online.length} online
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              overflowX: "auto",
              paddingBottom: 4,
              scrollbarWidth: "none",
            }}
          >
            {online.map((u, i) => {
              const name = u?.name || u?.username || "?";
              const href = joinHref(u?.roomId, u?.roomIsLobby);
              const where = u?.roomName || (u?.roomId ? "a room" : "online");
              return (
                <div
                  key={u?.id || i}
                  className="home-pulse-person"
                  style={{
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "7px 10px",
                    borderRadius: 2,
                    background: "rgba(255,255,255,.03)",
                    border: "1px solid rgba(255,255,255,.07)",
                  }}
                >
                  <div
                    onClick={() => onDm(u)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onDm(u);
                    }}
                    style={{ cursor: "pointer" }}
                    title={`DM ${name}`}
                  >
                    <Face name={name} avatar={u?.avatar} color={u?.avatarColor} dim={u?.isAway} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: "rgba(255,255,255,.85)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: 110,
                      }}
                    >
                      {name}
                    </div>
                    <div
                      style={{
                        fontSize: 9.5,
                        color: "rgba(148,163,184,.55)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: 110,
                      }}
                    >
                      {where}
                    </div>
                  </div>
                  {href && (
                    <Link
                      href={href}
                      className="home-pulse-join"
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: ".5px",
                        padding: "4px 9px",
                        borderRadius: 2,
                        textDecoration: "none",
                        color: "#fff",
                        background: "rgba(88,0,229,.35)",
                        border: "1px solid rgba(88,0,229,.55)",
                        flexShrink: 0,
                      }}
                    >
                      JOIN
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
