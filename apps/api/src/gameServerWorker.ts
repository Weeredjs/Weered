// Game server aggregate: poll the public server list and keep the history.
//
// Every server tracker is built on the same two public sources — Steam's master
// server list and the A2S query protocol. Nobody has privileged access; what a
// tracker sells is the polling and the history on top. This is that, for the
// games Weered has lobbies for, kept because a live snapshot cannot answer the
// question a milsim unit actually has:
//
//   "we want to seed tonight — when does this box normally fill?"
//
// BattleMetrics can tell you a server is at 19/100. History tells you it climbs
// past 40 at 19:00 ET on weeknights and never does on a Sunday, which is the
// difference between a seeding push that works and one that wastes an evening.
import { PrismaClient } from "@prisma/client";
import { log, swallow } from "./lib/logger";

const prisma = new PrismaClient();

/** Apps we track. Vietnam (3079210) is deliberately absent: it is flagged
 *  Cross-Platform Multiplayer and routes through Team17's own backend, so it
 *  publishes nothing to Steam's master list. Verified — every gamedir, product
 *  and appid filter returns zero. Adding it here would poll an empty set. */
const APPS = [686810]; // Hell Let Loose

const PAGE_LIMIT = 5000;

/** Raw samples are a rolling window. The rhythm we care about is derived from
 *  them; keeping a year of five-minute rows to answer "typical Tuesday" is
 *  storage for its own sake. */
const RETAIN_DAYS = 21;

/** A server absent from the list for this long is treated as offline rather
 *  than deleted — units rename and move boxes, and losing the history would
 *  lose the thing that makes this worth having. */
const OFFLINE_AFTER_MIN = 30;

type SteamServer = {
  addr?: string;
  gameport?: number;
  steamid?: string;
  name?: string;
  appid?: number;
  players?: number;
  max_players?: number;
  map?: string;
  version?: string;
  dedicated?: boolean;
};

/** Region from the server name. Crude, and deliberately so for now: the honest
 *  upgrade is GeoIP on `addr`, which needs a database we do not ship yet. Named
 *  here rather than hidden so it is obvious what to replace. */
function guessRegion(name: string): string | null {
  const n = ` ${name.toLowerCase()} `;
  if (/\b(eu|europe|de|uk|fr|nl|pl|ger|lon|fra|ams)\b/.test(n)) return "EU";
  if (/\b(na|us|usa|ny|la|chi|dal|nae|naw|east|west)\b/.test(n)) return "NA";
  if (/\b(oce|aus|au|nz|syd|sydney)\b/.test(n)) return "OCE";
  if (/\b(asia|sg|jp|kr|hk|sea)\b/.test(n)) return "ASIA";
  return null;
}

async function fetchApp(appId: number): Promise<SteamServer[]> {
  const key = process.env.STEAM_API_KEY || "";
  if (!key) return [];
  const url =
    "https://api.steampowered.com/IGameServersService/GetServerList/v1/" +
    `?key=${key}&filter=%5Cappid%5C${appId}&limit=${PAGE_LIMIT}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(25_000) });
    if (!res.ok) {
      log.warn(`[gsw] steam ${res.status} for appid ${appId}`);
      return [];
    }
    const j: any = await res.json();
    const rows = j?.response?.servers;
    return Array.isArray(rows) ? rows : [];
  } catch (e) {
    log.warn("[gsw] steam fetch failed", String(e).slice(0, 120));
    return [];
  }
}

export async function runGameServerWorker(): Promise<void> {
  if (!process.env.STEAM_API_KEY) return;

  for (const appId of APPS) {
    const rows = await fetchApp(appId);
    if (!rows.length) continue;

    const seen: string[] = [];
    let samples = 0;

    for (const s of rows) {
      const id = String(s.steamid || "").trim();
      if (!id) continue; // steamid is the stable key; without it there is no row
      const name = String(s.name || "").slice(0, 200);
      const players = Number(s.players) || 0;
      const maxPlayers = Number(s.max_players) || 0;
      const map = s.map ? String(s.map).slice(0, 60) : null;

      const data = {
        appId,
        name,
        addr: String(s.addr || "").slice(0, 64),
        gamePort: Number(s.gameport) || null,
        map,
        region: guessRegion(name),
        maxPlayers,
        players,
        version: s.version ? String(s.version).slice(0, 24) : null,
        dedicated: s.dedicated !== false,
        online: true,
        lastSeenAt: new Date(),
      };

      try {
        await prisma.gameServer.upsert({
          where: { id },
          create: { id, ...data },
          update: data,
        });
        await prisma.gameServerSample.create({ data: { serverId: id, players, map } });
        seen.push(id);
        samples++;
      } catch (e) {
        swallow(e);
      }
    }

    // Anything not in this pass and stale is marked offline, never deleted.
    try {
      const cutoff = new Date(Date.now() - OFFLINE_AFTER_MIN * 60_000);
      const { count } = await prisma.gameServer.updateMany({
        where: { appId, online: true, lastSeenAt: { lt: cutoff } },
        data: { online: false, players: 0 },
      });
      if (count) log.info(`[gsw] appid ${appId}: ${count} marked offline`);
    } catch (e) {
      swallow(e);
    }

    log.info(`[gsw] appid ${appId}: ${seen.length} servers, ${samples} samples`);
  }

  // Prune outside the app loop: one delete per run, not per game.
  try {
    const cutoff = new Date(Date.now() - RETAIN_DAYS * 86_400_000);
    const { count } = await prisma.gameServerSample.deleteMany({ where: { at: { lt: cutoff } } });
    if (count) log.info(`[gsw] pruned ${count} samples older than ${RETAIN_DAYS}d`);
  } catch (e) {
    swallow(e);
  }
}
