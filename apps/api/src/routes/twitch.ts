import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";

// /twitch/streams + /live/featured + /live/rooms — Helix + active-room
// passthroughs for the home page Live Now section. App-only OAuth token
// cached in-memory.
type Opts = {
  rooms?: Map<string, any>;
};

export default async function twitchRoutes(app: FastifyInstance, opts: Opts = {}) {
  const roomsMap = opts.rooms;
  const TWITCH_CLIENT_ID     = process.env.TWITCH_CLIENT_ID || "";
  const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET || "";
  let twitchAppToken = "";
  let twitchTokenExp = 0;

  async function getTwitchAppToken(): Promise<string> {
    if (twitchAppToken && Date.now() < twitchTokenExp) return twitchAppToken;
    if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) return "";
    try {
      const res = await fetch("https://id.twitch.tv/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: TWITCH_CLIENT_ID,
          client_secret: TWITCH_CLIENT_SECRET,
          grant_type: "client_credentials",
        }),
      });
      const data = await res.json();
      twitchAppToken = data.access_token || "";
      twitchTokenExp = Date.now() + ((data.expires_in || 3600) - 60) * 1000;
      console.log("[twitch] app token acquired");
      return twitchAppToken;
    } catch (e) {
      console.error("[twitch] token error", e);
      return "";
    }
  }

  // Helix helpers — small wrappers over the two endpoints we use.
  async function helixGet(path: string): Promise<any> {
    const token = await getTwitchAppToken();
    if (!token) return null;
    try {
      const res = await fetch(`https://api.twitch.tv/helix/${path}`, {
        headers: { "Client-ID": TWITCH_CLIENT_ID, "Authorization": `Bearer ${token}` },
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.error("[twitch helix]", path, e);
      return null;
    }
  }

  function shapeStream(s: any) {
    return {
      id: s.id,
      userName: s.user_name,
      userLogin: s.user_login,
      title: s.title,
      viewerCount: s.viewer_count,
      thumbnailUrl: (s.thumbnail_url || "").replace("{width}", "640").replace("{height}", "360"),
      language: s.language,
      startedAt: s.started_at,
      gameName: s.game_name,
    };
  }

  app.get("/twitch/streams", async (req, reply) => {
    const token = await getTwitchAppToken();
    if (!token) return reply.send({ ok: true, streams: [], error: "twitch_not_configured" });

    const gameName = String((req as any).query?.game || "Destiny 2");
    const game = await helixGet(`games?name=${encodeURIComponent(gameName)}`);
    const gameId = game?.data?.[0]?.id;
    if (!gameId) return reply.send({ ok: true, streams: [] });

    const streamData = await helixGet(`streams?game_id=${gameId}&first=12&sort=viewers`);
    const streams = (streamData?.data || []).map(shapeStream);
    return reply.send({ ok: true, streams, gameId, gameName });
  });

  // ──────────────────────────────────────────────────────────────────────
  // /live/featured — single "lead" stream for the home Live Now section,
  // chosen via this cascade:
  //   1. Any Weered user with a linked Twitch login who is currently live
  //   2. Top stream of the current featured lobby's game (uses lobby.name)
  //   3. League of Legends top stream — always populated, anti-empty-state
  //
  // Cached for ~90s so a busy home page doesn't hammer Helix.
  // ──────────────────────────────────────────────────────────────────────
  type FeaturedCache = { ts: number; payload: any };
  let featuredCache: FeaturedCache | null = null;
  const FEATURED_TTL_MS = 90 * 1000;

  app.get("/live/featured", async (_req, reply) => {
    if (featuredCache && Date.now() - featuredCache.ts < FEATURED_TTL_MS) {
      return reply.send(featuredCache.payload);
    }

    const token = await getTwitchAppToken();
    if (!token) {
      const empty = { ok: true, stream: null, source: null };
      featuredCache = { ts: Date.now(), payload: empty };
      return reply.send(empty);
    }

    // Helper: find a lobby that matches a game name, so we can route the
    // Join Room button to a real lobby (everyone clicking lands in the same
    // place to watch together).
    async function resolveLobbyForGame(gameName: string): Promise<string | null> {
      const g = gameName.toLowerCase().trim();
      try {
        // Try exact name match first, then keyword match
        const exact = await (prisma as any).lobby.findFirst({
          where: { name: { equals: gameName, mode: "insensitive" } },
          select: { id: true },
        });
        if (exact?.id) return exact.id;
        const byKeyword = await (prisma as any).lobby.findFirst({
          where: { keywords: { has: g } },
          select: { id: true },
        });
        return byKeyword?.id || null;
      } catch { return null; }
    }

    // 1. Linked Weered users currently live
    try {
      const linked: any[] = await (prisma as any).user.findMany({
        where: { twitchLogin: { not: null } },
        select: { id: true, name: true, avatar: true, twitchLogin: true },
        take: 100,
      });
      const logins = linked.map(u => u.twitchLogin).filter(Boolean) as string[];
      if (logins.length > 0) {
        // Helix accepts up to 100 user_login params per call
        const params = logins.slice(0, 100).map(l => `user_login=${encodeURIComponent(l)}`).join("&");
        const data = await helixGet(`streams?${params}&first=100`);
        const streams = data?.data || [];
        if (streams.length > 0) {
          const top = streams.sort((a: any, b: any) => b.viewer_count - a.viewer_count)[0];
          const weeredUser = linked.find(u => u.twitchLogin?.toLowerCase() === top.user_login?.toLowerCase());
          // For a Weered user streaming, route to the lobby matching the
          // game they're streaming, if we have one.
          const joinLobbyId = top.game_name ? await resolveLobbyForGame(top.game_name) : null;
          const payload = {
            ok: true,
            stream: {
              ...shapeStream(top),
              source: "user",
              weeredUser: weeredUser ? { id: weeredUser.id, name: weeredUser.name, avatar: weeredUser.avatar } : null,
              joinLobbyId,
            },
          };
          featuredCache = { ts: Date.now(), payload };
          return reply.send(payload);
        }
      }
    } catch (e) {
      console.error("[live/featured] linked-users step", e);
    }

    // 2. Featured lobby's game (uses lobby.name as the Twitch game query)
    try {
      const cfg = await (prisma as any).siteConfig.findUnique({ where: { key: "featuredLobbyId" } });
      const featuredId = cfg?.value || null;
      let featuredLobbyName: string | null = null;
      if (featuredId) {
        const lob = await (prisma as any).lobby.findUnique({ where: { id: featuredId }, select: { name: true } });
        featuredLobbyName = lob?.name || null;
      }
      if (featuredLobbyName) {
        const game = await helixGet(`games?name=${encodeURIComponent(featuredLobbyName)}`);
        const gameId = game?.data?.[0]?.id;
        if (gameId) {
          const data = await helixGet(`streams?game_id=${gameId}&first=1&sort=viewers`);
          const top = data?.data?.[0];
          if (top) {
            const payload = {
              ok: true,
              stream: { ...shapeStream(top), source: "game", gameName: featuredLobbyName, joinLobbyId: featuredId },
            };
            featuredCache = { ts: Date.now(), payload };
            return reply.send(payload);
          }
        }
      }
    } catch (e) {
      console.error("[live/featured] featured-game step", e);
    }

    // 3. League of Legends fallback — always populated
    try {
      const game = await helixGet(`games?name=${encodeURIComponent("League of Legends")}`);
      const gameId = game?.data?.[0]?.id;
      if (gameId) {
        const data = await helixGet(`streams?game_id=${gameId}&first=1&sort=viewers`);
        const top = data?.data?.[0];
        if (top) {
          const lolLobbyId = await resolveLobbyForGame("League of Legends");
          const payload = {
            ok: true,
            stream: { ...shapeStream(top), source: "fallback", gameName: "League of Legends", joinLobbyId: lolLobbyId },
          };
          featuredCache = { ts: Date.now(), payload };
          return reply.send(payload);
        }
      }
    } catch (e) {
      console.error("[live/featured] LoL fallback step", e);
    }

    const empty = { ok: true, stream: null, source: null };
    featuredCache = { ts: Date.now(), payload: empty };
    return reply.send(empty);
  });

  // ──────────────────────────────────────────────────────────────────────
  // /live/rooms — active rooms with enrichment for the home Live Now
  // right-column cards. Returns rooms that currently have ≥1 user, joined
  // up to a small avatar sample, plus the parent lobby's logo / accent /
  // name and a friendly "activity" label derived from activeModule.
  // ──────────────────────────────────────────────────────────────────────
  function activityLabel(moduleKey: string | null | undefined): string {
    const k = String(moduleKey || "").toLowerCase();
    if (k === "youtube" || k === "co_watch")  return "Watching together";
    if (k === "twitch")                       return "Watching stream";
    if (k === "voice")                        return "Voice chat";
    if (k === "feed")                         return "Reading feed";
    if (k === "trade" || k === "trading")     return "Trading";
    if (k === "raid" || k === "lfg")          return "Forming party";
    return "Hanging out";
  }

  app.get("/live/rooms", async (_req, reply) => {
    if (!roomsMap) return reply.send({ ok: true, rooms: [] });

    // Pull each room with at least one online user
    type Active = { id: string; name: string; lobbyId: string | null; userIds: string[]; activeModule: string | null };
    const active: Active[] = [];
    for (const [rid, r] of roomsMap as any) {
      const userIds = Array.from((r.users?.keys?.() || [])) as string[];
      if (userIds.length === 0) continue;
      active.push({
        id: rid,
        name: r.name || rid,
        lobbyId: r.lobbyId || null,
        userIds,
        activeModule: r.activeModule || null,
      });
    }
    if (active.length === 0) return reply.send({ ok: true, rooms: [] });

    // Batch-resolve lobbies + avatars in two parallel queries
    const lobbyIds = [...new Set(active.map(r => r.lobbyId).filter(Boolean))] as string[];
    const allUserIds = [...new Set(active.flatMap(r => r.userIds))];

    const [lobbies, users] = await Promise.all([
      lobbyIds.length
        ? (prisma as any).lobby.findMany({
            where: { id: { in: lobbyIds } },
            select: { id: true, name: true, logoUrl: true, accentColor: true },
          })
        : Promise.resolve([]),
      allUserIds.length
        ? prisma.user.findMany({
            where: { id: { in: allUserIds } },
            select: { id: true, name: true, avatar: true, avatarColor: true } as any,
          })
        : Promise.resolve([]),
    ]);

    const lobbyMap = new Map(lobbies.map((l: any) => [l.id, l]));
    const userMap  = new Map((users as any[]).map((u: any) => [u.id, u]));

    // Some active "rooms" are actually lobby presence channels (the WS
    // roomId equals a Lobby.id). Surface that as roomIsLobby so the home
    // ticker can route the click to /lobby/<id> instead of /room/<id>.
    const allActiveIds = [...new Set(active.map(r => r.id))];
    const lobbyIdSet = new Set(
      allActiveIds.length
        ? (await (prisma as any).lobby.findMany({ where: { id: { in: allActiveIds } }, select: { id: true } })).map((l: any) => l.id)
        : []
    );

    const out = active
      .sort((a, b) => b.userIds.length - a.userIds.length)
      .slice(0, 12)
      .map(r => {
        const lobby = r.lobbyId ? lobbyMap.get(r.lobbyId) as any : null;
        const avatars = r.userIds.slice(0, 5).map(uid => {
          const u = userMap.get(uid) as any;
          return {
            id: uid,
            name: u?.name || "?",
            avatar: u?.avatar || null,
            avatarColor: u?.avatarColor || null,
          };
        });
        return {
          id: r.id,
          name: r.name,
          lobbyId: r.lobbyId,
          lobbyName: lobby?.name || null,
          lobbyLogoUrl: lobby?.logoUrl || null,
          lobbyAccentColor: lobby?.accentColor || null,
          roomIsLobby: lobbyIdSet.has(r.id),
          onlineCount: r.userIds.length,
          activity: activityLabel(r.activeModule),
          avatars,
        };
      });

    return reply.send({ ok: true, rooms: out });
  });
}
