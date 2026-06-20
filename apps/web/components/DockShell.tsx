"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWeered } from "./WeeredProvider";
import EmptyState from "./EmptyState";
import LoadingState from "./LoadingState";
import GroupsTab from "./GroupsTab";
import {
  linkify,
  __id,
  WEERED_THEME_KEY,
  type WeeredThemeName,
  applyWeeredTheme,
  pickFirstString,
  normRole,
  decodeJwtClaims,
  fmtTime,
  fmtRelative,
  Avatar,
  StatusDot,
  GroupAvatarStack,
  UnreadBadge,
  SegmentedControl,
} from "./dock/shellHelpers";
import { FriendsTab } from "./dock/FriendsTab";
import { CrewTab } from "./dock/CrewTab";
import { DmComposer } from "./dock/DmComposer";
import { DmMessage } from "./dock/DmMessage";
import type { DmMsg, DmThread } from "./dock/types";

type GroupMemberLite = { id: string; name: string; avatar?: string | null };
type GroupThreadLite = {
  id: string;
  name: string | null;
  createdById: string;
  role: "OWNER" | "MEMBER";
  unread: number;
  lastMessageAt: string;
  members: GroupMemberLite[];
  lastMessage: {
    id: string;
    senderId: string;
    body: string;
    createdAt: string;
    deleted?: boolean;
  } | null;
};

export default function DockShell(props: { forceMode?: "rail" | "floating" } = {}) {
  const ctx: any = (useWeered?.() as any) || {};
  const {
    me,
    wsReady,
    wsState,
    activeRoomId,
    joinedRoomId,
    users,
    msgs,
    meta,
    admin,
    role,
    joinStatus,
    sendChat,
    logout: _logout,
    renameRoom,
    lockRoom,
    unlockRoom,
    knock,
    admit: _admit,
  } = ctx || {};

  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<"room" | "dms" | "friends" | "crew">("dms");
  const [text, setText] = useState("");
  const [dockMode, setDockMode] = useState<"rail" | "floating">(props.forceMode || "floating");
  const [theme, setTheme] = useState<WeeredThemeName>("press");
  const [themeHydrated, setThemeHydrated] = useState(false);

  useEffect(() => {
    try {
      const v = String(localStorage.getItem(WEERED_THEME_KEY) || "").trim();
      if (["slate", "zinc", "stone", "gray", "ishimura", "broadcast", "press"].includes(v))
        setTheme(v as WeeredThemeName);
    } catch {}
    setThemeHydrated(true);
  }, []);

  useEffect(() => {
    if (!themeHydrated) return;
    try {
      localStorage.setItem(WEERED_THEME_KEY, theme);
    } catch {}
    applyWeeredTheme(theme);
  }, [theme, themeHydrated]);

  useEffect(() => {
    if (props.forceMode) {
      setDockMode(props.forceMode);
      if (props.forceMode === "rail") setOpen(true);
      return;
    }
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width:1100px)");
    const apply = () => {
      const m = mq.matches ? "rail" : "floating";
      setDockMode(m);
      if (m === "rail") setOpen(true);
    };
    apply();
    try {
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    } catch {
      mq.addListener(apply);
      return () => mq.removeListener(apply);
    }
  }, [props.forceMode]);

  const viewId = String(activeRoomId || "");
  const joinedId = String(joinedRoomId || "");
  const needJoin = !!viewId && viewId !== joinedId;
  const wsUp = useMemo(
    () =>
      !!wsReady ||
      wsState === 1 ||
      (typeof wsState === "string" && wsState.toLowerCase() === "open"),
    [wsReady, wsState],
  );

  const tokenMaybe = useMemo(() => {
    if (typeof window === "undefined") return "";
    return (
      pickFirstString(ctx?.token, ctx?.authToken, ctx?.jwt, me?.token, me?.jwt) ||
      pickFirstString(
        localStorage.getItem("weered_token"),
        localStorage.getItem("token"),
        localStorage.getItem("auth_token"),
      )
    );
  }, [ctx, me]);

  const claims = useMemo(() => decodeJwtClaims(tokenMaybe), [tokenMaybe]);
  const globalRole = useMemo(
    () =>
      normRole(pickFirstString(me?.globalRole, me?.global_role, claims?.globalRole, claims?.gr)),
    [me, claims],
  );
  const meName = pickFirstString(me?.name, me?.username, "Guest");
  const roomTitle = pickFirstString(meta?.name, viewId, "");
  const roomRole = normRole(pickFirstString(role, joinStatus?.role));
  const apiBase = pickFirstString(ctx?.apiBase, ctx?.api, "") || "";

  const [dmThreads, setDmThreads] = useState<DmThread[]>([]);
  const [dmActivePeerId, setDmActivePeerId] = useState("");
  const [dmPeer, setDmPeer] = useState("");
  const [dmDraft, setDmDraft] = useState("");
  const [dmLoading, setDmLoading] = useState(false);
  const [dmEditingMsgId, setDmEditingMsgId] = useState("");
  const [dmEditDraft, setDmEditDraft] = useState("");
  const [dmHoveredMsgId, setDmHoveredMsgId] = useState("");
  const [dmPickerMsgId, setDmPickerMsgId] = useState("");
  const [dmReplyingTo, setDmReplyingTo] = useState<{
    id: string;
    userName: string;
    body: string;
  } | null>(null);
  const DM_QUICK_REACTIONS = ["👍", "❤️", "😂", "🔥", "🎉", "😢", "😮", "🙌"];

  const [groupThreads, setGroupThreads] = useState<GroupThreadLite[]>([]);
  const [dmActiveGroupId, setDmActiveGroupId] = useState("");
  const [groupCompose, setGroupCompose] = useState(false);

  const reloadGroups = useCallback(() => {
    if (!apiBase || !tokenMaybe) return;
    fetch(`${apiBase}/groups`, { headers: { Authorization: `Bearer ${tokenMaybe}` } })
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok && Array.isArray(j.threads)) setGroupThreads(j.threads);
      })
      .catch(() => {});
  }, [apiBase, tokenMaybe]);

  useEffect(() => {
    reloadGroups();
  }, [reloadGroups]);
  useEffect(() => {
    const onMsg = (e: Event) => {
      const m = (e as CustomEvent).detail?.message;
      if (!m?.threadId) {
        reloadGroups();
        return;
      }
      setGroupThreads((cur) =>
        cur
          .map((t) => {
            if (t.id !== m.threadId) return t;
            const mine = m.senderId === String(me?.id || "");
            const isOpen = dmActiveGroupId === t.id;
            return {
              ...t,
              lastMessage: { id: m.id, senderId: m.senderId, body: m.body, createdAt: m.createdAt },
              lastMessageAt: m.createdAt,
              unread: isOpen || mine ? t.unread : (t.unread || 0) + 1,
            };
          })
          .sort((a, b) => (b.lastMessageAt > a.lastMessageAt ? 1 : -1)),
      );
    };
    const onStruct = () => reloadGroups();
    window.addEventListener("weered:group:message", onMsg);
    window.addEventListener("weered:group:created", onStruct);
    window.addEventListener("weered:group:renamed", onStruct);
    window.addEventListener("weered:group:members:added", onStruct);
    window.addEventListener("weered:group:members:removed", onStruct);
    return () => {
      window.removeEventListener("weered:group:message", onMsg);
      window.removeEventListener("weered:group:created", onStruct);
      window.removeEventListener("weered:group:renamed", onStruct);
      window.removeEventListener("weered:group:members:added", onStruct);
      window.removeEventListener("weered:group:members:removed", onStruct);
    };
  }, [reloadGroups, me, dmActiveGroupId]);

  useEffect(() => {
    if (!dmActiveGroupId) return;
    setGroupThreads((cur) => cur.map((t) => (t.id === dmActiveGroupId ? { ...t, unread: 0 } : t)));
  }, [dmActiveGroupId]);

  useEffect(() => {
    if (dmActivePeerId) {
      setDmActiveGroupId("");
      setGroupCompose(false);
    }
  }, [dmActivePeerId]);

  useEffect(() => {
    if (!dmPickerMsgId) return;
    function onClick(e: MouseEvent) {
      const t = e.target as HTMLElement | null;
      if (t && t.closest?.("[data-reaction-ui]")) return;
      setDmPickerMsgId("");
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [dmPickerMsgId]);
  const dmEndRef = useRef<HTMLDivElement | null>(null);
  const dmInputRef = useRef<HTMLInputElement | null>(null);
  const roomInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!tokenMaybe || !apiBase) return;
    fetch(`${apiBase}/dm/conversations`, { headers: { Authorization: `Bearer ${tokenMaybe}` } })
      .then((r) => r.json())
      .then((j) => {
        if (!Array.isArray(j?.conversations)) return;
        setDmThreads((cur) => {
          const byId = new Map(cur.map((t: DmThread) => [t.peerId, t]));
          const merged: DmThread[] = [];
          for (const t of cur) {
            const c = j.conversations.find((x: any) => (x.id || x.peerId) === t.peerId);
            if (c)
              merged.push({
                ...t,
                peerName: c.name || c.usernameKey || t.peerName,
                peerAvatar: c.avatar ?? t.peerAvatar ?? null,
                peerAvatarColor: c.avatarColor ?? t.peerAvatarColor ?? null,
                peerOnline: !!c.online,
                unread: c.unread ?? t.unread,
              });
            else merged.push(t);
          }
          for (const c of j.conversations) {
            const id = c.id || c.peerId;
            if (byId.has(id)) continue;
            merged.push({
              peerId: id,
              peerName: c.name || c.usernameKey || id,
              peerAvatar: c.avatar ?? null,
              peerAvatarColor: c.avatarColor ?? null,
              peerOnline: !!c.online,
              msgs: [],
              unread: c.unread || 0,
            });
          }
          return merged;
        });
      })
      .catch(() => {});
  }, [tokenMaybe, apiBase]);

  useEffect(() => {
    if (!tokenMaybe || !apiBase) return;
    function pollUnread() {
      fetch(`${apiBase}/dm/unread`, { headers: { Authorization: `Bearer ${tokenMaybe}` } })
        .then((r) => r.json())
        .then((j) => {
          if (!j?.counts) return;
          const newPeerIds = Object.keys(j.counts).filter(
            (pid) => !dmThreads.find((t) => t.peerId === pid),
          );
          if (newPeerIds.length) {
            fetch(`${apiBase}/dm/conversations`, {
              headers: { Authorization: `Bearer ${tokenMaybe}` },
            })
              .then((r) => r.json())
              .then((conv) => {
                if (!Array.isArray(conv?.conversations)) return;
                setDmThreads((cur) => {
                  const existing = new Set(cur.map((t: DmThread) => t.peerId));
                  const incoming = conv.conversations
                    .filter((c: any) => !existing.has(c.id || c.peerId))
                    .map((c: any) => ({
                      peerId: c.id || c.peerId,
                      peerName: c.name || c.usernameKey || c.id,
                      peerAvatar: c.avatar ?? null,
                      peerAvatarColor: c.avatarColor ?? null,
                      peerOnline: !!c.online,
                      msgs: [],
                      unread: c.unread || 0,
                    }));
                  return [...cur, ...incoming];
                });
              })
              .catch(() => {});
          }
          setDmThreads((cur) => cur.map((t) => ({ ...t, unread: j.counts[t.peerId] ?? 0 })));
        })
        .catch(() => {});
    }
    pollUnread();
    const t = setInterval(pollUnread, 60000);
    return () => clearInterval(t);
  }, [tokenMaybe, apiBase]);

  useEffect(() => {
    if (!dmActivePeerId || !tokenMaybe || !apiBase) return;
    setDmLoading(true);
    fetch(`${apiBase}/dm/${dmActivePeerId}`, { headers: { Authorization: `Bearer ${tokenMaybe}` } })
      .then((r) => r.json())
      .then((j) => {
        if (!Array.isArray(j?.messages)) return;
        setDmThreads((cur) =>
          cur.map((t) => (t.peerId === dmActivePeerId ? { ...t, msgs: j.messages, unread: 0 } : t)),
        );
      })
      .catch(() => {})
      .finally(() => setDmLoading(false));
  }, [dmActivePeerId, tokenMaybe, apiBase]);

  useEffect(() => {
    const handler = (ev: any) => {
      const msg: DmMsg = ev?.detail?.message;
      if (!msg) return;
      const meId = String(me?.id || "");
      const peerId = msg.fromId === meId ? msg.toId : msg.fromId;
      setDmThreads((cur) => {
        const existing = cur.find((t) => t.peerId === peerId);
        if (existing)
          return cur.map((t) =>
            t.peerId === peerId
              ? {
                  ...t,
                  msgs: [...t.msgs, msg],
                  unread: dmActivePeerId === peerId ? 0 : t.unread + 1,
                }
              : t,
          );
        fetch(`${apiBase}/profile/${encodeURIComponent(peerId)}`, {
          headers: tokenMaybe ? { Authorization: `Bearer ${tokenMaybe}` } : {},
        })
          .then((r) => r.json())
          .then((j) => {
            if (j?.name)
              setDmThreads((ts) =>
                ts.map((t) => (t.peerId === peerId ? { ...t, peerName: j.name } : t)),
              );
          })
          .catch(() => {});
        return [
          { peerId, peerName: peerId, msgs: [msg], unread: dmActivePeerId === peerId ? 0 : 1 },
          ...cur,
        ];
      });
    };
    window.addEventListener("weered:dm:message", handler as any);

    const editHandler = (ev: any) => {
      const d = ev?.detail;
      if (!d) return;
      const msgId = String(d.msgId || "");
      const newBody = String(d.body || "");
      const editedAt = d.editedAt;
      if (!msgId) return;
      const meId = String(me?.id || "");
      const peerId = d.fromId === meId ? d.toId : d.fromId;
      setDmThreads((cur) =>
        cur.map((t) =>
          t.peerId === peerId
            ? {
                ...t,
                msgs: t.msgs.map((m) =>
                  m.id === msgId ? ({ ...m, body: newBody, editedAt } as any) : m,
                ),
              }
            : t,
        ),
      );
    };
    const delHandler = (ev: any) => {
      const d = ev?.detail;
      if (!d) return;
      const msgId = String(d.msgId || "");
      const deletedAt = d.deletedAt;
      if (!msgId) return;
      const meId = String(me?.id || "");
      const peerId = d.fromId === meId ? d.toId : d.fromId;
      setDmThreads((cur) =>
        cur.map((t) =>
          t.peerId === peerId
            ? {
                ...t,
                msgs: t.msgs.map((m) =>
                  m.id === msgId ? ({ ...m, body: "", deletedAt } as any) : m,
                ),
              }
            : t,
        ),
      );
    };
    const rxHandler = (ev: any) => {
      const d = ev?.detail;
      if (!d) return;
      const msgId = String(d.msgId || "");
      const reactions = Array.isArray(d.reactions) ? d.reactions : [];
      if (!msgId) return;
      const meId = String(me?.id || "");
      const peerId = d.fromId === meId ? d.toId : d.fromId;
      setDmThreads((cur) =>
        cur.map((t) =>
          t.peerId === peerId
            ? { ...t, msgs: t.msgs.map((m) => (m.id === msgId ? ({ ...m, reactions } as any) : m)) }
            : t,
        ),
      );
    };

    window.addEventListener("weered:dm:edited", editHandler as any);
    window.addEventListener("weered:dm:deleted", delHandler as any);
    window.addEventListener("weered:dm:reaction", rxHandler as any);

    return () => {
      window.removeEventListener("weered:dm:message", handler as any);
      window.removeEventListener("weered:dm:edited", editHandler as any);
      window.removeEventListener("weered:dm:deleted", delHandler as any);
      window.removeEventListener("weered:dm:reaction", rxHandler as any);
    };
  }, [me, dmActivePeerId, apiBase, tokenMaybe]);

  useEffect(() => {
    try {
      dmEndRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch {}
  }, [dmActivePeerId, dmThreads]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const h = () =>
      setTimeout(() => {
        try {
          if (tab === "dms") dmInputRef.current?.focus();
          else roomInputRef.current?.focus();
        } catch {}
      }, 0);
    window.addEventListener("weered:dock:opened", h);
    return () => window.removeEventListener("weered:dock:opened", h);
  }, [tab, dmActivePeerId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const h = (ev: any) => {
      const d = ev?.detail;
      if (!d) return;
      if (typeof d.tab === "string") {
        const t = String(d.tab).toLowerCase();
        if (t === "room" || t === "dms" || t === "friends" || t === "crew") {
          setTab(t);
          setOpen(true);
          return;
        }
      }
      if (d.mode !== "dm") return;
      const peerName = pickFirstString(d?.peer?.name, d?.peerName, d?.peer, "");
      const peerId = pickFirstString(d?.peer?.id, d?.peerId, "");
      if (!peerName && !peerId) return;
      setTab("dms");
      setOpen(true);
      setDmThreads((cur) => {
        const ex = cur.find(
          (t) => t.peerId === peerId || t.peerName.toLowerCase() === peerName.toLowerCase(),
        );
        if (ex) {
          setDmActivePeerId(ex.peerId);
          return cur;
        }
        setDmActivePeerId(peerId);
        return [{ peerId, peerName, msgs: [], unread: 0 }, ...cur];
      });
    };
    window.addEventListener("weered:dock:open", h as any);
    return () => window.removeEventListener("weered:dock:open", h as any);
  }, []);

  const dmActive = useMemo(
    () => dmThreads.find((t) => t.peerId === dmActivePeerId) || null,
    [dmThreads, dmActivePeerId],
  );
  const groupUnread = useMemo(
    () => groupThreads.reduce((s, t) => s + (t.unread || 0), 0),
    [groupThreads],
  );
  const totalUnread = useMemo(
    () => dmThreads.reduce((s, t) => s + t.unread, 0) + groupUnread,
    [dmThreads, groupUnread],
  );

  useEffect(() => {
    try {
      localStorage.setItem("weered:dock:unread", String(totalUnread));
    } catch {}
    try {
      window.dispatchEvent(
        new CustomEvent("weered:dock:unread", { detail: { count: totalUnread } }),
      );
    } catch {}
  }, [totalUnread]);

  function call(fn: any, ...args: any[]) {
    try {
      if (typeof fn === "function") return fn(...args);
    } catch {}
  }
  function sendRoomChat(body: string) {
    const b = body.trim();
    if (!b) return;
    try {
      if (typeof sendChat === "function") {
        sendChat(b);
        return;
      }
    } catch {}
    try {
      sendChat(viewId || joinedId, b);
    } catch {}
  }

  async function dmCreateThread() {
    const peer = dmPeer.trim();
    if (!peer) return;
    const existing = dmThreads.find(
      (t) => t.peerName.toLowerCase() === peer.toLowerCase() || t.peerId === peer,
    );
    if (existing) {
      setDmActivePeerId(existing.peerId);
      setDmPeer("");
      return;
    }
    setDmPeer("");
    try {
      const r = await fetch(`${apiBase}/profile/${encodeURIComponent(peer)}`, {
        headers: tokenMaybe ? { Authorization: `Bearer ${tokenMaybe}` } : {},
      });
      const j = await r.json();
      const resolvedId = j?.id || peer;
      const resolvedName = j?.name || peer;
      setDmThreads((cur) => {
        const dup = cur.find((t) => t.peerId === resolvedId);
        if (dup) {
          setDmActivePeerId(resolvedId);
          return cur;
        }
        return [{ peerId: resolvedId, peerName: resolvedName, msgs: [], unread: 0 }, ...cur];
      });
      setDmActivePeerId(resolvedId);
    } catch {
      setDmThreads((cur) => [{ peerId: peer, peerName: peer, msgs: [], unread: 0 }, ...cur]);
      setDmActivePeerId(peer);
    }
  }

  async function dmSend() {
    if (!dmActive || !dmDraft.trim() || !tokenMaybe || !apiBase) return;
    const body = dmDraft.trim();
    const replyToId = dmReplyingTo?.id;
    setDmDraft("");
    setDmReplyingTo(null);
    const meId = String(me?.id || "");
    const optimistic: DmMsg = {
      id: __id(),
      fromId: meId,
      toId: dmActive.peerId,
      body,
      createdAt: new Date().toISOString(),
      readAt: null,
    };
    if (replyToId && dmReplyingTo) {
      (optimistic as any).replyToId = replyToId;
      (optimistic as any).replyToUserName = dmReplyingTo.userName;
      (optimistic as any).replyToBody = dmReplyingTo.body.slice(0, 120);
    }
    setDmThreads((cur) =>
      cur.map((t) => (t.peerId === dmActive.peerId ? { ...t, msgs: [...t.msgs, optimistic] } : t)),
    );
    try {
      if (typeof ctx?.sendRaw === "function")
        ctx.sendRaw({
          type: "dm:send",
          toId: dmActive.peerId,
          body,
          ...(replyToId ? { replyToId } : {}),
        });
      else
        await fetch(`${apiBase}/dm/${dmActive.peerId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenMaybe}` },
          body: JSON.stringify({ body, replyToId }),
        });
    } catch {}
  }

  const embedded = !!props.forceMode;
  const panel: React.CSSProperties = embedded
    ? {
        position: "relative",
        width: "100%",
        height: "100%",
        background: "transparent",
        border: "none",
        borderRadius: 0,
        overflow: "hidden",
        zIndex: 1,
        color: "var(--weered-text)",
        fontFamily: "ui-sans-serif,system-ui,-apple-system,sans-serif",
      }
    : dockMode === "rail"
      ? {
          position: "sticky",
          top: 16,
          width: "100%",
          height: "calc(100vh - 32px)",
          background: "var(--weered-panel2)",
          border: "1px solid var(--weered-bd2)",
          borderRadius: 16,
          boxShadow: "0 8px 40px rgba(0,0,0,.4)",
          backdropFilter: "blur(12px)",
          overflow: "hidden",
          zIndex: 40,
          color: "var(--weered-text)",
          fontFamily: "ui-sans-serif,system-ui,-apple-system,sans-serif",
          maxHeight: "calc(100vh - 32px)",
        }
      : {
          position: "fixed",
          right: 14,
          top: 88,
          width: 320,
          maxWidth: "92vw",
          height: "calc(100vh - 110px)",
          background: "var(--weered-panel2)",
          border: "1px solid var(--weered-bd2)",
          borderRadius: 16,
          boxShadow: "0 8px 40px rgba(0,0,0,.4)",
          backdropFilter: "blur(12px)",
          overflow: "hidden",
          zIndex: 9999,
          color: "var(--weered-text)",
          fontFamily: "ui-sans-serif,system-ui,-apple-system,sans-serif",
          maxHeight: "calc(100vh - 24px)",
        };

  if (!open)
    return props.forceMode ? null : (
      <button
        onClick={() => setOpen(true)}
        style={{
          position: "fixed",
          right: 14,
          top: 88,
          zIndex: 9999,
          padding: "8px 16px",
          borderRadius: 999,
          border: "1px solid var(--weered-bd2)",
          background: "var(--weered-panel2)",
          color: "var(--weered-text)",
          fontWeight: 700,
          cursor: "pointer",
          fontSize: 13,
          backdropFilter: "blur(12px)",
        }}
      >
        Chat
      </button>
    );

  const userArr: any[] = Array.isArray(users) ? users : [];
  const msgArr: any[] = Array.isArray(msgs) ? msgs : [];

  const inputStyle: React.CSSProperties = {
    flex: 1,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid var(--weered-bd2)",
    background: "rgba(255,255,255,.05)",
    color: "var(--weered-text)",
    outline: "none",
    fontSize: 13,
  };

  const sendBtn: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid var(--weered-accent-ring)",
    background: "var(--weered-accent-bg)",
    color: "var(--weered-accent-text)",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
  };

  return (
    <div className="weered-dock" style={{ ...panel, display: "flex", flexDirection: "column" }}>
      <div
        className="weered-dock-header"
        style={{
          padding: "10px 14px 0",
          borderBottom: "1px solid var(--weered-bd)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <img
            src="/brand/logo/weered-logo-32.png"
            alt="Weered"
            style={{ width: 22, height: 22, borderRadius: 5 }}
          />
          <span
            className="weered-dock-title"
            style={{
              fontWeight: 800,
              fontSize: 15,
              letterSpacing: ".02em",
              color: "var(--weered-text)",
            }}
          >
            Burner
          </span>
          <StatusDot online={wsUp} />
          <span style={{ flex: 1 }} />
          <button
            className="weered-dock-close"
            onClick={() => {
              try {
                window.dispatchEvent(new CustomEvent("weered:dock:close"));
              } catch {}
            }}
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,.08)",
              background: "rgba(255,255,255,.04)",
              color: "var(--weered-muted)",
              cursor: "pointer",
              fontSize: 15,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all .15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.1)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.04)";
            }}
          >
            ×
          </button>
        </div>

        <SegmentedControl
          tabs={[
            { id: "dms", label: "Messages", badge: totalUnread, tone: "red" },
            { id: "friends", label: "Friends" },
            { id: "crew", label: "Crew" },
          ]}
          active={tab}
          onChange={(id) => setTab(id as any)}
        />
      </div>

      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        {tab === "room" ? (
          <div style={{ display: "flex", flexDirection: "column", flex: 1, height: "100%" }}>
            {needJoin && (
              <div
                style={{
                  margin: "12px 14px 0",
                  padding: "10px 12px",
                  borderRadius: 12,
                  background: "var(--weered-accent-bg)",
                  border: "1px solid var(--weered-accent-ring)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 12, color: "var(--weered-accent-text)", fontWeight: 600 }}>
                  Not joined yet
                </span>
                {typeof knock === "function" && (
                  <button
                    onClick={() => call(knock, viewId)}
                    style={{
                      padding: "5px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--weered-accent-ring)",
                      background: "transparent",
                      color: "var(--weered-accent-text)",
                      fontSize: 12,
                      cursor: "pointer",
                      fontWeight: 700,
                    }}
                  >
                    Knock
                  </button>
                )}
              </div>
            )}

            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "12px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {msgArr.length ? (
                msgArr.slice(-80).map((m: any, i: number) => {
                  const who = pickFirstString(m?.user?.name, m?.name, m?.from, "?");
                  const body = pickFirstString(m?.body, m?.text, "");
                  const isMe = !!me?.id && (m?.user?.id === me?.id || m?.fromId === me?.id);
                  return (
                    <div
                      key={m?.id || i}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: isMe ? "flex-end" : "flex-start",
                      }}
                    >
                      {!isMe && (
                        <span
                          style={{
                            fontSize: 11,
                            color: "var(--weered-muted)",
                            marginBottom: 2,
                            paddingLeft: 4,
                          }}
                        >
                          {who}
                        </span>
                      )}
                      <div
                        style={{
                          maxWidth: "82%",
                          padding: "8px 12px",
                          borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                          background: isMe ? "var(--weered-accent-bg)" : "rgba(255,255,255,.07)",
                          border: isMe
                            ? "1px solid var(--weered-accent-ring)"
                            : "1px solid var(--weered-bd)",
                        }}
                      >
                        <div
                          style={{ fontSize: 13, lineHeight: "18px", color: "var(--weered-text)" }}
                        >
                          {linkify(body)}
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: 10,
                          color: "var(--weered-muted)",
                          marginTop: 2,
                          paddingLeft: 4,
                          paddingRight: 4,
                        }}
                      >
                        {fmtTime(m?.createdAt || new Date().toISOString())}
                      </span>
                    </div>
                  );
                })
              ) : (
                <EmptyState title="Quiet in here." hint="Be the one who breaks the silence." />
              )}
            </div>

            <div
              style={{
                padding: "10px 12px",
                borderTop: "1px solid var(--weered-bd)",
                display: "flex",
                gap: 8,
                flexShrink: 0,
              }}
            >
              <input
                ref={roomInputRef}
                value={text}
                onChange={(e) => setText((e.target as any).value || "")}
                placeholder="Message..."
                style={inputStyle}
                onKeyDown={(e) => {
                  if ((e as any).key === "Enter") {
                    sendRoomChat(text);
                    setText("");
                  }
                }}
              />
              <button
                style={sendBtn}
                onClick={() => {
                  sendRoomChat(text);
                  setText("");
                }}
              >
                ↑
              </button>
            </div>

            {userArr.length > 0 && (
              <div
                style={{
                  borderTop: "1px solid var(--weered-bd)",
                  padding: "10px 14px",
                  maxHeight: 160,
                  overflowY: "auto",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--weered-muted)",
                    marginBottom: 8,
                    textTransform: "uppercase" as const,
                    letterSpacing: 0.5,
                  }}
                >
                  In this room · {userArr.length}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {userArr.map((u: any) => {
                    const uname = pickFirstString(u?.name, u?.username, "?");
                    const ugr = normRole(pickFirstString(u?.globalRole, u?.global_role));
                    const isMe = !!me?.id && u?.id === me?.id;
                    return (
                      <div
                        key={u?.id || uname}
                        style={{ display: "flex", alignItems: "center", gap: 8 }}
                      >
                        <Avatar name={uname} size={26} isMe={isMe} chosenColor={u?.avatarColor} />
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: isMe ? "var(--weered-accent-text)" : "var(--weered-text)",
                          }}
                        >
                          {uname}
                          {isMe ? " (you)" : ""}
                        </span>
                        {ugr && (
                          <span
                            style={{
                              fontSize: 10,
                              color: "var(--weered-muted)",
                              marginLeft: "auto",
                            }}
                          >
                            {ugr}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {(admin || roomRole === "OWNER" || roomRole === "MOD") && (
              <div
                style={{
                  borderTop: "1px solid var(--weered-bd)",
                  padding: "10px 14px",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--weered-muted)",
                    marginBottom: 8,
                    textTransform: "uppercase" as const,
                    letterSpacing: 0.5,
                  }}
                >
                  Moderation
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
                  {typeof lockRoom === "function" && (
                    <button
                      style={{
                        padding: "6px 12px",
                        borderRadius: 8,
                        border: "1px solid var(--weered-bd)",
                        background: "transparent",
                        color: "var(--weered-text)",
                        fontSize: 12,
                        cursor: "pointer",
                        fontWeight: 600,
                      }}
                      onClick={() => call(lockRoom, viewId)}
                    >
                      Lock
                    </button>
                  )}
                  {typeof unlockRoom === "function" && (
                    <button
                      style={{
                        padding: "6px 12px",
                        borderRadius: 8,
                        border: "1px solid var(--weered-bd)",
                        background: "transparent",
                        color: "var(--weered-text)",
                        fontSize: 12,
                        cursor: "pointer",
                        fontWeight: 600,
                      }}
                      onClick={() => call(unlockRoom, viewId)}
                    >
                      Unlock
                    </button>
                  )}
                  {typeof renameRoom === "function" && (
                    <button
                      style={{
                        padding: "6px 12px",
                        borderRadius: 8,
                        border: "1px solid var(--weered-bd)",
                        background: "transparent",
                        color: "var(--weered-text)",
                        fontSize: 12,
                        cursor: "pointer",
                        fontWeight: 600,
                      }}
                      onClick={() => {
                        const n = prompt("New name?");
                        if (n) call(renameRoom, viewId, n);
                      }}
                    >
                      Rename
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : tab === "dms" ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              height: "100%",
              position: "relative",
            }}
          >
            {dmActiveGroupId || groupCompose ? (
              <GroupsTab
                apiBase={apiBase}
                token={tokenMaybe || ""}
                meId={String(me?.id || "")}
                initialThreadId={dmActiveGroupId || undefined}
                initialCreate={groupCompose && !dmActiveGroupId}
                onExitToInbox={() => {
                  setDmActiveGroupId("");
                  setGroupCompose(false);
                  reloadGroups();
                }}
              />
            ) : dmActive ? (
              <>
                <div
                  className="weered-dock-conv-header"
                  style={{
                    padding: "8px 12px",
                    borderBottom: "1px solid var(--weered-bd)",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flexShrink: 0,
                    background: "rgba(255,255,255,.02)",
                  }}
                >
                  <button
                    onClick={() => setDmActivePeerId("")}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--weered-muted)",
                      cursor: "pointer",
                      fontSize: 20,
                      padding: "0 4px",
                      lineHeight: 1,
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </button>
                  <div style={{ position: "relative" }}>
                    <Avatar
                      name={dmActive.peerName}
                      size={30}
                      src={dmActive.peerAvatar}
                      chosenColor={dmActive.peerAvatarColor || undefined}
                    />
                    {dmActive.peerOnline && (
                      <span
                        style={{
                          position: "absolute",
                          bottom: -1,
                          right: -1,
                          width: 9,
                          height: 9,
                          borderRadius: 999,
                          background: "#22c55e",
                          border: "2px solid var(--weered-panel2)",
                        }}
                      />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: "var(--weered-text)" }}>
                      {dmActive.peerName}
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    flex: 1,
                    overflowY: "auto",
                    padding: "10px 14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 3,
                  }}
                >
                  {dmLoading ? (
                    <div
                      style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <LoadingState compact label="Tuning in" />
                    </div>
                  ) : dmActive.msgs.length ? (
                    dmActive.msgs.map((m, i, arr) => (
                      <DmMessage
                        key={m.id ?? i}
                        m={m}
                        i={i}
                        arr={arr}
                        me={me}
                        ctx={ctx}
                        dmActive={dmActive}
                        dmInputRef={dmInputRef}
                        dmEditingMsgId={dmEditingMsgId}
                        setDmEditingMsgId={setDmEditingMsgId}
                        dmEditDraft={dmEditDraft}
                        setDmEditDraft={setDmEditDraft}
                        dmHoveredMsgId={dmHoveredMsgId}
                        setDmHoveredMsgId={setDmHoveredMsgId}
                        dmPickerMsgId={dmPickerMsgId}
                        setDmPickerMsgId={setDmPickerMsgId}
                        setDmReplyingTo={setDmReplyingTo}
                        DM_QUICK_REACTIONS={DM_QUICK_REACTIONS}
                      />
                    ))
                  ) : (
                    <div
                      style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                      }}
                    >
                      <Avatar
                        name={dmActive.peerName}
                        size={56}
                        src={dmActive.peerAvatar}
                        chosenColor={dmActive.peerAvatarColor || undefined}
                      />
                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--weered-text)" }}>
                        {dmActive.peerName}
                      </span>
                      <span style={{ color: "var(--weered-muted)", fontSize: 12 }}>
                        Start the conversation
                      </span>
                    </div>
                  )}
                  <div ref={dmEndRef} />
                </div>

                <DmComposer
                  dmReplyingTo={dmReplyingTo}
                  setDmReplyingTo={setDmReplyingTo}
                  dmInputRef={dmInputRef}
                  dmDraft={dmDraft}
                  setDmDraft={setDmDraft}
                  dmSend={dmSend}
                />
              </>
            ) : (
              <>
                <div
                  style={{
                    padding: "10px 12px",
                    borderBottom: "1px solid var(--weered-bd)",
                    flexShrink: 0,
                  }}
                >
                  <div style={{ display: "flex", gap: 6 }}>
                    <div
                      style={{
                        flex: 1,
                        position: "relative",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        style={{
                          position: "absolute",
                          left: 10,
                          opacity: 0.4,
                          pointerEvents: "none",
                        }}
                      >
                        <circle cx="11" cy="11" r="7" />
                        <path d="M21 21l-4.35-4.35" />
                      </svg>
                      <input
                        value={dmPeer}
                        onChange={(e) => setDmPeer((e.target as any).value || "")}
                        placeholder="Search or start new chat..."
                        style={{ ...inputStyle, paddingLeft: 32, borderRadius: 22, fontSize: 12 }}
                        onKeyDown={(e) => {
                          if ((e as any).key === "Enter") void dmCreateThread();
                        }}
                      />
                    </div>
                    <button
                      className="weered-dock-compose"
                      title="New direct message"
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 999,
                        border: "1px solid var(--weered-accent-ring)",
                        background: "var(--weered-accent-bg)",
                        color: "var(--weered-accent-text)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        fontSize: 18,
                        fontWeight: 700,
                      }}
                      onClick={() => void dmCreateThread()}
                    >
                      +
                    </button>
                    <button
                      title="New group"
                      onClick={() => {
                        setGroupCompose(true);
                        setDmActiveGroupId("");
                        setDmActivePeerId("");
                      }}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 999,
                        border: "1px solid var(--weered-bd2)",
                        background: "rgba(255,255,255,.05)",
                        color: "var(--weered-text)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <svg
                        width="17"
                        height="17"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 00-3-3.87" />
                        <path d="M16 3.13a4 4 0 010 7.75" />
                      </svg>
                    </button>
                  </div>
                </div>

                {(() => {
                  const q = dmPeer.trim().toLowerCase();
                  const dmItems = dmThreads
                    .filter((t) => !q || t.peerName.toLowerCase().includes(q))
                    .map((t) => {
                      const lastMsg = t.msgs.length ? t.msgs[t.msgs.length - 1] : null;
                      return {
                        kind: "dm" as const,
                        id: t.peerId,
                        ts: lastMsg ? new Date(lastMsg.createdAt).getTime() : 0,
                        dm: t,
                        lastMsg,
                      };
                    });
                  const groupItems = groupThreads
                    .filter((t) => {
                      if (!q) return true;
                      const nm = (t.name || t.members.map((m) => m.name).join(", ")).toLowerCase();
                      return nm.includes(q);
                    })
                    .map((t) => ({
                      kind: "group" as const,
                      id: t.id,
                      ts: t.lastMessageAt ? new Date(t.lastMessageAt).getTime() : 0,
                      group: t,
                    }));
                  const merged = [...dmItems, ...groupItems].sort((a, b) => b.ts - a.ts);

                  if (merged.length === 0) {
                    return (
                      <EmptyState
                        icon={
                          <img
                            src="/brand/logo/weered-logo-64.png"
                            alt=""
                            style={{ width: 44, height: 44, opacity: 0.35, borderRadius: 10 }}
                          />
                        }
                        title="Nobody on the line."
                        hint="Search a username up top, or start a group."
                      />
                    );
                  }

                  return (
                    <div style={{ flex: 1, overflowY: "auto" }}>
                      {merged.map((item) => {
                        if (item.kind === "dm") {
                          const t = item.dm;
                          const lastMsg = item.lastMsg;
                          const isMyLastMsg = lastMsg && lastMsg.fromId === String(me?.id || "");
                          const preview = lastMsg
                            ? (isMyLastMsg ? "You: " : "") +
                              lastMsg.body.slice(0, 40) +
                              (lastMsg.body.length > 40 ? "..." : "")
                            : "Tap to start chatting";
                          const time = lastMsg ? fmtRelative(lastMsg.createdAt) : "";
                          return (
                            <button
                              key={`dm-${t.peerId}`}
                              className="weered-dock-thread"
                              onClick={() => setDmActivePeerId(t.peerId)}
                              style={{
                                width: "100%",
                                textAlign: "left",
                                padding: "12px 14px",
                                border: "none",
                                borderBottom: "1px solid rgba(255,255,255,.04)",
                                background: "transparent",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 12,
                                transition: "background .1s",
                              }}
                              onMouseEnter={(e) => {
                                (e.currentTarget as HTMLElement).style.background =
                                  "rgba(255,255,255,.04)";
                              }}
                              onMouseLeave={(e) => {
                                (e.currentTarget as HTMLElement).style.background = "transparent";
                              }}
                            >
                              <div style={{ position: "relative", flexShrink: 0 }}>
                                <Avatar
                                  name={t.peerName}
                                  size={42}
                                  src={t.peerAvatar}
                                  chosenColor={t.peerAvatarColor || undefined}
                                />
                                {t.peerOnline && (
                                  <span
                                    style={{
                                      position: "absolute",
                                      bottom: 0,
                                      right: 0,
                                      width: 10,
                                      height: 10,
                                      borderRadius: 999,
                                      background: "#22c55e",
                                      border: "2px solid var(--weered-panel2)",
                                    }}
                                  />
                                )}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 8,
                                  }}
                                >
                                  <span
                                    style={{
                                      fontWeight: 600,
                                      fontSize: 13,
                                      color: "var(--weered-text)",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {t.peerName}
                                  </span>
                                  {time && (
                                    <span
                                      style={{
                                        fontSize: 10,
                                        color: "var(--weered-muted)",
                                        flexShrink: 0,
                                      }}
                                    >
                                      {time}
                                    </span>
                                  )}
                                </div>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 8,
                                    marginTop: 2,
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: 12,
                                      color: "var(--weered-muted)",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {preview}
                                  </span>
                                  {t.unread > 0 && <UnreadBadge count={t.unread} />}
                                </div>
                              </div>
                            </button>
                          );
                        }
                        const g = item.group;
                        const others = g.members.filter((m) => m.id !== String(me?.id || ""));
                        const memberCount = g.members.length;
                        const roster = others
                          .map((m) => (m.name || "").split(/\s+/)[0])
                          .filter(Boolean);
                        const rosterLine = roster.length
                          ? roster.slice(0, 3).join(", ") +
                            (roster.length > 3 ? ` +${roster.length - 3}` : "")
                          : "Just you";
                        const title =
                          g.name ||
                          (others.length
                            ? others
                                .slice(0, 3)
                                .map((m) => m.name)
                                .join(", ")
                            : "Group");
                        const last = g.lastMessage;
                        const senderFirst = last
                          ? (others.find((m) => m.id === last.senderId)?.name || "").split(/\s+/)[0]
                          : "";
                        const preview = last
                          ? last.deleted
                            ? "[deleted]"
                            : `${last.senderId === String(me?.id || "") ? "You: " : senderFirst ? `${senderFirst}: ` : ""}${last.body.slice(0, 40)}${last.body.length > 40 ? "..." : ""}`
                          : rosterLine;
                        const time = g.lastMessageAt ? fmtRelative(g.lastMessageAt) : "";
                        return (
                          <button
                            key={`group-${g.id}`}
                            className="weered-dock-thread"
                            onClick={() => {
                              setDmActiveGroupId(g.id);
                              setGroupCompose(false);
                              setDmActivePeerId("");
                            }}
                            style={{
                              width: "100%",
                              textAlign: "left",
                              padding: "12px 14px",
                              border: "none",
                              borderBottom: "1px solid rgba(255,255,255,.04)",
                              background: "transparent",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 12,
                              transition: "background .1s",
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLElement).style.background =
                                "rgba(255,255,255,.04)";
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLElement).style.background = "transparent";
                            }}
                          >
                            <GroupAvatarStack members={others.length ? others : g.members} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span
                                  style={{
                                    fontWeight: 600,
                                    fontSize: 13,
                                    color: "var(--weered-text)",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    minWidth: 0,
                                  }}
                                >
                                  {title}
                                </span>
                                <span
                                  title={`${memberCount} members`}
                                  style={{
                                    flexShrink: 0,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 3,
                                    padding: "1px 6px",
                                    borderRadius: 999,
                                    background: "var(--weered-accent-bg)",
                                    border: "1px solid var(--weered-accent-ring)",
                                    color: "var(--weered-accent-text)",
                                    fontSize: 9,
                                    fontWeight: 800,
                                    lineHeight: 1.4,
                                  }}
                                >
                                  <svg
                                    width="9"
                                    height="9"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                                    <circle cx="9" cy="7" r="4" />
                                    <path d="M23 21v-2a4 4 0 00-3-3.87" />
                                    <path d="M16 3.13a4 4 0 010 7.75" />
                                  </svg>
                                  {memberCount}
                                </span>
                                <span style={{ flex: 1 }} />
                                {time && (
                                  <span
                                    style={{
                                      fontSize: 10,
                                      color: "var(--weered-muted)",
                                      flexShrink: 0,
                                    }}
                                  >
                                    {time}
                                  </span>
                                )}
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  gap: 8,
                                  marginTop: 2,
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: 12,
                                    color: "var(--weered-muted)",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {preview}
                                </span>
                                {g.unread > 0 && <UnreadBadge count={g.unread} />}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        ) : tab === "friends" ? (
          <FriendsTab
            apiBase={apiBase}
            tokenMaybe={tokenMaybe}
            onMessage={(peerName, peerId) => {
              setTab("dms");
              setDmThreads((cur) => {
                const ex = cur.find(
                  (t) => t.peerId === peerId || t.peerName.toLowerCase() === peerName.toLowerCase(),
                );
                if (ex) {
                  setDmActivePeerId(ex.peerId);
                  return cur;
                }
                setDmActivePeerId(peerId);
                return [{ peerId, peerName, msgs: [], unread: 0 }, ...cur];
              });
            }}
            onJoin={(roomId) => {
              try {
                ctx?.join?.(roomId);
              } catch {}
            }}
            myRoomId={String(ctx?.joinedRoomId || "")}
          />
        ) : tab === "crew" ? (
          <CrewTab
            apiBase={apiBase}
            tokenMaybe={tokenMaybe}
            myId={String(me?.id || "")}
            myName={meName}
            onJoin={(roomId) => {
              try {
                ctx?.join?.(roomId);
              } catch {}
            }}
          />
        ) : null}
      </div>

      <div
        style={{
          flexShrink: 0,
          padding: "8px 14px",
          borderTop: "1px solid var(--weered-bd)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          fontSize: 11,
          color: "var(--weered-muted)",
        }}
      >
        <a
          href="/lobby"
          style={{
            color: "inherit",
            textDecoration: "none",
            opacity: 0.75,
            transition: "opacity .15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.opacity = "1";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.opacity = ".75";
          }}
        >
          Browse lobbies
        </a>
        <span style={{ opacity: 0.3 }}>·</span>
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setTab("friends");
          }}
          style={{
            color: "inherit",
            textDecoration: "none",
            opacity: 0.75,
            transition: "opacity .15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.opacity = "1";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.opacity = ".75";
          }}
        >
          Add friends
        </a>
        <span style={{ opacity: 0.3 }}>·</span>
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setTab("crew");
          }}
          style={{
            color: "inherit",
            textDecoration: "none",
            opacity: 0.75,
            transition: "opacity .15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.opacity = "1";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.opacity = ".75";
          }}
        >
          Crews
        </a>
        <span style={{ flex: 1 }} />
        <span
          style={{
            fontSize: 9,
            opacity: 0.4,
            fontWeight: 700,
            letterSpacing: ".08em",
            textTransform: "uppercase",
          }}
        >
          BURNER
        </span>
      </div>
    </div>
  );
}
