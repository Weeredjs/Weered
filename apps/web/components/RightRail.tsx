"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWeered } from "./WeeredProvider";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE as string) || "http://127.0.0.1:4000";

type RoomRow = { id: string; name: string; locked: boolean; users: number };

function authHeaders() {
  try { const t = localStorage.getItem("weered_token") || ""; return t ? { Authorization: `Bearer ${t}` } : {}; } catch { return {}; }
}

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API_BASE}${path}`, { ...opts, headers: { "Content-Type": "application/json", ...authHeaders(), ...(opts?.headers || {}) } });
  return r.json();
}

function RoomsPanel({ currentRoomId }: { currentRoomId: string }) {
  const [q, setQ]           = React.useState("");
  const [newRoom, setNewRoom] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [rows, setRows]     = React.useState<RoomRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr]       = React.useState("");

  async function load() {
    setLoading(true); setErr("");
    try {
      const r = await fetch(API_BASE + "/rooms", { cache: "no-store" });
      const j = await r.json();
      setRows((Array.isArray(j?.rooms) ? j.rooms : []).map((r: any) => ({
        id: String(r.id || ""), name: String(r.name || r.id || ""),
        locked: Boolean(r.locked), users: Number(r.users ?? r.memberCount ?? 0),
      })).filter((r: RoomRow) => r.id));
    } catch (e: any) { setErr(String(e?.message || e)); }
    finally { setLoading(false); }
  }

  async function createRoom() {
    const id = newRoom.trim(); if (!id) return;
    setCreating(true); setErr("");
    try {
      const j = await fetch(API_BASE + "/rooms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, name: id }) }).then(r => r.json());
      if (!j?.ok) throw new Error(j?.error || "create failed");
      setNewRoom(""); await load();
    } catch (e: any) { setErr(String(e?.message || e)); }
    finally { setCreating(false); }
  }

  React.useEffect(() => { void load(); const t = setInterval(load, 6000); return () => clearInterval(t); }, []);

  const filtered = rows
    .filter(r => !q.trim() || (r.name + " " + r.id).toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => b.users - a.users);

  const s = {
    input: { width: "100%", padding: "7px 10px", borderRadius: 9, border: "1px solid rgba(255,255,255,.10)", background: "rgba(0,0,0,.25)", fontSize: 12, color: "rgba(243,244,246,.90)", outline: "none", boxSizing: "border-box" as const },
    btn:   { padding: "7px 10px", borderRadius: 9, border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.05)", fontSize: 12, cursor: "pointer", color: "rgba(243,244,246,.90)", flexShrink: 0 } as React.CSSProperties,
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.5, letterSpacing: ".7px", textTransform: "uppercase", marginBottom: 8 }}>Rooms</div>

      {/* Create */}
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <input style={s.input} placeholder="New room name…" value={newRoom}
          onChange={e => setNewRoom(e.target.value)}
          onKeyDown={e => e.key === "Enter" && createRoom()} />
        <button style={s.btn} onClick={createRoom} disabled={creating || !newRoom.trim()}>
          {creating ? "…" : "Create"}
        </button>
      </div>

      {/* Search */}
      <input style={{ ...s.input, marginBottom: 8 }} placeholder="Search rooms…" value={q} onChange={e => setQ(e.target.value)} />

      {err && <div style={{ fontSize: 11, color: "rgba(252,165,165,.80)", marginBottom: 6 }}>{err}</div>}

      {/* List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 360, overflowY: "auto" }}>
        {loading && !rows.length && <div style={{ fontSize: 12, opacity: 0.5 }}>Loading…</div>}
        {!loading && !filtered.length && <div style={{ fontSize: 12, opacity: 0.5 }}>No rooms.</div>}
        {filtered.slice(0, 40).map(rm => {
          const active = rm.id === currentRoomId;
          const hasUsers = rm.users > 0;
          return (
            <Link key={rm.id} href={"/room/" + encodeURIComponent(rm.id)} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
              padding: "8px 10px", borderRadius: 10, textDecoration: "none",
              border: active ? "1px solid rgba(124,58,237,.40)" : "1px solid rgba(255,255,255,.07)",
              background: active ? "rgba(124,58,237,.10)" : "rgba(255,255,255,.02)",
              transition: "background 0.12s",
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "rgba(243,244,246,.95)" }}>
                  {rm.name || rm.id}
                  {rm.locked ? <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.6 }}>🔒</span> : null}
                </div>
                <div style={{ fontSize: 11, opacity: 0.45, marginTop: 1 }}>{rm.users} online</div>
              </div>
              {hasUsers && (
                <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 999, border: "1px solid rgba(124,58,237,.30)", background: "rgba(124,58,237,.10)", color: "rgba(216,180,254,.85)", flexShrink: 0 }}>
                  open
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function LobbyModPanel({ globalRole }: { globalRole: string }) {
  const canMod = globalRole === "GOD" || globalRole === "STAFF" || globalRole === "SUPPORT";
  if (!canMod) return null;

  const [note, setNote]   = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function action(type: string) {
    setLoading(true); setNote("");
    try {
      const j = await apiFetch("/staff/lobby/" + type, { method: "POST", body: JSON.stringify({}) });
      setNote(j.ok ? `Done: ${type}` : j.error || "Failed.");
    } catch { setNote("Request failed."); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.5, letterSpacing: ".7px", textTransform: "uppercase", marginBottom: 8 }}>Lobby Controls</div>
      <div style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.02)", padding: "10px 12px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <button disabled={loading} onClick={() => action("lock")}
            style={{ padding: "8px 10px", borderRadius: 9, border: "1px solid rgba(245,158,11,.25)", background: "rgba(245,158,11,.08)", fontSize: 12, cursor: "pointer", color: "rgb(253,230,138)" }}>
            Lock Chat
          </button>
          <button disabled={loading} onClick={() => action("unlock")}
            style={{ padding: "8px 10px", borderRadius: 9, border: "1px solid rgba(16,185,129,.25)", background: "rgba(16,185,129,.08)", fontSize: 12, cursor: "pointer", color: "rgb(167,243,208)" }}>
            Unlock Chat
          </button>
          <button disabled={loading} onClick={() => { if (confirm("Clear all lobby chat messages?")) action("clear-chat"); }}
            style={{ padding: "8px 10px", borderRadius: 9, border: "1px solid rgba(239,68,68,.25)", background: "rgba(239,68,68,.08)", fontSize: 12, cursor: "pointer", color: "rgba(252,165,165,.90)", gridColumn: "span 2" }}>
            Clear Chat
          </button>
        </div>
        {note && <div style={{ marginTop: 8, fontSize: 11, opacity: 0.65 }}>{note}</div>}
      </div>
    </div>
  );
}

export default function RightRail() {
  const pathname     = usePathname() || "";
  const { globalRole } = useWeered() as any;

  const currentRoomId = (() => {
    if (pathname === "/lobby") return "lobby";
    if (pathname.startsWith("/room/")) return decodeURIComponent(pathname.replace("/room/", ""));
    return "lobby";
  })();

  const ctxLabel = (() => {
    if (pathname === "/lobby") return "lobby";
    if (pathname.startsWith("/room/")) return "room: " + decodeURIComponent(pathname.replace("/room/", ""));
    return pathname;
  })();

  return (
    <div style={{ padding: "14px 14px 20px", fontSize: 13, color: "rgba(243,244,246,.92)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 13 }}>Control Panel</div>
          <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>context: {ctxLabel}</div>
        </div>
        <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 999, border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.04)", opacity: 0.7 }}>tools</span>
      </div>

      <LobbyModPanel globalRole={globalRole || ""} />
      <RoomsPanel currentRoomId={currentRoomId} />
    </div>
  );
}
