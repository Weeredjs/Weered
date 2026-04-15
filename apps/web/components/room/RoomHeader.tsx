"use client";

import React from "react";
import { avatarBg } from "../../lib/avatarColor";

export type RoomTab = "chat" | "media" | "activity" | "details";

export type ModulePill = {
  id: string;
  label: string;
  icon: string;
  live: boolean;
  active: boolean;
};

// ── Inline brand icons ───────────────────────────────────────────────────────

function TwitchIcon({ size = 13, color = "#9146FF" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 268" style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}>
      <path d="M17.458 0L0 46.556v185.81h63.983v34.934h34.932l34.898-34.934h52.36L256 162.954V0H17.458zm23.259 23.263H232.73v128.029l-40.739 40.736H128L93.113 226.93v-34.902H40.717V23.263zm64.008 116.405H128V69.844h-23.275v69.824zm63.997 0h23.275V69.844h-23.275v69.824z" fill={color} />
    </svg>
  );
}

function YouTubeIcon({ size = 15, color = "#FF0000" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={Math.round(size * 0.72)} viewBox="0 0 159 110" style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}>
      <path d="M154 17.5c-1.82-6.73-7.07-12-13.8-13.8C128.04 0 79.5 0 79.5 0S30.96 0 18.8 3.7C12.07 5.5 6.82 10.77 5 17.5 1.3 29.66 1.3 55 1.3 55s0 25.34 3.7 37.5c1.82 6.73 7.07 12 13.8 13.8C30.96 110 79.5 110 79.5 110s48.54 0 60.7-3.7c6.73-1.82 12-7.07 13.8-13.8 3.7-12.16 3.7-37.5 3.7-37.5s0-25.34-3.7-37.5z" fill={color} />
      <path d="M64 78.8V31.2L105 55 64 78.8z" fill="#fff" />
    </svg>
  );
}

function getAccent(id: string): string {
  switch (id) {
    case "twitch":  return "#9146FF";
    case "youtube": return "#FF0000";
    case "voice":   return "#22c55e";
    case "browser": return "#38bdf8";
    default:        return "#5800E5";
  }
}

// ── Avatar stack ─────────────────────────────────────────────────────────────

function AvatarStack({ users, max = 4 }: { users: any[]; max?: number }) {
  const shown = users.slice(0, max);
  const overflow = users.length - max;
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {shown.map((u, i) => {
        const name = u?.name || u?.username || "?";
        const avatar = u?.avatar || null;
        const bg = avatar ? "rgba(255,255,255,.08)" : avatarBg(name);
        return (
          <div
            key={u?.id || i}
            title={name}
            style={{
              width: 24, height: 24, borderRadius: "50%",
              border: "2px solid rgba(10,10,18,0.95)",
              marginLeft: i > 0 ? -7 : 0,
              background: bg,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 9, fontWeight: 800, color: "#fff",
              overflow: "hidden", position: "relative", zIndex: max - i,
            }}
          >
            {avatar
              ? <img src={avatar} alt={name + " avatar"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : name[0]?.toUpperCase() ?? "?"
            }
          </div>
        );
      })}
      {overflow > 0 && (
        <div style={{
          width: 24, height: 24, borderRadius: "50%",
          border: "2px solid rgba(10,10,18,0.95)",
          marginLeft: -7, zIndex: 0,
          background: "rgba(255,255,255,.06)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 8, fontWeight: 700, color: "rgba(255,255,255,.4)",
          fontFamily: "monospace",
        }}>
          +{overflow}
        </div>
      )}
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export default function RoomHeader({
  title,
  memberCount,
  locked,
  thumbnail,
  pills,
  users,
  lobbyName,
  lobbyLogo,
  onPillClick,
  onDetailsClick,
  onLeave,
  showDetails,
}: {
  title: string;
  memberCount?: number;
  locked?: boolean;
  thumbnail?: string | null;
  pills?: ModulePill[];
  users?: any[];
  lobbyName?: string | null;
  lobbyLogo?: string | null;
  onPillClick?: (id: string) => void;
  onDetailsClick?: () => void;
  onLeave?: () => void;
  showDetails?: boolean;
}) {
  const activeModule = pills?.find(p => p.active);
  const activeAccent = activeModule ? getAccent(activeModule.id) : "#5800E5";
  const userArr = Array.isArray(users) ? users : [];
  const count = memberCount ?? userArr.length;

  return (
    <div style={{
      flexShrink: 0, position: "relative", overflow: "hidden",
      borderBottom: "1px solid rgba(255,255,255,0.05)",
      background: "rgba(10,10,18,0.6)",
    }}>
      {/* ── Ambient layers ── */}

      {/* Thumbnail wash */}
      {thumbnail && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 0,
          backgroundImage: `url(${thumbnail})`,
          backgroundSize: "cover", backgroundPosition: "center",
          opacity: 0.08,
          filter: "blur(20px) saturate(1.8)",
          transform: "scale(1.2)",
          pointerEvents: "none",
        }} />
      )}

      {/* Gradient base */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
        background: "linear-gradient(180deg, rgba(10,10,18,0.2) 0%, rgba(10,10,18,0.65) 100%)",
      }} />

      {/* Accent wash — visible color tint from active module */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
        background: activeModule
          ? `linear-gradient(135deg, ${activeAccent}18 0%, ${activeAccent}08 35%, transparent 60%, ${activeAccent}06 100%)`
          : "linear-gradient(135deg, rgba(88,0,229,0.06) 0%, transparent 60%)",
        transition: "background 0.4s ease",
      }} />

      {/* Accent glow orb — top-left radial */}
      <div style={{
        position: "absolute", top: -15, left: 30, width: 160, height: 80,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${activeAccent}20 0%, ${activeAccent}08 40%, transparent 70%)`,
        pointerEvents: "none", zIndex: 0,
        transition: "background 0.4s ease",
      }} />

      {/* Noise texture */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
        opacity: 0.015,
        backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
        backgroundSize: "16px 16px",
      }} />

      {/* Bottom edge glow — thicker, more visible */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent 2%, ${activeAccent}50 20%, ${activeAccent}35 50%, ${activeAccent}50 80%, transparent 98%)`,
        zIndex: 3,
        transition: "background 0.4s ease",
        boxShadow: `0 0 12px ${activeAccent}25, 0 0 4px ${activeAccent}15`,
      }} />

      {/* ── Content ── */}
      <div style={{ position: "relative", zIndex: 1, padding: "10px 16px 8px" }}>

        {/* ── Row 1: Identity bar ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>

          {/* Lobby logo + room identity */}
          <div style={{ display: "flex", alignItems: "center", gap: 9, flex: 1, minWidth: 0 }}>
            {lobbyLogo ? (
              <div style={{
                width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                background: "rgba(0,0,0,.4)",
                border: "1px solid rgba(255,255,255,.06)",
                display: "flex", alignItems: "center", justifyContent: "center",
                overflow: "hidden",
              }}>
                <img src={lobbyLogo} alt={(lobbyName || "Lobby") + " logo"} style={{ width: 22, height: 22, objectFit: "contain" }} />
              </div>
            ) : (
              <div style={{
                width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                background: `${activeAccent}12`,
                border: `1px solid ${activeAccent}18`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 900, color: activeAccent,
              }}>
                {title.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <h1 style={{
                  fontSize: 15, fontWeight: 900, letterSpacing: "-0.4px",
                  color: "rgba(243,244,246,0.97)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  margin: 0, lineHeight: 1.2,
                }}>
                  {title}
                </h1>
                {locked && (
                  <span style={{ fontSize: 10, opacity: 0.4, flexShrink: 0 }}>🔒</span>
                )}
              </div>
              {lobbyName && (
                <div style={{
                  fontSize: 10, color: "rgba(148,163,184,0.35)",
                  marginTop: 1, fontWeight: 500,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {lobbyName}
                </div>
              )}
            </div>
          </div>

          {/* Right cluster */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>

            {/* People block */}
            <div style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "4px 10px 4px 5px",
              borderRadius: 10,
              background: "rgba(255,255,255,.02)",
              border: "1px solid rgba(255,255,255,.05)",
            }}>
              {userArr.length > 0 ? (
                <AvatarStack users={userArr} max={4} />
              ) : (
                <span style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: count > 0 ? "#4ade80" : "rgba(255,255,255,.12)",
                  boxShadow: count > 0 ? "0 0 6px rgba(74,222,128,0.5)" : "none",
                }} />
              )}
              <span style={{
                fontSize: 11, fontWeight: 700,
                color: count > 0 ? "rgba(134,239,172,0.8)" : "rgba(255,255,255,.25)",
                fontFamily: "monospace",
              }}>
                {count}
              </span>
            </div>

            {/* Details toggle */}
            {onDetailsClick && (
              <button
                type="button"
                onClick={onDetailsClick}
                title={showDetails ? "Close details" : "Room details"}
                style={{
                  width: 28, height: 28, borderRadius: 7,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, cursor: "pointer", transition: "all 0.15s",
                  border: showDetails ? "1px solid rgba(255,255,255,.15)" : "1px solid rgba(255,255,255,.06)",
                  background: showDetails ? "rgba(255,255,255,.07)" : "rgba(255,255,255,.02)",
                  color: showDetails ? "rgba(255,255,255,.6)" : "rgba(255,255,255,.22)",
                }}
                onMouseEnter={e => { if (!showDetails) { e.currentTarget.style.background = "rgba(255,255,255,.05)"; e.currentTarget.style.color = "rgba(255,255,255,.45)"; } }}
                onMouseLeave={e => { if (!showDetails) { e.currentTarget.style.background = "rgba(255,255,255,.02)"; e.currentTarget.style.color = "rgba(255,255,255,.22)"; } }}
              >
                {showDetails ? "✕" : "⋯"}
              </button>
            )}

            {/* Leave button */}
            {onLeave && (
              <button
                type="button"
                onClick={onLeave}
                title="Leave room"
                style={{
                  height: 28, borderRadius: 7,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  gap: 4, padding: "0 10px",
                  fontSize: 10, fontWeight: 700, cursor: "pointer", transition: "all 0.15s",
                  border: "1px solid rgba(239,68,68,.12)",
                  background: "rgba(239,68,68,.05)",
                  color: "rgba(252,165,165,.45)",
                  letterSpacing: "0.03em",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,.12)"; e.currentTarget.style.color = "rgba(252,165,165,.85)"; e.currentTarget.style.borderColor = "rgba(239,68,68,.28)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(239,68,68,.05)"; e.currentTarget.style.color = "rgba(252,165,165,.45)"; e.currentTarget.style.borderColor = "rgba(239,68,68,.12)"; }}
              >
                Leave
              </button>
            )}
          </div>
        </div>

        {/* ── Row 2: Module controls ── */}
        {pills && pills.length > 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 4,
            overflowX: "auto", scrollbarWidth: "none",
            padding: "2px 0 2px",
          }}>
            {pills.map((m) => {
              const isTwitch = m.icon === "__twitch__";
              const isYT     = m.icon === "__youtube__";
              const accent   = getAccent(m.id);

              return (
                <button
                  key={m.id}
                  type="button"
                  disabled={!m.live}
                  onClick={() => m.live && onPillClick?.(m.id)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "5px 12px", borderRadius: 7,
                    fontSize: 11, fontWeight: 700, letterSpacing: "0.02em",
                    cursor: m.live ? "pointer" : "default",
                    transition: "all 0.15s ease",
                    whiteSpace: "nowrap", flexShrink: 0,
                    border: m.active
                      ? `1px solid ${accent}55`
                      : m.live
                        ? "1px solid rgba(255,255,255,0.06)"
                        : "1px solid rgba(255,255,255,0.03)",
                    background: m.active
                      ? `${accent}15`
                      : m.live
                        ? "rgba(255,255,255,0.02)"
                        : "transparent",
                    color: m.active
                      ? "rgba(255,255,255,.92)"
                      : m.live
                        ? "rgba(226,232,240,0.5)"
                        : "rgba(255,255,255,0.14)",
                    boxShadow: m.active ? `0 0 16px ${accent}20, inset 0 0 12px ${accent}08` : "none",
                  }}
                  onMouseEnter={e => {
                    if (!m.live || m.active) return;
                    e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                    e.currentTarget.style.borderColor = `${accent}25`;
                    e.currentTarget.style.color = "rgba(226,232,240,0.8)";
                  }}
                  onMouseLeave={e => {
                    if (!m.live || m.active) return;
                    e.currentTarget.style.background = "rgba(255,255,255,0.02)";
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                    e.currentTarget.style.color = "rgba(226,232,240,0.5)";
                  }}
                >
                  {isTwitch ? (
                    <TwitchIcon size={12} color={m.active ? "#9146FF" : m.live ? "rgba(145,70,255,0.55)" : "rgba(255,255,255,0.14)"} />
                  ) : isYT ? (
                    <YouTubeIcon size={13} color={m.active ? "#FF0000" : m.live ? "rgba(255,0,0,0.45)" : "rgba(255,255,255,0.14)"} />
                  ) : (
                    <span style={{ fontSize: 11, lineHeight: 1 }}>{m.icon}</span>
                  )}
                  {m.label}
                  {m.active && (
                    <span style={{
                      width: 5, height: 5, borderRadius: "50%",
                      background: accent,
                      boxShadow: `0 0 8px ${accent}`,
                    }} />
                  )}
                  {!m.live && !m.active && (
                    <span style={{
                      fontSize: 7, fontWeight: 700,
                      padding: "1px 4px", borderRadius: 3,
                      background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.16)",
                      textTransform: "uppercase", letterSpacing: "0.05em",
                    }}>SOON</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
