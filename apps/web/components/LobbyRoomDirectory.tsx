"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWeered } from "./WeeredProvider";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

/* ── Types ───────────────────────────────────────────────────────────────── */

interface RoomUser {
  id?: string;
  name?: string;
  avatar?: string;
}

interface RoomData {
  id: string;
  name: string;
  description?: string;
  locked: boolean;
  ownerId?: string;
  _count?: { members: number };
  onlineCount?: number;
  onlineUsers?: RoomUser[];
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function authHeaders() {
  try {
    const t = localStorage.getItem("weered_token") || "";
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch { return {}; }
}

function roomIcon(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("voice"))    return "🎙";
  if (n.includes("lfg") || n.includes("squad"))  return "🔥";
  if (n.includes("trading") || n.includes("trade"))  return "💱";
  if (n.includes("general"))  return "💬";
  if (n.includes("watch") || n.includes("stream")) return "📺";
  if (n.includes("ranked"))   return "🏆";
  if (n.includes("chill") || n.includes("lounge")) return "🌙";
  if (n.includes("news") || n.includes("feed"))    return "📰";
  if (n.includes("meme") || n.includes("shitpost")) return "🤣";
  if (n.includes("help") || n.includes("support")) return "🛟";
  if (n.includes("music") || n.includes("audio"))  return "🎵";
  if (n.includes("art") || n.includes("creative")) return "🎨";
  if (n.includes("cryo") || n.includes("archive")) return "🧊";
  return "◆";
}

function roomSubtitle(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("voice"))    return "Voice channel";
  if (n.includes("lfg") || n.includes("squad"))  return "Looking for group";
  if (n.includes("trading") || n.includes("trade"))  return "Trading post";
  if (n.includes("general"))  return "General chat";
  if (n.includes("watch") || n.includes("stream")) return "Watch party";
  if (n.includes("ranked"))   return "Competitive";
  if (n.includes("chill") || n.includes("lounge")) return "Chill zone";
  return "Text channel";
}

/* Avatar color from name hash */
const AV_COLORS = ["#5800E5", "#22c55e", "#f97316", "#60a5fa", "#ef4444", "#eab308", "#ec4899", "#14b8a6"];
function avColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return AV_COLORS[Math.abs(h) % AV_COLORS.length];
}

/* Deterministic mesh angle per card */
function meshAngle(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 17 + id.charCodeAt(i)) & 0xffffff;
  return (h % 360);
}

/* ── Component ────────────────────────────────────────────────────────────── */

export default function LobbyRoomDirectory({
  lobbyId,
  accentColor,
  bannerUrl,
  style,
}: {
  lobbyId: string;
  accentColor?: string;
  bannerUrl?: string;
  style?: React.CSSProperties;
}) {
  const router = useRouter();
  const { join } = useWeered() as any;
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lobbyBanner, setLobbyBanner] = useState<string | null>(bannerUrl || null);

  const accent = accentColor || "#5800E5";
  const LIVE_COLOR = "#22c55e";

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/lobbies/${encodeURIComponent(lobbyId)}`, { headers: authHeaders() as any })
      .then(r => r.json())
      .then(j => {
        if (j.ok && j.lobby?.rooms) setRooms(j.lobby.rooms);
        if (j.ok && j.lobby?.bannerUrl && !lobbyBanner) setLobbyBanner(j.lobby.bannerUrl);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [lobbyId]);

  function handleJoin(room: RoomData) {
    try { join?.(`room:${room.id}`); } catch {}
    router.push(`/room/${encodeURIComponent(room.id)}`);
  }

  /* ── Loading ───────────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 80, position: "relative", ...style }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, zIndex: 2 }}>
          <div style={{
            width: 32, height: 32, border: `2px solid ${accent}33`,
            borderTop: `2px solid ${accent}`, borderRadius: "50%",
            animation: "weered-room-spin 0.8s linear infinite",
          }} />
          <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,.3)", letterSpacing: "0.04em" }}>Loading rooms</div>
        </div>
      </div>
    );
  }

  /* ── Empty ─────────────────────────────────────────────────────────────── */
  if (rooms.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 80, gap: 10, position: "relative", ...style }}>
        <div style={{ fontSize: 40, opacity: 0.15, zIndex: 2 }}>🚪</div>
        <div style={{ fontSize: 14, fontWeight: 800, color: "rgba(255,255,255,.25)", zIndex: 2 }}>No rooms yet</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,.15)", zIndex: 2 }}>Create one from the right panel</div>
      </div>
    );
  }

  /* ── Room grid ─────────────────────────────────────────────────────────── */
  return (
    <div style={{ flex: 1, overflowY: "auto", position: "relative", ...style }}>

      {/* ── Blurred banner backdrop ──────────────────────────────────────── */}
      {lobbyBanner && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 0, overflow: "hidden",
          pointerEvents: "none",
        }}>
          <div style={{
            position: "absolute", inset: "-20px",
            backgroundImage: `url(${lobbyBanner})`,
            backgroundSize: "cover", backgroundPosition: "center",
            filter: "blur(40px) saturate(0.6) brightness(0.25)",
            opacity: 0.5,
            transform: "scale(1.1)",
          }} />
          {/* Vignette */}
          <div style={{
            position: "absolute", inset: 0,
            background: "radial-gradient(ellipse at center, transparent 20%, rgba(0,0,0,.7) 100%)",
          }} />
          {/* Bottom fade */}
          <div style={{
            position: "absolute", left: 0, right: 0, bottom: 0, height: "40%",
            background: "linear-gradient(to top, var(--weered-panel2, #0f1117), transparent)",
          }} />
        </div>
      )}

      <div style={{ position: "relative", zIndex: 1, padding: "20px 22px 32px" }}>

        {/* Section header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div style={{
            width: 3, height: 18, borderRadius: 2,
            background: accent,
            boxShadow: `0 0 8px ${accent}55`,
          }} />
          <span style={{
            fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase",
            color: "rgba(255,255,255,.5)",
          }}>
            Rooms
          </span>
          <span style={{
            fontSize: 10, fontFamily: "monospace", fontWeight: 700,
            color: "rgba(255,255,255,.25)",
            background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.08)",
            borderRadius: 99, padding: "2px 10px",
          }}>
            {rooms.length}
          </span>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,.06)" }} />
        </div>

        {/* Grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: 14,
        }}>
          {rooms.map(room => {
            const icon = roomIcon(room.name);
            const subtitle = room.description || roomSubtitle(room.name);
            const memberCount = room._count?.members ?? 0;
            const liveCount = room.onlineCount ?? 0;
            const isLive = liveCount > 0;
            const onlineUsers: RoomUser[] = room.onlineUsers ?? [];

            // Color strategy: live rooms get green, others use lobby accent
            const cardColor = isLive ? LIVE_COLOR : accent;
            const angle = meshAngle(room.id);

            // CSS custom props for hover styles
            const cssVars = {
              "--card-glow": isLive ? "rgba(34,197,94,.15)" : `${accent}18`,
              "--card-border-hover": isLive ? "rgba(34,197,94,.40)" : `${accent}40`,
              "--card-join-bg": isLive ? "rgba(34,197,94,.22)" : `${accent}22`,
              "--card-join-border": isLive ? "rgba(34,197,94,.40)" : `${accent}40`,
            } as React.CSSProperties;

            return (
              <div
                key={room.id}
                onClick={() => handleJoin(room)}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleJoin(room); } }}
                className="weered-room-card"
                style={{
                  position: "relative", overflow: "hidden",
                  borderRadius: 14, cursor: "pointer",
                  border: `1px solid ${cardColor}22`,
                  transition: "all .22s ease",
                  background: "transparent",
                  ...cssVars,
                }}
              >
                {/* ── Gradient mesh background ──────────────────────────── */}
                <div style={{
                  position: "absolute", inset: 0, zIndex: 0,
                  background: [
                    `radial-gradient(ellipse at ${20 + (angle % 40)}% ${15 + (angle % 30)}%, ${cardColor}14 0%, transparent 60%)`,
                    `radial-gradient(ellipse at ${70 + (angle % 20)}% ${75 - (angle % 25)}%, ${cardColor}0c 0%, transparent 55%)`,
                    `linear-gradient(${angle}deg, rgba(255,255,255,.02) 0%, rgba(255,255,255,.005) 100%)`,
                  ].join(", "),
                  transition: "opacity .22s",
                }} />

                {/* ── Glass layer ───────────────────────────────────────── */}
                <div style={{
                  position: "absolute", inset: 0, zIndex: 0,
                  borderRadius: 14,
                  background: "rgba(255,255,255,.02)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                }} />

                {/* Accent top bar */}
                <div style={{
                  position: "relative", zIndex: 1,
                  height: 2,
                  background: isLive
                    ? `linear-gradient(90deg, ${LIVE_COLOR}44, ${LIVE_COLOR}, ${LIVE_COLOR}44)`
                    : `linear-gradient(90deg, ${accent}22, ${accent}77, ${accent}22)`,
                }} />

                <div style={{ position: "relative", zIndex: 1, padding: "16px 18px 18px" }}>

                  {/* ── Row 1: Icon + Name + Status ──────────────────────── */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>

                    {/* Icon box */}
                    <div style={{
                      width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                      background: `linear-gradient(135deg, ${cardColor}1a, ${cardColor}0a)`,
                      border: `1px solid ${cardColor}28`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 20,
                      boxShadow: `0 0 16px ${cardColor}10`,
                    }}>
                      {icon}
                    </div>

                    {/* Name + subtitle */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontWeight: 800, fontSize: 15, lineHeight: 1.25,
                        color: "rgba(243,244,246,.95)", letterSpacing: "-0.3px",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {room.name}
                      </div>
                      <div style={{
                        fontSize: 11, color: "rgba(148,163,184,.45)", marginTop: 3,
                        lineHeight: 1.4,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {subtitle}
                      </div>
                    </div>

                    {/* Status badge */}
                    {isLive ? (
                      <div style={{
                        display: "flex", alignItems: "center", gap: 5,
                        padding: "4px 10px", borderRadius: 99, flexShrink: 0,
                        background: "rgba(34,197,94,.10)", border: "1px solid rgba(34,197,94,.22)",
                        boxShadow: "0 0 12px rgba(34,197,94,.08)",
                      }}>
                        <span style={{
                          width: 6, height: 6, borderRadius: "50%",
                          background: "#22c55e", boxShadow: "0 0 8px #22c55e",
                          animation: "weered-room-pulse 2s ease-in-out infinite",
                        }} />
                        <span style={{
                          fontSize: 11, fontWeight: 700,
                          color: "rgba(134,239,172,.9)", fontFamily: "monospace",
                        }}>
                          {liveCount}
                        </span>
                      </div>
                    ) : room.locked ? (
                      <div style={{
                        fontSize: 10, fontWeight: 700, padding: "4px 10px", borderRadius: 99,
                        background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.15)",
                        color: "rgba(252,165,165,.6)", flexShrink: 0, letterSpacing: "0.02em",
                      }}>
                        🔒 Locked
                      </div>
                    ) : null}
                  </div>

                  {/* ── Row 2: Avatar stack + member count + join ────────── */}
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    paddingTop: 12,
                    borderTop: "1px solid rgba(255,255,255,.04)",
                  }}>

                    {/* Avatar stack + count */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>

                      {onlineUsers.length > 0 && (
                        <div style={{ display: "flex", alignItems: "center" }}>
                          {onlineUsers.slice(0, 4).map((u, i) => {
                            const name = u.name || "?";
                            const color = avColor(name);
                            return (
                              <div
                                key={u.id || i}
                                title={name}
                                style={{
                                  width: 24, height: 24, borderRadius: "50%",
                                  border: "2px solid rgba(15,17,23,.9)",
                                  marginLeft: i === 0 ? 0 : -8,
                                  zIndex: 4 - i,
                                  position: "relative",
                                  overflow: "hidden",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.85)",
                                  background: u.avatar ? "rgba(255,255,255,.08)" : `linear-gradient(135deg, ${color}55, ${color}aa)`,
                                  flexShrink: 0,
                                }}
                              >
                                {u.avatar
                                  ? <img src={u.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                  : name[0]?.toUpperCase() ?? "?"
                                }
                              </div>
                            );
                          })}
                          {liveCount > 4 && (
                            <div style={{
                              width: 24, height: 24, borderRadius: "50%",
                              border: "2px solid rgba(15,17,23,.9)",
                              marginLeft: -8, zIndex: 0,
                              background: "rgba(255,255,255,.06)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,.4)",
                              fontFamily: "monospace",
                            }}>
                              +{liveCount - 4}
                            </div>
                          )}
                        </div>
                      )}

                      <span style={{
                        fontSize: 10, color: "rgba(148,163,184,.35)", fontFamily: "monospace",
                        display: "flex", alignItems: "center", gap: 4,
                      }}>
                        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.5 }}>
                          <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5" />
                          <path d="M2 14c0-3 2.5-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                        {memberCount > 0 ? `${memberCount} joined` : "Empty"}
                      </span>
                    </div>

                    {/* Join button */}
                    <span className="weered-room-join" style={{
                      fontSize: 11, fontWeight: 700, padding: "5px 14px", borderRadius: 8,
                      background: `${cardColor}12`, border: `1px solid ${cardColor}25`,
                      color: "rgba(243,244,246,.7)",
                      transition: "all .18s",
                      letterSpacing: "0.02em",
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

      {/* Animations + hover styles */}
      <style>{`
        @keyframes weered-room-spin { to { transform: rotate(360deg); } }
        @keyframes weered-room-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }

        .weered-room-card {
          will-change: transform, box-shadow;
        }
        .weered-room-card:hover {
          transform: translateY(-3px) !important;
          box-shadow:
            0 16px 40px rgba(0,0,0,.4),
            0 0 30px var(--card-glow, rgba(88,0,229,.12)),
            inset 0 1px 0 rgba(255,255,255,.04) !important;
          border-color: var(--card-border-hover, rgba(88,0,229,.35)) !important;
        }
        .weered-room-card:hover .weered-room-join {
          background: var(--card-join-bg, rgba(88,0,229,.22)) !important;
          color: rgba(255,255,255,.9) !important;
          border-color: var(--card-join-border, rgba(88,0,229,.4)) !important;
        }
      `}</style>
    </div>
  );
}
