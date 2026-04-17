"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useWeered } from "./WeeredProvider";
import EmptyState from "./EmptyState";

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
  } catch { return ""; }
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
  DM_RECEIVED:        { icon: "\u2709", color: "rgba(96,165,250,.8)" },
  FRIEND_REQUEST:     { icon: "\u2795", color: "rgba(52,211,153,.8)" },
  FRIEND_ACCEPTED:    { icon: "\u2714", color: "rgba(52,211,153,.8)" },
  CREW_INVITE:        { icon: "\uD83D\uDC65", color: "rgba(249,115,22,.8)" },
  MENTION:            { icon: "@", color: "rgba(245,158,11,.8)" },
  CHALLENGE_STARTED:  { icon: "\u2694", color: "rgba(239,68,68,.8)" },
  CHALLENGE_COMPLETED:{ icon: "\uD83C\uDFC6", color: "rgba(250,204,21,.8)" },
  NOTORIETY_RANKUP:   { icon: "\u2B06", color: "rgba(168,85,247,.8)" },
  LOBBY_EVENT:        { icon: "\uD83C\uDFAE", color: "rgba(88,0,229,.8)" },
  SYSTEM:             { icon: "\u26A0", color: "rgba(148,163,184,.7)" },
};

export function NotificationBell() {
  const { me } = useWeered() as any;
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notif[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const bellRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [dropPos, setDropPos] = useState<{ top: number; left: number } | null>(null);

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

  // Poll unread count every 30s + on mount
  useEffect(() => {
    fetchUnreadCount();
    const iv = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(iv);
  }, [fetchUnreadCount]);

  // Listen for real-time notifications from WS
  useEffect(() => {
    const handler = (e: Event) => {
      const notif = (e as CustomEvent).detail as Notif;
      if (!notif?.id) return;
      setNotifications(prev => [notif, ...prev].slice(0, 50));
      setUnreadCount(c => c + 1);
    };
    window.addEventListener("weered:notification", handler);
    return () => window.removeEventListener("weered:notification", handler);
  }, []);

  // Fetch full list when panel opens
  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  // Close on outside click (check both bell and portal panel)
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (bellRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const markAllRead = async () => {
    const tok = getToken();
    if (!tok) return;
    try {
      await fetch(`${API_BASE}/notifications/read`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ all: true }),
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {}
  };

  const markOneRead = async (id: string) => {
    const tok = getToken();
    if (!tok) return;
    try {
      await fetch(`${API_BASE}/notifications/read`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ ids: [id] }),
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setUnreadCount(c => Math.max(0, c - 1));
    } catch {}
  };

  const deleteNotif = async (id: string) => {
    const tok = getToken();
    if (!tok) return;
    try {
      await fetch(`${API_BASE}/notifications/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${tok}` },
      });
      const removed = notifications.find(n => n.id === id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      if (removed && !removed.read) setUnreadCount(c => Math.max(0, c - 1));
    } catch {}
  };

  const handleClick = (notif: Notif) => {
    if (!notif.read) markOneRead(notif.id);
    if (notif.actionUrl) {
      window.location.href = notif.actionUrl;
      setOpen(false);
    }
  };

  // Compute dropdown position when opening
  const toggleOpen = useCallback(() => {
    setOpen(o => {
      if (!o && bellRef.current) {
        const rect = bellRef.current.getBoundingClientRect();
        setDropPos({ top: rect.bottom + 8, left: rect.left });
      }
      return !o;
    });
  }, []);

  return (
    <>
      {/* Bell button */}
      <button
        ref={bellRef}
        type="button"
        onClick={toggleOpen}
        title={unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications"}
        className={unreadCount > 0 ? "weered-bell-hot" : ""}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 30, height: 30, borderRadius: 8,
          background: open
            ? "rgba(88,0,229,.25)"
            : unreadCount > 0
              ? "rgba(245,158,11,.12)"
              : "transparent",
          border: open
            ? "1px solid rgba(88,0,229,.45)"
            : unreadCount > 0
              ? "1px solid rgba(245,158,11,.30)"
              : "1px solid rgba(255,255,255,.08)",
          cursor: "pointer",
          color: unreadCount > 0 ? "rgba(253,230,138,.9)" : "rgba(255,255,255,.4)",
          transition: "all 0.15s", position: "relative",
          flexShrink: 0,
        }}
        onMouseEnter={e => { const el = e.currentTarget; el.style.background = unreadCount > 0 ? "rgba(245,158,11,.20)" : "rgba(255,255,255,.10)"; el.style.color = unreadCount > 0 ? "rgba(253,230,138,1)" : "rgba(255,255,255,.7)"; }}
        onMouseLeave={e => { const el = e.currentTarget; el.style.background = open ? "rgba(88,0,229,.25)" : unreadCount > 0 ? "rgba(245,158,11,.12)" : "transparent"; el.style.color = unreadCount > 0 ? "rgba(253,230,138,.9)" : "rgba(255,255,255,.4)"; }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {/* Unread badge */}
        {unreadCount > 0 && (
          <span style={{
            position: "absolute", top: -4, right: -4,
            minWidth: 14, height: 14, borderRadius: 999,
            background: "#f59e0b",
            border: "2px solid rgba(10,10,15,.95)",
            fontSize: 8, fontWeight: 900, color: "#000",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: unreadCount > 9 ? "0 2px" : "0",
            lineHeight: 1,
            boxShadow: "0 0 6px rgba(245,158,11,.5)",
          }}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Bell glow animation */}
      {unreadCount > 0 && (
        <style>{`
          @keyframes weered-bell-pulse {
            0%, 100% { box-shadow: 0 0 4px rgba(245,158,11,.15); }
            50% { box-shadow: 0 0 12px rgba(245,158,11,.35); }
          }
          .weered-bell-hot { animation: weered-bell-pulse 2s ease-in-out infinite; }
        `}</style>
      )}

      {/* Dropdown panel — portaled to body to avoid overflow clipping */}
      {open && typeof document !== "undefined" && createPortal(
        <div ref={panelRef} style={{
          position: "fixed",
          top: dropPos?.top ?? 0,
          left: dropPos?.left ?? 0,
          width: 340, maxHeight: 440,
          background: "rgba(14,14,20,.97)",
          border: "1px solid rgba(88,0,229,.30)",
          borderRadius: 14,
          boxShadow: "0 12px 48px rgba(0,0,0,.6), 0 0 0 1px rgba(0,0,0,.3)",
          zIndex: 99999,
          display: "flex", flexDirection: "column",
          overflow: "hidden",
          backdropFilter: "blur(16px)",
        }}>
          {/* Header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 16px 10px",
            borderBottom: "1px solid rgba(255,255,255,.06)",
          }}>
            <span style={{ fontSize: 13, fontWeight: 900, color: "rgba(243,244,246,.95)", letterSpacing: "-.2px" }}>
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: 10, fontWeight: 700, color: "rgba(88,0,229,.8)",
                  padding: "4px 8px", borderRadius: 6,
                  transition: "all 0.15s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(88,0,229,.12)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "none"; }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
            {loading && notifications.length === 0 && (
              <div style={{ padding: 24, textAlign: "center", color: "rgba(255,255,255,.3)", fontSize: 12 }}>
                Loading...
              </div>
            )}
            {!loading && notifications.length === 0 && (
              <EmptyState title="All quiet." hint="You'll know when something moves." />
            )}
            {notifications.map(n => {
              const info = TYPE_ICONS[n.type] || TYPE_ICONS.SYSTEM;
              return (
                <div
                  key={n.id}
                  onClick={() => handleClick(n)}
                  style={{
                    display: "flex", gap: 10, padding: "10px 16px",
                    cursor: n.actionUrl ? "pointer" : "default",
                    background: n.read ? "transparent" : "rgba(88,0,229,.06)",
                    borderLeft: n.read ? "3px solid transparent" : "3px solid rgba(88,0,229,.5)",
                    transition: "background 0.12s",
                    position: "relative",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.04)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = n.read ? "transparent" : "rgba(88,0,229,.06)"; }}
                >
                  {/* Type icon */}
                  <div style={{
                    width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                    background: `${info.color}18`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, marginTop: 1,
                  }}>
                    <span style={{ color: info.color }}>{info.icon}</span>
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 12, fontWeight: n.read ? 600 : 800,
                      color: n.read ? "rgba(255,255,255,.55)" : "rgba(243,244,246,.92)",
                      lineHeight: 1.35,
                    }}>
                      {n.title}
                    </div>
                    {n.body && (
                      <div style={{
                        fontSize: 11, color: "rgba(255,255,255,.35)",
                        marginTop: 2, lineHeight: 1.3,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {n.body}
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,.22)", marginTop: 3 }}>
                      {timeAgo(n.createdAt)}
                    </div>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteNotif(n.id); }}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: "rgba(255,255,255,.15)", fontSize: 14, padding: "2px 4px",
                      borderRadius: 4, transition: "all 0.12s",
                      alignSelf: "flex-start", flexShrink: 0,
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "rgba(239,68,68,.6)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,.15)"; }}
                    title="Dismiss"
                  >
                    &times;
                  </button>
                </div>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
