"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE as string) || "http://127.0.0.1:4000";

type RoomRow = {
  id: string;
  name: string;
  locked: boolean;
  users: number;
};

function subredditFromRoom(id: string, name: string): string | null {
  const s = (name || id || "").trim();
  const m = s.match(/^r\/([a-zA-Z0-9_]+)$/i) || s.match(/^([a-zA-Z0-9_]+)$/i);
  // Only treat as subreddit if it looks like a clean subreddit name
  if (s.toLowerCase().startsWith("r/")) return s.replace(/^r\//i, "");
  return null;
}

function RoomIcon({ id, name }: { id: string; name: string }) {
  const sub = subredditFromRoom(id, name);
  const [imgOk, setImgOk] = useState(true);
  const initial = (name || id || "?").trim().slice(0, 1).toUpperCase();

  if (sub && imgOk) {
    return (
      <img
        src={`https://www.redditstatic.com/desktop2x/img/snoovatars/snoo.png`}
        alt=""
        width={36} height={36}
        style={{ borderRadius: 10, objectFit: "cover", flexShrink: 0 }}
        onError={() => setImgOk(false)}
      />
    );
  }

  // Fallback: generated initial avatar
  const hue = Math.abs([...id].reduce((a: number, c: string) => a + c.charCodeAt(0), 0)) % 360;
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
      background: `hsl(${hue}, 55%, 28%)`,
      border: `1px solid hsl(${hue}, 55%, 38%)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 900, fontSize: 15, color: `hsl(${hue}, 80%, 85%)`,
    }}>
      {initial}
    </div>
  );
}

export default function LobbyBrowser() {
  const router = useRouter();
  const [open, setOpen]     = useState(false);
  const [rooms, setRooms]   = useState<RoomRow[]>([]);
  const [q, setQ]           = useState("");
  const [loading, setLoading] = useState(false);
  const intervalRef         = useRef<any>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(API_BASE + "/rooms", { cache: "no-store" });
      const j = await r.json();
      const list: RoomRow[] = (Array.isArray(j?.rooms) ? j.rooms : []).map((r: any) => ({
        id:     String(r.id || ""),
        name:   String(r.name || r.id || ""),
        locked: Boolean(r.locked),
        users:  Number(r.users ?? r.memberCount ?? 0),
      })).filter((r: RoomRow) => r.id && r.id !== "@me" && r.id !== "lobby");
      setRooms(list);
    } catch {}
    finally { setLoading(false); }
  }

  // Listen for browse event
  useEffect(() => {
    const onBrowse = () => { setOpen(true); load(); };
    window.addEventListener("weered:lobby:browse", onBrowse);
    return () => window.removeEventListener("weered:lobby:browse", onBrowse);
  }, []);

  // Poll while open
  useEffect(() => {
    if (open) {
      load();
      intervalRef.current = setInterval(load, 6000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [open]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const filtered = rooms
    .filter(r => {
      if (!q.trim()) return true;
      return (r.name + " " + r.id).toLowerCase().includes(q.trim().toLowerCase());
    })
    .sort((a, b) => b.users - a.users);

  const active  = filtered.filter(r => r.users > 0);
  const inactive = filtered.filter(r => r.users === 0);

  function goRoom(id: string) {
    router.push("/room/" + encodeURIComponent(id));
    setOpen(false);
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 9000, backdropFilter: "blur(2px)" }}
        />
      )}

      {/* Slideout panel */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: "min(580px, 92vw)",
        background: "var(--weered-panel, rgba(17,24,39,.97))",
        borderLeft: "1px solid var(--weered-border)",
        zIndex: 9001,
        display: "flex", flexDirection: "column",
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.28s cubic-bezier(.22,.61,.36,1)",
        boxShadow: open ? "-20px 0 60px rgba(0,0,0,.45)" : "none",
      }}>
        {/* Header */}
        <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid var(--weered-border)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: 18, letterSpacing: "-.2px" }}>Browse Rooms</div>
              <div style={{ fontSize: 12, opacity: 0.55, marginTop: 2 }}>
                {loading ? "Refreshing…" : `${rooms.length} rooms · ${active.length} active`}
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{ padding: "7px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.06)", fontSize: 13, cursor: "pointer", color: "rgba(243,244,246,.9)" }}
            >
              Close
            </button>
          </div>

          <input
            autoFocus={open}
            placeholder="Search rooms…"
            value={q}
            onChange={e => setQ(e.target.value)}
            style={{ width: "100%", padding: "9px 13px", borderRadius: 12, border: "1px solid rgba(255,255,255,.12)", background: "rgba(0,0,0,.35)", fontSize: 14, color: "rgba(243,244,246,.95)", outline: "none", boxSizing: "border-box" }}
          />
        </div>

        {/* Room list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>

          {active.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.5, letterSpacing: ".8px", textTransform: "uppercase", marginBottom: 8 }}>
                Active · {active.length}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
                {active.map(r => <RoomCard key={r.id} room={r} onJoin={goRoom} />)}
              </div>
            </>
          )}

          {inactive.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.5, letterSpacing: ".8px", textTransform: "uppercase", marginBottom: 8 }}>
                Empty · {inactive.length}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {inactive.map(r => <RoomCard key={r.id} room={r} onJoin={goRoom} />)}
              </div>
            </>
          )}

          {!loading && filtered.length === 0 && (
            <div style={{ opacity: 0.45, fontSize: 13, padding: "24px 0" }}>No rooms found.</div>
          )}
        </div>
      </div>
    </>
  );
}

function RoomCard({ room, onJoin }: { room: RoomRow; onJoin: (id: string) => void }) {
  const isActive = room.users > 0;
  return (
    <button
      onClick={() => onJoin(room.id)}
      style={{
        width: "100%", textAlign: "left", cursor: "pointer",
        padding: "11px 13px", borderRadius: 14,
        border: `1px solid ${isActive ? "rgba(124,58,237,.30)" : "rgba(255,255,255,.07)"}`,
        background: isActive ? "rgba(124,58,237,.08)" : "rgba(255,255,255,.02)",
        display: "flex", alignItems: "center", gap: 12,
        transition: "background 0.12s, border-color 0.12s",
        color: "rgba(243,244,246,.95)",
      }}
      onMouseEnter={e => { (e.currentTarget as any).style.background = isActive ? "rgba(124,58,237,.14)" : "rgba(255,255,255,.05)"; }}
      onMouseLeave={e => { (e.currentTarget as any).style.background = isActive ? "rgba(124,58,237,.08)" : "rgba(255,255,255,.02)"; }}
    >
      <RoomIcon id={room.id} name={room.name} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {room.name || room.id}
        </div>
        <div style={{ fontSize: 12, opacity: 0.55, marginTop: 2 }}>
          {room.id !== room.name ? room.id + " · " : ""}
          {room.locked ? "🔒 locked · " : ""}
          {room.users > 0 ? `${room.users} online` : "empty"}
        </div>
      </div>

      {isActive && (
        <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 999, border: "1px solid rgba(124,58,237,.35)", background: "rgba(124,58,237,.14)", color: "rgba(216,180,254,.90)", fontWeight: 700, flexShrink: 0 }}>
          open
        </span>
      )}
    </button>
  );
}
