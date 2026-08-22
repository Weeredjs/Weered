"use client";

import React, { useCallback, useEffect, useState } from "react";
import StreamInterceptModal, { type StreamInfo } from "./StreamInterceptModal";
import EmptyState from "./EmptyState";
import ModuleTabBar from "./ModuleTabBar";
import { useWatchHere, consumePendingStream } from "../lib/useWatchHere";
import { onActivate } from "@/lib/a11y";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

const ACCENT_D2 = "#f26b21";

function authHeaders(): Record<string, string> {
  try {
    const t = localStorage.getItem("weered_token") || "";
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}
async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(opts?.headers || {}) },
  });
  return r.json();
}

const S = {
  card: {
    borderRadius: 2,
    border: "1px solid rgba(255,255,255,.06)",
    background: "rgba(255,255,255,.03)",
    padding: "10px 12px",
  } as React.CSSProperties,
  btn: {
    padding: "6px 12px",
    borderRadius: 2,
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(255,255,255,.05)",
    fontSize: 12,
    cursor: "pointer",
    color: "rgba(243,244,246,.88)",
    fontFamily: "inherit",
  } as React.CSSProperties,
  btnPri: {
    padding: "6px 12px",
    borderRadius: 2,
    border: "1px solid rgba(242,107,33,.35)",
    background: "rgba(242,107,33,.12)",
    fontSize: 12,
    cursor: "pointer",
    color: "rgb(242,107,33)",
    fontWeight: 600,
    fontFamily: "inherit",
  } as React.CSSProperties,
  input: {
    width: "100%",
    padding: "8px 12px",
    borderRadius: 2,
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(0,0,0,.30)",
    fontSize: 13,
    color: "rgba(243,244,246,.92)",
    outline: "none",
    boxSizing: "border-box" as const,
    fontFamily: "inherit",
  },
  select: {
    padding: "8px 12px",
    borderRadius: 2,
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(0,0,0,.30)",
    fontSize: 12,
    color: "rgba(243,244,246,.92)",
    outline: "none",
    cursor: "pointer",
    fontFamily: "inherit",
  } as React.CSSProperties,
  label: {
    fontSize: 10,
    fontWeight: 700,
    opacity: 0.45,
    letterSpacing: ".7px",
    textTransform: "uppercase" as const,
    marginBottom: 6,
  } as React.CSSProperties,
};

const D2_REGIONS = ["Any", "NA", "EU", "Asia", "Oceania"];
// 8-agent activities get 8 slots; everything else runs a 4-agent fireteam.
const D2_ACTIVITIES: { name: string; max: number }[] = [
  { name: "Missions / Story", max: 4 },
  { name: "Dark Zone", max: 4 },
  { name: "Dark Hours Raid", max: 8 },
  { name: "Iron Horse Raid", max: 8 },
  { name: "Incursion", max: 8 },
  { name: "The Summit", max: 4 },
  { name: "Countdown", max: 8 },
  { name: "Legendary Missions", max: 4 },
  { name: "Bounties & Projects", max: 4 },
  { name: "Leveling 1-30", max: 4 },
  { name: "Other", max: 4 },
];

const TABS = [
  { id: "ops" as const, label: "Ops Board", icon: "\u{1F6F0}\u{FE0F}" },
  { id: "lfg" as const, label: "Squad Finder", icon: "\u{1F465}" },
  { id: "streams" as const, label: "Live Streams", icon: "\u{1F4FA}" },
];
type TabId = (typeof TABS)[number]["id"];

// Weekly vendor/activities reset: Tuesdays 08:30 UTC.
function nextWeeklyReset(): Date {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 8, 30, 0));
  while (d.getUTCDay() !== 2 || d.getTime() <= now.getTime()) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}
function fmtCountdown(ms: number): string {
  if (ms <= 0) return "now";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}

type PlatformStatus = {
  platform: string;
  status: string;
  maintenance: boolean;
  impacted: string[];
};

type NewsItem = { title: string; url: string; date: string; source: string; snippet: string };

const FIELD_RESOURCES: { label: string; url: string }[] = [
  { label: "Interactive Map", url: "https://division2map.com" },
  { label: "Vendor Tracker", url: "https://rubenalamina.mx/the-division-weekly-vendor-reset/" },
  { label: "Subreddit Wiki", url: "https://www.reddit.com/r/thedivision/wiki/index" },
  {
    label: "Megathreads",
    url: "https://www.reddit.com/r/thedivision/?f=flair_name%3A%22Megathread%22",
  },
];

function OpsBoard({ accent }: { accent: string }) {
  const [platforms, setPlatforms] = useState<PlatformStatus[] | null>(null);
  const [updatedAt, setUpdatedAt] = useState("");
  const [failed, setFailed] = useState(false);
  const [news, setNews] = useState<NewsItem[] | null>(null);
  const [, forceTick] = useState(0);

  useEffect(() => {
    let alive = true;
    apiFetch("/division2/news")
      .then((j: any) => {
        if (alive && j?.ok) setNews(Array.isArray(j.items) ? j.items : []);
      })
      .catch(() => {
        if (alive) setNews([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const load = useCallback(async () => {
    try {
      const j: any = await apiFetch("/division2/status");
      if (j?.ok && Array.isArray(j.platforms)) {
        setPlatforms(j.platforms);
        setUpdatedAt(j.updatedAt || "");
        setFailed(false);
      } else setFailed(true);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    load();
    const i = setInterval(load, 5 * 60_000);
    return () => clearInterval(i);
  }, [load]);
  useEffect(() => {
    const i = setInterval(() => forceTick((t) => t + 1), 30_000);
    return () => clearInterval(i);
  }, []);

  const reset = nextWeeklyReset();
  const anyMaintenance = (platforms || []).some((p) => p.maintenance);
  const asOf = (() => {
    try {
      return updatedAt
        ? new Date(updatedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
        : "";
    } catch {
      return "";
    }
  })();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {anyMaintenance && (
        <div
          style={{
            ...S.card,
            border: "1px solid rgba(239,68,68,.35)",
            background: "rgba(239,68,68,.08)",
            color: "#fca5a5",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {"⚠️"} Scheduled maintenance in progress — servers may be unavailable.
        </div>
      )}

      <div>
        <div style={S.label}>SERVER STATUS {asOf ? `· UBISOFT · ${asOf}` : "· UBISOFT"}</div>
        {platforms === null && !failed ? (
          <div style={{ padding: 16, opacity: 0.4, fontSize: 12 }}>Contacting Ubisoft…</div>
        ) : failed && !platforms ? (
          <div style={{ padding: 16, opacity: 0.5, fontSize: 12 }}>
            Status feed unreachable — try again in a minute.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: 8,
            }}
          >
            {(platforms || []).map((p) => {
              const online = p.status === "online" && !p.maintenance;
              const color = online ? "#22c55e" : "#ef4444";
              return (
                <div
                  key={p.platform}
                  style={{ ...S.card, display: "flex", flexDirection: "column", gap: 6 }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: "50%",
                        background: color,
                        boxShadow: `0 0 6px ${color}88`,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: 13, fontWeight: 800, color: "rgba(243,244,246,.95)" }}>
                      {p.platform}
                    </span>
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: ".5px",
                        color,
                      }}
                    >
                      {p.maintenance ? "Maintenance" : p.status}
                    </span>
                  </div>
                  {p.impacted.length > 0 && (
                    <div style={{ fontSize: 10, color: "rgba(252,165,165,.8)" }}>
                      Impacted: {p.impacted.join(", ")}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <div style={S.label}>TIMERS</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 8,
          }}
        >
          <div
            style={{
              ...S.card,
              borderColor: `${accent}33`,
              background: `linear-gradient(135deg, ${accent}12, rgba(0,0,0,.2))`,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: ".6px",
                textTransform: "uppercase",
                color: "rgba(148,163,184,.6)",
              }}
            >
              Weekly Reset · Vendors & Activities
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 800,
                fontFamily: "monospace",
                color: accent,
                marginTop: 4,
              }}
            >
              {fmtCountdown(reset.getTime() - Date.now())}
            </div>
            <div style={{ fontSize: 10, color: "rgba(148,163,184,.5)", marginTop: 2 }}>
              Tuesdays 08:30 UTC
            </div>
          </div>
          <div style={S.card}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: ".6px",
                textTransform: "uppercase",
                color: "rgba(148,163,184,.6)",
              }}
            >
              Cassie Mendoza · Secret Vendor
            </div>
            <div
              style={{
                fontSize: 12,
                color: "rgba(243,244,246,.85)",
                marginTop: 6,
                lineHeight: 1.5,
              }}
            >
              Rotates on a ~59-hour cycle — exotic and named gear off-schedule.{" "}
              <a
                href="https://rubenalamina.mx/the-division-weekly-vendor-reset/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: accent, fontWeight: 700 }}
              >
                Community tracker {"↗"}
              </a>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div style={S.label}>INTEL · OFFICIAL ANNOUNCEMENTS</div>
        {news === null ? (
          <div style={{ padding: 12, opacity: 0.4, fontSize: 12 }}>Decrypting intel…</div>
        ) : news.length === 0 ? (
          <div style={{ padding: 12, opacity: 0.5, fontSize: 12 }}>
            No intel available right now.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {news.slice(0, 6).map((n) => {
              const when = (() => {
                try {
                  return new Date(n.date).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  });
                } catch {
                  return "";
                }
              })();
              return (
                <a
                  key={n.url}
                  href={n.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    ...S.card,
                    display: "block",
                    textDecoration: "none",
                    transition: "border-color .12s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = `${accent}44`)}
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.borderColor = "rgba(255,255,255,.06)")
                  }
                >
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: "rgba(243,244,246,.92)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {n.title}
                    </div>
                    <span
                      style={{
                        fontSize: 10,
                        color: "rgba(148,163,184,.5)",
                        flexShrink: 0,
                        fontFamily: "monospace",
                      }}
                    >
                      {when}
                    </span>
                  </div>
                  {n.snippet && (
                    <div
                      style={{
                        fontSize: 11,
                        color: "rgba(148,163,184,.55)",
                        marginTop: 4,
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical" as any,
                      }}
                    >
                      {n.snippet}
                    </div>
                  )}
                </a>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <div style={S.label}>FIELD RESOURCES</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {FIELD_RESOURCES.map((r) => (
            <a
              key={r.url}
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                ...S.btn,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                border: `1px solid ${accent}33`,
              }}
            >
              {r.label} <span style={{ opacity: 0.5, fontSize: 10 }}>{"↗"}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function SquadFinder({ lobbyId, accent }: { lobbyId: string; accent: string }) {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activity, setActivity] = useState(D2_ACTIVITIES[0].name);
  const [region, setRegion] = useState("Any");
  const [note, setNote] = useState("");
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    apiFetch(`/lfg/${encodeURIComponent(lobbyId)}`)
      .then((j) => {
        setPosts(j.posts || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [lobbyId]);

  useEffect(() => {
    load();
    const i = setInterval(load, 12000);
    return () => clearInterval(i);
  }, [load]);

  async function create() {
    setCreating(true);
    setMsg("");
    const max = D2_ACTIVITIES.find((a) => a.name === activity)?.max || 4;
    const regionStr = region !== "Any" ? ` [${region}]` : "";
    const j = await apiFetch(`/lfg/${encodeURIComponent(lobbyId)}`, {
      method: "POST",
      body: JSON.stringify({
        activity: `${activity}${regionStr}`,
        description: note,
        maxPlayers: max,
        platform: "pc",
      }),
    });
    setCreating(false);
    if (j.ok) {
      setShowForm(false);
      setNote("");
      load();
    } else setMsg(j.message || j.error || "Failed to create post");
  }

  async function join(postId: string) {
    const j = await apiFetch(`/lfg/${postId}/join`, { method: "POST", body: JSON.stringify({}) });
    if (j.ok) load();
    else setMsg(j.message || j.error || "Failed to join");
  }
  async function leave(postId: string) {
    const j = await apiFetch(`/lfg/${postId}/leave`, { method: "POST", body: JSON.stringify({}) });
    if (j.ok) load();
    else setMsg(j.message || j.error || "Failed to leave");
  }

  if (loading)
    return (
      <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>
        Loading squads...
      </div>
    );

  const openPosts = posts.filter((p) => p.status === "OPEN");

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <div style={S.label}>SQUAD FINDER ({openPosts.length} open)</div>
        <button
          style={showForm ? S.btn : S.btnPri}
          onClick={() => {
            setShowForm(!showForm);
            setMsg("");
          }}
        >
          {showForm ? "Cancel" : "+ Find Squad"}
        </button>
      </div>

      {msg && (
        <div
          style={{
            marginBottom: 10,
            fontSize: 12,
            padding: "6px 10px",
            borderRadius: 2,
            background: "rgba(239,68,68,.08)",
            border: "1px solid rgba(239,68,68,.2)",
            color: "rgba(252,165,165,.8)",
          }}
        >
          {msg}
        </div>
      )}

      {showForm && (
        <div
          style={{
            ...S.card,
            marginBottom: 16,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            border: `1px solid ${accent}33`,
            borderLeft: `2px solid ${accent}`,
            background: `${accent}06`,
          }}
        >
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={S.label}>Activity</div>
              <select
                style={{ ...S.select, width: "100%" }}
                value={activity}
                onChange={(e) => setActivity(e.target.value)}
              >
                {D2_ACTIVITIES.map((a) => (
                  <option key={a.name} value={a.name}>
                    {a.name}
                    {a.max === 8 ? " (8)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <div style={S.label}>Region</div>
              <select
                style={{ ...S.select, width: "100%" }}
                value={region}
                onChange={(e) => setRegion(e.target.value)}
              >
                {D2_REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <div style={S.label}>Note (optional)</div>
            <input
              style={S.input}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="SHD 2000+, mic required, chill runs..."
              maxLength={300}
            />
          </div>
          <button
            style={{ ...S.btnPri, padding: "10px 24px", alignSelf: "flex-start", fontSize: 13 }}
            onClick={create}
            disabled={creating}
          >
            {creating ? "Posting..." : "Post Squad"}
          </button>
        </div>
      )}

      {posts.length === 0 ? (
        <EmptyState icon="👥" title="No squads posted yet." hint="Post one — agents are lurking." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {posts.map((p) => {
            const isFull = p.status === "FULL";
            const playerCount = (p.players || []).length;
            const maxP = p.maxPlayers || 4;
            const slots = Array.from({ length: maxP }, (_, i) => i < playerCount);
            return (
              <div
                key={p.id}
                style={{
                  ...S.card,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  border: isFull ? `1px solid ${accent}30` : "1px solid rgba(255,255,255,.06)",
                  opacity: isFull ? 0.65 : 1,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(243,244,246,.92)" }}>
                      {p.activity}
                    </div>
                    {p.description && (
                      <div style={{ fontSize: 11, color: "rgba(148,163,184,.5)", marginTop: 3 }}>
                        {p.description}
                      </div>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: 9,
                      padding: "2px 6px",
                      borderRadius: 2,
                      background: isFull ? "rgba(239,68,68,.10)" : `${accent}12`,
                      color: isFull ? "#ef4444" : accent,
                      fontWeight: 700,
                    }}
                  >
                    {isFull ? "FULL" : "OPEN"}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  {slots.map((filled, i) => (
                    <div
                      key={i}
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: filled ? accent : "rgba(255,255,255,.10)",
                        boxShadow: filled ? `0 0 4px ${accent}66` : "none",
                      }}
                    />
                  ))}
                  <span style={{ fontSize: 10, color: "rgba(148,163,184,.4)", marginLeft: 4 }}>
                    {playerCount}/{maxP}
                  </span>
                </div>
                <div
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <span style={{ fontSize: 10, color: "rgba(148,163,184,.35)" }}>
                    Host: {p.hostName || "Unknown"}
                  </span>
                  {!isFull ? (
                    <button style={S.btnPri} onClick={() => join(p.id)}>
                      Join
                    </button>
                  ) : (
                    <button style={S.btn} onClick={() => leave(p.id)}>
                      Leave
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TwitchStreams({ lobbyId, accent }: { lobbyId: string; accent: string }) {
  const [streams, setStreams] = useState<StreamInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [interceptStream, setInterceptStream] = useState<StreamInfo | null>(null);
  const [activeStream, setActiveStream] = useState<string | null>(null);
  const GAME = "Tom Clancy's The Division 2";

  useEffect(() => {
    const ch = consumePendingStream();
    if (ch) setActiveStream(ch);
  }, []);

  const load = useCallback(async () => {
    try {
      const j = await apiFetch(`/twitch/streams?game=${encodeURIComponent(GAME)}&first=20`);
      if (j.ok) setStreams(j.streams || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const i = setInterval(load, 30000);
    return () => clearInterval(i);
  }, [load]);

  function handleCardClick(s: any) {
    setInterceptStream({
      userLogin: s.userLogin || s.user_login || "",
      userName: s.userName || s.user_name || "",
      title: s.title || "",
      viewerCount: Number(s.viewerCount || s.viewer_count || 0),
      thumbnailUrl: s.thumbnailUrl || s.thumbnail_url || "",
      gameName: GAME,
    });
  }

  if (loading)
    return (
      <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>
        Loading streams...
      </div>
    );
  if (streams.length === 0)
    return (
      <div style={{ textAlign: "center", padding: 30 }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>{"\u{1F4FA}"}</div>
        <div style={{ fontSize: 13, color: "var(--weered-muted, rgba(148,163,184,.55))" }}>
          Nobody streaming The Division 2 right now.
        </div>
      </div>
    );

  return (
    <>
      {activeStream && (
        <div
          style={{
            borderRadius: 2,
            overflow: "hidden",
            border: `1px solid ${accent}40`,
            background: "#000",
            marginBottom: 8,
          }}
        >
          <iframe
            title="The Division 2 stream"
            src={`https://player.twitch.tv/?channel=${activeStream}&parent=${typeof window !== "undefined" ? window.location.hostname : "weered.ca"}&muted=true`}
            width="100%"
            height="280"
            style={{ border: "none", display: "block" }}
            allowFullScreen
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 12px",
              background: `${accent}10`,
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: accent }}>{activeStream}</span>
            <button
              onClick={() => setActiveStream(null)}
              style={{ ...S.btn, fontSize: 11, padding: "4px 10px" }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {streams.map((s) => (
          <div
            key={s.userLogin}
            onClick={() => handleCardClick(s)}
            onKeyDown={onActivate(() => handleCardClick(s))}
            tabIndex={0}
            role="button"
            style={{
              ...S.card,
              cursor: "pointer",
              display: "flex",
              gap: 10,
              alignItems: "center",
              transition: "border-color .12s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = `${accent}44`)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,.06)")}
          >
            {s.thumbnailUrl && (
              <img
                src={(s.thumbnailUrl || "").replace("{width}", "80").replace("{height}", "45")}
                alt={s.userName + " stream thumbnail"}
                style={{
                  width: 80,
                  height: 45,
                  borderRadius: 2,
                  objectFit: "cover",
                  flexShrink: 0,
                  border: "1px solid rgba(255,255,255,.06)",
                }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {s.title}
              </div>
              <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>
                {s.userName} {"·"} {s.viewerCount?.toLocaleString()} viewers
              </div>
            </div>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#22c55e",
                boxShadow: "0 0 6px rgba(34,197,94,.6)",
                flexShrink: 0,
              }}
            />
          </div>
        ))}
      </div>

      <StreamInterceptModal
        stream={interceptStream}
        lobbyId={lobbyId}
        accentColor={accent}
        onClose={() => setInterceptStream(null)}
        onWatchHere={handleWatchHereProxy(setActiveStream)}
      />
    </>
  );
}

function handleWatchHereProxy(setActiveStream: (s: string) => void) {
  return (stream: StreamInfo) => setActiveStream(stream.userLogin);
}

interface Props {
  lobbyId: string;
  gameName?: string;
  accentColor?: string;
  style?: React.CSSProperties;
}

export default function Division2ModulesPanel({ lobbyId, accentColor, style }: Props) {
  const accent = accentColor || ACCENT_D2;
  const [tab, setTab] = useState<TabId>("ops");
  useWatchHere(
    useCallback(() => {
      setTab("streams");
    }, []),
  );

  return (
    <div
      style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, ...style }}
    >
      <div
        style={{
          display: "flex",
          gap: 2,
          borderBottom: "1px solid rgba(255,255,255,.07)",
          flexShrink: 0,
          overflowX: "auto",
          alignItems: "center",
        }}
      >
        <ModuleTabBar
          tabs={TABS.map((t) => ({
            id: t.id,
            label: t.label,
            icon: <span style={{ fontSize: 13 }}>{t.icon}</span>,
          }))}
          active={tab}
          onSelect={(id) => setTab(id as TabId)}
          accent={accent}
        />
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "14px 14px 14px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {tab === "ops" && <OpsBoard accent={accent} />}
        {tab === "lfg" && <SquadFinder lobbyId={lobbyId} accent={accent} />}
        {tab === "streams" && <TwitchStreams lobbyId={lobbyId} accent={accent} />}
      </div>

      <div
        style={{
          padding: "6px 14px 8px",
          flexShrink: 0,
          borderTop: "1px solid rgba(255,255,255,.04)",
        }}
      >
        <p
          style={{
            fontSize: 9,
            color: "rgba(100,116,139,.35)",
            lineHeight: 1.4,
            margin: 0,
            textAlign: "center",
          }}
        >
          Weered is not affiliated with, endorsed by, or sponsored by Ubisoft. Tom Clancy's The
          Division 2 is a trademark of Ubisoft Entertainment. Server status via Ubisoft's public
          status API.
        </p>
      </div>
    </div>
  );
}
