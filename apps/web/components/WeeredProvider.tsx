"use client";

import { useRouter, usePathname } from "next/navigation";
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const API    = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
const WS_URL = process.env.NEXT_PUBLIC_WS_URL   || "ws://127.0.0.1:4001";
const SETTINGS_KEY = "weered:settings:v0";

// ─── Types ────────────────────────────────────────────────────────────────────
type Role       = "owner" | "mod" | "member" | "none";
type RoomUser   = { id: string; name: string; role?: Role };
type ChatMsg    = { id: string; user: RoomUser; body: string; ts: number };
type Knock      = { userId: string; name: string; ts: number };
type JoinStatus = "idle" | "joining" | "joined" | "knocking" | "banned" | "denied";

type AuditItem = {
  id: string; ts: number; type: string;
  actorId: string; actorName: string;
  targetId?: string; targetName?: string; note?: string;
};

type RoomMeta   = { name: string; locked: boolean; ownerId: string; mods: string[] };
type AdminState = { knocks: Knock[]; banned: string[]; audit: AuditItem[] };

type Ctx = {
  apiBase: string; wsUrl: string;
  token: string; me: any; authed: boolean; globalRole: string;
  wsReady: boolean; wsState: number;
  activeRoomId: string; joinedRoomId: string;
  setActiveRoomId: (id: string) => void;
  users: RoomUser[]; msgs: ChatMsg[];
  meta: RoomMeta | null; admin: AdminState | null;
  role: Role; joinStatus: JoinStatus;
  rooms: any[];
  join: (roomId: string) => void;
  knock: (roomId: string) => void;
  devLogin: (username: string) => Promise<void>;
  logout: () => void;
  sendChat: (body: string) => void;
  renameRoom: (name: string) => void;
  lockRoom: () => void; unlockRoom: () => void;
  promote: (userId: string) => void; demote: (userId: string) => void;
  kick: (userId: string) => void; ban: (userId: string) => void;
  unban: (userId: string) => void;
  admit: (userId: string) => void; deny: (userId: string) => void;
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

  // ── Room state ──
  const [activeRoomId,  setActiveRoomId ] = useState("");
  const [joinedRoomId,  setJoinedRoomId ] = useState("");
  const [usersByRoom,   setUsersByRoom  ] = useState<Record<string, RoomUser[]>>({});
  const [msgsByRoom,    setMsgsByRoom   ] = useState<Record<string, ChatMsg[]>>({});
  const [metaByRoom,    setMetaByRoom   ] = useState<Record<string, RoomMeta>>({});
  const [adminByRoom,   setAdminByRoom  ] = useState<Record<string, AdminState>>({});
  const [statusByRoom,  setStatusByRoom ] = useState<Record<string, JoinStatus>>({});
  const [rooms,         setRooms        ] = useState<any[]>([]);

  // ── Derived ──
  const authed     = useMemo(() => Boolean(token), [token]);
  const meta       = activeRoomId ? (metaByRoom[activeRoomId]   || null)    : null;
  const admin      = activeRoomId ? (adminByRoom[activeRoomId]  || null)    : null;
  const users      = activeRoomId ? (usersByRoom[activeRoomId]  || [])      : [];
  const msgs       = activeRoomId ? (msgsByRoom[activeRoomId]   || [])      : [];
  const joinStatus = activeRoomId ? (statusByRoom[activeRoomId] || "idle")  : "idle";

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

  // ── Auto-set default roomId from path ──
  useEffect(() => {
    try {
      if (!pathname) return;
      if (pathname.startsWith("/lobby")    && !activeRoomId) setActiveRoomId("lobby");
      if (pathname.startsWith("/room/@me") && !activeRoomId) setActiveRoomId("@me");
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // ── WebSocket lifecycle ──
  useEffect(() => {
    if (!token) return;

    // Re-auth on token change if WS already open
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      if (token !== lastAuthTokenRef.current) {
        lastAuthTokenRef.current = token;
        try { wsRef.current.send(JSON.stringify({ type: "auth:hello", token })); } catch {}
      }
      return;
    }
    if (wsRef.current?.readyState === WebSocket.CONNECTING) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsState(ws.readyState);
      const tok = (() => { try { return localStorage.getItem("weered_token") || token; } catch { return token; } })();
      lastAuthTokenRef.current = tok;
      ws.send(JSON.stringify({ type: "auth:hello", token: tok }));
    };

    ws.onclose = () => { setWsState(WebSocket.CLOSED); setWsReady(false); };
    ws.onerror = () => { setWsState(ws.readyState); };

    ws.onmessage = (ev) => {
      let msg: any = null;
      try { msg = JSON.parse(String(ev.data || "")); } catch { return; }
      msg = normalizeInbound(msg);
      if (!msg || typeof msg.type !== "string") return;

      // Generic rooms list payload
      if (Array.isArray(msg.rooms)) setRooms(msg.rooms);

      if (msg.type === "auth:ok") {
        setWsReady(true);
        setWsState(WebSocket.OPEN);
        // Grab user from server payload
        const u = msg.user ?? msg.payload?.user ?? null;
        if (u) { setMe(u); try { localStorage.setItem("weered_user", JSON.stringify(u)); } catch {} }
        else { try { const raw = localStorage.getItem("weered_user"); if (raw) setMe(JSON.parse(raw)); } catch {} }
        // Join pending room
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
          [rid]: { name: String(msg.name || rid), locked: Boolean(msg.locked), ownerId: String(msg.ownerId || ""), mods: Array.isArray(msg.mods) ? msg.mods.map(String) : [] },
        }));
        setStatusByRoom(prev => ({ ...prev, [rid]: "joined" }));
        if (rid && !activeRoomId) setActiveRoomId(rid);
        setJoinedRoomId(prev => {
          if (prev && prev !== rid) {
            try { ws.send(JSON.stringify({ type: "presence:leave", roomId: prev })); } catch {}
          }
          return rid;
        });
        return;
      }

      // Incremental presence — another user joined this room
      if (msg.type === "presence:join") {
        const rid  = String(msg.roomId || "");
        const user = msg.user as RoomUser | null;
        if (!rid || !user?.id) return;
        setUsersByRoom(prev => {
          const cur = prev[rid] || [];
          if (cur.find(u => u.id === user.id)) return prev; // already listed
          return { ...prev, [rid]: [...cur, user] };
        });
        return;
      }

      // Incremental presence — another user left this room
      if (msg.type === "presence:leave") {
        const rid    = String(msg.roomId || "");
        const userId = String(msg.userId || "");
        if (!rid || !userId) return;
        setUsersByRoom(prev => {
          const cur = prev[rid];
          if (!cur) return prev;
          return { ...prev, [rid]: cur.filter(u => u.id !== userId) };
        });
        return;
      }

      if (msg.type === "room:adminState") {
        const rid = String(msg.roomId || "");
        setAdminByRoom(prev => ({
          ...prev,
          [rid]: { knocks: Array.isArray(msg.knocks) ? msg.knocks : [], banned: Array.isArray(msg.banned) ? msg.banned.map(String) : [], audit: Array.isArray(msg.audit) ? msg.audit : [] },
        }));
        setMetaByRoom(prev => ({
          ...prev,
          [rid]: { name: String(msg.name || rid), locked: Boolean(msg.locked), ownerId: String(msg.ownerId || ""), mods: Array.isArray(msg.mods) ? msg.mods.map(String) : [] },
        }));
        return;
      }

      if (msg.type === "room:audit") {
        const rid  = String(msg.roomId || "");
        const item = msg.item as AuditItem;
        if (!item?.id) return;
        setAdminByRoom(prev => {
          const cur = prev[rid] || { knocks: [], banned: [], audit: [] };
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
        return;
      }


      if (msg.type === "room:locked") {
        const rid = String(msg.roomId || "");
        setMetaByRoom(prev => prev[rid] ? { ...prev, [rid]: { ...prev[rid], locked: true } } : prev);
        return;
      }

      if (msg.type === "room:unlocked") {
        const rid = String(msg.roomId || "");
        setMetaByRoom(prev => prev[rid] ? { ...prev, [rid]: { ...prev[rid], locked: false } } : prev);
        return;
      }

      if (msg.type === "chat:cleared") {
        const rid = String(msg.roomId || "");
        setMsgsByRoom(prev => ({ ...prev, [rid]: [] }));
        return;
      }

      if (msg.type === "room:knock:queued") { setStatusByRoom(prev => ({ ...prev, [String(msg.roomId || "")]: "knocking" })); return; }
      if (msg.type === "room:banned")       { setStatusByRoom(prev => ({ ...prev, [String(msg.roomId || "")]: "banned"   })); return; }
      if (msg.type === "room:denied")       { setStatusByRoom(prev => ({ ...prev, [String(msg.roomId || "")]: "denied"   })); return; }
    };

    return () => { try { ws.close(); } catch {} wsRef.current = null; };
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

  // ── Re-join + room list after auth ──
  useEffect(() => {
    if (!wsReady) return;
    lastJoinedRidRef.current = "";
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    sendJoin(ws);
    requestRoomsList(ws);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsReady, activeRoomId, joinedRoomId]);

  // ─── Internal helpers ─────────────────────────────────────────────────────
  function sendJoin(ws: WebSocket) {
    const ridRaw = joinedRoomId || activeRoomId;
    if (!ridRaw) return;
    let rid = ridRaw;
    try { rid = decodeURIComponent(ridRaw); } catch {}
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
    setStatusByRoom({});
    setActiveRoomId(""); setJoinedRoomId("");
    try { wsRef.current?.close(); } catch {}
    wsRef.current = null;
  }

  function join(roomId: string) {
    const id = roomId.trim();
    if (!id) return;
    setActiveRoomId(id);
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      let rid = id; try { rid = decodeURIComponent(id); } catch {}
      try { ws.send(JSON.stringify({ type: "presence:join",  roomId: rid })); } catch {}
      try { ws.send(JSON.stringify({ type: "chat:history",   roomId: rid, limit: 50 })); } catch {}
    }
  }

  function knock(roomId: string) {
    const id = roomId.trim();
    if (!id) return;
    setActiveRoomId(id);
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      let rid = id; try { rid = decodeURIComponent(id); } catch {}
      try { ws.send(JSON.stringify({ type: "room:knock", roomId: rid })); } catch {}
    }
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
    if (!ws || ws.readyState !== WebSocket.OPEN || !activeRoomId) return;
    ws.send(JSON.stringify({ type, roomId: activeRoomId, ...payload }));
  }

  const renameRoom = (name: string)   => sendAdmin("room:rename",  { name });
  const lockRoom   = ()               => sendAdmin("room:lock");
  const unlockRoom = ()               => sendAdmin("room:unlock");
  const promote    = (userId: string) => sendAdmin("mod:promote",  { userId });
  const demote     = (userId: string) => sendAdmin("mod:demote",   { userId });
  const kick       = (userId: string) => sendAdmin("mod:kick",     { userId });
  const ban        = (userId: string) => sendAdmin("mod:ban",      { userId });
  const unban      = (userId: string) => sendAdmin("mod:unban",    { userId });
  const admit      = (userId: string) => sendAdmin("room:admit",   { userId });
  const deny       = (userId: string) => sendAdmin("room:deny",    { userId });

  const value: Ctx = {
    apiBase: API, wsUrl: WS_URL,
    token, me, authed, globalRole,
    wsReady, wsState,
    activeRoomId, joinedRoomId, setActiveRoomId,
    users, msgs, meta, admin, role, joinStatus,
    usersByRoom,
    rooms, join, knock,
    devLogin, logout,
    sendChat, renameRoom,
    lockRoom, unlockRoom,
    promote, demote, kick, ban, unban, admit, deny,
  };

  return <WeeredContext.Provider value={value}>{children}</WeeredContext.Provider>;
}

export function useWeered(): Ctx {
  const ctx = useContext(WeeredContext);
  if (!ctx) throw new Error("useWeered must be used within WeeredProvider");
  return ctx;
}
