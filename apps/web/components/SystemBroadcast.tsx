"use client";

import React, { useEffect, useState } from "react";

type BroadcastMsg = {
  message: string;
  level: "info" | "warning" | "urgent";
  from: string;
  ts: number;
};

const LEVEL_STYLES: Record<string, { bg: string; border: string; color: string; icon: string }> = {
  info:    { bg: "rgba(88,0,229,.12)", border: "rgba(88,0,229,.35)", color: "rgba(216,180,254,.95)", icon: "📢" },
  warning: { bg: "rgba(245,158,11,.10)", border: "rgba(245,158,11,.35)", color: "rgb(253,230,138)", icon: "⚠️" },
  urgent:  { bg: "rgba(239,68,68,.10)", border: "rgba(239,68,68,.35)", color: "rgba(252,165,165,.95)", icon: "🚨" },
};

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

export default function SystemBroadcast() {
  const [msgs, setMsgs] = useState<BroadcastMsg[]>([]);

  // Fetch persistent banner on mount
  useEffect(() => {
    const dismissed = localStorage.getItem("weered:banner:dismissed");
    fetch(`${API}/banner`).then(r => r.json()).then(j => {
      if (j?.ok && j?.banner?.message) {
        const b = j.banner;
        if (dismissed === b.message) return; // user already dismissed this exact message
        setMsgs(prev => {
          if (prev.some(m => m.message === b.message)) return prev;
          return [{ message: b.message, level: b.level || "info", from: b.from || "Weered", ts: b.ts || 1 }, ...prev];
        });
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    function onBroadcast(ev: any) {
      const detail = ev?.detail;
      if (!detail?.message) return;
      setMsgs(prev => {
        // Dedupe by timestamp
        if (prev.some(m => m.ts === detail.ts)) return prev;
        return [...prev, { message: detail.message, level: detail.level || "info", from: detail.from || "System", ts: detail.ts || Date.now() }];
      });
    }
    window.addEventListener("weered:system:broadcast", onBroadcast);
    return () => window.removeEventListener("weered:system:broadcast", onBroadcast);
  }, []);

  function dismiss(ts: number) {
    const msg = msgs.find(m => m.ts === ts);
    if (msg && ts === 1) {
      // Persistent banner — remember dismissal
      try { localStorage.setItem("weered:banner:dismissed", msg.message); } catch {}
    }
    setMsgs(prev => prev.filter(m => m.ts !== ts));
  }

  if (msgs.length === 0) return null;

  return (
    <div style={{ position: "relative", zIndex: 9999 }}>
      {msgs.map(msg => {
        const s = LEVEL_STYLES[msg.level] || LEVEL_STYLES.info;
        return (
          <div
            key={msg.ts}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 16px",
              background: s.bg,
              borderBottom: `1px solid ${s.border}`,
              color: s.color,
              fontSize: 13,
              fontWeight: 600,
              animation: "weered-broadcast-in 0.3s ease-out",
            }}
          >
            <span style={{ fontSize: 16, flexShrink: 0 }}>{s.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span>{msg.message}</span>
              <span style={{ marginLeft: 10, fontSize: 10, opacity: 0.5, fontWeight: 400 }}>— {msg.from}</span>
            </div>
            <button
              onClick={() => dismiss(msg.ts)}
              style={{
                flexShrink: 0, padding: "4px 10px", borderRadius: 6,
                border: `1px solid ${s.border}`, background: "rgba(0,0,0,.2)",
                color: s.color, fontSize: 11, fontWeight: 700,
                cursor: "pointer", opacity: 0.7, transition: "opacity .15s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "0.7"; }}
            >
              Dismiss
            </button>
          </div>
        );
      })}
      <style>{`@keyframes weered-broadcast-in{from{opacity:0;transform:translateY(-100%)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}
