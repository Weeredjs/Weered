"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useWeered, useRoomUsers } from "./WeeredProvider";
import { useOverlay } from "./overlays/OverlayProvider";
import { avatarBg } from "../lib/avatarColor";
import EmptyState from "./EmptyState";
import { weeredConfirm } from "../lib/confirm";
import PresenceRow from "./PresenceRow";
import { LogoMenu } from "./LogoMenu";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE as string) || "http://127.0.0.1:4000";

type RoomRow = { id: string; name: string; locked: boolean; users: number; lobbyId?: string; hasPassword?: boolean; pinned?: boolean; isEvent?: boolean };

function authHeaders() {
  try { const t = localStorage.getItem("weered_token") || ""; return t ? { Authorization: `Bearer ${t}` } : {}; } catch { return {}; }
}

let _sessionExpiredNotified = false;
async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API_BASE}${path}`, { ...opts, headers: { "Content-Type": "application/json", ...authHeaders(), ...(opts?.headers || {}) } });
  if (r.status === 401) {
    if (typeof window !== "undefined" && !_sessionExpiredNotified) {
      _sessionExpiredNotified = true;
      try {
        const evt = new CustomEvent("weered:session-expired", { detail: { path } });
        window.dispatchEvent(evt);
      } catch {}
      setTimeout(() => {
        if (typeof document !== "undefined" && document.title.indexOf("Session expired") === -1) {
          try { console.warn("[Weered] Session expired — sign out + back in to refresh."); } catch {}
        }
      }, 500);
    }
  }
  return r.json();
}

function roomHref(id: string): string {
  let clean = id || "";
  if (clean.startsWith("room:")) clean = clean.slice(5);
  try { clean = decodeURIComponent(clean); } catch {}
  return `/room/${encodeURIComponent(clean)}`;
}

function presenceHref(roomId: string, roomIsLobby: boolean): string {
  let clean = roomId || "";
  if (clean.startsWith("room:")) clean = clean.slice(5);
  try { clean = decodeURIComponent(clean); } catch {}
  if (!clean) return "/lobby";
  return roomIsLobby ? `/lobby/${encodeURIComponent(clean)}` : `/room/${encodeURIComponent(clean)}`;
}

// Refresh on pushed WS events instead of waiting for the next poll tick.
// The provider re-dispatches every socket message as a weered:<type> CustomEvent.
function useWsRefresh(types: string[], cb: () => void) {
  const cbRef = React.useRef(cb); cbRef.current = cb;
  React.useEffect(() => {
    let t: any = null;
    const fire = () => { if (t) return; t = setTimeout(() => { t = null; cbRef.current(); }, 800); };
    const names = types.map(x => `weered:${x}`);
    names.forEach(n => window.addEventListener(n, fire));
    return () => { if (t) clearTimeout(t); names.forEach(n => window.removeEventListener(n, fire)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [types.join("|")]);
}

function useLobbyPresence(lobbyId: string) {
  const [users, setUsers] = React.useState<any[]>([]);
  React.useEffect(() => {
    if (!lobbyId) return;
    let alive = true;
    const load = async () => {
      try {
        const j = await apiFetch(`/lobbies/${encodeURIComponent(lobbyId)}/presence`);
        if (!alive) return;
        if (j?.ok && Array.isArray(j.users)) setUsers(j.users);
      } catch {}
    };
    load();
    loadRef.current = load;
    const t = setInterval(load, 60000);
    return () => { alive = false; clearInterval(t); };
  }, [lobbyId]);
  const loadRef = React.useRef<() => void>(() => {});
  useWsRefresh(["presence:join", "presence:leave", "presence:state", "lobby:activity"], () => loadRef.current());
  return users;
}

function useLobbyCrews(lobbyId: string, enabled: boolean) {
  const [crews, setCrews] = React.useState<any[]>([]);
  React.useEffect(() => {
    if (!enabled || !lobbyId) return;
    let alive = true;
    const load = async () => {
      try {
        const j = await apiFetch(`/lobbies/${encodeURIComponent(lobbyId)}/crews`);
        if (!alive) return;
        if (j?.ok && Array.isArray(j.crews)) setCrews(j.crews);
      } catch {}
    };
    load();
    const t = setInterval(load, 60000);
    return () => { alive = false; clearInterval(t); };
  }, [lobbyId, enabled]);
  return crews;
}

function PresenceAvatar({ user, size = 28, onClick }: { user: any; size?: number; onClick?: () => void }) {
  const name = String(user?.name || "?");
  const initial = name.slice(0, 1).toUpperCase();
  const bg = user?.avatar ? "rgba(255,255,255,.08)" : avatarBg(name, false, user?.avatarColor);
  return (
    <button
      type="button"
      onClick={onClick}
      title={user?.name || ""}
      style={{
        position: "relative", flexShrink: 0,
        width: size, height: size, borderRadius: 999,
        background: bg, border: "1px solid rgba(255,255,255,.08)",
        cursor: onClick ? "pointer" : "default", padding: 0,
        overflow: "hidden",
      }}
    >
      {user?.avatar
        ? <img src={user.avatar} alt={user.name || "user"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : <span style={{ fontSize: Math.round(size * 0.42), fontWeight: 700, color: "rgba(243,244,246,.85)" }}>{initial}</span>}
      <span style={{
        position: "absolute", bottom: -1, right: -1,
        width: Math.max(7, size * 0.28), height: Math.max(7, size * 0.28),
        borderRadius: 999,
        background: user?.isAway ? "#facc15" : "#22c55e",
        border: "2px solid rgba(10,10,15,1)",
      }} />
    </button>
  );
}

function WhosHerePanel({ lobbyId }: { lobbyId: string }) {
  const ctx: any = useWeered();
  const meId = String(ctx?.me?.id || "");
  const { openSheet } = useOverlay();
  const all = useLobbyPresence(lobbyId);
  const [eligible, setEligible] = React.useState(false);
  React.useEffect(() => {
    let alive = true;
    Promise.all([
      apiFetch("/friends").catch(() => ({} as any)),
      apiFetch("/crews/mine").catch(() => ({} as any)),
    ]).then(([f, c]) => {
      if (!alive) return;
      const friends = Array.isArray(f?.friends) ? f.friends : [];
      const crews = Array.isArray(c?.crews) ? c.crews : [];
      if (!friends.length && !crews.length) setEligible(true);
    });
    return () => { alive = false; };
  }, []);
  if (!eligible) return null;
  const others = all.filter(u => String(u?.id || "") !== meId);
  if (!others.length) return null;
  const visible = others.slice(0, 9);
  const overflow = Math.max(0, others.length - visible.length);
  return (
    <div className="weered-rr-section" style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.5, letterSpacing: ".7px", textTransform: "uppercase" }}>
          Who&apos;s here · {others.length}
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {visible.map(u => (
          <PresenceAvatar key={u.id} user={u} size={28} onClick={() => openSheet("profile", { userId: String(u.id) })} />
        ))}
        {overflow > 0 && (
          <div style={{
            width: 28, height: 28, borderRadius: 999,
            border: "1px dashed rgba(255,255,255,.18)", background: "rgba(255,255,255,.02)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 700, color: "rgba(243,244,246,.55)",
          }}>+{overflow}</div>
        )}
      </div>
    </div>
  );
}

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

function RoomsEmptyDiscovery({ lobbyId, canPin }: { lobbyId: string; canPin: boolean }) {
  const ctx: any = useWeered();
  const meId = String(ctx?.me?.id || "");
  const { openSheet } = useOverlay();
  const all = useLobbyPresence(lobbyId);
  const others = all.filter(u => String(u?.id || "") !== meId);
  if (!others.length) {
    return <EmptyState compact title={lobbyId ? "No rooms open here." : "No rooms."} hint={canPin ? "Hit + Room to start one." : "Check back in a minute."} />;
  }
  return (
    <div style={{
      borderRadius: 10, border: "1px solid rgba(124,58,237,.18)",
      background: "rgba(124,58,237,.04)", padding: 10,
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".7px", textTransform: "uppercase", color: "rgba(216,180,254,.75)" }}>
        No rooms — but {others.length} {others.length === 1 ? "person is" : "people are"} around
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {others.slice(0, 4).map(u => (
          <button key={u.id} type="button" onClick={() => openSheet("profile", { userId: String(u.id) })} style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "5px 8px", borderRadius: 7,
            border: "1px solid rgba(255,255,255,.06)", background: "rgba(255,255,255,.02)",
            cursor: "pointer", textAlign: "left",
          }}>
            <PresenceAvatar user={u} size={24} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(243,244,246,.92)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {u.name}
              </div>
              {u.roomName && <div style={{ fontSize: 9, opacity: 0.5, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>in {u.roomName}</div>}
            </div>
          </button>
        ))}
      </div>
      <div style={{ fontSize: 10, color: "rgba(243,244,246,.4)", fontStyle: "italic", textAlign: "center", paddingTop: 4 }}>
        {canPin ? "Hit + Room to start something." : "Or wait — someone usually opens one."}
      </div>
    </div>
  );
}

function RoomsPanel({ currentRoomId, lobbyId }: { currentRoomId: string; lobbyId: string }) {
  const [q,        setQ]        = React.useState("");
  const [rows,     setRows]     = React.useState<RoomRow[]>([]);
  const [loading,  setLoading]  = React.useState(false);
  const [err,      setErr]      = React.useState("");

  const [showCreate, setShowCreate] = React.useState(false);
  const [newRoom,    setNewRoom]    = React.useState("");
  const [creating,   setCreating]   = React.useState(false);
  const [selectedModule, setSelectedModule] = React.useState<string>("voice");
  const [roomPassword, setRoomPassword] = React.useState("");

  const w = useWeered() as any;
  const navRouter = useRouter();
  const wsUsers: any[] = useRoomUsers(w?.activeRoomId);
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

      navRouter.push(`/room/${encodeURIComponent(roomId)}`);

      if (chosenModule && chosenModule !== "none") {
        setTimeout(() => {
          try { w?.setModuleState?.(chosenModule); } catch {}
        }, 800);
      }
    } catch (e: any) { setErr(String(e?.message || e)); }
    finally { setCreating(false); }
  }

  React.useEffect(() => { void load(); }, [lobbyId]);
  React.useEffect(() => { const t = setInterval(load, 60000); return () => clearInterval(t); }, [lobbyId]);
  useWsRefresh(["lobby:activity", "room:closed", "room:locked"], load);

  const filtered = rows
    .filter(r => !q.trim() || (r.name + " " + r.id).toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => {
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

      {showCreate && (
        <div className="weered-rr-create-panel" style={{
          marginBottom: 10, padding: "12px", borderRadius: 12,
          border: "1px solid rgba(88,0,229,.25)", background: "rgba(88,0,229,.05)",
        }}>
          <div className="weered-rr-create-title" style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".7px", textTransform: "uppercase", color: "rgba(167,139,250,.7)", marginBottom: 8 }}>
            Create Room
          </div>

          <input
            style={{ ...s.input, marginBottom: 8, borderColor: "rgba(88,0,229,.20)" }}
            placeholder="Room name…"
            value={newRoom}
            onChange={e => setNewRoom(e.target.value)}
            onKeyDown={e => e.key === "Enter" && newRoom.trim() && createRoom()}
            autoFocus
          />

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
          <RoomsEmptyDiscovery lobbyId={lobbyId} canPin={canPin} />
        )}
        {filtered.slice(0, 40).map(rm => {
          const active      = rm.id === currentRoomId;
          const liveWsUsers = usersByRoom[rm.id] || [];
          const liveCount   = liveWsUsers.length || rm.users;
          const isLive      = liveCount > 0;

          const n = (rm.name || "").toLowerCase();
          const isWindrose = lobbyId === "windrose" || rm.lobbyId === "windrose";
          const customIcon = (rm as any).iconUrl ? String((rm as any).iconUrl) : null;
          const customBanner = (rm as any).bannerUrl ? String((rm as any).bannerUrl) : null;
          const customAccent = (rm as any).accentColor ? String((rm as any).accentColor) : null;
          const icon: React.ReactNode = customIcon
            ? <img src={customIcon} alt="" aria-hidden style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : isWindrose && (n.includes("helm") || n.includes("wheel"))   ? "⚓"
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
                  width={22}
                  height={22}
                  aria-hidden
                  style={{ objectFit: "contain" }}
                />
              )
            : "◆";

          const cardAccent = customAccent || (isLive ? "#22c55e" : active ? "#5800E5" : "rgba(255,255,255,.08)");
          const borderColor = customAccent ? `${customAccent}55` : (active ? "rgba(88,0,229,.45)" : isLive ? "rgba(34,197,94,.25)" : "rgba(255,255,255,.06)");
          const bg = customAccent ? `${customAccent}10` : (active ? "rgba(88,0,229,.08)" : isLive ? "rgba(34,197,94,.04)" : "rgba(255,255,255,.015)");
          const hoverBg = customAccent ? `${customAccent}22` : (active ? "rgba(88,0,229,.14)" : isLive ? "rgba(34,197,94,.08)" : "rgba(255,255,255,.04)");

          return (
            <Link key={rm.id} href={`/room/${encodeURIComponent(rm.id)}`}
              className={`weered-rr-room-card${active?" weered-rr-room-card-active":""}${isLive?" weered-rr-room-card-live":""}${rm.isEvent?" weered-rr-room-card-event":""}`}
              style={{
                display: "block", textDecoration: "none", padding: "9px 10px", borderRadius: 10,
                border: `1px solid ${borderColor}`,
                background: bg,
                transition: "all 0.15s ease", position: "relative", overflow: "hidden",
                flexShrink: 0,
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
              {customBanner && (
                <div aria-hidden style={{
                  position: "absolute", inset: 0, backgroundImage: `url("${customBanner}")`,
                  backgroundSize: "cover", backgroundPosition: "center",
                  opacity: 0.55, pointerEvents: "none",
                }} />
              )}
              {customBanner && (
                <div aria-hidden style={{
                  position: "absolute", inset: 0,
                  background: "linear-gradient(90deg, rgba(10,12,20,.85) 0%, rgba(10,12,20,.55) 50%, rgba(10,12,20,.25) 100%)",
                  pointerEvents: "none",
                }} />
              )}

              {active && <div style={{ position: "absolute", left: 0, top: 3, bottom: 3, width: 2.5, borderRadius: 2, background: "#5800E5", boxShadow: "0 0 6px rgba(88,0,229,.4)" }} />}

              <div style={{
                position: "absolute", top: 0, left: "10%", right: "10%", height: 1,
                background: `linear-gradient(90deg, transparent, ${cardAccent}${isLive ? "44" : active ? "33" : "08"}, transparent)`,
                borderRadius: 1,
              }} />

              <div style={{ display: "flex", alignItems: "center", gap: 9, position: "relative", zIndex: 1 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 9, flexShrink: 0,
                  background: customIcon ? "rgba(0,0,0,.25)" : (isLive ? "rgba(34,197,94,.10)" : active ? "rgba(88,0,229,.10)" : "rgba(255,255,255,.03)"),
                  border: `1px solid ${customAccent ? `${customAccent}55` : isLive ? "rgba(34,197,94,.18)" : active ? "rgba(88,0,229,.18)" : "rgba(255,255,255,.05)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 17, lineHeight: 1,
                  overflow: "hidden",
                }}>
                  {icon}
                </div>

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
                  {liveWsUsers.length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3 }}>
                      <AvatarStack users={liveWsUsers} size={16} />
                      {liveWsUsers.length > 3 && <span style={{ fontSize: 9, opacity: 0.35, fontFamily: "monospace" }}>+{liveWsUsers.length - 3}</span>}
                    </div>
                  )}
                </div>

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
      <div className="weered-rr-section-title" style={{ fontSize: 11, fontWeight: 700, opacity: 0.5, letterSpacing: ".7px", textTransform: "uppercase", marginBottom: 8 }}>Lobby Controls</div>
      <div className="weered-rr-mod-panel" style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.02)", padding: "10px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 10, fontWeight: 700, opacity: 0.55, letterSpacing: ".6px", textTransform: "uppercase", flexShrink: 0 }}>Chat</span>
          <div className="weered-rr-chatlock" style={{
            display: "flex", flex: 1, background: "rgba(0,0,0,.22)",
            borderRadius: 8, padding: 2, border: "1px solid rgba(255,255,255,.04)",
          }}>
            <button
              disabled={loading || !isLocked}
              onClick={() => action("unlock")}
              style={{
                flex: 1, padding: "5px 0", borderRadius: 6, border: "none",
                background: !isLocked ? "rgba(16,185,129,.22)" : "transparent",
                color: !isLocked ? "rgb(167,243,208)" : "rgba(255,255,255,.42)",
                fontSize: 10, fontWeight: 700, letterSpacing: ".5px",
                cursor: loading || !isLocked ? "default" : "pointer",
                transition: "background .15s, color .15s",
              }}
            >OPEN</button>
            <button
              disabled={loading || isLocked}
              onClick={() => action("lock")}
              style={{
                flex: 1, padding: "5px 0", borderRadius: 6, border: "none",
                background: isLocked ? "rgba(245,158,11,.22)" : "transparent",
                color: isLocked ? "rgb(253,230,138)" : "rgba(255,255,255,.42)",
                fontSize: 10, fontWeight: 700, letterSpacing: ".5px",
                cursor: loading || isLocked ? "default" : "pointer",
                transition: "background .15s, color .15s",
              }}
            >LOCKED</button>
          </div>
        </div>
        <div style={{ height: 1, background: "rgba(255,255,255,.05)", margin: "10px 0 6px 0" }} />
        <a
          className="weered-rr-destroy-link"
          role="button"
          tabIndex={loading ? -1 : 0}
          aria-disabled={loading}
          onClick={async () => {
            if (loading) return;
            const ok = await weeredConfirm({ title: "Clear all lobby chat?", body: "Every message in this lobby's chat gets wiped. Can't be undone.", confirmLabel: "Clear chat", destructive: true });
            if (!ok) return;
            setLoad(true);
            try { const j = await apiFetch("/staff/lobby/clear-chat", { method: "POST", body: JSON.stringify({ lobbyId }) }); setNote(j.ok ? "Chat cleared." : j.error || "Failed."); }
            catch { setNote("Request failed."); } finally { setLoad(false); }
          }}
          onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !loading) (e.currentTarget as HTMLElement).click(); }}
          style={{
            display: "block", width: "100%", padding: "6px 0", background: "transparent",
            border: "none", color: "rgba(252,165,165,.62)", fontSize: 11,
            fontWeight: 600, cursor: loading ? "default" : "pointer",
            textAlign: "left", letterSpacing: ".2px", textDecoration: "none",
            textTransform: "none", fontFamily: "inherit", boxShadow: "none",
            textShadow: "none", userSelect: "none",
          }}
        >Clear all chat</a>
        {note && <div style={{ marginTop: 8, fontSize: 11, opacity: 0.65 }}>{note}</div>}
      </div>
    </div>
  );
}

function FriendlessRow() {
  const PlatformDot = ({ color, label }: { color: string; label: string }) => (
    <span title={label} style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 14, height: 14, borderRadius: 3,
      background: `${color}22`, border: `1px solid ${color}55`,
      fontSize: 8, fontWeight: 800, color, fontFamily: "monospace",
    }}>{label[0]}</span>
  );
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "6px 8px", borderRadius: 7,
      border: "1px dashed rgba(255,255,255,.10)", background: "rgba(255,255,255,.015)",
    }} title="Demo entry — add your own people to replace me.">
      <div style={{
        position: "relative", width: 26, height: 26, borderRadius: 999,
        background: "rgba(124,58,237,.20)", border: "1px solid rgba(124,58,237,.35)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, fontWeight: 800, color: "rgba(216,180,254,.95)",
        flexShrink: 0,
      }}>
        F
        <span style={{
          position: "absolute", bottom: -1, right: -1,
          width: 8, height: 8, borderRadius: 999,
          background: "rgba(255,255,255,.18)", border: "2px solid rgba(10,10,15,1)",
        }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "rgba(243,244,246,.85)" }}>
          <span style={{ fontStyle: "italic" }}>Friendless</span>
          <span style={{ fontSize: 8, padding: "1px 4px", borderRadius: 3, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.10)", color: "rgba(243,244,246,.55)", letterSpacing: "0.4px", textTransform: "uppercase" }}>demo</span>
        </div>
        <div style={{ fontSize: 9, opacity: 0.45, fontStyle: "italic", marginTop: 1 }}>
          lying low in the void
        </div>
      </div>
      <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
        <PlatformDot color="#1b2838" label="Steam" />
        <PlatformDot color="#9146FF" label="Twitch" />
        <PlatformDot color="#107C10" label="Xbox" />
      </div>
    </div>
  );
}

function FriendsEmptyDiscovery({ lobbyId }: { lobbyId: string }) {
  const ctx: any = useWeered();
  const meId = String(ctx?.me?.id || "");
  const { openSheet } = useOverlay();
  const all = useLobbyPresence(lobbyId);
  const others = all.filter(u => String(u?.id || "") !== meId);
  return (
    <div className="weered-rr-section" style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.5, letterSpacing: ".7px", textTransform: "uppercase", marginBottom: 8 }}>
        Friends · 0 online
      </div>
      <div style={{
        borderRadius: 10, border: "1px solid rgba(255,255,255,.06)",
        background: "rgba(255,255,255,.02)", padding: 10,
        display: "flex", flexDirection: "column", gap: 6,
      }}>
        <FriendlessRow />
        {others.length > 0 && (
          <>
            <div style={{ fontSize: 9, color: "rgba(243,244,246,.35)", letterSpacing: ".5px", textTransform: "uppercase", textAlign: "center", padding: "4px 0 2px" }}>
              ↓ replace with real ones ↓
            </div>
            {others.slice(0, 5).map(u => (
              <button key={u.id} type="button" onClick={() => openSheet("profile", { userId: String(u.id) })} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "5px 6px", borderRadius: 7,
                border: "1px solid transparent", background: "transparent",
                cursor: "pointer", textAlign: "left",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.04)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <PresenceAvatar user={u} size={26} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(243,244,246,.92)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {u.name}
                  </div>
                  {u.roomName && <div style={{ fontSize: 10, opacity: 0.45, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.roomName}</div>}
                </div>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function FriendsPanel({ lobbyId }: { lobbyId: string }) {
  const { openSheet } = useOverlay();
  const [friends, setFriends] = React.useState<any[]>([]);
  const [open, setOpen]       = React.useState(true);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => { setMounted(true); }, []);

  async function load() {
    try { const j = await apiFetch("/friends"); setFriends(Array.isArray(j?.friends) ? j.friends : []); } catch {}
  }
  React.useEffect(() => { if (mounted) void load(); }, [mounted]);
  React.useEffect(() => { if (!mounted) return; const t = setInterval(load, 60000); return () => clearInterval(t); }, [mounted]);

  if (!mounted) return null;

  if (!friends.length) {
    return <FriendsEmptyDiscovery lobbyId={lobbyId} />;
  }
  const online  = friends.filter(f => f.online);
  const offline = friends.filter(f => !f.online);

  const renderFriend = (f: any) => {
    const hasUnread   = (f.unreadCount ?? 0) > 0 || Boolean(f.hasUnread ?? f.hasPendingDm);
    const unreadCount = f.unreadCount ?? (hasUnread ? 1 : 0);
    const userId      = String(f.id ?? f.userId ?? f.username ?? "");
    const rawRoomId   = String(f.roomId || "").replace(/^room:/, "");
    const isLobby     = f.roomIsLobby === true || rawRoomId === "lobby";
    const joinHref    = rawRoomId ? presenceHref(rawRoomId, isLobby) : null;

    const platforms = {
      steam:  !!f.steamId,
      twitch: !!f.twitchLogin,
      xbox:   !!f.xboxGamertag,
      psn:    !!f.psnAccountId,
    };

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
      if (f.statusText || f.statusEmoji) {
        return (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, minWidth: 0, opacity: 0.85 }}>
            {f.statusEmoji && <span style={{ flexShrink: 0 }}>{f.statusEmoji}</span>}
            {f.statusText && <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontStyle: "italic" }}>{f.statusText}</span>}
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
          userId={f.id}
          avatar={f.avatar}
          avatarColor={f.avatarColor}
          globalRole={f.globalRole}
          tier={f.tier}
          online={f.online}
          isAway={!!f.isAway}
          roomName={f.roomName}
          statusText={f.statusText}
          statusEmoji={f.statusEmoji}
          nameEffect={f.nameEffect}
          avatarFrame={f.avatarFrame}
          secondaryText={friendSecondary}
          platforms={platforms}
          pillBgColor={f.pillBgColor}
          pillAccentColor={f.pillAccentColor}
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

function CrewEmptyDiscovery({ lobbyId }: { lobbyId: string }) {
  const router = useRouter();
  const lobbyCrews = useLobbyCrews(lobbyId, true);
  const top = lobbyCrews
    .slice()
    .sort((a, b) => (Number(b?.recruiting) - Number(a?.recruiting)) || ((b?.memberCount || 0) - (a?.memberCount || 0)))
    .slice(0, 3);
  return (
    <div className="weered-rr-section" style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.5, letterSpacing: ".7px", textTransform: "uppercase", marginBottom: 8 }}>
        Crew · 1 online
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div
          style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "8px 10px", borderRadius: 9,
            border: "1px dashed rgba(255,255,255,.10)", background: "rgba(255,255,255,.015)",
          }}
          title="Demo entry — join a crew below or start your own."
        >
          <div style={{
            width: 28, height: 28, borderRadius: 7, flexShrink: 0,
            background: "linear-gradient(135deg, rgba(124,58,237,.25), rgba(245,158,11,.20))",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 800, color: "rgba(243,244,246,.85)",
          }}>🐺</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(243,244,246,.85)", display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontStyle: "italic" }}>Lone Wolf</span>
              <span style={{ fontSize: 9, opacity: 0.5, fontFamily: "monospace" }}>[SOLO]</span>
              <span style={{ fontSize: 8, padding: "1px 4px", borderRadius: 3, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.10)", color: "rgba(243,244,246,.55)", letterSpacing: "0.4px", textTransform: "uppercase", marginLeft: 3 }}>demo</span>
            </div>
            <div style={{ fontSize: 10, opacity: 0.55, marginTop: 1, fontStyle: "italic" }}>
              1 member · roaming
            </div>
          </div>
        </div>

        {top.length > 0 && (
          <div style={{ fontSize: 9, color: "rgba(243,244,246,.35)", letterSpacing: ".5px", textTransform: "uppercase", textAlign: "center", padding: "4px 0 2px" }}>
            ↓ or join one of these ↓
          </div>
        )}

        {top.map(c => {
          const accent = c.accentColor || "#5800E5";
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => router.push(`/crew/${encodeURIComponent(c.id)}`)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 10px", borderRadius: 9,
                border: `1px solid ${accent}33`, background: `${accent}0a`,
                cursor: "pointer", textAlign: "left",
                transition: "background 0.12s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${accent}18`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${accent}0a`; }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                background: c.logoUrl ? "rgba(255,255,255,.06)" : `${accent}33`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 800, color: "#fff",
                overflow: "hidden",
              }}>
                {c.logoUrl ? <img src={c.logoUrl} alt={c.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (c.tag || c.name || "?").slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(243,244,246,.95)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.name}{c.tag && <span style={{ marginLeft: 5, fontSize: 9, opacity: 0.5, fontFamily: "monospace" }}>[{c.tag}]</span>}
                </div>
                <div style={{ fontSize: 10, opacity: 0.55, marginTop: 1 }}>
                  {c.memberCount || 0} member{(c.memberCount || 0) === 1 ? "" : "s"}
                  {c.recruiting && <span style={{ marginLeft: 6, color: "rgb(110,231,183)" }}>· recruiting</span>}
                </div>
              </div>
              <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 999, border: `1px solid ${accent}55`, background: `${accent}18`, color: "rgba(243,244,246,.85)", flexShrink: 0 }}>view</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CrewPanel({ lobbyId }: { lobbyId: string }) {
  const { openSheet } = useOverlay();
  const [crews, setCrews] = React.useState<any[]>([]);
  const [open, setOpen]   = React.useState(true);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => { setMounted(true); }, []);
  async function load() { try { const j = await apiFetch("/crews/mine"); setCrews(Array.isArray(j?.crews) ? j.crews : []); } catch {} }
  React.useEffect(() => { if (mounted) void load(); }, [mounted]);
  React.useEffect(() => { if (!mounted) return; const t = setInterval(load, 60000); return () => clearInterval(t); }, [mounted]);

  if (!mounted) return null;
  if (!crews.length) return <CrewEmptyDiscovery lobbyId={lobbyId} />;

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
            const isLobby    = m.roomIsLobby === true || rawRoomId === "lobby";
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

function DiscoverLobbiesPanel({ currentLobbyId }: { currentLobbyId: string }) {
  const router = useRouter();
  const [eligible, setEligible] = React.useState(false);
  const [lobbies, setLobbies] = React.useState<any[]>([]);

  React.useEffect(() => {
    let alive = true;
    Promise.all([
      apiFetch("/friends").catch(() => ({} as any)),
      apiFetch("/crews/mine").catch(() => ({} as any)),
    ]).then(([f, c]) => {
      if (!alive) return;
      const friends = Array.isArray(f?.friends) ? f.friends : [];
      const crews = Array.isArray(c?.crews) ? c.crews : [];
      if (!friends.length && !crews.length) setEligible(true);
    });
    return () => { alive = false; };
  }, []);

  React.useEffect(() => {
    if (!eligible) return;
    let alive = true;
    apiFetch("/lobbies").then(j => {
      if (!alive) return;
      if (!Array.isArray(j?.lobbies)) return;
      const sorted = j.lobbies
        .filter((l: any) => l.id !== currentLobbyId)
        .filter((l: any) => l.verified || l.pinned)
        .sort((a: any, b: any) => (b.onlineCount || 0) - (a.onlineCount || 0) || (b._count?.members || 0) - (a._count?.members || 0))
        .slice(0, 4);
      setLobbies(sorted);
    }).catch(() => {});
    return () => { alive = false; };
  }, [eligible, currentLobbyId]);

  if (!eligible || !lobbies.length) return null;
  return (
    <div className="weered-rr-section" style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.5, letterSpacing: ".7px", textTransform: "uppercase", marginBottom: 8 }}>
        Discover · hot lobbies
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {lobbies.map(l => {
          const accent = l.accentColor || "#5800E5";
          const initial = String(l.name || l.id || "?").slice(0, 1).toUpperCase();
          return (
            <button
              key={l.id}
              type="button"
              onClick={() => router.push(`/lobby/${encodeURIComponent(l.id)}`)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 10px", borderRadius: 9,
                border: `1px solid ${accent}33`, background: `${accent}0a`,
                cursor: "pointer", textAlign: "left",
                transition: "background 0.12s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${accent}18`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${accent}0a`; }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                background: l.logoUrl ? "rgba(255,255,255,.06)" : `${accent}33`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 800, color: "#fff",
                overflow: "hidden",
              }}>
                {l.logoUrl ? <img src={l.logoUrl} alt={l.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initial}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(243,244,246,.95)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5 }}>
                  {l.name || l.id}
                  {l.verified && <span style={{ fontSize: 9, color: "rgb(110,231,183)" }}>✓</span>}
                </div>
                <div style={{ fontSize: 10, opacity: 0.55, marginTop: 1 }}>
                  {(l.onlineCount || 0) > 0 ? `${l.onlineCount} online` : `${l._count?.members || 0} members`}
                </div>
              </div>
              <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 999, border: `1px solid ${accent}55`, background: `${accent}18`, color: "rgba(243,244,246,.85)", flexShrink: 0 }}>visit</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

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
        <div style={{ flexShrink: 0 }}>
          <LogoMenu />
        </div>
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
          <div style={{ flexShrink: 0 }}>
            <LogoMenu />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13 }}>Control Panel</div>
            <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>context: {resolvedLobbyId}</div>
          </div>
        </div>
      </div>
      <LobbyModPanel globalRole={globalRole || ""} lobbyId={resolvedLobbyId} />
      <WhosHerePanel lobbyId={resolvedLobbyId} />
      <RoomsPanel currentRoomId={currentRoomId} lobbyId={resolvedLobbyId} />
      <FriendsPanel lobbyId={resolvedLobbyId} />
      <CrewPanel lobbyId={resolvedLobbyId} />
      <DiscoverLobbiesPanel currentLobbyId={resolvedLobbyId} />
    </div>
  );
}
