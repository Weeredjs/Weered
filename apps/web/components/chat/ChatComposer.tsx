"use client";

import React from "react";
import { avatarBg } from "../../lib/avatarColor";
import RoleIcon, { TierIcon } from "../RoleIcon";
import { GifPicker } from "./GifPicker";
import { Icons } from "./Icons";
import { EMOJI_CATEGORIES } from "./emoji";
import { API, ChatAtt, detectMentionAtCaret, nameStyleFor } from "./chatShared";

type ChatComposerProps = {
  ctx: any;
  effectiveRoomId: string;
  pendingAtt: ChatAtt | null;
  setPendingAtt: React.Dispatch<React.SetStateAction<ChatAtt | null>>;
  lockOpen: boolean;
  setLockOpen: React.Dispatch<React.SetStateAction<boolean>>;
  mediaElig: any;
  mentionState: { query: string; start: number; index: number } | null;
  setMentionState: React.Dispatch<
    React.SetStateAction<{ query: string; start: number; index: number } | null>
  >;
  mentionCandidates: any[];
  acceptMention: (username: string) => void;
  replyingTo: { id: string; userName: string; body: string } | null;
  setReplyingTo: React.Dispatch<
    React.SetStateAction<{ id: string; userName: string; body: string } | null>
  >;
  inputRef: React.RefObject<HTMLInputElement | null>;
  fileRef: React.RefObject<HTMLInputElement | null>;
  emojiRef: React.RefObject<HTMLDivElement | null>;
  text: string;
  setText: React.Dispatch<React.SetStateAction<string>>;
  broadcastTyping: () => void;
  handleFile: (file: File) => void | Promise<void>;
  canType: boolean;
  chatBlocked: boolean;
  onAttachClick: () => void | Promise<void>;
  attBusy: boolean;
  gifOpen: boolean;
  setGifOpen: React.Dispatch<React.SetStateAction<boolean>>;
  emojiOpen: boolean;
  setEmojiOpen: React.Dispatch<React.SetStateAction<boolean>>;
  emojiCat: number;
  setEmojiCat: React.Dispatch<React.SetStateAction<number>>;
  insertEmoji: (emoji: string) => void;
  onSend: () => void;
  canSend: boolean;
  canSendNow: boolean;
};

export function ChatComposer({
  ctx,
  effectiveRoomId,
  pendingAtt,
  setPendingAtt,
  lockOpen,
  setLockOpen,
  mediaElig,
  mentionState,
  setMentionState,
  mentionCandidates,
  acceptMention,
  replyingTo,
  setReplyingTo,
  inputRef,
  fileRef,
  emojiRef,
  text,
  setText,
  broadcastTyping,
  handleFile,
  canType,
  chatBlocked,
  onAttachClick,
  attBusy,
  gifOpen,
  setGifOpen,
  emojiOpen,
  setEmojiOpen,
  emojiCat,
  setEmojiCat,
  insertEmoji,
  onSend,
  canSend,
  canSendNow,
}: ChatComposerProps) {
  return (
    <div style={{ position: "relative", padding: "8px 10px 12px", flexShrink: 0 }}>
      {pendingAtt && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 8,
            padding: 6,
            borderRadius: 10,
            background: "rgba(255,255,255,.04)",
            border: "1px solid rgba(124,58,237,.25)",
            width: "fit-content",
          }}
        >
          <img
            src={`${API}${pendingAtt.thumbUrl}`}
            alt="pending attachment"
            style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 7 }}
          />
          <span style={{ fontSize: 11, color: "rgba(200,205,215,.75)" }}>Image ready</span>
          <button
            onClick={() => setPendingAtt(null)}
            title="Remove"
            style={{
              border: "none",
              background: "transparent",
              color: "rgba(148,163,184,.7)",
              cursor: "pointer",
              fontSize: 13,
              padding: "2px 6px",
            }}
          >
            {"✕"}
          </button>
        </div>
      )}
      {lockOpen && (
        <div
          onClick={() => setLockOpen(false)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 8,
            padding: "8px 12px",
            borderRadius: 10,
            background: "rgba(124,58,237,.08)",
            border: "1px solid rgba(124,58,237,.3)",
            cursor: "pointer",
            width: "fit-content",
          }}
        >
          <span style={{ fontSize: 13 }}>{"🔒"}</span>
          <span style={{ fontSize: 11.5, color: "rgba(216,180,254,.9)" }}>
            {mediaElig?.banned
              ? "Media privileges are suspended."
              : `Media privileges unlock at ${Number(mediaElig?.required ?? 100).toLocaleString()} rep. You’re ${Math.max(0, Number(mediaElig?.required ?? 100) - Number(mediaElig?.notoriety ?? 0)).toLocaleString()} away.`}
          </span>
        </div>
      )}
      {mentionState && mentionCandidates.length > 0 && (
        <div
          style={{
            position: "absolute",
            left: 10,
            right: 10,
            bottom: "calc(100% - 4px)",
            background: "var(--weered-panel2, rgba(18,18,26,.98))",
            border: "1px solid var(--weered-border, rgba(124,58,237,.35))",
            borderRadius: 10,
            boxShadow: "0 10px 32px rgba(0,0,0,.55)",
            padding: 4,
            maxHeight: 240,
            overflowY: "auto",
            zIndex: 40,
          }}
        >
          <div
            style={{
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: "2px",
              textTransform: "uppercase",
              color: "var(--weered-muted, rgba(148,163,184,.65))",
              padding: "4px 8px 6px",
            }}
          >
            Mention ·{" "}
            {mentionCandidates.length === 1 ? "1 match" : `${mentionCandidates.length} matches`}
          </div>
          {mentionCandidates.map((u: any, i: number) => {
            const role = u?.globalRole;
            const tier = u?.tier;
            const nstyle = nameStyleFor(role, tier);
            const active = i === mentionState.index;
            return (
              <button
                key={u.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  acceptMention(u.usernameKey || u.name);
                }}
                onMouseEnter={() => setMentionState((s) => (s ? { ...s, index: i } : null))}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  padding: "7px 10px",
                  borderRadius: 6,
                  border: "none",
                  background: active ? "rgba(124,58,237,.18)" : "transparent",
                  color: "inherit",
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "inherit",
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: u.avatar
                      ? "rgba(255,255,255,.08)"
                      : avatarBg(u.name, false, u.avatarColor),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 800,
                    color: "#fff",
                    overflow: "hidden",
                  }}
                >
                  {u.avatar ? (
                    <img
                      src={u.avatar}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    String(u.name || "?")
                      .slice(0, 1)
                      .toUpperCase()
                  )}
                </div>
                <span
                  style={{
                    ...nstyle,
                    fontSize: 13,
                    fontWeight: 700,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {u.name}
                </span>
                {role && String(role).toUpperCase() !== "USER" && (
                  <RoleIcon role={String(role).toUpperCase()} size={12} style={{ flexShrink: 0 }} />
                )}
                {tier && String(tier).toUpperCase() !== "INNOCENT" && (
                  <TierIcon tier={String(tier).toUpperCase()} size={12} style={{ flexShrink: 0 }} />
                )}
              </button>
            );
          })}
          <div
            style={{
              fontSize: 9,
              color: "var(--weered-muted, rgba(148,163,184,.45))",
              padding: "6px 10px 2px",
              fontStyle: "italic",
            }}
          >
            ↑↓ to browse · Tab / Enter to select · Esc to close
          </div>
        </div>
      )}
      {replyingTo && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 10px",
            marginBottom: 6,
            borderRadius: 8,
            borderLeft: "2px solid var(--weered-accent-ring, rgba(124,58,237,0.55))",
            background: "var(--weered-accent-bg, rgba(124,58,237,0.08))",
            fontSize: 11,
          }}
        >
          <span
            style={{
              color: "var(--weered-accent-text, rgba(196,181,253,0.9))",
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            ↩ Replying to <strong>{replyingTo.userName}</strong>
          </span>
          <span
            style={{
              flex: 1,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              color: "var(--weered-muted, rgba(148,163,184,.75))",
            }}
          >
            {replyingTo.body}
          </span>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            title="Cancel reply"
            style={{
              width: 18,
              height: 18,
              borderRadius: 4,
              border: "none",
              background: "transparent",
              color: "var(--weered-muted, rgba(148,163,184,.75))",
              cursor: "pointer",
              fontSize: 12,
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>
      )}
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => {
            const v = e.target.value;
            setText(v);
            if (v.length > 0) broadcastTyping();
            const caret = e.target.selectionStart ?? v.length;
            const m = detectMentionAtCaret(v, caret);
            setMentionState(m ? { ...m, index: 0 } : null);
          }}
          onSelect={(e) => {
            const el = e.currentTarget;
            const m = detectMentionAtCaret(el.value, el.selectionStart ?? el.value.length);
            setMentionState((prev) => {
              if (!m) return null;
              if (prev && prev.query === m.query && prev.start === m.start) return prev;
              return { ...m, index: 0 };
            });
          }}
          placeholder={
            canType
              ? "Message... (/ for commands · @ to mention)"
              : chatBlocked
                ? "Chat is locked."
                : "Join/admit required..."
          }
          onPaste={(e) => {
            const item = Array.from(e.clipboardData?.items || []).find((i) =>
              i.type.startsWith("image/"),
            );
            const f = item?.getAsFile?.();
            if (f) {
              e.preventDefault();
              void handleFile(f);
            }
          }}
          onDrop={(e) => {
            const f = e.dataTransfer?.files?.[0];
            if (f && f.type.startsWith("image/")) {
              e.preventDefault();
              void handleFile(f);
            }
          }}
          onDragOver={(e) => {
            if (e.dataTransfer?.types?.includes("Files")) e.preventDefault();
          }}
          disabled={!canType}
          style={{
            flex: 1,
            minWidth: 0,
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,.10)",
            background: "rgba(0,0,0,.15)",
            color: canType ? "rgba(243,244,246,.9)" : "rgba(255,255,255,.5)",
            fontSize: 13,
            outline: "none",
            fontFamily: "inherit",
            cursor: canType ? "text" : "not-allowed",
            boxSizing: "border-box",
          }}
          onKeyDown={(e) => {
            if (mentionState && mentionCandidates.length > 0) {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setMentionState((s) =>
                  s ? { ...s, index: Math.min(mentionCandidates.length - 1, s.index + 1) } : null,
                );
                return;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setMentionState((s) => (s ? { ...s, index: Math.max(0, s.index - 1) } : null));
                return;
              }
              if (e.key === "Tab" || e.key === "Enter") {
                e.preventDefault();
                const sel = mentionCandidates[mentionState.index];
                if (sel?.name) acceptMention(sel.usernameKey || sel.name);
                return;
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setMentionState(null);
                return;
              }
            }
            if (e.key === "Enter" && canSendNow) onSend();
          }}
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.currentTarget.value = "";
          }}
        />
        <button
          onClick={() => {
            void onAttachClick();
          }}
          disabled={!canType || attBusy}
          title="Attach image"
          style={{
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,.1)",
            background: attBusy ? "rgba(124,58,237,.18)" : "rgba(255,255,255,.04)",
            width: 34,
            height: 34,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: canType && !attBusy ? "pointer" : "not-allowed",
            color: canType ? "rgba(200,205,215,.75)" : "rgba(255,255,255,.3)",
            transition: "background .15s, color .15s",
            flexShrink: 0,
            fontSize: 15,
          }}
          aria-label="Attach image"
        >
          {attBusy ? "⏳" : "📎"}
        </button>
        <button
          onClick={() => {
            setGifOpen((v) => !v);
            setEmojiOpen(false);
          }}
          disabled={!canType}
          title="GIF"
          style={{
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,.1)",
            background: gifOpen ? "rgba(124,58,237,.18)" : "rgba(255,255,255,.04)",
            width: 34,
            height: 34,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: canType ? "pointer" : "not-allowed",
            color: canType
              ? gifOpen
                ? "rgba(216,180,254,.95)"
                : "rgba(200,205,215,.75)"
              : "rgba(255,255,255,.3)",
            transition: "background .15s, color .15s",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            if (canType && !gifOpen)
              (e.currentTarget as HTMLElement).style.color = "rgba(243,244,246,.95)";
          }}
          onMouseLeave={(e) => {
            if (canType && !gifOpen)
              (e.currentTarget as HTMLElement).style.color = "rgba(200,205,215,.75)";
          }}
          aria-label="GIF"
        >
          <Icons.Gif />
        </button>
        <button
          onClick={() => {
            setEmojiOpen((v) => !v);
            setGifOpen(false);
          }}
          disabled={!canType}
          title="Emoji"
          style={{
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,.1)",
            background: emojiOpen ? "rgba(124,58,237,.18)" : "rgba(255,255,255,.04)",
            width: 34,
            height: 34,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: canType ? "pointer" : "not-allowed",
            color: canType
              ? emojiOpen
                ? "rgba(216,180,254,.95)"
                : "rgba(200,205,215,.75)"
              : "rgba(255,255,255,.3)",
            transition: "background .15s, color .15s",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            if (canType && !emojiOpen)
              (e.currentTarget as HTMLElement).style.color = "rgba(243,244,246,.95)";
          }}
          onMouseLeave={(e) => {
            if (canType && !emojiOpen)
              (e.currentTarget as HTMLElement).style.color = "rgba(200,205,215,.75)";
          }}
          aria-label="Emoji"
        >
          <Icons.Emoji />
        </button>
        <button
          onClick={onSend}
          disabled={!canSendNow}
          title="Send"
          aria-label="Send"
          style={{
            borderRadius: 10,
            border: canSendNow
              ? "1px solid rgba(124,58,237,.35)"
              : "1px solid rgba(255,255,255,.10)",
            background: canSendNow ? "rgba(124,58,237,.18)" : "rgba(255,255,255,.04)",
            color: canSendNow ? "rgba(216,180,254,.95)" : "rgba(255,255,255,.4)",
            width: 40,
            height: 34,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: canSend ? "pointer" : "not-allowed",
            transition: "all .15s",
            flexShrink: 0,
          }}
        >
          <Icons.Send />
        </button>
      </div>

      {emojiOpen && (
        <div
          ref={emojiRef}
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            right: 0,
            width: 280,
            background: "#1a1a2e",
            border: "1px solid rgba(255,255,255,.12)",
            borderRadius: 12,
            padding: 8,
            zIndex: 50,
            boxShadow: "0 8px 32px rgba(0,0,0,.5)",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 2,
              marginBottom: 6,
              borderBottom: "1px solid rgba(255,255,255,.08)",
              paddingBottom: 6,
            }}
          >
            {EMOJI_CATEGORIES.map((cat, ci) => (
              <button
                key={ci}
                onClick={() => setEmojiCat(ci)}
                style={{
                  flex: 1,
                  background: ci === emojiCat ? "rgba(124,58,237,.2)" : "transparent",
                  border: "none",
                  borderRadius: 6,
                  padding: "4px 0",
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(8, 1fr)",
              gap: 2,
              maxHeight: 160,
              overflow: "auto",
            }}
          >
            {EMOJI_CATEGORIES[emojiCat].emojis.map((em, ei) => (
              <button
                key={ei}
                onClick={() => insertEmoji(em)}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: 18,
                  padding: 4,
                  borderRadius: 6,
                  cursor: "pointer",
                  lineHeight: 1,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,.1)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {em}
              </button>
            ))}
          </div>
        </div>
      )}

      {gifOpen && (
        <GifPicker
          onSelect={(url) => {
            ctx?.sendChat?.(effectiveRoomId, url);
          }}
          onClose={() => setGifOpen(false)}
        />
      )}
    </div>
  );
}
