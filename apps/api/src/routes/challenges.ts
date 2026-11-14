import { isStaffRole } from "../lib/lobbyAuth";
import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { z } from "zod";
import { LobbyRole, GlobalRole } from "@prisma/client";
import { isRealDate, sizeProblem } from "../lib/fieldSize";
import { adoptPicture, pictureName, pictureSize } from "../lib/adoptPicture";

// What a challenge may hold (lib/fieldSize.ts). The longest live title is 74
// characters, description 239, and objectives 750 as JSON.
const CHALLENGE_LIMITS = {
  title: 200,
  description: 2000,
  iconUrl: 500,
  category: 50,
  scope: 40,
  lobbyId: 64,
  crewId: 64,
  badgeId: 64,
  objectives: 20_000,
  recurSchedule: 2000,
  requiredModifiers: 4000,
  requireDifficultyTier: 200,
} as const;

type Opts = {
  authFromHeader: (h?: string) => { id: string; name?: string; globalRole?: string } | null;
  getGlobalRole: (userId: string) => Promise<GlobalRole>;
  canAccessStaff: (role: GlobalRole) => boolean;
  getLobbyRole: (userId: string, lobbyId: string) => Promise<LobbyRole | null>;
};

export default async function challengesRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, getGlobalRole, canAccessStaff, getLobbyRole } = opts;

  app.get("/challenges", async (req, reply) => {
    const { scope, lobbyId, category } = req.query as any;
    const defFilter: any = { status: { not: "ARCHIVED" } };
    if (scope) defFilter.scope = scope;
    if (lobbyId) defFilter.lobbyId = lobbyId;
    if (category) defFilter.category = category;
    const where: any = { status: "ACTIVE", definition: defFilter };
    const instances = await prisma.challengeInstance.findMany({
      where,
      include: { definition: true, _count: { select: { enrollments: true } } },
      orderBy: { startsAt: "desc" },
      take: 50,
    });
    return reply.send({ ok: true, challenges: instances });
  });

  app.get("/challenges/:instanceId", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    const instanceId = String((req as any).params?.instanceId || "");
    const instance = await prisma.challengeInstance.findUnique({
      where: { id: instanceId },
      include: { definition: true, _count: { select: { enrollments: true } } },
    });
    if (!instance) return reply.code(404).send({ ok: false, error: "not_found" });

    let enrollment = null;
    if (u) {
      enrollment = await prisma.challengeEnrollment.findUnique({
        where: { instanceId_userId: { instanceId, userId: u.id } },
      });
    }
    return reply.send({ ok: true, challenge: instance, enrollment });
  });

  app.post(
    "/challenges/:instanceId/enroll",
    {
      schema: { tags: ["challenges"], params: z.object({ instanceId: z.string().min(1) }) },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });

      const instanceId = String((req as any).params?.instanceId || "");
      const instance = await prisma.challengeInstance.findUnique({
        where: { id: instanceId },
        include: { definition: true },
      });
      if (!instance || instance.status !== "ACTIVE")
        return reply.code(400).send({ ok: false, error: "challenge_not_active" });
      if (instance.endsAt && new Date() > instance.endsAt)
        return reply.code(400).send({ ok: false, error: "challenge_expired" });

      const acct = await prisma.userGameAccount.findFirst({
        where: { userId: u.id, gameType: "BUNGIE" },
      });
      if (!acct) return reply.code(400).send({ ok: false, error: "bungie_not_linked" });

      const objectives = (instance.definition.objectives as any[]) || [];
      const progress: Record<string, any> = {};
      for (const obj of objectives) {
        progress[obj.id] = { current: 0, target: obj.target, completed: false };
      }

      try {
        const enrollment = await prisma.challengeEnrollment.create({
          data: { instanceId, userId: u.id, progress: progress as any },
        });
        return reply.send({ ok: true, enrollment });
      } catch (e: any) {
        if (e.code === "P2002") return reply.send({ ok: true, error: "already_enrolled" });
        throw e;
      }
    },
  );

  app.delete(
    "/challenges/:instanceId/enroll",
    {
      schema: { tags: ["challenges"], params: z.object({ instanceId: z.string().min(1) }) },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
      const instanceId = String((req as any).params?.instanceId || "");

      await prisma.challengeEnrollment.updateMany({
        where: { instanceId, userId: u.id, status: "ACTIVE" },
        data: { status: "ABANDONED" },
      });
      return reply.send({ ok: true });
    },
  );

  app.get("/challenges/my", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });

    const enrollments = await prisma.challengeEnrollment.findMany({
      where: { userId: u.id },
      include: { instance: { include: { definition: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return reply.send({ ok: true, enrollments });
  });

  app.get("/challenges/:instanceId/leaderboard", async (req, reply) => {
    const instanceId = String((req as any).params?.instanceId || "");
    const enrollments = await prisma.challengeEnrollment.findMany({
      where: { instanceId, status: "COMPLETED" },
      orderBy: { completedAt: "asc" },
      take: 50,
    });
    const userIds = enrollments.map((e) => e.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, tier: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));
    const leaderboard = enrollments.map((e, i) => ({
      rank: i + 1,
      userId: e.userId,
      name: userMap.get(e.userId)?.name || "Unknown",
      tier: userMap.get(e.userId)?.tier || "INNOCENT",
      completedAt: e.completedAt,
    }));
    return reply.send({ ok: true, leaderboard });
  });

  /**
   * A challenge's rewards are minted when it is completed, so who may set
   * them is a question about money (fan-out audit, 2026-11-13). Staff set any
   * reward up to a ceiling. A lobby owner or moderator, or the member who made
   * the challenge, sets small ones (the largest a member had set was 100
   * Paper) and no badge: badges are staff's to give. A reward is a whole
   * number of zero or more; requireCount is 1 to 50 or none.
   */
  function rewardFields(body: any, staff: boolean): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    const cap = staff ? 1_000_000 : 500;
    const amount = (v: unknown) => {
      const n = Number.parseInt(String(v ?? ""), 10);
      return Number.isFinite(n) ? Math.max(0, Math.min(cap, n)) : 0;
    };
    if (body.notorietyReward !== undefined) out.notorietyReward = amount(body.notorietyReward);
    if (body.paperReward !== undefined) out.paperReward = amount(body.paperReward);
    if (body.crewRepReward !== undefined) out.crewRepReward = amount(body.crewRepReward);
    if (body.badgeId !== undefined && staff)
      out.badgeId = body.badgeId ? String(body.badgeId) : null;
    if (body.requireCount !== undefined) {
      const n = Number.parseInt(String(body.requireCount ?? ""), 10);
      out.requireCount = Number.isFinite(n) && n > 0 ? Math.min(50, n) : null;
    }
    return out;
  }

  async function canManageChallenge(
    userId: string,
    def: { lobbyId: string | null; createdById: string },
  ): Promise<boolean> {
    const role = await getGlobalRole(userId);
    if (canAccessStaff(role)) return true;
    if (def.createdById === userId) return true;
    if (def.lobbyId) {
      const lr = await getLobbyRole(userId, def.lobbyId);
      if (lr === LobbyRole.OWNER || lr === LobbyRole.MOD) return true;
    }
    return false;
  }

  app.post(
    "/challenges/definitions",
    {
      schema: { tags: ["challenges"] },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });

      const body = (req.body || {}) as any;
      // Sizes first (lib/fieldSize.ts): this stored whatever it was sent.
      const big = sizeProblem(body, CHALLENGE_LIMITS);
      if (big) return reply.code(400).send({ ok: false, ...big });
      const role = await getGlobalRole(u.id);
      const isStaff = isStaffRole(role);
      if (!isStaff) {
        if (!body.lobbyId) return reply.code(403).send({ ok: false, error: "forbidden" });
        const lr = await getLobbyRole(u.id, body.lobbyId);
        if (lr !== LobbyRole.OWNER && lr !== LobbyRole.MOD) {
          return reply.code(403).send({ ok: false, error: "forbidden" });
        }
      }

      // Linked from another site: copied in and screened (lib/adoptPicture.ts).
      const icon = await adoptPicture(body.iconUrl ? String(body.iconUrl) : null, {
        kind: "banners",
        name: pictureName.challenge(String(body.lobbyId || "global")),
        uploaderId: u.id,
        ...pictureSize.icon,
      });
      if (!icon.ok)
        return reply.code(icon.code).send({ ok: false, error: icon.error, message: icon.message });
      const def = await prisma.challengeDefinition.create({
        data: {
          title: String(body.title || "").trim(),
          description: String(body.description || "").trim(),
          iconUrl: icon.url,
          category: String(body.category || "").trim(),
          difficulty: Number.parseInt(body.difficulty) || 1,
          scope: body.scope || "GLOBAL",
          lobbyId: body.lobbyId || null,
          crewId: body.crewId || null,
          createdById: u.id,
          objectives: body.objectives || [],
          requireAll: body.requireAll !== false,
          requireCount: null,
          notorietyReward: 0,
          paperReward: 0,
          crewRepReward: 0,
          badgeId: null,
          ...rewardFields(body, isStaff),
          isRecurring: body.isRecurring === true,
          recurSchedule: body.recurSchedule || null,
          requiredModifiers: Array.isArray(body.requiredModifiers) ? body.requiredModifiers : [],
          requireDifficultyTier: body.requireDifficultyTier
            ? Number.parseInt(body.requireDifficultyTier)
            : null,
          minPartySize: body.minPartySize ? Number.parseInt(body.minPartySize) : null,
          maxPartySize: body.maxPartySize ? Number.parseInt(body.maxPartySize) : null,
          status: "DRAFT",
        },
      });
      return reply.send({ ok: true, definition: def });
    },
  );

  app.post(
    "/challenges/member-create",
    {
      schema: { tags: ["challenges"] },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
      const body = req.body as any;
      const lobbyId = String(body.lobbyId || "");
      if (!lobbyId)
        return reply.code(400).send({
          ok: false,
          error: "lobby_required",
          message: "Create challenges from inside a lobby.",
        });

      const role = await getGlobalRole(u.id);
      const isStaff = isStaffRole(role);
      if (!isStaff) {
        const lobby = await prisma.lobby.findUnique({
          where: { id: lobbyId },
          select: { ownerId: true, name: true },
        });
        const lr = await getLobbyRole(u.id, lobbyId);
        const isMember = lr !== null || (lobby && lobby.ownerId === u.id);
        if (!isMember) {
          return reply.code(403).send({
            ok: false,
            error: "not_a_member",
            message: `Join the ${lobby?.name || "lobby"} to build a challenge here.`,
          });
        }
        const liveCount = await prisma.challengeDefinition.count({
          where: { createdById: u.id, status: "ACTIVE" },
        });
        if (liveCount >= 3) {
          return reply.code(400).send({
            ok: false,
            error: "challenge_limit",
            message: "You already have 3 live challenges. Delete one to build another.",
          });
        }
      }

      const { DESTINY_MODIFIERS } = await import("../lib/destinyModifiers");
      const bySlug: Record<string, any> = {};
      const byHash: Record<string, any> = {};
      for (const m of DESTINY_MODIFIERS as any[]) {
        bySlug[m.slug] = m;
        byHash[String(m.hash)] = m;
      }

      const g = globalThis as any;
      if (!g.__skullNameMap) {
        try {
          const fs = await import("fs");
          const path = await import("path");
          const p = path.join(process.cwd(), "manifest-cache", "skulls.json");
          const raw = JSON.parse(fs.readFileSync(p, "utf-8"));
          const map: Record<string, string> = {};
          for (const [sid, v] of Object.entries(raw)) {
            const nm = ((v as any)?.name || "").trim();
            if (nm && !map[nm]) map[nm] = sid;
          }
          g.__skullNameMap = map;
        } catch {
          g.__skullNameMap = {};
        }
      }
      const skullByName: Record<string, string> = g.__skullNameMap;

      function resolveModifier(idf: string): { hash: string; name: string } | null {
        const m = bySlug[idf] || byHash[String(idf)];
        if (!m) return null;
        const skull = skullByName[(m.name || "").trim()];
        return { hash: skull || String(m.hash), name: m.name };
      }

      const ACTIVITY: Record<string, { modes?: number[]; label: string }> = {
        ANY: { label: "any activity" },
        DUNGEON: { modes: [82, 69], label: "a Dungeon" },
        RAID: { modes: [4], label: "a Raid" },
        NIGHTFALL: { modes: [16, 17, 46], label: "a Nightfall" },
        STRIKE: { modes: [3, 18], label: "a Strike" },
        CRUCIBLE: { modes: [5, 10, 12, 19, 24, 25, 31, 37, 38, 43, 84], label: "a Crucible match" },
        GAMBIT: { modes: [63, 48, 75], label: "a Gambit match" },
      };

      const steps: any[] = Array.isArray(body.steps) ? body.steps.slice(0, 5) : [];
      if (steps.length === 0)
        return reply
          .code(400)
          .send({ ok: false, error: "no_steps", message: "Add at least one step." });

      const objectives: any[] = [];
      const descParts: string[] = [];
      steps.forEach((s: any, i: number) => {
        const act = ACTIVITY[String(s.activity || "ANY").toUpperCase()] || ACTIVITY.ANY;
        const count = Math.max(1, Math.min(10, Number.parseInt(s.count) || 1));
        const mods = (Array.isArray(s.modifiers) ? s.modifiers : [])
          .map((x: any) => resolveModifier(String(x)))
          .filter(Boolean) as { hash: string; name: string }[];
        const filters: any = { requireCompletion: true };
        if (act.modes) filters.modes = act.modes;
        if (mods.length) filters.requiredModifiers = mods.map((m) => m.hash);
        const modText = mods.length ? ` with ${mods.map((m) => m.name).join(" + ")}` : "";
        objectives.push({
          id: `s${i + 1}`,
          type: "activities",
          target: count,
          filters,
          description: `Complete ${count}× ${act.label}${modText}`,
        });
        descParts.push(`${count}× ${act.label}${modText}`);
      });

      const title =
        String(body.title || "")
          .trim()
          .slice(0, 80) || "Complete " + descParts.join(", then ");

      const def = await prisma.challengeDefinition.create({
        data: {
          title,
          description: descParts.map((p) => "• " + p).join("\n"),
          category: "pve",
          difficulty: 1,
          scope: "LOBBY",
          lobbyId,
          createdById: u.id,
          objectives,
          requireAll: true,
          requiredModifiers: [],
          notorietyReward: 0,
          status: "ACTIVE",
        },
      });
      await prisma.challengeInstance.create({
        data: { definitionId: def.id, startsAt: new Date(), status: "ACTIVE" },
      });

      return reply.send({ ok: true, definition: def });
    },
  );

  app.patch(
    "/challenges/definitions/:id",
    {
      schema: { tags: ["challenges"], params: z.object({ id: z.string().min(1) }) },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
      const id = String((req as any).params?.id || "");
      const def = await prisma.challengeDefinition.findUnique({
        where: { id },
        select: {
          id: true,
          lobbyId: true,
          createdById: true,
          _count: { select: { instances: true } },
        },
      });
      if (!def) return reply.code(404).send({ ok: false, error: "not_found" });
      if (!(await canManageChallenge(u.id, def))) {
        return reply.code(403).send({ ok: false, error: "forbidden" });
      }
      const body = (req as any).body || {};
      // The words are cut to size below; the objectives had no limit at all.
      const big = sizeProblem(body, { objectives: CHALLENGE_LIMITS.objectives });
      if (big) return reply.code(400).send({ ok: false, ...big });
      const data: any = {};
      if (body.title !== undefined)
        data.title = String(body.title || "")
          .trim()
          .slice(0, 200);
      if (body.description !== undefined)
        data.description = String(body.description || "")
          .trim()
          .slice(0, 2000);
      if (body.iconUrl !== undefined) {
        // Linked from another site: copied in and screened (lib/adoptPicture.ts).
        const icon = await adoptPicture(body.iconUrl ? String(body.iconUrl).slice(0, 500) : null, {
          kind: "banners",
          name: pictureName.challenge(String(def.lobbyId || "global")),
          uploaderId: u.id,
          ...pictureSize.icon,
        });
        if (!icon.ok)
          return reply
            .code(icon.code)
            .send({ ok: false, error: icon.error, message: icon.message });
        data.iconUrl = icon.url;
      }
      if (body.category !== undefined)
        data.category = String(body.category || "")
          .trim()
          .slice(0, 50);
      if (body.difficulty !== undefined)
        data.difficulty = Math.max(1, Math.min(5, Number.parseInt(body.difficulty) || 1));
      if (body.requireAll !== undefined) data.requireAll = !!body.requireAll;
      Object.assign(data, rewardFields(body, isStaffRole(await getGlobalRole(u.id))));
      if (body.isRecurring !== undefined) data.isRecurring = !!body.isRecurring;
      if (body.recurSchedule !== undefined) data.recurSchedule = body.recurSchedule || null;
      if (body.requiredModifiers !== undefined)
        data.requiredModifiers = Array.isArray(body.requiredModifiers)
          ? body.requiredModifiers
          : [];
      if (body.requireDifficultyTier !== undefined)
        data.requireDifficultyTier = body.requireDifficultyTier
          ? Number.parseInt(body.requireDifficultyTier)
          : null;
      if (body.minPartySize !== undefined)
        data.minPartySize = body.minPartySize ? Number.parseInt(body.minPartySize) : null;
      if (body.maxPartySize !== undefined)
        data.maxPartySize = body.maxPartySize ? Number.parseInt(body.maxPartySize) : null;
      if (body.status !== undefined && ["DRAFT", "ACTIVE", "ARCHIVED"].includes(body.status))
        data.status = body.status;
      if (body.objectives !== undefined) {
        if (def._count.instances > 0) {
          const existing = await prisma.challengeDefinition.findUnique({
            where: { id },
            select: { objectives: true },
          });
          const existingObjs: any[] = (existing?.objectives as any[]) || [];
          const incomingById: Record<string, any> = {};
          for (const o of body.objectives as any[]) if (o?.id) incomingById[o.id] = o;
          const merged = existingObjs.map((eo: any) => {
            const inc = incomingById[eo.id];
            if (!inc) return eo;
            const newTarget = Number(inc.target);
            if (Number.isFinite(newTarget) && newTarget > 0 && newTarget !== eo.target) {
              return { ...eo, target: newTarget };
            }
            return eo;
          });
          data.objectives = merged;
        } else {
          data.objectives = body.objectives;
        }
      }
      if (Object.keys(data).length === 0)
        return reply.code(400).send({ ok: false, error: "no_fields" });
      const updated = await prisma.challengeDefinition.update({ where: { id }, data });
      return reply.send({ ok: true, definition: updated });
    },
  );

  app.delete(
    "/challenges/definitions/:id",
    {
      schema: { tags: ["challenges"], params: z.object({ id: z.string().min(1) }) },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
      const id = String((req as any).params?.id || "");
      const def = await prisma.challengeDefinition.findUnique({
        where: { id },
        select: {
          id: true,
          lobbyId: true,
          createdById: true,
          _count: { select: { instances: true } },
        },
      });
      if (!def) return reply.code(404).send({ ok: false, error: "not_found" });
      if (!(await canManageChallenge(u.id, def))) {
        return reply.code(403).send({ ok: false, error: "forbidden" });
      }
      if (def._count.instances > 0) {
        await prisma.challengeDefinition.update({ where: { id }, data: { status: "ARCHIVED" } });
        await prisma.challengeInstance.updateMany({
          where: { definitionId: id, status: "ACTIVE" },
          data: { status: "ARCHIVED" },
        });
        return reply.send({ ok: true, mode: "archived" });
      }
      await prisma.challengeDefinition.delete({ where: { id } });
      return reply.send({ ok: true, mode: "deleted" });
    },
  );

  app.patch(
    "/challenges/instances/:id",
    {
      schema: { tags: ["challenges"], params: z.object({ id: z.string().min(1) }) },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
      const id = String((req as any).params?.id || "");
      const instance = await prisma.challengeInstance.findUnique({
        where: { id },
        include: { definition: { select: { id: true, lobbyId: true, createdById: true } } },
      });
      if (!instance) return reply.code(404).send({ ok: false, error: "not_found" });
      if (!(await canManageChallenge(u.id, instance.definition))) {
        return reply.code(403).send({ ok: false, error: "forbidden" });
      }
      const body = (req as any).body || {};
      const data: any = {};
      if (body.startsAt !== undefined) {
        if (!isRealDate(body.startsAt))
          return reply.code(400).send({ ok: false, error: "bad_date" });
        data.startsAt = new Date(body.startsAt);
        // Activity before the challenge existed does not count towards it:
        // moving the start back made every past game a completion.
        if (data.startsAt < instance.createdAt && !isStaffRole(await getGlobalRole(u.id)))
          return reply.code(400).send({
            ok: false,
            error: "start_in_past",
            message: "A challenge can't start before it was made.",
          });
      }
      if (body.endsAt !== undefined) {
        if (body.endsAt && !isRealDate(body.endsAt))
          return reply.code(400).send({ ok: false, error: "bad_date" });
        data.endsAt = body.endsAt ? new Date(body.endsAt) : null;
      }
      if (
        body.status !== undefined &&
        ["ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"].includes(body.status)
      )
        data.status = body.status;
      if (Object.keys(data).length === 0)
        return reply.code(400).send({ ok: false, error: "no_fields" });
      const updated = await prisma.challengeInstance.update({ where: { id }, data });
      return reply.send({ ok: true, instance: updated });
    },
  );

  app.delete(
    "/challenges/instances/:id",
    {
      schema: { tags: ["challenges"], params: z.object({ id: z.string().min(1) }) },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
      const id = String((req as any).params?.id || "");
      const instance = await prisma.challengeInstance.findUnique({
        where: { id },
        include: {
          definition: { select: { id: true, lobbyId: true, createdById: true } },
          _count: { select: { enrollments: true } },
        },
      });
      if (!instance) return reply.code(404).send({ ok: false, error: "not_found" });
      if (!(await canManageChallenge(u.id, instance.definition))) {
        return reply.code(403).send({ ok: false, error: "forbidden" });
      }
      if (instance._count.enrollments > 0) {
        await prisma.challengeInstance.update({ where: { id }, data: { status: "ARCHIVED" } });
        return reply.send({ ok: true, mode: "archived" });
      }
      await prisma.challengeInstance.delete({ where: { id } });
      return reply.send({ ok: true, mode: "deleted" });
    },
  );

  app.get("/challenges/modifiers/catalog", async (_req, reply) => {
    const { DESTINY_MODIFIERS } = await import("../lib/destinyModifiers");
    return reply.send({ ok: true, modifiers: DESTINY_MODIFIERS });
  });

  app.post(
    "/challenges/definitions/:id/activate",
    {
      schema: { tags: ["challenges"], params: z.object({ id: z.string().min(1) }) },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
      // The role is read from the account. A session never carried one, so
      // reading it off the session (as this did) refused staff every time.
      if (!isStaffRole(await getGlobalRole(u.id))) {
        return reply.code(403).send({ ok: false, error: "forbidden" });
      }

      const defId = String((req as any).params?.id || "");
      const body = req.body as any;
      const def = await prisma.challengeDefinition.findUnique({ where: { id: defId } });
      if (!def) return reply.code(404).send({ ok: false, error: "not_found" });

      await prisma.challengeDefinition.update({ where: { id: defId }, data: { status: "ACTIVE" } });

      const instance = await prisma.challengeInstance.create({
        data: {
          definitionId: defId,
          startsAt: body.startsAt ? new Date(body.startsAt) : new Date(),
          endsAt: body.endsAt ? new Date(body.endsAt) : null,
          status: "ACTIVE",
        },
      });
      return reply.send({ ok: true, instance });
    },
  );

  app.get("/challenges/definitions", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const q: any = (req as any).query || {};
    const lobbyId = q.lobbyId ? String(q.lobbyId) : null;
    const where: any = {};
    if (lobbyId) {
      where.OR = [{ lobbyId }, { scope: "GLOBAL" }];
    }
    const defs = await prisma.challengeDefinition.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return reply.send({ ok: true, definitions: defs });
  });
}
