/* ── apps/web/components/RoleIcon.tsx ─────────────────────────────────────── */
"use client";
import React from "react";

/**
 * Role icon — inline SVG, zero file dependencies.
 * Usage: <RoleIcon role="GOD" size={14} />
 */

const ICONS: Record<string, { color: string; path: string }> = {
  /* Kingpin (GOD) — crown */
  GOD: {
    color: "#D4A017",
    path: "M1 12h14v2H1zm0 0L3.5 4 8 8l4.5-4L15 12z",
  },
  /* Lieutenant (ADMIN) — trident */
  ADMIN: {
    color: "#EF4444",
    path: "M7 6H5l3-5 3 5H9v4h1.5L8 15l-2.5-5H7V6zM3 6l2-3v2L3 8.5 5 12v2L3 11 1 8.5 3 6zm10 0l-2-3v2l2 3.5L11 12v2l2-3 2-2.5L13 6z",
  },
  /* Enforcer (STAFF) — brass knuckles */
  STAFF: {
    color: "#60A5FA",
    path: "M3 7a2 2 0 1 1 4 0 2 2 0 0 1 2 0 2 2 0 0 1 2 0 2 2 0 1 1 4 0v2c0 1-1 3-3 4H6c-2-1-3-3-3-4V7z",
  },
  /* Lookout (SUPPORT) — diamond eye */
  SUPPORT: {
    color: "#2DD4BF",
    path: "M8 1L1 8l7 7 7-7-7-7zm0 3l4 4-4 4-4-4 4-4zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",
  },
  /* Captain (MOD) — crossed swords */
  MOD: {
    color: "#34D399",
    path: "M2 2l5 5 1-1-5-5zm7 4l5-5 1 1-5 5zM6.5 8.5L3 12l1 1 3.5-3.5zM9.5 8.5L13 12l-1 1-3.5-3.5zM7 9l1 1 1-1-1-1z",
  },
  /* Founder (OWNER) — key */
  OWNER: {
    color: "#F97316",
    path: "M10 1a4 4 0 0 0-3.8 5.2L1 11.5V15h3.5v-2H6v-1.5h1.5l.7-.7A4 4 0 1 0 10 1zm1 3a1 1 0 1 1 0 2 1 1 0 0 1 0-2z",
  },
  /* Premium (PAID) — star badge */
  PAID: {
    color: "#A78BFA",
    path: "M8 1l2.2 4.5 4.8.7-3.5 3.4.8 4.9L8 12.3 3.7 14.5l.8-4.9L1 6.2l4.8-.7z",
  },
};

const DISPLAY_NAMES: Record<string, string> = {
  GOD: "Kingpin", ADMIN: "Lieutenant", STAFF: "Enforcer",
  SUPPORT: "Lookout", MOD: "Captain", OWNER: "Founder",
};

interface RoleIconProps {
  role: string;
  size?: number;
  style?: React.CSSProperties;
  className?: string;
}

export default function RoleIcon({ role, size = 14, style, className }: RoleIconProps) {
  const icon = ICONS[role];
  if (!icon) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill={icon.color}
      className={className}
      style={{ display: "inline", verticalAlign: "middle", flexShrink: 0, ...style }}
    >
      <path d={icon.path} />
    </svg>
  );
}

export function getRoleDisplayName(role: string): string {
  return DISPLAY_NAMES[role] || role;
}

export function getRoleColor(role: string): string {
  return ICONS[role]?.color || "#888";
}
