"use client";

import React, { useMemo } from "react";
import { useWeered } from "./WeeredProvider";
import { useOverlay } from "./overlays/OverlayProvider";

function pickFirstString(...vals: any[]): string {
  for (const v of vals) if (typeof v === "string" && v.trim()) return v.trim();
  return "";
}

function avatarBg(name: string, isMe?: boolean): string {
  const colors = ["#6366f1","#8b5cf6","#ec4899","#f97316","#eab308","#22c55e","#14b8a6","#3b82f6"];
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const hash = colors[h % colors.length];
  if (!isMe) return hash;
  try { return localStorage.getItem("weered:avatarColor") || hash; } catch { return hash; }
}

function normRole(x: string) {
  const s = String(x || "").trim().toUpperCase();
  if (!s) return "";
  if (s === "GOD")     return "GOD";
  if (s === "SUPPORT") return "SUPPORT";
  if (s === "STAFF")   return "STAFF";
  if (s === "ADMIN")   return "ADMIN";
  if (s === "MOD")     return "MOD";
  if (s === "OWNER")   return "OWNER";
  if (s === "MEMBER")  return "MEMBER";
  return s.slice(0, 14);
}

const ROLE_COLORS: Record<string, { border: string; bg: string; color: string }> = {
  GOD:     { border: "rgba(250,204,21,.38)",  bg: "rgba(234,179,8,.18)",   color: "#fde68a" },
  ADMIN:   { border: "rgba(248,113,113,.34)", bg: "rgba(239,68,68,.14)",   color: "#fca5a5" },
  STAFF:   { border: "rgba(96,165,250,.34)",  bg: "rgba(59,130,246,.14)",  color: "#93c5fd" },
  SUPPORT: { border: "rgba(52,211,153,.34)",  bg: "rgba(16,185,129,.14)",  color: "#6ee7b7" },
  OWNER:   { border: "rgba(249,115,22,.34)",  bg: "rgba(234,88,12,.14)",   color: "#fdba74" },
  MOD:     { border: "rgba(167,139,250,.34)", bg: "rgba(124,58,237,.18)",  color: "#c4b5fd" },
};

// Small SVG icons
const IconSettings = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M8 1.5v1.2M8 13.3v1.2M1.5 8h1.2M13.3 8h1.2M3.4 3.4l.85.85M11.75 11.75l.85.85M3.4 12.6l.85-.85M11.75 4.25l.85-.85" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);

const IconDock = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
    <rect x="1.5" y="4" width="13" height="8.5" rx="2" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M5 7.5h6M5 10h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);

export default function UserCorner() {
  const { me, role, globalRole } = useWeered() as any;
  const { openSheet } = useOverlay();

  const name     = useMemo(() => pickFirstString(me?.name, me?.username, "Guest"), [me]);
  // Re-render when avatar color changes
  const [, forceUpdate] = React.useState(0);
  React.useEffect(() => {
    const handler = () => forceUpdate(n => n + 1);
    window.addEventListener("weered:avatarColor", handler);
    return () => window.removeEventListener("weered:avatarColor", handler);
  }, []);
  const gRole    = useMemo(() => normRole(globalRole || ""), [globalRole]);
  const roomRole = useMemo(() => normRole(pickFirstString(role)), [role]);
  const initial  = (name || "G").trim().slice(0, 1).toUpperCase();

  const profileUserId = (me?.id ?? me?.userId ?? me?.name ?? me?.username ?? "me").toString();

  // Pick avatar color from localStorage if set (mirrors ProfileSheet logic)
  const avatarColor = typeof window !== "undefined"
    ? null // will be driven by profile API later; default to accent grad for now
    : null;

  const chipStyle = (r: string) => {
    const c = ROLE_COLORS[r];
    if (!c) return {};
    return { borderColor: c.border, background: c.bg, color: c.color };
  };

  return (
    <div
      style={{
        position: "relative",
        borderRadius: 16,
        border: "1px solid rgba(148,163,184,.13)",
        background: "rgba(255,255,255,.03)",
        overflow: "hidden",
        marginBottom: 4,
      }}
    >
      {/* Ambient brand watermark — top right */}
      <div style={{
        position: "absolute", top: 8, right: 10,
        opacity: 0.045, pointerEvents: "none", userSelect: "none",
        fontSize: 11, fontWeight: 900, letterSpacing: "3px", textTransform: "uppercase",
      }}>
        WEERED
      </div>

      {/* Main identity row — clickable to open profile */}
      <button
        type="button"
        onClick={() => openSheet("profile", { userId: profileUserId })}
        style={{
          display: "flex", alignItems: "center", gap: 11,
          width: "100%", padding: "12px 14px 10px",
          background: "none", border: "none", cursor: "pointer",
          color: "inherit", textAlign: "left",
        }}
      >
        {/* Avatar */}
        <div style={{
          width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
          background: avatarBg(name, true),
          boxShadow: `0 0 18px ${avatarBg(name, true)}55`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, fontWeight: 950, color: "#fff",
        }}>
          {initial}
        </div>

        {/* Name + chips */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 900, letterSpacing: "-.1px",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            color: "rgba(243,244,246,.95)",
          }}>
            {name}
          </div>
          <div style={{ display: "flex", gap: 5, marginTop: 4, flexWrap: "wrap" }}>
            {gRole && (
              <span style={{
                fontSize: 10, fontWeight: 900, padding: "2px 7px",
                borderRadius: 999, border: "1px solid rgba(148,163,184,.22)",
                background: "rgba(255,255,255,.06)",
                ...chipStyle(gRole),
              }}>
                {gRole}
              </span>
            )}
            {roomRole && roomRole !== gRole && (
              <span style={{
                fontSize: 10, fontWeight: 900, padding: "2px 7px",
                borderRadius: 999, border: "1px solid rgba(148,163,184,.22)",
                background: "rgba(255,255,255,.06)",
                ...chipStyle(roomRole),
              }}>
                {roomRole}
              </span>
            )}
          </div>
        </div>
      </button>

      {/* Action strip */}
      <div style={{
        display: "flex", borderTop: "1px solid rgba(255,255,255,.05)",
      }}>
        <button
          type="button"
          onClick={() => openSheet("settings")}
          title="Settings"
          style={actionBtn}
        >
          <IconSettings />
          <span style={{ fontSize: 11 }}>Settings</span>
        </button>

        <div style={{ width: 1, background: "rgba(255,255,255,.05)", flexShrink: 0 }} />

        <button
          type="button"
          onClick={() => { try { window.dispatchEvent(new CustomEvent("weered:dock:toggle")); } catch {} }}
          title="Dock"
          style={actionBtn}
        >
          <IconDock />
          <span style={{ fontSize: 11 }}>Dock</span>
        </button>
      </div>
    </div>
  );
}

const actionBtn: React.CSSProperties = {
  flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
  gap: 5, padding: "8px 0",
  background: "none", border: "none", cursor: "pointer",
  color: "rgba(255,255,255,.45)", fontFamily: "inherit",
  transition: "color 0.12s, background 0.12s",
};
