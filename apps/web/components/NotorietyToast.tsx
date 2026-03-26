"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";

// Action labels for human-readable toast messages
const ACTION_LABELS: Record<string, string> = {
  DAILY_ACTIVE:      "Daily login bonus",
  CHAT_MESSAGE:      "Chat activity",
  ROOM_JOINED:       "Joined a room",
  VOICE_JOINED:      "Voice chat",
  CREW_CREATED:      "Founded a crew",
  CREW_JOINED:       "Joined a crew",
  LOBBY_CREATED:     "Created a lobby",
  FRIEND_ADDED:      "Made a friend",
  BIO_COMPLETE:      "Completed your bio",
  AVATAR_SET:        "Set your avatar",
  BUNGIE_LINKED:     "Linked Bungie account",
  FIRST_ROOM_HOSTED: "Hosted your first room",
  ROOM_25_USERS:     "Room hit 25 users",
  SUBREDDIT_LINKED:  "Linked a subreddit",
};

interface Toast {
  id: string;
  action: string;
  points: number;
  fadeOut: boolean;
}

export default function NotorietyToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const addToast = useCallback((action: string, points: number) => {
    const id = `nt-${++counterRef.current}`;
    setToasts(prev => [...prev.slice(-4), { id, action, points, fadeOut: false }]);

    // Start fade after 2.5s
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, fadeOut: true } : t));
    }, 2500);

    // Remove after 3.2s
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3200);
  }, []);

  useEffect(() => {
    function handleNotoriety(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail?.action && detail?.points) {
        addToast(detail.action, detail.points);
      }
    }
    window.addEventListener("weered:notoriety:award", handleNotoriety);
    return () => window.removeEventListener("weered:notoriety:award", handleNotoriety);
  }, [addToast]);

  if (!toasts.length) return null;

  return (
    <div style={{
      position: "fixed", top: 16, right: 16, zIndex: 9999,
      display: "flex", flexDirection: "column", gap: 8,
      pointerEvents: "none",
    }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 16px", borderRadius: 12,
            background: "rgba(10,10,18,0.92)",
            border: "1px solid rgba(88,0,229,0.4)",
            boxShadow: "0 0 20px rgba(88,0,229,0.25), 0 8px 24px rgba(0,0,0,0.5)",
            backdropFilter: "blur(12px)",
            opacity: t.fadeOut ? 0 : 1,
            transform: t.fadeOut ? "translateX(20px)" : "translateX(0)",
            transition: "opacity 0.5s ease, transform 0.5s ease",
            animation: t.fadeOut ? undefined : "notorietySlideIn 0.3s ease-out",
          }}
        >
          {/* XP icon */}
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "linear-gradient(135deg, rgba(88,0,229,0.3), rgba(212,160,23,0.3))",
            border: "1px solid rgba(212,160,23,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 900, color: "#D4A017",
            fontFamily: "monospace",
          }}>
            ★
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 13, fontWeight: 800, color: "#D4A017",
              letterSpacing: "-0.2px",
            }}>
              +{t.points} XP
            </div>
            <div style={{
              fontSize: 10, color: "rgba(148,163,184,0.6)",
              letterSpacing: "0.02em",
            }}>
              {ACTION_LABELS[t.action] || t.action}
            </div>
          </div>
        </div>
      ))}

      <style>{`
        @keyframes notorietySlideIn {
          from { opacity: 0; transform: translateX(30px) scale(0.95); }
          to   { opacity: 1; transform: translateX(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
