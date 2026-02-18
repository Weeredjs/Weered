"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

type Room = { id: string; roomId: string; name?: string; users?: number };

export default function HomePage() {
  const router = useRouter();
  const [username, setUsername] = useState("Guest");
  const [token, setToken] = useState<string>("");
  const [me, setMe] = useState<any>(null);

  const [rooms, setRooms] = useState<Room[]>([]);
  const [createName, setCreateName] = useState("");
  const [joinId, setJoinId] = useState("");

  async function loadRooms() {
    try {
      const r = await fetch(`${API}/rooms`, { cache: "no-store" });
      const j = await r.json();
      setRooms(Array.isArray(j?.rooms) ? j.rooms : []);
    } catch {
      setRooms([]);
    }
  }

  async function devLogin(name: string) {
    const r = await fetch(`${API}/auth/dev-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: name }),
    });
    const j = await r.json();
    if (j?.token) {
      setToken(j.token);
      setMe(j.user || null);
      localStorage.setItem("weered_token", j.token);
      localStorage.setItem("weered_user", JSON.stringify(j.user || null));
    }
  }

  async function createRoom() {
    try {
      const r = await fetch(`${API}/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: createName || "" }),
      });
      const j = await r.json();
      const roomId = String(j?.roomId || j?.id || "");
      if (roomId) router.push(`/room/${roomId}`);
    } catch {}
  }

  function joinRoom() {
    const id = (joinId || "").trim();
    if (!id) return;
    router.push(`/room/${encodeURIComponent(id)}`);
  }

  useEffect(() => {
    try {
      const t = localStorage.getItem("weered_token") || "";
      const u = localStorage.getItem("weered_user") || "";
      if (t) setToken(t);
      if (u) setMe(JSON.parse(u));
    } catch {}
    loadRooms();
    const h = setInterval(loadRooms, 2500);
    return () => clearInterval(h);
  }, []);

  const authed = useMemo(() => Boolean(token), [token]);

  return (
    <main style={{ padding: 18, fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>Weered Lobby</h2>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            onClick={() => { localStorage.removeItem("weered_token"); localStorage.removeItem("weered_user"); setToken(""); setMe(null); }}
            style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}
          >
            Logout
          </button>
          <button
            onClick={loadRooms}
            style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}
          >
            Refresh
          </button>
        </div>
      </div>

      <div style={{ marginTop: 10, color: "#555" }}>
        {authed ? (
          <>Logged in as <b>{me?.name || "?"}</b></>
        ) : (
          <>Not logged in</>
        )}
      </div>

      <section style={{ marginTop: 16, border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
        <div style={{ fontWeight: 700 }}>Dev Login</div>
        <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center" }}>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Your name"
            style={{ flex: 1, padding: 10, borderRadius: 12, border: "1px solid #ddd" }}
          />
          <button
            onClick={() => devLogin(username)}
            style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}
          >
            Login
          </button>
        </div>
      </section>

      <section style={{ marginTop: 16, border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
        <div style={{ fontWeight: 700 }}>Create Room</div>
        <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center" }}>
          <input
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            placeholder="Optional room name"
            style={{ flex: 1, padding: 10, borderRadius: 12, border: "1px solid #ddd" }}
          />
          <button
            onClick={createRoom}
            style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}
          >
            Create
          </button>
        </div>
      </section>

      <section style={{ marginTop: 16, border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
        <div style={{ fontWeight: 700 }}>Join Room</div>
        <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center" }}>
          <input
            value={joinId}
            onChange={(e) => setJoinId(e.target.value)}
            placeholder="Room ID"
            style={{ flex: 1, padding: 10, borderRadius: 12, border: "1px solid #ddd" }}
          />
          <button
            onClick={joinRoom}
            style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}
          >
            Join
          </button>
        </div>
      </section>

      <section style={{ marginTop: 16, border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 700 }}>Recent Rooms</div>
          <span style={{ fontSize: 12, color: "#666" }}>{rooms.length}</span>
        </div>

        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          {rooms.length === 0 ? (
            <div style={{ color: "#777" }}>No rooms yet.</div>
          ) : (
            rooms.map((r) => (
              <div key={r.roomId} style={{ display: "flex", justifyContent: "space-between", gap: 10, border: "1px solid #eee", borderRadius: 12, padding: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{r.name || r.roomId}</div>
                  <div style={{ fontSize: 12, color: "#666", wordBreak: "break-all" }}>{r.roomId}</div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "#666" }}>users: {r.users ?? 0}</span>
                  <Link href={`/room/${encodeURIComponent(r.roomId)}`} style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", textDecoration: "none" }}>
                    Open
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
