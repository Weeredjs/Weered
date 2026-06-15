"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import EmptyState from "./EmptyState";
import LoadingState from "./LoadingState";
import { weeredConfirm } from "../lib/confirm";

function fmtRel(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

interface Member { id: string; name: string; avatar?: string | null; usernameKey?: string; }
interface Thread {
  id: string;
  name: string | null;
  createdById: string;
  createdAt: string;
  lastMessageAt: string;
  role: "OWNER" | "MEMBER";
  unread: number;
  members: Member[];
  lastMessage: { id: string; senderId: string; body: string; createdAt: string; deleted?: boolean } | null;
}
interface Message {
  id: string;
  threadId: string;
  senderId: string;
  body: string;
  createdAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  senderName?: string;
  replyToId?: string | null;
  replyToUserId?: string | null;
  replyToUserName?: string | null;
  replyToBody?: string | null;
}
interface FriendRow { id: string; name: string; avatar?: string | null; avatarColor?: string | null; }
interface ReplyDraft { id: string; userName: string; body: string; }

function threadDisplayName(t: Thread, meId: string): string {
  if (t.name) return t.name;
  const others = t.members.filter(m => m.id !== meId).map(m => m.name);
  if (others.length === 0) return "Group";
  if (others.length <= 3) return others.join(", ");
  return `${others.slice(0, 3).join(", ")} +${others.length - 3}`;
}

export default function GroupsTab({
  apiBase, token, meId, initialThreadId, initialCreate, onExitToInbox,
}: {
  apiBase: string;
  token: string;
  meId: string;
  initialThreadId?: string;
  initialCreate?: boolean;
  onExitToInbox?: () => void;
}) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string>(initialThreadId || "");
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<ReplyDraft | null>(null);
  const [editingId, setEditingId] = useState<string>("");
  const [editDraft, setEditDraft] = useState("");
  const [hoveredId, setHoveredId] = useState<string>("");
  const [loadingList, setLoadingList] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [view, setView] = useState<"list" | "thread" | "create" | "settings">(
    initialThreadId ? "thread" : initialCreate ? "create" : "list"
  );

  useEffect(() => {
    if (initialThreadId) { setActiveId(initialThreadId); setView("thread"); }
    else if (initialCreate) { setView("create"); }
  }, [initialThreadId, initialCreate]);

  const exitTop = useCallback(() => {
    if (onExitToInbox) { onExitToInbox(); return; }
    setView("list"); setActiveId("");
  }, [onExitToInbox]);
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const auth = useMemo(() => token ? { Authorization: `Bearer ${token}` } : ({} as any), [token]);

  const reloadThreads = useCallback(async () => {
    if (!apiBase || !token) return;
    setLoadingList(true);
    try {
      const r = await fetch(`${apiBase}/groups`, { headers: auth });
      const j = await r.json();
      if (j?.ok) setThreads(j.threads || []);
    } catch {}
    setLoadingList(false);
  }, [apiBase, token, auth]);

  const reloadMessages = useCallback(async (id: string) => {
    if (!apiBase || !token || !id) return;
    setLoadingMsgs(true);
    try {
      const r = await fetch(`${apiBase}/groups/${encodeURIComponent(id)}/messages`, { headers: auth });
      const j = await r.json();
      if (j?.ok) {
        setMessages(j.messages || []);
        setThreads(cur => cur.map(t => t.id === id ? { ...t, unread: 0 } : t));
      }
    } catch {}
    setLoadingMsgs(false);
  }, [apiBase, token, auth]);

  useEffect(() => { void reloadThreads(); }, [reloadThreads]);

  useEffect(() => {
    if (activeId && view === "thread") void reloadMessages(activeId);
    if (!activeId) setMessages([]);
  }, [activeId, view, reloadMessages]);

  useEffect(() => {
    const total = threads.reduce((s, t) => s + (t.unread || 0), 0);
    try { window.dispatchEvent(new CustomEvent("weered:groups:unread", { detail: { count: total } })); } catch {}
  }, [threads]);

  useEffect(() => {
    if (view === "thread") try { endRef.current?.scrollIntoView({ block: "end" }); } catch {}
  }, [messages, view]);

  useEffect(() => {
    const onMsg = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const m: Message = detail?.message;
      if (!m?.id || !m.threadId) return;
      if (m.threadId === activeId) {
        setMessages(cur => cur.some(x => x.id === m.id) ? cur : [...cur, m]);
      }
      setThreads(cur => cur.map(t => {
        if (t.id !== m.threadId) return t;
        const isMine = m.senderId === meId;
        return {
          ...t,
          lastMessage: { id: m.id, senderId: m.senderId, body: m.body, createdAt: m.createdAt },
          lastMessageAt: m.createdAt,
          unread: (t.id === activeId || isMine) ? t.unread : t.unread + 1,
        };
      }).sort((a, b) => (b.lastMessageAt > a.lastMessageAt ? 1 : -1)));
    };
    const onEdited = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (!d?.threadId || !d?.msgId) return;
      if (d.threadId !== activeId) return;
      setMessages(cur => cur.map(x => x.id === d.msgId ? { ...x, body: d.body, editedAt: d.editedAt } : x));
    };
    const onDeleted = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (!d?.threadId || !d?.msgId) return;
      if (d.threadId !== activeId) return;
      setMessages(cur => cur.map(x => x.id === d.msgId ? { ...x, body: "", deletedAt: d.deletedAt } : x));
    };
    const onCreated = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const t = detail?.thread;
      if (!t?.id) return;
      setThreads(cur => cur.some(x => x.id === t.id) ? cur : [{
        id: t.id,
        name: t.name || null,
        createdById: t.createdById,
        createdAt: t.createdAt,
        lastMessageAt: t.lastMessageAt,
        role: t.createdById === meId ? "OWNER" : "MEMBER",
        unread: 0,
        members: t.members || [],
        lastMessage: null,
      }, ...cur]);
    };
    const onRenamed = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (!d?.threadId) return;
      setThreads(cur => cur.map(t => t.id === d.threadId ? { ...t, name: d.name || null } : t));
    };
    const onMembers = () => { void reloadThreads(); };

    window.addEventListener("weered:group:message", onMsg);
    window.addEventListener("weered:group:edited", onEdited);
    window.addEventListener("weered:group:deleted", onDeleted);
    window.addEventListener("weered:group:created", onCreated);
    window.addEventListener("weered:group:renamed", onRenamed);
    window.addEventListener("weered:group:members:added", onMembers);
    window.addEventListener("weered:group:members:removed", onMembers);
    return () => {
      window.removeEventListener("weered:group:message", onMsg);
      window.removeEventListener("weered:group:edited", onEdited);
      window.removeEventListener("weered:group:deleted", onDeleted);
      window.removeEventListener("weered:group:created", onCreated);
      window.removeEventListener("weered:group:renamed", onRenamed);
      window.removeEventListener("weered:group:members:added", onMembers);
      window.removeEventListener("weered:group:members:removed", onMembers);
    };
  }, [activeId, meId, reloadThreads]);

  const send = async () => {
    const body = draft.trim();
    if (!body || !activeId) return;
    setDraft("");
    const replyId = replyTo?.id;
    setReplyTo(null);
    try {
      await fetch(`${apiBase}/groups/${encodeURIComponent(activeId)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify({ body, replyToId: replyId }),
      });
    } catch {}
  };

  const commitEdit = async () => {
    const next = editDraft.trim();
    const id = editingId;
    if (!next || !activeId || !id) { setEditingId(""); setEditDraft(""); return; }
    setEditingId(""); setEditDraft("");
    try {
      await fetch(`${apiBase}/groups/${encodeURIComponent(activeId)}/messages/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify({ body: next }),
      });
    } catch {}
  };

  const deleteMsg = async (msgId: string) => {
    if (!activeId) return;
    const ok = await weeredConfirm({
      title: "Delete this message?",
      body: "Gone for everyone in the group.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await fetch(`${apiBase}/groups/${encodeURIComponent(activeId)}/messages/${encodeURIComponent(msgId)}`, {
        method: "DELETE",
        headers: auth,
      });
    } catch {}
  };

  const active = threads.find(t => t.id === activeId) || null;

  if (view === "create") {
    return (
      <CreateGroupView
        apiBase={apiBase}
        token={token}
        onCancel={() => exitTop()}
        onCreated={(t) => {
          setView("thread");
          setActiveId(t.id);
          setThreads(cur => cur.some(x => x.id === t.id) ? cur : [t, ...cur]);
        }}
      />
    );
  }

  if (view === "settings" && active) {
    return (
      <SettingsView
        apiBase={apiBase}
        token={token}
        meId={meId}
        thread={active}
        onClose={() => setView("thread")}
        onLeft={() => {
          setThreads(cur => cur.filter(t => t.id !== active.id));
          exitTop();
        }}
      />
    );
  }

  if (view === "thread" && active) {
    const title = threadDisplayName(active, meId);
    return (
      <div style={{ display: "flex", flexDirection: "column", flex: 1, height: "100%" }}>
        <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--weered-bd)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0, background: "rgba(255,255,255,.02)" }}>
          <button onClick={() => exitTop()} style={{ background: "none", border: "none", color: "var(--weered-muted)", cursor: "pointer", padding: "0 4px", display: "flex", alignItems: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--weered-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
            <div style={{ fontSize: 10, color: "var(--weered-muted)" }}>{active.members.length} members</div>
          </div>
          <button
            onClick={() => setView("settings")}
            title="Group settings"
            style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--weered-bd)", background: "rgba(255,255,255,.04)", color: "var(--weered-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 008.07 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09c0 .67.4 1.27 1 1.51a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82c.24.6.84 1 1.51 1H21a2 2 0 110 4h-.09c-.67 0-1.27.4-1.51 1z" /></svg>
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px", display: "flex", flexDirection: "column", gap: 4 }}>
          {loadingMsgs && messages.length === 0 ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <LoadingState compact label="Tuning in" />
            </div>
          ) : messages.length === 0 ? (
            <EmptyState title="Empty thread." hint="Be the one who breaks the silence." />
          ) : messages.map((m, i) => {
            const isMe = m.senderId === meId;
            const prev = i > 0 ? messages[i - 1] : null;
            const sameSender = prev && prev.senderId === m.senderId;
            const senderMember = active.members.find(mm => mm.id === m.senderId);
            const senderName = senderMember?.name || m.senderName || "Someone";
            const isDeleted = !!m.deletedAt;
            const isEdited = !!m.editedAt && !isDeleted;
            const createdTs = new Date(m.createdAt).getTime();
            const editable = isMe && !isDeleted && (Date.now() - createdTs) < 15 * 60 * 1000;
            const deletable = !isDeleted && (isMe || active.role === "OWNER");
            const isEditing = editingId === m.id;
            const isHovered = hoveredId === m.id;
            return (
              <div
                key={m.id}
                data-msg-id={m.id}
                onMouseEnter={() => setHoveredId(m.id)}
                onMouseLeave={() => setHoveredId(cur => cur === m.id ? "" : cur)}
                style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start", marginTop: sameSender ? 1 : 8, maxWidth: "82%", alignSelf: isMe ? "flex-end" : "flex-start" }}
              >
                {!isMe && !sameSender && !isDeleted && (
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--weered-muted)", padding: "0 8px 2px" }}>{senderName}</div>
                )}
                {m.replyToId && !isDeleted && (
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        const el = document.querySelector(`[data-msg-id="${m.replyToId}"]`) as HTMLElement | null;
                        if (el) {
                          el.scrollIntoView({ behavior: "smooth", block: "center" });
                          const prevBg = el.style.background;
                          el.style.transition = "background 0.2s";
                          el.style.background = "rgba(124,58,237,0.10)";
                          setTimeout(() => { el.style.background = prevBg; }, 900);
                        }
                      } catch {}
                    }}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "2px 8px 2px 6px",
                      marginBottom: 3,
                      fontSize: 10,
                      background: "transparent", border: "none",
                      borderLeft: "2px solid var(--weered-accent-ring)",
                      color: "var(--weered-muted)",
                      cursor: "pointer", fontFamily: "inherit",
                      maxWidth: "100%", overflow: "hidden",
                    }}
                  >
                    <span style={{ color: "var(--weered-accent-text)", fontWeight: 700 }}>↩ {m.replyToUserName || "?"}</span>
                    <span style={{ opacity: 0.75, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.replyToBody || ""}</span>
                  </button>
                )}
                {isDeleted ? (
                  <div style={{ padding: "7px 13px", borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px", background: "rgba(255,255,255,.03)", border: "1px dashed var(--weered-bd)", fontSize: 12, fontStyle: "italic", color: "var(--weered-muted)" }}>[message deleted]</div>
                ) : isEditing ? (
                  <div style={{ width: "100%", minWidth: 220 }}>
                    <textarea
                      autoFocus
                      value={editDraft}
                      onChange={e => setEditDraft(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void commitEdit(); }
                        if (e.key === "Escape") { e.preventDefault(); setEditingId(""); setEditDraft(""); }
                      }}
                      style={{ width: "100%", minHeight: 56, padding: "7px 11px", borderRadius: 12, border: "1px solid var(--weered-bd2)", background: "var(--weered-panel2)", color: "var(--weered-text)", fontFamily: "inherit", fontSize: 13, outline: "none", resize: "vertical" }}
                    />
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 4, fontSize: 10, color: "var(--weered-muted)" }}>
                      <button type="button" onClick={() => { setEditingId(""); setEditDraft(""); }} style={{ padding: "3px 8px", fontSize: 10, fontWeight: 700, background: "transparent", border: "1px solid var(--weered-bd)", borderRadius: 6, color: "var(--weered-muted)", cursor: "pointer" }}>Cancel</button>
                      <button type="button" onClick={() => void commitEdit()} style={{ padding: "3px 10px", fontSize: 10, fontWeight: 800, background: "var(--weered-accent-bg)", border: "1px solid var(--weered-accent-ring)", borderRadius: 6, color: "var(--weered-accent-text)", cursor: "pointer" }}>Save</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: "9px 13px", borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px", background: isMe ? "var(--weered-accent-bg)" : "rgba(255,255,255,.07)", border: isMe ? "1px solid var(--weered-accent-ring)" : "1px solid var(--weered-bd)" }}>
                    <div style={{ fontSize: 13, lineHeight: "19px", color: "var(--weered-text)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.body}</div>
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2, padding: "0 4px" }}>
                  <span style={{ fontSize: 10, color: "var(--weered-muted)" }}>{fmtTime(m.createdAt)}</span>
                  {isEdited && <span style={{ fontSize: 9, color: "var(--weered-muted)" }}>(edited)</span>}
                </div>
                {isHovered && !isEditing && !isDeleted && (
                  <div style={{ position: "absolute", top: -6, [isMe ? "left" : "right" as any]: -4, display: "flex", gap: 2, padding: 3, borderRadius: 7, background: "var(--weered-panel2)", border: "1px solid var(--weered-bd)", boxShadow: "0 4px 12px rgba(0,0,0,.35)", zIndex: 2 }}>
                    <button
                      type="button"
                      title="Reply"
                      onClick={() => {
                        setReplyTo({ id: m.id, userName: senderName, body: m.body });
                        try { inputRef.current?.focus(); } catch {}
                      }}
                      style={{ width: 22, height: 22, borderRadius: 5, border: "none", background: "transparent", color: "var(--weered-muted)", cursor: "pointer", fontSize: 11 }}
                    >↩</button>
                    {editable && (
                      <button
                        type="button"
                        title="Edit"
                        onClick={() => { setEditingId(m.id); setEditDraft(m.body); }}
                        style={{ width: 22, height: 22, borderRadius: 5, border: "none", background: "transparent", color: "var(--weered-muted)", cursor: "pointer", fontSize: 11 }}
                      >✎</button>
                    )}
                    {deletable && (
                      <button
                        type="button"
                        title="Delete"
                        onClick={() => void deleteMsg(m.id)}
                        style={{ width: 22, height: 22, borderRadius: 5, border: "none", background: "transparent", color: "var(--weered-muted)", cursor: "pointer", fontSize: 11 }}
                      >🗑</button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        <div style={{ padding: "8px 12px 10px", borderTop: "1px solid var(--weered-bd)", flexShrink: 0 }}>
          {replyTo && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 10px", marginBottom: 6, borderRadius: 7, borderLeft: "2px solid var(--weered-accent-ring)", background: "var(--weered-accent-bg)", fontSize: 11 }}>
              <span style={{ color: "var(--weered-accent-text)", fontWeight: 700, flexShrink: 0 }}>↩ Replying to <strong>{replyTo.userName}</strong></span>
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--weered-muted)" }}>{replyTo.body}</span>
              <button type="button" onClick={() => setReplyTo(null)} title="Cancel reply" style={{ width: 18, height: 18, borderRadius: 4, border: "none", background: "transparent", color: "var(--weered-muted)", cursor: "pointer", fontSize: 12, flexShrink: 0 }}>×</button>
            </div>
          )}
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <input
              ref={inputRef}
              value={draft}
              onChange={e => setDraft((e.target as any).value || "")}
              onKeyDown={e => { if ((e as any).key === "Enter") { e.preventDefault(); void send(); } }}
              placeholder={`Message ${title.slice(0, 24)}...`}
              style={{ width: "100%", padding: "10px 42px 10px 16px", borderRadius: 22, border: "1px solid var(--weered-bd2)", background: "rgba(255,255,255,.05)", color: "var(--weered-text)", outline: "none", fontSize: 13, fontFamily: "inherit" }}
            />
            {draft.trim() && (
              <button onClick={() => void send()} style={{ position: "absolute", right: 6, width: 30, height: 30, borderRadius: 999, border: "none", background: "var(--weered-accent-bg)", color: "var(--weered-accent-text)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, height: "100%" }}>
      <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--weered-bd)", flexShrink: 0, display: "flex", gap: 8 }}>
        <button onClick={() => setView("create")} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 14px", borderRadius: 22, border: "1px solid var(--weered-accent-ring)", background: "var(--weered-accent-bg)", color: "var(--weered-accent-text)", cursor: "pointer", fontWeight: 700, fontSize: 12, fontFamily: "inherit" }}>
          <span style={{ fontSize: 14 }}>+</span> New group
        </button>
      </div>

      {loadingList && threads.length === 0 ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <LoadingState compact label="Loading" />
        </div>
      ) : threads.length === 0 ? (
        <EmptyState title="No groups yet." hint="Make a thread with a few friends." />
      ) : (
        <div style={{ flex: 1, overflowY: "auto" }}>
          {threads.map(t => {
            const title = threadDisplayName(t, meId);
            const last = t.lastMessage;
            const preview = last ? (last.deleted ? "[deleted]" : (last.body || "").slice(0, 60) + (last.body.length > 60 ? "..." : "")) : "No messages yet";
            const time = last ? fmtRel(last.createdAt) : fmtRel(t.createdAt);
            return (
              <button key={t.id} onClick={() => { setActiveId(t.id); setView("thread"); }} style={{ width: "100%", textAlign: "left", padding: "12px 14px", border: "none", borderBottom: "1px solid rgba(255,255,255,.04)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, fontFamily: "inherit" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.04)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <GroupAvatar members={t.members} meId={meId} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: "var(--weered-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
                    {time && <span style={{ fontSize: 10, color: "var(--weered-muted)", flexShrink: 0 }}>{time}</span>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 2 }}>
                    <span style={{ fontSize: 12, color: "var(--weered-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preview}</span>
                    {t.unread > 0 && (
                      <span style={{ minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999, background: "linear-gradient(135deg,#f59e0b,#ef4444)", color: "#fff", fontSize: 10, fontWeight: 900, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {t.unread > 99 ? "99+" : t.unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GroupAvatar({ members, meId }: { members: Member[]; meId: string }) {
  const others = members.filter(m => m.id !== meId).slice(0, 3);
  return (
    <div style={{ position: "relative", width: 42, height: 42, flexShrink: 0 }}>
      {others.map((m, i) => {
        const initial = (m.name || "?").charAt(0).toUpperCase();
        const offset = i * 10;
        return (
          <div key={m.id} style={{
            position: "absolute",
            left: offset,
            top: i * 4,
            width: 28, height: 28, borderRadius: "50%",
            background: m.avatar ? `url(${m.avatar}) center/cover` : "linear-gradient(135deg,#7c3aed,#5800e5)",
            border: "2px solid var(--weered-panel2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 800, color: "#fff",
          }}>{!m.avatar && initial}</div>
        );
      })}
      {others.length === 0 && (
        <div style={{ width: 42, height: 42, borderRadius: "50%", background: "rgba(124,58,237,.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>👥</div>
      )}
    </div>
  );
}

function CreateGroupView({ apiBase, token, onCancel, onCreated }: {
  apiBase: string;
  token: string;
  onCancel: () => void;
  onCreated: (t: Thread) => void;
}) {
  const [name, setName] = useState("");
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const auth = useMemo(() => token ? { Authorization: `Bearer ${token}` } : ({} as any), [token]);

  useEffect(() => {
    if (!apiBase || !token) return;
    fetch(`${apiBase}/friends`, { headers: auth })
      .then(r => r.json())
      .then(j => { if (Array.isArray(j?.friends)) setFriends(j.friends); })
      .catch(() => {});
  }, [apiBase, token, auth]);

  const togglePick = (id: string) => {
    setPicked(s => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const filtered = friends.filter(f => !search.trim() || f.name.toLowerCase().includes(search.toLowerCase()));

  const create = async () => {
    setErr("");
    if (picked.size === 0) { setErr("Pick at least one friend."); return; }
    setBusy(true);
    try {
      const r = await fetch(`${apiBase}/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify({ name: name.trim() || undefined, memberIds: Array.from(picked) }),
      });
      const j = await r.json();
      if (j?.ok && j.thread) {
        onCreated({
          id: j.thread.id,
          name: j.thread.name || null,
          createdById: j.thread.createdById,
          createdAt: j.thread.createdAt,
          lastMessageAt: j.thread.lastMessageAt,
          role: "OWNER",
          unread: 0,
          members: j.thread.members || [],
          lastMessage: null,
        });
      } else {
        setErr(j?.error || "Could not create group.");
      }
    } catch {
      setErr("Network error.");
    }
    setBusy(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, height: "100%" }}>
      <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--weered-bd)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <button onClick={onCancel} style={{ background: "none", border: "none", color: "var(--weered-muted)", cursor: "pointer", padding: "0 4px", display: "flex", alignItems: "center" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <div style={{ flex: 1, fontWeight: 700, fontSize: 14, color: "var(--weered-text)" }}>New group</div>
        <button
          disabled={busy || picked.size === 0}
          onClick={() => void create()}
          style={{ padding: "6px 14px", borderRadius: 16, border: "1px solid var(--weered-accent-ring)", background: busy || picked.size === 0 ? "rgba(255,255,255,.05)" : "var(--weered-accent-bg)", color: "var(--weered-accent-text)", cursor: busy || picked.size === 0 ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 800, fontFamily: "inherit", opacity: busy || picked.size === 0 ? 0.55 : 1 }}
        >
          Create
        </button>
      </div>

      <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--weered-bd)", flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        <input
          value={name}
          onChange={e => setName((e.target as any).value || "")}
          placeholder="Group name (optional)"
          maxLength={60}
          style={{ width: "100%", padding: "8px 12px", borderRadius: 10, border: "1px solid var(--weered-bd2)", background: "rgba(255,255,255,.05)", color: "var(--weered-text)", outline: "none", fontSize: 13, fontFamily: "inherit" }}
        />
        <input
          value={search}
          onChange={e => setSearch((e.target as any).value || "")}
          placeholder="Search friends..."
          style={{ width: "100%", padding: "7px 12px", borderRadius: 10, border: "1px solid var(--weered-bd2)", background: "rgba(255,255,255,.04)", color: "var(--weered-text)", outline: "none", fontSize: 12, fontFamily: "inherit" }}
        />
        {err && <div style={{ fontSize: 11, color: "rgba(239,68,68,.85)" }}>{err}</div>}
        <div style={{ fontSize: 11, color: "var(--weered-muted)" }}>{picked.size} selected</div>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {friends.length === 0 ? (
          <EmptyState title="No friends yet." hint="Add friends first to start a group." />
        ) : filtered.length === 0 ? (
          <EmptyState title="No matches." hint="Try a different search." />
        ) : filtered.map(f => {
          const on = picked.has(f.id);
          const initial = (f.name || "?").charAt(0).toUpperCase();
          return (
            <button
              key={f.id}
              onClick={() => togglePick(f.id)}
              style={{ width: "100%", textAlign: "left", padding: "10px 14px", border: "none", borderBottom: "1px solid rgba(255,255,255,.04)", background: on ? "rgba(124,58,237,.10)" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, fontFamily: "inherit" }}
            >
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: f.avatar ? `url(${f.avatar}) center/cover` : (f.avatarColor || "linear-gradient(135deg,#7c3aed,#5800e5)"), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
                {!f.avatar && initial}
              </div>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--weered-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
              <span style={{
                width: 18, height: 18, borderRadius: 5,
                border: `1.5px solid ${on ? "var(--weered-accent-ring)" : "var(--weered-bd2)"}`,
                background: on ? "var(--weered-accent-bg)" : "transparent",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                color: "var(--weered-accent-text)", fontSize: 12, fontWeight: 900,
              }}>{on ? "✓" : ""}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SettingsView({ apiBase, token, meId, thread, onClose, onLeft }: {
  apiBase: string;
  token: string;
  meId: string;
  thread: Thread;
  onClose: () => void;
  onLeft: () => void;
}) {
  const [name, setName] = useState(thread.name || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const auth = useMemo(() => token ? { Authorization: `Bearer ${token}` } : ({} as any), [token]);
  const isOwner = thread.role === "OWNER";

  const saveName = async () => {
    setErr("");
    setBusy(true);
    try {
      const r = await fetch(`${apiBase}/groups/${encodeURIComponent(thread.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify({ name: name.trim() }),
      });
      const j = await r.json();
      if (!j?.ok) setErr(j?.error || "Could not save.");
    } catch { setErr("Network error."); }
    setBusy(false);
  };

  const kick = async (uid: string) => {
    const target = thread.members.find(m => m.id === uid);
    const ok = await weeredConfirm({
      title: `Remove ${target?.name || "this member"}?`,
      body: "They lose access to the thread immediately.",
      confirmLabel: "Remove",
      destructive: true,
    });
    if (!ok) return;
    try {
      await fetch(`${apiBase}/groups/${encodeURIComponent(thread.id)}/members/${encodeURIComponent(uid)}`, {
        method: "DELETE",
        headers: auth,
      });
    } catch {}
  };

  const leave = async () => {
    const ok = await weeredConfirm({
      title: "Leave this group?",
      body: "You won't get any more messages. Someone can re-add you.",
      confirmLabel: "Leave",
      destructive: true,
    });
    if (!ok) return;
    try {
      await fetch(`${apiBase}/groups/${encodeURIComponent(thread.id)}/members/${encodeURIComponent(meId)}`, {
        method: "DELETE",
        headers: auth,
      });
      onLeft();
    } catch {}
  };

  if (adding) {
    return (
      <AddMembersView
        apiBase={apiBase}
        token={token}
        thread={thread}
        onCancel={() => setAdding(false)}
        onAdded={() => setAdding(false)}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, height: "100%" }}>
      <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--weered-bd)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--weered-muted)", cursor: "pointer", padding: "0 4px", display: "flex", alignItems: "center" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <div style={{ flex: 1, fontWeight: 700, fontSize: 14, color: "var(--weered-text)" }}>Group settings</div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--weered-muted)", marginBottom: 6 }}>Name</div>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              value={name}
              onChange={e => setName((e.target as any).value || "")}
              maxLength={60}
              disabled={!isOwner}
              placeholder="Optional name"
              style={{ flex: 1, padding: "8px 12px", borderRadius: 10, border: "1px solid var(--weered-bd2)", background: "rgba(255,255,255,.05)", color: "var(--weered-text)", outline: "none", fontSize: 13, fontFamily: "inherit", opacity: isOwner ? 1 : 0.55 }}
            />
            {isOwner && (
              <button
                onClick={() => void saveName()}
                disabled={busy || name.trim() === (thread.name || "")}
                style={{ padding: "0 14px", borderRadius: 10, border: "1px solid var(--weered-accent-ring)", background: "var(--weered-accent-bg)", color: "var(--weered-accent-text)", cursor: busy ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 800, fontFamily: "inherit", opacity: name.trim() === (thread.name || "") ? 0.55 : 1 }}
              >Save</button>
            )}
          </div>
          {err && <div style={{ fontSize: 11, color: "rgba(239,68,68,.85)", marginTop: 6 }}>{err}</div>}
        </div>

        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--weered-muted)" }}>Members ({thread.members.length})</span>
            {isOwner && (
              <button
                onClick={() => setAdding(true)}
                style={{ padding: "4px 10px", borderRadius: 12, border: "1px solid var(--weered-accent-ring)", background: "var(--weered-accent-bg)", color: "var(--weered-accent-text)", cursor: "pointer", fontSize: 10, fontWeight: 800, fontFamily: "inherit" }}
              >+ Add</button>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {thread.members.map(m => {
              const initial = (m.name || "?").charAt(0).toUpperCase();
              const isMe = m.id === meId;
              const isOwnerRow = m.id === thread.createdById;
              const canKick = isOwner && !isMe && !isOwnerRow;
              return (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, background: "rgba(255,255,255,.03)", border: "1px solid var(--weered-bd)" }}>
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: m.avatar ? `url(${m.avatar}) center/cover` : "linear-gradient(135deg,#7c3aed,#5800e5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#fff", flexShrink: 0 }}>{!m.avatar && initial}</div>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--weered-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}{isMe ? " (you)" : ""}</span>
                  {isOwnerRow && <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", padding: "2px 6px", borderRadius: 6, background: "rgba(245,158,11,.15)", color: "rgba(253,224,71,.95)", border: "1px solid rgba(245,158,11,.3)" }}>Owner</span>}
                  {canKick && (
                    <button
                      onClick={() => void kick(m.id)}
                      title="Remove"
                      style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid var(--weered-bd)", background: "transparent", color: "rgba(239,68,68,.6)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}
                    >×</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: "auto" }}>
          <button
            onClick={() => void leave()}
            style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(239,68,68,.4)", background: "rgba(239,68,68,.10)", color: "rgba(252,165,165,.95)", cursor: "pointer", fontSize: 12, fontWeight: 800, fontFamily: "inherit" }}
          >Leave group</button>
        </div>
      </div>
    </div>
  );
}

function AddMembersView({ apiBase, token, thread, onCancel, onAdded }: {
  apiBase: string;
  token: string;
  thread: Thread;
  onCancel: () => void;
  onAdded: () => void;
}) {
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const auth = useMemo(() => token ? { Authorization: `Bearer ${token}` } : ({} as any), [token]);
  const memberIds = useMemo(() => new Set(thread.members.map(m => m.id)), [thread.members]);

  useEffect(() => {
    if (!apiBase || !token) return;
    fetch(`${apiBase}/friends`, { headers: auth })
      .then(r => r.json())
      .then(j => {
        if (Array.isArray(j?.friends)) {
          setFriends(j.friends.filter((f: FriendRow) => !memberIds.has(f.id)));
        }
      })
      .catch(() => {});
  }, [apiBase, token, auth, memberIds]);

  const togglePick = (id: string) => {
    setPicked(s => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const filtered = friends.filter(f => !search.trim() || f.name.toLowerCase().includes(search.toLowerCase()));

  const add = async () => {
    setErr("");
    if (picked.size === 0) return;
    setBusy(true);
    try {
      const r = await fetch(`${apiBase}/groups/${encodeURIComponent(thread.id)}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify({ memberIds: Array.from(picked) }),
      });
      const j = await r.json();
      if (j?.ok) onAdded();
      else setErr(j?.error || "Could not add.");
    } catch { setErr("Network error."); }
    setBusy(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, height: "100%" }}>
      <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--weered-bd)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <button onClick={onCancel} style={{ background: "none", border: "none", color: "var(--weered-muted)", cursor: "pointer", padding: "0 4px", display: "flex", alignItems: "center" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <div style={{ flex: 1, fontWeight: 700, fontSize: 14, color: "var(--weered-text)" }}>Add members</div>
        <button
          disabled={busy || picked.size === 0}
          onClick={() => void add()}
          style={{ padding: "6px 14px", borderRadius: 16, border: "1px solid var(--weered-accent-ring)", background: busy || picked.size === 0 ? "rgba(255,255,255,.05)" : "var(--weered-accent-bg)", color: "var(--weered-accent-text)", cursor: busy || picked.size === 0 ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 800, fontFamily: "inherit", opacity: busy || picked.size === 0 ? 0.55 : 1 }}
        >Add</button>
      </div>

      <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--weered-bd)", flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        <input
          value={search}
          onChange={e => setSearch((e.target as any).value || "")}
          placeholder="Search friends..."
          style={{ width: "100%", padding: "7px 12px", borderRadius: 10, border: "1px solid var(--weered-bd2)", background: "rgba(255,255,255,.04)", color: "var(--weered-text)", outline: "none", fontSize: 12, fontFamily: "inherit" }}
        />
        {err && <div style={{ fontSize: 11, color: "rgba(239,68,68,.85)" }}>{err}</div>}
        <div style={{ fontSize: 11, color: "var(--weered-muted)" }}>{picked.size} selected</div>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {friends.length === 0 ? (
          <EmptyState title="No one to add." hint="All your friends are already in this group." />
        ) : filtered.length === 0 ? (
          <EmptyState title="No matches." hint="Try a different search." />
        ) : filtered.map(f => {
          const on = picked.has(f.id);
          const initial = (f.name || "?").charAt(0).toUpperCase();
          return (
            <button
              key={f.id}
              onClick={() => togglePick(f.id)}
              style={{ width: "100%", textAlign: "left", padding: "10px 14px", border: "none", borderBottom: "1px solid rgba(255,255,255,.04)", background: on ? "rgba(124,58,237,.10)" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, fontFamily: "inherit" }}
            >
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: f.avatar ? `url(${f.avatar}) center/cover` : (f.avatarColor || "linear-gradient(135deg,#7c3aed,#5800e5)"), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
                {!f.avatar && initial}
              </div>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--weered-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
              <span style={{
                width: 18, height: 18, borderRadius: 5,
                border: `1.5px solid ${on ? "var(--weered-accent-ring)" : "var(--weered-bd2)"}`,
                background: on ? "var(--weered-accent-bg)" : "transparent",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                color: "var(--weered-accent-text)", fontSize: 12, fontWeight: 900,
              }}>{on ? "✓" : ""}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
