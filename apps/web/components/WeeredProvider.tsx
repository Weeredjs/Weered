"use client";

import { useRouter, usePathname } from "next/navigation";
import { VoiceProvider } from "./VoiceContext";
import NotorietyToast from "./NotorietyToast";
import RankUpCelebration from "./RankUpCelebration";
import SystemBroadcast from "./SystemBroadcast";
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const API    = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
const WS_URL = process.env.NEXT_PUBLIC_WS_URL   || "ws://127.0.0.1:4001";
const SETTINGS_KEY = "weered:settings:v0";

// ─── Types ────────────────────────────────────────────────────────────────────
type Role       = "owner" | "mod" | "member" | "none";
type RoomUser   = { id: string; name: string; role?: Role; globalRole?: string; avatarColor?: string };
type ChatMsg    = { id: string; user: RoomUser; body: string; ts: number };
type Knock      = { userId: string; name: string; ts: number };
type JoinStatus = "idle" | "joining" | "joined" | "knocking" | "banned" | "denied";

type AuditItem = {
  id: string; ts: number; type: string;
  actorId: string; actorName: string;
  targetId?: string; targetName?: string; note?: string;
};

type RoomMeta   = { name: string; locked: boolean; chatDisabled: boolean; thumbnail?: string; ownerId: string; mods: string[] };
type AdminState = { knocks: Knock[]; banned: string[]; muted: string[]; audit: AuditItem[] };
type ModuleState = { mode: string; url?: string; channel?: string; setBy?: string; setAt?: number } | null;

type Ctx = {
  apiBase: string; wsUrl: string;
  token: string; me: any; authed: boolean; globalRole: string;
  wsReady: boolean; wsState: number;
  activeRoomId: string; joinedRoomId: string; currentLobbyId: string;
  setActiveRoomId: (id: string) => void;
  users: RoomUser[]; msgs: ChatMsg[];
  usersByRoom: Record<string, RoomUser[]>;
  msgsByRoom: Record<string, ChatMsg[]>;
  metaByRoom: Record<string, RoomMeta>;
  adminByRoom: Record<string, AdminState>;
  moduleByRoom: Record<string, ModuleState>;
  ytStateByRoom: Record<string, { videoId: string; playing: boolean; position: number; updatedAt: number }>;
  meta: RoomMeta | null; admin: AdminState | null;
  moduleState: ModuleState;
  role: Role; joinStatus: JoinStatus; statusByRoom: Record<string, JoinStatus>;
  rooms: any[];
  join: (roomId: string) => void;
  leave: () => void;
  knock: (roomId: string) => void;
  devLogin: (username: string) => Promise<void>;
  logout: () => void;
  sendChat: (body: string) => void;
  renameRoom: (name: string) => void;
  setModuleState: (mode: string | null, opts?: { url?: string; channel?: string }) => void;
  lockRoom: () => void; unlockRoom: () => void;
  joinWithPassword: (roomId: string, password: string) => void;
  passwordRoomId: string; passwordError: string;
  setPasswordRoomId: (id: string) => void;
  promote: (userId: string) => void; demote: (userId: string) => void;
  kick: (userId: string) => void; ban: (userId: string) => void;
  unban: (userId: string) => void; mute: (userId: string) => void; unmute: (userId: string) => void;
  admit: (userId: string) => void; deny: (userId: string) => void;
  sendRaw: (msg: object) => void;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function normalizeInbound(msg: any) {
  if (msg?.payload && typeof msg.payload === "object") return { ...msg, ...msg.payload };
  return msg;
}

function applySettingsToDom(s: any) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-weered-theme",        String(s?.theme        ?? "stone"));
  root.setAttribute("data-weered-density",      String(s?.density      ?? "comfortable"));
  root.setAttribute("data-weered-reduce-motion", s?.reduceMotion ? "1" : "0");
}

function readSettings(): any {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(SETTINGS_KEY) : null;
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// ─── Context ──────────────────────────────────────────────────────────────────
const WeeredContext = createContext<Ctx | null>(null);

/* ─── Password Prompt (inline sub-component) ─────────────────────────────── */
function PasswordPromptInput({ roomId, error, onSubmit, onCancel }: {
  roomId: string; error: string; onSubmit: (pw: string) => void; onCancel: () => void;
}) {
  const [pw, setPw] = React.useState("");
  return (
    <>
      <input
        autoFocus
        type="password"
        placeholder="Enter room password…"
        value={pw}
        onChange={e => setPw(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && pw.trim()) onSubmit(pw.trim()); }}
        style={{
          width: "100%", padding: "9px 12px", borderRadius: 10, fontSize: 13,
          border: error ? "1px solid rgba(239,68,68,.50)" : "1px solid rgba(88,0,229,.30)",
          background: "rgba(0,0,0,.35)", color: "rgba(243,244,246,.92)",
          outline: "none", boxSizing: "border-box",
        }}
      />
      {error && <div style={{ fontSize: 11, color: "rgba(252,165,165,.85)", marginTop: 6 }}>{error}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button
          onClick={onCancel}
          style={{
            flex: 1, padding: "8px", borderRadius: 9, fontSize: 12, fontWeight: 600,
            border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.05)",
            color: "rgba(243,244,246,.70)", cursor: "pointer",
          }}
        >
          Cancel
        </button>
        <button
          onClick={() => pw.trim() && onSubmit(pw.trim())}
          disabled={!pw.trim()}
          style={{
            flex: 1, padding: "8px", borderRadius: 9, fontSize: 12, fontWeight: 700,
            border: "1px solid rgba(88,0,229,.45)", background: "rgba(88,0,229,.18)",
            color: "rgba(167,139,250,.95)", cursor: pw.trim() ? "pointer" : "default",
            opacity: pw.trim() ? 1 : 0.5,
          }}
        >
          Enter Room
        </button>
      </div>
    </>
  );
}

export function WeeredProvider({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();

  // ── Auth state ──
  const [token, setToken] = useState("");
  const [me,    setMe   ] = useState<any>(null);
  const [globalRole, setGlobalRole] = useState("");

  // ── WS state ──
  const [wsState, setWsState] = useState<number>(WebSocket.CLOSED);
  const [wsReady, setWsReady] = useState(false);
  const wsRef            = useRef<WebSocket | null>(null);
  const lastAuthTokenRef = useRef("");
  const lastJoinedRidRef = useRef("");
  const activeRoomIdRef  = useRef(""); // always-current ref to escape stale closures

  // ── Room state ──
  const [activeRoomId,  setActiveRoomId ] = useState("");
  const [joinedRoomId,  setJoinedRoomId ] = useState("");
  const [currentLobbyId, setCurrentLobbyId] = useState("");
  const [usersByRoom,   setUsersByRoom  ] = useState<Record<string, RoomUser[]>>({});
  const [msgsByRoom,    setMsgsByRoom   ] = useState<Record<string, ChatMsg[]>>({});
  const [metaByRoom,    setMetaByRoom   ] = useState<Record<string, RoomMeta>>({});
  const [adminByRoom,   setAdminByRoom  ] = useState<Record<string, AdminState>>({});
  const [statusByRoom,  setStatusByRoom ] = useState<Record<string, JoinStatus>>({});
  const [moduleByRoom,  setModuleByRoom ] = useState<Record<string, ModuleState>>({});
  const [ytStateByRoom, setYtStateByRoom] = useState<Record<string, { videoId: string; playing: boolean; position: number; updatedAt: number }>>({});
  const [rooms,         setRooms        ] = useState<any[]>([]);
  const [passwordRoomId, setPasswordRoomId] = useState("");
  const [passwordError,  setPasswordError ] = useState("");

  // ── Derived ──
  const authed     = useMemo(() => Boolean(token), [token]);
  const meta       = activeRoomId ? (metaByRoom[activeRoomId]   || null)    : null;
  const admin      = activeRoomId ? (adminByRoom[activeRoomId]  || null)    : null;
  const users      = activeRoomId ? (usersByRoom[activeRoomId]  || [])      : [];
  const msgs       = activeRoomId ? (msgsByRoom[activeRoomId]   || [])      : [];
  const joinStatus = activeRoomId ? (statusByRoom[activeRoomId] || "idle")  : "idle";
  const moduleState: ModuleState = activeRoomId ? (moduleByRoom[activeRoomId] ?? null) : null;

  const role: Role = useMemo(() => {
    if (!meta || !me?.id) return "none";
    if (meta.ownerId === me.id) return "owner";
    if (Array.isArray(meta.mods) && meta.mods.includes(me.id)) return "mod";
    return "member";
  }, [meta, me]);

  // ── Fetch globalRole when token changes ──
  useEffect(() => {
    if (!token) { setGlobalRole(""); return; }
    fetch(`${API}/staff/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(j => { if (j?.globalRole) setGlobalRole(j.globalRole); })
      .catch(() => {});
  }, [token]);

  // ── Settings: apply on mount and when changed ──
  useEffect(() => {
    const s = readSettings();
    if (s) applySettingsToDom(s);
    const onChanged = (ev: any) => {
      const next = ev?.detail ?? readSettings();
      if (next) applySettingsToDom(next);
    };
    window.addEventListener("weered:settings:changed", onChanged as any);
    return () => window.removeEventListener("weered:settings:changed", onChanged as any);
  }, []);

  // ── Boot: load persisted auth from localStorage ──
  useEffect(() => {
    try {
      const tok  = localStorage.getItem("weered_token") || "";
      const uRaw = localStorage.getItem("weered_user")  || "";
      if (tok) setToken(tok);
      if (uRaw) { try { setMe(JSON.parse(uRaw)); } catch {} }
    } catch {}
  }, []);

  // ── Sync auth from localStorage on navigation ──
  useEffect(() => {
    try {
      const tok  = localStorage.getItem("weered_token") || "";
      const uRaw = localStorage.getItem("weered_user")  || "";
      if (tok && tok !== token) {
        setToken(tok);
        try { setMe(uRaw ? JSON.parse(uRaw) : null); } catch { setMe(null); }
      }
      if (!tok && token) { setToken(""); setMe(null); }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // ── Auto-set activeRoomId from path ──
  useEffect(() => {
    try {
      if (!pathname) return;
      // Room path: /room/ROOMID or /room/ROOMID/...
      const roomMatch = pathname.match(/^\/room\/([^/]+)/);
      if (roomMatch) {
        const rid = decodeURIComponent(roomMatch[1]);
        if (rid && rid !== "@me") { activeRoomIdRef.current = rid; setActiveRoomId(rid); return; }
      }
    if (pathname.startsWith("/lobby")) {
      const seg = pathname.replace("/lobby/", "").replace("/lobby", "").trim();
      // Skip static routes that aren't lobby IDs
      const staticRoutes = ["create", "admin", "settings"];
      if (seg && staticRoutes.includes(seg.split("/")[0])) return;
      const rid = seg ? decodeURIComponent(seg) : "lobby";
      activeRoomIdRef.current = rid;
      setActiveRoomId(rid);
      // Set lobby context from path immediately (WS will confirm/override later)
      if (seg) setCurrentLobbyId(decodeURIComponent(seg));
      return;
    }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // ── WebSocket lifecycle ──
  useEffect(() => {
    if (!token) return;

    // If already open, just re-auth in-band — never spawn a new connection
    const existing = wsRef.current;
    if (existing?.readyState === WebSocket.OPEN) {
      if (token !== lastAuthTokenRef.current) {
        lastAuthTokenRef.current = token;
        try { existing.send(JSON.stringify({ type: "auth:hello", token })); } catch {}
      }
      return;
    }
    // If already connecting, don't create another
    if (existing?.readyState === WebSocket.CONNECTING) return;
    // Close any dead socket before creating new one
    if (existing) { try { existing.close(); } catch {} wsRef.current = null; }

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsState(ws.readyState);
      const tok = (() => { try { return localStorage.getItem("weered_token") || token; } catch { return token; } })();
      lastAuthTokenRef.current = tok;
      ws.send(JSON.stringify({ type: "auth:hello", token: tok }));
    };

    ws.onclose = () => {
      setWsState(WebSocket.CLOSED);
      setWsReady(false);
      // Only clear ref if this is still the current socket
      if (wsRef.current === ws) wsRef.current = null;
    };
    ws.onerror = () => { setWsState(ws.readyState); };

    ws.onmessage = (ev) => {
      let msg: any = null;
      try { msg = JSON.parse(String(ev.data || "")); } catch { return; }
      msg = normalizeInbound(msg);
      if (!msg || typeof msg.type !== "string") return;
      // Forward DM messages to DockShell via window event
      if (msg.type === "dm:message") {
        try { window.dispatchEvent(new CustomEvent("weered:dm:message", { detail: msg })); } catch {}
      }
      // Forward notification events to DOM
      if (msg.type === "notification:new") {
        try { window.dispatchEvent(new CustomEvent("weered:notification", { detail: msg.notification })); } catch {}
      }
      // Forward crew chat messages to DOM
      if (msg.type === "crew:message") {
        try { window.dispatchEvent(new CustomEvent("weered:crew:message", { detail: { crewId: msg.crewId, message: msg.message } })); } catch {}
      }
      // Forward crew presence changes to DOM
      if (msg.type === "crew:presence") {
        try { window.dispatchEvent(new CustomEvent("weered:crew:presence", { detail: { userId: msg.userId, name: msg.name, online: msg.online } })); } catch {}
      }
      // Forward poker state to DOM
      if (msg.type === "poker:state") {
        try { window.dispatchEvent(new CustomEvent("weered:poker:state", { detail: msg })); } catch {}
      }
      // Forward D&D events (initiative tracker + dice rolls) to DOM
      if (msg.type === "dnd:initiative" || msg.type === "dnd:roll") {
        try { window.dispatchEvent(new CustomEvent(`weered:${msg.type}`, { detail: msg })); } catch {}
      }
      // Forward all youtube sync events to RoomStage via DOM event + buffer state for late joiners
      if (msg.type?.startsWith("youtube:")) {
        const rid = String(msg.roomId || "");
        if (rid) {
          if (msg.type === "youtube:state" || msg.type === "youtube:load") {
            setYtStateByRoom(prev => ({ ...prev, [rid]: { videoId: msg.videoId, playing: Boolean(msg.playing), position: Number(msg.position ?? 0), updatedAt: Date.now() } }));
          } else if (msg.type === "youtube:play") {
            setYtStateByRoom(prev => ({ ...prev, [rid]: { ...(prev[rid] || { videoId: "", playing: false, position: 0, updatedAt: 0 }), playing: true, position: Number(msg.position ?? 0), updatedAt: Date.now() } }));
          } else if (msg.type === "youtube:pause") {
            setYtStateByRoom(prev => ({ ...prev, [rid]: { ...(prev[rid] || { videoId: "", playing: false, position: 0, updatedAt: 0 }), playing: false, position: Number(msg.position ?? 0), updatedAt: Date.now() } }));
          } else if (msg.type === "youtube:stop") {
            setYtStateByRoom(prev => { const n = { ...prev }; delete n[rid]; return n; });
          }
        }
        try { window.dispatchEvent(new CustomEvent("weered:youtube", { detail: { ...msg, updatedAt: Date.now() } })); } catch {}
      }
      // Generic rooms list payload
      if (Array.isArray(msg.rooms)) setRooms(msg.rooms);

      if (msg.type === "auth:ok") {
        setWsReady(true);
        setWsState(WebSocket.OPEN);
        const u = msg.user ?? msg.payload?.user ?? null;
        if (u) {
          setMe(u);
          try { localStorage.setItem("weered_user", JSON.stringify(u)); } catch {}
          if (u.globalRole) setGlobalRole(String(u.globalRole));
        } else {
          try { const raw = localStorage.getItem("weered_user"); if (raw) setMe(JSON.parse(raw)); } catch {}
        }
        sendJoin(ws);
        requestRoomsList(ws);
        return;
      }

      if (msg.type === "auth:fail") {
        setWsReady(false);
        setWsState(WebSocket.OPEN);
        return;
      }

      if (msg.type === "presence:state") {
        const rid  = String(msg.roomId || "");
        const list = Array.isArray(msg.users) ? msg.users : [];
        setUsersByRoom(prev => ({ ...prev, [rid]: list }));
        setMetaByRoom(prev => ({
          ...prev,
          [rid]: { name: String(msg.name || rid), locked: Boolean(msg.locked), chatDisabled: Boolean(msg.chatDisabled ?? false), thumbnail: msg.thumbnail || undefined, ownerId: String(msg.ownerId || ""), mods: Array.isArray(msg.mods) ? msg.mods.map(String) : [] },
        }));
        setStatusByRoom(prev => ({ ...prev, [rid]: "joined" }));
        // Extract active module state sent on join
        if (msg.activeModule) {
          setModuleByRoom(prev => ({ ...prev, [rid]: msg.activeModule }));
        }
        // Track lobby context from the server's lobbyId field
        if (msg.lobbyId) setCurrentLobbyId(String(msg.lobbyId));
        // activeRoomId managed by path effect — no override needed here
        setJoinedRoomId(prev => {
          if (prev && prev !== rid) {
            try { ws.send(JSON.stringify({ type: "presence:leave", roomId: prev })); } catch {}
          }
          return rid;
        });
        return;
      }

      // Another user joined this room
      if (msg.type === "presence:join") {
        const rid  = String(msg.roomId || "");
        const user = msg.user as RoomUser | null;
        if (!rid || !user?.id) return;
        setUsersByRoom(prev => {
          const cur = prev[rid] || [];
          if (cur.find((u: RoomUser) => u.id === user.id)) return prev;
          return { ...prev, [rid]: [...cur, user] };
        });
        return;
      }

      // Another user left this room
      if (msg.type === "presence:leave") {
        const rid    = String(msg.roomId || "");
        const userId = String(msg.userId || "");
        if (!rid || !userId) return;
        setUsersByRoom(prev => {
          const cur = prev[rid];
          if (!cur) return prev;
          return { ...prev, [rid]: cur.filter((u: RoomUser) => u.id !== userId) };
        });
        return;
      }

      if (msg.type === "room:adminState") {
        const rid = String(msg.roomId || "");
        setAdminByRoom(prev => ({
          ...prev,
          [rid]: {
            knocks:  Array.isArray(msg.knocks)  ? msg.knocks                  : [],
            banned:  Array.isArray(msg.banned)  ? msg.banned.map(String)      : [],
            muted:   Array.isArray(msg.muted)   ? msg.muted.map(String)       : [],
            audit:   Array.isArray(msg.audit)   ? msg.audit                   : [],
          },
        }));
        setMetaByRoom(prev => ({
          ...prev,
          [rid]: { name: String(msg.name || rid), locked: Boolean(msg.locked), chatDisabled: Boolean(msg.chatDisabled ?? false), thumbnail: msg.thumbnail || undefined, ownerId: String(msg.ownerId || ""), mods: Array.isArray(msg.mods) ? msg.mods.map(String) : [] },
        }));
        return;
      }

      if (msg.type === "room:audit") {
        const rid  = String(msg.roomId || "");
        const item = msg.item as AuditItem;
        if (!item?.id) return;
        setAdminByRoom(prev => {
          const cur = prev[rid] || { knocks: [], banned: [], muted: [], audit: [] };
          return { ...prev, [rid]: { ...cur, audit: [...cur.audit, item].slice(-80) } };
        });
        return;
      }

      if (msg.type === "chat:history") {
        const rid  = String(msg.roomId || "");
        const list = Array.isArray(msg.msgs) ? (msg.msgs as ChatMsg[]) : [];
        setMsgsByRoom(prev => ({ ...prev, [rid]: list.slice(-200) }));
        return;
      }

      if (msg.type === "chat:new") {
        const rid = String(msg.roomId || "");
        const m   = msg.msg as ChatMsg;
        if (!m?.id) return;
        setMsgsByRoom(prev => ({ ...prev, [rid]: [...(prev[rid] || []), m].slice(-200) }));
        // Dispatch DOM event so closed chat drawers can track unread
        try { window.dispatchEvent(new CustomEvent("weered:chat:new", { detail: { roomId: rid, msg: m } })); } catch {}
        return;
      }


      // room:locked: server sends locked:true for lock, locked:false for unlock (room behaviour).
      // Lobby omits the field entirely, so default to true when absent.
      if (msg.type === "room:locked") {
        const rid = String(msg.roomId || "");
        const isLocked = typeof msg.locked === "boolean" ? msg.locked : true;
        setMetaByRoom(prev => ({
          ...prev,
          [rid]: { ...(prev[rid] || { name: rid, ownerId: "", mods: [], chatDisabled: false }), locked: isLocked }
        }));
        return;
      }

      // room:unlocked fires when a room is unlocked
      if (msg.type === "room:unlocked") {
        const rid = String(msg.roomId || "");
        setMetaByRoom(prev => ({
          ...prev,
          [rid]: { ...(prev[rid] || { name: rid, ownerId: "", mods: [], chatDisabled: false }), locked: false }
        }));
        return;
      }

      if (msg.type === "room:chat:disable") {
        const rid = String(msg.roomId || "");
        setMetaByRoom(prev => ({
          ...prev,
          [rid]: { ...(prev[rid] || { name: rid, ownerId: "", mods: [], locked: false, chatDisabled: false }), chatDisabled: true }
        }));
        return;
      }

      if (msg.type === "room:chat:enable") {
        const rid = String(msg.roomId || "");
        setMetaByRoom(prev => ({
          ...prev,
          [rid]: { ...(prev[rid] || { name: rid, ownerId: "", mods: [], locked: false, chatDisabled: false }), chatDisabled: false }
        }));
        return;
      }

      if (msg.type === "chat:cleared") {
        const rid = String(msg.roomId || "");
        setMsgsByRoom(prev => ({ ...prev, [rid]: [] }));
        return;
      }

      if (msg.type === "room:knock:queued") { setStatusByRoom(prev => ({ ...prev, [String(msg.roomId || "")]: "knocking" })); return; }
      if (msg.type === "room:banned")       { setStatusByRoom(prev => ({ ...prev, [String(msg.roomId || "")]: "banned"   })); return; }
      if (msg.type === "room:password:required") { setPasswordRoomId(String(msg.roomId || "")); setPasswordError(""); return; }
      if (msg.type === "room:password:wrong")    { setPasswordError("Wrong password."); return; }
      if (msg.type === "room:denied")       { setStatusByRoom(prev => ({ ...prev, [String(msg.roomId || "")]: "denied"   })); return; }
      if (msg.type === "staff:kicked") {
        const rid = String(msg.roomId || "");
        if (rid) setStatusByRoom(prev => ({ ...prev, [rid]: "idle" }));
        setActiveRoomId("");
        setJoinedRoomId("");
        try { router.replace("/lobby"); } catch {}
        return;
      }
      if (msg.type === "room:closed") {
        const rid = String(msg.roomId || "");
        if (rid) setStatusByRoom(prev => ({ ...prev, [rid]: "idle" }));
        setActiveRoomId("");
        setJoinedRoomId("");
        try { router.replace("/lobby"); } catch {}
        return;
      }
      if (msg.type === "room:admitted") {
        const rid = String(msg.roomId || "");
        if (rid) setStatusByRoom(prev => ({ ...prev, [rid]: "joined" }));
        return;
      }

      if (msg.type === "notoriety:award") {
        window.dispatchEvent(new CustomEvent("weered:notoriety:award", {
          detail: { action: msg.action, points: msg.points },
        }));
        return;
      }

      if (msg.type === "notoriety:rankup") {
        window.dispatchEvent(new CustomEvent("weered:notoriety:rankup", {
          detail: { oldRank: msg.oldRank, newRank: msg.newRank, score: msg.score },
        }));
        return;
      }

      // ── Challenge real-time progress / completion ──
      if (msg.type === "challenge:progress" || msg.type === "challenge:completed") {
        try { window.dispatchEvent(new CustomEvent("weered:challenge", { detail: msg })); } catch {}
        return;
      }

      // ── Module state sync — another user changed the active module ──
      if (msg.type === "module:state") {
        const rid = String(msg.roomId || "");
        if (!rid) return;
        setModuleByRoom(prev => ({ ...prev, [rid]: msg.activeModule ?? null }));
        // Dispatch DOM event so RoomCanvas can react immediately
        try { window.dispatchEvent(new CustomEvent("weered:module:state", { detail: { roomId: rid, activeModule: msg.activeModule ?? null } })); } catch {}
        return;
      }

      // ── System broadcast from staff ──
      if (msg.type === "system:broadcast") {
        try { window.dispatchEvent(new CustomEvent("weered:system:broadcast", { detail: { message: msg.message, level: msg.level, from: msg.from, ts: msg.ts } })); } catch {}
        return;
      }

      // ── Staff banned — kicked from platform ──
      if (msg.type === "staff:banned") {
        try { window.dispatchEvent(new CustomEvent("weered:staff:banned", { detail: { reason: msg.reason } })); } catch {}
        setActiveRoomId("");
        setJoinedRoomId("");
        try { router.replace("/login?error=account_suspended"); } catch {}
        return;
      }
    };

    return () => { /* do not close — guards at effect top handle re-auth in-band */ };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ── Join room when activeRoomId changes ──
  useEffect(() => {
    if (!wsReady) return;
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const rid = activeRoomId.trim();
    if (!rid) return;
    setStatusByRoom(prev => ({ ...prev, [rid]: "joining" }));
    try { ws.send(JSON.stringify({ type: "presence:join", roomId: rid })); } catch {}
  }, [activeRoomId, wsReady]);

  // ── Request rooms list after WS auth ──
  useEffect(() => {
    if (!wsReady) return;
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    requestRoomsList(ws);
    // Re-trigger the join effect by clearing the last joined ref
    lastJoinedRidRef.current = "";
    // If we already have an activeRoomId, join immediately
    const rid = activeRoomId.trim();
    if (rid) {
      try { ws.send(JSON.stringify({ type: "presence:join", roomId: rid })); } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsReady]);

  // ─── Internal helpers ─────────────────────────────────────────────────────
  function sendJoin(ws: WebSocket) {
    // Use ref to get current roomId — avoids stale closure from WS effect
    const ridRaw = activeRoomIdRef.current || joinedRoomId || activeRoomId;
    if (!ridRaw) return;
    let rid = ridRaw;
    // Strip "room:" prefix for consistency
    if (rid.startsWith("room:")) rid = rid.slice(5);
    try { rid = decodeURIComponent(rid); } catch {}
    if (lastJoinedRidRef.current === rid) return;
    lastJoinedRidRef.current = rid;
    try {
      ws.send(JSON.stringify({ type: "presence:join",  roomId: rid }));
      ws.send(JSON.stringify({ type: "chat:history",   roomId: rid, limit: 50 }));
    } catch {}
  }

  function requestRoomsList(ws: WebSocket) {
    try { ws.send(JSON.stringify({ type: "rooms:list" })); } catch {}
  }

  function canChat() {
    return Boolean(activeRoomId && joinedRoomId && activeRoomId === joinedRoomId && statusByRoom[activeRoomId] === "joined");
  }

  // Listen for weered:ws:send events from components that need to send WS messages
  useEffect(() => {
    const handler = (e: Event) => {
      const msg = (e as CustomEvent).detail;
      if (msg && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try { wsRef.current.send(JSON.stringify(msg)); } catch {}
      }
    };
    window.addEventListener("weered:ws:send", handler);
    return () => window.removeEventListener("weered:ws:send", handler);
  }, []);

  // ─── Public API ───────────────────────────────────────────────────────────
  async function devLogin(username: string) {
    const r = await fetch(`${API}/auth/dev-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    const j = await r.json();
    if (j?.token) {
      try { wsRef.current?.close(); } catch {}
      wsRef.current = null;
      setWsReady(false);
      setWsState(WebSocket.CLOSED);
      setToken(j.token);
      setMe(j.user || null);
      try { localStorage.setItem("weered_token", j.token); } catch {}
      try { localStorage.setItem("weered_user",  JSON.stringify(j.user || null)); } catch {}
    }
  }

  function logout() {
    try { localStorage.removeItem("weered_token"); localStorage.removeItem("weered_user"); } catch {}
    try { router.replace("/"); } catch {}
    setToken(""); setMe(null);
    setUsersByRoom({}); setMsgsByRoom({});
    setMetaByRoom({}); setAdminByRoom({});
    setStatusByRoom({}); setModuleByRoom({});
    setActiveRoomId(""); setJoinedRoomId("");
    try { wsRef.current?.close(); } catch {}
    wsRef.current = null;
  }

  function join(roomId: string) {
    let id = roomId.trim();
    if (!id) return;
    // Normalize: strip "room:" prefix so IDs are consistent with path-based activeRoomId
    if (id.startsWith("room:")) id = id.slice(5);
    setActiveRoomId(id);
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      let rid = id; try { rid = decodeURIComponent(id); } catch {}
      try { ws.send(JSON.stringify({ type: "presence:join",  roomId: rid })); } catch {}
      try { ws.send(JSON.stringify({ type: "chat:history",   roomId: rid, limit: 50 })); } catch {}
    }
  }

  function knock(roomId: string) {
    let id = roomId.trim();
    if (!id) return;
    if (id.startsWith("room:")) id = id.slice(5);
    setActiveRoomId(id);
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      let rid = id; try { rid = decodeURIComponent(id); } catch {}
      try { ws.send(JSON.stringify({ type: "room:knock", roomId: rid })); } catch {}
    }
  }

  function leave() {
    const rid = joinedRoomId || activeRoomId;
    if (rid) {
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) {
        let decoded = rid; try { decoded = decodeURIComponent(rid); } catch {}
        try { ws.send(JSON.stringify({ type: "presence:leave", roomId: decoded })); } catch {}
      }
    }
    setActiveRoomId("");
    setJoinedRoomId("");
    setCurrentLobbyId("");
    activeRoomIdRef.current = "";
    lastJoinedRidRef.current = "";
  }

  function sendChat(body: string) {
    const b = body.trim();
    if (!b || !canChat()) return;
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    let rid = activeRoomId; try { rid = decodeURIComponent(activeRoomId); } catch {}
    ws.send(JSON.stringify({ type: "chat:send", roomId: rid, body: b }));
  }

  function sendAdmin(type: string, payload: any = {}) {
    const ws = wsRef.current;
    const rid = activeRoomId || joinedRoomId;
    if (!ws || ws.readyState !== WebSocket.OPEN || !rid) return;
    ws.send(JSON.stringify({ type, roomId: rid, ...payload }));
  }

  function setModuleState(mode: string | null, opts?: { url?: string; channel?: string }) {
    const ws = wsRef.current;
    const rid = activeRoomId || joinedRoomId;
    if (!ws || ws.readyState !== WebSocket.OPEN || !rid) return;
    if (!mode) {
      ws.send(JSON.stringify({ type: "module:clear", roomId: rid }));
      setModuleByRoom(prev => ({ ...prev, [rid]: null }));
    } else {
      ws.send(JSON.stringify({ type: "module:set", roomId: rid, mode, url: opts?.url, channel: opts?.channel }));
      // Optimistic local update
      setModuleByRoom(prev => ({ ...prev, [rid]: { mode, url: opts?.url, channel: opts?.channel, setBy: me?.id, setAt: Date.now() } }));
    }
  }

const renameRoom = (name: string)   => sendAdmin("room:rename",  { name });
  const lockRoom   = ()               => sendAdmin("room:lock");
  const unlockRoom = ()               => sendAdmin("room:unlock");
  const joinWithPassword = (roomId: string, password: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    try { ws.send(JSON.stringify({ type: "presence:join", roomId, password })); } catch {}
    setPasswordRoomId("");
    setPasswordError("");
  };
  const promote    = (userId: string) => sendAdmin("mod:promote",  { userId });
  const demote     = (userId: string) => sendAdmin("mod:demote",   { userId });
  const kick       = (userId: string) => sendAdmin("mod:kick",     { userId });
  const ban        = (userId: string) => sendAdmin("mod:ban",      { userId });
  const unban      = (userId: string) => sendAdmin("mod:unban",    { userId });
  const mute       = (userId: string) => sendAdmin("mod:mute",     { userId });
  const unmute     = (userId: string) => sendAdmin("mod:unmute",   { userId });
  const admit      = (userId: string) => sendAdmin("room:admit",   { userId });
  const deny       = (userId: string) => sendAdmin("room:deny",    { userId });

  const value: Ctx = {
    apiBase: API, wsUrl: WS_URL,
    token, me, authed, globalRole,
    wsReady, wsState,
    activeRoomId, joinedRoomId, currentLobbyId, setActiveRoomId,
    users, msgs, meta, admin, role, joinStatus, statusByRoom,
    usersByRoom, msgsByRoom, metaByRoom, adminByRoom, moduleByRoom, ytStateByRoom,
    moduleState, setModuleState,
    rooms, join, leave, knock,
    devLogin, logout,
    sendChat, renameRoom,
    lockRoom, unlockRoom, joinWithPassword,
    passwordRoomId, passwordError, setPasswordRoomId,
    promote, demote, kick, ban, unban, mute, unmute, admit, deny,
    sendRaw: (msg: object) => {
      try {
        const ws = (wsRef as any)?.current;
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
      } catch {}
    },
  };

  return (
    <WeeredContext.Provider value={value}>
      <VoiceProvider>
        <SystemBroadcast />
        {children}
        <NotorietyToast />
        <RankUpCelebration />
        {/* Password prompt modal */}
        {passwordRoomId && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 99999,
            background: "rgba(0,0,0,.65)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }} onClick={() => setPasswordRoomId("")}>
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: "rgba(18,18,24,.97)", border: "1px solid rgba(88,0,229,.35)",
                borderRadius: 16, padding: "28px 24px", width: 340,
                boxShadow: "0 8px 40px rgba(0,0,0,.5)",
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 900, color: "rgba(243,244,246,.95)", marginBottom: 4 }}>
                🔑 Password Required
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,.45)", marginBottom: 16 }}>
                This room requires a password to enter.
              </div>
              <PasswordPromptInput
                roomId={passwordRoomId}
                error={passwordError}
                onSubmit={(pw: string) => joinWithPassword(passwordRoomId, pw)}
                onCancel={() => setPasswordRoomId("")}
              />
            </div>
          </div>
        )}
      </VoiceProvider>
    </WeeredContext.Provider>
  );
}

export function useWeered(): Ctx {
  const ctx = useContext(WeeredContext);
  if (!ctx) throw new Error("useWeered must be used within WeeredProvider");
  return ctx;
}
