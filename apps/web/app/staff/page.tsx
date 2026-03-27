"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWeered } from "../../components/WeeredProvider";
import LobbyChatPanel from "../../components/LobbyChatPanel";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

type GlobalRole = "USER" | "SUPPORT" | "STAFF" | "ADMIN" | "GOD";
type UserTier   = "INNOCENT" | "INDICTED" | "FELON" | "KINGPIN";
type StaffUser  = { id: string; name: string; usernameKey: string; globalRole: GlobalRole; tier: UserTier; notoriety: number; createdAt: string; email?: string; banned?: boolean; banReason?: string };
type AuditLog   = { id: string; actorName: string; action: string; targetName?: string; meta?: any; createdAt: string };
type StaffNote  = { id: string; authorName: string; body: string; createdAt: string };
type StaffRoom  = { id: string; name: string; locked: boolean; members: number; lobbyId?: string; createdAt: string };
type StaffLobby = { id: string; name: string; description?: string; verified: boolean; pinned: boolean; moduleType: string; onlineCount: number };
type SiteConfig = { featuredLobbyId: string; registrationOpen: boolean; maintenanceMode: boolean; defaultTier: UserTier; maxRoomsPerLobby: number; chatRateLimit: number };

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(s: string) {
  try { return new Date(s).toLocaleString(); } catch { return s; }
}

function roleColor(r: string) {
  if (r === "GOD")     return { bg: "rgba(245,158,11,.12)", border: "rgba(245,158,11,.30)", color: "rgb(253,230,138)" };
  if (r === "STAFF")   return { bg: "rgba(124,58,237,.12)", border: "rgba(124,58,237,.30)", color: "rgb(216,180,254)" };
  if (r === "ADMIN")   return { bg: "rgba(167,139,250,.12)", border: "rgba(167,139,250,.30)", color: "rgb(196,181,253)" };
  if (r === "SUPPORT") return { bg: "rgba(14,165,233,.10)", border: "rgba(14,165,233,.28)", color: "rgb(186,230,253)" };
  return { bg: "rgba(255,255,255,.05)", border: "rgba(255,255,255,.10)", color: "rgba(255,255,255,.55)" };
}

function tierColor(t: string) {
  if (t === "KINGPIN")  return { bg: "rgba(245,158,11,.12)", border: "rgba(245,158,11,.30)", color: "rgb(253,230,138)" };
  if (t === "FELON")    return { bg: "rgba(239,68,68,.10)", border: "rgba(239,68,68,.28)", color: "rgb(252,165,165)" };
  if (t === "INDICTED") return { bg: "rgba(124,58,237,.12)", border: "rgba(124,58,237,.30)", color: "rgb(216,180,254)" };
  return { bg: "rgba(255,255,255,.05)", border: "rgba(255,255,255,.10)", color: "rgba(255,255,255,.45)" };
}

function RoleBadge({ role }: { role: string }) {
  const c = roleColor(role);
  return <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 999, background: c.bg, border: `1px solid ${c.border}`, color: c.color, fontWeight: 700, letterSpacing: ".4px", flexShrink: 0 }}>{role}</span>;
}

function TierBadge({ tier }: { tier: string }) {
  const c = tierColor(tier);
  return <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 999, background: c.bg, border: `1px solid ${c.border}`, color: c.color, fontWeight: 700, letterSpacing: ".4px", flexShrink: 0 }}>{tier}</span>;
}

function BannedBadge() {
  return <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 999, background: "rgba(239,68,68,.15)", border: "1px solid rgba(239,68,68,.40)", color: "rgb(252,165,165)", fontWeight: 700, letterSpacing: ".4px", flexShrink: 0 }}>BANNED</span>;
}

function authHeaders() {
  try { const t = localStorage.getItem("weered_token") || ""; return t ? { Authorization: `Bearer ${t}` } : {}; } catch { return {}; }
}

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, { ...opts, headers: { "Content-Type": "application/json", ...authHeaders(), ...(opts?.headers || {}) } });
  return r.json();
}

// ── Style constants ───────────────────────────────────────────────────────────

const S = {
  card:    { borderRadius: 10, border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.03)", padding: "11px 14px" } as React.CSSProperties,
  cardHov: { borderRadius: 10, border: "1px solid rgba(124,58,237,.35)", background: "rgba(124,58,237,.07)", padding: "11px 14px" } as React.CSSProperties,
  btn:     { padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.05)", fontSize: 12, cursor: "pointer", color: "rgba(243,244,246,.88)" } as React.CSSProperties,
  btnPri:  { padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(124,58,237,.35)", background: "rgba(124,58,237,.12)", fontSize: 12, cursor: "pointer", color: "rgb(216,180,254)", fontWeight: 600 } as React.CSSProperties,
  danger:  { padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(239,68,68,.30)", background: "rgba(239,68,68,.08)", fontSize: 12, cursor: "pointer", color: "rgba(252,165,165,.90)" } as React.CSSProperties,
  warn:    { padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(245,158,11,.30)", background: "rgba(245,158,11,.08)", fontSize: 12, cursor: "pointer", color: "rgb(253,230,138)" } as React.CSSProperties,
  success: { padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(16,185,129,.30)", background: "rgba(16,185,129,.08)", fontSize: 12, cursor: "pointer", color: "rgb(110,231,183)" } as React.CSSProperties,
  input:   { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,.10)", background: "rgba(0,0,0,.30)", fontSize: 13, color: "rgba(243,244,246,.92)", outline: "none", boxSizing: "border-box" as const },
  label:   { fontSize: 10, fontWeight: 700, opacity: 0.45, letterSpacing: ".7px", textTransform: "uppercase" as const, marginBottom: 6 },
  sectionTitle: { fontSize: 12, fontWeight: 700, opacity: 0.6, letterSpacing: ".5px", textTransform: "uppercase" as const, marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,.07)" },
};

// ── Sidebar nav ───────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: "users",    label: "Users",         icon: "👤", minRole: "SUPPORT" },
  { id: "subs",     label: "Subscriptions", icon: "💳", minRole: "STAFF" },
  { id: "rooms",     label: "Rooms",         icon: "🚪", minRole: "STAFF" },
  { id: "lobbies",   label: "Lobbies",       icon: "🏛️", minRole: "STAFF" },
  { id: "broadcast", label: "Broadcast",     icon: "📢", minRole: "STAFF" },
  { id: "audit",     label: "Audit Log",     icon: "📋", minRole: "STAFF" },
  { id: "files",     label: "Files",         icon: "🗂️", minRole: "GOD" },
  { id: "config",    label: "Config",        icon: "⚙️", minRole: "GOD" },
] as const;

type NavId = typeof NAV_ITEMS[number]["id"];

const ROLE_RANK: Record<string, number> = { SUPPORT: 1, STAFF: 2, ADMIN: 2, GOD: 3 };

function canSeeNav(myRole: GlobalRole, minRole: string) {
  return (ROLE_RANK[myRole] || 0) >= (ROLE_RANK[minRole] || 99);
}

// ── Presence sidebar ──────────────────────────────────────────────────────────

function OpsPresence() {
  const ctx   = useWeered() as any;
  const users: any[] = Array.isArray(ctx?.users) ? ctx.users : [];
  return (
    <div>
      <div style={S.label}>Online in Ops</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {users.length === 0 && <div style={{ fontSize: 11, opacity: 0.35 }}>No one else here.</div>}
        {users.map((u: any, i: number) => {
          const name = String(u?.name ?? "?");
          const rc = roleColor(String(u?.globalRole ?? u?.role ?? "USER").toUpperCase());
          return (
            <div key={u?.id ?? i} style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 8px", borderRadius: 8, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)" }}>
              <div style={{ width: 24, height: 24, borderRadius: 999, background: "rgba(124,58,237,.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                {name.slice(0, 1).toUpperCase()}
              </div>
              <div style={{ minWidth: 0, flex: 1, fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
              <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 999, background: rc.bg, border: `1px solid ${rc.border}`, color: rc.color, flexShrink: 0 }}>{String(u?.globalRole ?? u?.role ?? "")}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Users tab (with global ban/unban) ────────────────────────────────────────

function UsersTab({ myRole }: { myRole: GlobalRole }) {
  const [q, setQ]               = useState("");
  const [users, setUsers]       = useState<StaffUser[]>([]);
  const [loading, setLoading]   = useState(false);
  const [selected, setSelected] = useState<StaffUser | null>(null);
  const [notes, setNotes]       = useState<StaffNote[]>([]);
  const [newNote, setNewNote]   = useState("");
  const [msg, setMsg]           = useState("");
  const [banReason, setBanReason] = useState("");

  const canEdit    = myRole !== "SUPPORT";
  const canGod     = myRole === "GOD";
  const canBan     = myRole === "STAFF" || myRole === "ADMIN" || myRole === "GOD";

  const search = useCallback(async () => {
    setLoading(true);
    try {
      const j = await apiFetch(`/staff/users?q=${encodeURIComponent(q)}`);
      setUsers(j.users || []);
    } finally { setLoading(false); }
  }, [q]);

  useEffect(() => { void search(); }, []);

  async function loadNotes(u: StaffUser) {
    setSelected(u); setNotes([]); setBanReason("");
    const j = await apiFetch(`/staff/users/${u.id}/notes`);
    setNotes(j.notes || []);
  }

  async function addNote() {
    if (!selected || !newNote.trim()) return;
    const j = await apiFetch(`/staff/users/${selected.id}/note`, { method: "POST", body: JSON.stringify({ body: newNote.trim() }) });
    if (j.ok) { setNewNote(""); setMsg("Note saved."); loadNotes(selected); }
    else setMsg(j.error || "Failed.");
  }

  async function setRole(userId: string, role: string) {
    const j = await apiFetch(`/staff/users/${userId}/role`, { method: "POST", body: JSON.stringify({ role }) });
    if (j.ok) { setMsg(`Role → ${role}`); search(); if (selected?.id === userId) setSelected(s => s ? { ...s, globalRole: role as GlobalRole } : s); }
    else setMsg(j.error || "Failed.");
  }

  async function kickUser(userId: string, name: string) {
    if (!confirm(`Global kick ${name}?`)) return;
    const j = await apiFetch(`/staff/users/${userId}/kick`, { method: "POST" });
    setMsg(j.ok ? `Kicked ${name}` : j.error || "Failed.");
  }

  async function banUser(userId: string, name: string) {
    if (!confirm(`Globally BAN ${name}? This will block them from the entire platform.`)) return;
    const j = await apiFetch(`/staff/users/${userId}/ban`, { method: "POST", body: JSON.stringify({ reason: banReason.trim() }) });
    if (j.ok) {
      setMsg(`Banned ${name}`);
      setBanReason("");
      search();
      if (selected?.id === userId) setSelected(s => s ? { ...s, banned: true, banReason: banReason.trim() } : s);
    } else setMsg(j.error || "Failed.");
  }

  async function unbanUser(userId: string, name: string) {
    if (!confirm(`Unban ${name}?`)) return;
    const j = await apiFetch(`/staff/users/${userId}/ban`, { method: "DELETE" });
    if (j.ok) {
      setMsg(`Unbanned ${name}`);
      search();
      if (selected?.id === userId) setSelected(s => s ? { ...s, banned: false, banReason: undefined } : s);
    } else setMsg(j.error || "Failed.");
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 16, alignItems: "start", height: "100%" }}>
      {/* Left: list */}
      <div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input style={{ ...S.input, flex: 1 }} placeholder="Search by name or handle…" value={q}
            onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && search()} />
          <button style={S.btn} onClick={search}>{loading ? "…" : "Search"}</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {users.map(u => (
            <div key={u.id} onClick={() => loadNotes(u)}
              style={{ ...(selected?.id === u.id ? S.cardHov : S.card), cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                    {u.name || u.usernameKey}
                    {u.banned && <BannedBadge />}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.45, marginTop: 1 }}>@{u.usernameKey} · {fmtDate(u.createdAt)}</div>
                </div>
                <RoleBadge role={u.globalRole} />
              </div>
            </div>
          ))}
          {!users.length && !loading && <div style={{ opacity: 0.4, fontSize: 13 }}>No users found.</div>}
        </div>
      </div>

      {/* Right: detail */}
      {selected ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Identity */}
          <div style={S.card}>
            <div style={S.sectionTitle}>Identity</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 44, height: 44, borderRadius: 999, background: "rgba(124,58,237,.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800 }}>
                {(selected.name || selected.usernameKey).slice(0, 1).toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
                  {selected.name || selected.usernameKey}
                  {selected.banned && <BannedBadge />}
                </div>
                <div style={{ fontSize: 11, opacity: 0.5 }}>@{selected.usernameKey}</div>
                {selected.email && <div style={{ fontSize: 11, opacity: 0.45, marginTop: 2 }}>{selected.email}</div>}
              </div>
              <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                <RoleBadge role={selected.globalRole} />
              </div>
            </div>
            <div style={{ fontSize: 11, opacity: 0.4 }}>ID: <span style={{ fontFamily: "monospace" }}>{selected.id}</span></div>
            <div style={{ fontSize: 11, opacity: 0.4, marginTop: 2 }}>Joined: {fmtDate(selected.createdAt)}</div>
            {selected.banned && selected.banReason && (
              <div style={{ fontSize: 11, color: "rgba(252,165,165,.80)", marginTop: 6, padding: "6px 10px", borderRadius: 6, background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.15)" }}>
                Ban reason: {selected.banReason}
              </div>
            )}
          </div>

          {/* Role actions */}
          {canEdit && (
            <div style={S.card}>
              <div style={S.sectionTitle}>Role Actions</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button style={S.btn} onClick={() => setRole(selected.id, "SUPPORT")}>→ SUPPORT</button>
                <button style={S.btn} onClick={() => setRole(selected.id, "STAFF")}>→ STAFF</button>
                <button style={S.btn} onClick={() => setRole(selected.id, "USER")}>→ USER</button>
                {canGod && <button style={{ ...S.btn, borderColor: "rgba(245,158,11,.30)", color: "rgb(253,230,138)" }} onClick={() => setRole(selected.id, "GOD")}>→ GOD</button>}
                <button style={S.danger} onClick={() => kickUser(selected.id, selected.name)}>Global Kick</button>
              </div>
              {msg && <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>{msg}</div>}
            </div>
          )}

          {/* Global Ban */}
          {canBan && (
            <div style={S.card}>
              <div style={S.sectionTitle}>Global Ban</div>
              {selected.banned ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: 12, color: "rgba(252,165,165,.80)" }}>
                    This user is currently banned from the platform.
                  </div>
                  <button style={S.success} onClick={() => unbanUser(selected.id, selected.name)}>Unban User</button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <input
                    style={S.input}
                    placeholder="Ban reason (optional)…"
                    value={banReason}
                    onChange={e => setBanReason(e.target.value)}
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

          {/* Staff notes */}
          <div style={S.card}>
            <div style={S.sectionTitle}>Staff Notes</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10, maxHeight: 180, overflowY: "auto" }}>
              {notes.length === 0 && <div style={{ fontSize: 12, opacity: 0.4 }}>No notes yet.</div>}
              {notes.map(n => (
                <div key={n.id} style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)" }}>
                  <div style={{ fontSize: 12 }}>{n.body}</div>
                  <div style={{ fontSize: 10, opacity: 0.4, marginTop: 4 }}>{n.authorName} · {fmtDate(n.createdAt)}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <textarea style={{ ...S.input, resize: "vertical", minHeight: 60, flex: 1 }} placeholder="Add a staff note…"
                value={newNote} onChange={e => setNewNote(e.target.value)} />
              <button style={{ ...S.btnPri, alignSelf: "flex-end" }} onClick={addNote}>Save</button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, opacity: 0.3, fontSize: 13 }}>
          Select a user to view details
        </div>
      )}
    </div>
  );
}

// ── Subscriptions tab ─────────────────────────────────────────────────────────

function SubsTab() {
  const [users, setUsers]     = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]         = useState("");
  const [filter, setFilter]   = useState<UserTier | "ALL">("ALL");

  useEffect(() => {
    setLoading(true);
    apiFetch("/staff/subscriptions").then(j => { setUsers(j.users || []); setLoading(false); });
  }, []);

  async function setTier(userId: string, tier: UserTier) {
    const j = await apiFetch(`/staff/users/${userId}/tier`, { method: "POST", body: JSON.stringify({ tier }) });
    if (j.ok) {
      setMsg(`Tier updated to ${tier}`);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, tier } : u));
    } else setMsg(j.error || "Failed.");
  }

  const TIERS: UserTier[] = ["INNOCENT", "INDICTED", "FELON", "KINGPIN"];
  const filtered = filter === "ALL" ? users : users.filter(u => u.tier === filter);

  const counts = TIERS.reduce((acc, t) => ({ ...acc, [t]: users.filter(u => u.tier === t).length }), {} as Record<string, number>);

  return (
    <div>
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
        {TIERS.map(t => {
          const c = tierColor(t);
          return (
            <div key={t} style={{ padding: "14px", borderRadius: 10, border: `1px solid ${c.border}`, background: c.bg, textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: c.color }}>{counts[t] || 0}</div>
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{t}</div>
            </div>
          );
        })}
      </div>

      {/* Filter */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {(["ALL", ...TIERS] as const).map(t => (
          <button key={t} onClick={() => setFilter(t)}
            style={{ ...S.btn, background: filter === t ? "rgba(124,58,237,.15)" : "rgba(255,255,255,.04)", borderColor: filter === t ? "rgba(124,58,237,.35)" : "rgba(255,255,255,.10)", color: filter === t ? "rgb(216,180,254)" : "rgba(243,244,246,.65)" }}>
            {t}
          </button>
        ))}
      </div>

      {msg && <div style={{ marginBottom: 10, fontSize: 12, opacity: 0.7 }}>{msg}</div>}

      {loading && <div style={{ opacity: 0.4 }}>Loading…</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {filtered.map(u => (
          <div key={u.id} style={{ ...S.card, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{u.name || u.usernameKey}</div>
              <div style={{ fontSize: 11, opacity: 0.45, marginTop: 1 }}>@{u.usernameKey} · {u.notoriety} notoriety</div>
            </div>
            <TierBadge tier={u.tier} />
            <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
              {TIERS.filter(t => t !== u.tier).map(t => (
                <button key={t} style={{ ...S.btn, fontSize: 11, padding: "4px 8px" }} onClick={() => setTier(u.id, t)}>→ {t}</button>
              ))}
            </div>
          </div>
        ))}
        {!filtered.length && !loading && <div style={{ opacity: 0.4, fontSize: 13 }}>No users.</div>}
      </div>
    </div>
  );
}

// ── Rooms tab ─────────────────────────────────────────────────────────────────

function RoomsTab({ myRole }: { myRole: GlobalRole }) {
  const [rooms, setRooms]     = useState<StaffRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]         = useState("");
  const canDelete = myRole === "STAFF" || myRole === "ADMIN" || myRole === "GOD";

  useEffect(() => {
    setLoading(true);
    apiFetch("/staff/rooms").then(j => { setRooms(j.rooms || []); setLoading(false); });
  }, []);

  async function deleteRoom(id: string, name: string) {
    if (!confirm(`Delete room "${name || id}"?`)) return;
    const j = await apiFetch(`/staff/rooms/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (j.ok) { setMsg(`Deleted ${name || id}`); setRooms(prev => prev.filter(r => r.id !== id)); }
    else setMsg(j.error || "Failed.");
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontSize: 13, opacity: 0.6 }}>{rooms.length} rooms total</div>
        {msg && <div style={{ fontSize: 12, opacity: 0.7 }}>{msg}</div>}
      </div>
      {loading && <div style={{ opacity: 0.4 }}>Loading…</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {rooms.map(r => (
          <div key={r.id} style={{ ...S.card, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                {r.name || <span style={{ opacity: 0.4 }}>(unnamed)</span>}
                {r.locked && <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 999, border: "1px solid rgba(239,68,68,.30)", color: "rgba(252,165,165,.80)", background: "rgba(239,68,68,.08)" }}>LOCKED</span>}
              </div>
              <div style={{ fontSize: 11, opacity: 0.4, marginTop: 2, fontFamily: "monospace" }}>
                {r.id}{r.lobbyId ? ` · lobby: ${r.lobbyId}` : ""} · {r.members} members · {fmtDate(r.createdAt)}
              </div>
            </div>
            {canDelete && (
              <button style={{ ...S.danger, flexShrink: 0 }} onClick={() => deleteRoom(r.id, r.name)}>Delete</button>
            )}
          </div>
        ))}
        {!rooms.length && !loading && <div style={{ opacity: 0.4, fontSize: 13 }}>No rooms found.</div>}
      </div>
    </div>
  );
}

// ── Lobbies tab (with Set Featured) ──────────────────────────────────────────

function LobbiesTab({ myRole }: { myRole: GlobalRole }) {
  const [lobbies, setLobbies]         = useState<StaffLobby[]>([]);
  const [loading, setLoading]         = useState(false);
  const [msg, setMsg]                 = useState("");
  const [featuredId, setFeaturedId]   = useState("");
  const canEdit = myRole === "STAFF" || myRole === "ADMIN" || myRole === "GOD";

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiFetch("/staff/lobbies"),
      apiFetch("/staff/featured"),
    ]).then(([lobbyData, featData]) => {
      setLobbies(lobbyData.lobbies || []);
      setFeaturedId(featData.featuredLobbyId || "");
      setLoading(false);
    });
  }, []);

  async function togglePin(id: string, pinned: boolean) {
    const j = await apiFetch(`/staff/lobbies/${encodeURIComponent(id)}/pin`, { method: "POST", body: JSON.stringify({ pinned: !pinned }) });
    if (j.ok) { setMsg(`${!pinned ? "Pinned" : "Unpinned"} ${id}`); setLobbies(prev => prev.map(l => l.id === id ? { ...l, pinned: !pinned } : l)); }
    else setMsg(j.error || "Failed.");
  }

  async function setFeatured(id: string) {
    const clearing = featuredId === id;
    const j = await apiFetch("/staff/featured", { method: "POST", body: JSON.stringify({ lobbyId: clearing ? "" : id }) });
    if (j.ok) {
      setFeaturedId(clearing ? "" : id);
      setMsg(clearing ? "Featured cleared" : `Featured → ${id}`);
    } else setMsg(j.error || "Failed.");
  }

  async function lockLobby(id: string) {
    const j = await apiFetch("/staff/lobby/lock", { method: "POST", body: JSON.stringify({ lobbyId: id }) });
    setMsg(j.ok ? `Locked ${id}` : j.error || "Failed.");
  }

  async function unlockLobby(id: string) {
    const j = await apiFetch("/staff/lobby/unlock", { method: "POST", body: JSON.stringify({ lobbyId: id }) });
    setMsg(j.ok ? `Unlocked ${id}` : j.error || "Failed.");
  }

  async function clearChat(id: string) {
    if (!confirm(`Clear all chat in ${id}?`)) return;
    const j = await apiFetch("/staff/lobby/clear-chat", { method: "POST", body: JSON.stringify({ lobbyId: id }) });
    setMsg(j.ok ? `Chat cleared in ${id}` : j.error || "Failed.");
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 13, opacity: 0.6 }}>{lobbies.length} lobbies</div>
          {featuredId && (
            <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, background: "rgba(245,158,11,.12)", border: "1px solid rgba(245,158,11,.30)", color: "rgb(253,230,138)", fontWeight: 700 }}>
              Featured: {featuredId}
            </span>
          )}
        </div>
        {msg && <div style={{ fontSize: 12, opacity: 0.7 }}>{msg}</div>}
      </div>
      {loading && <div style={{ opacity: 0.4 }}>Loading…</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {lobbies.map(l => {
          const isFeatured = featuredId === l.id;
          return (
            <div key={l.id} style={{ ...S.card, borderColor: isFeatured ? "rgba(245,158,11,.35)" : undefined, background: isFeatured ? "rgba(245,158,11,.04)" : undefined }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: canEdit ? 8 : 0 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                    {l.name || l.id}
                    {l.pinned && <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 999, border: "1px solid rgba(124,58,237,.30)", color: "rgba(216,180,254,.80)", background: "rgba(124,58,237,.08)" }}>PINNED</span>}
                    {l.verified && <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 999, border: "1px solid rgba(16,185,129,.30)", color: "rgba(110,231,183,.80)", background: "rgba(16,185,129,.08)" }}>VERIFIED</span>}
                    {isFeatured && <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 999, border: "1px solid rgba(245,158,11,.40)", color: "rgb(253,230,138)", background: "rgba(245,158,11,.12)", fontWeight: 800 }}>★ FEATURED</span>}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.4, marginTop: 1, fontFamily: "monospace" }}>{l.id} · {l.moduleType} · {l.onlineCount} online</div>
                </div>
              </div>
              {canEdit && (
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  <button
                    style={isFeatured ? { ...S.warn, fontSize: 11, padding: "4px 8px", fontWeight: 800 } : { ...S.btn, fontSize: 11, padding: "4px 8px", borderColor: "rgba(245,158,11,.25)", color: "rgb(253,230,138)" }}
                    onClick={() => setFeatured(l.id)}
                  >
                    {isFeatured ? "★ Unfeature" : "☆ Set Featured"}
                  </button>
                  <button style={{ ...S.btn, fontSize: 11, padding: "4px 8px" }} onClick={() => togglePin(l.id, l.pinned)}>
                    {l.pinned ? "Unpin" : "Pin"}
                  </button>
                  <button style={{ ...S.btn, fontSize: 11, padding: "4px 8px", borderColor: "rgba(245,158,11,.25)", color: "rgb(253,230,138)" }} onClick={() => lockLobby(l.id)}>Lock Chat</button>
                  <button style={{ ...S.btn, fontSize: 11, padding: "4px 8px", borderColor: "rgba(16,185,129,.25)", color: "rgb(110,231,183)" }} onClick={() => unlockLobby(l.id)}>Unlock Chat</button>
                  <button style={{ ...S.danger, fontSize: 11, padding: "4px 8px" }} onClick={() => clearChat(l.id)}>Clear Chat</button>
                </div>
              )}
            </div>
          );
        })}
        {!lobbies.length && !loading && <div style={{ opacity: 0.4, fontSize: 13 }}>No lobbies found.</div>}
      </div>
    </div>
  );
}

// ── Audit tab ─────────────────────────────────────────────────────────────────

function AuditTab() {
  const [logs, setLogs]       = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter]   = useState("");

  useEffect(() => {
    setLoading(true);
    apiFetch("/staff/audit").then(j => { setLogs(j.logs || []); setLoading(false); });
  }, []);

  const actionColor = (a: string) => {
    if (a.includes("kick") || a.includes("delete") || a.includes("ban")) return "rgba(239,68,68,.85)";
    if (a.includes("role") || a.includes("tier"))  return "rgba(124,58,237,.95)";
    if (a.includes("note"))  return "rgba(14,165,233,.85)";
    if (a.includes("lock"))  return "rgba(245,158,11,.85)";
    if (a.includes("clear")) return "rgba(239,68,68,.65)";
    if (a.includes("featured") || a.includes("config")) return "rgba(16,185,129,.85)";
    return "rgba(148,163,184,.75)";
  };

  const filtered = filter.trim() ? logs.filter(l => (l.action + l.actorName + (l.targetName || "")).toLowerCase().includes(filter.toLowerCase())) : logs;

  return (
    <div>
      <input style={{ ...S.input, marginBottom: 14 }} placeholder="Filter by action, actor, target…" value={filter} onChange={e => setFilter(e.target.value)} />
      {loading && <div style={{ opacity: 0.4 }}>Loading…</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {filtered.map(l => (
          <div key={l.id} style={{ display: "flex", alignItems: "baseline", gap: 12, padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,.07)", background: "rgba(255,255,255,.02)", fontSize: 12 }}>
            <span style={{ color: actionColor(l.action), fontWeight: 700, minWidth: 130, flexShrink: 0 }}>{l.action}</span>
            <span style={{ opacity: 0.8, flexShrink: 0 }}>{l.actorName}</span>
            {l.targetName && <><span style={{ opacity: 0.35 }}>→</span><span style={{ opacity: 0.75 }}>{l.targetName}</span></>}
            {l.meta && <span style={{ opacity: 0.4, fontFamily: "monospace", fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{JSON.stringify(l.meta)}</span>}
            <span style={{ marginLeft: "auto", opacity: 0.35, whiteSpace: "nowrap", fontSize: 11 }}>{fmtDate(l.createdAt)}</span>
          </div>
        ))}
        {!filtered.length && !loading && <div style={{ opacity: 0.4, fontSize: 13 }}>No audit logs.</div>}
      </div>
    </div>
  );
}

// ── Broadcast tab ─────────────────────────────────────────────────────────────

function BroadcastTab() {
  const [message, setMessage] = useState("");
  const [level, setLevel]     = useState<"info" | "warning" | "urgent">("info");
  const [sending, setSending] = useState(false);
  const [result, setResult]   = useState("");
  const [history, setHistory] = useState<Array<{ message: string; level: string; sent: number; ts: string }>>([]);

  async function send() {
    if (!message.trim()) return;
    if (!confirm(`Broadcast "${message.trim()}" as ${level.toUpperCase()} to all connected users?`)) return;
    setSending(true); setResult("");
    try {
      const j = await apiFetch("/staff/broadcast", { method: "POST", body: JSON.stringify({ message: message.trim(), level }) });
      if (j.ok) {
        setResult(`Sent to ${j.sent} user${j.sent !== 1 ? "s" : ""}.`);
        setHistory(prev => [{ message: message.trim(), level, sent: j.sent, ts: new Date().toLocaleString() }, ...prev].slice(0, 10));
        setMessage("");
      } else {
        setResult(j.error || "Failed.");
      }
    } catch { setResult("Request failed."); }
    finally { setSending(false); }
  }

  const levelStyles: Record<string, { bg: string; border: string; color: string; label: string }> = {
    info:    { bg: "rgba(88,0,229,.12)", border: "rgba(88,0,229,.35)", color: "rgb(216,180,254)", label: "📢 Info" },
    warning: { bg: "rgba(245,158,11,.10)", border: "rgba(245,158,11,.35)", color: "rgb(253,230,138)", label: "⚠️ Warning" },
    urgent:  { bg: "rgba(239,68,68,.10)", border: "rgba(239,68,68,.35)", color: "rgb(252,165,165)", label: "🚨 Urgent" },
  };

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ ...S.card, marginBottom: 16 }}>
        <div style={S.sectionTitle}>Send System Broadcast</div>
        <div style={{ fontSize: 11, opacity: 0.45, marginBottom: 12 }}>
          Sends a persistent alert bar to all connected users. They must manually dismiss it.
        </div>

        {/* Message */}
        <textarea
          style={{ ...S.input, resize: "vertical", minHeight: 70, marginBottom: 10 }}
          placeholder="Broadcast message…"
          value={message}
          onChange={e => setMessage(e.target.value)}
          maxLength={500}
        />
        <div style={{ fontSize: 10, opacity: 0.3, textAlign: "right", marginBottom: 10 }}>{message.length}/500</div>

        {/* Level selector */}
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {(["info", "warning", "urgent"] as const).map(l => {
            const ls = levelStyles[l];
            const active = level === l;
            return (
              <button key={l} onClick={() => setLevel(l)} style={{
                flex: 1, padding: "10px", borderRadius: 9, textAlign: "center",
                border: `1px solid ${active ? ls.border : "rgba(255,255,255,.08)"}`,
                background: active ? ls.bg : "rgba(255,255,255,.02)",
                color: active ? ls.color : "rgba(243,244,246,.5)",
                fontSize: 12, fontWeight: active ? 700 : 400, cursor: "pointer",
                transition: "all .12s",
              }}>
                {ls.label}
              </button>
            );
          })}
        </div>

        {/* Preview */}
        {message.trim() && (
          <div style={{
            marginBottom: 14, padding: "10px 14px", borderRadius: 9,
            background: levelStyles[level].bg,
            border: `1px solid ${levelStyles[level].border}`,
            color: levelStyles[level].color,
            fontSize: 13, fontWeight: 600,
          }}>
            <span style={{ marginRight: 8 }}>{level === "info" ? "📢" : level === "warning" ? "⚠️" : "🚨"}</span>
            {message.trim()}
          </div>
        )}

        {/* Send */}
        <button
          onClick={send}
          disabled={sending || !message.trim()}
          style={{
            ...S.btnPri, width: "100%", padding: "10px", fontSize: 13,
            opacity: sending || !message.trim() ? 0.5 : 1,
          }}
        >
          {sending ? "Sending…" : "Send Broadcast"}
        </button>

        {result && <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>{result}</div>}
      </div>

      {/* Recent broadcasts */}
      {history.length > 0 && (
        <div style={S.card}>
          <div style={S.sectionTitle}>Recent Broadcasts (this session)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {history.map((h, i) => {
              const ls = levelStyles[h.level] || levelStyles.info;
              return (
                <div key={i} style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.06)" }}>
                  <div style={{ fontSize: 12, color: ls.color }}>{h.message}</div>
                  <div style={{ fontSize: 10, opacity: 0.4, marginTop: 3 }}>{h.level.toUpperCase()} · {h.sent} users · {h.ts}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Files tab ─────────────────────────────────────────────────────────────────

function FilesTab() {
  return (
    <div>
      <div style={{ ...S.card, textAlign: "center", padding: "40px 20px" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🗂️</div>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>File Management</div>
        <div style={{ fontSize: 13, opacity: 0.5 }}>Coming soon — user avatars, uploaded media, and asset management.</div>
      </div>
    </div>
  );
}

// ── Config tab (wired to real SiteConfig endpoints) ──────────────────────────

function ConfigTab() {
  const [config, setConfig]   = useState<SiteConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState("");
  const [lobbies, setLobbies] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    Promise.all([
      apiFetch("/staff/config"),
      apiFetch("/staff/lobbies"),
    ]).then(([configData, lobbyData]) => {
      if (configData.ok) setConfig(configData.config);
      setLobbies((lobbyData.lobbies || []).map((l: any) => ({ id: l.id, name: l.name })));
      setLoading(false);
    });
  }, []);

  async function save() {
    if (!config) return;
    setSaving(true); setMsg("");
    const j = await apiFetch("/staff/config", { method: "POST", body: JSON.stringify(config) });
    setSaving(false);
    setMsg(j.ok ? "Saved." : j.error || "Failed.");
  }

  if (loading) return <div style={{ opacity: 0.4 }}>Loading…</div>;
  if (!config) return <div style={{ opacity: 0.4 }}>Config unavailable.</div>;

  const toggle = (key: keyof SiteConfig) => setConfig(c => c ? { ...c, [key]: !c[key as keyof SiteConfig] } : c);
  const num    = (key: keyof SiteConfig, val: string) => setConfig(c => c ? { ...c, [key]: Number(val) } : c);

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 9, border: "1px solid rgba(255,255,255,.07)", background: "rgba(255,255,255,.02)", marginBottom: 6 }}>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
      {children}
    </div>
  );

  const Toggle = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
    <button onClick={onClick} style={{ width: 44, height: 24, borderRadius: 999, border: "none", cursor: "pointer", background: on ? "rgba(16,185,129,.7)" : "rgba(255,255,255,.12)", position: "relative", transition: "background .15s" }}>
      <span style={{ position: "absolute", top: 3, left: on ? 23 : 3, width: 18, height: 18, borderRadius: 999, background: "#fff", transition: "left .15s" }} />
    </button>
  );

  return (
    <div style={{ maxWidth: 560 }}>
      <Row label="Featured Hero Lobby">
        <select
          value={config.featuredLobbyId || ""}
          onChange={e => setConfig(c => c ? { ...c, featuredLobbyId: e.target.value } : c)}
          style={{ ...S.input, width: 200, cursor: "pointer" }}
        >
          <option value="">None (auto-fallback)</option>
          {lobbies.map(l => (
            <option key={l.id} value={l.id}>{l.name || l.id}</option>
          ))}
        </select>
      </Row>
      <Row label="Registration Open"><Toggle on={config.registrationOpen} onClick={() => toggle("registrationOpen")} /></Row>
      <Row label="Maintenance Mode"><Toggle on={config.maintenanceMode} onClick={() => toggle("maintenanceMode")} /></Row>
      <Row label="Chat Rate Limit (msg/min)">
        <input type="number" style={{ ...S.input, width: 80 }} value={config.chatRateLimit} onChange={e => num("chatRateLimit", e.target.value)} />
      </Row>
      <Row label="Max Rooms per Lobby">
        <input type="number" style={{ ...S.input, width: 80 }} value={config.maxRoomsPerLobby} onChange={e => num("maxRoomsPerLobby", e.target.value)} />
      </Row>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 16 }}>
        <button style={{ ...S.btnPri, padding: "8px 20px" }} onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Config"}</button>
        {msg && <span style={{ fontSize: 12, opacity: 0.7 }}>{msg}</span>}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function StaffPage() {
  const router = useRouter();
  const ctx    = useWeered() as any;

  const [myRole, setMyRole]   = useState<GlobalRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [nav, setNav]         = useState<NavId>("users");

  useEffect(() => {
    try { ctx?.setActiveRoomId?.("@ops"); } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    apiFetch("/staff/me").then(j => {
      if (!j.ok || !["SUPPORT","STAFF","ADMIN","GOD"].includes(j.globalRole)) {
        router.replace("/lobby"); return;
      }
      setMyRole(j.globalRole);
      setLoading(false);
    }).catch(() => router.replace("/lobby"));
  }, []);

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--weered-bg, #080810)", color: "rgba(243,244,246,.4)", fontFamily: "monospace", fontSize: 13 }}>
      Checking access…
    </div>
  );

  if (!myRole) return null;

  const visibleNav = NAV_ITEMS.filter(n => canSeeNav(myRole, n.minRole));

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "var(--weered-bg, #080810)", color: "rgba(243,244,246,.92)", fontFamily: "system-ui, sans-serif", overflow: "hidden" }}>

      {/* Header */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,.08)", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: 999, background: "rgba(16,185,129,.85)", boxShadow: "0 0 6px rgba(16,185,129,.5)" }} />
          <div>
            <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-.3px" }}>weered ops</span>
            <span style={{ fontSize: 11, opacity: 0.4, marginLeft: 10 }}>staff area · {myRole}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <RoleBadge role={myRole} />
          <a href="/lobby" style={{ fontSize: 12, opacity: 0.55, textDecoration: "none", padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.04)" }}>← Lobby</a>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "200px 1fr 280px" }}>

        {/* Left: nav + presence */}
        <div style={{ borderRight: "1px solid rgba(255,255,255,.07)", padding: "14px 10px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ ...S.label, marginBottom: 8 }}>Navigation</div>
          {visibleNav.map(item => (
            <button key={item.id} onClick={() => setNav(item.id)}
              style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 9, border: "none", cursor: "pointer", textAlign: "left", width: "100%", background: nav === item.id ? "rgba(124,58,237,.15)" : "transparent", color: nav === item.id ? "rgba(216,180,254,.95)" : "rgba(148,163,184,.75)", fontWeight: nav === item.id ? 700 : 400, fontSize: 13, transition: "background .1s" }}>
              <span style={{ fontSize: 14 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}

          <div style={{ marginTop: "auto", paddingTop: 16, borderTop: "1px solid rgba(255,255,255,.06)" }}>
            <OpsPresence />
          </div>
        </div>

        {/* Center: content */}
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
          {/* Section header */}
          <div style={{ padding: "14px 20px 12px", borderBottom: "1px solid rgba(255,255,255,.07)", flexShrink: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>
              {visibleNav.find(n => n.id === nav)?.icon} {visibleNav.find(n => n.id === nav)?.label}
            </div>
          </div>
          {/* Content */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
            {nav === "users"   && <UsersTab myRole={myRole} />}
            {nav === "subs"    && <SubsTab />}
            {nav === "rooms"   && <RoomsTab myRole={myRole} />}
            {nav === "lobbies" && <LobbiesTab myRole={myRole} />}
            {nav === "audit"     && <AuditTab />}
            {nav === "broadcast" && <BroadcastTab />}
            {nav === "files"     && <FilesTab />}
            {nav === "config"  && <ConfigTab />}
          </div>
        </div>

        {/* Right: ops chat */}
        <div style={{ borderLeft: "1px solid rgba(255,255,255,.07)", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid rgba(255,255,255,.07)", flexShrink: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>Ops Chat</div>
            <div style={{ fontSize: 11, opacity: 0.4, marginTop: 2 }}>#ops · staff only</div>
          </div>
          <div style={{ flex: 1, minHeight: 0, padding: "0 10px 10px" }}>
            <LobbyChatPanel roomId="@ops" embedded style={{ height: "100%", display: "flex", flexDirection: "column" }} />
          </div>
        </div>

      </div>
    </div>
  );
}
