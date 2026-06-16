"use client";

import { useRouter, usePathname } from "next/navigation";
import { VoiceProvider } from "./VoiceContext";
import NotorietyToast from "./NotorietyToast";
import RankUpCelebration from "./RankUpCelebration";
import SystemBroadcast from "./SystemBroadcast";
import { weeredToast } from "../lib/toast";
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

const API    = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
const WS_URL = process.env.NEXT_PUBLIC_WS_URL   || "ws://127.0.0.1:4001";
const SETTINGS_KEY = "weered:settings:v0";

type Role       = "owner" | "mod" | "member" | "none";
type RoomUser   = { id: string; name: string; role?: Role; globalRole?: string; avatarColor?: string };
type ChatMsg    = { id: string; user: RoomUser; body: string; ts: number; kind?: "trade" | "dice" | "system" | "poker" | "poker-winner"; meta?: any };
type Knock      = { userId: string; name: string; ts: number };
type JoinStatus = "idle" | "joining" | "joined" | "knocking" | "banned" | "denied";

type AuditItem = {
  id: string; ts: number; type: string;
  actorId: string; actorName: string;
  targetId?: string; targetName?: string; note?: string;
};

type RoomMeta   = { name: string; locked: boolean; chatDisabled: boolean; thumbnail?: string; ownerId: string; mods: string[]; description?: string; iconUrl?: string; bannerUrl?: string; accentColor?: string; disabledModules?: string[] };
type AdminState = { knocks: Knock[]; banned: string[]; muted: string[]; audit: AuditItem[] };
type ModuleState = { mode: string; url?: string; channel?: string; setBy?: string; setAt?: number } | null;

export type LaunchTarget = {
  appid: number;
  connect: string;
  display: string;
  note?: string;
  setBy: string;
  setAt: number;
};
export type LaunchSnapshot = {
  target: LaunchTarget | null;
  slots: { userId: string; slot: "player" | "observer" }[];
  ready: string[];
  firedAt: number | null;
  firedBy: string | null;
};

export type Ctx = {
  apiBase: string; wsUrl: string;
  token: string; me: any; authed: boolean; globalRole: string;
  wsReady: boolean; wsState: number;
  activeRoomId: string; joinedRoomId: string; currentLobbyId: string;
  setActiveRoomId: (id: string) => void;
  metaByRoom: Record<string, RoomMeta>;
  adminByRoom: Record<string, AdminState>;
  moduleByRoom: Record<string, ModuleState>;
  ytStateByRoom: Record<string, { videoId: string; playing: boolean; position: number; updatedAt: number }>;
  launchByRoom: Record<string, LaunchSnapshot | null>;
  voiceByRoom: Record<string, { mode: "OPEN" | "QUEUED" | "LISTEN_ONLY"; queue: string[]; speakers: string[] }>;
  pinnedByRoom: Record<string, string[]>;
  meta: RoomMeta | null; admin: AdminState | null;
  moduleState: ModuleState;
  role: Role; joinStatus: JoinStatus; statusByRoom: Record<string, JoinStatus>;
  rooms: any[];
  join: (roomId: string) => void;
  leave: () => void;
  knock: (roomId: string) => void;
  devLogin: (username: string) => Promise<void>;
  logout: () => void;
  sendChat: (body: string, opts?: { replyToId?: string; attachmentId?: string }) => void;
  renameRoom: (name: string) => void;
  setModuleState: (mode: string | null, opts?: { url?: string; channel?: string }) => void;
  setVoiceMode: (mode: "OPEN" | "QUEUED" | "LISTEN_ONLY") => void;
  raiseHand: () => void;
  lowerHand: () => void;
  approveSpeaker: (userId: string) => void;
  revokeSpeaker: (userId: string) => void;
  lockRoom: () => void; unlockRoom: () => void;
  joinWithPassword: (roomId: string, password: string) => void;
  passwordRoomId: string; passwordError: string;
  setPasswordRoomId: (id: string) => void;
  promote: (userId: string) => void; demote: (userId: string) => void;
  kick: (userId: string) => void; ban: (userId: string) => void;
  unban: (userId: string) => void; mute: (userId: string) => void; unmute: (userId: string) => void;
  admit: (userId: string) => void; deny: (userId: string) => void;
  sendRaw: (msg: object) => void;
  isAway: boolean;
  setAway: (away: boolean) => void;
};

function normalizeInbound(msg: any) {
  if (msg?.payload && typeof msg.payload === "object") return { ...msg, ...msg.payload };
  return msg;
}

function applySettingsToDom(s: any) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-weered-theme", String(s?.theme || "press"));
  root.setAttribute("data-weered-density",      String(s?.density      ?? "comfortable"));
  root.setAttribute("data-weered-reduce-motion", s?.reduceMotion ? "1" : "0");
}

function readSettings(): any {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(SETTINGS_KEY) : null;
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// ── Hot-path store (presence / chat / typing) ────────────────────────────────
// These maps change on every message, keystroke and presence tick. They live
// outside React context so an update only re-renders components subscribed
// through the useRoom* hooks — not every useWeered() consumer.
type HotMaps = {
  usersByRoom: Record<string, RoomUser[]>;
  msgsByRoom: Record<string, ChatMsg[]>;
  typingByRoom: Record<string, { userId: string; name: string; ts: number }[]>;
};
const EMPTY_USERS: RoomUser[] = [];
const EMPTY_MSGS: ChatMsg[] = [];
const EMPTY_TYPING: { userId: string; name: string; ts: number }[] = [];
const hotStore = {
  state: { usersByRoom: {}, msgsByRoom: {}, typingByRoom: {} } as HotMaps,
  subs: new Set<() => void>(),
  set<K extends keyof HotMaps>(key: K, updater: React.SetStateAction<HotMaps[K]>) {
    const prev = hotStore.state[key];
    const next = typeof updater === "function" ? (updater as (p: HotMaps[K]) => HotMaps[K])(prev) : updater;
    if (next === prev) return;
    hotStore.state = { ...hotStore.state, [key]: next };
    hotStore.subs.forEach((fn) => { try { fn(); } catch {} });
  },
  subscribe(fn: () => void) { hotStore.subs.add(fn); return () => { hotStore.subs.delete(fn); }; },
};
export function useRoomUsers(roomId?: string): RoomUser[] {
  return React.useSyncExternalStore(
    hotStore.subscribe,
    () => (roomId ? hotStore.state.usersByRoom[roomId] || EMPTY_USERS : EMPTY_USERS),
    () => EMPTY_USERS,
  );
}
export function useUsersByRoom(): Record<string, RoomUser[]> {
  return React.useSyncExternalStore(hotStore.subscribe, () => hotStore.state.usersByRoom, () => hotStore.state.usersByRoom);
}
export function useRoomMsgs(roomId?: string): ChatMsg[] {
  return React.useSyncExternalStore(
    hotStore.subscribe,
    () => (roomId ? hotStore.state.msgsByRoom[roomId] || EMPTY_MSGS : EMPTY_MSGS),
    () => EMPTY_MSGS,
  );
}
export function useRoomTyping(roomId?: string): { userId: string; name: string; ts: number }[] {
  return React.useSyncExternalStore(
    hotStore.subscribe,
    () => (roomId ? hotStore.state.typingByRoom[roomId] || EMPTY_TYPING : EMPTY_TYPING),
    () => EMPTY_TYPING,
  );
}

const WeeredContext = createContext<Ctx | null>(null);

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

  const [token, setToken] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try { return localStorage.getItem("weered_user") ? "authed" : ""; } catch { return ""; }
  });
  const [me,    setMe   ] = useState<any>(() => {
    if (typeof window === "undefined") return null;
    try { const u = localStorage.getItem("weered_user"); return u ? JSON.parse(u) : null; } catch { return null; }
  });
  const [globalRole, setGlobalRole] = useState("");

  const [wsState, setWsState] = useState<number>(WebSocket.CLOSED);
  const [wsReady, setWsReady] = useState(false);
  const wsRef            = useRef<WebSocket | null>(null);
  const lastAuthTokenRef = useRef("");
  const lastJoinedRidRef = useRef("");
  const activeRoomIdRef  = useRef("");

  const [activeRoomId,  setActiveRoomId ] = useState("");
  const [joinedRoomId,  setJoinedRoomId ] = useState("");
  const [currentLobbyId, setCurrentLobbyId] = useState("");
  const setUsersByRoom: React.Dispatch<React.SetStateAction<Record<string, RoomUser[]>>> = (u) => hotStore.set("usersByRoom", u);
  const setMsgsByRoom:  React.Dispatch<React.SetStateAction<Record<string, ChatMsg[]>>>  = (u) => hotStore.set("msgsByRoom", u);
  const [metaByRoom,    setMetaByRoom   ] = useState<Record<string, RoomMeta>>({});
  const [adminByRoom,   setAdminByRoom  ] = useState<Record<string, AdminState>>({});
  const [statusByRoom,  setStatusByRoom ] = useState<Record<string, JoinStatus>>({});
  const [moduleByRoom,  setModuleByRoom ] = useState<Record<string, ModuleState>>({});
  const [ytStateByRoom, setYtStateByRoom] = useState<Record<string, { videoId: string; playing: boolean; position: number; updatedAt: number }>>({});
  const [launchByRoom,  setLaunchByRoom ] = useState<Record<string, LaunchSnapshot | null>>({});
  const [voiceByRoom,   setVoiceByRoom  ] = useState<Record<string, { mode: "OPEN" | "QUEUED" | "LISTEN_ONLY"; queue: string[]; speakers: string[] }>>({});
  const setTypingByRoom: React.Dispatch<React.SetStateAction<Record<string, { userId: string; name: string; ts: number }[]>>> = (u) => hotStore.set("typingByRoom", u);
  const [pinnedByRoom,  setPinnedByRoom ] = useState<Record<string, string[]>>({});
  const [rooms,         setRooms        ] = useState<any[]>([]);
  const [passwordRoomId, setPasswordRoomId] = useState("");
  const [passwordError,  setPasswordError ] = useState("");

  const authed     = useMemo(() => Boolean(token), [token]);
  const meta       = activeRoomId ? (metaByRoom[activeRoomId]   || null)    : null;
  const admin      = activeRoomId ? (adminByRoom[activeRoomId]  || null)    : null;
  const joinStatus = activeRoomId ? (statusByRoom[activeRoomId] || "idle")  : "idle";
  const moduleState: ModuleState = activeRoomId ? (moduleByRoom[activeRoomId] ?? null) : null;

  const role: Role = useMemo(() => {
    if (!meta || !me?.id) return "none";
    if (meta.ownerId === me.id) return "owner";
    if (Array.isArray(meta.mods) && meta.mods.includes(me.id)) return "mod";
    return "member";
  }, [meta, me]);

  useEffect(() => {
    if (!token) { setGlobalRole(""); return; }
    fetch(`${API}/staff/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(j => { if (j?.globalRole) setGlobalRole(j.globalRole); })
      .catch(() => {});
  }, [token]);

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

  useEffect(() => {
    try {
      const uRaw = localStorage.getItem("weered_user")  || "";
      if (uRaw) { setToken("authed"); try { setMe(JSON.parse(uRaw)); } catch {} }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const uRaw = localStorage.getItem("weered_user")  || "";
      if (uRaw && !token) {
        setToken("authed");
        try { setMe(JSON.parse(uRaw)); } catch {}
      }
      if (!uRaw && token) { setToken(""); setMe(null); }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    try {
      if (!pathname) return;
      const roomMatch = pathname.match(/^\/room\/([^/]+)/);
      if (roomMatch) {
        const rid = decodeURIComponent(roomMatch[1]);
        if (rid && rid !== "@me") { activeRoomIdRef.current = rid; setActiveRoomId(rid); return; }
      }
    if (pathname.startsWith("/lobby")) {
      const seg = pathname.replace("/lobby/", "").replace("/lobby", "").trim();
      const staticRoutes = ["create", "admin", "settings"];
      if (seg && staticRoutes.includes(seg.split("/")[0])) return;
      const rid = seg ? decodeURIComponent(seg) : "lobby";
      activeRoomIdRef.current = rid;
      setActiveRoomId(rid);
      if (seg) setCurrentLobbyId(decodeURIComponent(seg));
      return;
    }
    if (pathname === "/home" || pathname.startsWith("/home/")) {
      activeRoomIdRef.current = "lobby";
      setActiveRoomId("lobby");
      return;
    }
    } catch {}
   
  }, [pathname]);

  useEffect(() => {
    if (!token) return;

    const existing = wsRef.current;
    if (existing?.readyState === WebSocket.OPEN) {
      if (token !== lastAuthTokenRef.current) {
        lastAuthTokenRef.current = token;
      }
      return;
    }
    if (existing?.readyState === WebSocket.CONNECTING) return;
    if (existing) { try { existing.close(); } catch {} wsRef.current = null; }

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsState(ws.readyState);
      fetch(`${API}/auth/ws-ticket`).then(r => r.json()).then(j => {
        const tk = j && j.ticket;
        if (tk && wsRef.current === ws && ws.readyState === WebSocket.OPEN) {
          lastAuthTokenRef.current = tk;
          ws.send(JSON.stringify({ type: "auth:hello", token: tk }));
        }
      }).catch(() => {});
    };

    ws.onclose = () => {
      setWsState(WebSocket.CLOSED);
      setWsReady(false);
      if (wsRef.current === ws) wsRef.current = null;
    };
    ws.onerror = () => { setWsState(ws.readyState); };

    ws.onmessage = (ev) => {
      let msg: any = null;
      try { msg = JSON.parse(String(ev.data || "")); } catch { return; }
      msg = normalizeInbound(msg);
      if (!msg || typeof msg.type !== "string") return;
      if (msg.type === "dm:message") {
        try { window.dispatchEvent(new CustomEvent("weered:dm:message", { detail: msg })); } catch {}
        try { window.dispatchEvent(new CustomEvent("weered:unread-tick")); } catch {}
      }
      if (msg.type === "dm:edited") {
        try { window.dispatchEvent(new CustomEvent("weered:dm:edited", { detail: msg })); } catch {}
      }
      if (msg.type === "dm:deleted") {
        try { window.dispatchEvent(new CustomEvent("weered:dm:deleted", { detail: msg })); } catch {}
      }
      if (msg.type === "dm:reaction") {
        try { window.dispatchEvent(new CustomEvent("weered:dm:reaction", { detail: msg })); } catch {}
      }
      if (msg.type === "group:created" || msg.type === "group:message" ||
          msg.type === "group:edited" || msg.type === "group:deleted" ||
          msg.type === "group:renamed" || msg.type === "group:members:added" ||
          msg.type === "group:members:removed") {
        try { window.dispatchEvent(new CustomEvent(`weered:${msg.type}`, { detail: msg })); } catch {}
      }
      if (msg.type === "notification:new") {
        try { window.dispatchEvent(new CustomEvent("weered:notification", { detail: msg.notification })); } catch {}
        try { window.dispatchEvent(new CustomEvent("weered:unread-tick")); } catch {}
      }
      if (msg.type === "crew:message") {
        try { window.dispatchEvent(new CustomEvent("weered:crew:message", { detail: { crewId: msg.crewId, message: msg.message } })); } catch {}
      }
      if (msg.type === "crew:edited") {
        try { window.dispatchEvent(new CustomEvent("weered:crew:edited", { detail: msg })); } catch {}
      }
      if (msg.type === "crew:deleted") {
        try { window.dispatchEvent(new CustomEvent("weered:crew:deleted", { detail: msg })); } catch {}
      }
      if (msg.type === "crew:reaction") {
        try { window.dispatchEvent(new CustomEvent("weered:crew:reaction", { detail: msg })); } catch {}
      }
      if (msg.type === "crew:presence") {
        try { window.dispatchEvent(new CustomEvent("weered:crew:presence", { detail: { userId: msg.userId, name: msg.name, online: msg.online } })); } catch {}
      }
      if (msg.type === "poker:state") {
        try { window.dispatchEvent(new CustomEvent("weered:poker:state", { detail: msg })); } catch {}
      }
      if (
        msg.type === "dnd:initiative" ||
        msg.type === "dnd:roll" ||
        msg.type === "dnd:combatant:damage" ||
        msg.type === "dnd:combatant:select"
      ) {
        try { window.dispatchEvent(new CustomEvent(`weered:${msg.type}`, { detail: msg })); } catch {}
      }
      if (msg.type?.startsWith("map:")) {
        try { window.dispatchEvent(new CustomEvent(`weered:${msg.type}`, { detail: msg })); } catch {}
      }
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
        const myId = String(((): any => { try { return (JSON.parse(localStorage.getItem("weered_user") || "{}") || {}).id || ""; } catch { return ""; } })());
        if (myId) {
          const meEntry = list.find((u: any) => String(u?.id || "") === myId);
          myLivePresenceActiveRef.current = !!(meEntry && meEntry.livePresence && meEntry.livePresence.activity);
        }
        setMetaByRoom(prev => ({
          ...prev,
          [rid]: {
            name: String(msg.name || rid),
            locked: Boolean(msg.locked),
            chatDisabled: Boolean(msg.chatDisabled ?? false),
            thumbnail: msg.thumbnail || undefined,
            ownerId: String(msg.ownerId || ""),
            mods: Array.isArray(msg.mods) ? msg.mods.map(String) : [],
            description: msg.description || undefined,
            iconUrl: msg.iconUrl || undefined,
            bannerUrl: msg.bannerUrl || undefined,
            accentColor: msg.accentColor || undefined,
            disabledModules: Array.isArray(msg.disabledModules) ? msg.disabledModules.map(String) : [],
          },
        }));
        setStatusByRoom(prev => ({ ...prev, [rid]: "joined" }));
        if (msg.activeModule) {
          setModuleByRoom(prev => ({ ...prev, [rid]: msg.activeModule }));
        }
        if (msg.voiceMode || Array.isArray(msg.voiceQueue) || Array.isArray(msg.voiceSpeakers)) {
          setVoiceByRoom(prev => ({
            ...prev,
            [rid]: {
              mode: (msg.voiceMode === "QUEUED" || msg.voiceMode === "LISTEN_ONLY") ? msg.voiceMode : "OPEN",
              queue: Array.isArray(msg.voiceQueue) ? msg.voiceQueue.map(String) : [],
              speakers: Array.isArray(msg.voiceSpeakers) ? msg.voiceSpeakers.map(String) : [],
            },
          }));
        }
        if (msg.launch !== undefined) {
          setLaunchByRoom(prev => ({ ...prev, [rid]: msg.launch as LaunchSnapshot | null }));
        }
        if (Array.isArray(msg.pinned)) {
          setPinnedByRoom(prev => ({ ...prev, [rid]: msg.pinned.map(String) }));
        }
        if (msg.lobbyId) setCurrentLobbyId(String(msg.lobbyId));
        setJoinedRoomId(prev => {
          if (prev && prev !== rid) {
            try { ws.send(JSON.stringify({ type: "presence:leave", roomId: prev })); } catch {}
          }
          return rid;
        });
        return;
      }

      if (msg.type === "chat:pins") {
        const rid = String(msg.roomId || "");
        if (!rid) return;
        const pins = Array.isArray(msg.pinned) ? msg.pinned.map(String) : [];
        setPinnedByRoom(prev => ({ ...prev, [rid]: pins }));
        return;
      }

      if (msg.type === "chat:pin:error") {
        try { weeredToast.error(String((msg as any).reason || "Pin failed.")); } catch {}
        return;
      }

      if (msg.type === "chat:typing") {
        const rid = String(msg.roomId || "");
        const u = msg.user as { id: string; name: string } | undefined;
        if (!rid || !u?.id) return;
        if (me?.id && u.id === me.id) return;
        setTypingByRoom(prev => {
          const cur = prev[rid] ? prev[rid].filter(e => e.userId !== u.id) : [];
          cur.push({ userId: u.id, name: u.name, ts: Date.now() });
          return { ...prev, [rid]: cur };
        });
        return;
      }

      if (msg.type === "launch:state") {
        const rid = String(msg.roomId || "");
        if (!rid) return;
        setLaunchByRoom(prev => ({ ...prev, [rid]: (msg.launch as LaunchSnapshot) ?? null }));
        return;
      }

      if (msg.type === "presence:join") {
        const rid  = String(msg.roomId || "");
        const user = msg.user as RoomUser | null;
        if (!rid || !user?.id) return;
        setUsersByRoom(prev => {
          const cur = prev[rid] || [];
          const idx = cur.findIndex((u: RoomUser) => u.id === user.id);
          if (idx === -1) return { ...prev, [rid]: [...cur, user] };
          const next = cur.slice();
          next[idx] = { ...cur[idx], ...user };
          return { ...prev, [rid]: next };
        });
        return;
      }

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
          [rid]: {
            ...(prev[rid] || {}),
            name: String(msg.name || rid),
            locked: Boolean(msg.locked),
            chatDisabled: Boolean(msg.chatDisabled ?? false),
            thumbnail: msg.thumbnail || undefined,
            ownerId: String(msg.ownerId || ""),
            mods: Array.isArray(msg.mods) ? msg.mods.map(String) : [],
          },
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
        const authorId = (m as any)?.user?.id;
        if (authorId) setTypingByRoom(prev => {
          const cur = prev[rid];
          if (!cur || !cur.some(e => e.userId === authorId)) return prev;
          return { ...prev, [rid]: cur.filter(e => e.userId !== authorId) };
        });
        try { window.dispatchEvent(new CustomEvent("weered:chat:new", { detail: { roomId: rid, msg: m } })); } catch {}
        return;
      }

      if (msg.type === "operator:commentary") {
        const rid = activeRoomIdRef.current || "";
        if (!rid) return;
        const ts = Number(msg.ts || Date.now());
        const opMsg: ChatMsg = {
          id: `op:${ts}:${Math.random().toString(36).slice(2, 8)}`,
          user: { id: "operator", name: "The Operator", avatarColor: "#D4A017" } as any,
          body: String(msg.body || ""),
          ts,
        };
        if (!opMsg.body) return;
        setMsgsByRoom(prev => ({ ...prev, [rid]: [...(prev[rid] || []), opMsg].slice(-200) }));
        try { window.dispatchEvent(new CustomEvent("weered:chat:new", { detail: { roomId: rid, msg: opMsg } })); } catch {}
        return;
      }

      if (msg.type === "trading:trade") {
        const rid = activeRoomIdRef.current || "";
        if (!rid) return;
        const ts = Number(msg.time || Date.now());
        const synthetic: ChatMsg = {
          id: `trade:${String(msg.userId || "?")}:${ts}`,
          user: { id: String(msg.userId || ""), name: String(msg.userName || "trader") },
          body: "",
          ts,
          kind: "trade",
          meta: {
            symbol: String(msg.symbol || ""),
            side: String(msg.side || "").toUpperCase(),
            quantity: Number(msg.quantity || 0),
            price: Number(msg.price || 0),
          },
        };
        setMsgsByRoom(prev => ({ ...prev, [rid]: [...(prev[rid] || []), synthetic].slice(-200) }));
        try { window.dispatchEvent(new CustomEvent("weered:chat:new", { detail: { roomId: rid, msg: synthetic } })); } catch {}
        return;
      }

      if (msg.type === "dice:roll") {
        const rid = activeRoomIdRef.current || "";
        if (!rid) return;
        const ts = Number(msg.time || Date.now());
        const synthetic: ChatMsg = {
          id: `dice:${String(msg.userId || "?")}:${ts}`,
          user: { id: String(msg.userId || ""), name: String(msg.userName || "roller") },
          body: "",
          ts,
          kind: "dice",
          meta: {
            expression: String(msg.expression || ""),
            total: Number(msg.total || 0),
            rolls: Array.isArray(msg.rolls) ? msg.rolls : [],
            kept: Array.isArray(msg.kept) ? msg.kept : [],
            dropped: Array.isArray(msg.dropped) ? msg.dropped : [],
            modifier: Number(msg.modifier || 0),
            sides: Number(msg.sides || 0),
            advantage: !!msg.advantage,
            disadvantage: !!msg.disadvantage,
            isNat20: !!msg.isNat20,
            isNat1: !!msg.isNat1,
          },
        };
        setMsgsByRoom(prev => ({ ...prev, [rid]: [...(prev[rid] || []), synthetic].slice(-200) }));
        try { window.dispatchEvent(new CustomEvent("weered:chat:new", { detail: { roomId: rid, msg: synthetic } })); } catch {}
        return;
      }

      if (msg.type === "poker:action-chip") {
        const rid = activeRoomIdRef.current || "";
        if (!rid) return;
        const ts = Number(msg.time || Date.now());
        const synthetic: ChatMsg = {
          id: "poker:" + String(msg.userId || "?") + ":" + String(ts),
          user: { id: String(msg.userId || ""), name: String(msg.userName || "player") },
          body: "",
          ts,
          kind: "poker",
          meta: {
            action: String(msg.action || ""),
            amount: Number(msg.amount || 0),
            tableId: String(msg.tableId || ""),
          },
        };
        setMsgsByRoom(prev => ({ ...prev, [rid]: [...(prev[rid] || []), synthetic].slice(-200) }));
        try { window.dispatchEvent(new CustomEvent("weered:chat:new", { detail: { roomId: rid, msg: synthetic } })); } catch {}
        return;
      }

      if (msg.type === "poker:winner-chip") {
        const rid = activeRoomIdRef.current || "";
        if (!rid) return;
        const ts = Number(msg.time || Date.now());
        const winnersArr = Array.isArray(msg.winners) ? msg.winners : [];
        const first = winnersArr[0] || {};
        const synthetic: ChatMsg = {
          id: "pokerwin:" + String(first.userId || "pot") + ":" + String(ts),
          user: { id: String(first.userId || ""), name: String(first.userName || "winner") },
          body: "",
          ts,
          kind: "poker-winner",
          meta: {
            winners: winnersArr,
            pot: Number(msg.pot || 0),
            reason: String(msg.reason || "showdown"),
            tableId: String(msg.tableId || ""),
          },
        };
        setMsgsByRoom(prev => ({ ...prev, [rid]: [...(prev[rid] || []), synthetic].slice(-200) }));
        try { window.dispatchEvent(new CustomEvent("weered:chat:new", { detail: { roomId: rid, msg: synthetic } })); } catch {}
        return;
      }

            if (msg.type === "chat:edited") {
        const rid = String(msg.roomId || "");
        const msgId = String(msg.msgId || "");
        const newBody = String(msg.body || "");
        const editedAt = Number(msg.editedAt || Date.now());
        if (!rid || !msgId) return;
        setMsgsByRoom(prev => ({
          ...prev,
          [rid]: (prev[rid] || []).map(m => m.id === msgId ? { ...m, body: newBody, editedAt } as any : m),
        }));
        return;
      }

      if (msg.type === "chat:deleted") {
        const rid = String(msg.roomId || "");
        const msgId = String(msg.msgId || "");
        const deletedAt = Number(msg.deletedAt || Date.now());
        if (!rid || !msgId) return;
        setMsgsByRoom(prev => ({
          ...prev,
          [rid]: (prev[rid] || []).map(m => m.id === msgId ? { ...m, body: "", deletedAt } as any : m),
        }));
        return;
      }

      if (msg.type === "reaction:changed") {
        const rid = String(msg.roomId || "");
        const msgId = String(msg.msgId || "");
        const reactions = Array.isArray(msg.reactions) ? msg.reactions : [];
        if (!rid || !msgId) return;
        setMsgsByRoom(prev => ({
          ...prev,
          [rid]: (prev[rid] || []).map(m => m.id === msgId ? { ...m, reactions } as any : m),
        }));
        return;
      }

      if (msg.type === "reaction:rejected") {
        weeredToast.warn(String(msg.reason || "Reaction not added."));
        return;
      }

      if (msg.type === "chat:rejected" || msg.type === "dm:rejected" || msg.type === "crew:rejected") {
        const reason = String(msg.reason || "Message blocked.");
        weeredToast.warn(reason);
        return;
      }

      if (msg.type === "room:locked") {
        const rid = String(msg.roomId || "");
        const isLocked = typeof msg.locked === "boolean" ? msg.locked : true;
        setMetaByRoom(prev => ({
          ...prev,
          [rid]: { ...(prev[rid] || { name: rid, ownerId: "", mods: [], chatDisabled: false }), locked: isLocked }
        }));
        return;
      }

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

      if (msg.type === "challenge:progress" || msg.type === "challenge:completed") {
        try { window.dispatchEvent(new CustomEvent("weered:challenge", { detail: msg })); } catch {}
        return;
      }

      if (msg.type === "module:state") {
        const rid = String(msg.roomId || "");
        if (!rid) return;
        setModuleByRoom(prev => ({ ...prev, [rid]: msg.activeModule ?? null }));
        try { window.dispatchEvent(new CustomEvent("weered:module:state", { detail: { roomId: rid, activeModule: msg.activeModule ?? null } })); } catch {}
        return;
      }

      if (msg.type === "room:settings") {
        const rid = String(msg.roomId || "");
        if (!rid) return;
        if (Array.isArray(msg.disabledModules)) {
          const list = msg.disabledModules.map(String);
          setMetaByRoom(prev => ({
            ...prev,
            [rid]: { ...(prev[rid] || { name: rid, locked: false, chatDisabled: false, ownerId: "", mods: [] }), disabledModules: list },
          }));
        }
        return;
      }

      if (msg.type === "module:rejected") {
        const reason = String(msg.reason || "");
        const mode = String(msg.mode || "");
        if (reason === "module_disabled") {
          weeredToast.error(`The "${mode}" module is disabled in this room.`);
        }
        return;
      }

      if (msg.type === "voice:state") {
        const rid = String(msg.roomId || "");
        if (!rid) return;
        setVoiceByRoom(prev => ({
          ...prev,
          [rid]: {
            mode: (msg.mode === "QUEUED" || msg.mode === "LISTEN_ONLY") ? msg.mode : "OPEN",
            queue: Array.isArray(msg.queue) ? msg.queue.map(String) : [],
            speakers: Array.isArray(msg.speakers) ? msg.speakers.map(String) : [],
          },
        }));
        try { window.dispatchEvent(new CustomEvent("weered:voice:state", { detail: { roomId: rid, mode: msg.mode, queue: msg.queue, speakers: msg.speakers } })); } catch {}
        return;
      }

      if (msg.type === "voice:permission") {
        const rid = String(msg.roomId || "");
        const userId = String(msg.userId || "");
        try { window.dispatchEvent(new CustomEvent("weered:voice:permission", { detail: { roomId: rid, userId } })); } catch {}
        return;
      }

      if (msg.type === "system:broadcast") {
        try { window.dispatchEvent(new CustomEvent("weered:system:broadcast", { detail: { message: msg.message, level: msg.level, from: msg.from, ts: msg.ts } })); } catch {}
        return;
      }

      if (msg.type === "staff:banned") {
        try { window.dispatchEvent(new CustomEvent("weered:staff:banned", { detail: { reason: msg.reason } })); } catch {}
        setActiveRoomId("");
        setJoinedRoomId("");
        try { router.replace("/login?error=account_suspended"); } catch {}
        return;
      }
    };

    return () => { };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!wsReady) return;
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const rid = activeRoomId.trim();
    if (!rid) return;
    setStatusByRoom(prev => ({ ...prev, [rid]: "joining" }));
    try { ws.send(JSON.stringify({ type: "presence:join", roomId: rid })); } catch {}
  }, [activeRoomId, wsReady]);

  useEffect(() => {
    if (!wsReady) return;
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    requestRoomsList(ws);
    lastJoinedRidRef.current = "";
    const rid = activeRoomId.trim();
    if (rid) {
      try { ws.send(JSON.stringify({ type: "presence:join", roomId: rid })); } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsReady]);

  function sendJoin(ws: WebSocket) {
    const ridRaw = activeRoomIdRef.current || joinedRoomId || activeRoomId;
    if (!ridRaw) return;
    let rid = ridRaw;
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

  useEffect(() => {
    const TYPING_TTL_MS = 5000;
    const t = setInterval(() => {
      const now = Date.now();
      setTypingByRoom(prev => {
        let changed = false;
        const next: Record<string, { userId: string; name: string; ts: number }[]> = {};
        for (const [rid, list] of Object.entries(prev)) {
          const fresh = list.filter(e => now - e.ts < TYPING_TTL_MS);
          if (fresh.length !== list.length) changed = true;
          if (fresh.length > 0) next[rid] = fresh;
          else if (list.length > 0) changed = true;
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const [isAway, setIsAwayState] = useState(false);
  const manualAwayRef = useRef(false);
  const lastSentAwayRef = useRef<boolean | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const myLivePresenceActiveRef = useRef(false);

  const sendAwayStatus = React.useCallback((away: boolean, force = false) => {
    if (!force && lastSentAwayRef.current === away) return;
    setIsAwayState(away);
    lastSentAwayRef.current = away;
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    try { ws.send(JSON.stringify({ type: "presence:idle", away })); } catch {}
  }, []);

  const armIdleTimer = React.useCallback(() => {
    const IDLE_MS = 20 * 60 * 1000;
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      if (manualAwayRef.current) return;
      if (myLivePresenceActiveRef.current) {
        armIdleTimer();
        return;
      }
      sendAwayStatus(true);
    }, IDLE_MS);
  }, [sendAwayStatus]);

  const setAway = React.useCallback((away: boolean) => {
    manualAwayRef.current = away;
    sendAwayStatus(away, true);
    if (!away) armIdleTimer();
    else if (idleTimerRef.current) { clearTimeout(idleTimerRef.current); idleTimerRef.current = null; }
  }, [sendAwayStatus, armIdleTimer]);

  useEffect(() => {
    const onActivity = () => {
      if (manualAwayRef.current) return;
      sendAwayStatus(false);
      armIdleTimer();
    };
    armIdleTimer();
    const events: (keyof WindowEventMap)[] = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
    events.forEach(e => window.addEventListener(e, onActivity, { passive: true }));
    return () => {
      events.forEach(e => window.removeEventListener(e, onActivity));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [armIdleTimer, sendAwayStatus]);

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
      setToken("authed");
      setMe(j.user || null);
      try { document.documentElement.setAttribute("data-weered-authed", "1"); } catch {}
      try { localStorage.setItem("weered_user",  JSON.stringify(j.user || null)); } catch {}
    }
  }

  function logout() {
    fetch(`${API}/auth/logout`, { method: "POST" }).catch(() => {});
    try { localStorage.removeItem("weered_token"); localStorage.removeItem("weered_user"); document.documentElement.removeAttribute("data-weered-authed"); } catch {}
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

  function sendChat(body: string, opts?: { replyToId?: string; attachmentId?: string }) {
    const b = body.trim();
    if ((!b && !opts?.attachmentId) || !canChat()) return;
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    let rid = activeRoomId; try { rid = decodeURIComponent(activeRoomId); } catch {}
    const env: any = { type: "chat:send", roomId: rid, body: b };
    if (opts?.replyToId) env.replyToId = opts.replyToId;
    if (opts?.attachmentId) env.attachmentId = opts.attachmentId;
    ws.send(JSON.stringify(env));
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
      const meta = metaByRoom[rid];
      const disabled = Array.isArray(meta?.disabledModules) ? meta!.disabledModules! : [];
      if (disabled.includes(mode)) {
        weeredToast.error(`The "${mode}" module is disabled in this room.`);
        return;
      }
      ws.send(JSON.stringify({ type: "module:set", roomId: rid, mode, url: opts?.url, channel: opts?.channel }));
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

  const sendRaw = React.useCallback((msg: object) => {
    try {
      const ws = (wsRef as any)?.current;
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    } catch {}
  }, []);

  const setVoiceMode      = (mode: "OPEN" | "QUEUED" | "LISTEN_ONLY") => sendAdmin("voice:mode",    { mode });
  const raiseHand         = ()                                        => sendAdmin("voice:raise");
  const lowerHand         = ()                                        => sendAdmin("voice:lower");
  const approveSpeaker    = (userId: string)                          => sendAdmin("voice:approve", { userId });
  const revokeSpeaker     = (userId: string)                          => sendAdmin("voice:revoke",  { userId });

  const value: Ctx = React.useMemo(() => ({
    apiBase: API, wsUrl: WS_URL,
    token, me, authed, globalRole,
    wsReady, wsState,
    activeRoomId, joinedRoomId, currentLobbyId, setActiveRoomId,
    meta, admin, role, joinStatus, statusByRoom,
    metaByRoom, adminByRoom, moduleByRoom, ytStateByRoom, launchByRoom, voiceByRoom,
    pinnedByRoom,
    moduleState, setModuleState,
    setVoiceMode, raiseHand, lowerHand, approveSpeaker, revokeSpeaker,
    rooms, join, leave, knock,
    devLogin, logout,
    sendChat, renameRoom,
    lockRoom, unlockRoom, joinWithPassword,
    passwordRoomId, passwordError, setPasswordRoomId,
    promote, demote, kick, ban, unban, mute, unmute, admit, deny,
    sendRaw,
    isAway,
    setAway,
  }), [
    token, me, authed, globalRole,
    wsReady, wsState,
    activeRoomId, joinedRoomId, currentLobbyId,
    meta, admin, role, joinStatus, statusByRoom,
    metaByRoom, adminByRoom, moduleByRoom, ytStateByRoom, launchByRoom, voiceByRoom,
    pinnedByRoom,
    moduleState,
    rooms,
    passwordRoomId, passwordError,
    sendRaw, isAway, setAway,
    join, leave, knock, sendChat, renameRoom, lockRoom, unlockRoom,
    joinWithPassword, setPasswordRoomId, devLogin, logout,
    promote, demote, kick, ban, unban, mute, unmute, admit, deny,
    setActiveRoomId, setModuleState,
    setVoiceMode, raiseHand, lowerHand, approveSpeaker, revokeSpeaker,
  ]);

  return (
    <WeeredContext.Provider value={value}>
      <VoiceProvider>
        <SystemBroadcast />
        {children}
        <NotorietyToast />
        <RankUpCelebration />
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
