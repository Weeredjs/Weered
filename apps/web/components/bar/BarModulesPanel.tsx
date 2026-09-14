"use client";

import React, { useEffect, useMemo, useState } from "react";
import ModuleTabBar from "../ModuleTabBar";
import { useBarMaps } from "./useBarMaps";
import MapThumb from "./MapThumb";
import { useBarDesktopStatus } from "../room/BarLaunch";

// Beyond All Reason lobby module. Data comes from BAR's public live services
// through our API (routes/bar.ts), cached server-side. Private battles are the
// point: half of BAR's live games on 2026-09-14 were passworded friend groups
// averaging 2.3 players, which is exactly who a lobby is for.

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
const DEFAULT_ACCENT = "#4FA3E0";

const TABS = [
  { id: "live", label: "Live" },
  { id: "matches", label: "Matches" },
  { id: "maps", label: "Maps" },
  { id: "launcher", label: "Room launcher" },
] as const;
type TabId = (typeof TABS)[number]["id"];

type Battle = {
  id: number;
  title: string;
  map: string;
  gameType: string;
  preset: string;
  running: boolean;
  gameTimeSec: number | null;
  passworded: boolean;
  players: number;
  maxPlayers: number;
  spectators: number;
};

type Member = {
  userId: string;
  name: string;
  avatarColor: string | null;
  barName: string;
  role: "player" | "spectator" | null;
  battle: Battle | null;
};

type FeedRow = {
  id: string;
  startTime: string;
  durationMin: number;
  map: string;
  players: number;
  bots: boolean;
  members: { userId: string; name: string; barName: string; result: "win" | "loss" | "none" }[];
};

type MembersResponse = {
  ok: boolean;
  error?: string;
  linkedCount: number;
  inGame: number;
  members: Member[];
  openGames: Battle[];
  feed: FeedRow[];
};

function authHeaders(): Record<string, string> {
  try {
    const t = localStorage.getItem("weered_token") || "";
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

function ago(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "";
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

function clock(sec: number | null): string {
  if (sec === null || sec <= 0) return "starting";
  const m = Math.floor(sec / 60);
  return `${m}m in`;
}

function useMembers(lobbyId: string) {
  const [data, setData] = useState<MembersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(`${API}/lobbies/${encodeURIComponent(lobbyId)}/bar/members`, {
          headers: authHeaders(),
          credentials: "include",
        });
        const j = await r.json();
        if (!alive) return;
        if (j?.ok) {
          setData(j);
          setError(null);
        } else {
          setError(j?.error || "unavailable");
        }
      } catch {
        if (alive) setError("unavailable");
      }
    };
    void load();
    const t = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [lobbyId]);
  return { data, error };
}

export default function BarModulesPanel({
  lobbyId,
  accentColor,
  style,
}: {
  lobbyId: string;
  accentColor?: string;
  style?: React.CSSProperties;
}) {
  const accent = accentColor || DEFAULT_ACCENT;
  const [tab, setTab] = useState<TabId>("live");
  const { data, error } = useMembers(lobbyId);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, ...style }}>
      <ModuleTabBar
        tabs={TABS}
        active={tab}
        onSelect={(id) => setTab(id as TabId)}
        accent={accent}
      />
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "12px 4px 20px" }}>
        {tab === "live" && <LiveTab data={data} error={error} accent={accent} />}
        {tab === "matches" && <MatchesTab data={data} error={error} />}
        {tab === "maps" && <MapsTab accent={accent} />}
        {tab === "launcher" && <LauncherTab accent={accent} />}
      </div>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "14px 16px",
        borderRadius: 10,
        background: "rgba(255,255,255,.03)",
        border: "1px solid rgba(255,255,255,.07)",
        fontSize: 13,
        lineHeight: 1.5,
        color: "rgba(203,213,225,.8)",
      }}
    >
      {children}
    </div>
  );
}

function errorCopy(error: string | null) {
  if (error === "members_only") return "Join the lobby to see who's playing.";
  if (error === "unauthorized") return "Sign in to see who's playing.";
  return "Beyond All Reason's live data is unreachable right now. It'll retry on its own.";
}

const LINK_HINT = (
  <>
    Link your Beyond All Reason name in <b>Settings → Presence</b> and you'll show up here the
    moment you're in a game.
  </>
);

function LiveTab({
  data,
  error,
  accent,
}: {
  data: MembersResponse | null;
  error: string | null;
  accent: string;
}) {
  if (!data) return <Notice>{error ? errorCopy(error) : "Checking who's in a game…"}</Notice>;

  const playing = data.members.filter((m) => m.battle);
  const idle = data.members.filter((m) => !m.battle);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Stat label="In a game" value={data.inGame} accent={accent} />
        <Stat label="Linked members" value={data.linkedCount} accent={accent} />
        <Stat label="Open public games" value={data.openGames.length} accent={accent} />
      </div>

      {data.linkedCount === 0 ? (
        <Notice>{LINK_HINT}</Notice>
      ) : (
        <>
          <Section title="Playing now">
            {playing.length === 0 ? (
              <div style={muted}>Nobody from the lobby is in a game.</div>
            ) : (
              playing.map((m) => (
                <div key={m.userId} style={card}>
                  <Avatar name={m.name} color={m.avatarColor} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>
                      {m.name} <span style={muted}>as {m.barName}</span>
                    </div>
                    <div style={{ ...muted, marginTop: 2 }}>
                      {m.role === "spectator" ? "Spectating · " : ""}
                      {m.battle!.map} · {m.battle!.gameType || m.battle!.preset} ·{" "}
                      {m.battle!.players}/{m.battle!.maxPlayers}
                      {m.battle!.passworded ? " · private" : ""}
                    </div>
                  </div>
                  <span style={{ ...pill, borderColor: `${accent}88`, color: accent }}>
                    {m.battle!.running ? clock(m.battle!.gameTimeSec) : "in lobby"}
                  </span>
                </div>
              ))
            )}
          </Section>

          {idle.length > 0 && (
            <Section title="Not in a game">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {idle.map((m) => (
                  <span key={m.userId} style={chip} title={`BAR name: ${m.barName}`}>
                    {m.name}
                  </span>
                ))}
              </div>
            </Section>
          )}
        </>
      )}

      <Section title="Public games looking for players">
        {data.openGames.length === 0 ? (
          <div style={muted}>No open public games right now.</div>
        ) : (
          data.openGames.map((b) => (
            <div key={b.id} style={row}>
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {b.title || b.map}
              </span>
              <span style={muted}>{b.map}</span>
              <span style={mono}>
                {b.players}/{b.maxPlayers}
              </span>
            </div>
          ))
        )}
        {data.openGames.length > 0 && (
          <div style={{ ...muted, marginTop: 6 }}>Join these from BAR's own lobby.</div>
        )}
      </Section>
    </div>
  );
}

function MatchesTab({ data, error }: { data: MembersResponse | null; error: string | null }) {
  const maps = useBarMaps();
  const fileFor = useMemo(() => {
    const m = new Map<string, string>();
    for (const row of maps || []) m.set(row.scriptName, row.fileName);
    return m;
  }, [maps]);

  if (!data) return <Notice>{error ? errorCopy(error) : "Loading recent matches…"}</Notice>;
  if (data.linkedCount === 0) return <Notice>{LINK_HINT}</Notice>;
  if (data.feed.length === 0) {
    return (
      <Notice>
        No recent public matches from linked members. Private and room-launched games aren't
        recorded by BAR.
      </Notice>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {data.feed.map((f) => {
        const file = fileFor.get(f.map);
        return (
          <div key={f.id} style={card}>
            {file ? (
              <MapThumb fileName={file} style={thumb} />
            ) : (
              <div style={{ ...thumb, background: "rgba(255,255,255,.05)" }} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{f.map}</div>
              <div style={{ ...muted, marginTop: 2 }}>
                {ago(f.startTime)} · {f.durationMin} min · {f.players} players
                {f.bots ? " · with AI" : ""}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
                {f.members.map((m) => (
                  <span
                    key={m.userId}
                    style={{
                      ...chip,
                      borderColor:
                        m.result === "win"
                          ? "rgba(34,197,94,.45)"
                          : m.result === "loss"
                            ? "rgba(239,68,68,.4)"
                            : "rgba(255,255,255,.1)",
                      color:
                        m.result === "win"
                          ? "#86efac"
                          : m.result === "loss"
                            ? "#fca5a5"
                            : "rgba(203,213,225,.75)",
                    }}
                  >
                    {m.name} {m.result === "win" ? "W" : m.result === "loss" ? "L" : ""}
                  </span>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MapsTab({ accent }: { accent: string }) {
  const maps = useBarMaps();
  const [q, setQ] = useState("");
  const [size, setSize] = useState<"all" | "small" | "medium" | "large">("all");
  const [shown, setShown] = useState(60);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (maps || []).filter((m) => {
      if (needle && !m.scriptName.toLowerCase().includes(needle)) return false;
      const w = Math.max(m.width || 0, m.height || 0);
      if (size === "small") return w > 0 && w <= 12;
      if (size === "medium") return w > 12 && w <= 20;
      if (size === "large") return w > 20;
      return true;
    });
  }, [maps, q, size]);

  if (!maps) return <Notice>Loading the map catalogue…</Notice>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value.slice(0, 60));
            setShown(60);
          }}
          placeholder={`Search ${maps.length} maps`}
          style={{ ...inputStyle, flex: 1, minWidth: 180 }}
        />
        {(["all", "small", "medium", "large"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSize(s)}
            style={{
              ...chip,
              cursor: "pointer",
              ...(size === s ? { borderColor: accent, color: accent } : null),
            }}
          >
            {s === "all" ? "All sizes" : s[0].toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 10,
        }}
      >
        {filtered.slice(0, shown).map((m) => (
          <div
            key={m.scriptName}
            style={{ ...card, flexDirection: "column", alignItems: "stretch", padding: 8 }}
            title={m.description}
          >
            <MapThumb
              fileName={m.fileName}
              style={{
                width: "100%",
                aspectRatio: "1 / 1",
                objectFit: "cover",
                borderRadius: 6,
                background: "#111",
              }}
            />
            <div style={{ fontWeight: 700, fontSize: 12, marginTop: 6 }}>{m.scriptName}</div>
            <div style={{ ...muted, marginTop: 2 }}>
              {m.width && m.height ? `${m.width}×${m.height}` : "?"}
              {m.startPositions ? ` · ${m.startPositions} starts` : ""}
              {m.minWind !== null && m.maxWind !== null ? ` · wind ${m.minWind}–${m.maxWind}` : ""}
            </div>
          </div>
        ))}
      </div>
      {filtered.length > shown && (
        <button
          type="button"
          onClick={() => setShown((n) => n + 60)}
          style={{ ...chip, cursor: "pointer", alignSelf: "center" }}
        >
          Show more ({filtered.length - shown} left)
        </button>
      )}
    </div>
  );
}

function LauncherTab({ accent }: { accent: string }) {
  const { desktop, status, error, refresh, setDir } = useBarDesktopStatus();
  const [dir, setDirInput] = useState("");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Notice>
        Set up a game inside any room in this lobby: pick the map and mode, players slot in and
        ready up, the host fires. Everyone with the Weered desktop app is launched straight into
        BAR. The host shares their screen so everyone else watches in the room, and{" "}
        <b>Ctrl+Shift+F8</b> switches that share off and on from inside the game.
      </Notice>

      <Section title="This PC">
        {!desktop ? (
          <div style={muted}>
            You're in a browser. Launching BAR needs the Weered desktop app; watching the stream
            doesn't.
          </div>
        ) : error ? (
          <div style={{ ...muted, color: "#fca5a5" }}>{error}</div>
        ) : !status ? (
          <div style={muted}>Checking for Beyond All Reason…</div>
        ) : status.found && !status.error ? (
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>
            <div>
              <span style={{ color: "#86efac" }}>Ready.</span>{" "}
              <span style={muted}>{status.install_dir}</span>
            </div>
            <div style={muted}>
              {status.game} · engine {status.engine}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={muted}>
              {status.error ||
                "Weered can't find Beyond All Reason. Paste the folder that contains BAR's data folder."}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                value={dir}
                onChange={(e) => setDirInput(e.target.value.slice(0, 260))}
                placeholder="F:\Games\Beyond-All-Reason"
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                type="button"
                onClick={() => setDir(dir)}
                disabled={!dir.trim()}
                style={{ ...chip, cursor: "pointer", borderColor: accent, color: accent }}
              >
                Use folder
              </button>
              <button
                type="button"
                onClick={() => refresh()}
                style={{ ...chip, cursor: "pointer" }}
              >
                Recheck
              </button>
            </div>
          </div>
        )}
      </Section>

      <Section title="Before the first game">
        <ul
          style={{
            margin: 0,
            paddingLeft: 18,
            fontSize: 13,
            lineHeight: 1.7,
            color: "rgba(203,213,225,.85)",
          }}
        >
          <li>Everyone playing needs BAR installed and updated once.</li>
          <li>
            The host needs UDP port 8452 forwarded, or the group joins the same VPN and uses the
            host's VPN address.
          </li>
          <li>
            Room games run outside BAR's servers, so they're unrated and don't appear in BAR's
            replays.
          </li>
          <li>
            Co-op against Raptors or Scavengers needs no port at all when everyone plays on the
            host's PC.
          </li>
        </ul>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "1.6px",
          textTransform: "uppercase",
          color: "rgba(148,163,184,.7)",
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{children}</div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div
      style={{ ...card, flexDirection: "column", alignItems: "flex-start", gap: 2, minWidth: 120 }}
    >
      <span
        style={{ fontSize: 22, fontWeight: 900, color: accent, fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </span>
      <span
        style={{
          ...muted,
          textTransform: "uppercase",
          letterSpacing: ".6px",
          fontSize: 9,
          fontWeight: 800,
        }}
      >
        {label}
      </span>
    </div>
  );
}

function Avatar({ name, color }: { name: string; color: string | null }) {
  return (
    <div
      style={{
        width: 30,
        height: 30,
        borderRadius: "50%",
        background: color || "rgba(79,163,224,.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
        fontWeight: 800,
        flexShrink: 0,
      }}
    >
      {(name || "?").slice(0, 1).toUpperCase()}
    </div>
  );
}

const muted: React.CSSProperties = { fontSize: 11, color: "rgba(148,163,184,.75)" };
const mono: React.CSSProperties = {
  fontSize: 11,
  fontFamily: "ui-monospace, monospace",
  color: "rgba(203,213,225,.8)",
};
const card: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 12px",
  borderRadius: 10,
  background: "rgba(255,255,255,.03)",
  border: "1px solid rgba(255,255,255,.07)",
  color: "rgba(229,231,235,.92)",
};
const row: React.CSSProperties = { ...card, padding: "7px 12px", fontSize: 12 };
const chip: React.CSSProperties = {
  padding: "3px 9px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 600,
  background: "rgba(255,255,255,.04)",
  border: "1px solid rgba(255,255,255,.1)",
  color: "rgba(203,213,225,.8)",
  fontFamily: "inherit",
};
const pill: React.CSSProperties = {
  ...chip,
  background: "transparent",
  fontFamily: "ui-monospace, monospace",
  flexShrink: 0,
};
const thumb: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 6,
  objectFit: "cover",
  flexShrink: 0,
  background: "#111",
};
const inputStyle: React.CSSProperties = {
  padding: "8px 11px",
  borderRadius: 8,
  background: "rgba(0,0,0,.3)",
  border: "1px solid rgba(255,255,255,.1)",
  color: "rgba(243,244,246,.95)",
  fontFamily: "inherit",
  fontSize: 13,
  outline: "none",
};
