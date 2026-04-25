"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import EmptyState from "./EmptyState";
import LoadingState from "./LoadingState";

// ── helpers (mirrored from DockShell so this file is self-contained) ────────
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
  senderName?: string;
}
interface FriendRow { id: string; name: string; avatar?: string | null; avatarColor?: string | null; }

function threadDisplayName(t: Thread, meId: string): string {
  if (t.name) return t.name;
  const others = t.members.filter(m => m.id !== meId).map(m => m.name);
  if (others.length === 0) return "Group";
  if (others.length <= 3) return others.join(", ");
  return `${others.slice(0, 3).join(", ")} +${others.length - 3}`;
}

export default function GroupsTab({ apiBase, token, meId }: { apiBase: string; token: string; meId: string }) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loadingList, setLoadingList] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [creating, setCreating] = useState(false);
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
    if (activeId) void reloadMessages(activeId);
    else setMessages([]);
  }, [activeId, reloadMessages]);

  // Scroll-to-bottom when messages change in active thread
  useEffect(() => {
    if (activeId) try { endRef.current?.scrollIntoView({ block: "end" }); } catch {}
  }, [messages, activeId]);

  // WS: incoming new message
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
    window.addEventListener("weered:group:created", onCreated);
    window.addEventListener("weered:group:renamed", onRenamed);
    window.addEventListener("weered:group:members:added", onMembers);
    window.addEventListener("weered:group:members:removed", onMembers);
    return () => {
      window.removeEventListener("weered:group:message", onMsg);
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
    try {
      await fetch(`${apiBase}/groups/${encodeURIComponent(activeId)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify({ body }),
      });
    } catch {}
  };

  const active = threads.find(t => t.id === activeId) || null;

  if (creating) {
    return (
      <CreateGroupView
        apiBase={apiBase}
        token={token}
        onCancel={() => setCreating(false)}
        onCreated={(t) => {
          setCreating(false);
          setActiveId(t.id);
          setThreads(cur => cur.some(x => x.id === t.id) ? cur : [t, ...cur]);
        }}
      />
    );
  }

  if (active) {
    const title = threadDisplayName(active, meId);
    return (
      <div style={{ display: "flex", flexDirection: "column", flex: 1, height: "100%" }}>
        <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--weered-bd)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0, background: "rgba(255,255,255,.02)" }}>
          <button onClick={() => setActiveId("")} style={{ background: "none", border: "none", color: "var(--weered-muted)", cursor: "pointer", padding: "0 4px", display: "flex", alignItems: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--weered-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
            <div style={{ fontSize: 10, color: "var(--weered-muted)" }}>{active.members.length} members</div>
          </div>
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
            return (
              <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start", marginTop: sameSender ? 1 : 8, maxWidth: "82%", alignSelf: isMe ? "flex-end" : "flex-start" }}>
                {!isMe && !sameSender && (
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--weered-muted)", padding: "0 8px 2px" }}>{senderName}</div>
                )}
                <div style={{ padding: "9px 13px", borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px", background: isMe ? "var(--weered-accent-bg)" : "rgba(255,255,255,.07)", border: isMe ? "1px solid var(--weered-accent-ring)" : "1px solid var(--weered-bd)" }}>
                  <div style={{ fontSize: 13, lineHeight: "19px", color: "var(--weered-text)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.body}</div>
                </div>
                <div style={{ fontSize: 10, color: "var(--weered-muted)", marginTop: 2, padding: "0 4px" }}>{fmtTime(m.createdAt)}</div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        <div style={{ padding: "8px 12px 10px", borderTop: "1px solid var(--weered-bd)", flexShrink: 0 }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <input
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

  // List view
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, height: "100%" }}>
      <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--weered-bd)", flexShrink: 0, display: "flex", gap: 8 }}>
        <button onClick={() => setCreating(true)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 14px", borderRadius: 22, border: "1px solid var(--weered-accent-ring)", background: "var(--weered-accent-bg)", color: "var(--weered-accent-text)", cursor: "pointer", fontWeight: 700, fontSize: 12, fontFamily: "inherit" }}>
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
              <button key={t.id} onClick={() => setActiveId(t.id)} style={{ width: "100%", textAlign: "left", padding: "12px 14px", border: "none", borderBottom: "1px solid rgba(255,255,255,.04)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, fontFamily: "inherit" }}
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

// Stack of small circle avatars showing up to 3 non-self members.
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

// New-group flow — pick name + members from friends list.
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
