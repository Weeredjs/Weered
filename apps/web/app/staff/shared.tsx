"use client";
import { API, authHeaders, apiFetch } from "../../lib/apiClient";
export { API, authHeaders, apiFetch };
import React from "react";
import {
  Bug,
  ChartColumn,
  CreditCard,
  DoorOpen,
  Flag,
  IdCard,
  Landmark,
  Mail,
  Megaphone,
  Puzzle,
  Scale,
  ScrollText,
  Settings,
  StickyNote,
  Sun,
  Users,
  type LucideIcon,
} from "lucide-react";

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
  /** A lobby's own chat, an admin chat, ops chat, or an ordinary room (lib/roomKinds.ts). */
  kind?: "ops" | "admin" | "lobby" | "room";
  locked: boolean;
  members: number;
  lobbyId?: string | null;
  lobbyName?: string | null;
  createdAt: string;
  pinned?: boolean;
  liveUsers?: number;
  lastActiveAt?: number | null;
};
export type StaffLobby = {
  id: string;
  name: string;
  description?: string;
  verified: boolean;
  pinned: boolean;
  moduleType: string;
  /** Who is in the lobby's rooms now (it used to be the member count). */
  onlineCount: number;
  members?: number;
  locked?: boolean;
  unlisted?: boolean;
};
export type SiteConfig = {
  featuredLobbyId: string;
  registrationOpen: boolean;
  /** Most real accounts (0 = no cap); accounts and waitlist are read-only. */
  registrationCap: number;
  accounts?: number;
  waitlist?: number;
  maintenanceMode: boolean;
  aiEnabled: boolean;
  defaultTier: UserTier;
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

// Inline styles for every ops tab, in the ops palette (57-ops.css sets the
// --o-* channels from the viewer's colourway; violet if none).
const BTN: React.CSSProperties = {
  padding: "6px 13px",
  borderRadius: 999,
  border: "1px solid rgb(255 255 255 / .10)",
  background: "rgb(255 255 255 / .04)",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  color: "var(--o-text, rgba(243,244,246,.9))",
};
const tone = (rgb: string, color: string): React.CSSProperties => ({
  ...BTN,
  border: `1px solid rgb(${rgb} / .32)`,
  background: `rgb(${rgb} / .09)`,
  color,
});

export const S = {
  card: {
    borderRadius: 12,
    border: "1px solid rgb(255 255 255 / .08)",
    background: "var(--o-glass, rgba(255,255,255,.03))",
    padding: "11px 14px",
  } as React.CSSProperties,
  cardHov: {
    borderRadius: 12,
    border: "1px solid rgb(var(--o-a) / .38)",
    background: "rgb(var(--o-a) / .08)",
    padding: "11px 14px",
  } as React.CSSProperties,
  btn: BTN,
  btnPri: {
    ...BTN,
    border: "1px solid rgb(var(--o-a) / .42)",
    background: "rgb(var(--o-a) / .14)",
    color: "var(--o-hi, rgb(216,180,254))",
  } as React.CSSProperties,
  danger: tone("var(--o-bad)", "rgb(252 165 165)"),
  warn: tone("var(--o-warn)", "rgb(253 230 138)"),
  success: tone("var(--o-ok)", "rgb(110 231 183)"),
  input: {
    width: "100%",
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid rgb(255 255 255 / .10)",
    background: "rgb(0 0 0 / .28)",
    fontSize: 13,
    color: "var(--o-text, rgba(243,244,246,.92))",
    outline: "none",
    boxSizing: "border-box" as const,
  },
  label: {
    fontSize: 11,
    fontWeight: 700,
    color: "var(--o-dim, rgba(203,200,230,.66))",
    letterSpacing: ".12em",
    textTransform: "uppercase" as const,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: "var(--o-dim, rgba(203,200,230,.66))",
    letterSpacing: ".12em",
    textTransform: "uppercase" as const,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottom: "1px solid var(--o-line, rgba(255,255,255,.07))",
  },
};

export type NavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  minRole: GlobalRole;
  /** The heading it sits under; Today and Board sit above the groups. */
  group: "" | "People" | "Places" | "Safety" | "Outreach" | "System";
  /** One line under the page title. */
  blurb: string;
};

// The ops navigation (2026-11-02 rebuild): Today and the staff board, then
// five groups. Events and Files were cut the same day (James: events never
// showed on the site; Files was a placeholder).
export const NAV_ITEMS = [
  {
    id: "today",
    label: "Today",
    icon: Sun,
    minRole: "SUPPORT",
    group: "",
    blurb: "What needs a person now, and how Weered is doing.",
  },
  {
    id: "board",
    label: "Board",
    icon: StickyNote,
    minRole: "SUPPORT",
    group: "",
    blurb: "Notes for the staff team.",
  },
  {
    id: "users",
    label: "Users",
    icon: Users,
    minRole: "SUPPORT",
    group: "People",
    blurb: "Find anyone: roles, bans, notes.",
  },
  {
    id: "roster",
    label: "Roster",
    icon: IdCard,
    minRole: "SUPPORT",
    group: "People",
    blurb: "Weered's staff, and who can do what.",
  },
  {
    id: "subs",
    label: "Subscriptions",
    icon: CreditCard,
    minRole: "STAFF",
    group: "People",
    blurb: "Everyone who holds a tier, paid or given by staff.",
  },
  {
    id: "lobbies",
    label: "Lobbies",
    icon: Landmark,
    minRole: "STAFF",
    group: "Places",
    blurb: "Every lobby: feature, pin, lock.",
  },
  {
    id: "rooms",
    label: "Rooms",
    icon: DoorOpen,
    minRole: "STAFF",
    group: "Places",
    blurb: "Rooms across Weered.",
  },
  {
    id: "mods",
    label: "Mods",
    icon: Puzzle,
    minRole: "SUPPORT",
    group: "Places",
    blurb: "Community mods: review and hide.",
  },
  {
    id: "reports",
    label: "Reports",
    icon: Flag,
    minRole: "SUPPORT",
    group: "Safety",
    blurb: "What members have reported.",
  },
  {
    id: "appeals",
    label: "Ban Appeals",
    icon: Scale,
    minRole: "SUPPORT",
    group: "Safety",
    blurb: "Banned members asking to come back.",
  },
  {
    id: "bugs",
    label: "Bug Reports",
    icon: Bug,
    minRole: "SUPPORT",
    group: "Safety",
    blurb: "Bugs, requests and feedback from members.",
  },
  {
    id: "audit",
    label: "Audit Log",
    icon: ScrollText,
    minRole: "STAFF",
    group: "Safety",
    blurb: "What staff have done.",
  },
  {
    id: "outreach",
    label: "Outreach",
    icon: Mail,
    minRole: "STAFF",
    group: "Outreach",
    blurb: "Contacts and follow-ups.",
  },
  {
    id: "broadcast",
    label: "Broadcast",
    icon: Megaphone,
    minRole: "STAFF",
    group: "Outreach",
    blurb: "Announcements and site-wide messages.",
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: ChartColumn,
    minRole: "STAFF",
    group: "System",
    blurb: "Accounts, activity and lobbies.",
  },
  {
    id: "config",
    label: "Config",
    icon: Settings,
    minRole: "GOD",
    group: "System",
    blurb: "Site switches.",
  },
] as const satisfies readonly NavItem[];

export const NAV_GROUPS = ["", "People", "Places", "Safety", "Outreach", "System"] as const;

export type NavId = (typeof NAV_ITEMS)[number]["id"];

export const ROLE_RANK: Record<string, number> = { SUPPORT: 1, STAFF: 2, ADMIN: 2, GOD: 3 };

export function canSeeNav(myRole: GlobalRole, minRole: string) {
  return (ROLE_RANK[myRole] || 0) >= (ROLE_RANK[minRole] || 99);
}

// Weered's staff ladder, the same rule as apps/api/src/lib/roleLadder.ts: you
// act only on people below you, and give only roles below your own. STAFF and
// ADMIN share a rung; only GOD makes or removes staff.
const LADDER: Record<string, number> = { USER: 0, SUPPORT: 1, STAFF: 2, ADMIN: 2, GOD: 3 };
const ALL_ROLES: GlobalRole[] = ["USER", "SUPPORT", "STAFF", "ADMIN", "GOD"];

export function rolesToGive(actor: GlobalRole): GlobalRole[] {
  if (actor === "GOD") return ALL_ROLES;
  if (actor === "STAFF" || actor === "ADMIN")
    return ALL_ROLES.filter((r) => LADDER[r] < LADDER[actor]);
  return [];
}

export function mayActOn(actor: GlobalRole, target: string): boolean {
  return actor === "GOD" || (LADDER[target] ?? 0) < LADDER[actor];
}

/** What the server's refusals mean, for people. */
export const STAFF_ERRORS: Record<string, string> = {
  insufficient_rank: "Your role can't do that to this person.",
  cannot_change_self: "You can't change your own role.",
  cannot_kick_self: "You can't kick yourself.",
  cannot_ban_self: "You can't ban yourself.",
  cannot_kick_god: "God accounts can't be kicked.",
  cannot_ban_god: "God accounts can't be banned.",
  forbidden: "Your role can't do that.",
};
