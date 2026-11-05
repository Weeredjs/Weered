"use client";
import React from "react";

const ROLE_MAP: Record<string, { file: string; color: string }> = {
  GOD: { file: "godfather", color: "#D4A017" },
  ADMIN: { file: "lieutenant", color: "#EF4444" },
  STAFF: { file: "enforcer", color: "#60A5FA" },
  // The support role is Weered's medic: a red cross (James 2026-11-05).
  SUPPORT: { file: "medic", color: "#E5262E" },
  MOD: { file: "captain", color: "#5800E5" },
  OWNER: { file: "founder", color: "#F97316" },
  MEMBER: { file: "member", color: "#94A3B8" },
  // A room's (or its lobby's) moderators and owner: the God star's shape, in
  // their own colours (James 2026-10-31).
  ROOM_MOD: { file: "mod-star", color: "#C7D2FE" },
  ROOM_OWNER: { file: "owner-star", color: "#FB923C" },
};

const TIER_MAP: Record<string, { file: string; color: string }> = {
  KINGPIN: { file: "kingpin", color: "#D4A017" },
  CONDEMNED: { file: "condemned", color: "#E24B4A" },
  FELON: { file: "felon", color: "#F97316" },
  INDICTED: { file: "indicted", color: "#A78BFA" },
};

const DISPLAY_NAMES: Record<string, string> = {
  GOD: "Godfather",
  ADMIN: "Lieutenant",
  STAFF: "Enforcer",
  SUPPORT: "Medic",
  MOD: "Captain",
  OWNER: "Founder",
  ROOM_MOD: "Moderator",
  ROOM_OWNER: "Owner",
};

/** The star for someone's rank in this room, or null for everyone else. */
export function roomRoleIcon(role?: string | null): "ROOM_OWNER" | "ROOM_MOD" | null {
  const r = String(role || "").toLowerCase();
  return r === "owner" ? "ROOM_OWNER" : r === "mod" ? "ROOM_MOD" : null;
}

interface RoleIconProps {
  role: string;
  size?: number;
  style?: React.CSSProperties;
  className?: string;
}

const ICON_VERSION = "v6";

export default function RoleIcon({ role, size = 14, style, className }: RoleIconProps) {
  const info = ROLE_MAP[role];
  if (!info) return null;
  return (
    <img
      src={`/brand/roles/${info.file}.svg?${ICON_VERSION}`}
      alt={DISPLAY_NAMES[role] || role}
      width={size}
      height={size}
      className={className}
      style={{
        display: "inline",
        verticalAlign: "middle",
        flexShrink: 0,
        ...style,
      }}
    />
  );
}

export function TierIcon({
  tier,
  size = 14,
  style,
  className,
}: {
  tier: string;
  size?: number;
  style?: React.CSSProperties;
  className?: string;
}) {
  const info = TIER_MAP[tier.toUpperCase()];
  if (!info) return null;
  return (
    <img
      src={`/brand/roles/${info.file}.svg?${ICON_VERSION}`}
      alt={tier}
      width={size}
      height={size}
      className={className}
      style={{
        display: "inline",
        verticalAlign: "middle",
        flexShrink: 0,
        ...style,
      }}
    />
  );
}

export function getRoleDisplayName(role: string): string {
  return DISPLAY_NAMES[role] || role;
}

export function getRoleColor(role: string): string {
  return ROLE_MAP[role]?.color || TIER_MAP[role]?.color || "#888";
}
