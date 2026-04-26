"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useWeered } from "../../components/WeeredProvider";
import { avatarBg } from "../../lib/avatarColor";
import DmPreviewStrip from "../../components/DmPreviewStrip";
import ActivityFeed from "../../components/ActivityFeed";
import FeatureShowcase from "../../components/FeatureShowcase";
import EmptyState from "../../components/EmptyState";
import VerticalPicker from "../../components/VerticalPicker";

/* ─── helpers ────────────────────────────────────────────── */
function pickFirst(...vals: any[]): string {
  for (const v of vals) if (typeof v === "string" && v.trim()) return v.trim();
  return "";
}
function onlineCount(r: any): number {
  return Number(r?.onlineCount ?? r?.online ?? r?.memberCount ?? r?.count ?? 0);
}
function roomId(r: any): string {
  return pickFirst(r?.id, r?.roomId, "");
}
/** Display name: prefer .name, then fall back to cleaned ID */
function roomName(r: any): string {
  // Prefer explicit name field from API/WS
  const name = pickFirst(r?.name, "");
  if (name) return name;
  // Fallback: strip room: prefix from ID
  const id = roomId(r);
  return id.startsWith("room:") ? id.slice(5) : id;
}
function isPrivateRoom(r: any): boolean {
  const id = roomId(r);
  const name = id.startsWith("room:") ? id.slice(5) : id;
  if (name.startsWith("@")) return true;
  if (/^[a-z0-9]{4,7}$/i.test(name) && !name.includes("/")) return true;
  if (/^test/i.test(name)) return true;
  return false;
}
function isPinned(r: any): boolean {
  return Boolean(r?.pinned);
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5)  return "Late night";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  if (h < 22) return "Good evening";
  return "Late night";
}

function timeAgo(ts: number | string): string {
  const diff = Date.now() - (typeof ts === "string" ? new Date(ts).getTime() : ts);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Heat color based on online count
function heatColor(count: number): string {
  if (count >= 10) return "#ef4444";
  if (count >= 5)  return "#f97316";
  if (count >= 2)  return "#eab308";
  if (count >= 1)  return "#22c55e";
  return "rgba(255,255,255,.15)";
}

function heatLabel(count: number): string {
  if (count >= 10) return "on fire";
  if (count >= 5)  return "hot";
  if (count >= 2)  return "warm";
  if (count >= 1)  return "live";
  return "quiet";
}

// Determine if an accent color is too light for white text
function isLightAccent(hex: string): boolean {
  const h = hex.replace("#", "");
  if (h.length < 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // Relative luminance
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.65;
}

// Lobby accent or fallback
function lobbyAccent(r: any, idx: number): string {
  if (r?.accentColor) return r.accentColor;
  const fallbacks = ["#5800E5", "#22c55e", "#f97316", "#60a5fa", "#ef4444", "#eab308", "#5800E5", "#06b6d4"];
  return fallbacks[idx % fallbacks.length];
}

/* ─── LivePulse dot ──────────────────────────────────────── */
function PulseDot({ color, size = 6 }: { color: string; size?: number }) {
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", width: size, height: size }}>
      <span style={{
        position: "absolute", width: size * 2, height: size * 2, borderRadius: "50%",
        background: color, opacity: 0.3,
        animation: "weered-ripple 2s ease-out infinite",
      }} />
      <span style={{
        width: size, height: size, borderRadius: "50%",
        background: color, boxShadow: `0 0 6px ${color}`,
        position: "relative", zIndex: 1,
      }} />
    </span>
  );
}

/* ─── HeroBanner ─────────────────────────────────────────── */
function HeroBanner({ lobby, onJoin }: { lobby: any; onJoin: (id: string, pinned: boolean) => void }) {
  if (!lobby) return null;
  const name = roomName(lobby);
  const cnt = onlineCount(lobby);
  const accent = lobby?.accentColor || "#5800E5";
  const logo = lobby?.logoUrl;
  const banner = lobby?.bannerUrl;
  const desc = lobby?.description;
  const lightAccent = isLightAccent(accent);
  const btnText = lightAccent ? "#111" : "#fff";

  return (
    <div
      onClick={() => onJoin(roomId(lobby), Boolean(lobby?.pinned))}
      className="weered-featured-card"
      style={{
        position: "relative", borderRadius: 16, overflow: "hidden",
        minHeight: 200, cursor: "pointer",
        border: `1px solid ${accent}22`,
        background: banner
          ? `linear-gradient(135deg, rgba(10,10,15,.7) 0%, rgba(10,10,15,.4) 50%, rgba(10,10,15,.7) 100%)`
          : `linear-gradient(135deg, ${accent}15 0%, rgba(10,10,15,.95) 40%, ${accent}08 100%)`,
        transition: "transform .2s, border-color .2s",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.borderColor = `${accent}44`; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.borderColor = `${accent}22`; }}
    >
      {/* Banner image */}
      {banner && (
        <Image
          src={banner}
          alt={`${roomName(lobby)} lobby banner`}
          fill
          sizes="(max-width: 1024px) 100vw, 720px"
          priority
          style={{ objectFit: "cover", opacity: 0.55, pointerEvents: "none" }}
          unoptimized={banner.startsWith("/")}
        />
      )}

      {/* Ambient effects (only when no banner) */}
      {!banner && (
        <>
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: `radial-gradient(ellipse at 25% 50%, ${accent}20 0%, transparent 55%), radial-gradient(ellipse at 85% 20%, ${accent}10 0%, transparent 40%)` }} />
          <div style={{ position: "absolute", inset: 0, opacity: 0.04, pointerEvents: "none", backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)", backgroundSize: "22px 22px" }} />
        </>
      )}

      {/* Top bar — wraps on narrow viewports so pills don't collide */}
      <div style={{ position: "absolute", top: 14, left: 18, right: 18, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", zIndex: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          {logo && <img src={logo} alt={`${roomName(lobby)} logo`} style={{ width: 22, height: 22, borderRadius: 6, objectFit: "contain", background: "rgba(0,0,0,.3)", flexShrink: 0 }} />}
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(0,0,0,.5)", backdropFilter: "blur(8px)",
            border: `1px solid ${accent}35`,
            borderRadius: 99, padding: "3px 11px",
            fontSize: 10, fontWeight: 800, color: accent, letterSpacing: ".3px",
            whiteSpace: "nowrap",
          }}>
            <PulseDot color={accent} />
            {lobby.pinned ? "FEATURED LOBBY" : "POPULAR"}
          </span>
        </div>
        <div style={{
          background: "rgba(0,0,0,.5)", backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,.08)", borderRadius: 8,
          padding: "4px 10px", fontSize: 11, fontFamily: "monospace",
          color: "rgba(255,255,255,.6)", display: "flex", alignItems: "center", gap: 5,
          whiteSpace: "nowrap", flexShrink: 0,
        }}>
          <PulseDot color="#22c55e" size={5} />
          {cnt} online
        </div>
      </div>

      {/* Spacer so the absolute top bar never overlaps body content when card grows */}
      <div aria-hidden style={{ height: 52 }} />

      {/* Bottom content — flows in normal layout so the card grows to fit */}
      <div style={{ padding: "8px 22px 18px", zIndex: 2, position: "relative", background: "linear-gradient(transparent, rgba(0,0,0,.75))" }}>
        <div style={{ fontWeight: 900, fontSize: 26, lineHeight: 1.1, marginBottom: desc ? 6 : 14, letterSpacing: "-0.5px", textShadow: banner ? "0 2px 8px rgba(0,0,0,.6)" : "none" }}>{name}</div>
        {desc && (
          <div style={{
            fontSize: 12, color: "rgba(232,232,236,.6)", marginBottom: 14, maxWidth: 480,
            lineHeight: 1.4, textShadow: banner ? "0 1px 4px rgba(0,0,0,.5)" : "none",
            display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" as any, overflow: "hidden",
          }}>{desc}</div>
        )}
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onJoin(roomId(lobby), Boolean(lobby?.pinned)); }}
          style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            background: lightAccent ? "#fff" : accent,
            color: btnText,
            border: lightAccent ? "1px solid rgba(255,255,255,.3)" : "none",
            borderRadius: 10,
            padding: "10px 20px", fontWeight: 800, fontSize: 13,
            cursor: "pointer", fontFamily: "inherit",
            boxShadow: `0 4px 16px ${accent}44`,
            transition: "transform .15s, box-shadow .15s",
          }}
        >
          Join {lobby.pinned ? "Lobby" : "Room"}
        </button>
      </div>
    </div>
  );
}

/* ─── LiveRoomCard ───────────────────────────────────────── */
// Right-column card on the home Live Now section. Shows the lobby's
// logo + accent stripe, the room's name + activity, a stack of up to
// four user avatars from the room, and the live headcount.
function LiveRoomCard({ room, onJoin }: { room: any; onJoin: (id: string, pinned: boolean) => void }) {
  const accent = (room?.lobbyAccentColor && /^#[0-9a-f]{6}$/i.test(room.lobbyAccentColor)) ? room.lobbyAccentColor : "#7C3AED";
  const visibleAvatars = (room.avatars || []).slice(0, 4);
  const overflow = Math.max(0, (room.onlineCount || 0) - visibleAvatars.length);

  return (
    <button
      type="button"
      onClick={() => onJoin(room.id, false)}
      style={{
        display: "grid", gridTemplateColumns: "auto 1fr auto", gridTemplateRows: "auto auto",
        gap: "2px 10px", alignItems: "center",
        padding: "8px 12px", borderRadius: 10,
        background: `${accent}08`, border: `1px solid ${accent}24`,
        color: "inherit", cursor: "pointer", fontFamily: "inherit",
        transition: "all .15s",
        width: "100%", textAlign: "left",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${accent}55`; (e.currentTarget as HTMLElement).style.background = `${accent}14`; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = `${accent}24`; (e.currentTarget as HTMLElement).style.background = `${accent}08`; }}
    >
      {/* Lobby logo, spans both rows. Falls back to the Weered W mark for
          unbranded lobbies (e.g. "home") so every card has a real glyph. */}
      <div style={{ gridRow: "1 / span 2", width: 38, height: 38, borderRadius: 8, overflow: "hidden", border: `1px solid ${accent}55`, background: `${accent}10`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={room.lobbyLogoUrl || "/brand/logo/weered-logo-64.png"}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </div>

      {/* Top row: room name + count */}
      <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: "rgba(243,244,246,.96)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
          {room.name}
        </span>
      </div>
      <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontFamily: "ui-monospace, monospace", fontWeight: 700, color: "#22c55e", flexShrink: 0 }}>
        <PulseDot color="#22c55e" size={5} />
        {room.onlineCount}
      </span>

      {/* Bottom row: lobby name · activity + avatar stack */}
      <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "rgba(255,255,255,.5)" }}>
        {room.lobbyName && (
          <>
            <span style={{ fontWeight: 700, color: `${accent}d0`, letterSpacing: "0.4px", textTransform: "uppercase", fontSize: 9, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{room.lobbyName}</span>
            <span style={{ opacity: 0.4 }}>·</span>
          </>
        )}
        <span style={{ fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{room.activity}</span>
      </div>

      {/* Avatar stack — right side of bottom row, larger so the room reads
          as "people are here" rather than just a count. Avatars without an
          uploaded image fall back to their avatarColor + initial. */}
      <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
        {visibleAvatars.map((a: any, i: number) => (
          <div
            key={a.id || i}
            title={a.name}
            style={{
              width: 26, height: 26, borderRadius: "50%",
              marginLeft: i === 0 ? 0 : -8,
              background: a.avatar ? "rgba(255,255,255,.08)" : (a.avatarColor || "#5800E5"),
              border: "2px solid rgba(10,10,18,.95)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 800, color: "#fff",
              overflow: "hidden",
              zIndex: visibleAvatars.length - i,
              boxShadow: "0 1px 3px rgba(0,0,0,.4)",
            }}
          >
            {a.avatar
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={a.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : (a.name || "?").slice(0, 1).toUpperCase()
            }
          </div>
        ))}
        {overflow > 0 && (
          <div style={{
            width: 26, height: 26, borderRadius: "50%", marginLeft: -8,
            background: "rgba(255,255,255,.08)", border: "2px solid rgba(10,10,18,.95)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,.75)",
            boxShadow: "0 1px 3px rgba(0,0,0,.4)",
          }}>
            +{overflow}
          </div>
        )}
      </div>
    </button>
  );
}

/* ─── FeaturedStreamCard ─────────────────────────────────── */
// Lead card for the Live Now section. Pulled from /live/featured which
// runs a cascade: Weered users currently live → top stream of the
// featured lobby's game → League of Legends fallback (always populated).
// Click the thumbnail or Watch button to play the Twitch embed inline.
function FeaturedStreamCard({ stream }: { stream: any }) {
  const router = useRouter();
  const [playing, setPlaying] = React.useState(false);
  const [muted, setMuted] = React.useState(true);

  // Stop playback when the underlying stream changes (e.g. /live/featured
  // poll returns a different streamer) so we don't render an iframe for a
  // user who's no longer being shown.
  React.useEffect(() => { setPlaying(false); }, [stream?.userLogin]);

  if (!stream) return null;

  // Click Join Room → land on the lobby with ?stream=<login>; the lobby
  // page reads that and dispatches the existing watchhere event so the
  // modules panel auto-jumps to Streams + plays the channel inline.
  const handleJoinRoom = () => {
    if (!stream.joinLobbyId) return;
    const login = stream.userLogin || "";
    const qs = login ? `?stream=${encodeURIComponent(login)}` : "";
    router.push(`/lobby/${encodeURIComponent(stream.joinLobbyId)}${qs}`);
  };

  const sourceLabel =
    stream.source === "user"
      ? (stream.weeredUser?.name ? `${stream.weeredUser.name} on Weered` : "Live on Weered")
      : stream.source === "game"
        ? `Top stream · ${stream.gameName || "Featured game"}`
        : "Trending on Twitch";
  const sourceColor =
    stream.source === "user" ? "#a78bfa"
    : stream.source === "game" ? "#f5b700"
    : "#9146ff";

  const parentHost = typeof window !== "undefined" ? window.location.hostname : "weered.ca";
  const embedUrl = `https://player.twitch.tv/?channel=${encodeURIComponent(stream.userLogin || "")}&parent=${encodeURIComponent(parentHost)}&autoplay=true&muted=${muted ? "true" : "false"}`;

  // 16:9 thumbnail at 320×180 — big enough to actually watch in-place
  // without taking over the page.
  const thumbWidth = 320;
  const thumbHeight = 180;

  return (
    <div
      style={{
        display: "grid", gridTemplateColumns: `${thumbWidth}px 1fr`,
        gap: 14, padding: 0,
        background: "rgba(255,255,255,.02)",
        border: `1px solid ${sourceColor}24`,
        borderRadius: 12, overflow: "hidden",
        color: "inherit",
        transition: "border-color .15s, transform .15s",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${sourceColor}66`; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = `${sourceColor}24`; }}
    >
      {/* Thumbnail / inline player */}
      <div style={{ position: "relative", width: thumbWidth, height: thumbHeight, background: "rgba(0,0,0,.6)", flexShrink: 0 }}>
        {playing ? (
          <>
            <iframe
              src={embedUrl}
              title={stream.title || stream.userName}
              allowFullScreen
              allow="autoplay; fullscreen"
              style={{ width: "100%", height: "100%", border: 0, display: "block" }}
            />
            <button
              type="button"
              onClick={() => setPlaying(false)}
              title="Stop"
              style={{
                position: "absolute", top: 6, right: 6,
                width: 24, height: 24, borderRadius: 4,
                border: "1px solid rgba(255,255,255,.18)",
                background: "rgba(0,0,0,.7)", color: "#fff",
                cursor: "pointer", fontFamily: "inherit",
                fontSize: 14, lineHeight: 1, fontWeight: 700,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                zIndex: 2,
              }}
            >×</button>
            <button
              type="button"
              onClick={() => setMuted(m => !m)}
              title={muted ? "Unmute" : "Mute"}
              style={{
                position: "absolute", top: 6, right: 36,
                width: 24, height: 24, borderRadius: 4,
                border: "1px solid rgba(255,255,255,.18)",
                background: "rgba(0,0,0,.7)", color: "#fff",
                cursor: "pointer", fontFamily: "inherit",
                fontSize: 11, lineHeight: 1, fontWeight: 700,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                zIndex: 2,
              }}
            >{muted ? "🔇" : "🔊"}</button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            style={{
              width: "100%", height: "100%", padding: 0,
              border: 0, background: "none", cursor: "pointer",
              position: "relative", display: "block",
            }}
            aria-label={`Play ${stream.userName || stream.userLogin}`}
          >
            {stream.thumbnailUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={stream.thumbnailUrl} alt={stream.title || ""} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            )}
            {/* Big play overlay so it reads as clickable */}
            <span
              aria-hidden
              style={{
                position: "absolute", top: "50%", left: "50%",
                transform: "translate(-50%, -50%)",
                width: 54, height: 54, borderRadius: "50%",
                background: "rgba(0,0,0,.55)", border: "2px solid rgba(255,255,255,.85)",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontSize: 18,
                boxShadow: "0 4px 16px rgba(0,0,0,.5)",
              }}
            >▶</span>
          </button>
        )}

        {/* LIVE pip — always visible */}
        <div style={{
          position: "absolute", top: 6, left: 6,
          display: "flex", alignItems: "center", gap: 4,
          padding: "2px 6px", borderRadius: 4,
          background: "rgba(220,38,38,.92)", color: "#fff",
          fontSize: 9, fontWeight: 900, letterSpacing: "1px", textTransform: "uppercase",
          pointerEvents: "none", zIndex: 1,
        }}>
          <span style={{ width: 4, height: 4, borderRadius: 999, background: "#fff" }} />
          Live
        </div>
        {/* Viewer count — hidden once playing so it doesn't cover the player UI */}
        {!playing && (
          <div style={{
            position: "absolute", bottom: 6, right: 6,
            padding: "2px 6px", borderRadius: 4,
            background: "rgba(0,0,0,.75)", color: "#fff",
            fontSize: 10, fontWeight: 700, fontFamily: "monospace",
            pointerEvents: "none",
          }}>
            {(stream.viewerCount ?? 0).toLocaleString()} watching
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "12px 14px 12px 0", minWidth: 0 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "1.6px", textTransform: "uppercase", color: sourceColor, marginBottom: 4 }}>
            {sourceLabel}
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "rgba(243,244,246,.96)", letterSpacing: "-.2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {stream.userName || stream.userLogin}
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,.6)", marginTop: 4, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {stream.title || ""}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setPlaying(p => !p)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 13px", borderRadius: 6,
              background: playing ? `${sourceColor}26` : `${sourceColor}14`,
              border: `1px solid ${sourceColor}66`,
              color: sourceColor,
              fontSize: 11, fontWeight: 800, letterSpacing: "1.2px", textTransform: "uppercase",
              fontFamily: "ui-monospace, 'JetBrains Mono', monospace",
              cursor: "pointer",
            }}
          >
            {playing ? "■ Stop" : "▶ Watch here"}
          </button>
          {stream.joinLobbyId && (
            <button
              type="button"
              onClick={handleJoinRoom}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "6px 11px", borderRadius: 6,
                border: "1px solid rgba(34,197,94,.45)",
                background: "rgba(34,197,94,.08)",
                color: "rgba(187,247,208,.95)",
                fontSize: 10, fontWeight: 700, letterSpacing: "1.1px", textTransform: "uppercase",
                fontFamily: "ui-monospace, 'JetBrains Mono', monospace",
                cursor: "pointer",
              }}
            >
              Join room →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── LiveTicker ─────────────────────────────────────────── */
// Two-column layout: featured stream card on the left (capped width so
// it doesn't span the page), active room chips stacked on the right
// filling the rest of the row. Wraps on narrow viewports.
function LiveTicker({ rooms: _rooms, onJoin, apiBase }: { rooms: any[]; onJoin: (id: string, pinned: boolean) => void; apiBase: string }) {
  const [stream, setStream] = useState<any>(null);
  const [liveRooms, setLiveRooms] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    const fetchStream = async () => {
      try {
        const r = await fetch(`${apiBase}/live/featured`);
        const j = await r.json();
        if (!cancelled && j?.ok) setStream(j.stream || null);
      } catch {}
    };
    const fetchRooms = async () => {
      try {
        const r = await fetch(`${apiBase}/live/rooms`);
        const j = await r.json();
        if (!cancelled && j?.ok) setLiveRooms(Array.isArray(j.rooms) ? j.rooms : []);
      } catch {}
    };
    fetchStream(); fetchRooms();
    const t1 = setInterval(fetchStream, 90000);
    const t2 = setInterval(fetchRooms, 12000);
    return () => { cancelled = true; clearInterval(t1); clearInterval(t2); };
  }, [apiBase]);

  if (!stream && liveRooms.length === 0) return null;

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <PulseDot color="#22c55e" size={5} />
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "1.5px", textTransform: "uppercase", color: "rgba(255,255,255,.4)" }}>
          Live now
        </span>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,.06)" }} />
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        {stream && (
          <div style={{ flex: "1 1 580px", maxWidth: 720, minWidth: 0 }}>
            <FeaturedStreamCard stream={stream} />
          </div>
        )}

        {liveRooms.length > 0 && (
          <div style={{
            flex: "1 1 280px",
            display: "flex", flexDirection: "column",
            gap: 8, minWidth: 0,
            // Match the stream card's height so the column fills its space.
            maxHeight: 220, overflowY: "auto",
          }}>
            {liveRooms.map(r => (
              <LiveRoomCard key={r.id} room={r} onJoin={onJoin} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── LobbyCard (redesigned) ─────────────────────────────── */
function LobbyCard({ room, idx, onJoin }: { room: any; idx: number; onJoin: (id: string) => void }) {
  const name = roomName(room);
  const cnt = onlineCount(room);
  const accent = lobbyAccent(room, idx);
  const desc = room?.description as string | undefined;
  const logo = room?.logoUrl;
  const banner = room?.bannerUrl;
  const heat = heatLabel(cnt);

  return (
    <div
      onClick={() => onJoin(roomId(room))}
      style={{
        background: "rgba(255,255,255,.02)",
        border: "1px solid rgba(255,255,255,.06)",
        borderRadius: 14, padding: 0, cursor: "pointer",
        position: "relative", overflow: "hidden",
        transition: "border-color .2s, transform .15s",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${accent}35`; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,.06)"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
    >
      {/* Banner background */}
      {banner && (
        <Image
          src={banner}
          alt={`${roomName(room)} banner`}
          fill
          sizes="(max-width: 768px) 100vw, 400px"
          loading="lazy"
          style={{ objectFit: "cover", opacity: 0.12, pointerEvents: "none" }}
          unoptimized={banner.startsWith("/")}
        />
      )}

      {/* Accent top bar */}
      <div style={{ height: 3, background: `linear-gradient(90deg, ${accent}55, ${accent})`, borderRadius: "14px 14px 0 0", position: "relative", zIndex: 1 }} />

      {/* Card body */}
      <div style={{ padding: "14px 16px 16px", position: "relative", zIndex: 1 }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            {logo ? (
              <img src={logo} alt={`${roomName(room)} logo`} style={{ width: 32, height: 32, borderRadius: 8, objectFit: "contain", background: "rgba(0,0,0,.3)" }} />
            ) : (
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: `${accent}15`, border: `1px solid ${accent}22`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 15, fontWeight: 900, color: accent,
              }}>
                {name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontWeight: 800, fontSize: 14, lineHeight: 1.2, letterSpacing: "-0.2px" }}>{name}</span>
                {room?.verified && (
                  <span style={{
                    fontSize: 8, fontWeight: 800, padding: "2px 6px", borderRadius: 5,
                    background: `${accent}18`, border: `1px solid ${accent}30`,
                    color: accent, letterSpacing: "0.05em", flexShrink: 0,
                  }}>
                    VERIFIED
                  </span>
                )}
              </div>
              {desc && <div style={{ fontSize: 10, color: "rgba(255,255,255,.35)", marginTop: 2, lineHeight: 1.3, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{desc}</div>}
            </div>
          </div>

          {/* Online badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontFamily: "monospace", color: heatColor(cnt), flexShrink: 0 }}>
            <PulseDot color={heatColor(cnt)} size={4} />
            {cnt}
          </div>
        </div>

        {/* Heat bar */}
        <div style={{ height: 2, background: "rgba(255,255,255,.05)", borderRadius: 99, overflow: "hidden", marginBottom: 10 }}>
          <div style={{
            height: "100%", width: `${Math.min(100, cnt * 10)}%`,
            background: `linear-gradient(90deg, ${accent}66, ${accent})`,
            borderRadius: 99, transition: "width 1s ease",
          }} />
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{
            fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 5,
            background: `${accent}12`, border: `1px solid ${accent}20`,
            color: accent, textTransform: "uppercase", letterSpacing: ".5px",
          }}>
            {room?.pinned ? "lobby" : "room"}
          </span>
          {cnt > 0 && (
            <span style={{ fontSize: 9, fontFamily: "monospace", color: heatColor(cnt), opacity: 0.7 }}>
              {heat}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── FriendStrip (compact horizontal) ───────────────────── */
function FriendStrip({ friends, onDm, onJoin }: { friends: any[]; onDm: (u: any) => void; onJoin: (u: any) => void }) {
  if (friends.length === 0) return null;
  return (
    <div style={{ marginTop: 24 }}>
      <SectionHeader icon="👥" label="Active Now" count={friends.length} />
      <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6, scrollbarWidth: "none" }}>
        {friends.map((u, i) => {
          const name = pickFirst(u?.name, u?.username, "?");
          const initial = name[0]?.toUpperCase() ?? "?";
          const inRoom = Boolean(u?.room ?? u?.roomId ?? u?.activeRoom);
          const loc = inRoom ? String(u?.room ?? u?.roomId ?? "a room").replace("room:", "") : "lobby";
          const avatar = u?.avatar || null;
          const color = u?.avatarColor || avatarBg(name);
          return (
            <div
              key={u?.id || i}
              onClick={() => onDm(u)}
              style={{
                flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center",
                gap: 5, padding: "10px 14px", borderRadius: 12,
                background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.06)",
                cursor: "pointer", transition: "all .15s", minWidth: 72,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,.14)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,.06)"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
            >
              <div style={{ position: "relative" }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: avatar ? "rgba(255,255,255,.08)" : color,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 800, fontSize: 14, color: "#fff", overflow: "hidden",
                }}>
                  {avatar ? <img src={avatar} alt={`${name} avatar`} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initial}
                </div>
                <span style={{
                  position: "absolute", bottom: 0, right: 0,
                  width: 9, height: 9, borderRadius: "50%",
                  background: inRoom ? "#5800E5" : "#22c55e",
                  border: "2px solid rgba(10,10,15,1)",
                  boxShadow: `0 0 4px ${inRoom ? "#5800E5" : "#22c55e"}`,
                }} />
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.8)", maxWidth: 64, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" }}>{name}</span>
              <span style={{ fontSize: 9, fontFamily: "monospace", color: "rgba(255,255,255,.3)", maxWidth: 64, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {inRoom ? loc : "lobby"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── RecentRow ──────────────────────────────────────────── */
function RecentRow({ room, onJoin }: { room: any; onJoin: (id: string, pinned: boolean) => void }) {
  const name = roomName(room);
  const cnt = onlineCount(room);
  const accent = lobbyAccent(room, 0);
  const logo = room?.logoUrl;
  const pinned = isPinned(room);
  return (
    <div
      onClick={() => onJoin(roomId(room), pinned)}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "9px 12px", background: "rgba(255,255,255,.02)",
        border: "1px solid rgba(255,255,255,.06)", borderRadius: 10,
        cursor: "pointer", transition: "all .15s",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,.14)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.04)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,.06)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.02)"; }}
    >
      {logo ? (
        <img src={logo} alt={`${name} logo`} style={{ width: 30, height: 30, borderRadius: 8, objectFit: "contain", background: "rgba(0,0,0,.3)", flexShrink: 0 }} />
      ) : (
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: `${accent}12`, border: `1px solid ${accent}18`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 900, color: accent, flexShrink: 0,
        }}>
          {name.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
        {room?.lobbyId && (
          <div style={{ fontSize: 10, color: "rgba(255,255,255,.25)", marginTop: 1 }}>{pickFirst(room?.lobbyName, room?.lobbyId, "")}</div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        {cnt > 0 && (
          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontFamily: "monospace", color: "#22c55e" }}>
            <PulseDot color="#22c55e" size={4} />
            {cnt}
          </span>
        )}
        <span style={{
          fontSize: 10, padding: "3px 8px", borderRadius: 6,
          background: "rgba(124,106,247,.1)", border: "1px solid rgba(124,106,247,.2)",
          color: "#5800E5", fontWeight: 700, cursor: "pointer",
        }}>
          Rejoin
        </span>
      </div>
    </div>
  );
}

/* ─── SectionHeader ──────────────────────────────────────── */
function SectionHeader({ icon, label, count, sub }: { icon: string; label: string; count?: number; sub?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ fontWeight: 800, fontSize: 13, letterSpacing: "-0.1px" }}>{label}</span>
        {count !== undefined && (
          <span style={{
            fontSize: 10, fontFamily: "monospace", color: "rgba(255,255,255,.3)",
            background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.07)",
            borderRadius: 99, padding: "1px 8px",
          }}>{count}</span>
        )}
      </div>
      {sub && <span style={{ fontSize: 10, fontFamily: "monospace", color: "rgba(255,255,255,.2)" }}>{sub}</span>}
    </div>
  );
}

/* ─── HomePage ───────────────────────────────────────────── */
export default function HomePage() {
  const router = useRouter();
  const { rooms, usersByRoom, me, join, joinedRoomId, joinStatus } = useWeered() as any;

  useEffect(() => {
    if (!me?.id) return;
    if (joinedRoomId === "home" && joinStatus === "joined") return;
    try { join?.("home"); } catch {}
  }, [me?.id, joinedRoomId, joinStatus, join]);

  const [search, setSearch] = useState("");
  const [showShowcase, setShowShowcase] = useState(false);
  const [fetchedRooms, setFetchedRooms] = React.useState<any[]>([]);

  // Aggregated lobby presence counts (live users across all rooms)
  const [lobbyPresenceCounts, setLobbyPresenceCounts] = React.useState<Record<string, number>>({});

  // Featured lobby from staff config
  const [featuredLobby, setFeaturedLobby] = React.useState<any>(null);

  // Server-side recents
  const [serverRecents, setServerRecents] = React.useState<any[]>([]);

  React.useEffect(() => {
    const base = "https://api.weered.ca";
    const token = localStorage.getItem("weered_token") ?? "";
    const headers: any = token ? { Authorization: `Bearer ${token}` } : {};
    Promise.all([
      fetch(`${base}/lobbies`, { headers }).then(r => r.json()).catch(() => ({})),
      fetch(`${base}/rooms`, { headers }).then(r => r.json()).catch(() => ({})),
      fetch(`${base}/featured`, { headers }).then(r => r.json()).catch(() => ({})),
      token ? fetch(`${base}/recents`, { headers }).then(r => r.json()).catch(() => ({})) : Promise.resolve({}),
    ]).then(([lobbyData, roomData, featuredData, recentsData]) => {
      const lobbies = Array.isArray(lobbyData?.lobbies)
        ? lobbyData.lobbies.map((l: any) => ({ ...l, pinned: true, onlineCount: l._count?.members ?? 0 }))
        : [];
      const rms = Array.isArray(roomData?.rooms) ? roomData.rooms : [];
      const seen = new Set<string>();
      const merged = [...lobbies, ...rms].filter(r => {
        const id = r.id ?? r.roomId;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
      setFetchedRooms(merged);

      // Set featured lobby from API config
      if (featuredData?.ok && featuredData?.lobby) {
        setFeaturedLobby({ ...featuredData.lobby, pinned: true });
      }

      // Set server-side recents
      if (Array.isArray(recentsData?.recents)) {
        setServerRecents(recentsData.recents);
      }

      // Fetch aggregated presence for all lobbies
      const lobbyIds = lobbies.map((l: any) => l.id).filter(Boolean);
      if (lobbyIds.length) {
        Promise.all(
          lobbyIds.map((id: string) =>
            fetch(`${base}/lobbies/${encodeURIComponent(id)}/presence`, { headers })
              .then(r => r.json())
              .then(j => ({ id, count: j?.count ?? 0 }))
              .catch(() => ({ id, count: 0 }))
          )
        ).then(results => {
          const counts: Record<string, number> = {};
          for (const r of results) counts[r.id] = r.count;
          setLobbyPresenceCounts(counts);
        });
      }
    });
  }, []);

  const myName = pickFirst(me?.name, me?.username, "there");

  const allRooms: any[] = useMemo(() => {
    const ws = Array.isArray(rooms) ? rooms : [];
    let base: any[];
    if (ws.length > 0 && fetchedRooms.length > 0) {
      const brandingMap = new Map(fetchedRooms.map((r: any) => [r.id, r]));
      base = ws.map((r: any) => {
        const branding = brandingMap.get(r.id) ?? brandingMap.get(r.roomId) ?? {};
        // Merge: branding is base, WS overrides counts/presence,
        // but preserve branding's name if WS doesn't have one
        const merged = { ...branding, ...r };
        // If WS name is just the ID, prefer branding name
        if (branding.name && (!r.name || r.name === r.id || r.name === r.roomId)) {
          merged.name = branding.name;
        }
        return merged;
      });
    } else {
      base = ws.length > 0 ? ws : fetchedRooms;
    }
    // Override online counts with aggregated lobby presence where available
    if (Object.keys(lobbyPresenceCounts).length > 0) {
      return base.map((r: any) => {
        const id = r.id ?? r.roomId;
        if (id && lobbyPresenceCounts[id] !== undefined) {
          return { ...r, onlineCount: lobbyPresenceCounts[id] };
        }
        return r;
      });
    }
    return base;
  }, [rooms, fetchedRooms, lobbyPresenceCounts]);

  const allUsers: any[] = useMemo(() => {
    if (!usersByRoom || typeof usersByRoom !== "object") return [];
    const seen = new Set<string>();
    const out: any[] = [];
    for (const roomUsers of Object.values(usersByRoom) as any[][]) {
      for (const u of roomUsers) {
        const id = u?.id ?? u?.userId;
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const rid = Object.keys(usersByRoom).find(rid => (usersByRoom[rid] as any[]).some((ru: any) => ru.id === id));
        out.push({ ...u, room: rid });
      }
    }
    return out;
  }, [usersByRoom]);

  const filtered = useMemo(() => {
    if (!search.trim()) return allRooms;
    const q = search.toLowerCase();
    return allRooms.filter(r => roomName(r).toLowerCase().includes(q));
  }, [allRooms, search]);

  const lobbies = useMemo(() => {
    const sorted = filtered.filter(r => isPinned(r)).sort((a, b) => onlineCount(b) - onlineCount(a));
    // Pin destiny2 to top of grid
    const d2idx = sorted.findIndex(r => roomId(r) === "destiny2" || roomName(r) === "destiny2");
    if (d2idx > 0) { const [d2] = sorted.splice(d2idx, 1); sorted.unshift(d2); }
    return sorted;
  },
    [filtered]
  );

  const popularRooms = useMemo(() =>
    filtered
      .filter(r => !isPinned(r) && !isPrivateRoom(r) && onlineCount(r) > 0)
      .sort((a, b) => onlineCount(b) - onlineCount(a))
      .slice(0, 6),
    [filtered]
  );

  // Hero: use staff-configured featured lobby, then fallback to highest-traffic lobby
  const featured = useMemo(() => {
    // Use the featured lobby from staff config if available
    if (featuredLobby) {
      const id = featuredLobby.id;
      const liveCount = lobbyPresenceCounts[id] ?? onlineCount(featuredLobby);
      return { ...featuredLobby, pinned: true, onlineCount: liveCount };
    }
    // Fallback: highest-traffic lobby
    return lobbies.find(r => onlineCount(r) > 0) ?? lobbies[0] ?? popularRooms[0] ?? null;
  },
    [lobbies, popularRooms, featuredLobby, lobbyPresenceCounts]
  );

  // Hide featured lobby from the grid to avoid duplication
  const featuredId = featured ? roomId(featured) : "";

  // Recents: server-side, enriched with live data from allRooms
  const recentRooms = useMemo(() => {
    if (serverRecents.length === 0) return [];
    return serverRecents
      .map(rec => {
        // Try to find live data for this room/lobby
        const targetId = rec.lobbyId || rec.roomId;
        const live = allRooms.find(r => roomId(r) === targetId);
        if (live) return { ...live, ...rec, id: targetId, onlineCount: onlineCount(live) };
        // Fallback to the stored data
        return { ...rec, id: targetId, name: rec.name || targetId, pinned: Boolean(rec.lobbyId) };
      })
      .filter((r: any) => !isPrivateRoom(r))
      .slice(0, 6);
  }, [serverRecents, allRooms]);

  const [friendsList, setFriendsList] = React.useState<any[]>([]);
  React.useEffect(() => {
    const token = localStorage.getItem("weered_token") ?? "";
    if (!token) return;
    fetch("https://api.weered.ca/friends", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d?.friends)) setFriendsList(d.friends); })
      .catch(() => {});
  }, []);

  const onlineFriends = useMemo(() => friendsList.filter(u => u?.online).slice(0, 12), [friendsList]);

  function handleJoin(id: string, pinned?: boolean) {
    if (!id) return;
    const clean = id.replace("room:", "");
    if (pinned) {
      if (clean === "lobby") router.push("/lobby");
      else router.push(`/lobby/${encodeURIComponent(clean)}`);
      return;
    }
    // Record visit server-side
    const token = localStorage.getItem("weered_token") ?? "";
    if (token) {
      fetch("https://api.weered.ca/recents", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: clean }),
      }).catch(() => {});
    }

    try { join?.(clean); } catch {}
    router.push(`/room/${encodeURIComponent(clean)}`);
  }

  // Also record lobby visits
  function handleLobbyVisit(lobbyId: string) {
    const token = localStorage.getItem("weered_token") ?? "";
    if (token && lobbyId) {
      fetch("https://api.weered.ca/recents", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ lobbyId }),
      }).catch(() => {});
    }
  }

  function handleDm(user: any) {
    try {
      window.dispatchEvent(new CustomEvent("weered:dock:open", {
        detail: { mode: "dm", peer: { id: pickFirst(user?.id, user?.userId, ""), name: pickFirst(user?.name, user?.username, "") } }
      }));
    } catch {}
  }

  return (
    // Pin to weered-center via absolute positioning so the home page
    // doesn't depend on a percentage-height cascade through flex
    // ancestors. weered-center is position: relative — this fills it.
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* TOP BAR */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px 12px", borderBottom: "1px solid rgba(255,255,255,.06)", flexShrink: 0 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "1.5px", textTransform: "uppercase", color: "rgba(255,255,255,.25)" }}>{greeting()}</div>
          <div style={{ fontWeight: 900, fontSize: 22, lineHeight: 1.1, marginTop: 3, letterSpacing: "-0.5px" }}>
            Hey, <span style={{ color: "#5800E5" }}>{myName}</span>
          </div>
        </div>
        <Link
          href="/desktop"
          style={{
            background: "linear-gradient(135deg, rgba(245,183,0,0.12), rgba(245,183,0,0.04))",
            border: "1px solid rgba(245,183,0,0.25)", borderRadius: 8, padding: "7px 12px",
            color: "#f5b700", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
            letterSpacing: "0.02em", transition: "all 0.15s", fontFamily: "inherit", textDecoration: "none",
            display: "inline-flex", alignItems: "center", gap: 6,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = "linear-gradient(135deg, rgba(245,183,0,0.22), rgba(245,183,0,0.08))"; (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(245,183,0,0.45)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = "linear-gradient(135deg, rgba(245,183,0,0.12), rgba(245,183,0,0.04))"; (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(245,183,0,0.25)"; }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
          Desktop app
        </Link>
        <button
          onClick={() => setShowShowcase(true)}
          style={{
            background: "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(124,58,237,0.08))",
            border: "1px solid rgba(124,58,237,0.25)", borderRadius: 8, padding: "7px 14px",
            color: "#a78bfa", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
            letterSpacing: "0.02em", transition: "all 0.15s", fontFamily: "inherit",
          }}
          onMouseEnter={e => { (e.currentTarget).style.background = "linear-gradient(135deg, rgba(124,58,237,0.25), rgba(124,58,237,0.15))"; (e.currentTarget).style.borderColor = "rgba(124,58,237,0.4)"; }}
          onMouseLeave={e => { (e.currentTarget).style.background = "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(124,58,237,0.08))"; (e.currentTarget).style.borderColor = "rgba(124,58,237,0.25)"; }}
        >
          What can you do here?
        </button>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,.25)", fontSize: 14, pointerEvents: "none" }}>&#8981;</span>
          <input data-weered-search value={search} onChange={e => setSearch(e.target.value)} placeholder="Find a room or lobby... ( / )"
            style={{
              background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)",
              borderRadius: 10, padding: "9px 14px 9px 34px",
              color: "#e8e8ec", fontSize: 13, width: 220, outline: "none", fontFamily: "inherit",
              transition: "border-color .15s",
            }}
            onFocus={e => (e.target as HTMLInputElement).style.borderColor = "rgba(255,255,255,.15)"}
            onBlur={e => (e.target as HTMLInputElement).style.borderColor = "rgba(255,255,255,.07)"}
          />
        </div>
      </div>

      {/* SCROLL AREA — small bottom breath; the shell already reserves
          28px below for the SiteFooter via .weered-shell.has-footer, so
          we just need a tiny gap above the footer line. */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "0 20px 8px" }}>

        {/* HERO BANNER */}
        <div style={{ paddingTop: 16 }}>
          <HeroBanner lobby={featured} onJoin={handleJoin} />
        </div>

        {/* UPGRADE BANNER — only for Innocent (free) users */}
        {me && String(me?.tier || "INNOCENT").toUpperCase() === "INNOCENT" && (
          <div
            onClick={() => router.push("/subscribe")}
            style={{
              marginTop: 14, padding: "14px 20px",
              borderRadius: 14, cursor: "pointer",
              background: "linear-gradient(135deg, rgba(88,0,229,.08) 0%, rgba(167,139,250,.06) 50%, rgba(249,115,22,.05) 100%)",
              border: "1px solid rgba(88,0,229,.18)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              gap: 16, transition: "all .2s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(88,0,229,.35)"; (e.currentTarget as HTMLElement).style.background = "linear-gradient(135deg, rgba(88,0,229,.12) 0%, rgba(167,139,250,.08) 50%, rgba(249,115,22,.06) 100%)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(88,0,229,.18)"; (e.currentTarget as HTMLElement).style.background = "linear-gradient(135deg, rgba(88,0,229,.08) 0%, rgba(167,139,250,.06) 50%, rgba(249,115,22,.05) 100%)"; }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <img src="/brand/logo/weered-logo-128.png" alt="Weered logo" style={{ width: 36, height: 36, objectFit: "contain" }} />
              <div>
                <div style={{ fontWeight: 800, fontSize: 13, color: "rgba(243,244,246,.88)", letterSpacing: "-0.1px" }}>
                  Get Indicted. Own a lobby.
                </div>
                <div style={{ fontSize: 11, color: "rgba(148,163,184,.5)", marginTop: 2 }}>
                  Create your own branded community. Premium features. Your rules.
                </div>
              </div>
            </div>
            <span style={{
              flexShrink: 0, fontSize: 11, fontWeight: 800, padding: "6px 14px",
              borderRadius: 8, background: "rgba(88,0,229,.15)", border: "1px solid rgba(88,0,229,.30)",
              color: "rgba(167,139,250,.9)", letterSpacing: ".2px",
              transition: "all .15s",
            }}>
              Upgrade
            </span>
          </div>
        )}

        {/* LIVE TICKER */}
        <LiveTicker rooms={allRooms} onJoin={handleJoin} apiBase="https://api.weered.ca" />

        {/* LOBBIES */}
        {lobbies.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <SectionHeader icon="&#10022;" label="Lobbies" count={lobbies.length} sub="verified communities" />
            <div className="weered-lobby-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {lobbies.filter(r => featuredId ? (roomId(r) !== featuredId) : true).map((r, i) => <LobbyCard key={roomId(r) || i} room={r} idx={i} onJoin={(id) => { handleLobbyVisit(id); handleJoin(id, true); }} />)}

              {/* Create Your Lobby CTA card */}
              {me && (
                <div
                  onClick={() => {
                    const tier = String(me?.tier || "INNOCENT").toUpperCase();
                    if (tier === "INNOCENT") router.push("/subscribe");
                    else router.push("/lobby/create");
                  }}
                  style={{
                    background: "rgba(255,255,255,.02)",
                    border: "1px dashed rgba(88,0,229,.25)",
                    borderRadius: 14, padding: 0, cursor: "pointer",
                    position: "relative", overflow: "hidden",
                    transition: "border-color .2s, transform .15s",
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    minHeight: 140,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(88,0,229,.45)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.background = "rgba(88,0,229,.04)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(88,0,229,.25)"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.02)"; }}
                >
                  <div style={{ fontSize: 36, marginBottom: 8, opacity: 0.7, color: '#5800E5' }}>+</div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: "rgba(243,244,246,.88)", letterSpacing: "-0.1px" }}>
                    Create Your Lobby
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(148,163,184,.4)", marginTop: 4 }}>
                    {String(me?.tier || "INNOCENT").toUpperCase() === "INNOCENT" ? "Indicted+ required" : "Start your community"}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* POPULAR ROOMS */}
        {popularRooms.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <SectionHeader icon="&#128293;" label="Popular Rooms" count={popularRooms.length} sub="active right now" />
            <div className="weered-lobby-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {popularRooms.map((r, i) => <LobbyCard key={roomId(r) || i} room={r} idx={i} onJoin={handleJoin} />)}
            </div>
          </div>
        )}

        {/* ACTIVE FRIENDS */}
        <FriendStrip friends={onlineFriends} onDm={handleDm} onJoin={u => { const rid = pickFirst(u?.room, u?.roomId, ""); if (rid) handleJoin(rid); }} />

        {/* DM PREVIEWS */}
        <div style={{ marginTop: 24 }}>
          <DmPreviewStrip />
        </div>

        {/* ACTIVITY FEED */}
        <div style={{ marginTop: 24 }}>
          <ActivityFeed />
        </div>

        {/* RECENTLY VISITED */}
        {recentRooms.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <SectionHeader icon="&#128339;" label="Recently Visited" count={recentRooms.length} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {recentRooms.map((r, i) => <RecentRow key={roomId(r) || i} room={r} onJoin={handleJoin} />)}
            </div>
          </div>
        )}

        {/* EMPTY STATE */}
        {lobbies.length === 0 && popularRooms.length === 0 && (
          <EmptyState
            icon={<img src="/brand/logo/weered-shieldlogo-512.png" alt="" style={{ width: 72, height: 72, opacity: 0.45 }} />}
            title="Nothing's happening yet."
            hint="Head over to Lobby to find a room — or be the first to start something."
          />
        )}

      </div>

      {/* Animations */}
      <style>{`
        @keyframes weered-ripple{0%{transform:scale(.5);opacity:.5}100%{transform:scale(2);opacity:0}}
        div::-webkit-scrollbar{display:none}
      `}</style>

      <FeatureShowcase open={showShowcase} onClose={() => setShowShowcase(false)} />
      {/* VerticalPicker disabled for now — Press is the default theme until
          we re-enable per-vertical theme selection. Restore by uncommenting:
          <VerticalPicker /> */}
    </div>
  );
}
