"use client";
import { type Ctx } from "../WeeredProvider";

import React from "react";
import { fmtTime, fmtDateSep, linkify } from "./shellHelpers";
import type { DmMsg, DmReplyTo, DmThread } from "./types";

export function DmMessage(props: {
  m: DmMsg;
  i: number;
  arr: DmMsg[];
  me: any;
  ctx: Ctx;
  dmActive: DmThread | null;
  dmInputRef: React.RefObject<HTMLInputElement | null>;
  dmEditingMsgId: string;
  setDmEditingMsgId: (v: string) => void;
  dmEditDraft: string;
  setDmEditDraft: (v: string) => void;
  dmHoveredMsgId: string;
  setDmHoveredMsgId: (v: string | ((cur: string) => string)) => void;
  dmPickerMsgId: string;
  setDmPickerMsgId: (v: string | ((cur: string) => string)) => void;
  setDmReplyingTo: (v: DmReplyTo | null) => void;
  DM_QUICK_REACTIONS: string[];
}) {
  const {
    m,
    i,
    arr,
    me,
    ctx,
    dmActive,
    dmInputRef,
    dmEditingMsgId,
    setDmEditingMsgId,
    dmEditDraft,
    setDmEditDraft,
    dmHoveredMsgId,
    setDmHoveredMsgId,
    dmPickerMsgId,
    setDmPickerMsgId,
    setDmReplyingTo,
    DM_QUICK_REACTIONS,
  } = props;

  const isMe = m.fromId === String(me?.id || "");
  const prevMsg = i > 0 ? arr[i - 1] : null;
  const sameSender = prevMsg && prevMsg.fromId === m.fromId;
  const msgDate = fmtDateSep(m.createdAt);
  const prevDate = prevMsg ? fmtDateSep(prevMsg.createdAt) : "";
  const showDateSep = msgDate !== prevDate;
  const nextMsg = i < arr.length - 1 ? arr[i + 1] : null;
  const sameNext = nextMsg && nextMsg.fromId === m.fromId;
  const timeDiff = nextMsg
    ? new Date(nextMsg.createdAt).getTime() - new Date(m.createdAt).getTime()
    : Infinity;
  const showTime = !sameNext || timeDiff > 300_000;
  const isLastSent = isMe && (!nextMsg || nextMsg.fromId !== String(me?.id || ""));
  return (
    <React.Fragment key={m.id}>
      {showDateSep && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            margin: "12px 0 8px",
          }}
        >
          <div style={{ flex: 1, height: 1, background: "var(--weered-bd)" }} />
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: "var(--weered-muted)",
              letterSpacing: ".04em",
              whiteSpace: "nowrap",
            }}
          >
            {msgDate}
          </span>
          <div style={{ flex: 1, height: 1, background: "var(--weered-bd)" }} />
        </div>
      )}
      {(() => {
        const isDeleted = !!m.deletedAt;
        const isEdited = !!m.editedAt && !isDeleted;
        const createdTs = new Date(m.createdAt).getTime();
        const editable = isMe && !isDeleted && Date.now() - createdTs < 15 * 60 * 1000;
        const deletable = isMe && !isDeleted;
        const isEditing = dmEditingMsgId === m.id;
        const isHovered = dmHoveredMsgId === m.id;

        const commitDmEdit = () => {
          const next = dmEditDraft.trim();
          if (!next || next === m.body) {
            setDmEditingMsgId("");
            setDmEditDraft("");
            return;
          }
          try {
            ctx?.sendRaw?.({
              type: "dm:edit",
              msgId: m.id,
              body: next,
            });
          } catch {}
          setDmEditingMsgId("");
          setDmEditDraft("");
        };
        const handleDmDelete = async () => {
          const { weeredConfirm } = await import("../../lib/confirm");
          const ok = await weeredConfirm({
            title: "Delete this message?",
            body: "Gone for you and them.",
            confirmLabel: "Delete",
            destructive: true,
          });
          if (!ok) return;
          try {
            ctx?.sendRaw?.({ type: "dm:delete", msgId: m.id });
          } catch {}
        };

        return (
          <div
            onMouseEnter={() => setDmHoveredMsgId(m.id)}
            onMouseLeave={() => setDmHoveredMsgId((cur) => (cur === m.id ? "" : cur))}
            data-msg-id={m.id}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: isMe ? "flex-end" : "flex-start",
              marginTop: sameSender && !showDateSep ? 1 : 8,
              position: "relative",
              maxWidth: "82%",
              alignSelf: isMe ? "flex-end" : "flex-start",
            }}
          >
            {m.replyToId && !isDeleted && (
              <button
                type="button"
                onClick={() => {
                  try {
                    const el = document.querySelector(
                      `[data-msg-id="${m.replyToId}"]`,
                    ) as HTMLElement | null;
                    if (el) {
                      el.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                      });
                      const prev = el.style.background;
                      el.style.transition = "background 0.2s";
                      el.style.background = "rgba(124,58,237,0.10)";
                      setTimeout(() => {
                        el.style.background = prev;
                      }, 900);
                    }
                  } catch {}
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "2px 8px 2px 6px",
                  marginBottom: 3,
                  fontSize: 10,
                  background: "transparent",
                  border: "none",
                  borderLeft: "2px solid var(--weered-accent-ring)",
                  color: "var(--weered-muted)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  maxWidth: "100%",
                  overflow: "hidden",
                }}
              >
                <span
                  style={{
                    color: "var(--weered-accent-text)",
                    fontWeight: 700,
                  }}
                >
                  ↩ {m.replyToUserName || "?"}
                </span>
                <span
                  style={{
                    opacity: 0.75,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {m.replyToBody || ""}
                </span>
              </button>
            )}
            {isDeleted ? (
              <div
                style={{
                  padding: "7px 13px",
                  borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  background: "rgba(255,255,255,.03)",
                  border: "1px dashed var(--weered-bd)",
                  fontSize: 12,
                  fontStyle: "italic",
                  color: "var(--weered-muted)",
                }}
              >
                [message deleted]
              </div>
            ) : isEditing ? (
              <div style={{ width: "100%", minWidth: 220 }}>
                <textarea
                  autoFocus
                  value={dmEditDraft}
                  onChange={(e) => setDmEditDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      commitDmEdit();
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setDmEditingMsgId("");
                      setDmEditDraft("");
                    }
                  }}
                  style={{
                    width: "100%",
                    minHeight: 56,
                    padding: "7px 11px",
                    borderRadius: 12,
                    border: "1px solid var(--weered-bd2)",
                    background: "var(--weered-panel2)",
                    color: "var(--weered-text)",
                    fontFamily: "inherit",
                    fontSize: 13,
                    outline: "none",
                    resize: "vertical",
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    justifyContent: "flex-end",
                    marginTop: 4,
                    fontSize: 10,
                    color: "var(--weered-muted)",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setDmEditingMsgId("");
                      setDmEditDraft("");
                    }}
                    style={{
                      padding: "3px 8px",
                      fontSize: 10,
                      fontWeight: 700,
                      background: "transparent",
                      border: "1px solid var(--weered-bd)",
                      borderRadius: 6,
                      color: "var(--weered-muted)",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={commitDmEdit}
                    style={{
                      padding: "3px 10px",
                      fontSize: 10,
                      fontWeight: 800,
                      background: "var(--weered-accent-bg)",
                      border: "1px solid var(--weered-accent-ring)",
                      borderRadius: 6,
                      color: "var(--weered-accent-text)",
                      cursor: "pointer",
                    }}
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div
                className={`weered-dock-bubble${isMe ? " weered-dock-bubble-me" : ""}`}
                style={{
                  padding: "9px 13px",
                  borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  background: isMe ? "var(--weered-accent-bg)" : "rgba(255,255,255,.07)",
                  border: isMe
                    ? "1px solid var(--weered-accent-ring)"
                    : "1px solid var(--weered-bd)",
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    lineHeight: "19px",
                    color: "var(--weered-text)",
                  }}
                >
                  {linkify(String(m.body || ""))}
                </div>
              </div>
            )}
            {showTime && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  marginTop: 2,
                  padding: "0 4px",
                }}
              >
                <span style={{ fontSize: 10, color: "var(--weered-muted)" }}>
                  {fmtTime(m.createdAt)}
                </span>
                {isEdited && (
                  <span
                    title={m.editedAt ? new Date(m.editedAt).toLocaleString() : undefined}
                    style={{ fontSize: 9, color: "var(--weered-muted)" }}
                  >
                    (edited)
                  </span>
                )}
                {isLastSent && !isDeleted && m.readAt && (
                  <span
                    style={{
                      fontSize: 9,
                      color: "var(--weered-accent-text)",
                      fontWeight: 600,
                    }}
                  >
                    Read
                  </span>
                )}
                {isLastSent && !isDeleted && !m.readAt && (
                  <span style={{ fontSize: 9, color: "var(--weered-muted)" }}>Sent</span>
                )}
              </div>
            )}
            {isHovered && !isEditing && !isDeleted && (
              <div
                data-reaction-ui
                style={{
                  position: "absolute",
                  top: -6,
                  [isMe ? "left" : ("right" as any)]: -4,
                  display: "flex",
                  gap: 2,
                  padding: 3,
                  borderRadius: 7,
                  background: "var(--weered-panel2)",
                  border: "1px solid var(--weered-bd)",
                  boxShadow: "0 4px 12px rgba(0,0,0,.35)",
                  zIndex: 2,
                }}
              >
                <button
                  type="button"
                  title="React"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDmPickerMsgId((cur) => (cur === m.id ? "" : m.id));
                  }}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 5,
                    border: "none",
                    background: "transparent",
                    color: "var(--weered-muted)",
                    cursor: "pointer",
                    fontSize: 11,
                  }}
                >
                  😊
                </button>
                <button
                  type="button"
                  title="Reply"
                  onClick={(e) => {
                    e.stopPropagation();
                    const peerName = dmActive?.peerName || "user";
                    const senderName = isMe ? me?.name || "you" : peerName;
                    setDmReplyingTo({
                      id: m.id,
                      userName: senderName,
                      body: String(m.body || ""),
                    });
                    try {
                      dmInputRef.current?.focus();
                    } catch {}
                  }}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 5,
                    border: "none",
                    background: "transparent",
                    color: "var(--weered-muted)",
                    cursor: "pointer",
                    fontSize: 11,
                  }}
                >
                  ↩
                </button>
                {editable && (
                  <button
                    type="button"
                    title="Edit"
                    onClick={() => {
                      setDmEditingMsgId(m.id);
                      setDmEditDraft(String(m.body || ""));
                    }}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 5,
                      border: "none",
                      background: "transparent",
                      color: "var(--weered-muted)",
                      cursor: "pointer",
                      fontSize: 11,
                    }}
                  >
                    ✎
                  </button>
                )}
                {deletable && (
                  <button
                    type="button"
                    title="Delete"
                    onClick={handleDmDelete}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 5,
                      border: "none",
                      background: "transparent",
                      color: "var(--weered-muted)",
                      cursor: "pointer",
                      fontSize: 11,
                    }}
                  >
                    🗑
                  </button>
                )}
              </div>
            )}
            {dmPickerMsgId === m.id && (
              <div
                data-reaction-ui
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                  }
                }}
                tabIndex={0}
                role="button"
                style={{
                  position: "absolute",
                  top: 16,
                  [isMe ? "left" : ("right" as any)]: 0,
                  display: "flex",
                  gap: 2,
                  padding: 5,
                  borderRadius: 8,
                  background: "var(--weered-panel2)",
                  border: "1px solid var(--weered-bd)",
                  boxShadow: "0 6px 20px rgba(0,0,0,.5)",
                  zIndex: 3,
                }}
              >
                {DM_QUICK_REACTIONS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => {
                      try {
                        ctx?.sendRaw?.({
                          type: "dm:react",
                          msgId: m.id,
                          emoji: e,
                        });
                      } catch {}
                      setDmPickerMsgId("");
                    }}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 5,
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      fontSize: 16,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
            {Array.isArray(m.reactions) && m.reactions.length > 0 && !isDeleted && (
              <div
                data-reaction-ui
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 4,
                  marginTop: 4,
                  justifyContent: isMe ? "flex-end" : "flex-start",
                }}
              >
                {m.reactions.map((r: any) => {
                  const mine = Array.isArray(r.users) && r.users.includes(String(me?.id || ""));
                  return (
                    <button
                      key={r.emoji}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        try {
                          ctx?.sendRaw?.({
                            type: "dm:react",
                            msgId: m.id,
                            emoji: r.emoji,
                          });
                        } catch {}
                      }}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 3,
                        padding: "1px 6px",
                        borderRadius: 10,
                        border: `1px solid ${mine ? "var(--weered-accent-ring)" : "var(--weered-bd)"}`,
                        background: mine ? "var(--weered-accent-bg)" : "rgba(255,255,255,.04)",
                        color: mine ? "var(--weered-accent-text)" : "var(--weered-muted)",
                        fontSize: 10,
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        lineHeight: 1.1,
                      }}
                    >
                      <span style={{ fontSize: 12 }}>{r.emoji}</span>
                      <span style={{ fontVariantNumeric: "tabular-nums" }}>{r.count}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}
    </React.Fragment>
  );
}
