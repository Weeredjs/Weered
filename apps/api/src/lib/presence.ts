import { prisma } from "./prisma";
import nodeHttps from "https";
import { broadcast, rooms } from "./roomState";
import { log, swallow } from "./logger";

// Third-party presence pollers (Steam/Twitch/Xbox) extracted from index.ts.
// wss injected from main(); startPresencePolling() scheduled there too.
let _wss: any = null;
export function setPresenceWss(w: any) {
  _wss = w;
}

export const PRESENCE_POLL_MS = 60_000;
export const STEAM_API_KEY = process.env.STEAM_API_KEY || "";
export const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || "";
export const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET || "";
export const OPENXBL_API_KEY = process.env.OPENXBL_API_KEY || "";
export const XBL_POLL_CAP_PER_CYCLE = 20;
export let _xblRateLimitedUntil = 0;
export const STEAM_PERSONASTATES: Record<number, string> = {
  0: "Offline",
  1: "Online",
  2: "Busy",
  3: "Away",
  4: "Snooze",
  5: "Looking to trade",
  6: "Looking to play",
};

export let twitchAppToken: { token: string; expiresAt: number } | null = null;
export async function getTwitchAppToken(): Promise<string | null> {
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) return null;
  if (twitchAppToken && twitchAppToken.expiresAt > Date.now() + 60_000) return twitchAppToken.token;
  try {
    const url = `https://id.twitch.tv/oauth2/token?client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&grant_type=client_credentials`;
    const res = await fetch(url, { method: "POST" });
    if (!res.ok) return null;
    const j: any = await res.json();
    if (!j?.access_token) return null;
    twitchAppToken = {
      token: j.access_token,
      expiresAt: Date.now() + (j.expires_in ?? 3600) * 1000,
    };
    return twitchAppToken.token;
  } catch {
    return null;
  }
}

export async function pollTwitchPresenceBatch(logins: string[]): Promise<Record<string, any>> {
  if (!TWITCH_CLIENT_ID || logins.length === 0) return {};
  const token = await getTwitchAppToken();
  if (!token) return {};
  try {
    const qs = logins.map((l) => `user_login=${encodeURIComponent(l)}`).join("&");
    const res = await fetch(`https://api.twitch.tv/helix/streams?${qs}&first=100`, {
      headers: { "Client-ID": TWITCH_CLIENT_ID, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return {};
    const j: any = await res.json();
    const streams: any[] = j?.data || [];
    const live = new Set<string>();
    const out: Record<string, any> = {};
    for (const s of streams) {
      const login = String(s.user_login || "").toLowerCase();
      if (!login) continue;
      live.add(login);
      out[login] = {
        source: "TWITCH",
        activity: s.game_name ? `Streaming ${s.game_name}` : "Streaming on Twitch",
        detail: s.title || undefined,
        url: `https://twitch.tv/${login}`,
        viewers: typeof s.viewer_count === "number" ? s.viewer_count : undefined,
        updatedAt: new Date().toISOString(),
      };
    }
    for (const login of logins) if (!live.has(login.toLowerCase())) out[login.toLowerCase()] = null;
    return out;
  } catch {
    return {};
  }
}

export async function pollSteamPresenceBatch(steamIds: string[]): Promise<Record<string, any>> {
  if (!STEAM_API_KEY || steamIds.length === 0) return {};
  try {
    const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${STEAM_API_KEY}&steamids=${steamIds.join(",")}`;
    const res = await fetch(url);
    if (!res.ok) return {};
    const j: any = await res.json();
    const players: any[] = j?.response?.players || [];
    const out: Record<string, any> = {};
    for (const p of players) {
      const sid = String(p.steamid || "");
      if (!sid) continue;
      if (p.gameextrainfo) {
        out[sid] = {
          source: "STEAM",
          activity: `Playing ${p.gameextrainfo}`,
          detail: p.gameserverip || undefined,
          url: p.profileurl || undefined,
          appId: p.gameid ? String(p.gameid) : undefined,
          gameName: String(p.gameextrainfo),
          updatedAt: new Date().toISOString(),
        };
      } else if (p.personastate && p.personastate !== 0) {
        out[sid] = {
          source: "STEAM",
          activity: STEAM_PERSONASTATES[p.personastate] || "Online",
          url: p.profileurl || undefined,
          updatedAt: new Date().toISOString(),
        };
      } else {
        out[sid] = null;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export const XBL_BASE = "https://xbl.io/api/v2";

export function xblGet(pathname: string): Promise<{ status: number; json: any | null }> {
  return new Promise((resolve) => {
    if (!OPENXBL_API_KEY) return resolve({ status: 0, json: null });
    if (Date.now() < _xblRateLimitedUntil) return resolve({ status: 429, json: null });
    let settled = false;
    const settle = (v: { status: number; json: any | null }) => {
      if (!settled) {
        settled = true;
        resolve(v);
      }
    };
    const req = nodeHttps.get(
      {
        host: "xbl.io",
        path: pathname,
        headers: { "X-Authorization": OPENXBL_API_KEY, Accept: "application/json" },
      },
      (res: any) => {
        let body = "";
        res.on("data", (c: any) => {
          body += c;
        });
        res.on("end", () => {
          if (res.statusCode === 429) {
            _xblRateLimitedUntil = Date.now() + 5 * 60 * 1000;
            log.warn("[xbl] hit 429; cooling down 5 min");
            return settle({ status: 429, json: null });
          }
          try {
            settle({ status: res.statusCode || 0, json: JSON.parse(body) });
          } catch {
            settle({ status: res.statusCode || 0, json: null });
          }
        });
      },
    );
    req.on("error", () => settle({ status: 0, json: null }));
    req.setTimeout(10000, () => {
      req.destroy();
      settle({ status: 0, json: null });
    });
  });
}

export async function resolveXboxGamertag(
  gamertag: string,
): Promise<{ xuid: string; gamertag: string } | null> {
  if (!OPENXBL_API_KEY) return null;
  try {
    const { status, json } = await xblGet(`/api/v2/search/${encodeURIComponent(gamertag)}`);
    if (status !== 200 || !json) return null;
    const j: any = json;
    const content = j?.content ?? j;
    const p = content?.people?.[0] || content?.profileUsers?.[0] || null;
    if (!p) return null;
    const xuid = String(p.xuid || p.id || "");
    const gt = String(p.uniqueModernGamertag || p.gamertag || p.modernGamertag || gamertag);
    if (!xuid) return null;
    return { xuid, gamertag: gt };
  } catch {
    return null;
  }
}

export async function pollXboxPresenceOne(xuid: string): Promise<any | null> {
  if (!OPENXBL_API_KEY || !xuid) return null;
  try {
    const { status, json } = await xblGet(`/api/v2/${encodeURIComponent(xuid)}/presence`);
    if (status !== 200 || !json) return null;
    const j: any = json;
    const body = j?.content ?? j;
    const state = String(body?.state || "").toLowerCase();
    const devices: any[] = Array.isArray(body?.devices) ? body.devices : [];
    const titles = devices.flatMap((d) => (Array.isArray(d?.titles) ? d.titles : []));
    const game = titles.find((t) => {
      const name = String(t?.name || "").trim();
      const placement = String(t?.placement || "").toLowerCase();
      const tState = String(t?.state || "").toLowerCase();
      return name && name.toLowerCase() !== "home" && placement === "full" && tState === "active";
    });
    if (game) {
      return {
        source: "XBOX",
        activity: `Playing ${game.name}`,
        detail: game?.activity?.richPresence || undefined,
        updatedAt: new Date().toISOString(),
      };
    }
    if (state === "online") {
      return { source: "XBOX", activity: "Online on Xbox", updatedAt: new Date().toISOString() };
    }
    return null;
  } catch {
    return null;
  }
}

export async function runPresencePoll() {
  if (!STEAM_API_KEY && !TWITCH_CLIENT_ID && !OPENXBL_API_KEY) return;
  try {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { steamId: { not: null } },
          { twitchLogin: { not: null } },
          { xboxXuid: { not: null } },
        ],
      },
      select: { id: true, steamId: true, twitchLogin: true, xboxXuid: true },
      take: 500,
    });
    if (users.length === 0) return;

    const steamData: Record<string, any> = {};
    if (STEAM_API_KEY) {
      const steamUsers = users.filter((u) => u.steamId);
      for (let i = 0; i < steamUsers.length; i += 100) {
        const chunk = steamUsers.slice(i, i + 100);
        const batch = await pollSteamPresenceBatch(chunk.map((u) => u.steamId as string));
        Object.assign(steamData, batch);
      }
    }

    const twitchData: Record<string, any> = {};
    if (TWITCH_CLIENT_ID) {
      const twitchUsers = users.filter((u) => u.twitchLogin);
      for (let i = 0; i < twitchUsers.length; i += 100) {
        const chunk = twitchUsers.slice(i, i + 100);
        const batch = await pollTwitchPresenceBatch(
          chunk.map((u) => (u.twitchLogin as string).toLowerCase()),
        );
        Object.assign(twitchData, batch);
      }
    }

    const xboxData: Record<string, any> = {};
    if (OPENXBL_API_KEY) {
      const xboxUsers = users.filter((u) => u.xboxXuid).slice(0, XBL_POLL_CAP_PER_CYCLE);
      for (const u of xboxUsers) {
        const pres = await pollXboxPresenceOne(u.xboxXuid as string);
        xboxData[u.xboxXuid as string] = pres;
      }
    }

    for (const u of users) {
      const tw = u.twitchLogin ? twitchData[u.twitchLogin.toLowerCase()] : undefined;
      const xb = u.xboxXuid ? xboxData[u.xboxXuid] : undefined;
      const st = u.steamId ? steamData[u.steamId] : undefined;
      const primary =
        tw && tw.source === "TWITCH" ? tw : xb && xb.source === "XBOX" ? xb : (st ?? null);
      if (primary === undefined) continue;
      await prisma.user
        .update({
          where: { id: u.id },
          data: { livePresence: primary, presenceCheckedAt: new Date() },
        })
        .catch(swallow);

      try {
        for (const [, room] of rooms) {
          const entry = room.users.get(u.id);
          if (!entry) continue;
          (entry as any).livePresence = primary ?? null;
          broadcast(room, { type: "presence:join", roomId: room.roomId, user: entry });
        }
        for (const s of _wss?.clients ?? []) {
          if (s?.user?.id === u.id) s.user.livePresence = primary ?? null;
        }
      } catch (e) {
        swallow(e);
      }
    }
  } catch (e) {
    log.error("[presence poll]", e);
  }
}

export function startPresencePolling() {
  if (STEAM_API_KEY || TWITCH_CLIENT_ID || OPENXBL_API_KEY) {
    setInterval(() => {
      void runPresencePoll();
    }, PRESENCE_POLL_MS);
    setTimeout(() => {
      void runPresencePoll();
    }, 15_000);
  }
}
