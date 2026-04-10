"use client";

import React, { useState, useEffect, useRef } from "react";
import { useWeered } from "./WeeredProvider";
import LobbyChatPanel from "./LobbyChatPanel";

interface Props {
  roomId: string;
  title?: string;
  accentColor?: string;
}

export default function LobbyChatDrawer({ roomId, title = "Lobby Chat", accentColor }: Props) {
  const [open, setOpen] = useState(() => typeof window !== "undefined" ? window.innerWidth > 767 : true);
  const [mounted, setMounted] = useState(false);
  const [unread, setUnread] = useState(0);
  const openRef = useRef(false);

  const ctx = useWeered() as any;

  // accent with fallback
  const ac = accentColor || "#7C3AED";
  const acDim = `${ac}33`;
  const acMid = `${ac}55`;

  // Resolve effective room ID from prop
  const effectiveRoomId = (() => {
    let rid = String(roomId || "").trim();
    if (rid.startsWith("room:")) rid = rid.slice(5);
    try { rid = decodeURIComponent(rid); } catch {}
    return rid;
  })();

  // Keep ref in sync
  useEffect(() => { openRef.current = open; }, [open]);

  useEffect(() => { setMounted(true); }, []);

  // Track unread via DOM event — works even when chat panel is unmounted
  useEffect(() => {
    function onChatNew(e: Event) {
      const detail = (e as CustomEvent)?.detail;
      if (!detail || String(detail.roomId || "") !== effectiveRoomId) return;
      // Don't count own messages
      const senderId = detail.msg?.user?.id;
      const myId = ctx?.me?.id;
      if (senderId && myId && senderId === myId) return;
      if (!openRef.current) {
        setUnread(prev => prev + 1);
      }
    }
    window.addEventListener("weered:chat:new", onChatNew);
    return () => window.removeEventListener("weered:chat:new", onChatNew);
  }, [effectiveRoomId, ctx?.me?.id]);

  // Clear unread when opening
  function handleOpen() {
    setOpen(true);
    setUnread(0);
  }

  function handleToggle() {
    if (open) {
      setOpen(false);
    } else {
      handleOpen();
    }
  }

  const hasUnread = unread > 0;

  return (
    <>
      <style>{`
        @keyframes drawerSlideIn {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes unreadGlow {
          0%, 100% { box-shadow: 0 0 8px 0 ${ac}44; }
          50%      { box-shadow: 0 0 20px 4px ${ac}66, 0 0 40px 8px ${ac}22; }
        }
        @keyframes unreadPulse {
          0%, 100% { transform: translateY(-50%) scale(1); }
          50%      { transform: translateY(-50%) scale(1.15); }
        }
        .lobby-chat-drawer {
          position: absolute;
          top: 0; right: 0; bottom: 4px;
          width: min(340px, 90%);
          display: flex; flex-direction: column;
          background: rgba(10, 10, 18, 0.82);
          backdrop-filter: blur(18px) saturate(1.4);
          -webkit-backdrop-filter: blur(18px) saturate(1.4);
          border-left: 1px solid ${acDim};
          border-radius: 0 14px 14px 0;
          z-index: 50; overflow: hidden;
          box-shadow: -8px 0 40px rgba(0,0,0,0.45), inset 1px 0 0 rgba(255,255,255,0.04);
          animation: drawerSlideIn 0.38s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        @media (max-width: 767px) {
          .lobby-chat-drawer {
            position: fixed !important;
            top: 0 !important; right: 0 !important; bottom: 56px !important; left: 0 !important;
            width: 100% !important;
            border-radius: 0 !important;
            background: rgba(10, 10, 18, 0.97) !important;
          }
        }
        .lobby-chat-tab {
          position: absolute;
          right: 0; top: 50%;
          transform: translateY(-50%);
          writing-mode: vertical-rl;
          text-orientation: mixed;
          padding: 14px 7px;
          background: ${ac}2e;
          border: 1px solid ${acMid};
          border-right: none;
          border-radius: 10px 0 0 10px;
          color: ${ac};
          font-size: 11px; font-weight: 700;
          letter-spacing: 0.12em;
          cursor: pointer; z-index: 49;
          transition: background 0.15s, right 0.38s cubic-bezier(0.22, 1, 0.36, 1);
          user-select: none;
          backdrop-filter: blur(8px);
        }
        @media (max-width: 767px) {
          .lobby-chat-tab {
            position: fixed !important;
            right: 0 !important;
            top: 40% !important;
            z-index: 100 !important;
          }
        }
        .lobby-chat-tab:hover {
          background: ${ac}44;
        }
        .lobby-chat-tab.has-unread {
          animation: unreadGlow 2s ease-in-out infinite;
          background: ${ac}3a;
          border-color: ${ac};
        }
        .lobby-chat-tab.open {
          animation: none;
          background: ${ac}3a;
        }
        .lobby-drawer-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 14px 10px;
          border-bottom: 1px solid ${acDim};
          flex-shrink: 0;
        }
        .lobby-drawer-title {
          font-size: 12px; font-weight: 800;
          color: ${ac};
          letter-spacing: 0.06em;
          text-transform: uppercase;
          opacity: 0.85;
        }
        .lobby-drawer-close {
          width: 24px; height: 24px;
          border-radius: 6px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
          color: rgba(148,163,184,0.6);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; font-size: 12px;
          transition: all 0.15s; flex-shrink: 0;
        }
        .lobby-drawer-close:hover {
          background: rgba(255,255,255,0.08);
          color: rgba(243,244,246,0.9);
          border-color: rgba(255,255,255,0.15);
        }
        .lobby-chat-drawer::before {
          content: '';
          position: absolute; inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
          pointer-events: none; z-index: 0; opacity: 0.4;
        }
      `}</style>

      {/* Tab trigger */}
      {mounted && (
        <div
          className={`lobby-chat-tab${open ? " open" : ""}${hasUnread && !open ? " has-unread" : ""}`}
          onClick={handleToggle}
          style={{ right: open ? "min(340px, 90%)" : 0 }}
        >
          CHAT
          {/* Unread badge */}
          {hasUnread && !open && (
            <div style={{
              position: "absolute", top: 8, left: "50%",
              transform: "translateX(-50%)",
              writingMode: "horizontal-tb",
              minWidth: 18, height: 18, borderRadius: 9,
              background: "#ef4444",
              border: "2px solid rgba(10,10,18,0.9)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 800, color: "#fff",
              lineHeight: 1, padding: "0 4px",
              animation: "unreadPulse 2s ease-in-out infinite",
            }}>
              {unread > 99 ? "99+" : unread}
            </div>
          )}
        </div>
      )}

      {/* Drawer panel */}
      {mounted && open && (
        <div
          className="lobby-chat-drawer"
          onTouchStart={e => { (e.currentTarget as any)._swipe = { x: e.touches[0].clientX, t: Date.now() }; }}
          onTouchMove={e => {
            const s = (e.currentTarget as any)._swipe; if (!s) return;
            const dx = e.touches[0].clientX - s.x;
            if (dx > 0) { (e.currentTarget as any)._swipeDx = dx; }
          }}
          onTouchEnd={e => {
            const dx = (e.currentTarget as any)._swipeDx || 0;
            const dt = Date.now() - ((e.currentTarget as any)._swipe?.t || Date.now());
            if (dx > 60 || (dx > 20 && dx / Math.max(1, dt) > 0.3)) setOpen(false);
            (e.currentTarget as any)._swipe = null;
            (e.currentTarget as any)._swipeDx = 0;
          }}
        >
          {/* Swipe hint watermark */}
          <div style={{
            position: "absolute", inset: 0, zIndex: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            pointerEvents: "none", opacity: 0.14,
            flexDirection: "column", gap: 6,
          }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: ac }}>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: ac }}>swipe to close</span>
          </div>
          <div className="lobby-drawer-header" style={{ position: "relative", zIndex: 1 }}>
            <span className="lobby-drawer-title">{title}</span>
            <div className="lobby-drawer-close" onClick={() => setOpen(false)}>✕</div>
          </div>
          <div style={{ flex: 1, minHeight: 0, position: "relative", zIndex: 1, paddingBottom: 32 }}>
            <LobbyChatPanel roomId={roomId} embedded={true} />
          </div>
        </div>
      )}
    </>
  );
}
