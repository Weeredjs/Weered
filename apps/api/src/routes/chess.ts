import type { FastifyInstance } from "fastify";
import { fetchWithTimeout } from "../lib/fetchWithTimeout";
import { prisma } from "../lib/prisma";

type Opts = {
  authFromHeader: (h?: string) => any;
};

const LICHESS_USERNAME_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{1,28}$/;
const CHESS_COM_USERNAME_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{2,24}$/;

export default async function chessRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader } = opts;

  app.post("/profile/me/lichess", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const body: any = (req as any).body || {};
    const raw = String(body.username || "").trim();

    if (raw === "") {
      await prisma.user.update({ where: { id: u.id }, data: { lichessUsername: null } });
      return reply.send({ ok: true, lichessUsername: null });
    }

    if (!LICHESS_USERNAME_RE.test(raw)) {
      return reply.code(400).send({
        ok: false,
        error: "invalid_lichess_username",
        message:
          "Lichess usernames are 2-29 chars, letters/digits/dash/underscore, must start with a letter or digit.",
      });
    }

    try {
      const r = await fetchWithTimeout(`https://lichess.org/api/user/${encodeURIComponent(raw)}`);
      if (r.status === 404) {
        return reply.code(404).send({
          ok: false,
          error: "lichess_user_not_found",
          message: `Lichess user "${raw}" doesn't exist.`,
        });
      }
      if (!r.ok) {
        return reply.code(502).send({
          ok: false,
          error: "lichess_unreachable",
          message: "Couldn't reach Lichess just now. Try again in a sec.",
        });
      }
      const data = await r.json();
      const canonical = (data?.username || raw).trim();
      await prisma.user.update({ where: { id: u.id }, data: { lichessUsername: canonical } });
      return reply.send({ ok: true, lichessUsername: canonical });
    } catch (err: any) {
      return reply
        .code(502)
        .send({ ok: false, error: "lichess_error", message: String(err?.message || err) });
    }
  });

  app.post("/profile/me/chess-com", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const body: any = (req as any).body || {};
    const raw = String(body.username || "").trim();

    if (raw === "") {
      await prisma.user.update({ where: { id: u.id }, data: { chessComUsername: null } });
      return reply.send({ ok: true, chessComUsername: null });
    }

    if (!CHESS_COM_USERNAME_RE.test(raw)) {
      return reply.code(400).send({
        ok: false,
        error: "invalid_chess_com_username",
        message: "Chess.com usernames are 3-25 chars, letters/digits/dash/underscore.",
      });
    }

    try {
      const r = await fetchWithTimeout(
        `https://api.chess.com/pub/player/${encodeURIComponent(raw.toLowerCase())}`,
        {
          headers: { "User-Agent": "Weered (https://weered.ca)" },
        },
      );
      if (r.status === 404) {
        return reply.code(404).send({
          ok: false,
          error: "chess_com_user_not_found",
          message: `Chess.com user "${raw}" doesn't exist.`,
        });
      }
      if (!r.ok) {
        return reply.code(502).send({
          ok: false,
          error: "chess_com_unreachable",
          message: "Couldn't reach Chess.com just now. Try again in a sec.",
        });
      }
      const data = await r.json();
      const canonical = String(data?.username || raw).trim();
      await prisma.user.update({ where: { id: u.id }, data: { chessComUsername: canonical } });
      return reply.send({ ok: true, chessComUsername: canonical });
    } catch (err: any) {
      return reply
        .code(502)
        .send({ ok: false, error: "chess_com_error", message: String(err?.message || err) });
    }
  });

  app.get("/chess/me/profile", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });

    const row = await prisma.user.findUnique({
      where: { id: u.id },
      select: { lichessUsername: true, chessComUsername: true },
    });
    const lichessUsername = row?.lichessUsername || null;
    const chessComUsername = row?.chessComUsername || null;

    const result: any = {
      ok: true,
      lichessUsername,
      chessComUsername,
      lichess: null,
      chessCom: null,
    };

    const ua = { "User-Agent": "Weered (https://weered.ca)" };
    if (lichessUsername) {
      try {
        const r = await fetchWithTimeout(
          `https://lichess.org/api/user/${encodeURIComponent(lichessUsername)}`,
        );
        if (r.ok) {
          const d = await r.json();
          result.lichess = {
            username: d.username,
            url: d.url,
            createdAt: d.createdAt,
            seenAt: d.seenAt,
            perfs: d.perfs
              ? Object.fromEntries(
                  Object.entries(d.perfs).map(([k, v]: any) => [
                    k,
                    { rating: v.rating, games: v.games, prog: v.prog },
                  ]),
                )
              : null,
            count: d.count,
          };
        }
      } catch {}
    }
    if (chessComUsername) {
      try {
        const r = await fetchWithTimeout(
          `https://api.chess.com/pub/player/${encodeURIComponent(chessComUsername.toLowerCase())}/stats`,
          { headers: ua },
        );
        if (r.ok) {
          const d = await r.json();
          result.chessCom = {
            username: chessComUsername,
            url: `https://chess.com/member/${chessComUsername}`,
            ratings: {
              bullet: d.chess_bullet?.last?.rating ?? null,
              blitz: d.chess_blitz?.last?.rating ?? null,
              rapid: d.chess_rapid?.last?.rating ?? null,
              daily: d.chess_daily?.last?.rating ?? null,
            },
          };
        }
      } catch {}
    }

    return reply.send(result);
  });

  app.get("/chess/me/activities", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const q: any = (req as any).query || {};
    const limit = Math.max(1, Math.min(100, Number(q.limit) || 20));

    const rows = await prisma.chessActivityLog.findMany({
      where: { userId: u.id },
      orderBy: { playedAt: "desc" },
      take: limit,
    });

    return reply.send({ ok: true, activities: rows });
  });

  app.get("/chess/leaderboard", async (req, reply) => {
    const q: any = (req as any).query || {};
    const perf = String(q.perf || "blitz");
    const limit = Math.max(1, Math.min(50, Number(q.limit) || 20));

    const users = await prisma.user.findMany({
      where: { lichessUsername: { not: null } },
      select: { id: true, name: true, lichessUsername: true, usernameKey: true },
      take: 200,
    });

    const rows: any[] = [];
    for (const u of users) {
      try {
        const r = await fetchWithTimeout(
          `https://lichess.org/api/user/${encodeURIComponent(u.lichessUsername!)}`,
        );
        if (!r.ok) continue;
        const d = await r.json();
        const rating = d?.perfs?.[perf]?.rating;
        if (typeof rating === "number") {
          rows.push({
            userId: u.id,
            name: u.name,
            usernameKey: u.usernameKey,
            lichessUsername: u.lichessUsername,
            rating,
            games: d?.perfs?.[perf]?.games || 0,
          });
        }
      } catch {}
    }

    rows.sort((a, b) => b.rating - a.rating);
    return reply.send({ ok: true, perf, leaderboard: rows.slice(0, limit) });
  });
}
