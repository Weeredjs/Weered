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
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [unread, setUnread] = useState(0);
  const openRef = useRef(false);

  const { msgs } = useWeered();

  // accent with fallback
  const ac = accentColor || "#7C3AED";
  const acDim = `${ac}33`;
  const acMid = `${ac}55`;

  // Keep ref in sync
  useEffect(() => { openRef.current = open; }, [open]);

  useEffect(() => { setMounted(true); }, []);

  // Track unread: increment when new messages arrive while closed
  const msgCountRef = useRef(msgs.length);
  useEffect(() => {
    const newCount = msgs.length;
    if (newCount > msgCountRef.current && !openRef.current) {
      setUnread(prev => prev + (newCount - msgCountRef.current));
    }
    msgCountRef.current = newCount;
  }, [msgs.length]);

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
          top: 0; right: 0; bottom: 0;
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
          style={{ right: open ? "min(340px, 90%)" : 0, position: "relative" }}
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
        <div className="lobby-chat-drawer">
          <div className="lobby-drawer-header">
            <span className="lobby-drawer-title">{title}</span>
            <div className="lobby-drawer-close" onClick={() => setOpen(false)}>✕</div>
          </div>
          <div style={{ flex: 1, minHeight: 0, position: "relative", zIndex: 1, paddingBottom: 12 }}>
            <LobbyChatPanel roomId={roomId} embedded={true} />
          </div>
        </div>
      )}
    </>
  );
}
