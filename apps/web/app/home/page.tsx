"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useWeered } from "../../components/WeeredProvider";

/* ─── helpers ────────────────────────────────────────────── */
function pickFirst(...vals: any[]): string {
  for (const v of vals) if (typeof v === "string" && v.trim()) return v.trim();
  return "";
}
function onlineCount(r: any): number {
  return Number(r?.onlineCount ?? r?.online ?? r?.memberCount ?? r?.count ?? 0);
}
function roomId(r: any): string {
  return pickFirst(r?.id, r?.roomId, r?.name, "");
}
function roomName(r: any): string {
  const id = roomId(r);
  return id.startsWith("room:") ? id.slice(5) : id;
}
function isPrivateRoom(r: any): boolean {
  const name = roomName(r);
  if (name.startsWith("@")) return true;
  if (/^[a-z0-9]{4,7}$/i.test(name) && !name.includes("/")) return true;
  if (/^test/i.test(name)) return true;
  return false;
}
function isPinned(r: any): boolean {
  return Boolean(r?.pinned);
}

const ROOM_EMOJIS: Record<string, string> = {
  lobby: "🏠", ops: "⚙️", gaming: "🎮", music: "🎵",
  crypto: "💸", tech: "🤖", news: "🌎", food: "🍕",
  art: "🎨", sports: "⚽", film: "🎬", books: "📚",
  technology: "💻", worldnews: "🌐", all: "♾️", weered: "⚡",
};
function emojiFor(name: string): string {
  const n = name.toLowerCase();
  for (const [k, v] of Object.entries(ROOM_EMOJIS)) if (n.includes(k)) return v;
  return "💬";
}

const ACCENTS = [
  { bar: "#7c6af7", bg: "rgba(124,106,247,0.12)" },
  { bar: "#22c55e", bg: "rgba(34,197,94,0.10)"   },
  { bar: "#f97316", bg: "rgba(249,115,22,0.10)"  },
  { bar: "#60a5fa", bg: "rgba(96,165,250,0.10)"  },
  { bar: "#ef4444", bg: "rgba(239,68,68,0.10)"   },
  { bar: "#eab308", bg: "rgba(234,179,8,0.10)"   },
];

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

const cardBase: React.CSSProperties = {
  background: "var(--weered-panel, #141416)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 12, padding: "13px 14px",
  cursor: "pointer", position: "relative", overflow: "hidden",
  transition: "border-color .2s, transform .15s",
};

/* ─── LobbyCard ──────────────────────────────────────────── */
function LobbyCard({ room, idx, onJoin }: { room: any; idx: number; onJoin: (id: string) => void }) {
  const name = roomName(room);
  const cnt  = onlineCount(room);
  const acc  = ACCENTS[idx % ACCENTS.length];
  const em   = emojiFor(name);
  const desc = room?.description as string | undefined;

  return (
    <div onClick={() => onJoin(roomId(room))} style={cardBase}
      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "rgba(255,255,255,0.18)"; el.style.transform = "translateY(-1px)"; }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "rgba(255,255,255,0.07)"; el.style.transform = "translateY(0)"; }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${acc.bar}66, ${acc.bar})`, borderRadius: "12px 12px 0 0" }} />
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: acc.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{em}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontFamily: "monospace", color: cnt > 0 ? "#22c55e" : "rgba(255,255,255,0.25)" }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: cnt > 0 ? "#22c55e" : "rgba(255,255,255,0.2)", boxShadow: cnt > 0 ? "0 0 5px #22c55e" : "none" }} />
          {cnt}
        </div>
      </div>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
      {desc && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 8, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } as any}>{desc}</div>}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: desc ? 0 : 8 }}>
        <div style={{ fontSize: 9, fontFamily: "monospace", background: "rgba(124,106,247,0.12)", border: "1px solid rgba(124,106,247,0.2)", borderRadius: 4, padding: "2px 7px", color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          ✦ lobby
        </div>
        {room?.tags?.length > 0 && (
          <div style={{ fontSize: 9, fontFamily: "monospace", color: "rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.04)", borderRadius: 4, padding: "2px 6px" }}>{room.tags[0]}</div>
        )}
      </div>
    </div>
  );
}

/* ─── RoomCard ───────────────────────────────────────────── */
function RoomCard({ room, idx, onJoin }: { room: any; idx: number; onJoin: (id: string) => void }) {
  const name = roomName(room);
  const cnt  = onlineCount(room);
  const acc  = ACCENTS[idx % ACCENTS.length];
  const em   = emojiFor(name);

  return (
    <div onClick={() => onJoin(roomId(room))} style={cardBase}
      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "rgba(255,255,255,0.18)"; el.style.transform = "translateY(-1px)"; }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "rgba(255,255,255,0.07)"; el.style.transform = "translateY(0)"; }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${acc.bar}44, ${acc.bar}88)`, borderRadius: "12px 12px 0 0" }} />
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: acc.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{em}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontFamily: "monospace", color: "#22c55e" }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 5px #22c55e" }} />
          {cnt}
        </div>
      </div>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 10 }}>{cnt === 1 ? "1 person online" : `${cnt} people online`}</div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ fontSize: 9, fontFamily: "monospace", background: "rgba(255,255,255,0.05)", borderRadius: 4, padding: "2px 7px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>room</div>
      </div>
    </div>
  );
}

/* ─── RecentRow ──────────────────────────────────────────── */
function RecentRow({ room, onJoin }: { room: any; onJoin: (id: string) => void }) {
  const name = roomName(room);
  const cnt  = onlineCount(room);
  const em   = emojiFor(name);
  return (
    <div onClick={() => onJoin(roomId(room))}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 12px", background: "var(--weered-panel, #141416)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, cursor: "pointer", transition: "border-color .2s, background .2s" }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "rgba(255,255,255,0.16)"; el.style.background = "#16161a"; }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "rgba(255,255,255,0.07)"; el.style.background = "var(--weered-panel, #141416)"; }}
    >
      <div style={{ width: 30, height: 30, borderRadius: 7, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>{em}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 1, fontFamily: "monospace" }}>{cnt} online</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontFamily: "monospace", color: "#22c55e" }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 5px #22c55e" }} />
          live
        </div>
        <button type="button" onClick={e => { e.stopPropagation(); onJoin(roomId(room)); }}
          style={{ background: "rgba(124,106,247,0.12)", border: "1px solid rgba(124,106,247,0.25)", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, color: "#a78bfa", cursor: "pointer" }}>
          Rejoin
        </button>
      </div>
    </div>
  );
}

/* ─── FriendCard ─────────────────────────────────────────── */
function FriendCard({ user, onDm, onJoin }: { user: any; onDm: (u: any) => void; onJoin?: (u: any) => void }) {
  const name    = pickFirst(user?.name, user?.username, "?");
  const initial = name[0]?.toUpperCase() ?? "?";
  const inRoom  = Boolean(user?.room ?? user?.roomId ?? user?.activeRoom);
  const loc     = inRoom ? (user?.room ?? user?.roomId ?? "a room") : "lobby";
  const colors  = ["#7c6af7", "#22c55e", "#f97316", "#60a5fa", "#ef4444", "#eab308"];
  const color   = colors[name.charCodeAt(0) % colors.length];
  return (
    <div style={{ background: "var(--weered-panel, #141416)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 12, cursor: "pointer", textAlign: "center", transition: "border-color .2s, transform .15s" }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "rgba(255,255,255,0.16)"; el.style.transform = "translateY(-1px)"; }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "rgba(255,255,255,0.07)"; el.style.transform = "translateY(0)"; }}
    >
      <div style={{ position: "relative", display: "inline-block", marginBottom: 7 }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: `linear-gradient(135deg, ${color}cc, ${color})`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16, color: "#fff", margin: "0 auto" }}>{initial}</div>
        <div style={{ position: "absolute", bottom: 1, right: 1, width: 9, height: 9, borderRadius: "50%", border: "2px solid #141416", background: inRoom ? "#a78bfa" : "#22c55e", boxShadow: inRoom ? "0 0 6px #a78bfa" : "0 0 6px #22c55e" }} />
      </div>
      <div style={{ fontWeight: 700, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 2 }}>{name}</div>
      <div style={{ fontSize: 10, fontFamily: "monospace", color: "rgba(255,255,255,0.35)", marginBottom: 9, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {inRoom ? `🔵 ${String(loc).replace("room:", "")}` : "🟢 lobby"}
      </div>
      <div style={{ display: "flex", gap: 5, justifyContent: "center" }}>
        <button type="button" onClick={e => { e.stopPropagation(); onDm(user); }}
          style={{ flex: 1, borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", fontSize: 10, fontFamily: "monospace", color: "rgba(255,255,255,0.5)", padding: "4px 6px", cursor: "pointer" }}>DM</button>
        {inRoom && onJoin && (
          <button type="button" onClick={e => { e.stopPropagation(); onJoin(user); }}
            style={{ flex: 1, borderRadius: 6, background: "rgba(124,106,247,0.12)", border: "1px solid rgba(124,106,247,0.25)", fontSize: 10, fontFamily: "monospace", color: "#a78bfa", padding: "4px 6px", cursor: "pointer" }}>Join</button>
        )}
      </div>
    </div>
  );
}

/* ─── SectionHeader ──────────────────────────────────────── */
function SectionHeader({ icon, label, count, sub }: { icon: string; label: string; count: number; sub?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 11 }}>
      <div style={{ fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
        {icon} {label}
        <span style={{ fontSize: 10, fontFamily: "monospace", color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 99, padding: "1px 8px" }}>{count}</span>
      </div>
      {sub && <div style={{ fontSize: 11, fontFamily: "monospace", color: "rgba(255,255,255,0.25)" }}>{sub}</div>}
    </div>
  );
}

/* ─── HomePage ───────────────────────────────────────────── */
export default function HomePage() {
  const router = useRouter();
  const { rooms, usersByRoom, me, join } = useWeered() as any;
  const [search, setSearch] = useState("");
  const [fetchedRooms, setFetchedRooms] = React.useState<any[]>([]);

React.useEffect(() => {
  const base = "https://api.weered.ca";
  const token = localStorage.getItem("weered:token") ?? "";
  const headers: any = token ? { Authorization: `Bearer ${token}` } : {};

  Promise.all([
    fetch(`${base}/lobbies`, { headers }).then(r => r.json()).catch(() => ({})),
    fetch(`${base}/rooms`, { headers }).then(r => r.json()).catch(() => ({})),
  ]).then(([lobbyData, roomData]) => {
    const lobbies = Array.isArray(lobbyData?.lobbies)
      ? lobbyData.lobbies.map((l: any) => ({ ...l, pinned: true, onlineCount: l._count?.members ?? 0 }))
      : [];
    const rooms = Array.isArray(roomData?.rooms) ? roomData.rooms : [];
    const seen = new Set<string>();
    const merged = [...lobbies, ...rooms].filter(r => {
      const id = r.id ?? r.roomId;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    setFetchedRooms(merged);
  });
}, []);

  const myName = pickFirst(me?.name, me?.username, "there");

const allRooms: any[] = useMemo(() => {
  const ws = Array.isArray(rooms) ? rooms : [];
  if (ws.length > 0 && fetchedRooms.length > 0) {
    // WS has live counts — enrich with branding from API fetch
    const brandingMap = new Map(fetchedRooms.map((r: any) => [r.id, r]));
    return ws.map((r: any) => {
      const branding = brandingMap.get(r.id) ?? brandingMap.get(r.roomId) ?? {};
      return { ...branding, ...r };
    });
  }
  return ws.length > 0 ? ws : fetchedRooms;
}, [rooms, fetchedRooms]);

const allUsers: any[] = useMemo(() => {
  if (!usersByRoom || typeof usersByRoom !== "object") return [];
  const seen = new Set<string>();
  const out: any[] = [];
  for (const roomUsers of Object.values(usersByRoom) as any[][]) {
    for (const u of roomUsers) {
      const id = u?.id ?? u?.userId;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      // Find which room they're in
      const roomId = Object.keys(usersByRoom).find(rid =>
        (usersByRoom[rid] as any[]).some((ru: any) => ru.id === id)
      );
      out.push({ ...u, room: roomId });
    }
  }
  return out;
}, [usersByRoom]);

  const filtered = useMemo(() => {
    if (!search.trim()) return allRooms;
    const q = search.toLowerCase();
    return allRooms.filter(r => roomName(r).toLowerCase().includes(q));
  }, [allRooms, search]);

  // Lobbies = pinned, sorted by online count desc
  const lobbies = useMemo(() =>
    filtered.filter(r => isPinned(r)).sort((a, b) => onlineCount(b) - onlineCount(a)),
    [filtered]
  );

  // Popular rooms = non-pinned, non-private, at least 1 online
  const popularRooms = useMemo(() =>
    filtered
      .filter(r => !isPinned(r) && !isPrivateRoom(r) && onlineCount(r) > 0)
      .sort((a, b) => onlineCount(b) - onlineCount(a))
      .slice(0, 6),
    [filtered]
  );

  // Featured = most active lobby first, fallback to most active room
  const featured = useMemo(() =>
    lobbies.find(r => onlineCount(r) > 0) ?? lobbies[0] ?? popularRooms[0] ?? null,
    [lobbies, popularRooms]
  );

  const recentIds: string[] = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("weered:recentRooms") || "[]"); }
    catch { return []; }
  }, []);
  const recentRooms = useMemo(() =>
    recentIds.map(id => allRooms.find(r => roomId(r) === id || roomName(r) === id)).filter(Boolean).filter((r: any) => !isPrivateRoom(r)).slice(0, 4),
    [recentIds, allRooms]
  );

  const friends = useMemo(() =>
    allUsers.filter(u => u?.id !== me?.id && u?.id !== me?.userId).slice(0, 8),
    [allUsers, me]
  );

  function handleJoin(id: string, pinned?: boolean) {
    if (!id) return;
    const clean = id.replace("room:", "");
    // Lobbies (pinned) route to /lobby or /lobby/<id>
    if (pinned) {
      if (clean === "lobby") {
        router.push("/lobby");
      } else {
        router.push(`/lobby/${encodeURIComponent(clean)}`);
      }
      return;
    }
    const normalized = id.startsWith("room:") ? id : `room:${id}`;
    try {
      const prev: string[] = JSON.parse(localStorage.getItem("weered:recentRooms") || "[]");
      // Filter out private rooms from recent history
      if (!clean.startsWith("@") && !/^[a-z0-9]{4,7}$/i.test(clean)) {
        localStorage.setItem("weered:recentRooms", JSON.stringify([normalized, ...prev.filter(x => x !== normalized)].slice(0, 10)));
      }
    } catch {}
    try { join?.(normalized); } catch {}
    router.push(`/room/${encodeURIComponent(clean)}`);
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
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px 12px", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontFamily: "monospace", color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{greeting()}</div>
          <div style={{ fontWeight: 800, fontSize: 20, lineHeight: 1.1, marginTop: 2, letterSpacing: "-0.3px" }}>
            Hey, <span style={{ color: "#a78bfa" }}>{myName}</span> 👋
          </div>
        </div>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.3)", fontSize: 14, pointerEvents: "none" }}>⌕</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Find a room or lobby..."
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "8px 14px 8px 34px", color: "#e8e8ec", fontSize: 13, width: 210, outline: "none", fontFamily: "inherit" }} />
        </div>
      </div>

      {/* SCROLL AREA */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "0 20px 32px" }}>

        {/* FEATURED BANNER */}
        {featured && (
          <div style={{ paddingTop: 16 }}>
            <div style={{ fontSize: 10, fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 10 }}>✦ Featured right now</div>
            <div
              onClick={() => handleJoin(roomId(featured), Boolean(featured?.pinned))}
              style={{ position: "relative", borderRadius: 14, overflow: "hidden", height: 180, cursor: "pointer", border: "1px solid rgba(255,255,255,0.08)", background: "linear-gradient(135deg, #1a103a 0%, #0d0d1a 50%, #0d1a1a 100%)", transition: "transform .2s, border-color .2s" }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = "translateY(-1px)"; el.style.borderColor = "rgba(255,255,255,0.16)"; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = "translateY(0)"; el.style.borderColor = "rgba(255,255,255,0.08)"; }}
            >
              <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse at 30% 50%, rgba(124,106,247,0.22) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(34,197,94,0.10) 0%, transparent 50%)" }} />
              <div style={{ position: "absolute", inset: 0, opacity: 0.05, pointerEvents: "none", backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
              <div style={{ position: "absolute", top: 14, left: 18, display: "flex", alignItems: "center", gap: 6, background: "rgba(124,106,247,0.18)", border: "1px solid rgba(124,106,247,0.3)", borderRadius: 99, padding: "3px 10px", fontSize: 10, fontFamily: "monospace", color: "#a78bfa" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#a78bfa", animation: "weered-pulse 2s ease-in-out infinite" }} />
                {featured.pinned ? "✦ Lobby" : "Popular room"}
              </div>
              <div style={{ position: "absolute", top: 14, right: 14, background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "3px 9px", fontSize: 11, fontFamily: "monospace", color: "rgba(255,255,255,0.4)", display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e" }} />
                {onlineCount(featured)} online
              </div>
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "20px 22px", zIndex: 2 }}>
                <div style={{ fontWeight: 800, fontSize: 24, lineHeight: 1.1, marginBottom: featured.description ? 6 : 14 }}>{roomName(featured)}</div>
                {featured.description && <div style={{ fontSize: 12, color: "rgba(232,232,236,0.5)", marginBottom: 12, maxWidth: 400 }}>{featured.description}</div>}
                <button type="button" onClick={e => { e.stopPropagation(); handleJoin(roomId(featured), Boolean(featured?.pinned)); }}
                  style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#7c6af7", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  ↗ Join {featured.pinned ? "Lobby" : "Room"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* LOBBIES */}
        {lobbies.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <SectionHeader icon="✦" label="Lobbies" count={lobbies.length} sub="verified & pinned" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {lobbies.map((r, i) => <LobbyCard key={roomId(r) || i} room={r} idx={i} onJoin={(id) => handleJoin(id, true)} />)}
            </div>
          </div>
        )}

        {/* POPULAR ROOMS */}
        {popularRooms.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <SectionHeader icon="🔥" label="Popular Rooms" count={popularRooms.length} sub="active right now" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {popularRooms.map((r, i) => <RoomCard key={roomId(r) || i} room={r} idx={i} onJoin={handleJoin} />)}
            </div>
          </div>
        )}

        {/* RECENTLY VISITED */}
        {recentRooms.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <SectionHeader icon="🕓" label="Recently Visited" count={recentRooms.length} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {recentRooms.map((r, i) => <RecentRow key={roomId(r) || i} room={r} onJoin={handleJoin} />)}
            </div>
          </div>
        )}

        {/* ACTIVE NOW */}
        {friends.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <SectionHeader icon="👥" label="Active Now" count={friends.length} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {friends.map((u, i) => (
                <FriendCard key={u?.id || i} user={u} onDm={handleDm}
                  onJoin={u => { const rid = pickFirst(u?.room, u?.roomId, u?.activeRoom, ""); if (rid) handleJoin(rid); }} />
              ))}
            </div>
          </div>
        )}

        {/* EMPTY STATE */}
        {lobbies.length === 0 && popularRooms.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "rgba(255,255,255,0.3)" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>👋</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Nothing here yet</div>
            <div style={{ fontSize: 13 }}>Head to Lobby to browse and join rooms.</div>
          </div>
        )}

      </div>
      <style>{`@keyframes weered-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.8)}}`}</style>
    </div>
  );
}
