"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import SubredditBrowser from "../../components/SubredditBrowser";

function pickFirstString(...vals: any[]): string {
  for (const v of vals) if (typeof v === "string" && v.trim()) return v.trim();
  return "";
}

export default function LobbyPage() {
  const sp = useSearchParams();
  const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

  const [rooms, setRooms] = useState<any[]>([]);
  const [createName, setCreateName] = useState("");

  const subParam = useMemo(() => sp.get("sub") || "r/all", [sp]);
  const sub = useMemo(() => subParam.replace(/^r\//i, ""), [subParam]);

  async function loadRooms() {
    try {
      const r = await fetch(`${API}/rooms`, { cache: "no-store" });
      const j = await r.json();
      setRooms(Array.isArray(j?.rooms) ? j.rooms : Array.isArray(j) ? j : []);
    } catch {
      setRooms([]);
    }
  }

  async function createRoom() {
    const name = createName.trim();
    if (!name) return;
    try {
      await fetch(`${API}/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setCreateName("");
      loadRooms();
    } catch {}
  }

  useEffect(() => { loadRooms(); }, []);

  const panel: React.CSSProperties = {
    border: "1px solid rgba(148,163,184,.18)",
    borderRadius: 16,
    background: "rgba(15,23,42,.92)",
    padding: 12,
    minHeight: 520,
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ opacity: 0.7, fontSize: 12, fontWeight: 900 }}>lobby</div>
          <div style={{ fontSize: 18, fontWeight: 1000 }}>
            Weered Lobby — {subParam}
          </div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>
            Subreddit = lobby • Rooms list lives under this lobby
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <Link href={`/r/${encodeURIComponent(sub)}`} style={{ padding: "8px 10px", borderRadius: 12, border: "1px solid rgba(148,163,184,.24)", background: "rgba(255,255,255,.06)", fontWeight: 950, textDecoration: "none", color: "rgba(243,244,246,.98)" }}>
            Open subreddit
          </Link>
          <button onClick={loadRooms} style={{ padding: "8px 10px", borderRadius: 12 }}>
            Refresh
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1.7fr 1.1fr", gap: 14 }}>
        {/* Rooms */}
        <section style={panel}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontWeight: 950 }}>Rooms</div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>{rooms.length}</div>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Room name..."
              style={{ flex: 1, padding: "8px 10px", borderRadius: 12 }}
            />
            <button onClick={createRoom} style={{ padding: "8px 10px", borderRadius: 12 }}>
              Create
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 430, overflow: "auto" }}>
            {rooms.map((r: any) => (
              <div key={r.id ?? Math.random()} style={{ border: "1px solid rgba(148,163,184,.14)", borderRadius: 14, padding: 10, display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 950, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {pickFirstString(r.name, r.id)}
                  </div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>
                    id: {r.id} • users: {r.users ?? r.userCount ?? "—"}
                  </div>
                </div>
                <Link href={`/room/${r.id}`} style={{ padding: "6px 10px", borderRadius: 12, border: "1px solid rgba(148,163,184,.20)", background: "rgba(255,255,255,.05)", fontWeight: 950, textDecoration: "none", color: "rgba(243,244,246,.98)", height: 32 }}>
                  Open
                </Link>
              </div>
            ))}
            {!rooms.length ? <div style={{ opacity: 0.7 }}>No rooms found.</div> : null}
          </div>
        </section>

        {/* Subreddit Browser */}
        <SubredditBrowser subreddit={sub} />

        {/* Lobby chat placeholder */}
        <section style={panel}>
          <div style={{ fontWeight: 950, marginBottom: 10 }}>Lobby Chat</div>
          <div style={{ opacity: 0.7 }}>
            v1: Chat remains in the Dock. Next patch wires lobby chat to render here too.
          </div>
        </section>
      </div>
    </div>
  );
}