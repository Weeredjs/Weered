"use client";
import { API, authHeaders, apiFetch } from "../../lib/apiClient";
export { API, authHeaders, apiFetch };
import React from "react";

export type GlobalRole = "USER" | "SUPPORT" | "STAFF" | "ADMIN" | "GOD";
export type UserTier = "INNOCENT" | "INDICTED" | "FELON" | "KINGPIN";
export type StaffUser = {
  id: string;
  name: string;
  usernameKey: string;
  globalRole: GlobalRole;
  tier: UserTier;
  notoriety: number;
  createdAt: string;
  email?: string;
  banned?: boolean;
  banReason?: string;
};
export type AuditLog = {
  id: string;
  actorName: string;
  action: string;
  targetName?: string;
  meta?: any;
  createdAt: string;
};
export type StaffNote = { id: string; authorName: string; body: string; createdAt: string };
export type StaffRoom = {
  id: string;
  name: string;
  locked: boolean;
  members: number;
  lobbyId?: string;
  createdAt: string;
  pinned?: boolean;
  liveUsers?: number;
  lastActiveAt?: number;
};
export type StaffLobby = {
  id: string;
  name: string;
  description?: string;
  verified: boolean;
  pinned: boolean;
  moduleType: string;
  onlineCount: number;
};
export type SiteConfig = {
  featuredLobbyId: string;
  registrationOpen: boolean;
  maintenanceMode: boolean;
  aiEnabled: boolean;
  defaultTier: UserTier;
  maxRoomsPerLobby: number;
  chatRateLimit: number;
};

export function fmtDate(s: string) {
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

export function roleColor(r: string) {
  if (r === "GOD")
    return {
      bg: "rgba(245,158,11,.12)",
      border: "rgba(245,158,11,.30)",
      color: "rgb(253,230,138)",
    };
  if (r === "STAFF")
    return {
      bg: "rgba(124,58,237,.12)",
      border: "rgba(124,58,237,.30)",
      color: "rgb(216,180,254)",
    };
  if (r === "ADMIN")
    return {
      bg: "rgba(167,139,250,.12)",
      border: "rgba(167,139,250,.30)",
      color: "rgb(196,181,253)",
    };
  if (r === "SUPPORT")
    return {
      bg: "rgba(14,165,233,.10)",
      border: "rgba(14,165,233,.28)",
      color: "rgb(186,230,253)",
    };
  return {
    bg: "rgba(255,255,255,.05)",
    border: "rgba(255,255,255,.10)",
    color: "rgba(255,255,255,.55)",
  };
}

export function tierColor(t: string) {
  if (t === "KINGPIN")
    return {
      bg: "rgba(245,158,11,.12)",
      border: "rgba(245,158,11,.30)",
      color: "rgb(253,230,138)",
    };
  if (t === "FELON")
    return { bg: "rgba(239,68,68,.10)", border: "rgba(239,68,68,.28)", color: "rgb(252,165,165)" };
  if (t === "INDICTED")
    return {
      bg: "rgba(124,58,237,.12)",
      border: "rgba(124,58,237,.30)",
      color: "rgb(216,180,254)",
    };
  return {
    bg: "rgba(255,255,255,.05)",
    border: "rgba(255,255,255,.10)",
    color: "rgba(255,255,255,.45)",
  };
}

export function RoleBadge({ role }: { role: string }) {
  const c = roleColor(role);
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
      {role}
    </span>
  );
}

export function TierBadge({ tier }: { tier: string }) {
  const c = tierColor(tier);
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
      {tier}
    </span>
  );
}

export function BannedBadge() {
  return (
    <span
      style={{
        fontSize: 10,
        padding: "2px 7px",
        borderRadius: 999,
        background: "rgba(239,68,68,.15)",
        border: "1px solid rgba(239,68,68,.40)",
        color: "rgb(252,165,165)",
        fontWeight: 700,
        letterSpacing: ".4px",
        flexShrink: 0,
      }}
    >
      BANNED
    </span>
  );
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
  warn: {
    padding: "6px 12px",
    borderRadius: 8,
    border: "1px solid rgba(245,158,11,.30)",
    background: "rgba(245,158,11,.08)",
    fontSize: 12,
    cursor: "pointer",
    color: "rgb(253,230,138)",
  } as React.CSSProperties,
  success: {
    padding: "6px 12px",
    borderRadius: 8,
    border: "1px solid rgba(16,185,129,.30)",
    background: "rgba(16,185,129,.08)",
    fontSize: 12,
    cursor: "pointer",
    color: "rgb(110,231,183)",
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

export const NAV_ITEMS = [
  { id: "analytics", label: "Analytics", icon: "📊", minRole: "STAFF" },
  { id: "users", label: "Users", icon: "👤", minRole: "SUPPORT" },
  { id: "board", label: "Board", icon: "📌", minRole: "SUPPORT" },
  { id: "roster", label: "Roster", icon: "🪪", minRole: "SUPPORT" },
  { id: "subs", label: "Subscriptions", icon: "💳", minRole: "STAFF" },
  { id: "rooms", label: "Rooms", icon: "🚪", minRole: "STAFF" },
  { id: "lobbies", label: "Lobbies", icon: "🏛️", minRole: "STAFF" },
  { id: "events", label: "Events", icon: "📅", minRole: "STAFF" },
  { id: "broadcast", label: "Broadcast", icon: "📢", minRole: "STAFF" },
  { id: "reports", label: "Reports", icon: "🚩", minRole: "SUPPORT" },
  { id: "appeals", label: "Ban Appeals", icon: "⚖️", minRole: "SUPPORT" },
  { id: "bugs", label: "Bug Reports", icon: "🐛", minRole: "SUPPORT" },
  { id: "audit", label: "Audit Log", icon: "📋", minRole: "STAFF" },
  { id: "outreach", label: "Outreach", icon: "📧", minRole: "STAFF" },
  { id: "mods", label: "Mods", icon: "🪝", minRole: "SUPPORT" },
  { id: "permissions", label: "Permissions", icon: "🔑", minRole: "SUPPORT" },
  { id: "files", label: "Files", icon: "🗂️", minRole: "GOD" },
  { id: "config", label: "Config", icon: "⚙️", minRole: "GOD" },
] as const;

export type NavId = (typeof NAV_ITEMS)[number]["id"];

export const ROLE_RANK: Record<string, number> = { SUPPORT: 1, STAFF: 2, ADMIN: 2, GOD: 3 };

export function canSeeNav(myRole: GlobalRole, minRole: string) {
  return (ROLE_RANK[myRole] || 0) >= (ROLE_RANK[minRole] || 99);
}

export type PermRow = { name: string; can: string };
export type PermBlockData = { title: string; subtitle: string; accent: string; rows: PermRow[] };

export const PERM_SCOPES: PermBlockData[] = [
  {
    title: "Global Roles",
    subtitle: "Platform-wide authority",
    accent: "#a78bfa",
    rows: [
      { name: "USER", can: "Baseline. Join lobbies, chat, voice, DMs, crews." },
      {
        name: "SUPPORT",
        can: "View the Ops console (read). Handle reports, ban appeals, bug reports, mods.",
      },
      {
        name: "STAFF",
        can: "All Support powers + assign roles, manage rooms/lobbies/events/subscriptions, broadcast, view audit + analytics + outreach.",
      },
      {
        name: "ADMIN",
        can: "Same authority tier as Staff (assigns roles + all Staff sections). Reserved for senior operators.",
      },
      {
        name: "GOD",
        can: "Unrestricted. Files + Config sections. Protected from moderation actions by others.",
      },
    ],
  },
  {
    title: "Lobby Roles",
    subtitle: "Per-lobby · 5-level ladder",
    accent: "#34d399",
    rows: [
      { name: "1 · Member", can: "Participate in the lobby and its rooms." },
      { name: "2 · Trusted", can: "View lobby admin panels (read)." },
      { name: "3 · Moderator", can: "Moderate: kick, mute, clear chat within the lobby." },
      { name: "4 · Admin", can: "Manage the lobby: rename, settings, rooms, events, modules." },
      {
        name: "5 · Owner",
        can: "Full control: billing + paid tiers, transfer, destructive actions.",
      },
    ],
  },
  {
    title: "Room Roles",
    subtitle: "Per-room",
    accent: "#60a5fa",
    rows: [
      { name: "MEMBER", can: "Chat + voice in the room." },
      { name: "MOD", can: "Kick, clear messages, lock the room." },
      { name: "OWNER", can: "Full room control. (Global Staff+ overrides.)" },
    ],
  },
  {
    title: "Crew Roles",
    subtitle: "Per-crew",
    accent: "#fbbf24",
    rows: [
      { name: "MEMBER", can: "Crew member." },
      { name: "OFFICER", can: "Help run the crew." },
      { name: "LEADER", can: "Full crew control." },
    ],
  },
];

export const PERM_TIERS: PermBlockData[] = [
  {
    title: "Reputation Tier",
    subtitle: "Earned — standing / notoriety",
    accent: "#d4a017",
    rows: [
      { name: "INNOCENT", can: "Starting standing." },
      { name: "INDICTED", can: "Rising notoriety." },
      { name: "FELON", can: "Established." },
      { name: "KINGPIN", can: "Top reputation." },
    ],
  },
  {
    title: "Paid Tier",
    subtitle: "Billing — perks",
    accent: "#ec4899",
    rows: [
      { name: "FREE", can: "Default. (Reputation: Innocent.)" },
      { name: "INDICTED · $6/mo", can: "Colored username, video streaming, custom fonts." },
      { name: "FELON · $14/mo", can: "Above + own up to 3 lobbies." },
      { name: "KINGPIN · staff-granted", can: "Unlimited lobbies + all modules." },
    ],
  },
];

export function PermBlock({ s }: { s: PermBlockData }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,.02)",
        border: "1px solid rgba(255,255,255,.07)",
        borderRadius: 12,
        overflow: "hidden",
        marginBottom: 14,
      }}
    >
      <div
        style={{
          padding: "10px 14px",
          borderLeft: `3px solid ${s.accent}`,
          background: `${s.accent}10`,
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: "rgba(243,244,246,.95)",
            letterSpacing: ".3px",
          }}
        >
          {s.title}
        </div>
        <div style={{ fontSize: 11, color: "rgba(148,163,184,.7)", marginTop: 1 }}>
          {s.subtitle}
        </div>
      </div>
      <div>
        {s.rows.map((r, i) => (
          <div
            key={r.name}
            style={{
              display: "flex",
              gap: 12,
              padding: "9px 14px",
              borderTop: i ? "1px solid rgba(255,255,255,.04)" : "none",
              alignItems: "baseline",
            }}
          >
            <div
              style={{
                flex: "0 0 158px",
                fontSize: 12,
                fontWeight: 700,
                color: s.accent,
                fontFamily: "ui-monospace, monospace",
              }}
            >
              {r.name}
            </div>
            <div
              style={{ flex: 1, fontSize: 12, color: "rgba(203,213,225,.85)", lineHeight: 1.45 }}
            >
              {r.can}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
