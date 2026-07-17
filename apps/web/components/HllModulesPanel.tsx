"use client";

import React, { useEffect, useMemo, useState } from "react";
import ModuleTabBar from "./ModuleTabBar";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
const ACCENT = "#BFA46F"; // brass over field-grey — HLL's palette

function authHeaders(): Record<string, string> {
  try {
    const t = localStorage.getItem("weered_token") || "";
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

const TABS = [
  { id: "frontlines" as const, label: "Front Lines" },
  { id: "seeding" as const, label: "Seeding Ops" },
  { id: "garrison" as const, label: "Garrison" },
  { id: "artillery" as const, label: "Artillery School" },
  { id: "intel" as const, label: "Intel" },
];
type TabId = (typeof TABS)[number]["id"];

// ---- shared bits -----------------------------------------------------------

type BmServer = {
  id: string;
  name: string;
  players: number;
  maxPlayers: number;
  map: string | null;
  country: string | null;
  rank: number | null;
};

const EU = new Set("GB DE FR NL BE ES IT PL SE NO DK FI AT CH CZ PT IE HU RO GR UA".split(" "));
const NA = new Set(["US", "CA", "MX"]);
const OCE = new Set(["AU", "NZ"]);
function regionOf(country: string | null): "EU" | "NA" | "OCE" | "ASIA" | "OTHER" {
  if (!country) return "OTHER";
  if (EU.has(country)) return "EU";
  if (NA.has(country)) return "NA";
  if (OCE.has(country)) return "OCE";
  if (["JP", "KR", "CN", "SG", "HK", "TW", "TH", "VN", "IN"].includes(country)) return "ASIA";
  return "OTHER";
}

const MAP_NAMES: Record<string, string> = {
  carentan: "Carentan",
  foy: "Foy",
  hill400: "Hill 400",
  hurtgenforest: "Hürtgen Forest",
  kharkov: "Kharkov",
  kursk: "Kursk",
  stalingrad: "Stalingrad",
  remagen: "Remagen",
  mortain: "Mortain",
  driel: "Driel",
  elalamein: "El Alamein",
  elsenbornridge: "Elsenborn Ridge",
  purpleheartlane: "Purple Heart Lane",
  stmariedumont: "St. Marie du Mont",
  stmereeglise: "Ste. Mère Église",
  utahbeach: "Utah Beach",
  omahabeach: "Omaha Beach",
  tobruk: "Tobruk",
};
function prettyMap(raw: string | null): string {
  if (!raw) return "—";
  const lower = raw.toLowerCase();
  const base = lower.split("_")[0];
  const name = MAP_NAMES[base] || base.charAt(0).toUpperCase() + base.slice(1);
  const mode = lower.includes("off")
    ? " · Offensive"
    : lower.includes("skirmish")
      ? " · Skirmish"
      : "";
  return name + mode;
}

// Seeding window: below ~5 the server is idle; 5–39 is the grind where every
// body counts; 40+ the game is alive and sells itself.
function seedState(players: number): "empty" | "seeding" | "live" {
  if (players < 5) return "empty";
  if (players < 40) return "seeding";
  return "live";
}

const S: Record<string, React.CSSProperties> = {
  wrap: { display: "flex", flexDirection: "column", overflow: "hidden" },
  body: { flex: 1, minHeight: 0, overflow: "auto", padding: "4px 14px 20px" },
  kick: {
    fontSize: 10.5,
    fontWeight: 700,
    letterSpacing: ".16em",
    textTransform: "uppercase",
    color: "rgba(191,164,111,.85)",
    margin: "14px 0 8px",
  },
  card: {
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.07)",
    borderRadius: 10,
    padding: "12px 14px",
    marginBottom: 10,
  },
  muted: { color: "rgba(148,163,184,.75)", fontSize: 12.5, lineHeight: 1.55 },
  row: { display: "flex", alignItems: "center", gap: 10 },
  btn: {
    padding: "6px 12px",
    borderRadius: 6,
    border: "1px solid rgba(191,164,111,.5)",
    background: "rgba(191,164,111,.14)",
    color: "#E3D3AC",
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
  },
  btnQuiet: {
    padding: "6px 12px",
    borderRadius: 6,
    border: "1px solid rgba(255,255,255,.14)",
    background: "transparent",
    color: "rgba(226,232,240,.85)",
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
  },
  input: {
    padding: "7px 10px",
    borderRadius: 6,
    border: "1px solid rgba(255,255,255,.14)",
    background: "rgba(0,0,0,.25)",
    color: "rgba(236,242,250,.95)",
    fontSize: 13,
  },
  badge: {
    fontSize: 9.5,
    fontWeight: 800,
    letterSpacing: ".1em",
    padding: "2px 7px",
    borderRadius: 999,
  },
};

function FillBar({ players, max, accent }: { players: number; max: number; accent: string }) {
  const pct = Math.min(100, Math.round((players / Math.max(1, max)) * 100));
  const st = seedState(players);
  const color = st === "seeding" ? "#E0B653" : st === "live" ? accent : "rgba(148,163,184,.5)";
  return (
    <div
      style={{
        height: 4,
        borderRadius: 2,
        background: "rgba(255,255,255,.08)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          background: color,
          transition: "width 600ms ease",
        }}
      />
    </div>
  );
}

function SeedBadge({ players }: { players: number }) {
  const st = seedState(players);
  if (st === "seeding")
    return (
      <span style={{ ...S.badge, color: "#E0B653", border: "1px solid rgba(224,182,83,.45)" }}>
        SEEDING
      </span>
    );
  if (st === "live")
    return (
      <span style={{ ...S.badge, color: "#8FBF7F", border: "1px solid rgba(143,191,127,.4)" }}>
        LIVE
      </span>
    );
  return (
    <span
      style={{
        ...S.badge,
        color: "rgba(148,163,184,.6)",
        border: "1px solid rgba(148,163,184,.3)",
      }}
    >
      IDLE
    </span>
  );
}

// ---- Front Lines (server browser) ------------------------------------------

function FrontLines({ accent }: { accent: string }) {
  const [servers, setServers] = useState<BmServer[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [region, setRegion] = useState<string>("ALL");
  const [seedOnly, setSeedOnly] = useState(false);
  const [q, setQ] = useState("");
  const [copied, setCopied] = useState<string>("");

  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const r = await fetch(`${API}/hll/servers`);
        const j = await r.json();
        if (!stop && j?.ok) setServers(j.servers || []);
      } catch {}
      if (!stop) setLoaded(true);
    };
    void load();
    const iv = setInterval(load, 60_000);
    return () => {
      stop = true;
      clearInterval(iv);
    };
  }, []);

  const shown = useMemo(() => {
    let list = servers;
    if (region !== "ALL") list = list.filter((s) => regionOf(s.country) === region);
    if (seedOnly) list = list.filter((s) => seedState(s.players) === "seeding");
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      list = list.filter((s) => s.name.toLowerCase().includes(needle));
    }
    return list;
  }, [servers, region, seedOnly, q]);

  const copyName = (s: BmServer) => {
    try {
      void navigator.clipboard.writeText(s.name);
      setCopied(s.id);
      setTimeout(() => setCopied(""), 1600);
    } catch {}
  };

  return (
    <div>
      <div style={{ ...S.row, flexWrap: "wrap", marginTop: 12 }}>
        {["ALL", "EU", "NA", "OCE", "ASIA"].map((r) => (
          <button key={r} style={region === r ? S.btn : S.btnQuiet} onClick={() => setRegion(r)}>
            {r === "ALL" ? "All regions" : r}
          </button>
        ))}
        <button style={seedOnly ? S.btn : S.btnQuiet} onClick={() => setSeedOnly((v) => !v)}>
          Seeding only
        </button>
        <input
          style={{ ...S.input, flex: 1, minWidth: 140 }}
          placeholder="Search servers…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div style={S.kick}>
        {shown.length} server{shown.length === 1 ? "" : "s"} · live population
      </div>
      {!loaded && <div style={S.muted}>Contacting the front…</div>}
      {loaded && shown.length === 0 && (
        <div style={S.muted}>No servers match. Widen the filters.</div>
      )}
      {shown.map((s) => (
        <div key={s.id} style={S.card}>
          <div style={{ ...S.row, justifyContent: "space-between" }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: 13.5,
                  fontWeight: 700,
                  color: "rgba(236,242,250,.95)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={s.name}
              >
                {s.name}
              </div>
              <div style={{ ...S.muted, marginTop: 2 }}>
                {prettyMap(s.map)} · {s.country || "?"}
                {s.rank ? ` · #${s.rank}` : ""}
              </div>
            </div>
            <SeedBadge players={s.players} />
            <div
              style={{
                fontVariantNumeric: "tabular-nums",
                fontWeight: 800,
                fontSize: 14,
                color: "rgba(236,242,250,.95)",
                width: 64,
                textAlign: "right",
              }}
            >
              {s.players}/{s.maxPlayers}
            </div>
          </div>
          <div style={{ margin: "8px 0 6px" }}>
            <FillBar players={s.players} max={s.maxPlayers} accent={accent} />
          </div>
          <div style={{ ...S.row, justifyContent: "flex-end", gap: 8 }}>
            <a
              href={`https://www.battlemetrics.com/servers/hll/${s.id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...S.btnQuiet, textDecoration: "none" }}
            >
              BattleMetrics
            </a>
            <button style={S.btnQuiet} onClick={() => copyName(s)}>
              {copied === s.id ? "Copied — search it in-game" : "Copy name"}
            </button>
          </div>
        </div>
      ))}
      <div style={{ ...S.muted, marginTop: 6 }}>
        HLL has no direct-join link — copy the server name and find it in the in-game browser.
      </div>
    </div>
  );
}

// ---- Seeding Ops (rally board) ---------------------------------------------

type RallyView = {
  id: string;
  bmServerId: string;
  serverName: string;
  note: string;
  target: number;
  armedByName: string;
  createdAt: number;
  expiresAt: number;
  players: number | null;
  maxPlayers: number | null;
  map: string | null;
  verifiedMode?: boolean;
  joiners: { id: string; name: string; verified?: boolean }[];
};

function SeedingOps({ accent, currentUserId }: { accent: string; currentUserId?: string }) {
  const [rallies, setRallies] = useState<RallyView[]>([]);
  const [canArm, setCanArm] = useState(false);
  const [joinedIds, setJoinedIds] = useState<string[]>([]);
  const [meSteamLinked, setMeSteamLinked] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [servers, setServers] = useState<BmServer[]>([]);
  const [armServer, setArmServer] = useState("");
  const [armNote, setArmNote] = useState("");
  const [err, setErr] = useState("");

  const load = async () => {
    try {
      const r = await fetch(`${API}/hll/rallies`, { headers: authHeaders() });
      const j = await r.json();
      if (j?.ok) {
        setRallies(j.rallies || []);
        setCanArm(!!j.canArm);
        setJoinedIds(j.joinedIds || []);
        setMeSteamLinked(j.meSteamLinked !== false);
      }
    } catch {}
    setLoaded(true);
  };

  useEffect(() => {
    void load();
    const iv = setInterval(load, 45_000);
    fetch(`${API}/hll/servers`)
      .then((r) => r.json())
      .then((j) => j?.ok && setServers(j.servers || []))
      .catch(() => {});
    return () => clearInterval(iv);
  }, []);

  const act = async (path: string, body?: any) => {
    setErr("");
    try {
      const r = await fetch(`${API}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: body ? JSON.stringify(body) : undefined,
      });
      const j = await r.json();
      if (!j?.ok) {
        setErr(
          j?.error === "cooldown"
            ? "A rally was armed recently — give it an hour."
            : j?.error === "rally_exists"
              ? "That server already has an active rally."
              : j?.error === "mods_only"
                ? "Only lobby moderators can arm a rally."
                : "That didn't go through.",
        );
        return;
      }
      await load();
    } catch {
      setErr("That didn't go through.");
    }
  };

  return (
    <div>
      <div style={{ ...S.card, marginTop: 12 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: "rgba(236,242,250,.95)" }}>
          The seeding problem, solved by showing up
        </div>
        <div style={{ ...S.muted, marginTop: 4 }}>
          An HLL server below 40 players isn&rsquo;t a game yet — it&rsquo;s a queue with scenery. A
          rally is a call to fill one specific server, together, now. Arm one, join one, and the
          lobby gets pinged. When it hits the threshold, everyone plays.
        </div>
      </div>

      {canArm && (
        <div style={S.card}>
          <div style={S.kick}>Arm a rally</div>
          <div style={{ ...S.row, flexWrap: "wrap" }}>
            <select
              style={{ ...S.input, flex: 2, minWidth: 200 }}
              value={armServer}
              onChange={(e) => setArmServer(e.target.value)}
            >
              <option value="">Pick a server…</option>
              {servers
                .filter((s) => seedState(s.players) !== "live")
                .slice(0, 50)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name.slice(0, 60)} ({s.players}/{s.maxPlayers})
                  </option>
                ))}
            </select>
            <input
              style={{ ...S.input, flex: 3, minWidth: 180 }}
              placeholder="Note (optional) — e.g. Friday fight night, seed by 7pm AT"
              value={armNote}
              maxLength={180}
              onChange={(e) => setArmNote(e.target.value)}
            />
            <button
              style={S.btn}
              onClick={() =>
                armServer && act("/hll/rallies", { bmServerId: armServer, note: armNote })
              }
            >
              Arm + ping the lobby
            </button>
          </div>
        </div>
      )}
      {err && <div style={{ ...S.muted, color: "#E08A83" }}>{err}</div>}

      {currentUserId && !meSteamLinked && rallies.some((r) => r.verifiedMode) && (
        <div style={{ ...S.card, borderColor: "rgba(224,182,83,.4)" }}>
          <div style={{ ...S.muted, color: "#E0B653" }}>
            A rally here has verified seeding: link your SteamID64 in Settings and you earn
            notoriety automatically when you actually show up on the server.
          </div>
        </div>
      )}

      <div style={S.kick}>Active rallies</div>
      {!loaded && <div style={S.muted}>Checking the board…</div>}
      {loaded && rallies.length === 0 && (
        <div style={S.muted}>
          No active rallies. Quiet board, quiet servers — a moderator can arm one from the form
          above{canArm ? "" : " (moderators only)"}.
        </div>
      )}
      {rallies.map((r) => {
        const joined = joinedIds.includes(r.id);
        const players = r.players ?? 0;
        const hit = players >= r.target;
        return (
          <div
            key={r.id}
            style={{
              ...S.card,
              borderColor: hit ? "rgba(143,191,127,.4)" : "rgba(191,164,111,.35)",
            }}
          >
            <div style={{ ...S.row, justifyContent: "space-between" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ ...S.row, gap: 8 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "rgba(236,242,250,.95)" }}>
                    {r.serverName}
                  </div>
                  {r.verifiedMode && (
                    <span
                      style={{
                        ...S.badge,
                        color: "#8FBF7F",
                        border: "1px solid rgba(143,191,127,.4)",
                      }}
                      title="This server is linked — showing up earns notoriety automatically"
                    >
                      ✓ VERIFIED
                    </span>
                  )}
                </div>
                <div style={{ ...S.muted, marginTop: 2 }}>
                  {prettyMap(r.map)} · armed by {r.armedByName}
                  {r.note ? ` · “${r.note}”` : ""}
                </div>
              </div>
              <div
                style={{
                  fontVariantNumeric: "tabular-nums",
                  fontWeight: 800,
                  fontSize: 15,
                  color: hit ? "#8FBF7F" : "#E0B653",
                }}
              >
                {r.players == null ? "—" : `${players}/${r.target}`}
              </div>
            </div>
            <div style={{ margin: "8px 0 6px" }}>
              <FillBar players={players} max={r.target} accent={hit ? "#8FBF7F" : accent} />
            </div>
            <div style={{ ...S.row, justifyContent: "space-between" }}>
              <div
                style={{
                  ...S.muted,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {hit
                  ? "Threshold hit — the server is alive. Good work."
                  : r.joiners.length <= 1
                    ? "Be the first to answer."
                    : `${r.joiners.length} answering: ${r.joiners
                        .slice(0, 6)
                        .map((x) => (x.verified ? `${x.name} ✓` : x.name))
                        .join(", ")}${r.joiners.length > 6 ? "…" : ""}`}
              </div>
              <div style={{ ...S.row, gap: 8 }}>
                {currentUserId ? (
                  joined ? (
                    <button style={S.btnQuiet} onClick={() => act(`/hll/rallies/${r.id}/leave`)}>
                      Stand down
                    </button>
                  ) : (
                    <button style={S.btn} onClick={() => act(`/hll/rallies/${r.id}/join`)}>
                      I&rsquo;m in
                    </button>
                  )
                ) : (
                  <span style={S.muted}>Sign in to answer</span>
                )}
                {canArm && (
                  <button style={S.btnQuiet} onClick={() => act(`/hll/rallies/${r.id}/cancel`)}>
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---- Garrison (linked community server via CRCON) --------------------------

type GarrisonServer = {
  name: string;
  bmServerId: string | null;
  status: string;
  lastSeenAt: string | null;
  hasKey: boolean;
  live: {
    serverName: string | null;
    map: string | null;
    players: number;
    maxPlayers: number;
    allied: number;
    axis: number;
    scoreAllied: number;
    scoreAxis: number;
    timeRemaining: number;
  } | null;
  rotation: string[];
};

function fmtClock(secs: number): string {
  if (!secs || secs <= 0) return "—";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

function Garrison({ accent }: { accent: string }) {
  const [linked, setLinked] = useState<boolean | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [server, setServer] = useState<GarrisonServer | null>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [needsKey, setNeedsKey] = useState(false);
  const [servers, setServers] = useState<BmServer[]>([]);
  const [fName, setFName] = useState("");
  const [fUrl, setFUrl] = useState("");
  const [fKey, setFKey] = useState("");
  const [fBm, setFBm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = async () => {
    try {
      const r = await fetch(`${API}/hll/server`, { headers: authHeaders() });
      const j = await r.json();
      if (j?.ok) {
        setLinked(!!j.linked);
        setCanManage(!!j.canManage);
        setServer(j.server || null);
      }
    } catch {}
    try {
      const r2 = await fetch(`${API}/hll/server/warrecord`);
      const j2 = await r2.json();
      if (j2?.ok) {
        setMatches(j2.matches || []);
        setNeedsKey(!!j2.needsKey);
      }
    } catch {}
  };

  useEffect(() => {
    void load();
    const iv = setInterval(load, 60_000);
    fetch(`${API}/hll/servers`)
      .then((r) => r.json())
      .then((j) => j?.ok && setServers(j.servers || []))
      .catch(() => {});
    return () => clearInterval(iv);
  }, []);

  const link = async () => {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch(`${API}/hll/server/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ name: fName, baseUrl: fUrl, apiKey: fKey, bmServerId: fBm }),
      });
      const j = await r.json();
      if (!j?.ok) {
        setErr(
          j?.error === "not_crcon"
            ? "That URL didn't answer like a CRCON — check the address (no /api, just the base)."
            : j?.error === "bad_url"
              ? "That URL can't be reached safely."
              : j?.error === "mods_only"
                ? "Moderators only."
                : "Link failed.",
        );
      } else {
        setFName("");
        setFUrl("");
        setFKey("");
        setFBm("");
        await load();
      }
    } catch {
      setErr("Link failed.");
    }
    setBusy(false);
  };

  const unlink = async () => {
    setBusy(true);
    try {
      await fetch(`${API}/hll/server/unlink`, { method: "POST", headers: authHeaders() });
      await load();
    } catch {}
    setBusy(false);
  };

  const live = server?.live;
  return (
    <div>
      {linked === null && <div style={{ ...S.muted, marginTop: 14 }}>Raising the garrison…</div>}

      {linked === false && (
        <>
          <div style={{ ...S.card, marginTop: 12 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "rgba(236,242,250,.95)" }}>
              No community server linked yet
            </div>
            <div style={{ ...S.muted, marginTop: 4 }}>
              Run a Hell Let Loose server? Link your CRCON and this tab becomes your garrison board:
              live map, score and population for everyone in the lobby, match history, and — with an
              API key — <b>verified seeding</b>: members who answer a rally and actually show up on
              your server earn notoriety automatically.
            </div>
          </div>
          {canManage && (
            <div style={S.card}>
              <div style={S.kick}>Link your CRCON</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <input
                  style={S.input}
                  placeholder="Server name — e.g. 82nd Airborne | NA West"
                  value={fName}
                  maxLength={80}
                  onChange={(e) => setFName(e.target.value)}
                />
                <input
                  style={S.input}
                  placeholder="CRCON base URL — e.g. https://rcon.yourclan.com"
                  value={fUrl}
                  maxLength={200}
                  onChange={(e) => setFUrl(e.target.value)}
                />
                <input
                  style={S.input}
                  type="password"
                  placeholder="CRCON API key (optional — unlocks match history + verified seeding)"
                  value={fKey}
                  maxLength={200}
                  onChange={(e) => setFKey(e.target.value)}
                />
                <select style={S.input} value={fBm} onChange={(e) => setFBm(e.target.value)}>
                  <option value="">
                    BattleMetrics identity (optional — enables verified rallies)
                  </option>
                  {servers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name.slice(0, 70)}
                    </option>
                  ))}
                </select>
                <button
                  style={{ ...S.btn, opacity: busy ? 0.6 : 1 }}
                  disabled={busy}
                  onClick={link}
                >
                  {busy ? "Probing…" : "Link server"}
                </button>
                {err && <div style={{ ...S.muted, color: "#E08A83" }}>{err}</div>}
              </div>
            </div>
          )}
        </>
      )}

      {linked && server && (
        <>
          <div style={{ ...S.card, marginTop: 12 }}>
            <div style={{ ...S.row, justifyContent: "space-between" }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "rgba(236,242,250,.95)" }}>
                {server.name}
              </div>
              <span
                style={{
                  ...S.badge,
                  color: server.status === "connected" ? "#8FBF7F" : "#E08A83",
                  border: `1px solid ${server.status === "connected" ? "rgba(143,191,127,.4)" : "rgba(224,138,131,.4)"}`,
                }}
              >
                {server.status === "connected" ? "CONNECTED" : server.status.toUpperCase()}
              </span>
            </div>
            {live ? (
              <>
                <div style={{ ...S.row, marginTop: 10, justifyContent: "space-between" }}>
                  <div style={{ ...S.muted }}>{prettyMap(live.map)}</div>
                  <div style={{ ...S.muted }}>⏱ {fmtClock(live.timeRemaining)}</div>
                  <div
                    style={{
                      fontVariantNumeric: "tabular-nums",
                      fontWeight: 800,
                      color: "rgba(236,242,250,.95)",
                    }}
                  >
                    {live.players}/{live.maxPlayers}
                  </div>
                </div>
                <div style={{ margin: "8px 0" }}>
                  <FillBar players={live.players} max={live.maxPlayers} accent={accent} />
                </div>
                <div style={{ ...S.row, justifyContent: "center", gap: 18 }}>
                  <span style={{ ...S.muted }}>
                    Allies <b style={{ color: "#9DB8D6" }}>{live.scoreAllied}</b>
                    {" · "}
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>{live.allied} on</span>
                  </span>
                  <span style={{ ...S.muted }}>
                    Axis <b style={{ color: "#D6A99D" }}>{live.scoreAxis}</b>
                    {" · "}
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>{live.axis} on</span>
                  </span>
                </div>
              </>
            ) : (
              <div style={{ ...S.muted, marginTop: 8 }}>
                Server unreachable right now — last seen{" "}
                {server.lastSeenAt ? new Date(server.lastSeenAt).toLocaleString() : "never"}.
              </div>
            )}
            {server.rotation.length > 0 && (
              <>
                <div style={S.kick}>Map rotation</div>
                <div style={{ ...S.row, flexWrap: "wrap", gap: 6 }}>
                  {server.rotation.map((m, i) => (
                    <span
                      key={i}
                      style={{
                        ...S.badge,
                        color: "rgba(226,232,240,.8)",
                        border: "1px solid rgba(255,255,255,.14)",
                      }}
                    >
                      {prettyMap(m)}
                    </span>
                  ))}
                </div>
              </>
            )}
            {canManage && (
              <div style={{ ...S.row, justifyContent: "flex-end", marginTop: 10 }}>
                <button style={S.btnQuiet} disabled={busy} onClick={unlink}>
                  Unlink
                </button>
              </div>
            )}
          </div>

          <div style={S.kick}>War record</div>
          {needsKey && (
            <div style={S.muted}>
              Add a CRCON API key to the link to pull match history and arm verified seeding.
            </div>
          )}
          {!needsKey && matches.length === 0 && (
            <div style={S.muted}>No recent matches reported.</div>
          )}
          {matches.map((m, i) => (
            <div key={i} style={S.card}>
              <div style={{ ...S.row, justifyContent: "space-between" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(236,242,250,.95)" }}>
                  {prettyMap(m.map)}
                </div>
                <div style={{ fontVariantNumeric: "tabular-nums", fontWeight: 800 }}>
                  {m.allied != null && m.axis != null ? (
                    <>
                      <span style={{ color: "#9DB8D6" }}>{m.allied}</span>
                      <span style={{ color: "rgba(148,163,184,.6)" }}> – </span>
                      <span style={{ color: "#D6A99D" }}>{m.axis}</span>
                    </>
                  ) : (
                    <span style={S.muted}>—</span>
                  )}
                </div>
              </div>
              {m.start && (
                <div style={{ ...S.muted, marginTop: 3 }}>{new Date(m.start).toLocaleString()}</div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ---- Artillery School ------------------------------------------------------
// Faction ballistics are linear in HLL: mils at 100m and 1600m, interpolate.
// Community-verified endpoints (EasyArty & co.): US/GER 978→622, RUS 1120→800,
// GB 533→270.

const GUNS = [
  { id: "us", label: "US 155mm", m100: 978, m1600: 622 },
  { id: "ger", label: "German 150mm", m100: 978, m1600: 622 },
  { id: "rus", label: "Soviet 122mm", m100: 1120, m1600: 800 },
  { id: "gb", label: "British 25-pounder", m100: 533, m1600: 270 },
] as const;

function ArtillerySchool({ accent }: { accent: string }) {
  const [gun, setGun] = useState<(typeof GUNS)[number]>(GUNS[0]);
  const [dist, setDist] = useState(800);

  const mils = useMemo(() => {
    const d = Math.min(1600, Math.max(100, dist));
    return Math.round(gun.m100 + ((d - 100) * (gun.m1600 - gun.m100)) / 1500);
  }, [gun, dist]);
  const per50 = Math.abs(((gun.m1600 - gun.m100) / 1500) * 50).toFixed(1);

  return (
    <div>
      <div style={{ ...S.card, marginTop: 12 }}>
        <div style={S.kick}>Gun</div>
        <div style={{ ...S.row, flexWrap: "wrap" }}>
          {GUNS.map((g) => (
            <button
              key={g.id}
              style={gun.id === g.id ? S.btn : S.btnQuiet}
              onClick={() => setGun(g)}
            >
              {g.label}
            </button>
          ))}
        </div>
        <div style={S.kick}>Range to target (meters)</div>
        <div style={{ ...S.row }}>
          <input
            type="range"
            min={100}
            max={1600}
            step={5}
            value={dist}
            onChange={(e) => setDist(Number(e.target.value))}
            style={{ flex: 1, accentColor: accent }}
          />
          <input
            type="number"
            min={100}
            max={1600}
            value={dist}
            onChange={(e) => setDist(Number(e.target.value) || 100)}
            style={{ ...S.input, width: 90, textAlign: "right" }}
          />
        </div>
        <div style={{ textAlign: "center", padding: "18px 0 8px" }}>
          <div
            style={{
              fontSize: 56,
              fontWeight: 800,
              fontVariantNumeric: "tabular-nums",
              color: "#E3D3AC",
              lineHeight: 1,
            }}
          >
            {mils}
          </div>
          <div style={{ ...S.muted, marginTop: 6 }}>
            mils · set the elevation wheel, fire for effect
          </div>
        </div>
        <div style={{ ...S.muted, textAlign: "center" }}>
          Walking fire: ±50m ≈ {per50} mils {gun.m1600 < gun.m100 ? "(down = farther)" : ""}
        </div>
      </div>
      <div style={S.card}>
        <div style={S.kick}>Quick reference · {gun.label}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
          {[200, 400, 600, 800, 1000, 1200, 1400, 1600].map((d) => (
            <div key={d} style={{ ...S.muted, fontVariantNumeric: "tabular-nums" }}>
              {d}m →{" "}
              <b style={{ color: "rgba(236,242,250,.9)" }}>
                {Math.round(gun.m100 + ((d - 100) * (gun.m1600 - gun.m100)) / 1500)}
              </b>
            </div>
          ))}
        </div>
      </div>
      <div style={{ ...S.muted }}>
        How to range: open the map, measure grid distance to target (one large square = 200m), dial
        the mils, adjust off your spotter&rsquo;s call. Counter-battery lives at the far end of this
        table.
      </div>
    </div>
  );
}

// ---- Intel -----------------------------------------------------------------

function Intel() {
  const [playingNow, setPlayingNow] = useState<number | null>(null);
  const [news, setNews] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`${API}/hll/intel`)
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok) {
          setPlayingNow(j.playingNow);
          setNews(j.news || []);
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  return (
    <div>
      <div style={{ ...S.card, marginTop: 12, textAlign: "center" }}>
        <div
          style={{
            fontSize: 42,
            fontWeight: 800,
            fontVariantNumeric: "tabular-nums",
            color: "#E3D3AC",
          }}
        >
          {playingNow == null ? "—" : playingNow.toLocaleString()}
        </div>
        <div style={S.muted}>on the front right now (Steam)</div>
      </div>
      <div style={S.kick}>Dispatches</div>
      {!loaded && <div style={S.muted}>Decoding transmissions…</div>}
      {loaded && news.length === 0 && <div style={S.muted}>No recent dispatches.</div>}
      {news.map((n) => (
        <a
          key={n.id}
          href={n.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...S.card, display: "block", textDecoration: "none" }}
        >
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "rgba(236,242,250,.95)" }}>
            {n.title}
          </div>
          <div style={{ ...S.muted, marginTop: 3 }}>
            {n.date ? new Date(n.date).toLocaleDateString() : ""}
            {n.feed ? ` · ${n.feed}` : ""}
          </div>
          {n.snippet && <div style={{ ...S.muted, marginTop: 5 }}>{n.snippet}</div>}
        </a>
      ))}
    </div>
  );
}

// ---- shell -----------------------------------------------------------------

export default function HllModulesPanel({
  lobbyId: _lobbyId,
  accentColor,
  currentUserId,
  style,
}: {
  lobbyId: string;
  accentColor?: string;
  currentUserId?: string;
  style?: React.CSSProperties;
}) {
  const accent = accentColor || ACCENT;
  const [tab, setTab] = useState<TabId>("frontlines");

  return (
    <div style={{ ...S.wrap, ...style }}>
      <ModuleTabBar
        tabs={TABS}
        active={tab}
        onSelect={(id) => setTab(id as TabId)}
        accent={accent}
      />
      <div style={S.body}>
        {tab === "frontlines" && <FrontLines accent={accent} />}
        {tab === "seeding" && <SeedingOps accent={accent} currentUserId={currentUserId} />}
        {tab === "garrison" && <Garrison accent={accent} />}
        {tab === "artillery" && <ArtillerySchool accent={accent} />}
        {tab === "intel" && <Intel />}
      </div>
    </div>
  );
}
