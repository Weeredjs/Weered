"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
function getToken() {
  try {
    return localStorage.getItem("weered_token") || "";
  } catch {
    return "";
  }
}

interface ActiveRoom {
  roomId: string;
  name: string;
  users: number;
}
interface LobbyRow {
  id: string;
  name: string;
  members: number;
  onlineNow: number;
}
interface TopUser {
  id: string;
  name: string;
  notoriety: number;
  messagesThisWeek: number;
}
interface AnalyticsPayload {
  ok: boolean;
  live: { onlineNow: number; activeRooms: ActiveRoom[] };
  users: { total: number; today: number; thisWeek: number; thisMonth: number };
  messages: {
    dmToday: number;
    dmThisWeek: number;
    chatToday: number;
    chatThisWeek: number;
  };
  engagement: {
    lfgPostsThisWeek: number;
    notorietyEventsToday: number;
    notificationsToday: number;
    pushSubscribers: number;
  };
  lobbies: LobbyRow[];
  retention: {
    signupsLast30d: number;
    returnedAfter1d: number;
    returnedAfter7d: number;
  };
  topUsers: TopUser[];
}

const C = {
  purple: "#5800E5",
  purpleDim: "rgba(88,0,229,.15)",
  green: "#22c55e",
  gold: "#D4A017",
  red: "#ef4444",
  text: "rgba(243,244,246,.95)",
  dim: "rgba(243,244,246,.55)",
  muted: "rgba(243,244,246,.25)",
  border: "rgba(255,255,255,.06)",
  mono: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
};

function pct(num: number, den: number) {
  if (!den) return "0%";
  return `${Math.round((num / den) * 100)}%`;
}

function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

function elapsed(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ${s % 60}s ago`;
}

const PULSE_ID = "__weered_analytics_pulse";
function ensurePulseKeyframes() {
  if (typeof document === "undefined") return;
  if (document.getElementById(PULSE_ID)) return;
  const style = document.createElement("style");
  style.id = PULSE_ID;
  style.textContent = `
    @keyframes weered-pulse {
      0%, 100% { opacity: 1; }
      50%      { opacity: .35; }
    }
    @keyframes weered-skeleton {
      0%   { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
  `;
  document.head.appendChild(style);
}

const cardBase: React.CSSProperties = {
  background: C.purpleDim,
  border: `1px solid ${C.border}`,
  borderRadius: 10,
  padding: "14px 18px",
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const labelStyle: React.CSSProperties = {
  fontFamily: C.mono,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: ".06em",
  textTransform: "uppercase",
  color: C.dim,
};

const bigNum: React.CSSProperties = {
  fontFamily: C.mono,
  fontSize: 28,
  fontWeight: 700,
  color: C.text,
  lineHeight: 1.15,
};

const sectionTitle: React.CSSProperties = {
  fontFamily: C.mono,
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: ".08em",
  textTransform: "uppercase",
  color: C.dim,
  margin: "24px 0 10px",
};

function Skeleton({ w = "100%", h = 24 }: { w?: string | number; h?: number }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: 6,
        background: `linear-gradient(90deg, ${C.purpleDim} 25%, rgba(88,0,229,.28) 50%, ${C.purpleDim} 75%)`,
        backgroundSize: "200% 100%",
        animation: "weered-skeleton 1.6s ease infinite",
      }}
    />
  );
}

function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ ...cardBase, flex: "1 1 140px", minWidth: 140, gap: 10 }}>
          <Skeleton w={80} h={12} />
          <Skeleton w={60} h={28} />
        </div>
      ))}
    </div>
  );
}

function GreenDot({ pulse = false, size = 8 }: { pulse?: boolean; size?: number }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: "50%",
        background: C.green,
        boxShadow: `0 0 6px ${C.green}`,
        animation: pulse ? "weered-pulse 2s ease-in-out infinite" : undefined,
        flexShrink: 0,
      }}
    />
  );
}

export default function AnalyticsTab() {
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(0);
  const [tick, setTick] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    ensurePulseKeyframes();
  }, []);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/staff/analytics`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Bad response");
      setData(json as AnalyticsPayload);
      setLastUpdated(Date.now());
    } catch (e: any) {
      setError(e.message || "Fetch failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    timerRef.current = setInterval(() => fetchData(true), 30_000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchData]);

  useEffect(() => {
    tickRef.current = setInterval(() => setTick((t) => t + 1), 5_000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  if (loading && !data) {
    return (
      <div style={{ padding: 24 }}>
        <SkeletonCards count={4} />
        <div style={{ marginTop: 20 }}>
          <Skeleton h={16} w={120} />
        </div>
        <div style={{ marginTop: 12 }}>
          <SkeletonCards count={4} />
        </div>
        <div style={{ marginTop: 20 }}>
          <Skeleton h={16} w={160} />
        </div>
        <div style={{ marginTop: 12 }}>
          <Skeleton h={200} />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div
        style={{
          padding: 32,
          textAlign: "center",
          color: C.red,
          fontFamily: C.mono,
          fontSize: 14,
        }}
      >
        <div style={{ fontSize: 18, marginBottom: 8 }}>Failed to load analytics</div>
        <div style={{ color: C.dim, marginBottom: 16 }}>{error}</div>
        <button
          onClick={() => fetchData()}
          style={{
            background: C.purpleDim,
            color: C.text,
            border: `1px solid ${C.purple}`,
            borderRadius: 6,
            padding: "8px 20px",
            fontFamily: C.mono,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { live, users, messages, engagement, lobbies, retention, topUsers } = data;

  return (
    <div style={{ padding: "20px 24px 40px", maxWidth: 960, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 18,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: C.mono,
              fontSize: 18,
              fontWeight: 700,
              color: C.text,
              letterSpacing: ".04em",
            }}
          >
            ANALYTICS
          </div>
          {lastUpdated > 0 && (
            <div style={{ fontFamily: C.mono, fontSize: 11, color: C.muted, marginTop: 2 }}>
              Last updated: {elapsed(lastUpdated)}
              {error && <span style={{ color: C.red, marginLeft: 8 }}>(refresh failed)</span>}
            </div>
          )}
        </div>
        <button
          onClick={() => fetchData(true)}
          title="Refresh now"
          style={{
            background: C.purpleDim,
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            padding: "6px 14px",
            fontFamily: C.mono,
            fontSize: 12,
            color: C.dim,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            transition: "border-color .2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = C.purple;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = C.border;
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          Refresh
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
        }}
      >
        <div
          style={{
            ...cardBase,
            boxShadow: `0 0 18px rgba(34,197,94,.12)`,
            borderColor: "rgba(34,197,94,.18)",
          }}
        >
          <div style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 6 }}>
            <GreenDot pulse size={7} />
            Online Now
          </div>
          <div style={{ ...bigNum, color: C.green }}>{fmtNum(live.onlineNow)}</div>
        </div>

        <div style={cardBase}>
          <div style={labelStyle}>Users Total</div>
          <div style={bigNum}>{fmtNum(users.total)}</div>
        </div>

        <div style={cardBase}>
          <div style={labelStyle}>Signups Today</div>
          <div style={bigNum}>{fmtNum(users.today)}</div>
        </div>

        <div style={cardBase}>
          <div style={labelStyle}>Push Subscribers</div>
          <div style={{ ...bigNum, color: C.purple }}>{fmtNum(engagement.pushSubscribers)}</div>
        </div>
      </div>

      {live.activeRooms && live.activeRooms.length > 0 && (
        <>
          <div style={sectionTitle}>Active Rooms</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {live.activeRooms.map((r) => (
              <div
                key={r.roomId}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: C.purpleDim,
                  border: `1px solid ${C.border}`,
                  borderRadius: 20,
                  padding: "5px 14px",
                  fontFamily: C.mono,
                  fontSize: 12,
                  color: C.text,
                }}
              >
                <GreenDot size={6} />
                <span
                  style={{
                    maxWidth: 140,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {r.name}
                </span>
                <span style={{ color: C.dim, marginLeft: 2 }}>{r.users}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={sectionTitle}>Messages</div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10,
        }}
      >
        {(
          [
            ["DMs Today", messages.dmToday],
            ["DMs This Week", messages.dmThisWeek],
            ["Chat Today", messages.chatToday],
            ["Chat This Week", messages.chatThisWeek],
          ] as [string, number][]
        ).map(([label, val]) => (
          <div key={label} style={{ ...cardBase, padding: "12px 14px" }}>
            <div style={{ ...labelStyle, fontSize: 10 }}>{label}</div>
            <div style={{ ...bigNum, fontSize: 22 }}>{fmtNum(val)}</div>
          </div>
        ))}
      </div>

      <div style={sectionTitle}>Lobby Leaderboard</div>
      <div
        style={{
          background: C.purpleDim,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontFamily: C.mono,
            fontSize: 12,
          }}
        >
          <thead>
            <tr>
              {["#", "Lobby", "Members", "Online"].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: h === "Lobby" ? "left" : "center",
                    padding: "10px 12px",
                    color: C.muted,
                    fontWeight: 600,
                    fontSize: 10,
                    letterSpacing: ".08em",
                    textTransform: "uppercase",
                    borderBottom: `1px solid ${C.border}`,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lobbies.slice(0, 15).map((lob, i) => (
              <tr
                key={lob.id}
                style={{
                  borderBottom:
                    i < Math.min(lobbies.length, 15) - 1 ? `1px solid ${C.border}` : undefined,
                }}
              >
                <td style={{ textAlign: "center", padding: "8px 12px", color: C.muted }}>
                  {i + 1}
                </td>
                <td
                  style={{
                    padding: "8px 12px",
                    color: C.text,
                    maxWidth: 220,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {lob.name}
                </td>
                <td style={{ textAlign: "center", padding: "8px 12px", color: C.dim }}>
                  {fmtNum(lob.members)}
                </td>
                <td
                  style={{
                    textAlign: "center",
                    padding: "8px 12px",
                    color: lob.onlineNow > 0 ? C.green : C.muted,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 5,
                  }}
                >
                  {lob.onlineNow > 0 && <GreenDot size={5} />}
                  {lob.onlineNow}
                </td>
              </tr>
            ))}
            {lobbies.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: 16, textAlign: "center", color: C.muted }}>
                  No lobbies
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={sectionTitle}>Engagement</div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 10,
        }}
      >
        {(
          [
            ["LFG Posts This Week", engagement.lfgPostsThisWeek, C.purple],
            ["Notoriety Events Today", engagement.notorietyEventsToday, C.gold],
            ["Notifications Today", engagement.notificationsToday, C.text],
          ] as [string, number, string][]
        ).map(([label, val, color]) => (
          <div key={label} style={{ ...cardBase, padding: "12px 14px" }}>
            <div style={{ ...labelStyle, fontSize: 10 }}>{label}</div>
            <div style={{ ...bigNum, fontSize: 22, color }}>{fmtNum(val)}</div>
          </div>
        ))}
      </div>

      <div style={sectionTitle}>Retention (30 day)</div>
      <div style={{ ...cardBase, gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ ...labelStyle, fontSize: 10 }}>Signups Last 30d</div>
            <div style={{ ...bigNum, fontSize: 22 }}>{fmtNum(retention.signupsLast30d)}</div>
          </div>
          <div
            style={{
              width: 1,
              height: 36,
              background: C.border,
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ ...labelStyle, fontSize: 10 }}>Returned After 1d</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ ...bigNum, fontSize: 22 }}>{fmtNum(retention.returnedAfter1d)}</span>
              <span
                style={{
                  fontFamily: C.mono,
                  fontSize: 14,
                  fontWeight: 700,
                  color: C.green,
                }}
              >
                {pct(retention.returnedAfter1d, retention.signupsLast30d)}
              </span>
            </div>
            <div
              style={{
                marginTop: 5,
                height: 4,
                borderRadius: 2,
                background: "rgba(255,255,255,.06)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  borderRadius: 2,
                  width: retention.signupsLast30d
                    ? `${Math.min(100, (retention.returnedAfter1d / retention.signupsLast30d) * 100)}%`
                    : "0%",
                  background: C.green,
                  transition: "width .6s ease",
                }}
              />
            </div>
          </div>
          <div
            style={{
              width: 1,
              height: 36,
              background: C.border,
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ ...labelStyle, fontSize: 10 }}>Returned After 7d</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ ...bigNum, fontSize: 22 }}>{fmtNum(retention.returnedAfter7d)}</span>
              <span
                style={{
                  fontFamily: C.mono,
                  fontSize: 14,
                  fontWeight: 700,
                  color: C.green,
                }}
              >
                {pct(retention.returnedAfter7d, retention.signupsLast30d)}
              </span>
            </div>
            <div
              style={{
                marginTop: 5,
                height: 4,
                borderRadius: 2,
                background: "rgba(255,255,255,.06)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  borderRadius: 2,
                  width: retention.signupsLast30d
                    ? `${Math.min(100, (retention.returnedAfter7d / retention.signupsLast30d) * 100)}%`
                    : "0%",
                  background: C.purple,
                  transition: "width .6s ease",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <div style={sectionTitle}>Top Users</div>
      <div
        style={{
          background: C.purpleDim,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontFamily: C.mono,
            fontSize: 12,
          }}
        >
          <thead>
            <tr>
              {["#", "User", "Notoriety", "Msgs/Week"].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: h === "User" ? "left" : "center",
                    padding: "10px 12px",
                    color: C.muted,
                    fontWeight: 600,
                    fontSize: 10,
                    letterSpacing: ".08em",
                    textTransform: "uppercase",
                    borderBottom: `1px solid ${C.border}`,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {topUsers.slice(0, 10).map((u, i) => (
              <tr
                key={u.id}
                style={{
                  borderBottom:
                    i < Math.min(topUsers.length, 10) - 1 ? `1px solid ${C.border}` : undefined,
                }}
              >
                <td style={{ textAlign: "center", padding: "8px 12px", color: C.muted }}>
                  {i + 1}
                </td>
                <td
                  style={{
                    padding: "8px 12px",
                    color: C.text,
                    maxWidth: 200,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {u.name}
                </td>
                <td
                  style={{
                    textAlign: "center",
                    padding: "8px 12px",
                    color: C.gold,
                    fontWeight: 700,
                  }}
                >
                  {fmtNum(u.notoriety)}
                </td>
                <td style={{ textAlign: "center", padding: "8px 12px", color: C.dim }}>
                  {fmtNum(u.messagesThisWeek)}
                </td>
              </tr>
            ))}
            {topUsers.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: 16, textAlign: "center", color: C.muted }}>
                  No data yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
