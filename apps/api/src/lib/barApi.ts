import { swallow } from "./logger";

// Beyond All Reason's public live-services API (github.com/beyond-all-reason/bar-db).
// No key, CORS open, Fastify behind nginx. Everything is cached here so a lobby
// full of viewers costs one upstream call, not one per viewer.
//
// Two facts that bite:
//  - `/replays?players=` is CASE-SENSITIVE. "TicksInYourBase" matches, the
//    lowercase spelling returns nothing. Linked names are stored canonical.
//  - `/leaderboards` proxies Teiserver's memory and was returning `{}` on
//    2026-09-14, so nothing here depends on it.

const BASE = "https://api.bar-rts.com";
const HEADERS = { "User-Agent": "Weered (https://weered.ca)" };

export const BAR_NAME_RE = /^[A-Za-z0-9_[\]-]{1,40}$/;

async function getJson(path: string, timeoutMs = 12_000): Promise<any> {
  const r = await fetch(`${BASE}${path}`, {
    headers: HEADERS,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!r.ok) throw new Error(`bar-rts ${path} -> HTTP ${r.status}`);
  return r.json();
}

/** Single-flight, TTL, and stale-on-error: a BAR outage serves the last good copy. */
function makeCache<T>(ttlMs: number, load: () => Promise<T>) {
  let value: T | null = null;
  let at = 0;
  let inflight: Promise<T> | null = null;
  return async function get(): Promise<T> {
    if (value !== null && Date.now() - at < ttlMs) return value;
    if (inflight) return inflight;
    inflight = load()
      .then((v) => {
        value = v;
        at = Date.now();
        return v;
      })
      .catch((err) => {
        if (value === null) throw err;
        swallow(err);
        // Retry in 30s rather than on every request while BAR is down.
        at = Date.now() - ttlMs + 30_000;
        return value;
      })
      .finally(() => {
        inflight = null;
      });
    return inflight;
  };
}

// ── Live battles ───────────────────────────────────────────────────────────

export type BarBattlePlayer = { name: string; userId: number | null; country: string | null };

export type BarBattle = {
  id: number;
  title: string;
  map: string;
  gameType: string;
  preset: string;
  running: boolean;
  gameTimeSec: number | null;
  passworded: boolean;
  locked: boolean;
  maxPlayers: number;
  host: string;
  players: BarBattlePlayer[];
  spectators: BarBattlePlayer[];
};

function toPlayer(p: any): BarBattlePlayer | null {
  const name = String(p?.username || p?.name || "").trim();
  if (!name) return null;
  return {
    name,
    userId: Number.isFinite(Number(p?.userId)) ? Number(p.userId) : null,
    country: p?.country || p?.countryCode || null,
  };
}

function normalizeBattle(b: any): BarBattle {
  const humans = (Array.isArray(b?.players) ? b.players : []).filter(
    (p: any) => !(p?.status && p.status.bot),
  );
  const specs = Array.isArray(b?.spectators) ? b.spectators : [];
  const status = String(b?.gameStatus || b?.lobbyStatus || "");
  return {
    id: Number(b?.battleId) || 0,
    title: String(b?.title || ""),
    map: String(b?.map || ""),
    gameType: String(b?.gameType || ""),
    preset: String(b?.preset || "").split(" ")[0],
    running: status === "running" || !!b?.founder?.status?.ingame,
    gameTimeSec: Number.isFinite(Number(b?.gameTime)) ? Number(b.gameTime) : null,
    passworded: !!b?.passworded,
    locked: !!b?.locked,
    maxPlayers: Number(b?.maxPlayers) || 0,
    host: String(b?.founder?.username || ""),
    players: humans.map(toPlayer).filter(Boolean) as BarBattlePlayer[],
    spectators: specs.map(toPlayer).filter(Boolean) as BarBattlePlayer[],
  };
}

const battlesCache = makeCache(20_000, async () => {
  const raw = await getJson("/battles");
  return {
    fetchedAt: new Date().toISOString(),
    battles: (Array.isArray(raw) ? raw : []).map(normalizeBattle),
  };
});

export const getBattles = battlesCache;

// ── Maps ───────────────────────────────────────────────────────────────────

export type BarMap = {
  scriptName: string;
  fileName: string;
  description: string;
  width: number | null;
  height: number | null;
  minWind: number | null;
  maxWind: number | null;
  maxMetal: number | null;
  tidal: number | null;
  startPositions: number;
};

const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : null);

const mapsCache = makeCache(6 * 60 * 60_000, async () => {
  // limit=1000 returns the whole catalogue (633 maps on 2026-09-14) in one call.
  const raw = await getJson("/maps?limit=1000", 30_000);
  const rows: any[] = Array.isArray(raw?.data) ? raw.data : [];
  return rows
    .map(
      (m): BarMap => ({
        scriptName: String(m?.scriptName || ""),
        fileName: String(m?.fileName || ""),
        description: String(m?.description || "").slice(0, 400),
        width: num(m?.width),
        height: num(m?.height),
        minWind: num(m?.minWind),
        maxWind: num(m?.maxWind),
        maxMetal: num(m?.maxMetal),
        tidal: num(m?.tidalStrength),
        startPositions: Array.isArray(m?.startPositions) ? m.startPositions.length : 0,
      }),
    )
    .filter((m) => m.scriptName)
    .sort((a, b) => a.scriptName.localeCompare(b.scriptName));
});

export const getMaps = mapsCache;

// ── Replays by player ──────────────────────────────────────────────────────

export type BarMatch = {
  id: string;
  startTime: string;
  durationMin: number;
  map: string;
  players: number;
  bots: boolean;
  result: "win" | "loss" | "none";
};

function matchFor(name: string, r: any): BarMatch {
  const teams: any[] = Array.isArray(r?.AllyTeams) ? r.AllyTeams : [];
  const lower = name.toLowerCase();
  let players = 0;
  let bots = false;
  let mine: any = null;
  let anyWinner = false;
  for (const t of teams) {
    const ps: any[] = Array.isArray(t?.Players) ? t.Players : [];
    players += ps.length;
    if (Array.isArray(t?.AIs) && t.AIs.length) bots = true;
    if (t?.winningTeam) anyWinner = true;
    if (ps.some((p) => String(p?.name || "").toLowerCase() === lower)) mine = t;
  }
  return {
    id: String(r?.id || ""),
    startTime: String(r?.startTime || ""),
    durationMin: Math.round((Number(r?.durationMs) || 0) / 60_000),
    map: String(r?.Map?.scriptName || r?.Map?.fileName || ""),
    players,
    bots,
    result: mine && anyWinner ? (mine.winningTeam ? "win" : "loss") : "none",
  };
}

const playerCache = new Map<string, { at: number; value: BarMatch[] }>();
const PLAYER_TTL = 2 * 60_000;

export async function getPlayerMatches(name: string, limit = 30): Promise<BarMatch[]> {
  const key = `${name}|${limit}`;
  const hit = playerCache.get(key);
  if (hit && Date.now() - hit.at < PLAYER_TTL) return hit.value;
  try {
    const raw = await getJson(`/replays?page=1&limit=${limit}&players=${encodeURIComponent(name)}`);
    const rows: any[] = Array.isArray(raw?.data) ? raw.data : [];
    const value = rows.map((r) => matchFor(name, r)).filter((m) => m.id);
    playerCache.set(key, { at: Date.now(), value });
    if (playerCache.size > 800) {
      const oldest = playerCache.keys().next().value;
      if (oldest) playerCache.delete(oldest);
    }
    return value;
  } catch (err) {
    if (hit) {
      swallow(err);
      return hit.value;
    }
    throw err;
  }
}

export type BarSummary = {
  games: number;
  wins: number;
  losses: number;
  winRate: number | null;
  topMap: string | null;
  lastPlayed: string | null;
  avgMinutes: number | null;
  vsBots: number;
};

export function summarize(matches: BarMatch[]): BarSummary {
  const wins = matches.filter((m) => m.result === "win").length;
  const losses = matches.filter((m) => m.result === "loss").length;
  const counts = new Map<string, number>();
  for (const m of matches) if (m.map) counts.set(m.map, (counts.get(m.map) || 0) + 1);
  const topMap = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const decided = wins + losses;
  return {
    games: matches.length,
    wins,
    losses,
    winRate: decided ? Math.round((wins / decided) * 100) : null,
    topMap,
    lastPlayed: matches[0]?.startTime || null,
    avgMinutes: matches.length
      ? Math.round(matches.reduce((t, m) => t + m.durationMin, 0) / matches.length)
      : null,
    vsBots: matches.filter((m) => m.bots).length,
  };
}

// ── Account lookup ─────────────────────────────────────────────────────────

export type BarUser = { id: number; username: string; country: string | null };

// /cached-users is every BAR account (~13 MB of JSON on 2026-09-14). It is only
// needed when someone links a name, so it is loaded on demand and released
// after half an hour instead of living in memory for the life of the process.
let usersIndex: { byName: Map<string, BarUser>; at: number } | null = null;
let usersInflight: Promise<Map<string, BarUser>> | null = null;
const USERS_TTL = 30 * 60_000;

async function loadUsers(): Promise<Map<string, BarUser>> {
  if (usersIndex && Date.now() - usersIndex.at < USERS_TTL) return usersIndex.byName;
  if (usersInflight) return usersInflight;
  usersInflight = getJson("/cached-users", 60_000)
    .then((raw: any[]) => {
      const byName = new Map<string, BarUser>();
      for (const u of Array.isArray(raw) ? raw : []) {
        const username = String(u?.username || "");
        if (!username) continue;
        byName.set(username.toLowerCase(), {
          id: Number(u?.id) || 0,
          username,
          country: u?.countryCode || null,
        });
      }
      usersIndex = { byName, at: Date.now() };
      const release = setTimeout(() => {
        usersIndex = null;
      }, USERS_TTL);
      (release as any).unref?.();
      return byName;
    })
    .finally(() => {
      usersInflight = null;
    });
  return usersInflight;
}

/** Case-insensitive lookup that returns BAR's canonical spelling and account id. */
export async function resolveBarUser(name: string): Promise<BarUser | null> {
  const idx = await loadUsers();
  return idx.get(name.trim().toLowerCase()) ?? null;
}
