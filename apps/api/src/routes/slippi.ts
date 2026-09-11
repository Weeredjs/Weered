import type { FastifyInstance } from "fastify";
import { log, swallow } from "../lib/logger";
import { prisma } from "../lib/prisma";
import { canManageLobby } from "../lib/lobbyAccess";
import { fetchWithTimeout } from "../lib/fetchWithTimeout";

// Slippi ranked board.
//
// A Melee lobby keeps a list of its members' Slippi connect codes. For each
// code we read the public ranked profile — rating, record, daily placement,
// characters — the same read Slippi's own profile pages make, and keep the
// last good read in SlippiEntry. The board is served from that table and
// refreshed on a schedule, so the room never waits on Slippi and a Slippi
// outage shows a dated board, not an empty one.
//
// Codes are volunteered: a member adds their own; moderators can add or
// remove any. A code that Slippi has never heard of is refused at the door
// rather than stored as a permanent blank row.

type Opts = {
  authFromHeader?: (h?: string) => { id: string; name?: string } | null;
};

const GQL = "https://internal.slippi.gg/graphql";
const REFRESH_MS = 60 * 60_000; // an hour between reads of the same code
const SWEEP_MS = 10 * 60_000; // how often the worker looks for stale codes
const STALE_MS = 3 * 60 * 60_000; // board flags itself once reads are this old
const MAX_PER_LOBBY = 200;
const MAX_PER_MEMBER = 3;
const BATCH = 20; // codes per Slippi request (aliased in one query)

// Slippi connect codes: letters, a hash, digits. "MANG#0", "IBDW#0", "ZAIN#0".
const CODE_RE = /^[A-Z0-9]{1,8}#\d{1,5}$/;

export function normalizeCode(raw: unknown): string | null {
  const s = String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[＃♯]/g, "#")
    .replace(/\s+/g, "");
  return CODE_RE.test(s) ? s : null;
}

// Slippi's tiers. Thresholds are the community-documented rating ordinals
// that Slippi's own client uses; Grandmaster additionally needs a daily
// global placement inside the top 300, which is why it is not a plain
// threshold row.
const TIERS: [number, string][] = [
  [0, "Bronze 1"],
  [766, "Bronze 2"],
  [914, "Bronze 3"],
  [1055, "Silver 1"],
  [1189, "Silver 2"],
  [1316, "Silver 3"],
  [1436, "Gold 1"],
  [1549, "Gold 2"],
  [1654, "Gold 3"],
  [1752, "Platinum 1"],
  [1843, "Platinum 2"],
  [1928, "Platinum 3"],
  [2004, "Diamond 1"],
  [2074, "Diamond 2"],
  [2137, "Diamond 3"],
  [2192, "Master 1"],
  [2275, "Master 2"],
  [2350, "Master 3"],
];
const PLACEMENT_GAMES = 5;

export function rankOf(
  ordinal: number | null,
  updates: number,
  globalPlacement: number | null,
): { tier: string; placement: boolean } {
  if (ordinal == null) return { tier: "Unranked", placement: false };
  if (updates < PLACEMENT_GAMES) return { tier: "Placement", placement: true };
  if (ordinal >= 2350 && globalPlacement != null && globalPlacement <= 300) {
    return { tier: "Grandmaster", placement: false };
  }
  let tier = TIERS[0][1];
  for (const [min, name] of TIERS) if (ordinal >= min) tier = name;
  return { tier, placement: false };
}

// ---------------------------------------------------------------- Slippi IO

type Profile = {
  displayName: string;
  ordinal: number | null;
  updates: number;
  wins: number;
  losses: number;
  globalPlacement: number | null;
  regionalPlacement: number | null;
  continent: string | null;
  characters: { character: string; gameCount: number }[];
};

const FIELDS = `displayName connectCode { code } rankedNetplayProfile {
  ratingOrdinal ratingUpdateCount wins losses dailyGlobalPlacement dailyRegionalPlacement continent
  characters { character gameCount }
}`;

/** One request for up to BATCH codes. A code Slippi does not know comes back
 *  as null in the map; a transport or schema failure throws, so the caller
 *  can keep the last good read instead of blanking rows. */
export async function readProfiles(codes: string[]): Promise<Map<string, Profile | null>> {
  const out = new Map<string, Profile | null>();
  for (let i = 0; i < codes.length; i += BATCH) {
    const chunk = codes.slice(i, i + BATCH);
    const vars: Record<string, string> = {};
    const parts = chunk.map((c, k) => {
      vars[`c${k}`] = c;
      return `u${k}: getUser(connectCode: $c${k}) { ${FIELDS} }`;
    });
    const decl = chunk.map((_, k) => `$c${k}: String`).join(", ");
    const query = `query Board(${decl}) { ${parts.join("\n")} }`;
    const r = await fetchWithTimeout(
      GQL,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "apollographql-client-name": "weered" },
        body: JSON.stringify({ query, variables: vars }),
      },
      12_000,
      { retries: 1 },
    );
    if (!r.ok) throw new Error(`slippi_http_${r.status}`);
    const j: any = await r.json().catch(() => null);
    if (!j || typeof j !== "object" || !("data" in j)) throw new Error("slippi_bad_body");
    chunk.forEach((c, k) => {
      const u = j.data?.[`u${k}`];
      if (!u) {
        out.set(c, null);
        return;
      }
      const p = u.rankedNetplayProfile || {};
      out.set(c, {
        displayName: String(u.displayName || "").slice(0, 40),
        ordinal: typeof p.ratingOrdinal === "number" ? p.ratingOrdinal : null,
        updates: Number(p.ratingUpdateCount) || 0,
        wins: Number(p.wins) || 0,
        losses: Number(p.losses) || 0,
        globalPlacement: typeof p.dailyGlobalPlacement === "number" ? p.dailyGlobalPlacement : null,
        regionalPlacement:
          typeof p.dailyRegionalPlacement === "number" ? p.dailyRegionalPlacement : null,
        continent: p.continent ? String(p.continent).slice(0, 24) : null,
        characters: Array.isArray(p.characters)
          ? p.characters
              .filter((x: any) => x && typeof x.character === "string")
              .map((x: any) => ({ character: x.character, gameCount: Number(x.gameCount) || 0 }))
              .sort((a: any, b: any) => b.gameCount - a.gameCount)
              .slice(0, 6)
          : [],
      });
    });
  }
  return out;
}

function profileData(p: Profile) {
  return {
    displayName: p.displayName,
    ordinal: p.ordinal,
    updates: p.updates,
    wins: p.wins,
    losses: p.losses,
    globalPlacement: p.globalPlacement,
    regionalPlacement: p.regionalPlacement,
    continent: p.continent,
    characters: p.characters,
    fetchedAt: new Date(),
    lastError: null as string | null,
  };
}

/** Refresh a set of entries in place. A code Slippi has forgotten keeps its
 *  last read and carries the error; a transport failure marks every entry in
 *  the batch the same way. Never throws. */
async function refreshEntries(entries: { id: string; code: string }[]): Promise<void> {
  if (!entries.length) return;
  const codes = Array.from(new Set(entries.map((e) => e.code)));
  let read: Map<string, Profile | null>;
  try {
    read = await readProfiles(codes);
  } catch (e: any) {
    const msg = String(e?.message || e).slice(0, 120);
    log.warn(`[slippi] refresh failed for ${codes.length} code(s): ${msg}`);
    await prisma.slippiEntry
      .updateMany({ where: { id: { in: entries.map((e) => e.id) } }, data: { lastError: msg } })
      .catch(swallow);
    return;
  }
  for (const e of entries) {
    const p = read.get(e.code);
    const data = p ? profileData(p) : { lastError: "unknown_code" };
    await prisma.slippiEntry.update({ where: { id: e.id }, data }).catch(swallow);
  }
}

// ---------------------------------------------------------------- shape

function rowOf(e: any) {
  const rank = rankOf(e.ordinal, e.updates, e.globalPlacement);
  return {
    code: e.code,
    displayName: e.displayName,
    rating: e.ordinal == null ? null : Math.round(e.ordinal),
    tier: rank.tier,
    placement: rank.placement,
    wins: e.wins,
    losses: e.losses,
    globalPlacement: e.globalPlacement,
    regionalPlacement: e.regionalPlacement,
    continent: e.continent,
    characters: Array.isArray(e.characters) ? e.characters : [],
    fetchedAt: e.fetchedAt,
    error: e.lastError,
    addedById: e.addedById,
  };
}

function sortRows(rows: ReturnType<typeof rowOf>[]) {
  // Ranked players by rating; placements and unread codes at the bottom.
  return rows.sort((a, b) => {
    const ar = a.rating == null || a.placement ? -1 : a.rating;
    const br = b.rating == null || b.placement ? -1 : b.rating;
    if (br !== ar) return br - ar;
    return a.code.localeCompare(b.code);
  });
}

export default async function slippiRoutes(app: FastifyInstance, opts: Opts) {
  const authFromHeader = opts.authFromHeader;
  const userOf = (req: any) => authFromHeader?.(req.headers?.authorization) || null;

  async function isMember(userId: string, lobbyId: string): Promise<boolean> {
    const m = await prisma.lobbyMember.findUnique({
      where: { lobbyId_userId: { lobbyId, userId } },
      select: { id: true },
    });
    return !!m || (await canManageLobby(userId, lobbyId));
  }

  // ---- worker: hourly reads, in small sweeps so one busy lobby cannot
  // ---- starve another and Slippi sees a trickle, never a burst.
  let sweeping = false;
  async function sweep() {
    if (sweeping) return;
    sweeping = true;
    try {
      const due = await prisma.slippiEntry.findMany({
        where: {
          OR: [{ fetchedAt: null }, { fetchedAt: { lt: new Date(Date.now() - REFRESH_MS) } }],
          updatedAt: { lt: new Date(Date.now() - 5 * 60_000) }, // not just retried
        },
        select: { id: true, code: true },
        orderBy: { updatedAt: "asc" },
        take: 100,
      });
      if (due.length) {
        await refreshEntries(due);
        log.info(`[slippi] refreshed ${due.length} code(s)`);
      }
    } catch (e) {
      swallow(e);
    } finally {
      sweeping = false;
    }
  }
  setTimeout(() => void sweep(), 90_000);
  setInterval(() => void sweep(), SWEEP_MS);

  // ---- routes ---------------------------------------------------------------

  /** The board. Public, like the lobby page. */
  app.get("/slippi/:lobbyId/board", async (req: any, reply) => {
    const lobbyId = String(req.params.lobbyId || "");
    const u = userOf(req);
    const entries = await prisma.slippiEntry.findMany({ where: { lobbyId } });
    const rows = sortRows(entries.map(rowOf));
    const reads = entries.map((e) => e.fetchedAt?.getTime() || 0).filter(Boolean);
    const oldest = reads.length ? Math.min(...reads) : null;
    const newest = reads.length ? Math.max(...reads) : null;
    const failing = entries.filter((e) => e.lastError && e.lastError !== "unknown_code").length;
    let canManage = false;
    let member = false;
    if (u) {
      canManage = await canManageLobby(u.id, lobbyId);
      member = canManage || (await isMember(u.id, lobbyId));
    }
    reply.header("Cache-Control", "no-store");
    return {
      rows,
      count: rows.length,
      newestRead: newest ? new Date(newest).toISOString() : null,
      oldestRead: oldest ? new Date(oldest).toISOString() : null,
      stale: !!oldest && Date.now() - oldest > STALE_MS,
      failing,
      me: u ? { id: u.id, member, canManage } : null,
    };
  });

  /** Add a code. Members add their own (a few, for alts); moderators any. */
  app.post("/slippi/:lobbyId/codes", async (req: any, reply) => {
    const u = userOf(req);
    if (!u) return reply.code(401).send({ error: "auth_required" });
    const lobbyId = String(req.params.lobbyId || "");
    const code = normalizeCode(req.body?.code);
    if (!code) return reply.code(400).send({ error: "bad_code" });
    const canManage = await canManageLobby(u.id, lobbyId);
    if (!canManage && !(await isMember(u.id, lobbyId))) {
      return reply.code(403).send({ error: "members_only" });
    }
    const existing = await prisma.slippiEntry.findUnique({
      where: { lobbyId_code: { lobbyId, code } },
    });
    if (existing) return { ok: true, row: rowOf(existing), existed: true };

    const total = await prisma.slippiEntry.count({ where: { lobbyId } });
    if (total >= MAX_PER_LOBBY) return reply.code(409).send({ error: "board_full" });
    if (!canManage) {
      const mine = await prisma.slippiEntry.count({ where: { lobbyId, addedById: u.id } });
      if (mine >= MAX_PER_MEMBER) return reply.code(409).send({ error: "too_many_codes" });
    }

    // Read before we store, so an unknown code is refused rather than parked.
    let read: Map<string, Profile | null>;
    try {
      read = await readProfiles([code]);
    } catch (e: any) {
      log.warn(`[slippi] add ${code} failed: ${String(e?.message || e).slice(0, 120)}`);
      return reply.code(502).send({ error: "slippi_unreachable" });
    }
    const p = read.get(code);
    if (!p) return reply.code(404).send({ error: "unknown_code" });

    const row = await prisma.slippiEntry.create({
      data: { lobbyId, code, addedById: u.id, ...profileData(p) },
    });
    return { ok: true, row: rowOf(row) };
  });

  /** Remove a code: whoever added it, or a moderator. */
  app.delete("/slippi/:lobbyId/codes/:code", async (req: any, reply) => {
    const u = userOf(req);
    if (!u) return reply.code(401).send({ error: "auth_required" });
    const lobbyId = String(req.params.lobbyId || "");
    const code = normalizeCode(decodeURIComponent(String(req.params.code || "")));
    if (!code) return reply.code(400).send({ error: "bad_code" });
    const e = await prisma.slippiEntry.findUnique({ where: { lobbyId_code: { lobbyId, code } } });
    if (!e) return reply.code(404).send({ error: "not_found" });
    if (e.addedById !== u.id && !(await canManageLobby(u.id, lobbyId))) {
      return reply.code(403).send({ error: "forbidden" });
    }
    await prisma.slippiEntry.delete({ where: { id: e.id } });
    return { ok: true };
  });

  /** Moderator: re-read the whole board now (rate-limited to once a minute). */
  const lastForce = new Map<string, number>();
  app.post("/slippi/:lobbyId/refresh", async (req: any, reply) => {
    const u = userOf(req);
    if (!u) return reply.code(401).send({ error: "auth_required" });
    const lobbyId = String(req.params.lobbyId || "");
    if (!(await canManageLobby(u.id, lobbyId))) return reply.code(403).send({ error: "forbidden" });
    const last = lastForce.get(lobbyId) || 0;
    if (Date.now() - last < 60_000) return reply.code(429).send({ error: "slow_down" });
    lastForce.set(lobbyId, Date.now());
    const entries = await prisma.slippiEntry.findMany({
      where: { lobbyId },
      select: { id: true, code: true },
    });
    await refreshEntries(entries);
    return { ok: true, refreshed: entries.length };
  });
}
