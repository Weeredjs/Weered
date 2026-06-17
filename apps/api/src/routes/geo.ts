import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { latLngToCell, cellToBoundary, gridDisk } from "h3-js";

type Opts = {
  authFromHeader: (h?: string) => { id: string; name?: string } | null;
};

export default async function geoRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader } = opts;
  const H3_RES = 7;

  app.post(
    "/me/location",
    {
      schema: { tags: ["geo"] },
    },
    async (req, reply) => {
      const viewer = authFromHeader((req as any).headers?.authorization);
      if (!viewer) return reply.code(401).send({ error: "Unauthorized" });
      const body: any = (req as any).body || {};
      const lat = Number(body.latitude);
      const lng = Number(body.longitude);
      if (!isFinite(lat) || !isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return reply.code(400).send({ error: "Invalid coordinates" });
      }
      const h3Index = latLngToCell(lat, lng, H3_RES);
      await prisma.user.update({
        where: { id: viewer.id },
        data: {
          locationOptIn: true,
          latitude: lat,
          longitude: lng,
          locationH3: h3Index,
          locationUpdatedAt: new Date(),
        },
      });
      return reply.send({ ok: true, h3: h3Index });
    },
  );

  app.delete(
    "/me/location",
    {
      schema: { tags: ["geo"] },
    },
    async (req, reply) => {
      const viewer = authFromHeader((req as any).headers?.authorization);
      if (!viewer) return reply.code(401).send({ error: "Unauthorized" });
      await prisma.user.update({
        where: { id: viewer.id },
        data: {
          locationOptIn: false,
          latitude: null,
          longitude: null,
          locationH3: null,
          locationUpdatedAt: null,
        },
      });
      return reply.send({ ok: true });
    },
  );

  app.get("/me/location", async (req, reply) => {
    const viewer = authFromHeader((req as any).headers?.authorization);
    if (!viewer) return reply.code(401).send({ error: "Unauthorized" });
    const u = await prisma.user.findUnique({
      where: { id: viewer.id },
      select: {
        locationOptIn: true,
        latitude: true,
        longitude: true,
        locationH3: true,
        locationUpdatedAt: true,
      },
    });
    return reply.send({
      optIn: u?.locationOptIn || false,
      latitude: u?.latitude || null,
      longitude: u?.longitude || null,
      h3: u?.locationH3 || null,
      updatedAt: u?.locationUpdatedAt || null,
    });
  });

  app.get("/map/hexes", async (req, reply) => {
    const q: any = (req as any).query || {};
    const gameFilter = typeof q.game === "string" ? q.game.trim().toUpperCase() : "";

    let users: { locationH3: string | null }[];
    if (gameFilter) {
      const members = await prisma.lobbyMember.findMany({
        where: { lobby: { moduleType: gameFilter } },
        select: { userId: true },
      });
      const memberIds = [...new Set(members.map((m) => m.userId))];
      if (!memberIds.length) return reply.send({ hexes: [], games: [] });
      users = await prisma.user.findMany({
        where: { locationOptIn: true, locationH3: { not: null }, id: { in: memberIds } },
        select: { locationH3: true },
      });
    } else {
      users = await prisma.user.findMany({
        where: { locationOptIn: true, locationH3: { not: null } },
        select: { locationH3: true },
      });
    }

    const hexCounts = new Map<string, number>();
    for (const u of users) {
      if (!u.locationH3) continue;
      hexCounts.set(u.locationH3, (hexCounts.get(u.locationH3) || 0) + 1);
    }
    const hexes = Array.from(hexCounts.entries()).map(([h3, count]) => {
      const boundary = cellToBoundary(h3);
      return { h3, count, boundary };
    });

    const allLocUsers = await prisma.user.findMany({
      where: { locationOptIn: true, locationH3: { not: null } },
      select: { id: true },
    });
    const locUserIds = new Set(allLocUsers.map((u) => u.id));
    const lobbies = await prisma.lobby.findMany({
      select: { id: true, name: true, moduleType: true, members: { select: { userId: true } } },
    });
    const gameMap = new Map<string, { name: string; count: number }>();
    for (const l of lobbies) {
      const locMembers = l.members.filter((m) => locUserIds.has(m.userId));
      if (!locMembers.length) continue;
      const key = l.moduleType;
      const existing = gameMap.get(key);
      if (existing) {
        existing.count += locMembers.length;
      } else {
        gameMap.set(key, { name: l.moduleType, count: locMembers.length });
      }
    }
    const games = Array.from(gameMap.entries())
      .map(([id, g]) => ({ id, name: g.name, count: g.count }))
      .sort((a, b) => b.count - a.count);

    return reply.send({ hexes, games });
  });

  app.get("/map/nearby", async (req, reply) => {
    const viewer = authFromHeader((req as any).headers?.authorization);
    if (!viewer) return reply.code(401).send({ error: "Unauthorized" });
    const q: any = (req as any).query || {};
    const lat = Number(q.lat);
    const lng = Number(q.lng);
    if (!isFinite(lat) || !isFinite(lng))
      return reply.code(400).send({ error: "lat/lng required" });
    const center = latLngToCell(lat, lng, H3_RES);
    const ring = gridDisk(center, 1);
    const nearby = await prisma.user.findMany({
      where: { locationOptIn: true, locationH3: { in: ring } },
      select: {
        id: true,
        usernameKey: true,
        name: true,
        avatar: true,
        avatarColor: true,
        tier: true,
        locationH3: true,
      },
    });
    const others = nearby.filter((u) => u.id !== viewer.id).slice(0, 50);
    const userIds = others.map((u) => u.id);
    const memberships = userIds.length
      ? await prisma.lobbyMember.findMany({
          where: { userId: { in: userIds } },
          select: {
            userId: true,
            lobbyId: true,
            lobby: { select: { name: true } },
            updatedAt: true,
          },
          orderBy: { updatedAt: "desc" },
        })
      : [];
    const lobbyMap = new Map<string, { lobbyId: string; lobbyName: string }>();
    for (const m of memberships) {
      if (!lobbyMap.has(m.userId))
        lobbyMap.set(m.userId, { lobbyId: m.lobbyId, lobbyName: m.lobby.name });
    }
    const enriched = others.map((u) => {
      const lm = lobbyMap.get(u.id);
      return { ...u, lobbyId: lm?.lobbyId || null, lobbyName: lm?.lobbyName || null };
    });
    return reply.send({ hex: center, nearbyCount: enriched.length, users: enriched });
  });

  app.get("/map/lobbies", async (_req, reply) => {
    const locUsers = await prisma.user.findMany({
      where: { locationOptIn: true, latitude: { not: null }, longitude: { not: null } },
      select: { id: true, latitude: true, longitude: true },
    });
    const locMap = new Map<string, { lat: number; lng: number }>();
    for (const u of locUsers) {
      if (u.latitude != null && u.longitude != null)
        locMap.set(u.id, { lat: u.latitude, lng: u.longitude });
    }

    const lobbies = await prisma.lobby.findMany({
      select: {
        id: true,
        name: true,
        logoUrl: true,
        accentColor: true,
        moduleType: true,
        members: { select: { userId: true } },
        _count: { select: { members: true } },
      },
    });

    const pins = lobbies
      .map((l) => {
        const membersWithLoc = l.members.map((m) => locMap.get(m.userId)).filter(Boolean) as {
          lat: number;
          lng: number;
        }[];
        if (!membersWithLoc.length) return null;
        let sumLat = 0,
          sumLng = 0;
        for (const m of membersWithLoc) {
          sumLat += m.lat;
          sumLng += m.lng;
        }
        return {
          id: l.id,
          name: l.name,
          logoUrl: l.logoUrl,
          accentColor: l.accentColor,
          moduleType: l.moduleType,
          memberCount: l._count.members,
          lat: sumLat / membersWithLoc.length,
          lng: sumLng / membersWithLoc.length,
        };
      })
      .filter(Boolean);

    return reply.send({ lobbies: pins });
  });
}
