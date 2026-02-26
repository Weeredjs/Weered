"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useWeered } from "./WeeredProvider";

function pickFirstString(...vals: any[]): string {
  for (const v of vals) if (typeof v === "string" && v.trim()) return v.trim();
  return "";
}

export default function LobbyChatPanel(props: { title?: string; style?: React.CSSProperties } = {}) {
  const {
    me,
    wsReady,
    wsState,
    activeRoomId,
    joinedRoomId,
    joinStatus,
    msgs,
    sendChat,
  }: any = useWeered();

  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  const wsUp = useMemo(() => {
    if (!!wsReady) return true;
    if (wsState === 1) return true;
    if (typeof wsState === "string" && wsState.toLowerCase() === "open") return true;
    return false;
  }, [wsReady, wsState]);

  const canChat = useMemo(() => {
    const view = String(activeRoomId || "");
    const joined = String(joinedRoomId || "");
    if (!view) return false;
    if (!wsUp) return false;
    if (view !== joined) return false;
    if (String(joinStatus || "") !== "joined") return false;
    return true;
  }, [activeRoomId, joinedRoomId, wsUp, joinStatus]);

  const hint = useMemo(() => {
    const view = String(activeRoomId || "");
    const joined = String(joinedRoomId || "");
    if (!view) return "No room selected.";
    if (!wsUp) return "WS down.";
    if (view !== joined) return "Chat disabled until joined/admitted.";
    if (String(joinStatus || "") !== "joined") return "Joiningâ€¦";
    return "";
  }, [activeRoomId, joinedRoomId, joinStatus, wsUp]);

  function onSend() {
    const b = (text || "").trim();
    if (!b) return;
    if (!canChat) return;
    try { sendChat(b); } catch {}
    setText("");
  }

  useEffect(() => {
    // auto-scroll on new messages
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [msgs?.length]);

  const panel: React.CSSProperties = {
    border: "1px solid rgba(148,163,184,.18)",
    borderRadius: 16,
    background: "rgba(15,23,42,.92)",
    padding: 12,
    ...props.style,
  };

  return (
    <section style={panel}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
        <div style={{ fontWeight: 950 }}>{props.title || "Lobby Chat"}</div>
        <div style={{ opacity: 0.7, fontSize: 12 }}>
          {hint ? hint : `room: ${String(activeRoomId || "â€”")}`}
        </div>
      </div>

      <div
        ref={listRef}
        style={{
          border: "1px solid rgba(148,163,184,.14)",
          borderRadius: 14,
          padding: 10,
          height: 260,
          overflow: "auto",
          background: "rgba(2,6,23,.25)",
          marginBottom: 10,
        }}
      >
        {Array.isArray(msgs) && msgs.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {msgs.map((m: any) => {
              const uname = pickFirstString(m?.user?.name, m?.user?.username, "someone");
              const body = String(m?.body ?? "");
              const isMe = Boolean(me?.id && m?.user?.id && String(me.id) === String(m.user.id));
              return (
                <div key={m?.id || Math.random()} style={{ display: "flex", gap: 10 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 999, display: "grid", placeItems: "center", background: "rgba(255,255,255,.07)", border: "1px solid rgba(148,163,184,.16)", boxShadow: isMe ? "0 0 0 2px var(--weered-accent-ring, rgba(14,165,233,.34))" : "none", fontWeight: 1000, flex: "0 0 auto" }}><span style={{ fontSize: 12 }}>{uname.slice(0,1).toUpperCase()}</span></div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 950, opacity: 0.92 }}>
                      {uname}
                    </div>
                    <div style={{ opacity: 0.92, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                      {body}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ opacity: 0.7 }}>No messages yet.</div>
        )}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder={canChat ? "Message..." : "Join/admit requiredâ€¦"}
          disabled={!canChat}
          style={{ flex: 1, padding: "10px 12px", borderRadius: 12 }}
        />
        <button
          onClick={onSend}
          disabled={!canChat}
          style={{ padding: "10px 12px", borderRadius: 12, fontWeight: 950 }}
        >
          Send
        </button>
      </div>
    </section>
  );
}
