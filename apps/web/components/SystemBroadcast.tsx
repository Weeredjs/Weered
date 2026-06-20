"use client";

import { useEffect, useState } from "react";

type BroadcastMsg = {
  id?: string;
  message: string;
  level: "info" | "warning" | "urgent";
  from: string;
  ts: number;
  sticky?: boolean;
};

const LEVEL_STYLES: Record<
  string,
  { bg: string; border: string; color: string; icon: string; tag: string; tagColor: string }
> = {
  info: {
    bg: "rgba(30,14,58,.96)",
    border: "rgba(124,58,237,.55)",
    color: "rgba(224,200,255,.96)",
    icon: "📢",
    tag: "ANNOUNCEMENT",
    tagColor: "#a78bfa",
  },
  warning: {
    bg: "rgba(54,38,8,.96)",
    border: "rgba(245,158,11,.55)",
    color: "rgb(253,230,138)",
    icon: "⚠️",
    tag: "MAINTENANCE",
    tagColor: "#f5b700",
  },
  urgent: {
    bg: "rgba(56,12,12,.96)",
    border: "rgba(239,68,68,.6)",
    color: "rgba(254,202,202,.98)",
    icon: "🚨",
    tag: "URGENT",
    tagColor: "#fca5a5",
  },
};

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

export default function SystemBroadcast() {
  const [msgs, setMsgs] = useState<BroadcastMsg[]>([]);

  useEffect(() => {
    let dismissedIds: string[] = [];
    try {
      dismissedIds = JSON.parse(localStorage.getItem("weered:banner:dismissedIds") || "[]");
    } catch {}
    fetch(`${API}/banner`)
      .then((r) => r.json())
      .then((j) => {
        const banners = Array.isArray(j?.banners) ? j.banners : j?.banner ? [j.banner] : [];
        const shown = banners
          .filter((b: any) => b?.message && !dismissedIds.includes(b.id))
          .map((b: any) => ({
            id: b.id,
            message: b.message,
            level: b.level || "info",
            from: b.from || "Weered",
            ts: b.ts || 1,
            sticky: !!b.sticky,
          }));
        if (shown.length)
          setMsgs((prev) => {
            const have = new Set(prev.map((m) => m.id || m.message));
            return [...shown.filter((b: BroadcastMsg) => !have.has(b.id || b.message)), ...prev];
          });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function onBroadcast(ev: any) {
      const detail = ev?.detail;
      if (!detail?.message) return;
      setMsgs((prev) => {
        if (prev.some((m) => m.ts === detail.ts)) return prev;
        return [
          ...prev,
          {
            message: detail.message,
            level: detail.level || "info",
            from: detail.from || "System",
            ts: detail.ts || Date.now(),
          },
        ];
      });
    }
    window.addEventListener("weered:system:broadcast", onBroadcast);
    return () => window.removeEventListener("weered:system:broadcast", onBroadcast);
  }, []);

  function dismiss(msg: BroadcastMsg) {
    if (msg.id) {
      try {
        const ids: string[] = JSON.parse(
          localStorage.getItem("weered:banner:dismissedIds") || "[]",
        );
        if (!ids.includes(msg.id))
          localStorage.setItem(
            "weered:banner:dismissedIds",
            JSON.stringify([...ids, msg.id].slice(-50)),
          );
      } catch {}
    }
    setMsgs((prev) => prev.filter((m) => (m.id || m.ts) !== (msg.id || msg.ts)));
  }

  if (msgs.length === 0) return null;

  return (
    <div style={{ position: "relative", zIndex: 9999 }}>
      {msgs.map((msg) => {
        const s = LEVEL_STYLES[msg.level] || LEVEL_STYLES.info;
        return (
          <div
            key={msg.id || msg.ts}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "9px 14px",
              background: s.bg,
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              borderBottom: `1px solid ${s.border}`,
              boxShadow: "0 2px 12px rgba(0,0,0,.35)",
              color: s.color,
              fontSize: 13,
              fontWeight: 600,
              animation: "weered-broadcast-in 0.3s ease-out",
            }}
          >
            <span style={{ fontSize: 15, flexShrink: 0 }}>{s.icon}</span>
            <span
              style={{
                flexShrink: 0,
                fontSize: 9,
                fontWeight: 900,
                letterSpacing: "1px",
                textTransform: "uppercase",
                color: s.tagColor,
                border: `1px solid ${s.border}`,
                borderRadius: 4,
                padding: "2px 7px",
                background: "rgba(0,0,0,.25)",
              }}
            >
              {s.tag}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span>{msg.message}</span>
              <span style={{ marginLeft: 10, fontSize: 10, opacity: 0.5, fontWeight: 400 }}>
                — {msg.from}
              </span>
            </div>
            <button
              onClick={() => dismiss(msg)}
              title={msg.sticky ? "Hide for now" : "Dismiss"}
              aria-label={msg.sticky ? "Hide announcement" : "Dismiss announcement"}
              style={{
                flexShrink: 0,
                width: msg.sticky ? 26 : "auto",
                height: 26,
                padding: msg.sticky ? 0 : "0 11px",
                borderRadius: 6,
                border: `1px solid ${s.border}`,
                background: "rgba(0,0,0,.28)",
                color: s.color,
                fontSize: msg.sticky ? 15 : 11,
                fontWeight: 700,
                cursor: "pointer",
                opacity: 0.75,
                transition: "opacity .15s",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                lineHeight: 1,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.opacity = "1";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.opacity = "0.75";
              }}
            >
              {msg.sticky ? "×" : "Dismiss"}
            </button>
          </div>
        );
      })}
      <style>{`@keyframes weered-broadcast-in{from{opacity:0;transform:translateY(-100%)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}
