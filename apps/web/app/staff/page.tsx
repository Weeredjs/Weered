"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWeered } from "../../components/WeeredProvider";
import LobbyChatPanel from "../../components/LobbyChatPanel";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

type GlobalRole = "USER" | "SUPPORT" | "STAFF" | "GOD";
type StaffUser  = { id: string; name: string; usernameKey: string; globalRole: GlobalRole; createdAt: string };
type AuditLog   = { id: string; actorName: string; action: string; targetName?: string; meta?: any; createdAt: string };
type StaffNote  = { id: string; authorName: string; body: string; createdAt: string };
type StaffRoom  = { id: string; name: string; locked: boolean; members: number; createdAt: string };

function fmtDate(s: string) {
  try { return new Date(s).toLocaleString(); } catch { return s; }
}

function roleColor(r: GlobalRole) {
  if (r === "GOD")     return { bg: "rgba(245,158,11,.12)", border: "rgba(245,158,11,.30)", color: "rgb(253,230,138)" };
  if (r === "STAFF")   return { bg: "rgba(124,58,237,.12)", border: "rgba(124,58,237,.30)", color: "rgb(216,180,254)" };
  if (r === "SUPPORT") return { bg: "rgba(14,165,233,.10)", border: "rgba(14,165,233,.28)", color: "rgb(186,230,253)" };
  return { bg: "rgba(255,255,255,.05)", border: "rgba(255,255,255,.10)", color: "rgba(255,255,255,.55)" };
}

function RoleBadge({ role }: { role: GlobalRole }) {
  const c = roleColor(role);
  return (
    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: c.bg, border: `1px solid ${c.border}`, color: c.color, fontWeight: 700, letterSpacing: ".4px" }}>
      {role}
    </span>
  );
}

function authHeaders() {
  try {
    const tok = localStorage.getItem("weered_token") || "";
    return tok ? { Authorization: `Bearer ${tok}` } : {};
  } catch { return {}; }
}

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, { ...opts, headers: { "Content-Type": "application/json", ...authHeaders(), ...(opts?.headers || {}) } });
  return r.json();
}

const S = {
  card:   { borderRadius: 12, border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.03)", padding: "12px 14px" } as React.CSSProperties,
  btn:    { padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.05)", fontSize: 12, cursor: "pointer", color: "rgba(243,244,246,.90)" } as React.CSSProperties,
  input:  { width: "100%", padding: "8px 12px", borderRadius: 9, border: "1px solid rgba(255,255,255,.10)", background: "rgba(0,0,0,.30)", fontSize: 13, color: "rgba(243,244,246,.92)", outline: "none", boxSizing: "border-box" as const },
  danger: { padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(239,68,68,.30)", background: "rgba(239,68,68,.08)", fontSize: 12, cursor: "pointer", color: "rgba(252,165,165,.90)" } as React.CSSProperties,
  label:  { fontSize: 11, fontWeight: 700, opacity: 0.5, letterSpacing: ".6px", textTransform: "uppercase" as const, marginBottom: 8 },
};

// ── Presence Sidebar ──────────────────────────────────────────────────────────

function OpsPresence() {
  const ctx = useWeered() as any;
  const users: any[] = Array.isArray(ctx?.users) ? ctx.users : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div style={S.label}>Online in Ops</div>
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
        {users.length === 0 && <div style={{ fontSize: 12, opacity: 0.4 }}>No one else here.</div>}
        {users.map((u: any, i: number) => {
          const name = String(u?.name ?? u?.id ?? "?");
          const role = String(u?.role ?? "member");
          const rc   = roleColor((role.toUpperCase() as GlobalRole) || "USER");
          return (
            <div key={u?.id ?? i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 10, border: "1px solid rgba(255,255,255,.07)", background: "rgba(255,255,255,.03)" }}>
              <div style={{ width: 28, height: 28, borderRadius: 999, background: "rgba(124,58,237,.20)", border: "1px solid rgba(124,58,237,.30)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                {name.slice(0, 1).toUpperCase()}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 12, truncate: true }}>{name}</div>
              </div>
              <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 999, background: rc.bg, border: `1px solid ${rc.border}`, color: rc.color, flexShrink: 0 }}>
                {role}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Users Tab ─────────────────────────────────────────────────────────────────

function UsersTab({ myRole }: { myRole: GlobalRole }) {
  const [q, setQ]               = useState("");
  const [users, setUsers]       = useState<StaffUser[]>([]);
  const [loading, setLoading]   = useState(false);
  const [selected, setSelected] = useState<StaffUser | null>(null);
  const [notes, setNotes]       = useState<StaffNote[]>([]);
  const [newNote, setNewNote]   = useState("");
  const [note, setNote]         = useState("");

  const search = useCallback(async () => {
    setLoading(true);
    try {
      const j = await apiFetch(`/staff/users?q=${encodeURIComponent(q)}`);
      setUsers(j.users || []);
    } finally { setLoading(false); }
  }, [q]);

  useEffect(() => { void search(); }, []);

  async function loadNotes(u: StaffUser) {
    setSelected(u); setNotes([]);
    const j = await apiFetch(`/staff/users/${u.id}/notes`);
    setNotes(j.notes || []);
  }

  async function addNote() {
    if (!selected || !newNote.trim()) return;
    const j = await apiFetch(`/staff/users/${selected.id}/note`, { method: "POST", body: JSON.stringify({ body: newNote.trim() }) });
    if (j.ok) { setNewNote(""); setNote("Note saved."); loadNotes(selected); }
    else setNote(j.error || "Failed.");
  }

  async function setRole(userId: string, role: GlobalRole) {
    const j = await apiFetch(`/staff/users/${userId}/role`, { method: "POST", body: JSON.stringify({ role }) });
    if (j.ok) { setNote(`Role updated to ${role}`); search(); if (selected?.id === userId) setSelected(s => s ? { ...s, globalRole: role } : s); }
    else setNote(j.error || "Failed.");
  }

  async function kickUser(userId: string, name: string) {
    if (!confirm(`Global kick ${name}?`)) return;
    const j = await apiFetch(`/staff/users/${userId}/kick`, { method: "POST" });
    setNote(j.ok ? `Kicked ${name}` : j.error || "Failed.");
  }

  const canAssign    = myRole === "STAFF" || myRole === "GOD";
  const canAssignGod = myRole === "GOD";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 16, alignItems: "start" }}>
      <div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input style={{ ...S.input, flex: 1 }} placeholder="Search users…" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && search()} />
          <button style={S.btn} onClick={search}>{loading ? "…" : "Search"}</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {users.map(u => (
            <div key={u.id} onClick={() => loadNotes(u)} style={{ ...S.card, cursor: "pointer", border: selected?.id === u.id ? "1px solid rgba(124,58,237,.40)" : "1px solid rgba(255,255,255,.08)", background: selected?.id === u.id ? "rgba(124,58,237,.08)" : "rgba(255,255,255,.03)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{u.name}</div>
                  <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>{u.usernameKey} · {fmtDate(u.createdAt)}</div>
                </div>
                <RoleBadge role={u.globalRole} />
              </div>
            </div>
          ))}
          {!users.length && !loading && <div style={{ opacity: 0.5, fontSize: 13 }}>No users found.</div>}
        </div>
      </div>

      <div>
        {selected ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={S.card}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{selected.name}</div>
                  <div style={{ fontSize: 11, opacity: 0.5 }}>id: {selected.id}</div>
                </div>
                <RoleBadge role={selected.globalRole} />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                <button style={S.danger} onClick={() => kickUser(selected.id, selected.name)}>Global Kick</button>
                {canAssign && (
                  <>
                    {selected.globalRole !== "SUPPORT" && <button style={S.btn} onClick={() => setRole(selected.id, "SUPPORT")}>→ SUPPORT</button>}
                    {selected.globalRole !== "USER"    && <button style={S.btn} onClick={() => setRole(selected.id, "USER")}>→ USER</button>}
                    {canAssignGod && selected.globalRole !== "STAFF" && <button style={S.btn} onClick={() => setRole(selected.id, "STAFF")}>→ STAFF</button>}
                    {canAssignGod && selected.globalRole !== "GOD"   && <button style={{ ...S.btn, borderColor: "rgba(245,158,11,.35)", color: "rgb(253,230,138)" }} onClick={() => setRole(selected.id, "GOD")}>→ GOD</button>}
                  </>
                )}
              </div>
              {note && <div style={{ marginTop: 8, fontSize: 12, opacity: 0.65 }}>{note}</div>}
            </div>

            <div style={S.card}>
              <div style={{ fontWeight: 700, fontSize: 12, opacity: 0.65, letterSpacing: ".6px", textTransform: "uppercase", marginBottom: 10 }}>Staff Notes</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                {notes.map(n => (
                  <div key={n.id} style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(0,0,0,.25)", border: "1px solid rgba(255,255,255,.07)" }}>
                    <div style={{ fontSize: 12, lineHeight: 1.5 }}>{n.body}</div>
                    <div style={{ fontSize: 11, opacity: 0.45, marginTop: 4 }}>{n.authorName} · {fmtDate(n.createdAt)}</div>
                  </div>
                ))}
                {!notes.length && <div style={{ fontSize: 12, opacity: 0.45 }}>No notes yet.</div>}
              </div>
              <textarea style={{ ...S.input, resize: "vertical", minHeight: 70 }} placeholder="Add a staff note…" value={newNote} onChange={e => setNewNote(e.target.value)} />
              <button style={{ ...S.btn, width: "100%", marginTop: 8 }} onClick={addNote}>Save note</button>
            </div>
          </div>
        ) : (
          <div style={{ opacity: 0.45, fontSize: 13, padding: "20px 0" }}>Select a user to view details.</div>
        )}
      </div>
    </div>
  );
}

// ── Rooms Tab ─────────────────────────────────────────────────────────────────

function RoomsTab({ myRole }: { myRole: GlobalRole }) {
  const [rooms, setRooms]     = useState<StaffRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]         = useState("");
  const canDelete             = myRole === "GOD" || myRole === "STAFF";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const j = await apiFetch("/staff/rooms");
      setRooms(j.rooms || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, []);

  async function deleteRoom(id: string, name: string) {
    if (!confirm(`Delete room "${name || id}"? This cannot be undone.`)) return;
    const j = await apiFetch(`/staff/rooms/${id}`, { method: "DELETE" });
    if (j.ok) { setMsg(`Deleted ${name || id}`); load(); }
    else setMsg(j.error || "Failed.");
  }

  return (
    <div>
      {msg && <div style={{ marginBottom: 12, fontSize: 12, opacity: 0.65 }}>{msg}</div>}
      {loading && <div style={{ opacity: 0.5, fontSize: 13 }}>Loading…</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rooms.map(r => (
          <div key={r.id} style={{ ...S.card, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                {r.name || <span style={{ opacity: 0.4 }}>(unnamed)</span>}
                {r.locked && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 999, border: "1px solid rgba(239,68,68,.30)", color: "rgba(252,165,165,.80)", background: "rgba(239,68,68,.08)" }}>LOCKED</span>}
              </div>
              <div style={{ fontSize: 11, opacity: 0.45, marginTop: 2 }}>
                {r.id} · {r.members} members · {fmtDate(r.createdAt)}
              </div>
            </div>
            {canDelete && (
              <button style={{ ...S.danger, flexShrink: 0 }} onClick={() => deleteRoom(r.id, r.name)}>Delete</button>
            )}
          </div>
        ))}
        {!rooms.length && !loading && <div style={{ opacity: 0.45, fontSize: 13 }}>No rooms found.</div>}
      </div>
    </div>
  );
}

// ── Audit Tab ─────────────────────────────────────────────────────────────────

function AuditTab() {
  const [logs, setLogs]       = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiFetch("/staff/audit").then(j => { setLogs(j.logs || []); setLoading(false); });
  }, []);

  const actionColor = (a: string) => {
    if (a.includes("kick") || a.includes("delete")) return "rgba(239,68,68,.80)";
    if (a.includes("role"))  return "rgba(124,58,237,.90)";
    if (a.includes("note"))  return "rgba(14,165,233,.80)";
    return "rgba(148,163,184,.80)";
  };

  return (
    <div>
      {loading && <div style={{ opacity: 0.5 }}>Loading…</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {logs.map(l => (
          <div key={l.id} style={{ display: "flex", alignItems: "baseline", gap: 12, padding: "8px 12px", borderRadius: 9, border: "1px solid rgba(255,255,255,.07)", background: "rgba(255,255,255,.02)", fontSize: 12 }}>
            <span style={{ color: actionColor(l.action), fontWeight: 700, minWidth: 120, flexShrink: 0 }}>{l.action}</span>
            <span style={{ opacity: 0.8 }}>{l.actorName}</span>
            {l.targetName && <><span style={{ opacity: 0.4 }}>→</span><span style={{ opacity: 0.8 }}>{l.targetName}</span></>}
            {l.meta && <span style={{ opacity: 0.45, fontFamily: "monospace", fontSize: 11 }}>{JSON.stringify(l.meta)}</span>}
            <span style={{ marginLeft: "auto", opacity: 0.40, whiteSpace: "nowrap" }}>{fmtDate(l.createdAt)}</span>
          </div>
        ))}
        {!logs.length && !loading && <div style={{ opacity: 0.45 }}>No audit logs yet.</div>}
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
  const [tab, setTab]         = useState<"users" | "rooms" | "audit">("users");

  // Join @ops room on mount
  useEffect(() => {
    try { ctx?.setActiveRoomId?.("@ops"); } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    apiFetch("/staff/me").then(j => {
      if (!j.ok || !["SUPPORT","STAFF","GOD"].includes(j.globalRole)) {
        router.replace("/lobby"); return;
      }
      setMyRole(j.globalRole);
      setLoading(false);
    }).catch(() => router.replace("/lobby"));
  }, []);

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--weered-bg, #080810)", color: "rgba(243,244,246,.5)", fontFamily: "monospace" }}>
      Checking access…
    </div>
  );

  if (!myRole) return null;

  const canSeeAudit = myRole === "STAFF" || myRole === "GOD";
  const tabs = ["users", "rooms", ...(canSeeAudit ? ["audit"] : [])] as const;

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "var(--weered-bg, #080810)", color: "rgba(243,244,246,.92)", fontFamily: "system-ui, sans-serif", overflow: "hidden" }}>

      {/* Header */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,.08)", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: "-.3px" }}>weered ops</div>
            <div style={{ fontSize: 11, opacity: 0.45, marginTop: 1 }}>staff area · {myRole}</div>
          </div>
          <div style={{ width: 8, height: 8, borderRadius: 999, background: "rgba(16,185,129,.85)", boxShadow: "0 0 6px rgba(16,185,129,.5)" }} title="@ops room live" />
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <RoleBadge role={myRole} />
          <a href="/lobby" style={{ fontSize: 12, opacity: 0.55, textDecoration: "none", padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.04)" }}>← Lobby</a>
        </div>
      </div>

      {/* Body: 3 columns */}
      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "220px 1fr 300px" }}>

        {/* Left: presence */}
        <div style={{ borderRight: "1px solid rgba(255,255,255,.07)", padding: "16px 14px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
          <OpsPresence />
        </div>

        {/* Center: tabs + content */}
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
          <div style={{ padding: "12px 20px 0", display: "flex", gap: 4, borderBottom: "1px solid rgba(255,255,255,.07)", flexShrink: 0 }}>
            {tabs.map(t => (
              <button key={t} onClick={() => setTab(t as any)}
                style={{ padding: "8px 16px", borderRadius: "9px 9px 0 0", border: "none", background: tab === t ? "rgba(124,58,237,.20)" : "transparent", color: tab === t ? "rgba(216,180,254,.95)" : "rgba(148,163,184,.70)", fontWeight: tab === t ? 700 : 400, cursor: "pointer", fontSize: 13 }}>
                {t}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
            {tab === "users" && <UsersTab myRole={myRole} />}
            {tab === "rooms" && <RoomsTab myRole={myRole} />}
            {tab === "audit" && canSeeAudit && <AuditTab />}
          </div>
        </div>

        {/* Right: ops chat */}
        <div style={{ borderLeft: "1px solid rgba(255,255,255,.07)", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid rgba(255,255,255,.07)", flexShrink: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>Ops Chat</div>
            <div style={{ fontSize: 11, opacity: 0.45, marginTop: 2 }}>#ops · staff only</div>
          </div>
          <div style={{ flex: 1, minHeight: 0, padding: "0 10px 10px" }}>
            <LobbyChatPanel roomId="@ops" embedded style={{ height: "100%", display: "flex", flexDirection: "column" }} />
          </div>
        </div>

      </div>
    </div>
  );
}
