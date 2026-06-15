import type { FastifyInstance } from "fastify";
import { fetchWithTimeout } from "../lib/fetchWithTimeout";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";

// Profile routes (extracted from index.ts): public profile view, profile edit,
// platform-account linking (steam/twitch/xbox/psn), presence read + refresh,
// and self-delete. WS-coupled: PATCH /profile/me and POST /profile/me/delete
// fan over live sockets, so wss (via getWss(), assigned late in index.ts),
// rooms, and publishState are injected BY REFERENCE. The presence-poll helpers
// are shared with the runPresencePoll worker, so they are injected (not moved).
type Opts = {
  authFromHeader: (h?: string) => any;
  getNotorietyRank: (n: number) => { title: string; min: number; next: { title: string; min: number } | null };
  awardNotoriety: (userId: string, action: string) => Promise<number | null>;
  globalAudit: (actorId: string, actorName: string, action: string, targetId?: string, targetName?: string, meta?: any) => Promise<void>;
  publishState: (room: any) => void;
  rooms: Map<string, any>;
  getWss: () => any;
  resolveXboxGamertag: (gamertag: string) => Promise<{ xuid: string; gamertag: string } | null>;
  pollSteamPresenceBatch: (steamIds: string[]) => Promise<Record<string, any>>;
  pollTwitchPresenceBatch: (logins: string[]) => Promise<Record<string, any>>;
  pollXboxPresenceOne: (xuid: string) => Promise<any | null>;
  STEAM_API_KEY: string;
  TWITCH_CLIENT_ID: string;
  OPENXBL_API_KEY: string;
};

export default async function profileRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, getNotorietyRank, awardNotoriety, globalAudit, publishState, rooms, getWss, resolveXboxGamertag, pollSteamPresenceBatch, pollTwitchPresenceBatch, pollXboxPresenceOne, STEAM_API_KEY, TWITCH_CLIENT_ID, OPENXBL_API_KEY } = opts;

  app.get("/profile/:userId", async (req, reply) => {
    const { userId } = req.params as any;
    if (!userId) return reply.code(400).send({ error: "Missing userId" });

    const authHeader = (req.headers as any).authorization;
    const viewer = authFromHeader(authHeader);

    try {
      const isId = userId.length > 20 && !userId.includes(" ");
      const u = await prisma.user.findFirst({
        where: isId
          ? { id: userId }
          : { OR: [{ usernameKey: userId.toLowerCase() }, { name: userId }] },
        select: {
          id: true,
          name: true,
          bio: true,
          statusText: true,
          statusEmoji: true,
          avatarFrame: true,
          nameEffect: true,
          notoriety: true,
          joinPolicy: true,
          invitePolicy: true,
          tier: true,
          globalRole: true,
          createdAt: true,
          updatedAt: true,
          avatar: true,
          avatarColor: true,
          bannerUrl: true,
          steamId: true,
          twitchLogin: true,
          xboxGamertag: true,
        },
      });

      if (!u) return reply.code(404).send({ error: "User not found" });

      const roomsHosted = await prisma.room.count({ where: { ownerId: u.id } });

      const gameAccounts = await prisma.userGameAccount.findMany({
        where: { userId: u.id },
        select: { gameType: true, displayName: true, platform: true, createdAt: true },
      });

      const primaryMembership = await prisma.crewMember.findFirst({
        where: { userId: u.id },
        orderBy: { joinedAt: "asc" },
        include: { crew: { select: { id: true, name: true, tag: true, logoUrl: true, accentColor: true, tagShape: true } } },
      });

      const nRank = getNotorietyRank(u.notoriety ?? 0);
      return reply.send({
        id: u.id,
        name: u.name,
        bio: u.bio || "",
        statusText: (u as any).statusText || null,
        statusEmoji: (u as any).statusEmoji || null,
        avatarFrame: (u as any).avatarFrame || null,
        nameEffect: (u as any).nameEffect || null,
        notoriety: u.notoriety ?? 0,
        joinPolicy: (u as any).joinPolicy || "FRIENDS",
        invitePolicy: (u as any).invitePolicy || "FRIENDS",
        ...(await (async () => {
          if (!viewer || viewer.id === u.id) return { friendStatus: viewer && viewer.id === u.id ? "self" : "none" };
          let friendStatus = "none"; let requestId: string | null = null;
          try {
            const fr: any = await prisma.friendRequest.findFirst({
              where: { OR: [{ fromId: viewer.id, toId: u.id }, { fromId: u.id, toId: viewer.id }], status: { in: ["PENDING", "ACCEPTED"] } },
              orderBy: { createdAt: "desc" },
            });
            if (fr) {
              if (fr.status === "ACCEPTED") friendStatus = "friends";
              else if (fr.fromId === viewer.id) friendStatus = "outgoing";
              else { friendStatus = "incoming"; requestId = fr.id; }
            }
          } catch {}
          let joinable = false; let currentRoomId: string | null = null; let currentRoomIsLobby = false;
          const policy = (u as any).joinPolicy || "FRIENDS";
          if (policy !== "OFF" && (policy === "EVERYONE" || friendStatus === "friends")) {
            for (const [rid, rs] of rooms) {
              if (rs.users.has(u.id)) { currentRoomId = rid; break; }
            }
            if (currentRoomId) {
              joinable = true;
              try { currentRoomIsLobby = !!(await prisma.lobby.findUnique({ where: { id: currentRoomId }, select: { id: true } })); } catch {}
            }
          }
          return { friendStatus, friendRequestId: requestId, joinable, currentRoomId: joinable ? currentRoomId : null, currentRoomIsLobby };
        })()),
        notorietyRank: nRank.title,
        notorietyNext: nRank.next ? { title: nRank.next.title, min: nRank.next.min } : null,
        tier: u.tier ?? "INNOCENT",
        globalRole: String(u.globalRole ?? "USER"),
        joinedAt: u.createdAt.toISOString(),
        lastSeen: u.updatedAt.toISOString(),
        roomsHosted,
        avatar: u.avatar || null,
        avatarColor: u.avatarColor || null,
        bannerUrl: u.bannerUrl || null,
        steamId: u.steamId || null,
        twitchLogin: u.twitchLogin || null,
        xboxGamertag: u.xboxGamertag || null,
        gameAccounts: gameAccounts.map(a => ({
          gameType: a.gameType,
          displayName: a.displayName,
          platform: a.platform,
          linkedAt: a.createdAt.toISOString(),
        })),
        primaryCrew: primaryMembership?.crew
          ? {
              id: primaryMembership.crew.id,
              name: primaryMembership.crew.name,
              tag: primaryMembership.crew.tag || "",
              logoUrl: primaryMembership.crew.logoUrl || null,
              accentColor: primaryMembership.crew.accentColor || null,
              tagShape: primaryMembership.crew.tagShape || "rounded",
              role: primaryMembership.role,
            }
          : null,
      });
    } catch (e) {
      console.error("[profile GET]", e);
      return reply.code(500).send({ error: "Server error" });
    }
  });

  app.patch("/profile/me", {
  schema: { tags: ["profile"] },
}, async (req, reply) => {
    const authHeader = (req.headers as any).authorization;
    const viewer = authFromHeader(authHeader);
    if (!viewer) return reply.code(401).send({ error: "Unauthorized" });

    const body: any = (req as any).body || {};
    const bio = typeof body.bio === "string" ? body.bio.trim().slice(0, 280) : undefined;
    const avatarColor = typeof body.avatarColor === "string" ? body.avatarColor.slice(0, 20) : undefined;
    const avatar = typeof body.avatar === "string" ? body.avatar.slice(0, 500) : undefined;
    const bannerUrl = typeof body.bannerUrl === "string" ? body.bannerUrl.slice(0, 500) : undefined;
    const statusText = typeof body.statusText === "string" ? body.statusText.trim().slice(0, 80) : undefined;
    const statusEmoji = typeof body.statusEmoji === "string" ? body.statusEmoji.trim().slice(0, 24) : undefined;
    const FRAME_KEYS = ["none","gold","flames","crystal","neon","circuit"];
    const avatarFrame = typeof body.avatarFrame === "string" && FRAME_KEYS.includes(body.avatarFrame) ? body.avatarFrame : undefined;
    const NAME_KEYS = ["none","gold","fire","ice","toxic","royal","rainbow"];
    const nameEffect = typeof body.nameEffect === "string" && NAME_KEYS.includes(body.nameEffect) ? body.nameEffect : undefined;
    const JOIN_KEYS = ["EVERYONE", "FRIENDS", "OFF"];
    const joinPolicy = typeof body.joinPolicy === "string" && JOIN_KEYS.includes(body.joinPolicy) ? body.joinPolicy : undefined;
    const invitePolicy = typeof body.invitePolicy === "string" && JOIN_KEYS.includes(body.invitePolicy) ? body.invitePolicy : undefined;

    const isHex = (s: string) => /^#[0-9a-f]{6}$/i.test(s);
    const normColor = (raw: any): string | null | undefined => {
      if (typeof raw !== "string") return undefined;
      const t = raw.trim();
      if (t === "") return null;
      return isHex(t) ? t : undefined;
    };
    const panelBgColor = normColor(body.panelBgColor);
    const panelAccentColor = normColor(body.panelAccentColor);
    const pillBgColor = normColor(body.pillBgColor);
    const pillAccentColor = normColor(body.pillAccentColor);

    if (
      bio === undefined && avatarColor === undefined && avatar === undefined && bannerUrl === undefined
      && panelBgColor === undefined && panelAccentColor === undefined
      && pillBgColor === undefined && pillAccentColor === undefined
      && statusText === undefined && statusEmoji === undefined && avatarFrame === undefined && nameEffect === undefined && joinPolicy === undefined && invitePolicy === undefined
    ) return reply.code(400).send({ error: "Nothing to update" });

    try {
      const u = await prisma.user.update({
        where: { id: viewer.id },
        data: {
          ...(bio !== undefined && { bio }),
          ...(avatarColor !== undefined && { avatarColor }),
          ...(avatar !== undefined && { avatar: avatar || null }),
          ...(bannerUrl !== undefined && { bannerUrl: bannerUrl || null }),
          ...(statusText !== undefined && { statusText: statusText || null }),
          ...(statusEmoji !== undefined && { statusEmoji: statusEmoji || null }),
          ...(avatarFrame !== undefined && { avatarFrame: avatarFrame === "none" ? null : avatarFrame }),
          ...(nameEffect !== undefined && { nameEffect: nameEffect === "none" ? null : nameEffect }),
          ...(joinPolicy !== undefined && { joinPolicy }),
          ...(invitePolicy !== undefined && { invitePolicy }),
          ...(panelBgColor !== undefined && { panelBgColor }),
          ...(panelAccentColor !== undefined && { panelAccentColor }),
          ...(pillBgColor !== undefined && { pillBgColor }),
          ...(pillAccentColor !== undefined && { pillAccentColor }),
        } as any,
        select: { id: true, bio: true, statusText: true, statusEmoji: true } as any,
      });

      if (bio !== undefined && bio.length >= 10) {
        await awardNotoriety(viewer.id, "BIO_COMPLETE");
      }

      const visibleChanged =
        avatarColor !== undefined || avatar !== undefined
        || panelBgColor !== undefined || panelAccentColor !== undefined
        || pillBgColor !== undefined  || pillAccentColor !== undefined;
      if (visibleChanged) {
        if (avatar !== undefined && avatar) awardNotoriety(viewer.id, "AVATAR_SET").catch(() => {});
        for (const sock of getWss().clients) {
          const s = sock as any;
          if (s.user?.id === viewer.id) {
            if (avatarColor !== undefined)      s.user.avatarColor = avatarColor;
            if (avatar !== undefined)           s.user.avatar = avatar || undefined;
            if (panelBgColor !== undefined)     (s.user as any).panelBgColor     = panelBgColor     || undefined;
            if (panelAccentColor !== undefined) (s.user as any).panelAccentColor = panelAccentColor || undefined;
            if (pillBgColor !== undefined)      (s.user as any).pillBgColor      = pillBgColor      || undefined;
            if (pillAccentColor !== undefined)  (s.user as any).pillAccentColor  = pillAccentColor  || undefined;
            if (s.roomId) {
              const room = rooms.get(s.roomId);
              if (room) {
                const entry = room.users.get(viewer.id);
                if (entry) {
                  if (avatarColor !== undefined)      (entry as any).avatarColor = avatarColor;
                  if (avatar !== undefined)           (entry as any).avatar      = avatar || undefined;
                  if (pillBgColor !== undefined)      (entry as any).pillBgColor = pillBgColor || undefined;
                  if (pillAccentColor !== undefined)  (entry as any).pillAccentColor = pillAccentColor || undefined;
                }
                publishState(room);
              }
            }
          }
        }
      }

      return reply.send({ ok: true, bio: u.bio, statusText: (u as any).statusText ?? null, statusEmoji: (u as any).statusEmoji ?? null });
    } catch (e) {
      console.error("[profile PATCH]", e);
      return reply.code(500).send({ error: "Server error" });
    }
  });

  app.post("/profile/me/steam-id", {
  schema: { tags: ["profile"] },
}, async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const body: any = (req as any).body || {};
    let raw = String(body.steamId || "").trim();

    if (raw === "") {
      await prisma.user.update({
        where: { id: u.id },
        data: { steamId: null, livePresence: Prisma.DbNull, presenceCheckedAt: null },
      });
      return reply.send({ ok: true, steamId: null });
    }

    const urlMatch = raw.match(/steamcommunity\.com\/(id|profiles)\/([^/\s?#]+)/i);
    if (urlMatch) raw = urlMatch[2];

    let steamId: string | null = null;

    if (/^\d{17}$/.test(raw)) {
      steamId = raw;
    } else if (STEAM_API_KEY) {
      try {
        const resolveUrl = `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v0001/?key=${STEAM_API_KEY}&vanityurl=${encodeURIComponent(raw)}`;
        const res = await fetchWithTimeout(resolveUrl);
        if (res.ok) {
          const j: any = await res.json();
          if (j?.response?.success === 1 && typeof j?.response?.steamid === "string") {
            steamId = j.response.steamid;
          }
        }
      } catch {}
    }

    if (!steamId) {
      return reply.code(400).send({
        ok: false,
        error: "invalid_steam_id",
        message: STEAM_API_KEY
          ? "Could not resolve that. Use your SteamID64 (17 digits) or the exact vanity URL from steamcommunity.com/id/<yourname>/."
          : "Server missing Steam API key — paste your 17-digit SteamID64 directly.",
      });
    }

    await prisma.user.update({
      where: { id: u.id },
      data: { steamId, livePresence: undefined, presenceCheckedAt: null },
    });
    return reply.send({ ok: true, steamId, resolvedFrom: raw !== steamId ? raw : undefined });
  });

  app.post("/profile/me/twitch-login", {
  schema: { tags: ["profile"] },
}, async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const body: any = (req as any).body || {};
    const raw = String(body.twitchLogin || "").trim().toLowerCase();
    const twitchLogin = raw === "" ? null : (/^[a-z0-9_]{3,25}$/.test(raw) ? raw : null);
    if (raw !== "" && !twitchLogin) {
      return reply.code(400).send({ ok: false, error: "invalid_twitch_login", message: "Twitch login is 3-25 chars: letters, numbers, underscores." });
    }
    await prisma.user.update({
      where: { id: u.id },
      data: { twitchLogin, livePresence: twitchLogin ? undefined : Prisma.DbNull, presenceCheckedAt: null },
    });
    return reply.send({ ok: true, twitchLogin });
  });

  app.post("/profile/me/xbox-gamertag", {
  schema: { tags: ["profile"] },
}, async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const body: any = (req as any).body || {};
    const raw = String(body.gamertag || "").trim();

    if (raw === "") {
      await prisma.user.update({
        where: { id: u.id },
        data: { xboxGamertag: null, xboxXuid: null, livePresence: Prisma.DbNull, presenceCheckedAt: null },
      });
      return reply.send({ ok: true, xboxGamertag: null });
    }

    if (!OPENXBL_API_KEY) {
      return reply.code(503).send({ ok: false, error: "xbl_unconfigured", message: "Xbox integration is not configured on the server." });
    }

    const resolved = await resolveXboxGamertag(raw);
    if (!resolved) {
      return reply.code(400).send({ ok: false, error: "invalid_gamertag", message: "Could not find that Xbox gamertag. Double-check spelling and try again." });
    }

    await prisma.user.update({
      where: { id: u.id },
      data: { xboxGamertag: resolved.gamertag, xboxXuid: resolved.xuid, livePresence: undefined, presenceCheckedAt: null },
    });
    return reply.send({ ok: true, xboxGamertag: resolved.gamertag, xboxXuid: resolved.xuid });
  });

  app.post("/profile/me/psn-account-id", {
  schema: { tags: ["profile"] },
}, async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const body: any = (req as any).body || {};
    const raw = String(body.psnAccountId || "").trim();

    if (raw === "") {
      await prisma.user.update({ where: { id: u.id }, data: { psnAccountId: null } });
      return reply.send({ ok: true, psnAccountId: null });
    }

    if (!/^[A-Za-z][A-Za-z0-9_-]{2,15}$/.test(raw)) {
      return reply.code(400).send({
        ok: false,
        error: "invalid_psn_id",
        message: "PSN ID must be 3-16 characters, start with a letter, and contain only letters, numbers, dashes, or underscores.",
      });
    }

    await prisma.user.update({ where: { id: u.id }, data: { psnAccountId: raw } });
    return reply.send({ ok: true, psnAccountId: raw });
  });

  app.get("/profile/me/presence", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const row = await prisma.user.findUnique({
      where: { id: u.id },
      select: { steamId: true, twitchLogin: true, xboxGamertag: true, xboxXuid: true, psnAccountId: true, lichessUsername: true, chessComUsername: true, livePresence: true, presenceCheckedAt: true },
    });
    return reply.send({
      ok: true,
      steamId: row?.steamId ?? null,
      twitchLogin: row?.twitchLogin ?? null,
      xboxGamertag: row?.xboxGamertag ?? null,
      psnAccountId: row?.psnAccountId ?? null,
      lichessUsername: row?.lichessUsername ?? null,
      chessComUsername: row?.chessComUsername ?? null,
      livePresence: row?.livePresence ?? null,
      presenceCheckedAt: row?.presenceCheckedAt ?? null,
    });
  });

  app.post("/profile/me/presence/refresh", {
  schema: { tags: ["profile"] },
}, async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const row = await prisma.user.findUnique({
      where: { id: u.id },
      select: { id: true, steamId: true, twitchLogin: true, xboxXuid: true },
    });
    if (!row) return reply.code(404).send({ ok: false, error: "not_found" });

    let steamData: any = undefined;
    let twitchData: any = undefined;
    let xboxData: any = undefined;

    if (STEAM_API_KEY && row.steamId) {
      const batch = await pollSteamPresenceBatch([row.steamId]);
      steamData = batch[row.steamId];
    }
    if (TWITCH_CLIENT_ID && row.twitchLogin) {
      const batch = await pollTwitchPresenceBatch([row.twitchLogin.toLowerCase()]);
      twitchData = batch[row.twitchLogin.toLowerCase()];
    }
    if (OPENXBL_API_KEY && row.xboxXuid) {
      xboxData = await pollXboxPresenceOne(row.xboxXuid);
    }

    const primary = (twitchData && twitchData.source === "TWITCH") ? twitchData
      : (xboxData && xboxData.source === "XBOX") ? xboxData
      : (steamData ?? null);
    if (primary !== undefined) {
      await prisma.user.update({
        where: { id: row.id },
        data: { livePresence: primary as any, presenceCheckedAt: new Date() },
      }).catch(() => {});
    }
    return reply.send({ ok: true, livePresence: primary ?? null, presenceCheckedAt: new Date().toISOString() });
  });

  app.post("/profile/me/delete", {
  schema: { tags: ["profile"] },
}, async (req, reply) => {
    const viewer = authFromHeader((req as any).headers?.authorization);
    if (!viewer) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const body: any = (req as any).body || {};
    if (String(body.confirm || "").trim() !== "DELETE") {
      return reply.code(400).send({ ok: false, error: "confirm_phrase_required" });
    }

    const userId = viewer.id;

    try {
      const anonSuffix = userId.slice(-8).toLowerCase();
      const anonName = `deleted_${anonSuffix}`;

      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: {
            name: anonName,
            usernameKey: anonName,
            description: "",
            bio: null,
            email: null,
            googleId: null,
            avatar: null,
            avatarColor: null,
            locationOptIn: false,
            latitude: null,
            longitude: null,
            locationH3: null,
            locationUpdatedAt: null,
            deletedAt: new Date(),
          },
        });

        await tx.localAuth.deleteMany({ where: { userId } });

        await tx.pushSubscription.deleteMany({ where: { userId } });

        await tx.userGameAccount.deleteMany({ where: { userId } });
      });

      try {
        for (const sock of getWss().clients) {
          if ((sock as any).user?.id === userId) {
            try { (sock as any).close(); } catch {}
          }
        }
      } catch {}

      await globalAudit(userId, anonName, "account_deleted_self", userId);

      return reply.send({ ok: true });
    } catch (e: any) {
      console.error("[account delete]", e);
      return reply.code(500).send({ ok: false, error: "delete_failed" });
    }
  });
}
