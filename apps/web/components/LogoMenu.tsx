"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useWeered } from "./WeeredProvider";
import { useOverlay } from "./overlays/OverlayProvider";
import { NotificationsView } from "./NotificationCenter";

type View = "menu" | "notifications";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE as string) || "http://127.0.0.1:4000";

function getToken(): string {
  try { return localStorage.getItem("weered_token") || localStorage.getItem("token") || ""; }
  catch { return ""; }
}

export function LogoMenu() {
  const { me, isAway, setAway, logout } = useWeered() as any;
  const { openSheet } = useOverlay() as any;
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("menu");
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchUnread = useCallback(async () => {
    const tok = getToken();
    if (!tok) return;
    try {
      const r = await fetch(`${API_BASE}/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${tok}` },
      });
      const j = await r.json();
      if (typeof j?.count === "number") setUnreadCount(j.count);
    } catch {}
  }, []);

  useEffect(() => {
    fetchUnread();
    const iv = setInterval(fetchUnread, 30000);
    return () => clearInterval(iv);
  }, [fetchUnread]);

  useEffect(() => {
    const onIncoming = () => setUnreadCount(c => c + 1);
    const onCleared = () => setUnreadCount(0);
    const onDecrement = () => setUnreadCount(c => Math.max(0, c - 1));
    window.addEventListener("weered:notification", onIncoming);
    window.addEventListener("weered:notifications:cleared", onCleared);
    window.addEventListener("weered:notifications:decrement", onDecrement);
    return () => {
      window.removeEventListener("weered:notification", onIncoming);
      window.removeEventListener("weered:notifications:cleared", onCleared);
      window.removeEventListener("weered:notifications:decrement", onDecrement);
    };
  }, []);

  const computePos = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const right = Math.max(8, window.innerWidth - rect.right);
    setPos({ top: rect.bottom + 8, right });
  }, []);

  const toggleOpen = useCallback(() => {
    setOpen(o => {
      if (!o) {
        computePos();
        setView("menu");
      }
      return !o;
    });
  }, [computePos]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => computePos();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [open, computePos]);

  const hot = unreadCount > 0;

  if (!me?.id) {
    return (
      <a href="/home" className="weered-rail-logo" title="Home" style={{ marginBottom: 0 }}>
        <img src="/brand/logo/weered-logo-128.png" alt="Weered" />
      </a>
    );
  }

  const close = () => setOpen(false);
  const goHome = () => { close(); try { window.location.assign("/home"); } catch {} };
  const openProfile = () => { close(); openSheet?.("profile", { userId: me.id }); };
  const openSettings = () => { close(); openSheet?.("settings"); };
  const toggleAway = () => { close(); if (typeof setAway === "function") setAway(!isAway); };
  const showNotifs = () => setView("notifications");
  const doLogout = () => {
    close();
    if (typeof logout === "function") logout();
    else { try { localStorage.removeItem("weered_token"); window.location.href = "/login"; } catch {} }
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        title="Menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggleOpen}
        className={`weered-rail-logo weered-logo-menu-btn${hot ? " is-hot" : ""}`}
        style={{ background: "transparent", border: "none", padding: 0, marginBottom: 0, cursor: "pointer" }}
      >
        <img src="/brand/logo/weered-logo-128.png" alt="Weered" />
        {hot && (
          <span className="weered-logo-menu-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
        )}
      </button>
      {open && pos && typeof document !== "undefined" && createPortal(
        <div
          ref={panelRef}
          className="weered-logo-menu-panel"
          role="menu"
          style={{ position: "fixed", top: pos.top, right: pos.right }}
        >
          {view === "menu" ? (
            <>
              <button type="button" role="menuitem" className="weered-logo-menu-item" onClick={goHome}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12l9-9 9 9" /><path d="M5 10v10h14V10" /></svg>
                <span className="weered-logo-menu-label">Home</span>
              </button>
              <button type="button" role="menuitem" className="weered-logo-menu-item" onClick={openProfile}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.5 3.5-7 8-7s8 2.5 8 7" /></svg>
                <span className="weered-logo-menu-label">View profile</span>
              </button>
              <button type="button" role="menuitem" className="weered-logo-menu-item" onClick={showNotifs}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 1112 0c0 7 3 7 3 9H3c0-2 3-2 3-9z" /><path d="M10 21a2 2 0 004 0" /></svg>
                <span className="weered-logo-menu-label">Notifications</span>
                {hot && <span className="weered-logo-menu-pill">{unreadCount > 99 ? "99+" : unreadCount}</span>}
              </button>
              <button type="button" role="menuitem" className="weered-logo-menu-item" onClick={toggleAway}>
                <span aria-hidden style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 14, height: 14, flexShrink: 0,
                }}>
                  <span style={{
                    width: 10, height: 10, borderRadius: "50%",
                    background: isAway ? "#facc15" : "#22c55e",
                    boxShadow: isAway ? "0 0 6px rgba(250,204,21,.7)" : "0 0 6px rgba(34,197,94,.8)",
                  }} />
                </span>
                <span className="weered-logo-menu-label">{isAway ? "Come back" : "Lying low"}</span>
                <span className="weered-logo-menu-status">{isAway ? "AFK" : "Online"}</span>
              </button>
              <button type="button" role="menuitem" className="weered-logo-menu-item" onClick={openSettings}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3h.1a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5h.1a1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8v.1a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></svg>
                <span className="weered-logo-menu-label">Settings</span>
              </button>
              <div className="weered-logo-menu-divider" />
              <button type="button" role="menuitem" className="weered-logo-menu-item is-danger" onClick={doLogout}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                <span className="weered-logo-menu-label">Log out</span>
              </button>
            </>
          ) : (
            <NotificationsView onBack={() => setView("menu")} />
          )}
        </div>,
        document.body
      )}
    </>
  );
}
