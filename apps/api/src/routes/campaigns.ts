import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";

type Opts = {
  authFromHeader: (h?: string) => { id: string; name: string } | null;
  broadcastToLobby: (lobbyId: string, event: any) => void;
};

async function getCampaignByRoom(roomId: string) {
  return prisma.campaign.findFirst({ where: { roomId } });
}

export default async function campaignsRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, broadcastToLobby } = opts;

  app.get("/rooms/:roomId/campaign", async (req, reply) => {
    const u = authFromHeader((req.headers as any).authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const { roomId } = req.params as any;
    const campaign = await getCampaignByRoom(roomId);
    if (!campaign) return reply.send({ ok: true, campaign: null });
    const members = await prisma.campaignMember.findMany({
      where: { campaignId: campaign.id },
      orderBy: { joinedAt: "asc" },
    });
    return reply.send({ ok: true, campaign, members, isDM: campaign.dmUserId === u.id });
  });

  app.post("/rooms/:roomId/campaign", async (req, reply) => {
    const u = authFromHeader((req.headers as any).authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const { roomId } = req.params as any;
    const body = (req.body as any) || {};
    const name = String(body.name || "").trim().slice(0, 120);
    if (!name) return reply.code(400).send({ ok: false, error: "name_required" });
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) return reply.code(404).send({ ok: false, error: "room_not_found" });
    const existing = await getCampaignByRoom(roomId);
    if (existing) return reply.code(409).send({ ok: false, error: "campaign_exists", campaign: existing });
    const description = String(body.description || "").slice(0, 2000);
    const campaign = await prisma.campaign.create({
      data: { roomId, name, description, dmUserId: u.id },
    });
    await prisma.campaignMember.create({
      data: { campaignId: campaign.id, userId: u.id, characterName: "DM" },
    });
    return reply.send({ ok: true, campaign });
  });

  async function loadCampaignForMutate(roomId: string, userId: string): Promise<
    { error: string; code: number } | { campaign: any }
  > {
    const campaign = await getCampaignByRoom(roomId);
    if (!campaign) return { error: "no_campaign", code: 404 };
    if (campaign.dmUserId !== userId) return { error: "not_dm", code: 403 };
    return { campaign };
  }

  app.post("/rooms/:roomId/campaign/members", async (req, reply) => {
    const u = authFromHeader((req.headers as any).authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const { roomId } = req.params as any;
    const r = await loadCampaignForMutate(roomId, u.id);
    if ("error" in r) return reply.code(r.code).send({ ok: false, error: r.error });
    const body = (req.body as any) || {};
    const userId = String(body.userId || "").trim();
    const characterName = String(body.characterName || "").trim().slice(0, 80);
    if (!userId) return reply.code(400).send({ ok: false, error: "userId_required" });
    const m = await prisma.campaignMember.upsert({
      where: { campaignId_userId: { campaignId: r.campaign.id, userId } },
      create: { campaignId: r.campaign.id, userId, characterName },
      update: { characterName },
    });
    return reply.send({ ok: true, member: m });
  });

  app.delete("/rooms/:roomId/campaign/members/:memberId", async (req, reply) => {
    const u = authFromHeader((req.headers as any).authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const { roomId, memberId } = req.params as any;
    const r = await loadCampaignForMutate(roomId, u.id);
    if ("error" in r) return reply.code(r.code).send({ ok: false, error: r.error });
    await prisma.campaignMember.deleteMany({ where: { id: memberId, campaignId: r.campaign.id } });
    return reply.send({ ok: true });
  });

  app.get("/rooms/:roomId/campaign/ledger", async (req, reply) => {
    const u = authFromHeader((req.headers as any).authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const { roomId } = req.params as any;
    const campaign = await getCampaignByRoom(roomId);
    if (!campaign) return reply.code(404).send({ ok: false, error: "no_campaign" });
    const entries = await prisma.ledgerEntry.findMany({
      where: { campaignId: campaign.id },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return reply.send({ ok: true, entries, partyGold: campaign.partyGold });
  });

  app.post("/rooms/:roomId/campaign/ledger", async (req, reply) => {
    const u = authFromHeader((req.headers as any).authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const { roomId } = req.params as any;
    const r = await loadCampaignForMutate(roomId, u.id);
    if ("error" in r) return reply.code(r.code).send({ ok: false, error: r.error });
    const body = (req.body as any) || {};
    const type = String(body.type || "").toUpperCase();
    if (!["GOLD", "ITEM", "XP"].includes(type)) return reply.code(400).send({ ok: false, error: "bad_type" });
    const delta = Math.trunc(Number(body.delta) || 0);
    const description = String(body.description || "").slice(0, 500);
    const awardedToUserId = body.awardedToUserId ? String(body.awardedToUserId) : null;

    const entry = await prisma.ledgerEntry.create({
      data: { campaignId: r.campaign.id, type: type as any, delta, description, awardedToUserId },
    });

    let updatedCampaign = r.campaign;
    if (type === "GOLD") {
      updatedCampaign = await prisma.campaign.update({
        where: { id: r.campaign.id },
        data: { partyGold: r.campaign.partyGold + delta },
      });
    }

    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (room?.lobbyId) {
      broadcastToLobby(room.lobbyId, { type: "campaign:ledger", roomId, entry, partyGold: updatedCampaign.partyGold });
    }
    return reply.send({ ok: true, entry, partyGold: updatedCampaign.partyGold });
  });

  app.delete("/rooms/:roomId/campaign/ledger/:entryId", async (req, reply) => {
    const u = authFromHeader((req.headers as any).authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const { roomId, entryId } = req.params as any;
    const r = await loadCampaignForMutate(roomId, u.id);
    if ("error" in r) return reply.code(r.code).send({ ok: false, error: r.error });
    const entry = await prisma.ledgerEntry.findFirst({ where: { id: entryId, campaignId: r.campaign.id } });
    if (!entry) return reply.code(404).send({ ok: false, error: "not_found" });
    await prisma.ledgerEntry.delete({ where: { id: entry.id } });
    let partyGold = r.campaign.partyGold;
    if (entry.type === "GOLD") {
      const updated = await prisma.campaign.update({
        where: { id: r.campaign.id },
        data: { partyGold: partyGold - entry.delta },
      });
      partyGold = updated.partyGold;
    }
    return reply.send({ ok: true, partyGold });
  });

  app.get("/rooms/:roomId/campaign/xp", async (req, reply) => {
    const u = authFromHeader((req.headers as any).authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const { roomId } = req.params as any;
    const campaign = await getCampaignByRoom(roomId);
    if (!campaign) return reply.code(404).send({ ok: false, error: "no_campaign" });
    const grouped = await prisma.ledgerEntry.groupBy({
      by: ["awardedToUserId"],
      where: { campaignId: campaign.id, type: "XP" },
      _sum: { delta: true },
    });
    const totals = grouped.map(g => ({ userId: g.awardedToUserId, xp: g._sum.delta || 0 }));
    return reply.send({ ok: true, totals });
  });

  app.get("/rooms/:roomId/campaign/sessions", async (req, reply) => {
    const u = authFromHeader((req.headers as any).authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const { roomId } = req.params as any;
    const campaign = await getCampaignByRoom(roomId);
    if (!campaign) return reply.code(404).send({ ok: false, error: "no_campaign" });
    const sessions = await prisma.sessionLog.findMany({
      where: { campaignId: campaign.id },
      orderBy: { sessionNumber: "desc" },
      take: 100,
    });
    return reply.send({ ok: true, sessions });
  });

  app.post("/rooms/:roomId/campaign/sessions", async (req, reply) => {
    const u = authFromHeader((req.headers as any).authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const { roomId } = req.params as any;
    const r = await loadCampaignForMutate(roomId, u.id);
    if ("error" in r) return reply.code(r.code).send({ ok: false, error: r.error });
    const body = (req.body as any) || {};
    const last = await prisma.sessionLog.findFirst({
      where: { campaignId: r.campaign.id },
      orderBy: { sessionNumber: "desc" },
    });
    const sessionNumber = Math.max(1, (last?.sessionNumber || 0) + 1);
    const bodyText = String(body.body || "").slice(0, 20000);
    const session = await prisma.sessionLog.create({
      data: { campaignId: r.campaign.id, sessionNumber, dmUserId: u.id, body: bodyText },
    });
    return reply.send({ ok: true, session });
  });

  app.patch("/rooms/:roomId/campaign/sessions/:sessionId", async (req, reply) => {
    const u = authFromHeader((req.headers as any).authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const { roomId, sessionId } = req.params as any;
    const r = await loadCampaignForMutate(roomId, u.id);
    if ("error" in r) return reply.code(r.code).send({ ok: false, error: r.error });
    const body = (req.body as any) || {};
    const session = await prisma.sessionLog.findFirst({ where: { id: sessionId, campaignId: r.campaign.id } });
    if (!session) return reply.code(404).send({ ok: false, error: "not_found" });
    const updated = await prisma.sessionLog.update({
      where: { id: session.id },
      data: { body: String(body.body ?? session.body).slice(0, 20000) },
    });
    return reply.send({ ok: true, session: updated });
  });

  app.delete("/rooms/:roomId/campaign/sessions/:sessionId", async (req, reply) => {
    const u = authFromHeader((req.headers as any).authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const { roomId, sessionId } = req.params as any;
    const r = await loadCampaignForMutate(roomId, u.id);
    if ("error" in r) return reply.code(r.code).send({ ok: false, error: r.error });
    await prisma.sessionLog.deleteMany({ where: { id: sessionId, campaignId: r.campaign.id } });
    return reply.send({ ok: true });
  });

  app.get("/rooms/:roomId/campaign/npcs", async (req, reply) => {
    const u = authFromHeader((req.headers as any).authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const { roomId } = req.params as any;
    const campaign = await getCampaignByRoom(roomId);
    if (!campaign) return reply.code(404).send({ ok: false, error: "no_campaign" });
    const npcs = await prisma.npcEncounter.findMany({
      where: { campaignId: campaign.id },
      orderBy: { updatedAt: "desc" },
    });
    return reply.send({ ok: true, npcs });
  });

  app.post("/rooms/:roomId/campaign/npcs", async (req, reply) => {
    const u = authFromHeader((req.headers as any).authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const { roomId } = req.params as any;
    const r = await loadCampaignForMutate(roomId, u.id);
    if ("error" in r) return reply.code(r.code).send({ ok: false, error: r.error });
    const body = (req.body as any) || {};
    const name = String(body.name || "").trim().slice(0, 120);
    if (!name) return reply.code(400).send({ ok: false, error: "name_required" });
    const status = String(body.status || "UNKNOWN").toUpperCase();
    if (!["ALIVE", "DEAD", "HOSTILE", "ALLIED", "UNKNOWN"].includes(status)) {
      return reply.code(400).send({ ok: false, error: "bad_status" });
    }
    const npc = await prisma.npcEncounter.create({
      data: {
        campaignId: r.campaign.id,
        name,
        status: status as any,
        notes: String(body.notes || "").slice(0, 4000),
        firstMetSessionId: body.firstMetSessionId ? String(body.firstMetSessionId) : null,
      },
    });
    return reply.send({ ok: true, npc });
  });

  app.patch("/rooms/:roomId/campaign/npcs/:npcId", async (req, reply) => {
    const u = authFromHeader((req.headers as any).authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const { roomId, npcId } = req.params as any;
    const r = await loadCampaignForMutate(roomId, u.id);
    if ("error" in r) return reply.code(r.code).send({ ok: false, error: r.error });
    const npc = await prisma.npcEncounter.findFirst({ where: { id: npcId, campaignId: r.campaign.id } });
    if (!npc) return reply.code(404).send({ ok: false, error: "not_found" });
    const body = (req.body as any) || {};
    const data: any = {};
    if (typeof body.name === "string") data.name = body.name.trim().slice(0, 120);
    if (typeof body.notes === "string") data.notes = body.notes.slice(0, 4000);
    if (typeof body.status === "string") {
      const status = body.status.toUpperCase();
      if (!["ALIVE", "DEAD", "HOSTILE", "ALLIED", "UNKNOWN"].includes(status)) {
        return reply.code(400).send({ ok: false, error: "bad_status" });
      }
      data.status = status;
    }
    if (body.firstMetSessionId !== undefined) {
      data.firstMetSessionId = body.firstMetSessionId ? String(body.firstMetSessionId) : null;
    }
    const updated = await prisma.npcEncounter.update({ where: { id: npc.id }, data });
    return reply.send({ ok: true, npc: updated });
  });

  app.delete("/rooms/:roomId/campaign/npcs/:npcId", async (req, reply) => {
    const u = authFromHeader((req.headers as any).authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const { roomId, npcId } = req.params as any;
    const r = await loadCampaignForMutate(roomId, u.id);
    if ("error" in r) return reply.code(r.code).send({ ok: false, error: r.error });
    await prisma.npcEncounter.deleteMany({ where: { id: npcId, campaignId: r.campaign.id } });
    return reply.send({ ok: true });
  });

  app.get("/rooms/:roomId/campaign/threads", async (req, reply) => {
    const u = authFromHeader((req.headers as any).authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const { roomId } = req.params as any;
    const campaign = await getCampaignByRoom(roomId);
    if (!campaign) return reply.code(404).send({ ok: false, error: "no_campaign" });
    const threads = await prisma.plotThread.findMany({
      where: { campaignId: campaign.id },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });
    return reply.send({ ok: true, threads });
  });

  app.post("/rooms/:roomId/campaign/threads", async (req, reply) => {
    const u = authFromHeader((req.headers as any).authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const { roomId } = req.params as any;
    const r = await loadCampaignForMutate(roomId, u.id);
    if ("error" in r) return reply.code(r.code).send({ ok: false, error: r.error });
    const body = (req.body as any) || {};
    const title = String(body.title || "").trim().slice(0, 200);
    if (!title) return reply.code(400).send({ ok: false, error: "title_required" });
    const thread = await prisma.plotThread.create({
      data: {
        campaignId: r.campaign.id,
        title,
        body: String(body.body || "").slice(0, 8000),
        status: "OPEN",
      },
    });
    return reply.send({ ok: true, thread });
  });

  app.patch("/rooms/:roomId/campaign/threads/:threadId", async (req, reply) => {
    const u = authFromHeader((req.headers as any).authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const { roomId, threadId } = req.params as any;
    const r = await loadCampaignForMutate(roomId, u.id);
    if ("error" in r) return reply.code(r.code).send({ ok: false, error: r.error });
    const thread = await prisma.plotThread.findFirst({ where: { id: threadId, campaignId: r.campaign.id } });
    if (!thread) return reply.code(404).send({ ok: false, error: "not_found" });
    const body = (req.body as any) || {};
    const data: any = {};
    if (typeof body.title === "string") data.title = body.title.trim().slice(0, 200);
    if (typeof body.body === "string") data.body = body.body.slice(0, 8000);
    if (typeof body.status === "string") {
      const status = body.status.toUpperCase();
      if (!["OPEN", "CLOSED", "DORMANT"].includes(status)) {
        return reply.code(400).send({ ok: false, error: "bad_status" });
      }
      data.status = status;
      data.closedAt = status === "CLOSED" ? new Date() : null;
    }
    const updated = await prisma.plotThread.update({ where: { id: thread.id }, data });
    return reply.send({ ok: true, thread: updated });
  });

  app.delete("/rooms/:roomId/campaign/threads/:threadId", async (req, reply) => {
    const u = authFromHeader((req.headers as any).authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const { roomId, threadId } = req.params as any;
    const r = await loadCampaignForMutate(roomId, u.id);
    if ("error" in r) return reply.code(r.code).send({ ok: false, error: r.error });
    await prisma.plotThread.deleteMany({ where: { id: threadId, campaignId: r.campaign.id } });
    return reply.send({ ok: true });
  });

  app.get("/rooms/:roomId/campaign/party", async (req, reply) => {
    const u = authFromHeader((req.headers as any).authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const { roomId } = req.params as any;
    const campaign = await getCampaignByRoom(roomId);
    if (!campaign) return reply.code(404).send({ ok: false, error: "no_campaign" });
    const characters = await prisma.character.findMany({
      where: { campaignId: campaign.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true, name: true, className: true, level: true, race: true,
        hpCurrent: true, hpMax: true, hpTemp: true, ac: true,
        ownerUserId: true,
      },
    });
    const xpRows = await prisma.ledgerEntry.groupBy({
      by: ["awardedToUserId"],
      where: { campaignId: campaign.id, type: "XP" },
      _sum: { delta: true },
    });
    const xpByUser: Record<string, number> = {};
    for (const r of xpRows) if (r.awardedToUserId) xpByUser[r.awardedToUserId] = r._sum.delta || 0;
    const party = characters.map(c => ({ ...c, xp: xpByUser[c.ownerUserId] || 0 }));
    return reply.send({ ok: true, party });
  });

  app.post("/rooms/:roomId/campaign/ledger/distribute", async (req, reply) => {
    const u = authFromHeader((req.headers as any).authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const { roomId } = req.params as any;
    const r = await loadCampaignForMutate(roomId, u.id);
    if ("error" in r) return reply.code(r.code).send({ ok: false, error: r.error });
    const body = (req.body as any) || {};
    const delta = Math.trunc(Number(body.delta) || 0);
    if (!delta) return reply.code(400).send({ ok: false, error: "bad_delta" });
    const description = String(body.description || "XP").slice(0, 500);
    const onlyIds: string[] = Array.isArray(body.characterIds) ? body.characterIds.map((x: any) => String(x)) : [];
    const where: any = { campaignId: r.campaign.id };
    if (onlyIds.length) where.id = { in: onlyIds };
    const characters = await prisma.character.findMany({ where, select: { ownerUserId: true } });
    if (!characters.length) return reply.code(400).send({ ok: false, error: "no_party" });
    const entries = await prisma.$transaction(
      characters.map(c =>
        prisma.ledgerEntry.create({
          data: {
            campaignId: r.campaign.id,
            type: "XP",
            delta,
            description,
            awardedToUserId: c.ownerUserId,
          },
        })
      )
    );
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (room?.lobbyId) {
      for (const entry of entries) {
        broadcastToLobby(room.lobbyId, { type: "campaign:ledger", roomId, entry, partyGold: r.campaign.partyGold });
      }
    }
    return reply.send({ ok: true, awarded: entries.length, entries });
  });

  app.get("/rooms/:roomId/campaign/notes", async (req, reply) => {
    const u = authFromHeader((req.headers as any).authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const { roomId } = req.params as any;
    const campaign = await getCampaignByRoom(roomId);
    if (!campaign) return reply.code(404).send({ ok: false, error: "no_campaign" });
    const notes = await prisma.worldNote.findMany({
      where: { campaignId: campaign.id },
      orderBy: [{ parentId: "asc" }, { title: "asc" }],
    });
    return reply.send({ ok: true, notes });
  });

  app.post("/rooms/:roomId/campaign/notes", async (req, reply) => {
    const u = authFromHeader((req.headers as any).authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const { roomId } = req.params as any;
    const r = await loadCampaignForMutate(roomId, u.id);
    if ("error" in r) return reply.code(r.code).send({ ok: false, error: r.error });
    const body = (req.body as any) || {};
    const title = String(body.title || "").trim().slice(0, 160);
    if (!title) return reply.code(400).send({ ok: false, error: "title_required" });
    const parentId = body.parentId ? String(body.parentId) : null;
    if (parentId) {
      const parent = await prisma.worldNote.findFirst({ where: { id: parentId, campaignId: r.campaign.id } });
      if (!parent) return reply.code(400).send({ ok: false, error: "bad_parent" });
    }
    const note = await prisma.worldNote.create({
      data: {
        campaignId: r.campaign.id,
        parentId,
        title,
        body: String(body.body || "").slice(0, 16000),
      },
    });
    return reply.send({ ok: true, note });
  });

  app.patch("/rooms/:roomId/campaign/notes/:noteId", async (req, reply) => {
    const u = authFromHeader((req.headers as any).authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const { roomId, noteId } = req.params as any;
    const r = await loadCampaignForMutate(roomId, u.id);
    if ("error" in r) return reply.code(r.code).send({ ok: false, error: r.error });
    const note = await prisma.worldNote.findFirst({ where: { id: noteId, campaignId: r.campaign.id } });
    if (!note) return reply.code(404).send({ ok: false, error: "not_found" });
    const body = (req.body as any) || {};
    const data: any = {};
    if (typeof body.title === "string") data.title = body.title.trim().slice(0, 160);
    if (typeof body.body === "string") data.body = body.body.slice(0, 16000);
    if (body.parentId !== undefined) {
      const parentId = body.parentId ? String(body.parentId) : null;
      if (parentId === note.id) return reply.code(400).send({ ok: false, error: "self_parent" });
      if (parentId) {
        const parent = await prisma.worldNote.findFirst({ where: { id: parentId, campaignId: r.campaign.id } });
        if (!parent) return reply.code(400).send({ ok: false, error: "bad_parent" });
      }
      data.parentId = parentId;
    }
    const updated = await prisma.worldNote.update({ where: { id: note.id }, data });
    return reply.send({ ok: true, note: updated });
  });

  app.delete("/rooms/:roomId/campaign/notes/:noteId", async (req, reply) => {
    const u = authFromHeader((req.headers as any).authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const { roomId, noteId } = req.params as any;
    const r = await loadCampaignForMutate(roomId, u.id);
    if ("error" in r) return reply.code(r.code).send({ ok: false, error: r.error });
    await prisma.worldNote.deleteMany({ where: { id: noteId, campaignId: r.campaign.id } });
    return reply.send({ ok: true });
  });
}
