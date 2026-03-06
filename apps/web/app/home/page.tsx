"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useWeered } from "../../components/WeeredProvider";

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

const ROOM_EMOJIS: Record<string, string> = {
  lobby: "🏠", ops: "⚙️", gaming: "🎮", music: "🎵",
  crypto: "💸", tech: "🤖", news: "🌎", food: "🍕",
  art: "🎨", sports: "⚽", film: "🎬", books: "📚",
};

function emojiFor(name: string): string {
  const n = name.toLowerCase();
  for (const [k, v] of Object.entries(ROOM_EMOJIS)) {
    if (n.includes(k)) return v;
  }
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

function RoomCard({ room, idx, onJoin }: { room: any; idx: number; onJoin: (id: string) => void }) {
  const name = roomName(room);
  const cnt  = onlineCount(room);
  const acc  = ACCENTS[idx % ACCENTS.length];
  const em   = emojiFor(name);

  return (
    <div
      onClick={() => onJoin(roomId(room))}
      style={{
        background: "var(--weered-panel, #141416)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 12, padding: "13px 14px",
        cursor: "pointer", position: "relative", overflow: "hidden",
        transition: "border-color .2s, transform .15s",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.18)";
        (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)";
        (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${acc.bar}88, ${acc.bar})`, borderRadius: "12px 12px 0 0" }} />
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: acc.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
          {em}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontFamily: "monospace", color: "#22c55e" }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 5px #22c55e" }} />
          {cnt}
        </div>
      </div>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 10 }}>{cnt === 1 ? "1 person online" : `${cnt} people online`}</div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ fontSize: 10, fontFamily: "monospace", background: "rgba(255,255,255,0.05)", borderRadius: 4, padding: "2px 7px", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>room</div>
      </div>
    </div>
  );
}

function RecentRow({ room, onJoin }: { room: any; onJoin: (id: string) => void }) {
  const name = roomName(room);
  const cnt  = onlineCount(room);
  const em   = emojiFor(name);
  return (
    <div
      onClick={() => onJoin(roomId(room))}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 12px", background: "var(--weered-panel, #141416)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, cursor: "pointer", transition: "border-color .2s, background .2s" }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.16)"; (e.currentTarget as HTMLElement).style.background = "#16161a"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLElement).style.background = "var(--weered-panel, #141416)"; }}
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
        <button type="button" onClick={e => { e.stopPropagation(); onJoin(roomId(room)); }} style={{ background: "rgba(124,106,247,0.12)", border: "1px solid rgba(124,106,247,0.25)", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, color: "#a78bfa", cursor: "pointer" }}>
          Rejoin
        </button>
      </div>
    </div>
  );
}

function FriendCard({ user, onDm, onJoin }: { user: any; onDm: (u: any) => void; onJoin?: (u: any) => void }) {
  const name    = pickFirst(user?.name, user?.username, "?");
  const initial = name[0]?.toUpperCase() ?? "?";
  const inRoom  = Boolean(user?.room ?? user?.roomId ?? user?.activeRoom);
  const loc     = inRoom ? (user?.room ?? user?.roomId ?? "a room") : "lobby";
  const colors  = ["#7c6af7", "#22c55e", "#f97316", "#60a5fa", "#ef4444", "#eab308"];
  const color   = colors[name.charCodeAt(0) % colors.length];

  return (
    <div
      style={{ background: "var(--weered-panel, #141416)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 12, cursor: "pointer", textAlign: "center", transition: "border-color .2s, transform .15s" }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.16)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
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
        <button type="button" onClick={e => { e.stopPropagation(); onDm(user); }} style={{ flex: 1, borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", fontSize: 10, fontFamily: "monospace", color: "rgba(255,255,255,0.5)", padding: "4px 6px", cursor: "pointer" }}>DM</button>
        {inRoom && onJoin && (
          <button type="button" onClick={e => { e.stopPropagation(); onJoin(user); }} style={{ flex: 1, borderRadius: 6, background: "rgba(124,106,247,0.12)", border: "1px solid rgba(124,106,247,0.25)", fontSize: 10, fontFamily: "monospace", color: "#a78bfa", padding: "4px 6px", cursor: "pointer" }}>Join</button>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ icon, label, count }: { icon: string; label: string; count: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 11 }}>
      <div style={{ fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
        {icon} {label}
        <span style={{ fontSize: 10, fontFamily: "monospace", color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 99, padding: "1px 8px" }}>{count}</span>
      </div>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { rooms, users, me, join } = useWeered() as any;
  const [search, setSearch] = useState("");

  const myName   = pickFirst(me?.name, me?.username, "there");
  const allRooms: any[] = useMemo(() => (Array.isArray(rooms) ? rooms : []), [rooms]);
  const allUsers: any[] = useMemo(() => (Array.isArray(users) ? users : []), [users]);

  const filteredRooms = useMemo(() => {
    if (!search.trim()) return allRooms;
    const q = search.toLowerCase();
    return allRooms.filter(r => roomName(r).toLowerCase().includes(q));
  }, [allRooms, search]);

  const popularRooms = useMemo(() => [...filteredRooms].sort((a, b) => onlineCount(b) - onlineCount(a)).slice(0, 6), [filteredRooms]);

  const recentIds: string[] = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("weered:recentRooms") || "[]"); }
    catch { return []; }
  }, []);

  const recentRooms = useMemo(() =>
    recentIds.map(id => allRooms.find(r => roomId(r) === id || roomName(r) === id)).filter(Boolean).slice(0, 4),
    [recentIds, allRooms]
  );

  const friends = useMemo(() =>
    allUsers.filter(u => u?.id !== me?.id && u?.id !== me?.userId).slice(0, 8),
    [allUsers, me]
  );

  const featured = useMemo(() => popularRooms[0] ?? null, [popularRooms]);

  function handleJoin(id: string) {
    if (!id) return;
    const normalized = id.startsWith("room:") ? id : `room:${id}`;
    try {
      const prev: string[] = JSON.parse(localStorage.getItem("weered:recentRooms") || "[]");
      const next = [normalized, ...prev.filter(x => x !== normalized)].slice(0, 10);
      localStorage.setItem("weered:recentRooms", JSON.stringify(next));
    } catch {}
    try { join?.(normalized); } catch {}
    router.push(`/room/${encodeURIComponent(id.replace("room:", ""))}`);
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
          <div style={{ fontSize: 11, fontFamily: "monospace", color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em", textTransform: "uppercase" }}>{greeting()}</div>
          <div style={{ fontWeight: 800, fontSize: 20, lineHeight: 1.1, marginTop: 2, letterSpacing: "-0.3px" }}>
            Hey, <span style={{ color: "#a78bfa" }}>{myName}</span> 👋
          </div>
        </div>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.3)", fontSize: 14, pointerEvents: "none" }}>⌕</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Find a room..." style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "8px 14px 8px 34px", color: "#e8e8ec", fontSize: 13, width: 200, outline: "none", fontFamily: "inherit" }} />
        </div>
      </div>

      {/* SCROLL AREA */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "0 20px 32px" }}>

        {/* FEATURED */}
        {featured && (
          <div style={{ paddingTop: 16 }}>
            <div style={{ fontSize: 10, fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 10 }}>✦ Featured right now</div>
            <div
              onClick={() => handleJoin(roomId(featured))}
              style={{ position: "relative", borderRadius: 14, overflow: "hidden", height: 180, cursor: "pointer", border: "1px solid rgba(255,255,255,0.08)", background: "linear-gradient(135deg, #1a103a 0%, #0d0d1a 50%, #0d1a1a 100%)", transition: "transform .2s, border-color .2s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.16)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; }}
            >
              <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse at 30% 50%, rgba(124,106,247,0.22) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(34,197,94,0.10) 0%, transparent 50%)" }} />
              <div style={{ position: "absolute", inset: 0, opacity: 0.06, pointerEvents: "none", backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
              <div style={{ position: "absolute", top: 14, left: 18, display: "flex", alignItems: "center", gap: 6, background: "rgba(124,106,247,0.18)", border: "1px solid rgba(124,106,247,0.35)", borderRadius: 99, padding: "3px 10px", fontSize: 10, fontFamily: "monospace", color: "#a78bfa" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#a78bfa" }} />
                Most active
              </div>
              <div style={{ position: "absolute", top: 14, right: 14, background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "3px 9px", fontSize: 11, fontFamily: "monospace", color: "rgba(255,255,255,0.4)", display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e" }} />
                {onlineCount(featured)} online
              </div>
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "20px 22px", zIndex: 2 }}>
                <div style={{ fontWeight: 800, fontSize: 24, lineHeight: 1.1, marginBottom: 14 }}>{roomName(featured)}</div>
                <button type="button" onClick={e => { e.stopPropagation(); handleJoin(roomId(featured)); }} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#7c6af7", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  ↗ Join Room
                </button>
              </div>
            </div>
          </div>
        )}

        {/* POPULAR */}
        {popularRooms.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <SectionHeader icon="🔥" label="Popular Rooms" count={popularRooms.length} />
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
              {friends.map((u, i) => <FriendCard key={u?.id || i} user={u} onDm={handleDm} onJoin={u => { const rid = pickFirst(u?.room, u?.roomId, u?.activeRoom, ""); if (rid) handleJoin(rid); }} />)}
            </div>
          </div>
        )}

        {/* EMPTY STATE */}
        {allRooms.length === 0 && friends.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "rgba(255,255,255,0.3)" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>👋</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>No rooms yet</div>
            <div style={{ fontSize: 13 }}>Head to Lobby to browse and join rooms.</div>
          </div>
        )}

      </div>
    </div>
  );
}
