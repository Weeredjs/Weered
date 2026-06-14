import dotenv from "dotenv";
dotenv.config({ override: true });
import nodeHttps from "https";
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
  console.error("[unhandledRejection]", reason);
  try { Sentry.captureException(reason); } catch {}
});
process.on("uncaughtException", (err: any) => {
  console.error("[uncaughtException]", err);
  try { Sentry.captureException(err); Sentry.close(2000).finally(() => process.exit(1)); } catch { process.exit(1); }
});
import Fastify from "fastify";
import { z } from "zod";
import { serializerCompiler, validatorCompiler, jsonSchemaTransform } from "fastify-type-provider-zod";
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
import { mintFlairItem as mintFlairItemHelper, grantFlairToUser as grantFlairToUserHelper } from "./lib/flair";
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
import campaignsRoutes from "./routes/campaigns";
import characterRoutes from "./routes/characters";
import diceRoutes from "./routes/dice";
import mapsRoutes from "./routes/maps";
import supportRoutes from "./routes/support";
import publicRoutes from "./routes/public";
import overlayRoutes from "./routes/overlay";
import { pushActivity, anonymousFor, shouldEmit, seedSyntheticActivity } from "./lib/publicActivity";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { WebSocketServer, WebSocket as WsClient } from "ws";
import type { WebSocket } from "ws";
import { randomUUID, randomBytes, createHmac, timingSafeEqual } from "crypto";
import { PrismaClient, RoomRole, GlobalRole, LobbyRole, ModuleType, Prisma } from "@prisma/client";
import { OAuth2Client } from "google-auth-library";
import { syncManifest, enrichProfile, enrichMilestones, enrichVendorSales, resolveItem, resolveBucket, resolveDamageType, isLoaded as manifestLoaded, manifestVersion, WEAPON_BUCKETS, ARMOR_BUCKETS, ARMOR_STAT_HASHES } from "./manifest";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { latLngToCell, cellToBoundary, gridDisk, getResolution } from "h3-js";
import { join } from "path";
import { startChallengeWorker, setBungieApiKey } from "./challengeWorker";
import { startTournamentAutoDetect } from "./tournamentAutoDetect";
import { startNexusPoller, fetchAndUpsertMod } from "./nexusPoller";
import webpush from "web-push";
import { sendMail, buildVerifyEmail, buildResetEmail } from "./lib/email";

let _anthropicModule: any = null;
let _anthropicLoaded = false;

// Cached SiteConfig flags (aiEnabled, maintenanceMode), refreshed lazily (<=15s)
// so per-request hooks never hammer the DB. registrationOpen is read directly.
let _siteFlags: Record<string, string> = {};
let _siteFlagsAt = 0;
async function getSiteFlags(): Promise<Record<string, string>> {
  const now = Date.now();
  if (now - _siteFlagsAt > 15000) {
    try { _siteFlags = await getAllSiteConfig(); _siteFlagsAt = now; } catch {}
  }
  return _siteFlags;
}

async function getAI(): Promise<any | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  if ((await getSiteFlags()).aiEnabled === "false") return null;
  if (!_anthropicLoaded) {
    _anthropicLoaded = true;
    try {
      _anthropicModule = await import("@anthropic-ai/sdk");
    } catch (e) {
      console.error("[ai] Failed to load @anthropic-ai/sdk:", e);
      _anthropicModule = null;
    }
  }
  if (!_anthropicModule) return null;
  const Cls = _anthropicModule.default || _anthropicModule.Anthropic || _anthropicModule;
  return new Cls({ apiKey: key });
}

function isAIAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY) && _siteFlags.aiEnabled !== "false";
}

import { prisma } from "./lib/prisma";
import { readCookieToken } from "./lib/authCookie";

const JWT_SECRET = (() => {
  const s = process.env.JWT_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "development") return "weered-dev-secret";
  throw new Error("FATAL: JWT_SECRET is not set — refusing to start with a default secret.");
})();

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY  || "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT     || "mailto:support@weered.ca";
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}
const HTTP_PORT = Number(process.env.PORT || 4000);
const WS_PORT = Number(process.env.WS_PORT || 4001);

type AuthedUser = { id: string; name: string; usernameKey?: string; globalRole?: string; tier?: string; avatarColor?: string; avatar?: string };
type Sock = WebSocket & { user?: AuthedUser; roomId?: string; pendingRoomId?: string; joinedRoomId?: string };

type Role = "owner" | "mod" | "member";
type RoomUser = { id: string; name: string; role?: Role; globalRole?: string; tier?: string; avatarColor?: string | null; avatar?: string | null };
type ReactionAgg = { emoji: string; count: number; users: string[] };
type ReplyTo = { id: string; userId: string; userName: string; body: string };
type ChatAttachmentRef = { id: string; url: string; thumbUrl: string; w: number; h: number; trusted: boolean; expiresAt?: string | null };
type ChatMsg = { id: string; user: RoomUser; body: string; ts: number; editedAt?: number; deletedAt?: number; reactions?: ReactionAgg[]; replyTo?: ReplyTo; attachment?: ChatAttachmentRef };
type Knock = { userId: string; name: string; ts: number };

type AuditItem = {
  id: string;
  ts: number;
  type: string;
  actorId: string;
  actorName: string;
  targetId?: string;
  targetName?: string;
  note?: string;
};

type ModuleState = {
  mode: string;
  url?: string;
  channel?: string;
  setBy?: string;
  setAt?: number;
};

type LaunchTarget = {
  appid: number;
  connect: string;
  display: string;
  note?: string;
  setBy: string;
  setAt: number;
};

type LaunchSlot = "player" | "observer";

type LaunchState = {
  target: LaunchTarget | null;
  slots: Map<string, LaunchSlot>;
  ready: Set<string>;
  firedAt: number | null;
  firedBy: string | null;
};

type RoomState = {
  roomId: string;
  name?: string;
  description?: string;
  iconUrl?: string;
  bannerUrl?: string;
  accentColor?: string;
  thumbnail?: string;
  lobbyId?: string;
  users: Map<string, RoomUser>;
  sockets: Set<Sock>;
  msgs: ChatMsg[];
  ownerId?: string;
  mods: Set<string>;
  banned: Set<string>;
  muted: Set<string>;
  locked: boolean;
  knocks: Knock[];
  pending: Map<string, Set<Sock>>;
  audit: AuditItem[];
  activeModule: ModuleState | null;
  ytState: { videoId: string; playing: boolean; position: number; updatedAt: number } | null;
  lastActiveAt: number;
  pinned: boolean;
  isEvent: boolean;
  passwordHash?: string;
  launch?: LaunchState;
  voiceMode?: "OPEN" | "QUEUED" | "LISTEN_ONLY";
  voiceQueue?: Set<string>;
  voiceSpeakers?: Set<string>;
  disabledModules?: string[];
  };

const rooms = new Map<string, RoomState>();
const articleRoomMeta = new Map<string, { name: string; thumbnail?: string }>();
let wss: WebSocketServer;
let broadcastToLobbyRef: ((lobbyId: string, event: any) => void) | undefined;

type Card = { rank: string; suit: string };

type PokerSeat = {
  userId: string;
  name: string;
  chips: number;
  cards: Card[];
  folded: boolean;
  allIn: boolean;
  bet: number;
  seatIndex: number;
};

type SidePot = { amount: number; eligible: number[] };

type PokerPhase = "waiting" | "preflop" | "flop" | "turn" | "river" | "showdown";

type PokerTable = {
  tableId: string;
  seats: (PokerSeat | null)[];
  spectators: Set<string>;
  communityCards: Card[];
  deck: Card[];
  pot: number;
  sidePots: SidePot[];
  currentBet: number;
  dealerIndex: number;
  turnIndex: number;
  phase: PokerPhase;
  blinds: { small: number; big: number };
  minBuyin: number;
  maxBuyin: number;
  lastShowdownResult: any | null;
  lastAction: { userId: string; action: string; amount?: number } | null;
  handInProgress: boolean;
  autoStartTimer: ReturnType<typeof setTimeout> | null;
};

const pokerTables = new Map<string, PokerTable>();

const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const SUITS: ("h" | "d" | "c" | "s")[] = ["h", "d", "c", "s"];

function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return shuffleDeck(deck);
}

function shuffleDeck(deck: Card[]): Card[] {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function rankValue(r: string): number {
  const idx = RANKS.indexOf(r);
  return idx >= 0 ? idx + 2 : 0;
}

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const result: T[][] = [];
  const first = arr[0];
  const rest = arr.slice(1);
  for (const combo of combinations(rest, k - 1)) {
    result.push([first, ...combo]);
  }
  for (const combo of combinations(rest, k)) {
    result.push(combo);
  }
  return result;
}

function evaluate5(cards: Card[]): { rank: number; name: string; kickers: number[]; best: Card[] } {
  const vals = cards.map(c => rankValue(c.rank)).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);

  const isFlush = suits.every(s => s === suits[0]);

  let isStraight = false;
  let straightHigh = 0;
  if (vals[0] - vals[4] === 4 && new Set(vals).size === 5) {
    isStraight = true;
    straightHigh = vals[0];
  }
  if (vals[0] === 14 && vals[1] === 5 && vals[2] === 4 && vals[3] === 3 && vals[4] === 2) {
    isStraight = true;
    straightHigh = 5;
  }

  const counts = new Map<number, number>();
  for (const v of vals) counts.set(v, (counts.get(v) || 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);

  if (isStraight && isFlush) {
    return { rank: 8, name: straightHigh === 14 ? "Royal Flush" : "Straight Flush", kickers: [straightHigh], best: cards };
  }
  if (groups[0][1] === 4) {
    const quad = groups[0][0];
    const kicker = groups[1][0];
    return { rank: 7, name: "Four of a Kind", kickers: [quad, kicker], best: cards };
  }
  if (groups[0][1] === 3 && groups[1][1] === 2) {
    return { rank: 6, name: "Full House", kickers: [groups[0][0], groups[1][0]], best: cards };
  }
  if (isFlush) {
    return { rank: 5, name: "Flush", kickers: vals, best: cards };
  }
  if (isStraight) {
    return { rank: 4, name: "Straight", kickers: [straightHigh], best: cards };
  }
  if (groups[0][1] === 3) {
    const trip = groups[0][0];
    const kickers = vals.filter(v => v !== trip);
    return { rank: 3, name: "Three of a Kind", kickers: [trip, ...kickers], best: cards };
  }
  if (groups[0][1] === 2 && groups[1][1] === 2) {
    const high = Math.max(groups[0][0], groups[1][0]);
    const low = Math.min(groups[0][0], groups[1][0]);
    const kicker = groups[2][0];
    return { rank: 2, name: "Two Pair", kickers: [high, low, kicker], best: cards };
  }
  if (groups[0][1] === 2) {
    const pair = groups[0][0];
    const kickers = vals.filter(v => v !== pair);
    return { rank: 1, name: "Pair", kickers: [pair, ...kickers], best: cards };
  }
  return { rank: 0, name: "High Card", kickers: vals, best: cards };
}

function evaluateHand(cards: Card[]): { rank: number; name: string; best: Card[] ; kickers: number[] } {
  let bestResult: { rank: number; name: string; best: Card[]; kickers: number[] } | null = null;

  const combos = combinations(cards, 5);
  for (const combo of combos) {
    const result = evaluate5(combo);
    if (!bestResult || compareHands(result, bestResult) > 0) {
      bestResult = result;
    }
  }

  return bestResult!;
}

function compareHands(a: { rank: number; kickers: number[] }, b: { rank: number; kickers: number[] }): number {
  if (a.rank !== b.rank) return a.rank > b.rank ? 1 : -1;
  for (let i = 0; i < Math.max(a.kickers.length, b.kickers.length); i++) {
    const ak = a.kickers[i] ?? 0;
    const bk = b.kickers[i] ?? 0;
    if (ak !== bk) return ak > bk ? 1 : -1;
  }
  return 0;
}

function determineWinners(seats: (PokerSeat | null)[], communityCards: Card[]): number[] {
  let bestEval: { rank: number; kickers: number[] } | null = null;
  let winnerIndices: number[] = [];

  for (let i = 0; i < seats.length; i++) {
    const seat = seats[i];
    if (!seat || seat.folded) continue;
    const allCards = [...seat.cards, ...communityCards];
    if (allCards.length < 5) continue;
    const ev = evaluateHand(allCards);
    if (!bestEval) {
      bestEval = ev;
      winnerIndices = [i];
    } else {
      const cmp = compareHands(ev, bestEval);
      if (cmp > 0) {
        bestEval = ev;
        winnerIndices = [i];
      } else if (cmp === 0) {
        winnerIndices.push(i);
      }
    }
  }

  return winnerIndices;
}

function getOrCreatePokerTable(tableId: string): PokerTable {
  let table = pokerTables.get(tableId);
  if (!table) {
    table = {
      tableId,
      seats: new Array(6).fill(null),
      spectators: new Set(),
      communityCards: [],
      deck: [],
      pot: 0,
      sidePots: [],
      currentBet: 0,
      dealerIndex: 0,
      turnIndex: -1,
      phase: "waiting" as PokerPhase,
      blinds: { small: 5, big: 10 },
      minBuyin: 200,
      maxBuyin: 2000,
      lastShowdownResult: null,
      lastAction: null,
      handInProgress: false,
      autoStartTimer: null,
    };
    pokerTables.set(tableId, table);
  }
  return table;
}

function activeSeatCount(table: PokerTable): number {
  return table.seats.filter(s => s !== null).length;
}

function activePlayersInHand(table: PokerTable): PokerSeat[] {
  return table.seats.filter(s => s !== null && !s.folded) as PokerSeat[];
}

function nextActiveIndex(table: PokerTable, fromIndex: number): number {
  for (let i = 1; i <= 6; i++) {
    const idx = (fromIndex + i) % 6;
    const seat = table.seats[idx];
    if (seat && !seat.folded && !seat.allIn) return idx;
  }
  return -1;
}

function nextOccupiedIndex(table: PokerTable, fromIndex: number): number {
  for (let i = 1; i <= 6; i++) {
    const idx = (fromIndex + i) % 6;
    if (table.seats[idx]) return idx;
  }
  return -1;
}

function resetForNewHand(table: PokerTable) {
  table.communityCards = [];
  table.deck = createDeck();
  table.pot = 0;
  table.sidePots = [];
  table.currentBet = 0;
  table.turnIndex = -1;
  table.lastShowdownResult = null;
  table.handInProgress = false;
  for (const seat of table.seats) {
    if (seat) {
      seat.cards = [];
      seat.folded = false;
      seat.allIn = false;
      seat.bet = 0;
    }
  }
}

function buildPokerStateForUser(table: PokerTable, userId?: string): any {
  const isShowdown = table.phase === "showdown";
  return {
    tableId: table.tableId,
    seats: table.seats.map((s, i) => {
      if (!s) return null;
      const isMe = userId && s.userId === userId;
      return {
        seatIndex: i,
        userId: s.userId,
        name: s.name,
        chips: s.chips,
        folded: s.folded,
        allIn: s.allIn,
        bet: s.bet,
        cards: (isMe || (isShowdown && !s.folded)) ? s.cards : s.cards.map(() => ({ rank: "?", suit: "?" })),
      };
    }),
    communityCards: table.communityCards,
    pot: table.pot,
    sidePots: table.sidePots,
    currentBet: table.currentBet,
    dealerIndex: table.dealerIndex,
    turnIndex: table.turnIndex,
    phase: table.phase,
    blinds: table.blinds,
    minBuyin: table.minBuyin,
    maxBuyin: table.maxBuyin,
    lastShowdownResult: table.lastShowdownResult,
    lastAction: table.lastAction,
  };
}

function broadcastToPokerTable(tableId: string, event: any) {
  const table = pokerTables.get(tableId);
  if (!table) return;
  for (const sock of wss.clients) {
    const su = (sock as any).user as AuthedUser | undefined;
    if (!su) continue;
    const isSeated = table.seats.some(s => s && s.userId === su.id);
    const isSpectator = table.spectators.has(su.id);
    if (isSeated || isSpectator) {
      try { send(sock as any, event); } catch {}
    }
  }
}

function broadcastPokerState(tableId: string) {
  const table = pokerTables.get(tableId);
  if (!table) return;

  for (const sock of wss.clients) {
    const su = (sock as any).user as AuthedUser | undefined;
    if (!su) continue;
    const isSeated = table.seats.some(s => s && s.userId === su.id);
    const isSpectator = table.spectators.has(su.id);
    if (isSeated || isSpectator) {
      send(sock as any, {
        type: "poker:state",
        ...buildPokerStateForUser(table, su.id),
      });
    }
  }
}

function collectBetsIntoPot(table: PokerTable) {
  for (const seat of table.seats) {
    if (seat) {
      table.pot += seat.bet;
      seat.bet = 0;
    }
  }
  table.currentBet = 0;
}

function buildSidePots(table: PokerTable): SidePot[] {
  const activeBets: { seatIndex: number; totalBet: number }[] = [];
  for (let i = 0; i < table.seats.length; i++) {
    const s = table.seats[i];
    if (s && !s.folded) {
      activeBets.push({ seatIndex: i, totalBet: s.bet });
    }
  }
  if (activeBets.length === 0) return [];

  activeBets.sort((a, b) => a.totalBet - b.totalBet);
  const pots: SidePot[] = [];
  let prevBet = 0;

  for (let i = 0; i < activeBets.length; i++) {
    const bet = activeBets[i].totalBet;
    if (bet > prevBet) {
      const contrib = bet - prevBet;
      const eligible = activeBets.filter((_, j) => j >= i).map(b => b.seatIndex);
      const amount = contrib * (activeBets.length - i);
      for (const seat of table.seats) {
        if (seat && seat.folded && seat.bet > prevBet) {
          const foldedContrib = Math.min(seat.bet - prevBet, contrib);
        }
      }
      pots.push({ amount, eligible });
      prevBet = bet;
    }
  }

  return pots;
}

function dealCommunityCards(table: PokerTable, count: number) {
  for (let i = 0; i < count; i++) {
    const card = table.deck.pop();
    if (card) table.communityCards.push(card);
  }
}

function isBettingRoundComplete(table: PokerTable): boolean {
  const active = table.seats.filter(s => s && !s.folded && !s.allIn) as PokerSeat[];
  if (active.length === 0) return true;
  if (active.length === 1 && table.currentBet === 0) return true;
  return active.every(s => s.bet === table.currentBet);
}

function advancePokerGame(table: PokerTable) {
  const activePlayers = activePlayersInHand(table);

  if (activePlayers.length === 1) {
    collectBetsIntoPot(table);
    const winner = activePlayers[0];
    const wonAmount = table.pot;
    winner.chips += wonAmount;
    table.lastShowdownResult = {
      winners: [{ seatIndex: winner.seatIndex, name: winner.name, chips: wonAmount, hand: null }],
      pot: wonAmount,
    };
    table.pot = 0;
    table.phase = "showdown";
    table.handInProgress = false;
    broadcastPokerState(table.tableId);
    broadcastToLobbyRef?.("poker", { type: "poker:pot-won", userId: winner.userId, userName: winner.name, amount: wonAmount });
    broadcastToPokerTable(table.tableId, {
      type: "poker:winner-chip",
      tableId: table.tableId,
      winners: [{ userId: winner.userId, userName: winner.name, amount: wonAmount, hand: null }],
      pot: wonAmount,
      reason: "fold",
      time: Date.now(),
    });
    scheduleAutoStart(table);
    return;
  }

  const canAct = table.seats.filter(s => s && !s.folded && !s.allIn) as PokerSeat[];
  if (canAct.length <= 1) {
    collectBetsIntoPot(table);
    while (table.communityCards.length < 5) {
      dealCommunityCards(table, 1);
    }
    resolveShowdown(table);
    return;
  }

  if (isBettingRoundComplete(table)) {
    collectBetsIntoPot(table);

    if (table.phase === "preflop") {
      table.phase = "flop";
      dealCommunityCards(table, 3);
    } else if (table.phase === "flop") {
      table.phase = "turn";
      dealCommunityCards(table, 1);
    } else if (table.phase === "turn") {
      table.phase = "river";
      dealCommunityCards(table, 1);
    } else if (table.phase === "river") {
      resolveShowdown(table);
      return;
    }

    table.currentBet = 0;
    for (const seat of table.seats) {
      if (seat) seat.bet = 0;
    }
    table.turnIndex = nextActiveIndex(table, table.dealerIndex);
    broadcastPokerState(table.tableId);
    return;
  }

  table.turnIndex = nextActiveIndex(table, table.turnIndex);
  broadcastPokerState(table.tableId);
}

async function resolveShowdown(table: PokerTable) {
  table.phase = "showdown";

  const winnerIndices = determineWinners(table.seats, table.communityCards);
  const share = Math.floor(table.pot / winnerIndices.length);
  const remainder = table.pot - share * winnerIndices.length;

  const winners: any[] = [];
  for (let i = 0; i < winnerIndices.length; i++) {
    const idx = winnerIndices[i];
    const seat = table.seats[idx]!;
    const payout = share + (i === 0 ? remainder : 0);
    seat.chips += payout;
    const handEval = evaluateHand([...seat.cards, ...table.communityCards]);
    winners.push({
      seatIndex: idx,
      name: seat.name,
      chips: payout,
      hand: handEval.name,
      bestCards: handEval.best,
    });
    broadcastToLobbyRef?.("poker", { type: "poker:pot-won", userId: seat.userId, userName: seat.name, amount: payout });
  }

  const totalPot = table.pot;
  table.lastShowdownResult = { winners, pot: totalPot };
  table.pot = 0;
  table.handInProgress = false;
  broadcastPokerState(table.tableId);
  broadcastToPokerTable(table.tableId, {
    type: "poker:winner-chip",
    tableId: table.tableId,
    winners: winners.map(w => ({
      userId: (table.seats[w.seatIndex] as any)?.userId,
      userName: w.name,
      amount: w.chips,
      hand: w.hand,
    })),
    pot: totalPot,
    reason: "showdown",
    time: Date.now(),
  });
  scheduleAutoStart(table);
}

function scheduleAutoStart(table: PokerTable) {
  if (table.autoStartTimer) clearTimeout(table.autoStartTimer);
  table.autoStartTimer = setTimeout(() => {
    table.autoStartTimer = null;
    for (let i = 0; i < table.seats.length; i++) {
      const s = table.seats[i];
      if (s && s.chips <= 0) {
        table.seats[i] = null;
      }
    }
    if (activeSeatCount(table) >= 2) {
      startPokerHand(table);
    } else {
      table.phase = "waiting";
      broadcastPokerState(table.tableId);
    }
  }, 5000);
}

function startPokerHand(table: PokerTable) {
  if (activeSeatCount(table) < 2) return;

  resetForNewHand(table);
  table.handInProgress = true;

  table.dealerIndex = nextOccupiedIndex(table, table.dealerIndex);

  const sbIndex = nextOccupiedIndex(table, table.dealerIndex);
  const bbIndex = nextOccupiedIndex(table, sbIndex);

  const sbSeat = table.seats[sbIndex]!;
  const bbSeat = table.seats[bbIndex]!;

  const sbAmount = Math.min(table.blinds.small, sbSeat.chips);
  sbSeat.chips -= sbAmount;
  sbSeat.bet = sbAmount;
  if (sbSeat.chips === 0) sbSeat.allIn = true;

  const bbAmount = Math.min(table.blinds.big, bbSeat.chips);
  bbSeat.chips -= bbAmount;
  bbSeat.bet = bbAmount;
  if (bbSeat.chips === 0) bbSeat.allIn = true;

  table.currentBet = bbAmount;

  for (let round = 0; round < 2; round++) {
    for (let i = 0; i < 6; i++) {
      const seat = table.seats[i];
      if (seat) {
        const card = table.deck.pop();
        if (card) seat.cards.push(card);
      }
    }
  }

  table.phase = "preflop";
  table.turnIndex = nextActiveIndex(table, bbIndex);
  if (table.turnIndex === -1) {
    collectBetsIntoPot(table);
    while (table.communityCards.length < 5) dealCommunityCards(table, 1);
    resolveShowdown(table);
    return;
  }
  broadcastPokerState(table.tableId);
}

async function getGlobalRole(userId: string): Promise<GlobalRole> {
  try {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { globalRole: true } });
    return u?.globalRole ?? GlobalRole.USER;
  } catch { return GlobalRole.USER; }
}

function canAccessStaff(role: GlobalRole) {
  return role === GlobalRole.SUPPORT || role === GlobalRole.STAFF || role === GlobalRole.ADMIN || role === GlobalRole.GOD;
}

function canAssignRoles(role: GlobalRole) {
  return role === GlobalRole.STAFF || role === GlobalRole.ADMIN || role === GlobalRole.GOD;
}
async function isGloballyBanned(userId: string): Promise<boolean> {
  try {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { banned: true } });
    return u?.banned === true;
  } catch { return false; }
}

async function isNameReserved(name: string, scope: "LOBBY" | "USERNAME" | "BOTH"): Promise<boolean> {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!normalized) return false;
  const match = await (prisma as any).reservedName.findFirst({
    where: {
      name: normalized,
      scope: { in: scope === "BOTH" ? ["BOTH", "LOBBY", "USERNAME"] : ["BOTH", scope] },
    },
  });
  return Boolean(match);
}

async function getLobbyRole(userId: string, lobbyId: string): Promise<LobbyRole | null> {
  try {
    const m = await prisma.lobbyMember.findUnique({ where: { lobbyId_userId: { lobbyId, userId } }, select: { role: true } });
    return m?.role ?? null;
  } catch { return null; }
}

async function canModLobby(userId: string, lobbyId: string, globalRole: GlobalRole): Promise<boolean> {
  if (canAccessStaff(globalRole)) return true;
  const lr = await getLobbyRole(userId, lobbyId);
  return lr === LobbyRole.OWNER || lr === LobbyRole.MOD;
}

const SEED_LOBBIES = [
  { id: "lobby",        name: "The Lobby",    description: "General hangout. Everyone starts here.", keywords: ["lobby","general","home"],              moduleType: ModuleType.FEED,  moduleConfig: { subreddit: "r/all" } },
  { id: "r/all",        name: "r/all",        description: "Reddit firehose. All topics welcome.",   keywords: ["reddit","all","general"],              moduleType: ModuleType.FEED,  moduleConfig: { subreddit: "r/all" } },
  { id: "r/gaming",     name: "r/gaming",     description: "Gamers of all kinds.",                   keywords: ["reddit","gaming","games","gamer"],     moduleType: ModuleType.FEED,  moduleConfig: { subreddit: "r/gaming" } },
  { id: "r/technology", name: "r/technology", description: "Tech news, discussion, builds.",         keywords: ["reddit","tech","technology","coding"],  moduleType: ModuleType.FEED,  moduleConfig: { subreddit: "r/technology" } },
  { id: "destiny2", name: "Destiny 2", description: "Guardians, raids, dungeons, Trials, Gambit, and the Traveler's Light. Live raid races, Bungie API loadouts, LFG for every activity. The unofficial Guardian hub.", keywords: ["destiny", "destiny2", "bungie", "guardian", "warlock", "titan", "hunter", "raid", "crucible", "gambit", "trials", "iron banner", "nightfall", "dungeon"], moduleType: ModuleType.BUNGIE, moduleConfig: { subreddits: ["r/DestinyTheGame", "r/destiny2"], steamAppId: "1085660" }, accentColor: "#f58220", logoUrl: "/brand/lobbies/destiny2-logo.png", bannerUrl: "/brand/lobbies/destiny2-banner.svg", websiteUrl: "https://www.bungie.net" },
  { id: "news", name: "News", description: "Breaking news and headlines from around the world. CBC, BBC, Reuters, and more.", keywords: ["news","breaking","headlines","world","canada","politics","tech","business","science"], moduleType: ModuleType.NEWS, moduleConfig: {}, accentColor: "#DC2626" },
  { id: "fakeout", name: "FakeOut", description: "Paper trade crypto with fake money against real Binance prices. Live candlestick charts, instant orders, public leaderboards. All the thrill, none of the risk.", keywords: ["fakeout","trading","crypto","bitcoin","paper","stocks","market","btc","eth","finance","investing","fake"], moduleType: ModuleType.TRADING, moduleConfig: {}, accentColor: "#F5C518" },
  { id: "dnd", name: "Dungeons & Dragons", description: "The Tavern. Find a party, roll dice, look up spells and monsters, and play at the table. Full SRD compendium, AI NPCs, initiative tracker, and community dice tower.", keywords: ["dnd","dungeons","dragons","d&d","tabletop","ttrpg","rpg","5e","dungeon master","dm","pathfinder","dice","d20","campaign"], moduleType: ModuleType.DND, moduleConfig: { twitchCategory: "Dungeons & Dragons" }, accentColor: "#C4A55A", logoUrl: "/brand/lobbies/dnd-logo.png", bannerUrl: "/brand/lobbies/dnd-banner.png" },
  { id: "mtg", name: "Magic: The Gathering", description: "The kitchen table. Find a Commander pod tonight, brew jank decks, share cube lists, swap stories. Scryfall card lookup, Moxfield deck import, pod LFG for paper and online. Casual first.", keywords: ["mtg","magic","magic the gathering","mtga","mtgo","commander","edh","modern","standard","pioneer","legacy","vintage","pauper","cube","draft","deck","deckbuilder","scryfall","moxfield"], moduleType: ModuleType.MTG, moduleConfig: { twitchCategory: "Magic: The Gathering" }, accentColor: "#9C7C3F", logoUrl: "/brand/lobbies/mtg-logo.png" },
  { id: "poe", name: "Path of Exile", description: "Wraeclast awaits. Live economy dashboard powered by poe.ninja, currency trends, item prices, div cards, gem values, and party finder.", keywords: ["poe","path of exile","exile","wraeclast","arpg","grinding gear","ggg","currency","divine","chaos","mirror","mapping","builds"], moduleType: ModuleType.POE, moduleConfig: { twitchCategory: "Path of Exile" }, accentColor: "#AF6025", logoUrl: null, bannerUrl: null, websiteUrl: "https://www.pathofexile.com" },
  { id: "windrose", name: "Windrose", description: "Age of Piracy survival adventure by Kraken Express. Build, sail, survive. Live Steam player count, dev dispatches, Crew Finder, Captain's Log. The unofficial flagship hub.", keywords: ["windrose","kraken","kraken express","pocketpair","pirate","pirates","age of piracy","survival","souls-like","crosswind","naval","sailing","ship","black flag","co-op","pve"], moduleType: ModuleType.WINDROSE, moduleConfig: { twitchCategory: "Windrose", steamAppId: "3041230", publisher: "Pocketpair", studio: "Kraken Express" }, accentColor: "#b8935a", logoUrl: "/brand/lobbies/windrose-logo-official.png", bannerUrl: "/brand/lobbies/windrose-banner-v2.svg", websiteUrl: "https://playwindrose.com/" },
  { id: "hq", name: "Headquarters", description: "Weered HQ. Reception, Builders Bench, Newcomers, Changelog. Where the platform itself lives.", keywords: ["hq","headquarters","weered","meta"], moduleType: ModuleType.HEADQUARTERS, moduleConfig: {}, accentColor: "#5800E5" },
  { id: "helldivers2", name: "Helldivers 2", description: "Spread Managed Democracy across the galaxy. Live war map, Major Orders, defense campaigns, dispatches, squad finder, loadout sharer. The unofficial Super Earth war room.", keywords: ["helldivers","helldivers2","hd2","democracy","arrowhead","super earth","terminids","automatons","illuminate","stratagem","galactic war","managed democracy"], moduleType: ModuleType.HELLDIVERS2, moduleConfig: { twitchCategory: "Helldivers 2", subreddit: "r/Helldivers", steamAppId: "553850" }, accentColor: "#FFD700", logoUrl: "/brand/lobbies/helldivers2-logo.png", bannerUrl: "/brand/lobbies/helldivers2-banner.png", websiteUrl: "https://www.helldivers.com" },
  { id: "eve", name: "EVE Online", description: "New Eden's capsuleer hub. Link your character with CCP's official ESI for live location, ship, skill training and killboard, plus character/corp lookup and a no-judgement New Pilots lounge for surviving your first 30 days. The unofficial newbro home.", keywords: ["eve","eve online","ccp","capsuleer","new eden","newbro","null sec","nullsec","wormhole","mining","industry","pvp","corp","corporation","alliance","esi"," isk","pilot"], moduleType: ModuleType.EVE, moduleConfig: { twitchCategory: "EVE Online", subreddit: "r/Eve" }, accentColor: "#d4af37", logoUrl: null, bannerUrl: null, websiteUrl: "https://www.eveonline.com" },
  { id: "gta6", name: "GTA 6", description: "The unofficial community hub for Grand Theft Auto VI. Find a crew, build a heist team, post LFG, run voice, and follow the news. Crew finder and player matchmaking for GTA 6 Online — where players actually link up.", keywords: ["gta6","gta 6","gta vi","grand theft auto 6","grand theft auto vi","gta6 crew","gta 6 crew finder","gta 6 lfg","find gta 6 players","gta 6 community","gta 6 online","gta 6 heist team","gta online","vice city","leonida","rockstar"], moduleType: ModuleType.FEED, moduleConfig: { subreddit: "r/GTA6" }, accentColor: "#e84393" },
];

const SEED_ROOMS: { id: string; name: string; description: string; lobbyId: string; defaultModule?: string }[] = [
  { id: "dnd-tavern",    name: "The Tavern",      description: "Pull up a chair. General voice & chat for adventurers, DMs, and spectators alike.",           lobbyId: "dnd" },
  { id: "dnd-table",     name: "Campaign Table",   description: "Open play table — roll initiative, share maps, run encounters. Bring your character sheet.", lobbyId: "dnd" },
  { id: "dnd-workshop",  name: "DM's Workshop",    description: "Behind the screen. Prep sessions, world-building tips, and DM war stories.",                 lobbyId: "dnd" },
  { id: "dnd-forge",     name: "Character Forge",  description: "Build, theorycraft, and show off your characters. Multiclass debates welcome.",              lobbyId: "dnd" },

  { id: "windrose-helm",       name: "The Helm",          description: "General chat for all sailors. Trade tips, brag about storms, talk shop.",              lobbyId: "windrose" },
  { id: "windrose-crew",       name: "Crew Finder",       description: "Looking for 3 for a raid? Need a first mate? Post your flag here.",                    lobbyId: "windrose" },
  { id: "windrose-captains",   name: "Captain's Table",    description: "Voice strategy, PvE routes, soulslite boss tactics, and fleet tactics.",               lobbyId: "windrose" },
  { id: "windrose-tradingpost",name: "Trading Post",      description: "Barter loot, swap maps, and haggle over spoils. No scams, savvy?",                      lobbyId: "windrose" },
  { id: "windrose-log",        name: "Captain's Log",     description: "Screenshots, clips, and stories from the open sea. Drop your best shot.",               lobbyId: "windrose" },
  { id: "windrose-bug-hunters",name: "Bug Hunters",       description: "Repro steps, workarounds, and friendly noise aimed at Kraken Express.",                 lobbyId: "windrose" },

  { id: "destiny2-tower",      name: "The Tower",         description: "General Guardian gathering. Loadouts, roll talk, gunsmith chatter, all welcome.",        lobbyId: "destiny2" },
  { id: "destiny2-lfg-raids",  name: "LFG · Raids",       description: "Looking for fireteams for current and lore raids. Post role, encounter, platform.",    lobbyId: "destiny2" },
  { id: "destiny2-lfg-dungeons",name:"LFG · Dungeons",    description: "Dungeon fireteam finder. Solo flawless attempts welcome to post pre-run planning.",    lobbyId: "destiny2" },
  { id: "destiny2-crucible",   name: "Crucible",          description: "PvP. Trials cards, Comp climbs, Iron Banner lamentations. Pros and scrubs alike.",      lobbyId: "destiny2" },
  { id: "destiny2-vanguard",   name: "Vanguard Intel",    description: "PvE strats. Nightfalls, Onslaught, Exotic Missions. Build-crafting and rotation talk.", lobbyId: "destiny2" },
  { id: "destiny2-gambit",     name: "Gambit Hall",       description: "Gambit is still here. Bank motes, invade, have opinions.",                              lobbyId: "destiny2" },
  { id: "destiny2-gjallarhorn",name: "Gjallarhorn Wing",   description: "Lore, theorycrafting, patch speculation. Any and all non-fireteam discourse.",          lobbyId: "destiny2" },
  { id: "destiny2-clip-vault", name: "Clip Vault",        description: "Best plays, worst deaths, most cursed loadouts. Post the shot.",                         lobbyId: "destiny2" },

  { id: "fakeout-floor",      name: "The Floor",     description: "Main trading chat. Live charts, live trades, live witnesses. Where everyone hangs.", lobbyId: "fakeout", defaultModule: "fakeout" },
  { id: "fakeout-pit",        name: "The Pit",       description: "Hot takes, rapid-fire reactions, daily watchlists. Bring volume.",                    lobbyId: "fakeout", defaultModule: "fakeout" },
  { id: "fakeout-newcomers",  name: "Newcomers",     description: "First time? Start here. Ask anything. Read The Brief. Place your first paper trade with company.", lobbyId: "fakeout" },

  { id: "mtg-library",       name: "The Library",        description: "General chat for planeswalkers. Decks, meta, salt, and 'is this combo good' debates.",                lobbyId: "mtg" },
  { id: "mtg-commander",     name: "Commander Tables",   description: "Find a Commander pod tonight. Paper, Spelltable, MTGO — post your power level, format, and table type.", lobbyId: "mtg" },
  { id: "mtg-brew",          name: "Brew Lab",           description: "Decklists and theorycraft. Drop a Moxfield link, get feedback. Jank welcome, optimization optional.",  lobbyId: "mtg" },
  { id: "mtg-cube",          name: "The Cube",           description: "Drafting and cube curation. Pod-up for online drafts or share your latest 540-card list.",            lobbyId: "mtg" },
  { id: "mtg-going-first",   name: "Going First",        description: "60-card formats. Modern, Pioneer, Standard, Legacy. Tournament prep, meta reads, sideboard talk.",   lobbyId: "mtg" },

  { id: "poe-wraeclast",   name: "Wraeclast",      description: "General PoE chat. League talk, patch reactions, and the eternal 'is this build dead' discourse.", lobbyId: "poe" },
  { id: "poe-trade",       name: "Trade Hall",     description: "Buy, sell, price-check. Currency, items, bulk. Post your shop, no scams.",                        lobbyId: "poe" },
  { id: "poe-builds",      name: "Build Lab",      description: "Theorycraft and PoB pastebins. League-starter debates, min-max math — bring receipts.",        lobbyId: "poe" },
  { id: "poe-atlas",       name: "The Atlas",      description: "Mapping strategy, Atlas trees, juicing, scarabs and sextants. Share your farming setup.",          lobbyId: "poe" },
  { id: "poe-bosses",      name: "Boss Lounge",    description: "Pinnacle carries, deathless attempts, Uber strats. Mageblood not required.",                       lobbyId: "poe" },
  { id: "poe-leaguestart", name: "League Start",   description: "Fresh economy chaos. Day-1 plans, leveling routes, first-target farming. Race the curve.",         lobbyId: "poe" },

  { id: "league-rift",         name: "Summoner's Rift",        description: "General League chat. Champion talk, patch hot takes, the eternal Yasuo discourse.",                  lobbyId: "league-of-legends" },
  { id: "league-lfg-ranked",   name: "LFG · Ranked",           description: "Find a duo for Solo/Duo. Roles played, current rank, server in your post.",                          lobbyId: "league-of-legends" },
  { id: "league-lfg-flex",     name: "LFG · Flex / Clash",     description: "Five-stacks for Flex queue and Clash weekends. Bring friends or steal some.",                        lobbyId: "league-of-legends" },
  { id: "league-aram",         name: "ARAM Den",               description: "For when you can't be bothered with macro. Reroll talk, snowball strats, just bonk.",                lobbyId: "league-of-legends" },
  { id: "league-lab",          name: "Champion Lab",           description: "Theorycraft, off-meta builds, runes that shouldn't work but do. Bring receipts.",                    lobbyId: "league-of-legends" },

  { id: "cs2-lobby",           name: "The Lobby",              description: "General CS2 chat. Patch reactions, meta talk, complaints about the M4. Welcome.",                    lobbyId: "counter-strike-2" },
  { id: "cs2-lfg-premier",     name: "LFG · Premier",          description: "Premier queue partners. Post your CS rating + map preferences.",                                     lobbyId: "counter-strike-2" },
  { id: "cs2-lfg-faceit",      name: "LFG · FACEIT",           description: "FACEIT lobbies. Level + region in post. No ELO snobbery.",                                           lobbyId: "counter-strike-2" },
  { id: "cs2-aim",             name: "Aim Training Grounds",   description: "Routines, aim_botz, Kovaak's, Aim Lab. Share your warmup and your gains.",                           lobbyId: "counter-strike-2" },
  { id: "cs2-demo",            name: "Demo Theater",           description: "Clip review. Drop your demos, get crispy callouts back. Tactical or just funny.",                    lobbyId: "counter-strike-2" },

  { id: "dota-ancient",        name: "The Ancient",            description: "General Dota chat. Patches, Pudge complaints, eternal Aghanim's discourse.",                          lobbyId: "dota-2" },
  { id: "dota-lfg-ranked",     name: "LFG · Ranked",           description: "Stack up. Post your MMR, role queue, region.",                                                       lobbyId: "dota-2" },
  { id: "dota-lfg-turbo",      name: "LFG · Turbo",            description: "Quick games, low commitment. Just queue and click heads.",                                            lobbyId: "dota-2" },
  { id: "dota-lab",            name: "Hero Lab",               description: "Off-meta builds, position 5 carry, the eternal Tinker question. Theorycraft welcome.",                lobbyId: "dota-2" },
  { id: "dota-fountain",       name: "Fountain Hooks",         description: "Best plays, worst feeders, salt mine. Drop your clips.",                                              lobbyId: "dota-2" },

  { id: "pubg-zone",           name: "Drop Zone",              description: "General PUBG chat. Map rotations, the eternal Pochinki nostalgia, server complaints.",                lobbyId: "pubg" },
  { id: "pubg-lfg-squad",      name: "LFG · Squads",           description: "Find your fourth. Server, map preference, voice required in post.",                                   lobbyId: "pubg" },
  { id: "pubg-lfg-duo",        name: "LFG · Duos",             description: "Two-stacks. Less bickering, more headshots.",                                                         lobbyId: "pubg" },
  { id: "pubg-loot",           name: "Loot Pool",              description: "Hot drop strategies, vehicle meta, gear talk. From M4 to Mosin.",                                     lobbyId: "pubg" },
  { id: "pubg-vault",          name: "Clip Vault",             description: "Best plays, worst luck, last circle stories. Post the shot.",                                         lobbyId: "pubg" },

  { id: "mlb-dugout",          name: "The Dugout",             description: "General baseball chat. Standings, trade rumors, the eternal Yankees discourse.",                      lobbyId: "mlb" },
  { id: "mlb-gameday",         name: "Game Day Threads",       description: "Live threads for whatever's on right now. Pitch by pitch, inning by inning.",                          lobbyId: "mlb" },
  { id: "mlb-stats",           name: "Sabermetrics",           description: "WAR, FIP, xwOBA. Numbers people. Bring a CSV.",                                                       lobbyId: "mlb" },
  { id: "mlb-trade",           name: "Trade Talk",             description: "Rumors, deadlines, hot stove takes. Speculation welcome, math appreciated.",                          lobbyId: "mlb" },
  { id: "mlb-prospects",       name: "Prospect Watch",         description: "Minor leagues, draft talk, future stars. Who's coming up next.",                                       lobbyId: "mlb" },

  { id: "fortnite-island",     name: "The Island",             description: "General Fortnite chat. Skin drops, map updates, the eternal sweat-vs-casual debate.",                  lobbyId: "fortnite" },
  { id: "fortnite-lfg-squads", name: "LFG · Squads",           description: "Build squads. Drop region + style (BR / ZB / Reload).",                                              lobbyId: "fortnite" },
  { id: "fortnite-lfg-zb",     name: "LFG · Zero Build",       description: "For the no-build lifers. Pure aim, pure cover, pure pain.",                                          lobbyId: "fortnite" },
  { id: "fortnite-comp",       name: "Comp Corner",            description: "FNCS, cash cups, scrim discussion. Loadout debates, zone reads.",                                     lobbyId: "fortnite" },
  { id: "fortnite-creative",   name: "Creative Lobby",         description: "Map codes, parkour, deathruns, mini-games. Post your favorites.",                                     lobbyId: "fortnite" },

  { id: "gta6-strip",          name: "The Strip",              description: "General GTA 6 chat. News, leaks, hype, Vice City speculation. Everyone starts here.",                lobbyId: "gta6" },
  { id: "gta6-crew-finder",    name: "Crew Finder",            description: "Find a GTA 6 crew or recruit members. Post your crew, your platform, and your playstyle.",            lobbyId: "gta6" },
  { id: "gta6-lfg",            name: "LFG · Find Players",     description: "Looking for GTA 6 players to run with. Post platform, region, mic, and what you're grinding.",        lobbyId: "gta6" },
  { id: "gta6-heists",         name: "Heist Team",             description: "Build a heist crew. Coordinate roles, set up, and find a reliable team for GTA 6 Online jobs.",      lobbyId: "gta6" },
  { id: "gta6-news",           name: "News & Leaks",           description: "Trailers, official drops, dataminer leaks, release-date watch. Sort the real from the fake.",         lobbyId: "gta6" },
  { id: "gta6-clips",          name: "Clip Vault",             description: "Best plays, funniest deaths, cinematic shots. Post the clip.",                                       lobbyId: "gta6" },

  { id: "hq-reception",        name: "Reception",              description: "Welcome to Weered HQ. Platform questions, intros, hi.",                                              lobbyId: "hq" },
  { id: "hq-feedback",         name: "Builder's Bench",        description: "Feature requests, bug reports, why-doesn't-it-do-X. The dev team reads this.",                       lobbyId: "hq" },
  { id: "hq-newcomers",        name: "Newcomers",              description: "First time on Weered? Start here. Ask anything, no judgment.",                                       lobbyId: "hq" },
  { id: "hq-changelog",        name: "Changelog",              description: "What just shipped, what's brewing. Read-only-ish announcements.",                                    lobbyId: "hq" },
  { id: "hq-offtopic",         name: "Off Topic",              description: "Whatever isn't about Weered itself. Lowkey vibes, weekend chat.",                                    lobbyId: "hq" },
];

async function seedLobbies() {
  for (const l of SEED_LOBBIES) {
    try {
      await (prisma as any).lobby.upsert({
        where: { id: l.id },
        update: { pinned: true, moduleType: l.moduleType, moduleConfig: l.moduleConfig as any },
        create:  { id: l.id, name: l.name, description: l.description, pinned: true, verified: true, moduleType: l.moduleType, moduleConfig: l.moduleConfig as any, keywords: l.keywords, accentColor: (l as any).accentColor ?? null, logoUrl: (l as any).logoUrl ?? null, bannerUrl: (l as any).bannerUrl ?? null, websiteUrl: (l as any).websiteUrl ?? null },
      });
    } catch (e) { console.warn("seedLobbies:", l.id, e); }
  }
  console.log("[weered] lobbies seeded");

  for (const r of SEED_ROOMS) {
    try {
      await prisma.room.upsert({
        where: { id: r.id },
        update: { name: r.name, description: r.description, lobbyId: r.lobbyId, pinned: true, ...(r.defaultModule !== undefined ? { defaultModule: r.defaultModule } : {}) },
        create: { id: r.id, name: r.name, description: r.description, lobbyId: r.lobbyId, locked: false, pinned: true, ...(r.defaultModule !== undefined ? { defaultModule: r.defaultModule } : {}) },
      });
    } catch (e) { console.warn("seedRooms:", r.id, e); }
  }
  console.log(`[weered] seeded/updated ${SEED_ROOMS.length} default room(s)`);
}

async function globalAudit(actorId: string, actorName: string, action: string, targetId?: string, targetName?: string, meta?: any) {
  try {
    await prisma.globalAudit.create({
      data: { actorId, actorName, action, targetId: targetId ?? null, targetName: targetName ?? null, meta: meta ?? null },
    });
  } catch {}
}
async function getSiteConfig(key: string): Promise<string | null> {
  const row = await (prisma as any).siteConfig.findUnique({ where: { key } });
  return row?.value ?? null;
}

async function setSiteConfig(key: string, value: string): Promise<void> {
  await (prisma as any).siteConfig.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

async function getAllSiteConfig(): Promise<Record<string, string>> {
  const rows = await (prisma as any).siteConfig.findMany();
  const config: Record<string, string> = {};
  for (const r of rows) config[r.key] = r.value;
  return config;
}

const SITE_CONFIG_DEFAULTS: Record<string, string> = {
  featuredLobbyId: "",
  registrationOpen: "true",
  maintenanceMode: "false",
  aiEnabled: "true",
  defaultTier: "INNOCENT",
  maxRoomsPerLobby: "50",
  chatRateLimit: "30",
};

function makeEmptyRoom(roomId: string): RoomState {
  return {
    roomId, name: "",
    users: new Map(), sockets: new Set(), msgs: [],
    ownerId: undefined, mods: new Set(), banned: new Set(), muted: new Set(),
    locked: false, knocks: [], pending: new Map(), audit: [], activeModule: null, ytState: null, lastActiveAt: Date.now(), pinned: false, isEvent: false,
    voiceMode: "OPEN",
    voiceQueue: new Set<string>(),
    voiceSpeakers: new Set<string>(),
    disabledModules: [],
  };
}

function normalizeRoomId(input: string): string {
  let s = String(input || "").trim();
  for (let i = 0; i < 3; i++) {
    if (s.indexOf("%") === -1) break;
    try { const d = decodeURIComponent(s); if (d === s) break; s = d; } catch { break; }
  }
  return s;
}

async function ensureRoomLoaded(roomId: string): Promise<RoomState> {
  roomId = normalizeRoomId(roomId);
  const cached = rooms.get(roomId);
  if (cached) return cached;

  if (roomId === "lobby") {
    const r = makeEmptyRoom(roomId);
    r.name = "Home Lobby";
    rooms.set(roomId, r);
    return r;
  }

  const dbRoom = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      members: true,
      bans: true,
      messages: { orderBy: { ts: "asc" }, take: 80 },
      audit: { orderBy: { ts: "asc" }, take: 80 },
    },
  });

  const r = makeEmptyRoom(roomId);

  if (!dbRoom) {
    try {
      await prisma.room.create({ data: { id: roomId, name: "", locked: false, ownerId: null } });
    } catch (e: any) {
      if (e?.code !== "P2002") throw e;
    }
  } else {
    r.name = dbRoom.name || "";
    r.description = (dbRoom as any).description || undefined;
    r.iconUrl = (dbRoom as any).iconUrl || undefined;
    r.bannerUrl = (dbRoom as any).bannerUrl || undefined;
    r.accentColor = (dbRoom as any).accentColor || undefined;
    r.locked = Boolean(dbRoom.locked);
    r.pinned = Boolean((dbRoom as any).pinned);
    r.isEvent = Boolean((dbRoom as any).isEvent);
    r.ownerId = dbRoom.ownerId || undefined;
    r.lobbyId = (dbRoom as any).lobbyId || undefined;
    r.passwordHash = (dbRoom as any).passwordHash || undefined;
    (r as any).disabledModules = Array.isArray((dbRoom as any).disabledModules) ? (dbRoom as any).disabledModules : [];
    const vm = String((dbRoom as any).voiceMode || "OPEN").toUpperCase();
    r.voiceMode = (vm === "QUEUED" || vm === "LISTEN_ONLY") ? (vm as any) : "OPEN";
    for (const m of dbRoom.members) { if (m.role === "MOD") r.mods.add(m.userId); }
    for (const b of dbRoom.bans) r.banned.add(b.userId);
    r.msgs = dbRoom.messages.map((m) => ({
      id: m.id, user: { id: m.userId, name: m.userName || "?", role: "member" as Role },
      body: m.body, ts: new Date(m.ts).getTime(),
      editedAt: (m as any).editedAt ? new Date((m as any).editedAt).getTime() : undefined,
      deletedAt: (m as any).deletedAt ? new Date((m as any).deletedAt).getTime() : undefined,
      replyTo: (m as any).replyToId ? {
        id: (m as any).replyToId,
        userId: (m as any).replyToUserId || "",
        userName: (m as any).replyToUserName || "?",
        body: (m as any).replyToBody || "",
      } : undefined,
    }));

    try {
      const msgIds = r.msgs.map(m => m.id);
      if (msgIds.length > 0) {
        const rxRows = await (prisma as any).reaction.findMany({
          where: { targetType: "ROOM_MESSAGE", targetId: { in: msgIds } },
          select: { targetId: true, emoji: true, userId: true },
        });
        const byMsg: Record<string, Record<string, { count: number; users: string[] }>> = {};
        for (const rx of rxRows) {
          if (!byMsg[rx.targetId]) byMsg[rx.targetId] = {};
          if (!byMsg[rx.targetId][rx.emoji]) byMsg[rx.targetId][rx.emoji] = { count: 0, users: [] };
          byMsg[rx.targetId][rx.emoji].count++;
          if (byMsg[rx.targetId][rx.emoji].users.length < 12) byMsg[rx.targetId][rx.emoji].users.push(rx.userId);
        }
        for (const m of r.msgs) {
          const agg = byMsg[m.id];
          if (agg) {
            m.reactions = Object.entries(agg).map(([emoji, v]) => ({ emoji, count: v.count, users: v.users }));
          }
        }
      }
    } catch {}
    r.audit = dbRoom.audit.map((a) => ({
      id: a.id, ts: new Date(a.ts).getTime(), type: a.type,
      actorId: a.actorId, actorName: a.actorName,
      targetId: a.targetId || undefined, note: a.note || undefined,
    }));
  }

  if (!r.name) {
    const meta = articleRoomMeta.get(roomId);
    if (meta) {
      r.name = meta.name;
      if (meta.thumbnail) r.thumbnail = meta.thumbnail;
    } else if (roomId.startsWith("article_")) {
      try {
        const items = await prisma.feedItem.findMany({ orderBy: { fetchedAt: "desc" }, take: 500 });
        for (const item of items) {
          let h = 0;
          for (let i = 0; i < item.url.length; i++) { h = ((h << 5) - h) + item.url.charCodeAt(i); h |= 0; }
          if (`article_${Math.abs(h).toString(36).slice(0, 10)}` === roomId) {
            const shortTitle = item.title.length > 60 ? item.title.slice(0, 57) + "…" : item.title;
            r.name = shortTitle;
            if (item.thumbnail) r.thumbnail = item.thumbnail;
            articleRoomMeta.set(roomId, { name: shortTitle, thumbnail: item.thumbnail ?? undefined });
            break;
          }
        }
      } catch {}
    }
  }

  if (!r.lobbyId) {
    try {
      const isLobby = await prisma.lobby.findUnique({ where: { id: roomId }, select: { id: true } });
      if (isLobby) r.lobbyId = roomId;
    } catch {}
  }

  rooms.set(roomId, r);
  return r;
}

function safeJson(raw: any): any | null {
  try {
    const s = typeof raw === "string" ? raw : raw?.toString?.("utf8");
    if (!s) return null;
    const o = JSON.parse(s);
    if (o && typeof o === "object" && (o as any).payload && typeof (o as any).payload === "object") {
      return { ...(o as any), ...((o as any).payload) };
    }
    return o;
  } catch { return null; }
}

function withPayload(msg: any) {
  try {
    if (!msg || typeof msg !== "object") return msg;
    if ((msg as any).payload) return msg;
    const { type, ...rest } = msg as any;
    if (!type) return msg;
    return { ...(msg as any), payload: rest };
  } catch { return msg; }
}

function send(ws: Sock, msg: any) {
  try { if (ws.readyState === 1) ws.send(JSON.stringify(withPayload(msg))); } catch {}
}

function broadcast(room: RoomState, msg: any) {
  for (const s of room.sockets) send(s, msg);
  // Room occupancy changed: ping everyone so lobby rails refresh on push
  // instead of polling. Tiny payload, throttled to 1/2s per room.
  if (msg && (msg.type === "presence:join" || msg.type === "presence:leave")) {
    const now = Date.now();
    const last = _lobbyActivityAt.get(room.roomId) || 0;
    if (now - last > 2000) {
      _lobbyActivityAt.set(room.roomId, now);
      const ping = JSON.stringify({ type: "lobby:activity", lobbyId: room.lobbyId || null, roomId: room.roomId });
      for (const sock of wss.clients) {
        try { if ((sock as any).readyState === 1) sock.send(ping); } catch {}
      }
    }
  }
}
const _lobbyActivityAt = new Map<string, number>();

function isOwner(room: RoomState, userId?: string) {
  return Boolean(userId && room.ownerId && room.ownerId === userId);
}
function isMod(room: RoomState, userId?: string) {
  return Boolean(userId && room.mods.has(userId));
}
function isElevatedGlobal(globalRole?: string) {
  const r = String(globalRole || "").toUpperCase();
  return r === "GOD" || r === "STAFF" || r === "SUPPORT" || r === "ADMIN";
}
function isModOrOwner(room: RoomState, userId?: string, globalRole?: string) {
  return isElevatedGlobal(globalRole) || isOwner(room, userId) || isMod(room, userId);
}
function roleOf(room: RoomState, userId: string): Role {
  if (isOwner(room, userId)) return "owner";
  if (isMod(room, userId)) return "mod";
  return "member";
}

function ensureLaunch(room: RoomState): LaunchState {
  if (!room.launch) {
    room.launch = { target: null, slots: new Map(), ready: new Set(), firedAt: null, firedBy: null };
  }
  return room.launch;
}

function serializeLaunch(room: RoomState) {
  const l = ensureLaunch(room);
  return {
    target: l.target,
    slots: Array.from(l.slots.entries()).map(([userId, slot]) => ({ userId, slot })),
    ready: Array.from(l.ready.values()),
    firedAt: l.firedAt,
    firedBy: l.firedBy,
  };
}

function broadcastLaunch(room: RoomState) {
  broadcast(room, { type: "launch:state", roomId: room.roomId, launch: serializeLaunch(room) });
}

function audit(room: RoomState, item: Omit<AuditItem, "id" | "ts"> & { ts?: number }) {
  const a: AuditItem = { id: randomUUID(), ts: item.ts ?? Date.now(), ...item };
  room.audit.push(a);
  if (room.audit.length > 300) room.audit.splice(0, room.audit.length - 300);

  if (room.roomId !== "lobby") {
    void prisma.roomAudit.create({
      data: {
        id: a.id, roomId: room.roomId, type: a.type,
        actorId: a.actorId, actorName: a.actorName,
        targetId: a.targetId || null, note: a.note || null, ts: new Date(a.ts),
      },
    }).catch(() => {});
  }

  for (const s of room.sockets) {
    const uid = s.user?.id;
    if (!uid || !isModOrOwner(room, uid)) continue;
    send(s, { type: "room:audit", roomId: room.roomId, item: a });
  }
}

function buildStatePayload(room: RoomState) {
  const roleMap       = new Map<string, string>();
  const colorMap      = new Map<string, string>();
  const avatarMap     = new Map<string, string>();
  const pillBgMap     = new Map<string, string>();
  const pillAccentMap = new Map<string, string>();
  for (const s of room.sockets) {
    if (s.user?.id) {
      if (s.user.globalRole)  roleMap.set(s.user.id, s.user.globalRole);
      if (s.user.avatarColor) colorMap.set(s.user.id, s.user.avatarColor);
      if (s.user.avatar)      avatarMap.set(s.user.id, s.user.avatar);
      if ((s.user as any).pillBgColor) pillBgMap.set(s.user.id, (s.user as any).pillBgColor);
      if ((s.user as any).pillAccentColor) pillAccentMap.set(s.user.id, (s.user as any).pillAccentColor);
    }
  }
  const users = Array.from(room.users.values()).map((u) => ({
    ...u,
    role:        u.id ? roleOf(room, u.id) : "member",
    globalRole:  (u.id ? roleMap.get(u.id) : undefined) ?? (u as any).globalRole ?? "USER",
    avatarColor: (u.id ? colorMap.get(u.id) : undefined) ?? (u as any).avatarColor ?? undefined,
    avatar:      (u.id ? avatarMap.get(u.id) : undefined) ?? (u as any).avatar ?? undefined,
    pillBgColor: (u.id ? pillBgMap.get(u.id) : undefined) ?? (u as any).pillBgColor ?? undefined,
    pillAccentColor: (u.id ? pillAccentMap.get(u.id) : undefined) ?? (u as any).pillAccentColor ?? undefined,
  }));
  if (isAIAvailable()) {
    users.push({
      id: "operator", name: "The Operator", usernameKey: "operator",
      role: "SYSTEM", globalRole: "GOD",
      avatarColor: "#D4A017", avatar: "/brand/roles/operator.svg",
    } as any);
  }
  return {
    type: "presence:state", roomId: room.roomId, name: room.name || room.roomId,
    thumbnail: room.thumbnail || null, lobbyId: room.lobbyId || null,
    description: room.description || "",
    iconUrl: room.iconUrl || null,
    bannerUrl: room.bannerUrl || null,
    accentColor: room.accentColor || null,
    users, count: users.length - (isAIAvailable() ? 1 : 0), locked: Boolean(room.locked),
    ownerId: room.ownerId || "", mods: Array.from(room.mods.values()),
    muted: Array.from(room.muted.values()),
    activeModule: room.activeModule || null,
    disabledModules: Array.isArray((room as any).disabledModules) ? (room as any).disabledModules : [],
    voiceMode: room.voiceMode || "OPEN",
    voiceQueue: Array.from(room.voiceQueue || []),
    voiceSpeakers: Array.from(room.voiceSpeakers || []),
    launch: room.launch ? serializeLaunch(room) : null,
    pinned: Array.from(((room as any).pinned as Set<string> | undefined) || []),
  };
}

function publishStateToSocket(ws: Sock, room: RoomState) {
  send(ws, buildStatePayload(room));
  const uid = ws.user?.id;
  if (uid && isModOrOwner(room, uid, ws.user?.globalRole)) {
    send(ws, {
      type: "room:adminState", roomId: room.roomId, name: room.name || room.roomId,
      locked: Boolean(room.locked), ownerId: room.ownerId || "",
      mods: Array.from(room.mods.values()), knocks: room.knocks.slice(-50),
      banned: Array.from(room.banned.values()), muted: Array.from(room.muted.values()),
      audit: room.audit.slice(-50),
    });
  }
}

function publishState(room: RoomState) {
  const payload = buildStatePayload(room);
  broadcast(room, payload);

  for (const s of room.sockets) {
    const uid = s.user?.id;
    if (!uid || !isModOrOwner(room, uid, s.user?.globalRole)) continue;
    send(s, {
      type: "room:adminState", roomId: room.roomId, name: room.name || room.roomId,
      locked: Boolean(room.locked), ownerId: room.ownerId || "",
      mods: Array.from(room.mods.values()), knocks: room.knocks.slice(-50),
      banned: Array.from(room.banned.values()), muted: Array.from(room.muted.values()),
      audit: room.audit.slice(-50),
    });
  }
}

function leaveRoom(ws: Sock) {
  const roomId = ws.roomId;
  if (!roomId) return;
  const room = rooms.get(roomId);
  if (!room) return;

  room.sockets.delete(ws);
  if (ws.user) {
    let userHasOtherSocket = false;
    for (const s of room.sockets) {
      if (s.user?.id === ws.user.id) { userHasOtherSocket = true; break; }
    }
    if (!userHasOtherSocket) {
      const existed = room.users.delete(ws.user.id);
      if (existed) broadcast(room, { type: "presence:leave", roomId, userId: ws.user.id });
      const userId = ws.user.id;
      const location = (room as any).name || roomId;
      (prisma as any).user.update({
        where: { id: userId },
        data: { lastSeenAt: new Date(), lastSeenLocation: location },
      }).catch(() => {});
      if (room.launch) {
        const hadSlot = room.launch.slots.delete(ws.user.id);
        const hadReady = room.launch.ready.delete(ws.user.id);
        if (hadSlot || hadReady) broadcastLaunch(room);
      }
    }
  }
  ws.roomId = undefined;

  room.lastActiveAt = Date.now();
}
const NOTORIETY_ACTIONS: Record<string, { points: number; once?: boolean; cooldown?: number }> = {
  BIO_COMPLETE:        { points: 50,   once: true  },
  FIRST_ROOM_HOSTED:   { points: 100,  once: true  },
  ROOM_25_USERS:       { points: 250,  once: false },
  SUBREDDIT_LINKED:    { points: 75,   once: true  },
  DAILY_ACTIVE:        { points: 10,   once: false, cooldown: 86400000 },
  CHAT_MESSAGE:        { points: 2,    once: false, cooldown: 30000   },
  ROOM_JOINED:         { points: 5,    once: false, cooldown: 60000   },
  VOICE_JOINED:        { points: 15,   once: false, cooldown: 300000  },
  CHALLENGE_COMPLETED: { points: 200,  once: false, cooldown: 0       },
  FIRST_CHALLENGE:     { points: 100,  once: true                     },
  CREW_CREATED:        { points: 100,  once: true  },
  CREW_JOINED:         { points: 25,   once: false },
  FRIEND_ADDED:        { points: 15,   once: false },
  LOBBY_CREATED:       { points: 200,  once: false },
  AVATAR_SET:          { points: 30,   once: true  },
  BUNGIE_LINKED:       { points: 75,   once: true  },
  FIRST_FAKEOUT_TRADE: { points: 100,  once: true  },
  FAKEOUT_TRADE:       { points: 5,    once: false, cooldown: 60000  },
  FAKEOUT_PROFIT:      { points: 25,   once: false, cooldown: 0      },
  LFG_COMPLETED:       { points: 20,   once: false, cooldown: 600000 },
};

const NOTORIETY_RANKS = [
  { title: "Street Rat",   min: 0    },
  { title: "Corner Boy",   min: 100  },
  { title: "Hustler",      min: 300  },
  { title: "Shot Caller",  min: 500  },
  { title: "Enforcer",     min: 1000 },
  { title: "Made Man",     min: 1500 },
  { title: "Underboss",    min: 3000 },
  { title: "Crime Lord",   min: 5000 },
  { title: "Kingpin",      min: 10000},
];

function getNotorietyRank(n: number): { title: string; min: number; next: { title: string; min: number } | null } {
  let rank = NOTORIETY_RANKS[0];
  for (const r of NOTORIETY_RANKS) {
    if (n >= r.min) rank = r;
  }
  const idx = NOTORIETY_RANKS.indexOf(rank);
  const next = idx < NOTORIETY_RANKS.length - 1 ? NOTORIETY_RANKS[idx + 1] : null;
  return { ...rank, next };
}

const notorietyCooldowns = new Map<string, number>();

async function awardNotoriety(userId: string, action: string): Promise<number | null> {
  const cfg = NOTORIETY_ACTIONS[action];
  if (!cfg) return null;

  try {
    if (cfg.cooldown) {
      const key = `${userId}:${action}`;
      const last = notorietyCooldowns.get(key) || 0;
      if (Date.now() - last < cfg.cooldown) return null;
      notorietyCooldowns.set(key, Date.now());
    }

    if (cfg.once) {
      const existing = await prisma.notorietyEvent.findFirst({
        where: { userId, action },
      });
      
      if (existing) return null;
    }

    const userBefore = await prisma.user.findUnique({ where: { id: userId }, select: { notoriety: true, name: true } });
    const scoreBefore = userBefore?.notoriety || 0;
    const rankBefore = getNotorietyRank(scoreBefore);

    await prisma.$transaction([
      prisma.notorietyEvent.create({ data: { userId, action, points: cfg.points } }),
      prisma.user.update({
        where: { id: userId },
        data: { notoriety: { increment: cfg.points } },
      }),
    ]);

    const scoreAfter = scoreBefore + cfg.points;
    const rankAfter = getNotorietyRank(scoreAfter);

    for (const sock of wss.clients) {
      if ((sock as any).user?.id === userId) {
        send(sock as any, { type: "notoriety:award", action, points: cfg.points });
        if (rankAfter.title !== rankBefore.title) {
          send(sock as any, { type: "notoriety:rankup", oldRank: rankBefore.title, newRank: rankAfter.title, score: scoreAfter });
        }
      }
    }

    if (rankAfter.title !== rankBefore.title) {
      createNotification({
        userId,
        type: "NOTORIETY_RANKUP",
        title: `You are now a ${rankAfter.title}!`,
        body: `Promoted from ${rankBefore.title} at ${scoreAfter.toLocaleString()} notoriety`,
        actionUrl: `/profile/${userId}`,
      }).catch(() => {});
    }

    return cfg.points;
  } catch (e) {
    console.error("[notoriety] award failed", action, userId, e);
    return null;
  }
}

function dmDeliver(toUserId: string, payload: object) {
  for (const sock of wss.clients) {
    if ((sock as any).user?.id === toUserId) {
      send(sock as any, payload);
    }
  }
}

const MENTION_RE = /@([a-zA-Z0-9][a-zA-Z0-9_-]{1,31})/g;
const RESERVED_MENTIONS = new Set(["operator", "everyone", "all", "here", "admin", "mods", "staff"]);

async function resolveMentions(body: string, senderId: string): Promise<{ id: string; name: string }[]> {
  const handles = new Set<string>();
  let match: RegExpExecArray | null;
  MENTION_RE.lastIndex = 0;
  while ((match = MENTION_RE.exec(body)) !== null) {
    const h = match[1].toLowerCase();
    if (RESERVED_MENTIONS.has(h)) continue;
    handles.add(h);
  }
  if (handles.size === 0) return [];
  try {
    const users = await prisma.user.findMany({
      where: { usernameKey: { in: Array.from(handles) } },
      select: { id: true, name: true, usernameKey: true },
    });
    return users
      .filter(u => u.id !== senderId)
      .map(u => ({ id: u.id, name: u.name || u.usernameKey }));
  } catch {
    return [];
  }
}

async function toggleReactionOnTarget(targetType: "ROOM_MESSAGE" | "DIRECT_MESSAGE" | "CREW_MESSAGE", targetId: string, userId: string, emoji: string): Promise<{ ok: true; reactions: ReactionAgg[] } | { ok: false; reason: string }> {
  try {
    const existing = await (prisma as any).reaction.findUnique({
      where: { targetType_targetId_userId_emoji: { targetType, targetId, userId, emoji } },
    });
    if (existing) {
      await (prisma as any).reaction.delete({ where: { id: existing.id } });
    } else {
      const distinctRows = await (prisma as any).reaction.groupBy({ by: ["emoji"], where: { targetType, targetId } });
      if (distinctRows.length >= 20 && !distinctRows.find((d: any) => d.emoji === emoji)) {
        return { ok: false, reason: "Too many different reactions on this message." };
      }
      await (prisma as any).reaction.create({ data: { targetType, targetId, userId, emoji } });
    }
    const rows = await (prisma as any).reaction.findMany({
      where: { targetType, targetId },
      select: { emoji: true, userId: true },
    });
    const agg: Record<string, { count: number; users: string[] }> = {};
    for (const r of rows) {
      if (!agg[r.emoji]) agg[r.emoji] = { count: 0, users: [] };
      agg[r.emoji].count++;
      if (agg[r.emoji].users.length < 12) agg[r.emoji].users.push(r.userId);
    }
    const reactions: ReactionAgg[] = Object.entries(agg).map(([emoji, v]) => ({ emoji, count: v.count, users: v.users }));
    return { ok: true, reactions };
  } catch (e) {
    console.error("[reactionToggle]", e);
    return { ok: false, reason: "reaction_failed" };
  }
}

async function fetchReactionsForTargets(targetType: "ROOM_MESSAGE" | "DIRECT_MESSAGE" | "CREW_MESSAGE", targetIds: string[]): Promise<Record<string, ReactionAgg[]>> {
  const byMsg: Record<string, ReactionAgg[]> = {};
  if (targetIds.length === 0) return byMsg;
  try {
    const rows = await (prisma as any).reaction.findMany({
      where: { targetType, targetId: { in: targetIds } },
      select: { targetId: true, emoji: true, userId: true },
    });
    const nested: Record<string, Record<string, { count: number; users: string[] }>> = {};
    for (const r of rows) {
      if (!nested[r.targetId]) nested[r.targetId] = {};
      if (!nested[r.targetId][r.emoji]) nested[r.targetId][r.emoji] = { count: 0, users: [] };
      nested[r.targetId][r.emoji].count++;
      if (nested[r.targetId][r.emoji].users.length < 12) nested[r.targetId][r.emoji].users.push(r.userId);
    }
    for (const [mid, agg] of Object.entries(nested)) {
      byMsg[mid] = Object.entries(agg).map(([e, v]) => ({ emoji: e, count: v.count, users: v.users }));
    }
  } catch {}
  return byMsg;
}

const CHAT_RATE_MAX = 6;
const CHAT_RATE_WINDOW_MS = 10_000;
const CHAT_MAX_URLS = 3;
const recentChatSends = new Map<string, number[]>();

function checkChatRateLimit(userId: string): { ok: boolean; reason?: string; retryInMs?: number } {
  const now = Date.now();
  const arr = recentChatSends.get(userId) || [];
  const fresh = arr.filter(ts => now - ts < CHAT_RATE_WINDOW_MS);
  if (fresh.length >= CHAT_RATE_MAX) {
    const oldest = fresh[0];
    const retryInMs = CHAT_RATE_WINDOW_MS - (now - oldest);
    recentChatSends.set(userId, fresh);
    return { ok: false, reason: "Slow down — too many messages in a short window.", retryInMs };
  }
  fresh.push(now);
  recentChatSends.set(userId, fresh);
  return { ok: true };
}

const URL_RE = /https?:\/\/[^\s<>"')\]]+/gi;
function checkUrlSpam(body: string): { ok: boolean; reason?: string } {
  const matches = body.match(URL_RE);
  const count = matches ? matches.length : 0;
  if (count > CHAT_MAX_URLS) {
    return { ok: false, reason: `Too many links in one message (max ${CHAT_MAX_URLS}).` };
  }
  return { ok: true };
}

setInterval(() => {
  const now = Date.now();
  for (const [uid, arr] of recentChatSends) {
    const fresh = arr.filter(ts => now - ts < CHAT_RATE_WINDOW_MS);
    if (fresh.length === 0) recentChatSends.delete(uid);
    else recentChatSends.set(uid, fresh);
  }
}, 60_000);

const PRESENCE_POLL_MS = 60_000;
const STEAM_API_KEY = process.env.STEAM_API_KEY || "";
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || "";
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET || "";
const OPENXBL_API_KEY = process.env.OPENXBL_API_KEY || "";
const XBL_POLL_CAP_PER_CYCLE = 20;
let _xblRateLimitedUntil = 0;
const STEAM_PERSONASTATES: Record<number, string> = {
  0: "Offline", 1: "Online", 2: "Busy", 3: "Away", 4: "Snooze", 5: "Looking to trade", 6: "Looking to play",
};

let twitchAppToken: { token: string; expiresAt: number } | null = null;
async function getTwitchAppToken(): Promise<string | null> {
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) return null;
  if (twitchAppToken && twitchAppToken.expiresAt > Date.now() + 60_000) return twitchAppToken.token;
  try {
    const url = `https://id.twitch.tv/oauth2/token?client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&grant_type=client_credentials`;
    const res = await fetch(url, { method: "POST" });
    if (!res.ok) return null;
    const j: any = await res.json();
    if (!j?.access_token) return null;
    twitchAppToken = { token: j.access_token, expiresAt: Date.now() + (j.expires_in ?? 3600) * 1000 };
    return twitchAppToken.token;
  } catch { return null; }
}

async function pollTwitchPresenceBatch(logins: string[]): Promise<Record<string, any>> {
  if (!TWITCH_CLIENT_ID || logins.length === 0) return {};
  const token = await getTwitchAppToken();
  if (!token) return {};
  try {
    const qs = logins.map(l => `user_login=${encodeURIComponent(l)}`).join("&");
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
  } catch { return {}; }
}

async function pollSteamPresenceBatch(steamIds: string[]): Promise<Record<string, any>> {
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

const XBL_BASE = "https://xbl.io/api/v2";

function xblGet(pathname: string): Promise<{ status: number; json: any | null }> {
  return new Promise((resolve) => {
    if (!OPENXBL_API_KEY) return resolve({ status: 0, json: null });
    if (Date.now() < _xblRateLimitedUntil) return resolve({ status: 429, json: null });
    let settled = false;
    const settle = (v: { status: number; json: any | null }) => { if (!settled) { settled = true; resolve(v); } };
    const req = nodeHttps.get({
      host: "xbl.io",
      path: pathname,
      headers: { "X-Authorization": OPENXBL_API_KEY, Accept: "application/json" },
    }, (res: any) => {
      let body = "";
      res.on("data", (c: any) => { body += c; });
      res.on("end", () => {
        if (res.statusCode === 429) {
          _xblRateLimitedUntil = Date.now() + 5 * 60 * 1000;
          console.warn('[xbl] hit 429; cooling down 5 min');
          return settle({ status: 429, json: null });
        }
        try { settle({ status: res.statusCode || 0, json: JSON.parse(body) }); }
        catch { settle({ status: res.statusCode || 0, json: null }); }
      });
    });
    req.on("error", () => settle({ status: 0, json: null }));
    req.setTimeout(10000, () => { req.destroy(); settle({ status: 0, json: null }); });
  });
}

async function resolveXboxGamertag(gamertag: string): Promise<{ xuid: string; gamertag: string } | null> {
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
  } catch { return null; }
}

async function pollXboxPresenceOne(xuid: string): Promise<any | null> {
  if (!OPENXBL_API_KEY || !xuid) return null;
  try {
    const { status, json } = await xblGet(`/api/v2/${encodeURIComponent(xuid)}/presence`);
    if (status !== 200 || !json) return null;
    const j: any = json;
    const body = j?.content ?? j;
    const state = String(body?.state || "").toLowerCase();
    const devices: any[] = Array.isArray(body?.devices) ? body.devices : [];
    const titles = devices.flatMap(d => Array.isArray(d?.titles) ? d.titles : []);
    const game = titles.find(t => {
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
  } catch { return null; }
}

async function runPresencePoll() {
  if (!STEAM_API_KEY && !TWITCH_CLIENT_ID && !OPENXBL_API_KEY) return;
  try {
    const users = await prisma.user.findMany({
      where: { OR: [{ steamId: { not: null } }, { twitchLogin: { not: null } }, { xboxXuid: { not: null } }] },
      select: { id: true, steamId: true, twitchLogin: true, xboxXuid: true },
      take: 500,
    });
    if (users.length === 0) return;

    const steamData: Record<string, any> = {};
    if (STEAM_API_KEY) {
      const steamUsers = users.filter(u => u.steamId);
      for (let i = 0; i < steamUsers.length; i += 100) {
        const chunk = steamUsers.slice(i, i + 100);
        const batch = await pollSteamPresenceBatch(chunk.map(u => u.steamId as string));
        Object.assign(steamData, batch);
      }
    }

    const twitchData: Record<string, any> = {};
    if (TWITCH_CLIENT_ID) {
      const twitchUsers = users.filter(u => u.twitchLogin);
      for (let i = 0; i < twitchUsers.length; i += 100) {
        const chunk = twitchUsers.slice(i, i + 100);
        const batch = await pollTwitchPresenceBatch(chunk.map(u => (u.twitchLogin as string).toLowerCase()));
        Object.assign(twitchData, batch);
      }
    }

    const xboxData: Record<string, any> = {};
    if (OPENXBL_API_KEY) {
      const xboxUsers = users.filter(u => u.xboxXuid).slice(0, XBL_POLL_CAP_PER_CYCLE);
      for (const u of xboxUsers) {
        const pres = await pollXboxPresenceOne(u.xboxXuid as string);
        xboxData[u.xboxXuid as string] = pres;
      }
    }

    for (const u of users) {
      const tw = u.twitchLogin ? twitchData[(u.twitchLogin as string).toLowerCase()] : undefined;
      const xb = u.xboxXuid ? xboxData[u.xboxXuid as string] : undefined;
      const st = u.steamId ? steamData[u.steamId as string] : undefined;
      const primary = (tw && tw.source === "TWITCH") ? tw
        : (xb && xb.source === "XBOX") ? xb
        : (st ?? null);
      if (primary === undefined) continue;
      await prisma.user.update({
        where: { id: u.id },
        data: { livePresence: primary as any, presenceCheckedAt: new Date() },
      }).catch(() => {});

      try {
        for (const [, room] of rooms) {
          const entry = room.users.get(u.id);
          if (!entry) continue;
          (entry as any).livePresence = primary ?? null;
          broadcast(room, { type: "presence:join", roomId: room.roomId, user: entry });
        }
        for (const s of wss.clients as any) {
          if (s?.user?.id === u.id) (s.user as any).livePresence = primary ?? null;
        }
      } catch { }
    }
  } catch (e) { console.error("[presence poll]", e); }
}

if (STEAM_API_KEY || TWITCH_CLIENT_ID || OPENXBL_API_KEY) {
  setInterval(() => { void runPresencePoll(); }, PRESENCE_POLL_MS);
  setTimeout(() => { void runPresencePoll(); }, 15_000);
}

function send_to_user(userId: string, payload: object) {
  dmDeliver(userId, payload);
}

function isUserOnline(userId: string): boolean {
  for (const sock of wss.clients) {
    if ((sock as any).user?.id === userId) return true;
  }
  return false;
}

let _operatorUserId: string | null = null;
async function getOperatorUserId(): Promise<string> {
  if (_operatorUserId) return _operatorUserId;
  try {
    const op = await prisma.user.upsert({
      where: { usernameKey: "operator" },
      update: {},
      create: {
        usernameKey: "operator",
        name: "The Operator",
        avatar: "/brand/roles/operator.svg",
        avatarColor: "#D4A017",
        bio: "I'm the system. Type /help anywhere if you need a hand.",
      },
    });
    _operatorUserId = op.id;
    return op.id;
  } catch (e) {
    console.error("[getOperatorUserId]", e);
    throw e;
  }
}

async function seedWelcomeDM(toUserId: string): Promise<void> {
  try {
    const fromId = await getOperatorUserId();
    if (fromId === toUserId) return;
    const body = `Welcome aboard. This is the Burner — your DMs, friends, and crew all dock here. Tap a tab to explore.

We're sailing on the Windrose lobby right now (link in the rail). Find a crew, post a bounty on a Kraken tooth, browse mods. Voice rooms work everywhere.

If you get stuck, just hit me back here. — The Operator 🏴‍☠️`;
    const dm = await prisma.directMessage.create({
      data: { fromId, toId: toUserId, body },
    });
    dmDeliver(toUserId, {
      type: "dm:in",
      dm: {
        id: dm.id,
        fromId,
        toId: toUserId,
        body: dm.body,
        createdAt: dm.createdAt,
        fromName: "The Operator",
      },
    });
  } catch (e) {
    console.error("[seedWelcomeDM]", e);
  }
}

async function sendWebPush(userId: string, data: { title: string; body: string; url?: string; tag?: string }) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(data)
      );
    } catch (e: any) {
      if (e.statusCode === 404 || e.statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      }
    }
  }
}

async function sendExpoPush(userId: string, data: { title: string; body: string; url?: string; tag?: string }) {
  const tokens = await (prisma as any).expoPushToken.findMany({ where: { userId } });
  if (tokens.length === 0) return;
  const messages = tokens.map((t: any) => ({
    to: t.token,
    title: data.title,
    body: data.body || "",
    sound: "default",
    data: { url: data.url || "/", tag: data.tag },
  }));
  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(messages),
    });
    if (!res.ok) return;
    const json: any = await res.json().catch(() => null);
    const tickets: any[] = json?.data || [];
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      const token = tokens[i];
      if (!token) continue;
      if (ticket?.status === "error" && ticket?.details?.error === "DeviceNotRegistered") {
        await (prisma as any).expoPushToken.delete({ where: { id: token.id } }).catch(() => {});
      }
    }
  } catch {}
}

async function sendPush(userId: string, data: { title: string; body: string; url?: string; tag?: string }) {
  await Promise.all([
    sendWebPush(userId, data),
    sendExpoPush(userId, data),
  ]);
}

async function createNotification(opts: {
  userId: string;
  type: string;
  title: string;
  body?: string;
  actionUrl?: string;
  actorId?: string;
  actorName?: string;
  meta?: any;
}) {
  try {
    const notif = await (prisma as any).notification.create({
      data: {
        userId: opts.userId,
        type: opts.type,
        title: opts.title,
        body: opts.body || "",
        actionUrl: opts.actionUrl || null,
        actorId: opts.actorId || null,
        actorName: opts.actorName || null,
        meta: opts.meta || undefined,
      },
    });
    let matched = 0;
    const socketUserIds: string[] = [];
    for (const sock of wss.clients) {
      const sid = (sock as any).user?.id;
      if (sid) socketUserIds.push(sid);
      if (sid === opts.userId) {
        matched++;
        send(sock as Sock, {
          type: "notification:new",
          notification: { ...notif, createdAt: notif.createdAt?.toISOString?.() || notif.createdAt },
        });
      }
    }
    console.log("[notification]", opts.type, "target=" + opts.userId, "total_clients=" + wss.clients.size, "authed_count=" + socketUserIds.length, "matched=" + matched);
    if (matched === 0 && socketUserIds.length > 0) {
      console.log("[notification] target not found among:", JSON.stringify(socketUserIds.slice(0, 10)));
    }
    if (!isUserOnline(opts.userId)) {
      sendPush(opts.userId, {
        title: opts.title,
        body: opts.body || "",
        url: opts.actionUrl || "/home",
        tag: `notif:${opts.type}:${notif.id}`,
      }).catch(() => {});
    }
  } catch (e) {
    console.error("[notification] create failed", e);
  }
}

function removePending(room: RoomState, userId: string) {
  const set = room.pending.get(userId);
  if (set) { for (const s of set) { try { s.pendingRoomId = undefined; } catch {} } }
  room.pending.delete(userId);
}

function removeKnock(room: RoomState, userId: string) {
  room.knocks = room.knocks.filter((k) => k.userId !== userId);
}

async function hydrateGlobalRole(user: AuthedUser): Promise<AuthedUser> {
  try {
    const u = await prisma.user.findUnique({
      where: { id: user.id },
      select: { usernameKey: true, globalRole: true, tier: true, avatarColor: true, avatar: true, steamId: true, twitchLogin: true, xboxGamertag: true, livePresence: true, panelBgColor: true, panelAccentColor: true, pillBgColor: true, pillAccentColor: true, statusText: true, statusEmoji: true, nameEffect: true, avatarFrame: true } as any,
    });
    return {
      ...user,
      usernameKey: (u as any)?.usernameKey ?? undefined,
      globalRole: String(u?.globalRole ?? "USER"),
      tier: String(u?.tier ?? "INNOCENT"),
      avatarColor: u?.avatarColor ?? undefined,
      avatar: u?.avatar ?? undefined,
      steamId: u?.steamId ?? undefined,
      twitchLogin: u?.twitchLogin ?? undefined,
      xboxGamertag: u?.xboxGamertag ?? undefined,
      livePresence: u?.livePresence ?? null,
      panelBgColor: (u as any)?.panelBgColor ?? undefined,
      panelAccentColor: (u as any)?.panelAccentColor ?? undefined,
      pillBgColor: (u as any)?.pillBgColor ?? undefined,
      pillAccentColor: (u as any)?.pillAccentColor ?? undefined,
      statusText: (u as any)?.statusText ?? undefined,
      statusEmoji: (u as any)?.statusEmoji ?? undefined,
      nameEffect: (u as any)?.nameEffect ?? undefined,
      avatarFrame: (u as any)?.avatarFrame ?? undefined,
    } as any;
  } catch { return user; }
}

function verifyToken(token?: string): AuthedUser | null {
  if (!token) return null;
  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    const id = String(decoded?.sub || decoded?.id || "");
    const name = String(decoded?.name || decoded?.username || "");
    if (!id || !name) return null;
    return { id, name };
  } catch { return null; }
}

function buildOperatorSystemPrompt(lobbyId: string): string {
  const base = 'You are "The Operator" — the AI behind Weered, a lobby-based social gaming platform with a GTA street aesthetic. You are street-smart, slightly sarcastic, helpful but with attitude. Keep responses SHORT (1-3 sentences max). Never break character. Never be mean, just witty. No emojis, no hashtags, no quotes. If someone asks something you do not know, deflect with style — do not make up numbers or live state.';

  if (lobbyId === "destiny2") {
    return base + `

You are currently embedded in the destiny2 lobby. You speak Destiny fluently — both the game and the meta around it.

DESTINY 2 CANON YOU KNOW:
• Raids active in rotation: King's Fall, Crota's End, Vault of Glass, Vow of the Disciple, Salvation's Edge, Last Wish, Deep Stone Crypt, Garden of Salvation, Root of Nightmares, The Desert Perpetual.
• Dungeons: Ghosts of the Deep, Spire of the Watcher, Duality, Grasp of Avarice, Prophecy, Pit of Heresy, Warlord's Ruin, Vesper's Host, Sundered Doctrine.
• Champions: Barrier (anti-barrier), Overload (disruption), Unstoppable (stagger). Each needs the matching anti-champion mod or weapon perk.
• Match Game: enemy shields highly resistant to non-matching elemental damage. Brutal solo because you cannot cover every shield type.
• Surges: outgoing damage boost (BOON) — Solar/Arc/Void/Stasis/Strand. Player picks one of three in Custom Ops.
• Threats: incoming damage burn (CHALLENGE) — same elements. Increases damage Guardians take from that element.
• Pantheon: boss-rush mode. Original ran 6 weeks in Final Shape. Pantheon 2.0 returning June 9, 2026 with the Shadow & Order update — this time as a permanent mode.
• Trials of Osiris: 3v3 Elimination weekends, Saint-XIV hosts, Friday-Tuesday window.
• Iron Banner: monthly 6v6 Crucible event, Lord Saladin hosts.
• Day-1 Raid Race: 24-48hr Contest Mode, power-locked. World First clans include Elysium and Math Class affiliates.
• July 2025 Desert Perpetual scandal: 70% of top-100 contest clears used cheats. Bungie investigated, banned hundreds. Still a sore spot.
• Custom Ops / Portal: Bungie's customization layer. Tiers: Normal +10, Advanced +100, Expert +200, Master +300, Grandmaster +400, Ultimate +500. Player picks Skulls (mods) for Boons/Challenges; Champions and Rules are activity-locked.
• Sherpas, Pure Destiny, Trials Tactical — well-known competitive/teaching communities.

WEERED'S D2 LAYER (be specific — this is OUR moat):
• Bungie OAuth covers PSN/Steam/Xbox/Epic in one link. Players don't need to link platforms separately.
• PGCR-verified challenges and tournaments. No screenshots. No honor system. Bungie's API is the source of truth.
• Skull-manifest aware: Custom Ops player-picked modifiers count, not just Bungie-curated activity mods.
• High-tier marker fallback handles Bungie's inconsistent tier integers across activity types.
• Activity-hash filtering scopes challenges to specific maps (e.g. "Hand-Picked GM Strikes").
• The Impossible Tournament is currently live: Boss Rush Marathon (4 raids), Solo Dungeon Marathon (3 solo dungeons), Master Raid Conqueror (3 Master+ raids), Trials Win Streak (5 in a row). Survivors get the Impossible Champion banner.
• Tournament templates available for users to spin up their own events: Pantheon Cup, Trials Weekend, Iron Banner Cup, Solo Champion, Speed Run Cup.
• Standalone challenges outside the tournament: Iron Banner Standout (10 wins), Speed Demon (sub-6-min strike), [TEST] Verify Your Link.
• Anyone can create their own tournament now (one active per user, staff bypass that limit).
• Champions on Weered challenges show up as banner flair across the platform — chat, profile, member lists.

WHEN ASKED ABOUT LIVE STATE you can't see (current leaderboard standings, who's online, what tournaments are running this exact second), be honest you can't see that yet — but point them to the right tab: Tournaments tab for active events, Challenges tab for personal progress, Hall of Fame for past winners.`;
  }

  if (lobbyId === "chess") {
    return base + `

You are currently embedded in the chess lobby. You speak chess fluently — game knowledge, the community, the meta around it.

CHESS KNOWLEDGE YOU OWN:
• Time controls: bullet (<3min), blitz (3-8min), rapid (8-25min), classical (25min+), correspondence (days/move).
• Major openings: Sicilian (B20-B99, .Najdorf, Dragon, Sveshnikov, Taimanov), Ruy Lopez (C60-C99, Berlin Defense, Marshall), Italian Game (C50-C59, Giuoco Piano), Queen\'s Gambit (D06-D69, Slav, Semi-Slav, QGA, QGD), King\'s Indian Defense (E60-E99), Caro-Kann (B10-B19), French Defense (C00-C19), London System, Catalan, English.
• Endgame canon: K+R vs K, K+P vs K (square rule, opposition), Lucena and Philidor positions, K+B+N vs K (legendary).
• Major tournaments: Candidates, World Championship, Norway Chess, Tata Steel, Sinquefield Cup, FIDE World Cup, Grand Swiss.
• Active world-class players: Magnus Carlsen, Hikaru Nakamura, Fabiano Caruana, Ian Nepomniachtchi, Ding Liren (former WC), Gukesh Dommaraju (current WC), Praggnanandhaa, Wei Yi, Alireza Firouzja, Wesley So.
• Streamer ecosystem: Hikaru, GothamChess (Levy Rozman), Botez sisters, Eric Rosen, Anna Cramling, Daniel Naroditsky, Anish Giri.
• Cheating discourse: post-Hans Niemann 2022, the chess community is HIGHLY sensitive about online cheating. Engine-assist detection is hard. This is the moat for verified-by-API tournaments — Lichess and Chess.com run their own anti-cheat but community-organized tournaments have historically relied on screenshots/honor system. Weered closes that gap.
• Rating bands (Lichess approx): beginner <1200, casual 1200-1600, intermediate 1600-1900, club 1900-2200, expert 2200+, master 2400+. Chess.com runs about 100-300 points higher in equivalent strength due to different rating system.

WEERED\'S CHESS LAYER (be specific):
• Link Lichess + Chess.com usernames in Settings. Public API, no OAuth, no token. Validated against the live API on save — typos get rejected.
• Worker polls recent games every 5 min. Each game lands in your audit log with full metadata: time control, rating, opponent, opening, result, ECO code.
• Tournament-credit objectives include chess_wins, chess_streak (consecutive Ws), chess_rating_climb (net delta in a perf), chess_opening_wins (filter by ECO code or opening name regex).
• Current active challenges: [TEST] Lichess Link Check, Bullet Sprint (10 bullet wins), Blitz Five-Streak (5 in a row), Rating Climb — Blitz (+50 net), Sicilian Specialist (5 Sicilian wins, B20-B99), Cross-Platform Player (3 Lichess wins + 3 Chess.com wins).
• Pinned rooms: Bullet Club (speed chess), Long Game (rapid/classical), Opening Lab (themed weekly).
• Forum sections: General, Tournaments, Openings, Tactics, Endgames, Analysis, Streamers.

WHEN ASKED ABOUT LIVE STATE you can\'t see (current leaderboard, who\'s playing now, who\'s in a specific game), be honest you can\'t see that yet — point them to the right tab: Tournaments for events, Challenges for personal progress, Players list for lobby presence, or their own audit log for game-by-game truth.`;
  }

  return base + ` You know about: lobbies (gaming communities), Paper (virtual currency), notoriety (XP), FakeOut (paper trading), poker (Texas Hold'em with Paper stakes), crews, challenges, and game integrations (Destiny 2, League of Legends, Fortnite, Helldivers 2, Marathon).`;
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
  for (const s of room.sockets) { if (s.user?.id === userId) out.push(s); }
  return out;
}

async function persistMember(room: RoomState, user: AuthedUser) {
  if (room.roomId === "lobby") return;
  const role = roleOf(room, user.id);
  const dbRole = role === "owner" ? RoomRole.OWNER : role === "mod" ? RoomRole.MOD : RoomRole.MEMBER;
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

  if (ws.roomId === roomId) { publishStateToSocket(ws, room); return true; }
  if (ws.roomId) leaveRoom(ws);

  ws.roomId = roomId;
  ws.pendingRoomId = undefined;
  room.sockets.add(ws);
  room.lastActiveAt = Date.now();
  if (ws.user) room.pending.delete(ws.user.id);

  if (ws.user && !room.users.has(ws.user.id)) {
    const userEntry = { id: ws.user.id, name: ws.user.name, usernameKey: (ws.user as any).usernameKey ?? undefined, globalRole: ws.user.globalRole || "USER", tier: ws.user.tier || "INNOCENT", avatarColor: ws.user.avatarColor ?? undefined, avatar: ws.user.avatar ?? undefined, steamId: (ws.user as any).steamId ?? undefined, twitchLogin: (ws.user as any).twitchLogin ?? undefined, xboxGamertag: (ws.user as any).xboxGamertag ?? undefined, isAway: Boolean((ws.user as any).isAway), livePresence: (ws.user as any).livePresence ?? null, pillBgColor: (ws.user as any).pillBgColor ?? undefined, pillAccentColor: (ws.user as any).pillAccentColor ?? undefined, statusText: (ws.user as any).statusText ?? undefined, statusEmoji: (ws.user as any).statusEmoji ?? undefined, nameEffect: (ws.user as any).nameEffect ?? undefined, avatarFrame: (ws.user as any).avatarFrame ?? undefined };
    room.users.set(ws.user.id, userEntry);
    broadcast(room, { type: "presence:join", roomId, user: userEntry });
  }

  if (ws.user) { try { await persistMember(room, ws.user); } catch {} }

  if (ws.user) awardNotoriety(ws.user.id, "ROOM_JOINED").catch(() => {});

  publishStateToSocket(ws, room);

  if (room.msgs.length) {
    send(ws, { type: "chat:history", roomId, msgs: room.msgs.slice(-80) });
  }

  if (room.ytState) {
    send(ws, { type: "youtube:state", roomId, ...room.ytState });
  }

  return true;
}

interface RawItem {
  url: string;
  title: string;
  thumbnail?: string;
  domain: string;
  sourceName: string;
  category: string;
  postedAt: Date;
}

function domainOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

function roomIdFromUrl(url: string): string {
  let h = 0;
  for (let i = 0; i < url.length; i++) { h = ((h << 5) - h) + url.charCodeAt(i); h |= 0; }
  return `article_${Math.abs(h).toString(36).slice(0, 10)}`;
}

function recencyScore(postedAt: Date): number {
  const ageHours = (Date.now() - postedAt.getTime()) / 3600000;
  if (ageHours < 1)  return 70;
  if (ageHours < 3)  return 60;
  if (ageHours < 6)  return 50;
  if (ageHours < 12) return 38;
  if (ageHours < 24) return 25;
  if (ageHours < 48) return 12;
  return 5;
}

async function fetchHackerNews(): Promise<RawItem[]> {
  try {
    const res  = await fetch("https://hn.algolia.com/api/v1/search?tags=story&hitsPerPage=15&numericFilters=points>50");
    const data = await res.json() as any;
    return (data.hits || []).filter((h: any) => h.url).map((h: any) => ({
      url:        h.url,
      title:      h.title,
      domain:     domainOf(h.url),
      sourceName: "Hacker News",
      category:   "tech",
      postedAt:   new Date(h.created_at),
    }));
  } catch (e) { console.warn("[feed] HN fetch failed:", e); return []; }
}

async function fetchESPNRss(feedUrl: string, category: string, sourceName: string): Promise<RawItem[]> {
  try {
    const res  = await fetch(feedUrl, { headers: { "User-Agent": "Mozilla/5.0 (compatible; Weered/1.0)" } });
    const xml  = await res.text();
    const items: RawItem[] = [];
    const itemRx  = /<item>([\s\S]*?)<\/item>/g;
    const titleRx = /<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/;
    const linkRx  = /<link>(?:<!\[CDATA\[)?(https?[^<]+?)(?:\]\]>)?<\/link>/;
    const dateRx  = /<pubDate>(.*?)<\/pubDate>/;
    const imgRx   = /<media:thumbnail[^>]+url=\"([^"]+)\"/;
    let m: RegExpExecArray | null;
    while ((m = itemRx.exec(xml)) !== null) {
      const block  = m[1];
      const title  = titleRx.exec(block)?.[1]?.trim();
      const link   = linkRx.exec(block)?.[1]?.trim();
      const dateStr = dateRx.exec(block)?.[1];
      const thumb  = imgRx.exec(block)?.[1];
      if (!title || !link) continue;
      items.push({ url: link, title, thumbnail: thumb, domain: domainOf(link), sourceName, category, postedAt: dateStr ? new Date(dateStr) : new Date() });
    }
    return items.slice(0, 12);
  } catch (e) { console.warn(`[feed] ESPN RSS ${feedUrl} failed:`, e); return []; }
}

async function fetchItunesPodcasts(): Promise<RawItem[]> {
  try {
    const terms = ["true+crime", "comedy", "news", "sports", "technology"];
    const term  = terms[Math.floor(Math.random() * terms.length)];
    const res   = await fetch(`https://itunes.apple.com/search?media=podcast&entity=podcastEpisode&term=${term}&limit=10&sort=recent`);
    const data  = await res.json() as any;
    return (data.results || []).map((r: any) => ({
      url:        r.trackViewUrl || r.collectionViewUrl,
      title:      r.trackName || r.collectionName,
      thumbnail:  r.artworkUrl100,
      domain:     "podcasts.apple.com",
      sourceName: r.collectionName || "Apple Podcasts",
      category:   "podcasts",
      postedAt:   r.releaseDate ? new Date(r.releaseDate) : new Date(),
    })).filter((r: any) => r.url && r.title);
  } catch (e) { console.warn("[feed] iTunes fetch failed:", e); return []; }
}

async function fetchYouTubeRss(channelId: string, sourceName: string, category: string): Promise<RawItem[]> {
  try {
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
    const xml = await res.text();
    const items: RawItem[] = [];
    const entryRx = /<entry>([\s\S]*?)<\/entry>/g;
    const titleRx = /<title>(.*?)<\/title>/;
    const linkRx  = /<link rel=\"alternate\" href=\"([^"]+)\"/;
    const dateRx  = /<published>(.*?)<\/published>/;
    const thumbRx = /<media:thumbnail url=\"([^"]+)\"/;
    let m: RegExpExecArray | null;
    while ((m = entryRx.exec(xml)) !== null) {
      const block   = m[1];
      const title   = titleRx.exec(block)?.[1]?.trim();
      const link    = linkRx.exec(block)?.[1]?.trim();
      const dateStr = dateRx.exec(block)?.[1];
      const thumb   = thumbRx.exec(block)?.[1];
      if (!title || !link) continue;
      items.push({ url: link, title, thumbnail: thumb, domain: "youtube.com", sourceName, category, postedAt: dateStr ? new Date(dateStr) : new Date() });
    }
    return items.slice(0, 8);
  } catch (e) { console.warn(`[feed] YouTube RSS ${channelId} failed:`, e); return []; }
}

async function runFeedWorker() {
  console.log("[feed] worker starting fetch...");
  try {
    const [hn, espnUfc, espnNfl, espnNba, podcasts, ign, gamespot] = await Promise.all([
      fetchHackerNews(),
      fetchESPNRss("https://www.espn.com/espn/rss/mma/news",  "ufc",    "ESPN MMA"),
      fetchESPNRss("https://www.espn.com/espn/rss/nfl/news",  "sports", "ESPN NFL"),
      fetchESPNRss("https://www.espn.com/espn/rss/nba/news",  "sports", "ESPN NBA"),
      fetchItunesPodcasts(),
      fetchYouTubeRss("UCKy1dAqELo0zrOtPkf0eTMw", "IGN",      "gaming"),
      fetchYouTubeRss("UCbu2SsF-Or3Rsn3NxqODImQ", "GameSpot", "gaming"),
    ]);

    const all: RawItem[] = [...hn, ...espnUfc, ...espnNfl, ...espnNba, ...podcasts, ...ign, ...gamespot];
    const seen = new Set<string>();
    const deduped = all.filter(i => { if (!i.url || seen.has(i.url)) return false; seen.add(i.url); return true; });

    let upserted = 0;
    for (const item of deduped) {
      const roomId      = roomIdFromUrl(item.url);
      const roomState   = rooms.get(roomId);
      const usersInRoom = roomState ? roomState.users.size : 0;
      const heat        = Math.min(100, recencyScore(item.postedAt) + Math.min(30, usersInRoom * 5));

      await prisma.feedItem.upsert({
        where: { url: item.url },
        update: { heat, usersInRoom, fetchedAt: new Date(), title: item.title, thumbnail: item.thumbnail ?? null },
        create: { url: item.url, title: item.title, thumbnail: item.thumbnail ?? null, domain: item.domain, sourceName: item.sourceName, category: item.category, heat, usersInRoom, postedAt: item.postedAt },
      }).catch((e: any) => console.warn("[feed] upsert failed:", e?.message));
      const shortTitle = item.title.length > 60 ? item.title.slice(0, 57) + "…" : item.title;
      articleRoomMeta.set(roomId, { name: shortTitle, thumbnail: item.thumbnail || undefined });
      if (roomState) {
        roomState.name = shortTitle;
        if (item.thumbnail) roomState.thumbnail = item.thumbnail;
      }
      upserted++;
    }
    console.log(`[feed] worker done — ${upserted} items upserted`);
  } catch (e) { console.error("[feed] worker error:", e); }
}

async function main() {
  const app = Fastify({ logger: true });
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
      return reply.code(503).send({ error: "maintenance", message: "Weered is down for maintenance. Back shortly." });
    } catch {}
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
      return reply.status(400).send({ error: "validation_error", message: e.message || "Invalid request" });
    }
    if (status >= 500 && process.env.SENTRY_DSN_API) {
      Sentry.captureException(err, { tags: { route: req.routeOptions?.url || req.url } });
    }
    reply.status(status).send({ error: e.message || "Internal error" });
  });
  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: "Weered API",
        version: "1.0.0",
        description: "Weered platform API. Web clients authenticate with an httpOnly session cookie; mobile/desktop use a Bearer token.",
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
        } catch {}
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
  function applyWindroseReel<T extends { id?: string; bannerUrl?: string | null } | null>(lobby: T): T {
    if (!lobby || lobby.id !== "windrose") return lobby;
    const idx = Math.floor(Math.random() * WINDROSE_BANNER_COUNT) + 1;
    const num = idx.toString().padStart(2, "0");
    (lobby as any).bannerUrl = `/brand/windrose/banners/banner-${num}.webp`;
    return lobby;
  }

  await app.register(publicMiscRoutes, { getSiteConfig, applyWindroseReel } as any);
  app.get("/health", async () => {
    try { await prisma.$queryRaw`SELECT 1`; return { ok: true, db: "ok" }; }
    catch { return { ok: true, db: "down" }; }
  });

  await app.register(authRoutes, { authFromHeader, JWT_SECRET, isNameReserved, getSiteConfig, seedWelcomeDM } as any);

  const WEB_URL              = process.env.APP_URL               || "https://weered.ca";

  await app.register(voiceRoutes, { authFromHeader, rooms, ensureRoomLoaded, normalizeRoomId, isModOrOwner, awardNotoriety } as any);
  async function lobbyAdminAccess(req: any, reply: any, minLevel = 4): Promise<{ user: any; lobby: any; member: any; globalRole: any; overrideRole: string | null } | null> {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) { reply.code(401).send({ ok: false, error: "unauthorized" }); return null; }
    const lobbyId = String((req as any).params?.id || (req as any).params?.lobbyId || "");
    const lobby = await (prisma as any).lobby.findUnique({ where: { id: lobbyId } });
    if (!lobby) { reply.code(404).send({ ok: false, error: "lobby_not_found" }); return null; }
    const gr = await getGlobalRole(u.id);
    if (canAccessStaff(gr)) return { user: u, lobby, member: null, globalRole: gr, overrideRole: gr };
    const member = await (prisma as any).lobbyMember.findUnique({ where: { lobbyId_userId: { lobbyId, userId: u.id } } });
    if (!member || (member.roleLevel ?? 1) < minLevel) { reply.code(403).send({ ok: false, error: "forbidden" }); return null; }
    return { user: u, lobby, member, globalRole: gr, overrideRole: null };
  }

  await app.register(lobbiesRoutes, {
    authFromHeader, verifyToken, getGlobalRole, canAccessStaff, getLobbyRole,
    applyWindroseReel, lobbyAdminAccess, globalAudit, rooms,
    isNameReserved, awardNotoriety, send,
  } as any);

  await app.register(roomsRoutes, {
    authFromHeader, verifyToken, getGlobalRole, canAccessStaff,
    rooms, ensureRoomLoaded, normalizeRoomId, buildStatePayload, send, shortRoomId,
    broadcastToLobby,
  } as any);

  await app.register(staffRoutes, {
    authFromHeader, getGlobalRole, canAccessStaff, canAssignRoles, globalAudit,
    broadcast, broadcastEvent, rooms, send, getWss: () => wss, shortRoomId,
    getAllSiteConfig, setSiteConfig, SITE_CONFIG_DEFAULTS, getSiteConfig,
    isModOrOwner, audit, publishState, findSocketsByUser,
  } as any);

  await app.register(staffContentRoutes, { authFromHeader, getGlobalRole, canAccessStaff, globalAudit, rooms } as any);
  await app.register(profileRoutes, { authFromHeader, getNotorietyRank, awardNotoriety, globalAudit, publishState, rooms, getWss: () => wss, resolveXboxGamertag, pollSteamPresenceBatch, pollTwitchPresenceBatch, pollXboxPresenceOne, STEAM_API_KEY, TWITCH_CLIENT_ID, OPENXBL_API_KEY } as any);

  await app.register(geoRoutes, { authFromHeader } as any);

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
  await app.register(uploadsRoutes, { authFromHeader, awardNotoriety, canAccessStaff, onAvatarChanged } as any);

  await app.register(notorietyRoutes, { authFromHeader, getNotorietyRank, NOTORIETY_RANKS } as any);
  await app.register(crewsRoutes, { authFromHeader, verifyToken, awardNotoriety, createNotification, rooms, fetchReactionsForTargets, getNotorietyRank } as any);

  await app.register(invitesRoutes, { authFromHeader, awardNotoriety, getGlobalRole, canAssignRoles, WEB_URL } as any);
  await app.register(chessRoutes, { authFromHeader } as any);

  await app.register(dmRoutes, { authFromHeader, resolveUserId, fetchReactionsForTargets, dmDeliver, isUserOnline, sendPush } as any);
  await app.register(groupRoutes, { authFromHeader, resolveUserId, dmDeliver, isUserOnline, sendPush, resolveMentions, createNotification } as any);

  runFeedWorker();
  setInterval(runFeedWorker, 20 * 60 * 1000);
  setInterval(() => { void runHelldiversWorker({ getAI, broadcastToLobby, countLobbyActiveUsers }); }, 10 * 60 * 1000);
  setTimeout(() => { void runHelldiversWorker({ getAI, broadcastToLobby, countLobbyActiveUsers }); }, 30_000);

  await app.register(forumRoutes, { authFromHeader, getGlobalRole, canAccessStaff, getLobbyRole, resolveMentions, createNotification } as any);
  await app.register(forumModRoutes, { authFromHeader, getGlobalRole, canAccessStaff, getLobbyRole } as any);
  setInterval(() => { void autoModTick(); }, 60_000);

  const NEWS_FEEDS = [
    { url: "https://news.google.com/rss/search?q=site:cbc.ca+when:1d&hl=en-CA&gl=CA&ceid=CA:en", category: "canada", source: "CBC News", icon: "https://www.cbc.ca/favicon.ico" },
    { url: "https://feeds.bbci.co.uk/news/world/rss.xml",    category: "world",           source: "BBC World",   icon: "https://www.bbc.co.uk/favicon.ico" },
    { url: "https://feeds.bbci.co.uk/news/technology/rss.xml",category: "tech",           source: "BBC Tech",    icon: "https://www.bbc.co.uk/favicon.ico" },
    { url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml", category: "science", source: "BBC Science", icon: "https://www.bbc.co.uk/favicon.ico" },
    { url: "https://feeds.bbci.co.uk/news/business/rss.xml", category: "business",        source: "BBC Business",icon: "https://www.bbc.co.uk/favicon.ico" },
    { url: "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml", category: "entertainment", source: "BBC Arts", icon: "https://www.bbc.co.uk/favicon.ico" },
    { url: "https://feeds.bbci.co.uk/sport/rss.xml",         category: "sports",          source: "BBC Sport",   icon: "https://www.bbc.co.uk/favicon.ico" },
    { url: "https://feeds.bbci.co.uk/news/rss.xml",              category: "top",            source: "BBC News",    icon: "https://www.bbc.co.uk/favicon.ico" },
    { url: "https://news.google.com/rss/search?q=site:ctvnews.ca+when:1d&hl=en-CA&gl=CA&ceid=CA:en", category: "canada", source: "CTV News", icon: "https://www.ctvnews.ca/favicon.ico" },
    { url: "https://globalnews.ca/feed/",                         category: "canada",         source: "Global News", icon: "https://globalnews.ca/favicon.ico" },
    { url: "https://news.google.com/rss?hl=en-CA&gl=CA&ceid=CA:en", category: "top",        source: "Google News", icon: "https://news.google.com/favicon.ico" },
    { url: "https://news.google.com/rss/search?q=canada+when:1d&hl=en-CA&gl=CA&ceid=CA:en", category: "canada", source: "Google News", icon: "https://news.google.com/favicon.ico" },
    { url: "https://www.eurogamer.net/?format=rss",                                          category: "gaming",  source: "Eurogamer",   icon: "https://www.eurogamer.net/favicon.ico" },
    { url: "https://www.polygon.com/rss/index.xml",                                          category: "gaming",  source: "Polygon",     icon: "https://www.polygon.com/favicon.ico" },
    { url: "https://kotaku.com/rss",                                                         category: "gaming",  source: "Kotaku",      icon: "https://kotaku.com/favicon.ico" },
    { url: "https://www.gamespot.com/feeds/news/",                                           category: "gaming",  source: "GameSpot",    icon: "https://www.gamespot.com/favicon.ico" },
    { url: "https://news.google.com/rss/search?q=site:ign.com+when:2d&hl=en-US&gl=US&ceid=US:en",                                    category: "gaming",  source: "IGN",         icon: "https://www.ign.com/favicon.ico" },
    { url: "https://news.google.com/rss/search?q=%22GTA+6%22+OR+%22Grand+Theft+Auto+VI%22+when:7d&hl=en-US&gl=US&ceid=US:en", category: "gaming", source: "GTA 6 News", icon: "https://news.google.com/favicon.ico" },
    { url: "https://www.cnbc.com/id/100003114/device/rss/rss.html",                          category: "finance", source: "CNBC",        icon: "https://www.cnbc.com/favicon.ico" },
    { url: "https://www.marketwatch.com/rss/topstories",                                     category: "finance", source: "MarketWatch", icon: "https://www.marketwatch.com/favicon.ico" },
    { url: "https://feeds.bloomberg.com/markets/news.rss",                                   category: "finance", source: "Bloomberg",   icon: "https://www.bloomberg.com/favicon.ico" },
  ];

  async function fetchNewsRss(feedUrl: string, category: string, source: string, sourceIcon: string): Promise<any[]> {
    try {
      const res = await fetch(feedUrl, { headers: { "User-Agent": "Mozilla/5.0 (compatible; Weered/1.0)" } });
      const xml = await res.text();
      const items: any[] = [];
      const itemRx  = /<item[^>]*>([\s\S]*?)<\/item>/g;
      const titleRx = /<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/;
      const linkRx  = /<link>\s*(?:<!\[CDATA\[)?\s*(https?:\/\/[^<\s]+?)\s*(?:\]\]>)?\s*<\/link>/;
      const dateRx  = /<pubDate>(.*?)<\/pubDate>/;
      const descRx  = /<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/;
      const imgRx1  = /<media:content[^>]+url=["']([^"']+)["']/;
      const imgRx2  = /<media:thumbnail[^>]+url=["']([^"']+)["']/;
      const imgRx3  = /<enclosure[^>]+url=["']([^"']+)["'][^>]+type=["']image/;
      const imgRx4  = /<img[^>]+src=["']([^"']+)["']/;
      let m: RegExpExecArray | null;
      while ((m = itemRx.exec(xml)) !== null) {
        const block = m[1];
        const title = titleRx.exec(block)?.[1]?.trim();
        const link  = linkRx.exec(block)?.[1]?.trim();
        const dateStr = dateRx.exec(block)?.[1];
        const rawDesc = descRx.exec(block)?.[1] || "";
        const desc  = rawDesc
          .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&#x27;/g, "'")
          .replace(/<[^>]+>/g, " ")
          .replace(/https?:\/\/\S+/g, "")
          .replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim().slice(0, 250);
        const img   = imgRx4.exec(rawDesc)?.[1] || imgRx1.exec(block)?.[1] || imgRx2.exec(block)?.[1] || imgRx3.exec(block)?.[1] || null;
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
    } catch (e) { console.warn(`[news] RSS ${feedUrl} failed:`, e); return []; }
  }

  const newsCache = new Map<string, { articles: any[]; cachedAt: number }>();
  const NEWS_CACHE_TTL = 5 * 60 * 1000;

  async function runNewsWorker() {
    console.log("[news] worker starting fetch...");
    try {
      const results = await Promise.allSettled(
        NEWS_FEEDS.map(f => fetchNewsRss(f.url, f.category, f.source, f.icon))
      );
      const all = results.flatMap(r => r.status === "fulfilled" ? r.value : []);
      const seen = new Set<string>();
      const deduped = all.filter(a => { if (!a.guid || seen.has(a.guid)) return false; seen.add(a.guid); return true; });

      let upserted = 0;
      for (const a of deduped) {
        try {
          await prisma.newsArticle.upsert({
            where: { guid: a.guid },
            update: { heat: a.heat, title: a.title, description: a.description, imageUrl: a.imageUrl },
            create: a,
          });
          upserted++;
        } catch {}
      }

      await prisma.newsArticle.deleteMany({
        where: { publishedAt: { lt: new Date(Date.now() - 72 * 3600 * 1000) } },
      });

      newsCache.clear();
      console.log(`[news] worker done: ${upserted} upserted from ${deduped.length} articles`);
    } catch (e) { console.error("[news] worker error:", e); }
  }

  await app.register(newsRoutes);

  const annDb = prisma as any;

  (async () => {
    try {
      const count = await annDb.announcement.count();
      if (count === 0) {
        await annDb.announcement.create({ data: {
          message: "Early access build — things may break. Report bugs in the Forum. New features ship daily. Type @operator in any chat for help.",
          level: "info", pinned: true, sticky: true, createdById: "system", createdByName: "Weered",
        } });
      }
    } catch (e) { console.warn("[announcements] seed:", e); }
  })();

  await app.register(desktopRoutes, {} as any);

  await app.register(youtubeRoutes);

  await app.register(aiRoutes, { authFromHeader, isAIAvailable, getAI, rooms } as any);

  runNewsWorker();
  setInterval(runNewsWorker, 15 * 60 * 1000);

  await seedLobbies();

  await app.register(modsRoutes, { verifyToken } as any);

  wss = new WebSocketServer({ port: WS_PORT });
  app.log.info(`WS listening on ws://127.0.0.1:${WS_PORT}`);

  wss.on("connection", (rawWs) => {
    const ws = rawWs as Sock;

    ws.on("message", (raw) => {
      (async () => {
        const msg = safeJson(raw);
        if (!msg || typeof msg.type !== "string") return;

        if (msg.type === "auth:hello") {
          const u = verifyToken(msg.token);
          if (!u) { send(ws, { type: "auth:fail", reason: "Invalid token" }); return; }
          ws.user = await hydrateGlobalRole(u);
          if (await isGloballyBanned(ws.user.id)) {
            send(ws, { type: "auth:fail", reason: "Your account has been suspended." });
            try { ws.close(4003, "banned"); } catch {}
            return;
          }
          send(ws, { type: "auth:ok", user: { id: ws.user.id, name: ws.user.name, globalRole: ws.user.globalRole, tier: ws.user.tier || "INNOCENT", avatarColor: ws.user.avatarColor, avatar: ws.user.avatar, panelBgColor: (ws.user as any).panelBgColor, panelAccentColor: (ws.user as any).panelAccentColor, pillBgColor: (ws.user as any).pillBgColor, pillAccentColor: (ws.user as any).pillAccentColor } });
          awardNotoriety(ws.user.id, "DAILY_ACTIVE").catch(() => {});
          (async () => {
            try {
              const memberships = await (prisma as any).crewMember.findMany({ where: { userId: ws.user!.id }, select: { crewId: true } });
              if (!memberships.length) return;
              const crewIds = memberships.map((m: any) => m.crewId);
              const mates = await (prisma as any).crewMember.findMany({ where: { crewId: { in: crewIds }, userId: { not: ws.user!.id } }, select: { userId: true, crewId: true } });
              const payload = { type: "crew:presence", userId: ws.user!.id, name: ws.user!.name, online: true };
              for (const mate of mates) {
                for (const sock of wss.clients) {
                  if ((sock as any).user?.id === mate.userId) send(sock as Sock, payload);
                }
              }
            } catch {}
          })();
          return;
        }

        if (!ws.user) { send(ws, { type: "auth:fail", reason: "Not authenticated" }); return; }

        if (msg.type === "rooms:list" || msg.type === "lobby:rooms" || msg.type === "room:list"
            || msg.type === "presence:join" || msg.type === "presence:idle" || msg.type === "presence:leave") {
          await handlePresence(ws, msg, { rooms, send, broadcast, normalizeRoomId, ensureRoomLoaded, isModOrOwner, doJoin, publishState, leaveRoom });
          return;
        }

        if (msg.type === "chat:pin" || msg.type === "chat:unpin") {
          if (!ws.user?.id || !ws.roomId) return;
          const room = rooms.get(ws.roomId);
          if (!room) return;
          if (!isModOrOwner(room, ws.user.id, ws.user.globalRole)) return;
          const msgId = String((msg as any).msgId || "");
          if (!msgId) return;
          (room as any).pinned = (room as any).pinned || new Set<string>();
          if (msg.type === "chat:pin") {
            if ((room as any).pinned.size >= 10) {
              send(ws, { type: "chat:pin:error", reason: "Pinned limit is 10. Unpin one first." });
              return;
            }
            (room as any).pinned.add(msgId);
          } else {
            (room as any).pinned.delete(msgId);
          }
          broadcast(room, { type: "chat:pins", roomId: room.roomId, pinned: Array.from((room as any).pinned) });
          return;
        }

        if (msg.type === "chat:typing") {
          if (!ws.user?.id || !ws.roomId) return;
          const room = rooms.get(ws.roomId);
          if (!room || !room.users.has(ws.user.id)) return;
          broadcast(room, {
            type: "chat:typing",
            roomId: room.roomId,
            user: { id: ws.user.id, name: ws.user.name },
          });
          return;
        }

        if (msg.type === "launch:set" || msg.type === "launch:clear"
            || msg.type === "launch:slot" || msg.type === "launch:ready"
            || msg.type === "launch:fire" || msg.type === "launch:abort") {
          handleLaunch(ws, msg, { rooms, ensureLaunch, isOwner, isElevatedGlobal, broadcastLaunch });
          return;
        }

        if (handleCanvas(ws, msg, { normalizeRoomId, rooms, broadcast, isModOrOwner, send })) return;

        if (typeof msg.type === "string" && msg.type.startsWith("voice:")) {
          handleVoice(ws, msg, { broadcast, send, normalizeRoomId, rooms, isModOrOwner });
          return;
        }
        if (msg.type === "room:close") {
          const roomId = normalizeRoomId(String(msg.roomId || ws.roomId || ""));
          if (!roomId) return;
          const room = rooms.get(roomId);
          if (!room) return;
          if (!isModOrOwner(room, ws.user.id, ws.user?.globalRole)) return;

          if (room.pinned) {
            for (const s of room.sockets) {
              send(s, { type: "room:closed", roomId, by: ws.user.name });
              try { s.close(4004, "room:closed"); } catch {}
            }
            room.users.clear();
            room.sockets.clear();
            room.msgs = [];
            room.activeModule = null;
            return;
          }

          for (const s of room.sockets) {
            send(s, { type: "room:closed", roomId, by: ws.user.name });
            try { s.close(4004, "room:closed"); } catch {}
          }

          room.users.clear();
          room.sockets.clear();
          room.msgs = [];
          room.activeModule = null;

          try {
            await prisma.roomMessage.deleteMany({ where: { roomId } }).catch(() => {});
            await prisma.roomMember.deleteMany({ where: { roomId } }).catch(() => {});
            await prisma.room.delete({ where: { id: roomId } }).catch(() => {});
          } catch {}

          rooms.delete(roomId);

          await globalAudit(ws.user.id, ws.user.name, "room_close", roomId);
          return;
        }
        if (msg.type === "chat:send") {
          const roomId = normalizeRoomId(String(msg.roomId || ""));
          const body = String(msg.body || "").trim();
          const attachmentId = String((msg as any).attachmentId || "").slice(0, 40);
          if (!roomId || (!body && !attachmentId)) return;
          const room = await ensureRoomLoaded(roomId);
          if (!room.users.has(ws.user.id)) return;
          if (room.banned.has(ws.user.id)) return;
          if (room.muted.has(ws.user.id)) return;
          const urlCheck = checkUrlSpam(body);
          if (!urlCheck.ok) { send(ws, { type: "chat:rejected", roomId, reason: urlCheck.reason }); return; }
          const rate = checkChatRateLimit(ws.user.id);
          if (!rate.ok) { send(ws, { type: "chat:rejected", roomId, reason: rate.reason, retryInMs: rate.retryInMs }); return; }
          if (room.lobbyId) {
            const cache = (room as any).modPolicy as { blockedWords: string[]; blockedDomains: string[]; newAccountChatHours: number; expiresAt: number } | undefined;
            let policy = cache && cache.expiresAt > Date.now() ? cache : null;
            if (!policy) {
              try {
                const l: any = await (prisma as any).lobby.findUnique({
                  where: { id: room.lobbyId },
                  select: { blockedWords: true, blockedDomains: true, newAccountChatHours: true },
                });
                policy = {
                  blockedWords: Array.isArray(l?.blockedWords) ? l.blockedWords : [],
                  blockedDomains: Array.isArray(l?.blockedDomains) ? l.blockedDomains : [],
                  newAccountChatHours: Number(l?.newAccountChatHours || 0),
                  expiresAt: Date.now() + 60_000,
                };
                (room as any).modPolicy = policy;
              } catch { policy = { blockedWords: [], blockedDomains: [], newAccountChatHours: 0, expiresAt: Date.now() + 60_000 }; }
            }
            if (policy.newAccountChatHours > 0) {
              try {
                const u = await prisma.user.findUnique({ where: { id: ws.user.id }, select: { createdAt: true } });
                if (u && (Date.now() - u.createdAt.getTime()) < policy.newAccountChatHours * 3600 * 1000) {
                  send(ws, { type: "chat:rejected", roomId, reason: "account_too_new", message: `New accounts must wait ${policy.newAccountChatHours}h before chatting in this lobby.` });
                  return;
                }
              } catch {}
            }
            if (policy.blockedWords.length > 0) {
              const lower = body.toLowerCase();
              const hit = policy.blockedWords.find(w => w && lower.includes(String(w).toLowerCase()));
              if (hit) {
                send(ws, { type: "chat:rejected", roomId, reason: "blocked_word" });
                return;
              }
            }
            if (policy.blockedDomains.length > 0) {
              const urls = body.match(/https?:\/\/[^\s)]+/gi) || [];
              const bad = urls.find(u => policy!.blockedDomains.some(d => d && u.toLowerCase().includes(String(d).toLowerCase())));
              if (bad) {
                send(ws, { type: "chat:rejected", roomId, reason: "blocked_domain" });
                return;
              }
            }
          }
          let replyTo: ReplyTo | undefined;
          const replyToId = typeof msg.replyToId === "string" ? msg.replyToId : "";
          if (replyToId) {
            const parent = room.msgs.find(x => x.id === replyToId);
            if (parent && !parent.deletedAt) {
              replyTo = {
                id: parent.id,
                userId: parent.user.id,
                userName: parent.user.name,
                body: String(parent.body || "").slice(0, 120),
              };
            }
          }
          let attachment: ChatAttachmentRef | undefined;
          if (attachmentId) {
            try {
              const att: any = await (prisma as any).chatAttachment.findUnique({ where: { id: attachmentId } });
              if (att && att.uploaderId === ws.user.id && att.status === "ACTIVE"
                  && Date.now() - new Date(att.createdAt).getTime() < 15 * 60_000) {
                attachment = { id: att.id, url: att.url, thumbUrl: att.thumbUrl, w: att.width, h: att.height, trusted: att.trusted, expiresAt: att.expiresAt ? new Date(att.expiresAt).toISOString() : null };
                if (!att.roomId) void (prisma as any).chatAttachment.update({ where: { id: att.id }, data: { roomId: room.roomId } }).catch(() => {});
              }
            } catch {}
            if (!attachment) { send(ws, { type: "chat:rejected", roomId, reason: "bad_attachment" }); return; }
          }
          const u = room.users.get(ws.user.id)!;
          const m: ChatMsg = { id: randomUUID(), user: { id: u.id, name: u.name, role: roleOf(room, u.id), avatarColor: (u as any).avatarColor, avatar: (u as any).avatar }, body, ts: Date.now(), replyTo, attachment };
          room.msgs.push(m);
          if (room.msgs.length > 200) room.msgs.splice(0, room.msgs.length - 200);
          if (room.roomId !== "lobby") {
            void prisma.roomMessage.create({
              data: {
                id: m.id, roomId: room.roomId, userId: m.user.id, userName: m.user.name, body: m.body, ts: new Date(m.ts),
                replyToId: replyTo?.id ?? null,
                replyToUserId: replyTo?.userId ?? null,
                replyToUserName: replyTo?.userName ?? null,
                replyToBody: replyTo?.body ?? null,
              } as any,
            }).catch(() => {});
          }
          broadcast(room, { type: "chat:new", roomId, msg: m });
          room.lastActiveAt = Date.now();
          awardNotoriety(ws.user.id, "CHAT_MESSAGE").catch(() => {});
          (async () => {
            try {
              const mentioned = await resolveMentions(body, ws.user!.id);
              const roomPath = room.lobbyId ? `/lobby/${room.lobbyId}` : `/room/${room.roomId}`;
              for (const u of mentioned) {
                createNotification({
                  userId: u.id,
                  type: "MENTION",
                  title: `${ws.user!.name} mentioned you in ${room.name || "a lobby"}`,
                  body: body.slice(0, 120),
                  actorId: ws.user!.id,
                  actorName: ws.user!.name,
                  actionUrl: roomPath,
                }).catch(() => {});
              }
            } catch {}
          })();
          if (body.toLowerCase().includes("@operator") || body.toLowerCase().startsWith("/ask ")) {
            const question = body.replace(/@operator/gi, "").replace(/^\/ask\s*/i, "").trim();
            if (question.length > 0) {
              (async () => {
                try {
                  const ai = await getAI();
                  if (!ai) return;
                  const response = await ai.messages.create({
                      model: "claude-haiku-4-5-20251001",
                      max_tokens: 300,
                      system: buildOperatorSystemPrompt(room.lobbyId || ""),
                      messages: [{ role: "user", content: question }],
                    });
                    const reply = response?.content?.[0]?.text || "";
                    if (reply) {
                      const botMsg = {
                        id: randomUUID(),
                        user: { id: "operator", name: "The Operator", role: "SYSTEM" as any, avatarColor: "#D4A017", avatar: "/brand/roles/operator.svg" },
                        body: reply,
                        ts: Date.now(),
                      };
                      room.msgs.push(botMsg);
                      if (room.msgs.length > 200) room.msgs.splice(0, room.msgs.length - 200);
                      broadcast(room, { type: "chat:new", roomId, msg: botMsg });
                    }
                  } catch (e) { console.error("[operator]", e); }
                })();
              }
          }
          return;
        }

        if (msg.type === "chat:edit") {
          const rId = normalizeRoomId(String(msg.roomId || ""));
          const msgId = String(msg.msgId || "");
          const newBody = String(msg.body || "").trim();
          if (!rId || !msgId || !newBody) return;
          const room = await ensureRoomLoaded(rId);
          if (room.banned.has(ws.user.id)) return;
          const target = room.msgs.find(m => m.id === msgId);
          if (!target) return;
          if (target.deletedAt) return;
          if (target.user.id !== ws.user.id) return;
          if (target.body === newBody) return;
          if (Date.now() - target.ts > 15 * 60 * 1000) return;
          target.body = newBody;
          const editedAt = Date.now();
          target.editedAt = editedAt;
          if (room.roomId !== "lobby") {
            void prisma.roomMessage.update({
              where: { id: msgId },
              data: { body: newBody, editedAt: new Date(editedAt) },
            }).catch(() => {});
          }
          broadcast(room, { type: "chat:edited", roomId: rId, msgId, body: newBody, editedAt });
          return;
        }

        if (msg.type === "chat:delete") {
          const rId = normalizeRoomId(String(msg.roomId || ""));
          const msgId = String(msg.msgId || "");
          if (!rId || !msgId) return;
          const room = await ensureRoomLoaded(rId);
          const target = room.msgs.find(m => m.id === msgId);
          if (!target) return;
          if (target.deletedAt) return;
          const isSender = target.user.id === ws.user.id;
          const isMod = isModOrOwner(room, ws.user.id, ws.user.globalRole);
          if (!isSender && !isMod) return;
          const deletedAt = Date.now();
          target.deletedAt = deletedAt;
          target.body = "";
          if (room.roomId !== "lobby") {
            void prisma.roomMessage.update({
              where: { id: msgId },
              data: { body: "", deletedAt: new Date(deletedAt) },
            }).catch(() => {});
          }
          broadcast(room, { type: "chat:deleted", roomId: rId, msgId, deletedAt });
          return;
        }

        if (msg.type === "reaction:toggle") {
          const rId = normalizeRoomId(String(msg.roomId || ""));
          const msgId = String(msg.msgId || "");
          const emoji = String(msg.emoji || "").trim().slice(0, 12);
          if (!rId || !msgId || !emoji) return;
          const room = await ensureRoomLoaded(rId);
          if (room.banned.has(ws.user.id)) return;
          const target = room.msgs.find(m => m.id === msgId);
          if (!target || target.deletedAt) return;

          if (room.roomId !== "lobby") {
            try {
              const existing = await (prisma as any).reaction.findUnique({
                where: { targetType_targetId_userId_emoji: { targetType: "ROOM_MESSAGE", targetId: msgId, userId: ws.user.id, emoji } },
              });
              if (existing) {
                await (prisma as any).reaction.delete({ where: { id: existing.id } });
              } else {
                const distinctCount = await (prisma as any).reaction.groupBy({
                  by: ["emoji"], where: { targetType: "ROOM_MESSAGE", targetId: msgId },
                });
                if (distinctCount.length >= 20 && !distinctCount.find((d: any) => d.emoji === emoji)) {
                  send(ws, { type: "reaction:rejected", roomId: rId, msgId, reason: "Too many different reactions on this message." });
                  return;
                }
                await (prisma as any).reaction.create({
                  data: { targetType: "ROOM_MESSAGE", targetId: msgId, userId: ws.user.id, emoji },
                });
              }
              const rows = await (prisma as any).reaction.findMany({
                where: { targetType: "ROOM_MESSAGE", targetId: msgId },
                select: { emoji: true, userId: true },
              });
              const agg: Record<string, { count: number; users: string[] }> = {};
              for (const r of rows) {
                if (!agg[r.emoji]) agg[r.emoji] = { count: 0, users: [] };
                agg[r.emoji].count++;
                if (agg[r.emoji].users.length < 12) agg[r.emoji].users.push(r.userId);
              }
              const reactions = Object.entries(agg).map(([e, v]) => ({ emoji: e, count: v.count, users: v.users }));
              target.reactions = reactions;
              broadcast(room, { type: "reaction:changed", roomId: rId, msgId, reactions });
            } catch (e) { console.error("[reaction:toggle]", e); }
          } else {
            target.reactions = target.reactions || [];
            const existing = target.reactions.find(r => r.emoji === emoji);
            if (existing) {
              if (existing.users.includes(ws.user!.id)) {
                existing.users = existing.users.filter(u => u !== ws.user!.id);
                existing.count = Math.max(0, existing.count - 1);
                if (existing.count === 0) target.reactions = target.reactions.filter(r => r.emoji !== emoji);
              } else {
                existing.users.push(ws.user!.id);
                existing.count++;
              }
            } else {
              if (target.reactions.length >= 20) {
                send(ws, { type: "reaction:rejected", roomId: rId, msgId, reason: "Too many different reactions on this message." });
                return;
              }
              target.reactions.push({ emoji, count: 1, users: [ws.user.id] });
            }
            broadcast(room, { type: "reaction:changed", roomId: rId, msgId, reactions: target.reactions });
          }
          return;
        }

        const isCrewOrDm = typeof msg.type === "string" && (msg.type.startsWith("crew:") || msg.type.startsWith("dm:"));
        const roomId = normalizeRoomId(String(msg.roomId || ws.roomId || ws.pendingRoomId || ""));
        if (!roomId && !isCrewOrDm) return;
        const room = roomId ? await ensureRoomLoaded(roomId) : (null as unknown as RoomState);

        const actorId = ws.user.id;
        const actorName = ws.user.name;
        const actorGlobalRole = ws.user.globalRole || "USER";
        const actorIsMod = roomId ? isModOrOwner(room, actorId, actorGlobalRole) : false;
        const actorIsOwner = roomId ? (isOwner(room, actorId) || isElevatedGlobal(actorGlobalRole)) : false;

        if (msg.type === "room:getAdminState") {
          publishState(room);
          return;
        }

        if (msg.type === "room:rename") {
          if (!actorIsMod) return;
          const nextName = String(msg.name || "").trim().slice(0, 64);
          if (!nextName) return;
          room.name = nextName;
          await persistRoomBasics(room);
          audit(room, { type: "room:rename", actorId, actorName, note: nextName });
          publishState(room);
          broadcast(room, { type: "room:renamed", roomId, name: room.name });
          return;
        }

        if (msg.type === "room:lock") {
          if (!actorIsMod) return;
          room.locked = true;
          await persistRoomBasics(room);
          audit(room, { type: "room:lock", actorId, actorName });
          publishState(room);
          broadcast(room, { type: "room:locked", roomId, locked: true });
          return;
        }

        if (msg.type === "room:unlock") {
          if (!actorIsMod) return;
          room.locked = false;
          await persistRoomBasics(room);
          audit(room, { type: "room:unlock", actorId, actorName });
          publishState(room);
          broadcast(room, { type: "room:locked", roomId, locked: false });
          return;
        }

        if (msg.type === "room:admit") {
          if (!actorIsMod) return;
          const targetId = String(msg.userId || "");
          if (!targetId) return;
          removeKnock(room, targetId);
          const set = room.pending.get(targetId);
          if (set && set.size) {
            for (const s of set) {
              if (!s.user || s.user.id !== targetId) continue;
              await doJoin(s, roomId);
              send(s, { type: "room:admitted", roomId });
            }
          }
          removePending(room, targetId);
          audit(room, { type: "room:admit", actorId, actorName, targetId });
          publishState(room);
          return;
        }

        if (msg.type === "room:deny") {
          if (!actorIsMod) return;
          const targetId = String(msg.userId || "");
          if (!targetId) return;
          removeKnock(room, targetId);
          const set = room.pending.get(targetId);
          if (set && set.size) {
            for (const s of set) { send(s, { type: "room:denied", roomId }); try { s.pendingRoomId = undefined; } catch {} }
          }
          removePending(room, targetId);
          audit(room, { type: "room:deny", actorId, actorName, targetId });
          publishState(room);
          return;
        }

        if (msg.type === "staff:kick") {
          const kickActorId = ws.user?.id || "";
          const kickActorName = ws.user?.name || "staff";
          if (!kickActorId) return;
          const kickRole = await getGlobalRole(kickActorId);
          if (!canAccessStaff(kickRole)) return;
          const targetId = String(msg.userId || "");
          if (!targetId || targetId === kickActorId) return;
          for (const r of rooms.values()) {
            if (r.users.has(targetId) || r.mods.has(targetId)) {
              r.users.delete(targetId);
              r.mods.delete(targetId);
              try {
                for (const s of findSocketsByUser(r, targetId)) {
                  send(s, { type: "staff:kicked", roomId: r.roomId });
                  try { (s as any).roomId = undefined; } catch {}
                  try { (s as any).pendingRoomId = undefined; } catch {}
                  try { (s as any).close(4001, "staff:kick"); } catch {}
                }
              } catch {}
              broadcast(r, { type: "presence:leave", roomId: r.roomId, userId: targetId });
              audit(r, { type: "staff:kick", actorId: kickActorId, actorName: kickActorName, targetId });
              publishState(r);
            }
          }
          try {
            for (const c of wss.clients) {
              const s = c as any;
              if (s?.user?.id && String(s.user.id) === targetId) {
                send(s, { type: "staff:kicked" });
                try { s.close(4001, "staff:kick"); } catch {}
              }
            }
          } catch {}
          return;
        }

        if (msg.type === "mod:mute") {
          if (!actorIsMod) return;
          const targetId = String(msg.userId || "");
          if (!targetId || isOwner(room, targetId)) return;
          room.muted.add(targetId);
          for (const s of findSocketsByUser(room, targetId)) send(s, { type: "mod:muted", roomId });
          audit(room, { type: "mod:mute", actorId, actorName, targetId });
          publishState(room);
          return;
        }

        if (msg.type === "mod:unmute") {
          if (!actorIsMod) return;
          const targetId = String(msg.userId || "");
          if (!targetId) return;
          room.muted.delete(targetId);
          for (const s of findSocketsByUser(room, targetId)) send(s, { type: "mod:unmuted", roomId });
          audit(room, { type: "mod:unmute", actorId, actorName, targetId });
          publishState(room);
          return;
        }

        if (msg.type === "mod:kick") {
          if (!actorIsMod) return;
          const targetId = String(msg.userId || "");
          if (!targetId || isOwner(room, targetId)) return;
          room.users.delete(targetId);
          room.mods.delete(targetId);
          if (room.roomId !== "lobby") {
            void prisma.roomMember.updateMany({ where: { roomId: room.roomId, userId: targetId }, data: { role: RoomRole.MEMBER } }).catch(() => {});
          }
          for (const s of findSocketsByUser(room, targetId)) {
            send(s, { type: "mod:kicked", roomId });
            try { (s as any).roomId = undefined; } catch {}
          }
          broadcast(room, { type: "presence:leave", roomId, userId: targetId });
          audit(room, { type: "mod:kick", actorId, actorName, targetId });
          publishState(room);
          return;
        }

        if (msg.type === "mod:ban") {
          if (!actorIsMod) return;
          const targetId = String(msg.userId || "");
          if (!targetId || isOwner(room, targetId)) return;
          room.banned.add(targetId);
          room.users.delete(targetId);
          room.mods.delete(targetId);
          if (room.roomId !== "lobby") {
            void prisma.roomBan.upsert({
              where: { roomId_userId: { roomId: room.roomId, userId: targetId } },
              update: {}, create: { roomId: room.roomId, userId: targetId },
            }).catch(() => {});
          }
          for (const s of findSocketsByUser(room, targetId)) {
            send(s, { type: "mod:banned", roomId });
            try { (s as any).roomId = undefined; } catch {}
          }
          broadcast(room, { type: "presence:leave", roomId, userId: targetId });
          audit(room, { type: "mod:ban", actorId, actorName, targetId });
          publishState(room);
          return;
        }

        if (msg.type === "mod:unban") {
          if (!actorIsMod) return;
          const targetId = String(msg.userId || "");
          if (!targetId) return;
          room.banned.delete(targetId);
          if (room.roomId !== "lobby") {
            void prisma.roomBan.deleteMany({ where: { roomId: room.roomId, userId: targetId } }).catch(() => {});
          }
          audit(room, { type: "mod:unban", actorId, actorName, targetId });
          publishState(room);
          return;
        }

        if (msg.type === "mod:promote") {
          if (!actorIsOwner) return;
          const targetId = String(msg.userId || "");
          if (!targetId || isOwner(room, targetId)) return;
          room.mods.add(targetId);
          if (room.roomId !== "lobby") {
            void prisma.roomMember.upsert({
              where: { roomId_userId: { roomId: room.roomId, userId: targetId } },
              update: { role: RoomRole.MOD },
              create: { roomId: room.roomId, userId: targetId, name: "", role: RoomRole.MOD },
            }).catch(() => {});
          }
          audit(room, { type: "mod:promote", actorId, actorName, targetId });
          publishState(room);
          return;
        }

        if (msg.type === "mod:demote") {
          if (!actorIsOwner) return;
          const targetId = String(msg.userId || "");
          if (!targetId || isOwner(room, targetId)) return;
          room.mods.delete(targetId);
          if (room.roomId !== "lobby") {
            void prisma.roomMember.updateMany({ where: { roomId: room.roomId, userId: targetId }, data: { role: RoomRole.MEMBER } }).catch(() => {});
          }
          audit(room, { type: "mod:demote", actorId, actorName, targetId });
          publishState(room);
          return;
        }

        if (typeof msg.type === "string" && msg.type.startsWith("youtube:")) {
          handleYoutube(ws, msg, { room, roomId }, { send });
          return;
        }

        if (handleCanvasRelay(ws, msg, { room, roomId }, { send })) return;

        if (msg.type === "poker:join") {
          const tableId = String(msg.tableId || "").trim();
          const buyin = Number(msg.buyin || 0);
          if (!ws.user || !tableId || !buyin) return;

          const table = getOrCreatePokerTable(tableId);

          if (buyin < table.minBuyin || buyin > table.maxBuyin) {
            send(ws, { type: "poker:error", error: `Buy-in must be between ${table.minBuyin} and ${table.maxBuyin} Paper` });
            return;
          }

          if (table.seats.some(s => s && s.userId === ws.user!.id)) {
            send(ws, { type: "poker:error", error: "Already seated at this table" });
            return;
          }

          const emptySeatIndex = table.seats.findIndex(s => s === null);
          if (emptySeatIndex === -1) {
            send(ws, { type: "poker:error", error: "Table is full" });
            return;
          }

          try {
            const res = await awardPaper(ws.user.id, "POKER_BUYIN", -buyin, `Poker buy-in at table ${tableId}`, tableId);
            if (!res) {
              send(ws, { type: "poker:error", error: "Insufficient Paper balance" });
              return;
            }
          } catch (e) {
            console.error("[poker:join] Paper deduction failed:", e);
            send(ws, { type: "poker:error", error: "Failed to process buy-in" });
            return;
          }

          table.seats[emptySeatIndex] = {
            userId: ws.user.id,
            name: ws.user.name,
            chips: buyin,
            cards: [],
            folded: false,
            allIn: false,
            bet: 0,
            seatIndex: emptySeatIndex,
          };

          table.spectators.delete(ws.user.id);

          console.log(`[poker] ${ws.user.name} joined table ${tableId} seat ${emptySeatIndex} with ${buyin} chips`);
          broadcastPokerState(tableId);

          const seatedCount = table.seats.filter(s => s !== null).length;
          if (seatedCount >= 2 && table.phase === "waiting") {
            setTimeout(() => {
              const t = pokerTables.get(tableId);
              if (t && t.phase === "waiting" && t.seats.filter(s => s !== null).length >= 2) {
                startPokerHand(t);
              }
            }, 2000);
          }
          return;
        }

        if (msg.type === "poker:spectate") {
          const tableId = String(msg.tableId || "").trim();
          if (!ws.user || !tableId) return;
          const table = getOrCreatePokerTable(tableId);
          if (!table.seats.some(s => s && s.userId === ws.user!.id)) {
            table.spectators.add(ws.user.id);
          }
          send(ws, { type: "poker:state", ...buildPokerStateForUser(table, ws.user.id) });
          return;
        }

        if (msg.type === "poker:leave") {
          const tableId = String(msg.tableId || "").trim();
          if (!ws.user || !tableId) return;
          const table = pokerTables.get(tableId);
          if (!table) return;

          const seatIdx = table.seats.findIndex(s => s && s.userId === ws.user!.id);
          if (seatIdx === -1) {
            table.spectators.delete(ws.user.id);
            return;
          }

          const seat = table.seats[seatIdx]!;

          if (table.handInProgress && seat.cards.length > 0 && !seat.folded) {
            seat.folded = true;
            if (table.turnIndex === seatIdx) {
            }
          }

          if (seat.chips > 0) {
            try {
              const user = await prisma.user.findUnique({ where: { id: ws.user.id }, select: { paper: true } });
              if (user) {
                const newBalance = (user as any).paper + seat.chips;
                await prisma.$transaction([
                  (prisma as any).paperTransaction.create({
                    data: {
                      userId: ws.user.id,
                      type: "POKER_CASHOUT",
                      amount: seat.chips,
                      balance: newBalance,
                      description: `Left poker table ${tableId} with ${seat.chips} chips`,
                      refId: tableId,
                    },
                  }),
                  prisma.user.update({ where: { id: ws.user.id }, data: { paper: newBalance } }),
                ]);
              }
            } catch (e) {
              console.error("[poker:leave] Chip return failed:", e);
            }
          }

          const wasTheirTurn = table.turnIndex === seatIdx;
          table.seats[seatIdx] = null;

          console.log(`[poker] ${ws.user.name} left table ${tableId}`);

          send(ws, { type: "poker:state", ...buildPokerStateForUser(table, ws.user.id), youLeft: true });

          if (wasTheirTurn && table.handInProgress) {
            advancePokerGame(table);
          } else {
            broadcastPokerState(tableId);
          }

          if (table.handInProgress && activePlayersInHand(table).length <= 1) {
            advancePokerGame(table);
          }
          return;
        }

        if (msg.type === "poker:start") {
          const tableId = String(msg.tableId || "").trim();
          if (!ws.user || !tableId) return;
          const table = pokerTables.get(tableId);
          if (!table) { send(ws, { type: "poker:error", error: "Table not found" }); return; }

          if (!table.seats.some(s => s && s.userId === ws.user!.id)) {
            send(ws, { type: "poker:error", error: "Not seated at this table" });
            return;
          }

          if (table.handInProgress) {
            send(ws, { type: "poker:error", error: "Hand already in progress" });
            return;
          }

          if (activeSeatCount(table) < 2) {
            send(ws, { type: "poker:error", error: "Need at least 2 players" });
            return;
          }

          startPokerHand(table);
          return;
        }

        if (msg.type === "poker:action") {
          const tableId = String(msg.tableId || "").trim();
          const action = String(msg.action || "").trim().toLowerCase();
          const amount = Number(msg.amount || 0);
          if (!ws.user || !tableId || !action) return;

          const table = pokerTables.get(tableId);
          if (!table || !table.handInProgress) {
            send(ws, { type: "poker:error", error: "No active hand" });
            return;
          }

          const seatIdx = table.seats.findIndex(s => s && s.userId === ws.user!.id);
          if (seatIdx === -1) { send(ws, { type: "poker:error", error: "Not seated" }); return; }

          const seat = table.seats[seatIdx]!;

          if (table.turnIndex !== seatIdx) {
            send(ws, { type: "poker:error", error: "Not your turn" });
            return;
          }

          if (seat.folded || seat.allIn) {
            send(ws, { type: "poker:error", error: "Cannot act" });
            return;
          }

          const toCall = table.currentBet - seat.bet;

          let actionAmount: number | undefined;

          if (action === "fold") {
            seat.folded = true;
          } else if (action === "check") {
            if (toCall > 0) {
              send(ws, { type: "poker:error", error: "Cannot check — must call, raise, or fold" });
              return;
            }
          } else if (action === "call") {
            if (toCall <= 0) {
            } else {
              const callAmount = Math.min(toCall, seat.chips);
              seat.chips -= callAmount;
              seat.bet += callAmount;
              if (seat.chips === 0) seat.allIn = true;
              actionAmount = callAmount;
            }
          } else if (action === "raise") {
            if (amount <= 0) { send(ws, { type: "poker:error", error: "Raise amount required" }); return; }

            const totalBet = amount;
            const raiseAmount = totalBet - seat.bet;

            if (raiseAmount <= 0 || raiseAmount > seat.chips) {
              send(ws, { type: "poker:error", error: "Invalid raise amount" });
              return;
            }

            if (totalBet < table.currentBet * 2 && raiseAmount < seat.chips) {
              send(ws, { type: "poker:error", error: `Minimum raise is ${table.currentBet * 2}` });
              return;
            }

            seat.chips -= raiseAmount;
            seat.bet = totalBet;
            table.currentBet = totalBet;
            if (seat.chips === 0) seat.allIn = true;
            actionAmount = totalBet;
          } else if (action === "allin") {
            const allInAmount = seat.chips;
            seat.bet += allInAmount;
            seat.chips = 0;
            seat.allIn = true;
            if (seat.bet > table.currentBet) {
              table.currentBet = seat.bet;
            }
            actionAmount = allInAmount;
          } else {
            send(ws, { type: "poker:error", error: `Unknown action: ${action}` });
            return;
          }

          table.lastAction = { userId: seat.userId, action, amount: actionAmount };

          broadcastToPokerTable(table.tableId, {
            type: "poker:action-chip",
            tableId: table.tableId,
            userId: seat.userId,
            userName: seat.name,
            action,
            amount: actionAmount,
            time: Date.now(),
          });

          advancePokerGame(table);
          return;
        }

        if (msg.type === "crew:send") {
          const crewId = String(msg.crewId || "").trim();
          const body = String(msg.body || "").trim().slice(0, 2000);
          const fromId = ws.user?.id;
          if (!fromId || !crewId || !body) return;
          const urlCheck = checkUrlSpam(body);
          if (!urlCheck.ok) { send(ws, { type: "crew:rejected", crewId, reason: urlCheck.reason }); return; }
          const rate = checkChatRateLimit(fromId);
          if (!rate.ok) { send(ws, { type: "crew:rejected", crewId, reason: rate.reason, retryInMs: rate.retryInMs }); return; }

          try {
            const membership = await (prisma as any).crewMember.findFirst({
              where: { crewId, userId: fromId },
            });
            if (!membership) return;

            let crewReplyData: any = {};
            const crewReplyToId = typeof msg.replyToId === "string" ? msg.replyToId : "";
            if (crewReplyToId) {
              const parent = await (prisma as any).crewMessage.findUnique({ where: { id: crewReplyToId } });
              if (parent && !parent.deletedAt && parent.crewId === crewId) {
                crewReplyData = {
                  replyToId: parent.id,
                  replyToUserId: parent.userId,
                  replyToUserName: parent.userName || "?",
                  replyToBody: String(parent.body || "").slice(0, 120),
                };
              }
            }

            const message = await (prisma as any).crewMessage.create({
              data: { crewId, userId: fromId, userName: ws.user?.name || "Unknown", body, ...crewReplyData },
              select: { id: true, crewId: true, userId: true, userName: true, body: true, createdAt: true, replyToId: true, replyToUserId: true, replyToUserName: true, replyToBody: true },
            });

            const members = await (prisma as any).crewMember.findMany({
              where: { crewId },
              select: { userId: true },
            });

            const payload = { type: "crew:message", crewId, message: { ...message, createdAt: message.createdAt.toISOString() } };
            for (const sock of wss.clients) {
              const sockUser = (sock as any).user;
              if (sockUser && members.some((m: any) => m.userId === sockUser.id)) {
                send(sock as any, payload);
              }
            }

            for (const m of members) {
              if (m.userId === fromId) continue;
              if (!isUserOnline(m.userId)) {
                sendPush(m.userId, {
                  title: `Crew message from ${ws.user?.name}`,
                  body: body.slice(0, 120),
                  url: "/home",
                  tag: `crew:${crewId}`,
                }).catch(() => {});
              }
            }

            awardNotoriety(fromId, "CHAT_MESSAGE").catch(() => {});

            (async () => {
              try {
                const mentioned = await resolveMentions(body, fromId);
                if (mentioned.length === 0) return;
                const memberRows = await (prisma as any).crewMember.findMany({
                  where: { crewId },
                  select: { userId: true },
                });
                const memberSet = new Set<string>(memberRows.map((r: any) => r.userId));
                for (const u of mentioned) {
                  if (!memberSet.has(u.id)) continue;
                  createNotification({
                    userId: u.id,
                    type: "MENTION",
                    title: `${ws.user?.name || "Someone"} mentioned you in crew chat`,
                    body: body.slice(0, 120),
                    actorId: fromId,
                    actorName: ws.user?.name || undefined,
                    actionUrl: "/home",
                    meta: { crewId },
                  }).catch(() => {});
                }
              } catch {}
            })();
          } catch (e) { console.error("[crew:send]", e); }
          return;
        }

        if (msg.type === "crew:edit") {
          const msgId = String(msg.msgId || "");
          const newBody = String(msg.body || "").trim().slice(0, 2000);
          const meId = ws.user?.id;
          if (!msgId || !newBody || !meId) return;
          try {
            const row = await (prisma as any).crewMessage.findUnique({ where: { id: msgId } });
            if (!row) return;
            if (row.userId !== meId) return;
            if (row.deletedAt) return;
            if (row.body === newBody) return;
            if (Date.now() - new Date(row.createdAt).getTime() > 15 * 60 * 1000) return;
            const editedAt = new Date();
            await (prisma as any).crewMessage.update({ where: { id: msgId }, data: { body: newBody, editedAt } });
            const members = await (prisma as any).crewMember.findMany({ where: { crewId: row.crewId }, select: { userId: true } });
            const memberIds = new Set(members.map((m: any) => m.userId));
            const payload = { type: "crew:edited", crewId: row.crewId, msgId, body: newBody, editedAt: editedAt.toISOString() };
            for (const sock of wss.clients) {
              const sockUser = (sock as any).user;
              if (sockUser && memberIds.has(sockUser.id)) send(sock as any, payload);
            }
          } catch (e) { console.error("[crew:edit]", e); }
          return;
        }

        if (msg.type === "crew:delete") {
          const msgId = String(msg.msgId || "");
          const meId = ws.user?.id;
          if (!msgId || !meId) return;
          try {
            const row = await (prisma as any).crewMessage.findUnique({ where: { id: msgId } });
            if (!row) return;
            if (row.deletedAt) return;
            const membership = await (prisma as any).crewMember.findFirst({ where: { crewId: row.crewId, userId: meId } });
            const isMod = membership?.role === "LEADER" || membership?.role === "OFFICER";
            if (row.userId !== meId && !isMod) return;
            const deletedAt = new Date();
            await (prisma as any).crewMessage.update({ where: { id: msgId }, data: { body: "", deletedAt } });
            const members = await (prisma as any).crewMember.findMany({ where: { crewId: row.crewId }, select: { userId: true } });
            const memberIds = new Set(members.map((m: any) => m.userId));
            const payload = { type: "crew:deleted", crewId: row.crewId, msgId, deletedAt: deletedAt.toISOString() };
            for (const sock of wss.clients) {
              const sockUser = (sock as any).user;
              if (sockUser && memberIds.has(sockUser.id)) send(sock as any, payload);
            }
          } catch (e) { console.error("[crew:delete]", e); }
          return;
        }

        if (msg.type === "crew:react") {
          const msgId = String(msg.msgId || "");
          const emoji = String(msg.emoji || "").trim().slice(0, 12);
          const meId = ws.user?.id;
          if (!msgId || !emoji || !meId) return;
          try {
            const row = await (prisma as any).crewMessage.findUnique({ where: { id: msgId } });
            if (!row) return;
            if (row.deletedAt) return;
            const membership = await (prisma as any).crewMember.findFirst({ where: { crewId: row.crewId, userId: meId } });
            if (!membership) return;
            const res = await toggleReactionOnTarget("CREW_MESSAGE", msgId, meId, emoji);
            if (!res.ok) { send(ws, { type: "reaction:rejected", msgId, reason: res.reason }); return; }
            const members = await (prisma as any).crewMember.findMany({ where: { crewId: row.crewId }, select: { userId: true } });
            const memberIds = new Set(members.map((m: any) => m.userId));
            const payload = { type: "crew:reaction", crewId: row.crewId, msgId, reactions: res.reactions };
            for (const sock of wss.clients) {
              const sockUser = (sock as any).user;
              if (sockUser && memberIds.has(sockUser.id)) send(sock as any, payload);
            }
          } catch (e) { console.error("[crew:react]", e); }
          return;
        }

        if (msg.type === "dm:send") {
          const rawToId = String(msg.toId  || "").trim();
          const body    = String(msg.body  || "").trim().slice(0, 2000);
          const fromId  = ws.user?.id;
          console.log(`[dm:send] fromId=${fromId || "(none)"} rawToId=${JSON.stringify(rawToId)} bodyLen=${body.length}`);
          if (!fromId) { send(ws, { type: "dm:rejected", reason: "Session expired. Refresh the page." }); return; }
          if (!rawToId) { send(ws, { type: "dm:rejected", reason: "No recipient selected." }); return; }
          if (!body) { send(ws, { type: "dm:rejected", reason: "Empty message." }); return; }
          const urlCheck = checkUrlSpam(body);
          if (!urlCheck.ok) { send(ws, { type: "dm:rejected", reason: urlCheck.reason }); return; }
          const rate = checkChatRateLimit(fromId);
          if (!rate.ok) { send(ws, { type: "dm:rejected", reason: rate.reason, retryInMs: rate.retryInMs }); return; }
          const toId = await resolveUserId(rawToId);
          try {
            const blocked = await (prisma as any).userBlock.findFirst({
              where: {
                OR: [
                  { blockerId: fromId, blockedId: toId },
                  { blockerId: toId, blockedId: fromId },
                ],
              },
              select: { blockerId: true },
            });
            if (blocked) {
              const reason = blocked.blockerId === fromId
                ? "You've blocked this user. Unblock them in Settings to send messages."
                : "Message not delivered.";
              send(ws, { type: "dm:rejected", reason });
              return;
            }
          } catch {}
          let dmReplyData: any = {};
          const dmReplyToId = typeof msg.replyToId === "string" ? msg.replyToId : "";
          if (dmReplyToId) {
            try {
              const parent = await prisma.directMessage.findUnique({ where: { id: dmReplyToId } });
              if (parent && !(parent as any).deletedAt) {
                const sameThread =
                  (parent.fromId === fromId && parent.toId === toId) ||
                  (parent.fromId === toId && parent.toId === fromId);
                if (sameThread) {
                  const parentUser = await prisma.user.findUnique({ where: { id: parent.fromId }, select: { name: true } });
                  dmReplyData = {
                    replyToId: parent.id,
                    replyToUserId: parent.fromId,
                    replyToUserName: parentUser?.name || "?",
                    replyToBody: String(parent.body || "").slice(0, 120),
                  };
                }
              }
            } catch {}
          }
          try {
            const dm = await prisma.directMessage.create({
              data: { fromId, toId, body, ...dmReplyData },
              select: { id: true, fromId: true, toId: true, body: true, createdAt: true, replyToId: true, replyToUserId: true, replyToUserName: true, replyToBody: true } as any,
            });
          const payload = { type: "dm:message", message: { ...dm, createdAt: (dm as any).createdAt.toISOString() } };
          dmDeliver(toId, payload);
          sendPush(toId, { title: `DM from ${ws.user?.name || "Someone"}`, body: body.slice(0, 120), url: "/home", tag: `dm:${fromId}` }).catch(() => {});
          createNotification({ userId: toId, type: "DM_RECEIVED", title: `${ws.user?.name || "Someone"} sent you a message`, body: body.slice(0, 120), actorId: fromId, actorName: ws.user?.name || undefined, actionUrl: "/home", meta: { fromId } }).catch(() => {});
          } catch (e) { console.error("[dm:send]", e); }
          return;
        }

        if (msg.type === "dm:read") {
          const fromId = String(msg.fromId || "").trim();
          const toId   = ws.user?.id;
          if (!fromId || !toId) return;
          try {
            await prisma.directMessage.updateMany({
              where: { fromId, toId, readAt: null },
              data: { readAt: new Date() },
            });
            send(ws, { type: "dm:read:ack", fromId });
          } catch (e) { console.error("[dm:read]", e); }
          return;
        }

        if (msg.type === "dm:edit") {
          const msgId  = String(msg.msgId || "");
          const newBody = String(msg.body || "").trim().slice(0, 2000);
          const meId   = ws.user?.id;
          if (!msgId || !newBody || !meId) return;
          try {
            const dm = await prisma.directMessage.findUnique({ where: { id: msgId } });
            if (!dm) return;
            if (dm.fromId !== meId) return;
            if ((dm as any).deletedAt) return;
            if (dm.body === newBody) return;
            if (Date.now() - new Date(dm.createdAt).getTime() > 15 * 60 * 1000) return;
            const editedAt = new Date();
            await prisma.directMessage.update({
              where: { id: msgId },
              data: { body: newBody, editedAt },
            });
            const payload = { type: "dm:edited", msgId, fromId: dm.fromId, toId: dm.toId, body: newBody, editedAt: editedAt.toISOString() };
            dmDeliver(dm.toId, payload);
            dmDeliver(dm.fromId, payload);
          } catch (e) { console.error("[dm:edit]", e); }
          return;
        }

        if (msg.type === "dm:delete") {
          const msgId = String(msg.msgId || "");
          const meId  = ws.user?.id;
          if (!msgId || !meId) return;
          try {
            const dm = await prisma.directMessage.findUnique({ where: { id: msgId } });
            if (!dm) return;
            if (dm.fromId !== meId) return;
            if ((dm as any).deletedAt) return;
            const deletedAt = new Date();
            await prisma.directMessage.update({
              where: { id: msgId },
              data: { body: "", deletedAt },
            });
            const payload = { type: "dm:deleted", msgId, fromId: dm.fromId, toId: dm.toId, deletedAt: deletedAt.toISOString() };
            dmDeliver(dm.toId, payload);
            dmDeliver(dm.fromId, payload);
          } catch (e) { console.error("[dm:delete]", e); }
          return;
        }

        if (msg.type === "dm:react") {
          const msgId = String(msg.msgId || "");
          const emoji = String(msg.emoji || "").trim().slice(0, 12);
          const meId  = ws.user?.id;
          if (!msgId || !emoji || !meId) return;
          try {
            const dm = await prisma.directMessage.findUnique({ where: { id: msgId } });
            if (!dm) return;
            if ((dm as any).deletedAt) return;
            if (dm.fromId !== meId && dm.toId !== meId) return;
            const res = await toggleReactionOnTarget("DIRECT_MESSAGE", msgId, meId, emoji);
            if (!res.ok) { send(ws, { type: "reaction:rejected", msgId, reason: res.reason }); return; }
            const payload = { type: "dm:reaction", msgId, fromId: dm.fromId, toId: dm.toId, reactions: res.reactions };
            dmDeliver(dm.toId, payload);
            dmDeliver(dm.fromId, payload);
          } catch (e) { console.error("[dm:react]", e); }
          return;
        }
      })().catch((e) => {
        console.error("[ws-dispatcher] async chain threw:", e);
      });
    });

    ws.on("close", () => {
      if (ws.pendingRoomId && ws.user) {
        const r = rooms.get(ws.pendingRoomId);
        if (r) {
          const set = r.pending.get(ws.user.id);
          if (set) set.delete(ws);
          if (set && set.size === 0) r.pending.delete(ws.user.id);
        }
      }
      if (ws.user) {
        const closingUserId = ws.user.id;
        const closingUserName = ws.user.name;
        setTimeout(() => {
          if (!isUserOnline(closingUserId)) {
            (async () => {
              try {
                const memberships = await (prisma as any).crewMember.findMany({ where: { userId: closingUserId }, select: { crewId: true } });
                if (!memberships.length) return;
                const crewIds = memberships.map((m: any) => m.crewId);
                const mates = await (prisma as any).crewMember.findMany({ where: { crewId: { in: crewIds }, userId: { not: closingUserId } }, select: { userId: true } });
                const payload = { type: "crew:presence", userId: closingUserId, name: closingUserName, online: false };
                for (const mate of mates) {
                  for (const sock of wss.clients) {
                    if ((sock as any).user?.id === mate.userId) send(sock as Sock, payload);
                  }
                }
              } catch {}
            })();
          }
        }, 2000);
      }
      leaveRoom(ws);
    });
  });

  await app.register(socialRoutes, { authFromHeader, verifyToken, awardNotoriety, createNotification, rooms } as any);

  await app.register(usersSearchRoutes, {} as any);

  await app.register(billingRoutes, { authFromHeader, getGlobalRole, canAccessStaff, canAssignRoles, globalAudit, lobbyAdminAccess } as any);

  function broadcastEvent(title: string, startsAt: Date) {
    const timeStr = startsAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    const payload = { type: "system:broadcast", message: `Event: ${title} — ${timeStr}`, level: "info", from: "Events", ts: Date.now() };
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

  await app.register(eventsRoutes, { authFromHeader, getGlobalRole, canAssignRoles, canAccessStaff, broadcastEvent, globalAudit, lobbyAdminAccess } as any);

  await app.register(notificationsRoutes, { authFromHeader, VAPID_PUBLIC, sendPush } as any);

  await app.register(activityRoutes, { authFromHeader } as any);

  await app.register(staffOpsRoutes, { authFromHeader, getGlobalRole, canAccessStaff, rooms } as any);

  await app.register(tenorRoutes);
  await app.register(twitchRoutes, { rooms } as any);

  await app.register(mlbRoutes);

  await app.register(pgaRoutes);

  const ytCache: Record<string, { data: any; ts: number }> = {};

  app.get<{ Params: { channelId: string } }>("/youtube/channel/:channelId", async (req, reply) => {
    const { channelId } = req.params;
    if (!/^UC[\w-]{20,}$/.test(channelId)) return reply.code(400).send({ ok: false, error: "invalid_channel_id" });

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
          title: tag("title").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"'),
          published: tag("published"),
          updated: tag("updated"),
          channelName: tag("name"),
          thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
          thumbnailHq: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          views: parseInt(attr("media:statistics", "views") || "0", 10),
          starRating: parseFloat(attr("media:starRating", "average") || "0"),
          description: tag("media:description").slice(0, 300).replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"'),
        });
      }

      const payload = { ok: true, channelId, videos: entries };
      ytCache[channelId] = { data: payload, ts: Date.now() };
      return reply.send(payload);
    } catch (e) {
      console.error("[youtube rss]", e);
      return reply.code(500).send({ ok: false, error: "youtube_parse_failed" });
    }
  });

  await app.register(bungieRoutes, { authFromHeader, awardNotoriety } as any);
  await app.register(eveRoutes,    { authFromHeader, awardNotoriety } as any);
  await app.register(poeRoutes,    { authFromHeader, awardNotoriety } as any);
  await app.register(chatMediaRoutes, { authFromHeader, isStaff: isElevatedGlobal, createNotification } as any);
  await app.register(mcRoutes,     { authFromHeader } as any);

  if (process.env.BUNGIE_API_KEY) {
    syncManifest(process.env.BUNGIE_API_KEY).then(r => {
      console.log(`[manifest] Startup sync: ${r.ok ? "OK" : "FAILED"} — v${r.version}`, r.counts);
    }).catch(e => console.error("[manifest] Startup sync error:", e));
  }

  await app.register(challengesRoutes, { authFromHeader, getGlobalRole, canAccessStaff, getLobbyRole } as any);

  await app.register(badgesRoutes, { authFromHeader } as any);
  await app.register(tournamentsRoutes, { authFromHeader, awardNotoriety, awardPaper, createNotification, getGlobalRole, canAccessStaff, getLobbyRole, onTournamentMatchLive: (mid: string) => (globalThis as any).__weeredAutoDetect?.onMatchLive(mid) } as any);
  await app.register(flairContestsRoutes, { authFromHeader, awardNotoriety, getGlobalRole, canAccessStaff, getLobbyRole, broadcastToLobby, createNotification } as any);
  await app.register(flairRoutes, { authFromHeader, getGlobalRole, canAccessStaff } as any);

  await app.register(leagueRoutes);

  await app.register(fortniteRoutes, { authFromHeader, sendPush } as any);
  await app.register(scryfallRoutes, {} as any);
  await app.register(mtgRoutes, {} as any);

  await app.register(pubgRoutes);

  await app.register(windroseRoutes, { authFromHeader, sendPush, awardPaper, isAIAvailable, getAI, broadcastToLobby } as any);
  await app.register((await import("./routes/helldivers")).default, { authFromHeader } as any);
  await app.register(helldiversStratagemsRoutes);
  await app.register(helldiversLoadoutsRoutes, { authFromHeader } as any);
  await app.register(steamRoutes, { authFromHeader, createNotification } as any);
  await app.register(windroseBuildsRoutes, { authFromHeader, awardNotoriety, broadcastToLobby, canAccessStaff, getGlobalRole } as any);

  await app.register(lfgRoutes, { authFromHeader, getGlobalRole, canAccessStaff, broadcastToLobby, awardNotoriety, createNotification } as any);
  await app.register(redditRoutes);
  await app.register(helldiversMoRoutes, { authFromHeader, awardPaper } as any);

  async function awardPaper(userId: string, type: string, amount: number, description: string, refId?: string): Promise<{ balance: number } | null> {
    try {
      return await prisma.$transaction(async (tx) => {
        // Race-safe: atomic increment with a WHERE guard so concurrent debits
        // cannot overdraft (Postgres re-checks the predicate on the locked row).
        const upd = await tx.user.updateMany({
          where: amount < 0 ? { id: userId, paper: { gte: -amount } } : { id: userId },
          data: { paper: { increment: amount } },
        });
        if (upd.count === 0) return null;
        const fresh = await tx.user.findUnique({ where: { id: userId }, select: { paper: true } });
        const newBalance = (fresh as any)?.paper ?? 0;
        await (tx as any).paperTransaction.create({
          data: { userId, type, amount, balance: newBalance, description, refId: refId || null },
        });
        return { balance: newBalance };
      });
    } catch (e) {
      console.error("[paper] awardPaper error:", e);
      return null;
    }
  }

  await app.register(paperRoutes, { authFromHeader, awardPaper } as any);

  await app.register(pokerRoutes, { authFromHeader, pokerTables, buildPokerStateForUser, broadcastPokerState, awardPaper } as any);

  await app.register(storeRoutes, { authFromHeader } as any);

  const BINANCE_WS_BASE = "wss://stream.binance.com:9443";
  const BINANCE_REST = "https://api.binance.com";

  const livePrices = new Map<string, { price: number; time: number }>();
  const binanceSubs = new Map<string, WsClient>();
  const symbolSubscribers = new Map<string, Set<Sock>>();

  const DEFAULT_SYMBOLS = ["btcusdt", "ethusdt", "solusdt", "dogeusdt", "bnbusdt", "xrpusdt", "adausdt", "avaxusdt", "maticusdt", "linkusdt"];

  function subscribeBinanceSymbol(symbol: string) {
    const sym = symbol.toLowerCase();
    if (binanceSubs.has(sym)) return;

    const wsUrl = `${BINANCE_WS_BASE}/ws/${sym}@kline_1m/${sym}@trade`;
    const upstream = new WsClient(wsUrl);

    upstream.on("open", () => {
      console.log(`[trading] Binance WS connected: ${sym}`);
    });

    upstream.on("message", (raw: Buffer) => {
      try {
        const data = JSON.parse(raw.toString());
        if (data.e === "trade") {
          const price = parseFloat(data.p);
          livePrices.set(sym, { price, time: Date.now() });
          const subs = symbolSubscribers.get(sym);
          if (subs && subs.size > 0) {
            const msg = { type: "trading:price", symbol: sym.toUpperCase(), price, time: data.T, qty: parseFloat(data.q) };
            for (const sock of subs) {
              try { send(sock, msg); } catch {}
            }
          }
        } else if (data.e === "kline") {
          const k = data.k;
          const subs = symbolSubscribers.get(sym);
          if (subs && subs.size > 0) {
            const msg = {
              type: "trading:kline",
              symbol: sym.toUpperCase(),
              time: k.t / 1000,
              open: parseFloat(k.o),
              high: parseFloat(k.h),
              low: parseFloat(k.l),
              close: parseFloat(k.c),
              volume: parseFloat(k.v),
              closed: k.x,
            };
            for (const sock of subs) {
              try { send(sock, msg); } catch {}
            }
          }
        }
      } catch {}
    });

    upstream.on("close", () => {
      console.log(`[trading] Binance WS closed: ${sym}, reconnecting in 5s`);
      binanceSubs.delete(sym);
      setTimeout(() => subscribeBinanceSymbol(sym), 5000);
    });

    upstream.on("error", (e: any) => {
      console.error(`[trading] Binance WS error: ${sym}`, e.message);
    });

    binanceSubs.set(sym, upstream);
  }

  for (const sym of DEFAULT_SYMBOLS) subscribeBinanceSymbol(sym);

  function broadcastToLobby(lobbyId: string, event: any) {
    for (const sock of wss.clients) {
      const s = sock as Sock;
      if (s.roomId === `lobby:${lobbyId}` || s.roomId === lobbyId) {
        try { send(s, event); } catch {}
      }
    }
    try { capturePublicActivity(event, { lobbyId }); } catch {}
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
        try { send(s, event); } catch {}
      }
    }
    try { capturePublicActivity(event, { roomId }); } catch {}
  }

  function capturePublicActivity(event: any, ctx: { lobbyId?: string; roomId?: string }) {
    const t = String(event?.type || "");
    if (!t) return;
    const lobbyHint = ctx.lobbyId || (event?.lobbyId ? String(event.lobbyId) : "");
    const userId = event?.userId ? String(event.userId) : undefined;
    const userName = event?.userName ? String(event.userName) : (event?.user?.name ? String(event.user.name) : undefined);
    if (t === "dice:roll") {
      const isCrit = !!event.isNat20;
      const isFumble = !!event.isNat1;
      const key = `dice:${lobbyHint}:${isCrit ? "20" : isFumble ? "1" : "any"}`;
      if (!isCrit && !isFumble && !shouldEmit(key, 18_000)) return;
      const who = anonymousFor(lobbyHint);
      const realWho = userName || "someone";
      const expr = String(event.expression || "1d20");
      const total = Number(event.total || 0);
      const fmt = (w: string) => isCrit
        ? `${w} rolled a NAT 20 on ${expr}`
        : isFumble
          ? `${w} fumbled a NAT 1 on ${expr}`
          : `${w} rolled ${expr} → ${total}`;
      pushActivity({
        kind: "dice", lobbyId: lobbyHint,
        text: fmt(who), textReal: fmt(realWho),
        userId, userName,
        accent: isCrit ? "#22c55e" : isFumble ? "#ef4444" : "#D9A942",
      });
      return;
    }
    if (t === "trading:trade") {
      const notional = Math.abs(Number(event?.trade?.notional || event?.notional || 0));
      if (notional < 1000) return;
      if (!shouldEmit(`trade:${lobbyHint}`, 6_000)) return;
      const sym = String(event?.trade?.symbol || event?.symbol || "BTCUSDT").replace(/USDT$/i, "");
      const side = String(event?.trade?.side || event?.side || "").toLowerCase();
      const verb = side === "sell" ? "closed" : "opened";
      const who = anonymousFor("fakeout");
      const realWho = userName || event?.trade?.userName || "someone";
      const fmt = (w: string) => `${w} ${verb} a $${Math.round(notional).toLocaleString()} ${sym} position`;
      pushActivity({
        kind: "trade", lobbyId: lobbyHint || "fakeout",
        text: fmt(who), textReal: fmt(realWho),
        userId, userName: realWho,
        accent: "#22c55e",
      });
      return;
    }
    if (t === "trading:close" || t === "trading:position-closed") {
      const pnl = Number(event?.pnl ?? event?.realized ?? 0);
      if (Math.abs(pnl) < 500) return;
      if (!shouldEmit(`tradeclose:${lobbyHint}`, 8_000)) return;
      const who = anonymousFor("fakeout");
      const realWho = userName || "someone";
      const sign = pnl >= 0 ? "+" : "-";
      const fmt = (w: string) => `${w} closed a position for ${sign}$${Math.abs(Math.round(pnl)).toLocaleString()}`;
      pushActivity({
        kind: "trade", lobbyId: lobbyHint || "fakeout",
        text: fmt(who), textReal: fmt(realWho),
        userId, userName: realWho,
        accent: pnl >= 0 ? "#22c55e" : "#ef4444",
      });
      return;
    }
    if (t === "room:created") {
      const name = String(event?.room?.name || event?.name || "a new room");
      if (!shouldEmit(`room:${lobbyHint}:${name}`, 30_000)) return;
      const fmt = () => `a new room opened: ${name}`;
      pushActivity({
        kind: "room", lobbyId: lobbyHint,
        text: fmt(), textReal: userName ? `${userName} opened a new room: ${name}` : fmt(),
        userId, userName,
        accent: "#D9A942",
      });
      return;
    }
    if (t === "tavern:posted" || t === "lfg:posted") {
      if (!shouldEmit(`tavern:${lobbyHint}`, 12_000)) return;
      const who = anonymousFor(lobbyHint || "dnd");
      const realWho = userName || "someone";
      const fmt = (w: string) => `${w} posted to the Tavern Board`;
      pushActivity({
        kind: "tavern", lobbyId: lobbyHint || "dnd",
        text: fmt(who), textReal: fmt(realWho),
        userId, userName: realWho,
        accent: "#D9A942",
      });
      return;
    }
    if (t === "windrose:build:posted") {
      if (!shouldEmit(`windrose-build:${userId || "any"}`, 5_000)) return;
      const who = anonymousFor("windrose");
      const realWho = userName || "a captain";
      const buildTitle = String(event?.title || "a build").slice(0, 40);
      const fmt = (w: string) => `${w} filed a Logbook entry: "${buildTitle}"`;
      pushActivity({
        kind: "build", lobbyId: "windrose",
        text: fmt(who), textReal: fmt(realWho),
        userId, userName: realWho,
        accent: "#e8c48a",
      });
      return;
    }
    if (t === "poker:pot-won" || t === "poker:hand-won") {
      const amount = Math.abs(Number(event?.amount || event?.pot || 0));
      if (amount < 200) return;
      if (!shouldEmit(`poker:${lobbyHint}`, 8_000)) return;
      const who = anonymousFor("poker");
      const realWho = userName || "someone";
      const fmt = (w: string) => `${w} took a ${amount.toLocaleString()} Paper pot`;
      pushActivity({
        kind: "poker", lobbyId: lobbyHint || "poker",
        text: fmt(who), textReal: fmt(realWho),
        userId, userName: realWho,
        accent: "#fcd34d",
      });
      return;
    }
    if (t === "windrose:bounty:claimed" || t === "windrose:bounty:posted") {
      if (!shouldEmit(`windrose:${t}`, 10_000)) return;
      const who = anonymousFor("windrose");
      const realWho = userName || "someone";
      const verb = t.endsWith(":posted") ? "posted" : "claimed";
      const fmt = (w: string) => `${w} ${verb} a bounty`;
      pushActivity({
        kind: "bounty", lobbyId: lobbyHint || "windrose",
        text: fmt(who), textReal: fmt(realWho),
        userId, userName: realWho,
        accent: "#a78bfa",
      });
      return;
    }
    if (t === "challenge:completed") {
      if (!shouldEmit(`destiny:${lobbyHint}`, 12_000)) return;
      const who = anonymousFor("destiny");
      const realWho = userName || "someone";
      const fmt = (w: string) => `${w} cleared a Destiny challenge`;
      pushActivity({
        kind: "challenge", lobbyId: lobbyHint || "destiny",
        text: fmt(who), textReal: fmt(realWho),
        userId, userName: realWho,
        accent: "#60a5fa",
      });
      return;
    }
    if (t === "campaign:ledger") {
      const entry = event?.entry || {};
      const entryType = String(entry.type || "").toUpperCase();
      const delta = Number(entry.delta || 0);
      const desc = String(entry.description || "").trim().slice(0, 48);
      if (!shouldEmit(`campaign:${lobbyHint}:${entryType}`, 12_000)) return;
      const who = anonymousFor(lobbyHint || "dnd");
      const realWho = userName || "someone";
      let fmt: (w: string) => string;
      if (entryType === "GOLD" && delta > 0) {
        const amt = Math.abs(delta).toLocaleString();
        fmt = (_w) => desc ? `the party found ${amt} gp — ${desc}` : `the party found ${amt} gp`;
      } else if (entryType === "GOLD" && delta < 0) {
        const amt = Math.abs(delta).toLocaleString();
        fmt = (_w) => desc ? `the party spent ${amt} gp — ${desc}` : `the party spent ${amt} gp`;
      } else if (entryType === "XP") {
        const amt = Math.abs(delta).toLocaleString();
        fmt = (w) => `${w} earned ${amt} XP`;
      } else if (entryType === "ITEM") {
        fmt = (w) => `${w} found ${desc || "an item"}`;
      } else {
        fmt = (_w) => desc ? `the chronicle gained an entry — ${desc}` : `the party logged a chronicle entry`;
      }
      pushActivity({
        kind: "campaign", lobbyId: lobbyHint || "dnd",
        text: fmt(who), textReal: fmt(realWho),
        userId, userName: realWho,
        accent: "#C4A55A",
      });
      return;
    }
  }
  function notifyUser(userId: string, event: any) {
    for (const sock of wss.clients) {
      if ((sock as any).user?.id === userId) {
        try { send(sock as Sock, event); } catch {}
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
      console.error("[operator-trade]", e);
    }
  }

  await app.register(tradingRoutes, {
    authFromHeader, awardPaper, awardNotoriety, livePrices, broadcastToLobby, notifyUser, operatorCommentateOnTrade,
  } as any);

  await app.register(campaignsRoutes, {
    authFromHeader, broadcastToLobby,
  } as any);

  await app.register(characterRoutes, {
    authFromHeader, getGlobalRole, canAccessStaff,
  } as any);

  await app.register(diceRoutes, {
    authFromHeader, broadcastToLobby,
  } as any);

  await app.register(mapsRoutes, {
    authFromHeader, broadcastToRoom,
  } as any);

  await app.register(supportRoutes, {
    authFromHeader, getGlobalRole, canAccessStaff,
  } as any);

  await app.register(publicRoutes, {
    rooms, applyWindroseReel, authFromHeader,
  } as any);

  await app.register(overlayRoutes, {
    rooms, verifyToken,
  } as any);

  setupTradingSocket(wss, { send, safeJson, subscribeBinanceSymbol, symbolSubscribers, livePrices });

  console.log("[trading] Paper trading engine initialized with", DEFAULT_SYMBOLS.length, "default symbols");

  process.on("SIGINT", async () => {
    for (const [, ws] of binanceSubs) { try { ws.close(); } catch {} }
    try { await prisma.$disconnect(); } catch {}
    process.exit(0);
  });
  const ROOM_TTL_MS = 60 * 60 * 1000;
  const DISSOLUTION_INTERVAL_MS = 5 * 60 * 1000;

  setInterval(() => { try { seedSyntheticActivity(); } catch {} }, 32_000);
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
      try {
        await prisma.room.delete({ where: { id: roomId } }).catch(() => {});
        await prisma.roomMessage.deleteMany({ where: { roomId } }).catch(() => {});
        await prisma.roomMember.deleteMany({ where: { roomId } }).catch(() => {});
      } catch {}
      console.log(`[dissolution] Room "${roomId}" dissolved after ${ROOM_TTL_MS / 60000}min empty`);
    }

    if (toDelete.length > 0) {
      console.log(`[dissolution] Cleaned up ${toDelete.length} empty room(s)`);
    }
  }, DISSOLUTION_INTERVAL_MS);

  if (process.env.BUNGIE_API_KEY) {
    setBungieApiKey(process.env.BUNGIE_API_KEY);
    startChallengeWorker(prisma, awardNotoriety, (userId, event) => {
      for (const sock of wss.clients) {
        if ((sock as any).user?.id === userId) {
          send(sock as any, event);
  startChessWorker(prisma);
  startChessChallengeWorker(prisma, awardNotoriety, awardPaper, broadcastToLobby);
        }
      }
    }, awardPaper, broadcastToLobby, createNotification);

    const autoDetect = startTournamentAutoDetect(prisma, {
      notify: (userId, event) => {
        for (const sock of wss.clients) {
          if ((sock as any).user?.id === userId) send(sock as any, event);
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
  console.error(err);
  process.exit(1);
});
