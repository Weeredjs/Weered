"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWeered } from "./WeeredProvider";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE as string) || "http://127.0.0.1:4000";

type RoomRow = { id: string; name: string; locked: boolean; users: number; lobbyId?: string };

function authHeaders() {
  try { const t = localStorage.getItem("weered_token") || ""; return t ? { Authorization: `Bearer ${t}` } : {}; } catch { return {}; }
}

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API_BASE}${path}`, { ...opts, headers: { "Content-Type": "application/json", ...authHeaders(), ...(opts?.headers || {}) } });
  return r.json();
}

// ── RoomsPanel ─────────────────────────────────────────────────────────────────
// lobbyId = which lobby we're in (e.g. "r/gaming", "lobby", "weered.ca")
// Shows only rooms belonging to this lobby. Create room also scoped to lobby.

function RoomsPanel({ currentRoomId, lobbyId }: { currentRoomId: string; lobbyId: string }) {
  const [q,        setQ]        = React.useState("");
  const [newRoom,  setNewRoom]  = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [rows,     setRows]     = React.useState<RoomRow[]>([]);
  const [loading,  setLoading]  = React.useState(false);
  const [err,      setErr]      = React.useState("");

  async function load() {
    setLoading(true); setErr("");
    try {
      // Fetch rooms scoped to this lobby
      const url = lobbyId
        ? `${API_BASE}/lobbies/${encodeURIComponent(lobbyId)}/rooms`
        : `${API_BASE}/rooms`;
      const r = await fetch(url, { cache: "no-store" });
      const j = await r.json();
      const raw = Array.isArray(j?.rooms) ? j.rooms : [];
      setRows(raw.map((r: any) => ({
        id:      String(r.id || ""),
        name:    String(r.name || r.id || ""),
        locked:  Boolean(r.locked),
        users:   Number(r.onlineCount ?? r.users ?? r.memberCount ?? 0),
        lobbyId: r.lobbyId ?? lobbyId,
      })).filter((r: RoomRow) => r.id));
    } catch (e: any) { setErr(String(e?.message || e)); }
    finally { setLoading(false); }
  }

  async function createRoom() {
    const name = newRoom.trim();
    if (!name) return;
    if (!lobbyId) { setErr("No lobby context — can't create room."); return; }
    setCreating(true); setErr("");
    try {
      const j = await fetch(`${API_BASE}/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ name, lobbyId }),
      }).then(r => r.json());
      if (!j?.ok) throw new Error(j?.message || j?.error || "create failed");
      setNewRoom(""); await load();
    } catch (e: any) { setErr(String(e?.message || e)); }
    finally { setCreating(false); }
  }

  // Reload when lobbyId changes (switching lobbies)
  React.useEffect(() => { void load(); }, [lobbyId]);
  // Poll every 6s
  React.useEffect(() => { const t = setInterval(load, 6000); return () => clearInterval(t); }, [lobbyId]);

  const filtered = rows
    .filter(r => !q.trim() || (r.name + " " + r.id).toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => b.users - a.users);

  const s = {
    input: { width: "100%", padding: "7px 10px", borderRadius: 9, border: "1px solid rgba(255,255,255,.10)", background: "rgba(0,0,0,.25)", fontSize: 12, color: "rgba(243,244,246,.90)", outline: "none", boxSizing: "border-box" as const },
    btn:   { padding: "7px 10px", borderRadius: 9, border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.05)", fontSize: 12, cursor: "pointer", color: "rgba(243,244,246,.90)", flexShrink: 0 } as React.CSSProperties,
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.5, letterSpacing: ".7px", textTransform: "uppercase" }}>Rooms</div>
        {lobbyId && (
          <div style={{ fontSize: 10, fontFamily: "monospace", color: "rgba(167,139,250,.70)", background: "rgba(124,58,237,.10)", border: "1px solid rgba(124,58,237,.20)", borderRadius: 6, padding: "2px 7px" }}>
            {lobbyId}
          </div>
        )}
      </div>

      {/* Create */}
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <input style={s.input} placeholder="New room name…" value={newRoom}
          onChange={e => setNewRoom(e.target.value)}
          onKeyDown={e => e.key === "Enter" && createRoom()} />
        <button style={s.btn} onClick={createRoom} disabled={creating || !newRoom.trim()}>
          {creating ? "…" : "Create"}
        </button>
      </div>

      {/* Search */}
      <input style={{ ...s.input, marginBottom: 8 }} placeholder="Search rooms…" value={q} onChange={e => setQ(e.target.value)} />

      {err && <div style={{ fontSize: 11, color: "rgba(252,165,165,.80)", marginBottom: 6 }}>{err}</div>}

      {/* List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 360, overflowY: "auto" }}>
        {loading && !rows.length && <div style={{ fontSize: 12, opacity: 0.5 }}>Loading…</div>}
        {!loading && !filtered.length && (
          <div style={{ fontSize: 12, opacity: 0.4, padding: "8px 0" }}>
            {lobbyId ? `No rooms in ${lobbyId} yet.` : "No rooms."}
          </div>
        )}
        {filtered.slice(0, 40).map(rm => {
          const active   = rm.id === currentRoomId;
          const hasUsers = rm.users > 0;
          return (
            <Link key={rm.id} href={"/room/" + encodeURIComponent(rm.id)} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
              padding: "8px 10px", borderRadius: 10, textDecoration: "none",
              border: active ? "1px solid rgba(124,58,237,.40)" : "1px solid rgba(255,255,255,.07)",
              background: active ? "rgba(124,58,237,.10)" : "rgba(255,255,255,.02)",
              transition: "background 0.12s",
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "rgba(243,244,246,.95)" }}>
                  {rm.name || rm.id}
                  {rm.locked ? <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.6 }}>🔒</span> : null}
                </div>
                <div style={{ fontSize: 11, opacity: 0.45, marginTop: 1 }}>{rm.users} online</div>
              </div>
              {hasUsers && (
                <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 999, border: "1px solid rgba(124,58,237,.30)", background: "rgba(124,58,237,.10)", color: "rgba(216,180,254,.85)", flexShrink: 0 }}>
                  live
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ── LobbyModPanel ──────────────────────────────────────────────────────────────

function LobbyModPanel({ globalRole, lobbyId }: { globalRole: string; lobbyId: string }) {
  const canMod = ["GOD", "STAFF", "ADMIN", "SUPPORT"].includes(globalRole);
  if (!canMod) return null;

  const [note,    setNote]    = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function action(type: string) {
    setLoading(true); setNote("");
    try {
      const path = lobbyId ? `/staff/lobby/${encodeURIComponent(lobbyId)}/${type}` : `/staff/lobby/${type}`;
      const j = await apiFetch(path, { method: "POST", body: JSON.stringify({}) });
      setNote(j.ok ? `Done: ${type}` : j.error || "Failed.");
    } catch { setNote("Request failed."); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.5, letterSpacing: ".7px", textTransform: "uppercase", marginBottom: 8 }}>Lobby Controls</div>
      <div style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.02)", padding: "10px 12px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <button disabled={loading} onClick={() => action("lock")}
            style={{ padding: "8px 10px", borderRadius: 9, border: "1px solid rgba(245,158,11,.25)", background: "rgba(245,158,11,.08)", fontSize: 12, cursor: "pointer", color: "rgb(253,230,138)" }}>
            Lock Chat
          </button>
          <button disabled={loading} onClick={() => action("unlock")}
            style={{ padding: "8px 10px", borderRadius: 9, border: "1px solid rgba(16,185,129,.25)", background: "rgba(16,185,129,.08)", fontSize: 12, cursor: "pointer", color: "rgb(167,243,208)" }}>
            Unlock Chat
          </button>
          <button disabled={loading} onClick={() => { if (confirm("Clear all lobby chat messages?")) action("clear-chat"); }}
            style={{ padding: "8px 10px", borderRadius: 9, border: "1px solid rgba(239,68,68,.25)", background: "rgba(239,68,68,.08)", fontSize: 12, cursor: "pointer", color: "rgba(252,165,165,.90)", gridColumn: "span 2" }}>
            Clear Chat
          </button>
        </div>
        {note && <div style={{ marginTop: 8, fontSize: 11, opacity: 0.65 }}>{note}</div>}
      </div>
    </div>
  );
}

// ── FriendsPanel ───────────────────────────────────────────────────────────────

function FriendsPanel() {
  const [friends, setFriends] = React.useState<any[]>([]);
  const [open, setOpen] = React.useState(true);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => { setMounted(true); }, []);

  async function load() {
    try {
      const j = await apiFetch("/friends");
      setFriends(Array.isArray(j?.friends) ? j.friends : []);
    } catch {}
  }

  React.useEffect(() => { if (mounted) void load(); }, [mounted]);
  React.useEffect(() => {
    if (!mounted) return;
    const t = setInterval(load, 8000); return () => clearInterval(t);
  }, [mounted]);

  if (!mounted || !friends.length) return null;

  const online  = friends.filter(f => f.online);
  const offline = friends.filter(f => !f.online);

  const rowStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 8,
    padding: "7px 10px", borderRadius: 10,
    border: "1px solid rgba(255,255,255,.07)",
    background: "rgba(255,255,255,.02)",
  };

  const renderFriend = (f: any) => (
    <div key={f.id} style={rowStyle}>
      <div style={{ position: "relative", flexShrink: 0 }}>
        <div style={{ width: 26, height: 26, borderRadius: 999, background: f.avatarColor || "rgba(124,58,237,.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff" }}>
          {(f.name || "?").slice(0, 1).toUpperCase()}
        </div>
        <span style={{ position: "absolute", bottom: -1, right: -1, width: 8, height: 8, borderRadius: 999, background: f.online ? "#22c55e" : "rgba(255,255,255,.15)", border: "2px solid rgba(10,10,15,1)" }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(243,244,246,.95)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</div>
        {f.online && f.roomName && <div style={{ fontSize: 10, opacity: 0.45, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.roomName}</div>}
      </div>
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        {f.online && f.roomId && (
          <Link href={"/room/" + encodeURIComponent(f.roomId)} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 999, border: "1px solid rgba(124,58,237,.30)", background: "rgba(124,58,237,.10)", color: "rgba(216,180,254,.85)", textDecoration: "none" }}>
            join
          </Link>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: open ? 8 : 0, cursor: "pointer" }} onClick={() => setOpen(o => !o)}>
        <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.5, letterSpacing: ".7px", textTransform: "uppercase" }}>
          Friends · {online.length} online
        </div>
        <span style={{ fontSize: 10, opacity: 0.4 }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {online.map(renderFriend)}
          {offline.map(renderFriend)}
        </div>
      )}
    </div>
  );
}

// ── CrewPanel ──────────────────────────────────────────────────────────────────

function CrewPanel() {
  const [crews, setCrews] = React.useState<any[]>([]);
  const [open, setOpen] = React.useState(true);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => { setMounted(true); }, []);

  async function load() {
    try {
      const j = await apiFetch("/crews/mine");
      setCrews(Array.isArray(j?.crews) ? j.crews : []);
    } catch {}
  }

  React.useEffect(() => { if (mounted) void load(); }, [mounted]);
  React.useEffect(() => {
    if (!mounted) return;
    const t = setInterval(load, 8000); return () => clearInterval(t);
  }, [mounted]);

  if (!mounted || !crews.length) return null;

  const allMembers = crews.flatMap((c: any) =>
    (c.members || []).map((m: any) => ({ ...m, crewName: c.name, crewTag: c.tag }))
  );
  const online = allMembers.filter((m: any) => m.online);

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: open ? 8 : 0, cursor: "pointer" }} onClick={() => setOpen(o => !o)}>
        <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.5, letterSpacing: ".7px", textTransform: "uppercase" }}>
          Crew · {online.length} online
        </div>
        <span style={{ fontSize: 10, opacity: 0.4 }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {allMembers.length === 0 && <div style={{ fontSize: 12, opacity: 0.4, padding: "6px 0" }}>No crew members yet.</div>}
          {allMembers.map((m: any) => (
            <div key={m.userId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 10, border: "1px solid rgba(255,255,255,.07)", background: "rgba(255,255,255,.02)" }}>
              <div style={{ position: "relative", flexShrink: 0 }}>
                <div style={{ width: 26, height: 26, borderRadius: 999, background: "rgba(245,158,11,.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "rgb(251,191,36)" }}>
                  {(m.name || "?").slice(0, 1).toUpperCase()}
                </div>
                <span style={{ position: "absolute", bottom: -1, right: -1, width: 8, height: 8, borderRadius: 999, background: m.online ? "#22c55e" : "rgba(255,255,255,.15)", border: "2px solid rgba(10,10,15,1)" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(243,244,246,.95)", display: "flex", alignItems: "center", gap: 5, overflow: "hidden" }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</span>
                  {m.crewTag && <span style={{ fontSize: 9, opacity: 0.5, fontFamily: "monospace", flexShrink: 0 }}>[{m.crewTag}]</span>}
                  {m.role === "LEADER" && <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 5, background: "rgba(245,158,11,.15)", color: "rgb(251,191,36)", border: "1px solid rgba(245,158,11,.3)", flexShrink: 0 }}>★</span>}
                </div>
                {m.online && m.roomName && <div style={{ fontSize: 10, opacity: 0.45, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.roomName}</div>}
              </div>
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                {m.online && m.roomId && (
                  <Link href={"/room/" + encodeURIComponent(m.roomId)} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 999, border: "1px solid rgba(245,158,11,.30)", background: "rgba(245,158,11,.10)", color: "rgb(251,191,36)", textDecoration: "none" }}>
                    join
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── RightRail ──────────────────────────────────────────────────────────────────

export default function RightRail({ lobbyId }: { lobbyId?: string }) {
  const pathname       = usePathname() || "";
  const { globalRole } = useWeered() as any;
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => { setMounted(true); }, []);

  // Resolve lobby from prop (passed by RightRailSwitch) or fall back to pathname
  const resolvedLobbyId = lobbyId ?? (() => {
    if (pathname === "/lobby" || pathname.startsWith("/lobby/")) {
      const seg = pathname.replace("/lobby/", "").replace("/lobby", "");
      return seg ? decodeURIComponent(seg) : "lobby";
    }
    return "lobby";
  })();

  const currentRoomId = (() => {
    if (pathname.startsWith("/room/")) return decodeURIComponent(pathname.replace("/room/", ""));
    return resolvedLobbyId;
  })();

  const ctxLabel = resolvedLobbyId || pathname;

  if (!mounted) return (
    <div style={{ padding: "14px 14px 20px", fontSize: 13, color: "rgba(243,244,246,.92)" }}>
      <div style={{ fontWeight: 800, fontSize: 13 }}>Control Panel</div>
      <div style={{ fontSize: 11, opacity: 0.4, marginTop: 4 }}>loading…</div>
    </div>
  );

  return (
    <div style={{ padding: "14px 14px 20px", fontSize: 13, color: "rgba(243,244,246,.92)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 13 }}>Control Panel</div>
          <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>context: {ctxLabel}</div>
        </div>
        <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 999, border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.04)", opacity: 0.7 }}>tools</span>
      </div>

      <LobbyModPanel globalRole={globalRole || ""} lobbyId={resolvedLobbyId} />
      <RoomsPanel currentRoomId={currentRoomId} lobbyId={resolvedLobbyId} />
      <FriendsPanel />
      <CrewPanel />
    </div>
  );
}
