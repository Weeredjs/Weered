import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const a = req.headers.authorization || "";
  if (!a.startsWith("Bearer ")) {
    reply.code(401).send({ ok: false, error: "unauthorized" });
    return;
  }
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    reply.code(500).send({ ok: false, error: "JWT_SECRET_missing" });
    return;
  }
  try {
    const token = a.slice("Bearer ".length);
    const payload: any = jwt.verify(token, secret);
    const userId = payload?.userId ?? payload?.sub;
    if (!userId) { reply.code(401).send({ ok: false, error: "unauthorized" }); return; }
    (req as any).auth = { userId: String(userId) };
  } catch {
    reply.code(401).send({ ok: false, error: "unauthorized" });
  }
}

export function makeLobbiesRoutes(prisma: PrismaClient) {
  return async function lobbiesRoutes(app: FastifyInstance) {

    // ── GET /lobbies/search?q=destiny ─────────────────────────────────────────
    // Returns two buckets:
    //   pinned  — lobbies where any keyword matches (case-insensitive contains)
    //   rooms   — rooms across all lobbies where name matches
    // Auth optional — public search.
    app.get("/lobbies/search", async (req, reply) => {
      const q = ((req.query as any).q ?? "").trim().toLowerCase();
      if (!q || q.length < 2) {
        return { ok: true, pinned: [], rooms: [] };
      }

      const [pinnedLobbies, matchingRooms] = await Promise.all([
        // Pinned lobbies: keyword array contains the query term (case-insensitive)
        // We use has_any_keys on the array or a raw contains — Prisma scalar list
        // filter with `hasSome` works for exact matches; for contains we do a
        // raw query to handle partial keyword matching.
        (prisma as any).lobby.findMany({
          where: {
            pinned: true,
            // Match if any keyword in the array contains the search term
            // Prisma doesn't support LIKE on array elements directly, so we
            // pull all pinned lobbies and filter in JS (pinned set is small).
          },
          select: {
            id: true,
            name: true,
            description: true,
            verified: true,
            moduleType: true,
            moduleConfig: true,
            keywords: true,
            accentColor: true,
            logoUrl: true,
            bannerUrl: true,
            websiteUrl: true,
            _count: { select: { rooms: true, members: true } },
          },
          take: 50, // fetch all pinned, filter below
        }),

        // Rooms: name contains the search term, across all lobbies
        (prisma as any).room.findMany({
          where: {
            name: { contains: q, mode: "insensitive" },
          },
          select: {
            id: true,
            name: true,
            locked: true,
            lobbyId: true,
            lobby: { select: { id: true, name: true, accentColor: true, logoUrl: true } },
            _count: { select: { members: true } },
          },
          orderBy: { updatedAt: "desc" },
          take: 20,
        }),
      ]);

      // Filter pinned lobbies: any keyword contains the query term
      const filteredPinned = (pinnedLobbies as any[]).filter((lobby: any) => {
        const keywords: string[] = lobby.keywords ?? [];
        // Match on keyword contains OR lobby name contains
        return (
          lobby.name.toLowerCase().includes(q) ||
          keywords.some((kw: string) => kw.toLowerCase().includes(q) || q.includes(kw.toLowerCase()))
        );
      });

      return {
        ok: true,
        pinned: filteredPinned,
        rooms: matchingRooms,
      };
    });

    // ── GET /lobbies ──────────────────────────────────────────────────────────
    // List all lobbies (staff/admin use + sidebar population)
    app.get("/lobbies", async (_req, reply) => {
      const lobbies = await (prisma as any).lobby.findMany({
        select: {
          id: true,
          name: true,
          description: true,
          verified: true,
          pinned: true,
          moduleType: true,
          accentColor: true,
          logoUrl: true,
          _count: { select: { rooms: true, members: true } },
        },
        orderBy: [{ pinned: "desc" }, { name: "asc" }],
      });
      return { ok: true, lobbies };
    });

    // ── GET /lobbies/:id ──────────────────────────────────────────────────────
    // Full lobby detail including rooms and module config
    app.get("/lobbies/:id", async (req, reply) => {
      const id = (req.params as any).id as string;
      const lobby = await (prisma as any).lobby.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          description: true,
          verified: true,
          pinned: true,
          moduleType: true,
          moduleConfig: true,
          keywords: true,
          accentColor: true,
          logoUrl: true,
          bannerUrl: true,
          websiteUrl: true,
          rooms: {
            select: {
              id: true,
              name: true,
              locked: true,
              _count: { select: { members: true } },
            },
            orderBy: { name: "asc" },
          },
          _count: { select: { rooms: true, members: true } },
        },
      });
      if (!lobby) { reply.code(404).send({ ok: false, error: "not_found" }); return; }
      return { ok: true, lobby };
    });

    // ── POST /lobbies (staff only) ────────────────────────────────────────────
    // Create or upsert a pinned lobby — used by staff to seed game lobbies
    app.post(
      "/lobbies",
      { preHandler: requireAuth as any },
      async (req, reply) => {
        const body = (req.body || {}) as any;
        const {
          id,
          name,
          description = "",
          pinned = false,
          moduleType = "NONE",
          moduleConfig,
          keywords = [],
          accentColor,
          logoUrl,
          bannerUrl,
          websiteUrl,
        } = body;

        if (!id || !name) {
          reply.code(400).send({ ok: false, error: "id and name required" });
          return;
        }

        try {
          const lobby = await (prisma as any).lobby.upsert({
            where: { id: String(id) },
            update: {
              name: String(name),
              description: String(description),
              pinned: Boolean(pinned),
              moduleType,
              moduleConfig: moduleConfig ?? undefined,
              keywords: Array.isArray(keywords) ? keywords.map(String) : [],
              accentColor: accentColor ? String(accentColor) : undefined,
              logoUrl: logoUrl ? String(logoUrl) : undefined,
              bannerUrl: bannerUrl ? String(bannerUrl) : undefined,
              websiteUrl: websiteUrl ? String(websiteUrl) : undefined,
            },
            create: {
              id: String(id),
              name: String(name),
              description: String(description),
              pinned: Boolean(pinned),
              moduleType,
              moduleConfig: moduleConfig ?? undefined,
              keywords: Array.isArray(keywords) ? keywords.map(String) : [],
              accentColor: accentColor ? String(accentColor) : undefined,
              logoUrl: logoUrl ? String(logoUrl) : undefined,
              bannerUrl: bannerUrl ? String(bannerUrl) : undefined,
              websiteUrl: websiteUrl ? String(websiteUrl) : undefined,
            },
          });
          return { ok: true, lobby };
        } catch (err: any) {
          reply.code(400).send({ ok: false, error: String(err?.message ?? err) });
        }
      }
    );

    // ── GET /lobbies/:id/game-account ──────────────────────────────────────────
    // Get the authed user's game account for the lobby's game type
    app.get(
      "/lobbies/:id/game-account",
      { preHandler: requireAuth as any },
      async (req, reply) => {
        const lobbyId = (req.params as any).id as string;
        const userId = (req as any).auth.userId as string;

        const lobby = await (prisma as any).lobby.findUnique({
          where: { id: lobbyId },
          select: { moduleType: true },
        });
        if (!lobby) { reply.code(404).send({ ok: false, error: "not_found" }); return; }
        if (lobby.moduleType === "NONE" || lobby.moduleType === "FEED") {
          return { ok: true, linked: false };
        }

        const account = await (prisma as any).userGameAccount.findUnique({
          where: { userId_gameType: { userId, gameType: lobby.moduleType } },
          select: {
            id: true,
            gameType: true,
            externalId: true,
            displayName: true,
            platform: true,
            cardData: true,
            cardCachedAt: true,
          },
        });

        return { ok: true, linked: !!account, account: account ?? null };
      }
    );

    // ── GET /lobbies/:lobbyId/presence/:userId/game-card ───────────────────────
    // Get another user's game playcard — called when hovering presence in a game lobby
    // Returns cached cardData; caller is responsible for triggering a refresh if stale
    app.get(
      "/lobbies/:lobbyId/presence/:userId/game-card",
      { preHandler: requireAuth as any },
      async (req, reply) => {
        const { lobbyId, userId: targetUserId } = req.params as any;

        const lobby = await (prisma as any).lobby.findUnique({
          where: { id: lobbyId },
          select: { moduleType: true },
        });
        if (!lobby) { reply.code(404).send({ ok: false, error: "not_found" }); return; }
        if (lobby.moduleType === "NONE" || lobby.moduleType === "FEED") {
          return { ok: true, hasCard: false };
        }

        const account = await (prisma as any).userGameAccount.findUnique({
          where: { userId_gameType: { userId: targetUserId, gameType: lobby.moduleType } },
          select: {
            displayName: true,
            platform: true,
            cardData: true,
            cardCachedAt: true,
          },
        });

        if (!account?.cardData) { return { ok: true, hasCard: false }; }

        // Indicate staleness so the client can decide whether to trigger a refresh
        const staleMs = 5 * 60 * 1000; // 5 minutes
        const isStale = !account.cardCachedAt ||
          (Date.now() - new Date(account.cardCachedAt).getTime()) > staleMs;

        return {
          ok: true,
          hasCard: true,
          gameType: lobby.moduleType,
          displayName: account.displayName,
          platform: account.platform,
          cardData: account.cardData,
          isStale,
        };
      }
    );
  };
}
