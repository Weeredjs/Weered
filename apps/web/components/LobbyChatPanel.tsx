"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useOverlay } from "./overlays/OverlayProvider";
import { useWeered } from "./WeeredProvider";

function avatarBg(name: string, isMe?: boolean): string {
  const colors = ["#6366f1","#8b5cf6","#ec4899","#f97316","#eab308","#22c55e","#14b8a6","#3b82f6"];
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const hash = colors[h % colors.length];
  if (!isMe) return hash;
  try { return localStorage.getItem("weered:avatarColor") || hash; } catch { return hash; }
}

export default function LobbyChatPanel(
  props: {
    title?: string;
    style?: React.CSSProperties;
    roomId?: string;
    embedded?: boolean;
    /** When true, suppresses the input bar — parent is handling send */
    hideInput?: boolean;
  } = {}
) {
  const { replaceTop } = useOverlay();
  const ctx: any = useWeered();

  const activeRoomId = String(ctx?.activeRoomId || "");
  const joinedRoomId = String(ctx?.joinedRoomId || "");
  const joinStatus = String(ctx?.joinStatus || "idle");
  const msgs = Array.isArray(ctx?.msgs) ? ctx.msgs : [];
  const meta = ctx?.meta || null;
  const admin = ctx?.admin || null;

  const displayRoomName = String(
    meta?.name || meta?.title || meta?.label || admin?.name || ""
  ).trim();

  useEffect(() => {
    let forced = String(props.roomId || "").trim();
    if (!forced) return;
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
    return (forced || active || "").trim();
  }, [props.roomId, activeRoomId]);

  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  const joinedStrict = Boolean(activeRoomId && joinedRoomId && activeRoomId === joinedRoomId && joinStatus === "joined");
  const joinedByMeta = Boolean(meta || admin);
  const canType = joinedStrict || joinedByMeta;
  const msgTrim = String(text || "").trim();
  const canSend = !!canType && msgTrim.length > 0;

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const id = requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    });
    // Fire notification event so parent can show unread indicator
    try { window.dispatchEvent(new CustomEvent("weered:chat:message")); } catch {}
    return () => cancelAnimationFrame(id);
  }, [msgs.length, activeRoomId]);

  const onSend = () => {
    if (!canType) return;
    const msg = String(text || "").trim();
    if (!msg) return;
    try { ctx?.sendChat?.(msg); } catch {}
    setText("");
  };

  return (
    // Outer wrapper: full flex column filling whatever container gives it height
    <div style={{
      display: "flex",
      flexDirection: "column",
      minHeight: 0,
      overflow: "hidden",
      ...props.style,
    }}>

      {/* Header — only in non-embedded mode */}
      {!props.embedded && (
        <div className="flex items-center justify-between mb-2 flex-shrink-0">
          <div className="text-sm font-semibold text-white/90">{props.title || "Lobby Chat"}</div>
          <div className="text-xs text-white/60 truncate">room: {displayRoomName ? `${displayRoomName}  (#${roomLabel})` : roomLabel}</div>
        </div>
      )}

      {/* Messages list — takes all available space, scrolls internally */}
      <div
        ref={listRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          padding: props.embedded ? "8px 10px" : 10,
          background: props.embedded ? "transparent" : "rgba(255,255,255,.02)",
          border: props.embedded ? "none" : "1px solid var(--weered-border)",
          borderRadius: props.embedded ? 0 : 14,
        }}
      >
        {msgs.length === 0 ? (
          <div style={{ opacity: 0.7, fontSize: 13 }}>No messages yet.</div>
        ) : (
          msgs.map((m: any, i: number) => (
            <div key={i} data-chat-message style={{ display: "flex", gap: 10, marginBottom: 8 }}>
              {(() => {
                const uname = String(m?.user?.name || m?.user?.id || m?.name || m?.username || m?.author || "?");
                const isMine = !!(ctx?.me && (String(ctx.me.name) === uname || String(ctx.me.id) === String(m?.user?.id || m?.userId || "")));
                return (
                  <div style={{
                    width: 28, height: 28, borderRadius: 999, flexShrink: 0,
                    background: avatarBg(uname, isMine),
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 700, color: "#fff",
                  }}>
                    {uname.slice(0, 1).toUpperCase()}
                  </div>
                );
              })()}
              <div style={{ minWidth: 0 }}>
                <div data-chat-username style={{ fontWeight: 800, fontSize: 13 }}>
                  {String(m?.user?.name || m?.user?.id || m?.name || m?.username || m?.author || "unknown")}
                </div>
                <div data-chat-body style={{ opacity: 0.95, fontSize: 13, wordBreak: "break-word" }}>
                  {m?.body || m?.text || ""}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input — pinned to bottom, flex-shrink-0 so it never compresses */}
      {!props.hideInput && (
        <div className="flex gap-2 flex-shrink-0" style={{ padding: "8px 10px 10px" }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={canType ? "Message..." : "Join/admit required..."}
            disabled={!canType}
            className={
              "flex-1 rounded-lg border px-3 py-1.5 text-sm outline-none transition-colors " +
              (canType
                ? "border-white/10 bg-black/10 text-white/90 focus:border-white/20"
                : "border-white/10 bg-white/5 text-white/50 cursor-not-allowed")
            }
            onKeyDown={(e) => { if (e.key === "Enter" && canSend) onSend(); }}
          />
          <button
            onClick={onSend}
            disabled={!canSend}
            className={
              "rounded-lg border px-4 py-1.5 text-sm font-semibold transition-colors flex-shrink-0 " +
              (canSend
                ? "border-violet-300/25 bg-violet-500/10 hover:bg-violet-500/15 text-violet-100"
                : "border-white/10 bg-white/5 text-white/60 cursor-not-allowed")
            }
            style={canSend ? { background: "rgba(124,58,237,.18)", borderColor: "rgba(124,58,237,.35)" } : undefined}
          >
            Send
          </button>
        </div>
      )}

      {/* Open Dock button — non-embedded only */}
      {!props.embedded && (
        <div style={{ marginTop: 10, flexShrink: 0 }}>
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
