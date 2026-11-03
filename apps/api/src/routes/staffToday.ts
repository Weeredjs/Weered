import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { isStaffRole } from "../lib/lobbyAuth";
import { floodSetting, siteDoor } from "../lib/flood";
import { pressureNow } from "../lib/pressure";
import { accountCount } from "../lib/registration";
import { SITE_CONFIG_DEFAULTS, getAllSiteConfig } from "../lib/siteConfig";
import { STRIPE_LIVE_STATUSES as STRIPE_LIVE } from "../lib/stripeTier";

type Opts = {
  authFromHeader: (h?: string) => { id: string; name: string } | null;
  getGlobalRole: (userId: string) => Promise<string | null>;
  canAccessStaff: (role: string | null) => boolean;
  rooms: Map<string, { users: Map<string, any> }>;
};

const DAY = 86_400_000;
/** Outreach still in play; the rest (partnered, declined, stale) need no follow-up. */
const OUTREACH_OPEN = ["LEAD", "CONTACTED", "REPLIED", "IN_PROGRESS"] as const;

/**
 * The ops landing page (2026-11-02 rebuild): what needs a person now, and how
 * the place is doing, in one call. SUPPORT sees the safety queue; STAFF and up
 * also see outreach, the pulse, site switches and recent staff actions. The
 * same counts badge the ops sidebar.
 */
export default async function staffTodayRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, getGlobalRole, canAccessStaff, rooms } = opts;

  app.get("/staff/today", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
    const staff = isStaffRole(role);
    const now = Date.now();

    const [reports, reportsOpen, appeals, appealsPending, bugs, bugsOpen] = await Promise.all([
      prisma.report.findMany({
        where: { status: "OPEN" },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, targetType: true, reason: true, note: true, createdAt: true },
      }),
      prisma.report.count({ where: { status: "OPEN" } }),
      prisma.banAppeal.findMany({
        where: { status: "PENDING" },
        orderBy: { createdAt: "asc" },
        take: 3,
        select: { id: true, createdAt: true, user: { select: { name: true } } },
      }),
      prisma.banAppeal.count({ where: { status: "PENDING" } }),
      prisma.bugReport.findMany({
        where: { status: "OPEN" },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { id: true, category: true, body: true, page: true, createdAt: true },
      }),
      prisma.bugReport.count({ where: { status: "OPEN" } }),
    ]);

    const queue = {
      reports: {
        open: reportsOpen,
        latest: reports.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
      },
      appeals: {
        pending: appealsPending,
        oldest: appeals.map((a) => ({
          id: a.id,
          name: a.user?.name || "",
          createdAt: a.createdAt.toISOString(),
        })),
      },
      bugs: {
        open: bugsOpen,
        latest: bugs.map((b) => ({
          id: b.id,
          category: b.category,
          page: b.page,
          body: b.body.slice(0, 140),
          createdAt: b.createdAt.toISOString(),
        })),
      },
    };
    if (!staff) return reply.send({ ok: true, role, queue });

    const inRooms = new Set<string>();
    for (const room of rooms.values()) for (const id of room.users.keys()) inRooms.add(id);
    const real = { isGuest: false, deletedAt: null };
    const since = new Date(now - DAY);

    const [due, dueCount, accounts, signups, chat, dms, subs, granted, audit, stored, waitlist] =
      await Promise.all([
        prisma.outreachContact.findMany({
          where: { status: { in: [...OUTREACH_OPEN] }, nextFollowUp: { lte: new Date(now) } },
          orderBy: { nextFollowUp: "asc" },
          take: 5,
          select: { id: true, name: true, company: true, nextFollowUp: true },
        }),
        prisma.outreachContact.count({
          where: { status: { in: [...OUTREACH_OPEN] }, nextFollowUp: { lte: new Date(now) } },
        }),
        accountCount(),
        prisma.user.count({ where: { ...real, createdAt: { gte: since } } }),
        prisma.roomMessage.count({ where: { ts: { gte: since } } }),
        prisma.directMessage.count({ where: { createdAt: { gte: since } } }),
        prisma.subscription.count({
          where: { stripeSubId: { not: null }, status: { in: STRIPE_LIVE } },
        }),
        prisma.user.count({ where: { ...real, tier: { not: "INNOCENT" } } }),
        prisma.globalAudit.findMany({
          orderBy: { createdAt: "desc" },
          take: 8,
          select: { id: true, actorName: true, action: true, targetName: true, createdAt: true },
        }),
        getAllSiteConfig(),
        prisma.waitlistEntry.count().catch(() => 0),
      ]);

    const cfg = { ...SITE_CONFIG_DEFAULTS, ...stored };
    return reply.send({
      ok: true,
      role,
      queue,
      outreach: {
        due: dueCount,
        // A follow-up is a calendar day: send the date only, so it can't
        // shift a day in the reader's time zone.
        list: due.map((c) => ({
          id: c.id,
          name: c.name,
          company: c.company,
          date: c.nextFollowUp ? c.nextFollowUp.toISOString().slice(0, 10) : null,
        })),
      },
      pulse: {
        inRoomsNow: inRooms.size,
        accounts,
        signups24h: signups,
        messages24h: chat + dms,
        paying: subs,
        tiered: granted,
      },
      site: {
        maintenanceMode: cfg.maintenanceMode === "true",
        registrationOpen: cfg.registrationOpen !== "false",
        registrationCap: Number(cfg.registrationCap) || 0,
        waitlist,
        aiEnabled: cfg.aiEnabled !== "false",
        // The flood switches and the latest pressure reading (lib/flood.ts,
        // lib/pressure.ts).
        floodMode: floodSetting(),
        door: siteDoor(),
        pressure: pressureNow(),
      },
      recent: audit.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
    });
  });
}
