"use client";

import React from "react";
import RoleIcon, { TierIcon } from "./RoleIcon";
import { avatarBg } from "../lib/avatarColor";

// ═══════════════════════════════════════════════════════════════════════════
// Platform icons — minimal inline SVGs. Size prop default 13.
// Only rendered when the user has that platform linked (earned flair).
// ═══════════════════════════════════════════════════════════════════════════

export function SteamIcon({ size = 13, color = "#d4dbe8" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label="Steam">
      <circle cx="12" cy="12" r="11" fill={color} opacity="0.14" />
      <circle cx="12" cy="12" r="11" fill="none" stroke={color} strokeWidth="1.2" opacity="0.9" />
      <path d="M9.5 13.3a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6zm6.3-4.7a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" fill={color} />
      <path d="M3 15l4.3-1.8L9 14.6l-1.2.5-4.8 1.2L3 15z" fill={color} opacity="0.75" />
    </svg>
  );
}

export function TwitchIcon({ size = 13, color = "#b79bff" }: { size?: number; color?: string }) {
  // Official Twitch glitch proportions
  return (
    <svg width={size} height={size} viewBox="0 0 256 268" aria-label="Twitch">
      <path
        d="M17.458 0L0 46.556v185.81h63.983v34.934h34.932l34.898-34.934h52.36L256 162.954V0H17.458zm23.259 23.263H232.73v128.029l-40.739 40.736H128L93.113 226.93v-34.902H40.717V23.263zm64.008 116.405H128V69.844h-23.275v69.824zm63.997 0h23.275V69.844h-23.275v69.824z"
        fill={color}
      />
    </svg>
  );
}

export function XboxIcon({ size = 13, color = "#8ed96a" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label="Xbox">
      <circle cx="12" cy="12" r="11" fill={color} opacity="0.16" />
      <circle cx="12" cy="12" r="11" fill="none" stroke={color} strokeWidth="1.2" opacity="0.9" />
      <path d="M7.2 5.7c2.2-.9 5.2-1 6.9 0 .6.3 1.3.9 1.9 1.7-2.3-1-4.2-.6-4.9-.2-.9.5-1.7 1.3-2.1 1.8-.6-.8-1.3-1.9-1.8-3.3z" fill={color} opacity="0.9" />
      <path d="M4.2 10c.9-2 2.6-3.5 3.6-4.1.6 1 1.4 2.3 2 3.2-1.4 1.4-3.4 3.9-4.3 7.3C4.3 14.5 3.7 12.2 4.2 10z" fill={color} opacity="0.9" />
      <path d="M16.2 5.9c1 .6 2.7 2.1 3.6 4.1.5 2.2-.1 4.5-1.3 6.4-.9-3.4-2.9-5.9-4.3-7.3.6-.9 1.4-2.2 2-3.2z" fill={color} opacity="0.9" />
      <path d="M12 10.5c1.4 1.2 4 3.9 5.2 7.6-1.4 1.1-3.3 1.8-5.2 1.8s-3.8-.7-5.2-1.8C8 14.4 10.6 11.7 12 10.5z" fill={color} opacity="0.9" />
    </svg>
  );
}

export function PlaystationIcon({ size = 13, color = "#7eb8ff" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label="PlayStation">
      <circle cx="12" cy="12" r="11" fill={color} opacity="0.14" />
      <circle cx="12" cy="12" r="11" fill="none" stroke={color} strokeWidth="1.2" opacity="0.9" />
      <path d="M9.8 4.6v12.1l3.2 1.1V9.1c0-.7.2-1.2.6-1.2s.6.5.6 1.3v4.5c1.8.9 3.2.2 3.2-2V8.3c0-2.3-.8-3.4-3.1-3.9-1.5-.3-3.3-.4-4.5.2z" fill={color} />
      <path d="M13.6 14.8v2l5.4-1.9c.6-.2.7-.6.3-.9-.4-.3-1.1-.4-1.7-.3l-4 1.1zM3.7 14.5c-.7.3-.8.8-.1 1.1l4 1.4v-1.9l-2.9-.7c-.3-.1-.7 0-1 .1z" fill={color} opacity="0.85" />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PresenceRow — the platform's unified user-row primitive.
// ═══════════════════════════════════════════════════════════════════════════

export interface PresencePlatforms {
  steam?: boolean;
  twitch?: boolean;
  xbox?: boolean;
  psn?: boolean;
}

export interface LivePresence {
  source?: string;           // "STEAM" | "TWITCH" | "XBOX" | "PSN"
  activity?: string;         // "Playing Windrose" / "Streaming Warzone"
  detail?: string;           // stream title / game detail
  url?: string;              // profile / stream URL
  updatedAt?: string;
}

export interface PresenceRowProps {
  // Identity
  name: string;
  avatar?: string | null;
  avatarColor?: string | null;

  // Role / tier — small icons next to name
  globalRole?: string;       // STAFF | GOD | SUPPORT | MOD | USER
  tier?: string;             // KINGPIN | FELON | INNOCENT | INDICTED etc.

  // Activity
  online?: boolean;
  roomName?: string | null;
  livePresence?: LivePresence | null;
  secondaryText?: React.ReactNode; // override for the bottom line if needed

  // Platforms (only linked platforms render)
  platforms?: PresencePlatforms;

  // Interaction
  onClick?: () => void;
  href?: string;
  action?: React.ReactNode;        // trailing action (e.g. "Join" button)
  activeGlow?: string | null;      // accent color for an active/highlight state

  // Sizing
  compact?: boolean;               // denser row for rails
}

export default function PresenceRow({
  name,
  avatar,
  avatarColor,
  globalRole,
  tier,
  online,
  roomName,
  livePresence,
  secondaryText,
  platforms,
  onClick,
  href,
  action,
  activeGlow,
  compact,
}: PresenceRowProps) {
  const initial = (name || "?")[0]?.toUpperCase() || "?";
  const bg = avatar ? "rgba(255,255,255,0.08)" : (avatarColor || avatarBg(name || ""));
  const avatarSize = compact ? 30 : 36;

  // Secondary line content
  const secondary = secondaryText ?? (() => {
    if (livePresence?.activity) {
      return (
        <span style={{ color: "var(--weered-accent-text, rgba(196,181,253,.92))", fontWeight: 600 }}>
          {livePresence.activity}
          {livePresence.detail ? <span style={{ opacity: 0.65, fontWeight: 400, fontStyle: "italic" }}> · {livePresence.detail.slice(0, 40)}</span> : null}
        </span>
      );
    }
    if (online && roomName) return <span style={{ opacity: 0.65 }}>in {roomName}</span>;
    if (online) return <span style={{ opacity: 0.55, fontStyle: "italic" }}>online</span>;
    return <span style={{ opacity: 0.35, fontStyle: "italic" }}>offline</span>;
  })();

  const hasPlatforms = !!(platforms?.steam || platforms?.twitch || platforms?.xbox || platforms?.psn);

  const inner = (
    <div style={{
      display: "flex", alignItems: "stretch", gap: 10,
      padding: compact ? "8px 10px" : "10px 12px",
      borderRadius: 10,
      border: `1px solid ${activeGlow ? `${activeGlow}55` : "rgba(255,255,255,.06)"}`,
      background: activeGlow ? `${activeGlow}0a` : "rgba(255,255,255,.015)",
      transition: "border-color .12s, background .12s",
      cursor: (onClick || href) ? "pointer" : "default",
      position: "relative",
    }}>
      {/* Avatar with online pulse */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <div style={{
          width: avatarSize, height: avatarSize, borderRadius: "50%",
          background: bg,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 800, color: "#fff",
          fontSize: compact ? 13 : 15,
          overflow: "hidden",
        }}>
          {avatar ? (
            <img src={avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : initial}
        </div>
        {online && (
          <span style={{
            position: "absolute", bottom: -1, right: -1,
            width: 10, height: 10, borderRadius: "50%",
            background: "#22c55e",
            border: "2px solid var(--weered-bg, #0c0b0a)",
            boxShadow: "0 0 6px rgba(34,197,94,.6)",
          }} />
        )}
      </div>

      {/* Identity + activity */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            fontWeight: 700, fontSize: compact ? 13 : 14,
            color: "var(--weered-text, rgba(243,244,246,.96))",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            minWidth: 0,
          }}>{name}</span>
          {globalRole && globalRole !== "USER" && <RoleIcon role={globalRole} size={compact ? 12 : 13} />}
          {tier && tier !== "INNOCENT" && <TierIcon tier={tier} size={compact ? 12 : 13} />}
        </div>
        <div style={{
          fontSize: compact ? 11 : 12,
          color: "var(--weered-muted, rgba(203,213,225,.72))",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          minWidth: 0,
          lineHeight: 1.35,
        }}>
          {secondary}
        </div>
      </div>

      {/* Action slot */}
      {action && <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>{action}</div>}

      {/* Platform icon stack — vertical, right-aligned, only shows linked */}
      {hasPlatforms && (
        <div style={{
          display: "flex", flexDirection: "column",
          gap: 3, alignItems: "center", justifyContent: "center",
          flexShrink: 0,
          paddingLeft: 4,
          marginLeft: 2,
          borderLeft: "1px solid rgba(255,255,255,.05)",
        }}>
          {platforms?.steam  && <SteamIcon size={compact ? 12 : 13} />}
          {platforms?.twitch && <TwitchIcon size={compact ? 12 : 13} />}
          {platforms?.xbox   && <XboxIcon size={compact ? 12 : 13} />}
          {platforms?.psn    && <PlaystationIcon size={compact ? 12 : 13} />}
        </div>
      )}
    </div>
  );

  if (href) return <a href={href} style={{ textDecoration: "none", color: "inherit" }}>{inner}</a>;
  if (onClick) return <div onClick={onClick} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}>{inner}</div>;
  return inner;
}
