"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useWeered } from "../WeeredProvider";
import RoomHeader from "./RoomHeader";
import RoomChatPanel from "../RoomChatPanel";
import RoomStage, { StageMode } from "./RoomStage";
import LaunchPad from "./LaunchPad";
import { useOverlay } from "../overlays/OverlayProvider";
import { useVoice } from "../VoiceContext";
import ArticleReader from "./ArticleReader";
import CopyButton from "../CopyButton";
import { weeredToast } from "../../lib/toast";

// ── Twitch Glitch icon (official shape, used per Twitch brand guidelines) ──

function TwitchIcon({ size = 11, color = "#9146FF", style }: { size?: number; color?: string; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 268" style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0, ...style }}>
      <path d="M17.458 0L0 46.556v185.81h63.983v34.934h34.932l34.898-34.934h52.36L256 162.954V0H17.458zm23.259 23.263H232.73v128.029l-40.739 40.736H128L93.113 226.93v-34.902H40.717V23.263zm64.008 116.405H128V69.844h-23.275v69.824zm63.997 0h23.275V69.844h-23.275v69.824z" fill={color} />
    </svg>
  );
}

// ── YouTube play icon (official shape, used per YouTube API branding guidelines) ──

function YouTubeIcon({ size = 11, color = "#FF0000", style }: { size?: number; color?: string; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={Math.round(size * 0.72)} viewBox="0 0 159 110" style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0, ...style }}>
      <path d="M154 17.5c-1.82-6.73-7.07-12-13.8-13.8C128.04 0 79.5 0 79.5 0S30.96 0 18.8 3.7C12.07 5.5 6.82 10.77 5 17.5 1.3 29.66 1.3 55 1.3 55s0 25.34 3.7 37.5c1.82 6.73 7.07 12 13.8 13.8C30.96 110 79.5 110 79.5 110s48.54 0 60.7-3.7c6.73-1.82 12-7.07 13.8-13.8 3.7-12.16 3.7-37.5 3.7-37.5s0-25.34-3.7-37.5z" fill={color} />
      <path d="M64 78.8V31.2L105 55 64 78.8z" fill="#fff" />
    </svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeCopy(s: string) {
  try { navigator.clipboard?.writeText?.(s); } catch {}
}

function safeJsonParse<T>(s: string | null, fallback: T): T {
  try { if (!s) return fallback; return JSON.parse(s) as T; } catch { return fallback; }
}

// ─── Module pill definitions ──────────────────────────────────────────────────

const ALL_MODULES: { id: NonNullable<StageMode>; label: string; icon: string; live: boolean }[] = [
  { id: "voice",   icon: "🎙", label: "Voice",   live: true  },
  { id: "youtube", icon: "__youtube__",  label: "YouTube", live: true  },
  { id: "twitch",  icon: "__twitch__", label: "Twitch",  live: true  },
  { id: "browser", icon: "🌐", label: "Browser", live: true  },
  { id: "article", icon: "📰", label: "Article", live: true  },
  { id: "screen",  icon: "🖥", label: "Screen",  live: true  },
  { id: "video",   icon: "📹", label: "Video",   live: true  },
  { id: "poker",   icon: "♦",  label: "Poker",   live: true  },
  { id: "fakeout", icon: "📈", label: "FakeOut", live: true  },
  { id: "destiny", icon: "⚔",  label: "Destiny",  live: true  },
  { id: "league",  icon: "🏆", label: "League",   live: true  },
  { id: "fortnite",icon: "🎯", label: "Fortnite", live: true  },
  { id: "pubg",    icon: "🪖", label: "PUBG",     live: true  },
  { id: "hq",      icon: "🏢", label: "HQ",       live: true  },
  { id: "cs2",     icon: "💀", label: "CS2",      live: true  },
  { id: "dota2",   icon: "⚔",  label: "Dota 2",   live: true  },
  { id: "study",   icon: "📚", label: "Focus",    live: true  },
  { id: "dnd",     icon: "🐉", label: "D&D",      live: true  },
  { id: "windrose",icon: "⚓", label: "Windrose", live: true  },
  { id: "helldivers",icon: "💀", label: "Helldivers", live: true  },
];

// Module type → which special modules are available in rooms of that lobby
const LOBBY_MODULE_MAP: Record<string, string[]> = {
  POKER:   ["voice", "poker"],
  TRADING: ["voice", "fakeout", "video", "screen"],
  // Game lobbies get standard media modules, no poker/trading
  BUNGIE:  ["voice", "destiny", "youtube", "twitch", "video", "screen"],
  RIOT:    ["voice", "league", "youtube", "twitch", "video", "screen"],
  FORTNITE:["voice", "fortnite", "youtube", "twitch", "video", "screen"],
  PUBG:    ["voice", "pubg", "youtube", "twitch", "video", "screen"],
  MARATHON:["voice", "youtube", "twitch", "video", "screen"],
  HEADQUARTERS:["voice", "hq", "video", "screen"],
  CS2:         ["voice", "cs2", "youtube", "twitch", "video", "screen"],
  DOTA2:       ["voice", "dota2", "youtube", "twitch", "video", "screen"],
  STUDY:       ["voice", "study", "video", "screen"],
  DND:         ["voice", "dnd", "youtube", "browser", "video", "screen"],
  WINDROSE:    ["voice", "windrose", "youtube", "twitch", "video", "screen"],
  HELLDIVERS2: ["voice", "helldivers", "youtube", "twitch", "video", "screen"],
};

// Default modules for lobbies without a specific mapping
const DEFAULT_ROOM_MODULES = ["voice", "youtube", "twitch", "browser", "video", "screen"];

const ROOM_NAME_CACHE_KEY = "weered:roomnames:v1";

// Chat panel dimensions
const CHAT_WIDTH_DESKTOP = 580;
const CHAT_WIDTH_MOBILE  = 300;
const CHAT_HEIGHT_DESKTOP = 420;
const CHAT_HEIGHT_MOBILE  = "100%";

// ─── Component ────────────────────────────────────────────────────────────────

export default function RoomCanvas({ roomId }: { roomId: string }) {
  const w: any = useWeered();
  const activeRid = (w?.activeRoomId || "").replace("room:", "");
  const joinStatus = w?.statusByRoom?.[activeRid] || w?.statusByRoom?.["room:" + activeRid] || w?.statusByRoom?.[roomId] || "idle";
  // console.log("[knock debug]", { roomId, activeRid, joinStatus, statusByRoom: w?.statusByRoom });
  const { openSheet } = useOverlay();
  const voice = useVoice();
  const [stageMode, setStageMode] = useState<StageMode>("voice");

  // ── Solo viewing — when true, this user's module switches don't
  // broadcast and incoming module:state events are ignored. Lets one
  // user watch Twitch while the next watches YouTube in the same room.
  // Persisted per-room so it survives reload.
  const SOLO_KEY = `weered:room:${roomId}:solo`;
  const [soloViewing, setSoloViewing] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try { return localStorage.getItem(SOLO_KEY) === "1"; } catch { return false; }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try { localStorage.setItem(SOLO_KEY, soloViewing ? "1" : "0"); } catch {}
  }, [soloViewing, SOLO_KEY]);
  const soloRef = useRef(soloViewing);
  useEffect(() => { soloRef.current = soloViewing; }, [soloViewing]);

  // Responsive chat width
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setIsMobile(mq.matches);
    apply();
    try { mq.addEventListener("change", apply); return () => mq.removeEventListener("change", apply); }
    catch { mq.addListener(apply); return () => mq.removeListener(apply); }
  }, []);
  const CHAT_WIDTH = isMobile ? CHAT_WIDTH_MOBILE : CHAT_WIDTH_DESKTOP;
  const CHAT_HEIGHT = isMobile ? "100%" : CHAT_HEIGHT_DESKTOP;

  // Fetch room metadata so we can honor the creator's defaultModule on first join.
  // Only applies before any serverModule broadcast wins (see selfSetRef logic below).
  const initialModuleAppliedRef = useRef(false);
  useEffect(() => {
    if (initialModuleAppliedRef.current) return;
    if (!roomId) return;
    let cancelled = false;
    fetch(`https://api.weered.ca/rooms/${encodeURIComponent(roomId)}`)
      .then(r => r.json())
      .then(j => {
        if (cancelled || initialModuleAppliedRef.current) return;
        const dm = j?.room?.defaultModule;
        if (typeof dm === "string" && dm && dm !== "voice") {
          setStageMode(dm as StageMode);
        }
        initialModuleAppliedRef.current = true;
      })
      .catch(() => { initialModuleAppliedRef.current = true; });
    return () => { cancelled = true; };
  }, [roomId]);

  // Lobby context for this room
  const [lobbyContext, setLobbyContext] = useState<{ id: string; name: string; logoUrl?: string; moduleType?: string; enabledModules?: string[] } | null>(null);
  const currentLobbyId = w?.currentLobbyId || null;
  useEffect(() => {
    if (!currentLobbyId || currentLobbyId === "lobby") { setLobbyContext(null); return; }
    fetch(`https://api.weered.ca/lobbies/${encodeURIComponent(currentLobbyId)}`)
      .then(r => r.json())
      .then(j => {
        if (j?.ok && j?.lobby) {
          setLobbyContext({
            id: j.lobby.id,
            name: j.lobby.name || j.lobby.id,
            logoUrl: j.lobby.logoUrl || undefined,
            moduleType: j.lobby.moduleType || undefined,
            enabledModules: j.lobby.enabledModules || undefined,
          });
        }
      })
      .catch(() => {});
  }, [currentLobbyId]);

  // Filter modules based on lobby context
  const MODULES = useMemo(() => {
    if (!lobbyContext?.moduleType) return ALL_MODULES.filter(m => DEFAULT_ROOM_MODULES.includes(m.id));
    const allowed = LOBBY_MODULE_MAP[lobbyContext.moduleType] || DEFAULT_ROOM_MODULES;
    return ALL_MODULES.filter(m => allowed.includes(m.id));
  }, [lobbyContext?.moduleType]);

  // Lobby-specific theme takeover — persist into room pages too
  useEffect(() => {
    const THEMEABLE = new Set<string>(["windrose", "destiny2", "dnd", "helldivers2"]);
    const id = lobbyContext?.id;
    if (id && THEMEABLE.has(id)) {
      document.documentElement.setAttribute("data-weered-lobby", id);
      return () => { document.documentElement.removeAttribute("data-weered-lobby"); };
    }
  }, [lobbyContext?.id]);

  const [articleUrl, setArticleUrl]     = useState<string>("");
  const [browserUrl, setBrowserUrl]     = useState<string>("");
  const [browserInput, setBrowserInput] = useState<string>("");
  const [iframeBlocked, setIframeBlocked] = useState(false);

  // Twitch state
  const [twitchChannel, setTwitchChannel] = useState<string>("");
  const [twitchInput, setTwitchInput]     = useState<string>("");

  // Chat state — open on desktop, collapsed on mobile
  const [chatOpen, setChatOpen]         = useState(() => typeof window !== "undefined" ? window.innerWidth > 767 : true);
  const [chatFullscreen, setChatFullscreen] = useState(() => {
    try { return typeof window !== "undefined" && localStorage.getItem("weered_chat_fullscreen") === "1"; } catch { return false; }
  });
  const toggleChatFullscreen = () => {
    setChatFullscreen(v => {
      try { localStorage.setItem("weered_chat_fullscreen", v ? "0" : "1"); } catch {}
      return !v;
    });
    // Ensure the panel is open when expanding to full
    setChatOpen(true);
  };
  // ESC to exit fullscreen
  useEffect(() => {
    if (!chatFullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") toggleChatFullscreen(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chatFullscreen]);
  const [chatUnread, setChatUnread]     = useState(false);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);

  const [voicePrompt, setVoicePrompt] = useState(true);

  // Track whether we set the module ourselves (avoid echo-back re-setting)
  const selfSetRef = useRef(false);

  // ── Module sync: initialize from server state on join ──
  const serverModule = w?.moduleState;
  const prevServerModuleRef = useRef<any>(null);

  useEffect(() => {
    // Skip if this is our own echo
    if (selfSetRef.current) { selfSetRef.current = false; return; }
    // Skip if nothing changed
    if (JSON.stringify(serverModule) === JSON.stringify(prevServerModuleRef.current)) return;
    prevServerModuleRef.current = serverModule;

    if (!serverModule || !serverModule.mode) {
      // Module was cleared by someone — don't force-close if user has local state
      // Only clear if we didn't set it ourselves
      return;
    }

    const mode = serverModule.mode as StageMode;
    setStageMode(mode);

    if (mode === "twitch" && serverModule.channel) {
      setTwitchChannel(serverModule.channel);
      setTwitchInput(serverModule.channel);
    }
    if (mode === "browser" && serverModule.url) {
      setBrowserUrl(serverModule.url);
      setBrowserInput(serverModule.url);
      setIframeBlocked(false);
    }
    if (mode === "article" && serverModule.url) {
      setArticleUrl(serverModule.url);
    }
  }, [serverModule]);

  // ── Module sync: listen for live updates from other users ──
  useEffect(() => {
    function onModuleState(ev: any) {
      const detail = ev?.detail;
      if (!detail || detail.roomId !== roomId) return;
      if (selfSetRef.current) { selfSetRef.current = false; return; }
      // Solo viewing: ignore module changes that come from other users.
      if (soloRef.current) return;

      const mod = detail.activeModule;
      if (!mod || !mod.mode) {
        // Another user cleared the module
        setStageMode(null);
        return;
      }

      const mode = mod.mode as StageMode;
      setStageMode(mode);

      if (mode === "twitch" && mod.channel) {
        setTwitchChannel(mod.channel);
        setTwitchInput(mod.channel);
      }
      if (mode === "browser" && mod.url) {
        setBrowserUrl(mod.url);
        setBrowserInput(mod.url);
        setIframeBlocked(false);
      }
    }
    window.addEventListener("weered:module:state", onModuleState);
    return () => window.removeEventListener("weered:module:state", onModuleState);
  }, [roomId]);

  function toEmbedUrl(url: string): string {
    try {
      const u = new URL(url);
      // Standard watch URL: youtube.com/watch?v=ID
      if (u.hostname.includes("youtube.com") && u.searchParams.get("v")) {
        return `https://www.youtube.com/embed/${u.searchParams.get("v")}?autoplay=0`;
      }
      // Shorts: youtube.com/shorts/ID
      if (u.hostname.includes("youtube.com") && u.pathname.startsWith("/shorts/")) {
        const id = u.pathname.replace("/shorts/", "").split("/")[0];
        if (id) return `https://www.youtube.com/embed/${id}?autoplay=0`;
      }
      // Short URL: youtu.be/ID
      if (u.hostname.includes("youtu.be")) {
        return `https://www.youtube.com/embed${u.pathname}?autoplay=0`;
      }
      // Any other youtube.com URL — block it, YouTube sets X-Frame-Options: sameorigin
      if (u.hostname.includes("youtube.com")) {
        return "__youtube_blocked__";
      }
    } catch {}
    return url;
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const art = params.get("article");
    if (art) {
      const decoded = decodeURIComponent(art);
      setArticleUrl(decoded);
      selfSetRef.current = true;
      w?.setModuleState?.("article", { url: decoded });
      setStageMode("article");
    }
    const twitch = params.get("twitch");
    if (twitch) {
      const channel = decodeURIComponent(twitch).trim().toLowerCase();
      setTwitchChannel(channel);
      setTwitchInput(channel);
      setStageMode("twitch");
    }
  }, []);

  // Unread indicator — watch msgs directly from WeeredProvider, no event bus needed
  const msgs = Array.isArray(w?.msgs) ? w.msgs : [];
  const prevMsgCountRef = useRef(msgs.length);
  useEffect(() => {
    if (msgs.length > prevMsgCountRef.current) {
      if (!chatOpen) {
        setChatUnread(true);
        setChatUnreadCount(c => c + 1);
      }
    }
    prevMsgCountRef.current = msgs.length;
  }, [msgs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear on open
  useEffect(() => {
    if (chatOpen) { setChatUnread(false); setChatUnreadCount(0); }
  }, [chatOpen]);

  const roomLabel = useMemo(() => {
    const name = String(w?.meta?.name || w?.meta?.title || w?.meta?.label || w?.admin?.name || "").trim();
    if (name) return name;
    try { return decodeURIComponent(roomId || ""); } catch { return roomId || ""; }
  }, [w?.meta?.name, w?.meta?.title, w?.meta?.label, w?.admin?.name, roomId]);

  // Thumbnail: from meta (seeded by feed worker) or derived from article/YouTube URL
  const roomThumbnail = useMemo(() => {
    if (w?.meta?.thumbnail) return w.meta.thumbnail;
    if (!articleUrl) return null;
    try {
      const u = new URL(articleUrl);
      if (u.hostname.includes("youtube.com") && u.searchParams.get("v")) {
        return `https://img.youtube.com/vi/${u.searchParams.get("v")}/hqdefault.jpg`;
      }
      if (u.hostname.includes("youtube.com") && u.pathname.startsWith("/shorts/")) {
        const id = u.pathname.replace("/shorts/", "").split("/")[0];
        if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
      }
      if (u.hostname.includes("youtu.be")) {
        const id = u.pathname.replace("/", "");
        if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
      }
    } catch {}
    return null;
  }, [w?.meta?.thumbnail, articleUrl]);

  const memberCount = Array.isArray(w?.users) ? w.users.length : 0;
  const locked      = Boolean(w?.meta?.locked);

  useEffect(() => {
    if (!roomId || !roomLabel || roomLabel === roomId) return;
    try {
      const cache = JSON.parse(localStorage.getItem(ROOM_NAME_CACHE_KEY) || "{}");
      const entry = typeof cache[roomId] === "object" ? cache[roomId] : { name: cache[roomId] || roomLabel };
      const updated = { ...entry, name: roomLabel, count: memberCount };
      if (JSON.stringify(cache[roomId]) === JSON.stringify(updated)) return;
      cache[roomId] = updated;
      localStorage.setItem(ROOM_NAME_CACHE_KEY, JSON.stringify(cache));
      try { window.dispatchEvent(new CustomEvent("weered:roomnames:update")); } catch {}
    } catch {}
  }, [roomId, roomLabel, memberCount]);

  const aboutKey = `weered.room.about.${roomId}`;
  const linksKey = `weered.room.links.${roomId}`;
  const [about,       setAbout      ] = useState("");
  const [links,       setLinks      ] = useState<string[]>([]);
  const [newLink,     setNewLink    ] = useState("");

  useEffect(() => {
    try {
      setAbout(String(localStorage.getItem(aboutKey) || ""));
      setLinks(safeJsonParse<string[]>(localStorage.getItem(linksKey), []));
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  useEffect(() => {
    try { localStorage.setItem(aboutKey, about || ""); } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [about, roomId]);

  useEffect(() => {
    try { localStorage.setItem(linksKey, JSON.stringify(links || [])); } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [links, roomId]);

  const addLink = () => {
    const v = String(newLink || "").trim();
    if (!v) return;
    const normalized = v.startsWith("http://") || v.startsWith("https://") ? v : `https://${v}`;
    if (links.includes(normalized)) { setNewLink(""); return; }
    setLinks([normalized, ...links].slice(0, 20));
    setNewLink("");
  };

  const removeLink = (v: string) => setLinks(links.filter((x) => x !== v));

  const handleModuleClick = (id: NonNullable<StageMode>) => {
    const newMode = stageMode === id ? null : id;
    // Disabled-modules guard: the picker should refuse to switch to a
    // module the owner has disabled. Earlier this check only lived inside
    // setModuleState (in WeeredProvider), so the local stageMode flipped
    // before we bailed — user saw the tab change visually even when the
    // broadcast got blocked. Guard at the click site too.
    if (newMode) {
      const disabled: string[] = (w?.meta?.disabledModules as string[] | undefined) || [];
      const isStaff = ["GOD", "STAFF", "SUPPORT", "ADMIN"].includes(String(w?.globalRole || w?.me?.globalRole || "USER").toUpperCase());
      const meId = String(w?.me?.id || "");
      const isOwner = !!(meId && w?.meta?.ownerId === meId);
      if (disabled.includes(newMode) && !isStaff && !isOwner) {
        weeredToast.error(`The "${newMode}" module is disabled in this room.`);
        return;
      }
    }
    setStageMode(newMode);
    selfSetRef.current = true;
    // Solo viewing: skip the broadcast — the room state stays as it was.
    if (soloViewing) return;
    if (newMode) {
      // Broadcast the new module — for twitch/browser, content will be set when user enters a channel/URL
      const opts: any = {};
      if (newMode === "twitch" && twitchChannel) opts.channel = twitchChannel;
      if (newMode === "browser" && browserUrl) opts.url = browserUrl;
      w?.setModuleState?.(newMode, opts);
    } else {
      w?.setModuleState?.(null);
    }
  };

  const stageActive = stageMode !== null;
  const isFullStageMode = stageActive && !["youtube","browser","twitch","article"].includes(stageMode!);

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/room/${encodeURIComponent(roomId)}`
    : "";

  // ─── Details panel ────────────────────────────────────────────────────────
  // Effective-owner check: actual room owner OR global staff/god roles.
  // Mods get their own controls via isMod (passed separately to widgets
  // that distinguish — appearance editor stays owner-only).
  const meId: string = String(w?.me?.id || "");
  const roomOwnerId: string = String(w?.meta?.ownerId || "");
  const myGlobalRole = String(w?.globalRole || w?.me?.globalRole || "USER").toUpperCase();
  const isStaffGlobal = ["GOD", "STAFF", "SUPPORT"].includes(myGlobalRole);
  const isRoomOwner = (!!meId && meId === roomOwnerId) || isStaffGlobal;
  const isRoomMod = !!(w?.meta?.mods && Array.isArray(w.meta.mods) && w.meta.mods.includes(meId)) || isStaffGlobal;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-w-0" style={{ position: "relative", overflow: "hidden", height: "calc(100vh - 32px)" }}>

      {/* ── Knock waiting overlay ── */}
      {joinStatus === "knocking" && (
        <div style={{ position: "absolute", inset: 0, zIndex: 200, background: "rgba(10,10,18,0.92)", backdropFilter: "blur(12px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(124,58,237,0.2)", border: "2px solid rgba(124,58,237,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, animation: "weered-pulse 2s ease-in-out infinite" }}>🚪</div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>Waiting for admittance</div>
            <div style={{ fontSize: 13, opacity: 0.5 }}>A moderator will let you in shortly</div>
          </div>
          <button onClick={() => { try { w?.leave?.(); } catch {} try { window.history.back(); } catch {} }} style={{ marginTop: 8, padding: "8px 20px", borderRadius: 9, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)", fontSize: 13, cursor: "pointer" }}>Cancel</button>
          <style>{`@keyframes weered-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.95)}}`}</style>
        </div>
      )}

      {/* ── Denied overlay ── */}
      {joinStatus === "denied" && (
        <div style={{ position: "absolute", inset: 0, zIndex: 200, background: "rgba(10,10,18,0.92)", backdropFilter: "blur(12px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
          <div style={{ fontSize: 40 }}>🚫</div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>Entry denied</div>
            <div style={{ fontSize: 13, opacity: 0.5 }}>A moderator declined your request</div>
          </div>
          <button onClick={() => { try { window.history.back(); } catch {} }} style={{ marginTop: 8, padding: "8px 20px", borderRadius: 9, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "rgba(252,165,165,0.9)", fontSize: 13, cursor: "pointer" }}>Go back</button>
        </div>
      )}

      {/* ── Header ── */}
      <RoomHeader
        title={roomLabel}
        memberCount={memberCount}
        locked={locked}
        thumbnail={roomThumbnail}
        iconUrl={w?.meta?.iconUrl || null}
        bannerUrl={w?.meta?.bannerUrl || null}
        accentColor={w?.meta?.accentColor || null}
        pills={MODULES.map(m => ({ ...m, active: stageMode === m.id }))}
        users={Array.isArray(w?.users) ? w.users : []}
        lobbyName={lobbyContext?.name || w?.meta?.lobbyName || null}
        lobbyLogo={lobbyContext?.logoUrl || w?.meta?.lobbyLogo || null}
        onPillClick={(id) => handleModuleClick(id as NonNullable<StageMode>)}
        onLeave={() => {
          try { w?.leave?.(); } catch {}
          const lobbyId = lobbyContext?.id;
          if (lobbyId) {
            window.location.href = `/lobby/${encodeURIComponent(lobbyId)}`;
          } else {
            window.location.href = "/home";
          }
        }}
      />

      {/* ── Member toolbar — solo viewing + raise hand. Always visible
          to all members; admin-only voice settings live in the Details
          panel. ── */}
      <RoomMemberToolbar
        soloViewing={soloViewing}
        setSoloViewing={setSoloViewing}
        voiceState={w?.voiceByRoom?.[`room:${roomId}`] || w?.voiceByRoom?.[roomId] || null}
        isOwner={!!isRoomOwner}
        isMod={!!isRoomMod}
        meId={String(w?.me?.id || "")}
        onRaise={() => w?.raiseHand?.()}
        onLower={() => w?.lowerHand?.()}
      />

      {/* ── Launch Pad (MPlayer-style game launcher) ── */}
      <LaunchPad roomId={roomId} moduleType={lobbyContext?.moduleType} />

      {/* ── Voice available prompt — canonical Join CTA across every
          module tab. Hidden once the user is connected to voice. The
          inline join in RoomStage was removed to avoid duplication. ── */}
      {voicePrompt && voice.connState !== "connected" && voice.connState !== "connecting" && (
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", gap: 12, background: "rgba(124,58,237,0.08)", borderBottom: "1px solid rgba(124,58,237,0.18)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px #22c55e", flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(226,232,240,0.9)" }}>Voice chat available</div>
              <div style={{ fontSize: 11, color: "rgba(148,163,184,0.55)", marginTop: 1 }}>Join to hear and speak with others</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button onClick={() => setVoicePrompt(false)} style={{ padding: "5px 13px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "rgba(148,163,184,0.7)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Not now</button>
            <button onClick={() => { setVoicePrompt(false); voice.connect(roomId); }} style={{ padding: "5px 16px", borderRadius: 8, border: "none", background: "#7c3aed", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Join voice</button>
          </div>
        </div>
      )}

      {/* ── Voice active bar ── */}
      {voice.connState === "connected" && voice.activeRoomId === roomId && (
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 10, padding: "6px 16px", background: "rgba(34,197,94,0.08)", borderBottom: "1px solid rgba(34,197,94,0.15)" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e", flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: "rgba(134,239,172,0.8)", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>Voice active</span>
          <div style={{ display: "flex", gap: 6, marginLeft: 4 }}>
            {voice.tiles.slice(0, 5).map(t => (
              <span key={t.sid} style={{ fontSize: 11, color: t.isMuted ? "rgba(148,163,184,0.5)" : "rgba(134,239,172,0.9)" }}>
                {t.name}{t.isMuted ? " 🔇" : ""}
              </span>
            ))}
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <button onClick={() => voice.toggleMute()} style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)", color: "rgba(226,232,240,0.7)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              {voice.muted ? "🔇 Unmute" : "🎙 Mute"}
            </button>
            <button onClick={() => voice.disconnect()} style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.1)", color: "#fca5a5", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              Leave
            </button>
          </div>
        </div>
      )}

      {/* ── Stage zone ── */}
      <div
        className={[
          `border-b border-white/[0.07] overflow-auto`,
          isFullStageMode ? "" : "transition-all duration-300 ease-in-out",
          stageActive ? "bg-black/30" : "bg-transparent",
        ].join(" ")}
        style={(() => {
          if (!stageActive) return { height: "40px", flexShrink: 0 };
          return { flex: 1, minHeight: 0, overflow: "auto" };
        })()}
      >
        {!stageActive && (
          <div className="flex items-center px-4 h-10">
            <span className="text-[9px] font-bold tracking-[0.14em] uppercase text-white/20">
              Stage -- activate a module below
            </span>
          </div>
        )}

        {stageActive && stageMode !== "browser" && stageMode !== "twitch" && stageMode !== "article" && (
          <div style={{ height: "100%" }}>
            <RoomStage roomId={roomId} mode={stageMode} moduleType={lobbyContext?.moduleType} roomUsers={Array.isArray(w?.users) ? w.users : []} onClose={() => { setStageMode(null); selfSetRef.current = true; w?.setModuleState?.(null); }} />
          </div>
        )}

        {stageActive && stageMode === "browser" && (
          <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", background: "rgba(0,0,0,0.4)", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
              <span style={{ fontSize: 11, color: "rgba(100,116,139,0.4)" }}>🔒</span>
              <input
                value={browserInput}
                onChange={e => setBrowserInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    let u = browserInput.trim();
                    if (!u.startsWith("http")) u = "https://" + u;
                    setBrowserUrl(u); setBrowserInput(u); setIframeBlocked(false);
                    selfSetRef.current = true;
                    w?.setModuleState?.("browser", { url: u });
                  }
                }}
                style={{ flex: 1, padding: "4px 8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, color: "rgba(203,213,225,0.8)", fontSize: 11, outline: "none", fontFamily: "monospace" }}
              />
              <button onClick={() => window.open(browserUrl, "_blank")} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "rgba(148,163,184,0.6)", fontSize: 11, cursor: "pointer" }}>&#8599;</button>
              <button onClick={() => { setStageMode(null); selfSetRef.current = true; w?.setModuleState?.(null); }} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "rgba(148,163,184,0.6)", fontSize: 11, cursor: "pointer" }}>&times;</button>
            </div>
            {(() => {
              const BLOCKED = ["espn.com","nfl.com","nba.com","twitter.com","x.com","facebook.com","instagram.com","tiktok.com","reddit.com","linkedin.com","nytimes.com","wsj.com","bloomberg.com"];
              const isBlocked = iframeBlocked || BLOCKED.some(d => browserUrl.includes(d));
              if (isBlocked) return (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: "rgba(0,0,0,0.3)", padding: 32 }}>
                  <div style={{ fontSize: 40 }}>🚫</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(226,232,240,0.7)" }}>This site blocks embedding</div>
                  <div style={{ fontSize: 12, color: "rgba(148,163,184,0.5)", textAlign: "center", maxWidth: 320 }}>{browserUrl}</div>
                  <button onClick={() => window.open(browserUrl, "_blank")} style={{ marginTop: 8, padding: "10px 24px", borderRadius: 8, background: "rgba(124,58,237,0.3)", border: "1px solid rgba(124,58,237,0.5)", color: "rgba(167,139,250,0.9)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    Open in new tab
                  </button>
                  <div style={{ fontSize: 11, color: "rgba(100,116,139,0.4)", marginTop: 4 }}>
                    The discussion room is still active -- others can join and chat about this article
                  </div>
                </div>
              );
              const embedUrl = toEmbedUrl(browserUrl);
              if (embedUrl === "__youtube_blocked__") return (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: "rgba(0,0,0,0.3)", padding: 32 }}>
                  <YouTubeIcon size={48} color="rgba(255,0,0,0.3)" />
                  <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(226,232,240,0.7)" }}>YouTube blocks direct embedding</div>
                  <div style={{ fontSize: 12, color: "rgba(148,163,184,0.5)", textAlign: "center", maxWidth: 320 }}>Use the YouTube tab above to sync playback for everyone</div>
                  <button onClick={() => { handleModuleClick("youtube" as any); setStageMode("youtube"); }} style={{ marginTop: 8, padding: "10px 24px", borderRadius: 8, background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.4)", color: "rgba(252,165,165,0.9)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    Open YouTube tab
                  </button>
                </div>
              );
              return (
                <iframe
                  key={embedUrl}
                  src={embedUrl}
                  style={{ flex: 1, border: "none", display: "block", width: "100%", background: "#fff" }}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation"
                  title="Browser"
                  onError={() => setIframeBlocked(true)}
                />
              );
            })()}
          </div>
        )}

        {/* ── Article reader stage ── */}
        {stageActive && stageMode === "article" && articleUrl && (
          <ArticleReader
            url={articleUrl}
            onClose={() => { setStageMode(null); setArticleUrl(""); selfSetRef.current = true; w?.setModuleState?.(null); }}
          />
        )}

        {/* ── Twitch stage ── */}
        {stageActive && stageMode === "twitch" && (
          <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", background: "rgba(145,70,255,0.08)", borderBottom: "1px solid rgba(145,70,255,0.15)", flexShrink: 0 }}>
              <TwitchIcon size={14} color="rgba(145,70,255,0.8)" />
              <input
                value={twitchInput}
                onChange={e => setTwitchInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    const ch = twitchInput.trim().toLowerCase().replace(/^https?:\/\/(www\.)?twitch\.tv\//i, "").split(/[/?#]/)[0];
                    if (ch) {
                      setTwitchChannel(ch);
                      setTwitchInput(ch);
                      selfSetRef.current = true;
                      w?.setModuleState?.("twitch", { channel: ch });
                    }
                  }
                }}
                placeholder="Enter Twitch channel name..."
                style={{ flex: 1, padding: "4px 8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(145,70,255,0.15)", borderRadius: 6, color: "rgba(203,213,225,0.8)", fontSize: 11, outline: "none", fontFamily: "monospace" }}
              />
              {twitchChannel && (
                <a href={`https://www.twitch.tv/${twitchChannel}`} target="_blank" rel="noopener noreferrer" style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid rgba(145,70,255,0.15)", background: "rgba(145,70,255,0.08)", color: "rgba(216,180,254,0.7)", fontSize: 11, cursor: "pointer", textDecoration: "none" }}>↗ Twitch</a>
              )}
              <button onClick={() => { setTwitchChannel(""); setTwitchInput(""); setStageMode(null); selfSetRef.current = true; w?.setModuleState?.(null); }} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "rgba(148,163,184,0.6)", fontSize: 11, cursor: "pointer" }}>&times;</button>
            </div>
            {twitchChannel ? (
              <iframe
                src={`https://player.twitch.tv/?channel=${twitchChannel}&parent=${typeof window !== "undefined" ? window.location.hostname : "weered.ca"}&muted=false`}
                style={{ flex: 1, border: "none", display: "block", width: "100%" }}
                allowFullScreen
                allow="autoplay; encrypted-media"
                title={`Twitch - ${twitchChannel}`}
              />
            ) : (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, background: "rgba(0,0,0,0.2)" }}>
                <TwitchIcon size={40} color="rgba(145,70,255,0.25)" />
                <div style={{ fontSize: 13, opacity: 0.4 }}>Enter a Twitch channel name above to start watching</div>
                <div style={{ fontSize: 11, opacity: 0.25 }}>You can paste a full twitch.tv URL or just the channel name</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Main body ── */}
      {/*
        Chat panel and tab live here at the outer level so they are never
        clipped by the center column and always paint above the iframe.
        position:relative on this wrapper is the stacking root.
      */}
      <div className={isFullStageMode ? "flex" : stageActive ? "flex" : "flex flex-1 min-h-0"} style={{ position: "relative", overflow: "visible", ...(isFullStageMode ? { flexShrink: 0, maxHeight: 50 } : stageActive ? { flexShrink: 0, height: 0 } : {}) }}>

        {/* ── Center column — no overflow:hidden so chat can escape ── */}
        <div className={isFullStageMode ? "" : "flex flex-col flex-1 min-w-0 min-h-0"} style={{ position: "relative" }}>

          {/* Spacer — collapses when stage fills the space */}
          {!isFullStageMode && (
            <div className="flex-1 min-h-0" />
          )}

          {/* ── Bottom pills — rendered here but also duplicated at root level for visibility ── */}
          <div style={{ display: "none" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              {MODULES.map((m) => {
                const isActive = stageMode === m.id;
                const isLive   = m.live;
                const isTwitch = m.icon === "__twitch__";
                const isYT     = m.icon === "__youtube__";

                // Per-module accent colors
                const accent = isTwitch ? "#9146FF" : isYT ? "#FF0000" : m.id === "voice" ? "#22c55e" : m.id === "browser" ? "#38bdf8" : "#7C3AED";

                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={!isLive}
                    onClick={() => isLive && handleModuleClick(m.id)}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "6px 14px", borderRadius: 999,
                      fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
                      fontFamily: "monospace", cursor: isLive ? "pointer" : "default",
                      transition: "all 0.15s ease",
                      border: isActive
                        ? `1px solid ${accent}88`
                        : isLive
                          ? `1px solid ${accent}30`
                          : "1px solid rgba(255,255,255,0.06)",
                      background: isActive
                        ? `${accent}22`
                        : isLive
                          ? `${accent}0a`
                          : "rgba(255,255,255,0.02)",
                      color: isActive
                        ? "#fff"
                        : isLive
                          ? "rgba(226,232,240,0.65)"
                          : "rgba(255,255,255,0.18)",
                      boxShadow: isActive ? `0 0 14px ${accent}35, 0 0 4px ${accent}20` : "none",
                    }}
                    onMouseEnter={e => {
                      if (!isLive || isActive) return;
                      const el = e.currentTarget;
                      el.style.background = `${accent}18`;
                      el.style.borderColor = `${accent}50`;
                      el.style.color = "rgba(226,232,240,0.9)";
                      el.style.boxShadow = `0 0 10px ${accent}20`;
                    }}
                    onMouseLeave={e => {
                      if (!isLive || isActive) return;
                      const el = e.currentTarget;
                      el.style.background = `${accent}0a`;
                      el.style.borderColor = `${accent}30`;
                      el.style.color = "rgba(226,232,240,0.65)";
                      el.style.boxShadow = "none";
                    }}
                  >
                    {isTwitch ? (
                      <TwitchIcon
                        size={13}
                        color={isActive ? "#9146FF" : isLive ? "rgba(145,70,255,0.75)" : "rgba(255,255,255,0.18)"}
                      />
                    ) : isYT ? (
                      <YouTubeIcon
                        size={15}
                        color={isActive ? "#FF0000" : isLive ? "rgba(255,0,0,0.6)" : "rgba(255,255,255,0.18)"}
                      />
                    ) : (
                      <span style={{ fontSize: 12, lineHeight: 1 }}>{m.icon}</span>
                    )}
                    {m.label}
                    {isActive && (
                      <span style={{
                        fontSize: 8, fontWeight: 800, letterSpacing: "0.1em",
                        padding: "1px 5px", borderRadius: 4,
                        background: `${accent}44`, color: accent,
                        textTransform: "uppercase",
                      }}>ON</span>
                    )}
                    {!isLive && !isActive && (
                      <span style={{
                        fontSize: 8, fontWeight: 700, letterSpacing: "0.08em",
                        padding: "1px 5px", borderRadius: 4,
                        background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.22)",
                        textTransform: "uppercase",
                      }}>SOON</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/*
          ── Chat tab + panel ──
          Hoisted to the outer body wrapper so they are never clipped and
          always paint above iframes regardless of stacking context.
        */}

        {/* Tab handle */}
        <div
          onClick={() => { setChatOpen(o => !o); setChatUnread(false); }}
          style={{
            position: isMobile ? "fixed" : "absolute",
            right: chatOpen ? (isMobile ? "100%" : CHAT_WIDTH) : 0,
            bottom: isMobile ? 56 : CHAT_HEIGHT_DESKTOP,
            transform: isMobile ? "none" : "translateY(100%)",
            writingMode: "vertical-rl",
            textOrientation: "mixed",
            padding: "14px 8px",
            background: chatOpen ? "rgba(124,58,237,0.22)" : "rgba(124,58,237,0.12)",
            border: "1px solid rgba(124,58,237,0.30)",
            borderRight: "none",
            borderRadius: "10px 0 0 10px",
            color: chatOpen ? "rgba(167,139,250,0.95)" : "rgba(167,139,250,0.60)",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.13em",
            cursor: "pointer",
            userSelect: "none",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            transition: "right 0.34s cubic-bezier(0.22,1,0.36,1), background 0.2s ease, color 0.2s ease",
            zIndex: 100,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 7,
          }}
        >
          {chatUnread && !chatOpen && (
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#a78bfa", boxShadow: "0 0 7px rgba(167,139,250,0.9)", flexShrink: 0 }} />
          )}
          {chatUnreadCount > 0 && !chatOpen && (
            <span style={{
              background: "#7c3aed",
              color: "#fff",
              fontSize: 9,
              fontWeight: 900,
              borderRadius: 6,
              padding: "1px 4px",
              minWidth: 14,
              textAlign: "center",
              writingMode: "horizontal-tb",
              letterSpacing: 0,
              flexShrink: 0,
            }}>
              {chatUnreadCount > 99 ? "99+" : chatUnreadCount}
            </span>
          )}
          <span style={{ writingMode: "horizontal-tb", fontSize: 10, lineHeight: 1 }}>{chatOpen ? "›" : "‹"}</span>
          <span>CHAT</span>
        </div>

        {/* Chat panel — fixed height, bottom-anchored, frosted glass, above everything */}
        <div
          onTouchStart={e => { (e.currentTarget as any)._swipe = { x: e.touches[0].clientX, t: Date.now() }; }}
          onTouchMove={e => {
            const s = (e.currentTarget as any)._swipe; if (!s) return;
            const dx = e.touches[0].clientX - s.x;
            if (dx > 0) { (e.currentTarget as any)._swipeDx = dx; }
          }}
          onTouchEnd={e => {
            const dx = (e.currentTarget as any)._swipeDx || 0;
            const dt = Date.now() - ((e.currentTarget as any)._swipe?.t || Date.now());
            if (dx > 60 || (dx > 20 && dx / Math.max(1, dt) > 0.3)) setChatOpen(false);
            (e.currentTarget as any)._swipe = null;
            (e.currentTarget as any)._swipeDx = 0;
          }}
          className={chatFullscreen ? "weered-chat-fullscreen" : ""}
          style={{
            // Fullscreen overrides everything else — fixed viewport overlay
            // that covers the main content + right rail, leaves the left
            // rail alone. The CSS class handles responsive left offsets.
            ...(chatFullscreen ? {
              position: "fixed",
              top: 0, right: 0, bottom: 0,
              // left handled by CSS class for responsiveness
              width: "auto",
              height: "auto",
              borderLeft: "1px solid rgba(124,58,237,0.22)",
              borderTop: "none",
              borderRadius: 0,
              background: "rgba(8,8,20,0.97)",
              backdropFilter: "blur(28px) saturate(1.6)",
              WebkitBackdropFilter: "blur(28px) saturate(1.6)",
              display: "flex",
              flexDirection: "column" as const,
              zIndex: 120,
              transition: "none",
              overflow: "hidden",
            } : {
              position: isMobile ? "fixed" as const : "absolute" as const,
              bottom: isMobile ? 56 : 0,
              right: 0,
              ...(isMobile
                ? { top: 0, left: 0, width: chatOpen ? "100%" : 0 }
                : { height: CHAT_HEIGHT_DESKTOP, width: chatOpen ? CHAT_WIDTH : 0 }
              ),
              overflow: "hidden",
              borderLeft: chatOpen && !isMobile ? "1px solid rgba(124,58,237,0.22)" : "none",
              borderTop: chatOpen && !isMobile ? "1px solid rgba(124,58,237,0.15)" : "none",
              borderRadius: chatOpen && !isMobile ? "10px 0 0 0" : 0,
              background: isMobile ? "rgba(8,8,20,0.97)" : "rgba(8,8,20,0.52)",
              backdropFilter: "blur(28px) saturate(1.6)",
              WebkitBackdropFilter: "blur(28px) saturate(1.6)",
              display: "flex",
              flexDirection: "column" as const,
              zIndex: 99,
              transition: "width 0.34s cubic-bezier(0.22,1,0.36,1)",
            })
          }}
        >
          {chatOpen && (
            <>
              {/* Swipe hint — mobile only, faint watermark */}
              {isMobile && (
                <div style={{
                  position: "absolute", inset: 0, zIndex: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  pointerEvents: "none", opacity: 0.14,
                  flexDirection: "column", gap: 6,
                }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#a78bfa" }}>
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "#a78bfa" }}>swipe to close</span>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px 8px", borderBottom: "1px solid rgba(124,58,237,0.12)", flexShrink: 0, position: "relative", zIndex: 1, gap: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: "rgba(167,139,250,0.7)", letterSpacing: "0.10em", textTransform: "uppercase" }}>
                  Chat{chatFullscreen ? " · Fullscreen" : ""}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    onClick={toggleChatFullscreen}
                    title={chatFullscreen ? "Collapse chat (Esc)" : "Go fullscreen — room to breathe"}
                    aria-label={chatFullscreen ? "Collapse chat" : "Go fullscreen"}
                    className="weered-chat-fullscreen-cta"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "5px 12px 5px 10px",
                      borderRadius: 7,
                      border: `1px solid ${chatFullscreen ? "rgba(124,58,237,0.6)" : "rgba(124,58,237,0.45)"}`,
                      background: chatFullscreen
                        ? "linear-gradient(135deg, rgba(124,58,237,0.35), rgba(167,139,250,0.22))"
                        : "linear-gradient(135deg, rgba(124,58,237,0.22), rgba(167,139,250,0.10))",
                      color: chatFullscreen ? "rgba(237,223,255,1)" : "rgba(196,181,253,0.95)",
                      fontFamily: "inherit",
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      cursor: "pointer",
                      boxShadow: chatFullscreen
                        ? "0 0 12px rgba(124,58,237,0.35), inset 0 1px 0 rgba(255,255,255,0.08)"
                        : "0 0 8px rgba(124,58,237,0.18), inset 0 1px 0 rgba(255,255,255,0.05)",
                      transition: "all .15s",
                    }}
                  >
                    {chatFullscreen ? (
                      <>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                        <span>Collapse</span>
                      </>
                    ) : (
                      <>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                        <span>Dial In</span>
                      </>
                    )}
                  </button>
                  {!chatFullscreen && (
                    <button
                      onClick={() => setChatOpen(false)}
                      title="Close chat"
                      style={{ width: 22, height: 22, borderRadius: 5, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "rgba(148,163,184,0.5)", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      &times;
                    </button>
                  )}
                </div>
              </div>
              <RoomChatPanel
                roomId={roomId}
                style={{ flex: 1, minHeight: 0, overflow: "hidden", position: "relative", zIndex: 1 }}
              />
            </>
          )}
        </div>

      </div>

      {/* ── Bottom module pills — root level so never clipped ── */}
      <div style={{ flexShrink: 0, borderTop: "1px solid rgba(255,255,255,0.07)", padding: "10px 16px 8px", background: "rgba(10,10,18,0.95)", zIndex: 20 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          {MODULES.map((m) => {
            const isActive = stageMode === m.id;
            const isLive = m.live;
            const isTwitch = m.icon === "__twitch__";
            const isYT = m.icon === "__youtube__";
            const accent = isTwitch ? "#9146FF" : isYT ? "#FF0000" : m.id === "voice" ? "#22c55e" : m.id === "browser" ? "#38bdf8" : "#7C3AED";
            return (
              <button key={m.id} type="button" disabled={!isLive} onClick={() => isLive && handleModuleClick(m.id)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "6px 14px", borderRadius: 999, fontSize: 11, fontWeight: 700,
                  letterSpacing: "0.04em", fontFamily: "monospace", cursor: isLive ? "pointer" : "default",
                  transition: "all 0.15s ease",
                  border: isActive ? `1px solid ${accent}66` : "1px solid rgba(255,255,255,0.06)",
                  background: isActive ? `${accent}22` : "rgba(255,255,255,0.02)",
                  color: isActive ? accent : isLive ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.15)",
                }}
              >
                {isTwitch ? <TwitchIcon size={13} color={isActive ? "#9146FF" : isLive ? "rgba(145,70,255,0.75)" : "rgba(255,255,255,0.18)"} />
                  : isYT ? <YouTubeIcon size={15} color={isActive ? "#FF0000" : isLive ? "rgba(255,0,0,0.6)" : "rgba(255,255,255,0.18)"} />
                  : <span style={{ fontSize: 12, lineHeight: 1 }}>{m.icon}</span>}
                {m.label}
                {isActive && <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: "0.1em", padding: "1px 5px", borderRadius: 4, background: `${accent}44`, color: accent, textTransform: "uppercase" }}>ON</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Floating voice pill — connected to a DIFFERENT room ── */}
      {voice.connState === "connected" && voice.activeRoomId && voice.activeRoomId !== roomId && (
        <div style={{
          position: "fixed", bottom: 80, right: 16, zIndex: 9999,
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 14px",
          background: "rgba(8,8,16,0.92)",
          border: "1px solid rgba(34,197,94,0.35)",
          borderRadius: 12,
          backdropFilter: "blur(16px)",
          boxShadow: "0 0 20px rgba(34,197,94,0.15)",
          minWidth: 220,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px #22c55e", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, color: "rgba(134,239,172,0.7)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Voice connected</div>
            <div style={{ fontSize: 12, color: "rgba(226,232,240,0.8)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{voice.activeRoomId}</div>
          </div>
          <button onClick={() => voice.toggleMute()} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)", color: "rgba(226,232,240,0.7)", fontSize: 11, cursor: "pointer" }}>
            {voice.muted ? "🔇" : "🎙"}
          </button>
          <button onClick={() => voice.disconnect()} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.1)", color: "#fca5a5", fontSize: 11, cursor: "pointer" }}>
            &times;
          </button>
        </div>
      )}

    </div>
  );
}

// ── Room Member Toolbar ────────────────────────────────────────────────
// Slim bar mounted below the room header. Member-facing actions only —
// solo viewing toggle (always shown) and raise-hand (only in QUEUED mode
// when the user isn't already a speaker/mod/owner). Owner/mod controls
// stay in the Details panel.

function RoomMemberToolbar({
  soloViewing,
  setSoloViewing,
  voiceState,
  isOwner,
  isMod,
  meId,
  onRaise,
  onLower,
}: {
  soloViewing: boolean;
  setSoloViewing: (v: boolean) => void;
  voiceState: { mode: "OPEN" | "QUEUED" | "LISTEN_ONLY"; queue: string[]; speakers: string[] } | null | undefined;
  isOwner: boolean;
  isMod: boolean;
  meId: string;
  onRaise: () => void;
  onLower: () => void;
}) {
  const mode = voiceState?.mode || "OPEN";
  const queue = voiceState?.queue || [];
  const speakers = voiceState?.speakers || [];
  const handRaised = queue.includes(meId);
  const isSpeaker = speakers.includes(meId);

  // What goes here:
  //   - Solo viewing toggle: always visible (per-user preference)
  //   - Raise hand: only in QUEUED mode for non-mod non-speaker
  //   - Speaker badge: in QUEUED mode if you're an approved speaker
  const showRaise   = mode === "QUEUED" && !isMod && !isOwner && !isSpeaker;
  const showSpeaker = mode === "QUEUED" && isSpeaker && !isMod && !isOwner;

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 border-b border-white/[0.05]" style={{ background: "rgba(8,8,14,0.4)" }}>
      <button
        type="button"
        onClick={() => setSoloViewing(!soloViewing)}
        title={soloViewing
          ? "Solo viewing on — your module switches don't broadcast and others' don't affect you."
          : "Sync viewing — module switches are shared with the room."}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase transition-colors ${
          soloViewing
            ? "border-violet-400/40 bg-violet-500/[0.10] text-violet-200"
            : "border-white/[0.10] bg-white/[0.02] text-white/45 hover:bg-white/[0.05]"
        }`}
      >
        <span style={{ fontSize: 11 }}>{soloViewing ? "◉" : "○"}</span>
        {soloViewing ? "Solo" : "Synced"}
      </button>

      {showRaise && (
        <button
          type="button"
          onClick={handRaised ? onLower : onRaise}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-[10px] font-semibold tracking-wider uppercase transition-colors ${
            handRaised
              ? "border-amber-300/45 bg-amber-400/15 text-amber-100"
              : "border-amber-300/30 bg-amber-400/[0.06] text-amber-200/85 hover:bg-amber-400/15"
          }`}
        >
          <span style={{ fontSize: 11 }}>✋</span>
          {handRaised ? `Hand raised · #${queue.indexOf(meId) + 1}` : "Raise hand"}
        </button>
      )}

      {showSpeaker && (
        <span
          title="Mod approved you to speak. You can broadcast voice now."
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/[0.08] px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase text-emerald-200/85"
        >
          <span style={{ fontSize: 11 }}>●</span> Approved speaker
        </span>
      )}

      {mode === "LISTEN_ONLY" && !isMod && !isOwner && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase text-white/35">
          Listen only
        </span>
      )}
    </div>
  );
}

