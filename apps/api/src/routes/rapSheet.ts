import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { swallow } from "../lib/logger";
import { awardNotoriety, getNotorietyRank, NOTORIETY_RANKS } from "../lib/notoriety";
import { CHOICES, cleanPsn, cleanRapSheet, priorsFor, starsForRank } from "../lib/rapSheet";

// weered.ca/rap/<name>: a player's rap sheet (lib/rapSheet.ts).
//
//   GET /rapsheet/me       your own, and the choices the editor offers
//   GET /rapsheet/:name    anyone's, by username or id: public, it's for sharing
//   PUT /rapsheet          save yours (and your PSN ID; Xbox goes through
//                          /profile/me/xbox-gamertag, which checks it with Xbox)

type Opts = { authFromHeader: (h?: string) => { id: string; name: string } | null };

const USER = {
  id: true,
  name: true,
  usernameKey: true,
  avatar: true,
  avatarColor: true,
  createdAt: true,
  notoriety: true,
  tier: true,
  psnAccountId: true,
  xboxGamertag: true,
  isGuest: true,
  banned: true,
  deletedAt: true,
  rapSheet: true,
} as const;

/** The crew a player leads, else the one they joined first. */
async function crewOf(userId: string) {
  const led = await prisma.crew.findFirst({
    where: { ownerId: userId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, tag: true, accentColor: true },
  });
  if (led) return { ...led, boss: true };
  const m = await prisma.crewMember.findFirst({
    where: { userId },
    orderBy: { joinedAt: "asc" },
    select: {
      role: true,
      crew: { select: { id: true, name: true, tag: true, accentColor: true } },
    },
  });
  return m?.crew ? { ...m.crew, boss: m.role === "LEADER" } : null;
}

async function sheetFor(u: any) {
  const rank = getNotorietyRank(u.notoriety || 0);
  const rankIndex = NOTORIETY_RANKS.findIndex((r) => r.title === rank.title);
  const [crew, invited] = await Promise.all([
    crewOf(u.id),
    // Everyone who came in on this player's invites. A guest link's visitors
    // aren't recruits: they never made an account.
    prisma.invite.aggregate({
      _sum: { uses: true },
      where: { createdBy: u.id, type: { not: "GUEST" } },
    }),
  ]);
  const s = u.rapSheet;
  return {
    filed: !!s,
    // Public already (weered.ca/profile/<id>); lets a page know its owner.
    id: u.id,
    name: u.name,
    username: u.usernameKey,
    avatar: u.avatar || null,
    avatarColor: u.avatarColor || null,
    // The same "ID" a player sees on their own card (components/UserCorner.tsx).
    caseNo: String(u.id).slice(-8).toUpperCase(),
    onFileSince: u.createdAt,
    tier: u.tier,
    rank: { title: rank.title, stars: starsForRank(rankIndex), notoriety: u.notoriety || 0 },
    handles: { psn: u.psnAccountId || null, xbox: u.xboxGamertag || null },
    crew,
    playstyles: s?.playstyles || [],
    hours: s?.hours || [],
    timezone: s?.timezone || "",
    mic: s?.mic || "",
    lookingFor: s?.lookingFor || "",
    // Their words for the card, so a viewer needs no list of choices.
    micLabel: CHOICES.mic.find((c) => c.id === s?.mic)?.label || "",
    lookingForLabel: CHOICES.lookingFor.find((c) => c.id === s?.lookingFor)?.label || "",
    motto: s?.motto || "",
    priors: priorsFor({
      createdAt: u.createdAt,
      notoriety: u.notoriety || 0,
      rankTitle: rank.title,
      crew: crew ? { name: crew.name, tag: crew.tag, boss: crew.boss } : null,
      recruits: invited._sum.uses || 0,
    }),
    updatedAt: s?.updatedAt || null,
  };
}

const onFile = (u: any) => !!u && !u.isGuest && !u.banned && !u.deletedAt;

export default async function rapSheetRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader } = opts;

  app.get("/rapsheet/me", async (req, reply) => {
    const me = authFromHeader((req as any).headers?.authorization);
    if (!me) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const u = await prisma.user.findUnique({ where: { id: me.id }, select: USER });
    if (!onFile(u))
      return reply
        .code(403)
        .send({ ok: false, error: "no_account", message: "Rap sheets are for Weered accounts." });
    return reply.send({ ok: true, sheet: await sheetFor(u), choices: CHOICES });
  });

  app.get("/rapsheet/:name", async (req, reply) => {
    const name = String((req.params as any)?.name || "").trim();
    if (!name || name.length > 64) return reply.code(404).send({ ok: false, error: "not_found" });
    const byId = name.length > 20 && !/\s/.test(name);
    const u = await prisma.user.findFirst({
      where: byId ? { id: name } : { usernameKey: name.toLowerCase() },
      select: USER,
    });
    if (!onFile(u)) return reply.code(404).send({ ok: false, error: "not_found" });
    reply.header("Cache-Control", "public, max-age=60");
    return reply.send({ ok: true, sheet: await sheetFor(u) });
  });

  app.put(
    "/rapsheet",
    { config: { rateLimit: { max: 30, timeWindow: "1 hour" } } },
    async (req, reply) => {
      const me = authFromHeader((req as any).headers?.authorization);
      if (!me) return reply.code(401).send({ ok: false, error: "unauthorized" });
      const u = await prisma.user.findUnique({ where: { id: me.id }, select: USER });
      if (!onFile(u))
        return reply
          .code(403)
          .send({ ok: false, error: "no_account", message: "Rap sheets are for Weered accounts." });
      const body: any = (req as any).body || {};
      const data = cleanRapSheet(body);
      let psn: string | null | undefined;
      if ("psn" in body) {
        const p = cleanPsn(body.psn);
        if (!p.ok)
          return reply.code(400).send({ ok: false, error: "invalid_psn_id", message: p.message });
        psn = p.psn;
      }
      await prisma.$transaction([
        prisma.rapSheet.upsert({
          where: { userId: me.id },
          create: { userId: me.id, ...data },
          update: data,
        }),
        ...(psn !== undefined
          ? [prisma.user.update({ where: { id: me.id }, data: { psnAccountId: psn } })]
          : []),
      ]);
      // Filing one is worth a little notoriety, once.
      if (!u!.rapSheet) awardNotoriety(me.id, "RAP_SHEET_FILED").catch(swallow);
      const fresh = await prisma.user.findUnique({ where: { id: me.id }, select: USER });
      return reply.send({ ok: true, sheet: await sheetFor(fresh) });
    },
  );
}
