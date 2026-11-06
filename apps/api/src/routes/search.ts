import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { findLobbiesAndRooms } from "./lobbySearch";

// The search in the bar at the top of every page (James 2026-11-06: "Just
// search that taps into everything"): lobbies and rooms under the header
// search's own rules, then people, crews and forum posts, in one request per
// pause in typing.

type Opts = {
  authFromHeader: (h?: string) => { id: string } | null;
};

const EMPTY = { ok: true, lobbies: [], rooms: [], people: [], crews: [], posts: [] };

/** How well a name answers the query: the whole name, its start, then anywhere. */
export function nameRank(q: string, ...names: (string | null | undefined)[]): number {
  let best = 3;
  for (const raw of names) {
    const n = String(raw || "").toLowerCase();
    if (!n) continue;
    best = Math.min(best, n === q ? 0 : n.startsWith(q) ? 1 : n.includes(q) ? 2 : 3);
  }
  return best;
}

/** Best match first; the order things came in breaks a tie. */
function byRank<T>(list: T[], rank: (x: T) => number): T[] {
  return list
    .map((x, i) => ({ x, i, r: rank(x) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((e) => e.x);
}

export default async function searchRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader } = opts;

  app.get(
    "/search",
    { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const q = String((req.query as any).q ?? "")
        .trim()
        .slice(0, 80);
      if (q.length < 2) return reply.send(EMPTY);
      const lower = q.toLowerCase();
      const viewer = authFromHeader((req as any).headers?.authorization);

      const [places, people, crews, posts] = await Promise.all([
        findLobbiesAndRooms(lower, viewer),
        // More than are shown, so an exact name isn't lost behind busier ones.
        prisma.user.findMany({
          where: {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { usernameKey: { contains: lower } },
            ],
            banned: false,
            isGuest: false,
          },
          select: {
            id: true,
            name: true,
            usernameKey: true,
            avatar: true,
            avatarColor: true,
          },
          orderBy: { notoriety: "desc" },
          take: 25,
        }),
        prisma.crew.findMany({
          where: {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { tagKey: { startsWith: q.toUpperCase() } },
            ],
          },
          select: {
            id: true,
            name: true,
            tag: true,
            tagKey: true,
            logoUrl: true,
            accentColor: true,
            _count: { select: { members: true } },
          },
          take: 15,
        }),
        // A post in an unlisted or deleted lobby stays out, as its rooms do.
        prisma.$queryRaw<any[]>`
          SELECT p.id, p.title, p."lobbyId", p."commentCount", l.name AS "lobbyName"
          FROM "ForumPost" p
          LEFT JOIN "Lobby" l ON l.id = p."lobbyId"
          WHERE p."searchVector" @@ plainto_tsquery('english', ${q})
            AND p."removedAt" IS NULL
            AND (p."lobbyId" IS NULL OR (l.unlisted = false AND l."deletedAt" IS NULL))
          ORDER BY ts_rank(p."searchVector", plainto_tsquery('english', ${q})) DESC,
                   p."createdAt" DESC
          LIMIT 5
        `.catch(() => [] as any[]),
      ]);

      // Lobbies: the best name first, the busier one within it (a keyword
      // match, "night" finding Destiny 2, comes after the names).
      const lobbies = places.pinned
        .map((l: any, i: number) => ({ l, i, r: nameRank(lower, l.name, l.id) }))
        .sort(
          (a, b) =>
            a.r - b.r || (b.l._count?.members ?? 0) - (a.l._count?.members ?? 0) || a.i - b.i,
        )
        .map((e) => e.l);

      return reply.send({
        ok: true,
        lobbies: lobbies.slice(0, 8).map((l: any) => ({
          id: l.id,
          name: l.name,
          verified: !!l.verified,
          unlisted: !!l.unlisted,
          accentColor: l.accentColor ?? null,
          logoUrl: l.logoUrl ?? null,
          members: l._count?.members ?? 0,
        })),
        rooms: byRank(places.rooms, (r: any) => nameRank(lower, r.name)).slice(0, 8),
        people: byRank(people, (p) => nameRank(lower, p.usernameKey, p.name)).slice(0, 6),
        crews: byRank(crews, (c) => nameRank(lower, c.tagKey, c.name)).slice(0, 5),
        posts: posts.map((p) => ({ ...p, commentCount: Number(p.commentCount) || 0 })),
      });
    },
  );
}
