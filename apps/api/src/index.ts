import { log, logger, swallow } from "./lib/logger";
import dotenv from "dotenv";
dotenv.config({ override: true });
import * as Sentry from "@sentry/node";
if (process.env.SENTRY_DSN_API) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN_API,
    environment: process.env.NODE_ENV || "production",
    tracesSampleRate: 0.1,
    ignoreErrors: [
      "Bad escaped character in JSON",
      "Unexpected token",
      "Unexpected end of JSON input",
      "Unsupported Media Type",
      "Body cannot be empty",
      "FST_ERR_CTP_INVALID_MEDIA_TYPE",
      "FST_ERR_CTP_EMPTY_JSON_BODY",
      "Internal server error",
      "api_error",
      "overloaded_error",
      "ECONNRESET",
      "ETIMEDOUT",
      "ENOTFOUND",
      "fetch failed",
    ],
  });
}

process.on("unhandledRejection", (reason: any) => {
  log.error("[unhandledRejection]", reason);
  try {
    Sentry.captureException(reason);
  } catch (e) {
    swallow(e);
  }
});
process.on("uncaughtException", (err: any) => {
  log.error("[uncaughtException]", err);
  try {
    Sentry.captureException(err);
    Sentry.close(2000).finally(() => process.exit(1));
  } catch {
    process.exit(1);
  }
});
import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform,
} from "fastify-type-provider-zod";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import mlbRoutes from "./routes/mlb";
import pgaRoutes from "./routes/pga";
import tenorRoutes from "./routes/tenor";
import twitchRoutes from "./routes/twitch";
import youtubeRoutes from "./routes/youtube";
import fortniteRoutes from "./routes/fortnite";
import scryfallRoutes from "./routes/scryfall";
import mtgRoutes from "./routes/mtg";
import pubgRoutes from "./routes/pubg";
import leagueRoutes from "./routes/league";
import bungieRoutes from "./routes/bungie";
import eveRoutes from "./routes/eve";
import poeRoutes from "./routes/poe";
import chatMediaRoutes from "./routes/chatMedia";
import mcRoutes from "./routes/mc";
import windroseRoutes from "./routes/windrose";
import helldiversStratagemsRoutes from "./routes/helldivers-stratagems";
import helldiversLoadoutsRoutes from "./routes/helldivers-loadouts";
import steamRoutes from "./routes/steam";
import windroseBuildsRoutes from "./routes/windrose-builds";
import badgesRoutes from "./routes/badges";
import challengesRoutes from "./routes/challenges";
import geoRoutes from "./routes/geo";
import uploadsRoutes from "./routes/uploads";
import tournamentsRoutes from "./routes/tournaments";
import flairContestsRoutes, { startFlairContestTick } from "./routes/flair-contests";
import flairRoutes from "./routes/flair";
import {
  mintFlairItem as mintFlairItemHelper,
  grantFlairToUser as grantFlairToUserHelper,
} from "./lib/flair";
import lfgRoutes from "./routes/lfg";
import redditRoutes from "./routes/reddit";
import helldiversMoRoutes from "./routes/helldivers-mo";
import { runHelldiversWorker } from "./helldiversWorker";
import paperRoutes from "./routes/paper";
import invitesRoutes from "./routes/invites";
import chessRoutes from "./routes/chess";
import { startChessWorker } from "./chessWorker";
import { startChessChallengeWorker } from "./chessChallengeWorker";
import newsRoutes from "./routes/news";
import modsRoutes from "./routes/mods";
import aiRoutes from "./routes/ai";
import socialRoutes from "./routes/social";
import storeRoutes from "./routes/store";
import notificationsRoutes from "./routes/notifications";
import crewsRoutes from "./routes/crews";
import forumRoutes from "./routes/forum";
import forumModRoutes, { autoModTick } from "./routes/forum-mod";
import eventsRoutes from "./routes/events";
import dmRoutes from "./routes/dm";
import groupRoutes from "./routes/groups";
import billingRoutes from "./routes/billing";
import activityRoutes from "./routes/activity";
import staffOpsRoutes from "./routes/staffOps";
import roomsRoutes from "./routes/rooms";
import lobbiesRoutes from "./routes/lobbies";
import staffRoutes from "./routes/staff";
import tradingRoutes from "./routes/trading";
import usersSearchRoutes from "./routes/usersSearch";
import notorietyRoutes from "./routes/notoriety";
import publicMiscRoutes from "./routes/publicMisc";
import desktopRoutes from "./routes/desktop";
import voiceRoutes from "./routes/voice";
import staffContentRoutes from "./routes/staffContent";
import authRoutes from "./routes/auth";
import profileRoutes from "./routes/profile";
import pokerRoutes from "./routes/poker";
import setupTradingSocket from "./sockets/tradingWs";
import { handleCanvas, handleCanvasRelay } from "./sockets/canvas";
import { handleLaunch, handleYoutube } from "./sockets/roomMedia";
import { handleVoice } from "./sockets/voiceWs";
import { handlePresence } from "./sockets/presence";
import { handleChat, handleCrewDm, handleReactionToggle } from "./sockets/messaging";
import { handleRoomClose, handleRoomMod } from "./sockets/roomMod";
import { handlePoker } from "./sockets/poker";
import { handleAuthHello, handleClose } from "./sockets/connection";
import campaignsRoutes from "./routes/campaigns";
import characterRoutes from "./routes/characters";
import diceRoutes from "./routes/dice";
import mapsRoutes from "./routes/maps";
import supportRoutes from "./routes/support";
import publicRoutes from "./routes/public";
import overlayRoutes from "./routes/overlay";
import { seedSyntheticActivity, capturePublicActivity } from "./lib/publicActivity";
import jwt from "jsonwebtoken";
import { WebSocketServer } from "ws";
import cors from "@fastify/cors";
import { randomBytes } from "crypto";
import { RoomRole } from "@prisma/client";
import {
  canAccessStaff,
  getLobbyRole,
  getGlobalRole,
  canAssignRoles,
  isGloballyBanned,
  isNameReserved,
  hydrateGlobalRole,
} from "./lib/lobbyAuth";
import {
  getSiteConfig,
  setSiteConfig,
  getAllSiteConfig,
  SITE_CONFIG_DEFAULTS,
} from "./lib/siteConfig";
import {
  resolveMentions,
  toggleReactionOnTarget,
  fetchReactionsForTargets,
  checkChatRateLimit,
  checkUrlSpam,
} from "./lib/chatHelpers";
import {
  setRoomStateDeps,
  rooms,
  articleRoomMeta,
  _lobbyActivityAt,
  normalizeRoomId,
  ensureRoomLoaded,
  safeJson,
  send,
  broadcast,
  isOwner,
  isElevatedGlobal,
  isModOrOwner,
  roleOf,
  ensureLaunch,
  broadcastLaunch,
  audit,
  buildStatePayload,
  publishStateToSocket,
  publishState,
  leaveRoom,
  type Sock,
  type AuthedUser,
  type RoomState,
} from "./lib/roomState";
import {
  dmDeliver,
  isUserOnline,
  seedWelcomeDM,
  sendPush,
  createNotification,
  VAPID_PUBLIC,
  setNotificationsWss,
} from "./lib/notifications";
import {
  subscribeBinanceSymbol,
  symbolSubscribers,
  livePrices,
  binanceSubs,
  DEFAULT_SYMBOLS,
} from "./lib/binanceFeed";
import { getSiteFlags, getAI, isAIAvailable } from "./lib/ai";
import { buildOperatorSystemPrompt } from "./lib/operatorPrompt";
import { runFeedWorker, recencyScore } from "./lib/feedWorker";
import {
  setPokerTableDeps,
  pokerTables,
  getOrCreatePokerTable,
  activeSeatCount,
  activePlayersInHand,
  buildPokerStateForUser,
  broadcastToPokerTable,
  broadcastPokerState,
  advancePokerGame,
  startPokerHand,
} from "./lib/pokerTable";
import {
  setNotorietyDeps,
  awardNotoriety,
  getNotorietyRank,
  NOTORIETY_RANKS,
} from "./lib/notoriety";
import {
  setPresenceWss,
  startPresencePolling,
  STEAM_API_KEY,
  TWITCH_CLIENT_ID,
  OPENXBL_API_KEY,
  resolveXboxGamertag,
  pollSteamPresenceBatch,
  pollTwitchPresenceBatch,
  pollXboxPresenceOne,
} from "./lib/presence";

import { SEED_LOBBIES, SEED_ROOMS } from "./seedData";
import { syncManifest } from "./manifest";
import { startChallengeWorker, setBungieApiKey } from "./challengeWorker";
import { startTournamentAutoDetect } from "./tournamentAutoDetect";
import { startNexusPoller } from "./nexusPoller";

import { prisma } from "./lib/prisma";
import { readCookieToken } from "./lib/authCookie";
import { awardPaper } from "./lib/economy";

const JWT_SECRET = (() => {
  const s = process.env.JWT_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "development") return "weered-dev-secret";
  throw new Error("FATAL: JWT_SECRET is not set — refusing to start with a default secret.");
})();

const HTTP_PORT = Number(process.env.PORT || 4000);
const WS_PORT = Number(process.env.WS_PORT || 4001);

let wss: WebSocketServer;
let broadcastToLobbyRef: ((lobbyId: string, event: any) => void) | undefined;

async function seedLobbies() {
  for (const l of SEED_LOBBIES) {
    try {
      await prisma.lobby.upsert({
        where: { id: l.id },
        update: { pinned: true, moduleType: l.moduleType, moduleConfig: l.moduleConfig as any },
        create: {
          id: l.id,
          name: l.name,
          description: l.description,
          pinned: true,
          verified: true,
          moduleType: l.moduleType,
          moduleConfig: l.moduleConfig as any,
          keywords: l.keywords,
          accentColor: (l as any).accentColor ?? null,
          logoUrl: (l as any).logoUrl ?? null,
          bannerUrl: (l as any).bannerUrl ?? null,
          websiteUrl: (l as any).websiteUrl ?? null,
        },
      });
    } catch (e) {
      log.warn("seedLobbies:", l.id, e);
    }
  }
  log.log("[weered] lobbies seeded");

  for (const r of SEED_ROOMS) {
    try {
      await prisma.room.upsert({
        where: { id: r.id },
        update: {
          name: r.name,
          description: r.description,
          lobbyId: r.lobbyId,
          pinned: true,
          ...(r.defaultModule !== undefined ? { defaultModule: r.defaultModule } : {}),
        },
        create: {
          id: r.id,
          name: r.name,
          description: r.description,
          lobbyId: r.lobbyId,
          locked: false,
          pinned: true,
          ...(r.defaultModule !== undefined ? { defaultModule: r.defaultModule } : {}),
        },
      });
    } catch (e) {
      log.warn("seedRooms:", r.id, e);
    }
  }
  log.log(`[weered] seeded/updated ${SEED_ROOMS.length} default room(s)`);
}

async function globalAudit(
  actorId: string,
  actorName: string,
  action: string,
  targetId?: string,
  targetName?: string,
  meta?: any,
) {
  try {
    await prisma.globalAudit.create({
      data: {
        actorId,
        actorName,
        action,
        targetId: targetId ?? null,
        targetName: targetName ?? null,
        meta: meta ?? null,
      },
    });
  } catch (e) {
    swallow(e);
  }
}
function removePending(room: RoomState, userId: string) {
  const set = room.pending.get(userId);
  if (set) {
    for (const s of set) {
      try {
        s.pendingRoomId = undefined;
      } catch (e) {
        swallow(e);
      }
    }
  }
  room.pending.delete(userId);
}

function removeKnock(room: RoomState, userId: string) {
  room.knocks = room.knocks.filter((k) => k.userId !== userId);
}

function verifyToken(token?: string): AuthedUser | null {
  if (!token) return null;
  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    const id = String(decoded?.sub || decoded?.id || "");
    const name = String(decoded?.name || decoded?.username || "");
    if (!id || !name) return null;
    return { id, name };
  } catch {
    return null;
  }
}

function authFromHeader(authHeader?: string): AuthedUser | null {
  if (!authHeader) return null;
  const raw = String(authHeader).trim();
  const m = raw.match(/^Bearer\s+(.+)$/i);
  if (m) return verifyToken(m[1]);
  return verifyToken(raw);
}

async function resolveUserId(raw: string): Promise<string> {
  if (raw.length > 20 && !raw.includes(" ")) return raw;
  const found = await prisma.user.findFirst({
    where: { OR: [{ usernameKey: raw.toLowerCase() }, { name: raw }] },
    select: { id: true },
  });
  return found?.id ?? raw;
}

const ROOM_ALPH = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
function shortRoomId(len = 6): string {
  const b = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ROOM_ALPH[b[i] % ROOM_ALPH.length];
  return out;
}

function findSocketsByUser(room: RoomState, userId: string): Sock[] {
  const out: Sock[] = [];
  for (const s of room.sockets) {
    if (s.user?.id === userId) out.push(s);
  }
  return out;
}

async function persistMember(room: RoomState, user: AuthedUser) {
  if (room.roomId === "lobby") return;
  const role = roleOf(room, user.id);
  const dbRole =
    role === "owner" ? RoomRole.OWNER : role === "mod" ? RoomRole.MOD : RoomRole.MEMBER;
  await prisma.roomMember.upsert({
    where: { roomId_userId: { roomId: room.roomId, userId: user.id } },
    update: { name: user.name, role: dbRole },
    create: { roomId: room.roomId, userId: user.id, name: user.name, role: dbRole },
  });
}

async function persistRoomBasics(room: RoomState) {
  if (room.roomId === "lobby") return;
  await prisma.room.update({
    where: { id: room.roomId },
    data: { name: room.name || "", locked: Boolean(room.locked), ownerId: room.ownerId || null },
  });
}

async function doJoin(ws: Sock, roomId: string) {
  roomId = normalizeRoomId(roomId);
  const room = await ensureRoomLoaded(roomId);
  if (roomId === "lobby" && !room.name) room.name = "Home Lobby";

  if (!room.ownerId && ws.user) {
    room.ownerId = ws.user.id;
    if (room.roomId !== "lobby") {
      await prisma.room.update({ where: { id: room.roomId }, data: { ownerId: room.ownerId } });
    }
  }

  if (ws.user && room.banned.has(ws.user.id)) {
    send(ws, { type: "room:banned", roomId });
    return false;
  }

  if (ws.roomId === roomId) {
    publishStateToSocket(ws, room);
    return true;
  }
  if (ws.roomId) leaveRoom(ws);

  ws.roomId = roomId;
  ws.pendingRoomId = undefined;
  room.sockets.add(ws);
  room.lastActiveAt = Date.now();
  if (ws.user) room.pending.delete(ws.user.id);

  if (ws.user && !room.users.has(ws.user.id)) {
    const userEntry = {
      id: ws.user.id,
      name: ws.user.name,
      usernameKey: (ws.user as any).usernameKey ?? undefined,
      globalRole: ws.user.globalRole || "USER",
      tier: ws.user.tier || "INNOCENT",
      avatarColor: ws.user.avatarColor ?? undefined,
      avatar: ws.user.avatar ?? undefined,
      steamId: (ws.user as any).steamId ?? undefined,
      twitchLogin: (ws.user as any).twitchLogin ?? undefined,
      xboxGamertag: (ws.user as any).xboxGamertag ?? undefined,
      isAway: Boolean((ws.user as any).isAway),
      livePresence: (ws.user as any).livePresence ?? null,
      pillBgColor: (ws.user as any).pillBgColor ?? undefined,
      pillAccentColor: (ws.user as any).pillAccentColor ?? undefined,
      statusText: (ws.user as any).statusText ?? undefined,
      statusEmoji: (ws.user as any).statusEmoji ?? undefined,
      nameEffect: (ws.user as any).nameEffect ?? undefined,
      avatarFrame: (ws.user as any).avatarFrame ?? undefined,
    };
    room.users.set(ws.user.id, userEntry);
    broadcast(room, { type: "presence:join", roomId, user: userEntry });
  }

  if (ws.user) {
    try {
      await persistMember(room, ws.user);
    } catch (e) {
      swallow(e);
    }
  }

  if (ws.user) awardNotoriety(ws.user.id, "ROOM_JOINED").catch(swallow);

  publishStateToSocket(ws, room);

  if (room.msgs.length) {
    send(ws, { type: "chat:history", roomId, msgs: room.msgs.slice(-80) });
  }

  if (room.ytState) {
    send(ws, { type: "youtube:state", roomId, ...room.ytState });
  }

  return true;
}

async function main() {
  const app = Fastify({ loggerInstance: logger });

  // CORS is normally added at the Caddy edge in production. Non-prod stacks
  // with no edge (e.g. the E2E CI job, where the browser calls the API
  // cross-origin) opt in via ENABLE_CORS — kept OFF in prod so it never
  // duplicates the edge headers.
  if (process.env.ENABLE_CORS === "1") {
    await app.register(cors, { origin: true, credentials: true });
  }
  app.addHook("onRequest", async (req: any) => {
    if (!req.headers.authorization) {
      const c = readCookieToken(req);
      if (c) req.headers.authorization = "Bearer " + c;
    }
  });

  // Maintenance gate: when on, non-staff get 503. /health, /auth/*, and /staff*
  // always pass so an operator can always log in and turn it back off.
  // Fail-open: any error here lets the request through so a bug can never down the site.
  app.addHook("onRequest", async (req: any, reply: any) => {
    try {
      if ((await getSiteFlags()).maintenanceMode !== "true") return;
      const url = String(req.url || "").split("?")[0];
      if (url === "/health" || url.startsWith("/auth/") || url.startsWith("/staff")) return;
      const au = authFromHeader(req.headers.authorization);
      if (au && canAccessStaff(await getGlobalRole(au.id))) return;
      return reply
        .code(503)
        .send({ error: "maintenance", message: "Weered is down for maintenance. Back shortly." });
    } catch (e) {
      swallow(e);
    }
  });

  // ── Zod-backed validation + OpenAPI ───────────────────────────────────────
  // The Zod compilers only run for routes that declare a `schema`, so every
  // existing schema-less route is completely unaffected. /docs is staff-gated.
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.setErrorHandler((err, req, reply) => {
    const e = err as any;
    const status = e.statusCode || 500;
    // Schema (Zod) validation failures are client errors: clean 400, no Sentry noise.
    if (status === 400 && (e.validation || e.code === "FST_ERR_VALIDATION")) {
      return reply
        .status(400)
        .send({ ok: false, error: "validation_error", message: e.message || "Invalid request" });
    }
    if (status >= 500 && process.env.SENTRY_DSN_API) {
      Sentry.captureException(err, { tags: { route: req.routeOptions?.url || req.url } });
    }
    reply
      .status(status)
      .send({ ok: false, error: status >= 500 ? "internal_error" : e.message || "error" });
  });

  // Unknown routes get the same { ok:false, error, message } envelope as the rest
  // of the API (Fastify's default 404 shape was the odd one out).
  app.setNotFoundHandler((req, reply) => {
    reply
      .status(404)
      .send({ ok: false, error: "not_found", message: `Route ${req.method} ${req.url} not found` });
  });
  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: "Weered API",
        version: "1.0.0",
        description:
          "Weered platform API. Web clients authenticate with an httpOnly session cookie; mobile/desktop use a Bearer token.",
      },
      tags: [
        { name: "auth", description: "Registration, login, session" },
        { name: "paper", description: "Paper virtual-currency economy" },
        { name: "trading", description: "FakeOut paper trading" },
      ],
    },
    transform: jsonSchemaTransform,
  });
  await app.register(fastifySwaggerUi, {
    routePrefix: "/docs",
    uiHooks: {
      onRequest: async (req: any, reply: any) => {
        try {
          const u = authFromHeader(req.headers.authorization);
          if (u && canAccessStaff(await getGlobalRole(u.id))) return;
        } catch (e) {
          swallow(e);
        }
        return reply.code(403).send({ error: "forbidden" });
      },
    },
  });

  const { default: rateLimit } = await import("@fastify/rate-limit");
  await app.register(rateLimit, {
    global: true,
    max: 600,
    timeWindow: "1 minute",
    keyGenerator: (req) => {
      const fwd = (req.headers["x-forwarded-for"] as string | undefined) || "";
      return fwd.split(",")[0].trim() || req.ip;
    },
    errorResponseBuilder: (_req, ctx) => ({
      statusCode: 429,
      error: "rate_limited",
      message: "Too many requests. Slow down.",
      retryAfterSec: Math.ceil(ctx.ttl / 1000),
    }),
  });

  app.addHook("preParsing", async (req, _reply, payload) => {
    if (req.url === "/subscribe/webhook") {
      const chunks: Buffer[] = [];
      for await (const chunk of payload as any) chunks.push(Buffer.from(chunk));
      const raw = Buffer.concat(chunks);
      (req as any).rawBody = raw;
      const { Readable } = await import("stream");
      const copy = new Readable();
      copy.push(raw);
      copy.push(null);
      return copy;
    }
    return payload;
  });

  const WINDROSE_BANNER_COUNT = 24;
  function applyWindroseReel<T extends { id?: string; bannerUrl?: string | null } | null>(
    lobby: T,
  ): T {
    if (!lobby || lobby.id !== "windrose") return lobby;
    const idx = Math.floor(Math.random() * WINDROSE_BANNER_COUNT) + 1;
    const num = idx.toString().padStart(2, "0");
    (lobby as any).bannerUrl = `/brand/windrose/banners/banner-${num}.webp`;
    return lobby;
  }

  await app.register(publicMiscRoutes, { getSiteConfig, applyWindroseReel });
  app.get("/health", async (_req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { ok: true, db: "ok" };
    } catch {
      return reply.code(503).send({ ok: false, db: "down" });
    }
  });

  await app.register(authRoutes, {
    authFromHeader,
    JWT_SECRET,
    isNameReserved,
    getSiteConfig,
    seedWelcomeDM,
  });

  const WEB_URL = process.env.APP_URL || "https://weered.ca";

  await app.register(voiceRoutes, {
    authFromHeader,
    rooms,
    ensureRoomLoaded,
    normalizeRoomId,
    isModOrOwner,
    awardNotoriety,
  });
  async function lobbyAdminAccess(
    req: any,
    reply: any,
    minLevel = 4,
  ): Promise<{
    user: any;
    lobby: any;
    member: any;
    globalRole: any;
    overrideRole: string | null;
  } | null> {
    const u = authFromHeader(req.headers?.authorization);
    if (!u) {
      reply.code(401).send({ ok: false, error: "unauthorized" });
      return null;
    }
    const lobbyId = String(req.params?.id || req.params?.lobbyId || "");
    const lobby = await prisma.lobby.findUnique({ where: { id: lobbyId } });
    if (!lobby) {
      reply.code(404).send({ ok: false, error: "lobby_not_found" });
      return null;
    }
    const gr = await getGlobalRole(u.id);
    if (canAccessStaff(gr))
      return { user: u, lobby, member: null, globalRole: gr, overrideRole: gr };
    const member = await prisma.lobbyMember.findUnique({
      where: { lobbyId_userId: { lobbyId, userId: u.id } },
    });
    if (!member || (member.roleLevel ?? 1) < minLevel) {
      reply.code(403).send({ ok: false, error: "forbidden" });
      return null;
    }
    return { user: u, lobby, member, globalRole: gr, overrideRole: null };
  }

  await app.register(lobbiesRoutes, {
    authFromHeader,
    verifyToken,
    getGlobalRole,
    canAccessStaff,
    getLobbyRole,
    applyWindroseReel,
    lobbyAdminAccess,
    globalAudit,
    rooms,
    isNameReserved,
    awardNotoriety,
    send,
  } as any);

  await app.register(roomsRoutes, {
    authFromHeader,
    verifyToken,
    getGlobalRole,
    canAccessStaff,
    rooms,
    ensureRoomLoaded,
    normalizeRoomId,
    buildStatePayload,
    send,
    shortRoomId,
    broadcastToLobby,
  } as any);

  await app.register(staffRoutes, {
    authFromHeader,
    getGlobalRole,
    canAccessStaff,
    canAssignRoles,
    globalAudit,
    broadcast,
    broadcastEvent,
    rooms,
    send,
    getWss: () => wss,
    shortRoomId,
    getAllSiteConfig,
    setSiteConfig,
    SITE_CONFIG_DEFAULTS,
    getSiteConfig,
    isModOrOwner,
    audit,
    publishState,
    findSocketsByUser,
  } as any);

  await app.register(staffContentRoutes, {
    authFromHeader,
    getGlobalRole,
    canAccessStaff,
    globalAudit,
    rooms,
  });
  await app.register(profileRoutes, {
    authFromHeader,
    getNotorietyRank,
    awardNotoriety,
    globalAudit,
    publishState,
    rooms,
    getWss: () => wss,
    resolveXboxGamertag,
    pollSteamPresenceBatch,
    pollTwitchPresenceBatch,
    pollXboxPresenceOne,
    STEAM_API_KEY,
    TWITCH_CLIENT_ID,
    OPENXBL_API_KEY,
  });

  await app.register(geoRoutes, { authFromHeader });

  const onAvatarChanged = (userId: string, avatarUrl: string) => {
    for (const sock of wss.clients) {
      const s = sock as Sock;
      if (s.user?.id === userId) {
        s.user.avatar = avatarUrl;
        if (s.roomId) {
          const room = rooms.get(s.roomId);
          if (room) {
            const entry = room.users.get(userId);
            if (entry) (entry as any).avatar = avatarUrl;
            publishState(room);
          }
        }
      }
    }
  };
  await app.register(uploadsRoutes, {
    authFromHeader,
    awardNotoriety,
    canAccessStaff,
    onAvatarChanged,
  });

  await app.register(notorietyRoutes, { authFromHeader, getNotorietyRank, NOTORIETY_RANKS });
  await app.register(crewsRoutes, {
    authFromHeader,
    verifyToken,
    awardNotoriety,
    createNotification,
    rooms,
    fetchReactionsForTargets,
    getNotorietyRank,
  } as any);

  await app.register(invitesRoutes, {
    authFromHeader,
    awardNotoriety,
    getGlobalRole,
    canAssignRoles,
    WEB_URL,
  } as any);
  await app.register(chessRoutes, { authFromHeader });

  await app.register(dmRoutes, {
    authFromHeader,
    resolveUserId,
    fetchReactionsForTargets,
    dmDeliver,
    isUserOnline,
    sendPush,
  } as any);
  await app.register(groupRoutes, {
    authFromHeader,
    resolveUserId,
    dmDeliver,
    isUserOnline,
    sendPush,
    resolveMentions,
    createNotification,
  });

  runFeedWorker();
  setInterval(runFeedWorker, 20 * 60 * 1000);
  setInterval(
    () => {
      void runHelldiversWorker({ getAI, broadcastToLobby, countLobbyActiveUsers });
    },
    10 * 60 * 1000,
  );
  setTimeout(() => {
    void runHelldiversWorker({ getAI, broadcastToLobby, countLobbyActiveUsers });
  }, 30_000);

  await app.register(forumRoutes, {
    authFromHeader,
    getGlobalRole,
    canAccessStaff,
    getLobbyRole,
    resolveMentions,
    createNotification,
  } as any);
  await app.register(forumModRoutes, {
    authFromHeader,
    getGlobalRole,
    canAccessStaff,
    getLobbyRole,
  } as any);
  setInterval(() => {
    void autoModTick();
  }, 60_000);

  const NEWS_FEEDS = [
    {
      url: "https://news.google.com/rss/search?q=site:cbc.ca+when:1d&hl=en-CA&gl=CA&ceid=CA:en",
      category: "canada",
      source: "CBC News",
      icon: "https://www.cbc.ca/favicon.ico",
    },
    {
      url: "https://feeds.bbci.co.uk/news/world/rss.xml",
      category: "world",
      source: "BBC World",
      icon: "https://www.bbc.co.uk/favicon.ico",
    },
    {
      url: "https://feeds.bbci.co.uk/news/technology/rss.xml",
      category: "tech",
      source: "BBC Tech",
      icon: "https://www.bbc.co.uk/favicon.ico",
    },
    {
      url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml",
      category: "science",
      source: "BBC Science",
      icon: "https://www.bbc.co.uk/favicon.ico",
    },
    {
      url: "https://feeds.bbci.co.uk/news/business/rss.xml",
      category: "business",
      source: "BBC Business",
      icon: "https://www.bbc.co.uk/favicon.ico",
    },
    {
      url: "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml",
      category: "entertainment",
      source: "BBC Arts",
      icon: "https://www.bbc.co.uk/favicon.ico",
    },
    {
      url: "https://feeds.bbci.co.uk/sport/rss.xml",
      category: "sports",
      source: "BBC Sport",
      icon: "https://www.bbc.co.uk/favicon.ico",
    },
    {
      url: "https://feeds.bbci.co.uk/news/rss.xml",
      category: "top",
      source: "BBC News",
      icon: "https://www.bbc.co.uk/favicon.ico",
    },
    {
      url: "https://news.google.com/rss/search?q=site:ctvnews.ca+when:1d&hl=en-CA&gl=CA&ceid=CA:en",
      category: "canada",
      source: "CTV News",
      icon: "https://www.ctvnews.ca/favicon.ico",
    },
    {
      url: "https://globalnews.ca/feed/",
      category: "canada",
      source: "Global News",
      icon: "https://globalnews.ca/favicon.ico",
    },
    {
      url: "https://news.google.com/rss?hl=en-CA&gl=CA&ceid=CA:en",
      category: "top",
      source: "Google News",
      icon: "https://news.google.com/favicon.ico",
    },
    {
      url: "https://news.google.com/rss/search?q=canada+when:1d&hl=en-CA&gl=CA&ceid=CA:en",
      category: "canada",
      source: "Google News",
      icon: "https://news.google.com/favicon.ico",
    },
    {
      url: "https://www.eurogamer.net/?format=rss",
      category: "gaming",
      source: "Eurogamer",
      icon: "https://www.eurogamer.net/favicon.ico",
    },
    {
      url: "https://www.polygon.com/rss/index.xml",
      category: "gaming",
      source: "Polygon",
      icon: "https://www.polygon.com/favicon.ico",
    },
    {
      url: "https://kotaku.com/rss",
      category: "gaming",
      source: "Kotaku",
      icon: "https://kotaku.com/favicon.ico",
    },
    {
      url: "https://www.gamespot.com/feeds/news/",
      category: "gaming",
      source: "GameSpot",
      icon: "https://www.gamespot.com/favicon.ico",
    },
    {
      url: "https://news.google.com/rss/search?q=site:ign.com+when:2d&hl=en-US&gl=US&ceid=US:en",
      category: "gaming",
      source: "IGN",
      icon: "https://www.ign.com/favicon.ico",
    },
    {
      url: "https://news.google.com/rss/search?q=%22GTA+6%22+OR+%22Grand+Theft+Auto+VI%22+when:7d&hl=en-US&gl=US&ceid=US:en",
      category: "gaming",
      source: "GTA 6 News",
      icon: "https://news.google.com/favicon.ico",
    },
    {
      url: "https://www.cnbc.com/id/100003114/device/rss/rss.html",
      category: "finance",
      source: "CNBC",
      icon: "https://www.cnbc.com/favicon.ico",
    },
    {
      url: "https://www.marketwatch.com/rss/topstories",
      category: "finance",
      source: "MarketWatch",
      icon: "https://www.marketwatch.com/favicon.ico",
    },
    {
      url: "https://feeds.bloomberg.com/markets/news.rss",
      category: "finance",
      source: "Bloomberg",
      icon: "https://www.bloomberg.com/favicon.ico",
    },
  ];

  async function fetchNewsRss(
    feedUrl: string,
    category: string,
    source: string,
    sourceIcon: string,
  ): Promise<any[]> {
    try {
      const res = await fetch(feedUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; Weered/1.0)" },
      });
      const xml = await res.text();
      const items: any[] = [];
      const itemRx = /<item[^>]*>([\s\S]*?)<\/item>/g;
      const titleRx = /<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/;
      const linkRx = /<link>\s*(?:<!\[CDATA\[)?\s*(https?:\/\/[^<\s]+?)\s*(?:\]\]>)?\s*<\/link>/;
      const dateRx = /<pubDate>(.*?)<\/pubDate>/;
      const descRx = /<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/;
      const imgRx1 = /<media:content[^>]+url=["']([^"']+)["']/;
      const imgRx2 = /<media:thumbnail[^>]+url=["']([^"']+)["']/;
      const imgRx3 = /<enclosure[^>]+url=["']([^"']+)["'][^>]+type=["']image/;
      const imgRx4 = /<img[^>]+src=["']([^"']+)["']/;
      let m: RegExpExecArray | null;
      while ((m = itemRx.exec(xml)) !== null) {
        const block = m[1];
        const title = titleRx.exec(block)?.[1]?.trim();
        const link = linkRx.exec(block)?.[1]?.trim();
        const dateStr = dateRx.exec(block)?.[1];
        const rawDesc = descRx.exec(block)?.[1] || "";
        const desc = rawDesc
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&amp;/g, "&")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&apos;/g, "'")
          .replace(/&#x27;/g, "'")
          .replace(/<[^>]+>/g, " ")
          .replace(/https?:\/\/\S+/g, "")
          .replace(/&nbsp;/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 250);
        const img =
          imgRx4.exec(rawDesc)?.[1] ||
          imgRx1.exec(block)?.[1] ||
          imgRx2.exec(block)?.[1] ||
          imgRx3.exec(block)?.[1] ||
          null;
        if (!title || !link) continue;
        const publishedAt = dateStr ? new Date(dateStr) : new Date();
        items.push({
          guid: `${category}::${link}`,
          url: link,
          title,
          description: desc,
          imageUrl: img,
          source,
          sourceIcon,
          category,
          publishedAt,
          heat: recencyScore(publishedAt),
        });
      }
      return items.slice(0, 20);
    } catch (e) {
      log.warn(`[news] RSS ${feedUrl} failed:`, e);
      return [];
    }
  }

  const newsCache = new Map<string, { articles: any[]; cachedAt: number }>();
  const NEWS_CACHE_TTL = 5 * 60 * 1000;

  async function runNewsWorker() {
    log.log("[news] worker starting fetch...");
    try {
      const results = await Promise.allSettled(
        NEWS_FEEDS.map((f) => fetchNewsRss(f.url, f.category, f.source, f.icon)),
      );
      const all = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
      const seen = new Set<string>();
      const deduped = all.filter((a) => {
        if (!a.guid || seen.has(a.guid)) return false;
        seen.add(a.guid);
        return true;
      });

      let upserted = 0;
      for (const a of deduped) {
        try {
          await prisma.newsArticle.upsert({
            where: { guid: a.guid },
            update: {
              heat: a.heat,
              title: a.title,
              description: a.description,
              imageUrl: a.imageUrl,
            },
            create: a,
          });
          upserted++;
        } catch (e) {
          swallow(e);
        }
      }

      await prisma.newsArticle.deleteMany({
        where: { publishedAt: { lt: new Date(Date.now() - 72 * 3600 * 1000) } },
      });

      newsCache.clear();
      log.log(`[news] worker done: ${upserted} upserted from ${deduped.length} articles`);
    } catch (e) {
      log.error("[news] worker error:", e);
    }
  }

  await app.register(newsRoutes);

  const annDb = prisma as any;

  (async () => {
    try {
      const count = await annDb.announcement.count();
      if (count === 0) {
        await annDb.announcement.create({
          data: {
            message:
              "Early access build — things may break. Report bugs in the Forum. New features ship daily. Type @operator in any chat for help.",
            level: "info",
            pinned: true,
            sticky: true,
            createdById: "system",
            createdByName: "Weered",
          },
        });
      }
    } catch (e) {
      log.warn("[announcements] seed:", e);
    }
  })();

  await app.register(desktopRoutes, {} as any);

  await app.register(youtubeRoutes);

  await app.register(aiRoutes, { authFromHeader, isAIAvailable, getAI, rooms });

  runNewsWorker();
  setInterval(runNewsWorker, 15 * 60 * 1000);

  await seedLobbies();

  await app.register(modsRoutes, { verifyToken });

  wss = new WebSocketServer({ port: WS_PORT, maxPayload: 256 * 1024 });
  setRoomStateDeps({ wss, isAIAvailable });
  setPokerTableDeps({ wss, broadcastToLobby });
  setNotorietyDeps({ wss, createNotification });
  setNotificationsWss(wss);
  setPresenceWss(wss);
  startPresencePolling();
  app.log.info(`WS listening on ws://127.0.0.1:${WS_PORT}`);

  // 30s heartbeat: ping every client, terminate any that didn't pong since the
  // previous tick. Reaps stale half-open sockets that otherwise tax all the
  // wss.clients-iterating fanout sites. Browsers/ws auto-reply to ping.
  const wsHeartbeat = setInterval(() => {
    for (const c of wss.clients) {
      const s = c as any;
      if (s.isAlive === false) {
        try {
          s.terminate();
        } catch (e) {
          swallow(e);
        }
        continue;
      }
      s.isAlive = false;
      try {
        s.ping();
      } catch (e) {
        swallow(e);
      }
    }
  }, 30000);
  wss.on("close", () => clearInterval(wsHeartbeat));

  wss.on("connection", (rawWs) => {
    const ws = rawWs as Sock;
    (ws as any).isAlive = true;
    ws.on("pong", () => {
      (ws as any).isAlive = true;
    });

    ws.on("message", (raw) => {
      (async () => {
        const msg = safeJson(raw);
        if (!msg || typeof msg.type !== "string") return;

        if (msg.type === "auth:hello") {
          await handleAuthHello(ws, msg, {
            verifyToken,
            hydrateGlobalRole,
            isGloballyBanned,
            send,
            awardNotoriety,
            wss,
          });
          return;
        }

        if (!ws.user) {
          send(ws, { type: "auth:fail", reason: "Not authenticated" });
          return;
        }

        if (
          msg.type === "rooms:list" ||
          msg.type === "lobby:rooms" ||
          msg.type === "room:list" ||
          msg.type === "presence:join" ||
          msg.type === "presence:idle" ||
          msg.type === "presence:leave"
        ) {
          await handlePresence(ws, msg, {
            rooms,
            send,
            broadcast,
            normalizeRoomId,
            ensureRoomLoaded,
            isModOrOwner,
            doJoin,
            publishState,
            leaveRoom,
          });
          return;
        }

        if (typeof msg.type === "string" && msg.type.startsWith("chat:")) {
          await handleChat(ws, msg, {
            normalizeRoomId,
            ensureRoomLoaded,
            rooms,
            send,
            broadcast,
            isModOrOwner,
            checkUrlSpam,
            checkChatRateLimit,
            roleOf,
            awardNotoriety,
            resolveMentions,
            createNotification,
            getAI,
            buildOperatorSystemPrompt,
          });
          return;
        }

        if (
          msg.type === "launch:set" ||
          msg.type === "launch:clear" ||
          msg.type === "launch:slot" ||
          msg.type === "launch:ready" ||
          msg.type === "launch:fire" ||
          msg.type === "launch:abort"
        ) {
          handleLaunch(ws, msg, {
            rooms,
            ensureLaunch,
            isOwner,
            isElevatedGlobal,
            broadcastLaunch,
          });
          return;
        }

        if (handleCanvas(ws, msg, { normalizeRoomId, rooms, broadcast, isModOrOwner, send }))
          return;

        if (typeof msg.type === "string" && msg.type.startsWith("voice:")) {
          handleVoice(ws, msg, { broadcast, send, normalizeRoomId, rooms, isModOrOwner });
          return;
        }
        if (msg.type === "room:close") {
          await handleRoomClose(ws, msg, {
            normalizeRoomId,
            rooms,
            isModOrOwner,
            send,
            globalAudit,
          });
          return;
        }
        if (msg.type === "reaction:toggle") {
          // reaction:toggle runs several prisma queries; cap per-socket so one
          // connection can't amplify DB load (20 per 5s >> any human cadence).
          const rxNow = Date.now();
          const rx = ((ws as any)._rx || []).filter((t: number) => rxNow - t < 5000);
          if (rx.length >= 20) return;
          rx.push(rxNow);
          (ws as any)._rx = rx;
          await handleReactionToggle(ws, msg, {
            normalizeRoomId,
            ensureRoomLoaded,
            send,
            broadcast,
          });
          return;
        }

        const isCrewOrDm =
          typeof msg.type === "string" &&
          (msg.type.startsWith("crew:") || msg.type.startsWith("dm:"));
        const roomId = normalizeRoomId(String(msg.roomId || ws.roomId || ws.pendingRoomId || ""));
        if (!roomId && !isCrewOrDm) return;
        const room = roomId ? await ensureRoomLoaded(roomId) : (null as unknown as RoomState);

        const actorId = ws.user.id;
        const actorName = ws.user.name;
        const actorGlobalRole = ws.user.globalRole || "USER";
        const actorIsMod = roomId ? isModOrOwner(room, actorId, actorGlobalRole) : false;
        const actorIsOwner = roomId
          ? isOwner(room, actorId) || isElevatedGlobal(actorGlobalRole)
          : false;

        if (isCrewOrDm) {
          await handleCrewDm(ws, msg, {
            checkUrlSpam,
            checkChatRateLimit,
            createNotification,
            dmDeliver,
            isUserOnline,
            resolveMentions,
            resolveUserId,
            send,
            sendPush,
            toggleReactionOnTarget,
            awardNotoriety,
            wss,
          });
          return;
        }

        if (
          msg.type === "room:getAdminState" ||
          msg.type === "room:rename" ||
          msg.type === "room:lock" ||
          msg.type === "room:unlock" ||
          msg.type === "room:admit" ||
          msg.type === "room:deny" ||
          msg.type === "staff:kick" ||
          msg.type === "mod:mute" ||
          msg.type === "mod:unmute" ||
          msg.type === "mod:kick" ||
          msg.type === "mod:ban" ||
          msg.type === "mod:unban" ||
          msg.type === "mod:promote" ||
          msg.type === "mod:demote"
        ) {
          await handleRoomMod(
            ws,
            msg,
            { room, roomId, actorId, actorName, actorIsMod, actorIsOwner },
            {
              publishState,
              broadcast,
              persistRoomBasics,
              audit,
              removeKnock,
              removePending,
              doJoin,
              send,
              getGlobalRole,
              canAccessStaff,
              findSocketsByUser,
              isOwner,
              rooms,
              wss,
            },
          );
          return;
        }

        if (typeof msg.type === "string" && msg.type.startsWith("youtube:")) {
          handleYoutube(ws, msg, { room, roomId }, { send });
          return;
        }

        if (handleCanvasRelay(ws, msg, { room, roomId }, { send })) return;

        if (
          msg.type === "poker:join" ||
          msg.type === "poker:spectate" ||
          msg.type === "poker:leave" ||
          msg.type === "poker:start" ||
          msg.type === "poker:action"
        ) {
          await handlePoker(ws, msg, {
            getOrCreatePokerTable,
            broadcastPokerState,
            startPokerHand,
            buildPokerStateForUser,
            advancePokerGame,
            activePlayersInHand,
            activeSeatCount,
            broadcastToPokerTable,
            awardPaper,
            pokerTables,
            send,
          });
          return;
        }
      })().catch((e) => {
        log.error("[ws-dispatcher] async chain threw:", e);
      });
    });

    ws.on("close", () => {
      handleClose(ws, { rooms, isUserOnline, send, leaveRoom, wss });
    });
  });

  await app.register(socialRoutes, {
    authFromHeader,
    verifyToken,
    awardNotoriety,
    createNotification,
    rooms,
  });

  await app.register(usersSearchRoutes, {} as any);

  await app.register(billingRoutes, {
    authFromHeader,
    getGlobalRole,
    canAccessStaff,
    canAssignRoles,
    globalAudit,
    lobbyAdminAccess,
  } as any);

  function broadcastEvent(title: string, startsAt: Date) {
    const timeStr = startsAt.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    const payload = {
      type: "system:broadcast",
      message: `Event: ${title} — ${timeStr}`,
      level: "info",
      from: "Events",
      ts: Date.now(),
    };
    const sent = new Set<string>();
    for (const room of rooms.values()) {
      for (const s of room.sockets) {
        const sid = s.user?.id;
        if (!sid || sent.has(sid)) continue;
        sent.add(sid);
        send(s, payload);
      }
    }
    return sent.size;
  }

  await app.register(eventsRoutes, {
    authFromHeader,
    getGlobalRole,
    canAssignRoles,
    canAccessStaff,
    broadcastEvent,
    globalAudit,
    lobbyAdminAccess,
  } as any);

  await app.register(notificationsRoutes, { authFromHeader, VAPID_PUBLIC, sendPush });

  await app.register(activityRoutes, { authFromHeader });

  await app.register(staffOpsRoutes, {
    authFromHeader,
    getGlobalRole,
    canAccessStaff,
    rooms,
  } as any);

  await app.register(tenorRoutes);
  await app.register(twitchRoutes, { rooms });

  await app.register(mlbRoutes);

  await app.register(pgaRoutes);

  const ytCache: Record<string, { data: any; ts: number }> = {};

  app.get<{ Params: { channelId: string } }>("/youtube/channel/:channelId", async (req, reply) => {
    const { channelId } = req.params;
    if (!/^UC[\w-]{20,}$/.test(channelId))
      return reply.code(400).send({ ok: false, error: "invalid_channel_id" });

    const cached = ytCache[channelId];
    if (cached && Date.now() - cached.ts < 5 * 60 * 1000) return reply.send(cached.data);

    try {
      const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
      const res = await fetch(feedUrl);
      if (!res.ok) return reply.code(502).send({ ok: false, error: "youtube_fetch_failed" });
      const xml = await res.text();

      const entries: any[] = [];
      const entryBlocks = xml.split("<entry>").slice(1);
      for (const block of entryBlocks.slice(0, 20)) {
        const tag = (name: string) => {
          const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
          return m ? m[1].trim() : "";
        };
        const attr = (tagName: string, attrName: string) => {
          const m = block.match(new RegExp(`<${tagName}[^>]*${attrName}="([^"]*)"[^>]*/?>`, "i"));
          return m ? m[1] : "";
        };
        const videoId = tag("yt:videoId");
        if (!videoId) continue;
        entries.push({
          videoId,
          title: tag("title")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&#39;/g, "'")
            .replace(/&quot;/g, '"'),
          published: tag("published"),
          updated: tag("updated"),
          channelName: tag("name"),
          thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
          thumbnailHq: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          views: parseInt(attr("media:statistics", "views") || "0", 10),
          starRating: parseFloat(attr("media:starRating", "average") || "0"),
          description: tag("media:description")
            .slice(0, 300)
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&#39;/g, "'")
            .replace(/&quot;/g, '"'),
        });
      }

      const payload = { ok: true, channelId, videos: entries };
      ytCache[channelId] = { data: payload, ts: Date.now() };
      return reply.send(payload);
    } catch (e) {
      log.error("[youtube rss]", e);
      return reply.code(500).send({ ok: false, error: "youtube_parse_failed" });
    }
  });

  await app.register(bungieRoutes, { authFromHeader, awardNotoriety });
  await app.register(eveRoutes, { authFromHeader, awardNotoriety });
  await app.register(poeRoutes, { authFromHeader, awardNotoriety });
  await app.register(chatMediaRoutes, {
    authFromHeader,
    isStaff: isElevatedGlobal,
    createNotification,
  });
  await app.register(mcRoutes, { authFromHeader });

  if (process.env.BUNGIE_API_KEY) {
    syncManifest(process.env.BUNGIE_API_KEY)
      .then((r) => {
        log.log(`[manifest] Startup sync: ${r.ok ? "OK" : "FAILED"} — v${r.version}`, r.counts);
      })
      .catch((e) => log.error("[manifest] Startup sync error:", e));
  }

  await app.register(challengesRoutes, {
    authFromHeader,
    getGlobalRole,
    canAccessStaff,
    getLobbyRole,
  });

  await app.register(badgesRoutes, { authFromHeader });
  await app.register(tournamentsRoutes, {
    authFromHeader,
    awardNotoriety,
    awardPaper,
    createNotification,
    getGlobalRole,
    canAccessStaff,
    getLobbyRole,
    onTournamentMatchLive: (mid: string) =>
      (globalThis as any).__weeredAutoDetect?.onMatchLive(mid),
  } as any);
  await app.register(flairContestsRoutes, {
    authFromHeader,
    awardNotoriety,
    getGlobalRole,
    canAccessStaff,
    getLobbyRole,
    broadcastToLobby,
    createNotification,
  } as any);
  await app.register(flairRoutes, { authFromHeader, getGlobalRole, canAccessStaff } as any);

  await app.register(leagueRoutes);

  await app.register(fortniteRoutes, { authFromHeader, sendPush });
  await app.register(scryfallRoutes, {});
  await app.register(mtgRoutes, {});

  await app.register(pubgRoutes);

  await app.register(windroseRoutes, {
    authFromHeader,
    sendPush,
    awardPaper,
    isAIAvailable,
    getAI,
    broadcastToLobby,
  });
  await app.register((await import("./routes/helldivers")).default, { authFromHeader });
  await app.register(helldiversStratagemsRoutes);
  await app.register(helldiversLoadoutsRoutes, { authFromHeader });
  await app.register(steamRoutes, { authFromHeader, createNotification });
  await app.register(windroseBuildsRoutes, {
    authFromHeader,
    awardNotoriety,
    broadcastToLobby,
    canAccessStaff,
    getGlobalRole,
  } as any);

  await app.register(lfgRoutes, {
    authFromHeader,
    getGlobalRole,
    canAccessStaff,
    broadcastToLobby,
    awardNotoriety,
    createNotification,
  } as any);
  await app.register(redditRoutes);
  await app.register(helldiversMoRoutes, { authFromHeader, awardPaper, awardNotoriety });

  await app.register(paperRoutes, { authFromHeader, awardPaper });

  await app.register(pokerRoutes, {
    authFromHeader,
    pokerTables,
    buildPokerStateForUser,
    broadcastPokerState,
    awardPaper,
  });

  await app.register(storeRoutes, { authFromHeader });

  for (const sym of DEFAULT_SYMBOLS) subscribeBinanceSymbol(sym);

  function broadcastToLobby(lobbyId: string, event: any) {
    for (const sock of wss.clients) {
      const s = sock as Sock;
      if (s.roomId === `lobby:${lobbyId}` || s.roomId === lobbyId) {
        try {
          send(s, event);
        } catch (e) {
          swallow(e);
        }
      }
    }
    try {
      capturePublicActivity(event, { lobbyId });
    } catch (e) {
      swallow(e);
    }
  }
  broadcastToLobbyRef = broadcastToLobby;

  function countLobbyActiveUsers(lobbyId: string): number {
    const uids = new Set<string>();
    for (const sock of wss.clients) {
      const s = sock as Sock;
      if (s.roomId === `lobby:${lobbyId}` || s.roomId === lobbyId) {
        const uid = (s as any).user?.id;
        if (uid) uids.add(uid);
      }
    }
    return uids.size;
  }
  function broadcastToRoom(roomId: string, event: any) {
    for (const sock of wss.clients) {
      const s = sock as Sock;
      if (s.roomId === roomId) {
        try {
          send(s, event);
        } catch (e) {
          swallow(e);
        }
      }
    }
    try {
      capturePublicActivity(event, { roomId });
    } catch (e) {
      swallow(e);
    }
  }

  function notifyUser(userId: string, event: any) {
    for (const sock of wss.clients) {
      if ((sock as any).user?.id === userId) {
        try {
          send(sock, event);
        } catch (e) {
          swallow(e);
        }
      }
    }
  }

  const _operatorLastByLobby = new Map<string, number>();
  async function operatorCommentateOnTrade(lobbyId: string, context: string) {
    if (countLobbyActiveUsers(lobbyId) === 0) return;
    const now = Date.now();
    const last = _operatorLastByLobby.get(lobbyId) || 0;
    if (now - last < 60_000) return;
    _operatorLastByLobby.set(lobbyId, now);
    try {
      const ai = await getAI();
      if (!ai) return;
      const response = await ai.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 80,
        system: `You are "The Operator" — Weered's AI host with a GTA street-smart attitude. You're commenting LIVE on a paper trade in a FakeOut trading lobby. ONE sentence, max 16 words. Witty, never mean, occasional gallows humor. No emojis. No quotes. No hashtags. Speak like a beat reporter at the casino floor. If they made money, give them a nod with attitude. If they lost or averaged down on a loser, ribbing is fair. If the trade is huge, react to size. Never break character.`,
        messages: [{ role: "user", content: context }],
      });
      const reply = (response?.content?.[0]?.text || "").trim();
      if (!reply) return;
      broadcastToLobby(lobbyId, { type: "operator:commentary", body: reply, ts: Date.now() });
    } catch (e) {
      log.error("[operator-trade]", e);
    }
  }

  await app.register(tradingRoutes, {
    authFromHeader,
    awardPaper,
    awardNotoriety,
    livePrices,
    broadcastToLobby,
    notifyUser,
    operatorCommentateOnTrade,
  });

  await app.register(campaignsRoutes, {
    authFromHeader,
    broadcastToLobby,
  });

  await app.register(characterRoutes, {
    authFromHeader,
    getGlobalRole,
    canAccessStaff,
  });

  await app.register(diceRoutes, {
    authFromHeader,
    broadcastToLobby,
  });

  await app.register(mapsRoutes, {
    authFromHeader,
    broadcastToRoom,
  });

  await app.register(supportRoutes, {
    authFromHeader,
    getGlobalRole,
    canAccessStaff,
  } as any);

  await app.register(publicRoutes, {
    rooms,
    applyWindroseReel,
    authFromHeader,
  } as any);

  await app.register(overlayRoutes, {
    rooms,
    verifyToken,
  });

  setupTradingSocket(wss, {
    send,
    safeJson,
    subscribeBinanceSymbol,
    symbolSubscribers,
    livePrices,
  });

  log.log(
    "[trading] Paper trading engine initialized with",
    DEFAULT_SYMBOLS.length,
    "default symbols",
  );

  process.on("SIGINT", async () => {
    for (const [, ws] of binanceSubs) {
      try {
        ws.close();
      } catch (e) {
        swallow(e);
      }
    }
    try {
      await prisma.$disconnect();
    } catch (e) {
      swallow(e);
    }
    process.exit(0);
  });
  const ROOM_TTL_MS = 60 * 60 * 1000;
  const DISSOLUTION_INTERVAL_MS = 5 * 60 * 1000;

  setInterval(() => {
    try {
      seedSyntheticActivity();
    } catch (e) {
      swallow(e);
    }
  }, 32_000);
  for (let i = 0; i < 5; i++) seedSyntheticActivity();

  setInterval(async () => {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [roomId, room] of rooms.entries()) {
      if (room.pinned) continue;
      if (roomId.startsWith("lobby:") || roomId === "lobby" || roomId === "@ops") continue;
      if (room.users.size > 0 || room.sockets.size > 0) continue;
      if (now - room.lastActiveAt < ROOM_TTL_MS) continue;

      toDelete.push(roomId);
    }

    for (const roomId of toDelete) {
      rooms.delete(roomId);
      articleRoomMeta.delete(roomId);
      _lobbyActivityAt.delete(roomId);
      try {
        await prisma.room.delete({ where: { id: roomId } }).catch(swallow);
        await prisma.roomMessage.deleteMany({ where: { roomId } }).catch(swallow);
        await prisma.roomMember.deleteMany({ where: { roomId } }).catch(swallow);
      } catch (e) {
        swallow(e);
      }
      log.log(`[dissolution] Room "${roomId}" dissolved after ${ROOM_TTL_MS / 60000}min empty`);
    }

    if (toDelete.length > 0) {
      log.log(`[dissolution] Cleaned up ${toDelete.length} empty room(s)`);
    }
  }, DISSOLUTION_INTERVAL_MS);

  if (process.env.BUNGIE_API_KEY) {
    setBungieApiKey(process.env.BUNGIE_API_KEY);
    startChallengeWorker(
      prisma,
      awardNotoriety,
      (userId, event) => {
        for (const sock of wss.clients) {
          if ((sock as any).user?.id === userId) {
            send(sock, event);
            startChessWorker(prisma);
            startChessChallengeWorker(prisma, awardNotoriety, awardPaper, broadcastToLobby);
          }
        }
      },
      awardPaper,
      broadcastToLobby,
      createNotification,
    );

    const autoDetect = startTournamentAutoDetect(prisma, {
      notify: (userId, event) => {
        for (const sock of wss.clients) {
          if ((sock as any).user?.id === userId) send(sock, event);
        }
      },
      createNotification,
    });
    (globalThis as any).__weeredAutoDetect = autoDetect;
  }

  startFlairContestTick(prisma, {
    mintFlairItem: mintFlairItemHelper,
    grantFlairToUser: grantFlairToUserHelper,
    createNotification,
    broadcastToLobby,
    intervalMs: 60_000,
  });

  startNexusPoller(prisma);

  try {
    await app.listen({ host: "0.0.0.0", port: HTTP_PORT });
    app.log.info(`HTTP listening at http://127.0.0.1:${HTTP_PORT}`);
  } catch (err) {
    app.log.error({ err }, `FATAL: failed to bind HTTP port ${HTTP_PORT}`);
    process.exit(1);
  }
}

main().catch((err) => {
  log.error(err);
  process.exit(1);
});
