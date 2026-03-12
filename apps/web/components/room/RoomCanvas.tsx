"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useWeered } from "../WeeredProvider";
import RoomHeader from "./RoomHeader";
import RoomChatPanel from "../RoomChatPanel";
import RoomStage, { StageMode } from "./RoomStage";
import { useOverlay } from "../overlays/OverlayProvider";
import { useVoice } from "../VoiceContext";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeCopy(s: string) {
  try { navigator.clipboard?.writeText?.(s); } catch {}
}

function safeJsonParse<T>(s: string | null, fallback: T): T {
  try { if (!s) return fallback; return JSON.parse(s) as T; } catch { return fallback; }
}

// ─── Module pill definitions ──────────────────────────────────────────────────

const MODULES: { id: NonNullable<StageMode>; label: string; icon: string; live: boolean }[] = [
  { id: "voice",   icon: "🎙", label: "Voice",   live: true  },
  { id: "youtube", icon: "▶",  label: "YouTube", live: true  },
  { id: "browser", icon: "🌐", label: "Browser", live: true  },
  { id: "screen",  icon: "🖥", label: "Screen",  live: false },
  { id: "video",   icon: "📹", label: "Video",   live: false },
];

const ROOM_NAME_CACHE_KEY = "weered:roomnames:v1";

// Chat panel dimensions
const CHAT_WIDTH  = 580;
const CHAT_HEIGHT = 420;

// ─── Component ────────────────────────────────────────────────────────────────

export default function RoomCanvas({ roomId }: { roomId: string }) {
  const w: any = useWeered();
  const { openSheet } = useOverlay();
  const voice = useVoice();
  const [stageMode, setStageMode] = useState<StageMode>(null);

  const [articleUrl, setArticleUrl]     = useState<string>("");
  const [browserUrl, setBrowserUrl]     = useState<string>("");
  const [browserInput, setBrowserInput] = useState<string>("");
  const [iframeBlocked, setIframeBlocked] = useState(false);

  // Chat state — open by default
  const [chatOpen, setChatOpen]         = useState(true);
  const [chatUnread, setChatUnread]     = useState(false);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);

  const [voicePrompt, setVoicePrompt] = useState(true);

  function toEmbedUrl(url: string): string {
    try {
      const u = new URL(url);
      if (u.hostname.includes("youtube.com") && u.searchParams.get("v")) {
        return `https://www.youtube.com/embed/${u.searchParams.get("v")}?autoplay=0`;
      }
      if (u.hostname.includes("youtu.be")) {
        return `https://www.youtube.com/embed${u.pathname}?autoplay=0`;
      }
    } catch {}
    return url;
  }

  useEffect(() => {
    const art = new URLSearchParams(window.location.search).get("article");
    if (art) {
      const decoded = decodeURIComponent(art);
      setArticleUrl(decoded);
      setBrowserUrl(decoded);
      setBrowserInput(decoded);
      setIframeBlocked(false);
      setStageMode("browser");
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
  const [showDetails, setShowDetails] = useState(false);

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
    setStageMode(prev => prev === id ? null : id);
  };

  const stageActive = stageMode !== null;

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/room/${encodeURIComponent(roomId)}`
    : "";

  // ─── Details panel ────────────────────────────────────────────────────────
  const detailsPanel = (
    <div className="flex flex-col gap-3 overflow-y-auto flex-1 min-h-0 pr-0.5">
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
        <div className="text-[10px] font-semibold tracking-widest uppercase text-white/35 mb-1.5">Room</div>
        <div className="text-sm font-semibold truncate mb-0.5">{roomLabel}</div>
        <div className="text-[11px] text-white/35 truncate font-mono mb-2">{roomId}</div>
        <div className="flex gap-2">
          <button type="button" onClick={() => safeCopy(roomId)} className="text-[11px] rounded-full border border-white/10 px-2.5 py-1 hover:bg-white/[0.07] text-white/50 transition-colors">Copy id</button>
          <button type="button" onClick={() => safeCopy(shareUrl)} className="text-[11px] rounded-full border border-white/10 px-2.5 py-1 hover:bg-white/[0.07] text-white/50 transition-colors">Copy link</button>
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] font-semibold tracking-widest uppercase text-white/35">About</div>
          <span className="text-[9px] rounded-full border border-white/10 px-2 py-0.5 text-white/30">local</span>
        </div>
        <textarea
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          rows={3}
          placeholder="Description, rules, context..."
          className="w-full rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2 text-[12px] text-white/70 placeholder:text-white/25 outline-none focus:border-white/20 resize-none"
        />
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] font-semibold tracking-widest uppercase text-white/35">Links</div>
          <span className="text-[9px] rounded-full border border-white/10 px-2 py-0.5 text-white/30">local</span>
        </div>
        <div className="flex gap-2 mb-2">
          <input
            value={newLink}
            onChange={(e) => setNewLink(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addLink()}
            placeholder="Paste a link..."
            className="flex-1 rounded-lg border border-white/[0.08] bg-black/20 px-3 py-1.5 text-[12px] text-white/70 placeholder:text-white/25 outline-none focus:border-white/20"
          />
          <button type="button" onClick={addLink} className="rounded-lg border border-violet-300/20 bg-violet-500/10 px-3 py-1.5 text-[12px] text-violet-200/70 font-semibold hover:bg-violet-500/15 transition-colors">Add</button>
        </div>
        {links.length > 0 ? (
          <div className="space-y-1.5">
            {links.map((v) => (
              <div key={v} className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-black/10 px-3 py-2">
                <a className="text-[12px] text-white/60 truncate flex-1 hover:underline" href={v} target="_blank" rel="noreferrer">{v}</a>
                <button type="button" onClick={() => safeCopy(v)} className="text-[10px] text-white/35 hover:text-white/60 flex-shrink-0">copy</button>
                <button type="button" onClick={() => removeLink(v)} className="text-[10px] text-white/35 hover:text-red-400/70 flex-shrink-0">&times;</button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[12px] text-white/25">No links yet.</div>
        )}
      </div>
    </div>
  );

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-w-0 h-full overflow-hidden">

      {/* ── Header ── */}
      <RoomHeader
        title={roomLabel}
        memberCount={memberCount}
        locked={locked}
        onInvite={() => {}}
        pills={MODULES.map(m => ({ ...m, active: stageMode === m.id }))}
        onPillClick={(id) => handleModuleClick(id as NonNullable<StageMode>)}
        onDetailsClick={() => setShowDetails(d => !d)}
        showDetails={showDetails}
      />

      {/* ── Voice available prompt ── */}
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
          "flex-shrink-0 border-b border-white/[0.07] transition-all duration-300 ease-in-out overflow-hidden",
          stageActive ? "bg-black/30" : "bg-transparent",
        ].join(" ")}
        style={{ height: stageActive ? (stageMode === "youtube" ? "clamp(320px, 52vh, 560px)" : stageMode === "browser" ? "clamp(300px, 55vh, 600px)" : "clamp(180px, 35vh, 320px)") : "40px" }}
      >
        {!stageActive && (
          <div className="flex items-center px-4 h-10">
            <span className="text-[9px] font-bold tracking-[0.14em] uppercase text-white/20">
              Stage -- activate a module below
            </span>
          </div>
        )}

        {stageActive && stageMode !== "browser" && (
          <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column" }}>
            <RoomStage roomId={roomId} mode={stageMode} onClose={() => setStageMode(null)} />
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
                  }
                }}
                style={{ flex: 1, padding: "4px 8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, color: "rgba(203,213,225,0.8)", fontSize: 11, outline: "none", fontFamily: "monospace" }}
              />
              <button onClick={() => window.open(browserUrl, "_blank")} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "rgba(148,163,184,0.6)", fontSize: 11, cursor: "pointer" }}>&#8599;</button>
              <button onClick={() => setStageMode(null)} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "rgba(148,163,184,0.6)", fontSize: 11, cursor: "pointer" }}>&times;</button>
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
              return (
                <iframe
                  key={browserUrl}
                  src={toEmbedUrl(browserUrl)}
                  style={{ flex: 1, border: "none", display: "block", width: "100%", background: "#fff" }}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation"
                  title="Browser"
                  onError={() => setIframeBlocked(true)}
                />
              );
            })()}
          </div>
        )}
      </div>

      {/* ── Main body ── */}
      {/*
        Chat panel and tab live here at the outer level so they are never
        clipped by the center column and always paint above the iframe.
        position:relative on this wrapper is the stacking root.
      */}
      <div className="flex flex-1 min-h-0" style={{ position: "relative", overflow: "visible" }}>

        {/* ── Center column — no overflow:hidden so chat can escape ── */}
        <div className="flex flex-col flex-1 min-w-0 min-h-0" style={{ position: "relative" }}>

          {/* Spacer */}
          <div className="flex-1 min-h-0" />

          {/* ── Bottom pills — always visible ── */}
          <div className="flex-shrink-0 border-t border-white/[0.07] px-4 pt-2.5 pb-2">
            <div className="flex flex-wrap gap-1.5">
              {MODULES.map((m) => {
                const isActive = stageMode === m.id;
                const isLive   = m.live;
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={!isLive}
                    onClick={() => isLive && handleModuleClick(m.id)}
                    className={[
                      "text-[10px] font-bold tracking-wide px-2.5 py-1 rounded-full border transition-all duration-150 font-mono",
                      isActive
                        ? "border-violet-400/35 bg-violet-500/15 text-violet-200"
                        : isLive
                          ? "border-green-500/25 bg-green-500/[0.06] text-green-300/60 hover:bg-green-500/12 hover:text-green-200 cursor-pointer"
                          : "border-white/[0.06] text-white/20 cursor-default",
                    ].join(" ")}
                  >
                    {m.icon} {m.label}
                    {isActive && <span className="ml-1 text-[9px]">on</span>}
                    {!isLive && !isActive && <span className="ml-1 text-[8px] opacity-40">soon</span>}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setShowDetails(d => !d)}
                className={[
                  "text-[10px] font-bold tracking-wide px-2.5 py-1 rounded-full border transition-all duration-150 ml-auto font-mono",
                  showDetails ? "border-white/20 bg-white/[0.08] text-white/70" : "border-white/[0.06] text-white/25 hover:text-white/50 hover:border-white/15",
                ].join(" ")}
              >
                {showDetails ? "close details" : "... details"}
              </button>
            </div>
          </div>
        </div>

        {/* ── Details side panel ── */}
        <div
          className="flex-shrink-0 border-l border-white/[0.07] overflow-hidden transition-all duration-300 ease-in-out"
          style={{ width: showDetails ? 240 : 0 }}
        >
          <div className="w-[240px] h-full overflow-y-auto p-3 flex flex-col gap-0">
            <div className="text-[10px] font-bold tracking-[0.12em] uppercase text-white/30 mb-3">Details</div>
            {detailsPanel}
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
            position: "absolute",
            right: chatOpen ? CHAT_WIDTH : 0,
            bottom: CHAT_HEIGHT,
            transform: "translateY(100%)",
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
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            height: CHAT_HEIGHT,
            width: chatOpen ? CHAT_WIDTH : 0,
            overflow: "hidden",
            borderLeft: chatOpen ? "1px solid rgba(124,58,237,0.22)" : "none",
            borderTop: chatOpen ? "1px solid rgba(124,58,237,0.15)" : "none",
            borderRadius: chatOpen ? "10px 0 0 0" : 0,
            background: "rgba(8,8,20,0.52)",
            backdropFilter: "blur(28px) saturate(1.6)",
            WebkitBackdropFilter: "blur(28px) saturate(1.6)",
            display: "flex",
            flexDirection: "column",
            zIndex: 99,
            transition: "width 0.34s cubic-bezier(0.22,1,0.36,1)",
          }}
        >
          {chatOpen && (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px 8px", borderBottom: "1px solid rgba(124,58,237,0.12)", flexShrink: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: "rgba(167,139,250,0.7)", letterSpacing: "0.10em", textTransform: "uppercase" }}>Chat</span>
                <button
                  onClick={() => setChatOpen(false)}
                  style={{ width: 20, height: 20, borderRadius: 5, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "rgba(148,163,184,0.5)", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  &times;
                </button>
              </div>
              <RoomChatPanel
                roomId={roomId}
                style={{ flex: 1, minHeight: 0, overflow: "hidden" }}
              />
            </>
          )}
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
