import { log, swallow } from "../lib/logger";
import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";

type Opts = {
  authFromHeader: (h?: string) => { id: string; name?: string; globalRole?: string } | null;
};

const FACTIONS = new Set(["TERMINIDS", "AUTOMATONS", "ILLUMINATE", "ANY"]);
const SLUG_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

function isStaff(role?: string) {
  const r = String(role || "").toUpperCase();
  return r === "STAFF" || r === "ADMIN" || r === "MODERATOR" || r === "OWNER";
}

function slugify(s: string) {
  return (
    String(s || "")
      .toLowerCase()
      .normalize("NFKD")
      .replaceAll(/[^\w\s-]/g, "")
      .trim()
      .replaceAll(/\s+/g, "-")
      .replaceAll(/-+/g, "-")
      .slice(0, 48) || "loadout"
  );
}

function randSuffix(n = 5) {
  let out = "";
  for (let i = 0; i < n; i++)
    out += SLUG_ALPHABET[Math.floor(Math.random() * SLUG_ALPHABET.length)];
  return out;
}

function clampStr(v: any, max: number, fallback = ""): string {
  if (typeof v !== "string") return fallback;
  return v.slice(0, max);
}

function normalizeFaction(v: any): string {
  const f = String(v || "").toUpperCase();
  return FACTIONS.has(f) ? f : "ANY";
}

export default async function helldiversLoadoutsRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader } = opts;

  app.post("/helldivers/loadouts", async (req, reply) => {
    const auth = authFromHeader(String((req.headers as any).authorization || ""));
    if (!auth?.id) return reply.code(401).send({ ok: false, error: "auth_required" });

    const body = (req.body || {}) as any;
    const name = clampStr(body.name, 80).trim();
    if (!name) return reply.code(400).send({ ok: false, error: "name_required" });

    const primary = clampStr(body.primary, 60).trim();
    const secondary = clampStr(body.secondary, 60).trim();
    const throwable = clampStr(body.throwable, 60).trim();
    const armor = clampStr(body.armor, 60).trim();
    if (!primary || !secondary || !throwable || !armor) {
      return reply.code(400).send({ ok: false, error: "loadout_incomplete" });
    }

    const stratagem1 = clampStr(body.stratagem1, 60).trim();
    const stratagem2 = clampStr(body.stratagem2, 60).trim();
    const stratagem3 = clampStr(body.stratagem3, 60).trim();
    const stratagem4 = clampStr(body.stratagem4, 60).trim();
    if (!stratagem1 || !stratagem2 || !stratagem3 || !stratagem4) {
      return reply.code(400).send({ ok: false, error: "stratagems_incomplete" });
    }

    const description = clampStr(body.description, 1000) || null;
    const helmet = clampStr(body.helmet, 60).trim() || null;
    const faction = normalizeFaction(body.faction);
    const difficulty = clampStr(body.difficulty, 24).trim() || null;
    const role = clampStr(body.role, 32).trim() || null;

    let slug = "";
    for (let attempt = 0; attempt < 6; attempt++) {
      const candidate = `${slugify(name)}-${randSuffix(5)}`;
      const existing = await prisma.helldiversLoadout
        .findUnique({ where: { slug: candidate } })
        .catch(() => null);
      if (!existing) {
        slug = candidate;
        break;
      }
    }
    if (!slug) slug = `${slugify(name)}-${randSuffix(8)}`;

    try {
      const loadout = await prisma.helldiversLoadout.create({
        data: {
          slug,
          name,
          description,
          authorId: auth.id,
          primary,
          secondary,
          throwable,
          armor,
          helmet,
          stratagem1,
          stratagem2,
          stratagem3,
          stratagem4,
          faction,
          difficulty,
          role,
        },
        include: {
          author: { select: { id: true, name: true, usernameKey: true, avatar: true, tier: true } },
        },
      });
      return reply.send({ ok: true, loadout });
    } catch (e: any) {
      log.error("[helldivers/loadouts] create failed", e);
      return reply.code(500).send({ ok: false, error: "create_failed" });
    }
  });

  app.get("/helldivers/loadouts", async (req, reply) => {
    const q = (req.query || {}) as any;
    const faction = q.faction ? String(q.faction).toUpperCase() : null;
    const role = q.role ? String(q.role) : null;
    const difficulty = q.difficulty ? String(q.difficulty) : null;
    const sort = String(q.sort || "top").toLowerCase();
    const limit = Math.min(Math.max(Number.parseInt(String(q.limit || "30"), 10) || 30, 1), 100);
    const offset = Math.max(Number.parseInt(String(q.offset || "0"), 10) || 0, 0);
    const search = clampStr(q.q || q.search, 80).trim();

    const where: any = {};
    if (faction && FACTIONS.has(faction)) where.faction = faction;
    if (role) where.role = role;
    if (difficulty) where.difficulty = difficulty;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { primary: { contains: search, mode: "insensitive" } },
        { secondary: { contains: search, mode: "insensitive" } },
      ];
    }

    let orderBy: any = [{ upvotes: "desc" }, { createdAt: "desc" }];
    if (sort === "new") orderBy = [{ createdAt: "desc" }];
    else if (sort === "views") orderBy = [{ views: "desc" }, { createdAt: "desc" }];
    else if (sort === "controversial") orderBy = [{ downvotes: "desc" }];

    try {
      const [loadouts, total] = await Promise.all([
        prisma.helldiversLoadout.findMany({
          where,
          orderBy,
          take: limit,
          skip: offset,
          include: {
            author: {
              select: { id: true, name: true, usernameKey: true, avatar: true, tier: true },
            },
          },
        }),
        prisma.helldiversLoadout.count({ where }),
      ]);
      return reply.send({ ok: true, loadouts, total, limit, offset });
    } catch (e: any) {
      log.error("[helldivers/loadouts] list failed", e);
      return reply.code(500).send({ ok: false, error: "list_failed" });
    }
  });

  app.get("/helldivers/loadouts/:slug", async (req, reply) => {
    const slug = String((req.params as any).slug || "");
    if (!slug) return reply.code(400).send({ ok: false, error: "slug_required" });
    try {
      const loadout = await prisma.helldiversLoadout.findUnique({
        where: { slug },
        include: {
          author: { select: { id: true, name: true, usernameKey: true, avatar: true, tier: true } },
        },
      });
      if (!loadout) return reply.code(404).send({ ok: false, error: "not_found" });

      prisma.helldiversLoadout
        .update({ where: { slug }, data: { views: { increment: 1 } } })
        .catch(swallow);

      let myVote = 0;
      const auth = authFromHeader(String((req.headers as any).authorization || ""));
      if (auth?.id) {
        const v = await prisma.helldiversLoadoutVote
          .findUnique({
            where: { loadoutId_userId: { loadoutId: loadout.id, userId: auth.id } },
          })
          .catch(() => null);
        myVote = v?.value || 0;
      }

      return reply.send({ ok: true, loadout: { ...loadout, views: loadout.views + 1 }, myVote });
    } catch (e: any) {
      log.error("[helldivers/loadouts] get failed", e);
      return reply.code(500).send({ ok: false, error: "get_failed" });
    }
  });

  app.post("/helldivers/loadouts/:slug/vote", async (req, reply) => {
    const auth = authFromHeader(String((req.headers as any).authorization || ""));
    if (!auth?.id) return reply.code(401).send({ ok: false, error: "auth_required" });

    const slug = String((req.params as any).slug || "");
    const body = (req.body || {}) as any;
    const raw = Number(body.value);
    const value = raw === 1 ? 1 : raw === -1 ? -1 : 0;

    try {
      const loadout = await prisma.helldiversLoadout.findUnique({ where: { slug } });
      if (!loadout) return reply.code(404).send({ ok: false, error: "not_found" });

      if (value === 0) {
        await prisma.helldiversLoadoutVote.deleteMany({
          where: { loadoutId: loadout.id, userId: auth.id },
        });
      } else {
        await prisma.helldiversLoadoutVote.upsert({
          where: { loadoutId_userId: { loadoutId: loadout.id, userId: auth.id } },
          create: { loadoutId: loadout.id, userId: auth.id, value },
          update: { value },
        });
      }

      const [up, down] = await Promise.all([
        prisma.helldiversLoadoutVote.count({ where: { loadoutId: loadout.id, value: 1 } }),
        prisma.helldiversLoadoutVote.count({ where: { loadoutId: loadout.id, value: -1 } }),
      ]);
      const updated = await prisma.helldiversLoadout.update({
        where: { id: loadout.id },
        data: { upvotes: up, downvotes: down },
      });

      return reply.send({
        ok: true,
        upvotes: updated.upvotes,
        downvotes: updated.downvotes,
        myVote: value,
      });
    } catch (e: any) {
      log.error("[helldivers/loadouts] vote failed", e);
      return reply.code(500).send({ ok: false, error: "vote_failed" });
    }
  });

  app.delete("/helldivers/loadouts/:slug", async (req, reply) => {
    const auth = authFromHeader(String((req.headers as any).authorization || ""));
    if (!auth?.id) return reply.code(401).send({ ok: false, error: "auth_required" });

    const slug = String((req.params as any).slug || "");
    try {
      const loadout = await prisma.helldiversLoadout.findUnique({ where: { slug } });
      if (!loadout) return reply.code(404).send({ ok: false, error: "not_found" });

      if (loadout.authorId !== auth.id && !isStaff(auth.globalRole)) {
        return reply.code(403).send({ ok: false, error: "forbidden" });
      }

      await prisma.helldiversLoadout.delete({ where: { id: loadout.id } });
      return reply.send({ ok: true });
    } catch (e: any) {
      log.error("[helldivers/loadouts] delete failed", e);
      return reply.code(500).send({ ok: false, error: "delete_failed" });
    }
  });
}
