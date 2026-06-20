"use client";

import { useEffect, useState, useCallback } from "react";
import EmptyState from "./EmptyState";
import LoadingState from "./LoadingState";
import { onActivate } from "@/lib/a11y";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE as string) || "http://127.0.0.1:4000";

interface Notif {
  id: string;
  type: string;
  title: string;
  body: string;
  actionUrl?: string;
  actorId?: string;
  actorName?: string;
  meta?: any;
  read: boolean;
  createdAt: string;
}

function getToken(): string {
  try {
    return localStorage.getItem("weered_token") || localStorage.getItem("token") || "";
  } catch {
    return "";
  }
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

const TYPE_ICONS: Record<string, { icon: string; color: string }> = {
  DM_RECEIVED: { icon: "✉", color: "rgba(96,165,250,.8)" },
  FRIEND_REQUEST: { icon: "➕", color: "rgba(52,211,153,.8)" },
  FRIEND_ACCEPTED: { icon: "✔", color: "rgba(52,211,153,.8)" },
  CREW_INVITE: { icon: "👥", color: "rgba(249,115,22,.8)" },
  ROOM_INVITE: { icon: "\u27A4", color: "rgba(34,197,94,.85)" },
  MENTION: { icon: "@", color: "rgba(245,158,11,.8)" },
  CHALLENGE_STARTED: { icon: "⚔", color: "rgba(239,68,68,.8)" },
  CHALLENGE_COMPLETED: { icon: "🏆", color: "rgba(250,204,21,.8)" },
  NOTORIETY_RANKUP: { icon: "⬆", color: "rgba(168,85,247,.8)" },
  LOBBY_EVENT: { icon: "🎮", color: "rgba(88,0,229,.8)" },
  SYSTEM: { icon: "⚠", color: "rgba(148,163,184,.7)" },
};

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notif[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchUnreadCount = useCallback(async () => {
    const tok = getToken();
    if (!tok) return;
    try {
      const r = await fetch(`${API_BASE}/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${tok}` },
      });
      const j = await r.json();
      if (typeof j.count === "number") setUnreadCount(j.count);
    } catch {}
  }, []);

  const fetchNotifications = useCallback(async () => {
    const tok = getToken();
    if (!tok) return;
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/notifications?limit=30`, {
        headers: { Authorization: `Bearer ${tok}` },
      });
      const j = await r.json();
      if (Array.isArray(j.notifications)) setNotifications(j.notifications);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    const iv = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(iv);
  }, [fetchUnreadCount]);

  useEffect(() => {
    const handler = (e: Event) => {
      const notif = (e as CustomEvent).detail as Notif;
      if (!notif?.id) return;
      setNotifications((prev) => [notif, ...prev].slice(0, 50));
      setUnreadCount((c) => c + 1);
    };
    window.addEventListener("weered:notification", handler);
    return () => window.removeEventListener("weered:notification", handler);
  }, []);

  const markAllRead = useCallback(async () => {
    const tok = getToken();
    if (!tok) return;
    try {
      await fetch(`${API_BASE}/notifications/read`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ all: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
      try {
        window.dispatchEvent(new CustomEvent("weered:notifications:cleared"));
      } catch {}
    } catch {}
  }, []);

  const markOneRead = useCallback(async (id: string) => {
    const tok = getToken();
    if (!tok) return;
    try {
      await fetch(`${API_BASE}/notifications/read`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ ids: [id] }),
      });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
      try {
        window.dispatchEvent(new CustomEvent("weered:notifications:decrement"));
      } catch {}
    } catch {}
  }, []);

  const deleteNotif = useCallback(async (id: string) => {
    const tok = getToken();
    if (!tok) return;
    try {
      await fetch(`${API_BASE}/notifications/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${tok}` },
      });
      let wasUnread = false;
      setNotifications((prev) => {
        const removed = prev.find((n) => n.id === id);
        if (removed && !removed.read) {
          wasUnread = true;
          setUnreadCount((c) => Math.max(0, c - 1));
        }
        return prev.filter((n) => n.id !== id);
      });
      if (wasUnread) {
        try {
          window.dispatchEvent(new CustomEvent("weered:notifications:decrement"));
        } catch {}
      }
    } catch {}
  }, []);

  return {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAllRead,
    markOneRead,
    deleteNotif,
  };
}

export function NotificationsView({ onBack }: { onBack: () => void }) {
  const {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAllRead,
    markOneRead,
    deleteNotif,
  } = useNotifications();

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const ACTIONABLE_TYPES = new Set([
    "DM_RECEIVED",
    "FRIEND_REQUEST",
    "FRIEND_ACCEPTED",
    "CREW_INVITE",
  ]);
  const isActionable = (n: Notif) =>
    ACTIONABLE_TYPES.has(n.type) ||
    (!!n.actionUrl && n.actionUrl !== "/home" && n.actionUrl !== "/");

  const handleClick = (notif: Notif) => {
    if (!notif.read) markOneRead(notif.id);

    const dispatch = (detail: any) => {
      try {
        window.dispatchEvent(new CustomEvent("weered:dock:open", { detail }));
      } catch {}
    };

    switch (notif.type) {
      case "DM_RECEIVED": {
        const peerId = notif.actorId || notif.meta?.fromId || "";
        const peerName = notif.actorName || "";
        if (peerId || peerName) dispatch({ mode: "dm", peer: { id: peerId, name: peerName } });
        else dispatch({ tab: "dms" });
        return;
      }
      case "FRIEND_REQUEST":
      case "FRIEND_ACCEPTED":
        dispatch({ tab: "friends" });
        return;
      case "CREW_INVITE": {
        const crewId = notif.meta?.crewId;
        if (notif.actionUrl && notif.actionUrl.startsWith("/crew/")) {
          try {
            window.location.href = notif.actionUrl;
          } catch {}
        } else if (crewId) {
          try {
            window.location.href = `/crew/${crewId}`;
          } catch {}
        } else {
          dispatch({ tab: "crew" });
        }
        return;
      }
      default:
        break;
    }

    if (notif.actionUrl && notif.actionUrl !== "/home" && notif.actionUrl !== "/") {
      try {
        window.location.href = notif.actionUrl;
      } catch {}
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        maxHeight: 440,
        minWidth: 320,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 12px",
          borderBottom: "1px solid rgba(255,255,255,.06)",
        }}
      >
        <button
          onClick={onBack}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "rgba(243,244,246,.7)",
            fontSize: 11,
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 6px",
            borderRadius: 6,
            fontFamily: "inherit",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.06)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "none";
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>
        <span
          style={{
            fontSize: 12,
            fontWeight: 900,
            color: "rgba(243,244,246,.95)",
            letterSpacing: "-.2px",
          }}
        >
          Notifications
        </span>
        {unreadCount > 0 ? (
          <button
            onClick={markAllRead}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 10,
              fontWeight: 700,
              color: "rgba(124,58,237,.85)",
              padding: "4px 6px",
              borderRadius: 6,
              fontFamily: "inherit",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "rgba(88,0,229,.12)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "none";
            }}
          >
            Mark all read
          </button>
        ) : (
          <span style={{ width: 60 }} />
        )}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
        {loading && notifications.length === 0 && <LoadingState compact label="Checking" />}
        {!loading && notifications.length === 0 && (
          <EmptyState title="All quiet." hint="You'll know when something moves." />
        )}
        {notifications.map((n) => {
          const info = TYPE_ICONS[n.type] || TYPE_ICONS.SYSTEM;
          return (
            <div
              key={n.id}
              onClick={() => handleClick(n)}
              onKeyDown={onActivate(() => handleClick(n))}
              tabIndex={0}
              role="button"
              style={{
                display: "flex",
                gap: 10,
                padding: "10px 14px",
                cursor: isActionable(n) ? "pointer" : "default",
                background: n.read ? "transparent" : "rgba(88,0,229,.06)",
                borderLeft: n.read ? "3px solid transparent" : "3px solid rgba(88,0,229,.5)",
                transition: "background 0.12s",
                position: "relative",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.04)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = n.read
                  ? "transparent"
                  : "rgba(88,0,229,.06)";
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  flexShrink: 0,
                  background: `${info.color}18`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  marginTop: 1,
                }}
              >
                <span style={{ color: info.color }}>{info.icon}</span>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: n.read ? 600 : 800,
                    color: n.read ? "rgba(255,255,255,.55)" : "rgba(243,244,246,.92)",
                    lineHeight: 1.35,
                  }}
                >
                  {n.title}
                </div>
                {n.body && (
                  <div
                    style={{
                      fontSize: 11,
                      color: "rgba(255,255,255,.35)",
                      marginTop: 2,
                      lineHeight: 1.3,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {n.body}
                  </div>
                )}
                <div style={{ fontSize: 10, color: "rgba(255,255,255,.22)", marginTop: 3 }}>
                  {timeAgo(n.createdAt)}
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteNotif(n.id);
                }}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "rgba(255,255,255,.15)",
                  fontSize: 14,
                  padding: "2px 4px",
                  borderRadius: 4,
                  transition: "all 0.12s",
                  alignSelf: "flex-start",
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.color = "rgba(239,68,68,.6)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,.15)";
                }}
                title="Dismiss"
              >
                &times;
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
