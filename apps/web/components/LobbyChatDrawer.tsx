"use client";

import React, { useState, useEffect, useRef } from "react";
import LobbyChatPanel from "./LobbyChatPanel";

interface Props {
  roomId: string;
  title?: string;
}

export default function LobbyChatDrawer({ roomId, title = "Lobby Chat" }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Open by default after mount (avoids SSR mismatch)
  useEffect(() => {
    setMounted(true);
    const timer = setTimeout(() => setOpen(true), 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <style>{`
        @keyframes drawerSlideIn {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes drawerSlideOut {
          from { transform: translateX(0);    opacity: 1; }
          to   { transform: translateX(100%); opacity: 0; }
        }
        @keyframes tabPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(124,58,237,0); }
          50%       { box-shadow: 0 0 12px 2px rgba(124,58,237,0.35); }
        }
        .chat-drawer {
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          width: min(340px, 90%);
          display: flex;
          flex-direction: column;
          background: rgba(10, 10, 18, 0.82);
          backdrop-filter: blur(18px) saturate(1.4);
          -webkit-backdrop-filter: blur(18px) saturate(1.4);
          border-left: 1px solid rgba(124,58,237,0.20);
          border-radius: 0 14px 14px 0;
          z-index: 50;
          overflow: hidden;
          box-shadow: -8px 0 40px rgba(0,0,0,0.45), inset 1px 0 0 rgba(255,255,255,0.04);
        }
        .chat-drawer.entering {
          animation: drawerSlideIn 0.38s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .chat-drawer.exiting {
          animation: drawerSlideOut 0.28s cubic-bezier(0.55, 0, 1, 0.45) forwards;
        }
        .chat-tab {
          position: absolute;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
          writing-mode: vertical-rl;
          text-orientation: mixed;
          rotate: 180deg;
          padding: 14px 7px;
          background: rgba(124,58,237,0.18);
          border: 1px solid rgba(124,58,237,0.30);
          border-right: none;
          border-radius: 10px 0 0 10px;
          color: rgba(167,139,250,0.90);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.12em;
          cursor: pointer;
          z-index: 49;
          transition: background 0.15s, color 0.15s;
          user-select: none;
          backdrop-filter: blur(8px);
          animation: tabPulse 2.5s ease-in-out 1s 3;
        }
        .chat-tab:hover {
          background: rgba(124,58,237,0.30);
          color: rgba(196,181,253,1);
        }
        .chat-tab.open {
          animation: none;
          background: rgba(124,58,237,0.25);
          border-color: rgba(124,58,237,0.45);
        }
        .drawer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px 10px;
          border-bottom: 1px solid rgba(124,58,237,0.15);
          flex-shrink: 0;
        }
        .drawer-title {
          font-size: 12px;
          font-weight: 800;
          color: rgba(196,181,253,0.85);
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .drawer-close {
          width: 24px;
          height: 24px;
          border-radius: 6px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
          color: rgba(148,163,184,0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.15s;
          flex-shrink: 0;
        }
        .drawer-close:hover {
          background: rgba(255,255,255,0.08);
          color: rgba(243,244,246,0.9);
          border-color: rgba(255,255,255,0.15);
        }
        /* Noise texture overlay for glass depth */
        .chat-drawer::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
          pointer-events: none;
          z-index: 0;
          opacity: 0.4;
        }
      `}</style>

      {/* Tab trigger — always visible */}
      {mounted && (
        <div
          className={`chat-tab${open ? " open" : ""}`}
          onClick={() => setOpen(o => !o)}
          style={{ right: open ? "min(340px, 90%)" : 0, transition: "right 0.38s cubic-bezier(0.22, 1, 0.36, 1)" }}
        >
          CHAT
        </div>
      )}

      {/* Drawer panel */}
      {mounted && open && (
        <div className="chat-drawer entering">
          <div className="drawer-header">
            <span className="drawer-title">{title}</span>
            <div className="drawer-close" onClick={() => setOpen(false)}>✕</div>
          </div>
          <div style={{ flex: 1, minHeight: 0, position: "relative", zIndex: 1 }}>
            <LobbyChatPanel roomId={roomId} embedded={true} />
          </div>
        </div>
      )}
    </>
  );
}
