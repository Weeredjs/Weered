// Read side of the game server aggregate.
//
// Three questions, in order of how much they matter to a milsim unit:
//
//   history  — what has this server done for the last N hours
//   rhythm   — what does this server NORMALLY do at this hour of this weekday
//   seeding  — is it worth pushing bodies at it right now
//
// Only the first is what a live server browser gives you. The other two need
// history, which is the whole reason the worker exists.
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";

/** A seed is "working" once a server is climbing toward the population where
 *  Hell Let Loose stops being a walking simulator. 40 is the number the
 *  community uses and the number the lobby copy already quotes. */
const ALIVE_AT = 40;

export default async function gameServerRoutes(app: FastifyInstance) {
  // Full list, not a top-N slice. A unit looking for THEIR server should not
  // fail to find it because it is quiet right now.
  app.get("/gs/servers", { schema: { tags: ["gameServers"] } }, async (req, reply) => {
    const q: any = (req as any).query || {};
    const appId = Number(q.appId) || 686810;
    const search = String(q.q || "")
      .trim()
      .slice(0, 60);
    const region = String(q.region || "")
      .trim()
      .toUpperCase();
    const take = Math.min(Number(q.limit) || 200, 500);

    const rows = await prisma.gameServer.findMany({
      where: {
        appId,
        ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
        ...(region && region !== "ALL" ? { region } : {}),
        ...(q.online === "false" ? {} : { online: true }),
      },
      orderBy: [{ players: "desc" }, { name: "asc" }],
      take,
      select: {
        id: true,
        name: true,
        map: true,
        region: true,
        players: true,
        maxPlayers: true,
        online: true,
        lastSeenAt: true,
      },
    });
    return reply.send({ ok: true, count: rows.length, servers: rows });
  });

  // Raw history for a chart.
  app.get(
    "/gs/servers/:id/history",
    { schema: { tags: ["gameServers"], params: z.object({ id: z.string().min(1) }) } },
    async (req, reply) => {
      const id = String((req as any).params?.id || "");
      const hours = Math.min(Number((req as any).query?.hours) || 48, 24 * 21);
      const since = new Date(Date.now() - hours * 3_600_000);
      const rows = await prisma.gameServerSample.findMany({
        where: { serverId: id, at: { gte: since } },
        orderBy: { at: "asc" },
        select: { players: true, map: true, at: true },
      });
      return reply.send({ ok: true, hours, points: rows.length, samples: rows });
    },
  );

  /**
   * The rhythm: average and peak population per hour-of-week.
   *
   * Bucketed by (weekday, hour) in UTC and returned as 168 buckets. A unit
   * planning a seed does not want "it has 19 players"; they want "it is 19 and
   * it is normally 71 by now", or "it never fills on a Tuesday, don't bother".
   * Computed in SQL because pulling 20k rows into node to average them is
   * wasteful and this runs behind a lobby page.
   */
  app.get(
    "/gs/servers/:id/rhythm",
    { schema: { tags: ["gameServers"], params: z.object({ id: z.string().min(1) }) } },
    async (req, reply) => {
      const id = String((req as any).params?.id || "");
      const server = await prisma.gameServer.findUnique({
        where: { id },
        select: { id: true, name: true, players: true, maxPlayers: true, online: true },
      });
      if (!server) return reply.code(404).send({ ok: false, error: "unknown_server" });

      const rows = await prisma.$queryRaw<
        { dow: number; hour: number; avg: number; peak: number; n: number }[]
      >`
        SELECT EXTRACT(DOW  FROM "at")::int AS dow,
               EXTRACT(HOUR FROM "at")::int AS hour,
               ROUND(AVG("players"))::int   AS avg,
               MAX("players")::int          AS peak,
               COUNT(*)::int                AS n
        FROM "GameServerSample"
        WHERE "serverId" = ${id}
        GROUP BY 1, 2
        ORDER BY 1, 2
      `;

      const now = new Date();
      const bucket = rows.find((r) => r.dow === now.getUTCDay() && r.hour === now.getUTCHours());

      // Enough history to say anything? Two observations of one hour is not a
      // pattern, and presenting it as one would be worse than saying nothing.
      const confident = !!bucket && bucket.n >= 6;

      return reply.send({
        ok: true,
        server,
        buckets: rows,
        now: {
          players: server.players,
          typical: confident ? bucket!.avg : null,
          peakSeen: confident ? bucket!.peak : null,
          samples: bucket?.n ?? 0,
          confident,
          // Signed, so a caller can say "busier than usual" without recomputing.
          delta: confident ? server.players - bucket!.avg : null,
        },
      });
    },
  );

  /**
   * Seeding candidates: servers that are awake but short of the population
   * where the game comes alive, ranked by how close they are to tipping.
   *
   * The ranking is deliberately not "emptiest first". A box at 3/100 needs
   * forty people and will not get them; one at 34/100 needs six and will hold
   * once it tips. That is where a unit's seeding push is worth spending.
   */
  app.get("/gs/seeding", { schema: { tags: ["gameServers"] } }, async (req, reply) => {
    const appId = Number((req as any).query?.appId) || 686810;
    const rows = await prisma.gameServer.findMany({
      where: { appId, online: true, players: { gt: 0, lt: ALIVE_AT } },
      orderBy: { players: "desc" },
      take: 40,
      select: { id: true, name: true, map: true, region: true, players: true, maxPlayers: true },
    });
    return reply.send({
      ok: true,
      aliveAt: ALIVE_AT,
      servers: rows.map((s) => ({ ...s, needs: ALIVE_AT - s.players })),
    });
  });
}
