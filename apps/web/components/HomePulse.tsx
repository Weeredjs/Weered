"use client";

// Home's Mplayer moment, done the home way: PEOPLE are the doors. Home rooms
// stay hidden from the canvas (you reach them by joining a friend who's
// there); what home shows is who's around — the live Home Lobby roster (from
// the WS presence you're already in) and your friends/crew with where they
// are and a one-click Join. No room directory here, by design.

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

type HomeRoom = {
  id: string;
  name: string;
  onlineCount?: number;
  onlineUsers?: { id: string; name?: string; avatar?: string | null }[];
  lastMessageAt?: string | null;
};

function timeAgo(iso?: string | null): string | null {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return null;
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 90) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`;
  return null;
}

export default function HomePulse({
  homeUsers: _homeUsers,
  onDm,
}: {
  homeUsers: any[];
  onDm: (u: any) => void;
}) {
  const [friends, setFriends] = useState<any[]>([]);
  const [rooms, setRooms] = useState<HomeRoom[]>([]);

  // The Home Lobby's rooms — the hidden pool you're already inside once you're
  // on /home. Listed here (not as a browsable directory) so people who made it
  // through the door can actually see where to go.
  const loadRooms = useCallback(() => {
    fetch(`${API}/lobbies/lobby/rooms`, { headers: authHeaders() as any })
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok && Array.isArray(j.rooms)) setRooms(j.rooms);
      })
      .catch(() => {});
  }, []);

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
    const refresh = () => {
      loadFriends();
      loadRooms();
    };
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
  }, [loadFriends, loadRooms]);

  const online = useMemo(() => (friends || []).filter((u) => u?.online).slice(0, 16), [friends]);
  // Live rooms first, then most recently active.
  const sortedRooms = useMemo(
    () =>
      [...rooms].sort((a, b) => {
        const live = (b.onlineCount ?? 0) - (a.onlineCount ?? 0);
        if (live !== 0) return live;
        const ra = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0;
        const rb = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0;
        return rb - ra;
      }),
    [rooms],
  );

  if (sortedRooms.length === 0 && online.length === 0) return null;

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
      {sortedRooms.length > 0 && (
        <div style={{ minWidth: 210, maxWidth: 320 }}>
          <div style={label}>Home rooms · {sortedRooms.length}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {sortedRooms.slice(0, 4).map((r) => {
              const live = r.onlineCount ?? 0;
              const ago = live > 0 ? null : timeAgo(r.lastMessageAt);
              return (
                <Link
                  key={r.id}
                  href={`/room/${encodeURIComponent(r.id)}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 9px",
                    borderRadius: 2,
                    textDecoration: "none",
                    background: "rgba(255,255,255,.03)",
                    border: `1px solid ${live > 0 ? "rgba(34,197,94,.28)" : "rgba(255,255,255,.07)"}`,
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      flexShrink: 0,
                      background: live > 0 ? "#22c55e" : "rgba(148,163,184,.3)",
                      boxShadow: live > 0 ? "0 0 6px #22c55e88" : "none",
                    }}
                  />
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: "rgba(243,244,246,.88)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    {r.name}
                  </span>
                  <span
                    style={{
                      fontSize: 9.5,
                      fontFamily: "monospace",
                      color: live > 0 ? "rgba(34,197,94,.85)" : "rgba(148,163,184,.45)",
                      flexShrink: 0,
                    }}
                  >
                    {live > 0 ? `${live} here` : ago ? ago : "quiet"}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {online.length > 0 && (
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={label}>Friends & crew · {online.length} online</div>
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
