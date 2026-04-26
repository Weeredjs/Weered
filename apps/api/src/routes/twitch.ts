import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";

// /twitch/streams + /live/featured — Helix passthroughs for the home page
// Live Now section. App-only OAuth token cached in-memory.
export default async function twitchRoutes(app: FastifyInstance) {
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
          const payload = {
            ok: true,
            stream: { ...shapeStream(top), source: "user", weeredUser: weeredUser ? { id: weeredUser.id, name: weeredUser.name, avatar: weeredUser.avatar } : null },
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
              stream: { ...shapeStream(top), source: "game", gameName: featuredLobbyName },
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
          const payload = {
            ok: true,
            stream: { ...shapeStream(top), source: "fallback", gameName: "League of Legends" },
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
}
