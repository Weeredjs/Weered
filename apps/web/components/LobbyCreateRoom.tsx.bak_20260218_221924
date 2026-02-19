"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useWeered } from "./WeeredProvider";

function getTokenMaybe(w: any): string {
  const direct =
    w?.token ||
    w?.authToken ||
    w?.session?.token ||
    w?.auth?.token ||
    w?.me?.token;

  if (typeof direct === "string" && direct.trim()) return direct.trim();

  if (typeof window === "undefined") return "";
  const keys = ["weered_token", "token", "auth_token", "weered:token", "weered.jwt"];
  for (const k of keys) {
    const v = window.localStorage.getItem(k);
    if (v && v.trim()) return v.trim();
  }
  return "";
}

export default function LobbyCreateRoom() {
  const w = useWeered() as any;
  const router = useRouter();
  const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [status, setStatus] = useState<string>("");

  const canCreate = useMemo(() => {
    return Boolean(w?.createRoom || w?.create);
  }, [w?.createRoom, w?.create]);

  async function createViaProvider(payload: any) {
    if (typeof w?.createRoom === "function") return await w.createRoom(payload);
    if (typeof w?.create === "function") return await w.create(payload);
    return null;
  }

  async function createViaHttp(payload: any) {
    const token = getTokenMaybe(w);
    const res = await fetch(`${API}/rooms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`POST /rooms failed (${res.status}): ${txt || res.statusText}`);
    }
    return await res.json();
  }

  async function onCreate() {
    const nm = name.trim();
    const id = roomId.trim();

    if (!nm && !id) {
      setStatus("Enter a name or an id.");
      return;
    }

    const payload: any = {};
    if (nm) payload.name = nm;
    if (id) payload.id = id;

    try {
      setStatus("Creating…");

      let out = null;
      // Prefer provider method if it exists (keeps WS state in sync immediately)
      if (canCreate) out = await createViaProvider(payload);

      // Fallback to HTTP create
      if (!out) out = await createViaHttp(payload);

      const createdId =
        out?.room?.id ||
        out?.id ||
        payload.id;

      setStatus("Created.");
      setOpen(false);
      setName("");
      setRoomId("");

      if (createdId) router.push(`/room/${createdId}`);
    } catch (e: any) {
      setStatus(e?.message || "Create failed.");
    }
  }

  return (
    <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <button
        onClick={() => { setStatus(""); setOpen(true); }}
        style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd" }}
      >
        + Create room
      </button>

      {status ? <div style={{ fontSize: 12, opacity: 0.85 }}>{status}</div> : null}

      {open ? (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 14,
            zIndex: 9999,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "min(520px, 96vw)", background: "#fff", borderRadius: 14, padding: 14, border: "1px solid #eee" }}
          >
            <div style={{ fontWeight: 800, fontSize: 16 }}>Create Room</div>

            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Room name (optional)…"
                style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd" }}
              />
              <input
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="Custom room id (optional, e.g. dev-hangout)…"
                style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd" }}
              />
            </div>

            <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                onClick={() => setOpen(false)}
                style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ddd" }}
              >
                Cancel
              </button>
              <button
                onClick={onCreate}
                style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ddd" }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
