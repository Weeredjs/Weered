"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOverlay } from "./overlays/OverlayProvider";
import { useWeered } from "./WeeredProvider";
import { avatarBg } from "../lib/avatarColor";

// ── URL regex — matches http(s) links ──
const URL_RE = /https?:\/\/[^\s<>"')\]]+/gi;
const IMG_EXT = /\.(png|jpe?g|gif|webp)(\?[^\s]*)?$/i;

function ChatBody({ text }: { text: string }) {
  if (!text) return null;
  const parts: React.ReactNode[] = [];
  const imageUrls: string[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  URL_RE.lastIndex = 0;
  let key = 0;
  while ((match = URL_RE.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const url = match[0];
    parts.push(
      <a key={key++} href={url} target="_blank" rel="noopener noreferrer" style={{
        color: "#7c9dff", textDecoration: "underline", textUnderlineOffset: 2,
        wordBreak: "break-all",
      }}>{url}</a>
    );
    if (IMG_EXT.test(url)) imageUrls.push(url);
    last = match.index + url.length;
  }
  if (last < text.length) parts.push(text.slice(last));

  return (
    <>
      <div style={{ opacity: 0.95, wordBreak: "break-word" }}>{parts}</div>
      {imageUrls.map((src, i) => (
        <a key={`img-${i}`} href={src} target="_blank" rel="noopener noreferrer">
          <img
            src={src} alt="" loading="lazy"
            style={{
              maxWidth: 280, maxHeight: 200, borderRadius: 8, marginTop: 4,
              border: "1px solid rgba(255,255,255,.1)", display: "block",
            }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        </a>
      ))}
    </>
  );
}

// ── Emoji picker data (compact) ──
const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  { label: "😀", emojis: ["😀","😂","🤣","😅","😊","😍","🥰","😘","😎","🤩","🥳","😭","😤","🤔","🤫","🤯","🥶","🥵","😈","👻"] },
  { label: "👍", emojis: ["👍","👎","👏","🙌","🤝","✌️","🤞","💪","🫡","🫶","❤️","🔥","💯","⭐","✨","💀","🎉","🎮","🏆","👀"] },
  { label: "🎯", emojis: ["🎯","🚀","💡","⚡","🔫","🗡️","🛡️","💣","🎲","🃏","♟️","🏹","⚔️","🧨","💥","💫","🌟","🔮","🧿","🎪"] },
  { label: "🐸", emojis: ["🐸","🐶","🐱","🦊","🐺","🦁","🐯","🦄","🐉","🦅","🐍","🦈","🐙","🦀","🐝","🦋","🌈","🌊","☀️","🌙"] },
];

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

  // Resolve the effective room ID — prefer the explicit prop over activeRoomId
  const effectiveRoomId = (() => {
    let forced = String(props.roomId || "").trim();
    if (forced.startsWith("room:")) forced = forced.slice(5);
    try { forced = decodeURIComponent(forced); } catch {}
    return forced || activeRoomId;
  })();

  // Read msgs and meta from the effective room, not just activeRoomId
  const msgsByRoom = ctx?.msgsByRoom || {};
  const metaByRoom = ctx?.metaByRoom || {};
  const adminByRoom = ctx?.adminByRoom || {};
  const statusByRoom = ctx?.statusByRoom || {};

  const msgs = Array.isArray(msgsByRoom[effectiveRoomId]) ? msgsByRoom[effectiveRoomId]
    : Array.isArray(ctx?.msgs) ? ctx.msgs : [];
  const meta = metaByRoom[effectiveRoomId] || ctx?.meta || null;
  const admin = adminByRoom[effectiveRoomId] || ctx?.admin || null;
  const effectiveJoinStatus = statusByRoom[effectiveRoomId] || joinStatus;

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

  const roomLabel = effectiveRoomId;

  const [text, setText] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiCat, setEmojiCat] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const emojiRef = useRef<HTMLDivElement | null>(null);

  // Close emoji picker on outside click
  useEffect(() => {
    if (!emojiOpen) return;
    const handler = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) setEmojiOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [emojiOpen]);

  const insertEmoji = useCallback((emoji: string) => {
    setText(prev => prev + emoji);
    inputRef.current?.focus();
  }, []);

  const joinedStrict = Boolean(effectiveRoomId && joinedRoomId && effectiveRoomId === joinedRoomId && effectiveJoinStatus === "joined");
  // For lobbies (not embedded): locked = chat locked (staff lobby lock controls).
  // For rooms (embedded): locked = entry lock, NOT chat lock. Use chatDisabled instead.
  const chatBlocked = props.embedded
    ? Boolean(meta?.chatDisabled)          // rooms: only chatDisabled kills chat
    : Boolean(meta?.locked);               // lobbies: locked = chat locked
  const joinedByMeta = Boolean((meta || admin) && !chatBlocked && !admin?.locked);
  const canType = (joinedStrict || joinedByMeta) && !chatBlocked;
  const msgTrim = String(text || "").trim();
  const canSend = !!canType && msgTrim.length > 0;

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    // rAF ensures DOM has painted the new message before we scroll
    const id = requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    });
    return () => cancelAnimationFrame(id);
  }, [msgs.length, effectiveRoomId]);

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
          border: props.embedded ? "none" : "1px solid var(--weered-border)",
          borderRadius: props.embedded ? 0 : 14,
          padding: props.embedded ? "0 10px" : 10,
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          background: props.embedded ? "transparent" : "rgba(255,255,255,.02)",
          marginBottom: props.hideInput ? 0 : 10,
        }}
      >
        {msgs.length === 0 ? (
          <div style={{ opacity: 0.7 }}>No messages yet.</div>
        ) : (
          msgs.map((m: any, i: number) => (
            <div key={i} data-chat-message style={{ display: "flex", gap: 10, marginBottom: 8 }}>
              {(() => {
                const uname = String(m?.user?.name || m?.user?.id || m?.name || m?.username || m?.author || "?");
                const isMine = !!(ctx?.me && (String(ctx.me.name) === uname || String(ctx.me.id) === String(m?.user?.id || m?.userId || "")));
                const msgAvatar = m?.user?.avatar || null;
                return (
                  <div style={{
                    width: 28, height: 28, borderRadius: 999, flexShrink: 0,
                    background: msgAvatar ? "rgba(255,255,255,.08)" : avatarBg(uname, isMine, m?.user?.avatarColor),
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 700, color: "#fff",
                    overflow: "hidden",
                  }}>
                    {msgAvatar ? (
                      <img src={msgAvatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      uname.slice(0, 1).toUpperCase()
                    )}
                  </div>
                );
              })()}
              <div style={{ minWidth: 0 }}>
                <div data-chat-username style={{ fontWeight: 800, fontSize: 13 }}>
                  {String(m?.user?.name || m?.user?.id || m?.name || m?.username || m?.author || "unknown")}
                </div>
                <ChatBody text={m?.body || m?.text || ""} />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input — hidden when parent handles it */}
      {!props.hideInput && (
        <div style={{ position: "relative" }}>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={canType ? "Message..." : chatBlocked ? "Chat is locked." : "Join/admit required..."}
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
              onClick={() => setEmojiOpen(v => !v)}
              disabled={!canType}
              title="Emoji"
              style={{
                borderRadius: 8, border: "1px solid rgba(255,255,255,.1)", background: emojiOpen ? "rgba(124,58,237,.18)" : "rgba(255,255,255,.04)",
                padding: "0 10px", fontSize: 16, cursor: canType ? "pointer" : "not-allowed",
                color: canType ? "#fff" : "rgba(255,255,255,.4)", transition: "background .15s",
              }}
            >
              😀
            </button>
            <button
              onClick={onSend}
              disabled={!canSend}
              className={
                "rounded-lg border px-4 py-1.5 text-sm font-semibold transition-colors " +
                (canSend
                  ? "border-violet-300/25 bg-violet-500/10 hover:bg-violet-500/15 text-violet-100"
                  : "border-white/10 bg-white/5 text-white/60 cursor-not-allowed")
              }
              style={canSend ? { background: "rgba(124,58,237,.18)", borderColor: "rgba(124,58,237,.35)" } : undefined}
            >
              Send
            </button>
          </div>

          {/* Emoji picker */}
          {emojiOpen && (
            <div ref={emojiRef} style={{
              position: "absolute", bottom: "calc(100% + 6px)", right: 0,
              width: 280, background: "#1a1a2e", border: "1px solid rgba(255,255,255,.12)",
              borderRadius: 12, padding: 8, zIndex: 50,
              boxShadow: "0 8px 32px rgba(0,0,0,.5)",
            }}>
              {/* Category tabs */}
              <div style={{ display: "flex", gap: 2, marginBottom: 6, borderBottom: "1px solid rgba(255,255,255,.08)", paddingBottom: 6 }}>
                {EMOJI_CATEGORIES.map((cat, ci) => (
                  <button key={ci} onClick={() => setEmojiCat(ci)} style={{
                    flex: 1, background: ci === emojiCat ? "rgba(124,58,237,.2)" : "transparent",
                    border: "none", borderRadius: 6, padding: "4px 0", fontSize: 14, cursor: "pointer",
                  }}>
                    {cat.label}
                  </button>
                ))}
              </div>
              {/* Emoji grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 2, maxHeight: 160, overflow: "auto" }}>
                {EMOJI_CATEGORIES[emojiCat].emojis.map((em, ei) => (
                  <button key={ei} onClick={() => insertEmoji(em)} style={{
                    background: "transparent", border: "none", fontSize: 18, padding: 4,
                    borderRadius: 6, cursor: "pointer", lineHeight: 1,
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,.1)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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
