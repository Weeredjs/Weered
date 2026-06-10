import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";

type Opts = {
  authFromHeader: (h?: string) => { id: string; name: string } | null;
  getGlobalRole: (userId: string) => Promise<string | null>;
  canAccessStaff: (role: string | null) => boolean;
  rooms: Map<string, { name?: string; lobbyId?: string | null; users: Map<string, any> }>;
};

export default async function staffOpsRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, getGlobalRole, canAccessStaff, rooms } = opts;

app.get("/staff/outreach", async (req, reply) => {
  const u = authFromHeader((req as any).headers?.authorization);
  if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
  const role = await getGlobalRole(u.id);
  if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });

  const status   = (req as any).query?.status || undefined;
  const category = (req as any).query?.category || undefined;
  const where: any = {};
  if (status) where.status = status;
  if (category) where.category = category;

  const contacts = await (prisma as any).outreachContact.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  return reply.send({ ok: true, contacts });
});

app.post("/staff/outreach", async (req, reply) => {
  const u = authFromHeader((req as any).headers?.authorization);
  if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
  const role = await getGlobalRole(u.id);
  if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });

  const b = (req as any).body || {};
  if (!b.name || !b.company) return reply.code(400).send({ ok: false, error: "name and company required" });

  const contact = await (prisma as any).outreachContact.create({
    data: {
      name: b.name,
      company: b.company,
      email: b.email || "",
      role: b.role || "",
      category: b.category || "OTHER",
      status: b.status || "LEAD",
      notes: b.notes || "",
      postUrl: b.postUrl || "",
      lastContact: b.lastContact ? new Date(b.lastContact) : null,
      nextFollowUp: b.nextFollowUp ? new Date(b.nextFollowUp) : null,
      createdById: u.id,
    },
  });
  return reply.send({ ok: true, contact });
});

app.patch("/staff/outreach/:id", async (req, reply) => {
  const u = authFromHeader((req as any).headers?.authorization);
  if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
  const role = await getGlobalRole(u.id);
  if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });

  const id = (req as any).params.id;
  const b = (req as any).body || {};
  const data: any = {};
  if (b.name !== undefined) data.name = b.name;
  if (b.company !== undefined) data.company = b.company;
  if (b.email !== undefined) data.email = b.email;
  if (b.role !== undefined) data.role = b.role;
  if (b.category !== undefined) data.category = b.category;
  if (b.status !== undefined) data.status = b.status;
  if (b.notes !== undefined) data.notes = b.notes;
  if (b.postUrl !== undefined) data.postUrl = b.postUrl;
  if (b.lastContact !== undefined) data.lastContact = b.lastContact ? new Date(b.lastContact) : null;
  if (b.nextFollowUp !== undefined) data.nextFollowUp = b.nextFollowUp ? new Date(b.nextFollowUp) : null;

  try {
    const contact = await (prisma as any).outreachContact.update({ where: { id }, data });
    return reply.send({ ok: true, contact });
  } catch { return reply.code(404).send({ ok: false, error: "not_found" }); }
});

app.delete("/staff/outreach/:id", async (req, reply) => {
  const u = authFromHeader((req as any).headers?.authorization);
  if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
  const role = await getGlobalRole(u.id);
  if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });

  try {
    await (prisma as any).outreachContact.delete({ where: { id: (req as any).params.id } });
  } catch { return reply.code(404).send({ ok: false, error: "not_found" }); }
  return reply.send({ ok: true });
});

app.get("/staff/analytics", async (req, reply) => {
  const u = authFromHeader((req as any).headers?.authorization);
  if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
  const role = await getGlobalRole(u.id);
  if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });

  const now = Date.now();
  const todayStart = new Date(now - 1 * 86400000);
  const weekStart = new Date(now - 7 * 86400000);
  const monthStart = new Date(now - 30 * 86400000);

  const onlineUserIds = new Set<string>();
  const activeRoomsList: { roomId: string; name: string; users: number }[] = [];
  for (const [roomId, room] of rooms) {
    if (room.users.size === 0) continue;
    for (const uid of room.users.keys()) onlineUserIds.add(uid);
    activeRoomsList.push({ roomId, name: room.name || roomId, users: room.users.size });
  }
  activeRoomsList.sort((a, b) => b.users - a.users);
  const topActiveRooms = activeRoomsList.slice(0, 10);
  const onlineNow = onlineUserIds.size;

  const [
    totalUsers,
    usersToday,
    usersThisWeek,
    usersThisMonth,
    dmToday,
    dmThisWeek,
    chatToday,
    chatThisWeek,
    lfgPostsThisWeek,
    notorietyEventsToday,
    notificationsToday,
    pushSubscribers,
    lobbies,
    recentSignups,
    topUsersByNotoriety,
  ] = await Promise.all([
    (prisma as any).user.count(),
    (prisma as any).user.count({ where: { createdAt: { gte: todayStart } } }),
    (prisma as any).user.count({ where: { createdAt: { gte: weekStart } } }),
    (prisma as any).user.count({ where: { createdAt: { gte: monthStart } } }),
    (prisma as any).directMessage.count({ where: { createdAt: { gte: todayStart } } }),
    (prisma as any).directMessage.count({ where: { createdAt: { gte: weekStart } } }),
    (prisma as any).roomMessage.count({ where: { ts: { gte: todayStart } } }),
    (prisma as any).roomMessage.count({ where: { ts: { gte: weekStart } } }),
    (prisma as any).lfgPost.count({ where: { createdAt: { gte: weekStart } } }),
    (prisma as any).notorietyEvent.count({ where: { createdAt: { gte: todayStart } } }),
    (prisma as any).notification.count({ where: { createdAt: { gte: todayStart } } }),
    (prisma as any).pushSubscription.count(),
    (prisma as any).lobby.findMany({
      select: { id: true, name: true, _count: { select: { members: true } } },
    }),
    (prisma as any).user.findMany({
      where: { createdAt: { gte: monthStart } },
      select: { id: true, createdAt: true },
    }),
    (prisma as any).user.findMany({
      orderBy: { notoriety: "desc" },
      take: 10,
      select: { id: true, name: true, notoriety: true },
    }),
  ]);

  const lobbyOnline = new Map<string, number>();
  for (const [, room] of rooms) {
    if (room.lobbyId && room.users.size > 0) {
      lobbyOnline.set(room.lobbyId, (lobbyOnline.get(room.lobbyId) || 0) + room.users.size);
    }
  }
  const lobbyList = (lobbies as any[]).map((l: any) => ({
    id: l.id,
    name: l.name,
    members: l._count.members,
    onlineNow: lobbyOnline.get(l.id) || 0,
  }));
  lobbyList.sort((a: any, b: any) => b.onlineNow - a.onlineNow || b.members - a.members);
  const topLobbies = lobbyList.slice(0, 20);

  const signupsLast30d = (recentSignups as any[]).length;
  let returnedAfter1d = 0;
  let returnedAfter7d = 0;

  if (signupsLast30d > 0) {
    const userIds = (recentSignups as any[]).map((u: any) => u.id);
    const userCreatedMap = new Map<string, Date>();
    for (const su of recentSignups as any[]) userCreatedMap.set(su.id, new Date(su.createdAt));

    const [dmActivity, chatActivity] = await Promise.all([
      (prisma as any).directMessage.findMany({
        where: { fromId: { in: userIds }, createdAt: { gte: monthStart } },
        select: { fromId: true, createdAt: true },
      }),
      (prisma as any).roomMessage.findMany({
        where: { userId: { in: userIds }, ts: { gte: monthStart } },
        select: { userId: true, ts: true },
      }),
    ]);

    const returned1d = new Set<string>();
    const returned7d = new Set<string>();

    for (const dm of dmActivity as any[]) {
      const created = userCreatedMap.get(dm.fromId);
      if (!created) continue;
      const msgTime = new Date(dm.createdAt).getTime();
      if (msgTime > created.getTime() + 1 * 86400000) returned1d.add(dm.fromId);
      if (msgTime > created.getTime() + 7 * 86400000) returned7d.add(dm.fromId);
    }
    for (const msg of chatActivity as any[]) {
      const created = userCreatedMap.get(msg.userId);
      if (!created) continue;
      const msgTime = new Date(msg.ts).getTime();
      if (msgTime > created.getTime() + 1 * 86400000) returned1d.add(msg.userId);
      if (msgTime > created.getTime() + 7 * 86400000) returned7d.add(msg.userId);
    }
    returnedAfter1d = returned1d.size;
    returnedAfter7d = returned7d.size;
  }

  const topUserIds = (topUsersByNotoriety as any[]).map((u: any) => u.id);
  const dmCounts = await (prisma as any).directMessage.groupBy({
    by: ["fromId"],
    where: { fromId: { in: topUserIds }, createdAt: { gte: weekStart } },
    _count: { id: true },
  });
  const dmCountMap = new Map<string, number>();
  for (const row of dmCounts as any[]) dmCountMap.set(row.fromId, row._count.id);

  const topUsers = (topUsersByNotoriety as any[]).map((u: any) => ({
    id: u.id,
    name: u.name,
    notoriety: u.notoriety,
    messagesThisWeek: dmCountMap.get(u.id) || 0,
  }));

  return reply.send({
    ok: true,
    live: { onlineNow, activeRooms: topActiveRooms },
    users: {
      total: totalUsers,
      today: usersToday,
      thisWeek: usersThisWeek,
      thisMonth: usersThisMonth,
    },
    messages: {
      dmToday,
      dmThisWeek,
      chatToday,
      chatThisWeek,
    },
    engagement: {
      lfgPostsThisWeek,
      notorietyEventsToday,
      notificationsToday,
      pushSubscribers,
    },
    lobbies: topLobbies,
    retention: {
      signupsLast30d,
      returnedAfter1d,
      returnedAfter7d,
    },
    topUsers,
  });
});
}
