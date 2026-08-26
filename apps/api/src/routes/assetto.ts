/**
 * Assetto Corsa server board.
 *
 * Every AC dedicated server exposes its own small HTTP API — `/INFO` for the
 * session (track, session type, time left, slots, car list) and `/JSON|<guid>`
 * for the grid (who is connected, in which car). It is public and unauthenticated;
 * it is what Content Manager reads to draw the in-game server browser. So a
 * racing community's live grid can be shown without asking anything of them and
 * without a bot to maintain.
 *
 * SECURITY — where the addresses come from matters more than anything else here.
 * The server list is read from the LOBBY's stored moduleConfig, written by a
 * lobby admin, and never from the query string. A `?host=` parameter would make
 * this endpoint a server-side request forgery tool pointed at the droplet's own
 * network. Configured hosts are additionally screened against loopback, private
 * and link-local ranges (see isPublicHost) so an admin cannot aim it inward
 * either, deliberately or by accident.
 *
 * Politeness: results are cached, every server is polled at most once per
 * CACHE_MS regardless of how many people have the lobby open, and requests
 * identify themselves.
 */
import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { fetchWithTimeout } from "../lib/fetchWithTimeout";
import { swallow } from "../lib/logger";

const CACHE_MS = 20_000;
const MAX_SERVERS = 12; // a community board, not a global scraper
const UA = "Weered/1.0 (+https://weered.ca; community server board; contact: legal@weered.ca)";

export type AcDriver = { name: string; car: string; carLabel: string };
export type AcServer = {
  id: string;
  label: string | null;
  name: string | null;
  host: string;
  httpPort: number;
  online: boolean;
  track: string | null;
  trackLabel: string | null;
  session: number | null;
  sessionLabel: string | null;
  timeLeftSec: number | null;
  clients: number;
  maxClients: number;
  passworded: boolean;
  cars: string[];
  carLabels: string[];
  drivers: AcDriver[];
  joinUrl: string | null;
};

/** AC's session enum. Unknown values are surfaced honestly rather than guessed. */
const SESSION_LABELS: Record<number, string> = {
  0: "Booking",
  1: "Practice",
  2: "Qualifying",
  3: "Race",
};

/** Reject loopback, private, link-local and multicast targets. A lobby admin
 *  configures these, but an admin should not be able to turn the board into a
 *  probe of the host's own network. */
export function isPublicHost(host: string): boolean {
  const h = String(host || "")
    .trim()
    .toLowerCase();
  if (!h || h.length > 253) return false;
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local")) return false;
  if (h === "::1" || h.startsWith("[")) return false;
  if (!/^[a-z0-9.-]+$/.test(h)) return false;

  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if ([a, b, Number(v4[3]), Number(v4[4])].some((n) => n > 255)) return false;
    if (a === 0 || a === 127 || a === 10) return false; // this-host, loopback, private
    if (a === 192 && b === 168) return false; // private
    if (a === 172 && b >= 16 && b <= 31) return false; // private
    if (a === 169 && b === 254) return false; // link-local (cloud metadata)
    if (a >= 224) return false; // multicast / reserved
  }
  return true;
}

/** "csp/2651/../H/../ks_vallelunga-extended_circuit" -> "Vallelunga Extended Circuit".
 *  AC track ids arrive as asset paths, often wrapped in CSP prefixes. */
export function prettyTrack(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const last = String(raw).split("/").filter(Boolean).pop() || "";
  if (!last) return null;
  return titleise(last.replace(/^ks_/, ""));
}

/** "bmw_z4_gt3" -> "BMW Z4 GT3". Keeps well-known racing acronyms upper-case. */
export function prettyCar(raw: string | null | undefined): string {
  if (!raw) return "";
  return titleise(String(raw).replace(/^ks_/, ""));
}

const UPPER = new Set([
  "gt",
  "gt1",
  "gt2",
  "gt3",
  "gt4",
  "gte",
  "lmp1",
  "lmp2",
  "bmw",
  "amg",
  "sls",
  "rs",
  "gtr",
  "sw",
  "st",
  "s1",
  "s2",
  "s3",
  "f1",
  "dtm",
  "wrc",
  "ss",
  "gtc",
  "abt",
  "m3",
  "m4",
  "rsr",
  "lms",
  "hgk",
  "tt",
  "ktm",
  "srt",
  "zr1",
  "z4",
  "z06",
  "sf15",
  "c7",
  "c6",
  "gt2rs",
]);

/** Tokens whose correct form is neither lower, Title, nor UPPER. Racing people
 *  notice these — a board that prints "Mclaren Mp412c" reads as software that
 *  has never seen the game. */
const FIXUPS: Record<string, string> = {
  mclaren: "McLaren",
  mp412c: "MP4-12C",
  "650s": "650S",
  "570s": "570S",
  "720s": "720S",
  bmw: "BMW",
  amg: "AMG",
  gtr: "GT-R",
  nismo: "NISMO",
  rsr: "RSR",
  lafferrari: "LaFerrari",
  countach: "Countach",
  huracan: "Huracán",
  "935": "935",
  ks: "",
};

function titleise(s: string): string {
  return s
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => {
      const k = w.toLowerCase();
      if (k in FIXUPS) return FIXUPS[k];
      if (UPPER.has(k)) return w.toUpperCase();
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .filter(Boolean)
    .join(" ");
}

type Configured = { host: string; httpPort: number; label?: string | null };

/** Pull the configured server list off a lobby's moduleConfig, defensively —
 *  it is operator-entered JSON, so anything malformed is dropped rather than
 *  trusted. */
export function readConfiguredServers(moduleConfig: unknown): Configured[] {
  const cfg = (moduleConfig ?? {}) as Record<string, unknown>;
  const raw = cfg.acServers;
  if (!Array.isArray(raw)) return [];
  const out: Configured[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const host = typeof r.host === "string" ? r.host.trim() : "";
    const httpPort = Number(r.httpPort);
    if (!host || !isPublicHost(host)) continue;
    if (!Number.isInteger(httpPort) || httpPort < 1 || httpPort > 65535) continue;
    out.push({
      host,
      httpPort,
      label: typeof r.label === "string" ? r.label.slice(0, 60) : null,
    });
    if (out.length >= MAX_SERVERS) break;
  }
  return out;
}

async function pollServer(s: Configured): Promise<AcServer> {
  const base = `http://${s.host}:${s.httpPort}`;
  const id = `${s.host}:${s.httpPort}`;
  const shell: AcServer = {
    id,
    label: s.label ?? null,
    name: null,
    host: s.host,
    httpPort: s.httpPort,
    online: false,
    track: null,
    trackLabel: null,
    session: null,
    sessionLabel: null,
    timeLeftSec: null,
    clients: 0,
    maxClients: 0,
    passworded: false,
    cars: [],
    carLabels: [],
    drivers: [],
    // Content Manager's join handler — one click straight into the session.
    joinUrl: `https://acstuff.club/s/q:race/online/join?ip=${encodeURIComponent(s.host)}&httpPort=${s.httpPort}`,
  };

  try {
    const r = await fetchWithTimeout(`${base}/INFO`, {
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    if (!r.ok) return shell;
    const j: any = await r.json();
    shell.online = true;
    shell.name = typeof j?.name === "string" ? j.name.slice(0, 160) : null;
    shell.track = typeof j?.track === "string" ? j.track : null;
    shell.trackLabel = prettyTrack(shell.track);
    shell.session = Number.isFinite(j?.session) ? Number(j.session) : null;
    shell.sessionLabel =
      shell.session != null ? (SESSION_LABELS[shell.session] ?? `Session ${shell.session}`) : null;
    shell.timeLeftSec = Number.isFinite(j?.timeleft) ? Number(j.timeleft) : null;
    shell.clients = Number.isFinite(j?.clients) ? Number(j.clients) : 0;
    shell.maxClients = Number.isFinite(j?.maxclients) ? Number(j.maxclients) : 0;
    shell.passworded = Boolean(j?.pass);
    shell.cars = Array.isArray(j?.cars) ? j.cars.filter((c: unknown) => typeof c === "string") : [];
    shell.carLabels = shell.cars.map(prettyCar);
  } catch (e) {
    swallow(e);
    return shell;
  }

  // The grid. Only worth a second request when someone is actually on track.
  if (shell.clients > 0) {
    try {
      const r2 = await fetchWithTimeout(`${base}/JSON%7C-1`, {
        headers: { "User-Agent": UA, Accept: "application/json" },
      });
      if (r2.ok) {
        const j2: any = await r2.json();
        const cars = Array.isArray(j2?.Cars) ? j2.Cars : [];
        for (const c of cars) {
          const name = typeof c?.DriverName === "string" ? c.DriverName.trim() : "";
          if (!name) continue;
          const model = typeof c?.Model === "string" ? c.Model : "";
          shell.drivers.push({ name: name.slice(0, 48), car: model, carLabel: prettyCar(model) });
        }
      }
    } catch (e) {
      swallow(e);
    }
  }
  return shell;
}

const cache = new Map<string, { data: AcServer[]; exp: number }>();

export default async function assettoRoutes(app: FastifyInstance) {
  app.get("/assetto/servers", async (req, reply) => {
    const lobbyId = String((req as any).query?.lobby || "").slice(0, 64);
    if (!lobbyId) return reply.send({ ok: true, servers: [] });

    const hit = cache.get(lobbyId);
    if (hit && hit.exp > Date.now()) {
      return reply.send({ ok: true, cached: true, servers: hit.data });
    }

    const lobby = await prisma.lobby
      .findUnique({ where: { id: lobbyId }, select: { moduleConfig: true } })
      .catch(() => null);
    const configured = readConfiguredServers(lobby?.moduleConfig);
    if (configured.length === 0) return reply.send({ ok: true, servers: [] });

    const servers = await Promise.all(configured.map(pollServer));
    cache.set(lobbyId, { data: servers, exp: Date.now() + CACHE_MS });
    return reply.send({ ok: true, servers });
  });
}
