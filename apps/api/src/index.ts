import dotenv from "dotenv";
dotenv.config({ override: true });
import * as Sentry from "@sentry/node";
if (process.env.SENTRY_DSN_API) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN_API,
    environment: process.env.NODE_ENV || "production",
    tracesSampleRate: 0.1,
  });
}
import Fastify from "fastify";
import mlbRoutes from "./routes/mlb";
import pgaRoutes from "./routes/pga";
import tenorRoutes from "./routes/tenor";
import twitchRoutes from "./routes/twitch";
import youtubeRoutes from "./routes/youtube";
import fortniteRoutes from "./routes/fortnite";
import pubgRoutes from "./routes/pubg";
import leagueRoutes from "./routes/league";
import bungieRoutes from "./routes/bungie";
import windroseRoutes from "./routes/windrose";
import badgesRoutes from "./routes/badges";
import tournamentsRoutes from "./routes/tournaments";
import lfgRoutes from "./routes/lfg";
import paperRoutes from "./routes/paper";
import invitesRoutes from "./routes/invites";
import newsRoutes from "./routes/news";
import modsRoutes from "./routes/mods";
import aiRoutes from "./routes/ai";
import socialRoutes from "./routes/social";
import storeRoutes from "./routes/store";
import notificationsRoutes from "./routes/notifications";
import crewsRoutes from "./routes/crews";
import forumRoutes from "./routes/forum";
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
import campaignsRoutes from "./routes/campaigns";
import diceRoutes from "./routes/dice";
import supportRoutes from "./routes/support";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { WebSocketServer, WebSocket as WsClient } from "ws";
import type { WebSocket } from "ws";
import { randomUUID, randomBytes, createHmac, timingSafeEqual } from "crypto";
import { AccessToken } from "livekit-server-sdk";
import { PrismaClient, RoomRole, GlobalRole, LobbyRole, ModuleType } from "@prisma/client";
import { OAuth2Client } from "google-auth-library";
import { syncManifest, enrichProfile, enrichMilestones, enrichVendorSales, resolveItem, resolveBucket, resolveDamageType, isLoaded as manifestLoaded, manifestVersion, WEAPON_BUCKETS, ARMOR_BUCKETS, ARMOR_STAT_HASHES } from "./manifest";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { latLngToCell, cellToBoundary, gridDisk, getResolution } from "h3-js";
import { join } from "path";
import { startChallengeWorker, setBungieApiKey } from "./challengeWorker";
import { startNexusPoller, fetchAndUpsertMod } from "./nexusPoller";
import webpush from "web-push";
import { sendMail, buildVerifyEmail, buildResetEmail } from "./lib/email";

// ── Anthropic AI SDK (optional) ──────────────────────────────────────────────
let _anthropicModule: any = null;
let _anthropicLoaded = false;

async function getAI(): Promise<any | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
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
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

import { prisma } from "./lib/prisma";

const JWT_SECRET = process.env.JWT_SECRET || "weered-dev-secret";

// ── Web Push (VAPID) ──────────────────────────────────────────────────────
const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY  || "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT     || "mailto:support@weered.ca";
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}
const HTTP_PORT = Number(process.env.PORT || 4000);
const WS_PORT = Number(process.env.WS_PORT || 4001);

const LIVEKIT_URL = process.env.LIVEKIT_URL || process.env.LIVEKIT_WS_URL || "ws://127.0.0.1:7880";
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || "";

type AuthedUser = { id: string; name: string; globalRole?: string; tier?: string; avatarColor?: string; avatar?: string };
type Sock = WebSocket & { user?: AuthedUser; roomId?: string; pendingRoomId?: string };

type Role = "owner" | "mod" | "member";
type RoomUser = { id: string; name: string; role?: Role; globalRole?: string; tier?: string; avatarColor?: string | null; avatar?: string | null };
type ReactionAgg = { emoji: string; count: number; users: string[] }; // users = first N user IDs for "you reacted" detection + hover
type ReplyTo = { id: string; userId: string; userName: string; body: string };
type ChatMsg = { id: string; user: RoomUser; body: string; ts: number; editedAt?: number; deletedAt?: number; reactions?: ReactionAgg[]; replyTo?: ReplyTo };
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

// MPlayer-style launch target, set by the room host. Lives in-memory on
// the room; cleared when the room is evicted or the host clears it.
type LaunchTarget = {
  appid: number;          // Steam AppID, e.g. 3041230 for Windrose
  connect: string;        // "ip:port" or "ip:port/password" — feeds steam://connect/
  display: string;        // human label shown to members (server name)
  note?: string;          // free-text from host
  setBy: string;          // userId of whoever set it
  setAt: number;          // epoch ms
};

type LaunchSlot = "player" | "observer";

type LaunchState = {
  target: LaunchTarget | null;
  slots: Map<string, LaunchSlot>;  // userId → slot
  ready: Set<string>;              // userIds of player-slotted users who've clicked Ready
  firedAt: number | null;          // epoch ms when host hit fire (null otherwise)
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
  // Voice gating — schema-backed mode + ephemeral queue/speaker sets.
  // OPEN = anyone publishes. QUEUED = raise hand → mod approves → speaker
  // set entry → token grants canPublish on next join. LISTEN_ONLY = only
  // mods/owner ever publish.
  voiceMode?: "OPEN" | "QUEUED" | "LISTEN_ONLY";
  voiceQueue?: Set<string>;
  voiceSpeakers?: Set<string>;
  disabledModules?: string[];
  };

const rooms = new Map<string, RoomState>();
// Title/thumbnail for article rooms — populated by feed worker, used in ensureRoomLoaded
const articleRoomMeta = new Map<string, { name: string; thumbnail?: string }>();
let wss: WebSocketServer;

// ── Poker Engine — Types & State ──────────────────────────────────────────────

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
  handInProgress: boolean;
  autoStartTimer: ReturnType<typeof setTimeout> | null;
};

const pokerTables = new Map<string, PokerTable>();

// ── Poker Engine — Utility Functions ──────────────────────────────────────────

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
  return idx >= 0 ? idx + 2 : 0; // "2"=2 ... "A"=14
}

/** Returns all C(n,k) combinations of an array */
function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const result: T[][] = [];
  const first = arr[0];
  const rest = arr.slice(1);
  // combos that include first
  for (const combo of combinations(rest, k - 1)) {
    result.push([first, ...combo]);
  }
  // combos that don't include first
  for (const combo of combinations(rest, k)) {
    result.push(combo);
  }
  return result;
}

/**
 * Evaluate the best 5-card poker hand from exactly 5 cards.
 * Returns { rank, name, kickers } where kickers is used for tiebreaking.
 */
function evaluate5(cards: Card[]): { rank: number; name: string; kickers: number[]; best: Card[] } {
  const vals = cards.map(c => rankValue(c.rank)).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);

  const isFlush = suits.every(s => s === suits[0]);

  // Check straight (including A-2-3-4-5 wheel)
  let isStraight = false;
  let straightHigh = 0;
  if (vals[0] - vals[4] === 4 && new Set(vals).size === 5) {
    isStraight = true;
    straightHigh = vals[0];
  }
  // Wheel: A-2-3-4-5
  if (vals[0] === 14 && vals[1] === 5 && vals[2] === 4 && vals[3] === 3 && vals[4] === 2) {
    isStraight = true;
    straightHigh = 5; // 5-high straight
  }

  // Count occurrences
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

/**
 * Evaluate the best 5-card hand from 7 cards (2 hole + 5 community).
 */
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

/**
 * Compare two evaluated hands. Returns 1 if a wins, -1 if b wins, 0 if tie.
 */
function compareHands(a: { rank: number; kickers: number[] }, b: { rank: number; kickers: number[] }): number {
  if (a.rank !== b.rank) return a.rank > b.rank ? 1 : -1;
  for (let i = 0; i < Math.max(a.kickers.length, b.kickers.length); i++) {
    const ak = a.kickers[i] ?? 0;
    const bk = b.kickers[i] ?? 0;
    if (ak !== bk) return ak > bk ? 1 : -1;
  }
  return 0;
}

/**
 * Given active (not folded) seats and community cards, returns indices of winners.
 */
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

// ── Poker Engine — Game Flow Helpers ──────────────────────────────────────────

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

/**
 * Build a sanitized table state for broadcasting. Each player only sees their own cards.
 * During showdown, all remaining players' cards are revealed.
 */
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
  };
}

function broadcastPokerState(tableId: string) {
  const table = pokerTables.get(tableId);
  if (!table) return;

  for (const sock of wss.clients) {
    const su = (sock as any).user as AuthedUser | undefined;
    if (!su) continue;
    // Send to seated players and spectators
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
  // Gather all active bets from non-folded players who have bet this round
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
      // Each player at or above this level contributes
      const amount = contrib * (activeBets.length - i);
      // Also add contributions from folded players at this level
      for (const seat of table.seats) {
        if (seat && seat.folded && seat.bet > prevBet) {
          const foldedContrib = Math.min(seat.bet - prevBet, contrib);
          // Already collected; skip for side pot calculation
        }
      }
      pots.push({ amount, eligible });
      prevBet = bet;
    }
  }

  return pots;
}

/** Deal the next community cards based on the phase transition */
function dealCommunityCards(table: PokerTable, count: number) {
  for (let i = 0; i < count; i++) {
    const card = table.deck.pop();
    if (card) table.communityCards.push(card);
  }
}

/** Check if the betting round is complete */
function isBettingRoundComplete(table: PokerTable): boolean {
  const active = table.seats.filter(s => s && !s.folded && !s.allIn) as PokerSeat[];
  if (active.length === 0) return true;
  if (active.length === 1 && table.currentBet === 0) return true;
  return active.every(s => s.bet === table.currentBet);
}

/** Advance to the next phase or next player after an action */
function advancePokerGame(table: PokerTable) {
  const activePlayers = activePlayersInHand(table);

  // Only one player left — they win
  if (activePlayers.length === 1) {
    collectBetsIntoPot(table);
    const winner = activePlayers[0];
    winner.chips += table.pot;
    table.lastShowdownResult = {
      winners: [{ seatIndex: winner.seatIndex, name: winner.name, chips: table.pot, hand: null }],
      pot: table.pot,
    };
    table.pot = 0;
    table.phase = "showdown";
    table.handInProgress = false;
    broadcastPokerState(table.tableId);
    scheduleAutoStart(table);
    return;
  }

  // All remaining players are all-in (or only one non-all-in player) — run out community cards
  const canAct = table.seats.filter(s => s && !s.folded && !s.allIn) as PokerSeat[];
  if (canAct.length <= 1) {
    collectBetsIntoPot(table);
    // Deal remaining community cards
    while (table.communityCards.length < 5) {
      dealCommunityCards(table, 1);
    }
    resolveShowdown(table);
    return;
  }

  // Check if the current betting round is done
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

    // New betting round starts from first active player after dealer
    table.currentBet = 0;
    for (const seat of table.seats) {
      if (seat) seat.bet = 0;
    }
    table.turnIndex = nextActiveIndex(table, table.dealerIndex);
    broadcastPokerState(table.tableId);
    return;
  }

  // Move to next player
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
    const payout = share + (i === 0 ? remainder : 0); // first winner gets remainder
    seat.chips += payout;
    const handEval = evaluateHand([...seat.cards, ...table.communityCards]);
    winners.push({
      seatIndex: idx,
      name: seat.name,
      chips: payout,
      hand: handEval.name,
      bestCards: handEval.best,
    });
  }

  table.lastShowdownResult = { winners, pot: table.pot };
  table.pot = 0;
  table.handInProgress = false;
  broadcastPokerState(table.tableId);
  scheduleAutoStart(table);
}

function scheduleAutoStart(table: PokerTable) {
  if (table.autoStartTimer) clearTimeout(table.autoStartTimer);
  table.autoStartTimer = setTimeout(() => {
    table.autoStartTimer = null;
    // Remove players with 0 chips
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

  // Move dealer
  table.dealerIndex = nextOccupiedIndex(table, table.dealerIndex);

  const sbIndex = nextOccupiedIndex(table, table.dealerIndex);
  const bbIndex = nextOccupiedIndex(table, sbIndex);

  // Post blinds
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

  // Deal 2 cards to each player
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
  // Action starts at player after big blind
  table.turnIndex = nextActiveIndex(table, bbIndex);
  // Edge case: if turnIndex is -1 (all players all-in from blinds), advance directly
  if (table.turnIndex === -1) {
    collectBetsIntoPot(table);
    while (table.communityCards.length < 5) dealCommunityCards(table, 1);
    resolveShowdown(table);
    return;
  }
  broadcastPokerState(table.tableId);
}

// ── Pinned lobbies now seeded from DB via seedLobbies() on startup ────────────


// ── Global role helpers ───────────────────────────────────────────────────────

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

// ── Reserved name check ─────────────────────────────────────────────────────
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

// ── Lobby role helpers ────────────────────────────────────────────────────────

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

// ── Seed pinned lobbies into DB on startup ────────────────────────────────────

const SEED_LOBBIES = [
  { id: "lobby",        name: "The Lobby",    description: "General hangout. Everyone starts here.", keywords: ["lobby","general","home"],              moduleType: ModuleType.FEED,  moduleConfig: { subreddit: "r/all" } },
  { id: "r/all",        name: "r/all",        description: "Reddit firehose. All topics welcome.",   keywords: ["reddit","all","general"],              moduleType: ModuleType.FEED,  moduleConfig: { subreddit: "r/all" } },
  { id: "r/gaming",     name: "r/gaming",     description: "Gamers of all kinds.",                   keywords: ["reddit","gaming","games","gamer"],     moduleType: ModuleType.FEED,  moduleConfig: { subreddit: "r/gaming" } },
  { id: "r/technology", name: "r/technology", description: "Tech news, discussion, builds.",         keywords: ["reddit","tech","technology","coding"],  moduleType: ModuleType.FEED,  moduleConfig: { subreddit: "r/technology" } },
  { id: "r/worldnews",  name: "r/worldnews",  description: "Global news and current events.",        keywords: ["reddit","news","world","worldnews"],   moduleType: ModuleType.FEED,  moduleConfig: { subreddit: "r/worldnews" } },
  { id: "weered.ca",    name: "Weered HQ",    description: "Meta, announcements, beta feedback.",    keywords: ["weered","meta","official","hq"],       moduleType: ModuleType.NONE,    moduleConfig: null },
  { id: "destiny2", name: "Destiny 2", description: "Guardians, raids, dungeons, Trials, Gambit, and the Traveler's Light. Live raid races, Bungie API loadouts, LFG for every activity. The unofficial Guardian hub.", keywords: ["destiny", "destiny2", "bungie", "guardian", "warlock", "titan", "hunter", "raid", "crucible", "gambit", "trials", "iron banner", "nightfall", "dungeon"], moduleType: ModuleType.BUNGIE, moduleConfig: { subreddits: ["r/DestinyTheGame", "r/destiny2"], steamAppId: "1085660" }, accentColor: "#f58220", logoUrl: "/brand/lobbies/destiny2-logo.png", bannerUrl: "/brand/lobbies/destiny2-banner.svg", websiteUrl: "https://www.bungie.net" },
  { id: "news", name: "News", description: "Breaking news and headlines from around the world. CBC, BBC, Reuters, and more.", keywords: ["news","breaking","headlines","world","canada","politics","tech","business","science"], moduleType: ModuleType.NEWS, moduleConfig: {}, accentColor: "#DC2626" },
  { id: "fakeout", name: "FakeOut", description: "Paper trade crypto with fake money against real Binance prices. Live candlestick charts, instant orders, public leaderboards. All the thrill, none of the risk.", keywords: ["fakeout","trading","crypto","bitcoin","paper","stocks","market","btc","eth","finance","investing","fake"], moduleType: ModuleType.TRADING, moduleConfig: {}, accentColor: "#F5C518" },
  { id: "dnd", name: "Dungeons & Dragons", description: "The Tavern. Find a party, roll dice, look up spells and monsters, and play at the table. Full SRD compendium, AI NPCs, initiative tracker, and community dice tower.", keywords: ["dnd","dungeons","dragons","d&d","tabletop","ttrpg","rpg","5e","dungeon master","dm","pathfinder","dice","d20","campaign"], moduleType: ModuleType.DND, moduleConfig: { twitchCategory: "Dungeons & Dragons" }, accentColor: "#C4A55A", logoUrl: "/brand/lobbies/dnd-logo.png", bannerUrl: "/brand/lobbies/dnd-banner.png" },
  { id: "poe", name: "Path of Exile", description: "Wraeclast awaits. Live economy dashboard powered by poe.ninja, currency trends, item prices, div cards, gem values, and party finder.", keywords: ["poe","path of exile","exile","wraeclast","arpg","grinding gear","ggg","currency","divine","chaos","mirror","mapping","builds"], moduleType: ModuleType.POE, moduleConfig: { twitchCategory: "Path of Exile" }, accentColor: "#AF6025", logoUrl: null, bannerUrl: null, websiteUrl: "https://www.pathofexile.com" },
  { id: "windrose", name: "Windrose", description: "Age of Piracy survival adventure by Kraken Express. Build, sail, survive. Live Steam player count, dev dispatches, Crew Finder, Captain's Log. The unofficial flagship hub.", keywords: ["windrose","kraken","kraken express","pocketpair","pirate","pirates","age of piracy","survival","souls-like","crosswind","naval","sailing","ship","black flag","co-op","pve"], moduleType: ModuleType.WINDROSE, moduleConfig: { twitchCategory: "Windrose", steamAppId: "3041230", publisher: "Pocketpair", studio: "Kraken Express" }, accentColor: "#b8935a", logoUrl: "/brand/lobbies/windrose-logo-official.png", bannerUrl: "/brand/lobbies/windrose-banner-v2.svg", websiteUrl: "https://playwindrose.com/" },
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

  // FakeOut house rooms — pinned, undeletable. Always-on entry points so
  // a first-timer landing on /lobby/fakeout never sees an empty rooms
  // list. The Floor is the headline trading chat; The Pit is for hot
  // takes and rapid-fire reactions; Newcomers is a low-bar onboarding
  // room that opens chat-first (no module on first join).
  { id: "fakeout-floor",      name: "The Floor",     description: "Main trading chat. Live charts, live trades, live witnesses. Where everyone hangs.", lobbyId: "fakeout", defaultModule: "fakeout" },
  { id: "fakeout-pit",        name: "The Pit",       description: "Hot takes, rapid-fire reactions, daily watchlists. Bring volume.",                    lobbyId: "fakeout", defaultModule: "fakeout" },
  { id: "fakeout-newcomers",  name: "Newcomers",     description: "First time? Start here. Ask anything. Read The Brief. Place your first paper trade with company.", lobbyId: "fakeout" },
];

async function seedLobbies() {
  for (const l of SEED_LOBBIES) {
    try {
      await (prisma as any).lobby.upsert({
        where: { id: l.id },
        // Update only code-authoritative fields. Branding (name, description,
        // accentColor, logoUrl, bannerUrl, websiteUrl, keywords) is admin-
        // editable via /lobbies/:id/admin/branding — re-applying the seed
        // value on every API restart was wiping admin changes.
        update: { pinned: true, moduleType: l.moduleType, moduleConfig: l.moduleConfig as any },
        create:  { id: l.id, name: l.name, description: l.description, pinned: true, verified: true, moduleType: l.moduleType, moduleConfig: l.moduleConfig as any, keywords: l.keywords, accentColor: (l as any).accentColor ?? null, logoUrl: (l as any).logoUrl ?? null, bannerUrl: (l as any).bannerUrl ?? null, websiteUrl: (l as any).websiteUrl ?? null },
      });
    } catch (e) { console.warn("seedLobbies:", l.id, e); }
  }
  console.log("[weered] lobbies seeded");

  // Seed rooms — upsert so that newly-added seeds are created AND existing
  // seed rooms are force-pinned (they should never dissolve; they're the
  // default architecture of their parent lobby, not ephemeral user rooms).
  for (const r of SEED_ROOMS) {
    try {
      await prisma.room.upsert({
        where: { id: r.id },
        // defaultModule is part of the seed contract — re-applying on
        // every restart keeps it in sync if the seed evolves. Branding
        // (icon/banner/accent) stays admin-editable separately.
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

// Default config values — used when keys don't exist in DB yet
const SITE_CONFIG_DEFAULTS: Record<string, string> = {
  featuredLobbyId: "",
  registrationOpen: "true",
  maintenanceMode: "false",
  defaultTier: "INNOCENT",
  maxRoomsPerLobby: "50",
  chatRateLimit: "30",
};
// ── Room helpers ──────────────────────────────────────────────────────────────

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

    // Attach reaction aggregates to the loaded messages
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

  // Apply article room meta — in-memory map first, then DB fallback for fresh deploys
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

  // If this room IS a lobby, set lobbyId to itself
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
}

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

// ── Room launcher (MPlayer-style) ──────────────────────────────────────────
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
  // Inject The Operator as a virtual presence if AI is available
  if (isAIAvailable()) {
    users.push({
      id: "operator", name: "The Operator",
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

// Send full state to a single socket only (used on join — don't overwrite others' incremental state)
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
    // Only remove the user from the room if they have NO other sockets still connected.
    // During a page refresh the new socket joins before the old one fires "close",
    // so deleting by userId here would evict the user who already reconnected.
    let userHasOtherSocket = false;
    for (const s of room.sockets) {
      if (s.user?.id === ws.user.id) { userHasOtherSocket = true; break; }
    }
    if (!userHasOtherSocket) {
      const existed = room.users.delete(ws.user.id);
      if (existed) broadcast(room, { type: "presence:leave", roomId, userId: ws.user.id });
      // Record last-seen so the friends list can show "Last seen in <x>"
      // on the offline row. Stamp the room name (falls back to roomId).
      const userId = ws.user.id;
      const location = (room as any).name || roomId;
      (prisma as any).user.update({
        where: { id: userId },
        data: { lastSeenAt: new Date(), lastSeenLocation: location },
      }).catch(() => {});
      // Drop any launch slot/ready entries the user held
      if (room.launch) {
        const hadSlot = room.launch.slots.delete(ws.user.id);
        const hadReady = room.launch.ready.delete(ws.user.id);
        if (hadSlot || hadReady) broadcastLaunch(room);
      }
    }
  }
  ws.roomId = undefined;

  // Mark last activity so dissolution timer knows when the room went idle
  room.lastActiveAt = Date.now();
  // Don't delete immediately — let the dissolution interval handle cleanup after TTL
}
// ── Notoriety system ──────────────────────────────────────────────────────────
// Point values per action (idempotent where flagged)
const NOTORIETY_ACTIONS: Record<string, { points: number; once?: boolean; cooldown?: number }> = {
  BIO_COMPLETE:        { points: 50,   once: true  },
  FIRST_ROOM_HOSTED:   { points: 100,  once: true  },
  ROOM_25_USERS:       { points: 250,  once: false },
  SUBREDDIT_LINKED:    { points: 75,   once: true  },
  DAILY_ACTIVE:        { points: 10,   once: false, cooldown: 86400000 },  // 24h
  CHAT_MESSAGE:        { points: 2,    once: false, cooldown: 30000   },   // 30s cooldown
  ROOM_JOINED:         { points: 5,    once: false, cooldown: 60000   },   // 1min cooldown
  VOICE_JOINED:        { points: 15,   once: false, cooldown: 300000  },   // 5min cooldown
  CHALLENGE_COMPLETED: { points: 200,  once: false, cooldown: 0       },   // Per challenge completion
  FIRST_CHALLENGE:     { points: 100,  once: true                     },   // First ever challenge
  CREW_CREATED:        { points: 100,  once: true  },
  CREW_JOINED:         { points: 25,   once: false },
  FRIEND_ADDED:        { points: 15,   once: false },
  LOBBY_CREATED:       { points: 200,  once: false },
  AVATAR_SET:          { points: 30,   once: true  },
  BUNGIE_LINKED:       { points: 75,   once: true  },
  FIRST_FAKEOUT_TRADE: { points: 100,  once: true  },
  FAKEOUT_TRADE:       { points: 5,    once: false, cooldown: 60000  },  // 1min cooldown
  FAKEOUT_PROFIT:      { points: 25,   once: false, cooldown: 0      },  // Each profitable close
};

// Notoriety rank titles (cosmetic only — does NOT affect Stripe tier)
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

// Cooldown tracking (in-memory, resets on restart — good enough for rate limiting XP)
const notorietyCooldowns = new Map<string, number>();

// Track one-time awards in a simple DB table — for now use a JSON field on User
// or a separate NotorietyEvent table. Using NotorietyEvent for auditability.
async function awardNotoriety(userId: string, action: string): Promise<number | null> {
  const cfg = NOTORIETY_ACTIONS[action];
  if (!cfg) return null;

  try {
    // Check cooldown
    if (cfg.cooldown) {
      const key = `${userId}:${action}`;
      const last = notorietyCooldowns.get(key) || 0;
      if (Date.now() - last < cfg.cooldown) return null;
      notorietyCooldowns.set(key, Date.now());
    }

    if (cfg.once) {
      // Check if already awarded
      const existing = await prisma.notorietyEvent.findFirst({
        where: { userId, action },
      });
      
      if (existing) return null;
    }

    // Get current score before awarding
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

    // Send realtime XP notification via WebSocket
    for (const sock of wss.clients) {
      if ((sock as any).user?.id === userId) {
        send(sock as any, { type: "notoriety:award", action, points: cfg.points });
        // Rank-up event
        if (rankAfter.title !== rankBefore.title) {
          send(sock as any, { type: "notoriety:rankup", oldRank: rankBefore.title, newRank: rankAfter.title, score: scoreAfter });
        }
      }
    }

    // Notification for rank-up
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

// DM delivery — push to all sockets belonging to a user
function dmDeliver(toUserId: string, payload: object) {
  for (const sock of wss.clients) {
    if ((sock as any).user?.id === toUserId) {
      send(sock as any, payload);
    }
  }
}

// ── @mention resolution ──────────────────────────────────────────────────────
// Extract @handles from body and look them up against User.usernameKey.
// Returns { id, name }[] of resolved mentioned users, excluding the sender.
// Case-insensitive; tolerates hyphens, underscores, numbers.
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

// ── Reaction helper: toggle a user's reaction on a target, return full aggregate
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

// ── Chat rate limit + URL spam filter ────────────────────────────────────────
const CHAT_RATE_MAX = 6;          // messages per window
const CHAT_RATE_WINDOW_MS = 10_000; // 10s sliding window
const CHAT_MAX_URLS = 3;          // per message
const recentChatSends = new Map<string, number[]>();

function checkChatRateLimit(userId: string): { ok: boolean; reason?: string; retryInMs?: number } {
  const now = Date.now();
  const arr = recentChatSends.get(userId) || [];
  // Prune anything outside the window
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

// Occasional cleanup of stale entries so the map doesn't grow unbounded
setInterval(() => {
  const now = Date.now();
  for (const [uid, arr] of recentChatSends) {
    const fresh = arr.filter(ts => now - ts < CHAT_RATE_WINDOW_MS);
    if (fresh.length === 0) recentChatSends.delete(uid);
    else recentChatSends.set(uid, fresh);
  }
}, 60_000);

// ── Steam Rich Presence poller ───────────────────────────────────────────────
// Polls Steam GetPlayerSummaries every PRESENCE_POLL_MS for all users with a
// steamId set. Updates User.livePresence with { source: "STEAM", activity,
// detail, url, updatedAt } or clears it when they're offline/hidden.
const PRESENCE_POLL_MS = 120_000; // 2 min
const STEAM_API_KEY = process.env.STEAM_API_KEY || "";
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || "";
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET || "";
const OPENXBL_API_KEY = process.env.OPENXBL_API_KEY || "";
// OpenXBL free tier: 60 requests per 5 min. Each Xbox-linked user costs 1
// request per cycle, so cap Xbox polling to stay well under the ceiling.
const XBL_POLL_CAP_PER_CYCLE = 20;
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
        out[sid] = null; // offline / hidden
      }
    }
    return out;
  } catch {
    return {};
  }
}

// ── OpenXBL (xbl.io) Xbox presence ────────────────────────────────────
// Free tier rate-limit: 60 requests per 5 min. No batch endpoint; one
// request per gamertag lookup / presence poll. Uses X-Authorization header.
const XBL_BASE = "https://xbl.io/api/v2";

async function resolveXboxGamertag(gamertag: string): Promise<{ xuid: string; gamertag: string } | null> {
  if (!OPENXBL_API_KEY) return null;
  try {
    const res = await fetch(`${XBL_BASE}/search/${encodeURIComponent(gamertag)}`, {
      headers: { "X-Authorization": OPENXBL_API_KEY, Accept: "application/json" },
    });
    if (!res.ok) return null;
    const j: any = await res.json();
    // Responses come wrapped: { content: { people: [...] } } or { content: { profileUsers: [...] } }
    const content = j?.content ?? j;
    const p = content?.people?.[0] || content?.profileUsers?.[0] || null;
    if (!p) return null;
    const xuid = String(p.xuid || p.id || "");
    // Prefer the modern display form ("Weered#3068") so our stored copy matches what the user typed
    const gt = String(p.uniqueModernGamertag || p.gamertag || p.modernGamertag || gamertag);
    if (!xuid) return null;
    return { xuid, gamertag: gt };
  } catch { return null; }
}

async function pollXboxPresenceOne(xuid: string): Promise<any | null> {
  if (!OPENXBL_API_KEY || !xuid) return null;
  try {
    const res = await fetch(`${XBL_BASE}/${encodeURIComponent(xuid)}/presence`, {
      headers: { "X-Authorization": OPENXBL_API_KEY, Accept: "application/json" },
    });
    if (!res.ok) return null;
    const j: any = await res.json();
    // OpenXBL wraps the payload in `content`
    const body = j?.content ?? j;
    const state = String(body?.state || "").toLowerCase();
    const devices: any[] = Array.isArray(body?.devices) ? body.devices : [];
    // Prefer Full placement + Active state, and skip "Home" (the dashboard) /
    // empty-name entries (anonymous web sessions)
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
      // Priority: Twitch-live > Xbox game > Steam game/online > null
      const primary = (tw && tw.source === "TWITCH") ? tw
        : (xb && xb.source === "XBOX") ? xb
        : (st ?? null);
      if (primary === undefined) continue;
      await prisma.user.update({
        where: { id: u.id },
        data: { livePresence: primary as any, presenceCheckedAt: new Date() },
      }).catch(() => {});

      // Push the change into every room this user is currently in so the
      // left-rail presence line updates without requiring a rejoin. We also
      // refresh the AuthedUser on any connected sockets so subsequent
      // presence:join broadcasts carry the latest state.
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
      } catch { /* ignore — best-effort fanout */ }
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

// ── Operator system user + welcome DM ───────────────────────────────────────
// "operator" is a reserved mention but we own a real User row for it so the
// welcome DM can FK against User.id. Cached on first lookup. Created lazily
// the first time we need it (typically on the first signup).
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

// Seed a single welcome DM from The Operator to a freshly-registered user
// so they have an unread in the Burner on first login. Fire-and-forget.
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

// Expo Push (mobile). Accepts Expo push tokens (ExponentPushToken[...]).
// Server-to-server REST call to exp.host — no VAPID keys, no FCM creds needed.
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
    // Drop tokens Expo flags as DeviceNotRegistered so they don't accumulate.
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

// Convenience wrapper that fires both transports for a user.
async function sendPush(userId: string, data: { title: string; body: string; url?: string; tag?: string }) {
  await Promise.all([
    sendWebPush(userId, data),
    sendExpoPush(userId, data),
  ]);
}

// ── Notification helper — creates in-app notification + WS push + browser push ──
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
    // Push to user via WebSocket if online
    for (const sock of wss.clients) {
      if ((sock as any).user?.id === opts.userId) {
        send(sock as Sock, {
          type: "notification:new",
          notification: { ...notif, createdAt: notif.createdAt?.toISOString?.() || notif.createdAt },
        });
      }
    }
    // Browser push if offline
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

// Hydrate globalRole onto AuthedUser from DB (called once per WS connection)
async function hydrateGlobalRole(user: AuthedUser): Promise<AuthedUser> {
  try {
    const u = await prisma.user.findUnique({
      where: { id: user.id },
      select: { globalRole: true, tier: true, avatarColor: true, avatar: true, steamId: true, twitchLogin: true, xboxGamertag: true, livePresence: true, panelBgColor: true, panelAccentColor: true, pillBgColor: true, pillAccentColor: true } as any,
    });
    return {
      ...user,
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

function authFromHeader(authHeader?: string): AuthedUser | null {
  if (!authHeader) return null;
  const raw = String(authHeader).trim();
  const m = raw.match(/^Bearer\s+(.+)$/i);
  if (m) return verifyToken(m[1]);
  // Fallback: try raw token directly (for query param auth)
  return verifyToken(raw);
}

async function resolveUserId(raw: string): Promise<string> {
  console.log("[resolveUserId] raw=", JSON.stringify(raw));
  // If it looks like a cuid already, use it directly
  if (raw.length > 20 && !raw.includes(" ")) return raw;
  const found = await prisma.user.findFirst({
    where: { OR: [{ usernameKey: raw.toLowerCase() }, { name: raw }] },
    select: { id: true },
  });
  console.log("[resolveUserId] found=", JSON.stringify(found));
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

  // Already in this room on this socket — just republish state to this socket only, not everyone
  if (ws.roomId === roomId) { publishStateToSocket(ws, room); return true; }
  if (ws.roomId) leaveRoom(ws);

  ws.roomId = roomId;
  ws.pendingRoomId = undefined;
  room.sockets.add(ws);
  room.lastActiveAt = Date.now();
  if (ws.user) room.pending.delete(ws.user.id);

  if (ws.user && !room.users.has(ws.user.id)) {
    const userEntry = { id: ws.user.id, name: ws.user.name, globalRole: ws.user.globalRole || "USER", tier: ws.user.tier || "INNOCENT", avatarColor: ws.user.avatarColor ?? undefined, avatar: ws.user.avatar ?? undefined, steamId: (ws.user as any).steamId ?? undefined, twitchLogin: (ws.user as any).twitchLogin ?? undefined, xboxGamertag: (ws.user as any).xboxGamertag ?? undefined, isAway: Boolean((ws.user as any).isAway), livePresence: (ws.user as any).livePresence ?? null, pillBgColor: (ws.user as any).pillBgColor ?? undefined, pillAccentColor: (ws.user as any).pillAccentColor ?? undefined };
    room.users.set(ws.user.id, userEntry);
    broadcast(room, { type: "presence:join", roomId, user: userEntry });
  }

  if (ws.user) { try { await persistMember(room, ws.user); } catch {} }

  // Award notoriety for joining a room (cooldown-gated)
  if (ws.user) awardNotoriety(ws.user.id, "ROOM_JOINED").catch(() => {});

  // Only send full state to the joining socket — everyone else already got presence:join
  publishStateToSocket(ws, room);

  if (room.msgs.length) {
    send(ws, { type: "chat:history", roomId, msgs: room.msgs.slice(-80) });
  }

  // Send current YouTube state so late joiners see what everyone is watching
  if (room.ytState) {
    send(ws, { type: "youtube:state", roomId, ...room.ytState });
  }

  return true;
}

// ── HTTP server ───────────────────────────────────────────────────────────────


// ── Content Ingestion Worker ──────────────────────────────────────────────────
// Fetches from 6 sources every 20 min, normalises into FeedItem, stores in DB.
// Heat = recency score (0-70) + room presence bonus (0-30)

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
      // Seed in-memory article room meta — title + thumbnail for header display
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

  // Rate limiting — defends auth/signup against brute force and bot signups.
  // Global default is generous; auth routes opt into stricter per-route limits below.
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

  // Cloudflare Turnstile verifier — gated behind TURNSTILE_SECRET. Without
  // the secret set this is a no-op so the existing flow keeps working until
  // keys are provisioned. Site key lives client-side as NEXT_PUBLIC_TURNSTILE_SITE_KEY.
  async function verifyCaptcha(token: unknown, ip: string): Promise<{ ok: true } | { ok: false; reason: string }> {
    const secret = process.env.TURNSTILE_SECRET;
    if (!secret) return { ok: true }; // gating disabled
    if (typeof token !== "string" || !token) return { ok: false, reason: "missing_captcha" };
    try {
      const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ secret, response: token, remoteip: ip }).toString(),
      });
      const j = (await r.json().catch(() => null)) as { success?: boolean; "error-codes"?: string[] } | null;
      if (!j?.success) return { ok: false, reason: (j?.["error-codes"]?.[0] ?? "captcha_failed") };
      return { ok: true };
    } catch (e) {
      console.warn("[turnstile] verify error:", e);
      return { ok: false, reason: "captcha_unreachable" };
    }
  }

  // Store raw body for Stripe webhook signature verification
  app.addHook("preParsing", async (req, _reply, payload) => {
    if (req.url === "/subscribe/webhook") {
      const chunks: Buffer[] = [];
      for await (const chunk of payload as any) chunks.push(Buffer.from(chunk));
      const raw = Buffer.concat(chunks);
      (req as any).rawBody = raw;
      // Return a new readable stream so Fastify can still parse it
      const { Readable } = await import("stream");
      const copy = new Readable();
      copy.push(raw);
      copy.push(null);
      return copy;
    }
    return payload;
  });

  // Windrose banner reel — 24 cinematic images, one chosen at random per
  // request so the hero rotates every refresh. Applied to any lobby response
  // where `id === "windrose"`. If we ever want per-lobby reels, promote this
  // to a schema field and iterate the list.
  const WINDROSE_BANNER_COUNT = 24;
  function applyWindroseReel<T extends { id?: string; bannerUrl?: string | null } | null>(lobby: T): T {
    if (!lobby || lobby.id !== "windrose") return lobby;
    const idx = Math.floor(Math.random() * WINDROSE_BANNER_COUNT) + 1;
    const num = idx.toString().padStart(2, "0");
    (lobby as any).bannerUrl = `/brand/windrose/banners/banner-${num}.webp`;
    return lobby;
  }

  // GET /featured — public endpoint returning featured lobby for homepage hero
  app.get("/featured", async (_req, reply) => {
    const featuredId = await getSiteConfig("featuredLobbyId");
    if (!featuredId) {
      // Fallback: return first pinned lobby by name
      const fallback = await (prisma as any).lobby.findFirst({
        where: { pinned: true },
        select: {
          id: true, name: true, description: true, verified: true, pinned: true,
          moduleType: true, moduleConfig: true, keywords: true,
          accentColor: true, logoUrl: true, bannerUrl: true, websiteUrl: true,
          _count: { select: { rooms: true, members: true } },
        },
        orderBy: { name: "asc" },
      });
      return reply.send({ ok: true, lobby: applyWindroseReel(fallback), source: "fallback" });
    }

    const lobby = await (prisma as any).lobby.findUnique({
      where: { id: featuredId },
      select: {
        id: true, name: true, description: true, verified: true, pinned: true,
        moduleType: true, moduleConfig: true, keywords: true,
        accentColor: true, logoUrl: true, bannerUrl: true, websiteUrl: true,
        _count: { select: { rooms: true, members: true } },
      },
    });

    if (!lobby) {
      return reply.send({ ok: true, lobby: null, source: "missing" });
    }

    return reply.send({ ok: true, lobby: applyWindroseReel(lobby), source: "config" });
  });

  // Health
  app.get("/health", async () => {
    try { await prisma.$queryRaw`SELECT 1`; return { ok: true, db: "ok" }; }
    catch { return { ok: true, db: "down" }; }
  });

  // Auth: dev-login
  app.post("/auth/dev-login", {
    config: { rateLimit: { max: 30, timeWindow: "10 minutes" } },
  }, async (req, reply) => {
    const body: any = (req as any).body || {};
    const raw = typeof body.username === "string" ? body.username : "";
    let name = (raw || "").trim().slice(0, 32);
    if (!name) { const suf = Math.floor(Math.random() * 9000 + 1000); name = `Guest-${suf}`; }
    const usernameKey = name.toLowerCase();
    const u = await prisma.user.upsert({
      where: { usernameKey }, update: { name }, create: { usernameKey, name },
    });
    const user = { id: u.id, name: u.name || name };
    const token = jwt.sign({ sub: user.id, name: user.name }, JWT_SECRET, { expiresIn: "7d" });
    return reply.send({ token, user });
  });

  app.post("/dev-login", async (req, reply) => {
    const r = await (app as any).inject({ method: "POST", url: "/auth/dev-login", payload: (req as any).body || {} });
    reply.code(r.statusCode).headers(r.headers).send(r.json());
  });

  // Auth: register — 5 attempts/IP/hour, plus Turnstile if configured.
  app.post("/auth/register", {
    config: { rateLimit: { max: 5, timeWindow: "1 hour" } },
  }, async (req, reply) => {
    const body: any = (req as any).body || {};
    const rawU = typeof body.username === "string" ? body.username : "";
    const rawP = typeof body.password === "string" ? body.password : "";
    const rawE = typeof body.email === "string" ? body.email : "";
    const captchaToken = body.captchaToken ?? body.turnstileToken;
    const username = (rawU || "").trim().toLowerCase().slice(0, 32);
    const password = (rawP || "").trim();
    const email = (rawE || "").trim().toLowerCase().slice(0, 254) || null;
    if (!username || !password) return reply.code(400).send({ error: "Missing username/password" });
    if (password.length < 6) return reply.code(400).send({ error: "Password too short" });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply.code(400).send({ error: "Invalid email" });
    const cap = await verifyCaptcha(captchaToken, req.ip);
    if (!cap.ok) return reply.code(400).send({ error: "captcha_required", reason: cap.reason });
    const existing = await prisma.localAuth.findUnique({ where: { username } }).catch(() => null);
    if (existing) return reply.code(409).send({ error: "Username already exists" });
    if (email) {
      const emailTaken = await prisma.localAuth.findUnique({ where: { email } }).catch(() => null);
      if (emailTaken) return reply.code(409).send({ error: "Email already in use" });
    }
    const reserved = await isNameReserved(username, "USERNAME");
    if (reserved) return reply.code(403).send({ error: "This username is reserved and cannot be used." });
    const user = await prisma.user.create({ data: { name: username, usernameKey: username, email } });
    const passwordHash = await bcrypt.hash(password, 10);

    // Verification token only generated when email provided. 24h expiry.
    let verifyToken: string | null = null;
    let verifyTokenExp: Date | null = null;
    if (email) {
      verifyToken = randomBytes(32).toString("hex");
      verifyTokenExp = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }
    await prisma.localAuth.create({
      data: {
        username, passwordHash, userId: user.id, email,
        ...(verifyToken ? { verifyToken, verifyTokenExp } : {}),
      },
    });
    if (email && verifyToken) {
      const tmpl = buildVerifyEmail({ username, token: verifyToken });
      sendMail({ to: email, subject: tmpl.subject, html: tmpl.html }).catch(() => {});
    }
    seedWelcomeDM(user.id).catch(() => {});
    const token = jwt.sign({ sub: user.id, name: user.name }, JWT_SECRET, { expiresIn: "7d" });
    return reply.send({ token, user, pendingVerification: Boolean(email) });
  });

  // Auth: verify email — token comes from the link in the verification email.
  app.post("/auth/verify-email", {
    config: { rateLimit: { max: 30, timeWindow: "1 hour" } },
  }, async (req, reply) => {
    const body: any = (req as any).body || {};
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token) return reply.code(400).send({ error: "Missing token" });
    const la = await prisma.localAuth.findUnique({ where: { verifyToken: token } }).catch(() => null);
    if (!la) return reply.code(400).send({ error: "Invalid or expired token" });
    if (la.verifyTokenExp && la.verifyTokenExp.getTime() < Date.now()) {
      return reply.code(400).send({ error: "Token expired" });
    }
    await prisma.localAuth.update({
      where: { id: la.id },
      data: { emailVerified: true, verifyToken: null, verifyTokenExp: null },
    });
    const user = await prisma.user.findUnique({ where: { id: la.userId } });
    if (!user) return reply.code(500).send({ error: "Account record missing" });
    if (user.banned) return reply.code(403).send({ ok: false, error: "banned" });
    const sessionToken = jwt.sign({ sub: user.id, name: user.name }, JWT_SECRET, { expiresIn: "7d" });
    return reply.send({ ok: true, token: sessionToken, user });
  });

  // Auth: resend verification email — by username so the user can request it
  // even if they don't remember which email they used. Always returns ok to
  // avoid leaking whether the username exists.
  app.post("/auth/resend-verification", {
    config: { rateLimit: { max: 5, timeWindow: "1 hour" } },
  }, async (req, reply) => {
    const body: any = (req as any).body || {};
    const username = (typeof body.username === "string" ? body.username : "").trim().toLowerCase().slice(0, 32);
    if (!username) return reply.send({ ok: true });
    const la = await prisma.localAuth.findUnique({ where: { username } }).catch(() => null);
    if (la && la.email && !la.emailVerified) {
      const verifyToken = randomBytes(32).toString("hex");
      const verifyTokenExp = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await prisma.localAuth.update({ where: { id: la.id }, data: { verifyToken, verifyTokenExp } });
      const tmpl = buildVerifyEmail({ username, token: verifyToken });
      sendMail({ to: la.email, subject: tmpl.subject, html: tmpl.html }).catch(() => {});
    }
    return reply.send({ ok: true });
  });

  // Auth: forgot password — body is { username } OR { email }. Always returns
  // ok regardless of whether the account exists (prevents email enumeration).
  app.post("/auth/forgot-password", {
    config: { rateLimit: { max: 5, timeWindow: "1 hour" } },
  }, async (req, reply) => {
    const body: any = (req as any).body || {};
    const username = (typeof body.username === "string" ? body.username : "").trim().toLowerCase().slice(0, 32);
    const email = (typeof body.email === "string" ? body.email : "").trim().toLowerCase().slice(0, 254);
    let la = null as any;
    if (username) la = await prisma.localAuth.findUnique({ where: { username } }).catch(() => null);
    else if (email) la = await prisma.localAuth.findUnique({ where: { email } }).catch(() => null);
    if (la && la.email) {
      const resetToken = randomBytes(32).toString("hex");
      const resetExp = new Date(Date.now() + 60 * 60 * 1000); // 1h
      await prisma.localAuth.update({
        where: { id: la.id },
        data: { passwordResetToken: resetToken, passwordResetTokenExp: resetExp },
      });
      const tmpl = buildResetEmail({ username: la.username, token: resetToken });
      sendMail({ to: la.email, subject: tmpl.subject, html: tmpl.html }).catch(() => {});
    }
    return reply.send({ ok: true });
  });

  // Auth: reset password — { token, password }. Validates token + expiry,
  // sets new password, invalidates token.
  app.post("/auth/reset-password", {
    config: { rateLimit: { max: 10, timeWindow: "1 hour" } },
  }, async (req, reply) => {
    const body: any = (req as any).body || {};
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const password = typeof body.password === "string" ? body.password.trim() : "";
    if (!token || !password) return reply.code(400).send({ error: "Missing token or password" });
    if (password.length < 6) return reply.code(400).send({ error: "Password too short" });
    const la = await prisma.localAuth.findUnique({ where: { passwordResetToken: token } }).catch(() => null);
    if (!la) return reply.code(400).send({ error: "Invalid or expired token" });
    if (la.passwordResetTokenExp && la.passwordResetTokenExp.getTime() < Date.now()) {
      return reply.code(400).send({ error: "Token expired" });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.localAuth.update({
      where: { id: la.id },
      data: { passwordHash, passwordResetToken: null, passwordResetTokenExp: null },
    });
    return reply.send({ ok: true });
  });

  // Auth: login — 20 attempts/IP/15min. Username-level limiting would require a
  // stateful store (redis); IP-level keeps it simple and still defeats spray attacks.
  app.post("/auth/login", {
    config: { rateLimit: { max: 20, timeWindow: "15 minutes" } },
  }, async (req, reply) => {
    const body: any = (req as any).body || {};
    const rawU = typeof body.username === "string" ? body.username : "";
    const rawP = typeof body.password === "string" ? body.password : "";
    const username = (rawU || "").trim().toLowerCase().slice(0, 32);
    const password = (rawP || "").trim();
    if (!username || !password) return reply.code(400).send({ error: "Missing username/password" });
    const la = await prisma.localAuth.findUnique({ where: { username } }).catch(() => null);
    if (!la) return reply.code(401).send({ error: "Invalid credentials" });
    const ok = await bcrypt.compare(password, la.passwordHash);
    if (!ok) return reply.code(401).send({ error: "Invalid credentials" });
    const user = await prisma.user.findUnique({ where: { id: la.userId } });
    if (!user) return reply.code(401).send({ error: "Invalid credentials" });
    if (user.banned) return reply.code(403).send({ ok: false, error: "banned", message: "Your account has been suspended." });
    const token = jwt.sign({ sub: user.id, name: user.name }, JWT_SECRET, { expiresIn: "7d" });
    return reply.send({ token, user });
  });


  // Auth: Google OAuth
  const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID     || "";
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
  const GOOGLE_CALLBACK_URL  = process.env.GOOGLE_CALLBACK_URL  || "https://api.weered.ca/auth/google/callback";
  const WEB_URL              = process.env.APP_URL               || "https://weered.ca";

  // Allowlist: web app, mobile standalone scheme, and Expo Go dev redirects.
  // Mobile passes its own redirect URI because it differs between Expo Go and a built app.
  const REDIRECT_ALLOW = [
    /^https:\/\/([a-z0-9-]+\.)?weered\.ca(\/.*)?$/i,
    /^weered:\/\/[^\s]*$/i,
    /^exp:\/\/[0-9a-z.\-:]+\/--\/[^\s]*$/i,
  ];
  const isAllowedRedirect = (u: string) => REDIRECT_ALLOW.some((re) => re.test(u));

  app.get("/auth/google", async (req, reply) => {
    const { redirect } = (req as any).query as { redirect?: string };
    const client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL);
    let state: string | undefined;
    if (redirect && isAllowedRedirect(redirect)) {
      state = jwt.sign({ r: redirect }, JWT_SECRET, { expiresIn: "10m" });
    }
    const url = client.generateAuthUrl({
      access_type: "offline",
      scope: ["profile", "email"],
      prompt: "select_account",
      ...(state ? { state } : {}),
    });
    return reply.redirect(url);
  });

  app.get("/auth/google/callback", async (req, reply) => {
    const { code, state } = (req as any).query as { code?: string; state?: string };
    // Decode a custom redirect if one was signed into state on the start leg.
    let customRedirect: string | null = null;
    if (state) {
      try {
        const decoded = jwt.verify(state, JWT_SECRET) as { r?: string };
        if (decoded?.r && isAllowedRedirect(decoded.r)) customRedirect = decoded.r;
      } catch {}
    }
    const finishUrl = (path: string, qs: string) => {
      if (customRedirect) {
        const sep = customRedirect.includes("?") ? "&" : "?";
        return `${customRedirect}${sep}${qs}`;
      }
      return `${WEB_URL}${path}?${qs}`;
    };
    if (!code) return reply.redirect(customRedirect ? `${customRedirect}${customRedirect.includes("?") ? "&" : "?"}error=no_code` : `${WEB_URL}/login?error=no_code`);
    try {
      const client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL);
      const { tokens } = await client.getToken(code);
      client.setCredentials(tokens);
      const ticket = await client.verifyIdToken({ idToken: tokens.id_token!, audience: GOOGLE_CLIENT_ID });
      const payload = ticket.getPayload();
      if (!payload) return reply.redirect(`${WEB_URL}/login?error=no_payload`);
      const googleId = payload.sub;
      const email = payload.email || null;
      const avatar = payload.picture || null;
      const displayName = payload.name || `g_${googleId.slice(0, 12)}`;

      // 1. Find by googleId
      let user = await prisma.user.findFirst({ where: { googleId } });

      // 2. Find by email and link
      if (!user && email) {
        user = await prisma.user.findFirst({ where: { email } });
        if (user) {
          await prisma.user.update({ where: { id: user.id }, data: { googleId, avatar: avatar || undefined } });
        }
      }

      // 3. Create new user
      const isNew = !user;
      if (!user) {
        const tempName = `g_${googleId.slice(0, 12)}`;
        user = await prisma.user.create({ data: { name: displayName, usernameKey: tempName, googleId, email, avatar } });
        seedWelcomeDM(user.id).catch(() => {});
      }
      if (user.banned) return reply.redirect(customRedirect ? `${customRedirect}${customRedirect.includes("?") ? "&" : "?"}error=account_suspended` : `${WEB_URL}/login?error=account_suspended`);
      const token = jwt.sign({ sub: user.id, name: user.name }, JWT_SECRET, { expiresIn: "7d" });
      const userParam = encodeURIComponent(JSON.stringify({ id: user.id, name: user.name }));
      const qs = `token=${token}&user=${userParam}${isNew ? "&new=1" : ""}`;
      return reply.redirect(finishUrl(isNew ? "/onboarding" : "/auth/google/finish", qs));
    } catch (e) {
      console.error("[google callback]", e);
      return reply.redirect(customRedirect ? `${customRedirect}${customRedirect.includes("?") ? "&" : "?"}error=oauth_failed` : `${WEB_URL}/login?error=oauth_failed`);
    }
  });

  // Auth: username availability check
  app.get("/auth/username-check", async (req, reply) => {
    const { username } = (req as any).query as { username?: string };
    const clean = (username || "").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 32);
    if (clean.length < 2) return reply.send({ available: false, reason: "too_short" });
    const existing = await prisma.user.findUnique({ where: { usernameKey: clean } }).catch(() => null);
    return reply.send({ available: !existing });
  });

  // Auth: onboarding — set username after Google login
  app.post("/auth/onboarding", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ error: "Unauthorized" });
    const body: any = (req as any).body || {};
    const raw = typeof body.username === "string" ? body.username : "";
    const usernameKey = raw.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 32);
    if (usernameKey.length < 2) return reply.code(400).send({ error: "Username too short" });
    const existing = await prisma.user.findUnique({ where: { usernameKey } }).catch(() => null);
    if (existing && existing.id !== u.id) return reply.code(409).send({ error: "Username taken" });
    const reserved = await isNameReserved(usernameKey, "USERNAME");
    if (reserved) return reply.code(403).send({ error: "This username is reserved and cannot be used." });
    const updated = await prisma.user.update({
      where: { id: u.id },
      data: { name: usernameKey, usernameKey },
    });
    const token = jwt.sign({ sub: updated.id, name: updated.name }, JWT_SECRET, { expiresIn: "7d" });
    return reply.send({ token, user: { id: updated.id, name: updated.name } });
  });

  // Voice token (LiveKit). Publish permission is gated by the room's
  // voiceMode + speaker set:
  //   OPEN        → anyone may publish
  //   QUEUED      → mods + owner + approved speakers may publish
  //   LISTEN_ONLY → mods + owner only
  app.post("/voice/token", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) return reply.code(500).send({ ok: false, error: "livekit_not_configured" });
    const body: any = (req as any).body || {};
    const roomIdRaw = String(body.roomId || body.room || "").trim().slice(0, 64);
    if (!roomIdRaw) return reply.code(400).send({ ok: false, error: "missing_roomId" });

    // Resolve the room state — strip a leading "room:" prefix if present
    // (clients connect to LiveKit by raw room id but our state uses the
    // canonicalized id) and check voice gating.
    const cleaned = roomIdRaw.startsWith("room:") ? roomIdRaw.slice(5) : roomIdRaw;
    const lookup = normalizeRoomId(cleaned);
    let canPublish = true;
    try {
      const room = lookup ? rooms.get(lookup) || (await ensureRoomLoaded(lookup).catch(() => null)) : null;
      if (room) {
        const isOwnerOrMod = isModOrOwner(room, u.id, (u as any).globalRole);
        const mode = room.voiceMode || "OPEN";
        if (mode === "OPEN") {
          canPublish = true;
        } else if (mode === "LISTEN_ONLY") {
          canPublish = isOwnerOrMod;
        } else { // QUEUED
          canPublish = isOwnerOrMod || (room.voiceSpeakers ? room.voiceSpeakers.has(u.id) : false);
        }
      }
    } catch {}

    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity: u.id, name: u.name });
    at.addGrant({ roomJoin: true, room: roomIdRaw, canPublish, canSubscribe: true, canPublishData: true });
    const token = await at.toJwt();
    awardNotoriety(u.id, "VOICE_JOINED").catch(() => {});
    return reply.send({ ok: true, url: LIVEKIT_URL, token, canPublish });
  });

  // Rooms
  // GET /lobbies — all lobbies with live counts


  // ── Lobby admin access helper (used by lobbies, events, billing plugins) ──
  // Returns null and sends an error response if access is denied; caller checks.
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

  // ── Lobbies — extracted to routes/lobbies.ts ──────────────────────────────
  await app.register(lobbiesRoutes, {
    authFromHeader, verifyToken, getGlobalRole, canAccessStaff, getLobbyRole,
    applyWindroseReel, lobbyAdminAccess, globalAudit, rooms,
  } as any);

  // ── Rooms — extracted to routes/rooms.ts ──────────────────────────────────
  await app.register(roomsRoutes, {
    authFromHeader, verifyToken, getGlobalRole, canAccessStaff,
    rooms, ensureRoomLoaded, normalizeRoomId, buildStatePayload, send, shortRoomId,
  } as any);

  // ── Staff — extracted to routes/staff.ts ──────────────────────────────────
  await app.register(staffRoutes, {
    authFromHeader, getGlobalRole, canAccessStaff, canAssignRoles, globalAudit,
    broadcast, broadcastEvent, rooms, send, wss, shortRoomId,
    getAllSiteConfig, setSiteConfig, SITE_CONFIG_DEFAULTS, getSiteConfig,
  } as any);

  // ── Staff API (remaining inline staff routes — gradually migrating) ────────

  // GET /staff/me

  // GET /staff/users?q=

  // POST /staff/users/:userId/role

  // POST /staff/users/:userId/note

  // GET /staff/users/:userId/notes

  // GET /staff/audit
// POST /staff/lobby/lock — lock lobby chat (SUPPORT+)

  // POST /staff/lobby/unlock — unlock lobby chat (SUPPORT+)

  // POST /staff/lobby/clear-chat — clear lobby messages (STAFF+)

  // POST /staff/room/clear-chat — clear room messages (room owner/mod or STAFF+)
  // POST /staff/broadcast — send a system message to all connected users
  // POST /staff/users/:userId/kick

  // POST /staff/users/:userId/ban — global platform ban

  // DELETE /staff/users/:userId/ban — unban user

  // ── Start HTTP ────────────────────────────────────────────────────────────────

  await 
    app.get("/staff/rooms", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });

    const list = await prisma.room.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, locked: true, createdAt: true, lobbyId: true, _count: { select: { members: true } } },
    });
    const roomsMem = new Map([...rooms.entries()]);
    const enriched = list.map(r => {
    const mem = roomsMem.get(r.id);
    return {
      id: r.id, name: r.name || "", locked: Boolean(r.locked),
      members: r._count.members, createdAt: r.createdAt.toISOString(),
      lobbyId: r.lobbyId || null,
      pinned: mem?.pinned || false,
      liveUsers: mem?.users.size || 0,
      lastActiveAt: mem?.lastActiveAt || null,
    };
  });
  return reply.send({ ok: true, rooms: enriched });
  });
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
          notoriety: true,
          tier: true,
          globalRole: true,
          createdAt: true,
          updatedAt: true,
          avatar: true,
          avatarColor: true,
          steamId: true,
          twitchLogin: true,
          xboxGamertag: true,
        },
      });

      if (!u) return reply.code(404).send({ error: "User not found" });

      // Count rooms hosted (owned)
      const roomsHosted = await prisma.room.count({ where: { ownerId: u.id } });

      // Linked game accounts (public info only)
      const gameAccounts = await prisma.userGameAccount.findMany({
        where: { userId: u.id },
        select: { gameType: true, displayName: true, platform: true, createdAt: true },
      });

      // Primary crew (earliest-joined). Used as repping flair next to the
      // user's name in chat + hover cards. If the user's in multiple crews
      // we surface the oldest one — "your first ship" wins by default.
      const primaryMembership = await (prisma as any).crewMember.findFirst({
        where: { userId: u.id },
        orderBy: { joinedAt: "asc" },
        include: { crew: { select: { id: true, name: true, tag: true, logoUrl: true, accentColor: true, tagShape: true } } },
      });

      const nRank = getNotorietyRank(u.notoriety ?? 0);
      return reply.send({
        id: u.id,
        name: u.name,
        bio: u.bio || "",
        notoriety: u.notoriety ?? 0,
        notorietyRank: nRank.title,
        notorietyNext: nRank.next ? { title: nRank.next.title, min: nRank.next.min } : null,
        tier: u.tier ?? "INNOCENT",
        globalRole: String(u.globalRole ?? "USER"),
        joinedAt: u.createdAt.toISOString(),
        lastSeen: u.updatedAt.toISOString(),
        roomsHosted,
        avatar: u.avatar || null,
        avatarColor: u.avatarColor || null,
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

  // PATCH /profile/me  — update own bio / avatarColor
  app.patch("/profile/me", async (req, reply) => {
    const authHeader = (req.headers as any).authorization;
    const viewer = authFromHeader(authHeader);
    if (!viewer) return reply.code(401).send({ error: "Unauthorized" });

    const body: any = (req as any).body || {};
    const bio = typeof body.bio === "string" ? body.bio.trim().slice(0, 280) : undefined;
    const avatarColor = typeof body.avatarColor === "string" ? body.avatarColor.slice(0, 20) : undefined;
    const avatar = typeof body.avatar === "string" ? body.avatar.slice(0, 500) : undefined;

    // Profile customization (Phase 1: colors). Accept either a valid #RRGGBB
    // hex or empty string to clear. Anything else is silently dropped.
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
      bio === undefined && avatarColor === undefined && avatar === undefined
      && panelBgColor === undefined && panelAccentColor === undefined
      && pillBgColor === undefined && pillAccentColor === undefined
    ) return reply.code(400).send({ error: "Nothing to update" });

    try {
      const u = await prisma.user.update({
        where: { id: viewer.id },
        data: {
          ...(bio !== undefined && { bio }),
          ...(avatarColor !== undefined && { avatarColor }),
          ...(avatar !== undefined && { avatar: avatar || null }),
          ...(panelBgColor !== undefined && { panelBgColor }),
          ...(panelAccentColor !== undefined && { panelAccentColor }),
          ...(pillBgColor !== undefined && { pillBgColor }),
          ...(pillAccentColor !== undefined && { pillAccentColor }),
        } as any,
        select: { id: true, bio: true } as any,
      });

      // Award notoriety for completing bio (one-time)
      if (bio !== undefined && bio.length >= 10) {
        await awardNotoriety(viewer.id, "BIO_COMPLETE");
      }

      // If any visible field changed, update all live sockets for this user
      // and re-broadcast presence in every room they're in so other clients
      // see the change instantly. Without this, viewers would only see the
      // updated colours after a fresh /friends fetch or a page reload.
      const visibleChanged =
        avatarColor !== undefined || avatar !== undefined
        || panelBgColor !== undefined || panelAccentColor !== undefined
        || pillBgColor !== undefined  || pillAccentColor !== undefined;
      if (visibleChanged) {
        if (avatar !== undefined && avatar) awardNotoriety(viewer.id, "AVATAR_SET").catch(() => {});
        for (const sock of wss.clients) {
          const s = sock as Sock;
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

      return reply.send({ ok: true, bio: u.bio });
    } catch (e) {
      console.error("[profile PATCH]", e);
      return reply.code(500).send({ error: "Server error" });
    }
  });

  // ── Rich Presence (Steam pull) ───────────────────────────────────────────
  // POST /profile/me/steam-id  { steamId } — accepts a SteamID64 (17 digits)
  // OR a vanity URL/username (e.g. "weeredjs" from steamcommunity.com/id/weeredjs)
  // Resolves vanity via Steam's ResolveVanityURL API.
  app.post("/profile/me/steam-id", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const body: any = (req as any).body || {};
    let raw = String(body.steamId || "").trim();

    // Clear
    if (raw === "") {
      await prisma.user.update({
        where: { id: u.id },
        data: { steamId: null, livePresence: null, presenceCheckedAt: null },
      });
      return reply.send({ ok: true, steamId: null });
    }

    // Strip common paste mistakes — users often paste the full profile URL
    // e.g. "https://steamcommunity.com/id/weeredjs/" or ".../profiles/76561198..."
    const urlMatch = raw.match(/steamcommunity\.com\/(id|profiles)\/([^/\s?#]+)/i);
    if (urlMatch) raw = urlMatch[2];

    let steamId: string | null = null;

    if (/^\d{17}$/.test(raw)) {
      steamId = raw;
    } else if (STEAM_API_KEY) {
      // Resolve vanity URL -> SteamID64
      try {
        const resolveUrl = `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v0001/?key=${STEAM_API_KEY}&vanityurl=${encodeURIComponent(raw)}`;
        const res = await fetch(resolveUrl);
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

  // POST /profile/me/twitch-login  { twitchLogin } — set or clear
  app.post("/profile/me/twitch-login", async (req, reply) => {
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
      data: { twitchLogin, livePresence: twitchLogin ? undefined : null, presenceCheckedAt: null },
    });
    return reply.send({ ok: true, twitchLogin });
  });

  // POST /profile/me/xbox-gamertag  { gamertag } — set or clear. Resolves
  // gamertag -> xuid via OpenXBL (xbl.io). Empty string clears.
  app.post("/profile/me/xbox-gamertag", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const body: any = (req as any).body || {};
    const raw = String(body.gamertag || "").trim();

    if (raw === "") {
      await prisma.user.update({
        where: { id: u.id },
        data: { xboxGamertag: null, xboxXuid: null, livePresence: null, presenceCheckedAt: null },
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

  // GET /profile/me/presence — authed user's own link state + most recent detected presence
  app.get("/profile/me/presence", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const row = await prisma.user.findUnique({
      where: { id: u.id },
      select: { steamId: true, twitchLogin: true, xboxGamertag: true, xboxXuid: true, livePresence: true, presenceCheckedAt: true },
    });
    return reply.send({
      ok: true,
      steamId: row?.steamId ?? null,
      twitchLogin: row?.twitchLogin ?? null,
      xboxGamertag: row?.xboxGamertag ?? null,
      livePresence: row?.livePresence ?? null,
      presenceCheckedAt: row?.presenceCheckedAt ?? null,
    });
  });

  // POST /profile/me/presence/refresh — force an immediate poll for this user
  app.post("/profile/me/presence/refresh", async (req, reply) => {
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

    // Priority: Twitch-live > Xbox game > Steam game/online > null
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

  // GET /presence/users?ids=a,b,c — batch live-presence for friend lists etc.
  app.get("/presence/users", async (req, reply) => {
    const ids = String((req.query as any)?.ids || "").split(",").map(s => s.trim()).filter(Boolean).slice(0, 60);
    if (ids.length === 0) return reply.send({ ok: true, presence: {} });
    const rows = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, livePresence: true },
    });
    const out: Record<string, any> = {};
    for (const r of rows) if (r.livePresence) out[r.id] = r.livePresence;
    return reply.send({ ok: true, presence: out });
  });

  // ── Account deletion (GDPR right to erasure) ─────────────────────────────
  // POST /profile/me/delete — user-initiated account wipe.
  // Requires body.confirm === "DELETE" (typed-word gate).
  // Scrubs PII, deletes auth rows + push subs, keeps content for FK integrity
  // (messages attributed to a generic "deleted_user" handle).
  app.post("/profile/me/delete", async (req, reply) => {
    const viewer = authFromHeader((req as any).headers?.authorization);
    if (!viewer) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const body: any = (req as any).body || {};
    if (String(body.confirm || "").trim() !== "DELETE") {
      return reply.code(400).send({ ok: false, error: "confirm_phrase_required" });
    }

    const userId = viewer.id;

    try {
      // Generate a stable anonymized handle so this user's id can still be FK'd
      // without leaking their old identity. Use first 8 chars of cuid for uniqueness.
      const anonSuffix = userId.slice(-8).toLowerCase();
      const anonName = `deleted_${anonSuffix}`;

      await prisma.$transaction(async (tx) => {
        // 1. Scrub PII on User row + mark deleted
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

        // 2. Delete auth credentials so they can't log back in
        await tx.localAuth.deleteMany({ where: { userId } });

        // 3. Kill push subscriptions
        await (tx as any).pushSubscription.deleteMany({ where: { userId } });

        // 4. Remove linked game accounts (revoke OAuth)
        await (tx as any).userGameAccount.deleteMany({ where: { userId } });
      });

      // Best-effort: terminate live sockets for this user
      try {
        for (const sock of wss.clients) {
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

  // ── GPS Location (opt-in) ─────────────────────────────────────────────────
  const H3_RES = 7; // ~5.16 km edge length

  // POST /me/location — opt-in and store approximate location
  app.post("/me/location", async (req, reply) => {
    const viewer = authFromHeader((req as any).headers?.authorization);
    if (!viewer) return reply.code(401).send({ error: "Unauthorized" });
    const body: any = (req as any).body || {};
    const lat = Number(body.latitude);
    const lng = Number(body.longitude);
    if (!isFinite(lat) || !isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return reply.code(400).send({ error: "Invalid coordinates" });
    }
    const h3Index = latLngToCell(lat, lng, H3_RES);
    await prisma.user.update({
      where: { id: viewer.id },
      data: { locationOptIn: true, latitude: lat, longitude: lng, locationH3: h3Index, locationUpdatedAt: new Date() },
    });
    return reply.send({ ok: true, h3: h3Index });
  });

  // DELETE /me/location — opt-out, wipe stored location
  app.delete("/me/location", async (req, reply) => {
    const viewer = authFromHeader((req as any).headers?.authorization);
    if (!viewer) return reply.code(401).send({ error: "Unauthorized" });
    await prisma.user.update({
      where: { id: viewer.id },
      data: { locationOptIn: false, latitude: null, longitude: null, locationH3: null, locationUpdatedAt: null },
    });
    return reply.send({ ok: true });
  });

  // GET /me/location — get own location opt-in status
  app.get("/me/location", async (req, reply) => {
    const viewer = authFromHeader((req as any).headers?.authorization);
    if (!viewer) return reply.code(401).send({ error: "Unauthorized" });
    const u = await prisma.user.findUnique({ where: { id: viewer.id }, select: { locationOptIn: true, latitude: true, longitude: true, locationH3: true, locationUpdatedAt: true } });
    return reply.send({ optIn: u?.locationOptIn || false, latitude: u?.latitude || null, longitude: u?.longitude || null, h3: u?.locationH3 || null, updatedAt: u?.locationUpdatedAt || null });
  });

  // GET /map/hexes — aggregated hex grid cells with user counts (public)
  // Optional ?game= filter to show only users in a specific lobby moduleType
  app.get("/map/hexes", async (req, reply) => {
    const q: any = (req as any).query || {};
    const gameFilter = typeof q.game === "string" ? q.game.trim().toUpperCase() : "";

    // If filtering by game, join through LobbyMember → Lobby
    let users: { locationH3: string | null }[];
    if (gameFilter) {
      const members = await prisma.lobbyMember.findMany({
        where: { lobby: { moduleType: gameFilter as any } },
        select: { userId: true },
      });
      const memberIds = [...new Set(members.map(m => m.userId))];
      if (!memberIds.length) return reply.send({ hexes: [], games: [] });
      users = await prisma.user.findMany({
        where: { locationOptIn: true, locationH3: { not: null }, id: { in: memberIds } },
        select: { locationH3: true },
      });
    } else {
      users = await prisma.user.findMany({
        where: { locationOptIn: true, locationH3: { not: null } },
        select: { locationH3: true },
      });
    }

    const hexCounts = new Map<string, number>();
    for (const u of users) {
      if (!u.locationH3) continue;
      hexCounts.set(u.locationH3, (hexCounts.get(u.locationH3) || 0) + 1);
    }
    const hexes = Array.from(hexCounts.entries()).map(([h3, count]) => {
      const boundary = cellToBoundary(h3);
      return { h3, count, boundary };
    });

    // Build game breakdown for filter UI
    const allLocUsers = await prisma.user.findMany({
      where: { locationOptIn: true, locationH3: { not: null } },
      select: { id: true },
    });
    const locUserIds = new Set(allLocUsers.map(u => u.id));
    const lobbies = await prisma.lobby.findMany({
      select: { id: true, name: true, moduleType: true, members: { select: { userId: true } } },
    });
    const gameMap = new Map<string, { name: string; count: number }>();
    for (const l of lobbies) {
      const locMembers = l.members.filter(m => locUserIds.has(m.userId));
      if (!locMembers.length) continue;
      const key = l.moduleType;
      const existing = gameMap.get(key);
      if (existing) { existing.count += locMembers.length; }
      else { gameMap.set(key, { name: l.moduleType, count: locMembers.length }); }
    }
    const games = Array.from(gameMap.entries())
      .map(([id, g]) => ({ id, name: g.name, count: g.count }))
      .sort((a, b) => b.count - a.count);

    return reply.send({ hexes, games });
  });

  // GET /map/nearby?lat=&lng= — users in your hex + neighbors (auth required)
  // Enriched with current lobby membership info
  app.get("/map/nearby", async (req, reply) => {
    const viewer = authFromHeader((req as any).headers?.authorization);
    if (!viewer) return reply.code(401).send({ error: "Unauthorized" });
    const q: any = (req as any).query || {};
    const lat = Number(q.lat);
    const lng = Number(q.lng);
    if (!isFinite(lat) || !isFinite(lng)) return reply.code(400).send({ error: "lat/lng required" });
    const center = latLngToCell(lat, lng, H3_RES);
    const ring = gridDisk(center, 1);
    const nearby = await prisma.user.findMany({
      where: { locationOptIn: true, locationH3: { in: ring } },
      select: { id: true, usernameKey: true, name: true, avatar: true, avatarColor: true, tier: true, locationH3: true },
    });
    const others = nearby.filter(u => u.id !== viewer.id).slice(0, 50);
    // Enrich with most recent lobby membership
    const userIds = others.map(u => u.id);
    const memberships = userIds.length ? await prisma.lobbyMember.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, lobbyId: true, lobby: { select: { name: true } }, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    }) : [];
    const lobbyMap = new Map<string, { lobbyId: string; lobbyName: string }>();
    for (const m of memberships) {
      if (!lobbyMap.has(m.userId)) lobbyMap.set(m.userId, { lobbyId: m.lobbyId, lobbyName: m.lobby.name });
    }
    const enriched = others.map(u => {
      const lm = lobbyMap.get(u.id);
      return { ...u, lobbyId: lm?.lobbyId || null, lobbyName: lm?.lobbyName || null };
    });
    return reply.send({ hex: center, nearbyCount: enriched.length, users: enriched });
  });

  // GET /map/lobbies — lobby pins with geographic center of their members
  app.get("/map/lobbies", async (_req, reply) => {
    // Get all users with location opted in
    const locUsers = await prisma.user.findMany({
      where: { locationOptIn: true, latitude: { not: null }, longitude: { not: null } },
      select: { id: true, latitude: true, longitude: true },
    });
    const locMap = new Map<string, { lat: number; lng: number }>();
    for (const u of locUsers) {
      if (u.latitude != null && u.longitude != null) locMap.set(u.id, { lat: u.latitude, lng: u.longitude });
    }

    const lobbies = await prisma.lobby.findMany({
      select: {
        id: true, name: true, logoUrl: true, accentColor: true, moduleType: true,
        members: { select: { userId: true } },
        _count: { select: { members: true } },
      },
    });

    const pins = lobbies.map(l => {
      const membersWithLoc = l.members.map(m => locMap.get(m.userId)).filter(Boolean) as { lat: number; lng: number }[];
      if (!membersWithLoc.length) return null;
      let sumLat = 0, sumLng = 0;
      for (const m of membersWithLoc) { sumLat += m.lat; sumLng += m.lng; }
      return {
        id: l.id, name: l.name, logoUrl: l.logoUrl, accentColor: l.accentColor,
        moduleType: l.moduleType, memberCount: l._count.members,
        lat: sumLat / membersWithLoc.length, lng: sumLng / membersWithLoc.length,
      };
    }).filter(Boolean);

    return reply.send({ lobbies: pins });
  });

  // ── Avatar upload (Indicted+ only) ────────────────────────────────────────
  const AVATAR_DIR = join(process.cwd(), "uploads", "avatars");
  if (!existsSync(AVATAR_DIR)) mkdirSync(AVATAR_DIR, { recursive: true });
  const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2MB
  const SITE_BASE = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";

  app.post("/profile/avatar/upload", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ error: "unauthorized" });

    // Tier gate — Indicted+ only
    const dbUser = await prisma.user.findUnique({ where: { id: u.id }, select: { tier: true } });
    const tier = String(dbUser?.tier ?? "INNOCENT").toUpperCase();
    if (tier === "INNOCENT") {
      return reply.code(403).send({ error: "tier_required", message: "Custom avatar uploads require Indicted tier or higher." });
    }

    const body: any = (req as any).body || {};
    const dataUrl = body.image;
    if (!dataUrl || typeof dataUrl !== "string") {
      return reply.code(400).send({ error: "missing_image" });
    }

    // Validate data URL format
    const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,(.+)$/);
    if (!match) {
      return reply.code(400).send({ error: "invalid_format", message: "Image must be PNG, JPEG, WebP, or GIF." });
    }

    const ext = match[1] === "jpeg" || match[1] === "jpg" ? "jpg" : match[1];
    const buffer = Buffer.from(match[2], "base64");

    if (buffer.length > AVATAR_MAX_BYTES) {
      return reply.code(400).send({ error: "too_large", message: "Image must be under 2MB." });
    }

    try {
      const filename = `${u.id}-${Date.now()}.${ext}`;
      const filepath = join(AVATAR_DIR, filename);
      writeFileSync(filepath, buffer);

      const avatarUrl = `${SITE_BASE}/avatars/${filename}`;

      // Update user record
      await prisma.user.update({
        where: { id: u.id },
        data: { avatar: avatarUrl },
      });

      // Award notoriety for setting avatar
      awardNotoriety(u.id, "AVATAR_SET").catch(() => {});

      // Update live WS presence
      for (const sock of wss.clients) {
        const s = sock as Sock;
        if (s.user?.id === u.id) {
          s.user.avatar = avatarUrl;
          if (s.roomId) {
            const room = rooms.get(s.roomId);
            if (room) {
              const entry = room.users.get(u.id);
              if (entry) (entry as any).avatar = avatarUrl;
              publishState(room);
            }
          }
        }
      }

      return reply.send({ ok: true, avatar: avatarUrl });
    } catch (e) {
      console.error("[avatar upload]", e);
      return reply.code(500).send({ error: "upload_failed" });
    }
  });

  // Serve uploaded avatars as static files
  app.get("/avatars/:filename", async (req, reply) => {
    const filename = String((req as any).params?.filename || "").replace(/[^a-zA-Z0-9._-]/g, "");
    if (!filename) return reply.code(400).send("bad request");
    const filepath = join(AVATAR_DIR, filename);
    if (!existsSync(filepath)) return reply.code(404).send("not found");

    const ext = filename.split(".").pop()?.toLowerCase();
    const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "gif" ? "image/gif" : "image/jpeg";

    const { readFileSync } = await import("fs");
    const data = readFileSync(filepath);
    reply.header("Content-Type", mime);
    reply.header("Cache-Control", "public, max-age=31536000, immutable");
    return reply.send(data);
  });

  // GET /notoriety/me — current user's notoriety score, rank, recent events, next milestone
  app.get("/notoriety/me", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ error: "unauthorized" });

    const dbUser = await prisma.user.findUnique({
      where: { id: u.id },
      select: { notoriety: true },
    });
    const score = dbUser?.notoriety ?? 0;
    const rank = getNotorietyRank(score);

    const recentEvents = await prisma.notorietyEvent.findMany({
      where: { userId: u.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { action: true, points: true, createdAt: true },
    });

    return reply.send({
      ok: true,
      score,
      rank: rank.title,
      rankMin: rank.min,
      nextRank: rank.next ? { title: rank.next.title, min: rank.next.min, pointsNeeded: rank.next.min - score } : null,
      recentEvents,
      ranks: NOTORIETY_RANKS,
    });
  });

  // GET /notoriety/leaderboard — top users by notoriety
  app.get("/notoriety/leaderboard", async (req, reply) => {
    const limit = Math.min(Number((req as any).query?.limit || 25), 50);
    const leaders = await prisma.user.findMany({
      orderBy: { notoriety: "desc" },
      take: limit,
      select: { id: true, name: true, notoriety: true, tier: true, avatar: true, avatarColor: true },
    });
    const ranked = leaders.map((u, i) => ({
      position: i + 1,
      id: u.id,
      name: u.name,
      score: u.notoriety,
      rank: getNotorietyRank(u.notoriety).title,
      tier: u.tier,
      avatar: u.avatar,
      avatarColor: u.avatarColor,
    }));
    return reply.send({ ok: true, leaders: ranked });
  });

  // ── Crews — extracted to routes/crews.ts ─────────────────────────────────
  await app.register(crewsRoutes, { authFromHeader, verifyToken, awardNotoriety, createNotification, rooms, fetchReactionsForTargets, getNotorietyRank } as any);


  // DELETE /staff/rooms/:roomId — STAFF+ can delete rooms
  // POST /staff/rooms/:roomId/rename — rename a room

  // POST /staff/rooms/:roomId/pin — pin/unpin a room (pinned rooms don't dissolve)

  // POST /staff/rooms/:roomId/event — toggle event room flag

  // POST /staff/rooms/:roomId/close — staff force-close a room

// ── Invites — extracted to routes/invites.ts ────────────────────────────────
  await app.register(invitesRoutes, { authFromHeader, awardNotoriety, getGlobalRole, canAssignRoles, WEB_URL } as any);


  // ── DM — extracted to routes/dm.ts ────────────────────────────────────────
  await app.register(dmRoutes, { authFromHeader, resolveUserId, fetchReactionsForTargets, dmDeliver, isUserOnline, sendPush } as any);
  await app.register(groupRoutes, { authFromHeader, resolveUserId, dmDeliver, isUserOnline, sendPush, resolveMentions, createNotification } as any);



  // ── Feed API ────────────────────────────────────────────────────────────────

  // GET /feed/hot — returns top 50 items sorted by heat
  app.get("/feed/hot", async (req, reply) => {
    const qs       = (req as any).query as any;
    const category = qs?.category && qs.category !== "all" ? String(qs.category) : undefined;
    const domain   = qs?.domain ? String(qs.domain) : undefined;
    const sort     = qs?.sort === "new" ? { postedAt: "desc" as const } : { heat: "desc" as const };
    const where: any = {};
    if (category) where.category = category;
    if (domain)   where.domain   = domain;
    const items    = await prisma.feedItem.findMany({
      where:   Object.keys(where).length ? where : undefined,
      orderBy: sort,
      take:    50,
    });
    return reply.send({ items, updatedAt: new Date().toISOString() });
  });

  // Run worker on startup then every 20 minutes
  runFeedWorker();
  setInterval(runFeedWorker, 20 * 60 * 1000);

  // ── Forum — extracted to routes/forum.ts ──────────────────────────────────
  await app.register(forumRoutes, { authFromHeader, getGlobalRole, canAccessStaff, getLobbyRole, resolveMentions, createNotification } as any);


  // ── News RSS ingestion worker ─────────────────────────────────────────────
  const NEWS_FEEDS = [
    // CBC (top + world work; others blocked from server)
    { url: "https://www.cbc.ca/webfeed/rss/rss-topstories",  category: "top",            source: "CBC News",    icon: "https://www.cbc.ca/favicon.ico" },
    { url: "https://www.cbc.ca/webfeed/rss/rss-world",       category: "world",           source: "CBC News",    icon: "https://www.cbc.ca/favicon.ico" },
    { url: "https://www.cbc.ca/webfeed/rss/rss-canada",      category: "canada",          source: "CBC News",    icon: "https://www.cbc.ca/favicon.ico" },
    { url: "https://www.cbc.ca/webfeed/rss/rss-technology",   category: "tech",            source: "CBC News",    icon: "https://www.cbc.ca/favicon.ico" },
    { url: "https://www.cbc.ca/webfeed/rss/rss-business",    category: "business",        source: "CBC News",    icon: "https://www.cbc.ca/favicon.ico" },
    { url: "https://www.cbc.ca/webfeed/rss/rss-sports",      category: "sports",          source: "CBC News",    icon: "https://www.cbc.ca/favicon.ico" },
    { url: "https://www.cbc.ca/webfeed/rss/rss-entertainment",category: "entertainment",  source: "CBC News",    icon: "https://www.cbc.ca/favicon.ico" },
    // BBC (reliable, always works)
    { url: "https://feeds.bbci.co.uk/news/world/rss.xml",    category: "world",           source: "BBC World",   icon: "https://www.bbc.co.uk/favicon.ico" },
    { url: "https://feeds.bbci.co.uk/news/technology/rss.xml",category: "tech",           source: "BBC Tech",    icon: "https://www.bbc.co.uk/favicon.ico" },
    { url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml", category: "science", source: "BBC Science", icon: "https://www.bbc.co.uk/favicon.ico" },
    { url: "https://feeds.bbci.co.uk/news/business/rss.xml", category: "business",        source: "BBC Business",icon: "https://www.bbc.co.uk/favicon.ico" },
    { url: "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml", category: "entertainment", source: "BBC Arts", icon: "https://www.bbc.co.uk/favicon.ico" },
    { url: "https://feeds.bbci.co.uk/sport/rss.xml",         category: "sports",          source: "BBC Sport",   icon: "https://www.bbc.co.uk/favicon.ico" },
    // BBC Top Stories + Canada-relevant (these include <media:thumbnail>)
    { url: "https://feeds.bbci.co.uk/news/rss.xml",              category: "top",            source: "BBC News",    icon: "https://www.bbc.co.uk/favicon.ico" },
    // CTV + Global (Canadian sources with images)
    { url: "https://www.ctvnews.ca/rss/ctvnews-ca-top-stories-public-rss-1.822009", category: "canada", source: "CTV News", icon: "https://www.ctvnews.ca/favicon.ico" },
    { url: "https://globalnews.ca/feed/",                         category: "canada",         source: "Global News", icon: "https://globalnews.ca/favicon.ico" },
    // Google News (no images but good for headlines)
    { url: "https://news.google.com/rss?hl=en-CA&gl=CA&ceid=CA:en", category: "top",        source: "Google News", icon: "https://news.google.com/favicon.ico" },
    { url: "https://news.google.com/rss/search?q=canada+when:1d&hl=en-CA&gl=CA&ceid=CA:en", category: "canada", source: "Google News", icon: "https://news.google.com/favicon.ico" },
    // Gaming
    { url: "https://www.eurogamer.net/?format=rss",                                          category: "gaming",  source: "Eurogamer",   icon: "https://www.eurogamer.net/favicon.ico" },
    { url: "https://www.polygon.com/rss/index.xml",                                          category: "gaming",  source: "Polygon",     icon: "https://www.polygon.com/favicon.ico" },
    { url: "https://kotaku.com/rss",                                                         category: "gaming",  source: "Kotaku",      icon: "https://kotaku.com/favicon.ico" },
    { url: "https://www.gamespot.com/feeds/news/",                                           category: "gaming",  source: "GameSpot",    icon: "https://www.gamespot.com/favicon.ico" },
    { url: "https://www.ign.com/rss/articles?tags=games",                                    category: "gaming",  source: "IGN",         icon: "https://www.ign.com/favicon.ico" },
    // Finance
    { url: "https://www.cnbc.com/id/100003114/device/rss/rss.html",                          category: "finance", source: "CNBC",        icon: "https://www.cnbc.com/favicon.ico" },
    { url: "https://www.marketwatch.com/rss/topstories",                                     category: "finance", source: "MarketWatch", icon: "https://www.marketwatch.com/favicon.ico" },
    { url: "https://feeds.bloomberg.com/markets/news.rss",                                   category: "finance", source: "Bloomberg",   icon: "https://www.bloomberg.com/favicon.ico" },
    { url: "https://feeds.reuters.com/reuters/businessNews",                                 category: "finance", source: "Reuters",     icon: "https://www.reuters.com/favicon.ico" },
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

      // Purge articles older than 72 hours
      await prisma.newsArticle.deleteMany({
        where: { publishedAt: { lt: new Date(Date.now() - 72 * 3600 * 1000) } },
      });

      newsCache.clear();
      console.log(`[news] worker done: ${upserted} upserted from ${deduped.length} articles`);
    } catch (e) { console.error("[news] worker error:", e); }
  }

  // ── News routes — extracted to routes/news.ts (worker stays here) ──────────
  await app.register(newsRoutes);


  // ── Persistent Banner ──────────────────────────────────────────────────────
  let siteBanner: { message: string; level: string; from: string; ts: number } | null = {
    message: "Early access build — things may break. Report bugs in the Forum. New features ship daily. Type @operator in any chat for help.",
    level: "info",
    from: "Weered",
    ts: 1,
  };

  app.get("/banner", async (_req, reply) => {
    return reply.send({ ok: true, banner: siteBanner });
  });

  // /staff/banner stays here with /banner — both mutate/read siteBanner.
  app.post("/staff/banner", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false });
    const { message, level, clear } = (req as any).body || {};
    if (clear) { siteBanner = null; return reply.send({ ok: true, banner: null }); }
    if (!message) return reply.code(400).send({ ok: false, error: "message required" });
    siteBanner = { message, level: level || "info", from: u.name, ts: 1 };
    return reply.send({ ok: true, banner: siteBanner });
  });

  // ── Desktop app updater (Tauri) ─────────────────────────────────────────────
  // Tauri's updater plugin polls this endpoint on launch. We pull the latest
  // signed release from GitHub Releases and translate it into the manifest
  // shape Tauri expects. Returns 204 (no update) if there's no release,
  // the user is already current, or GitHub is unreachable — never errors
  // back to the client (we'd rather miss an update than crash the desktop app).

  type DesktopReleaseManifest = {
    version: string;
    notes: string;
    pub_date: string;
    platforms: Record<string, { signature: string; url: string }>;
  };

  // Map Tauri's target strings to release-asset filename patterns.
  // GitHub Actions uploads artifacts named like Weered_0.2.0_x64-setup.exe etc.
  const TAURI_TARGET_MATCHERS: Record<string, RegExp> = {
    "windows-x86_64":  /Weered.*x64-setup\.exe$/i,
    "darwin-x86_64":   /Weered.*x64\.app\.tar\.gz$/i,
    "darwin-aarch64":  /Weered.*aarch64\.app\.tar\.gz$/i,
    "linux-x86_64":    /weered.*amd64\.AppImage$/i,
  };

  type GhAsset = { name: string; browser_download_url: string };
  type GhRelease = {
    tag_name: string;
    name: string;
    body: string;
    published_at: string;
    assets: GhAsset[];
    prerelease: boolean;
    draft: boolean;
  };

  // Cache the latest manifest for 5 minutes — Tauri clients poll on each launch
  // and we don't want to hammer GitHub. Also keeps the endpoint snappy.
  let desktopReleaseCache: { manifest: DesktopReleaseManifest | null; expiresAt: number } | null = null;
  const DESKTOP_RELEASE_TTL = 5 * 60 * 1000;

  // GitHub repo to pull releases from. Override via env if the repo moves.
  const DESKTOP_RELEASES_REPO = process.env.DESKTOP_RELEASES_REPO || "Weeredjs/Weered";

  async function fetchLatestDesktopRelease(): Promise<DesktopReleaseManifest | null> {
    if (desktopReleaseCache && desktopReleaseCache.expiresAt > Date.now()) {
      return desktopReleaseCache.manifest;
    }

    let manifest: DesktopReleaseManifest | null = null;
    try {
      const url = `https://api.github.com/repos/${DESKTOP_RELEASES_REPO}/releases?per_page=10`;
      const headers: Record<string, string> = {
        "User-Agent": "Weered-API/1.0",
        Accept: "application/vnd.github+json",
      };
      if (process.env.GITHUB_TOKEN) headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`GitHub releases ${res.status}`);
      const releases = (await res.json()) as GhRelease[];

      // Find the latest non-draft, non-prerelease desktop release.
      const latest = releases.find((r) => !r.draft && !r.prerelease && /^desktop-v/.test(r.tag_name));
      if (!latest) {
        manifest = null;
      } else {
        const version = latest.tag_name.replace(/^desktop-v/, "");

        // Build the platforms map. .sig file is optional — without it the
        // entry still serves the landing page download URL but Tauri's
        // auto-updater will skip the platform (it requires signatures).
        const platforms: DesktopReleaseManifest["platforms"] = {};
        for (const [target, matcher] of Object.entries(TAURI_TARGET_MATCHERS)) {
          const asset = latest.assets.find((a) => matcher.test(a.name));
          if (!asset) continue;
          const sigAsset = latest.assets.find((a) => a.name === `${asset.name}.sig`);
          let signature = "";
          if (sigAsset) {
            try {
              const sigRes = await fetch(sigAsset.browser_download_url, { headers: { "User-Agent": "Weered-API/1.0" } });
              if (sigRes.ok) signature = (await sigRes.text()).trim();
            } catch {}
          }
          platforms[target] = { signature, url: asset.browser_download_url };
        }

        if (Object.keys(platforms).length > 0) {
          manifest = {
            version,
            notes: latest.body || `Weered Desktop ${version}`,
            pub_date: latest.published_at,
            platforms,
          };
        }
      }
    } catch (e) {
      console.warn("[desktop-updater] fetchLatestDesktopRelease failed:", e);
      // On error, keep whatever we had cached. If nothing cached, return null.
      if (desktopReleaseCache?.manifest) return desktopReleaseCache.manifest;
    }

    desktopReleaseCache = { manifest, expiresAt: Date.now() + DESKTOP_RELEASE_TTL };
    return manifest;
  }

  app.get<{ Params: { target: string; version: string } }>(
    "/desktop/updates/:target/:version",
    async (req, reply) => {
      const manifest = await fetchLatestDesktopRelease();
      if (!manifest) return reply.code(204).send();
      const { version, target } = req.params;
      if (manifest.version === version) return reply.code(204).send();
      const plat = manifest.platforms[target];
      // Tauri auto-updater requires a signature; if we don't have one,
      // pretend there's no update for this platform. Landing page download
      // links still work via /desktop/latest.
      if (!plat || !plat.signature) return reply.code(204).send();
      return reply.send(manifest);
    },
  );

  // Convenience endpoint for the /desktop landing page — returns the latest
  // release info (or null) so the page can render real download buttons.
  app.get("/desktop/latest", async (_req, reply) => {
    const manifest = await fetchLatestDesktopRelease();
    if (!manifest) return reply.send({ ok: true, release: null });
    return reply.send({
      ok: true,
      release: {
        version: manifest.version,
        pub_date: manifest.pub_date,
        notes: manifest.notes,
        downloads: Object.fromEntries(
          Object.entries(manifest.platforms).map(([k, v]) => [k, v.url]),
        ),
      },
    });
  });


  // ── YouTube Search — extracted to routes/youtube.ts ────────────────────────
  await app.register(youtubeRoutes);

  // ── AI Endpoints — extracted to routes/ai.ts ───────────────────────────────
  await app.register(aiRoutes, { authFromHeader, isAIAvailable, getAI, rooms } as any);


  // Start news worker on startup then every 15 minutes
  runNewsWorker();
  setInterval(runNewsWorker, 15 * 60 * 1000);

  await seedLobbies();

  app.setErrorHandler((err, req, reply) => {
    if (process.env.SENTRY_DSN_API) {
      Sentry.captureException(err, {
        tags: { route: req.routeOptions?.url || req.url },
      });
    }
    reply.status(err.statusCode || 500).send({ error: err.message || "Internal error" });
  });

  // ── Mods — extracted to routes/mods.ts ─────────────────────────────────────
  await app.register(modsRoutes, { verifyToken } as any);


  // app.listen() moved to the end of main() — routes after this point would
  // throw FST_ERR_INSTANCE_ALREADY_LISTENING if we awaited it here.

  // ── WebSocket server ──────────────────────────────────────────────────────────

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
          // Block globally banned users from connecting
          if (await isGloballyBanned(ws.user.id)) {
            send(ws, { type: "auth:fail", reason: "Your account has been suspended." });
            try { ws.close(4003, "banned"); } catch {}
            return;
          }
          send(ws, { type: "auth:ok", user: { id: ws.user.id, name: ws.user.name, globalRole: ws.user.globalRole, tier: ws.user.tier || "INNOCENT", avatarColor: ws.user.avatarColor, avatar: ws.user.avatar, panelBgColor: (ws.user as any).panelBgColor, panelAccentColor: (ws.user as any).panelAccentColor, pillBgColor: (ws.user as any).pillBgColor, pillAccentColor: (ws.user as any).pillAccentColor } });
          // Award daily active notoriety (cooldown-gated, fires at most once per 24h)
          awardNotoriety(ws.user.id, "DAILY_ACTIVE").catch(() => {});
          // Crew presence: notify crew mates this user came online
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


        // ── rooms:list — return lobby directory from DB ───────────────────
        if (msg.type === "rooms:list" || msg.type === "lobby:rooms" || msg.type === "room:list") {
          const [lobbyList, roomList] = await Promise.all([
            (prisma as any).lobby.findMany({
            where: { pinned: true },
            select: { id: true, name: true, description: true, verified: true, pinned: true, moduleType: true },
            }),
            prisma.room.findMany({
              orderBy: { updatedAt: "desc" },
              select: {
                id: true, name: true, locked: true, lobbyId: true,
                iconUrl: true, bannerUrl: true, accentColor: true, pinned: true, isEvent: true,
                _count: { select: { members: true } },
              },
              take: 100,
            }),
          ]);
            const lobbyIds = new Set(lobbyList.map((l: any) => l.id));
            const lobbyOut = lobbyList.map((l: any) => ({
            id: l.id, roomId: l.id, name: l.name, description: l.description,
            verified: l.verified, pinned: true, moduleType: l.moduleType,
            onlineCount: rooms.get(l.id)?.users.size ?? 0, locked: false,
          }));
          const roomOut = roomList
            .filter(r => !r.id.includes("%") && !lobbyIds.has(r.id))
            .map((r: any) => ({
              id: r.id, roomId: r.id, name: r.name || r.id,
              onlineCount: rooms.get(r.id)?.users.size ?? 0,
              locked: Boolean(r.locked), pinned: Boolean(r.pinned), isEvent: Boolean(r.isEvent),
              iconUrl: r.iconUrl ?? null, bannerUrl: r.bannerUrl ?? null, accentColor: r.accentColor ?? null,
              lobbyId: r.lobbyId ?? null,
            }));
          send(ws, { type: "rooms", rooms: [...lobbyOut, ...roomOut] });
          return;
        }

        if (msg.type === "presence:join") {
          const roomId = normalizeRoomId(String(msg.roomId || ""));
          if (!roomId) return;
          const room = await ensureRoomLoaded(roomId);
          if (room.banned.has(ws.user.id)) { send(ws, { type: "room:banned", roomId }); return; }
          const uid = ws.user.id;
          const isLobby = String(roomId || "").startsWith("lobby:");

          // Password-protected rooms: check password before allowing entry
          if (room.passwordHash && !isLobby && !isModOrOwner(room, uid, ws.user?.globalRole)) {
            const suppliedPassword = typeof msg.password === "string" ? msg.password : "";
            if (!suppliedPassword) {
              send(ws, { type: "room:password:required", roomId });
              return;
            }
            const passwordOk = await bcrypt.compare(suppliedPassword, room.passwordHash);
            if (!passwordOk) {
              send(ws, { type: "room:password:wrong", roomId });
              return;
            }
            // Password correct — fall through to normal join
          }

          if (isLobby) room.locked = false;
          if (room.locked && !isLobby && !isModOrOwner(room, uid, ws.user?.globalRole)) {
            if (!room.knocks.some((k) => k.userId === uid)) {
              room.knocks.push({ userId: uid, name: ws.user.name, ts: Date.now() });
              if (room.knocks.length > 200) room.knocks.splice(0, room.knocks.length - 200);
            }
            let p = room.pending.get(uid);
            if (!p) { p = new Set<Sock>(); room.pending.set(uid, p); }
            p.add(ws);
            ws.pendingRoomId = roomId;
            send(ws, { type: "room:knock:queued", roomId });
            for (const s of room.sockets) {
              const sid = s.user?.id;
              if (!sid || !isModOrOwner(room, sid)) continue;
              send(s, { type: "room:knock", roomId, user: { id: uid, name: ws.user.name } });
            }
            publishState(room);
            return;
          }
          await doJoin(ws, roomId);
          return;
        }

        // ── Pin / unpin messages ───────────────────────────────────────
        // Mods + owners can pin up to 10 messages in a room. State is
        // held on room.pinned (Set<msgId>) in memory and broadcast as
        // chat:pins whenever it changes. Clients render a strip at the
        // top of chat listing pinned messages.
        if (msg.type === "chat:pin" || msg.type === "chat:unpin") {
          if (!ws.user?.id || !ws.joinedRoomId) return;
          const room = rooms.get(ws.joinedRoomId);
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

        // ── Chat typing indicator ──────────────────────────────────────
        // Clients send chat:typing while the composer has focus + input.
        // Broadcast a minimal payload (id, name) to the room. Clients
        // self-expire stale entries after ~5s, so no server-side state.
        if (msg.type === "chat:typing") {
          if (!ws.user?.id || !ws.joinedRoomId) return;
          const room = rooms.get(ws.joinedRoomId);
          if (!room || !room.users.has(ws.user.id)) return;
          broadcast(room, {
            type: "chat:typing",
            roomId: room.roomId,
            user: { id: ws.user.id, name: ws.user.name },
          });
          return;
        }

        if (msg.type === "presence:idle") {
          if (!ws.user) return;
          const away = Boolean(msg.away);
          (ws.user as any).isAway = away;
          // Update and rebroadcast in every room this user is currently in
          // so the red dot flips instantly for everyone else in the same room.
          for (const [, room] of rooms) {
            const entry = room.users.get(ws.user.id);
            if (entry) {
              (entry as any).isAway = away;
              broadcast(room, { type: "presence:join", roomId: room.roomId, user: entry });
            }
          }
          return;
        }

        // ── Room launcher (MPlayer-style) ──────────────────────────────────
        // All launch:* messages target the user's currently-joined room. Only
        // the room owner can set/clear a target and fire the countdown. Any
        // member can pick player/observer and ready up.
        if (msg.type === "launch:set" || msg.type === "launch:clear"
            || msg.type === "launch:slot" || msg.type === "launch:ready"
            || msg.type === "launch:fire" || msg.type === "launch:abort") {
          if (!ws.user || !ws.joinedRoomId) return;
          const room = rooms.get(ws.joinedRoomId);
          if (!room) return;
          if (!room.users.has(ws.user.id)) return;
          const launch = ensureLaunch(room);
          const userIsOwner = isOwner(room, ws.user.id) || isElevatedGlobal(ws.user.globalRole);

          if (msg.type === "launch:set") {
            if (!userIsOwner) return;
            const appid = Number(msg.appid);
            const connect = String(msg.connect || "").trim().slice(0, 200);
            const display = String(msg.display || connect || "").trim().slice(0, 80);
            const note    = msg.note ? String(msg.note).trim().slice(0, 300) : undefined;
            if (!appid || !connect) return;
            launch.target = { appid, connect, display, note, setBy: ws.user.id, setAt: Date.now() };
            // Reset ready set + firedAt on a new target; preserve slot picks
            launch.ready.clear();
            launch.firedAt = null;
            launch.firedBy = null;
            broadcastLaunch(room);
            return;
          }

          if (msg.type === "launch:clear") {
            if (!userIsOwner) return;
            launch.target = null;
            launch.ready.clear();
            launch.slots.clear();
            launch.firedAt = null;
            launch.firedBy = null;
            broadcastLaunch(room);
            return;
          }

          if (msg.type === "launch:slot") {
            const slot: LaunchSlot = msg.slot === "player" ? "player" : "observer";
            launch.slots.set(ws.user.id, slot);
            // Dropping out of player slot also drops ready
            if (slot === "observer") launch.ready.delete(ws.user.id);
            broadcastLaunch(room);
            return;
          }

          if (msg.type === "launch:ready") {
            // Only player-slotted users can ready up
            if (launch.slots.get(ws.user.id) !== "player") return;
            const ready = Boolean(msg.ready);
            if (ready) launch.ready.add(ws.user.id);
            else launch.ready.delete(ws.user.id);
            broadcastLaunch(room);
            return;
          }

          if (msg.type === "launch:fire") {
            if (!userIsOwner || !launch.target) return;
            // Need at least one player-slotted user to fire
            const anyPlayer = Array.from(launch.slots.values()).some(s => s === "player");
            if (!anyPlayer) return;
            launch.firedAt = Date.now();
            launch.firedBy = ws.user.id;
            broadcastLaunch(room);
            // Auto-reset 60s after fire so a new match can be queued
            setTimeout(() => {
              const r = rooms.get(room.roomId);
              if (!r?.launch) return;
              if (r.launch.firedAt === launch.firedAt) {
                r.launch.firedAt = null;
                r.launch.firedBy = null;
                r.launch.ready.clear();
                broadcastLaunch(r);
              }
            }, 60_000);
            return;
          }

          if (msg.type === "launch:abort") {
            if (!userIsOwner) return;
            launch.firedAt = null;
            launch.firedBy = null;
            broadcastLaunch(room);
            return;
          }
          return;
        }

        if (msg.type === "presence:leave") {
          if (ws.pendingRoomId) {
            const rid = ws.pendingRoomId;
            const r = rooms.get(rid);
            if (r) {
              const set = r.pending.get(ws.user.id);
              if (set) set.delete(ws);
              if (set && set.size === 0) r.pending.delete(ws.user.id);
              ws.pendingRoomId = undefined;
              publishState(r);
            }
            return;
          }
          // Only leave if the roomId in the message matches where this socket currently is.
          // Stale presence:leave messages (sent by client after navigating away) must not
          // kick the socket out of the room it has already joined.
          const leaveRid = normalizeRoomId(String(msg.roomId || ""));
          if (leaveRid && ws.roomId && leaveRid !== ws.roomId) return;
          leaveRoom(ws);
          return;
        }
          // ── module:set — user sets the active module for the room
        if (msg.type === "module:set") {
          const roomId = normalizeRoomId(String(msg.roomId || ws.roomId || ""));
          if (!roomId) return;
          const room = rooms.get(roomId);
          if (!room) return;
          if (!room.users.has(ws.user.id)) return;
          const mode = String(msg.mode || "").trim() || null;
          if (!mode) {
            room.activeModule = null;
            room.ytState = null;
            broadcast(room, { type: "module:state", roomId, activeModule: null });
            return;
          }
          // Reject if owner has disabled this module for the room.
          // Owner + mods + global staff bypass — they need to be able to
          // test the room and toggle modules even when disabled.
          const disabled: string[] = Array.isArray((room as any).disabledModules) ? (room as any).disabledModules : [];
          if (disabled.includes(mode) && !isModOrOwner(room, ws.user.id, ws.user?.globalRole)) {
            try { send(ws, { type: "module:rejected", roomId, mode, reason: "module_disabled" }); } catch {}
            return;
          }
          // Clear YouTube state when switching away from YouTube
          if (mode !== "youtube") room.ytState = null;
          const moduleState: ModuleState = {
            mode,
            url: typeof msg.url === "string" ? msg.url.slice(0, 2000) : undefined,
            channel: typeof msg.channel === "string" ? msg.channel.slice(0, 100).toLowerCase() : undefined,
            setBy: ws.user.id,
            setAt: Date.now(),
          };
          room.activeModule = moduleState;
          broadcast(room, { type: "module:state", roomId, activeModule: moduleState });
          return;
        }

        if (msg.type === "module:clear") {
          const roomId = normalizeRoomId(String(msg.roomId || ws.roomId || ""));
          if (!roomId) return;
          const room = rooms.get(roomId);
          if (!room) return;
          if (!room.users.has(ws.user.id)) return;
          room.activeModule = null;
          room.ytState = null;
          broadcast(room, { type: "module:state", roomId, activeModule: null });
          return;
        }

        // ── Voice queue / hand-raise WS protocol ───────────────────────
        // voice:mode    → owner sets OPEN | QUEUED | LISTEN_ONLY (persisted)
        // voice:raise   → user adds self to queue (QUEUED mode only)
        // voice:lower   → user removes self from queue
        // voice:approve → mod adds a queued user to speakers (auto-removes from queue)
        // voice:revoke  → mod removes user from speakers
        // After every change we broadcast voice:state. Granted/revoked users
        // also receive a voice:permission ping so their client can refresh
        // its LiveKit token + reconnect to pick up canPublish.
        function broadcastVoiceState(room: RoomState) {
          broadcast(room, {
            type: "voice:state",
            roomId: room.roomId,
            mode: room.voiceMode || "OPEN",
            queue: Array.from(room.voiceQueue || []),
            speakers: Array.from(room.voiceSpeakers || []),
          });
        }
        function pushVoicePermission(room: RoomState, userId: string) {
          for (const sock of room.sockets) {
            if ((sock as any).user?.id === userId) {
              try { send(sock as Sock, { type: "voice:permission", roomId: room.roomId, userId }); } catch {}
            }
          }
        }

        if (msg.type === "voice:mode") {
          const roomId = normalizeRoomId(String(msg.roomId || ws.roomId || ""));
          if (!roomId) return;
          const room = rooms.get(roomId);
          if (!room) return;
          if (!isModOrOwner(room, ws.user.id, ws.user?.globalRole)) return;
          const next = String(msg.mode || "").toUpperCase();
          if (!["OPEN", "QUEUED", "LISTEN_ONLY"].includes(next)) return;
          room.voiceMode = next as any;
          // Switching to LISTEN_ONLY clears queue + speakers (no-one speaks
          // except mods/owner). Switching to OPEN also clears them — the
          // gating no longer applies.
          if (next === "LISTEN_ONLY" || next === "OPEN") {
            const dropped = new Set([...(room.voiceSpeakers || []), ...(room.voiceQueue || [])]);
            room.voiceQueue = new Set();
            room.voiceSpeakers = new Set();
            for (const uid of dropped) pushVoicePermission(room, uid);
          }
          // Persist mode to DB.
          (prisma as any).room.update({ where: { id: roomId }, data: { voiceMode: next } }).catch(() => {});
          broadcastVoiceState(room);
          return;
        }

        if (msg.type === "voice:raise") {
          const roomId = normalizeRoomId(String(msg.roomId || ws.roomId || ""));
          if (!roomId) return;
          const room = rooms.get(roomId);
          if (!room) return;
          if (!room.users.has(ws.user.id)) return;
          if ((room.voiceMode || "OPEN") !== "QUEUED") return;
          if (!room.voiceQueue) room.voiceQueue = new Set();
          if (room.voiceSpeakers?.has(ws.user.id)) return; // already a speaker
          room.voiceQueue.add(ws.user.id);
          broadcastVoiceState(room);
          return;
        }

        if (msg.type === "voice:lower") {
          const roomId = normalizeRoomId(String(msg.roomId || ws.roomId || ""));
          if (!roomId) return;
          const room = rooms.get(roomId);
          if (!room) return;
          if (!room.voiceQueue?.has(ws.user.id)) return;
          room.voiceQueue.delete(ws.user.id);
          broadcastVoiceState(room);
          return;
        }

        if (msg.type === "voice:approve") {
          const roomId = normalizeRoomId(String(msg.roomId || ws.roomId || ""));
          if (!roomId) return;
          const room = rooms.get(roomId);
          if (!room) return;
          if (!isModOrOwner(room, ws.user.id, ws.user?.globalRole)) return;
          const target = String(msg.userId || "").trim();
          if (!target) return;
          if (!room.voiceSpeakers) room.voiceSpeakers = new Set();
          room.voiceQueue?.delete(target);
          room.voiceSpeakers.add(target);
          broadcastVoiceState(room);
          pushVoicePermission(room, target);
          return;
        }

        if (msg.type === "voice:revoke") {
          const roomId = normalizeRoomId(String(msg.roomId || ws.roomId || ""));
          if (!roomId) return;
          const room = rooms.get(roomId);
          if (!room) return;
          if (!isModOrOwner(room, ws.user.id, ws.user?.globalRole)) return;
          const target = String(msg.userId || "").trim();
          if (!target) return;
          const removed = room.voiceSpeakers?.delete(target) || false;
          room.voiceQueue?.delete(target);
          if (removed) pushVoicePermission(room, target);
          broadcastVoiceState(room);
          return;
        }
                // ── room:close — owner/mod force-closes the room ─────────────────
        if (msg.type === "room:close") {
          const roomId = normalizeRoomId(String(msg.roomId || ws.roomId || ""));
          if (!roomId) return;
          const room = rooms.get(roomId);
          if (!room) return;
          // Only owner, mods, or staff can close
          if (!isModOrOwner(room, ws.user.id, ws.user?.globalRole)) return;

          // Don't delete pinned rooms — just kick everyone and clear state
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

          // Kick everyone
          for (const s of room.sockets) {
            send(s, { type: "room:closed", roomId, by: ws.user.name });
            try { s.close(4004, "room:closed"); } catch {}
          }

          // Clean up in-memory state
          room.users.clear();
          room.sockets.clear();
          room.msgs = [];
          room.activeModule = null;

          // Delete from DB
          try {
            await prisma.roomMessage.deleteMany({ where: { roomId } }).catch(() => {});
            await prisma.roomMember.deleteMany({ where: { roomId } }).catch(() => {});
            await prisma.room.delete({ where: { id: roomId } }).catch(() => {});
          } catch {}

          // Remove from in-memory map
          rooms.delete(roomId);

          await globalAudit(ws.user.id, ws.user.name, "room_close", roomId);
          return;
        }
        if (msg.type === "chat:send") {
          const roomId = normalizeRoomId(String(msg.roomId || ""));
          const body = String(msg.body || "").trim();
          if (!roomId || !body) return;
          const room = await ensureRoomLoaded(roomId);
          if (!room.users.has(ws.user.id)) return;
          if (room.banned.has(ws.user.id)) return;
          if (room.muted.has(ws.user.id)) return;
          // URL spam check
          const urlCheck = checkUrlSpam(body);
          if (!urlCheck.ok) { send(ws, { type: "chat:rejected", roomId, reason: urlCheck.reason }); return; }
          // Rate limit
          const rate = checkChatRateLimit(ws.user.id);
          if (!rate.ok) { send(ws, { type: "chat:rejected", roomId, reason: rate.reason, retryInMs: rate.retryInMs }); return; }
          // AutoMod-light: lobby-owner-configurable filters. Cached on the
          // room object; refreshed lazily after 60s. Owner edits flush the
          // cache via /lobbies/:id/admin/moderation handler below.
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
            // 1. New-account chat cooldown
            if (policy.newAccountChatHours > 0) {
              try {
                const u = await prisma.user.findUnique({ where: { id: ws.user.id }, select: { createdAt: true } });
                if (u && (Date.now() - u.createdAt.getTime()) < policy.newAccountChatHours * 3600 * 1000) {
                  send(ws, { type: "chat:rejected", roomId, reason: "account_too_new", message: `New accounts must wait ${policy.newAccountChatHours}h before chatting in this lobby.` });
                  return;
                }
              } catch {}
            }
            // 2. Blocked words (case-insensitive substring)
            if (policy.blockedWords.length > 0) {
              const lower = body.toLowerCase();
              const hit = policy.blockedWords.find(w => w && lower.includes(String(w).toLowerCase()));
              if (hit) {
                send(ws, { type: "chat:rejected", roomId, reason: "blocked_word" });
                return;
              }
            }
            // 3. Blocked domains (substring match against any URL)
            if (policy.blockedDomains.length > 0) {
              const urls = body.match(/https?:\/\/[^\s)]+/gi) || [];
              const bad = urls.find(u => policy!.blockedDomains.some(d => d && u.toLowerCase().includes(String(d).toLowerCase())));
              if (bad) {
                send(ws, { type: "chat:rejected", roomId, reason: "blocked_domain" });
                return;
              }
            }
          }
          // Optional reply-to — snapshot parent from in-memory room.msgs
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
          const u = room.users.get(ws.user.id)!;
          const m: ChatMsg = { id: randomUUID(), user: { id: u.id, name: u.name, role: roleOf(room, u.id), avatarColor: (u as any).avatarColor, avatar: (u as any).avatar }, body, ts: Date.now(), replyTo };
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
          // @mention notifications — resolves against the User table so
          // offline / out-of-room users still get pinged
          (async () => {
            try {
              const mentioned = await resolveMentions(body, ws.user.id);
              const roomPath = room.lobbyId ? `/lobby/${room.lobbyId}` : `/room/${room.roomId}`;
              for (const u of mentioned) {
                createNotification({
                  userId: u.id,
                  type: "MENTION",
                  title: `${ws.user.name} mentioned you in ${room.name || "a lobby"}`,
                  body: body.slice(0, 120),
                  actorId: ws.user.id,
                  actorName: ws.user.name,
                  actionUrl: roomPath,
                }).catch(() => {});
              }
            } catch {}
          })();
          // AI Operator bot detection
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
                      system: `You are "The Operator" — the AI behind Weered, a lobby-based social gaming platform with a GTA street aesthetic. You're street-smart, slightly sarcastic, helpful but with attitude. Keep responses SHORT (1-3 sentences max). You know about: lobbies (gaming communities), Paper (virtual currency), notoriety (XP), FakeOut (paper trading), poker (Texas Hold'em with Paper stakes), crews, challenges, and game integrations (Destiny 2, League of Legends, Fortnite, Marathon). Never break character. Never be mean, just witty. If someone asks something you don't know, deflect with style.`,
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
          if (target.user.id !== ws.user.id) return; // only sender can edit
          if (target.body === newBody) return;
          // 15 min edit window
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

          // Spam guard — max 20 distinct emojis across all users per message
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
              // Rebuild aggregation for this message
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
            // Root lobby is in-memory only; toggle on ChatMsg.reactions directly
            target.reactions = target.reactions || [];
            const existing = target.reactions.find(r => r.emoji === emoji);
            if (existing) {
              if (existing.users.includes(ws.user.id)) {
                existing.users = existing.users.filter(u => u !== ws.user.id);
                existing.count = Math.max(0, existing.count - 1);
                if (existing.count === 0) target.reactions = target.reactions.filter(r => r.emoji !== emoji);
              } else {
                existing.users.push(ws.user.id);
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

        // Crew and DM messages don't carry a roomId — let them fall through to
        // their dedicated handlers below without forcing a room context.
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
          // Allow any user to request presence state; admin state only goes to mods
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

        // ── YouTube / media sync ──────────────────────────────────────────────
        // Relay any youtube: message to every OTHER socket in the same room.
        // The client sends: { type: "youtube:load"|"youtube:sync"|"youtube:play"|"youtube:pause"|"youtube:stop", roomId, url?, ts?, playing? }
        if (msg.type === "youtube:load" || msg.type === "youtube:sync" ||
            msg.type === "youtube:play" || msg.type === "youtube:pause" || msg.type === "youtube:stop") {
          if (!room.users.has(ws.user.id)) return;
          // Store YouTube state so late joiners can catch up
          if (msg.type === "youtube:load" && msg.videoId) {
            room.ytState = { videoId: String(msg.videoId), playing: false, position: 0, updatedAt: Date.now() };
            // Also store videoId in activeModule for completeness
            if (room.activeModule && room.activeModule.mode === "youtube") {
              room.activeModule.url = String(msg.videoId);
            }
          } else if (msg.type === "youtube:play") {
            if (room.ytState) { room.ytState.playing = true; room.ytState.position = Number(msg.position ?? 0); room.ytState.updatedAt = Date.now(); }
          } else if (msg.type === "youtube:pause") {
            if (room.ytState) { room.ytState.playing = false; room.ytState.position = Number(msg.position ?? 0); room.ytState.updatedAt = Date.now(); }
          } else if (msg.type === "youtube:stop") {
            room.ytState = null;
          }
          for (const s of room.sockets) {
            if (s === ws) continue;
            send(s, { ...msg, roomId, _from: ws.user.id });
          }
          return;
        }

        // ── D&D Module — broadcast initiative + dice to room ───────────────────
        if (msg.type === "dnd:initiative" || msg.type === "dnd:roll") {
          if (!room.users.has(ws.user.id)) return;
          for (const s of room.sockets) {
            if (s === ws) continue;
            send(s, { ...msg, roomId, _from: ws.user.id });
          }
          return;
        }

        // ── Poker Engine — WebSocket Handlers ─────────────────────────────────

        if (msg.type === "poker:join") {
          const tableId = String(msg.tableId || "").trim();
          const buyin = Number(msg.buyin || 0);
          if (!ws.user || !tableId || !buyin) return;

          const table = getOrCreatePokerTable(tableId);

          // Validate buyin range
          if (buyin < table.minBuyin || buyin > table.maxBuyin) {
            send(ws, { type: "poker:error", error: `Buy-in must be between ${table.minBuyin} and ${table.maxBuyin} Paper` });
            return;
          }

          // Check if already seated
          if (table.seats.some(s => s && s.userId === ws.user!.id)) {
            send(ws, { type: "poker:error", error: "Already seated at this table" });
            return;
          }

          // Find first empty seat
          const emptySeatIndex = table.seats.findIndex(s => s === null);
          if (emptySeatIndex === -1) {
            send(ws, { type: "poker:error", error: "Table is full" });
            return;
          }

          // Verify and deduct Paper balance
          try {
            const user = await prisma.user.findUnique({ where: { id: ws.user.id }, select: { paper: true } });
            if (!user || (user as any).paper < buyin) {
              send(ws, { type: "poker:error", error: "Insufficient Paper balance" });
              return;
            }
            const newBalance = (user as any).paper - buyin;
            await prisma.$transaction([
              (prisma as any).paperTransaction.create({
                data: {
                  userId: ws.user.id,
                  type: "POKER_BUYIN",
                  amount: -buyin,
                  balance: newBalance,
                  description: `Poker buy-in at table ${tableId}`,
                  refId: tableId,
                },
              }),
              prisma.user.update({ where: { id: ws.user.id }, data: { paper: newBalance } }),
            ]);
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

          // Remove from spectators if present
          table.spectators.delete(ws.user.id);

          console.log(`[poker] ${ws.user.name} joined table ${tableId} seat ${emptySeatIndex} with ${buyin} chips`);
          broadcastPokerState(tableId);

          // Auto-start when 2+ players seated and not already in a hand
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

          // If mid-hand and they have cards, auto-fold
          if (table.handInProgress && seat.cards.length > 0 && !seat.folded) {
            seat.folded = true;
            // If it was their turn, advance
            if (table.turnIndex === seatIdx) {
              // We'll handle chip return after fold processing
            }
          }

          // Return remaining chips to Paper balance
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

          // If the game was waiting on them, advance
          if (wasTheirTurn && table.handInProgress) {
            advancePokerGame(table);
          } else {
            broadcastPokerState(tableId);
          }

          // If fewer than 2 players remain mid-hand, resolve
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

          // Must be seated
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

          // Find player seat
          const seatIdx = table.seats.findIndex(s => s && s.userId === ws.user!.id);
          if (seatIdx === -1) { send(ws, { type: "poker:error", error: "Not seated" }); return; }

          const seat = table.seats[seatIdx]!;

          // Verify it's their turn
          if (table.turnIndex !== seatIdx) {
            send(ws, { type: "poker:error", error: "Not your turn" });
            return;
          }

          if (seat.folded || seat.allIn) {
            send(ws, { type: "poker:error", error: "Cannot act" });
            return;
          }

          const toCall = table.currentBet - seat.bet;

          if (action === "fold") {
            seat.folded = true;
          } else if (action === "check") {
            if (toCall > 0) {
              send(ws, { type: "poker:error", error: "Cannot check — must call, raise, or fold" });
              return;
            }
            // Check is a no-op on bet
          } else if (action === "call") {
            if (toCall <= 0) {
              // Treat as check
            } else {
              const callAmount = Math.min(toCall, seat.chips);
              seat.chips -= callAmount;
              seat.bet += callAmount;
              if (seat.chips === 0) seat.allIn = true;
            }
          } else if (action === "raise") {
            if (amount <= 0) { send(ws, { type: "poker:error", error: "Raise amount required" }); return; }

            const totalBet = amount; // Total bet amount (not additional)
            const raiseAmount = totalBet - seat.bet;

            if (raiseAmount <= 0 || raiseAmount > seat.chips) {
              send(ws, { type: "poker:error", error: "Invalid raise amount" });
              return;
            }

            // Minimum raise is at least double the current bet (or all-in)
            if (totalBet < table.currentBet * 2 && raiseAmount < seat.chips) {
              send(ws, { type: "poker:error", error: `Minimum raise is ${table.currentBet * 2}` });
              return;
            }

            seat.chips -= raiseAmount;
            seat.bet = totalBet;
            table.currentBet = totalBet;
            if (seat.chips === 0) seat.allIn = true;
          } else if (action === "allin") {
            const allInAmount = seat.chips;
            seat.bet += allInAmount;
            seat.chips = 0;
            seat.allIn = true;
            if (seat.bet > table.currentBet) {
              table.currentBet = seat.bet;
            }
          } else {
            send(ws, { type: "poker:error", error: `Unknown action: ${action}` });
            return;
          }

          // Advance game logic (broadcasts state to all clients)
          advancePokerGame(table);
          return;
        }

        // ── Crew Chat via WebSocket ──────────────────────────────────────────
        if (msg.type === "crew:send") {
          const crewId = String(msg.crewId || "").trim();
          const body = String(msg.body || "").trim().slice(0, 2000);
          const fromId = ws.user?.id;
          if (!fromId || !crewId || !body) return;
          // URL spam check
          const urlCheck = checkUrlSpam(body);
          if (!urlCheck.ok) { send(ws, { type: "crew:rejected", crewId, reason: urlCheck.reason }); return; }
          // Rate limit
          const rate = checkChatRateLimit(fromId);
          if (!rate.ok) { send(ws, { type: "crew:rejected", crewId, reason: rate.reason, retryInMs: rate.retryInMs }); return; }

          try {
            // Verify sender is a member of the crew
            const membership = await (prisma as any).crewMember.findFirst({
              where: { crewId, userId: fromId },
            });
            if (!membership) return;

            // Optional reply-to — look up parent (must be same crew)
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

            // Save message
            const message = await (prisma as any).crewMessage.create({
              data: { crewId, userId: fromId, userName: ws.user?.name || "Unknown", body, ...crewReplyData },
              select: { id: true, crewId: true, userId: true, userName: true, body: true, createdAt: true, replyToId: true, replyToUserId: true, replyToUserName: true, replyToBody: true },
            });

            // Get all crew members
            const members = await (prisma as any).crewMember.findMany({
              where: { crewId },
              select: { userId: true },
            });

            // Broadcast to all online crew members
            const payload = { type: "crew:message", crewId, message: { ...message, createdAt: message.createdAt.toISOString() } };
            for (const sock of wss.clients) {
              const sockUser = (sock as any).user;
              if (sockUser && members.some((m: any) => m.userId === sockUser.id)) {
                send(sock as any, payload);
              }
            }

            // Notify offline members
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

            // @mention notifications inside crew chat — only pings
            // crew members (we don't notify random users via crew chat)
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
                  if (!memberSet.has(u.id)) continue; // skip non-members
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
            // Sender, or crew leader/officer
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
            if (!membership) return; // must be a crew member
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

        // ── DM via WebSocket ──────────────────────────────────────────────────
        if (msg.type === "dm:send") {
          const rawToId = String(msg.toId  || "").trim();
          const body    = String(msg.body  || "").trim().slice(0, 2000);
          const fromId  = ws.user?.id;
          console.log(`[dm:send] fromId=${fromId || "(none)"} rawToId=${JSON.stringify(rawToId)} bodyLen=${body.length}`);
          if (!fromId) { send(ws, { type: "dm:rejected", reason: "Session expired. Refresh the page." }); return; }
          if (!rawToId) { send(ws, { type: "dm:rejected", reason: "No recipient selected." }); return; }
          if (!body) { send(ws, { type: "dm:rejected", reason: "Empty message." }); return; }
          // URL spam check
          const urlCheck = checkUrlSpam(body);
          if (!urlCheck.ok) { send(ws, { type: "dm:rejected", reason: urlCheck.reason }); return; }
          // Rate limit
          const rate = checkChatRateLimit(fromId);
          if (!rate.ok) { send(ws, { type: "dm:rejected", reason: rate.reason, retryInMs: rate.retryInMs }); return; }
          const toId = await resolveUserId(rawToId);
          // Block check — either direction blocks
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
          // Optional reply-to — look up the parent message to snapshot
          let dmReplyData: any = {};
          const dmReplyToId = typeof msg.replyToId === "string" ? msg.replyToId : "";
          if (dmReplyToId) {
            try {
              const parent = await prisma.directMessage.findUnique({ where: { id: dmReplyToId } });
              if (parent && !(parent as any).deletedAt) {
                // Only allow replying to messages in the same thread
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
          const payload = { type: "dm:message", message: { ...dm, createdAt: dm.createdAt.toISOString() } };
          dmDeliver(toId, payload);
          if (!isUserOnline(toId)) {
            sendPush(toId, { title: `DM from ${ws.user?.name || "Someone"}`, body: body.slice(0, 120), url: "/home", tag: `dm:${fromId}` }).catch(() => {});
          }
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
            if (dm.fromId !== meId) return; // sender-only
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
            if (dm.fromId !== meId) return; // sender-only; DMs have no mods
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
            if (dm.fromId !== meId && dm.toId !== meId) return; // only the two peers
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
      // Crew presence: notify crew mates this user went offline (only if no other sockets)
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
        }, 2000); // 2s delay to avoid flicker on page navigation
      }
      leaveRoom(ws);
    });
  });

  // ── Social (Friends + Recents + Blocks + user-side Reports) ───────────────
  // Extracted to routes/social.ts. /staff/reports/* below stays put (will move
  // with the staff extraction).
  await app.register(socialRoutes, { authFromHeader, verifyToken, awardNotoriety, createNotification, rooms } as any);


  // GET /staff/reports — queue

  // POST /staff/reports/:id/action — mark as reviewed/actioned/dismissed



// ── Lobby search ──────────────────────────────────────────────────────────

  // GET /users/search?q=... — search users by name/usernameKey
  app.get("/users/search", async (req, reply) => {
    const q = String((req.query as any).q ?? "").trim();
    if (!q || q.length < 2) return reply.send({ ok: true, users: [] });
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { usernameKey: { contains: q.toLowerCase() } },
        ],
        banned: false,
      },
      select: { id: true, name: true, usernameKey: true, avatar: true, avatarColor: true, tier: true, notoriety: true },
      orderBy: { notoriety: "desc" },
      take: 25,
    });
    return reply.send({ ok: true, users });
  });


  // ══════════════════════════════════════════════════════════════════════════════
  // ── LOBBY PAID TIERS + STRIPE — extracted to routes/billing.ts ────────────
  // ══════════════════════════════════════════════════════════════════════════════
  await app.register(billingRoutes, { authFromHeader, getGlobalRole, canAccessStaff, canAssignRoles, globalAudit, lobbyAdminAccess } as any);


  // ── Reserved Names (staff-managed blocklist) ────────────────────────────────



  // ══════════════════════════════════════════════════════════════════════════════
  // ── EVENT MANAGER ──────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════════

  // Helper: broadcast an event announcement to all connected users
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

  // ── Events — extracted to routes/events.ts ────────────────────────────────
  await app.register(eventsRoutes, { authFromHeader, getGlobalRole, canAssignRoles, canAccessStaff, broadcastEvent, globalAudit, lobbyAdminAccess } as any);


  // GET /staff/config — returns all site config values

  // POST /staff/config — update site config values
  // POST /staff/featured — set the featured lobby for the homepage hero

  // GET /staff/featured — get current featured lobby ID


  // GET /staff/lobbies — list all lobbies for staff management
  // POST /staff/lobbies/:id/pin — toggle lobby pinned state

  // ── Notifications + Push — extracted to routes/notifications.ts ─────────
  await app.register(notificationsRoutes, { authFromHeader, VAPID_PUBLIC, sendPush } as any);


  // GET /staff/roster — list all staff members with roles

  // GET /staff/board — list staff board posts

  // POST /staff/board — create a board post

  // POST /staff/board/:id/pin — toggle pin on a board post

  // DELETE /staff/board/:id — delete a board post

  // ══════════════════════════════════════════════════════════════════════════════
  // ── NOTIFICATIONS — extracted to routes/notifications.ts ──────────────────
  // ══════════════════════════════════════════════════════════════════════════════


  // ══════════════════════════════════════════════════════════════════════════════
  // ── ACTIVITY FEED + UNFURL — extracted to routes/activity.ts ──────────────
  // ══════════════════════════════════════════════════════════════════════════════
  await app.register(activityRoutes, { authFromHeader } as any);


  // ══════════════════════════════════════════════════════════════════════════════
  // ── OUTREACH + ANALYTICS — extracted to routes/staffOps.ts ────────────────
  // ══════════════════════════════════════════════════════════════════════════════
  await app.register(staffOpsRoutes, { authFromHeader, getGlobalRole, canAccessStaff, rooms } as any);


  // ══════════════════════════════════════════════════════════════════════════════
  // ── TENOR + TWITCH — extracted to routes/tenor.ts and routes/twitch.ts ─────
  // ══════════════════════════════════════════════════════════════════════════════

  await app.register(tenorRoutes);
  await app.register(twitchRoutes, { rooms } as any);


  // ══════════════════════════════════════════════════════════════════════════════
  // ── MLB STATS API INTEGRATION — extracted to routes/mlb.ts ──────────────────
  // ══════════════════════════════════════════════════════════════════════════════

  await app.register(mlbRoutes);


  // ══════════════════════════════════════════════════════════════════════════════
  // ── PGA TOUR API INTEGRATION — extracted to routes/pga.ts ────────────────────
  // ══════════════════════════════════════════════════════════════════════════════

  await app.register(pgaRoutes);


  // ══════════════════════════════════════════════════════════════════════════════
  // ── YOUTUBE RSS FEED ───────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════════

  // In-memory cache for YouTube RSS (avoids hammering YouTube)
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

      // Parse XML entries — lightweight regex parse, no external XML lib needed
      const entries: any[] = [];
      const entryBlocks = xml.split("<entry>").slice(1); // skip first chunk (feed header)
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

  // ══════════════════════════════════════════════════════════════════════════════
  // ── BUNGIE API INTEGRATION — extracted to routes/bungie.ts ─────────────────
  // ══════════════════════════════════════════════════════════════════════════════

  await app.register(bungieRoutes, { authFromHeader, awardNotoriety } as any);

  // Auto-sync Bungie manifest on startup (non-blocking) — kept here because
  // it's a startup workflow, not a request handler.
  if (process.env.BUNGIE_API_KEY) {
    syncManifest(process.env.BUNGIE_API_KEY).then(r => {
      console.log(`[manifest] Startup sync: ${r.ok ? "OK" : "FAILED"} — v${r.version}`, r.counts);
    }).catch(e => console.error("[manifest] Startup sync error:", e));
  }


  // POST /staff/users/:userId/tier — update user tier (alias for subscription grant)


  // ══════════════════════════════════════════════════════════════════════════════
  // ── DESTINY CHALLENGES ────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════════

  // GET /challenges — list active challenge instances
  app.get("/challenges", async (req, reply) => {
    const { scope, lobbyId, category } = req.query as any;
    const where: any = {
      status: "ACTIVE",
      ...(scope ? { definition: { scope } } : {}),
      ...(lobbyId ? { definition: { lobbyId } } : {}),
      ...(category ? { definition: { category } } : {}),
    };
    const instances = await prisma.challengeInstance.findMany({
      where,
      include: { definition: true, _count: { select: { enrollments: true } } },
      orderBy: { startsAt: "desc" },
      take: 50,
    });
    return reply.send({ ok: true, challenges: instances });
  });

  // GET /challenges/:instanceId — single challenge with user's enrollment
  app.get("/challenges/:instanceId", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    const instanceId = String((req as any).params?.instanceId || "");
    const instance = await prisma.challengeInstance.findUnique({
      where: { id: instanceId },
      include: { definition: true, _count: { select: { enrollments: true } } },
    });
    if (!instance) return reply.code(404).send({ ok: false, error: "not_found" });

    let enrollment = null;
    if (u) {
      enrollment = await prisma.challengeEnrollment.findUnique({
        where: { instanceId_userId: { instanceId, userId: u.id } },
      });
    }
    return reply.send({ ok: true, challenge: instance, enrollment });
  });

  // POST /challenges/:instanceId/enroll — enroll in a challenge
  app.post("/challenges/:instanceId/enroll", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });

    const instanceId = String((req as any).params?.instanceId || "");
    const instance = await prisma.challengeInstance.findUnique({
      where: { id: instanceId },
      include: { definition: true },
    });
    if (!instance || instance.status !== "ACTIVE") return reply.code(400).send({ ok: false, error: "challenge_not_active" });
    if (instance.endsAt && new Date() > instance.endsAt) return reply.code(400).send({ ok: false, error: "challenge_expired" });

    // Check Bungie account linked
    const acct = await prisma.userGameAccount.findFirst({ where: { userId: u.id, gameType: "BUNGIE" } });
    if (!acct) return reply.code(400).send({ ok: false, error: "bungie_not_linked" });

    // Initialize progress
    const objectives = (instance.definition.objectives as any[]) || [];
    const progress: Record<string, any> = {};
    for (const obj of objectives) {
      progress[obj.id] = { current: 0, target: obj.target, completed: false };
    }

    try {
      const enrollment = await prisma.challengeEnrollment.create({
        data: { instanceId, userId: u.id, progress: progress as any },
      });
      return reply.send({ ok: true, enrollment });
    } catch (e: any) {
      if (e.code === "P2002") return reply.send({ ok: true, error: "already_enrolled" });
      throw e;
    }
  });

  // DELETE /challenges/:instanceId/enroll — abandon a challenge
  app.delete("/challenges/:instanceId/enroll", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const instanceId = String((req as any).params?.instanceId || "");

    await prisma.challengeEnrollment.updateMany({
      where: { instanceId, userId: u.id, status: "ACTIVE" },
      data: { status: "ABANDONED" },
    });
    return reply.send({ ok: true });
  });

  // GET /challenges/my — user's active enrollments with progress
  app.get("/challenges/my", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });

    const enrollments = await prisma.challengeEnrollment.findMany({
      where: { userId: u.id },
      include: { instance: { include: { definition: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return reply.send({ ok: true, enrollments });
  });

  // GET /challenges/:instanceId/leaderboard — completion leaderboard
  app.get("/challenges/:instanceId/leaderboard", async (req, reply) => {
    const instanceId = String((req as any).params?.instanceId || "");
    const enrollments = await prisma.challengeEnrollment.findMany({
      where: { instanceId, status: "COMPLETED" },
      orderBy: { completedAt: "asc" },
      take: 50,
    });
    // Resolve usernames
    const userIds = enrollments.map(e => e.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, tier: true },
    });
    const userMap = new Map(users.map(u => [u.id, u]));
    const leaderboard = enrollments.map((e, i) => ({
      rank: i + 1,
      userId: e.userId,
      name: userMap.get(e.userId)?.name || "Unknown",
      tier: userMap.get(e.userId)?.tier || "INNOCENT",
      completedAt: e.completedAt,
    }));
    return reply.send({ ok: true, leaderboard });
  });

  // ── Challenge Admin (staff or lobby owner) ────────────────────────────────

  // POST /challenges/definitions — create a challenge definition
  app.post("/challenges/definitions", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    // Only staff+ can create challenges for now
    if (!["GOD", "ADMIN", "STAFF"].includes(u.globalRole || "")) {
      return reply.code(403).send({ ok: false, error: "forbidden" });
    }

    const body = req.body as any;
    const def = await prisma.challengeDefinition.create({
      data: {
        title: String(body.title || "").trim(),
        description: String(body.description || "").trim(),
        iconUrl: body.iconUrl || null,
        category: String(body.category || "").trim(),
        difficulty: parseInt(body.difficulty) || 1,
        scope: body.scope || "GLOBAL",
        lobbyId: body.lobbyId || null,
        crewId: body.crewId || null,
        createdById: u.id,
        objectives: body.objectives || [],
        requireAll: body.requireAll !== false,
        requireCount: body.requireCount || null,
        notorietyReward: parseInt(body.notorietyReward) || 0,
        crewRepReward: parseInt(body.crewRepReward) || 0,
        isRecurring: body.isRecurring === true,
        recurSchedule: body.recurSchedule || null,
        status: "DRAFT",
      },
    });
    return reply.send({ ok: true, definition: def });
  });

  // POST /challenges/definitions/:id/activate — create an active instance
  app.post("/challenges/definitions/:id/activate", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    if (!["GOD", "ADMIN", "STAFF"].includes(u.globalRole || "")) {
      return reply.code(403).send({ ok: false, error: "forbidden" });
    }

    const defId = String((req as any).params?.id || "");
    const body = req.body as any;
    const def = await prisma.challengeDefinition.findUnique({ where: { id: defId } });
    if (!def) return reply.code(404).send({ ok: false, error: "not_found" });

    // Activate the definition
    await prisma.challengeDefinition.update({ where: { id: defId }, data: { status: "ACTIVE" } });

    // Create instance
    const instance = await prisma.challengeInstance.create({
      data: {
        definitionId: defId,
        startsAt: body.startsAt ? new Date(body.startsAt) : new Date(),
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
        status: "ACTIVE",
      },
    });
    return reply.send({ ok: true, instance });
  });

  // GET /challenges/definitions — list all definitions (admin)
  app.get("/challenges/definitions", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    if (!["GOD", "ADMIN", "STAFF"].includes(u.globalRole || "")) {
      return reply.code(403).send({ ok: false, error: "forbidden" });
    }
    const defs = await prisma.challengeDefinition.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return reply.send({ ok: true, definitions: defs });
  });

  // ── BADGES + TOURNAMENTS — extracted to routes/badges.ts + routes/tournaments.ts
  await app.register(badgesRoutes, { authFromHeader } as any);
  await app.register(tournamentsRoutes, { authFromHeader, awardNotoriety } as any);


  // ══════════════════════════════════════════════════════════════════════════════
  // ── RIOT / LEAGUE — extracted to routes/league.ts ──────────────────────────
  // ══════════════════════════════════════════════════════════════════════════════

  await app.register(leagueRoutes);


  // ══════════════════════════════════════════════════════════════════════════════
  // ── FORTNITE API INTEGRATION — extracted to routes/fortnite.ts ─────────────
  // ══════════════════════════════════════════════════════════════════════════════

  await app.register(fortniteRoutes, { authFromHeader, sendPush } as any);


  // ══════════════════════════════════════════════════════════════════════════════
  // ── PUBG API INTEGRATION — extracted to routes/pubg.ts ─────────────────────
  // ══════════════════════════════════════════════════════════════════════════════

  await app.register(pubgRoutes);


  // ══════════════════════════════════════════════════════════════════════════════
  // ── WINDROSE — extracted to routes/windrose.ts ─────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════════

  await app.register(windroseRoutes, { authFromHeader, sendPush, awardPaper, isAIAvailable, getAI } as any);


  // ══════════════════════════════════════════════════════════════════════════════
  // ── DESTINY 2 (Steam appid 1085660) ───────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════════
  const DESTINY2_APPID = "1085660";
  const d2Cache = new Map<string, { data: any; expiresAt: number }>();
  function d2CacheGet(key: string) {
    const c = d2Cache.get(key);
    if (c && c.expiresAt > Date.now()) return c.data;
    return null;
  }
  function d2CacheSet(key: string, data: any, ttlMs: number) {
    d2Cache.set(key, { data, expiresAt: Date.now() + ttlMs });
  }

  app.get("/destiny/live-players", async (req, reply) => {
    const cacheKey = "d2:live";
    const cached = d2CacheGet(cacheKey);
    if (cached) return reply.send(cached);
    try {
      const url = `https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${DESTINY2_APPID}`;
      const res = await fetch(url);
      if (!res.ok) return reply.send({ ok: false, error: "steam_fetch_failed" });
      const j: any = await res.json();
      const count = j?.response?.player_count;
      if (typeof count !== "number") return reply.send({ ok: false, error: "no_count" });
      const result = { ok: true, players: count, appid: DESTINY2_APPID, checkedAt: new Date().toISOString() };
      d2CacheSet(cacheKey, result, 60 * 1000);
      return reply.send(result);
    } catch (e) {
      console.error("[destiny/live-players]", e);
      return reply.send({ ok: false, error: "fetch_failed" });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // ── LFG / FIRETEAM BOARD — extracted to routes/lfg.ts ──────────────────────
  // ══════════════════════════════════════════════════════════════════════════════

  await app.register(lfgRoutes, { authFromHeader, getGlobalRole, canAccessStaff } as any);


  // ── Paper Economy ──────────────────────────────────────────────────────────
  // Virtual currency system: earn Paper through gameplay, spend in store/marketplace.

  // Core transaction function — all Paper movement goes through here
  async function awardPaper(userId: string, type: string, amount: number, description: string, refId?: string): Promise<{ balance: number } | null> {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { paper: true } });
      if (!user) return null;

      const newBalance = (user as any).paper + amount;
      if (newBalance < 0) return null; // can't go negative

      await prisma.$transaction([
        (prisma as any).paperTransaction.create({
          data: { userId, type, amount, balance: newBalance, description, refId: refId || null },
        }),
        prisma.user.update({ where: { id: userId }, data: { paper: newBalance } }),
      ]);

      return { balance: newBalance };
    } catch (e) {
      console.error("[paper] awardPaper error:", e);
      return null;
    }
  }

  // ── Paper routes — extracted to routes/paper.ts ────────────────────────
  await app.register(paperRoutes, { authFromHeader, awardPaper } as any);


  // ── Poker — REST Endpoints ────────────────────────────────────────────────

  // GET /poker/:tableId — public table state (no hole cards)
  app.get("/poker/:tableId", async (req, reply) => {
    const tableId = String((req as any).params?.tableId || "").trim();
    if (!tableId) return reply.code(400).send({ ok: false, error: "missing tableId" });

    const table = pokerTables.get(tableId);
    if (!table) return reply.send({ ok: true, table: null, message: "No active table" });

    // Optionally auth to show the requester's own cards
    const u = authFromHeader((req as any).headers?.authorization);
    return reply.send({ ok: true, table: buildPokerStateForUser(table, u?.id) });
  });

  // POST /poker/:tableId/cashout — cash out remaining chips to Paper
  app.post("/poker/:tableId/cashout", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });

    const tableId = String((req as any).params?.tableId || "").trim();
    if (!tableId) return reply.code(400).send({ ok: false, error: "missing tableId" });

    const table = pokerTables.get(tableId);
    if (!table) return reply.code(404).send({ ok: false, error: "Table not found" });

    const seatIdx = table.seats.findIndex(s => s && s.userId === u.id);
    if (seatIdx === -1) return reply.code(400).send({ ok: false, error: "Not seated at this table" });

    const seat = table.seats[seatIdx]!;

    // Can't cash out mid-hand
    if (table.handInProgress && !seat.folded) {
      return reply.code(400).send({ ok: false, error: "Cannot cash out during an active hand. Fold first or wait for the hand to end." });
    }

    const chips = seat.chips;
    if (chips <= 0) {
      table.seats[seatIdx] = null;
      broadcastPokerState(tableId);
      return reply.send({ ok: true, cashed: 0, balance: 0 });
    }

    try {
      const user = await prisma.user.findUnique({ where: { id: u.id }, select: { paper: true } });
      if (!user) return reply.code(404).send({ ok: false, error: "User not found" });

      const newBalance = (user as any).paper + chips;
      await prisma.$transaction([
        (prisma as any).paperTransaction.create({
          data: {
            userId: u.id,
            type: "POKER_CASHOUT",
            amount: chips,
            balance: newBalance,
            description: `Cashed out ${chips} chips from poker table ${tableId}`,
            refId: tableId,
          },
        }),
        prisma.user.update({ where: { id: u.id }, data: { paper: newBalance } }),
      ]);

      table.seats[seatIdx] = null;
      broadcastPokerState(tableId);

      return reply.send({ ok: true, cashed: chips, balance: newBalance });
    } catch (e) {
      console.error("[poker:cashout] Error:", e);
      return reply.code(500).send({ ok: false, error: "Cashout failed" });
    }
  });

  // ── Store + Inventory + Market — extracted to routes/store.ts ────────────
  await app.register(storeRoutes, { authFromHeader } as any);


  // ── Paper Trading — Binance Market Data Bridge ─────────────────────────────
  // Server-side bridge: connects to Binance WebSocket for real-time crypto prices,
  // relays to connected clients. Also provides REST endpoints for historical candles.

  const BINANCE_WS_BASE = "wss://stream.binance.com:9443";
  const BINANCE_REST = "https://api.binance.com";

  // In-memory price cache: symbol → latest price + kline data
  const livePrices = new Map<string, { price: number; time: number }>();
  const binanceSubs = new Map<string, WsClient>(); // symbol → upstream WS
  const symbolSubscribers = new Map<string, Set<Sock>>(); // symbol → client sockets

  // Default symbols to always stream
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
          // Relay to subscribed clients
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
              closed: k.x, // is this kline closed?
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

  // Boot default symbols
  for (const sym of DEFAULT_SYMBOLS) subscribeBinanceSymbol(sym);

  // Handle client subscribe/unsubscribe via existing WS
  // Clients send: { type: "trading:subscribe", symbol: "BTCUSDT" }
  // Clients send: { type: "trading:unsubscribe", symbol: "BTCUSDT" }
  // (Hooked into the main WS message handler below)

  // ── Trading REST + workers — extracted to routes/trading.ts ───────────────
  // Helpers the plugin needs to broadcast over the global wss:
  function broadcastToLobby(lobbyId: string, event: any) {
    for (const sock of wss.clients) {
      const s = sock as Sock;
      if (s.roomId === `lobby:${lobbyId}` || s.roomId === lobbyId) {
        try { send(s, event); } catch {}
      }
    }
  }
  function notifyUser(userId: string, event: any) {
    for (const sock of wss.clients) {
      if ((sock as any).user?.id === userId) {
        try { send(sock as Sock, event); } catch {}
      }
    }
  }

  // ── Operator commentary on FakeOut trades ────────────────────────────────
  // The Operator (Weered's AI) heckles big trades in the lobby chat. We
  // throttle per-lobby (30s min between comments) to cap cost + spam, and
  // only invoke AI when a context arrives (caller decides what's worth
  // commenting on). Output is broadcast as operator:commentary; the client
  // synthesizes a chat row keyed to the active lobby room.
  const _operatorLastByLobby = new Map<string, number>();
  async function operatorCommentateOnTrade(lobbyId: string, context: string) {
    const now = Date.now();
    const last = _operatorLastByLobby.get(lobbyId) || 0;
    if (now - last < 30_000) return;
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

  await app.register(diceRoutes, {
    authFromHeader, broadcastToLobby,
  } as any);

  await app.register(supportRoutes, {
    authFromHeader, getGlobalRole, canAccessStaff,
  } as any);


  // ── Hook trading:subscribe / trading:unsubscribe into WS message handler ──
  // (We patch the existing ws.on("message") handler by also checking here)
  // The main handler is above; we add a secondary listener for trading msgs.
  wss.on("connection", (rawWs) => {
    const ws = rawWs as Sock;
    (ws as any)._tradingSubs = new Set<string>();

    ws.on("message", (raw) => {
      const msg = safeJson(raw);
      if (!msg) return;

      if (msg.type === "trading:subscribe") {
        const sym = String(msg.symbol || "").toLowerCase();
        if (!sym) return;
        // Subscribe to Binance if not already
        subscribeBinanceSymbol(sym);
        // Track this client's subscription
        if (!symbolSubscribers.has(sym)) symbolSubscribers.set(sym, new Set());
        symbolSubscribers.get(sym)!.add(ws);
        (ws as any)._tradingSubs.add(sym);
        // Send current price immediately
        const p = livePrices.get(sym);
        if (p) send(ws, { type: "trading:price", symbol: sym.toUpperCase(), price: p.price, time: p.time });
      }

      if (msg.type === "trading:unsubscribe") {
        const sym = String(msg.symbol || "").toLowerCase();
        symbolSubscribers.get(sym)?.delete(ws);
        (ws as any)._tradingSubs?.delete(sym);
      }
    });

    ws.on("close", () => {
      // Clean up trading subscriptions
      const subs = (ws as any)._tradingSubs as Set<string> | undefined;
      if (subs) {
        for (const sym of subs) {
          symbolSubscribers.get(sym)?.delete(ws);
        }
      }
    });
  });

  console.log("[trading] Paper trading engine initialized with", DEFAULT_SYMBOLS.length, "default symbols");

  process.on("SIGINT", async () => {
    // Close Binance connections
    for (const [, ws] of binanceSubs) { try { ws.close(); } catch {} }
    try { await prisma.$disconnect(); } catch {}
    process.exit(0);
  });
    // ── Room dissolution: clean up empty unpinned rooms after 1 hour ──────────
  const ROOM_TTL_MS = 60 * 60 * 1000; // 1 hour
  const DISSOLUTION_INTERVAL_MS = 5 * 60 * 1000; // check every 5 minutes

  setInterval(async () => {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [roomId, room] of rooms.entries()) {
      // Skip pinned rooms
      if (room.pinned) continue;
      // Skip lobby rooms
      if (roomId.startsWith("lobby:") || roomId === "lobby" || roomId === "@ops") continue;
      // Skip rooms with users
      if (room.users.size > 0 || room.sockets.size > 0) continue;
      // Skip rooms that haven't been empty long enough
      if (now - room.lastActiveAt < ROOM_TTL_MS) continue;

      toDelete.push(roomId);
    }

    for (const roomId of toDelete) {
      rooms.delete(roomId);
      // Also delete from DB (soft — just remove the room record)
      try {
        await prisma.room.delete({ where: { id: roomId } }).catch(() => {});
        // Clean up related records
        await prisma.roomMessage.deleteMany({ where: { roomId } }).catch(() => {});
        await prisma.roomMember.deleteMany({ where: { roomId } }).catch(() => {});
      } catch {}
      console.log(`[dissolution] Room "${roomId}" dissolved after ${ROOM_TTL_MS / 60000}min empty`);
    }

    if (toDelete.length > 0) {
      console.log(`[dissolution] Cleaned up ${toDelete.length} empty room(s)`);
    }
  }, DISSOLUTION_INTERVAL_MS);

  // ── Challenge tracking worker ──────────────────────────────────────────────
  if (process.env.BUNGIE_API_KEY) {
    setBungieApiKey(process.env.BUNGIE_API_KEY);
    startChallengeWorker(prisma, awardNotoriety, (userId, event) => {
      for (const sock of wss.clients) {
        if ((sock as any).user?.id === userId) {
          send(sock as any, event);
        }
      }
    }, awardPaper);
  }

  // ── Nexus Mods poller ──────────────────────────────────────────────────────
  startNexusPoller(prisma);

  // ── HTTP listen — must be the LAST step so all routes are registered ──────
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
