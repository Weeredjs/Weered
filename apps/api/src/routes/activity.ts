import type { FastifyInstance } from "fastify";
import { fetchWithTimeout } from "../lib/fetchWithTimeout";
import { prisma } from "../lib/prisma";

type Opts = {
  authFromHeader: (h?: string) => { id: string } | null;
};

export default async function activityRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader } = opts;

app.get("/activity-feed", async (req, reply) => {
  const u = authFromHeader(req.headers.authorization);
  if (!u) return reply.code(401).send({ ok: false });

  const since = new Date(Date.now() - 3 * 86400000);

  const [dms, notifs, notorietyEvents, friendships] = await Promise.all([
    (prisma as any).directMessage.findMany({
      where: { toId: u.id, createdAt: { gte: since } },
      select: { id: true, fromId: true, body: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    (prisma as any).notification.findMany({
      where: { userId: u.id, createdAt: { gte: since } },
      select: { id: true, type: true, title: true, body: true, actorName: true, actionUrl: true, createdAt: true, read: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    (prisma as any).notorietyEvent.findMany({
      where: { userId: u.id, createdAt: { gte: since } },
      select: { id: true, action: true, points: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    (prisma as any).friendRequest.findMany({
      where: { OR: [{ fromId: u.id }, { toId: u.id }], status: "ACCEPTED", updatedAt: { gte: since } },
      select: { id: true, fromId: true, toId: true, updatedAt: true },
      take: 5,
    }),
  ]);

  const senderIds = [...new Set(dms.map((d: any) => d.fromId))];
  const senders = senderIds.length > 0 ? await (prisma as any).user.findMany({
    where: { id: { in: senderIds } },
    select: { id: true, name: true },
  }) : [];
  const senderMap = new Map(senders.map((s: any) => [s.id, s.name]));

  const friendUserIds = [...new Set(friendships.flatMap((f: any) => [f.fromId, f.toId]).filter((id: string) => id !== u.id))];
  const friendUsers = friendUserIds.length > 0 ? await (prisma as any).user.findMany({
    where: { id: { in: friendUserIds } },
    select: { id: true, name: true },
  }) : [];
  const friendMap = new Map(friendUsers.map((f: any) => [f.id, f.name]));

  const feed: any[] = [];

  for (const dm of dms) {
    feed.push({ type: "dm", id: dm.id, text: `${senderMap.get(dm.fromId) || "Someone"} sent you a message`, preview: dm.body?.slice(0, 80), fromId: dm.fromId, fromName: senderMap.get(dm.fromId), ts: dm.createdAt });
  }
  for (const n of notifs) {
    feed.push({ type: "notification", id: n.id, subType: n.type, text: n.title, body: n.body, actionUrl: n.actionUrl, actorName: n.actorName, read: n.read, ts: n.createdAt });
  }
  for (const ne of notorietyEvents) {
    feed.push({ type: "notoriety", id: ne.id, text: `+${ne.points} XP — ${ne.action.replace(/_/g, " ").toLowerCase()}`, points: ne.points, action: ne.action, ts: ne.createdAt });
  }
  for (const f of friendships) {
    const otherId = f.fromId === u.id ? f.toId : f.fromId;
    feed.push({ type: "friend", id: f.id, text: `You and ${friendMap.get(otherId) || "someone"} became friends`, friendName: friendMap.get(otherId), ts: f.updatedAt });
  }

  feed.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

  return reply.send({ ok: true, feed: feed.slice(0, 20) });
});

const unfurlCache = new Map<string, { data: any; expiresAt: number }>();

app.get("/unfurl", async (req, reply) => {
  const url = String((req as any).query?.url || "");
  if (!url || !url.startsWith("http")) return reply.send({ ok: false });

  const cached = unfurlCache.get(url);
  if (cached && cached.expiresAt > Date.now()) return reply.send(cached.data);

  if (/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(url)) {
    try {
      const oe = await fetchWithTimeout(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; Twitterbot/1.0)" },
      });
      if (oe.ok) {
        const j: any = await oe.json();
        const result = {
          ok: true,
          title: j.title || "",
          description: j.author_name ? `by ${j.author_name}` : "",
          image: j.thumbnail_url || "",
          siteName: "YouTube",
          url,
        };
        if (result.title) {
          unfurlCache.set(url, { data: result, expiresAt: Date.now() + 30 * 60 * 1000 });
        }
        return reply.send(result);
      }
    } catch {}
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetchWithTimeout(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Twitterbot/1.0)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (!res.ok) return reply.send({ ok: false });
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return reply.send({ ok: false });

    const html = await res.text();
    const first4k = html.slice(0, 16000);

    const og = (prop: string) => {
      const m = first4k.match(new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']+)["']`, "i"))
              || first4k.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${prop}["']`, "i"));
      return m?.[1] || "";
    };
    const meta = (name: string) => {
      const m = first4k.match(new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"))
              || first4k.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, "i"));
      return m?.[1] || "";
    };

    const titleTag = first4k.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || "";

    const result = {
      ok: true,
      title: og("title") || meta("title") || titleTag || "",
      description: og("description") || meta("description") || "",
      image: og("image") || "",
      siteName: og("site_name") || "",
      url: og("url") || url,
    };

    if (result.title || result.description) {
      unfurlCache.set(url, { data: result, expiresAt: Date.now() + 30 * 60 * 1000 });
    }

    return reply.send(result);
  } catch {
    return reply.send({ ok: false });
  }
});
}
