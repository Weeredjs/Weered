import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { isStaffUser } from "../lib/isStaffUser";

// The header search: pinned lobbies by name or keyword, rooms by name, and
// — for whoever is allowed to find them — unlisted lobbies. Split out of
// lobbies.ts when it crossed the 1500-line tripwire; nothing else changed.

type Opts = {
  authFromHeader: (h?: string) => { id: string; name: string } | null;
};

export default async function lobbySearchRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader } = opts;

  app.get("/lobbies/search", async (req, reply) => {
    const q = String((req.query as any).q ?? "")
      .trim()
      .toLowerCase();
    if (!q || q.length < 2) return reply.send({ ok: true, pinned: [], rooms: [] });

    // Unlisted lobbies are absent from Browse and never pinned, which made
    // them unreachable from inside the desktop app (no address bar). They
    // are still URL-reachable by anyone, so an EXACT id or name finds one
    // for everyone; staff and the lobby's own members get a partial match.
    const viewer = authFromHeader((req as any).headers?.authorization);
    const staff = viewer ? await isStaffUser(viewer.id).catch(() => false) : false;
    const memberOf = viewer
      ? (
          await prisma.lobbyMember
            .findMany({ where: { userId: viewer.id }, select: { lobbyId: true } })
            .catch(() => [])
        ).map((m) => m.lobbyId)
      : [];
    const unlistedWhere = {
      unlisted: true,
      OR: [
        { id: q },
        { name: { equals: q, mode: "insensitive" as const } },
        ...(staff
          ? [{ name: { contains: q, mode: "insensitive" as const } }, { id: { contains: q } }]
          : []),
        ...(memberOf.length
          ? [{ id: { in: memberOf }, name: { contains: q, mode: "insensitive" as const } }]
          : []),
      ],
    };
    const visibleUnlisted = staff
      ? { unlisted: true }
      : memberOf.length
        ? { unlisted: true, id: { in: memberOf } }
        : { unlisted: true, id: q };

    const [allPinned, matchingRooms, unlistedHits] = await Promise.all([
      prisma.lobby.findMany({
        where: { pinned: true },
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
          ownerId: true,
          _count: { select: { rooms: true, members: true } },
        },
        take: 100,
      }),
      prisma.room.findMany({
        // The lobby filter matters as much as the pinned one above: a room
        // search returns its lobby's name, logo and accent, so without this an
        // unlisted lobby leaks through its own room names.
        where: { name: { contains: q, mode: "insensitive" }, lobby: { unlisted: false } },
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
      prisma.lobby.findMany({
        where: unlistedWhere,
        select: {
          id: true,
          name: true,
          description: true,
          verified: true,
          unlisted: true,
          moduleType: true,
          moduleConfig: true,
          keywords: true,
          accentColor: true,
          logoUrl: true,
          bannerUrl: true,
          websiteUrl: true,
          ownerId: true,
          _count: { select: { rooms: true, members: true } },
        },
        take: 10,
      }),
    ]);

    // Rooms inside an unlisted lobby the viewer is allowed to see. The main
    // room query above excludes unlisted lobbies so a name never leaks; this
    // adds back exactly the ones that are the viewer's to find.
    const unlistedRooms =
      staff || memberOf.length
        ? await prisma.room.findMany({
            where: { name: { contains: q, mode: "insensitive" }, lobby: visibleUnlisted },
            select: {
              id: true,
              name: true,
              locked: true,
              lobbyId: true,
              lobby: { select: { id: true, name: true, accentColor: true, logoUrl: true } },
              _count: { select: { members: true } },
            },
            orderBy: { updatedAt: "desc" },
            take: 10,
          })
        : [];

    const pinned = (allPinned as any[]).filter((l: any) => {
      const kws: string[] = Array.isArray(l.keywords) ? l.keywords : [];
      return (
        l.name.toLowerCase().includes(q) ||
        kws.some((kw: string) => kw.toLowerCase().includes(q) || q.includes(kw.toLowerCase()))
      );
    });

    return reply.send({
      ok: true,
      pinned: [...unlistedHits, ...pinned],
      rooms: [...unlistedRooms, ...matchingRooms],
    });
  });
}
