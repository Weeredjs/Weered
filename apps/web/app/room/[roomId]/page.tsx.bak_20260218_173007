"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://127.0.0.1:4001";

type RoomUser = { id: string; name: string };
type ChatMsg = { id: string; user: RoomUser; body: string; ts: number };

export default function RoomPage({ params }: { params: { roomId: string } }) {
  const roomId = String(params?.roomId || "");
  const [token, setToken] = useState<string>("");
  const [me, setMe] = useState<any>(null);

  const [users, setUsers] = useState<RoomUser[]>([]);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [text, setText] = useState("");

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    try {
      const t = localStorage.getItem("weered_token") || "";
      const u = localStorage.getItem("weered_user") || "";
      setToken(t);
      setMe(u ? JSON.parse(u) : null);
    } catch {}
  }, []);

  useEffect(() => {
    if (!token || !roomId) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "auth:hello", token }));
    };

    ws.onmessage = (ev) => {
      let msg: any = null;
      try { msg = JSON.parse(String(ev.data || "")); } catch { return; }
      if (!msg || typeof msg.type !== "string") return;

      // accept payload-wrapped or top-level
      if (msg.payload && typeof msg.payload === "object") msg = { ...msg, ...msg.payload };

      if (msg.type === "auth:ok") {
        ws.send(JSON.stringify({ type: "presence:join", roomId }));
        return;
      }

      if (msg.type === "presence:state" && String(msg.roomId || "") === roomId) {
        setUsers(Array.isArray(msg.users) ? msg.users : []);
        return;
      }

      if (msg.type === "chat:new" && String(msg.roomId || "") === roomId) {
        const m = msg.msg as ChatMsg;
        if (m && m.id) setMsgs((prev) => [...prev, m].slice(-200));
        return;
      }
    };

    ws.onclose = () => {};
    ws.onerror = () => {};

    return () => {
      try { ws.send(JSON.stringify({ type: "presence:leave", roomId })); } catch {}
      try { ws.close(); } catch {}
      wsRef.current = null;
    };
  }, [token, roomId]);

  const canSend = useMemo(() => Boolean((text || "").trim()), [text]);

  function sendChat() {
    const body = (text || "").trim();
    if (!body) return;
    const ws = wsRef.current;
    if (!ws || ws.readyState !== 1) return;
    ws.send(JSON.stringify({ type: "chat:send", roomId, body }));
    setText("");
  }

  return (
    <main style={{ padding: 18, fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0 }}>Room: {roomId}</h2>
          <div style={{ fontSize: 12, color: "#666" }}>Users: {users.length}</div>
        </div>
        <Link href="/" style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", textDecoration: "none" }}>
          Home
        </Link>
      </div>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "260px 1fr", gap: 12 }}>
        <aside style={{ border: "1px solid #eee", borderRadius: 14, padding: 12, minHeight: 300 }}>
          <div style={{ fontWeight: 700 }}>Presence</div>
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
            {users.length === 0 ? (
              <div style={{ color: "#777" }}>No users yet.</div>
            ) : (
              users.map((u) => (
                <div key={u.id} style={{ border: "1px solid #eee", borderRadius: 12, padding: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{u.name}</div>
                  <div style={{ fontSize: 11, color: "#666", wordBreak: "break-all" }}>{u.id}</div>
                </div>
              ))
            )}
          </div>
        </aside>

        <section style={{ border: "1px solid #eee", borderRadius: 14, padding: 12, minHeight: 300, display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, overflow: "auto", padding: 8, border: "1px solid #f1f1f1", borderRadius: 12 }}>
            {msgs.length === 0 ? (
              <div style={{ color: "#777", textAlign: "center", marginTop: 50 }}>No messages yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {msgs.map((m) => (
                  <div key={m.id} style={{ border: "1px solid #eee", borderRadius: 12, padding: 10 }}>
                    <div style={{ fontWeight: 800, fontSize: 13 }}>{m.user?.name || "?"}</div>
                    <div style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>{m.body}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") sendChat(); }}
              placeholder="Message..."
              style={{ flex: 1, padding: 10, borderRadius: 12, border: "1px solid #ddd" }}
            />
            <button
              onClick={sendChat}
              disabled={!canSend}
              style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", background: "#fff", cursor: "pointer", opacity: canSend ? 1 : 0.5 }}
            >
              Send
            </button>
          </div>
        </section>
      </div>

      <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
        WS: {WS_URL} • API: {API}
      </div>
    </main>
  );
}
