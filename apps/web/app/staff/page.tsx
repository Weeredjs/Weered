"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWeered, useRoomUsers } from "../../components/WeeredProvider";
import LobbyChatPanel from "../../components/LobbyChatPanel";
import AnalyticsTab from "../../components/AnalyticsTab";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

type GlobalRole = "USER" | "SUPPORT" | "STAFF" | "ADMIN" | "GOD";
type UserTier = "INNOCENT" | "INDICTED" | "FELON" | "KINGPIN";
type StaffUser = {
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
type AuditLog = {
  id: string;
  actorName: string;
  action: string;
  targetName?: string;
  meta?: any;
  createdAt: string;
};
type StaffNote = { id: string; authorName: string; body: string; createdAt: string };
type StaffRoom = {
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
type StaffLobby = {
  id: string;
  name: string;
  description?: string;
  verified: boolean;
  pinned: boolean;
  moduleType: string;
  onlineCount: number;
};
type SiteConfig = {
  featuredLobbyId: string;
  registrationOpen: boolean;
  maintenanceMode: boolean;
  aiEnabled: boolean;
  defaultTier: UserTier;
  maxRoomsPerLobby: number;
  chatRateLimit: number;
};

function fmtDate(s: string) {
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

function roleColor(r: string) {
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

function tierColor(t: string) {
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

function RoleBadge({ role }: { role: string }) {
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

function TierBadge({ tier }: { tier: string }) {
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

function BannedBadge() {
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

function authHeaders(): Record<string, string> {
  try {
    const t = localStorage.getItem("weered_token") || "";
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(opts?.headers || {}) },
  });
  return r.json();
}

const S = {
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

const NAV_ITEMS = [
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

type NavId = (typeof NAV_ITEMS)[number]["id"];

const ROLE_RANK: Record<string, number> = { SUPPORT: 1, STAFF: 2, ADMIN: 2, GOD: 3 };

function canSeeNav(myRole: GlobalRole, minRole: string) {
  return (ROLE_RANK[myRole] || 0) >= (ROLE_RANK[minRole] || 99);
}

type PermRow = { name: string; can: string };
type PermBlockData = { title: string; subtitle: string; accent: string; rows: PermRow[] };

const PERM_SCOPES: PermBlockData[] = [
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

const PERM_TIERS: PermBlockData[] = [
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

function PermBlock({ s }: { s: PermBlockData }) {
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

function PermissionsTab() {
  return (
    <div style={{ maxWidth: 840 }}>
      <div
        style={{ fontSize: 12, color: "rgba(148,163,184,.78)", lineHeight: 1.55, marginBottom: 16 }}
      >
        Weered uses{" "}
        <strong style={{ color: "rgba(243,244,246,.9)" }}>
          hierarchical levels across four independent scopes
        </strong>{" "}
        &mdash; each level is a strict superset of the one below it (no &agrave;-la-carte permission
        flags like Discord). One user can hold a role in each scope at once: e.g. global{" "}
        <em>Support</em> + <em>Owner</em> of their own lobby + <em>Member</em> elsewhere. The two
        tier systems are separate axes that happen to share the crime-ladder naming.
      </div>
      {PERM_SCOPES.map((s) => (
        <PermBlock key={s.title} s={s} />
      ))}
      <div style={{ height: 6 }} />
      {PERM_TIERS.map((s) => (
        <PermBlock key={s.title} s={s} />
      ))}
    </div>
  );
}

function OpsPresence() {
  const ctx = useWeered() as any;
  const users: any[] = useRoomUsers(ctx?.activeRoomId);
  return (
    <div>
      <div style={S.label}>Online in Ops</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {users.length === 0 && <div style={{ fontSize: 11, opacity: 0.35 }}>No one else here.</div>}
        {users.map((u: any, i: number) => {
          const name = String(u?.name ?? "?");
          const rc = roleColor(String(u?.globalRole ?? u?.role ?? "USER").toUpperCase());
          return (
            <div
              key={u?.id ?? i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "6px 8px",
                borderRadius: 8,
                background: "rgba(255,255,255,.03)",
                border: "1px solid rgba(255,255,255,.06)",
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 999,
                  background: "rgba(124,58,237,.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {name.slice(0, 1).toUpperCase()}
              </div>
              <div
                style={{
                  minWidth: 0,
                  flex: 1,
                  fontSize: 12,
                  fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {name}
              </div>
              <span
                style={{
                  fontSize: 9,
                  padding: "1px 5px",
                  borderRadius: 999,
                  background: rc.bg,
                  border: `1px solid ${rc.border}`,
                  color: rc.color,
                  flexShrink: 0,
                }}
              >
                {String(u?.globalRole ?? u?.role ?? "")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function UsersTab({ myRole }: { myRole: GlobalRole }) {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<StaffUser | null>(null);
  const [notes, setNotes] = useState<StaffNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [msg, setMsg] = useState("");
  const [banReason, setBanReason] = useState("");

  const canEdit = myRole !== "SUPPORT";
  const canGod = myRole === "GOD";
  const canBan = myRole === "STAFF" || myRole === "ADMIN" || myRole === "GOD";

  const search = useCallback(async () => {
    setLoading(true);
    try {
      const j = await apiFetch(`/staff/users?q=${encodeURIComponent(q)}`);
      setUsers(j.users || []);
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    void search();
  }, []);

  async function loadNotes(u: StaffUser) {
    setSelected(u);
    setNotes([]);
    setBanReason("");
    const j = await apiFetch(`/staff/users/${u.id}/notes`);
    setNotes(j.notes || []);
  }

  async function addNote() {
    if (!selected || !newNote.trim()) return;
    const j = await apiFetch(`/staff/users/${selected.id}/note`, {
      method: "POST",
      body: JSON.stringify({ body: newNote.trim() }),
    });
    if (j.ok) {
      setNewNote("");
      setMsg("Note saved.");
      loadNotes(selected);
    } else setMsg(j.error || "Failed.");
  }

  async function setRole(userId: string, role: string) {
    const j = await apiFetch(`/staff/users/${userId}/role`, {
      method: "POST",
      body: JSON.stringify({ role }),
    });
    if (j.ok) {
      setMsg(`Role → ${role}`);
      search();
      if (selected?.id === userId)
        setSelected((s) => (s ? { ...s, globalRole: role as GlobalRole } : s));
    } else setMsg(j.error || "Failed.");
  }

  async function kickUser(userId: string, name: string) {
    if (!confirm(`Global kick ${name}?`)) return;
    const j = await apiFetch(`/staff/users/${userId}/kick`, { method: "POST" });
    setMsg(j.ok ? `Kicked ${name}` : j.error || "Failed.");
  }

  async function banUser(userId: string, name: string) {
    if (!confirm(`Globally BAN ${name}? This will block them from the entire platform.`)) return;
    const j = await apiFetch(`/staff/users/${userId}/ban`, {
      method: "POST",
      body: JSON.stringify({ reason: banReason.trim() }),
    });
    if (j.ok) {
      setMsg(`Banned ${name}`);
      setBanReason("");
      search();
      if (selected?.id === userId)
        setSelected((s) => (s ? { ...s, banned: true, banReason: banReason.trim() } : s));
    } else setMsg(j.error || "Failed.");
  }

  async function unbanUser(userId: string, name: string) {
    if (!confirm(`Unban ${name}?`)) return;
    const j = await apiFetch(`/staff/users/${userId}/ban`, { method: "DELETE" });
    if (j.ok) {
      setMsg(`Unbanned ${name}`);
      search();
      if (selected?.id === userId)
        setSelected((s) => (s ? { ...s, banned: false, banReason: undefined } : s));
    } else setMsg(j.error || "Failed.");
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1.2fr",
        gap: 16,
        alignItems: "start",
        height: "100%",
      }}
    >
      <div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input
            style={{ ...S.input, flex: 1 }}
            placeholder="Search by name or handle…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
          />
          <button style={S.btn} onClick={search}>
            {loading ? "…" : "Search"}
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {users.map((u) => (
            <div
              key={u.id}
              onClick={() => loadNotes(u)}
              style={{ ...(selected?.id === u.id ? S.cardHov : S.card), cursor: "pointer" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 13,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {u.name || u.usernameKey}
                    {u.banned && <BannedBadge />}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.45, marginTop: 1 }}>
                    @{u.usernameKey} · {fmtDate(u.createdAt)}
                  </div>
                </div>
                <RoleBadge role={u.globalRole} />
              </div>
            </div>
          ))}
          {!users.length && !loading && (
            <div style={{ opacity: 0.4, fontSize: 13 }}>No users found.</div>
          )}
        </div>
      </div>

      {selected ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={S.card}>
            <div style={S.sectionTitle}>Identity</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 999,
                  background: "rgba(124,58,237,.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                  fontWeight: 800,
                }}
              >
                {(selected.name || selected.usernameKey).slice(0, 1).toUpperCase()}
              </div>
              <div>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: 15,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  {selected.name || selected.usernameKey}
                  {selected.banned && <BannedBadge />}
                </div>
                <div style={{ fontSize: 11, opacity: 0.5 }}>@{selected.usernameKey}</div>
                {selected.email && (
                  <div style={{ fontSize: 11, opacity: 0.45, marginTop: 2 }}>{selected.email}</div>
                )}
              </div>
              <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                <RoleBadge role={selected.globalRole} />
              </div>
            </div>
            <div style={{ fontSize: 11, opacity: 0.4 }}>
              ID: <span style={{ fontFamily: "monospace" }}>{selected.id}</span>
            </div>
            <div style={{ fontSize: 11, opacity: 0.4, marginTop: 2 }}>
              Joined: {fmtDate(selected.createdAt)}
            </div>
            {selected.banned && selected.banReason && (
              <div
                style={{
                  fontSize: 11,
                  color: "rgba(252,165,165,.80)",
                  marginTop: 6,
                  padding: "6px 10px",
                  borderRadius: 6,
                  background: "rgba(239,68,68,.06)",
                  border: "1px solid rgba(239,68,68,.15)",
                }}
              >
                Ban reason: {selected.banReason}
              </div>
            )}
          </div>

          {canEdit && (
            <div style={S.card}>
              <div style={S.sectionTitle}>Role Actions</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button style={S.btn} onClick={() => setRole(selected.id, "SUPPORT")}>
                  → SUPPORT
                </button>
                <button style={S.btn} onClick={() => setRole(selected.id, "STAFF")}>
                  → STAFF
                </button>
                <button style={S.btn} onClick={() => setRole(selected.id, "USER")}>
                  → USER
                </button>
                {canGod && (
                  <button
                    style={{
                      ...S.btn,
                      borderColor: "rgba(245,158,11,.30)",
                      color: "rgb(253,230,138)",
                    }}
                    onClick={() => setRole(selected.id, "GOD")}
                  >
                    → GOD
                  </button>
                )}
                <button style={S.danger} onClick={() => kickUser(selected.id, selected.name)}>
                  Global Kick
                </button>
              </div>
              {msg && <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>{msg}</div>}
            </div>
          )}

          {canBan && (
            <div style={S.card}>
              <div style={S.sectionTitle}>Global Ban</div>
              {selected.banned ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: 12, color: "rgba(252,165,165,.80)" }}>
                    This user is currently banned from the platform.
                  </div>
                  <button style={S.success} onClick={() => unbanUser(selected.id, selected.name)}>
                    Unban User
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <input
                    style={S.input}
                    placeholder="Ban reason (optional)…"
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                  />
                  <div style={{ display: "flex", gap: 6 }}>
                    <button style={S.danger} onClick={() => banUser(selected.id, selected.name)}>
                      Ban from Platform
                    </button>
                  </div>
                  <div style={{ fontSize: 10, opacity: 0.35 }}>
                    Banning disconnects the user from all rooms and prevents login.
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={S.card}>
            <div style={S.sectionTitle}>Staff Notes</div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                marginBottom: 10,
                maxHeight: 180,
                overflowY: "auto",
              }}
            >
              {notes.length === 0 && (
                <div style={{ fontSize: 12, opacity: 0.4 }}>No notes yet.</div>
              )}
              {notes.map((n) => (
                <div
                  key={n.id}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: "rgba(255,255,255,.03)",
                    border: "1px solid rgba(255,255,255,.07)",
                  }}
                >
                  <div style={{ fontSize: 12 }}>{n.body}</div>
                  <div style={{ fontSize: 10, opacity: 0.4, marginTop: 4 }}>
                    {n.authorName} · {fmtDate(n.createdAt)}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <textarea
                style={{ ...S.input, resize: "vertical", minHeight: 60, flex: 1 }}
                placeholder="Add a staff note…"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
              />
              <button style={{ ...S.btnPri, alignSelf: "flex-end" }} onClick={addNote}>
                Save
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: 200,
            opacity: 0.3,
            fontSize: 13,
          }}
        >
          Select a user to view details
        </div>
      )}
    </div>
  );
}

function SubsTab() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [filter, setFilter] = useState<UserTier | "ALL">("ALL");

  useEffect(() => {
    setLoading(true);
    apiFetch("/staff/subscriptions").then((j) => {
      setUsers(j.users || []);
      setLoading(false);
    });
  }, []);

  async function setTier(userId: string, tier: UserTier) {
    const j = await apiFetch(`/staff/users/${userId}/tier`, {
      method: "POST",
      body: JSON.stringify({ tier }),
    });
    if (j.ok) {
      setMsg(`Tier updated to ${tier}`);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, tier } : u)));
    } else setMsg(j.error || "Failed.");
  }

  const TIERS: UserTier[] = ["INNOCENT", "INDICTED", "FELON", "KINGPIN"];
  const filtered = filter === "ALL" ? users : users.filter((u) => u.tier === filter);

  const counts = TIERS.reduce(
    (acc, t) => ({ ...acc, [t]: users.filter((u) => u.tier === t).length }),
    {} as Record<string, number>,
  );

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 10,
          marginBottom: 20,
        }}
      >
        {TIERS.map((t) => {
          const c = tierColor(t);
          return (
            <div
              key={t}
              style={{
                padding: "14px",
                borderRadius: 10,
                border: `1px solid ${c.border}`,
                background: c.bg,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 800, color: c.color }}>{counts[t] || 0}</div>
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{t}</div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {(["ALL", ...TIERS] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            style={{
              ...S.btn,
              background: filter === t ? "rgba(124,58,237,.15)" : "rgba(255,255,255,.04)",
              borderColor: filter === t ? "rgba(124,58,237,.35)" : "rgba(255,255,255,.10)",
              color: filter === t ? "rgb(216,180,254)" : "rgba(243,244,246,.65)",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {msg && <div style={{ marginBottom: 10, fontSize: 12, opacity: 0.7 }}>{msg}</div>}

      {loading && <div style={{ opacity: 0.4 }}>Loading…</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {filtered.map((u) => (
          <div key={u.id} style={{ ...S.card, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{u.name || u.usernameKey}</div>
              <div style={{ fontSize: 11, opacity: 0.45, marginTop: 1 }}>
                @{u.usernameKey} · {u.notoriety} notoriety
              </div>
            </div>
            <TierBadge tier={u.tier} />
            <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
              {TIERS.filter((t) => t !== u.tier).map((t) => (
                <button
                  key={t}
                  style={{ ...S.btn, fontSize: 11, padding: "4px 8px" }}
                  onClick={() => setTier(u.id, t)}
                >
                  → {t}
                </button>
              ))}
            </div>
          </div>
        ))}
        {!filtered.length && !loading && (
          <div style={{ opacity: 0.4, fontSize: 13 }}>No users.</div>
        )}
      </div>
    </div>
  );
}

function RoomsTab({ myRole }: { myRole: GlobalRole }) {
  const [rooms, setRooms] = useState<StaffRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const canEdit = myRole === "STAFF" || myRole === "ADMIN" || myRole === "GOD";

  useEffect(() => {
    setLoading(true);
    apiFetch("/staff/rooms").then((j) => {
      setRooms(j.rooms || []);
      setLoading(false);
    });
  }, []);

  async function renameRoom(id: string) {
    const name = editName.trim();
    if (!name) return;
    const j = await apiFetch(`/staff/rooms/${encodeURIComponent(id)}/rename`, {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    if (j.ok) {
      setMsg(`Renamed → ${name}`);
      setRooms((prev) => prev.map((r) => (r.id === id ? { ...r, name } : r)));
      setEditId(null);
      setEditName("");
    } else setMsg(j.error || "Failed.");
  }

  async function togglePin(id: string, currentlyPinned: boolean) {
    const j = await apiFetch(`/staff/rooms/${encodeURIComponent(id)}/pin`, {
      method: "POST",
      body: JSON.stringify({ pinned: !currentlyPinned }),
    });
    if (j.ok) {
      setMsg(`${!currentlyPinned ? "Pinned" : "Unpinned"} room`);
      setRooms((prev) => prev.map((r) => (r.id === id ? { ...r, pinned: !currentlyPinned } : r)));
    } else setMsg(j.error || "Failed.");
  }

  async function closeRoom(id: string, name: string) {
    if (!confirm(`Close room "${name || id}"? This will kick all users and delete the room.`))
      return;
    const j = await apiFetch(`/staff/rooms/${encodeURIComponent(id)}/close`, { method: "POST" });
    if (j.ok) {
      setMsg(`Closed ${name || id}`);
      setRooms((prev) => prev.filter((r) => r.id !== id));
    } else setMsg(j.error || "Failed.");
  }

  async function deleteRoom(id: string, name: string) {
    if (!confirm(`Delete room "${name || id}" from database?`)) return;
    const j = await apiFetch(`/staff/rooms/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (j.ok) {
      setMsg(`Deleted ${name || id}`);
      setRooms((prev) => prev.filter((r) => r.id !== id));
    } else setMsg(j.error || "Failed.");
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: 13, opacity: 0.6 }}>{rooms.length} rooms total</div>
        {msg && <div style={{ fontSize: 12, opacity: 0.7 }}>{msg}</div>}
      </div>
      {loading && <div style={{ opacity: 0.4 }}>Loading…</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rooms.map((r) => {
          const isPinned = Boolean((r as any).pinned);
          const liveUsers = (r as any).liveUsers || 0;
          const isEditing = editId === r.id;

          return (
            <div
              key={r.id}
              style={{
                ...S.card,
                borderColor: isPinned ? "rgba(245,158,11,.30)" : undefined,
                background: isPinned ? "rgba(245,158,11,.03)" : undefined,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: canEdit ? 8 : 0,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  {isEditing ? (
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input
                        style={{ ...S.input, flex: 1, fontSize: 13, fontWeight: 700 }}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && renameRoom(r.id)}
                        autoFocus
                      />
                      <button
                        style={{ ...S.btnPri, fontSize: 11, padding: "4px 8px" }}
                        onClick={() => renameRoom(r.id)}
                      >
                        Save
                      </button>
                      <button
                        style={{ ...S.btn, fontSize: 11, padding: "4px 8px" }}
                        onClick={() => {
                          setEditId(null);
                          setEditName("");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 13,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      {r.name || <span style={{ opacity: 0.4 }}>(unnamed)</span>}
                      {r.locked && (
                        <span
                          style={{
                            fontSize: 10,
                            padding: "1px 5px",
                            borderRadius: 999,
                            border: "1px solid rgba(239,68,68,.30)",
                            color: "rgba(252,165,165,.80)",
                            background: "rgba(239,68,68,.08)",
                          }}
                        >
                          LOCKED
                        </span>
                      )}
                      {isPinned && (
                        <span
                          style={{
                            fontSize: 9,
                            padding: "1px 5px",
                            borderRadius: 999,
                            border: "1px solid rgba(245,158,11,.40)",
                            color: "rgb(253,230,138)",
                            background: "rgba(245,158,11,.12)",
                            fontWeight: 800,
                          }}
                        >
                          📌 PINNED
                        </span>
                      )}
                      {liveUsers > 0 && (
                        <span
                          style={{
                            fontSize: 9,
                            padding: "1px 5px",
                            borderRadius: 999,
                            border: "1px solid rgba(34,197,94,.30)",
                            color: "rgba(134,239,172,.85)",
                            background: "rgba(34,197,94,.08)",
                          }}
                        >
                          ● {liveUsers} live
                        </span>
                      )}
                    </div>
                  )}
                  <div
                    style={{ fontSize: 11, opacity: 0.4, marginTop: 2, fontFamily: "monospace" }}
                  >
                    {r.id}
                    {r.lobbyId ? ` · lobby: ${r.lobbyId}` : ""} · {r.members} members ·{" "}
                    {fmtDate(r.createdAt)}
                  </div>
                </div>
              </div>
              {canEdit && !isEditing && (
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  <button
                    style={{ ...S.btn, fontSize: 11, padding: "4px 8px" }}
                    onClick={() => {
                      setEditId(r.id);
                      setEditName(r.name);
                    }}
                  >
                    Rename
                  </button>
                  <button
                    style={{
                      ...S.btn,
                      fontSize: 11,
                      padding: "4px 8px",
                      borderColor: isPinned ? "rgba(245,158,11,.50)" : "rgba(245,158,11,.25)",
                      color: "rgb(253,230,138)",
                      fontWeight: isPinned ? 800 : 400,
                    }}
                    onClick={() => togglePin(r.id, isPinned)}
                  >
                    {isPinned ? "📌 Unpin" : "Pin"}
                  </button>
                  <button
                    style={{ ...S.warn, fontSize: 11, padding: "4px 8px" }}
                    onClick={() => closeRoom(r.id, r.name)}
                  >
                    Close Room
                  </button>
                  <button
                    style={{ ...S.danger, fontSize: 11, padding: "4px 8px" }}
                    onClick={() => deleteRoom(r.id, r.name)}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {!rooms.length && !loading && (
          <div style={{ opacity: 0.4, fontSize: 13 }}>No rooms found.</div>
        )}
      </div>
    </div>
  );
}

function LobbiesTab({ myRole }: { myRole: GlobalRole }) {
  const [lobbies, setLobbies] = useState<StaffLobby[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [featuredId, setFeaturedId] = useState("");
  const canEdit = myRole === "STAFF" || myRole === "ADMIN" || myRole === "GOD";

  useEffect(() => {
    setLoading(true);
    Promise.all([apiFetch("/staff/lobbies"), apiFetch("/staff/featured")]).then(
      ([lobbyData, featData]) => {
        setLobbies(lobbyData.lobbies || []);
        setFeaturedId(featData.featuredLobbyId || "");
        setLoading(false);
      },
    );
  }, []);

  async function togglePin(id: string, pinned: boolean) {
    const j = await apiFetch(`/staff/lobbies/${encodeURIComponent(id)}/pin`, {
      method: "POST",
      body: JSON.stringify({ pinned: !pinned }),
    });
    if (j.ok) {
      setMsg(`${!pinned ? "Pinned" : "Unpinned"} ${id}`);
      setLobbies((prev) => prev.map((l) => (l.id === id ? { ...l, pinned: !pinned } : l)));
    } else setMsg(j.error || "Failed.");
  }

  async function setFeatured(id: string) {
    const clearing = featuredId === id;
    const j = await apiFetch("/staff/featured", {
      method: "POST",
      body: JSON.stringify({ lobbyId: clearing ? "" : id }),
    });
    if (j.ok) {
      setFeaturedId(clearing ? "" : id);
      setMsg(clearing ? "Featured cleared" : `Featured → ${id}`);
    } else setMsg(j.error || "Failed.");
  }

  async function lockLobby(id: string) {
    const j = await apiFetch("/staff/lobby/lock", {
      method: "POST",
      body: JSON.stringify({ lobbyId: id }),
    });
    setMsg(j.ok ? `Locked ${id}` : j.error || "Failed.");
  }

  async function unlockLobby(id: string) {
    const j = await apiFetch("/staff/lobby/unlock", {
      method: "POST",
      body: JSON.stringify({ lobbyId: id }),
    });
    setMsg(j.ok ? `Unlocked ${id}` : j.error || "Failed.");
  }

  async function clearChat(id: string) {
    if (!confirm(`Clear all chat in ${id}?`)) return;
    const j = await apiFetch("/staff/lobby/clear-chat", {
      method: "POST",
      body: JSON.stringify({ lobbyId: id }),
    });
    setMsg(j.ok ? `Chat cleared in ${id}` : j.error || "Failed.");
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 13, opacity: 0.6 }}>{lobbies.length} lobbies</div>
          {featuredId && (
            <span
              style={{
                fontSize: 10,
                padding: "2px 8px",
                borderRadius: 999,
                background: "rgba(245,158,11,.12)",
                border: "1px solid rgba(245,158,11,.30)",
                color: "rgb(253,230,138)",
                fontWeight: 700,
              }}
            >
              Featured: {featuredId}
            </span>
          )}
        </div>
        {msg && <div style={{ fontSize: 12, opacity: 0.7 }}>{msg}</div>}
      </div>
      {loading && <div style={{ opacity: 0.4 }}>Loading…</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {lobbies.map((l) => {
          const isFeatured = featuredId === l.id;
          return (
            <div
              key={l.id}
              style={{
                ...S.card,
                borderColor: isFeatured ? "rgba(245,158,11,.35)" : undefined,
                background: isFeatured ? "rgba(245,158,11,.04)" : undefined,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: canEdit ? 8 : 0,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 13,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    {l.name || l.id}
                    {l.pinned && (
                      <span
                        style={{
                          fontSize: 9,
                          padding: "1px 5px",
                          borderRadius: 999,
                          border: "1px solid rgba(124,58,237,.30)",
                          color: "rgba(216,180,254,.80)",
                          background: "rgba(124,58,237,.08)",
                        }}
                      >
                        PINNED
                      </span>
                    )}
                    {l.verified && (
                      <span
                        style={{
                          fontSize: 9,
                          padding: "1px 5px",
                          borderRadius: 999,
                          border: "1px solid rgba(16,185,129,.30)",
                          color: "rgba(110,231,183,.80)",
                          background: "rgba(16,185,129,.08)",
                        }}
                      >
                        VERIFIED
                      </span>
                    )}
                    {isFeatured && (
                      <span
                        style={{
                          fontSize: 9,
                          padding: "1px 5px",
                          borderRadius: 999,
                          border: "1px solid rgba(245,158,11,.40)",
                          color: "rgb(253,230,138)",
                          background: "rgba(245,158,11,.12)",
                          fontWeight: 800,
                        }}
                      >
                        ★ FEATURED
                      </span>
                    )}
                  </div>
                  <div
                    style={{ fontSize: 11, opacity: 0.4, marginTop: 1, fontFamily: "monospace" }}
                  >
                    {l.id} · {l.moduleType} · {l.onlineCount} online
                  </div>
                </div>
              </div>
              {canEdit && (
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  <button
                    style={
                      isFeatured
                        ? { ...S.warn, fontSize: 11, padding: "4px 8px", fontWeight: 800 }
                        : {
                            ...S.btn,
                            fontSize: 11,
                            padding: "4px 8px",
                            borderColor: "rgba(245,158,11,.25)",
                            color: "rgb(253,230,138)",
                          }
                    }
                    onClick={() => setFeatured(l.id)}
                  >
                    {isFeatured ? "★ Unfeature" : "☆ Set Featured"}
                  </button>
                  <button
                    style={{ ...S.btn, fontSize: 11, padding: "4px 8px" }}
                    onClick={() => togglePin(l.id, l.pinned)}
                  >
                    {l.pinned ? "Unpin" : "Pin"}
                  </button>
                  <button
                    style={{
                      ...S.btn,
                      fontSize: 11,
                      padding: "4px 8px",
                      borderColor: "rgba(245,158,11,.25)",
                      color: "rgb(253,230,138)",
                    }}
                    onClick={() => lockLobby(l.id)}
                  >
                    Lock Chat
                  </button>
                  <button
                    style={{
                      ...S.btn,
                      fontSize: 11,
                      padding: "4px 8px",
                      borderColor: "rgba(16,185,129,.25)",
                      color: "rgb(110,231,183)",
                    }}
                    onClick={() => unlockLobby(l.id)}
                  >
                    Unlock Chat
                  </button>
                  <button
                    style={{ ...S.danger, fontSize: 11, padding: "4px 8px" }}
                    onClick={() => clearChat(l.id)}
                  >
                    Clear Chat
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {!lobbies.length && !loading && (
          <div style={{ opacity: 0.4, fontSize: 13 }}>No lobbies found.</div>
        )}
      </div>
    </div>
  );
}

type ReportRow = {
  id: string;
  reporterId: string;
  reporterName: string;
  targetType: string;
  targetId: string;
  targetName: string | null;
  context: string | null;
  reason: string;
  note: string | null;
  status: string;
  bodySnapshot: string | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewerName: string | null;
};

const REASON_LABELS: Record<string, string> = {
  SPAM: "Spam",
  HARASSMENT: "Harassment",
  HATE_SPEECH: "Hate speech",
  THREATS: "Threats",
  NSFW: "NSFW",
  MINOR_SAFETY: "Minor safety",
  IMPERSONATION: "Impersonation",
  SELF_HARM: "Self-harm",
  OTHER: "Other",
};

type AppealRow = {
  id: string;
  userId: string;
  reason: string;
  status: string;
  createdAt: string;
  reviewerNote: string | null;
  reviewedAt: string | null;
  user: {
    id: string;
    name: string;
    banReason: string | null;
    bannedAt: string | null;
    bannedBy: string | null;
  };
};

function AppealsTab() {
  const [rows, setRows] = useState<AppealRow[]>([]);
  const [filter, setFilter] = useState<"PENDING" | "ALL">("PENDING");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [noteFor, setNoteFor] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    const j = await apiFetch(`/staff/ban-appeals?status=${filter}`);
    setLoading(false);
    if (j.ok) setRows(j.rows || []);
  }

  useEffect(() => {
    load();
  }, [filter]);

  async function review(id: string, decision: "APPROVED" | "DENIED") {
    const note = (noteFor[id] || "").trim();
    const j = await apiFetch(`/staff/ban-appeals/${encodeURIComponent(id)}/review`, {
      method: "POST",
      body: JSON.stringify({ decision, note }),
    });
    if (j.ok) {
      setMsg(decision === "APPROVED" ? "Approved — user unbanned." : "Denied.");
      setNoteFor((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      load();
    } else {
      setMsg(j.message || j.error || "Failed.");
    }
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
          gap: 12,
        }}
      >
        <div style={{ display: "flex", gap: 6 }}>
          {(["PENDING", "ALL"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,.10)",
                background: filter === f ? "rgba(124,58,237,.20)" : "transparent",
                color: filter === f ? "rgba(216,180,254,.95)" : "rgba(148,163,184,.7)",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {f}
            </button>
          ))}
        </div>
        {msg && <div style={{ fontSize: 12, opacity: 0.7 }}>{msg}</div>}
      </div>

      {loading && (
        <div style={{ opacity: 0.5, fontSize: 13, padding: 30, textAlign: "center" }}>Loading…</div>
      )}
      {!loading && rows.length === 0 && (
        <div style={{ opacity: 0.4, fontSize: 13, padding: 40, textAlign: "center" }}>
          {filter === "PENDING" ? "No pending appeals. Calm waters." : "Nothing here."}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {rows.map((r) => (
          <div key={r.id} style={{ ...S.card, padding: 16 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 10,
              }}
            >
              <div>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{r.user.name}</span>
                <span
                  style={{ marginLeft: 10, fontSize: 11, opacity: 0.5, fontFamily: "monospace" }}
                >
                  {r.user.id.slice(-8)}
                </span>
              </div>
              <div style={{ fontSize: 11, opacity: 0.5 }}>
                {new Date(r.createdAt).toLocaleString()}
              </div>
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ ...S.label, marginBottom: 4 }}>original ban reason</div>
              <div
                style={{
                  fontSize: 12,
                  color: "rgba(252,165,165,0.85)",
                  padding: "8px 12px",
                  background: "rgba(239,68,68,0.06)",
                  border: "1px solid rgba(239,68,68,0.15)",
                  borderRadius: 6,
                }}
              >
                {r.user.banReason || (
                  <span style={{ opacity: 0.5, fontStyle: "italic" }}>none recorded</span>
                )}
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ ...S.label, marginBottom: 4 }}>their appeal</div>
              <div
                style={{
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: "rgba(243,244,246,0.9)",
                  whiteSpace: "pre-wrap",
                  padding: "10px 14px",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 6,
                }}
              >
                {r.reason}
              </div>
            </div>
            {r.status === "PENDING" ? (
              <>
                <input
                  value={noteFor[r.id] || ""}
                  onChange={(e) => setNoteFor((p) => ({ ...p, [r.id]: e.target.value }))}
                  placeholder="Optional note (shown to user with the decision)"
                  style={{ ...S.input, marginBottom: 8 }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => review(r.id, "APPROVED")}
                    style={{
                      ...S.btnPri,
                      padding: "8px 18px",
                      background: "rgba(34,197,94,0.20)",
                      border: "1px solid rgba(34,197,94,0.40)",
                    }}
                  >
                    Approve · Unban
                  </button>
                  <button
                    onClick={() => review(r.id, "DENIED")}
                    style={{ ...S.danger, padding: "8px 18px" }}
                  >
                    Deny
                  </button>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12, opacity: 0.6, padding: "8px 0" }}>
                <span
                  style={{
                    fontWeight: 700,
                    color: r.status === "APPROVED" ? "rgb(110,231,183)" : "rgb(252,165,165)",
                  }}
                >
                  {r.status}
                </span>
                {r.reviewedAt && (
                  <span style={{ marginLeft: 8 }}>{new Date(r.reviewedAt).toLocaleString()}</span>
                )}
                {r.reviewerNote && (
                  <div style={{ marginTop: 6, fontStyle: "italic" }}>note: {r.reviewerNote}</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

type BugRow = {
  id: string;
  userId: string | null;
  category: string;
  page: string;
  userAgent: string;
  body: string;
  status: string;
  createdAt: string;
  closedAt: string | null;
  staffNote: string | null;
  user: { id: string; name: string } | null;
};

const CATEGORY_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  BUG: { label: "BUG", color: "rgb(252,165,165)", bg: "rgba(239,68,68,0.10)" },
  LOBBY_MODULE_REQUEST: { label: "MODULE", color: "rgb(216,180,254)", bg: "rgba(124,58,237,0.10)" },
  FEEDBACK: { label: "FEEDBACK", color: "rgb(252,211,77)", bg: "rgba(245,158,11,0.10)" },
};

function BugsTab() {
  const [rows, setRows] = useState<BugRow[]>([]);
  const [filter, setFilter] = useState<"OPEN" | "ALL">("OPEN");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [noteFor, setNoteFor] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    const j = await apiFetch(`/staff/bugs?status=${filter}`);
    setLoading(false);
    if (j.ok) setRows(j.rows || []);
  }

  useEffect(() => {
    load();
  }, [filter]);

  async function close(id: string) {
    const note = (noteFor[id] || "").trim();
    const j = await apiFetch(`/staff/bugs/${encodeURIComponent(id)}/close`, {
      method: "POST",
      body: JSON.stringify({ note }),
    });
    if (j.ok) {
      setMsg("Closed.");
      setNoteFor((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      load();
    } else setMsg(j.message || j.error || "Failed.");
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
          gap: 12,
        }}
      >
        <div style={{ display: "flex", gap: 6 }}>
          {(["OPEN", "ALL"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,.10)",
                background: filter === f ? "rgba(124,58,237,.20)" : "transparent",
                color: filter === f ? "rgba(216,180,254,.95)" : "rgba(148,163,184,.7)",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {f}
            </button>
          ))}
        </div>
        {msg && <div style={{ fontSize: 12, opacity: 0.7 }}>{msg}</div>}
      </div>

      {loading && (
        <div style={{ opacity: 0.5, fontSize: 13, padding: 30, textAlign: "center" }}>Loading…</div>
      )}
      {!loading && rows.length === 0 && (
        <div style={{ opacity: 0.4, fontSize: 13, padding: 40, textAlign: "center" }}>
          {filter === "OPEN" ? "No open bug reports." : "Nothing here."}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {rows.map((r) => (
          <div key={r.id} style={{ ...S.card, padding: 16 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                {(() => {
                  const c = CATEGORY_BADGE[r.category] || CATEGORY_BADGE.BUG;
                  return (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 800,
                        letterSpacing: 1.2,
                        padding: "2px 8px",
                        borderRadius: 4,
                        color: c.color,
                        background: c.bg,
                        border: `1px solid ${c.color.replace("rgb", "rgba").replace(")", ",0.25)")}`,
                      }}
                    >
                      {c.label}
                    </span>
                  );
                })()}
                <span
                  style={{
                    fontSize: 12,
                    fontFamily: "monospace",
                    color: r.user ? "rgba(216,180,254,.85)" : "rgba(148,163,184,.5)",
                    fontWeight: 700,
                  }}
                >
                  {r.user?.name || "anonymous"}
                </span>
                {r.page && (
                  <span style={{ fontSize: 11, fontFamily: "monospace", opacity: 0.55 }}>
                    {r.page}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, opacity: 0.5 }}>
                {new Date(r.createdAt).toLocaleString()}
              </div>
            </div>
            <div
              style={{
                fontSize: 13,
                lineHeight: 1.6,
                color: "rgba(243,244,246,0.92)",
                whiteSpace: "pre-wrap",
                padding: "10px 14px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 6,
                marginBottom: 10,
              }}
            >
              {r.body}
            </div>
            {r.userAgent && (
              <div
                style={{
                  fontSize: 10,
                  fontFamily: "monospace",
                  color: "rgba(148,163,184,0.45)",
                  marginBottom: 10,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {r.userAgent}
              </div>
            )}
            {r.status === "OPEN" ? (
              <>
                <input
                  value={noteFor[r.id] || ""}
                  onChange={(e) => setNoteFor((p) => ({ ...p, [r.id]: e.target.value }))}
                  placeholder="Optional internal note"
                  style={{ ...S.input, marginBottom: 8 }}
                />
                <button onClick={() => close(r.id)} style={{ ...S.btnPri, padding: "8px 18px" }}>
                  Mark Closed
                </button>
              </>
            ) : (
              <div style={{ fontSize: 12, opacity: 0.6 }}>
                <span style={{ fontWeight: 700, color: "rgb(148,163,184)" }}>CLOSED</span>
                {r.closedAt && (
                  <span style={{ marginLeft: 8 }}>{new Date(r.closedAt).toLocaleString()}</span>
                )}
                {r.staffNote && (
                  <div style={{ marginTop: 6, fontStyle: "italic" }}>note: {r.staffNote}</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportsTab() {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"OPEN" | "REVIEWED" | "ACTIONED" | "DISMISSED" | "ALL">(
    "OPEN",
  );
  const [busyId, setBusyId] = useState("");

  async function load() {
    setLoading(true);
    try {
      const j = await apiFetch(`/staff/reports?status=${filter}`);
      setReports(Array.isArray(j?.reports) ? j.reports : []);
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [filter]);

  async function action(id: string, status: "REVIEWED" | "ACTIONED" | "DISMISSED") {
    setBusyId(id);
    try {
      const j = await apiFetch(`/staff/reports/${id}/action`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      if (j?.ok) setReports((cur) => cur.filter((r) => r.id !== id));
    } catch {}
    setBusyId("");
  }

  async function clearBranding(lobbyId: string, reportId: string) {
    setBusyId(reportId);
    try {
      const j = await apiFetch(`/staff/lobbies/${encodeURIComponent(lobbyId)}/clear-branding`, {
        method: "POST",
      });
      if (j?.ok) {
        await apiFetch(`/staff/reports/${reportId}/action`, {
          method: "POST",
          body: JSON.stringify({ status: "ACTIONED" }),
        });
        setReports((cur) => cur.filter((r) => r.id !== reportId));
      }
    } catch {}
    setBusyId("");
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Reports</h2>
        <div style={{ display: "flex", gap: 4 }}>
          {(["OPEN", "REVIEWED", "ACTIONED", "DISMISSED", "ALL"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              style={{
                padding: "5px 10px",
                borderRadius: 6,
                border: "1px solid rgba(255,255,255,.1)",
                background: filter === s ? "rgba(124,58,237,.2)" : "rgba(255,255,255,.03)",
                color: filter === s ? "rgb(196,181,253)" : "rgba(255,255,255,.7)",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading && <div style={{ padding: 20, opacity: 0.5, fontSize: 13 }}>Loading reports...</div>}
      {!loading && reports.length === 0 && (
        <div style={{ padding: "32px 20px", textAlign: "center", fontSize: 13 }}>
          <div style={{ fontWeight: 700, color: "rgba(255,255,255,.65)" }}>
            {filter === "OPEN" ? "Queue is clear." : "No reports in this view."}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", marginTop: 3 }}>
            {filter === "OPEN"
              ? "When users flag things, they land here."
              : "Change the filter to see more."}
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {reports.map((r) => (
          <div
            key={r.id}
            style={{
              padding: 14,
              borderRadius: 10,
              background: "rgba(255,255,255,.02)",
              border: "1px solid rgba(255,255,255,.08)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  padding: "3px 8px",
                  borderRadius: 5,
                  background: "rgba(239,68,68,.15)",
                  border: "1px solid rgba(239,68,68,.3)",
                  color: "rgb(252,165,165)",
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: ".05em",
                }}
              >
                {REASON_LABELS[r.reason] || r.reason}
              </span>
              <span
                style={{ fontSize: 11, color: "rgba(255,255,255,.4)", fontFamily: "monospace" }}
              >
                {r.targetType}
              </span>
              {r.status !== "OPEN" && (
                <span
                  style={{
                    padding: "3px 8px",
                    borderRadius: 5,
                    background: "rgba(255,255,255,.05)",
                    fontSize: 10,
                    fontWeight: 700,
                    color: "rgba(255,255,255,.5)",
                  }}
                >
                  {r.status}
                </span>
              )}
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 11, color: "rgba(255,255,255,.35)" }}>
                {new Date(r.createdAt).toLocaleString()}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.75)", marginBottom: 6 }}>
              <strong>{r.reporterName}</strong> reported{" "}
              {r.targetType === "USER" ? (
                <strong>{r.targetName || r.targetId}</strong>
              ) : (
                <code style={{ fontSize: 11, color: "rgba(255,255,255,.55)" }}>{r.targetId}</code>
              )}
              {r.context && (
                <>
                  {" "}
                  in{" "}
                  <code style={{ fontSize: 11, color: "rgba(255,255,255,.55)" }}>{r.context}</code>
                </>
              )}
            </div>
            {r.bodySnapshot && (
              <div
                style={{
                  padding: "8px 10px",
                  marginTop: 4,
                  marginBottom: 8,
                  borderRadius: 7,
                  background: "rgba(0,0,0,.3)",
                  border: "1px solid rgba(255,255,255,.05)",
                  fontSize: 12,
                  color: "rgba(255,255,255,.82)",
                  fontStyle: "italic",
                  lineHeight: 1.45,
                }}
              >
                "{r.bodySnapshot}"
              </div>
            )}
            {r.note && (
              <div style={{ fontSize: 11, color: "rgba(255,255,255,.55)", marginBottom: 8 }}>
                <strong>Note:</strong> {r.note}
              </div>
            )}
            {r.reviewerName && r.reviewedAt && (
              <div style={{ fontSize: 10, color: "rgba(255,255,255,.35)", marginBottom: 8 }}>
                {r.status.toLowerCase()} by {r.reviewerName} on{" "}
                {new Date(r.reviewedAt).toLocaleString()}
              </div>
            )}
            {r.status === "OPEN" && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button
                  disabled={busyId === r.id}
                  onClick={() => action(r.id, "ACTIONED")}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "1px solid rgba(34,197,94,.4)",
                    background: "rgba(34,197,94,.1)",
                    color: "rgb(134,239,172)",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Actioned
                </button>
                <button
                  disabled={busyId === r.id}
                  onClick={() => action(r.id, "REVIEWED")}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "1px solid rgba(255,255,255,.12)",
                    background: "rgba(255,255,255,.04)",
                    color: "rgba(255,255,255,.7)",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Reviewed
                </button>
                <button
                  disabled={busyId === r.id}
                  onClick={() => action(r.id, "DISMISSED")}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "1px solid rgba(255,255,255,.08)",
                    background: "transparent",
                    color: "rgba(255,255,255,.5)",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Dismiss
                </button>
                {r.targetType === "LOBBY" && (
                  <>
                    <span style={{ flex: 1 }} />
                    <a
                      href={`/lobby/${r.targetId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: "6px 12px",
                        borderRadius: 6,
                        border: "1px solid rgba(255,255,255,.12)",
                        background: "rgba(255,255,255,.04)",
                        color: "rgba(255,255,255,.7)",
                        fontSize: 11,
                        fontWeight: 700,
                        fontFamily: "inherit",
                        textDecoration: "none",
                      }}
                    >
                      View ↗
                    </a>
                    <button
                      disabled={busyId === r.id}
                      onClick={() => clearBranding(r.targetId, r.id)}
                      title="Remove this lobby's logo + banner"
                      style={{
                        padding: "6px 12px",
                        borderRadius: 6,
                        border: "1px solid rgba(245,158,11,.45)",
                        background: "rgba(245,158,11,.12)",
                        color: "rgb(253,230,138)",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      Clear branding
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AuditTab() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    setLoading(true);
    apiFetch("/staff/audit").then((j) => {
      setLogs(j.logs || []);
      setLoading(false);
    });
  }, []);

  const actionColor = (a: string) => {
    if (a.includes("kick") || a.includes("delete") || a.includes("ban"))
      return "rgba(239,68,68,.85)";
    if (a.includes("role") || a.includes("tier")) return "rgba(124,58,237,.95)";
    if (a.includes("note")) return "rgba(14,165,233,.85)";
    if (a.includes("lock")) return "rgba(245,158,11,.85)";
    if (a.includes("clear")) return "rgba(239,68,68,.65)";
    if (a.includes("featured") || a.includes("config")) return "rgba(16,185,129,.85)";
    return "rgba(148,163,184,.75)";
  };

  const filtered = filter.trim()
    ? logs.filter((l) =>
        (l.action + l.actorName + (l.targetName || ""))
          .toLowerCase()
          .includes(filter.toLowerCase()),
      )
    : logs;

  return (
    <div>
      <input
        style={{ ...S.input, marginBottom: 14 }}
        placeholder="Filter by action, actor, target…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      {loading && <div style={{ opacity: 0.4 }}>Loading…</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {filtered.map((l) => (
          <div
            key={l.id}
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 12,
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,.07)",
              background: "rgba(255,255,255,.02)",
              fontSize: 12,
            }}
          >
            <span
              style={{
                color: actionColor(l.action),
                fontWeight: 700,
                minWidth: 130,
                flexShrink: 0,
              }}
            >
              {l.action}
            </span>
            <span style={{ opacity: 0.8, flexShrink: 0 }}>{l.actorName}</span>
            {l.targetName && (
              <>
                <span style={{ opacity: 0.35 }}>→</span>
                <span style={{ opacity: 0.75 }}>{l.targetName}</span>
              </>
            )}
            {l.meta && (
              <span
                style={{
                  opacity: 0.4,
                  fontFamily: "monospace",
                  fontSize: 10,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {JSON.stringify(l.meta)}
              </span>
            )}
            <span style={{ marginLeft: "auto", opacity: 0.35, whiteSpace: "nowrap", fontSize: 11 }}>
              {fmtDate(l.createdAt)}
            </span>
          </div>
        ))}
        {!filtered.length && !loading && (
          <div style={{ opacity: 0.4, fontSize: 13 }}>No audit logs.</div>
        )}
      </div>
    </div>
  );
}

type Announcement = {
  id: string;
  message: string;
  level: string;
  pinned: boolean;
  sticky: boolean;
  createdByName: string;
  createdAt: string;
};

const ANN_PRESETS: { label: string; message: string; level: "info" | "warning" | "urgent" }[] = [
  {
    label: "Maintenance",
    message: "Scheduled maintenance — Weered may be briefly unavailable. We'll be back shortly.",
    level: "warning",
  },
  {
    label: "Beta notice",
    message:
      "Early access build — things may break. Report bugs in the Forum. New features ship daily. Type @operator in any chat for help.",
    level: "info",
  },
  {
    label: "New feature",
    message: "New feature just shipped — check the Changelog in HQ to see what's new.",
    level: "info",
  },
  {
    label: "Outage",
    message:
      "We're aware of an issue affecting parts of Weered and are on it. Thanks for your patience.",
    level: "urgent",
  },
];

const annLevelStyles: Record<
  string,
  { bg: string; border: string; color: string; label: string; emoji: string }
> = {
  info: {
    bg: "rgba(88,0,229,.12)",
    border: "rgba(88,0,229,.35)",
    color: "rgb(216,180,254)",
    label: "Info",
    emoji: "📢",
  },
  warning: {
    bg: "rgba(245,158,11,.10)",
    border: "rgba(245,158,11,.35)",
    color: "rgb(253,230,138)",
    label: "Warning",
    emoji: "⚠️",
  },
  urgent: {
    bg: "rgba(239,68,68,.10)",
    border: "rgba(239,68,68,.35)",
    color: "rgb(252,165,165)",
    label: "Urgent",
    emoji: "🚨",
  },
};

function BroadcastTab() {
  const [message, setMessage] = useState("");
  const [level, setLevel] = useState<"info" | "warning" | "urgent">("info");
  const [pin, setPin] = useState(false);
  const [sticky, setSticky] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const [items, setItems] = useState<Announcement[]>([]);

  const load = useCallback(async () => {
    const j = await apiFetch("/staff/announcements");
    if (j?.ok) setItems(j.announcements || []);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  function applyPreset(p: (typeof ANN_PRESETS)[number]) {
    setMessage(p.message);
    setLevel(p.level);
  }

  async function send() {
    if (!message.trim() || busy) return;
    setBusy(true);
    setResult("");
    try {
      const flash = await apiFetch("/staff/broadcast", {
        method: "POST",
        body: JSON.stringify({ message: message.trim(), level }),
      });
      if (pin) {
        await apiFetch("/staff/announcements", {
          method: "POST",
          body: JSON.stringify({ message: message.trim(), level, pinned: true, sticky }),
        });
      } else {
        await apiFetch("/staff/announcements", {
          method: "POST",
          body: JSON.stringify({ message: message.trim(), level, pinned: false }),
        });
      }
      setResult(
        flash?.ok
          ? `Sent to ${flash.sent} user${flash.sent !== 1 ? "s" : ""}${pin ? " · pinned" : ""}.`
          : "Saved.",
      );
      setMessage("");
      setPin(false);
      setSticky(false);
      await load();
    } catch {
      setResult("Request failed.");
    } finally {
      setBusy(false);
    }
  }

  async function togglePin(a: Announcement) {
    await apiFetch(`/staff/announcements/${a.id}`, {
      method: "PATCH",
      body: JSON.stringify({ pinned: !a.pinned, sticky: !a.pinned ? a.sticky : false }),
    });
    await load();
  }
  async function toggleSticky(a: Announcement) {
    await apiFetch(`/staff/announcements/${a.id}`, {
      method: "PATCH",
      body: JSON.stringify({ sticky: !a.sticky, pinned: true }),
    });
    await load();
  }
  async function del(a: Announcement) {
    if (!confirm("Delete this announcement from history?")) return;
    await apiFetch(`/staff/announcements/${a.id}`, { method: "DELETE" });
    await load();
  }

  const pinnedItems = items.filter((a) => a.pinned);
  const historyItems = items.filter((a) => !a.pinned);

  return (
    <div style={{ maxWidth: 620 }}>
      <div style={{ ...S.card, marginBottom: 16 }}>
        <div style={S.sectionTitle}>Compose Announcement</div>
        <div style={{ fontSize: 11, opacity: 0.45, marginBottom: 12 }}>
          Sends a toast to all connected users. Pin it to keep it as a banner — sticky banners can't
          be dismissed.
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {ANN_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => applyPreset(p)}
              style={{
                padding: "5px 11px",
                borderRadius: 7,
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                border: "1px solid rgba(255,255,255,.10)",
                background: "rgba(255,255,255,.03)",
                color: "rgba(203,213,225,.8)",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        <textarea
          style={{ ...S.input, resize: "vertical", minHeight: 70, marginBottom: 6 }}
          placeholder="Announcement message…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={500}
        />
        <div style={{ fontSize: 10, opacity: 0.3, textAlign: "right", marginBottom: 10 }}>
          {message.length}/500
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {(["info", "warning", "urgent"] as const).map((l) => {
            const ls = annLevelStyles[l];
            const active = level === l;
            return (
              <button
                key={l}
                onClick={() => setLevel(l)}
                style={{
                  flex: 1,
                  padding: "9px",
                  borderRadius: 9,
                  textAlign: "center",
                  border: `1px solid ${active ? ls.border : "rgba(255,255,255,.08)"}`,
                  background: active ? ls.bg : "rgba(255,255,255,.02)",
                  color: active ? ls.color : "rgba(243,244,246,.5)",
                  fontSize: 12,
                  fontWeight: active ? 700 : 400,
                  cursor: "pointer",
                }}
              >
                {ls.emoji} {ls.label}
              </button>
            );
          })}
        </div>

        <div
          style={{
            display: "flex",
            gap: 16,
            marginBottom: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              fontSize: 12,
              cursor: "pointer",
              color: "rgba(203,213,225,.85)",
            }}
          >
            <input
              type="checkbox"
              checked={pin}
              onChange={(e) => {
                setPin(e.target.checked);
                if (!e.target.checked) setSticky(false);
              }}
            />{" "}
            Pin as banner
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              fontSize: 12,
              cursor: pin ? "pointer" : "default",
              color: pin ? "rgba(203,213,225,.85)" : "rgba(148,163,184,.35)",
            }}
          >
            <input
              type="checkbox"
              checked={sticky}
              disabled={!pin}
              onChange={(e) => setSticky(e.target.checked)}
            />{" "}
            Sticky (can't be dismissed)
          </label>
        </div>

        {message.trim() && (
          <div
            style={{
              marginBottom: 14,
              padding: "10px 14px",
              borderRadius: 9,
              background: annLevelStyles[level].bg,
              border: `1px solid ${annLevelStyles[level].border}`,
              color: annLevelStyles[level].color,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <span style={{ marginRight: 8 }}>{annLevelStyles[level].emoji}</span>
            {message.trim()}
          </div>
        )}

        <button
          onClick={send}
          disabled={busy || !message.trim()}
          style={{
            ...S.btnPri,
            width: "100%",
            padding: "10px",
            fontSize: 13,
            opacity: busy || !message.trim() ? 0.5 : 1,
          }}
        >
          {busy ? "Sending…" : pin ? "Send + Pin" : "Send Broadcast"}
        </button>
        {result && <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>{result}</div>}
      </div>

      {pinnedItems.length > 0 && (
        <div style={{ ...S.card, marginBottom: 16 }}>
          <div style={S.sectionTitle}>Pinned Banners ({pinnedItems.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {pinnedItems.map((a) => (
              <AnnRow key={a.id} a={a} onPin={togglePin} onSticky={toggleSticky} onDelete={del} />
            ))}
          </div>
        </div>
      )}

      {historyItems.length > 0 && (
        <div style={S.card}>
          <div style={S.sectionTitle}>History</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {historyItems.map((a) => (
              <AnnRow key={a.id} a={a} onPin={togglePin} onSticky={toggleSticky} onDelete={del} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AnnRow({
  a,
  onPin,
  onSticky,
  onDelete,
}: {
  a: Announcement;
  onPin: (a: Announcement) => void;
  onSticky: (a: Announcement) => void;
  onDelete: (a: Announcement) => void;
}) {
  const ls = annLevelStyles[a.level] || annLevelStyles.info;
  return (
    <div
      style={{
        padding: "9px 11px",
        borderRadius: 8,
        background: a.pinned ? ls.bg : "rgba(255,255,255,.02)",
        border: `1px solid ${a.pinned ? ls.border : "rgba(255,255,255,.06)"}`,
      }}
    >
      <div style={{ fontSize: 12, color: a.pinned ? ls.color : "rgba(243,244,246,.85)" }}>
        {ls.emoji} {a.message}
      </div>
      <div
        style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, flexWrap: "wrap" }}
      >
        <span style={{ fontSize: 10, opacity: 0.4 }}>
          {ls.label.toUpperCase()} · {a.createdByName || "staff"} ·{" "}
          {new Date(a.createdAt).toLocaleString()}
        </span>
        <div style={{ flex: 1 }} />
        <button onClick={() => onPin(a)} style={annBtn(a.pinned)}>
          {a.pinned ? "Unpin" : "Pin"}
        </button>
        {a.pinned && (
          <button onClick={() => onSticky(a)} style={annBtn(a.sticky)}>
            {a.sticky ? "Sticky ✓" : "Make sticky"}
          </button>
        )}
        <button
          onClick={() => onDelete(a)}
          style={{ ...annBtn(false), color: "rgba(252,165,165,.85)" }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
function annBtn(active: boolean): React.CSSProperties {
  return {
    padding: "3px 9px",
    fontSize: 10,
    fontWeight: 700,
    cursor: "pointer",
    borderRadius: 6,
    border: `1px solid ${active ? "rgba(124,58,237,.5)" : "rgba(255,255,255,.12)"}`,
    background: active ? "rgba(124,58,237,.15)" : "transparent",
    color: active ? "#c4b5fd" : "rgba(148,163,184,.85)",
  };
}

type StaffEvent = {
  id: string;
  title: string;
  description: string;
  category: string;
  coverImageUrl: string | null;
  startsAt: string;
  endsAt: string | null;
  timezone: string;
  status: string;
  lobbyId: string | null;
  lobby?: { id: string; name: string } | null;
  createdById: string;
  createdByName: string;
  promotionStatus: string;
  promotionNote: string | null;
  promotionDenyReason: string | null;
  broadcastOnPublish: boolean;
  createdAt: string;
};

const EVENT_STATUS_COLORS: Record<string, { bg: string; border: string; color: string }> = {
  DRAFT: {
    bg: "rgba(255,255,255,.05)",
    border: "rgba(255,255,255,.15)",
    color: "rgba(255,255,255,.6)",
  },
  PUBLISHED: {
    bg: "rgba(16,185,129,.10)",
    border: "rgba(16,185,129,.30)",
    color: "rgb(167,243,208)",
  },
  CANCELED: { bg: "rgba(239,68,68,.10)", border: "rgba(239,68,68,.30)", color: "rgb(252,165,165)" },
  COMPLETED: {
    bg: "rgba(14,165,233,.10)",
    border: "rgba(14,165,233,.28)",
    color: "rgb(186,230,253)",
  },
};

const PROMO_COLORS: Record<string, { bg: string; border: string; color: string }> = {
  NONE: { bg: "transparent", border: "transparent", color: "transparent" },
  PENDING: {
    bg: "rgba(245,158,11,.10)",
    border: "rgba(245,158,11,.30)",
    color: "rgb(253,230,138)",
  },
  APPROVED: {
    bg: "rgba(16,185,129,.10)",
    border: "rgba(16,185,129,.30)",
    color: "rgb(167,243,208)",
  },
  DENIED: { bg: "rgba(239,68,68,.10)", border: "rgba(239,68,68,.30)", color: "rgb(252,165,165)" },
};

function StatusBadge({ status }: { status: string }) {
  const c = EVENT_STATUS_COLORS[status] || EVENT_STATUS_COLORS.DRAFT;
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
      }}
    >
      {status}
    </span>
  );
}

function PromoBadge({ status }: { status: string }) {
  if (status === "NONE") return null;
  const c = PROMO_COLORS[status] || PROMO_COLORS.NONE;
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
      }}
    >
      {status}
    </span>
  );
}

function EventsTab({ myRole }: { myRole: GlobalRole }) {
  const [view, setView] = useState<"all" | "promotions" | "create">("all");
  const [events, setEvents] = useState<StaffEvent[]>([]);
  const [promos, setPromos] = useState<StaffEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [scopeFilter, setScopeFilter] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    coverImageUrl: "",
    startsAt: "",
    endsAt: "",
    timezone: "UTC",
    status: "DRAFT",
    broadcastOnPublish: false,
  });
  const [creating, setCreating] = useState(false);

  const loadEvents = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (scopeFilter) params.set("scope", scopeFilter);
    if (search) params.set("q", search);
    const j = await apiFetch(`/staff/events?${params}`);
    if (j.ok) setEvents(j.events);
    setLoading(false);
  }, [statusFilter, scopeFilter, search]);

  const loadPromos = useCallback(async () => {
    const j = await apiFetch("/staff/events/promotions");
    if (j.ok) setPromos(j.events);
  }, []);

  useEffect(() => {
    loadEvents();
    loadPromos();
  }, [loadEvents, loadPromos]);

  async function createEvent() {
    if (!form.title.trim()) {
      setMsg("Title required.");
      return;
    }
    if (!form.startsAt) {
      setMsg("Start date required.");
      return;
    }
    setCreating(true);
    const j = await apiFetch("/staff/events", {
      method: "POST",
      body: JSON.stringify({
        ...form,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
      }),
    });
    setCreating(false);
    if (j.ok) {
      setMsg(`Created "${j.event.title}".`);
      setForm({
        title: "",
        description: "",
        category: "",
        coverImageUrl: "",
        startsAt: "",
        endsAt: "",
        timezone: "UTC",
        status: "DRAFT",
        broadcastOnPublish: false,
      });
      setView("all");
      loadEvents();
    } else setMsg(j.error || "Failed.");
  }

  async function updateEvent(id: string, data: any) {
    const j = await apiFetch(`/staff/events/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    if (j.ok) {
      setMsg("Updated.");
      loadEvents();
    } else setMsg(j.error || "Failed.");
  }

  async function deleteEvent(id: string) {
    const j = await apiFetch(`/staff/events/${id}`, { method: "DELETE" });
    if (j.ok) {
      setMsg("Deleted.");
      setSelected(null);
      loadEvents();
    } else setMsg(j.error || "Failed.");
  }

  async function reviewPromo(id: string, decision: string, reason?: string) {
    const j = await apiFetch(`/staff/events/${id}/promotion-review`, {
      method: "POST",
      body: JSON.stringify({ decision, reason }),
    });
    if (j.ok) {
      setMsg(`${decision}.`);
      loadPromos();
      loadEvents();
    } else setMsg(j.error || "Failed.");
  }

  const fmtDate = (s: string) => {
    try {
      return new Date(s).toLocaleString();
    } catch {
      return s;
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {msg && (
        <div
          style={{
            fontSize: 12,
            color: "rgba(167,243,208,.9)",
            padding: "8px 12px",
            borderRadius: 8,
            background: "rgba(16,185,129,.08)",
            border: "1px solid rgba(16,185,129,.25)",
          }}
        >
          {msg}
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button style={view === "all" ? S.btnPri : S.btn} onClick={() => setView("all")}>
          All Events
        </button>
        <button
          style={view === "promotions" ? S.btnPri : S.btn}
          onClick={() => setView("promotions")}
        >
          Promotions{" "}
          {promos.length > 0 && (
            <span
              style={{
                marginLeft: 4,
                fontSize: 10,
                padding: "1px 5px",
                borderRadius: 999,
                background: "rgba(245,158,11,.20)",
                color: "rgb(253,230,138)",
              }}
            >
              {promos.length}
            </span>
          )}
        </button>
        <button style={{ ...S.success, marginLeft: "auto" }} onClick={() => setView("create")}>
          + Create Global Event
        </button>
      </div>

      {view === "create" && (
        <div style={{ ...S.card, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={S.sectionTitle}>Create Global Event</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={S.label}>Title</div>
              <input
                style={S.input}
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <div style={S.label}>Category</div>
              <input
                style={S.input}
                placeholder="ban_court, raid_night, watch_party..."
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <div style={S.label}>Description</div>
              <input
                style={S.input}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div>
              <div style={S.label}>Starts At</div>
              <input
                style={S.input}
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
              />
            </div>
            <div>
              <div style={S.label}>Ends At</div>
              <input
                style={S.input}
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
              />
            </div>
            <div>
              <div style={S.label}>Status</div>
              <select
                style={{ ...S.input, appearance: "auto" }}
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 18 }}>
              <input
                type="checkbox"
                checked={form.broadcastOnPublish}
                onChange={(e) => setForm((f) => ({ ...f, broadcastOnPublish: e.target.checked }))}
              />
              <span style={{ fontSize: 12, opacity: 0.7 }}>Broadcast on publish</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={S.btnPri} onClick={createEvent} disabled={creating}>
              {creating ? "Creating..." : "Create Event"}
            </button>
            <button style={S.btn} onClick={() => setView("all")}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {view === "all" && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input
              style={{ ...S.input, flex: 1 }}
              placeholder="Search events..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              style={{ ...S.input, width: 120, appearance: "auto" }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="CANCELED">Canceled</option>
              <option value="COMPLETED">Completed</option>
            </select>
            <select
              style={{ ...S.input, width: 100, appearance: "auto" }}
              value={scopeFilter}
              onChange={(e) => setScopeFilter(e.target.value)}
            >
              <option value="">All Scope</option>
              <option value="global">Global</option>
              <option value="lobby">Lobby</option>
            </select>
          </div>
          {loading && <div style={{ opacity: 0.4, fontSize: 13 }}>Loading...</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {events.map((ev) => (
              <div
                key={ev.id}
                style={{
                  ...S.card,
                  cursor: "pointer",
                  transition: "border-color .1s",
                  borderColor: selected === ev.id ? "rgba(124,58,237,.35)" : undefined,
                }}
                onClick={() => setSelected(selected === ev.id ? null : ev.id)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{ev.title}</div>
                    <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>
                      {fmtDate(ev.startsAt)} {ev.lobby ? `· ${ev.lobby.name}` : "· GLOBAL"}{" "}
                      {ev.category && `· ${ev.category}`}
                    </div>
                  </div>
                  <StatusBadge status={ev.status} />
                  <PromoBadge status={ev.promotionStatus} />
                </div>
                {selected === ev.id && (
                  <div
                    style={{
                      marginTop: 12,
                      paddingTop: 12,
                      borderTop: "1px solid rgba(255,255,255,.07)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    {ev.description && (
                      <div style={{ fontSize: 12, opacity: 0.7 }}>{ev.description}</div>
                    )}
                    <div style={{ fontSize: 11, opacity: 0.5 }}>
                      Created by {ev.createdByName} · {fmtDate(ev.createdAt)}
                    </div>
                    {ev.promotionNote && (
                      <div style={{ fontSize: 11, opacity: 0.6 }}>
                        Promo note: {ev.promotionNote}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {ev.status === "DRAFT" && (
                        <button
                          style={S.success}
                          onClick={(e) => {
                            e.stopPropagation();
                            updateEvent(ev.id, { status: "PUBLISHED" });
                          }}
                        >
                          Publish
                        </button>
                      )}
                      {ev.status === "PUBLISHED" && (
                        <button
                          style={S.btn}
                          onClick={(e) => {
                            e.stopPropagation();
                            updateEvent(ev.id, { status: "COMPLETED" });
                          }}
                        >
                          Complete
                        </button>
                      )}
                      {ev.status !== "CANCELED" && (
                        <button
                          style={S.warn}
                          onClick={(e) => {
                            e.stopPropagation();
                            updateEvent(ev.id, { status: "CANCELED" });
                          }}
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        style={S.danger}
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteEvent(ev.id);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {!loading && events.length === 0 && (
              <div style={{ opacity: 0.4, fontSize: 13, padding: "20px 0", textAlign: "center" }}>
                No events found.
              </div>
            )}
          </div>
        </div>
      )}

      {view === "promotions" && (
        <div>
          <div style={S.sectionTitle}>Pending Promotion Requests</div>
          {promos.length === 0 && (
            <div style={{ opacity: 0.4, fontSize: 13, padding: "20px 0", textAlign: "center" }}>
              No pending requests.
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {promos.map((ev) => (
              <div key={ev.id} style={S.card}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{ev.title}</div>
                    <div style={{ fontSize: 11, opacity: 0.5 }}>
                      {ev.lobby?.name || "Unknown lobby"} · {fmtDate(ev.startsAt)}
                    </div>
                  </div>
                  <StatusBadge status={ev.status} />
                </div>
                {ev.description && (
                  <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
                    {ev.description}
                  </div>
                )}
                {ev.promotionNote && (
                  <div
                    style={{
                      fontSize: 12,
                      opacity: 0.6,
                      marginBottom: 8,
                      padding: "6px 10px",
                      borderRadius: 6,
                      background: "rgba(245,158,11,.06)",
                      border: "1px solid rgba(245,158,11,.15)",
                    }}
                  >
                    "{ev.promotionNote}"
                  </div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={S.success} onClick={() => reviewPromo(ev.id, "APPROVED")}>
                    Approve
                  </button>
                  <button
                    style={S.danger}
                    onClick={() => {
                      const r = prompt("Deny reason (optional):");
                      reviewPromo(ev.id, "DENIED", r || undefined);
                    }}
                  >
                    Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RosterTab() {
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/staff/roster")
      .then((j) => {
        setStaff(j.staff || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading)
    return <div style={{ textAlign: "center", padding: 20, opacity: 0.4 }}>Loading roster...</div>;

  const grouped: Record<string, any[]> = {};
  for (const u of staff) {
    const r = u.globalRole || "STAFF";
    if (!grouped[r]) grouped[r] = [];
    grouped[r].push(u);
  }
  const order = ["GOD", "ADMIN", "STAFF", "SUPPORT"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ fontSize: 13, opacity: 0.5 }}>{staff.length} staff members</div>
      {order
        .filter((r) => grouped[r]?.length)
        .map((r) => (
          <div key={r}>
            <div style={S.sectionTitle}>
              {r} ({grouped[r].length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {grouped[r].map((u: any) => {
                const rc = roleColor(u.globalRole);
                return (
                  <div
                    key={u.id}
                    style={{ ...S.card, display: "flex", alignItems: "center", gap: 12 }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 999,
                        background: u.avatarColor || "rgba(124,58,237,.25)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 14,
                        fontWeight: 700,
                        flexShrink: 0,
                        border: `2px solid ${rc.border}`,
                      }}
                    >
                      {(u.name || "?").slice(0, 1).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{u.name}</div>
                      <div style={{ fontSize: 10, opacity: 0.4 }}>
                        joined {fmtDate(u.createdAt)}
                      </div>
                    </div>
                    <RoleBadge role={u.globalRole} />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
    </div>
  );
}

function BoardTab({ myRole }: { myRole: GlobalRole }) {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    apiFetch("/staff/board")
      .then((j) => {
        setPosts(j.posts || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function submit() {
    if (!body.trim()) return;
    setPosting(true);
    setMsg("");
    const j = await apiFetch("/staff/board", {
      method: "POST",
      body: JSON.stringify({ body: body.trim() }),
    });
    if (j.ok) {
      setBody("");
      load();
    } else setMsg(j.error || "Failed");
    setPosting(false);
  }

  async function togglePin(id: string) {
    await apiFetch(`/staff/board/${id}/pin`, { method: "POST", body: JSON.stringify({}) });
    load();
  }

  async function remove(id: string) {
    await apiFetch(`/staff/board/${id}`, { method: "DELETE" });
    load();
  }

  if (loading)
    return <div style={{ textAlign: "center", padding: 20, opacity: 0.4 }}>Loading board...</div>;

  const canManage = ROLE_RANK[myRole] >= ROLE_RANK["STAFF"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          ...S.card,
          border: "1px solid rgba(124,58,237,.20)",
          background: "rgba(124,58,237,.04)",
        }}
      >
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Post a note, task, or update for the team..."
          rows={3}
          style={{ ...S.input, resize: "vertical", minHeight: 60, fontFamily: "inherit" }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 8,
          }}
        >
          <span style={{ fontSize: 10, opacity: 0.3 }}>{body.length}/2000</span>
          <button style={S.btnPri} onClick={submit} disabled={posting || !body.trim()}>
            {posting ? "Posting..." : "Post"}
          </button>
        </div>
        {msg && (
          <div style={{ fontSize: 11, color: "rgba(252,165,165,.8)", marginTop: 4 }}>{msg}</div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {posts.map((p: any) => (
          <div
            key={p.id}
            style={{
              ...S.card,
              borderLeft: p.pinned ? "3px solid rgba(245,158,11,.5)" : "3px solid transparent",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  background: "rgba(124,58,237,.15)",
                  border: "1px solid rgba(124,58,237,.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 9,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {(p.authorName || "?").slice(0, 1).toUpperCase()}
              </div>
              <span style={{ fontWeight: 700, fontSize: 12 }}>{p.authorName}</span>
              {p.pinned && (
                <span
                  style={{
                    fontSize: 9,
                    padding: "1px 5px",
                    borderRadius: 999,
                    background: "rgba(245,158,11,.12)",
                    border: "1px solid rgba(245,158,11,.25)",
                    color: "rgb(253,230,138)",
                  }}
                >
                  PINNED
                </span>
              )}
              <span style={{ fontSize: 10, opacity: 0.3, marginLeft: "auto" }}>
                {fmtDate(p.createdAt)}
              </span>
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", opacity: 0.85 }}>
              {p.body}
            </div>
            {canManage && (
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <button
                  style={{ ...S.btn, fontSize: 10, padding: "3px 8px" }}
                  onClick={() => togglePin(p.id)}
                >
                  {p.pinned ? "Unpin" : "Pin"}
                </button>
                <button
                  style={{ ...S.danger, fontSize: 10, padding: "3px 8px" }}
                  onClick={() => remove(p.id)}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
        {posts.length === 0 && (
          <div style={{ textAlign: "center", padding: 30, opacity: 0.3, fontSize: 13 }}>
            No posts yet. Be the first to post something.
          </div>
        )}
      </div>
    </div>
  );
}

function FilesTab() {
  return (
    <div>
      <div style={{ ...S.card, textAlign: "center", padding: "40px 20px" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🗂️</div>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>File Management</div>
        <div style={{ fontSize: 13, opacity: 0.5 }}>
          Coming soon — user avatars, uploaded media, and asset management.
        </div>
      </div>
    </div>
  );
}

function ModsAdminTab() {
  const [mods, setMods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showExcluded, setShowExcluded] = useState(false);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ gameSlug: "windrose" });
    if (showExcluded) params.set("excluded", "1");
    if (search.trim()) params.set("search", search.trim());
    const j = await apiFetch(`/staff/mods?${params.toString()}`);
    setMods(j?.mods || []);
    setLoading(false);
  }, [showExcluded, search]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function toggle(mod: any, next: boolean) {
    setBusy(mod.id);
    setMsg("");
    let note: string | null = null;
    if (next) {
      const reason = window.prompt(
        `Hide "${mod.name}" from the public catalog?\n\nOptional note (e.g. "author requested removal via email 2026-04-27"):`,
        "Author requested removal",
      );
      if (reason === null) {
        setBusy(null);
        return;
      }
      note = reason.trim() || null;
    }
    const j = await apiFetch(`/staff/mods/${mod.id}`, {
      method: "PATCH",
      body: JSON.stringify({ excluded: next, note }),
    });
    setBusy(null);
    if (j?.ok) {
      setMsg(next ? `Hid "${mod.name}".` : `Restored "${mod.name}".`);
      reload();
    } else {
      setMsg(j?.error || "Failed.");
    }
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          marginBottom: 14,
          flexWrap: "wrap",
        }}
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or author..."
          style={{ ...S.input, flex: 1, minWidth: 200 }}
        />
        <button onClick={() => setShowExcluded((v) => !v)} style={showExcluded ? S.warn : S.btn}>
          {showExcluded ? "Showing excluded" : "Show active"}
        </button>
        <button onClick={() => reload()} style={S.btn}>
          Refresh
        </button>
        {msg && <span style={{ fontSize: 12, opacity: 0.7 }}>{msg}</span>}
      </div>

      <div
        style={{ ...S.card, padding: "10px 14px", marginBottom: 14, fontSize: 12, opacity: 0.75 }}
      >
        <strong style={{ color: "rgb(216,180,254)" }}>How this works:</strong> Hide a mod when the
        author emails support requesting removal from the catalog. Hidden mods stop appearing on
        /mods/windrose and the in-app Mods tab. The Nexus poller will re-upsert metadata, but the
        excluded flag and note persist.
      </div>

      {loading ? (
        <div style={{ opacity: 0.4 }}>Loading…</div>
      ) : mods.length === 0 ? (
        <div style={{ opacity: 0.4 }}>{showExcluded ? "No excluded mods." : "No mods match."}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {mods.map((m) => (
            <div key={m.id} style={S.card}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {m.thumbnailUrl ? (
                  <img
                    src={m.thumbnailUrl}
                    alt=""
                    style={{
                      width: 56,
                      height: 32,
                      objectFit: "cover",
                      borderRadius: 4,
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 56,
                      height: 32,
                      borderRadius: 4,
                      background: "rgba(124,58,237,.12)",
                      flexShrink: 0,
                    }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {m.name}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.55 }}>
                    by {m.author || "?"} · 👍 {m.endorsements?.toLocaleString() || 0} · ⬇{" "}
                    {m.downloads?.toLocaleString() || 0}
                    {m.sourceUrl && (
                      <>
                        {" · "}
                        <a
                          href={m.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "rgb(167,139,250)" }}
                        >
                          source ↗
                        </a>
                      </>
                    )}
                  </div>
                  {m.excluded && m.excludedNote && (
                    <div
                      style={{
                        fontSize: 11,
                        marginTop: 4,
                        color: "rgb(252,165,165)",
                        fontStyle: "italic",
                      }}
                    >
                      Note: {m.excludedNote}
                      {m.excludedAt && (
                        <span style={{ opacity: 0.6 }}>
                          {" "}
                          · {new Date(m.excludedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => toggle(m, !m.excluded)}
                  disabled={busy === m.id}
                  style={m.excluded ? S.success : S.danger}
                >
                  {busy === m.id ? "…" : m.excluded ? "Restore" : "Hide"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConfigTab() {
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [lobbies, setLobbies] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    Promise.all([apiFetch("/staff/config"), apiFetch("/staff/lobbies")]).then(
      ([configData, lobbyData]) => {
        if (configData.ok) setConfig(configData.config);
        setLobbies((lobbyData.lobbies || []).map((l: any) => ({ id: l.id, name: l.name })));
        setLoading(false);
      },
    );
  }, []);

  async function save() {
    if (!config) return;
    setSaving(true);
    setMsg("");
    const j = await apiFetch("/staff/config", { method: "POST", body: JSON.stringify(config) });
    setSaving(false);
    setMsg(j.ok ? "Saved." : j.error || "Failed.");
  }

  if (loading) return <div style={{ opacity: 0.4 }}>Loading…</div>;
  if (!config) return <div style={{ opacity: 0.4 }}>Config unavailable.</div>;

  const toggle = (key: keyof SiteConfig) =>
    setConfig((c) => (c ? { ...c, [key]: !c[key as keyof SiteConfig] } : c));
  const num = (key: keyof SiteConfig, val: string) =>
    setConfig((c) => (c ? { ...c, [key]: Number(val) } : c));

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 14px",
        borderRadius: 9,
        border: "1px solid rgba(255,255,255,.07)",
        background: "rgba(255,255,255,.02)",
        marginBottom: 6,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
      {children}
    </div>
  );

  const Toggle = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
    <button
      onClick={onClick}
      style={{
        width: 44,
        height: 24,
        borderRadius: 999,
        border: "none",
        cursor: "pointer",
        background: on ? "rgba(16,185,129,.7)" : "rgba(255,255,255,.12)",
        position: "relative",
        transition: "background .15s",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: on ? 23 : 3,
          width: 18,
          height: 18,
          borderRadius: 999,
          background: "#fff",
          transition: "left .15s",
        }}
      />
    </button>
  );

  return (
    <div style={{ maxWidth: 560 }}>
      <Row label="Featured Hero Lobby">
        <select
          value={config.featuredLobbyId || ""}
          onChange={(e) => setConfig((c) => (c ? { ...c, featuredLobbyId: e.target.value } : c))}
          style={{ ...S.input, width: 200, cursor: "pointer" }}
        >
          <option value="">None (auto-fallback)</option>
          {lobbies.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name || l.id}
            </option>
          ))}
        </select>
      </Row>
      <Row label="Registration Open">
        <Toggle on={config.registrationOpen} onClick={() => toggle("registrationOpen")} />
      </Row>
      <Row label="Maintenance Mode">
        <Toggle on={config.maintenanceMode} onClick={() => toggle("maintenanceMode")} />
      </Row>
      <Row label="Operator AI Enabled">
        <Toggle on={config.aiEnabled} onClick={() => toggle("aiEnabled")} />
      </Row>
      <Row label="Chat Rate Limit (msg/min)">
        <input
          type="number"
          style={{ ...S.input, width: 80 }}
          value={config.chatRateLimit}
          onChange={(e) => num("chatRateLimit", e.target.value)}
        />
      </Row>
      <Row label="Max Rooms per Lobby">
        <input
          type="number"
          style={{ ...S.input, width: 80 }}
          value={config.maxRoomsPerLobby}
          onChange={(e) => num("maxRoomsPerLobby", e.target.value)}
        />
      </Row>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 16 }}>
        <button style={{ ...S.btnPri, padding: "8px 20px" }} onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save Config"}
        </button>
        {msg && <span style={{ fontSize: 12, opacity: 0.7 }}>{msg}</span>}
      </div>
    </div>
  );
}

const OUTREACH_STATUSES = [
  "LEAD",
  "CONTACTED",
  "REPLIED",
  "IN_PROGRESS",
  "PARTNERED",
  "DECLINED",
  "STALE",
] as const;
const OUTREACH_CATEGORIES = [
  "GAME_STUDIO",
  "ESPORTS_ORG",
  "CONTENT_CREATOR",
  "BRAND_SPONSOR",
  "MEDIA",
  "COMMUNITY",
  "PLATFORM",
  "OTHER",
] as const;

const STATUS_COLORS: Record<string, string> = {
  LEAD: "rgba(148,163,184,.8)",
  CONTACTED: "rgba(96,165,250,.8)",
  REPLIED: "rgba(253,230,138,.8)",
  IN_PROGRESS: "rgba(129,140,248,.8)",
  PARTNERED: "rgba(110,231,183,.8)",
  DECLINED: "rgba(252,165,165,.8)",
  STALE: "rgba(148,163,184,.4)",
};
const STATUS_BG: Record<string, string> = {
  LEAD: "rgba(148,163,184,.08)",
  CONTACTED: "rgba(96,165,250,.08)",
  REPLIED: "rgba(253,230,138,.08)",
  IN_PROGRESS: "rgba(129,140,248,.08)",
  PARTNERED: "rgba(110,231,183,.08)",
  DECLINED: "rgba(252,165,165,.08)",
  STALE: "rgba(148,163,184,.04)",
};

function OutreachTab() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("");
  const [catFilter, setCatFilter] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [expandedContact, setExpandedContact] = useState<string | null>(null);

  const [fName, setFName] = useState("");
  const [fCompany, setFCompany] = useState("");
  const [fEmail, setFEmail] = useState("");
  const [fRole, setFRole] = useState("");
  const [fCategory, setFCategory] = useState<string>("OTHER");
  const [fStatus, setFStatus] = useState<string>("LEAD");
  const [fNotes, setFNotes] = useState("");
  const [fPostUrl, setFPostUrl] = useState("");
  const [fFollowUp, setFFollowUp] = useState("");

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (filter) params.set("status", filter);
    if (catFilter) params.set("category", catFilter);
    apiFetch(`/staff/outreach?${params.toString()}`)
      .then((j) => {
        if (j.ok) setContacts(j.contacts || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [filter, catFilter]);

  useEffect(() => {
    load();
  }, [load]);

  function resetForm() {
    setFName("");
    setFCompany("");
    setFEmail("");
    setFRole("");
    setFCategory("OTHER");
    setFStatus("LEAD");
    setFNotes("");
    setFPostUrl("");
    setFFollowUp("");
    setEditing(null);
  }

  function editContact(c: any) {
    setFName(c.name);
    setFCompany(c.company);
    setFEmail(c.email || "");
    setFRole(c.role || "");
    setFCategory(c.category);
    setFStatus(c.status);
    setFNotes(c.notes || "");
    setFPostUrl(c.postUrl || "");
    setFFollowUp(c.nextFollowUp ? c.nextFollowUp.slice(0, 10) : "");
    setEditing(c);
    setShowForm(true);
  }

  async function save() {
    const body: any = {
      name: fName,
      company: fCompany,
      email: fEmail,
      role: fRole,
      category: fCategory,
      status: fStatus,
      notes: fNotes,
      postUrl: fPostUrl,
      nextFollowUp: fFollowUp || null,
    };

    if (editing) {
      const j = await apiFetch(`/staff/outreach/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      if (j.ok) {
        setMsg("Updated.");
        setShowForm(false);
        resetForm();
        load();
      } else setMsg(j.error || "Failed.");
    } else {
      const j = await apiFetch("/staff/outreach", { method: "POST", body: JSON.stringify(body) });
      if (j.ok) {
        setMsg("Added.");
        setShowForm(false);
        resetForm();
        load();
      } else setMsg(j.error || "Failed.");
    }
  }

  async function remove(id: string) {
    const j = await apiFetch(`/staff/outreach/${id}`, { method: "DELETE" });
    if (j.ok) load();
  }

  async function quickStatus(id: string, status: string) {
    const j = await apiFetch(`/staff/outreach/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        status,
        lastContact: status !== "LEAD" ? new Date().toISOString() : undefined,
      }),
    });
    if (j.ok) load();
  }

  if (loading) return <div style={{ opacity: 0.4 }}>Loading outreach...</div>;

  const total = contacts.length;
  const byStatus: Record<string, number> = {};
  contacts.forEach((c) => {
    byStatus[c.status] = (byStatus[c.status] || 0) + 1;
  });

  const displayContacts = contacts.filter((c) => {
    if (!searchQ.trim()) return true;
    const q = searchQ.toLowerCase();
    return (c.name + " " + c.company + " " + (c.notes || "") + " " + (c.category || ""))
      .toLowerCase()
      .includes(q);
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {OUTREACH_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(filter === s ? "" : s)}
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              border:
                filter === s ? `1px solid ${STATUS_COLORS[s]}` : "1px solid rgba(255,255,255,.06)",
              background: filter === s ? STATUS_BG[s] : "rgba(255,255,255,.02)",
              color: STATUS_COLORS[s],
            }}
          >
            {s.replace("_", " ")} ({byStatus[s] || 0})
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          style={{ ...S.input, width: 180, fontSize: 11, cursor: "pointer" }}
        >
          <option value="">All Categories</option>
          {OUTREACH_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c.replace("_", " ")}
            </option>
          ))}
        </select>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <span style={{ fontSize: 12, opacity: 0.4 }}>{total} contacts</span>
          <button
            style={S.btnPri}
            onClick={() => {
              resetForm();
              setShowForm(!showForm);
            }}
          >
            {showForm && !editing ? "Cancel" : "+ Add Contact"}
          </button>
        </div>
      </div>

      {msg && <div style={{ fontSize: 12, opacity: 0.7 }}>{msg}</div>}

      {showForm && (
        <div
          style={{
            ...S.card,
            border: "1px solid rgba(124,58,237,.25)",
            background: "rgba(124,58,237,.04)",
          }}
        >
          <div style={{ ...S.label, marginBottom: 10 }}>
            {editing ? "Edit Contact" : "New Contact"}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <div>
              <div style={S.label}>Name *</div>
              <input
                style={S.input}
                value={fName}
                onChange={(e) => setFName(e.target.value)}
                placeholder="Jane Smith"
              />
            </div>
            <div>
              <div style={S.label}>Company *</div>
              <input
                style={S.input}
                value={fCompany}
                onChange={(e) => setFCompany(e.target.value)}
                placeholder="Riot Games"
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <div>
              <div style={S.label}>Email</div>
              <input
                style={S.input}
                value={fEmail}
                onChange={(e) => setFEmail(e.target.value)}
                placeholder="jane@riot.com"
              />
            </div>
            <div>
              <div style={S.label}>Role / Title</div>
              <input
                style={S.input}
                value={fRole}
                onChange={(e) => setFRole(e.target.value)}
                placeholder="Community Manager"
              />
            </div>
          </div>

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}
          >
            <div>
              <div style={S.label}>Category</div>
              <select
                style={{ ...S.input, cursor: "pointer" }}
                value={fCategory}
                onChange={(e) => setFCategory(e.target.value)}
              >
                {OUTREACH_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div style={S.label}>Status</div>
              <select
                style={{ ...S.input, cursor: "pointer" }}
                value={fStatus}
                onChange={(e) => setFStatus(e.target.value)}
              >
                {OUTREACH_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div style={S.label}>Follow-up Date</div>
              <input
                type="date"
                style={S.input}
                value={fFollowUp}
                onChange={(e) => setFFollowUp(e.target.value)}
              />
            </div>
          </div>

          <div style={{ marginBottom: 8 }}>
            <div style={S.label}>Notes</div>
            <textarea
              style={{ ...S.input, minHeight: 60, resize: "vertical" }}
              value={fNotes}
              onChange={(e) => setFNotes(e.target.value)}
              placeholder="Context, thread links, what was discussed..."
            />
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={S.label}>Post / Thread URL</div>
            <input
              style={S.input}
              value={fPostUrl}
              onChange={(e) => setFPostUrl(e.target.value)}
              placeholder="https://reddit.com/r/DnD/comments/..."
            />
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ ...S.btnPri, padding: "8px 20px" }} onClick={save}>
              {editing ? "Update" : "Save"}
            </button>
            {editing && (
              <button
                style={S.btn}
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      <input
        placeholder="Search contacts..."
        value={searchQ}
        onChange={(e) => setSearchQ(e.target.value)}
        style={{ ...S.input, fontSize: 12 }}
      />

      <div
        style={{ borderRadius: 10, border: "1px solid rgba(255,255,255,.06)", overflow: "hidden" }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1.2fr 90px 90px 40px",
            gap: 0,
            padding: "8px 12px",
            background: "rgba(255,255,255,.03)",
            borderBottom: "1px solid rgba(255,255,255,.06)",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: ".06em",
            textTransform: "uppercase" as const,
            color: "rgba(255,255,255,.3)",
          }}
        >
          <span>Name / Company</span>
          <span>Category</span>
          <span>Status</span>
          <span>Action</span>
          <span></span>
        </div>

        {displayContacts.map((c) => {
          const sColor = STATUS_COLORS[c.status] || "rgba(255,255,255,.5)";
          const overdue = c.nextFollowUp && new Date(c.nextFollowUp) < new Date();
          const isExpanded = expandedContact === c.id;
          return (
            <div key={c.id}>
              <div
                onClick={() => setExpandedContact(isExpanded ? null : c.id)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1.2fr 90px 90px 40px",
                  gap: 0,
                  padding: "7px 12px",
                  cursor: "pointer",
                  alignItems: "center",
                  borderBottom: "1px solid rgba(255,255,255,.03)",
                  background: overdue
                    ? "rgba(245,158,11,.03)"
                    : isExpanded
                      ? "rgba(88,0,229,.04)"
                      : "transparent",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => {
                  if (!isExpanded)
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.02)";
                }}
                onMouseLeave={(e) => {
                  if (!isExpanded)
                    (e.currentTarget as HTMLElement).style.background = overdue
                      ? "rgba(245,158,11,.03)"
                      : "transparent";
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 12,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.name}
                    {overdue && (
                      <span style={{ marginLeft: 6, fontSize: 9, color: "rgba(253,230,138,.8)" }}>
                        overdue
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      opacity: 0.4,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.company}
                  </div>
                </div>
                <span style={{ fontSize: 10, opacity: 0.45, fontFamily: "monospace" }}>
                  {c.category.replace(/_/g, " ")}
                </span>
                <span
                  style={{
                    fontSize: 9,
                    padding: "2px 7px",
                    borderRadius: 999,
                    fontWeight: 700,
                    background: STATUS_BG[c.status],
                    color: sColor,
                    border: `1px solid ${sColor}33`,
                    justifySelf: "start",
                    whiteSpace: "nowrap",
                  }}
                >
                  {c.status.replace("_", " ")}
                </span>
                <div onClick={(e) => e.stopPropagation()}>
                  {c.status === "LEAD" && (
                    <button
                      style={{ ...S.btnPri, fontSize: 9, padding: "2px 7px" }}
                      onClick={() => quickStatus(c.id, "CONTACTED")}
                    >
                      Contacted
                    </button>
                  )}
                  {c.status === "CONTACTED" && (
                    <button
                      style={{ ...S.success, fontSize: 9, padding: "2px 7px" }}
                      onClick={() => quickStatus(c.id, "REPLIED")}
                    >
                      Replied
                    </button>
                  )}
                  {c.status === "REPLIED" && (
                    <button
                      style={{ ...S.btnPri, fontSize: 9, padding: "2px 7px" }}
                      onClick={() => quickStatus(c.id, "IN_PROGRESS")}
                    >
                      In Progress
                    </button>
                  )}
                </div>
                <span
                  style={{
                    fontSize: 10,
                    opacity: 0.2,
                    textAlign: "center",
                    transform: isExpanded ? "rotate(90deg)" : "none",
                    transition: "transform .15s",
                  }}
                >
                  &#9654;
                </span>
              </div>

              {isExpanded && (
                <div
                  style={{
                    padding: "10px 12px 12px",
                    background: "rgba(88,0,229,.03)",
                    borderBottom: "1px solid rgba(88,0,229,.12)",
                    display: "flex",
                    gap: 16,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {c.email && (
                      <div style={{ fontSize: 11, opacity: 0.55, marginBottom: 3 }}>
                        Email: {c.email}
                      </div>
                    )}
                    {c.role && (
                      <div style={{ fontSize: 11, opacity: 0.55, marginBottom: 3 }}>
                        Role: {c.role}
                      </div>
                    )}
                    {c.contactInfo && (
                      <div style={{ fontSize: 11, opacity: 0.55, marginBottom: 3 }}>
                        Contact: {c.contactInfo}
                      </div>
                    )}
                    {c.lastContact && (
                      <div style={{ fontSize: 11, opacity: 0.4, marginBottom: 3 }}>
                        Last contact: {new Date(c.lastContact).toLocaleDateString()}
                      </div>
                    )}
                    {c.nextFollowUp && (
                      <div
                        style={{
                          fontSize: 11,
                          color: overdue ? "rgba(253,230,138,.8)" : "rgba(255,255,255,.4)",
                          marginBottom: 3,
                        }}
                      >
                        Follow-up: {new Date(c.nextFollowUp).toLocaleDateString()}
                        {overdue ? " (overdue)" : ""}
                      </div>
                    )}
                    {c.postUrl && (
                      <div style={{ fontSize: 11, marginBottom: 3 }}>
                        <span style={{ opacity: 0.4 }}>Post: </span>
                        <a
                          href={c.postUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "rgba(96,165,250,.8)", textDecoration: "none" }}
                        >
                          {c.postUrl.length > 60 ? c.postUrl.slice(0, 60) + "..." : c.postUrl}
                        </a>
                      </div>
                    )}
                    {c.notes && (
                      <div
                        style={{
                          fontSize: 11,
                          opacity: 0.4,
                          marginTop: 6,
                          whiteSpace: "pre-wrap",
                          lineHeight: 1.5,
                        }}
                      >
                        {c.notes}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                    <button
                      style={{ ...S.btn, fontSize: 10, padding: "4px 10px" }}
                      onClick={() => editContact(c)}
                    >
                      Edit
                    </button>
                    <button
                      style={{ ...S.danger, fontSize: 10, padding: "4px 10px" }}
                      onClick={() => {
                        remove(c.id);
                        setExpandedContact(null);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {contacts.length === 0 && (
          <div style={{ textAlign: "center", padding: 24, opacity: 0.35, fontSize: 13 }}>
            No outreach contacts yet. Add your first one above.
          </div>
        )}
        {contacts.length > 0 && displayContacts.length === 0 && (
          <div style={{ textAlign: "center", padding: 24, opacity: 0.35, fontSize: 13 }}>
            No contacts match your search.
          </div>
        )}
      </div>
    </div>
  );
}

export default function StaffPage() {
  const router = useRouter();
  const ctx = useWeered() as any;

  const [myRole, setMyRole] = useState<GlobalRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [nav, setNav] = useState<NavId>("users");

  useEffect(() => {
    try {
      ctx?.setActiveRoomId?.("@ops");
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    apiFetch("/staff/me")
      .then((j) => {
        if (!j.ok || !["SUPPORT", "STAFF", "ADMIN", "GOD"].includes(j.globalRole)) {
          router.replace("/lobby");
          return;
        }
        setMyRole(j.globalRole);
        setLoading(false);
      })
      .catch(() => router.replace("/lobby"));
  }, []);

  if (loading)
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "var(--weered-bg, #080810)",
          color: "rgba(243,244,246,.4)",
          fontFamily: "monospace",
          fontSize: 13,
        }}
      >
        Checking access…
      </div>
    );

  if (!myRole) return null;

  const visibleNav = NAV_ITEMS.filter((n) => canSeeNav(myRole, n.minRole));

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--weered-bg, #080810)",
        color: "rgba(243,244,246,.92)",
        fontFamily: "system-ui, sans-serif",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          borderBottom: "1px solid rgba(255,255,255,.08)",
          padding: "12px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: "rgba(16,185,129,.85)",
              boxShadow: "0 0 6px rgba(16,185,129,.5)",
            }}
          />
          <div>
            <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-.3px" }}>
              weered ops
            </span>
            <span style={{ fontSize: 11, opacity: 0.4, marginLeft: 10 }}>
              staff area · {myRole}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <RoleBadge role={myRole} />
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("weered:dock:toggle"))}
            style={{
              fontSize: 12,
              opacity: 0.55,
              padding: "5px 12px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,.10)",
              background: "rgba(255,255,255,.04)",
              cursor: "pointer",
              color: "inherit",
            }}
          >
            DMs
          </button>
          <a
            href="/lobby"
            style={{
              fontSize: 12,
              opacity: 0.55,
              textDecoration: "none",
              padding: "5px 12px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,.10)",
              background: "rgba(255,255,255,.04)",
            }}
          >
            ← Lobby
          </a>
        </div>
      </div>

      <div
        className="weered-ops-mobile-nav"
        style={{
          display: "none",
          overflowX: "auto",
          gap: 4,
          padding: "8px 10px",
          borderBottom: "1px solid rgba(255,255,255,.07)",
          scrollbarWidth: "none",
          flexShrink: 0,
        }}
      >
        {visibleNav.map((item) => (
          <button
            key={item.id}
            onClick={() => setNav(item.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "6px 12px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              whiteSpace: "nowrap",
              background: nav === item.id ? "rgba(124,58,237,.18)" : "transparent",
              color: nav === item.id ? "rgba(216,180,254,.95)" : "rgba(148,163,184,.6)",
              fontWeight: nav === item.id ? 700 : 500,
              fontSize: 12,
              fontFamily: "inherit",
              transition: "all .12s",
            }}
          >
            <span style={{ fontSize: 12 }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>

      <div
        className="weered-ops-body"
        style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "200px 1fr 280px" }}
      >
        <div
          className="weered-ops-sidebar"
          style={{
            borderRight: "1px solid rgba(255,255,255,.07)",
            padding: "14px 10px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <div style={{ ...S.label, marginBottom: 8 }}>Navigation</div>
          {visibleNav.map((item) => (
            <button
              key={item.id}
              onClick={() => setNav(item.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                padding: "8px 10px",
                borderRadius: 9,
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                width: "100%",
                background: nav === item.id ? "rgba(124,58,237,.15)" : "transparent",
                color: nav === item.id ? "rgba(216,180,254,.95)" : "rgba(148,163,184,.75)",
                fontWeight: nav === item.id ? 700 : 400,
                fontSize: 13,
                fontFamily: "inherit",
                transition: "background .1s",
              }}
            >
              <span style={{ fontSize: 14 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}

          <div
            style={{
              marginTop: "auto",
              paddingTop: 16,
              borderTop: "1px solid rgba(255,255,255,.06)",
            }}
          >
            <OpsPresence />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
          <div
            style={{
              padding: "14px 20px 12px",
              borderBottom: "1px solid rgba(255,255,255,.07)",
              flexShrink: 0,
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 15 }}>
              {visibleNav.find((n) => n.id === nav)?.icon}{" "}
              {visibleNav.find((n) => n.id === nav)?.label}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
            {nav === "users" && <UsersTab myRole={myRole} />}
            {nav === "board" && <BoardTab myRole={myRole} />}
            {nav === "analytics" && <AnalyticsTab />}
            {nav === "roster" && <RosterTab />}
            {nav === "subs" && <SubsTab />}
            {nav === "rooms" && <RoomsTab myRole={myRole} />}
            {nav === "lobbies" && <LobbiesTab myRole={myRole} />}
            {nav === "events" && <EventsTab myRole={myRole} />}
            {nav === "audit" && <AuditTab />}
            {nav === "broadcast" && <BroadcastTab />}
            {nav === "reports" && <ReportsTab />}
            {nav === "appeals" && <AppealsTab />}
            {nav === "bugs" && <BugsTab />}
            {nav === "outreach" && <OutreachTab />}
            {nav === "mods" && <ModsAdminTab />}
            {nav === "permissions" && <PermissionsTab />}
            {nav === "files" && <FilesTab />}
            {nav === "config" && <ConfigTab />}
          </div>
        </div>

        <div
          className="weered-ops-chat"
          style={{
            borderLeft: "1px solid rgba(255,255,255,.07)",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <div
            style={{
              padding: "14px 14px 10px",
              borderBottom: "1px solid rgba(255,255,255,.07)",
              flexShrink: 0,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 13 }}>Ops Chat</div>
            <div style={{ fontSize: 11, opacity: 0.4, marginTop: 2 }}>#ops · staff only</div>
          </div>
          <div style={{ flex: 1, minHeight: 0, padding: "0 10px 10px" }}>
            <LobbyChatPanel
              roomId="@ops"
              embedded
              style={{ height: "100%", display: "flex", flexDirection: "column" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
