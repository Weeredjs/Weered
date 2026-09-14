import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { swallow } from "../lib/logger";
import {
  BAR_NAME_RE,
  getBattles,
  getMaps,
  getPlayerMatches,
  resolveBarUser,
  summarize,
  type BarBattle,
  type BarMatch,
} from "../lib/barApi";

// Beyond All Reason. The data plane is BAR's public live-services API (see
// lib/barApi.ts). There is no sign-in with a BAR account yet — their OAuth
// only publishes a localhost client — so a linked name is self-declared and
// validated against BAR's account list, not proven. When BAR opens OAuth to
// third parties that is the one ask of them, and this is where it plugs in.

type Opts = {
  authFromHeader: (h?: string) => { id: string; name?: string } | null;
};

const lobbyCache = new Map<string, { at: number; value: any }>();
const LOBBY_TTL = 30_000;

function battleSummary(b: BarBattle) {
  return {
    id: b.id,
    title: b.title,
    map: b.map,
    gameType: b.gameType,
    preset: b.preset,
    running: b.running,
    gameTimeSec: b.gameTimeSec,
    passworded: b.passworded,
    players: b.players.length,
    maxPlayers: b.maxPlayers,
    spectators: b.spectators.length,
  };
}

export default async function barRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader } = opts;
  const authed = (req: any) => authFromHeader(req?.headers?.authorization);

  app.get("/bar/battles", async (_req, reply) => {
    try {
      const { fetchedAt, battles } = await getBattles();
      return reply.send({ ok: true, fetchedAt, battles: battles.map(battleSummary) });
    } catch (e) {
      swallow(e);
      return reply.code(502).send({ ok: false, error: "bar_unreachable" });
    }
  });

  app.get("/bar/maps", async (_req, reply) => {
    try {
      const maps = await getMaps();
      reply.header("Cache-Control", "public, max-age=3600");
      return reply.send({ ok: true, maps });
    } catch (e) {
      swallow(e);
      return reply.code(502).send({ ok: false, error: "bar_unreachable" });
    }
  });

  app.get("/bar/players/:name", async (req, reply) => {
    const name = String((req.params as any)?.name || "").trim();
    if (!BAR_NAME_RE.test(name)) {
      return reply.code(400).send({ ok: false, error: "invalid_bar_name" });
    }
    try {
      const matches = await getPlayerMatches(name, 30);
      return reply.send({
        ok: true,
        name,
        summary: summarize(matches),
        recent: matches.slice(0, 10),
      });
    } catch (e) {
      swallow(e);
      return reply.code(502).send({ ok: false, error: "bar_unreachable" });
    }
  });

  app.post("/profile/me/bar", async (req, reply) => {
    const u = authed(req);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const raw = String(((req as any).body || {}).username || "").trim();

    if (raw === "") {
      await prisma.user.update({
        where: { id: u.id },
        data: { barUsername: null, barUserId: null },
      });
      return reply.send({ ok: true, barUsername: null });
    }

    if (!BAR_NAME_RE.test(raw)) {
      return reply.code(400).send({
        ok: false,
        error: "invalid_bar_name",
        message: "BAR names are up to 40 characters: letters, digits, [ ] _ and -.",
      });
    }

    try {
      const hit = await resolveBarUser(raw);
      if (!hit) {
        return reply.code(404).send({
          ok: false,
          error: "bar_user_not_found",
          message: `No Beyond All Reason account is named "${raw}".`,
        });
      }
      await prisma.user.update({
        where: { id: u.id },
        data: { barUsername: hit.username, barUserId: hit.id || null },
      });
      return reply.send({ ok: true, barUsername: hit.username, barUserId: hit.id });
    } catch (e) {
      swallow(e);
      return reply.code(502).send({
        ok: false,
        error: "bar_unreachable",
        message: "Couldn't reach Beyond All Reason just now. Try again in a minute.",
      });
    }
  });

  app.get("/lobbies/:id/bar/members", async (req, reply) => {
    const u = authed(req);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const lobbyId = String((req.params as any)?.id || "");
    if (!lobbyId) return reply.code(400).send({ ok: false, error: "missing_lobby" });

    // Members only: the board names who in the lobby is playing, and where.
    const member = await prisma.lobbyMember.findUnique({
      where: { lobbyId_userId: { lobbyId, userId: u.id } },
      select: { id: true },
    });
    if (!member) return reply.code(403).send({ ok: false, error: "members_only" });

    const cached = lobbyCache.get(lobbyId);
    if (cached && Date.now() - cached.at < LOBBY_TTL) return reply.send(cached.value);

    try {
      const rows = await prisma.lobbyMember.findMany({
        where: { lobbyId },
        select: { userId: true },
        take: 5000,
      });
      const linked = await prisma.user.findMany({
        where: { id: { in: rows.map((r) => r.userId) }, barUsername: { not: null } },
        select: { id: true, name: true, avatar: true, avatarColor: true, barUsername: true },
        orderBy: { name: "asc" },
        take: 300,
      });

      const { battles, fetchedAt } = await getBattles();
      const where = new Map<string, { battle: BarBattle; role: "player" | "spectator" }>();
      for (const b of battles) {
        for (const p of b.players) where.set(p.name.toLowerCase(), { battle: b, role: "player" });
        for (const p of b.spectators)
          if (!where.has(p.name.toLowerCase()))
            where.set(p.name.toLowerCase(), { battle: b, role: "spectator" });
      }

      const members = linked.map((m) => {
        const barName = String(m.barUsername);
        const hit = where.get(barName.toLowerCase()) || null;
        return {
          userId: m.id,
          name: m.name,
          avatar: m.avatar || null,
          avatarColor: m.avatarColor || null,
          barName,
          role: hit?.role ?? null,
          battle: hit ? battleSummary(hit.battle) : null,
        };
      });

      // Recent public matches across the members, merged. Bounded to twelve
      // members so a big lobby is still a handful of cached upstream calls.
      const feedById = new Map<
        string,
        BarMatch & { members: { userId: string; name: string; barName: string; result: string }[] }
      >();
      const sample = [...members]
        .sort((a, b) => Number(!!b.battle) - Number(!!a.battle))
        .slice(0, 12);
      const results = await Promise.allSettled(sample.map((m) => getPlayerMatches(m.barName, 5)));
      results.forEach((res, i) => {
        if (res.status !== "fulfilled") return;
        const who = sample[i];
        for (const match of res.value) {
          const row = feedById.get(match.id) || { ...match, members: [] };
          row.members.push({
            userId: who.userId,
            name: who.name,
            barName: who.barName,
            result: match.result,
          });
          feedById.set(match.id, row);
        }
      });
      const feed = [...feedById.values()]
        .sort((a, b) => b.startTime.localeCompare(a.startTime))
        .slice(0, 25)
        .map(({ result: _r, ...rest }) => rest);

      const openGames = battles
        .filter((b) => !b.running && !b.passworded && !b.locked && b.players.length < b.maxPlayers)
        .sort((a, b) => b.players.length - a.players.length)
        .slice(0, 8)
        .map(battleSummary);

      const value = {
        ok: true,
        fetchedAt,
        linkedCount: members.length,
        inGame: members.filter((m) => m.battle).length,
        members,
        openGames,
        feed,
      };
      lobbyCache.set(lobbyId, { at: Date.now(), value });
      if (lobbyCache.size > 500) {
        const oldest = lobbyCache.keys().next().value;
        if (oldest) lobbyCache.delete(oldest);
      }
      return reply.send(value);
    } catch (e) {
      swallow(e);
      return reply.code(502).send({ ok: false, error: "bar_unreachable" });
    }
  });
}
