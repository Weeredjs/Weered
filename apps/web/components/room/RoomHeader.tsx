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

// ── Accent per module ────────────────────────────────────────────────────────

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

function AvatarStack({ users, max = 5 }: { users: any[]; max?: number }) {
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
              width: 22, height: 22, borderRadius: "50%",
              border: "2px solid rgba(10,10,18,0.95)",
              marginLeft: i > 0 ? -6 : 0,
              background: bg,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 9, fontWeight: 800, color: "#fff",
              overflow: "hidden", position: "relative", zIndex: max - i,
            }}
          >
            {avatar
              ? <img src={avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : name[0]?.toUpperCase() ?? "?"
            }
          </div>
        );
      })}
      {overflow > 0 && (
        <div style={{
          width: 22, height: 22, borderRadius: "50%",
          border: "2px solid rgba(10,10,18,0.95)",
          marginLeft: -6, zIndex: 0,
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
  showDetails?: boolean;
}) {
  const activeModule = pills?.find(p => p.active);
  const activeAccent = activeModule ? getAccent(activeModule.id) : "#5800E5";
  const userArr = Array.isArray(users) ? users : [];

  return (
    <div style={{
      flexShrink: 0, position: "relative", overflow: "hidden",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
    }}>
      {/* ── Ambient layers ── */}

      {/* Thumbnail wash */}
      {thumbnail && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 0,
          backgroundImage: `url(${thumbnail})`,
          backgroundSize: "cover", backgroundPosition: "center",
          opacity: 0.1,
          filter: "blur(16px) saturate(1.6)",
          transform: "scale(1.15)",
          pointerEvents: "none",
        }} />
      )}

      {/* Gradient base */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
        background: activeModule
          ? `linear-gradient(135deg, ${activeAccent}08 0%, rgba(10,10,18,0) 50%, ${activeAccent}04 100%)`
          : "linear-gradient(135deg, rgba(88,0,229,0.04) 0%, rgba(10,10,18,0) 60%)",
      }} />

      {/* Soft glow — follows active module accent */}
      <div style={{
        position: "absolute", top: -20, left: 40, width: 120, height: 80,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${activeAccent}10 0%, transparent 70%)`,
        pointerEvents: "none", zIndex: 0,
      }} />

      {/* Bottom edge glow */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 1,
        background: `linear-gradient(90deg, transparent 5%, ${activeAccent}30 30%, ${activeAccent}18 70%, transparent 95%)`,
        zIndex: 2,
      }} />

      {/* ── Row 1: Identity + Status ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 16px 0",
        position: "relative", zIndex: 1,
      }}>
        {/* Lobby logo */}
        {lobbyLogo && (
          <img src={lobbyLogo} alt="" style={{
            width: 20, height: 20, borderRadius: 5,
            objectFit: "contain", background: "rgba(0,0,0,.3)",
            flexShrink: 0,
          }} />
        )}

        {/* Room name + lobby context */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{
            fontSize: 14, fontWeight: 800, letterSpacing: "-0.3px",
            color: "rgba(243,244,246,0.95)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            margin: 0, lineHeight: 1.2,
          }}>
            {title}
          </h1>
          {lobbyName && (
            <div style={{
              fontSize: 10, color: "rgba(148,163,184,0.4)",
              marginTop: 1, fontWeight: 500,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {lobbyName}
            </div>
          )}
        </div>

        {/* Status badges */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {locked && (
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
              padding: "3px 8px", borderRadius: 6,
              border: "1px solid rgba(251,191,36,0.15)",
              background: "rgba(251,191,36,0.06)",
              color: "rgba(252,211,77,0.55)",
            }}>
              🔒
            </span>
          )}

          {/* Avatar stack + count */}
          {userArr.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <AvatarStack users={userArr} max={4} />
              <span style={{
                fontSize: 10, fontWeight: 700, color: "rgba(134,239,172,0.7)",
                fontFamily: "monospace",
              }}>
                {memberCount ?? userArr.length}
              </span>
            </div>
          )}
          {userArr.length === 0 && typeof memberCount === "number" && (
            <div style={{
              display: "flex", alignItems: "center", gap: 5,
              fontSize: 10, color: "rgba(255,255,255,0.35)",
            }}>
              <span style={{
                width: 5, height: 5, borderRadius: "50%",
                background: "#4ade80",
                boxShadow: "0 0 6px rgba(74,222,128,0.5)",
              }} />
              {memberCount}
            </div>
          )}

          {/* Dock button */}
          <button
            type="button"
            onClick={() => { try { window.dispatchEvent(new CustomEvent("weered:dock:toggle")); } catch {} }}
            style={{
              fontSize: 10, fontWeight: 700,
              padding: "4px 10px", borderRadius: 6,
              border: "1px solid rgba(255,255,255,0.07)",
              background: "rgba(255,255,255,0.03)",
              color: "rgba(255,255,255,0.35)",
              cursor: "pointer", transition: "all 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.color = "rgba(255,255,255,0.7)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.color = "rgba(255,255,255,0.35)"; }}
          >
            Dock
          </button>
        </div>
      </div>

      {/* ── Row 2: Module pills ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: "6px 16px 8px",
        position: "relative", zIndex: 1,
        overflowX: "auto", scrollbarWidth: "none",
      }}>
        {pills && pills.map((m) => {
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
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "4px 10px", borderRadius: 6,
                fontSize: 10, fontWeight: 700, letterSpacing: "0.03em",
                cursor: m.live ? "pointer" : "default",
                transition: "all 0.15s ease",
                whiteSpace: "nowrap", flexShrink: 0,
                border: m.active
                  ? `1px solid ${accent}66`
                  : m.live
                    ? "1px solid rgba(255,255,255,0.06)"
                    : "1px solid rgba(255,255,255,0.03)",
                background: m.active
                  ? `${accent}18`
                  : "transparent",
                color: m.active
                  ? "#fff"
                  : m.live
                    ? "rgba(226,232,240,0.5)"
                    : "rgba(255,255,255,0.15)",
                boxShadow: m.active ? `0 0 12px ${accent}25` : "none",
              }}
              onMouseEnter={e => {
                if (!m.live || m.active) return;
                e.currentTarget.style.background = `${accent}0c`;
                e.currentTarget.style.borderColor = `${accent}30`;
                e.currentTarget.style.color = "rgba(226,232,240,0.8)";
              }}
              onMouseLeave={e => {
                if (!m.live || m.active) return;
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                e.currentTarget.style.color = "rgba(226,232,240,0.5)";
              }}
            >
              {isTwitch ? (
                <TwitchIcon size={11} color={m.active ? "#9146FF" : m.live ? "rgba(145,70,255,0.6)" : "rgba(255,255,255,0.15)"} />
              ) : isYT ? (
                <YouTubeIcon size={12} color={m.active ? "#FF0000" : m.live ? "rgba(255,0,0,0.5)" : "rgba(255,255,255,0.15)"} />
              ) : (
                <span style={{ fontSize: 10, lineHeight: 1 }}>{m.icon}</span>
              )}
              {m.label}
              {m.active && (
                <span style={{
                  width: 4, height: 4, borderRadius: "50%",
                  background: accent,
                  boxShadow: `0 0 6px ${accent}`,
                  marginLeft: 2,
                }} />
              )}
              {!m.live && !m.active && (
                <span style={{
                  fontSize: 7, fontWeight: 700, letterSpacing: "0.06em",
                  padding: "1px 4px", borderRadius: 3,
                  background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.18)",
                  textTransform: "uppercase",
                }}>SOON</span>
              )}
            </button>
          );
        })}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Details toggle */}
        {onDetailsClick && (
          <button
            type="button"
            onClick={onDetailsClick}
            style={{
              display: "inline-flex", alignItems: "center", gap: 3,
              padding: "4px 10px", borderRadius: 6,
              fontSize: 10, fontWeight: 700,
              cursor: "pointer", transition: "all 0.15s ease",
              flexShrink: 0,
              border: showDetails ? "1px solid rgba(255,255,255,0.15)" : "1px solid rgba(255,255,255,0.05)",
              background: showDetails ? "rgba(255,255,255,0.06)" : "transparent",
              color: showDetails ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.2)",
            }}
            onMouseEnter={e => { if (!showDetails) { e.currentTarget.style.color = "rgba(255,255,255,0.45)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}}
            onMouseLeave={e => { if (!showDetails) { e.currentTarget.style.color = "rgba(255,255,255,0.2)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)"; }}}
          >
            {showDetails ? "✕" : "⋯"}
          </button>
        )}
      </div>
    </div>
  );
}
