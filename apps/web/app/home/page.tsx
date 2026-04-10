"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useWeered } from "../../components/WeeredProvider";
import { avatarBg } from "../../lib/avatarColor";
import DmPreviewStrip from "../../components/DmPreviewStrip";
import ActivityFeed from "../../components/ActivityFeed";

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
      style={{
        position: "relative", borderRadius: 16, overflow: "hidden",
        height: 200, cursor: "pointer",
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
        <img
          src={banner}
          alt=""
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            objectFit: "cover", opacity: 0.55, pointerEvents: "none",
          }}
        />
      )}

      {/* Ambient effects (only when no banner) */}
      {!banner && (
        <>
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: `radial-gradient(ellipse at 25% 50%, ${accent}20 0%, transparent 55%), radial-gradient(ellipse at 85% 20%, ${accent}10 0%, transparent 40%)` }} />
          <div style={{ position: "absolute", inset: 0, opacity: 0.04, pointerEvents: "none", backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)", backgroundSize: "22px 22px" }} />
        </>
      )}

      {/* Top bar */}
      <div style={{ position: "absolute", top: 14, left: 18, right: 18, display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {logo && <img src={logo} alt="" style={{ width: 22, height: 22, borderRadius: 6, objectFit: "contain", background: "rgba(0,0,0,.3)" }} />}
          <span style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "rgba(0,0,0,.5)", backdropFilter: "blur(8px)",
            border: `1px solid ${accent}35`,
            borderRadius: 99, padding: "3px 11px",
            fontSize: 10, fontWeight: 800, color: accent, letterSpacing: ".3px",
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
        }}>
          <PulseDot color="#22c55e" size={5} />
          {cnt} online
        </div>
      </div>

      {/* Bottom content */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "24px 22px 18px", zIndex: 2, background: "linear-gradient(transparent, rgba(0,0,0,.75))" }}>
        <div style={{ fontWeight: 900, fontSize: 26, lineHeight: 1.1, marginBottom: desc ? 6 : 14, letterSpacing: "-0.5px", textShadow: banner ? "0 2px 8px rgba(0,0,0,.6)" : "none" }}>{name}</div>
        {desc && <div style={{ fontSize: 12, color: "rgba(232,232,236,.6)", marginBottom: 14, maxWidth: 480, lineHeight: 1.4, textShadow: banner ? "0 1px 4px rgba(0,0,0,.5)" : "none" }}>{desc}</div>}
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

/* ─── LiveTicker ─────────────────────────────────────────── */
function LiveTicker({ rooms, onJoin }: { rooms: any[]; onJoin: (id: string, pinned: boolean) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const live = rooms.filter(r => onlineCount(r) > 0);
  if (live.length === 0) return null;

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <PulseDot color="#22c55e" size={5} />
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "1.5px", textTransform: "uppercase", color: "rgba(255,255,255,.4)" }}>
          Live now
        </span>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,.06)" }} />
      </div>
      <div ref={scrollRef} style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
        {live.map((r, i) => {
          const name = roomName(r);
          const cnt = onlineCount(r);
          const accent = lobbyAccent(r, i);
          // For rooms inside a lobby, show parent lobby context
          const parentLobby = r?.lobbyId ? pickFirst(r?.lobbyName, r?.lobbyId, "") : "";
          return (
            <button
              key={roomId(r)}
              type="button"
              onClick={() => onJoin(roomId(r), Boolean(r?.pinned))}
              style={{
                flexShrink: 0, display: "flex", alignItems: "center", gap: 8,
                padding: "8px 14px", borderRadius: 10,
                background: `${accent}08`, border: `1px solid ${accent}18`,
                color: "inherit", cursor: "pointer", fontFamily: "inherit",
                transition: "all .15s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${accent}40`; (e.currentTarget as HTMLElement).style.background = `${accent}14`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = `${accent}18`; (e.currentTarget as HTMLElement).style.background = `${accent}08`; }}
            >
              {r?.logoUrl && <img src={r.logoUrl} alt="" style={{ width: 18, height: 18, borderRadius: 4, objectFit: "contain" }} />}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                <span style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>{name}</span>
                {parentLobby && <span style={{ fontSize: 9, color: "rgba(255,255,255,.3)", whiteSpace: "nowrap" }}>{parentLobby}</span>}
              </div>
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontFamily: "monospace", color: "#22c55e" }}>
                <PulseDot color="#22c55e" size={4} />
                {cnt}
              </span>
            </button>
          );
        })}
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
        <img
          src={banner}
          alt=""
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            objectFit: "cover", opacity: 0.12, pointerEvents: "none",
          }}
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
              <img src={logo} alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: "contain", background: "rgba(0,0,0,.3)" }} />
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
                  {avatar ? <img src={avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initial}
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
        <img src={logo} alt="" style={{ width: 30, height: 30, borderRadius: 8, objectFit: "contain", background: "rgba(0,0,0,.3)", flexShrink: 0 }} />
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
  const { rooms, usersByRoom, me, join } = useWeered() as any;
  const [search, setSearch] = useState("");
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
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* TOP BAR */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px 12px", borderBottom: "1px solid rgba(255,255,255,.06)", flexShrink: 0 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "1.5px", textTransform: "uppercase", color: "rgba(255,255,255,.25)" }}>{greeting()}</div>
          <div style={{ fontWeight: 900, fontSize: 22, lineHeight: 1.1, marginTop: 3, letterSpacing: "-0.5px" }}>
            Hey, <span style={{ color: "#5800E5" }}>{myName}</span>
          </div>
        </div>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,.25)", fontSize: 14, pointerEvents: "none" }}>&#8981;</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Find a room or lobby..."
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

      {/* SCROLL AREA */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "0 20px 40px" }}>

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
              <img src="/brand/logo/weered-logo-128.png" alt="" style={{ width: 36, height: 36, objectFit: "contain" }} />
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
        <LiveTicker rooms={allRooms} onJoin={handleJoin} />

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
          <div style={{ textAlign: "center", padding: "60px 20px", color: "rgba(255,255,255,.25)" }}>
            <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}><img src="/brand/logo/weered-shieldlogo-512.png" alt="" style={{ width: 80, height: 80, opacity: 0.5 }} /></div>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>Nothing here yet</div>
            <div style={{ fontSize: 13, opacity: 0.7 }}>Head to Lobby to browse and join rooms.</div>
          </div>
        )}

      </div>

      {/* Animations */}
      <style>{`
        @keyframes weered-ripple{0%{transform:scale(.5);opacity:.5}100%{transform:scale(2);opacity:0}}
        div::-webkit-scrollbar{display:none}
      `}</style>
    </div>
  );
}
