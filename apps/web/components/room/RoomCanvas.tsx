"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useWeered } from "../WeeredProvider";
import RoomHeader from "./RoomHeader";
import RoomChatPanel from "../RoomChatPanel";
import RoomStage, { StageMode } from "./RoomStage";
import { useOverlay } from "../overlays/OverlayProvider";

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

// ─── Component ────────────────────────────────────────────────────────────────

export default function RoomCanvas({ roomId }: { roomId: string }) {
  const w: any = useWeered();
  const { openSheet } = useOverlay();
  const [stageMode, setStageMode] = useState<StageMode>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  // Article URL from ?article= param — auto-activates browser module
  const [articleUrl, setArticleUrl] = useState<string>("");
  const [browserUrl, setBrowserUrl] = useState<string>("");
  const [browserInput, setBrowserInput] = useState<string>("");

  // Two independent chat drawers
  const [chatSide, setChatSide]     = useState(false); // right → slides left
  const [chatBottom, setChatBottom] = useState(false); // bottom → slides up

  useEffect(() => {
    const art = new URLSearchParams(window.location.search).get("article");
    if (art) {
      const decoded = decodeURIComponent(art);
      setArticleUrl(decoded);
      setBrowserUrl(decoded);
      setBrowserInput(decoded);
      setStageMode("browser");
    }
  }, []);

  // ── Derived room label ──
  const roomLabel = useMemo(() => {
    const name = String(w?.meta?.name || w?.meta?.title || w?.meta?.label || w?.admin?.name || "").trim();
    if (name) return name;
    try { return decodeURIComponent(roomId || ""); } catch { return roomId || ""; }
  }, [w?.meta?.name, w?.meta?.title, w?.meta?.label, w?.admin?.name, roomId]);

  // ── Cache resolved room name for recents/favorites ──
  useEffect(() => {
    if (!roomId || !roomLabel || roomLabel === roomId) return;
    try {
      const cache = JSON.parse(localStorage.getItem(ROOM_NAME_CACHE_KEY) || "{}");
      if (cache[roomId] === roomLabel) return;
      cache[roomId] = roomLabel;
      localStorage.setItem(ROOM_NAME_CACHE_KEY, JSON.stringify(cache));
    } catch {}
  }, [roomId, roomLabel]);

  const memberCount = Array.isArray(w?.users) ? w.users.length : 0;
  const locked      = Boolean(w?.meta?.locked);

  // ── Details panel state (localStorage-backed, per room) ──
  const aboutKey = `weered.room.about.${roomId}`;
  const linksKey = `weered.room.links.${roomId}`;

  const [about,   setAbout  ] = useState("");
  const [links,   setLinks  ] = useState<string[]>([]);
  const [newLink, setNewLink] = useState("");
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

  // ── Toggle stage mode (toggle off if already active) ──
  const handleModuleClick = (id: NonNullable<StageMode>) => {
    setStageMode(prev => prev === id ? null : id);
  };

  const stageActive = stageMode !== null;

  // ─── Details side panel ────────────────────────────────────────────────────
  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/room/${encodeURIComponent(roomId)}`
    : "";

  const detailsPanel = (
    <div className="flex flex-col gap-3 overflow-y-auto flex-1 min-h-0 pr-0.5">
      {/* Room meta */}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
        <div className="text-[10px] font-semibold tracking-widest uppercase text-white/35 mb-1.5">Room</div>
        <div className="text-sm font-semibold truncate mb-0.5">{roomLabel}</div>
        <div className="text-[11px] text-white/35 truncate font-mono mb-2">{roomId}</div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => safeCopy(roomId)}
            className="text-[11px] rounded-full border border-white/10 px-2.5 py-1 hover:bg-white/[0.07] text-white/50 transition-colors"
          >
            Copy id
          </button>
          <button
            type="button"
            onClick={() => safeCopy(shareUrl)}
            className="text-[11px] rounded-full border border-white/10 px-2.5 py-1 hover:bg-white/[0.07] text-white/50 transition-colors"
          >
            Copy link
          </button>
        </div>
      </div>

      {/* About */}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] font-semibold tracking-widest uppercase text-white/35">About</div>
          <span className="text-[9px] rounded-full border border-white/10 px-2 py-0.5 text-white/30">local</span>
        </div>
        <textarea
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          rows={3}
          placeholder="Description, rules, context…"
          className="w-full rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2 text-[12px] text-white/70 placeholder:text-white/25 outline-none focus:border-white/20 resize-none"
        />
      </div>

      {/* Links */}
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
            placeholder="Paste a link…"
            className="flex-1 rounded-lg border border-white/[0.08] bg-black/20 px-3 py-1.5 text-[12px] text-white/70 placeholder:text-white/25 outline-none focus:border-white/20"
          />
          <button
            type="button"
            onClick={addLink}
            className="rounded-lg border border-violet-300/20 bg-violet-500/10 px-3 py-1.5 text-[12px] text-violet-200/70 font-semibold hover:bg-violet-500/15 transition-colors"
          >
            Add
          </button>
        </div>
        {links.length > 0 ? (
          <div className="space-y-1.5">
            {links.map((v) => (
              <div key={v} className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-black/10 px-3 py-2">
                <a className="text-[12px] text-white/60 truncate flex-1 hover:underline" href={v} target="_blank" rel="noreferrer">{v}</a>
                <button type="button" onClick={() => safeCopy(v)} className="text-[10px] text-white/35 hover:text-white/60 flex-shrink-0">copy</button>
                <button type="button" onClick={() => removeLink(v)} className="text-[10px] text-white/35 hover:text-red-400/70 flex-shrink-0">✕</button>
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

      {/* ── Single header bar ── */}
      <RoomHeader
        title={roomLabel}
        memberCount={memberCount}
        locked={locked}
        onInvite={() => {/* TODO: invite system */}}
      />

      {/* ── Stage zone ── */}
      {/*
        Passive: slim bar showing module pills — click to activate.
        Active:  expands to show RoomStage content; chat compresses below.
      */}
      <div
        className={[
          "flex-shrink-0 border-b border-white/[0.07] transition-all duration-300 ease-in-out overflow-hidden",
          stageActive ? "bg-black/30" : "bg-transparent",
        ].join(" ")}
        style={{ height: stageActive ? "clamp(180px, 35vh, 320px)" : "40px" }}
      >
        {/* Idle label — only shown when no stage active */}
        {!stageActive && (
          <div className="flex items-center px-4 h-10">
            <span className="text-[9px] font-bold tracking-[0.14em] uppercase text-white/20">
              Stage — activate a module below ↓
            </span>
          </div>
        )}

        {/* Stage content — rendered when active */}
        {stageActive && stageMode !== "browser" && (
          <div className="absolute inset-0 flex flex-col" style={{ position: "relative" }}>
            <RoomStage
              roomId={roomId}
              mode={stageMode}
              onClose={() => setStageMode(null)}
            />
          </div>
        )}

        {/* Browser module */}
        {stageActive && stageMode === "browser" && (
          <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column" }}>
            {/* Browser chrome */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", background: "rgba(0,0,0,0.4)", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
              <span style={{ fontSize: 11, color: "rgba(100,116,139,0.4)" }}>🔒</span>
              <input
                value={browserInput}
                onChange={e => setBrowserInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { let u = browserInput.trim(); if (!u.startsWith("http")) u = "https://" + u; setBrowserUrl(u); setBrowserInput(u); }}}
                style={{ flex: 1, padding: "4px 8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, color: "rgba(203,213,225,0.8)", fontSize: 11, outline: "none", fontFamily: "monospace" }}
              />
              <button onClick={() => window.open(browserUrl, "_blank")} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "rgba(148,163,184,0.6)", fontSize: 11, cursor: "pointer" }}>↗</button>
              <button onClick={() => setStageMode(null)} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "rgba(148,163,184,0.6)", fontSize: 11, cursor: "pointer" }}>✕</button>
            </div>
            <iframe
              key={browserUrl}
              src={browserUrl}
              style={{ flex: 1, border: "none", display: "block", width: "100%", background: "#fff" }}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation"
              title="Browser"
            />
          </div>
        )}
      </div>

      {/* ── Main body ── */}
<div className="flex flex-1 min-h-0 overflow-hidden" style={{ position: "relative" }}>

        {/* Center column: just the input zone at bottom, no static chat */}
        <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden" style={{ position: "relative" }}>

          {/* Spacer — fills the center when no static chat */}
          <div className="flex-1 min-h-0" />

          {/* Input zone */}
          <div className="flex-shrink-0 border-t border-white/[0.07] px-4 pt-2.5 pb-2">
            {/* Module pills */}
            <div className="flex flex-wrap gap-1.5 mb-2.5">
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

              {/* Details toggle */}
              <button
                type="button"
                onClick={() => setShowDetails(d => !d)}
                className={[
                  "text-[10px] font-bold tracking-wide px-2.5 py-1 rounded-full border transition-all duration-150 ml-auto font-mono",
                  showDetails
                    ? "border-white/20 bg-white/[0.08] text-white/70"
                    : "border-white/[0.06] text-white/25 hover:text-white/50 hover:border-white/15",
                ].join(" ")}
              >
                {showDetails ? "✕ details" : "· · · details"}
              </button>
            </div>

            {/* Text input */}
            <div className="flex gap-2 items-end">
              <textarea
                rows={1}
                placeholder={`Message ${roomLabel}…`}
                className="flex-1 rounded-lg border border-white/[0.09] bg-white/[0.04] px-3 py-2 text-[13px] text-white/80 placeholder:text-white/25 outline-none focus:border-violet-500/30 resize-none leading-snug transition-colors"
                style={{ maxHeight: 100 }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = Math.min(el.scrollHeight, 100) + "px";
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    const val = e.currentTarget.value.trim();
                    if (val) { w?.sendChat?.(val); e.currentTarget.value = ""; e.currentTarget.style.height = "auto"; }
                  }
                }}
              />
              <button
                type="button"
                className="flex-shrink-0 rounded-lg bg-violet-600 hover:bg-violet-500 px-4 py-2 text-[12px] font-bold text-white transition-colors h-[38px]"
                onClick={(e) => {
                  const ta = e.currentTarget.previousElementSibling as HTMLTextAreaElement;
                  const val = ta?.value?.trim();
                  if (val) { w?.sendChat?.(val); ta.value = ""; ta.style.height = "auto"; }
                }}
              >
                Send
              </button>
            </div>
          </div>

          {/* ── Side chat tab (right edge → slides left) ── */}
          <div
            onClick={() => setChatSide(o => !o)}
            style={{
              position: "absolute", right: chatSide ? "min(300px, 35%)" : 0, top: "50%",
              transform: "translateY(-50%) rotate(180deg)",
              writingMode: "vertical-rl", textOrientation: "mixed",
              padding: "14px 7px",
              background: "rgba(124,58,237,0.15)",
              border: "1px solid rgba(124,58,237,0.28)", borderRight: "none",
              borderRadius: "10px 0 0 10px",
              color: "rgba(167,139,250,0.85)",
              fontSize: 10, fontWeight: 800, letterSpacing: "0.12em",
              cursor: "pointer", userSelect: "none",
              backdropFilter: "blur(8px)",
              transition: "right 0.36s cubic-bezier(0.22,1,0.36,1)",
              zIndex: 40, display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <span>←</span>
            <span>CHAT</span>
          </div>

          {/* ── Bottom chat tab (bottom edge → slides up) ── */}
          <div
            onClick={() => setChatBottom(o => !o)}
            style={{
              position: "absolute", bottom: chatBottom ? "min(260px, 40%)" : 0, left: "50%",
              transform: "translateX(-50%)",
              padding: "7px 16px",
              background: "rgba(124,58,237,0.15)",
              border: "1px solid rgba(124,58,237,0.28)", borderBottom: "none",
              borderRadius: "10px 10px 0 0",
              color: "rgba(167,139,250,0.85)",
              fontSize: 10, fontWeight: 800, letterSpacing: "0.12em",
              cursor: "pointer", userSelect: "none" as const,
              backdropFilter: "blur(8px)",
              transition: "bottom 0.36s cubic-bezier(0.22,1,0.36,1)",
              zIndex: 40, display: "flex", alignItems: "center", gap: 6,
              whiteSpace: "nowrap",
            }}
          >
            <span>↑</span>
            <span>CHAT</span>
          </div>

          {/* ── Side chat panel ── */}
          {chatSide && (
            <div
              style={{
                position: "absolute", top: 0, right: 0, bottom: 0,
                width: "min(300px, 35%)",
                borderLeft: "1px solid rgba(124,58,237,0.18)",
                background: "rgba(8,8,16,0.82)",
                backdropFilter: "blur(20px) saturate(1.4)",
                display: "flex", flexDirection: "column",
                zIndex: 39,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px 8px", borderBottom: "1px solid rgba(124,58,237,0.12)", flexShrink: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: "rgba(167,139,250,0.7)", letterSpacing: "0.10em", textTransform: "uppercase" }}>Chat</span>
                <button style={{
                  width: 20, height: 20, borderRadius: 5,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.04)",
                  color: "rgba(148,163,184,0.5)",
                  fontSize: 10, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }} onClick={() => setChatSide(false)}>✕</button>
              </div>
              <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
                <RoomChatPanel roomId={roomId} style={{ height: "100%", display: "flex", flexDirection: "column" }} />
              </div>
            </div>
          )}

          {/* ── Bottom chat panel ── */}
          {chatBottom && (
            <div
              style={{
                position: "absolute", left: 0, right: 0, bottom: 0,
                height: "min(260px, 40%)",
                borderTop: "1px solid rgba(124,58,237,0.18)",
                background: "rgba(8,8,16,0.82)",
                backdropFilter: "blur(20px) saturate(1.4)",
                display: "flex", flexDirection: "column",
                zIndex: 38,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 12px 6px", borderBottom: "1px solid rgba(124,58,237,0.12)", flexShrink: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: "rgba(167,139,250,0.7)", letterSpacing: "0.10em", textTransform: "uppercase" }}>Chat</span>
                <button style={{
                  width: 20, height: 20, borderRadius: 5,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.04)",
                  color: "rgba(148,163,184,0.5)",
                  fontSize: 10, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }} onClick={() => setChatBottom(false)}>✕</button>
              </div>
              <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
                <RoomChatPanel roomId={roomId} style={{ height: "100%", display: "flex", flexDirection: "column" }} />
              </div>
            </div>
          )}
        </div>

        {/* Details side panel */}
        <div
          className="flex-shrink-0 border-l border-white/[0.07] overflow-hidden transition-all duration-250 ease-in-out"
          style={{ width: showDetails ? 240 : 0 }}
        >
          <div className="w-[240px] h-full overflow-y-auto p-3 flex flex-col gap-0">
            <div className="text-[10px] font-bold tracking-[0.12em] uppercase text-white/30 mb-3">Details</div>
            {detailsPanel}
          </div>
        </div>

      </div>

      </div>
    </div>
  );
}
