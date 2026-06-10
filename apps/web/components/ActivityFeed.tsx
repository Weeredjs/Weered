"use client";

import React, { useEffect, useState, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
function getToken() {
  try { return localStorage.getItem("weered_token") || ""; } catch { return ""; }
}

interface FeedItem {
  type: "dm" | "notification" | "notoriety" | "friend";
  id: string;
  text: string;
  preview?: string;
  ts: string;
  subType?: string;
  points?: number;
  action?: string;
  body?: string;
  actionUrl?: string;
  actorName?: string;
  fromId?: string;
  fromName?: string;
  friendName?: string;
  read?: boolean;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

const TYPE_CFG: Record<string, { icon: React.ReactNode; bg: string; color: string }> = {
  dm: {
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="M22 7l-10 7L2 7" />
      </svg>
    ),
    bg: "rgba(96,165,250,.14)",
    color: "rgba(96,165,250,.85)",
  },
  notification: {
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 01-3.46 0" />
      </svg>
    ),
    bg: "rgba(88,0,229,.14)",
    color: "rgba(88,0,229,.85)",
  },
  notoriety: {
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.27 5.82 21 7 14.14l-5-4.87 6.91-1.01L12 2z" />
      </svg>
    ),
    bg: "rgba(212,160,23,.14)",
    color: "rgba(212,160,23,.85)",
  },
  friend: {
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
    bg: "rgba(34,197,94,.14)",
    color: "rgba(34,197,94,.85)",
  },
};

export default function ActivityFeed({ initialCount = 10 }: { initialCount?: number } = {}) {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const tok = getToken();
    if (!tok) { setLoaded(true); return; }

    let cancelled = false;
    fetch(`${API}/activity-feed`, {
      headers: { Authorization: `Bearer ${tok}` },
    })
      .then(r => r.json())
      .then(j => {
        if (!cancelled && j.ok && Array.isArray(j.feed)) {
          setFeed(j.feed);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoaded(true); });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.id) return;
      const newItem: FeedItem = {
        type: detail.type || "notification",
        id: detail.id,
        text: detail.title || detail.text || "",
        preview: detail.body || detail.preview || "",
        ts: detail.createdAt || new Date().toISOString(),
        actionUrl: detail.actionUrl,
        actorName: detail.actorName,
        read: false,
      };
      setFeed(prev => [newItem, ...prev].slice(0, 50));
    };
    window.addEventListener("weered:notification", handler);
    return () => window.removeEventListener("weered:notification", handler);
  }, []);

  const handleClick = useCallback((item: FeedItem) => {
    if (item.type === "dm" && item.fromId) {
      window.dispatchEvent(new CustomEvent("weered:dock:open", {
        detail: { mode: "dm", peer: { id: item.fromId, name: item.fromName || item.actorName || "" } },
      }));
      return;
    }
    if (item.actionUrl) {
      window.location.href = item.actionUrl;
    }
  }, []);

  if (!loaded) return null;
  if (feed.length === 0) return null;

  const visible = expanded ? feed : feed.slice(0, initialCount);
  const hasMore = feed.length > initialCount && !expanded;

  return (
    <div style={{ padding: "0 0 4px" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 7,
        padding: "0 4px 10px",
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(243,244,246,.55)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
        <span style={{
          fontSize: 13, fontWeight: 800, color: "rgba(243,244,246,.95)",
          letterSpacing: "-.2px",
        }}>
          Activity
        </span>
      </div>

      {feed.length === 0 ? (
        <div style={{ padding: "28px 16px", textAlign: "center" }}>
          <div style={{ color: "rgba(243,244,246,.55)", fontSize: 12, fontWeight: 700 }}>Nothing moved recently.</div>
          <div style={{ color: "rgba(148,163,184,.45)", fontSize: 11, marginTop: 3 }}>When the feed picks up, you'll see it here.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {visible.map((item) => {
            const cfg = TYPE_CFG[item.type] || TYPE_CFG.notification;
            const isUnread = item.type === "notification" && item.read === false;
            const isClickable = (item.type === "dm" && item.fromId) || !!item.actionUrl;

            return (
              <div
                key={item.id}
                onClick={() => handleClick(item)}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 10,
                  padding: "9px 10px",
                  borderRadius: 8,
                  background: isUnread ? "rgba(88,0,229,.04)" : "transparent",
                  borderLeft: isUnread ? "3px solid rgba(88,0,229,.50)" : "3px solid transparent",
                  cursor: isClickable ? "pointer" : "default",
                  transition: "background 0.12s",
                }}
                onMouseEnter={e => {
                  if (isClickable) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.04)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = isUnread ? "rgba(88,0,229,.04)" : "transparent";
                }}
              >
                <div style={{
                  width: 28, height: 28, minWidth: 28, borderRadius: 8,
                  background: cfg.bg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: cfg.color,
                  marginTop: 1,
                }}>
                  {cfg.icon}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12, fontWeight: 700,
                    color: "rgba(243,244,246,.90)",
                    lineHeight: 1.35,
                  }}>
                    {formatMainText(item)}
                  </div>
                  {(item.preview || item.body) && (
                    <div style={{
                      fontSize: 11, color: "rgba(243,244,246,.40)",
                      marginTop: 2, lineHeight: 1.3,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {item.preview || item.body}
                    </div>
                  )}
                </div>

                <div style={{
                  fontSize: 10, color: "rgba(243,244,246,.25)",
                  fontFamily: "monospace",
                  fontVariantNumeric: "tabular-nums",
                  whiteSpace: "nowrap",
                  marginTop: 2,
                  flexShrink: 0,
                }}>
                  {timeAgo(item.ts)}
                </div>
              </div>
            );
          })}

          {hasMore && (
            <button
              onClick={() => setExpanded(true)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                padding: "8px 0",
                fontSize: 11, fontWeight: 700,
                color: "rgba(88,0,229,.7)",
                textAlign: "center",
                transition: "color 0.12s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "rgba(88,0,229,.95)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(88,0,229,.7)"; }}
            >
              Show more ({feed.length - 10} remaining)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function formatMainText(item: FeedItem): React.ReactNode {
  switch (item.type) {
    case "dm":
      return (
        <>
          <span style={{ color: "rgba(96,165,250,.9)" }}>{item.fromName || item.actorName || "Someone"}</span>
          {" "}{item.text}
        </>
      );
    case "notoriety":
      return (
        <>
          {item.text}
          {item.points != null && (
            <span style={{ color: "rgba(212,160,23,.85)", fontWeight: 800 }}> +{item.points}</span>
          )}
        </>
      );
    case "friend":
      return (
        <>
          <span style={{ color: "rgba(34,197,94,.9)" }}>{item.friendName || item.actorName || "Someone"}</span>
          {" "}{item.text}
        </>
      );
    default:
      return item.text;
  }
}
