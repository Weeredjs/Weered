"use client";

import { useRouter } from "next/navigation";
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://127.0.0.1:4001";

type Role = "owner" | "mod" | "member" | "none";
type RoomUser = { id: string; name: string; role?: Role };
type ChatMsg = { id: string; user: RoomUser; body: string; ts: number };
type Knock = { userId: string; name: string; ts: number };

type AuditItem = {
  id: string;
  ts: number;
  type: string;
  actorId: string;
  actorName: string;
  targetId?: string;
  targetName?: string;
  note?: string;
};

type RoomMeta = {
  name: string;
  locked: boolean;
  ownerId: string;
  mods: string[];
};

type AdminState = {
  knocks: Knock[];
  banned: string[];
  audit: AuditItem[];
};

type JoinStatus = "idle" | "joining" | "joined" | "knocking" | "banned" | "denied";

type Ctx = {
  apiBase: string;
  wsUrl: string;

  token: string;
  me: any;
  authed: boolean;

  wsReady: boolean;
  wsState: number;

  activeRoomId: string;
  joinedRoomId: string;
  setActiveRoomId: (id: string) => void;

  users: RoomUser[];
  msgs: ChatMsg[];
  meta: RoomMeta | null;
  admin: AdminState | null;
  role: Role;
  joinStatus: JoinStatus;

  devLogin: (username: string) => Promise<void>;
  logout: () => void;

  sendChat: (body: string) => void;

  renameRoom: (name: string) => void;

  lockRoom: () => void;
  unlockRoom: () => void;
  promote: (userId: string) => void;
  demote: (userId: string) => void;
  kick: (userId: string) => void;
  ban: (userId: string) => void;
  unban: (userId: string) => void;
  admit: (userId: string) => void;
  deny: (userId: string) => void;
};

const WeeredContext = createContext<Ctx | null>(null);

function normalizeInbound(msg: any) {
  if (msg && typeof msg === "object" && msg.payload && typeof msg.payload === "object") {
    return { ...msg, ...msg.payload };
  }
  return msg;
}

export function WeeredProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [me, setMe] = useState<any>(null);

  const [wsState, setWsState] = useState<number>(WebSocket.CLOSED);
  const [wsReady, setWsReady] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const lastJoinedRidRef = useRef<string>("");

  function sendJoinDefaultRoom() {
    
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    // Default room used by current UI
    const ridRaw = joinedRoomId || activeRoomId;
    if (!ridRaw) return;
    let rid = ridRaw;
    try { rid = decodeURIComponent(ridRaw); } catch {}

    // Avoid spamming: only join when rid changes
    if (lastJoinedRidRef.current === rid) return;
    lastJoinedRidRef.current = rid;
    try {
      console.log("[weered] sending presence:join", rid, "wsReady=", wsReady, "me=", me?.name || me);
ws.send(JSON.stringify({ type: "presence:join", roomId: rid }));
      try { ws.send(JSON.stringify({ type: "chat:history", roomId: rid, limit: 50 })); } catch {}
      /* joinedOnceRef removed */
    } catch {}
  }

  
  const lastAuthTokenRef = useRef<string>("");
const [activeRoomId, setActiveRoomId] = useState<string>("");
  const [joinedRoomId, setJoinedRoomId] = useState<string>("");

  const [usersByRoom, setUsersByRoom] = useState<Record<string, RoomUser[]>>({});
  const [msgsByRoom, setMsgsByRoom] = useState<Record<string, ChatMsg[]>>({});
  const [metaByRoom, setMetaByRoom] = useState<Record<string, RoomMeta>>({});
  const [adminByRoom, setAdminByRoom] = useState<Record<string, AdminState>>({});
  const [statusByRoom, setStatusByRoom] = useState<Record<string, JoinStatus>>({});

  const authed = useMemo(() => Boolean(token), [token]);

  const meta = activeRoomId ? (metaByRoom[activeRoomId] || null) : null;
  const admin = activeRoomId ? (adminByRoom[activeRoomId] || null) : null;
  const users = activeRoomId ? (usersByRoom[activeRoomId] || []) : [];
  const msgs = activeRoomId ? (msgsByRoom[activeRoomId] || []) : [];
  const joinStatus: JoinStatus = activeRoomId ? (statusByRoom[activeRoomId] || "idle") : "idle";

  const role: Role = useMemo(() => {
    if (!meta || !me?.id) return "none";
    if (meta.ownerId && meta.ownerId === me.id) return "owner";
    if (Array.isArray(meta.mods) && meta.mods.includes(me.id)) return "mod";
    return "member";
  }, [meta, me]);

    async function devLogin(username: string) {
    const r = await fetch(`${API}/auth/dev-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    const j = await r.json();
    if (j?.token) {
      // Force WS to reconnect using the new token (avoid refresh)
      try { wsRef.current?.close(); } catch {}
      wsRef.current = null;
      setWsReady(false);
      setWsState(WebSocket.CLOSED);

      setToken(j.token);
      setMe(j.user || null);
      try { localStorage.setItem("weered_token", j.token); } catch {}
      try { localStorage.setItem("weered_user", JSON.stringify(j.user || null)); } catch {}
    }
  }

  function logout() {
    try {
      localStorage.removeItem("weered_token");
      localStorage.removeItem("weered_user");
    try { router.replace("/"); } catch {}
    } catch {}
    setToken("");
    setMe(null);
    setUsersByRoom({});
    setMsgsByRoom({});
    setMetaByRoom({});
    setAdminByRoom({});
    setStatusByRoom({});
    setActiveRoomId("");
    /* keep joinedRoomId on ws close */
    try { wsRef.current?.close(); } catch {}
    wsRef.current = null;
  }
  // Load persisted auth on boot so WS can come up without clicking Login every refresh
  useEffect(() => {
    try {
      const tok = localStorage.getItem("weered_token") || "";
      const uRaw = localStorage.getItem("weered_user") || "";
      if (tok) setToken(tok);
      if (uRaw) {
        try { setMe(JSON.parse(uRaw)); } catch {}
      }
    } catch {}
  }, []);  // Re-join presence when activeRoomId changes (only after WS is ready)
  useEffect(() => {
    if (!wsReady) return;
    lastJoinedRidRef.current = "";
    sendJoinDefaultRoom();
  }, [wsReady, activeRoomId, joinedRoomId]);

  useEffect(() => {
    if (!token) return;

        // Re-auth on token change if WS is already open
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      if (token && token !== lastAuthTokenRef.current) {
        try {
          lastAuthTokenRef.current = token;
          wsRef.current.send(JSON.stringify({ type: "auth:hello", token }));
        } catch {}
      }
      return;
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING) return;

    const ws = new WebSocket(WS_URL);

    // --- debug: raw inbound logging (temporary) ---
    ws.addEventListener("open", () => console.log("[weered] ws open", WS_URL));
    ws.addEventListener("close", (e) => console.log("[weered] ws close", e.code, e.reason));
    ws.addEventListener("error", (e) => console.log("[weered] ws error", e));

    ws.addEventListener("message", (ev: MessageEvent) => {
      try {
        const raw = typeof ev.data === "string" ? ev.data : "";
        console.log("[weered] ws raw", raw.slice(0, 500));
        const parsed = raw ? JSON.parse(raw) : null;
        const msg = normalizeInbound(parsed);
        console.log("[weered] ws in", msg?.type, msg);
      } catch (err) {
        console.log("[weered] ws in parse error", err);
      }
    });
    // --- /debug ---
    wsRef.current = ws;

    ws.onopen = () => {
      setWsState(ws.readyState);
      
      const tok = (() => { try { return localStorage.getItem("weered_token") || token; } catch { return token; } })();
      lastAuthTokenRef.current = tok || "";
      ws.send(JSON.stringify({ type: "auth:hello", token: tok }));
};

    ws.onclose = () => {
      setWsState(WebSocket.CLOSED);
      setWsReady(false);
      /* keep joinedRoomId on ws close */
    };

    ws.onerror = () => {
      setWsState(ws.readyState);
    };

    ws.onmessage = (ev) => {
      let msg: any = null;
      try { msg = JSON.parse(String(ev.data || "")); } catch { return; }
      msg = normalizeInbound(msg);
      if (!msg || typeof msg.type !== "string") return;

      if (msg.type === "auth:ok") {
        setWsReady(true);
        setWsState(WebSocket.OPEN);

        
        sendJoinDefaultRoom();
// Prefer user from server payload; fallback to persisted dev-login user
        const u = (msg.user ?? msg.payload?.user) || null;
        if (u) {
          setMe(u);
          try { localStorage.setItem("weered_user", JSON.stringify(u)); } catch {}
        } else {
          try {
            const uRaw = localStorage.getItem("weered_user") || "";
            if (uRaw) setMe(JSON.parse(uRaw));
          } catch {}
        }
        return;
      }

      
      if (msg.type === "auth:fail") {
        setWsReady(false);
        setWsState(WebSocket.OPEN);
        console.warn("WS auth:fail", msg.reason || msg);
        return;
      }
if (msg.type === "presence:state") {
        const rid = String(msg.roomId || "");
        
        
      
      // Consider presence:state membership as "joined" (prevents UI stuck in disabled state)
      try {
        const meId = String(me?.id || "");
        const list = Array.isArray((msg as any).users) ? (msg as any).users : [];
        const inRoom = !!meId && list.some((u: any) => String(u?.id || "") === meId);
        if (inRoom && rid) {
          setJoinedRoomId(rid);
          setJoinStatus("joined");
        }
      } catch {}// Treat presence:state membership as "joined" for that room
      try {
        const viewRid = String(activeRoomId || "");
        const meId = String(me?.id || "");
        const list = Array.isArray((msg as any).users) ? (msg as any).users : [];
        const inRoom = !!meId && list.some((u: any) => String(u?.id || "") === meId);
        if (inRoom && rid && viewRid && rid === viewRid) {
          setJoinedRoomId(rid);
          setJoinStatus("joined");
        }
      } catch {}// Ensure UI room id matches server presence room
        if (rid && !activeRoomId) setActiveRoomId(rid);
const list = Array.isArray(msg.users) ? msg.users : [];
        setUsersByRoom((prev) => ({ ...prev, [rid]: list }));

        const nextMeta: RoomMeta = {
          name: String(msg.name || rid || ""),
          locked: Boolean(msg.locked),
          ownerId: String(msg.ownerId || ""),
          mods: Array.isArray(msg.mods) ? msg.mods.map(String) : [],
        };
        setMetaByRoom((prev) => ({ ...prev, [rid]: nextMeta }));
        setStatusByRoom((prev) => ({ ...prev, [rid]: "joined" }));

        if (rid && rid === activeRoomId) {
          setJoinedRoomId((prevJoined) => {
            const old = prevJoined;
            if (old && old !== rid) {
              try { ws.send(JSON.stringify({ type: "presence:leave", roomId: old })); } catch {}
            }
            return rid;
          });
        }
        return;
      }

      if (msg.type === "room:adminState") {
        const rid = String(msg.roomId || "");
        const st: AdminState = {
          knocks: Array.isArray(msg.knocks) ? msg.knocks : [],
          banned: Array.isArray(msg.banned) ? msg.banned.map(String) : [],
          audit: Array.isArray(msg.audit) ? msg.audit : [],
        };
        setAdminByRoom((prev) => ({ ...prev, [rid]: st }));

        const nextMeta: RoomMeta = {
          name: String(msg.name || rid || ""),
          locked: Boolean(msg.locked),
          ownerId: String(msg.ownerId || ""),
          mods: Array.isArray(msg.mods) ? msg.mods.map(String) : [],
        };
        setMetaByRoom((prev) => ({ ...prev, [rid]: nextMeta }));
        return;
      }

      if (msg.type === "room:audit") {
        const rid = String(msg.roomId || "");
        const item = msg.item as AuditItem;
        if (!item || !item.id) return;
        setAdminByRoom((prev) => {
          const cur = prev[rid] || { knocks: [], banned: [], audit: [] };
          const nextAudit = [...(cur.audit || []), item].slice(-80);
          return {
          ...prev, [rid]: { ...cur, audit: nextAudit } };
        });
        return;
      }

      // NEW: history dump on join (persistence)
      if (msg.type === "chat:history") {
        const rid = String(msg.roomId || "");
        const list = Array.isArray(msg.msgs) ? (msg.msgs as ChatMsg[]) : [];
        setMsgsByRoom((prev) => ({ ...prev, [rid]: list.slice(-200) }));
        return;
      }

      if (msg.type === "chat:new") {
        const rid = String(msg.roomId || "");
        const m = msg.msg as ChatMsg;
        if (!m || !m.id) return;
        setMsgsByRoom((prev) => {
          const cur = Array.isArray(prev[rid]) ? prev[rid] : [];
          const next = [...cur, m].slice(-200);
          return {
          ...prev, [rid]: next };
        });
        return;
      }

      if (msg.type === "room:knock:queued") {
        const rid = String(msg.roomId || "");
        setStatusByRoom((prev) => ({ ...prev, [rid]: "knocking" }));
        return;
      }

      if (msg.type === "room:banned") {
        const rid = String(msg.roomId || "");
        setStatusByRoom((prev) => ({ ...prev, [rid]: "banned" }));
        return;
      }

      if (msg.type === "room:denied") {
        const rid = String(msg.roomId || "");
        setStatusByRoom((prev) => ({ ...prev, [rid]: "denied" }));
        return;
      }
    };

    return () => {
      try { ws.close(); } catch {}
      wsRef.current = null;
    };
  }, [token]);

useEffect(() => {
    if (!wsReady) return;
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const next = (activeRoomId || "").trim();
    if (!next) return;

    setStatusByRoom((prev) => ({ ...prev, [next]: "joining" }));
    try { ws.send(JSON.stringify({ type: "presence:join", roomId: next })); } catch {}
  }, [activeRoomId, wsReady]);

  function canChatInActive() {
    return Boolean(activeRoomId && joinedRoomId && activeRoomId === joinedRoomId && (statusByRoom[activeRoomId] || "idle") === "joined");
  }

  function sendChat(body: string) {
    const b = (body || "").trim();
    if (!b) return;
    if (!canChatInActive()) return;

    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    let rid = activeRoomId;
    try { rid = decodeURIComponent(activeRoomId); } catch {}
    ws.send(JSON.stringify({ type: "chat:send", roomId: rid, body: b }));
  }

  function sendAdmin(type: string, payload: any = {}) {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const roomId = activeRoomId;
    if (!roomId) return;
    ws.send(JSON.stringify({ type, roomId, ...payload }));
  }

  const renameRoom = (name: string) => sendAdmin("room:rename", { name });

  const lockRoom = () => sendAdmin("room:lock");
  const unlockRoom = () => sendAdmin("room:unlock");
  const promote = (userId: string) => sendAdmin("mod:promote", { userId });
  const demote = (userId: string) => sendAdmin("mod:demote", { userId });
  const kick = (userId: string) => sendAdmin("mod:kick", { userId });
  const ban = (userId: string) => sendAdmin("mod:ban", { userId });
  const unban = (userId: string) => sendAdmin("mod:unban", { userId });
  const admit = (userId: string) => sendAdmin("room:admit", { userId });
  const deny = (userId: string) => sendAdmin("room:deny", { userId });

  const value: Ctx = {
    apiBase: API,
    wsUrl: WS_URL,

    token,
    me,
    authed,

    wsReady,
    wsState,

    activeRoomId,
    joinedRoomId,
    setActiveRoomId,

    users,
    msgs,
    meta,
    admin,
    role,
    joinStatus,

    devLogin,
    logout,

    sendChat,

    renameRoom,

    lockRoom,
    unlockRoom,
    promote,
    demote,
    kick,
    ban,
    unban,
    admit,
    deny,
  };

  return <WeeredContext.Provider value={value}>{children}</WeeredContext.Provider>;
}

export function useWeered() {
  const ctx = useContext(WeeredContext);
  if (!ctx) throw new Error("useWeered must be used within WeeredProvider");
  return ctx;
}
























