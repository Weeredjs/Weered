"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWeered } from "./WeeredProvider";
import { useOverlay } from "./overlays/OverlayProvider";
import { avatarBg } from "../lib/avatarColor";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE as string) || "http://127.0.0.1:4000";

type RoomRow = { id: string; name: string; locked: boolean; users: number; lobbyId?: string };

function authHeaders() {
  try { const t = localStorage.getItem("weered_token") || ""; return t ? { Authorization: `Bearer ${t}` } : {}; } catch { return {}; }
}

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API_BASE}${path}`, { ...opts, headers: { "Content-Type": "application/json", ...authHeaders(), ...(opts?.headers || {}) } });
  return r.json();
}

// Rooms are always /room/ — only Friends/Crew presence uses roomIsLobby from API
function roomHref(id: string): string {
  let clean = id || "";
  if (clean.startsWith("room:")) clean = clean.slice(5);
  try { clean = decodeURIComponent(clean); } catch {}
  return `/room/${encodeURIComponent(clean)}`;
}

// For friends/crew: use roomIsLobby from the API response
function presenceHref(roomId: string, roomIsLobby: boolean): string {
  let clean = roomId || "";
  if (clean.startsWith("room:")) clean = clean.slice(5);
  try { clean = decodeURIComponent(clean); } catch {}
  if (!clean) return "/lobby";
  return roomIsLobby ? `/lobby/${encodeURIComponent(clean)}` : `/room/${encodeURIComponent(clean)}`;
}

// ── AvatarStack ───────────────────────────────────────────────────────────────
function AvatarStack({ users, size = 18 }: { users: any[]; size?: number }) {
  if (!users.length) return null;
  const shown = users.slice(0, 3);
  return (
    <div style={{ display: "flex", flexDirection: "row-reverse", alignItems: "center" }}>
      {shown.map((u, i) => {
        const nm = String(u?.name || u?.username || "?");
        const bg = u?.avatar ? "rgba(255,255,255,.08)" : avatarBg(nm, false, u?.avatarColor);
        return (
          <div key={i} style={{
            width: size, height: size, borderRadius: "50%", flexShrink: 0,
            background: u?.avatar ? "rgba(0,0,0,0.4)" : bg,
            border: "1.5px solid rgba(10,10,18,1)",
            marginLeft: i > 0 ? -5 : 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: size * 0.45, fontWeight: 700, color: "#fff",
            overflow: "hidden", zIndex: shown.length - i,
          }}>
            {u?.avatar ? <img src={u.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : nm[0]?.toUpperCase()}
          </div>
        );
      })}
    </div>
  );
}

// ── RoomsPanel ────────────────────────────────────────────────────────────────
function RoomsPanel({ currentRoomId, lobbyId }: { currentRoomId: string; lobbyId: string }) {
  const [q,        setQ]        = React.useState("");
  const [newRoom,  setNewRoom]  = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [rows,     setRows]     = React.useState<RoomRow[]>([]);
  const [loading,  setLoading]  = React.useState(false);
  const [err,      setErr]      = React.useState("");

  const w = useWeered() as any;
  const wsUsers: any[] = React.useMemo(() => Array.isArray(w?.users) ? w.users : [], [w?.users]);

  const usersByRoom = React.useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const u of wsUsers) {
      let rid = String(u?.roomId || u?.room || "").replace(/^room:/, "");
      if (!rid) continue;
      try { rid = decodeURIComponent(rid); } catch {}
      if (!map[rid]) map[rid] = [];
      map[rid].push(u);
    }
    return map;
  }, [wsUsers]);

  async function load() {
    setLoading(true); setErr("");
    try {
      const url = lobbyId ? `${API_BASE}/lobbies/${encodeURIComponent(lobbyId)}/rooms` : `${API_BASE}/rooms`;
      const r = await fetch(url, { cache: "no-store" });
      const j = await r.json();
      const raw = Array.isArray(j?.rooms) ? j.rooms : [];
      setRows(raw.map((r: any) => ({
        id: String(r.id || ""), name: String(r.name || r.id || ""),
        locked: Boolean(r.locked), users: Number(r.onlineCount ?? r.users ?? r.memberCount ?? 0),
        lobbyId: r.lobbyId ?? lobbyId,
      })).filter((r: RoomRow) => r.id));
    } catch (e: any) { setErr(String(e?.message || e)); }
    finally { setLoading(false); }
  }

  async function createRoom() {
    const name = newRoom.trim();
    if (!name || !lobbyId) { setErr(!lobbyId ? "No lobby context." : ""); return; }
    setCreating(true); setErr("");
    try {
      const j = await fetch(`${API_BASE}/rooms`, {
        method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ name, lobbyId }),
      }).then(r => r.json());
      if (!j?.ok) throw new Error(j?.message || j?.error || "create failed");
      setNewRoom(""); await load();
    } catch (e: any) { setErr(String(e?.message || e)); }
    finally { setCreating(false); }
  }

  React.useEffect(() => { void load(); }, [lobbyId]);
  React.useEffect(() => { const t = setInterval(load, 8000); return () => clearInterval(t); }, [lobbyId]);

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

      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <input style={s.input} placeholder="New room name…" value={newRoom} onChange={e => setNewRoom(e.target.value)} onKeyDown={e => e.key === "Enter" && createRoom()} />
        <button style={s.btn} onClick={createRoom} disabled={creating || !newRoom.trim()}>{creating ? "…" : "Create"}</button>
      </div>
      <input style={{ ...s.input, marginBottom: 8 }} placeholder="Search rooms…" value={q} onChange={e => setQ(e.target.value)} />
      {err && <div style={{ fontSize: 11, color: "rgba(252,165,165,.80)", marginBottom: 6 }}>{err}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 360, overflowY: "auto" }}>
        {loading && !rows.length && <div style={{ fontSize: 12, opacity: 0.5 }}>Loading…</div>}
        {!loading && !filtered.length && (
          <div style={{ fontSize: 12, opacity: 0.4, padding: "8px 0" }}>{lobbyId ? `No rooms in ${lobbyId} yet.` : "No rooms."}</div>
        )}
        {filtered.slice(0, 40).map(rm => {
          const active      = rm.id === currentRoomId;
          const liveWsUsers = usersByRoom[rm.id] || [];
          const liveCount   = liveWsUsers.length || rm.users;
          const isLive      = liveCount > 0;
          return (
            <Link key={rm.id} href={`/room/${encodeURIComponent(rm.id)}`}
              style={{
                display: "block", textDecoration: "none", padding: "10px 11px", borderRadius: 10,
                border: active ? "1px solid rgba(124,58,237,.45)" : isLive ? "1px solid rgba(255,255,255,.10)" : "1px solid rgba(255,255,255,.06)",
                background: active ? "rgba(124,58,237,.12)" : "rgba(255,255,255,.02)",
                transition: "background 0.12s", position: "relative", overflow: "hidden",
              }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = active ? "rgba(124,58,237,.16)" : "rgba(255,255,255,.05)"; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = active ? "rgba(124,58,237,.12)" : "rgba(255,255,255,.02)"; }}
            >
              {active && <div style={{ position: "absolute", left: 0, top: 4, bottom: 4, width: 2.5, borderRadius: 2, background: "#a78bfa" }} />}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: liveWsUsers.length ? 7 : 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flex: 1 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, background: isLive ? "#22c55e" : "rgba(255,255,255,.15)", boxShadow: isLive ? "0 0 5px #22c55e" : "none" }} />
                  <div style={{ fontWeight: 700, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: active ? "rgba(196,181,253,.97)" : "rgba(243,244,246,.92)" }}>
                    {rm.name || rm.id}{rm.locked && <span style={{ marginLeft: 5, fontSize: 10, opacity: 0.55 }}>🔒</span>}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                  {isLive && <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "monospace", color: "rgba(34,197,94,.85)" }}>{liveCount}</span>}
                  {isLive && <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 999, border: "1px solid rgba(34,197,94,.25)", background: "rgba(34,197,94,.08)", color: "rgba(134,239,172,.85)", fontWeight: 700 }}>live</span>}
                </div>
              </div>
              {liveWsUsers.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingLeft: 12 }}>
                  <AvatarStack users={liveWsUsers} size={18} />
                  {liveWsUsers.length > 3 && <span style={{ fontSize: 10, opacity: 0.4, fontFamily: "monospace" }}>+{liveWsUsers.length - 3}</span>}
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ── LobbyModPanel ─────────────────────────────────────────────────────────────
function LobbyModPanel({ globalRole, lobbyId }: { globalRole: string; lobbyId: string }) {
  const canMod = ["GOD", "STAFF", "ADMIN", "SUPPORT"].includes(globalRole);
  if (!canMod) return null;

  const ctx = useWeered() as any;
  const ctxLocked: boolean | null = typeof ctx?.meta?.locked === "boolean" ? ctx.meta.locked : null;
  const [optimistic, setOptimistic] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    if (optimistic === null) return;
    if (ctxLocked === optimistic) { setOptimistic(null); return; }
    const t = setTimeout(() => setOptimistic(null), 8000);
    return () => clearTimeout(t);
  }, [ctxLocked, optimistic]);

  const LS_KEY = `weered:lobby:chatLocked:${lobbyId}`;
  const chatLocked: boolean = (() => {
    if (optimistic !== null) return optimistic;
    if (ctxLocked !== null) return ctxLocked;
    try { const v = localStorage.getItem(LS_KEY); if (v === "true") return true; if (v === "false") return false; } catch {}
    return false;
  })();

  React.useEffect(() => {
    if (ctxLocked !== null) { try { localStorage.setItem(LS_KEY, String(ctxLocked)); } catch {} }
  }, [ctxLocked]);

  const [note, setNote]     = React.useState("");
  const [loading, setLoad]  = React.useState(false);
  const isLocked = chatLocked === true;

  async function action(type: "lock" | "unlock") {
    setLoad(true); setNote("");
    const willLock = type === "lock";
    setOptimistic(willLock);
    try {
      let j = await apiFetch(`/staff/lobby/${type}`, { method: "POST", body: JSON.stringify({ lobbyId }) });
      if (!j?.ok && type === "unlock") j = await apiFetch("/staff/lobby/lock", { method: "POST", body: JSON.stringify({ lobbyId, locked: false }) });
      if (j?.ok) { setNote(willLock ? "Chat locked." : "Chat unlocked."); try { localStorage.setItem(LS_KEY, String(willLock)); } catch {} }
      else { setOptimistic(!willLock); setNote(j?.error || "Failed."); }
    } catch { setOptimistic(null); setNote("Request failed."); }
    finally { setLoad(false); }
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.5, letterSpacing: ".7px", textTransform: "uppercase" }}>Lobby Controls</div>
        {chatLocked !== null && (
          <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 999, letterSpacing: ".4px", background: isLocked ? "rgba(245,158,11,.12)" : "rgba(16,185,129,.10)", border: `1px solid ${isLocked ? "rgba(245,158,11,.35)" : "rgba(16,185,129,.30)"}`, color: isLocked ? "rgb(253,230,138)" : "rgb(167,243,208)" }}>
            {isLocked ? "CHAT LOCKED" : "CHAT OPEN"}
          </span>
        )}
      </div>
      <div style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.02)", padding: "10px 12px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <button disabled={loading} onClick={() => action("lock")} style={{ padding: "8px 10px", borderRadius: 9, fontSize: 12, cursor: loading ? "default" : "pointer", border: isLocked ? "1px solid rgba(245,158,11,.50)" : "1px solid rgba(245,158,11,.25)", background: isLocked ? "rgba(245,158,11,.18)" : "rgba(245,158,11,.08)", color: "rgb(253,230,138)", fontWeight: isLocked ? 700 : 400 }}>{isLocked ? "🔒 Locked" : "Lock Chat"}</button>
          <button disabled={loading} onClick={() => action("unlock")} style={{ padding: "8px 10px", borderRadius: 9, fontSize: 12, cursor: loading ? "default" : "pointer", border: !isLocked ? "1px solid rgba(16,185,129,.50)" : "1px solid rgba(16,185,129,.25)", background: !isLocked ? "rgba(16,185,129,.18)" : "rgba(16,185,129,.08)", color: "rgb(167,243,208)", fontWeight: !isLocked ? 700 : 400 }}>{!isLocked ? "✓ Unlocked" : "Unlock Chat"}</button>
          <button disabled={loading} style={{ padding: "8px 10px", borderRadius: 9, border: "1px solid rgba(239,68,68,.25)", background: "rgba(239,68,68,.08)", fontSize: 12, cursor: "pointer", color: "rgba(252,165,165,.90)", gridColumn: "span 2" }}
            onClick={async () => {
              if (!window.confirm("Clear all lobby chat messages?")) return;
              setLoad(true);
              try { const j = await apiFetch("/staff/lobby/clear-chat", { method: "POST", body: JSON.stringify({ lobbyId }) }); setNote(j.ok ? "Chat cleared." : j.error || "Failed."); }
              catch { setNote("Request failed."); } finally { setLoad(false); }
            }}>Clear Chat</button>
        </div>
        {note && <div style={{ marginTop: 8, fontSize: 11, opacity: 0.65 }}>{note}</div>}
      </div>
    </div>
  );
}

// ── FriendsPanel ──────────────────────────────────────────────────────────────
function FriendsPanel() {
  const { openSheet } = useOverlay();
  const [friends, setFriends] = React.useState<any[]>([]);
  const [open, setOpen]       = React.useState(true);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => { setMounted(true); }, []);

  async function load() {
    try { const j = await apiFetch("/friends"); setFriends(Array.isArray(j?.friends) ? j.friends : []); } catch {}
  }
  React.useEffect(() => { if (mounted) void load(); }, [mounted]);
  React.useEffect(() => { if (!mounted) return; const t = setInterval(load, 8000); return () => clearInterval(t); }, [mounted]);

  if (!mounted || !friends.length) return null;
  const online  = friends.filter(f => f.online);
  const offline = friends.filter(f => !f.online);

  const renderFriend = (f: any) => {
    const hasUnread   = (f.unreadCount ?? 0) > 0 || Boolean(f.hasUnread ?? f.hasPendingDm);
    const unreadCount = f.unreadCount ?? (hasUnread ? 1 : 0);
    const userId      = String(f.id ?? f.userId ?? f.username ?? "");
    const rawRoomId   = String(f.roomId || "").replace(/^room:/, "");
    // ── Use roomIsLobby from API, fall back to smart detection ──
    // Lobby slugs are always lowercase and human-readable (destiny2, warframe, etc.)
    // Random room IDs from shortRoomId() have mixed case (zbZTrF, k1rc3P)
    const isLobby     = f.roomIsLobby === true
      || (f.roomName || "").toLowerCase().includes("lobby")
      || rawRoomId === "lobby"
      || (rawRoomId.length > 2 && !rawRoomId.startsWith("article_") && /^[a-z][a-z0-9._-]+$/.test(rawRoomId) && rawRoomId.length < 30);
    const joinHref    = rawRoomId ? presenceHref(rawRoomId, isLobby) : null;

    return (
      <div key={f.id}
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 10, border: "1px solid rgba(255,255,255,.07)", background: "rgba(255,255,255,.02)", cursor: "pointer", transition: "background 0.12s" }}
        onClick={() => userId && openSheet("profile", { userId })}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.05)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.02)"; }}
      >
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div style={{ width: 26, height: 26, borderRadius: 999, background: f.avatar ? "rgba(255,255,255,.08)" : (f.avatarColor || "rgba(124,58,237,.3)"), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", overflow: "hidden" }}>
            {f.avatar ? <img src={f.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (f.name || "?").slice(0, 1).toUpperCase()}
          </div>
          <span style={{ position: "absolute", bottom: -1, right: -1, width: 8, height: 8, borderRadius: 999, background: f.online ? "#22c55e" : "rgba(255,255,255,.15)", border: "2px solid rgba(10,10,15,1)" }} />
          {hasUnread && (
            <span style={{ position: "absolute", top: -3, right: -3, minWidth: 14, height: 14, borderRadius: 999, background: "#f59e0b", border: "2px solid rgba(10,10,15,1)", fontSize: 8, fontWeight: 900, color: "#000", display: "flex", alignItems: "center", justifyContent: "center", padding: unreadCount > 9 ? "0 2px" : "0", lineHeight: 1 }}>
              {unreadCount > 9 ? "9+" : unreadCount > 1 ? unreadCount : ""}
            </span>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: hasUnread ? 700 : 600, color: hasUnread ? "rgba(243,244,246,1)" : "rgba(243,244,246,.95)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</div>
          {f.online && f.roomName && <div style={{ fontSize: 10, opacity: 0.45, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.roomName}</div>}
        </div>
        {f.online && joinHref && (
          <Link href={joinHref} onClick={e => e.stopPropagation()} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 999, border: "1px solid rgba(124,58,237,.30)", background: "rgba(124,58,237,.10)", color: "rgba(216,180,254,.85)", textDecoration: "none", flexShrink: 0 }}>
            join
          </Link>
        )}
      </div>
    );
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: open ? 8 : 0, cursor: "pointer" }} onClick={() => setOpen(o => !o)}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.5, letterSpacing: ".7px", textTransform: "uppercase" }}>Friends · {online.length} online</div>
          {friends.some(f => (f.unreadCount ?? 0) > 0 || f.hasUnread || f.hasPendingDm) && (
            <span style={{ width: 7, height: 7, borderRadius: 999, background: "#f59e0b", boxShadow: "0 0 5px #f59e0b88", flexShrink: 0 }} />
          )}
        </div>
        <span style={{ fontSize: 10, opacity: 0.4 }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{online.map(renderFriend)}{offline.map(renderFriend)}</div>}
    </div>
  );
}

// ── CrewPanel ─────────────────────────────────────────────────────────────────
function CrewPanel() {
  const { openSheet } = useOverlay();
  const [crews, setCrews] = React.useState<any[]>([]);
  const [open, setOpen]   = React.useState(true);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => { setMounted(true); }, []);
  async function load() { try { const j = await apiFetch("/crews/mine"); setCrews(Array.isArray(j?.crews) ? j.crews : []); } catch {} }
  React.useEffect(() => { if (mounted) void load(); }, [mounted]);
  React.useEffect(() => { if (!mounted) return; const t = setInterval(load, 8000); return () => clearInterval(t); }, [mounted]);

  if (!mounted || !crews.length) return null;

  const allMembers = crews.flatMap((c: any) =>
    (c.members || []).map((m: any) => ({ ...m, crewName: c.name, crewTag: c.tag }))
  );
  const online = allMembers.filter((m: any) => m.online);

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: open ? 8 : 0, cursor: "pointer" }} onClick={() => setOpen(o => !o)}>
        <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.5, letterSpacing: ".7px", textTransform: "uppercase" }}>Crew · {online.length} online</div>
        <span style={{ fontSize: 10, opacity: 0.4 }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {allMembers.length === 0 && <div style={{ fontSize: 12, opacity: 0.4, padding: "6px 0" }}>No crew members yet.</div>}
          {allMembers.map((m: any) => {
            const userId     = String(m.userId ?? m.id ?? "");
            const rawRoomId  = String(m.roomId || "").replace(/^room:/, "");
            // ── Use roomIsLobby from API, fall back to smart detection ──
            // Lobby slugs are always lowercase (destiny2, warframe), random IDs have mixed case (zbZTrF)
            const isLobby    = m.roomIsLobby === true
              || (m.roomName || "").toLowerCase().includes("lobby")
              || rawRoomId === "lobby"
              || (rawRoomId.length > 2 && !rawRoomId.startsWith("article_") && /^[a-z][a-z0-9._-]+$/.test(rawRoomId) && rawRoomId.length < 30);
            const joinHref   = rawRoomId ? presenceHref(rawRoomId, isLobby) : null;
            return (
              <div key={m.userId}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 10, border: "1px solid rgba(255,255,255,.07)", background: "rgba(255,255,255,.02)", cursor: "pointer", transition: "background 0.12s" }}
                onClick={() => userId && openSheet("profile", { userId })}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.05)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.02)"; }}
              >
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 999, background: m.avatar ? "rgba(255,255,255,.08)" : "rgba(245,158,11,.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "rgb(251,191,36)", overflow: "hidden" }}>
                    {m.avatar ? <img src={m.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (m.name || "?").slice(0, 1).toUpperCase()}
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
                {m.online && joinHref && (
                  <Link href={joinHref} onClick={e => e.stopPropagation()} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 999, border: "1px solid rgba(245,158,11,.30)", background: "rgba(245,158,11,.10)", color: "rgb(251,191,36)", textDecoration: "none", flexShrink: 0 }}>
                    join
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── RightRail ─────────────────────────────────────────────────────────────────
export default function RightRail({ lobbyId }: { lobbyId?: string }) {
  const pathname       = usePathname() || "";
  const { globalRole } = useWeered() as any;
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => { setMounted(true); }, []);

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

  if (!mounted) return (
    <div style={{ padding: "14px 14px 20px", fontSize: 13, color: "rgba(243,244,246,.92)" }}>
      <div style={{ fontWeight: 800, fontSize: 13 }}>Control Panel</div>
      <div style={{ fontSize: 11, opacity: 0.4, marginTop: 4 }}>loading…</div>
    </div>
  );

  return (
    <div style={{ padding: "14px 14px 20px", fontSize: 13, color: "rgba(243,244,246,.92)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 13 }}>Control Panel</div>
          <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>context: {resolvedLobbyId}</div>
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
