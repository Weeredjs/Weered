"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useWeered, useUsersByRoom } from "../../components/WeeredProvider";
import { avatarBg } from "../../lib/avatarColor";
import DmPreviewStrip from "../../components/DmPreviewStrip";
import ActivityFeed from "../../components/ActivityFeed";
import FeatureShowcase from "../../components/FeatureShowcase";
import EmptyState from "../../components/EmptyState";
import LobbyChatDrawer from "../../components/LobbyChatDrawer";
import HomeActivityTicker from "../../components/HomeActivityTicker";
import FirstTimePrompt from "../../components/FirstTimePrompt";
import HomePinnedNews from "../../components/HomePinnedNews";
import LobbySearch from "../../components/LobbySearch";

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
function roomName(r: any): string {
  const name = pickFirst(r?.name, "");
  if (name) return name;
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
function isLobby(r: any): boolean {
  return !r?.lobbyId;
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

function isLightAccent(hex: string): boolean {
  const h = hex.replace("#", "");
  if (h.length < 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.65;
}

function lobbyAccent(r: any, idx: number): string {
  if (r?.accentColor) return r.accentColor;
  const fallbacks = ["#5800E5", "#22c55e", "#f97316", "#60a5fa", "#ef4444", "#eab308", "#5800E5", "#06b6d4"];
  return fallbacks[idx % fallbacks.length];
}

function PulseDot({ color, size = 6 }: { color: string; size?: number }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: "50%",
      background: color,
      boxShadow: `0 0 8px ${color}99, 0 0 0 1px ${color}33`,
      display: "inline-block", flexShrink: 0,
    }} />
  );
}

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
        position: "relative", borderRadius: 2, overflow: "hidden",
        minHeight: 200, cursor: "pointer",
        border: `1px solid ${accent}22`,
        borderLeft: "2px solid rgba(124,58,237,.55)",
        background: banner
          ? `linear-gradient(135deg, rgba(10,10,15,.7) 0%, rgba(10,10,15,.4) 50%, rgba(10,10,15,.7) 100%)`
          : `linear-gradient(135deg, ${accent}15 0%, rgba(10,10,15,.95) 40%, ${accent}08 100%)`,
        transition: "transform .2s, border-color .2s",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.borderColor = `${accent}44`; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.borderColor = `${accent}22`; }}
    >
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

      {!banner && (
        <>
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: `radial-gradient(ellipse at 25% 50%, ${accent}20 0%, transparent 55%), radial-gradient(ellipse at 85% 20%, ${accent}10 0%, transparent 40%)` }} />
          <div style={{ position: "absolute", inset: 0, opacity: 0.04, pointerEvents: "none", backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)", backgroundSize: "22px 22px" }} />
        </>
      )}

      <div style={{ position: "absolute", top: 14, left: 18, right: 18, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", zIndex: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          {logo && <img src={logo} alt={`${roomName(lobby)} logo`} style={{ width: 22, height: 22, borderRadius: 2, objectFit: "contain", background: "rgba(0,0,0,.3)", flexShrink: 0 }} />}
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(0,0,0,.5)", backdropFilter: "blur(8px)",
            border: `1px solid ${accent}35`,
            borderRadius: 2, padding: "3px 11px",
            fontSize: 10, fontWeight: 800, color: accent, letterSpacing: ".3px",
            whiteSpace: "nowrap",
          }}>
            <PulseDot color={accent} />
            {lobby.pinned ? "FEATURED LOBBY" : "POPULAR"}
          </span>
        </div>
        <div style={{
          background: "rgba(0,0,0,.5)", backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,.08)", borderRadius: 2,
          padding: "4px 10px", fontSize: 11, fontFamily: "monospace",
          color: "rgba(255,255,255,.6)", display: "flex", alignItems: "center", gap: 5,
          whiteSpace: "nowrap", flexShrink: 0,
        }}>
          <PulseDot color="#22c55e" size={5} />
          {cnt} online
        </div>
      </div>

      <div aria-hidden style={{ height: 52 }} />

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
            borderRadius: 2,
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

function LiveRoomCard({ room, onJoin }: { room: any; onJoin: (id: string, pinned: boolean) => void }) {
  const accent = (room?.lobbyAccentColor && /^#[0-9a-f]{6}$/i.test(room.lobbyAccentColor)) ? room.lobbyAccentColor : "#7C3AED";
  const visibleAvatars = (room.avatars || []).slice(0, 4);
  const overflow = Math.max(0, (room.onlineCount || 0) - visibleAvatars.length);

  return (
    <button
      type="button"
      onClick={() => onJoin(room.id, !!room.roomIsLobby)}
      style={{
        display: "grid", gridTemplateColumns: "auto 1fr auto", gridTemplateRows: "auto auto",
        gap: "2px 10px", alignItems: "center",
        padding: "8px 12px", borderRadius: 2,
        background: `${accent}08`, border: `1px solid ${accent}24`,
        color: "inherit", cursor: "pointer", fontFamily: "inherit",
        transition: "all .15s",
        width: "100%", textAlign: "left",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${accent}55`; (e.currentTarget as HTMLElement).style.background = `${accent}14`; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = `${accent}24`; (e.currentTarget as HTMLElement).style.background = `${accent}08`; }}
    >
      <div style={{ gridRow: "1 / span 2", width: 38, height: 38, borderRadius: 2, overflow: "hidden", border: `1px solid ${accent}55`, background: `${accent}10`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <img
          src={room.lobbyLogoUrl || "/brand/logo/weered-logo-64.png"}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </div>

      <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: "rgba(243,244,246,.96)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
          {room.name}
        </span>
      </div>
      <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontFamily: "ui-monospace, monospace", fontWeight: 700, color: "#22c55e", flexShrink: 0 }}>
        <PulseDot color="#22c55e" size={5} />
        {room.onlineCount}
      </span>

      <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "rgba(255,255,255,.5)" }}>
        {room.lobbyName && (
          <>
            <span style={{ fontWeight: 700, color: `${accent}d0`, letterSpacing: "0.4px", textTransform: "uppercase", fontSize: 9, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{room.lobbyName}</span>
            <span style={{ opacity: 0.4 }}>·</span>
          </>
        )}
        <span style={{ fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{room.activity}</span>
      </div>

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

function FeaturedStreamCard({ stream }: { stream: any }) {
  const router = useRouter();
  const [playing, setPlaying] = React.useState(false);
  const [muted, setMuted] = React.useState(true);

  React.useEffect(() => { setPlaying(false); }, [stream?.userLogin]);

  if (!stream) return null;

  const handleJoinRoom = () => {
    if (!stream.joinLobbyId) return;
    const login = stream.userLogin || "";
    if (login) {
      try {
        (window as any).__weeredHomeJoinStream = { channel: login, ts: Date.now() };
      } catch {}
    }
    router.push(`/lobby/${encodeURIComponent(stream.joinLobbyId)}`);
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

  const thumbWidth = 320;
  const thumbHeight = 180;

  return (
    <div
      style={{
        display: "grid", gridTemplateColumns: `${thumbWidth}px 1fr`,
        gap: 14, padding: 0,
        background: "rgba(255,255,255,.02)",
        border: `1px solid ${sourceColor}24`,
        borderRadius: 2, overflow: "hidden",
        color: "inherit",
        transition: "border-color .15s, transform .15s",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${sourceColor}66`; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = `${sourceColor}24`; }}
    >
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
                width: 24, height: 24, borderRadius: 2,
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
                width: 24, height: 24, borderRadius: 2,
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

        <div style={{
          position: "absolute", top: 6, left: 6,
          display: "flex", alignItems: "center", gap: 4,
          padding: "2px 6px", borderRadius: 2,
          background: "rgba(220,38,38,.92)", color: "#fff",
          fontSize: 9, fontWeight: 900, letterSpacing: "1px", textTransform: "uppercase",
          pointerEvents: "none", zIndex: 1,
        }}>
          <span style={{ width: 4, height: 4, borderRadius: 2, background: "#fff" }} />
          Live
        </div>
        {!playing && (
          <div style={{
            position: "absolute", bottom: 6, right: 6,
            padding: "2px 6px", borderRadius: 2,
            background: "rgba(0,0,0,.75)", color: "#fff",
            fontSize: 10, fontWeight: 700, fontFamily: "monospace",
            pointerEvents: "none",
          }}>
            {(stream.viewerCount ?? 0).toLocaleString()} watching
          </div>
        )}
      </div>

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
              padding: "6px 13px", borderRadius: 2,
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
                padding: "6px 15px 6px 11px", borderRadius: 0,
                clipPath: "polygon(0 0, 100% 0, 88% 100%, 0 100%)",
                border: "1px solid rgba(124,58,237,.55)",
                background: "rgba(124,58,237,.12)",
                color: "rgba(216,202,255,.95)",
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
        background: "#14161A",
        border: "1px solid rgba(255,255,255,.06)",
        borderRadius: 0, padding: 0, cursor: "pointer",
        position: "relative", overflow: "hidden",
        transition: "border-color .2s, transform .15s",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${accent}35`; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,.06)"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
    >
      {banner && (
        <>
          <Image
            src={banner}
            alt={`${roomName(room)} banner`}
            fill
            sizes="(max-width: 768px) 100vw, 400px"
            loading="lazy"
            style={{ objectFit: "cover", opacity: 0.5, pointerEvents: "none" }}
            unoptimized={banner.startsWith("/")}
          />
          <div style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none", background: "linear-gradient(180deg, rgba(18,20,24,.36) 0%, rgba(18,20,24,.72) 100%)" }} />
        </>
      )}

      <div style={{ height: 3, background: `linear-gradient(90deg, ${accent}55, ${accent})`, borderRadius: 0, position: "relative", zIndex: 1 }} />

      <div style={{ padding: "10px 12px 11px", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            {logo ? (
              <img src={logo} alt={`${roomName(room)} logo`} style={{ width: 28, height: 28, borderRadius: 0, objectFit: "contain", background: "rgba(0,0,0,.3)" }} />
            ) : (
              <div style={{
                width: 28, height: 28, borderRadius: 0,
                background: `${accent}15`, border: `1px solid ${accent}22`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, fontWeight: 900, color: accent,
              }}>
                {name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontFamily: "var(--font-barlow), 'Barlow Condensed', sans-serif", textTransform: "uppercase", fontWeight: 800, fontSize: 15, lineHeight: 1.1, letterSpacing: "0.02em" }}>{name}</span>
                {room?.verified && (
                  <span style={{
                    fontSize: 8, fontWeight: 800, padding: "2px 6px", borderRadius: 0,
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

          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontFamily: "monospace", color: heatColor(cnt), flexShrink: 0 }}>
            <PulseDot color={heatColor(cnt)} size={4} />
            {cnt}
          </div>
        </div>

        <div style={{ height: 2, background: "rgba(255,255,255,.05)", borderRadius: 0, overflow: "hidden", marginBottom: 8 }}>
          <div style={{
            height: "100%", width: `${Math.min(100, cnt * 10)}%`,
            background: `linear-gradient(90deg, ${accent}66, ${accent})`,
            borderRadius: 0, transition: "width 1s ease",
          }} />
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{
            fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 0,
            background: `${accent}12`, border: `1px solid ${accent}20`,
            color: accent, textTransform: "uppercase", letterSpacing: ".5px",
            fontFamily: "var(--font-barlow), 'Barlow Condensed', sans-serif",
          }}>
            {!room?.lobbyId ? "lobby" : "room"}
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
                gap: 5, padding: "10px 14px", borderRadius: 2,
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
        border: "1px solid rgba(255,255,255,.06)", borderRadius: 2,
        cursor: "pointer", transition: "all .15s",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,.14)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.04)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,.06)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.02)"; }}
    >
      {logo ? (
        <img src={logo} alt={`${name} logo`} style={{ width: 30, height: 30, borderRadius: 2, objectFit: "contain", background: "rgba(0,0,0,.3)", flexShrink: 0 }} />
      ) : (
        <div style={{
          width: 30, height: 30, borderRadius: 2,
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
          fontSize: 10, padding: "3px 8px", borderRadius: 2,
          background: "rgba(124,106,247,.1)", border: "1px solid rgba(124,106,247,.2)",
          color: "#5800E5", fontWeight: 700, cursor: "pointer",
        }}>
          Rejoin
        </span>
      </div>
    </div>
  );
}

function LobbyRow({ room, onJoin }: { room: any; onJoin: (id: string) => void }) {
  const name = roomName(room);
  const cnt = onlineCount(room);
  const accent = lobbyAccent(room, 0);
  const logo = room?.logoUrl;
  return (
    <div
      onClick={() => onJoin(roomId(room))}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "7px 10px", background: "rgba(255,255,255,.02)",
        border: "1px solid rgba(255,255,255,.06)", borderRadius: 2,
        cursor: "pointer", transition: "all .15s",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${accent}40`; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.04)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,.06)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.02)"; }}
    >
      {logo ? (
        <img src={logo} alt="" style={{ width: 24, height: 24, borderRadius: 2, objectFit: "contain", background: "rgba(0,0,0,.3)", flexShrink: 0 }} />
      ) : (
        <div style={{ width: 24, height: 24, borderRadius: 2, background: `${accent}12`, border: `1px solid ${accent}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, color: accent, flexShrink: 0 }}>
          {name.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0, fontFamily: "var(--font-barlow), 'Barlow Condensed', sans-serif", textTransform: "uppercase", fontWeight: 700, fontSize: 13, letterSpacing: "0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
      {cnt > 0 && (
        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontFamily: "monospace", color: "#22c55e", flexShrink: 0 }}>
          <PulseDot color="#22c55e" size={4} />{cnt}
        </span>
      )}
    </div>
  );
}

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
            borderRadius: 2, padding: "1px 8px",
          }}>{count}</span>
        )}
      </div>
      {sub && <span style={{ fontSize: 10, fontFamily: "monospace", color: "rgba(255,255,255,.2)" }}>{sub}</span>}
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { rooms, me, join, joinedRoomId, joinStatus } = useWeered() as any;
  const usersByRoom = useUsersByRoom();

  useEffect(() => {
    if (!me?.id) return;
    if (joinedRoomId === "lobby" && joinStatus === "joined") return;
    try { join?.("lobby"); } catch {}
  }, [me?.id, joinedRoomId, joinStatus, join]);

  const [showShowcase, setShowShowcase] = useState(false);
  const [fetchedRooms, setFetchedRooms] = React.useState<any[]>([]);

  const [lobbyPresenceCounts, setLobbyPresenceCounts] = React.useState<Record<string, number>>({});

  const [featuredLobby, setFeaturedLobby] = React.useState<any>(null);

  const [serverRecents, setServerRecents] = React.useState<any[]>([]);

  React.useEffect(() => {
    const base = "https://api.weered.ca";
    const token = localStorage.getItem("weered_token") ?? "";
    const loggedIn = !!localStorage.getItem("weered_user");
    const headers: any = token ? { Authorization: `Bearer ${token}` } : {};
    Promise.all([
      fetch(`${base}/lobbies`, { headers }).then(r => r.json()).catch(() => ({})),
      fetch(`${base}/rooms`, { headers }).then(r => r.json()).catch(() => ({})),
      fetch(`${base}/featured`, { headers }).then(r => r.json()).catch(() => ({})),
      // Auth rides the httpOnly cookie via the global fetch-patch; gate on the
      // login marker, NOT weered_token (boot-deleted since the cookie migration).
      loggedIn ? fetch(`${base}/recents`, { headers }).then(r => r.json()).catch(() => ({})) : Promise.resolve({}),
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

      if (featuredData?.ok && featuredData?.lobby) {
        setFeaturedLobby({ ...featuredData.lobby, pinned: true });
      }

      if (Array.isArray(recentsData?.recents)) {
        setServerRecents(recentsData.recents);
      }

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
        const merged = { ...branding, ...r };
        if (branding.name && (!r.name || r.name === r.id || r.name === r.roomId)) {
          merged.name = branding.name;
        }
        return merged;
      });
    } else {
      base = ws.length > 0 ? ws : fetchedRooms;
    }
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

  const filtered = useMemo(() => allRooms, [allRooms]);

  const lobbies = useMemo(() => {
    const sorted = filtered.filter(r => isPinned(r) && isLobby(r)).sort((a, b) => {
      const oa = onlineCount(a), ob = onlineCount(b);
      if (ob !== oa) return ob - oa;
      const ma = (a._count?.members ?? a.memberCount ?? 0);
      const mb = (b._count?.members ?? b.memberCount ?? 0);
      if (mb !== ma) return mb - ma;
      const va = a.verified ? 1 : 0;
      const vb = b.verified ? 1 : 0;
      if (vb !== va) return vb - va;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
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

  const featured = useMemo(() => {
    if (featuredLobby) {
      const id = featuredLobby.id;
      const liveCount = lobbyPresenceCounts[id] ?? onlineCount(featuredLobby);
      return { ...featuredLobby, pinned: true, onlineCount: liveCount };
    }
    return lobbies.find(r => onlineCount(r) > 0) ?? lobbies[0] ?? popularRooms[0] ?? null;
  },
    [lobbies, popularRooms, featuredLobby, lobbyPresenceCounts]
  );

  const featuredId = featured ? roomId(featured) : "";

  const recentRooms = useMemo(() => {
    if (serverRecents.length === 0) return [];
    return serverRecents
      .map(rec => {
        const targetId = rec.lobbyId || rec.roomId;
        const live = allRooms.find(r => roomId(r) === targetId);
        if (live) return { ...live, ...rec, id: targetId, onlineCount: onlineCount(live) };
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
    if (localStorage.getItem("weered_user")) {
      fetch("https://api.weered.ca/recents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: clean }),
      }).catch(() => {});
    }

    try { join?.(clean); } catch {}
    router.push(`/room/${encodeURIComponent(clean)}`);
  }

  function handleLobbyVisit(lobbyId: string) {
    if (lobbyId && localStorage.getItem("weered_user")) {
      fetch("https://api.weered.ca/recents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      <div className="home-topbar" style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px 12px", borderBottom: "1px solid rgba(255,255,255,.06)", flexShrink: 0, flexWrap: "wrap" }}>
        <div className="home-topbar-greet" style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "1.5px", textTransform: "uppercase", color: "rgba(255,255,255,.25)" }}>{greeting()}</div>
          <div style={{ fontWeight: 900, fontSize: 22, lineHeight: 1.1, marginTop: 3, letterSpacing: "-0.5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            Hey, <span style={{ color: "#5800E5" }}>{myName}</span>
          </div>
        </div>

        <div className="home-topbar-search" style={{ flex: "1 1 auto", display: "flex", justifyContent: "center", minWidth: 0, maxWidth: 600 }}>
          <LobbySearch hero width={560} />
        </div>

        <div className="home-topbar-actions" style={{ flex: 1, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10 }}>
          <Link
            href="/desktop"
            className="home-topbar-secondary"
            style={{
              background: "linear-gradient(135deg, rgba(245,183,0,0.12), rgba(245,183,0,0.04))",
              border: "1px solid rgba(245,183,0,0.25)", borderRadius: 2, padding: "7px 12px",
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
            className="home-topbar-secondary"
            style={{
              background: "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(124,58,237,0.08))",
              border: "1px solid rgba(124,58,237,0.25)", borderRadius: 2, padding: "7px 14px",
              color: "#a78bfa", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
              letterSpacing: "0.02em", transition: "all 0.15s", fontFamily: "inherit",
            }}
            onMouseEnter={e => { (e.currentTarget).style.background = "linear-gradient(135deg, rgba(124,58,237,0.25), rgba(124,58,237,0.15))"; (e.currentTarget).style.borderColor = "rgba(124,58,237,0.4)"; }}
            onMouseLeave={e => { (e.currentTarget).style.background = "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(124,58,237,0.08))"; (e.currentTarget).style.borderColor = "rgba(124,58,237,0.25)"; }}
          >
            What can you do here?
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "0 20px 8px" }}>

        <FirstTimePrompt />

        <div style={{ paddingTop: 14 }}>
          <HomeActivityTicker />
        </div>

        <div style={{ paddingTop: 14 }}>
          <HeroBanner lobby={featured} onJoin={handleJoin} />
        </div>

        <LiveTicker rooms={allRooms} onJoin={handleJoin} apiBase="https://api.weered.ca" />

        {lobbies.length > 0 && (() => {
          const visibleLobbies = lobbies.filter(r => featuredId ? (roomId(r) !== featuredId) : true);
          const FEATURED_PRIORITY = ["eve", "destiny2", "poe", "helldivers2", "league-of-legends", "fakeout", "fortnite", "windrose", "counter-strike-2", "dota-2", "pubg", "mlb", "pga", "chess"];
          const pri = (r: any) => { const i = FEATURED_PRIORITY.indexOf(roomId(r)); return i === -1 ? 999 : i; };
          const ordered = [...visibleLobbies].sort((a, b) => {
            const pa = pri(a), pb = pri(b);
            if (pa !== pb) return pa - pb;
            return (b?.featured ? 1 : 0) - (a?.featured ? 1 : 0);
          });
          const cardLobbies = ordered.slice(0, 7);
          const canCreate = String(me?.tier || "INNOCENT").toUpperCase() !== "INNOCENT";
          return (
            <div style={{ marginTop: 24 }}>
              <SectionHeader icon="&#10022;" label="Featured Lobbies" sub="verified communities" />
              <div className="weered-lobby-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                {cardLobbies.map((r, i) => <LobbyCard key={roomId(r) || i} room={r} idx={i} onJoin={(id) => { handleLobbyVisit(id); handleJoin(id, true); }} />)}

                <div
                  onClick={() => { try { window.dispatchEvent(new CustomEvent("weered:lobby:browse")); } catch {} }}
                  style={{
                    background: "linear-gradient(135deg, rgba(124,58,237,.10), rgba(255,255,255,.02))",
                    border: "1px solid rgba(124,58,237,.3)",
                    borderRadius: 2, cursor: "pointer", position: "relative", overflow: "hidden",
                    transition: "border-color .2s, transform .15s",
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    minHeight: 112, gap: 4,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(124,58,237,.6)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(124,58,237,.3)"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
                >
                  <div style={{ fontSize: 28, marginBottom: 4, opacity: 0.85 }}>🧭</div>
                  <div style={{ fontFamily: "var(--font-barlow), sans-serif", fontWeight: 800, fontSize: 15, letterSpacing: "1px", textTransform: "uppercase", color: "rgba(243,244,246,.95)" }}>
                    Browse all {lobbies.length} lobbies
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(148,163,184,.55)" }}>Search · discover · find your community</div>
                </div>

                <div
                  onClick={() => router.push(canCreate ? "/lobby/create" : "/subscribe")}
                  style={{
                    background: "linear-gradient(135deg, rgba(245,183,0,.12), rgba(88,0,229,.10))",
                    border: "1px solid rgba(245,183,0,.30)",
                    borderRadius: 2, cursor: "pointer", position: "relative", overflow: "hidden",
                    transition: "border-color .2s, transform .15s",
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    minHeight: 112, gap: 4,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(245,183,0,.6)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(245,183,0,.30)"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
                >
                  <div style={{ fontSize: 30, marginBottom: 2, opacity: 0.9, color: "#f5b700", fontWeight: 300, lineHeight: 1 }}>+</div>
                  <div style={{ fontFamily: "var(--font-barlow), sans-serif", fontWeight: 800, fontSize: 15, letterSpacing: "1px", textTransform: "uppercase", color: "#f5d27a" }}>
                    Build your lobby
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(245,210,122,.55)" }}>
                    {canCreate ? "Your game · your rules · your brand" : "Get Indicted to host your own"}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        <HomePinnedNews />

        {me && String(me?.tier || "INNOCENT").toUpperCase() === "INNOCENT" && (
          <div
            onClick={() => router.push("/subscribe")}
            style={{
              marginTop: 14, padding: "14px 20px",
              borderRadius: 2, cursor: "pointer",
              background: "linear-gradient(135deg, rgba(88,0,229,.08) 0%, rgba(167,139,250,.06) 50%, rgba(249,115,22,.05) 100%)",
              border: "1px solid rgba(88,0,229,.18)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              gap: 16, transition: "all .2s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(88,0,229,.35)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(88,0,229,.18)"; }}
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
              borderRadius: 2, background: "rgba(88,0,229,.15)", border: "1px solid rgba(88,0,229,.30)",
              color: "rgba(167,139,250,.9)", letterSpacing: ".2px",
            }}>
              Upgrade
            </span>
          </div>
        )}

        {popularRooms.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <SectionHeader icon="&#128293;" label="Popular Rooms" count={popularRooms.length} sub="active right now" />
            <div className="weered-lobby-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {popularRooms.map((r, i) => <LobbyCard key={roomId(r) || i} room={r} idx={i} onJoin={handleJoin} />)}
            </div>
          </div>
        )}

        <FriendStrip friends={onlineFriends} onDm={handleDm} onJoin={u => { const rid = pickFirst(u?.room, u?.roomId, ""); if (rid) handleJoin(rid); }} />

        <div style={{ marginTop: 24 }}>
          <DmPreviewStrip />
        </div>

        <div style={{ marginTop: 24 }}>
          <ActivityFeed initialCount={5} />
        </div>

        {recentRooms.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <SectionHeader icon="&#128339;" label="Recently Visited" count={recentRooms.length} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {recentRooms.slice(0, 5).map((r, i) => <RecentRow key={roomId(r) || i} room={r} onJoin={handleJoin} />)}
            </div>
          </div>
        )}

        {lobbies.length === 0 && popularRooms.length === 0 && (
          <EmptyState
            icon={<img src="/brand/logo/weered-shieldlogo-512.png" alt="" style={{ width: 72, height: 72, opacity: 0.45 }} />}
            title="Nothing's happening yet."
            hint="Head over to Lobby to find a room — or be the first to start something."
          />
        )}

      </div>

      <style>{`div::-webkit-scrollbar{display:none}`}</style>

      <FeatureShowcase open={showShowcase} onClose={() => setShowShowcase(false)} />

      <LobbyChatDrawer roomId="room:lobby" title="Lobby Chat" />
    </div>
  );
}
