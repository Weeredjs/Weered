"use client";
import React from "react";

export const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

export type AdminMember = {
  id: string;
  userId: string;
  name: string;
  role: string;
  roleLevel: number;
  createdAt: string;
};
export type AdminRoom = {
  id: string;
  name: string;
  locked: boolean;
  ownerId?: string;
  onlineCount: number;
  memberCount: number;
};
export type AdminAudit = {
  id: string;
  type: string;
  actorId: string;
  actorName: string;
  targetId?: string;
  note?: string;
  ts: string;
};
export type AdminBan = { id: string; userId: string; reason: string; createdAt: string };

export type LobbyData = {
  id: string;
  name: string;
  description: string;
  verified: boolean;
  pinned: boolean;
  moduleType: string;
  moduleConfig: any;
  accentColor: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  websiteUrl: string | null;
  keywords: string[];
  enabledModules: string[];
  roleNames: Record<string, string>;
  joinMode: string;
  joinPassword?: string | null;
  blockedWords?: string[];
  blockedDomains?: string[];
  newAccountChatHours?: number;
  memberPerks?: string[];
};

export type DashboardData = {
  lobby: LobbyData;
  members: AdminMember[];
  rooms: AdminRoom[];
  audit: AdminAudit[];
  bans: AdminBan[];
  myLevel: number;
  overrideRole: string | null;
  globalRole: string;
  perms: string[];
};

export function fmtDate(s: string) {
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

export function authHeaders(): Record<string, string> {
  try {
    const t = localStorage.getItem("weered_token") || "";
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

export async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(opts?.headers || {}) },
  });
  return r.json();
}

export const S = {
  card: {
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,.08)",
    background: "rgba(255,255,255,.03)",
    padding: "11px 14px",
  } as React.CSSProperties,
  cardHov: {
    borderRadius: 10,
    border: "1px solid rgba(124,58,237,.35)",
    background: "rgba(124,58,237,.07)",
    padding: "11px 14px",
  } as React.CSSProperties,
  btn: {
    padding: "6px 12px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(255,255,255,.05)",
    fontSize: 12,
    cursor: "pointer",
    color: "rgba(243,244,246,.88)",
  } as React.CSSProperties,
  btnPri: {
    padding: "6px 12px",
    borderRadius: 8,
    border: "1px solid rgba(124,58,237,.35)",
    background: "rgba(124,58,237,.12)",
    fontSize: 12,
    cursor: "pointer",
    color: "rgb(216,180,254)",
    fontWeight: 600,
  } as React.CSSProperties,
  danger: {
    padding: "6px 12px",
    borderRadius: 8,
    border: "1px solid rgba(239,68,68,.30)",
    background: "rgba(239,68,68,.08)",
    fontSize: 12,
    cursor: "pointer",
    color: "rgba(252,165,165,.90)",
  } as React.CSSProperties,
  success: {
    padding: "6px 12px",
    borderRadius: 8,
    border: "1px solid rgba(16,185,129,.30)",
    background: "rgba(16,185,129,.08)",
    fontSize: 12,
    cursor: "pointer",
    color: "rgb(167,243,208)",
  } as React.CSSProperties,
  input: {
    width: "100%",
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(0,0,0,.30)",
    fontSize: 13,
    color: "rgba(243,244,246,.92)",
    outline: "none",
    boxSizing: "border-box" as const,
  },
  label: {
    fontSize: 10,
    fontWeight: 700,
    opacity: 0.45,
    letterSpacing: ".7px",
    textTransform: "uppercase" as const,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    opacity: 0.6,
    letterSpacing: ".5px",
    textTransform: "uppercase" as const,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottom: "1px solid rgba(255,255,255,.07)",
  },
};

export const LEVEL_COLORS: Record<number, { bg: string; border: string; color: string }> = {
  5: { bg: "rgba(245,158,11,.12)", border: "rgba(245,158,11,.30)", color: "rgb(253,230,138)" },
  4: { bg: "rgba(124,58,237,.12)", border: "rgba(124,58,237,.30)", color: "rgb(216,180,254)" },
  3: { bg: "rgba(14,165,233,.10)", border: "rgba(14,165,233,.28)", color: "rgb(186,230,253)" },
  2: { bg: "rgba(16,185,129,.10)", border: "rgba(16,185,129,.28)", color: "rgb(167,243,208)" },
  1: {
    bg: "rgba(255,255,255,.05)",
    border: "rgba(255,255,255,.10)",
    color: "rgba(255,255,255,.55)",
  },
};

export function LevelBadge({
  level,
  roleNames,
}: {
  level: number;
  roleNames: Record<string, string>;
}) {
  const c = LEVEL_COLORS[level] || LEVEL_COLORS[1];
  const name = roleNames[String(level)] || `Level ${level}`;
  return (
    <span
      style={{
        fontSize: 10,
        padding: "2px 7px",
        borderRadius: 999,
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.color,
        fontWeight: 700,
        letterSpacing: ".4px",
        flexShrink: 0,
      }}
    >
      {name}
    </span>
  );
}

export function OverrideBadge({ role }: { role: string }) {
  if (!role) return null;
  const c =
    role === "GOD"
      ? { bg: "rgba(245,158,11,.12)", border: "rgba(245,158,11,.30)", color: "rgb(253,230,138)" }
      : { bg: "rgba(124,58,237,.12)", border: "rgba(124,58,237,.30)", color: "rgb(216,180,254)" };
  return (
    <span
      style={{
        fontSize: 9,
        padding: "2px 6px",
        borderRadius: 999,
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.color,
        fontWeight: 700,
        letterSpacing: ".3px",
        opacity: 0.85,
      }}
    >
      Viewing as {role}
    </span>
  );
}

export const NAV_ITEMS = [
  { id: "branding", label: "Branding", icon: "🎨", minLevel: 4 },
  { id: "modules", label: "Modules", icon: "🧩", minLevel: 4 },
  { id: "moderation", label: "Moderation", icon: "🛡️", minLevel: 4 },
  { id: "rooms", label: "Rooms", icon: "🚪", minLevel: 3 },
  { id: "challenges", label: "Challenges", icon: "🎯", minLevel: 4 },
  { id: "tournaments", label: "Tournaments", icon: "🏆", minLevel: 4 },
  { id: "roles", label: "Roles", icon: "👑", minLevel: 5 },
  { id: "tiers", label: "Paid Tiers", icon: "💎", minLevel: 5 },
  { id: "join-requests", label: "Join Requests", icon: "📬", minLevel: 3 },
  { id: "events", label: "Events", icon: "📅", minLevel: 4 },
  { id: "members", label: "Members", icon: "👥", minLevel: 2 },
  { id: "audit", label: "Audit Log", icon: "📋", minLevel: 3 },
] as const;

export type NavId = (typeof NAV_ITEMS)[number]["id"];
