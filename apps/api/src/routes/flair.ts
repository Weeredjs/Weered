import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { z } from "zod";
import { isStaffUser } from "../lib/isStaffUser";
import { grantFlairToUser, getEquippedFlair, mintFlairItem } from "../lib/flair";

type Opts = {
  authFromHeader: (h?: string) => { id: string; globalRole?: string } | null;
  getGlobalRole?: (userId: string) => Promise<string>;
  canAccessStaff?: (role: string) => boolean;
};

const RARITY_RANK: Record<string, number> = { LEGENDARY: 4, EPIC: 3, RARE: 2, COMMON: 1 };

export default async function flairRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, getGlobalRole, canAccessStaff } = opts;

  const isStaff = (userId: string) => isStaffUser(userId, getGlobalRole, canAccessStaff);

  app.get("/flair/inventory", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });

    const owned = await prisma.userFlair.findMany({
      where: { userId: u.id },
      orderBy: { acquiredAt: "desc" },
    });
    const flairIds = owned.map((o: any) => o.flairItemId);
    const items =
      flairIds.length > 0
        ? await prisma.flairItem.findMany({ where: { id: { in: flairIds } } })
        : [];
    const byId: Record<string, any> = {};
    for (const f of items) byId[f.id] = f;

    const me = await prisma.user.findUnique({
      where: { id: u.id },
      select: { equippedFlairId: true } as any,
    });
    const equippedId = (me as any)?.equippedFlairId || null;

    const inventory = owned
      .map((o: any) => {
        const flairItem = byId[o.flairItemId];
        if (!flairItem) return null;
        return {
          flairItem,
          acquiredAt: o.acquiredAt,
          acquiredFrom: o.acquiredFrom,
          isEquipped: flairItem.id === equippedId,
        };
      })
      .filter(Boolean);

    inventory.sort((a: any, b: any) => {
      const rb = RARITY_RANK[b.flairItem.rarity] || 0;
      const ra = RARITY_RANK[a.flairItem.rarity] || 0;
      if (rb !== ra) return rb - ra;
      return new Date(b.acquiredAt).getTime() - new Date(a.acquiredAt).getTime();
    });

    return reply.send({ ok: true, inventory, equippedFlairId: equippedId });
  });

  app.post(
    "/flair/equip",
    {
      schema: { tags: ["flair"] },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
      const body = (req.body || {}) as any;
      const flairItemId =
        body.flairItemId === null || body.flairItemId === undefined
          ? null
          : String(body.flairItemId);

      if (flairItemId !== null) {
        const owned = await prisma.userFlair.findUnique({
          where: { userId_flairItemId: { userId: u.id, flairItemId } },
        });
        if (!owned) return reply.code(403).send({ ok: false, error: "not_owned" });
      }

      await prisma.user.update({
        where: { id: u.id },
        data: { equippedFlairId: flairItemId } as any,
      });
      return reply.send({ ok: true, equippedFlairId: flairItemId });
    },
  );

  app.get("/flair/items/:id", async (req, reply) => {
    const id = String((req as any).params?.id || "");
    const f = await prisma.flairItem.findUnique({ where: { id } });
    if (!f) return reply.code(404).send({ ok: false, error: "not_found" });
    return reply.send({ ok: true, flairItem: f });
  });

  app.get("/flair/equipped/:userId", async (req, reply) => {
    const userId = String((req as any).params?.userId || "");
    if (!userId) return reply.code(400).send({ ok: false, error: "bad_request" });
    const f = await getEquippedFlair(prisma, userId);
    return reply.send({ ok: true, flair: f });
  });

  app.post(
    "/flair/mint",
    {
      schema: {
        tags: ["flair"],
        body: z
          .object({
            slug: z.string().min(1),
            name: z.string().min(1),
            kind: z.string().optional(),
            source: z.string().optional(),
          })
          .passthrough(),
      },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
      if (!(await isStaff(u.id))) return reply.code(403).send({ ok: false, error: "forbidden" });

      const body = (req.body || {}) as any;
      const slug = String(body.slug || "").trim();
      const name = String(body.name || "").trim();
      const kind = String(body.kind || "").toUpperCase();
      const source = String(body.source || "MANUAL").toUpperCase();
      if (!slug || !name) return reply.code(400).send({ ok: false, error: "missing_fields" });
      if (!["BADGE", "BANNER", "NAMEPLATE"].includes(kind)) {
        return reply.code(400).send({ ok: false, error: "bad_kind" });
      }
      if (!["MANUAL", "TOURNAMENT", "CONTEST", "ACHIEVEMENT", "PURCHASE"].includes(source)) {
        return reply.code(400).send({ ok: false, error: "bad_source" });
      }

      try {
        const created = await mintFlairItem(prisma, {
          slug,
          name,
          description: body.description ? String(body.description) : "",
          kind: kind as any,
          imageUrl: body.imageUrl ? String(body.imageUrl) : null,
          color: body.color ? String(body.color) : null,
          rarity: body.rarity ? String(body.rarity).toUpperCase() : "COMMON",
          source: source as any,
          sourceRefId: body.sourceRefId ? String(body.sourceRefId) : null,
          createdById: u.id,
          meta: body.meta || {},
        });
        return reply.send({ ok: true, flairItem: created });
      } catch (e: any) {
        if (String(e?.code) === "P2002")
          return reply.code(409).send({ ok: false, error: "slug_taken" });
        return reply
          .code(500)
          .send({ ok: false, error: "mint_failed", detail: String(e?.message || e) });
      }
    },
  );

  app.post(
    "/flair/grant",
    {
      schema: {
        tags: ["flair"],
        body: z
          .object({
            userId: z.string().min(1),
            flairItemId: z.string().min(1),
            acquiredFrom: z.string().optional(),
          })
          .passthrough(),
      },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
      if (!(await isStaff(u.id))) return reply.code(403).send({ ok: false, error: "forbidden" });

      const body = (req.body || {}) as any;
      const userId = String(body.userId || "").trim();
      const flairItemId = String(body.flairItemId || "").trim();
      if (!userId || !flairItemId)
        return reply.code(400).send({ ok: false, error: "missing_fields" });

      const result = await grantFlairToUser(
        prisma,
        userId,
        flairItemId,
        body.acquiredFrom ? String(body.acquiredFrom) : undefined,
      );
      return reply.send({ ok: true, ...result });
    },
  );
}
