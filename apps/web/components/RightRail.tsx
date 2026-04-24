"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useWeered } from "./WeeredProvider";
import { useOverlay } from "./overlays/OverlayProvider";
import { avatarBg } from "../lib/avatarColor";
import EmptyState from "./EmptyState";
import { weeredConfirm } from "../lib/confirm";
import PresenceRow from "./PresenceRow";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE as string) || "http://127.0.0.1:4000";

type RoomRow = { id: string; name: string; locked: boolean; users: number; lobbyId?: string; hasPassword?: boolean; pinned?: boolean; isEvent?: boolean };

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
            {u?.avatar ? <img src={u.avatar} alt={nm + " avatar"} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : nm[0]?.toUpperCase()}
          </div>
        );
      })}
    </div>
  );
}

// ── RoomsPanel ────────────────────────────────────────────────────────────────
function RoomsPanel({ currentRoomId, lobbyId }: { currentRoomId: string; lobbyId: string }) {
  const [q,        setQ]        = React.useState("");
  const [rows,     setRows]     = React.useState<RoomRow[]>([]);
  const [loading,  setLoading]  = React.useState(false);
  const [err,      setErr]      = React.useState("");

  // Create room overlay state
  const [showCreate, setShowCreate] = React.useState(false);
  const [newRoom,    setNewRoom]    = React.useState("");
  const [creating,   setCreating]   = React.useState(false);
  const [selectedModule, setSelectedModule] = React.useState<string>("voice");
  const [roomPassword, setRoomPassword] = React.useState("");

  const w = useWeered() as any;
  const navRouter = useRouter();
  const wsUsers: any[] = React.useMemo(() => Array.isArray(w?.users) ? w.users : [], [w?.users]);
  const globalRole = String(w?.globalRole || "").toUpperCase();
  const isStaff = ["GOD", "ADMIN", "STAFF", "SUPPORT"].includes(globalRole);
  const [lobbyOwnerId, setLobbyOwnerId] = React.useState<string>("");
  React.useEffect(() => {
    if (!lobbyId) { setLobbyOwnerId(""); return; }
    fetch(`${API_BASE}/lobbies/${encodeURIComponent(lobbyId)}`, { cache: "no-store" })
      .then(r => r.json()).then(j => setLobbyOwnerId(String(j?.lobby?.ownerId || ""))).catch(() => {});
  }, [lobbyId]);
  const isLobbyOwner = !!lobbyOwnerId && lobbyOwnerId === String(w?.me?.id || "");
  const canPin = isStaff || isLobbyOwner;

  async function togglePin(roomId: string, currentlyPinned: boolean) {
    const target = !currentlyPinned;
    // Optimistic
    setRows(cur => cur.map(r => r.id === roomId ? { ...r, pinned: target } : r));
    try {
      const endpoint = isLobbyOwner && !isStaff
        ? `${API_BASE}/lobbies/${encodeURIComponent(lobbyId)}/admin/rooms/${encodeURIComponent(roomId)}/pin`
        : `${API_BASE}/staff/rooms/${encodeURIComponent(roomId)}/pin`;
      const res = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ pinned: target }),
      }).then(r => r.json());
      if (!res?.ok) {
        // Revert
        setRows(cur => cur.map(r => r.id === roomId ? { ...r, pinned: currentlyPinned } : r));
      }
    } catch {
      setRows(cur => cur.map(r => r.id === roomId ? { ...r, pinned: currentlyPinned } : r));
    }
  }

  async function toggleEvent(roomId: string, currentlyEvent: boolean) {
    const target = !currentlyEvent;
    setRows(cur => cur.map(r => r.id === roomId ? { ...r, isEvent: target } : r));
    try {
      const endpoint = isLobbyOwner && !isStaff
        ? `${API_BASE}/lobbies/${encodeURIComponent(lobbyId)}/admin/rooms/${encodeURIComponent(roomId)}/event`
        : `${API_BASE}/staff/rooms/${encodeURIComponent(roomId)}/event`;
      const res = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ isEvent: target }),
      }).then(r => r.json());
      if (!res?.ok) {
        setRows(cur => cur.map(r => r.id === roomId ? { ...r, isEvent: currentlyEvent } : r));
      }
    } catch {
      setRows(cur => cur.map(r => r.id === roomId ? { ...r, isEvent: currentlyEvent } : r));
    }
  }

  const ROOM_MODULES = [
    { id: "voice",   label: "Voice",   icon: "🎙", desc: "Voice chat room" },
    { id: "youtube", label: "YouTube", icon: "▶️", desc: "Watch together" },
    { id: "twitch",  label: "Twitch",  icon: "📺", desc: "Stream viewing party" },
    { id: "browser", label: "Browser", icon: "🌐", desc: "Shared browsing" },
    { id: "none",    label: "None",    icon: "💬", desc: "Chat only" },
  ];

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
        locked: Boolean(r.locked), users: Number(r.onlineCount ?? r.users ?? r.memberCount ?? 0), hasPassword: Boolean(r.hasPassword),
        pinned: Boolean(r.pinned),
        isEvent: Boolean(r.isEvent),
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
        body: JSON.stringify({ name, lobbyId, module: selectedModule, password: roomPassword.trim() || undefined }),
      }).then(r => r.json());
      if (!j?.ok) throw new Error(j?.message || j?.error || "create failed");
      const roomId = j.room?.id || name;
      const chosenModule = selectedModule;
      setNewRoom("");
      setShowCreate(false);
      setSelectedModule("voice");
      setRoomPassword("");

      // Auto-join: navigate into the new room
      navRouter.push(`/room/${encodeURIComponent(roomId)}`);

      // Set the module after a brief delay to let the room join complete
      if (chosenModule && chosenModule !== "none") {
        setTimeout(() => {
          try { w?.setModuleState?.(chosenModule); } catch {}
        }, 800);
      }
    } catch (e: any) { setErr(String(e?.message || e)); }
    finally { setCreating(false); }
  }

  React.useEffect(() => { void load(); }, [lobbyId]);
  React.useEffect(() => { const t = setInterval(load, 8000); return () => clearInterval(t); }, [lobbyId]);

  const filtered = rows
    .filter(r => !q.trim() || (r.name + " " + r.id).toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => {
      // Events first, then pinned, then by user count
      if (!!a.isEvent !== !!b.isEvent) return a.isEvent ? -1 : 1;
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.users - a.users;
    });

  const s = {
    input: { width: "100%", padding: "7px 10px", borderRadius: 9, border: "1px solid rgba(255,255,255,.10)", background: "rgba(0,0,0,.25)", fontSize: 12, color: "rgba(243,244,246,.90)", outline: "none", boxSizing: "border-box" as const },
    btn:   { padding: "7px 10px", borderRadius: 9, border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.05)", fontSize: 12, cursor: "pointer", color: "rgba(243,244,246,.90)", flexShrink: 0 } as React.CSSProperties,
  };

  return (
    <div className="weered-rr-section" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div className="weered-rr-section-title" style={{ fontSize: 11, fontWeight: 700, opacity: 0.5, letterSpacing: ".7px", textTransform: "uppercase" }}>Rooms</div>
        <button
          className="weered-rr-primary"
          onClick={() => setShowCreate(o => !o)}
          style={{
            padding: "3px 9px", borderRadius: 7, fontSize: 11, fontWeight: 700,
            border: showCreate ? "1px solid rgba(88,0,229,.50)" : "1px solid rgba(88,0,229,.25)",
            background: showCreate ? "rgba(88,0,229,.15)" : "rgba(88,0,229,.08)",
            color: "rgba(167,139,250,.9)", cursor: "pointer", transition: "all .15s",
          }}
        >
          {showCreate ? "✕" : "+ Room"}
        </button>
      </div>

      {/* ── Create Room Overlay ── */}
      {showCreate && (
        <div className="weered-rr-create-panel" style={{
          marginBottom: 10, padding: "12px", borderRadius: 12,
          border: "1px solid rgba(88,0,229,.25)", background: "rgba(88,0,229,.05)",
        }}>
          <div className="weered-rr-create-title" style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".7px", textTransform: "uppercase", color: "rgba(167,139,250,.7)", marginBottom: 8 }}>
            Create Room
          </div>

          {/* Room name */}
          <input
            style={{ ...s.input, marginBottom: 8, borderColor: "rgba(88,0,229,.20)" }}
            placeholder="Room name…"
            value={newRoom}
            onChange={e => setNewRoom(e.target.value)}
            onKeyDown={e => e.key === "Enter" && newRoom.trim() && createRoom()}
            autoFocus
          />

          {/* Module picker */}
          <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.45, letterSpacing: ".5px", textTransform: "uppercase", marginBottom: 6 }}>
            Starting Module
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
            {ROOM_MODULES.map(m => {
              const active = selectedModule === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  className={`weered-rr-module-btn${active?" weered-rr-module-btn-active":""}`}
                  onClick={() => setSelectedModule(m.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "7px 10px", borderRadius: 8, textAlign: "left", width: "100%",
                    border: active ? "1px solid rgba(88,0,229,.50)" : "1px solid rgba(255,255,255,.08)",
                    background: active ? "rgba(88,0,229,.12)" : "rgba(255,255,255,.02)",
                    color: active ? "rgba(216,180,254,.95)" : "rgba(243,244,246,.70)",
                    cursor: "pointer", transition: "all .12s", fontFamily: "inherit",
                  }}
                >
                  <span style={{ fontSize: 14, width: 22, textAlign: "center", flexShrink: 0 }}>{m.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{m.label}</div>
                    <div style={{ fontSize: 10, opacity: 0.5, marginTop: 1 }}>{m.desc}</div>
                  </div>
                  {active && (
                    <span style={{
                      fontSize: 8, fontWeight: 800, padding: "2px 6px", borderRadius: 4,
                      background: "rgba(88,0,229,.25)", color: "rgba(167,139,250,.9)",
                      letterSpacing: ".1em", textTransform: "uppercase", flexShrink: 0,
                    }}>
                      selected
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Optional password */}
          <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.45, letterSpacing: ".5px", textTransform: "uppercase", marginBottom: 6 }}>
            Password <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span>
          </div>
          <input
            style={{ ...s.input, marginBottom: 10, borderColor: roomPassword ? "rgba(88,0,229,.30)" : "rgba(255,255,255,.10)" }}
            placeholder="Leave blank for open room…"
            type="text"
            autoComplete="off"
            value={roomPassword}
            onChange={e => setRoomPassword(e.target.value)}
          />

          {/* Create button */}
          <button
            className="weered-rr-primary weered-rr-primary-solid"
            onClick={createRoom}
            disabled={creating || !newRoom.trim()}
            style={{
              width: "100%", padding: "9px", borderRadius: 9,
              border: "1px solid rgba(88,0,229,.40)", background: "rgba(88,0,229,.15)",
              color: "rgba(167,139,250,.95)", fontSize: 12, fontWeight: 700,
              cursor: creating || !newRoom.trim() ? "default" : "pointer",
              opacity: creating || !newRoom.trim() ? 0.5 : 1,
              transition: "all .15s",
            }}
          >
            {creating ? "Creating…" : `Create "${newRoom.trim() || "…"}" with ${ROOM_MODULES.find(m => m.id === selectedModule)?.label || "module"}`}
          </button>

          {err && <div style={{ fontSize: 11, color: "rgba(252,165,165,.80)", marginTop: 6 }}>{err}</div>}
        </div>
      )}

      <input className="weered-rr-search" style={{ ...s.input, marginBottom: 8 }} placeholder="Search rooms…" value={q} onChange={e => setQ(e.target.value)} />
      {err && <div style={{ fontSize: 11, color: "rgba(252,165,165,.80)", marginBottom: 6 }}>{err}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 360, overflowY: "auto", scrollbarWidth: "thin", scrollbarColor: "rgba(148,163,184,.15) transparent" }}>
        {loading && !rows.length && <div style={{ fontSize: 12, opacity: 0.5 }}>Loading…</div>}
        {!loading && !filtered.length && (
          <EmptyState compact title={lobbyId ? "No rooms open here." : "No rooms."} hint={canPin ? "Hit + Room to start one." : "Check back in a minute."} />
        )}
        {filtered.slice(0, 40).map(rm => {
          const active      = rm.id === currentRoomId;
          const liveWsUsers = usersByRoom[rm.id] || [];
          const liveCount   = liveWsUsers.length || rm.users;
          const isLive      = liveCount > 0;

          // Mini icon based on room name
          const n = (rm.name || "").toLowerCase();
          const isWindrose = lobbyId === "windrose" || rm.lobbyId === "windrose";
          const icon: React.ReactNode =
              isWindrose && (n.includes("helm") || n.includes("wheel"))   ? "⚓"
            : isWindrose && (n.includes("crew") || n.includes("mate"))    ? "🏴\u200d☠️"
            : isWindrose && n.includes("captain")                         ? "🧭"
            : isWindrose && (n.includes("log") || n.includes("journal"))  ? "📖"
            : isWindrose && (n.includes("bug") || n.includes("hunter"))   ? "🐛"
            : isWindrose && (n.includes("trading") || n.includes("post")) ? "💰"
            : n.includes("voice") ? "🎙" : n.includes("lfg") || n.includes("squad") ? "🔥"
            : n.includes("trad") ? "💱" : n.includes("general") ? "💬" : n.includes("ranked") ? "🏆"
            : n.includes("watch") || n.includes("stream") ? "📺" : n.includes("cryo") || n.includes("archive") ? "🧊"
            : n.includes("chill") || n.includes("lounge") ? "🌙"
            : isWindrose ? (
                <img
                  src="/brand/lobbies/windrose-logo-official.png"
                  alt=""
                  width={14}
                  height={14}
                  aria-hidden
                  style={{ objectFit: "contain" }}
                />
              )
            : "◆";

          // Color: live = green, active = accent, default = subtle
          const cardAccent = isLive ? "#22c55e" : active ? "#5800E5" : "rgba(255,255,255,.08)";
          const borderColor = active ? "rgba(88,0,229,.45)" : isLive ? "rgba(34,197,94,.25)" : "rgba(255,255,255,.06)";
          const bg = active ? "rgba(88,0,229,.08)" : isLive ? "rgba(34,197,94,.04)" : "rgba(255,255,255,.015)";
          const hoverBg = active ? "rgba(88,0,229,.14)" : isLive ? "rgba(34,197,94,.08)" : "rgba(255,255,255,.04)";

          return (
            <Link key={rm.id} href={`/room/${encodeURIComponent(rm.id)}`}
              className={`weered-rr-room-card${active?" weered-rr-room-card-active":""}${isLive?" weered-rr-room-card-live":""}${rm.isEvent?" weered-rr-room-card-event":""}`}
              style={{
                display: "block", textDecoration: "none", padding: "9px 10px", borderRadius: 10,
                border: `1px solid ${borderColor}`,
                background: bg,
                transition: "all 0.15s ease", position: "relative", overflow: "hidden",
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = hoverBg;
                el.style.borderColor = active ? "rgba(88,0,229,.55)" : isLive ? "rgba(34,197,94,.35)" : "rgba(255,255,255,.12)";
                el.style.transform = "none";
                el.style.boxShadow = isLive ? "0 0 12px rgba(34,197,94,.08)" : active ? "0 0 12px rgba(88,0,229,.08)" : "none";
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = bg;
                el.style.borderColor = borderColor;
                el.style.transform = "none";
                el.style.boxShadow = "none";
              }}
            >
              {/* Active accent bar */}
              {active && <div style={{ position: "absolute", left: 0, top: 3, bottom: 3, width: 2.5, borderRadius: 2, background: "#5800E5", boxShadow: "0 0 6px rgba(88,0,229,.4)" }} />}

              {/* Top accent line */}
              <div style={{
                position: "absolute", top: 0, left: "10%", right: "10%", height: 1,
                background: `linear-gradient(90deg, transparent, ${cardAccent}${isLive ? "44" : active ? "33" : "08"}, transparent)`,
                borderRadius: 1,
              }} />

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {/* Mini icon */}
                <div style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  background: isLive ? "rgba(34,197,94,.10)" : active ? "rgba(88,0,229,.10)" : "rgba(255,255,255,.03)",
                  border: `1px solid ${isLive ? "rgba(34,197,94,.18)" : active ? "rgba(88,0,229,.18)" : "rgba(255,255,255,.05)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, lineHeight: 1,
                }}>
                  {icon}
                </div>

                {/* Name + lock */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 700, fontSize: 12, lineHeight: 1.3,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    color: "rgba(243,244,246,.92)",
                  }}>
                    {rm.isEvent && (
                      <span title="Event room" className="weered-event-badge" style={{
                        marginRight: 6, fontSize: 8, fontWeight: 900, letterSpacing: ".12em",
                        padding: "2px 5px", borderRadius: 3,
                        background: "linear-gradient(90deg, #8b5cf6 0%, #ec4899 100%)",
                        color: "white", textTransform: "uppercase",
                        boxShadow: "0 0 8px rgba(139,92,246,0.5)",
                      }}>EVENT</span>
                    )}
                    {rm.pinned && <span title="Pinned room — survives cleanup" style={{ marginRight: 4, fontSize: 10, color: "#f59e0b" }}>📌</span>}
                    {rm.name || rm.id}
                    {rm.locked && <span style={{ marginLeft: 4, fontSize: 9, opacity: 0.45 }}>🔒</span>}
                    {rm.hasPassword && !rm.locked && <span style={{ marginLeft: 4, fontSize: 9, opacity: 0.45 }}>🔑</span>}
                  </div>
                  {/* Avatar stack row */}
                  {liveWsUsers.length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3 }}>
                      <AvatarStack users={liveWsUsers} size={16} />
                      {liveWsUsers.length > 3 && <span style={{ fontSize: 9, opacity: 0.35, fontFamily: "monospace" }}>+{liveWsUsers.length - 3}</span>}
                    </div>
                  )}
                </div>

                {/* Live badge / count */}
                <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                  {isLive ? (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 4,
                      padding: "3px 7px", borderRadius: 99,
                      background: "rgba(34,197,94,.08)", border: "1px solid rgba(34,197,94,.20)",
                    }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 5px #22c55e" }} />
                      <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "monospace", color: "rgba(134,239,172,.85)" }}>{liveCount}</span>
                    </div>
                  ) : (
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(255,255,255,.10)" }} />
                  )}
                  {canPin && (
                    <>
                      <button
                        title={rm.isEvent ? "Remove event flag" : "Mark as event room"}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); void toggleEvent(rm.id, Boolean(rm.isEvent)); }}
                        style={{
                          marginLeft: 4, width: 22, height: 22, borderRadius: 4,
                          border: "none", cursor: "pointer",
                          background: rm.isEvent ? "linear-gradient(135deg, rgba(139,92,246,0.25), rgba(236,72,153,0.25))" : "rgba(255,255,255,0.04)",
                          color: rm.isEvent ? "#c4b5fd" : "rgba(148,163,184,0.6)",
                          fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "all 0.12s",
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = rm.isEvent ? "linear-gradient(135deg, rgba(139,92,246,0.45), rgba(236,72,153,0.45))" : "rgba(255,255,255,0.10)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = rm.isEvent ? "linear-gradient(135deg, rgba(139,92,246,0.25), rgba(236,72,153,0.25))" : "rgba(255,255,255,0.04)"; }}
                      >✦</button>
                      <button
                        title={rm.pinned ? "Unpin room" : "Pin room (survives cleanup)"}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); void togglePin(rm.id, Boolean(rm.pinned)); }}
                        style={{
                          marginLeft: 4, width: 22, height: 22, borderRadius: 4,
                          border: "none", cursor: "pointer",
                          background: rm.pinned ? "rgba(245,158,11,0.18)" : "rgba(255,255,255,0.04)",
                          color: rm.pinned ? "#f59e0b" : "rgba(148,163,184,0.6)",
                          fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "all 0.12s",
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = rm.pinned ? "rgba(245,158,11,0.30)" : "rgba(255,255,255,0.10)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = rm.pinned ? "rgba(245,158,11,0.18)" : "rgba(255,255,255,0.04)"; }}
                      >📌</button>
                    </>
                  )}
                </div>
              </div>
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
    <div className="weered-rr-section" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div className="weered-rr-section-title" style={{ fontSize: 11, fontWeight: 700, opacity: 0.5, letterSpacing: ".7px", textTransform: "uppercase" }}>Lobby Controls</div>
        {chatLocked !== null && (
          <span className="weered-rr-status-chip" style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 999, letterSpacing: ".4px", background: isLocked ? "rgba(245,158,11,.12)" : "rgba(16,185,129,.10)", border: `1px solid ${isLocked ? "rgba(245,158,11,.35)" : "rgba(16,185,129,.30)"}`, color: isLocked ? "rgb(253,230,138)" : "rgb(167,243,208)" }}>
            {isLocked ? "CHAT LOCKED" : "CHAT OPEN"}
          </span>
        )}
      </div>
      <div className="weered-rr-mod-panel" style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.02)", padding: "10px 12px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <button disabled={loading} onClick={() => action("lock")} style={{ padding: "8px 10px", borderRadius: 9, fontSize: 12, cursor: loading ? "default" : "pointer", border: isLocked ? "1px solid rgba(245,158,11,.50)" : "1px solid rgba(245,158,11,.25)", background: isLocked ? "rgba(245,158,11,.18)" : "rgba(245,158,11,.08)", color: "rgb(253,230,138)", fontWeight: isLocked ? 700 : 400 }}>{isLocked ? "🔒 Locked" : "Lock Chat"}</button>
          <button disabled={loading} onClick={() => action("unlock")} style={{ padding: "8px 10px", borderRadius: 9, fontSize: 12, cursor: loading ? "default" : "pointer", border: !isLocked ? "1px solid rgba(16,185,129,.50)" : "1px solid rgba(16,185,129,.25)", background: !isLocked ? "rgba(16,185,129,.18)" : "rgba(16,185,129,.08)", color: "rgb(167,243,208)", fontWeight: !isLocked ? 700 : 400 }}>{!isLocked ? "✓ Unlocked" : "Unlock Chat"}</button>
          <button disabled={loading} style={{ padding: "8px 10px", borderRadius: 9, border: "1px solid rgba(239,68,68,.25)", background: "rgba(239,68,68,.08)", fontSize: 12, cursor: "pointer", color: "rgba(252,165,165,.90)", gridColumn: "span 2" }}
            onClick={async () => {
              const ok = await weeredConfirm({ title: "Clear all lobby chat?", body: "Every message in this lobby's chat gets wiped. Can't be undone.", confirmLabel: "Clear chat", destructive: true });
              if (!ok) return;
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
    const isLobby     = f.roomIsLobby === true
      || (f.roomName || "").toLowerCase().includes("lobby")
      || rawRoomId === "lobby"
      || (rawRoomId.length > 2 && !rawRoomId.startsWith("article_") && /^[a-z][a-z0-9._-]+$/.test(rawRoomId) && rawRoomId.length < 30);
    const joinHref    = rawRoomId ? presenceHref(rawRoomId, isLobby) : null;

    const platforms = {
      steam:  !!f.steamId,
      twitch: !!f.twitchLogin,
      xbox:   !!f.xboxGamertag,
      psn:    !!f.psnAccountId,
    };

    // Friends list shows *Weered* location — "Online in Destiny 2",
    // "Lying low in Destiny 2". Cross-platform game state lives on the left
    // rail where we're already with them; here the useful signal is where on
    // Weered they are so you know whether to jump in.
    const locationLabel = (f.roomName || "").trim();
    const friendSecondary: React.ReactNode = (() => {
      if (!f.online) return <span style={{ opacity: 0.4, fontStyle: "italic" }}>offline</span>;
      if (f.isAway) {
        return (
          <span style={{ color: "#facc15", fontStyle: "italic", opacity: 0.85 }}>
            lying low{locationLabel ? ` in ${locationLabel}` : ""}
          </span>
        );
      }
      if (locationLabel) {
        return (
          <span style={{ color: "rgba(203,213,225,.82)" }}>
            Online <span style={{ opacity: 0.55 }}>in</span>{" "}
            <span style={{ fontWeight: 600, color: "rgba(243,244,246,.92)" }}>{locationLabel}</span>
          </span>
        );
      }
      return <span style={{ opacity: 0.55, fontStyle: "italic" }}>online</span>;
    })();

    const joinLink = f.online && joinHref ? (
      <Link
        href={joinHref}
        className="weered-rr-join"
        onClick={e => e.stopPropagation()}
        style={{ fontSize: 10, padding: "3px 8px", borderRadius: 999, border: "1px solid rgba(88,0,229,.30)", background: "rgba(88,0,229,.10)", color: "rgba(243,244,246,.85)", textDecoration: "none", flexShrink: 0 }}
      >
        join
      </Link>
    ) : undefined;

    return (
      <div key={f.id} className="weered-rr-friend-row" style={{ position: "relative" }}>
        <PresenceRow
          name={f.name}
          avatar={f.avatar}
          avatarColor={f.avatarColor}
          globalRole={f.globalRole}
          tier={f.tier}
          online={f.online}
          isAway={!!f.isAway}
          roomName={f.roomName}
          secondaryText={friendSecondary}
          platforms={platforms}
          onClick={() => userId && openSheet("profile", { userId })}
          action={joinLink}
          compact
        />
        {hasUnread && (
          <span style={{
            position: "absolute", top: 2, left: 30,
            minWidth: 14, height: 14, borderRadius: 999,
            background: "#f59e0b", border: "2px solid rgba(10,10,15,1)",
            fontSize: 8, fontWeight: 900, color: "#000",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: unreadCount > 9 ? "0 2px" : "0", lineHeight: 1,
            zIndex: 2, pointerEvents: "none",
          }}>
            {unreadCount > 9 ? "9+" : unreadCount > 1 ? unreadCount : ""}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="weered-rr-section" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: open ? 8 : 0, cursor: "pointer" }} onClick={() => setOpen(o => !o)}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div className="weered-rr-section-title" style={{ fontSize: 11, fontWeight: 700, opacity: 0.5, letterSpacing: ".7px", textTransform: "uppercase" }}>Friends · {online.length} online</div>
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
    <div className="weered-rr-section" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: open ? 8 : 0, cursor: "pointer" }} onClick={() => setOpen(o => !o)}>
        <div className="weered-rr-section-title" style={{ fontSize: 11, fontWeight: 700, opacity: 0.5, letterSpacing: ".7px", textTransform: "uppercase" }}>Crew · {online.length} online</div>
        <span style={{ fontSize: 10, opacity: 0.4 }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {allMembers.length === 0 && <EmptyState compact title="Nobody riding with you yet." />}
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
                className="weered-rr-crew-row"
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 10, border: "1px solid rgba(255,255,255,.07)", background: "rgba(255,255,255,.02)", cursor: "pointer", transition: "background 0.12s" }}
                onClick={() => userId && openSheet("profile", { userId })}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.05)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.02)"; }}
              >
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 999, background: m.avatar ? "rgba(255,255,255,.08)" : "rgba(245,158,11,.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "rgb(251,191,36)", overflow: "hidden" }}>
                    {m.avatar ? <img src={m.avatar} alt={(m.name || "User") + " avatar"} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (m.name || "?").slice(0, 1).toUpperCase()}
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
                  <Link href={joinHref} className="weered-rr-join" onClick={e => e.stopPropagation()} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 999, border: "1px solid rgba(245,158,11,.30)", background: "rgba(245,158,11,.10)", color: "rgb(251,191,36)", textDecoration: "none", flexShrink: 0 }}>
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
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <a href="/home" className="weered-rail-logo" title="Home" style={{ flexShrink: 0, marginBottom: 0 }}>
          <img src="/brand/logo/weered-logo-128.png" alt="Weered" />
        </a>
        <div>
          <div style={{ fontWeight: 800, fontSize: 13 }}>Control Panel</div>
          <div style={{ fontSize: 11, opacity: 0.4, marginTop: 2 }}>loading…</div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ padding: "14px 14px 20px", fontSize: 13, color: "rgba(243,244,246,.92)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <a href="/home" className="weered-rail-logo" title="Home" style={{ flexShrink: 0, marginBottom: 0 }}>
            <img src="/brand/logo/weered-logo-128.png" alt="Weered" />
          </a>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13 }}>Control Panel</div>
            <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>context: {resolvedLobbyId}</div>
          </div>
        </div>
        {/* tools pill removed — collapse button is in ShellGate */}
      </div>
      <LobbyModPanel globalRole={globalRole || ""} lobbyId={resolvedLobbyId} />
      <RoomsPanel currentRoomId={currentRoomId} lobbyId={resolvedLobbyId} />
      <FriendsPanel />
      <CrewPanel />
    </div>
  );
}
