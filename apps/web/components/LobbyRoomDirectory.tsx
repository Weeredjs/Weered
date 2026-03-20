"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWeered } from "./WeeredProvider";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

interface RoomData {
  id: string;
  name: string;
  locked: boolean;
  _count?: { members: number };
}

function authHeaders() {
  try {
    const t = localStorage.getItem("weered_token") || "";
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch { return {}; }
}

// Room type icons
function roomIcon(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("voice"))   return "🎙";
  if (n.includes("lfg"))     return "🔥";
  if (n.includes("trading")) return "💱";
  if (n.includes("general")) return "💬";
  if (n.includes("watch"))   return "📺";
  if (n.includes("bug"))     return "🐛";
  if (n.includes("drop"))    return "🔔";
  if (n.includes("alpha"))   return "📈";
  if (n.includes("season"))  return "📅";
  if (n.includes("fight"))   return "🥊";
  return "◆";
}

function roomAccent(name: string, lobbyAccent?: string): string {
  const n = name.toLowerCase();
  if (n.includes("voice"))   return "#22c55e";
  if (n.includes("lfg"))     return "#f97316";
  if (n.includes("general")) return lobbyAccent || "#7c6af7";
  return lobbyAccent || "#a78bfa";
}

export default function LobbyRoomDirectory({
  lobbyId,
  accentColor,
  style,
}: {
  lobbyId: string;
  accentColor?: string;
  style?: React.CSSProperties;
}) {
  const router = useRouter();
  const { users, join } = useWeered() as any;
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [loading, setLoading] = useState(true);

  const accent = accentColor || "#7c6af7";

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/lobbies/${encodeURIComponent(lobbyId)}`, { headers: authHeaders() as any })
      .then(r => r.json())
      .then(j => {
        if (j.ok && j.lobby?.rooms) setRooms(j.lobby.rooms);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [lobbyId]);

  // Get online counts from WS presence
  const onlineCounts: Record<string, number> = {};
  if (users && typeof users === "object") {
    // users might be an array of users with roomId, or usersByRoom map
    if (Array.isArray(users)) {
      for (const u of users) {
        const rid = u?.roomId || u?.room;
        if (rid) onlineCounts[rid] = (onlineCounts[rid] || 0) + 1;
      }
    }
  }

  function handleJoin(room: RoomData) {
    try { join?.(`room:${room.id}`); } catch {}
    router.push(`/room/${encodeURIComponent(room.id)}`);
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60, ...style }}>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,.3)" }}>Loading rooms...</div>
      </div>
    );
  }

  if (rooms.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 60, gap: 8, ...style }}>
        <div style={{ fontSize: 32, opacity: 0.2 }}>🚪</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,.3)" }}>No rooms yet</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,.2)" }}>Create one from the right panel</div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px 24px", ...style }}>

      {/* Section header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, marginBottom: 16,
      }}>
        <div style={{
          width: 4, height: 16, borderRadius: 2,
          background: `linear-gradient(180deg, ${accent}, ${accent}55)`,
        }} />
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,.5)" }}>
          Rooms
        </span>
        <span style={{
          fontSize: 10, fontFamily: "monospace", color: "rgba(255,255,255,.25)",
          background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.07)",
          borderRadius: 99, padding: "1px 8px",
        }}>
          {rooms.length}
        </span>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,.05)" }} />
      </div>

      {/* Room grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
        {rooms.map(room => {
          const icon = roomIcon(room.name);
          const rAccent = roomAccent(room.name, accent);
          const memberCount = room._count?.members ?? 0;
          const liveCount = onlineCounts[room.id] ?? 0;
          const isVoice = room.name.toLowerCase().includes("voice");
          const isLfg = room.name.toLowerCase().includes("lfg");

          return (
            <div
              key={room.id}
              onClick={() => handleJoin(room)}
              style={{
                position: "relative", overflow: "hidden",
                borderRadius: 12, cursor: "pointer",
                background: "rgba(255,255,255,.025)",
                border: `1px solid rgba(255,255,255,.06)`,
                transition: "all .2s",
              }}
              onMouseEnter={e => {
                const el = e.currentTarget;
                el.style.borderColor = `${rAccent}40`;
                el.style.transform = "translateY(-2px)";
                el.style.boxShadow = `0 8px 24px rgba(0,0,0,.3), inset 0 1px 0 ${rAccent}15`;
              }}
              onMouseLeave={e => {
                const el = e.currentTarget;
                el.style.borderColor = "rgba(255,255,255,.06)";
                el.style.transform = "translateY(0)";
                el.style.boxShadow = "none";
              }}
            >
              {/* Accent top edge */}
              <div style={{
                height: 2, background: `linear-gradient(90deg, ${rAccent}44, ${rAccent}, ${rAccent}44)`,
              }} />

              <div style={{ padding: "14px 16px 16px" }}>
                {/* Top row: icon + name + status */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  {/* Icon pill */}
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: `${rAccent}12`, border: `1px solid ${rAccent}22`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 16,
                  }}>
                    {icon}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: 800, fontSize: 14, lineHeight: 1.2,
                      color: "rgba(243,244,246,.95)", letterSpacing: "-0.2px",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {room.name}
                    </div>
                    <div style={{
                      fontSize: 10, color: "rgba(148,163,184,.45)", marginTop: 2,
                      fontFamily: "monospace",
                    }}>
                      {isVoice ? "Voice channel" : isLfg ? "Looking for group" : "Text channel"}
                    </div>
                  </div>

                  {/* Live indicator */}
                  {liveCount > 0 ? (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 4,
                      padding: "3px 8px", borderRadius: 99,
                      background: "rgba(34,197,94,.10)", border: "1px solid rgba(34,197,94,.20)",
                    }}>
                      <span style={{
                        width: 5, height: 5, borderRadius: "50%",
                        background: "#22c55e", boxShadow: "0 0 6px #22c55e",
                      }} />
                      <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(134,239,172,.9)", fontFamily: "monospace" }}>
                        {liveCount}
                      </span>
                    </div>
                  ) : room.locked ? (
                    <div style={{
                      fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 99,
                      background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.18)",
                      color: "rgba(252,165,165,.7)",
                    }}>
                      🔒 Locked
                    </div>
                  ) : null}
                </div>

                {/* Bottom row: member count + join hint */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {memberCount > 0 && (
                      <span style={{
                        fontSize: 10, color: "rgba(148,163,184,.4)", fontFamily: "monospace",
                        display: "flex", alignItems: "center", gap: 3,
                      }}>
                        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.5 }}>
                          <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5" />
                          <path d="M2 14c0-3 2.5-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                        {memberCount} joined
                      </span>
                    )}
                  </div>

                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 6,
                    background: `${rAccent}10`, border: `1px solid ${rAccent}18`,
                    color: rAccent, opacity: 0.7,
                    transition: "opacity .15s",
                  }}>
                    Join →
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
