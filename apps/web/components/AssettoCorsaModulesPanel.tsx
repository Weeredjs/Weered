"use client";

// Assetto Corsa module — the server board a racing community would otherwise
// build a Discord bot for. Each configured server shows what it is running right
// now (circuit, session, countdown, slots) and WHO is on track, in what car,
// straight from the server's own public /INFO and /JSON endpoints.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import StreamInterceptModal, { type StreamInfo } from "./StreamInterceptModal";
import EmptyState from "./EmptyState";
import ModuleTabBar from "./ModuleTabBar";
import { useWatchHere, consumePendingStream } from "../lib/useWatchHere";
import { onActivate } from "@/lib/a11y";
import { ConfigBoard, readBoard, type BoardSpec } from "./ConfigBoards";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
const ACCENT_AC = "#e8452f";
const TWITCH_GAME = "Assetto Corsa";

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
    border: "1px solid rgba(232,69,47,.35)",
    background: "rgba(232,69,47,.12)",
    fontSize: 12,
    cursor: "pointer",
    color: "rgb(232,69,47)",
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

const AC_REGIONS = ["Any", "NA", "SA", "EU", "Asia", "Oceania"];
const AC_ACTIVITIES = [
  "Practice",
  "Qualifying",
  "Sprint race",
  "Endurance stint",
  "League round",
  "Hotlap session",
  "Drift",
  "Track day",
  "Coaching / setup help",
  "Other",
];

const TABS = [
  { id: "servers" as const, label: "Server Board", icon: "\u{1F3C1}" },
  { id: "lfg" as const, label: "Find a Race", icon: "\u{1F91D}" },
  { id: "streams" as const, label: "Live Streams", icon: "\u{1F4FA}" },
];
type TabId = (typeof TABS)[number]["id"] | string;

/** Boards a lobby can define in moduleConfig.demoData. The keys are fixed but
 *  every one is optional — a community configures only what it has. Tabs appear
 *  between the live board and the general tabs, because a community's own
 *  standings matter more to its members than our generic tooling does. */
const DEMO_BOARDS = [
  { key: "ranked", id: "demo-ranked", fallback: "Ranked", icon: "\u{1F3C6}" },
  { key: "records", id: "demo-records", fallback: "Records", icon: "\u{23F1}" },
  { key: "clean", id: "demo-clean", fallback: "Clean Racing", icon: "\u{1F6E1}" },
];

type AcDriver = { name: string; car: string; carLabel: string };
type AcServer = {
  id: string;
  label: string | null;
  name: string | null;
  online: boolean;
  trackLabel: string | null;
  sessionLabel: string | null;
  timeLeftSec: number | null;
  clients: number;
  maxClients: number;
  passworded: boolean;
  carLabels: string[];
  drivers: AcDriver[];
  joinUrl: string | null;
};

function countdown(sec: number | null): string | null {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return null;
  const h = Math.floor(sec / 3600),
    m = Math.floor((sec % 3600) / 60),
    s = Math.floor(sec % 60);
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${String(s).padStart(2, "0")}s` : `${s}s`;
}

/** Strips the community's own boilerplate out of a server name so the board
 *  reads cleanly — AC operators pack the name with the discord invite, the
 *  track, and the port because the in-game browser is one flat line of text. */
function tidyServerName(raw: string | null): string | null {
  if (!raw) return null;
  const cut = raw
    .split("|")
    .map((p) => p.trim())
    .filter((p) => p && !/discord\.gg|^ℹ|^\d+$/i.test(p));
  return cut.length ? cut.join(" · ") : raw;
}

/**
 * Resolves the lobby's accent and configured boards when the caller did not
 * supply them.
 *
 * The lobby page passes both. A ROOM cannot — the room stage only knows its
 * lobby id, and threading moduleConfig down through it would mean every future
 * game panel needs the same plumbing. So the panel asks for what it is missing,
 * and only for what it is missing: when both props are supplied, no request is
 * made at all.
 */
function useLobbyChrome(lobbyId: string, haveDemo: boolean, haveAccent: boolean) {
  const [chrome, setChrome] = useState<{ accent?: string; demoData?: unknown }>({});
  useEffect(() => {
    if (haveDemo && haveAccent) return;
    let dead = false;
    apiFetch(`/lobbies/${encodeURIComponent(lobbyId)}`)
      .then((j: any) => {
        if (dead || !j?.ok || !j.lobby) return;
        setChrome({
          accent: j.lobby.accentColor || undefined,
          demoData: j.lobby.moduleConfig?.demoData,
        });
      })
      .catch(() => {});
    return () => {
      dead = true;
    };
  }, [lobbyId, haveDemo, haveAccent]);
  return chrome;
}

function ServerBoard({ lobbyId, accent }: { lobbyId: string; accent: string }) {
  const [servers, setServers] = useState<AcServer[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [, tick] = useState(0);

  const load = useCallback(async () => {
    try {
      const j: any = await apiFetch(`/assetto/servers?lobby=${encodeURIComponent(lobbyId)}`);
      if (j?.ok && Array.isArray(j.servers)) {
        setServers(j.servers);
        setFailed(false);
      } else setFailed(true);
    } catch {
      setFailed(true);
    }
  }, [lobbyId]);

  useEffect(() => {
    load();
    const i = setInterval(load, 30_000);
    return () => clearInterval(i);
  }, [load]);
  // Local ticking so the session countdown moves between polls.
  useEffect(() => {
    const i = setInterval(() => tick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, []);

  if (servers === null && !failed)
    return (
      <div style={{ padding: 30, textAlign: "center", opacity: 0.4, fontSize: 13 }}>
        Reading the timing screens…
      </div>
    );
  if (failed && !servers)
    return (
      <div style={{ padding: 30, textAlign: "center", opacity: 0.5, fontSize: 13 }}>
        Server board unavailable — try again shortly.
      </div>
    );
  if (!servers || servers.length === 0) {
    return (
      <EmptyState
        icon="🏁"
        title="No servers on the board yet."
        hint="A lobby admin can add this community's Assetto Corsa servers, and the board fills itself in — no bot required."
      />
    );
  }

  const totalOnTrack = servers.reduce((n, s) => n + (s.clients || 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={S.label}>
          SERVER BOARD · {servers.length} server{servers.length === 1 ? "" : "s"}
        </div>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 11,
            fontFamily: "monospace",
            color: totalOnTrack > 0 ? "rgba(34,197,94,.85)" : "rgba(148,163,184,.5)",
          }}
        >
          {totalOnTrack > 0 ? `${totalOnTrack} on track now` : "garage quiet"}
        </span>
      </div>

      {servers.map((s) => {
        const live = s.online && s.clients > 0;
        const cd = countdown(s.timeLeftSec);
        const title = tidyServerName(s.name) || s.label || s.id;
        return (
          <div
            key={s.id}
            style={{
              ...S.card,
              borderColor: live
                ? "rgba(34,197,94,.30)"
                : s.online
                  ? "rgba(255,255,255,.08)"
                  : "rgba(239,68,68,.22)",
              padding: "12px 14px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  flexShrink: 0,
                  background: s.online ? (live ? "#22c55e" : "rgba(148,163,184,.45)") : "#ef4444",
                  boxShadow: live ? "0 0 7px #22c55e88" : "none",
                }}
              />
              <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(243,244,246,.94)" }}>
                {s.label || title}
              </span>
              {s.passworded && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    padding: "1px 6px",
                    borderRadius: 2,
                    background: "rgba(234,179,8,.12)",
                    color: "#eab308",
                  }}
                >
                  LOCKED
                </span>
              )}
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: 12,
                  fontFamily: "monospace",
                  fontWeight: 700,
                  color: live ? accent : "rgba(148,163,184,.55)",
                }}
              >
                {s.online ? `${s.clients}/${s.maxClients}` : "offline"}
              </span>
            </div>

            {s.online && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 7,
                  flexWrap: "wrap",
                  fontSize: 11.5,
                  color: "rgba(148,163,184,.75)",
                }}
              >
                {s.trackLabel && (
                  <span style={{ color: "rgba(243,244,246,.85)", fontWeight: 600 }}>
                    {s.trackLabel}
                  </span>
                )}
                {s.sessionLabel && <span>· {s.sessionLabel}</span>}
                {cd && <span style={{ fontFamily: "monospace" }}>· {cd} left</span>}
              </div>
            )}

            {s.drivers.length > 0 && (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ ...S.label, marginBottom: 2 }}>ON TRACK</div>
                {s.drivers.slice(0, 12).map((d, i) => (
                  <div
                    key={`${d.name}-${i}`}
                    style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}
                  >
                    <span
                      style={{
                        width: 18,
                        textAlign: "right",
                        fontSize: 10,
                        fontFamily: "monospace",
                        color: "rgba(148,163,184,.4)",
                      }}
                    >
                      {i + 1}
                    </span>
                    <span
                      style={{
                        fontWeight: 600,
                        color: "rgba(243,244,246,.9)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: 180,
                      }}
                    >
                      {d.name}
                    </span>
                    {d.carLabel && (
                      <span
                        style={{
                          fontSize: 10.5,
                          color: "rgba(148,163,184,.55)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {d.carLabel}
                      </span>
                    )}
                  </div>
                ))}
                {s.clients > s.drivers.length && (
                  <div style={{ fontSize: 10.5, color: "rgba(148,163,184,.45)", paddingLeft: 26 }}>
                    +{s.clients - s.drivers.length} more connecting
                  </div>
                )}
              </div>
            )}

            {s.online && s.drivers.length === 0 && s.carLabels.length > 0 && (
              <div style={{ marginTop: 8, fontSize: 11, color: "rgba(148,163,184,.5)" }}>
                Empty · {s.carLabels.slice(0, 4).join(", ")}
                {s.carLabels.length > 4 ? ` +${s.carLabels.length - 4} more` : ""}
              </div>
            )}

            {s.joinUrl && s.online && (
              <div style={{ marginTop: 10 }}>
                <a
                  href={s.joinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ ...S.btnPri, textDecoration: "none", display: "inline-block" }}
                >
                  Join session →
                </a>
              </div>
            )}
          </div>
        );
      })}

      <p
        style={{ fontSize: 10, color: "rgba(100,116,139,.4)", margin: "2px 0 0", lineHeight: 1.5 }}
      >
        Read live from each server&apos;s own public status endpoint — the same one the in-game
        browser uses. Join links open in Content Manager.
      </p>
    </div>
  );
}

function FindARace({ lobbyId, accent }: { lobbyId: string; accent: string }) {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activity, setActivity] = useState(AC_ACTIVITIES[0]);
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
    const regionStr = region !== "Any" ? ` [${region}]` : "";
    const j = await apiFetch(`/lfg/${encodeURIComponent(lobbyId)}`, {
      method: "POST",
      body: JSON.stringify({
        activity: `${activity}${regionStr}`,
        description: note,
        maxPlayers: 24,
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
  async function join(id: string) {
    const j = await apiFetch(`/lfg/${id}/join`, { method: "POST", body: JSON.stringify({}) });
    if (j.ok) load();
    else setMsg(j.message || j.error || "Failed to join");
  }
  async function leave(id: string) {
    const j = await apiFetch(`/lfg/${id}/leave`, { method: "POST", body: JSON.stringify({}) });
    if (j.ok) load();
    else setMsg(j.message || j.error || "Failed to leave");
  }

  if (loading)
    return (
      <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>
        Loading grid…
      </div>
    );
  const open = posts.filter((p) => p.status === "OPEN");

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
        <div style={S.label}>RACE FINDER ({open.length} open)</div>
        <button
          style={showForm ? S.btn : S.btnPri}
          onClick={() => {
            setShowForm(!showForm);
            setMsg("");
          }}
        >
          {showForm ? "Cancel" : "+ Post a race"}
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
              <div style={S.label}>Session</div>
              <select
                style={{ ...S.select, width: "100%" }}
                value={activity}
                onChange={(e) => setActivity(e.target.value)}
              >
                {AC_ACTIVITIES.map((a) => (
                  <option key={a} value={a}>
                    {a}
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
                {AC_REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <div style={S.label}>Details (optional)</div>
            <input
              style={S.input}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="GT3 at Spa, 20:00 UTC, no assists, clean drivers only..."
              maxLength={300}
            />
          </div>
          <button
            style={{ ...S.btnPri, padding: "10px 24px", alignSelf: "flex-start", fontSize: 13 }}
            onClick={create}
            disabled={creating}
          >
            {creating ? "Posting…" : "Post it"}
          </button>
        </div>
      )}

      {posts.length === 0 ? (
        <EmptyState
          icon="🤝"
          title="Nobody's looking for a race yet."
          hint="Post one — the board shows who's already on track."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {posts.map((p) => {
            const full = p.status === "FULL";
            const count = (p.players || []).length;
            const max = p.maxPlayers || 24;
            return (
              <div
                key={p.id}
                style={{
                  ...S.card,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  border: full ? `1px solid ${accent}30` : "1px solid rgba(255,255,255,.06)",
                  opacity: full ? 0.65 : 1,
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
                      background: full ? "rgba(239,68,68,.10)" : `${accent}12`,
                      color: full ? "#ef4444" : accent,
                      fontWeight: 700,
                    }}
                  >
                    {full ? "FULL" : "OPEN"}
                  </span>
                </div>
                <div
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <span style={{ fontSize: 10, color: "rgba(148,163,184,.35)" }}>
                    {count}/{max} · Host: {p.hostName || "Unknown"}
                  </span>
                  {!full ? (
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
  const [intercept, setIntercept] = useState<StreamInfo | null>(null);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const ch = consumePendingStream();
    if (ch) setActive(ch);
  }, []);
  const load = useCallback(async () => {
    try {
      const j = await apiFetch(`/twitch/streams?game=${encodeURIComponent(TWITCH_GAME)}&first=20`);
      if (j.ok) setStreams(j.streams || []);
    } catch {}
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
    const i = setInterval(load, 30000);
    return () => clearInterval(i);
  }, [load]);

  if (loading)
    return (
      <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>
        Loading streams…
      </div>
    );
  if (streams.length === 0)
    return (
      <div style={{ textAlign: "center", padding: 30 }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>{"\u{1F4FA}"}</div>
        <div style={{ fontSize: 13, color: "var(--weered-muted, rgba(148,163,184,.55))" }}>
          Nobody streaming Assetto Corsa right now.
        </div>
      </div>
    );

  return (
    <>
      {active && (
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
            title="Assetto Corsa stream"
            src={`https://player.twitch.tv/?channel=${active}&parent=${typeof window !== "undefined" ? window.location.hostname : "weered.ca"}&muted=true`}
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
            <span style={{ fontSize: 12, fontWeight: 700, color: accent }}>{active}</span>
            <button
              onClick={() => setActive(null)}
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
            onClick={() =>
              setIntercept({
                userLogin: s.userLogin,
                userName: s.userName,
                title: s.title,
                viewerCount: s.viewerCount,
                thumbnailUrl: s.thumbnailUrl,
                gameName: TWITCH_GAME,
              })
            }
            onKeyDown={onActivate(() =>
              setIntercept({
                userLogin: s.userLogin,
                userName: s.userName,
                title: s.title,
                viewerCount: s.viewerCount,
                thumbnailUrl: s.thumbnailUrl,
                gameName: TWITCH_GAME,
              }),
            )}
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
        stream={intercept}
        lobbyId={lobbyId}
        accentColor={accent}
        onClose={() => setIntercept(null)}
        onWatchHere={(st) => setActive(st.userLogin)}
      />
    </>
  );
}

interface Props {
  lobbyId: string;
  gameName?: string;
  accentColor?: string;
  /** moduleConfig.demoData — boards this community has configured. Optional;
   *  a lobby without it renders exactly the tabs it always did. */
  demoData?: unknown;
  style?: React.CSSProperties;
}

export default function AssettoCorsaModulesPanel({ lobbyId, accentColor, demoData, style }: Props) {
  const chrome = useLobbyChrome(lobbyId, demoData !== undefined, Boolean(accentColor));
  const accent = accentColor || chrome.accent || ACCENT_AC;
  const effectiveDemo = demoData !== undefined ? demoData : chrome.demoData;
  const [tab, setTab] = useState<TabId>("servers");
  useWatchHere(
    useCallback(() => {
      setTab("streams");
    }, []),
  );

  // Boards this lobby actually defines, in a fixed order. A community with no
  // configured boards sees exactly the tabs it saw before.
  const boards = useMemo(() => {
    const src = (effectiveDemo ?? {}) as Record<string, unknown>;
    return DEMO_BOARDS.map((b) => ({ ...b, board: readBoard(src[b.key]) })).filter(
      (b): b is typeof b & { board: BoardSpec } => b.board != null,
    );
  }, [effectiveDemo]);
  const isSample = Boolean((effectiveDemo as any)?.sample);

  const tabs = useMemo(() => {
    const base = TABS.map((t) => ({ id: t.id as string, label: t.label, icon: t.icon }));
    const extra = boards.map((b) => ({
      id: b.id,
      label: b.board.title || b.fallback,
      icon: b.icon,
    }));
    // Live board first, then the community's own boards, then generic tooling.
    return [base[0], ...extra, ...base.slice(1)].map((t) => ({
      id: t.id,
      label: t.label,
      icon: <span style={{ fontSize: 13 }}>{t.icon}</span>,
    }));
  }, [boards]);

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
          tabs={tabs}
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
          padding: "14px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {tab === "servers" && <ServerBoard lobbyId={lobbyId} accent={accent} />}
        {tab === "lfg" && <FindARace lobbyId={lobbyId} accent={accent} />}
        {tab === "streams" && <TwitchStreams lobbyId={lobbyId} accent={accent} />}
        {boards.map(
          (b) =>
            tab === b.id && (
              <ConfigBoard key={b.id} board={b.board} accent={accent} sample={isSample} />
            ),
        )}
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
          Weered is not affiliated with, endorsed by, or sponsored by Kunos Simulazioni. Assetto
          Corsa is a trademark of Kunos Simulazioni. Server data comes from each server&apos;s own
          public status endpoint.
        </p>
      </div>
    </div>
  );
}
