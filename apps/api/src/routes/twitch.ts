import type { FastifyInstance } from "fastify";

// /twitch/streams — top live streams for a given game name. Uses Helix
// (Twitch's public API) with an app-only OAuth token. Token is cached
// in-memory until expiry. Self-contained from the rich-presence poller's
// own copy of getTwitchAppToken at index.ts top-level.
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

  app.get("/twitch/streams", async (req, reply) => {
    const token = await getTwitchAppToken();
    if (!token) return reply.send({ ok: true, streams: [], error: "twitch_not_configured" });

    const gameName = String((req as any).query?.game || "Destiny 2");

    try {
      const gameRes = await fetch(`https://api.twitch.tv/helix/games?name=${encodeURIComponent(gameName)}`, {
        headers: { "Client-ID": TWITCH_CLIENT_ID, "Authorization": `Bearer ${token}` },
      });
      const gameData = await gameRes.json();
      const gameId = gameData?.data?.[0]?.id;
      if (!gameId) return reply.send({ ok: true, streams: [] });

      const streamRes = await fetch(`https://api.twitch.tv/helix/streams?game_id=${gameId}&first=12&sort=viewers`, {
        headers: { "Client-ID": TWITCH_CLIENT_ID, "Authorization": `Bearer ${token}` },
      });
      const streamData = await streamRes.json();
      const streams = (streamData?.data || []).map((s: any) => ({
        id: s.id,
        userName: s.user_name,
        userLogin: s.user_login,
        title: s.title,
        viewerCount: s.viewer_count,
        thumbnailUrl: (s.thumbnail_url || "").replace("{width}", "320").replace("{height}", "180"),
        language: s.language,
        startedAt: s.started_at,
      }));

      return reply.send({ ok: true, streams, gameId, gameName });
    } catch (e) {
      console.error("[twitch streams]", e);
      return reply.send({ ok: true, streams: [], error: "fetch_failed" });
    }
  });
}
