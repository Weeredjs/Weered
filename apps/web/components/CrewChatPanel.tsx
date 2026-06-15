"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { avatarBg } from "../lib/avatarColor";
import EmptyState from "./EmptyState";
import { useWeered } from "./WeeredProvider";
import { weeredConfirm } from "../lib/confirm";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
function getToken() {
  try {
    return localStorage.getItem("weered_token") || "";
  } catch {
    return "";
  }
}

type CrewReaction = { emoji: string; count: number; users: string[] };
interface CrewMessage {
  id: string;
  userId: string;
  userName: string;
  body: string;
  createdAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  reactions?: CrewReaction[];
  replyToId?: string | null;
  replyToUserId?: string | null;
  replyToUserName?: string | null;
  replyToBody?: string | null;
}

interface Props {
  crewId: string;
  crewName: string;
  myId: string;
  myName: string;
}

function timeStr(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

function dateLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.floor((today.getTime() - msgDay.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function isSameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

export default function CrewChatPanel({ crewId, crewName, myId, myName }: Props) {
  const [messages, setMessages] = useState<CrewMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [editingMsgId, setEditingMsgId] = useState("");
  const [editDraft, setEditDraft] = useState("");
  const [hoveredMsgId, setHoveredMsgId] = useState("");
  const [pickerMsgId, setPickerMsgId] = useState("");
  const [replyingTo, setReplyingTo] = useState<{
    id: string;
    userName: string;
    body: string;
  } | null>(null);
  const QUICK_REACTIONS = ["👍", "❤️", "😂", "🔥", "🎉", "😢", "😮", "🙌"];

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const ctx = useWeered() as any;

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  }, []);

  useEffect(() => {
    const tok = getToken();
    if (!tok) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    fetch(`${API}/crews/${crewId}/messages`, {
      headers: { Authorization: `Bearer ${tok}` },
    })
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled && j.ok && Array.isArray(j.messages)) {
          setMessages(j.messages);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          requestAnimationFrame(() => {
            bottomRef.current?.scrollIntoView({ behavior: "instant" as any });
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [crewId]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || detail.crewId !== crewId) return;
      const msg = detail.message as CrewMessage;
      if (!msg?.id) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      scrollToBottom();
    };
    window.addEventListener("weered:crew:message", handler);

    const editHandler = (ev: any) => {
      const d = ev?.detail;
      if (!d || d.crewId !== crewId) return;
      const id = String(d.msgId || "");
      const body = String(d.body || "");
      const editedAt = d.editedAt;
      if (!id) return;
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, body, editedAt } : m)));
    };
    const delHandler = (ev: any) => {
      const d = ev?.detail;
      if (!d || d.crewId !== crewId) return;
      const id = String(d.msgId || "");
      const deletedAt = d.deletedAt;
      if (!id) return;
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, body: "", deletedAt } : m)));
    };
    const rxHandler = (ev: any) => {
      const d = ev?.detail;
      if (!d || d.crewId !== crewId) return;
      const id = String(d.msgId || "");
      const reactions = Array.isArray(d.reactions) ? d.reactions : [];
      if (!id) return;
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, reactions } : m)));
    };
    window.addEventListener("weered:crew:edited", editHandler);
    window.addEventListener("weered:crew:deleted", delHandler);
    window.addEventListener("weered:crew:reaction", rxHandler);

    return () => {
      window.removeEventListener("weered:crew:message", handler);
      window.removeEventListener("weered:crew:edited", editHandler);
      window.removeEventListener("weered:crew:deleted", delHandler);
      window.removeEventListener("weered:crew:reaction", rxHandler);
    };
  }, [crewId, scrollToBottom]);

  useEffect(() => {
    if (messages.length > 0) scrollToBottom();
  }, [messages.length, scrollToBottom]);

  const handleSend = useCallback(() => {
    const body = input.trim();
    if (!body) return;

    const envelope: any = { type: "crew:send", crewId, body };
    if (replyingTo?.id) envelope.replyToId = replyingTo.id;

    window.dispatchEvent(new CustomEvent("weered:ws:send", { detail: envelope }));

    const optimistic: CrewMessage = {
      id: `opt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      userId: myId,
      userName: myName,
      body,
      createdAt: new Date().toISOString(),
      replyToId: replyingTo?.id,
      replyToUserName: replyingTo?.userName,
      replyToBody: replyingTo?.body?.slice(0, 120),
    };
    setMessages((prev) => [...prev, optimistic]);
    setInput("");
    setReplyingTo(null);
    scrollToBottom();
    inputRef.current?.focus();
  }, [input, crewId, myId, myName, scrollToBottom, replyingTo]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "rgba(10,10,15,.95)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderBottom: "1px solid rgba(255,255,255,.06)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(88,0,229,.7)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87" />
            <path d="M16 3.13a4 4 0 010 7.75" />
          </svg>
          <span
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: "rgba(243,244,246,.95)",
              letterSpacing: "-.2px",
            }}
          >
            {crewName}
          </span>
        </div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: "rgba(243,244,246,.25)",
            letterSpacing: ".04em",
            textTransform: "uppercase",
          }}
        >
          Crew Chat
        </span>
      </div>

      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          padding: "8px 0",
          minHeight: 0,
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(255,255,255,.08) transparent",
        }}
      >
        {loading && (
          <div
            style={{
              padding: "40px 20px",
              textAlign: "center",
              color: "rgba(243,244,246,.25)",
              fontSize: 12,
              letterSpacing: ".04em",
            }}
          >
            Loading messages...
          </div>
        )}

        {!loading && messages.length === 0 && (
          <EmptyState title="Crew's quiet." hint="Say something — they're probably listening." />
        )}

        {!loading &&
          messages.map((msg, i) => {
            const isMe = msg.userId === myId;
            const bg = avatarBg(msg.userName);
            const showDateSep = i === 0 || !isSameDay(messages[i - 1].createdAt, msg.createdAt);

            return (
              <React.Fragment key={msg.id}>
                {showDateSep && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "12px 16px 6px",
                    }}
                  >
                    <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,.06)" }} />
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: "rgba(243,244,246,.25)",
                        letterSpacing: ".04em",
                        textTransform: "uppercase",
                        flexShrink: 0,
                      }}
                    >
                      {dateLabel(msg.createdAt)}
                    </span>
                    <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,.06)" }} />
                  </div>
                )}

                {(() => {
                  const isDeleted = !!msg.deletedAt;
                  const isEdited = !!msg.editedAt && !isDeleted;
                  const createdTs = new Date(msg.createdAt).getTime();
                  const editable = isMe && !isDeleted && Date.now() - createdTs < 15 * 60 * 1000;
                  const deletable = isMe && !isDeleted;
                  const isEditing = editingMsgId === msg.id;
                  const isHovered = hoveredMsgId === msg.id;

                  const commitEdit = () => {
                    const next = editDraft.trim();
                    if (!next || next === msg.body) {
                      setEditingMsgId("");
                      setEditDraft("");
                      return;
                    }
                    try {
                      ctx?.sendRaw?.({ type: "crew:edit", msgId: msg.id, body: next });
                    } catch {}
                    setEditingMsgId("");
                    setEditDraft("");
                  };
                  const handleDel = async () => {
                    const ok = await weeredConfirm({
                      title: "Delete this message?",
                      body: "Wiped for the whole crew.",
                      confirmLabel: "Delete",
                      destructive: true,
                    });
                    if (!ok) return;
                    try {
                      ctx?.sendRaw?.({ type: "crew:delete", msgId: msg.id });
                    } catch {}
                  };

                  return (
                    <div
                      onMouseEnter={() => setHoveredMsgId(msg.id)}
                      onMouseLeave={() => setHoveredMsgId((cur) => (cur === msg.id ? "" : cur))}
                      data-msg-id={msg.id}
                      style={{
                        display: "flex",
                        flexDirection: isMe ? "row-reverse" : "row",
                        alignItems: "flex-start",
                        gap: 8,
                        padding: "4px 16px",
                        position: "relative",
                      }}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          minWidth: 28,
                          borderRadius: "50%",
                          background: `${bg}33`,
                          border: `1.5px solid ${bg}55`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 12,
                          fontWeight: 800,
                          color: bg,
                          marginTop: 2,
                          flexShrink: 0,
                          opacity: isDeleted ? 0.45 : 1,
                        }}
                      >
                        {msg.userName.charAt(0).toUpperCase()}
                      </div>

                      <div style={{ maxWidth: "75%", minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "baseline",
                            gap: 6,
                            marginBottom: 2,
                            flexDirection: isMe ? "row-reverse" : "row",
                          }}
                        >
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: isMe ? "rgba(88,0,229,.8)" : bg,
                            }}
                          >
                            {isMe ? "You" : msg.userName}
                          </span>
                          <span
                            style={{
                              fontSize: 9,
                              color: "rgba(243,244,246,.20)",
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {timeStr(msg.createdAt)}
                          </span>
                          {isEdited && (
                            <span
                              title={
                                msg.editedAt ? new Date(msg.editedAt).toLocaleString() : undefined
                              }
                              style={{ fontSize: 9, color: "rgba(243,244,246,.30)" }}
                            >
                              (edited)
                            </span>
                          )}
                        </div>

                        {msg.replyToId && !isDeleted && (
                          <button
                            type="button"
                            onClick={() => {
                              try {
                                const el = document.querySelector(
                                  `[data-msg-id="${msg.replyToId}"]`,
                                ) as HTMLElement | null;
                                if (el) {
                                  el.scrollIntoView({ behavior: "smooth", block: "center" });
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
                              borderLeft: "2px solid rgba(124,58,237,.5)",
                              color: "rgba(148,163,184,.7)",
                              cursor: "pointer",
                              fontFamily: "inherit",
                              alignSelf: isMe ? "flex-end" : "flex-start",
                              maxWidth: "100%",
                              overflow: "hidden",
                            }}
                          >
                            <span style={{ color: "rgba(196,181,253,.85)", fontWeight: 700 }}>
                              ↩ {msg.replyToUserName || "?"}
                            </span>
                            <span
                              style={{
                                opacity: 0.7,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {msg.replyToBody || ""}
                            </span>
                          </button>
                        )}

                        {isDeleted ? (
                          <div
                            style={{
                              fontSize: 12,
                              fontStyle: "italic",
                              color: "rgba(243,244,246,.35)",
                              padding: "6px 12px",
                              borderRadius: isMe ? "14px 4px 14px 14px" : "4px 14px 14px 14px",
                              background: "rgba(255,255,255,.025)",
                              border: "1px dashed rgba(255,255,255,.08)",
                            }}
                          >
                            [message deleted]
                          </div>
                        ) : isEditing ? (
                          <div style={{ minWidth: 220 }}>
                            <textarea
                              autoFocus
                              value={editDraft}
                              onChange={(e) => setEditDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  commitEdit();
                                }
                                if (e.key === "Escape") {
                                  e.preventDefault();
                                  setEditingMsgId("");
                                  setEditDraft("");
                                }
                              }}
                              style={{
                                width: "100%",
                                minHeight: 56,
                                padding: "7px 11px",
                                borderRadius: 10,
                                border: "1px solid rgba(255,255,255,.18)",
                                background: "rgba(0,0,0,.3)",
                                color: "rgba(243,244,246,.95)",
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
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingMsgId("");
                                  setEditDraft("");
                                }}
                                style={{
                                  padding: "3px 8px",
                                  fontSize: 10,
                                  fontWeight: 700,
                                  background: "transparent",
                                  border: "1px solid rgba(255,255,255,.12)",
                                  borderRadius: 6,
                                  color: "rgba(148,163,184,.75)",
                                  cursor: "pointer",
                                }}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={commitEdit}
                                style={{
                                  padding: "3px 10px",
                                  fontSize: 10,
                                  fontWeight: 800,
                                  background: "rgba(88,0,229,.18)",
                                  border: "1px solid rgba(88,0,229,.45)",
                                  borderRadius: 6,
                                  color: "rgba(196,181,253,.95)",
                                  cursor: "pointer",
                                }}
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            style={{
                              fontSize: 13,
                              lineHeight: 1.45,
                              color: "rgba(243,244,246,.88)",
                              padding: "8px 12px",
                              borderRadius: isMe ? "14px 4px 14px 14px" : "4px 14px 14px 14px",
                              background: isMe ? "rgba(88,0,229,.15)" : "rgba(255,255,255,.05)",
                              border: `1px solid ${isMe ? "rgba(88,0,229,.20)" : "rgba(255,255,255,.06)"}`,
                              wordBreak: "break-word",
                            }}
                          >
                            {msg.body}
                          </div>
                        )}
                      </div>

                      {isHovered && !isEditing && !isDeleted && (
                        <div
                          data-reaction-ui
                          style={{
                            position: "absolute",
                            top: 0,
                            [isMe ? "left" : ("right" as any)]: 8,
                            display: "flex",
                            gap: 2,
                            padding: 3,
                            borderRadius: 7,
                            background: "rgba(16,16,20,.96)",
                            border: "1px solid rgba(255,255,255,.1)",
                            boxShadow: "0 4px 12px rgba(0,0,0,.35)",
                            zIndex: 2,
                          }}
                        >
                          <button
                            type="button"
                            title="React"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPickerMsgId((cur) => (cur === msg.id ? "" : msg.id));
                            }}
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 5,
                              border: "none",
                              background: "transparent",
                              color: "rgba(148,163,184,.75)",
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
                              setReplyingTo({
                                id: msg.id,
                                userName: isMe ? "you" : msg.userName,
                                body: String(msg.body || ""),
                              });
                              try {
                                inputRef.current?.focus();
                              } catch {}
                            }}
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 5,
                              border: "none",
                              background: "transparent",
                              color: "rgba(148,163,184,.75)",
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
                                setEditingMsgId(msg.id);
                                setEditDraft(String(msg.body || ""));
                              }}
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: 5,
                                border: "none",
                                background: "transparent",
                                color: "rgba(148,163,184,.75)",
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
                              onClick={handleDel}
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: 5,
                                border: "none",
                                background: "transparent",
                                color: "rgba(148,163,184,.75)",
                                cursor: "pointer",
                                fontSize: 11,
                              }}
                            >
                              🗑
                            </button>
                          )}
                        </div>
                      )}
                      {pickerMsgId === msg.id && (
                        <div
                          data-reaction-ui
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            position: "absolute",
                            top: 22,
                            [isMe ? "left" : ("right" as any)]: 8,
                            display: "flex",
                            gap: 2,
                            padding: 5,
                            borderRadius: 8,
                            background: "rgba(16,16,20,.98)",
                            border: "1px solid rgba(255,255,255,.1)",
                            boxShadow: "0 6px 20px rgba(0,0,0,.5)",
                            zIndex: 3,
                          }}
                        >
                          {QUICK_REACTIONS.map((e) => (
                            <button
                              key={e}
                              type="button"
                              onClick={() => {
                                try {
                                  ctx?.sendRaw?.({ type: "crew:react", msgId: msg.id, emoji: e });
                                } catch {}
                                setPickerMsgId("");
                              }}
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 5,
                                border: "none",
                                background: "transparent",
                                cursor: "pointer",
                                fontSize: 16,
                              }}
                            >
                              {e}
                            </button>
                          ))}
                        </div>
                      )}
                      {Array.isArray(msg.reactions) && msg.reactions.length > 0 && !isDeleted && (
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
                          {msg.reactions.map((r) => {
                            const mine = Array.isArray(r.users) && r.users.includes(myId);
                            return (
                              <button
                                key={r.emoji}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  try {
                                    ctx?.sendRaw?.({
                                      type: "crew:react",
                                      msgId: msg.id,
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
                                  border: `1px solid ${mine ? "rgba(88,0,229,.55)" : "rgba(255,255,255,.1)"}`,
                                  background: mine ? "rgba(88,0,229,.18)" : "rgba(255,255,255,.04)",
                                  color: mine ? "rgba(196,181,253,.95)" : "rgba(148,163,184,.85)",
                                  fontSize: 10,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  fontFamily: "inherit",
                                  lineHeight: 1.1,
                                }}
                              >
                                <span style={{ fontSize: 12 }}>{r.emoji}</span>
                                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                                  {r.count}
                                </span>
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
          })}

        <div ref={bottomRef} />
      </div>

      {replyingTo && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 12px",
            borderTop: "1px solid rgba(255,255,255,.06)",
            borderLeft: "2px solid rgba(124,58,237,.55)",
            background: "rgba(124,58,237,.08)",
            fontSize: 11,
          }}
        >
          <span style={{ color: "rgba(196,181,253,.9)", fontWeight: 700, flexShrink: 0 }}>
            ↩ Replying to <strong>{replyingTo.userName}</strong>
          </span>
          <span
            style={{
              flex: 1,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              color: "rgba(148,163,184,.75)",
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
              color: "rgba(148,163,184,.75)",
              cursor: "pointer",
              fontSize: 12,
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px",
          borderTop: "1px solid rgba(255,255,255,.06)",
          flexShrink: 0,
          background: "rgba(10,10,15,.98)",
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message crew..."
          style={{
            flex: 1,
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,.08)",
            background: "rgba(255,255,255,.04)",
            color: "rgba(243,244,246,.95)",
            fontSize: 13,
            outline: "none",
            transition: "border-color 0.15s",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "rgba(88,0,229,.40)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "rgba(255,255,255,.08)";
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim()}
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            border: "none",
            background: input.trim() ? "#5800E5" : "rgba(88,0,229,.25)",
            color: input.trim() ? "rgba(255,255,255,.95)" : "rgba(255,255,255,.35)",
            cursor: input.trim() ? "pointer" : "default",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            if (input.trim()) (e.currentTarget as HTMLElement).style.background = "#6d1aff";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = input.trim()
              ? "#5800E5"
              : "rgba(88,0,229,.25)";
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
