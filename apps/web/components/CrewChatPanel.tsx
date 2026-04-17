"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { avatarBg } from "../lib/avatarColor";
import EmptyState from "./EmptyState";

// ─── Config ──────────────────────────────────────────────────────────────────
const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
function getToken() {
  try { return localStorage.getItem("weered_token") || ""; } catch { return ""; }
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface CrewMessage {
  id: string;
  userId: string;
  userName: string;
  body: string;
  createdAt: string;
}

interface Props {
  crewId: string;
  crewName: string;
  myId: string;
  myName: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
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
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
}

function isSameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function CrewChatPanel({ crewId, crewName, myId, myName }: Props) {
  const [messages, setMessages] = useState<CrewMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  }, []);

  // Fetch messages on mount
  useEffect(() => {
    const tok = getToken();
    if (!tok) { setLoading(false); return; }

    let cancelled = false;
    fetch(`${API}/crews/${crewId}/messages`, {
      headers: { Authorization: `Bearer ${tok}` },
    })
      .then(r => r.json())
      .then(j => {
        if (!cancelled && j.ok && Array.isArray(j.messages)) {
          setMessages(j.messages);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          // Scroll after DOM paint
          requestAnimationFrame(() => {
            bottomRef.current?.scrollIntoView({ behavior: "instant" as any });
          });
        }
      });

    return () => { cancelled = true; };
  }, [crewId]);

  // Listen for incoming crew messages via custom event
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || detail.crewId !== crewId) return;
      const msg = detail.message as CrewMessage;
      if (!msg?.id) return;
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      scrollToBottom();
    };
    window.addEventListener("weered:crew:message", handler);
    return () => window.removeEventListener("weered:crew:message", handler);
  }, [crewId, scrollToBottom]);

  // Scroll when messages change
  useEffect(() => {
    if (messages.length > 0) scrollToBottom();
  }, [messages.length, scrollToBottom]);

  // Send message
  const handleSend = useCallback(() => {
    const body = input.trim();
    if (!body) return;

    // Dispatch through WS bridge
    window.dispatchEvent(new CustomEvent("weered:ws:send", {
      detail: { type: "crew:send", crewId, body },
    }));

    // Optimistic add
    const optimistic: CrewMessage = {
      id: `opt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      userId: myId,
      userName: myName,
      body,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);
    setInput("");
    scrollToBottom();
    inputRef.current?.focus();
  }, [input, crewId, myId, myName, scrollToBottom]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: "rgba(10,10,15,.95)",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px",
        borderBottom: "1px solid rgba(255,255,255,.06)",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(88,0,229,.7)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87" />
            <path d="M16 3.13a4 4 0 010 7.75" />
          </svg>
          <span style={{
            fontSize: 13, fontWeight: 800, color: "rgba(243,244,246,.95)",
            letterSpacing: "-.2px",
          }}>
            {crewName}
          </span>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 600,
          color: "rgba(243,244,246,.25)",
          letterSpacing: ".04em",
          textTransform: "uppercase",
        }}>
          Crew Chat
        </span>
      </div>

      {/* Message list */}
      <div
        ref={scrollRef}
        style={{
          flex: 1, overflowY: "auto", overflowX: "hidden",
          padding: "8px 0",
          minHeight: 0,
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(255,255,255,.08) transparent",
        }}
      >
        {loading && (
          <div style={{
            padding: "40px 20px", textAlign: "center",
            color: "rgba(243,244,246,.25)", fontSize: 12,
            letterSpacing: ".04em",
          }}>
            Loading messages...
          </div>
        )}

        {!loading && messages.length === 0 && (
          <EmptyState title="Crew's quiet." hint="Say something — they're probably listening." />
        )}

        {!loading && messages.map((msg, i) => {
          const isMe = msg.userId === myId;
          const bg = avatarBg(msg.userName);
          const showDateSep = i === 0 || !isSameDay(messages[i - 1].createdAt, msg.createdAt);

          return (
            <React.Fragment key={msg.id}>
              {/* Date separator */}
              {showDateSep && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "12px 16px 6px",
                }}>
                  <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,.06)" }} />
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: "rgba(243,244,246,.25)",
                    letterSpacing: ".04em", textTransform: "uppercase",
                    flexShrink: 0,
                  }}>
                    {dateLabel(msg.createdAt)}
                  </span>
                  <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,.06)" }} />
                </div>
              )}

              {/* Message row */}
              <div style={{
                display: "flex",
                flexDirection: isMe ? "row-reverse" : "row",
                alignItems: "flex-start",
                gap: 8,
                padding: "4px 16px",
              }}>
                {/* Avatar */}
                <div style={{
                  width: 28, height: 28, minWidth: 28, borderRadius: "50%",
                  background: `${bg}33`,
                  border: `1.5px solid ${bg}55`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 800, color: bg,
                  marginTop: 2,
                  flexShrink: 0,
                }}>
                  {msg.userName.charAt(0).toUpperCase()}
                </div>

                {/* Bubble */}
                <div style={{
                  maxWidth: "75%", minWidth: 0,
                }}>
                  {/* Name + time */}
                  <div style={{
                    display: "flex", alignItems: "baseline", gap: 6,
                    marginBottom: 2,
                    flexDirection: isMe ? "row-reverse" : "row",
                  }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700,
                      color: isMe ? "rgba(88,0,229,.8)" : bg,
                    }}>
                      {isMe ? "You" : msg.userName}
                    </span>
                    <span style={{
                      fontSize: 9, color: "rgba(243,244,246,.20)",
                      fontVariantNumeric: "tabular-nums",
                    }}>
                      {timeStr(msg.createdAt)}
                    </span>
                  </div>

                  {/* Body */}
                  <div style={{
                    fontSize: 13, lineHeight: 1.45,
                    color: "rgba(243,244,246,.88)",
                    padding: "8px 12px",
                    borderRadius: isMe ? "14px 4px 14px 14px" : "4px 14px 14px 14px",
                    background: isMe ? "rgba(88,0,229,.15)" : "rgba(255,255,255,.05)",
                    border: `1px solid ${isMe ? "rgba(88,0,229,.20)" : "rgba(255,255,255,.06)"}`,
                    wordBreak: "break-word",
                  }}>
                    {msg.body}
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "10px 12px",
        borderTop: "1px solid rgba(255,255,255,.06)",
        flexShrink: 0,
        background: "rgba(10,10,15,.98)",
      }}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
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
          onFocus={e => { e.currentTarget.style.borderColor = "rgba(88,0,229,.40)"; }}
          onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,.08)"; }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim()}
          style={{
            width: 38, height: 38, borderRadius: 10,
            border: "none",
            background: input.trim() ? "#5800E5" : "rgba(88,0,229,.25)",
            color: input.trim() ? "rgba(255,255,255,.95)" : "rgba(255,255,255,.35)",
            cursor: input.trim() ? "pointer" : "default",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
            transition: "all 0.15s",
          }}
          onMouseEnter={e => {
            if (input.trim()) (e.currentTarget as HTMLElement).style.background = "#6d1aff";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = input.trim() ? "#5800E5" : "rgba(88,0,229,.25)";
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
