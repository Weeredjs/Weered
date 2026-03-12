"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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

// ─── Component ────────────────────────────────────────────────────────────────

export default function RoomCanvas({ roomId }: { roomId: string }) {
  const w: any = useWeered();
  const { openSheet } = useOverlay();
  const voice = useVoice();
  const [stageMode, setStageMode] = useState<StageMode>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  // Article URL from ?article= param — auto-activates browser module
  const [articleUrl, setArticleUrl] = useState<string>("");
  const [browserUrl, setBrowserUrl] = useState<string>("");
  const [browserInput, setBrowserInput] = useState<string>("");
  const [iframeBlocked, setIframeBlocked] = useState(false);

  // Convert YouTube watch URLs to embeddable format
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

  // Two independent chat drawers
  const [chatOpen, setChatOpen] = useState(true); // full-width overlay, open by default

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
      {/* ── Floating voice pill — shows when in voice for a DIFFERENT room ── */}
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
            <div style={{ fontSize: 12, color: "rgba(226,232,240,0.8)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {voice.activeRoomId}
            </div>
          </div>
          <button
            onClick={() => voice.toggleMute()}
            style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)", color: "rgba(226,232,240,0.7)", fontSize: 11, cursor: "pointer" }}
          >
            {voice.muted ? "🔇" : "🎙"}
          </button>
          <button
            onClick={() => voice.disconnect()}
            style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.1)", color: "#fca5a5", fontSize: 11, cursor: "pointer" }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
