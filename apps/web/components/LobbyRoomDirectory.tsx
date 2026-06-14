"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWeered } from "./WeeredProvider";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

interface RoomUser {
  id?: string;
  name?: string;
  avatar?: string;
}

interface RoomData {
  id: string;
  name: string;
  description?: string;
  locked: boolean;
  ownerId?: string;
  _count?: { members: number };
  onlineCount?: number;
  onlineUsers?: RoomUser[];
  pinned?: boolean;
  isEvent?: boolean;
  iconUrl?: string | null;
  bannerUrl?: string | null;
  accentColor?: string | null;
}

function authHeaders(): Record<string, string> {
  try {
    const t = localStorage.getItem("weered_token") || "";
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch { return {}; }
}

function SailMark({ size = 22 }: { size?: number }) {
  return (
    <img
      src="/brand/lobbies/windrose-logo-official.png"
      alt=""
      width={size}
      height={size}
      aria-hidden
      style={{ objectFit: "contain", filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))" }}
    />
  );
}

function roomIcon(name: string, moduleType?: string): React.ReactNode {
  const n = name.toLowerCase();
  if (moduleType === "WINDROSE") {
    if (n.includes("helm") || n.includes("wheel"))   return "⚓";
    if (n.includes("crew") || n.includes("mate"))    return "🏴‍☠️";
    if (n.includes("captain"))                       return "🧭";
    if (n.includes("log") || n.includes("journal"))  return "📖";
    if (n.includes("bug") || n.includes("hunter"))   return "🐛";
    if (n.includes("trading") || n.includes("post") || n.includes("market")) return "💰";
  }
  if (n.includes("tavern"))   return "🍺";
  if (n.includes("campaign") || n.includes("table")) return "🎲";
  if (n.includes("dm") || n.includes("workshop") || n.includes("dungeon master")) return "📜";
  if (n.includes("forge") || n.includes("character")) return "⚔️";
  if (n.includes("lore"))     return "📖";
  if (n.includes("voice"))    return "🎙";
  if (n.includes("lfg") || n.includes("squad"))  return "🔥";
  if (n.includes("trading") || n.includes("trade"))  return "💱";
  if (n.includes("general"))  return "💬";
  if (n.includes("watch") || n.includes("stream")) return "📺";
  if (n.includes("ranked"))   return "🏆";
  if (n.includes("chill") || n.includes("lounge")) return "🌙";
  if (n.includes("news") || n.includes("feed"))    return "📰";
  if (n.includes("meme") || n.includes("shitpost")) return "🤣";
  if (n.includes("help") || n.includes("support")) return "🛟";
  if (n.includes("music") || n.includes("audio"))  return "🎵";
  if (n.includes("art") || n.includes("creative")) return "🎨";
  if (n.includes("cryo") || n.includes("archive")) return "🧊";
  if (moduleType === "WINDROSE") return <SailMark size={22} />;
  return "◆";
}

function roomSubtitle(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("tavern"))   return "General gathering hall";
  if (n.includes("campaign") || n.includes("table")) return "Play table";
  if (n.includes("dm") || n.includes("workshop")) return "Dungeon Master prep";
  if (n.includes("forge") || n.includes("character")) return "Character building";
  if (n.includes("lore"))     return "Lore & discussion";
  if (n.includes("voice"))    return "Voice channel";
  if (n.includes("lfg") || n.includes("squad"))  return "Looking for group";
  if (n.includes("trading") || n.includes("trade"))  return "Trading post";
  if (n.includes("general"))  return "General chat";
  if (n.includes("watch") || n.includes("stream")) return "Watch party";
  if (n.includes("ranked"))   return "Competitive";
  if (n.includes("chill") || n.includes("lounge")) return "Chill zone";
  return "Text channel";
}

const AV_COLORS = ["#5800E5", "#22c55e", "#f97316", "#60a5fa", "#ef4444", "#eab308", "#ec4899", "#14b8a6"];
function avColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return AV_COLORS[Math.abs(h) % AV_COLORS.length];
}

function meshAngle(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 17 + id.charCodeAt(i)) & 0xffffff;
  return (h % 360);
}

const CREATE_LABELS: Record<string, { btn: string; title: string; placeholder: string; icon: string }> = {
  DND:   { btn: "Open a Table",   title: "Open a Table",    placeholder: "e.g. Curse of Strahd — Session 4",  icon: "🎲" },
  POKER: { btn: "Start a Table",  title: "Start a Table",   placeholder: "e.g. $500 Buy-In NLH",             icon: "♠️" },
  STUDY: { btn: "Open a Room",    title: "Create Study Room", placeholder: "e.g. Organic Chem Finals Grind",  icon: "📚" },
};
const DEFAULT_LABEL = { btn: "Create Room", title: "Create Room", placeholder: "Room name…", icon: "+" };

const MODULE_OPTIONS_BY_TYPE: Record<string, { value: string; label: string }[]> = {
  POKER:    [{ value: "voice", label: "Voice" }, { value: "poker", label: "Poker Table" }],
  TRADING:  [{ value: "voice", label: "Voice" }, { value: "fakeout", label: "FakeOut Trading" }, { value: "video", label: "Video" }, { value: "screen", label: "Screen Share" }],
  BUNGIE:   [{ value: "voice", label: "Voice" }, { value: "destiny", label: "Destiny" }, { value: "youtube", label: "YouTube" }, { value: "twitch", label: "Twitch" }],
  RIOT:     [{ value: "voice", label: "Voice" }, { value: "league", label: "League" }, { value: "youtube", label: "YouTube" }, { value: "twitch", label: "Twitch" }],
  FORTNITE: [{ value: "voice", label: "Voice" }, { value: "fortnite", label: "Fortnite" }, { value: "youtube", label: "YouTube" }, { value: "twitch", label: "Twitch" }],
  PUBG:     [{ value: "voice", label: "Voice" }, { value: "pubg", label: "PUBG" }, { value: "youtube", label: "YouTube" }, { value: "twitch", label: "Twitch" }],
  CS2:      [{ value: "voice", label: "Voice" }, { value: "cs2", label: "CS2" }, { value: "youtube", label: "YouTube" }, { value: "twitch", label: "Twitch" }],
  DOTA2:    [{ value: "voice", label: "Voice" }, { value: "dota2", label: "Dota 2" }, { value: "youtube", label: "YouTube" }, { value: "twitch", label: "Twitch" }],
  STUDY:    [{ value: "voice", label: "Voice" }, { value: "study", label: "Focus Timer" }, { value: "video", label: "Video" }],
  DND:      [{ value: "voice", label: "Voice" }, { value: "dnd", label: "D&D Tools" }, { value: "youtube", label: "YouTube" }, { value: "browser", label: "Browser" }],
  HEADQUARTERS: [{ value: "voice", label: "Voice" }, { value: "hq", label: "HQ Dashboard" }, { value: "video", label: "Video" }, { value: "screen", label: "Screen Share" }],
  NEWS:     [{ value: "voice", label: "Voice" }, { value: "article", label: "Article Reader" }, { value: "browser", label: "Browser" }],
};
const DEFAULT_MODULE_OPTIONS = [
  { value: "voice", label: "Voice" },
  { value: "youtube", label: "YouTube" },
  { value: "twitch", label: "Twitch" },
  { value: "browser", label: "Browser" },
  { value: "video", label: "Video" },
  { value: "screen", label: "Screen Share" },
  { value: "article", label: "Article Reader" },
];

export default function LobbyRoomDirectory({
  lobbyId,
  accentColor,
  bannerUrl,
  moduleType,
  style,
}: {
  lobbyId: string;
  accentColor?: string;
  bannerUrl?: string;
  moduleType?: string;
  style?: React.CSSProperties;
}) {
  const router = useRouter();
  const { join } = useWeered() as any;
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lobbyBanner, setLobbyBanner] = useState<string | null>(bannerUrl || null);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const moduleOptions = MODULE_OPTIONS_BY_TYPE[moduleType || ""] || DEFAULT_MODULE_OPTIONS;
  const [defaultModule, setDefaultModule] = useState<string>(moduleOptions[0]?.value || "voice");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [disabledModules, setDisabledModules] = useState<Set<string>>(new Set());

  const accent = accentColor || "#5800E5";
  const LIVE_COLOR = "#22c55e";
  const labels = CREATE_LABELS[moduleType || ""] || DEFAULT_LABEL;

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/lobbies/${encodeURIComponent(lobbyId)}`, { headers: authHeaders() as any })
      .then(r => r.json())
      .then(j => {
        if (j.ok && j.lobby?.rooms) setRooms(j.lobby.rooms);
        if (j.ok && j.lobby?.bannerUrl && !lobbyBanner) setLobbyBanner(j.lobby.bannerUrl);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [lobbyId]);

  function handleJoin(room: RoomData) {
    try { join?.(`room:${room.id}`); } catch {}
    router.push(`/room/${encodeURIComponent(room.id)}`);
  }

  async function handleCreate() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setCreating(true);
    setCreateError("");
    try {
      const res = await fetch(`${API}/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          name: trimmed,
          lobbyId,
          defaultModule,
          disabledModules: Array.from(disabledModules).filter(m => m !== defaultModule),
        }),
      });
      const j = await res.json();
      if (j.ok) {
        setNewName("");
        setShowCreate(false);
        try { join?.(`room:${j.id}`); } catch {}
        router.push(`/room/${encodeURIComponent(j.id)}`);
      } else {
        setCreateError(j.message || j.error || "Failed to create");
      }
    } catch {
      setCreateError("Network error");
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 80, position: "relative", ...style }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, zIndex: 2 }}>
          <div style={{
            width: 32, height: 32, border: `2px solid ${accent}33`,
            borderTop: `2px solid ${accent}`, borderRadius: "50%",
            animation: "weered-room-spin 0.8s linear infinite",
          }} />
          <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,.3)", letterSpacing: "0.04em" }}>Loading rooms</div>
        </div>
      </div>
    );
  }

  if (rooms.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 80, gap: 14, position: "relative", ...style }}>
        <div style={{ fontSize: 40, opacity: 0.15, zIndex: 2 }}>🚪</div>
        <div style={{ fontSize: 14, fontWeight: 800, color: "rgba(255,255,255,.55)", zIndex: 2 }}>No rooms open here.</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,.35)", zIndex: 2, marginTop: -6 }}>Be the first to start one.</div>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            zIndex: 2, padding: "8px 22px", borderRadius: 10, cursor: "pointer",
            border: `1px solid ${accent}44`, background: `${accent}18`,
            color: "rgba(243,244,246,.7)", fontSize: 12, fontWeight: 700,
            display: "flex", alignItems: "center", gap: 6,
          }}
        >
          <span>{labels.icon}</span> {labels.btn}
        </button>
        {showCreate && (
          <div style={{
            zIndex: 2, width: "100%", maxWidth: 400, marginTop: 8, padding: "14px 16px",
            borderRadius: 12, border: `1px solid ${accent}28`, background: `${accent}08`,
            display: "flex", flexDirection: "column", gap: 10,
          }}>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleCreate(); }}
                placeholder={labels.placeholder}
                maxLength={64}
                style={{
                  flex: 1, padding: "8px 12px", borderRadius: 8,
                  border: `1px solid ${accent}22`, background: "rgba(0,0,0,.3)",
                  color: "rgba(243,244,246,.9)", fontSize: 12, outline: "none",
                  fontFamily: "inherit",
                }}
              />
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                style={{
                  padding: "8px 20px", borderRadius: 8, cursor: creating || !newName.trim() ? "default" : "pointer",
                  border: `1px solid ${accent}44`, background: `${accent}22`,
                  color: "rgba(243,244,246,.9)", fontSize: 12, fontWeight: 700,
                  opacity: creating || !newName.trim() ? 0.4 : 1,
                }}
              >
                {creating ? "…" : "Go"}
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,.5)", letterSpacing: ".06em", textTransform: "uppercase" }}>opens with</span>
              <select
                value={defaultModule}
                onChange={e => setDefaultModule(e.target.value)}
                style={{
                  flex: 1, padding: "6px 10px", borderRadius: 8,
                  border: `1px solid ${accent}22`, background: "rgba(0,0,0,.3)",
                  color: "rgba(243,244,246,.9)", fontSize: 12, outline: "none",
                }}
              >
                {moduleOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>

            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced(s => !s)}
                style={{
                  background: "none", border: "none", padding: 0, cursor: "pointer",
                  fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
                  color: "rgba(255,255,255,.4)", fontWeight: 700,
                }}
              >
                {showAdvanced ? "▾" : "▸"} disable specific modules{disabledModules.size > 0 ? ` (${disabledModules.size})` : ""}
              </button>
              {showAdvanced && (
                <div style={{ marginTop: 6, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 4 }}>
                  {moduleOptions.map(opt => {
                    if (opt.value === defaultModule) return null;
                    const isOff = disabledModules.has(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setDisabledModules(prev => {
                          const next = new Set(prev);
                          if (next.has(opt.value)) next.delete(opt.value);
                          else next.add(opt.value);
                          return next;
                        })}
                        style={{
                          padding: "5px 8px", borderRadius: 6,
                          fontSize: 11, fontFamily: "monospace",
                          textAlign: "left", cursor: "pointer",
                          border: `1px solid ${isOff ? "rgba(239,68,68,.35)" : "rgba(255,255,255,.08)"}`,
                          background: isOff ? "rgba(239,68,68,.08)" : "rgba(255,255,255,.02)",
                          color: isOff ? "rgba(252,165,165,.85)" : "rgba(243,244,246,.55)",
                        }}
                      >
                        <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, marginRight: 6, border: "1px solid", borderColor: isOff ? "rgba(252,165,165,.6)" : "rgba(255,255,255,.2)", background: isOff ? "rgba(239,68,68,.4)" : "transparent", verticalAlign: "middle" }} />
                        {opt.label}{isOff && " ×"}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {createError && <div style={{ fontSize: 11, color: "#ef4444" }}>{createError}</div>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", position: "relative", ...style }}>

      {lobbyBanner && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 0, overflow: "hidden",
          pointerEvents: "none",
        }}>
          <div style={{
            position: "absolute", inset: "-20px",
            backgroundImage: `url(${lobbyBanner})`,
            backgroundSize: "cover", backgroundPosition: "center",
            filter: "blur(40px) saturate(0.6) brightness(0.25)",
            opacity: 0.5,
            transform: "scale(1.1)",
          }} />
          <div style={{
            position: "absolute", inset: 0,
            background: "radial-gradient(ellipse at center, transparent 20%, rgba(0,0,0,.7) 100%)",
          }} />
          <div style={{
            position: "absolute", left: 0, right: 0, bottom: 0, height: "40%",
            background: "linear-gradient(to top, var(--weered-panel2, #0f1117), transparent)",
          }} />
        </div>
      )}

      <div style={{ position: "relative", zIndex: 1, padding: "20px 22px 32px" }}>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div style={{
            width: 3, height: 18, borderRadius: 2,
            background: accent,
            boxShadow: `0 0 8px ${accent}55`,
          }} />
          <span className="weered-rooms-section-label" style={{
            fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase",
            color: "rgba(255,255,255,.5)",
          }}>
            Rooms
          </span>
          <span className="weered-rooms-section-count" style={{
            fontSize: 10, fontFamily: "monospace", fontWeight: 700,
            color: "rgba(255,255,255,.25)",
            background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.08)",
            borderRadius: 99, padding: "2px 10px",
          }}>
            {rooms.length}
          </span>
          <div className="weered-rooms-section-divider" style={{ flex: 1, height: 1, background: "rgba(255,255,255,.06)" }} />

          <button
            className="weered-rooms-create-btn"
            onClick={() => { setShowCreate(v => !v); setCreateError(""); }}
            style={{
              padding: "4px 14px", borderRadius: 8, cursor: "pointer",
              border: `1px solid ${accent}33`, background: showCreate ? `${accent}22` : `${accent}0c`,
              color: showCreate ? "rgba(243,244,246,.9)" : "rgba(243,244,246,.55)",
              fontSize: 11, fontWeight: 700, letterSpacing: "0.02em",
              transition: "all .15s", display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
            }}
            onMouseEnter={e => { if (!showCreate) { e.currentTarget.style.background = `${accent}18`; e.currentTarget.style.color = "rgba(243,244,246,.8)"; } }}
            onMouseLeave={e => { if (!showCreate) { e.currentTarget.style.background = `${accent}0c`; e.currentTarget.style.color = "rgba(243,244,246,.55)"; } }}
          >
            <span style={{ fontSize: 13 }}>{showCreate ? "✕" : labels.icon}</span>
            {showCreate ? "Cancel" : labels.btn}
          </button>
        </div>

        {showCreate && (
          <div className="weered-rooms-create-form" style={{
            marginBottom: 18, padding: "14px 16px", borderRadius: 12,
            border: `1px solid ${accent}28`, background: `${accent}08`,
            display: "flex", flexDirection: "column", gap: 10,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(243,244,246,.8)" }}>{labels.title}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleCreate(); }}
                placeholder={labels.placeholder}
                maxLength={64}
                style={{
                  flex: 1, padding: "8px 12px", borderRadius: 8,
                  border: `1px solid ${accent}22`, background: "rgba(0,0,0,.3)",
                  color: "rgba(243,244,246,.9)", fontSize: 12, outline: "none",
                  fontFamily: "inherit",
                }}
              />
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                style={{
                  padding: "8px 20px", borderRadius: 8, cursor: creating || !newName.trim() ? "default" : "pointer",
                  border: `1px solid ${accent}44`, background: `${accent}22`,
                  color: "rgba(243,244,246,.9)", fontSize: 12, fontWeight: 700,
                  opacity: creating || !newName.trim() ? 0.4 : 1,
                  transition: "all .15s", flexShrink: 0,
                }}
              >
                {creating ? "…" : "Go"}
              </button>
            </div>
            {createError && <div style={{ fontSize: 11, color: "#ef4444" }}>{createError}</div>}
          </div>
        )}

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: 14,
        }}>
          {rooms.map(room => {
            const customIcon = room.iconUrl ? String(room.iconUrl) : null;
            const customBanner = room.bannerUrl ? String(room.bannerUrl) : null;
            const icon: React.ReactNode = customIcon
              ? <img src={customIcon} alt="" aria-hidden style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : roomIcon(room.name, moduleType);
            const subtitle = room.description || roomSubtitle(room.name);
            const memberCount = room._count?.members ?? 0;
            const liveCount = room.onlineCount ?? 0;
            const isLive = liveCount > 0;
            const onlineUsers: RoomUser[] = room.onlineUsers ?? [];

            const cardColor = (room.accentColor && /^#[0-9a-f]{6}$/i.test(room.accentColor))
              ? room.accentColor
              : (isLive ? LIVE_COLOR : accent);
            const angle = meshAngle(room.id);

            const cssVars = {
              "--card-glow": isLive ? "rgba(34,197,94,.15)" : `${accent}18`,
              "--card-border-hover": isLive ? "rgba(34,197,94,.40)" : `${accent}40`,
              "--card-join-bg": isLive ? "rgba(34,197,94,.22)" : `${accent}22`,
              "--card-join-border": isLive ? "rgba(34,197,94,.40)" : `${accent}40`,
            } as React.CSSProperties;

            return (
              <div
                key={room.id}
                onClick={() => handleJoin(room)}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleJoin(room); } }}
                className={`weered-room-card${room.isEvent ? " weered-room-card-event" : ""}`}
                data-pinned={room.pinned ? "true" : "false"}
                style={{
                  position: "relative", overflow: "hidden",
                  borderRadius: 14, cursor: "pointer",
                  border: `1px solid ${cardColor}22`,
                  transition: "all .22s ease",
                  background: "transparent",
                  ...cssVars,
                }}
              >
                {customBanner && (
                  <div aria-hidden style={{
                    position: "absolute", inset: 0, zIndex: 0,
                    backgroundImage: `url("${customBanner}")`,
                    backgroundSize: "cover", backgroundPosition: "center",
                    opacity: 0.55,
                  }} />
                )}
                {customBanner && (
                  <div aria-hidden style={{
                    position: "absolute", inset: 0, zIndex: 0,
                    background: `linear-gradient(180deg, rgba(10,12,20,.30) 0%, rgba(10,12,20,.65) 60%, rgba(10,12,20,.85) 100%)`,
                  }} />
                )}

                <div style={{
                  position: "absolute", inset: 0, zIndex: 0,
                  background: [
                    `radial-gradient(ellipse at ${20 + (angle % 40)}% ${15 + (angle % 30)}%, ${cardColor}14 0%, transparent 60%)`,
                    `radial-gradient(ellipse at ${70 + (angle % 20)}% ${75 - (angle % 25)}%, ${cardColor}0c 0%, transparent 55%)`,
                    `linear-gradient(${angle}deg, rgba(255,255,255,.02) 0%, rgba(255,255,255,.005) 100%)`,
                  ].join(", "),
                  transition: "opacity .22s",
                  opacity: customBanner ? 0.4 : 1,
                }} />

                <div style={{
                  position: "absolute", inset: 0, zIndex: 0,
                  borderRadius: 14,
                  background: "rgba(255,255,255,.02)",
                  backdropFilter: customBanner ? "blur(2px)" : "blur(12px)",
                  WebkitBackdropFilter: customBanner ? "blur(2px)" : "blur(12px)",
                }} />

                <div style={{
                  position: "relative", zIndex: 1,
                  height: 2,
                  background: isLive
                    ? `linear-gradient(90deg, ${LIVE_COLOR}44, ${LIVE_COLOR}, ${LIVE_COLOR}44)`
                    : `linear-gradient(90deg, ${accent}22, ${accent}77, ${accent}22)`,
                }} />

                <div style={{ position: "relative", zIndex: 1, padding: "16px 18px 18px" }}>

                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>

                    <div style={{
                      width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                      background: customIcon ? "rgba(0,0,0,.25)" : `linear-gradient(135deg, ${cardColor}1a, ${cardColor}0a)`,
                      border: `1px solid ${cardColor}28`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 22,
                      boxShadow: `0 0 16px ${cardColor}10`,
                      overflow: "hidden",
                    }}>
                      {icon}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="weered-room-card-name" style={{
                        fontWeight: 800, fontSize: 15, lineHeight: 1.25,
                        color: "rgba(243,244,246,.95)", letterSpacing: "-0.3px",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        display: "flex", alignItems: "center", gap: 8,
                      }}>
                        {room.isEvent && (
                          <span className="weered-event-badge" style={{
                            flexShrink: 0, fontSize: 9, fontWeight: 900, letterSpacing: ".14em",
                            padding: "3px 7px", borderRadius: 4,
                            background: "linear-gradient(90deg, #8b5cf6 0%, #ec4899 100%)",
                            color: "white", textTransform: "uppercase",
                            boxShadow: "0 0 10px rgba(139,92,246,0.55)",
                          }}>EVENT</span>
                        )}
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{room.name}</span>
                      </div>
                      <div className="weered-room-subtitle" style={{
                        fontSize: 11, color: "rgba(148,163,184,.45)", marginTop: 3,
                        lineHeight: 1.4,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {subtitle}
                      </div>
                    </div>

                    {isLive ? (
                      <div style={{
                        display: "flex", alignItems: "center", gap: 5,
                        padding: "4px 10px", borderRadius: 99, flexShrink: 0,
                        background: "rgba(34,197,94,.10)", border: "1px solid rgba(34,197,94,.22)",
                        boxShadow: "0 0 12px rgba(34,197,94,.08)",
                      }}>
                        <span style={{
                          width: 6, height: 6, borderRadius: "50%",
                          background: "#22c55e", boxShadow: "0 0 8px #22c55e",
                          animation: "weered-room-pulse 2s ease-in-out infinite",
                        }} />
                        <span style={{
                          fontSize: 11, fontWeight: 700,
                          color: "rgba(134,239,172,.9)", fontFamily: "monospace",
                        }}>
                          {liveCount}
                        </span>
                      </div>
                    ) : room.locked ? (
                      <div style={{
                        fontSize: 10, fontWeight: 700, padding: "4px 10px", borderRadius: 99,
                        background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.15)",
                        color: "rgba(252,165,165,.6)", flexShrink: 0, letterSpacing: "0.02em",
                      }}>
                        🔒 Locked
                      </div>
                    ) : null}
                  </div>

                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    paddingTop: 12,
                    borderTop: "1px solid rgba(255,255,255,.04)",
                  }}>

                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>

                      {onlineUsers.length > 0 && (
                        <div style={{ display: "flex", alignItems: "center" }}>
                          {onlineUsers.slice(0, 4).map((u, i) => {
                            const name = u.name || "?";
                            const color = avColor(name);
                            return (
                              <div
                                key={u.id || i}
                                title={name}
                                style={{
                                  width: 24, height: 24, borderRadius: "50%",
                                  border: "2px solid rgba(15,17,23,.9)",
                                  marginLeft: i === 0 ? 0 : -8,
                                  zIndex: 4 - i,
                                  position: "relative",
                                  overflow: "hidden",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.85)",
                                  background: u.avatar ? "rgba(255,255,255,.08)" : `linear-gradient(135deg, ${color}55, ${color}aa)`,
                                  flexShrink: 0,
                                }}
                              >
                                {u.avatar
                                  ? <img src={u.avatar} alt={name + " avatar"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                  : name[0]?.toUpperCase() ?? "?"
                                }
                              </div>
                            );
                          })}
                          {liveCount > 4 && (
                            <div style={{
                              width: 24, height: 24, borderRadius: "50%",
                              border: "2px solid rgba(15,17,23,.9)",
                              marginLeft: -8, zIndex: 0,
                              background: "rgba(255,255,255,.06)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,.4)",
                              fontFamily: "monospace",
                            }}>
                              +{liveCount - 4}
                            </div>
                          )}
                        </div>
                      )}

                      <span style={{
                        fontSize: 10, color: "rgba(148,163,184,.35)", fontFamily: "monospace",
                        display: "flex", alignItems: "center", gap: 4,
                      }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
                          <circle cx="12" cy="8" r="3.5" />
                          <path d="M5.5 21v-1.5A5 5 0 0110.5 14h3a5 5 0 015 5.5V21" />
                        </svg>
                        {memberCount > 0 ? `${memberCount} joined` : "Empty"}
                      </span>
                    </div>

                    <span className="weered-room-join" style={{
                      fontSize: 11, fontWeight: 700, padding: "5px 14px", borderRadius: 8,
                      background: `${cardColor}12`, border: `1px solid ${cardColor}25`,
                      color: "rgba(243,244,246,.7)",
                      transition: "all .18s",
                      letterSpacing: "0.02em",
                    }}>
                      Join →
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes weered-room-spin { to { transform: rotate(360deg); } }
        @keyframes weered-room-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }

        .weered-room-card {
          will-change: transform, box-shadow;
        }
        .weered-room-card:hover {
          transform: translateY(-3px) !important;
          box-shadow:
            0 16px 40px rgba(0,0,0,.4),
            0 0 30px var(--card-glow, rgba(88,0,229,.12)),
            inset 0 1px 0 rgba(255,255,255,.04) !important;
          border-color: var(--card-border-hover, rgba(88,0,229,.35)) !important;
        }
        .weered-room-card:hover .weered-room-join {
          background: var(--card-join-bg, rgba(88,0,229,.22)) !important;
          color: rgba(255,255,255,.9) !important;
          border-color: var(--card-join-border, rgba(88,0,229,.4)) !important;
        }
      `}</style>
    </div>
  );
}
