"use client";

import React from "react";
import RoleIcon, { TierIcon } from "./RoleIcon";
import { avatarBg } from "../lib/avatarColor";

// ═══════════════════════════════════════════════════════════════════════════
// Platform icons — minimal inline SVGs. Size prop default 13.
// Only rendered when the user has that platform linked (earned flair).
// ═══════════════════════════════════════════════════════════════════════════

export function SteamIcon({ size = 14 }: { size?: number }) {
  // Steam dark-navy + cream — true brand palette
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label="Steam">
      <circle cx="12" cy="12" r="11" fill="#1b2838" />
      <circle cx="12" cy="12" r="11" fill="none" stroke="#66c0f4" strokeWidth="1" opacity="0.85" />
      <path d="M9.5 13.3a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6zm6.3-4.7a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" fill="#c6d4df" />
      <path d="M3 15l4.3-1.8L9 14.6l-1.2.5-4.8 1.2L3 15z" fill="#66c0f4" opacity="0.9" />
    </svg>
  );
}

export function TwitchIcon({ size = 14 }: { size?: number }) {
  // Official Twitch purple + white glitch
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label="Twitch">
      <rect width="24" height="24" rx="4" fill="#9146ff" />
      <path
        d="M5 4v13h4v3h2l3-3h3l4-4V4H5zm14 8l-2 2h-4l-3 3v-3H7V6h12v6zm-5-5h2v5h-2V7zm-4 0h2v5h-2V7z"
        fill="#fff"
      />
    </svg>
  );
}

export function XboxIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label="Xbox">
      <circle cx="12" cy="12" r="11" fill="#107c10" />
      <path d="M7.2 5.7c2.2-.9 5.2-1 6.9 0 .6.3 1.3.9 1.9 1.7-2.3-1-4.2-.6-4.9-.2-.9.5-1.7 1.3-2.1 1.8-.6-.8-1.3-1.9-1.8-3.3z" fill="#fff" />
      <path d="M4.2 10c.9-2 2.6-3.5 3.6-4.1.6 1 1.4 2.3 2 3.2-1.4 1.4-3.4 3.9-4.3 7.3C4.3 14.5 3.7 12.2 4.2 10z" fill="#fff" />
      <path d="M16.2 5.9c1 .6 2.7 2.1 3.6 4.1.5 2.2-.1 4.5-1.3 6.4-.9-3.4-2.9-5.9-4.3-7.3.6-.9 1.4-2.2 2-3.2z" fill="#fff" />
      <path d="M12 10.5c1.4 1.2 4 3.9 5.2 7.6-1.4 1.1-3.3 1.8-5.2 1.8s-3.8-.7-5.2-1.8C8 14.4 10.6 11.7 12 10.5z" fill="#fff" />
    </svg>
  );
}

export function PlaystationIcon({ size = 14 }: { size?: number }) {
  // Official PSN blue, "PS" wordmark
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label="PlayStation">
      <circle cx="12" cy="12" r="11" fill="#003791" />
      <path d="M9.8 4.6v12.1l3.2 1.1V9.1c0-.7.2-1.2.6-1.2s.6.5.6 1.3v4.5c1.8.9 3.2.2 3.2-2V8.3c0-2.3-.8-3.4-3.1-3.9-1.5-.3-3.3-.4-4.5.2z" fill="#fff" />
      <path d="M13.6 14.8v2l5.4-1.9c.6-.2.7-.6.3-.9-.4-.3-1.1-.4-1.7-.3l-4 1.1zM3.7 14.5c-.7.3-.8.8-.1 1.1l4 1.4v-1.9l-2.9-.7c-.3-.1-.7 0-1 .1z" fill="#fff" />
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
  isAway?: boolean;                // "Lying low" — online but idle

  // Platforms (only linked platforms render)
  platforms?: PresencePlatforms;

  // Interaction
  onClick?: () => void;
  href?: string;
  action?: React.ReactNode;        // trailing action (e.g. "Join" button)
  activeGlow?: string | null;      // accent color for an active/highlight state

  // Sizing
  compact?: boolean;               // denser row for rails

  // User-customizable pill background (#RRGGBB). Tints the row background.
  pillBgColor?: string | null;
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
  isAway,
  platforms,
  onClick,
  href,
  action,
  activeGlow,
  compact,
  pillBgColor,
}: PresenceRowProps) {
  const validPillBg = pillBgColor && /^#[0-9a-f]{6}$/i.test(pillBgColor) ? pillBgColor : null;

  // Viewer's chosen intensity (0-100). Lives in localStorage so it's a per-
  // viewer preference — controls how strongly OTHER users' pillBgColors
  // render in this user's interface.
  const [pillIntensity, setPillIntensity] = React.useState<number>(60);
  React.useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem("weered:pillBgIntensity");
        const n = raw == null ? 60 : Math.max(0, Math.min(100, Number(raw)));
        if (Number.isFinite(n)) setPillIntensity(n);
      } catch {}
    };
    read();
    const onChange = () => read();
    window.addEventListener("weered:pillBgIntensity", onChange);
    return () => window.removeEventListener("weered:pillBgIntensity", onChange);
  }, []);

  const pillTint = (() => {
    if (!validPillBg) return null;
    const r = parseInt(validPillBg.slice(1, 3), 16);
    const g = parseInt(validPillBg.slice(3, 5), 16);
    const b = parseInt(validPillBg.slice(5, 7), 16);
    const a = pillIntensity / 100;
    if (a <= 0.01) return null;
    return `linear-gradient(90deg, rgba(${r},${g},${b},${a.toFixed(3)}) 0%, rgba(${r},${g},${b},${(a * 0.45).toFixed(3)}) 60%, transparent 100%)`;
  })();
  const initial = (name || "?")[0]?.toUpperCase() || "?";
  const bg = avatar ? "rgba(255,255,255,0.08)" : (avatarColor || avatarBg(name || ""));
  const avatarSize = compact ? 30 : 36;

  // Active platform key, if we have a live game/stream signal — drives the
  // inline icon in the activity line AND dedup of the trailing pill group.
  const activePlatformKey =
    (livePresence?.activity && typeof livePresence?.source === "string")
      ? livePresence.source.toUpperCase()
      : "";
  const activePlatformGlyph = (() => {
    if (!activePlatformKey) return null;
    const glyphSize = compact ? 12 : 13;
    switch (activePlatformKey) {
      case "STEAM":  return <SteamIcon size={glyphSize} />;
      case "TWITCH": return <TwitchIcon size={glyphSize} />;
      case "XBOX":   return <XboxIcon size={glyphSize} />;
      case "PSN":
      case "PLAYSTATION": return <PlaystationIcon size={glyphSize} />;
      default: return null;
    }
  })();

  // Secondary line content.
  //
  // Presence bar contract: if we see you in the list, we know you're with us
  // on Weered — so the default line only speaks to *status*, not location.
  // Hierarchy:  playing/streaming game  >  lying low  >  online  >  offline.
  const secondary = secondaryText ?? (() => {
    if (online && isAway) {
      return <span style={{ color: "#facc15", fontStyle: "italic", opacity: 0.85 }}>lying low</span>;
    }
    if (livePresence?.activity) {
      return (
        <span style={{ color: "var(--weered-accent-text, rgba(196,181,253,.92))", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5, minWidth: 0 }}>
          {activePlatformGlyph && <span style={{ display: "inline-flex", flexShrink: 0 }}>{activePlatformGlyph}</span>}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {livePresence.activity}
            {livePresence.detail ? <span style={{ opacity: 0.65, fontWeight: 400, fontStyle: "italic" }}> · {livePresence.detail.slice(0, 40)}</span> : null}
          </span>
        </span>
      );
    }
    if (online) return <span style={{ opacity: 0.55, fontStyle: "italic" }}>online</span>;
    return <span style={{ opacity: 0.35, fontStyle: "italic" }}>offline</span>;
  })();

  // Trailing platform pills — suppress the one that's already rendering
  // inline in the activity line so the same icon doesn't appear twice.
  const showSteam  = !!platforms?.steam  && activePlatformKey !== "STEAM";
  const showTwitch = !!platforms?.twitch && activePlatformKey !== "TWITCH";
  const showXbox   = !!platforms?.xbox   && activePlatformKey !== "XBOX";
  const showPsn    = !!platforms?.psn    && activePlatformKey !== "PSN" && activePlatformKey !== "PLAYSTATION";
  const hasPlatforms = showSteam || showTwitch || showXbox || showPsn;

  // Accent stripe color — role takes priority over tier
  const accentStripe =
    globalRole === "GOD"     ? "#fcd34d"      // GOD: gold
    : globalRole === "STAFF"   ? "#60a5fa"      // STAFF: blue
    : globalRole === "SUPPORT" ? "#5800E5"      // SUPPORT: Weered purple
    : globalRole === "MOD"     ? "#34d399"      // MOD: emerald
    : tier === "KINGPIN"       ? "#fcd34d"      // KINGPIN: gold
    : tier === "FELON"         ? "#f97316"      // FELON: orange
    : tier === "INDICTED"      ? "#a78bfa"      // INDICTED: violet
    : null;

  const inner = (
    <div
      className={"weered-presence-row-inner" + (pillTint ? " has-custom-bg" : "")}
      style={{
        display: "flex", alignItems: "stretch", gap: 10,
        padding: compact ? "6px 10px 6px 12px" : "8px 12px 8px 14px",
        cursor: (onClick || href) ? "pointer" : "default",
        position: "relative",
        transition: "background .12s",
        ...(pillTint ? {
          background: pillTint,
          borderRadius: 8,
        } : {}),
      }}
    >
      {/* Left accent stripe for role/tier (colored only) */}
      {accentStripe && (
        <span style={{
          position: "absolute", left: 0, top: 4, bottom: 4,
          width: 3, borderRadius: "0 2px 2px 0",
          background: `linear-gradient(180deg, ${accentStripe}, ${accentStripe}88)`,
          boxShadow: `0 0 4px ${accentStripe}55`,
        }} />
      )}

      {/* Avatar with online pulse + role-tinted ring */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <div style={{
          width: avatarSize, height: avatarSize, borderRadius: "50%",
          background: bg,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 800, color: "#fff",
          fontSize: compact ? 13 : 15,
          overflow: "hidden",
          boxShadow: accentStripe ? `0 0 0 1.5px ${accentStripe}55, 0 0 10px ${accentStripe}33` : "inset 0 0 0 1px rgba(255,255,255,.06)",
        }}>
          {avatar ? (
            <img src={avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : initial}
        </div>
        {online && (
          <span title={isAway ? "Lying low" : "Online"} style={{
            position: "absolute", bottom: -1, right: -1,
            width: 10, height: 10, borderRadius: "50%",
            background: isAway ? "#facc15" : "#22c55e",
            border: "2px solid var(--weered-bg, #0c0b0a)",
            boxShadow: isAway ? "0 0 5px rgba(250,204,21,.45)" : "0 0 4px rgba(34,197,94,.45)",
            animation: isAway ? "none" : "weered-presence-pulse 5s ease-in-out infinite",
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
          {globalRole && globalRole !== "USER" && (
            <RoleIcon
              role={globalRole}
              size={compact ? 16 : 18}
              style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,.5))" }}
            />
          )}
          {tier && tier !== "INNOCENT" && (
            <TierIcon
              tier={tier}
              size={compact ? 16 : 18}
              style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,.5))" }}
            />
          )}
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

      {/* Platform icon stack — single horizontal row so 1-4 platforms don't
          force the pill taller than non-platform rows. The earlier 2-row
          grid was forcing min-height of ~30px on multi-platform pills,
          making them visibly taller than rows without platforms. */}
      {hasPlatforms && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          flexShrink: 0,
          paddingLeft: 4,
          marginLeft: 2,
          borderLeft: "1px solid rgba(255,255,255,.05)",
        }}>
          {showSteam  && <SteamIcon size={compact ? 12 : 13} />}
          {showTwitch && <TwitchIcon size={compact ? 12 : 13} />}
          {showXbox   && <XboxIcon size={compact ? 12 : 13} />}
          {showPsn    && <PlaystationIcon size={compact ? 12 : 13} />}
        </div>
      )}
    </div>
  );

  if (href) return <>
    <PresenceRowStyles />
    <a href={href} style={{ textDecoration: "none", color: "inherit" }} className="weered-presence-row-link">{inner}</a>
  </>;
  if (onClick) return <>
    <PresenceRowStyles />
    <div onClick={onClick} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }} className="weered-presence-row-link">{inner}</div>
  </>;
  return <><PresenceRowStyles />{inner}</>;
}

let _presenceRowStylesInjected = false;
function PresenceRowStyles() {
  // Inject once per page
  if (typeof document !== "undefined" && !_presenceRowStylesInjected) {
    _presenceRowStylesInjected = true;
  }
  return (
    <style>{`
      .weered-presence-row-link { display: block; color: inherit; text-decoration: none; }
      .weered-presence-row-inner { border-radius: 8px; }
      .weered-presence-row-link:hover .weered-presence-row-inner {
        background: rgba(255,255,255,.045);
      }
      @keyframes weered-presence-pulse {
        0%, 100% { box-shadow: 0 0 4px rgba(34,197,94,.40); }
        50%      { box-shadow: 0 0 6px rgba(34,197,94,.55); }
      }
      @media (prefers-reduced-motion: reduce) {
        .weered-presence-row-link * { animation: none !important; }
      }
    `}</style>
  );
}
