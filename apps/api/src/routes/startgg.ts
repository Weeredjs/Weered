// start.gg module (tier 1, read-only).
//
// A lobby points at ONE start.gg reference — an organizer (user/xxxx), a
// tournament (tournament/slug) or a league (league/slug) — stored in
// Lobby.moduleConfig.startgg. This file resolves that reference into a compact,
// client-ready payload: upcoming tournaments with their events, registration
// state, venue, streams and the stream queue while live, plus recent results.
//
// start.gg has no webhooks, so everything is polled. One in-memory cache per
// reference (5 min at rest, 45 s while a tournament is live, stale-on-error)
// keeps a busy lobby inside the 80 requests/minute token budget. The client
// never talks to start.gg; the token stays server-side (STARTGG_TOKEN).
import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { fetchWithTimeout } from "../lib/fetchWithTimeout";
import { hasLobbyPerm } from "../lib/lobbyPerms";

type Opts = {
  authFromHeader: (h?: string) => any;
  lobbyAdminAccess: (req: any, reply: any, minLevel?: number) => Promise<any>;
};

type RefKind = "user" | "tournament" | "league";
type Ref = { kind: RefKind; slug: string };

const GQL = "https://api.start.gg/gql/alpha";
const TTL_REST_MS = 5 * 60_000;
const TTL_LIVE_MS = 45_000;
const TTL_ERROR_MS = 60_000;

/** Accepts a full start.gg URL, a "kind/slug" pair, or a bare tournament slug. */
export function parseStartggRef(raw: unknown): Ref | null {
  let s = String(raw ?? "").trim();
  if (!s) return null;
  s = s.replace(/^https?:\/\/(www\.)?start\.gg\//i, "").replace(/^\/+/, "");
  s = s.split(/[?#]/)[0].replace(/\/+$/, "");
  const m = s.match(/^(user|tournament|league)\/([A-Za-z0-9_-]{1,80})/i);
  if (m) return { kind: m[1].toLowerCase() as RefKind, slug: m[2] };
  if (/^[A-Za-z0-9_-]{1,80}$/.test(s)) return { kind: "tournament", slug: s };
  return null;
}

// ---------------------------------------------------------------- start.gg IO

async function gql(query: string): Promise<any> {
  const token = process.env.STARTGG_TOKEN || "";
  if (!token) throw new Error("startgg_not_configured");
  const r = await fetchWithTimeout(
    GQL,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ query }),
    },
    12_000,
  );
  const j: any = await r.json().catch(() => null);
  if (r.status === 429) throw new Error("startgg_rate_limited");
  if (!r.ok) throw new Error(`startgg_http_${r.status}`);
  if (Array.isArray(j?.errors) && j.errors.length) {
    throw new Error(
      "startgg_gql: " +
        j.errors
          .map((e: any) => e?.message)
          .join("; ")
          .slice(0, 300),
    );
  }
  return j?.data ?? {};
}

// Field sets. `events(limit:)` keeps a 15-game major inside the 1000-object cap.
const T_UPCOMING = `
  id name slug url(relative: false) startAt endAt state numAttendees isOnline
  isRegistrationOpen registrationClosesAt venueName city addrState countryCode
  images { url type }
  events(limit: 12) { id name state numEntrants startAt videogame { id name displayName } }
  streams { streamName streamSource }
  streamQueue {
    stream { streamName streamSource }
    sets { id fullRoundText state event { name } slots { entrant { name } } }
  }`;

const T_PAST = `
  id name slug url(relative: false) startAt endAt state numAttendees
  events(limit: 12) {
    id name numEntrants videogame { id name displayName }
    standings(query: { perPage: 3 }) { nodes { placement entrant { name } } }
  }`;

function queryFor(ref: Ref): string {
  const slug = `${ref.kind}/${ref.slug}`;
  if (ref.kind === "user") {
    return `{ user(slug: "${slug}") {
      id slug name player { gamerTag } location { city state country }
      images { url type }
      upcoming: tournaments(query: { perPage: 4, filter: { upcoming: true } }) { nodes { ${T_UPCOMING} } }
      past: tournaments(query: { perPage: 2, filter: { past: true } }) { nodes { ${T_PAST} } }
    } }`;
  }
  if (ref.kind === "league") {
    return `{ league(slug: "${slug}") {
      id name slug url(relative: false) startAt endAt images { url type }
      events(query: { perPage: 12 }) { nodes {
        id name state numEntrants startAt videogame { id name displayName }
        tournament { id name slug url(relative: false) startAt endAt state isRegistrationOpen numAttendees isOnline venueName city addrState countryCode }
      } }
    } }`;
  }
  return `{
    t: tournament(slug: "${slug}") { ${T_UPCOMING} }
    r: tournament(slug: "${slug}") { ${T_PAST} }
  }`;
}

// ---------------------------------------------------------------- shaping

const STATE_NAMES: Record<number, string> = { 1: "CREATED", 2: "ACTIVE", 3: "COMPLETED" };
function stateName(s: any): string {
  if (typeof s === "number") return STATE_NAMES[s] || String(s);
  return String(s || "").toUpperCase() || "CREATED";
}
const sec = (v: any): number | null => (typeof v === "number" && v > 0 ? v * 1000 : null);

function pickImage(images: any[] | undefined, prefer: string): string | null {
  const list = Array.isArray(images) ? images : [];
  return list.find((i) => i?.type === prefer)?.url || list[0]?.url || null;
}

function streamUrl(name: string, source: string): string | null {
  const src = String(source || "").toUpperCase();
  if (!name) return null;
  if (src === "TWITCH") return `https://twitch.tv/${name}`;
  if (src === "YOUTUBE") return `https://youtube.com/${name.startsWith("@") ? name : "@" + name}`;
  return null;
}

function shapeTournament(t: any, now: number) {
  if (!t) return null;
  const startAt = sec(t.startAt);
  const endAt = sec(t.endAt);
  const state = stateName(t.state);
  const inWindow = startAt !== null && startAt <= now && (endAt === null || now <= endAt);
  const live = state === "ACTIVE" || (inWindow && state !== "COMPLETED");
  const events = (Array.isArray(t.events) ? t.events : []).map((e: any) => ({
    id: String(e.id),
    name: e.name || "",
    state: stateName(e.state),
    numEntrants: e.numEntrants ?? 0,
    game: e.videogame?.displayName || e.videogame?.name || null,
    startAt: sec(e.startAt),
    top: Array.isArray(e.standings?.nodes)
      ? e.standings.nodes
          .filter((n: any) => n?.entrant?.name)
          .map((n: any) => ({ place: n.placement, name: n.entrant.name }))
      : undefined,
  }));
  const onStream = (Array.isArray(t.streamQueue) ? t.streamQueue : []).flatMap((q: any) => {
    const sname = q?.stream?.streamName || "";
    const url = streamUrl(sname, q?.stream?.streamSource);
    return (Array.isArray(q?.sets) ? q.sets : []).map((s: any) => ({
      stream: sname,
      url,
      round: s?.fullRoundText || "",
      event: s?.event?.name || "",
      state: stateName(s?.state),
      players: (Array.isArray(s?.slots) ? s.slots : [])
        .map((sl: any) => sl?.entrant?.name)
        .filter(Boolean),
    }));
  });
  const where = t.isOnline
    ? "Online"
    : [t.venueName, t.city, t.addrState].filter(Boolean).join(", ") || t.countryCode || null;
  return {
    id: String(t.id),
    name: t.name || "",
    slug: String(t.slug || "").replace(/^tournament\//, ""),
    url: t.url || (t.slug ? `https://www.start.gg/${t.slug}` : null),
    startAt,
    endAt,
    state,
    live,
    numAttendees: t.numAttendees ?? 0,
    isOnline: !!t.isOnline,
    isRegistrationOpen: !!t.isRegistrationOpen,
    registrationClosesAt: sec(t.registrationClosesAt),
    where,
    image: pickImage(t.images, "banner"),
    events,
    streams: (Array.isArray(t.streams) ? t.streams : [])
      .filter((s: any) => s?.streamName)
      .map((s: any) => ({ name: s.streamName, url: streamUrl(s.streamName, s.streamSource) })),
    onStream,
  };
}

function shape(ref: Ref, data: any) {
  const now = Date.now();
  let source: any = null;
  let upcoming: any[] = [];
  let recent: any[] = [];

  if (ref.kind === "user") {
    const u = data?.user;
    if (!u) return null;
    source = {
      kind: "organizer",
      name: u.player?.gamerTag || u.name || "Organizer",
      url: `https://www.start.gg/${u.slug || "user/" + ref.slug}`,
      image: pickImage(u.images, "profile"),
      location: [u.location?.city, u.location?.state].filter(Boolean).join(", ") || null,
    };
    upcoming = (u.upcoming?.nodes || []).map((t: any) => shapeTournament(t, now)).filter(Boolean);
    recent = (u.past?.nodes || []).map((t: any) => shapeTournament(t, now)).filter(Boolean);
  } else if (ref.kind === "league") {
    const l = data?.league;
    if (!l) return null;
    source = {
      kind: "league",
      name: l.name || "League",
      url: l.url || `https://www.start.gg/league/${ref.slug}`,
      image: pickImage(l.images, "banner"),
      location: null,
    };
    // A league is a set of events across tournaments; regroup them by tournament.
    const byT = new Map<string, any>();
    for (const e of l.events?.nodes || []) {
      const t = e?.tournament;
      if (!t) continue;
      const key = String(t.id);
      if (!byT.has(key)) byT.set(key, { ...t, events: [] });
      byT.get(key).events.push(e);
    }
    const all = Array.from(byT.values())
      .map((t) => shapeTournament(t, now))
      .filter(Boolean) as any[];
    upcoming = all.filter((t) => t.state !== "COMPLETED" && (t.endAt === null || t.endAt >= now));
    recent = all.filter((t) => !upcoming.includes(t));
  } else {
    const t = data?.t;
    if (!t) return null;
    const shaped = shapeTournament(t, now)!;
    source = {
      kind: "tournament",
      name: shaped.name,
      url: shaped.url,
      image: shaped.image,
      location: shaped.where,
    };
    if (shaped.state === "COMPLETED") {
      const r = shapeTournament(data?.r, now);
      recent = r ? [r] : [shaped];
    } else {
      upcoming = [shaped];
    }
  }

  upcoming.sort((a, b) => (a.startAt ?? Infinity) - (b.startAt ?? Infinity));
  recent.sort((a, b) => (b.endAt ?? b.startAt ?? 0) - (a.endAt ?? a.startAt ?? 0));
  const live = upcoming.some((t) => t.live);
  return { source, upcoming, recent, live, fetchedAt: now };
}

// ---------------------------------------------------------------- cache

type Entry = {
  at: number;
  ttl: number;
  payload: any | null;
  error: string | null;
  inflight: Promise<any> | null;
};
const cache = new Map<string, Entry>();
const keyOf = (ref: Ref) => `${ref.kind}/${ref.slug}`;

async function fetchPayload(ref: Ref): Promise<any | null> {
  const data = await gql(queryFor(ref));
  return shape(ref, data);
}

/** Cached, single-flight, stale-on-error. Returns null when the ref resolves to nothing. */
async function getPayload(
  ref: Ref,
  force = false,
): Promise<{ payload: any | null; stale: boolean; error: string | null }> {
  const key = keyOf(ref);
  const now = Date.now();
  const e = cache.get(key);
  if (!force && e && now - e.at < e.ttl)
    return { payload: e.payload, stale: false, error: e.error };
  if (e?.inflight) {
    await e.inflight.catch(() => undefined);
    const f = cache.get(key)!;
    return { payload: f.payload, stale: false, error: f.error };
  }
  const entry: Entry = e ?? { at: 0, ttl: 0, payload: null, error: null, inflight: null };
  entry.inflight = fetchPayload(ref)
    .then((payload) => {
      entry.payload = payload;
      entry.error = null;
      entry.at = Date.now();
      entry.ttl = payload?.live ? TTL_LIVE_MS : TTL_REST_MS;
      return payload;
    })
    .catch((err) => {
      // Keep the last good payload; retry after a short back-off.
      entry.error = String(err?.message || err).slice(0, 200);
      entry.at = Date.now();
      entry.ttl = TTL_ERROR_MS;
      throw err;
    })
    .finally(() => {
      entry.inflight = null;
    });
  cache.set(key, entry);
  try {
    const payload = await entry.inflight;
    return { payload, stale: false, error: null };
  } catch {
    return { payload: entry.payload, stale: entry.payload !== null, error: entry.error };
  }
}

// ---------------------------------------------------------------- routes

export default async function startggRoutes(app: FastifyInstance, opts: Opts) {
  const { lobbyAdminAccess } = opts;

  // Public: what this lobby's start.gg reference resolves to right now.
  app.get("/lobbies/:id/startgg", { schema: { tags: ["startgg"] } }, async (req, reply) => {
    const id = String((req.params as any)?.id || "");
    const lobby = await prisma.lobby.findUnique({
      where: { id },
      select: { id: true, moduleConfig: true },
    });
    if (!lobby) return reply.code(404).send({ ok: false, error: "lobby_not_found" });
    const cfg: any = (lobby.moduleConfig as any)?.startgg;
    const ref = parseStartggRef(cfg?.ref);
    if (!ref) return reply.send({ ok: true, configured: false });

    const { payload, stale, error } = await getPayload(ref);
    reply.header("Cache-Control", "public, max-age=30");
    if (!payload) {
      if (error)
        return reply.code(502).send({ ok: false, configured: true, ref: keyOf(ref), error });
      return reply.send({ ok: true, configured: true, ref: keyOf(ref), missing: true });
    }
    return reply.send({ ok: true, configured: true, ref: keyOf(ref), stale, error, ...payload });
  });

  // Lobby admins (level 4+, edit_branding): point the lobby at a start.gg reference, or clear it.
  app.patch("/lobbies/:id/admin/startgg", { schema: { tags: ["startgg"] } }, async (req, reply) => {
    const ctx = await lobbyAdminAccess(req, reply, 4);
    if (!ctx) return;
    if (
      !hasLobbyPerm(
        ctx.member?.roleLevel ?? (ctx.overrideRole ? 5 : 1),
        "edit_branding",
        ctx.overrideRole,
      )
    ) {
      return reply.code(403).send({ ok: false, error: "no_permission" });
    }
    const body: any = (req as any).body || {};
    const raw = typeof body.ref === "string" ? body.ref.trim() : "";
    const cfg: any =
      ctx.lobby.moduleConfig && typeof ctx.lobby.moduleConfig === "object"
        ? { ...(ctx.lobby.moduleConfig as any) }
        : {};

    if (!raw) {
      delete cfg.startgg;
      await prisma.lobby.update({ where: { id: ctx.lobby.id }, data: { moduleConfig: cfg } });
      return reply.send({ ok: true, configured: false });
    }

    const ref = parseStartggRef(raw);
    if (!ref)
      return reply
        .code(400)
        .send({
          ok: false,
          error: "bad_ref",
          message: "Paste a start.gg link: a tournament, an organizer profile, or a league.",
        });

    const { payload, error } = await getPayload(ref, true);
    if (!payload) {
      if (error && error !== "startgg_not_configured") {
        return reply
          .code(502)
          .send({
            ok: false,
            error: "startgg_unavailable",
            message: "start.gg did not answer. Try again in a minute.",
          });
      }
      if (error === "startgg_not_configured") {
        return reply
          .code(503)
          .send({
            ok: false,
            error: "startgg_not_configured",
            message: "The server has no start.gg token.",
          });
      }
      return reply
        .code(404)
        .send({ ok: false, error: "not_found", message: "start.gg has nothing at that link." });
    }

    cfg.startgg = {
      ref: keyOf(ref),
      kind: ref.kind,
      name: payload.source?.name || null,
      url: payload.source?.url || null,
      setAt: new Date().toISOString(),
      setBy: ctx.user?.id || null,
    };
    await prisma.lobby.update({ where: { id: ctx.lobby.id }, data: { moduleConfig: cfg } });
    return reply.send({ ok: true, configured: true, ref: keyOf(ref), ...payload });
  });
}
