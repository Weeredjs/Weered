/* ── apps/web/components/RoleIcon.tsx ─────────────────────────────────────── */
"use client";
import React from "react";

/**
 * Role icon — renders brand PNG role icons with SVG fallbacks.
 * Usage: <RoleIcon role="GOD" size={14} />
 */

const ROLE_MAP: Record<string, { name: string; color: string; hasPng: boolean }> = {
  GOD:     { name: "kingpin",    color: "#D4A017", hasPng: true },
  ADMIN:   { name: "lieutenant", color: "#EF4444", hasPng: false },
  STAFF:   { name: "enforcer",   color: "#60A5FA", hasPng: true },
  SUPPORT: { name: "lookout",    color: "#2DD4BF", hasPng: true },
  MOD:     { name: "captain",    color: "#34D399", hasPng: true },
  OWNER:   { name: "founder",    color: "#F97316", hasPng: true },
  PAID:    { name: "premium",    color: "#A78BFA", hasPng: true },
};

/* SVG fallback paths for roles without PNGs */
const SVG_FALLBACKS: Record<string, string> = {
  ADMIN: "M8 1l2 4h-1.5v4.5h1L8 13l-1.5-3.5h1V5H6L8 1zM4.5 6L6 4v2l-1.5 2.5L6 11v2l-1.5-2L3 8.5 4.5 6zM11.5 6L10 4v2l1.5 2.5L10 11v2l1.5-2L13 8.5 11.5 6z",
};

/* Display name mapping */
const DISPLAY_NAMES: Record<string, string> = {
  GOD:     "Kingpin",
  ADMIN:   "Lieutenant",
  STAFF:   "Enforcer",
  SUPPORT: "Lookout",
  MOD:     "Captain",
  OWNER:   "Founder",
};

interface RoleIconProps {
  role: string;
  size?: number;
  style?: React.CSSProperties;
  className?: string;
}

export default function RoleIcon({ role, size = 14, style, className }: RoleIconProps) {
  const info = ROLE_MAP[role];
  if (!info) return null;

  // If we have a PNG, use it
  if (info.hasPng) {
    const pngSize = size <= 32 ? 32 : size <= 64 ? 64 : 128;
    return (
      <img
        src={`/brand/roles/role-${info.name}-${pngSize}.png`}
        alt={info.name}
        width={size}
        height={size}
        className={className}
        style={{
          display: "inline",
          verticalAlign: "middle",
          flexShrink: 0,
          borderRadius: size <= 20 ? 2 : 4,
          ...style,
        }}
      />
    );
  }

  // SVG fallback for roles without PNGs (Lieutenant)
  const path = SVG_FALLBACKS[role];
  if (!path) return null;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill={info.color}
      className={className}
      style={{
        display: "inline",
        verticalAlign: "middle",
        flexShrink: 0,
        ...style,
      }}
    >
      <path d={path} />
    </svg>
  );
}

/** Get display name for a DB role */
export function getRoleDisplayName(role: string): string {
  return DISPLAY_NAMES[role] || role;
}

/** Get role color */
export function getRoleColor(role: string): string {
  return ROLE_MAP[role]?.color || "#888";
}
