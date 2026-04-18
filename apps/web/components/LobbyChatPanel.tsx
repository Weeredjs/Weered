"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOverlay } from "./overlays/OverlayProvider";
import { useWeered } from "./WeeredProvider";
import { avatarBg } from "../lib/avatarColor";
import { useUserHover } from "./UserHoverCard";
import EmptyState from "./EmptyState";
import { weeredConfirm } from "../lib/confirm";
import { weeredReport } from "../lib/report";
import { weeredToast } from "../lib/toast";

// ── URL regex — matches http(s) links ──
const URL_RE = /https?:\/\/[^\s<>"')\]]+/gi;
const IMG_EXT = /\.(png|jpe?g|gif|webp)(\?[^\s]*)?$/i;
const TENOR_RE = /https?:\/\/media\.tenor\.com\/[^\s]+/i;
const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

function LinkPreviewCard({ url }: { url: string }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/unfurl?url=${encodeURIComponent(url)}`)
      .then(r => r.json())
      .then(j => { if (!cancelled && j.ok && (j.title || j.description)) setData(j); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [url]);

  if (!data) return null;

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "block", marginTop: 6 }}>
      <div style={{
        borderRadius: 8, border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.03)",
        overflow: "hidden", maxWidth: 320, transition: "border-color .15s",
      }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(124,58,237,.3)")}
        onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,.08)")}
      >
        {data.image && (
          <img src={data.image} alt={data.title || "Link preview"} style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }}
            onError={e => (e.currentTarget.style.display = "none")} />
        )}
        <div style={{ padding: "8px 10px" }}>
          {data.siteName && <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px", color: "rgba(124,58,237,.6)", marginBottom: 3 }}>{data.siteName}</div>}
          {data.title && <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(243,244,246,.9)", lineHeight: 1.3, marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } as any}>{data.title}</div>}
          {data.description && <div style={{ fontSize: 11, color: "rgba(148,163,184,.6)", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } as any}>{data.description}</div>}
        </div>
      </div>
    </a>
  );
}

const MENTION_BODY_RE = /@([a-zA-Z0-9][a-zA-Z0-9_-]{1,31})/g;

function ChatBody({ text, onMentionClick }: { text: string; onMentionClick?: (handle: string) => void }) {
  if (!text) return null;
  const imageUrls: string[] = [];
  const linkUrls: string[] = [];

  // Collect URL + mention matches, then render left-to-right
  type Tok = { kind: "url" | "mention"; start: number; end: number; value: string };
  const toks: Tok[] = [];
  URL_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = URL_RE.exec(text)) !== null) {
    toks.push({ kind: "url", start: m.index, end: m.index + m[0].length, value: m[0] });
  }
  MENTION_BODY_RE.lastIndex = 0;
  while ((m = MENTION_BODY_RE.exec(text)) !== null) {
    // Avoid matching an @ that's inside a URL we already captured
    const inUrl = toks.some(t => t.kind === "url" && m!.index >= t.start && m!.index < t.end);
    if (inUrl) continue;
    toks.push({ kind: "mention", start: m.index, end: m.index + m[0].length, value: m[1] });
  }
  toks.sort((a, b) => a.start - b.start);

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  for (const t of toks) {
    if (t.start > cursor) parts.push(text.slice(cursor, t.start));
    if (t.kind === "url") {
      const url = t.value;
      parts.push(
        <a key={key++} href={url} target="_blank" rel="noopener noreferrer" style={{
          color: "#7c9dff", textDecoration: "underline", textUnderlineOffset: 2,
          wordBreak: "break-all",
        }}>{url}</a>
      );
      if (IMG_EXT.test(url) || TENOR_RE.test(url)) imageUrls.push(url);
      else linkUrls.push(url);
    } else {
      const handle = t.value;
      parts.push(
        <span
          key={key++}
          onClick={(e) => {
            e.stopPropagation();
            if (onMentionClick) onMentionClick(handle);
          }}
          style={{
            display: "inline-block",
            padding: "0 4px",
            borderRadius: 4,
            background: "var(--weered-accent-bg, rgba(124,58,237,0.18))",
            color: "var(--weered-accent-text, rgba(196,181,253,0.95))",
            fontWeight: 700,
            cursor: onMentionClick ? "pointer" : "default",
          }}
        >@{handle}</span>
      );
    }
    cursor = t.end;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));

  return (
    <>
      <div style={{ opacity: 0.95, wordBreak: "break-word" }}>{parts}</div>
      {imageUrls.map((src, i) => (
        <a key={`img-${i}`} href={src} target="_blank" rel="noopener noreferrer">
          <img
            src={src} alt="Chat image" loading="lazy"
            style={{
              maxWidth: 280, maxHeight: 200, borderRadius: 8, marginTop: 4,
              border: "1px solid rgba(255,255,255,.1)", display: "block",
            }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        </a>
      ))}
      {linkUrls.slice(0, 1).map((url, i) => (
        <LinkPreviewCard key={`lp-${i}`} url={url} />
      ))}
    </>
  );
}

// ── GIF Picker (Tenor) ──
const TENOR_API_KEY = "AIza_REDACTED_TENOR_KEY"; // Tenor public/free key
const TENOR_URL = "https://tenor.googleapis.com/v2";

function GifPicker({ onSelect, onClose }: { onSelect: (url: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // Load trending on mount
  useEffect(() => {
    setLoading(true);
    fetch(`${TENOR_URL}/featured?key=${TENOR_API_KEY}&limit=20&media_filter=tinygif,gif`)
      .then(r => r.json())
      .then(j => { setResults(j.results || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  function search() {
    if (!query.trim()) return;
    setLoading(true);
    fetch(`${TENOR_URL}/search?key=${TENOR_API_KEY}&q=${encodeURIComponent(query)}&limit=20&media_filter=tinygif,gif`)
      .then(r => r.json())
      .then(j => { setResults(j.results || []); setLoading(false); })
      .catch(() => setLoading(false));
  }

  return (
    <div ref={ref} style={{
      position: "absolute", bottom: "calc(100% + 6px)", right: 0,
      width: 320, maxHeight: 360, background: "#1a1a2e", border: "1px solid rgba(255,255,255,.12)",
      borderRadius: 12, padding: 8, zIndex: 50, boxShadow: "0 8px 32px rgba(0,0,0,.5)",
      display: "flex", flexDirection: "column",
    }}>
      <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
        <input
          value={query} onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && search()}
          placeholder="Search GIFs..."
          style={{
            flex: 1, padding: "5px 8px", borderRadius: 6, border: "1px solid rgba(255,255,255,.1)",
            background: "rgba(0,0,0,.3)", color: "rgba(243,244,246,.9)", fontSize: 12, outline: "none",
          }}
        />
        <button onClick={search} style={{
          padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(124,58,237,.3)",
          background: "rgba(124,58,237,.12)", color: "rgba(216,180,254,.9)", fontSize: 11, cursor: "pointer",
        }}>Go</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
        {loading && <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 16, opacity: 0.4, fontSize: 12 }}>Loading...</div>}
        {results.map((r: any) => {
          const tiny = r.media_formats?.tinygif?.url || r.media_formats?.gif?.url || "";
          const full = r.media_formats?.gif?.url || tiny;
          if (!tiny) return null;
          return (
            <img key={r.id} src={tiny} alt="GIF" loading="lazy"
              onClick={() => { onSelect(full); onClose(); }}
              style={{ width: "100%", height: 80, objectFit: "cover", borderRadius: 6, cursor: "pointer", border: "1px solid rgba(255,255,255,.06)" }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(124,58,237,.4)")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,.06)")}
            />
          );
        })}
      </div>
      <div style={{ fontSize: 9, textAlign: "right", opacity: 0.2, marginTop: 4 }}>Powered by Tenor</div>
    </div>
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

  const { openHover, scheduleClose: hoverClose, card: hoverCard } = useUserHover({
    onViewProfile: (id) => replaceTop("profile", { userId: id }),
    onMessage: (id, name) => {
      try { window.dispatchEvent(new CustomEvent("weered:dock:open", { detail: { mode: "dm", peer: { id, name } } })); } catch {}
    },
  });

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
  const [gifOpen, setGifOpen] = useState(false);
  const [editingMsgId, setEditingMsgId] = useState<string>("");
  const [editDraft, setEditDraft] = useState<string>("");
  const [hoveredMsgId, setHoveredMsgId] = useState<string>("");
  const [pickerMsgId, setPickerMsgId] = useState<string>("");

  const QUICK_REACTIONS = ["👍","❤️","😂","🔥","🎉","😢","😮","🙌"];

  function toggleReaction(msgId: string, emoji: string) {
    try { (ctx as any)?.sendRaw?.({ type: "reaction:toggle", roomId: effectiveRoomId, msgId, emoji }); } catch {}
    setPickerMsgId("");
  }

  // Close picker on outside click
  useEffect(() => {
    if (!pickerMsgId) return;
    function onClick(e: MouseEvent) {
      const t = e.target as HTMLElement | null;
      if (t && t.closest?.("[data-reaction-ui]")) return;
      setPickerMsgId("");
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [pickerMsgId]);
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
    <>
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
          <EmptyState title="Crickets." hint="Be the one who drops the first line." />
        ) : (
          msgs.map((m: any, i: number) => {
            const uname = String(m?.user?.name || m?.user?.id || m?.name || m?.username || m?.author || "?");
            const mId = String(m?.id || "");
            const meId = String(ctx?.me?.id || "");
            const meName = String(ctx?.me?.name || "");
            const msgUserId = String(m?.user?.id || m?.userId || "");
            const isMine = !!(meId && msgUserId === meId) || !!(meName && uname === meName);
            const ts = Number(m?.ts || 0);
            const editedAt = m?.editedAt ? Number(m.editedAt) : 0;
            const deletedAt = m?.deletedAt ? Number(m.deletedAt) : 0;
            const editable = isMine && !deletedAt && ts > 0 && (Date.now() - ts) < 15 * 60 * 1000;
            const deletable = isMine && !deletedAt;
            const isEditing = editingMsgId === mId && mId !== "";
            const msgAvatar = m?.user?.avatar || null;
            const isHovered = hoveredMsgId === mId;

            function commitEdit() {
              const next = editDraft.trim();
              if (!next || !mId) { setEditingMsgId(""); return; }
              if (next !== String(m?.body || "")) {
                try { (ctx as any)?.sendRaw?.({ type: "chat:edit", roomId: effectiveRoomId, msgId: mId, body: next }); } catch {}
              }
              setEditingMsgId("");
              setEditDraft("");
            }

            async function handleDelete() {
              const ok = await weeredConfirm({ title: "Delete this message?", body: "It'll be wiped for everyone in this room.", confirmLabel: "Delete", destructive: true });
              if (!ok) return;
              try { (ctx as any)?.sendRaw?.({ type: "chat:delete", roomId: effectiveRoomId, msgId: mId }); } catch {}
            }

            return (
              <div
                key={mId || i}
                data-chat-message
                onMouseEnter={() => mId && setHoveredMsgId(mId)}
                onMouseLeave={() => setHoveredMsgId(cur => cur === mId ? "" : cur)}
                style={{ display: "flex", gap: 10, marginBottom: 8, position: "relative" }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: 999, flexShrink: 0,
                  background: msgAvatar ? "rgba(255,255,255,.08)" : avatarBg(uname, isMine, m?.user?.avatarColor),
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700, color: "#fff",
                  overflow: "hidden",
                  opacity: deletedAt ? 0.4 : 1,
                }}>
                  {msgAvatar ? (
                    <img src={msgAvatar} alt={uname + " avatar"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    uname.slice(0, 1).toUpperCase()
                  )}
                </div>
                <div style={{ minWidth: 0, flex: 1, opacity: deletedAt ? 0.55 : 1 }}>
                  <div
                    data-chat-username
                    style={{ fontWeight: 800, fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "baseline", gap: 6 }}
                    onMouseEnter={e => {
                      const uid = msgUserId;
                      if (uid) openHover(uid, uname, e.currentTarget as HTMLElement);
                    }}
                    onMouseLeave={() => hoverClose(160)}
                  >
                    <span>{uname}</span>
                    {editedAt > 0 && !deletedAt && (
                      <span title={new Date(editedAt).toLocaleString()} style={{ fontSize: 10, fontWeight: 500, color: "var(--weered-muted, rgba(148,163,184,.55))" }}>(edited)</span>
                    )}
                  </div>
                  {deletedAt ? (
                    <div style={{ fontSize: 12, fontStyle: "italic", color: "var(--weered-muted, rgba(148,163,184,.55))" }}>[message deleted]</div>
                  ) : isEditing ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 2 }}>
                      <textarea
                        autoFocus
                        value={editDraft}
                        onChange={e => setEditDraft(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitEdit(); }
                          if (e.key === "Escape") { e.preventDefault(); setEditingMsgId(""); setEditDraft(""); }
                        }}
                        style={{
                          width: "100%",
                          minHeight: 60,
                          resize: "vertical",
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "1px solid var(--weered-border2, rgba(255,255,255,.18))",
                          background: "var(--weered-panel2, rgba(0,0,0,.25))",
                          color: "var(--weered-text, rgba(243,244,246,.95))",
                          fontFamily: "inherit",
                          fontSize: 13,
                          outline: "none",
                        }}
                      />
                      <div style={{ display: "flex", gap: 6, fontSize: 10, color: "var(--weered-muted, rgba(148,163,184,.55))" }}>
                        <span>Enter to save</span>
                        <span>·</span>
                        <span>Esc to cancel</span>
                        <span style={{ flex: 1 }} />
                        <button type="button" onClick={() => { setEditingMsgId(""); setEditDraft(""); }} style={{ padding: "3px 8px", fontSize: 10, fontWeight: 700, background: "transparent", border: "1px solid var(--weered-border, rgba(255,255,255,.1))", borderRadius: 6, color: "var(--weered-muted, rgba(148,163,184,.75))", cursor: "pointer" }}>Cancel</button>
                        <button type="button" onClick={commitEdit} style={{ padding: "3px 10px", fontSize: 10, fontWeight: 800, background: "var(--weered-accent-bg, rgba(124,58,237,.18))", border: "1px solid var(--weered-accent-ring, rgba(124,58,237,.45))", borderRadius: 6, color: "var(--weered-accent-text, #c4b5fd)", cursor: "pointer" }}>Save</button>
                      </div>
                    </div>
                  ) : (
                    <ChatBody
                      text={m?.body || m?.text || ""}
                      onMentionClick={(h) => replaceTop("profile", { userId: h })}
                    />
                  )}
                  {/* Reaction chips */}
                  {Array.isArray((m as any).reactions) && (m as any).reactions.length > 0 && !deletedAt && (
                    <div data-reaction-ui style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                      {(m as any).reactions.map((r: any) => {
                        const mine = Array.isArray(r.users) && String(ctx?.me?.id || "") && r.users.includes(String(ctx?.me?.id || ""));
                        return (
                          <button
                            key={r.emoji}
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggleReaction(mId, r.emoji); }}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 4,
                              padding: "2px 7px", borderRadius: 10,
                              border: `1px solid ${mine ? "var(--weered-accent-ring, rgba(124,58,237,.55))" : "var(--weered-border, rgba(255,255,255,.1))"}`,
                              background: mine ? "var(--weered-accent-bg, rgba(124,58,237,.18))" : "rgba(255,255,255,.04)",
                              color: mine ? "var(--weered-accent-text, rgba(196,181,253,.95))" : "var(--weered-muted, rgba(148,163,184,.85))",
                              fontSize: 11, fontWeight: 700, cursor: "pointer",
                              fontFamily: "inherit", transition: "all .12s",
                              lineHeight: 1.1,
                            }}
                          >
                            <span style={{ fontSize: 13 }}>{r.emoji}</span>
                            <span style={{ fontVariantNumeric: "tabular-nums" }}>{r.count}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                {mId && isHovered && !isEditing && !deletedAt && (
                  <div data-reaction-ui style={{
                    position: "absolute",
                    top: -8,
                    right: 4,
                    display: "flex",
                    gap: 2,
                    padding: 3,
                    borderRadius: 7,
                    background: "var(--weered-panel2, rgba(16,16,20,.96))",
                    border: "1px solid var(--weered-border, rgba(255,255,255,.1))",
                    boxShadow: "0 4px 12px rgba(0,0,0,.35)",
                    zIndex: 2,
                  }}>
                    <button
                      type="button"
                      title="React"
                      onClick={(e) => { e.stopPropagation(); setPickerMsgId(cur => cur === mId ? "" : mId); }}
                      style={{ width: 24, height: 24, borderRadius: 5, border: "none", background: "transparent", color: "var(--weered-muted, rgba(148,163,184,.75))", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", transition: "background .1s" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.08)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    >😊</button>
                    {editable && (
                      <button
                        type="button"
                        title="Edit message"
                        onClick={() => { setEditingMsgId(mId); setEditDraft(String(m?.body || "")); }}
                        style={{ width: 24, height: 24, borderRadius: 5, border: "none", background: "transparent", color: "var(--weered-muted, rgba(148,163,184,.75))", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", transition: "background .1s, color .1s" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.08)"; (e.currentTarget as HTMLElement).style.color = "var(--weered-text, rgba(243,244,246,.95))"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--weered-muted, rgba(148,163,184,.75))"; }}
                      >✎</button>
                    )}
                    {deletable && (
                      <button
                        type="button"
                        title="Delete message"
                        onClick={handleDelete}
                        style={{ width: 24, height: 24, borderRadius: 5, border: "none", background: "transparent", color: "var(--weered-muted, rgba(148,163,184,.75))", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", transition: "background .1s, color .1s" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,.18)"; (e.currentTarget as HTMLElement).style.color = "rgba(252,165,165,.95)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--weered-muted, rgba(148,163,184,.75))"; }}
                      >🗑</button>
                    )}
                    {!isMine && mId && (
                      <button
                        type="button"
                        title="Report message"
                        onClick={async () => {
                          const res = await weeredReport({ targetType: "MESSAGE", targetId: mId, context: effectiveRoomId });
                          if (res?.ok) weeredToast.success("Report submitted. Staff will review.");
                          else if (res && !res.ok) weeredToast.error(res.error === "report_rate_limit" ? "You're reporting too fast. Try again in a few minutes." : "Report failed.");
                        }}
                        style={{ width: 24, height: 24, borderRadius: 5, border: "none", background: "transparent", color: "var(--weered-muted, rgba(148,163,184,.75))", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", transition: "background .1s, color .1s" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(245,158,11,.18)"; (e.currentTarget as HTMLElement).style.color = "rgba(251,191,36,.95)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--weered-muted, rgba(148,163,184,.75))"; }}
                      >🚩</button>
                    )}
                  </div>
                )}
                {pickerMsgId === mId && (
                  <div
                    data-reaction-ui
                    onClick={e => e.stopPropagation()}
                    style={{
                      position: "absolute",
                      top: 18, right: 4,
                      display: "flex", gap: 2, padding: 5,
                      borderRadius: 8,
                      background: "var(--weered-panel2, rgba(16,16,20,.98))",
                      border: "1px solid var(--weered-border, rgba(255,255,255,.1))",
                      boxShadow: "0 6px 20px rgba(0,0,0,.5)",
                      zIndex: 3,
                    }}
                  >
                    {QUICK_REACTIONS.map(e => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => toggleReaction(mId, e)}
                        style={{ width: 28, height: 28, borderRadius: 5, border: "none", background: "transparent", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", transition: "background .1s, transform .1s" }}
                        onMouseEnter={ev => { (ev.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.08)"; (ev.currentTarget as HTMLElement).style.transform = "scale(1.15)"; }}
                        onMouseLeave={ev => { (ev.currentTarget as HTMLElement).style.background = "transparent"; (ev.currentTarget as HTMLElement).style.transform = "none"; }}
                      >{e}</button>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Input — hidden when parent handles it */}
      {!props.hideInput && (
        <div style={{ position: "relative", padding: "8px 10px 12px", flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={canType ? "Message..." : chatBlocked ? "Chat is locked." : "Join/admit required..."}
              disabled={!canType}
              style={{
                flex: 1, minWidth: 0, padding: "8px 12px", borderRadius: 10,
                border: "1px solid rgba(255,255,255,.10)", background: "rgba(0,0,0,.15)",
                color: canType ? "rgba(243,244,246,.9)" : "rgba(255,255,255,.5)",
                fontSize: 13, outline: "none", fontFamily: "inherit",
                cursor: canType ? "text" : "not-allowed",
                boxSizing: "border-box" as any,
              }}
              onKeyDown={(e) => { if (e.key === "Enter" && canSend) onSend(); }}
            />
            <button
              onClick={() => { setGifOpen(v => !v); setEmojiOpen(false); }}
              disabled={!canType}
              title="GIF"
              style={{
                borderRadius: 8, border: "1px solid rgba(255,255,255,.1)", background: gifOpen ? "rgba(124,58,237,.18)" : "rgba(255,255,255,.04)",
                padding: "6px 10px", fontSize: 11, fontWeight: 700, cursor: canType ? "pointer" : "not-allowed",
                color: canType ? "rgba(216,180,254,.8)" : "rgba(255,255,255,.4)", transition: "background .15s",
                letterSpacing: ".5px", flexShrink: 0,
              }}
            >
              GIF
            </button>
            <button
              onClick={() => { setEmojiOpen(v => !v); setGifOpen(false); }}
              disabled={!canType}
              title="Emoji"
              style={{
                borderRadius: 8, border: "1px solid rgba(255,255,255,.1)", background: emojiOpen ? "rgba(124,58,237,.18)" : "rgba(255,255,255,.04)",
                padding: "6px 10px", fontSize: 16, cursor: canType ? "pointer" : "not-allowed",
                color: canType ? "#fff" : "rgba(255,255,255,.4)", transition: "background .15s",
                flexShrink: 0,
              }}
            >
              😀
            </button>
            <button
              onClick={onSend}
              disabled={!canSend}
              style={{
                borderRadius: 10, border: canSend ? "1px solid rgba(124,58,237,.35)" : "1px solid rgba(255,255,255,.10)",
                background: canSend ? "rgba(124,58,237,.18)" : "rgba(255,255,255,.04)",
                color: canSend ? "rgba(216,180,254,.95)" : "rgba(255,255,255,.4)",
                padding: "6px 14px", fontSize: 13, fontWeight: 700, fontFamily: "inherit",
                cursor: canSend ? "pointer" : "not-allowed", transition: "all .15s",
                flexShrink: 0,
              }}
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

          {/* GIF picker */}
          {gifOpen && (
            <GifPicker
              onSelect={(url) => { ctx?.sendChat?.(effectiveRoomId, url); }}
              onClose={() => setGifOpen(false)}
            />
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
    {hoverCard}
    </>
  );
}
