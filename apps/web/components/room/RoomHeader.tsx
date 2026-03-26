"use client";

import React from "react";

export type RoomTab = "chat" | "media" | "activity" | "details";

export type ModulePill = {
  id: string;
  label: string;
  icon: string;
  live: boolean;
  active: boolean;
};

// ── Inline brand icons (same as RoomCanvas) ──────────────────────────────────

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

// ── Accent color per module ──────────────────────────────────────────────────

function getAccent(id: string): string {
  switch (id) {
    case "twitch":  return "#9146FF";
    case "youtube": return "#FF0000";
    case "voice":   return "#22c55e";
    case "browser": return "#38bdf8";
    default:        return "#7C3AED";
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export default function RoomHeader({
  title,
  memberCount,
  locked,
  thumbnail,
  pills,
  onPillClick,
  onDetailsClick,
  showDetails,
}: {
  title: string;
  memberCount?: number;
  locked?: boolean;
  thumbnail?: string | null;
  pills?: ModulePill[];
  onPillClick?: (id: string) => void;
  onDetailsClick?: () => void;
  showDetails?: boolean;
}) {
  return (
    <div style={{
      flexShrink: 0, position: "relative", overflow: "hidden",
      borderBottom: "1px solid rgba(255,255,255,0.07)",
      background: "linear-gradient(180deg, rgba(88,0,229,0.06) 0%, rgba(10,10,18,0) 100%)",
    }}>
      {/* Faded thumbnail background */}
      {thumbnail && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 0,
          backgroundImage: `url(${thumbnail})`,
          backgroundSize: "cover", backgroundPosition: "center",
          opacity: 0.18,
          filter: "blur(10px) saturate(1.5)",
          transform: "scale(1.08)",
          pointerEvents: "none",
        }} />
      )}

      {/* Subtle accent glow top-left */}
      <div style={{
        position: "absolute", top: -30, left: -20, width: 180, height: 100,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(88,0,229,0.12) 0%, transparent 70%)",
        pointerEvents: "none", zIndex: 0,
      }} />

      {/* Bottom accent line */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 1,
        background: "linear-gradient(90deg, transparent, rgba(88,0,229,0.3), transparent)",
        zIndex: 2,
      }} />

      {/* ── Main header row ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "0 16px", height: 46,
        position: "relative", zIndex: 1,
      }}>
        <h1 style={{
          fontSize: 15, fontWeight: 800, letterSpacing: "-0.3px",
          color: "rgba(243,244,246,0.95)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          maxWidth: "50%", margin: 0, lineHeight: 1,
        }}>
          {title}
        </h1>

        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
          textTransform: "uppercase",
          padding: "3px 8px", borderRadius: 999,
          border: "1px solid rgba(88,0,229,0.3)",
          background: "rgba(88,0,229,0.1)",
          color: "rgba(167,139,250,0.6)",
          flexShrink: 0,
        }}>
          ROOM
        </span>

        {locked && (
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: "0.08em",
            textTransform: "uppercase",
            padding: "3px 8px", borderRadius: 999,
            border: "1px solid rgba(251,191,36,0.2)",
            background: "rgba(251,191,36,0.05)",
            color: "rgba(252,211,77,0.6)",
            flexShrink: 0,
          }}>
            🔒 LOCKED
          </span>
        )}

        {typeof memberCount === "number" && (
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            fontSize: 11, color: "rgba(255,255,255,0.4)", flexShrink: 0,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%",
              background: "#4ade80",
              boxShadow: "0 0 6px rgba(74,222,128,0.6)",
            }} />
            {memberCount} online
          </div>
        )}

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <button
            type="button"
            onClick={() => {
              try { window.dispatchEvent(new CustomEvent("weered:dock:toggle")); } catch {}
            }}
            style={{
              fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
              padding: "5px 14px", borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.04)",
              color: "rgba(255,255,255,0.55)",
              cursor: "pointer", transition: "all 0.15s",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "rgba(255,255,255,0.08)";
              e.currentTarget.style.color = "rgba(255,255,255,0.85)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "rgba(255,255,255,0.04)";
              e.currentTarget.style.color = "rgba(255,255,255,0.55)";
            }}
          >
            Dock
          </button>
        </div>
      </div>

      {/* ── Module pills row ── */}
      {pills && pills.length > 0 && (
        <div style={{
          display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6,
          padding: "0 16px 10px",
          position: "relative", zIndex: 1,
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
                  padding: "6px 14px", borderRadius: 999,
                  fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
                  fontFamily: "monospace", cursor: m.live ? "pointer" : "default",
                  transition: "all 0.15s ease",
                  border: m.active
                    ? `1px solid ${accent}88`
                    : m.live
                      ? `1px solid ${accent}30`
                      : "1px solid rgba(255,255,255,0.06)",
                  background: m.active
                    ? `${accent}22`
                    : m.live
                      ? `${accent}0a`
                      : "rgba(255,255,255,0.02)",
                  color: m.active
                    ? "#fff"
                    : m.live
                      ? "rgba(226,232,240,0.65)"
                      : "rgba(255,255,255,0.18)",
                  boxShadow: m.active ? `0 0 14px ${accent}35, 0 0 4px ${accent}20` : "none",
                }}
                onMouseEnter={e => {
                  if (!m.live || m.active) return;
                  const el = e.currentTarget;
                  el.style.background = `${accent}18`;
                  el.style.borderColor = `${accent}50`;
                  el.style.color = "rgba(226,232,240,0.9)";
                  el.style.boxShadow = `0 0 10px ${accent}20`;
                }}
                onMouseLeave={e => {
                  if (!m.live || m.active) return;
                  const el = e.currentTarget;
                  el.style.background = `${accent}0a`;
                  el.style.borderColor = `${accent}30`;
                  el.style.color = "rgba(226,232,240,0.65)";
                  el.style.boxShadow = "none";
                }}
              >
                {isTwitch ? (
                  <TwitchIcon
                    size={13}
                    color={m.active ? "#9146FF" : m.live ? "rgba(145,70,255,0.75)" : "rgba(255,255,255,0.18)"}
                  />
                ) : isYT ? (
                  <YouTubeIcon
                    size={15}
                    color={m.active ? "#FF0000" : m.live ? "rgba(255,0,0,0.6)" : "rgba(255,255,255,0.18)"}
                  />
                ) : (
                  <span style={{ fontSize: 12, lineHeight: 1 }}>{m.icon}</span>
                )}
                {m.label}
                {m.active && (
                  <span style={{
                    fontSize: 8, fontWeight: 800, letterSpacing: "0.1em",
                    padding: "1px 5px", borderRadius: 4,
                    background: `${accent}44`, color: accent,
                    textTransform: "uppercase",
                  }}>ON</span>
                )}
                {!m.live && !m.active && (
                  <span style={{
                    fontSize: 8, fontWeight: 700, letterSpacing: "0.08em",
                    padding: "1px 5px", borderRadius: 4,
                    background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.22)",
                    textTransform: "uppercase",
                  }}>SOON</span>
                )}
              </button>
            );
          })}
          {onDetailsClick && (
            <button
              type="button"
              onClick={onDetailsClick}
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "6px 14px", borderRadius: 999,
                fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
                fontFamily: "monospace", cursor: "pointer",
                marginLeft: "auto", transition: "all 0.15s ease",
                border: showDetails ? "1px solid rgba(255,255,255,0.2)" : "1px solid rgba(255,255,255,0.06)",
                background: showDetails ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.02)",
                color: showDetails ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.25)",
              }}
              onMouseEnter={e => { if (!showDetails) { e.currentTarget.style.color = "rgba(255,255,255,0.5)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; }}}
              onMouseLeave={e => { if (!showDetails) { e.currentTarget.style.color = "rgba(255,255,255,0.25)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}}
            >
              {showDetails ? "✕ close" : "⋯ details"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
