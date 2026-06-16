"use client";
import { useState, useEffect, useCallback } from "react";
import {
  BannedBadge,
  GlobalRole,
  RoleBadge,
  S,
  StaffNote,
  StaffUser,
  apiFetch,
  fmtDate,
} from "./shared";

export function UsersTab({ myRole }: { myRole: GlobalRole }) {
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
