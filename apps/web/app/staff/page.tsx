"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

type GlobalRole = "USER" | "SUPPORT" | "STAFF" | "GOD";
type StaffUser = { id: string; name: string; usernameKey: string; globalRole: GlobalRole; createdAt: string };
type AuditLog  = { id: string; actorName: string; action: string; targetName?: string; meta?: any; createdAt: string };
type StaffNote = { id: string; authorName: string; body: string; createdAt: string };

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

// ── Tabs ─────────────────────────────────────────────────────────────────────

function UsersTab({ myRole }: { myRole: GlobalRole }) {
  const [q, setQ]             = useState("");
  const [users, setUsers]     = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<StaffUser | null>(null);
  const [notes, setNotes]     = useState<StaffNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [note, setNote]       = useState("");

  const search = useCallback(async () => {
    setLoading(true);
    try {
      const j = await apiFetch(`/staff/users?q=${encodeURIComponent(q)}`);
      setUsers(j.users || []);
    } finally { setLoading(false); }
  }, [q]);

  useEffect(() => { void search(); }, []);

  async function loadNotes(u: StaffUser) {
    setSelected(u);
    setNotes([]);
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

  const canAssign = myRole === "STAFF" || myRole === "GOD";
  const canAssignGod = myRole === "GOD";

  const s = {
    card:  { borderRadius: 12, border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.03)", padding: "12px 14px" } as React.CSSProperties,
    btn:   { padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.05)", fontSize: 12, cursor: "pointer", color: "rgba(243,244,246,.90)" } as React.CSSProperties,
    input: { width: "100%", padding: "8px 12px", borderRadius: 9, border: "1px solid rgba(255,255,255,.10)", background: "rgba(0,0,0,.30)", fontSize: 13, color: "rgba(243,244,246,.92)", outline: "none", boxSizing: "border-box" as const },
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 16, alignItems: "start" }}>
      {/* Left: user list */}
      <div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input style={{ ...s.input, flex: 1 }} placeholder="Search users…" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && search()} />
          <button style={s.btn} onClick={search}>{loading ? "…" : "Search"}</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {users.map(u => (
            <div key={u.id}
              onClick={() => loadNotes(u)}
              style={{ ...s.card, cursor: "pointer", border: selected?.id === u.id ? "1px solid rgba(124,58,237,.40)" : "1px solid rgba(255,255,255,.08)", background: selected?.id === u.id ? "rgba(124,58,237,.08)" : "rgba(255,255,255,.03)" }}>
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

      {/* Right: user detail */}
      <div>
        {selected ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Header */}
            <div style={s.card}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{selected.name}</div>
                  <div style={{ fontSize: 11, opacity: 0.5 }}>id: {selected.id}</div>
                </div>
                <RoleBadge role={selected.globalRole} />
              </div>

              {/* Actions */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                <button style={s.btn} onClick={() => kickUser(selected.id, selected.name)}>Global Kick</button>
                {canAssign && (
                  <>
                    {selected.globalRole !== "SUPPORT" && <button style={s.btn} onClick={() => setRole(selected.id, "SUPPORT")}>→ SUPPORT</button>}
                    {selected.globalRole !== "USER"    && <button style={s.btn} onClick={() => setRole(selected.id, "USER")}>→ USER</button>}
                    {canAssignGod && selected.globalRole !== "STAFF" && <button style={s.btn} onClick={() => setRole(selected.id, "STAFF")}>→ STAFF</button>}
                    {canAssignGod && selected.globalRole !== "GOD"   && <button style={{ ...s.btn, borderColor: "rgba(245,158,11,.35)", color: "rgb(253,230,138)" }} onClick={() => setRole(selected.id, "GOD")}>→ GOD</button>}
                  </>
                )}
              </div>
              {note && <div style={{ marginTop: 8, fontSize: 12, opacity: 0.65 }}>{note}</div>}
            </div>

            {/* Notes */}
            <div style={s.card}>
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
              <textarea
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                placeholder="Add a staff note…"
                rows={3}
                style={{ ...s.input, resize: "none", marginBottom: 8 }}
              />
              <button style={{ ...s.btn, width: "100%" }} onClick={addNote}>Save note</button>
            </div>
          </div>
        ) : (
          <div style={{ opacity: 0.45, fontSize: 13, padding: "20px 0" }}>Select a user to view details.</div>
        )}
      </div>
    </div>
  );
}

function AuditTab() {
  const [logs, setLogs]       = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiFetch("/staff/audit").then(j => { setLogs(j.logs || []); setLoading(false); });
  }, []);

  const actionColor = (a: string) => {
    if (a.includes("kick"))    return "rgba(239,68,68,.80)";
    if (a.includes("role"))    return "rgba(124,58,237,.90)";
    if (a.includes("note"))    return "rgba(14,165,233,.80)";
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
  const [myRole, setMyRole]   = useState<GlobalRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState<"users" | "audit">("users");

  useEffect(() => {
    apiFetch("/staff/me").then(j => {
      if (!j.ok || !["SUPPORT","STAFF","GOD"].includes(j.globalRole)) {
        router.replace("/lobby");
        return;
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

  return (
    <div style={{ minHeight: "100vh", background: "var(--weered-bg, #080810)", color: "rgba(243,244,246,.92)", fontFamily: "system-ui, sans-serif", padding: "0 0 60px" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,.08)", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: "-.3px" }}>weered ops</div>
          <div style={{ fontSize: 12, opacity: 0.5, marginTop: 2 }}>staff area · {myRole}</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <RoleBadge role={myRole} />
          <a href="/lobby" style={{ fontSize: 12, opacity: 0.55, textDecoration: "none", padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.04)" }}>← Lobby</a>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ padding: "16px 24px 0", display: "flex", gap: 4 }}>
        {(["users", ...(canSeeAudit ? ["audit"] : [])] as const).map(t => (
          <button key={t} onClick={() => setTab(t as any)}
            style={{ padding: "8px 16px", borderRadius: 9, border: "none", background: tab === t ? "rgba(124,58,237,.20)" : "transparent", color: tab === t ? "rgba(216,180,254,.95)" : "rgba(148,163,184,.70)", fontWeight: tab === t ? 700 : 400, cursor: "pointer", fontSize: 13 }}>
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: "20px 24px" }}>
        {tab === "users"  && <UsersTab myRole={myRole} />}
        {tab === "audit"  && canSeeAudit && <AuditTab />}
      </div>
    </div>
  );
}
