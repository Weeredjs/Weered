"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useOverlay } from "./overlays/OverlayProvider";
import { useWeered } from "./WeeredProvider";

export default function LobbyChatPanel(
  props: { title?: string; style?: React.CSSProperties; roomId?: string; embedded?: boolean } = {}
) {
  const { replaceTop } = useOverlay();
  const ctx: any = useWeered();

  const activeRoomId = String(ctx?.activeRoomId || "");
  const joinedRoomId = String(ctx?.joinedRoomId || "");
  const joinStatus = String(ctx?.joinStatus || "idle"); // NOTE: active-room scalar
  const msgs = Array.isArray(ctx?.msgs) ? ctx.msgs : [];
  const meta = ctx?.meta || null;
  const admin = ctx?.admin || null;

  const displayRoomName = String(
    meta?.name || meta?.title || meta?.label || admin?.name || ""
  ).trim();

  // Force active room when parent provides it (provider effect will presence:join + chat:history)
  useEffect(() => {
    let forced = String(props.roomId || "").trim();
    if (!forced) return;

    // Normalize: strip "room:" prefix and decode
    if (forced.startsWith("room:")) forced = forced.slice(5);
    try { forced = decodeURIComponent(forced); } catch {}
    forced = String(forced || "").trim();
    if (!forced) return;
    try { ctx?.setActiveRoomId?.(forced); } catch {}
  }, [props.roomId]);

  const roomLabel = useMemo(() => {
    let forced = String(props.roomId || "").trim();
    let active = String(activeRoomId || "").trim();

    if (forced.startsWith("room:")) forced = forced.slice(5);
    if (active.startsWith("room:")) active = active.slice(5);

    // prefer forced if present
    const pick = (forced || active || "").trim();
    return pick;
  }, [props.roomId, activeRoomId]);

  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  const joinedStrict = Boolean(activeRoomId && joinedRoomId && activeRoomId === joinedRoomId && joinStatus === "joined");

  // If we have room meta/admin, we are effectively in the room (your WS is providing this)
  const joinedByMeta = Boolean(meta || admin);

  const canType = joinedStrict || joinedByMeta;
  const msgTrim = String(text || "").trim();
  const canSend = !!canType && msgTrim.length > 0;

  useEffect(() => {
    try { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); } catch {}
  }, [msgs.length, activeRoomId]);

  const onSend = () => {
    if (!canType) return;
    const msg = String(text || "").trim();
    if (!msg) return;
    try { ctx?.sendChat?.(msg); } catch {}
    setText("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, ...props.style }}>
      {!props.embedded && (
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold text-white/90">{props.title || "Lobby Chat"}</div>
        <div className="text-xs text-white/60 truncate">room: {displayRoomName ? `${displayRoomName}  (#${roomLabel})` : roomLabel}</div>
      </div>
    )}

      <div
        ref={listRef}
        style={{
          border: "1px solid var(--weered-border)",
          borderRadius: 14,
          padding: 10,
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          background: "rgba(255,255,255,.02)",
          marginBottom: 10,
        }}
      >
        {msgs.length === 0 ? (
          <div style={{ opacity: 0.7 }}>No messages yet.</div>
        ) : (
          msgs.map((m: any, i: number) => (
            <div key={i} data-chat-message style={{ display: "flex", gap: 10, marginBottom: 8 }}>
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  border: "1px solid var(--weered-border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  opacity: 0.9,
                }}
              >
                {(m?.name || "?").slice(0, 1).toUpperCase()}
              </div>
              <div style={{ minWidth: 0 }}>
                <div data-chat-username style={{ fontWeight: 800, fontSize: 13 }}>{String(m?.user?.name || m?.user?.id || m?.name || m?.username || m?.author || "unknown")}</div>
                <div data-chat-body style={{ opacity: 0.95 }}>{m?.body || m?.text || ""}</div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex gap-2">
        <input value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={canType ? "Message..." : "Join/admit required..."}
          disabled={!canType}
          className={
            "flex-1 rounded-lg border px-3 py-1.5 text-sm outline-none transition-colors " +
            (canType
              ? "border-white/10 bg-black/10 text-white/90 focus:border-white/20"
              : "border-white/10 bg-white/5 text-white/50 cursor-not-allowed")
          }
          onKeyDown={(e) => {
            if (e.key === "Enter" && canSend) onSend();
          }}
        />
        <button
          onClick={onSend}
          disabled={!canSend}
          className={
            "rounded-lg border px-4 py-1.5 text-sm font-semibold transition-colors " +
            (canSend
              ? "border-violet-300/25 bg-violet-500/10 hover:bg-violet-500/15 text-violet-100"
              : "border-white/10 bg-white/5 text-white/60 cursor-not-allowed")
          }
        
          style={ canSend ? {
                  background: "rgba(124,58,237,.18)",
                  borderColor: "rgba(124,58,237,.35)",
                }
              : undefined
          }
        >
          Send
        </button>
      </div>

      {!props.embedded && (
        <div style={{ marginTop: 10 }}>
          <button
            onClick={() => replaceTop("dock")}
            style={{
              borderRadius: 12,
              border: "1px solid var(--weered-border)",
              background: "rgba(255,255,255,.04)",
              color: "inherit",
              fontWeight: 800,
              padding: "8px 10px",
            }}
          >
            Open Dock
          </button>
        </div>
      )}
    </div>
  );
}


















