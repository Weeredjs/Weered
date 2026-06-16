import { send, type Sock, type AuthedUser } from "./roomState";
import { swallow } from "./logger";
import {
  createDeck,
  shuffleDeck,
  evaluateHand,
  compareHands,
  RANKS,
  SUITS,
  type Card,
} from "./pokerHands";

// Poker table engine (game-flow + chip pots) extracted from index.ts. The
// paper-economy buy-in/cashout lives in the WS handler, not here. wss is
// injected from main() for the all-clients table broadcast.
let _wss: any = null;
let _broadcastToLobby: ((lobbyId: string, event: any) => void) | undefined;
export function setPokerTableDeps(deps: {
  wss?: any;
  broadcastToLobby?: (lobbyId: string, event: any) => void;
}) {
  if (deps.wss) _wss = deps.wss;
  if (deps.broadcastToLobby) _broadcastToLobby = deps.broadcastToLobby;
}

export type PokerSeat = {
  userId: string;
  name: string;
  chips: number;
  cards: Card[];
  folded: boolean;
  allIn: boolean;
  bet: number;
  seatIndex: number;
};

export type SidePot = { amount: number; eligible: number[] };

export type PokerPhase = "waiting" | "preflop" | "flop" | "turn" | "river" | "showdown";

export type PokerTable = {
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

export const pokerTables = new Map<string, PokerTable>();

export function determineWinners(seats: (PokerSeat | null)[], communityCards: Card[]): number[] {
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

export function getOrCreatePokerTable(tableId: string): PokerTable {
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

export function activeSeatCount(table: PokerTable): number {
  return table.seats.filter((s) => s !== null).length;
}

export function activePlayersInHand(table: PokerTable): PokerSeat[] {
  return table.seats.filter((s) => s !== null && !s.folded) as PokerSeat[];
}

export function nextActiveIndex(table: PokerTable, fromIndex: number): number {
  for (let i = 1; i <= 6; i++) {
    const idx = (fromIndex + i) % 6;
    const seat = table.seats[idx];
    if (seat && !seat.folded && !seat.allIn) return idx;
  }
  return -1;
}

export function nextOccupiedIndex(table: PokerTable, fromIndex: number): number {
  for (let i = 1; i <= 6; i++) {
    const idx = (fromIndex + i) % 6;
    if (table.seats[idx]) return idx;
  }
  return -1;
}

export function resetForNewHand(table: PokerTable) {
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

export function buildPokerStateForUser(table: PokerTable, userId?: string): any {
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
        cards:
          isMe || (isShowdown && !s.folded)
            ? s.cards
            : s.cards.map(() => ({ rank: "?", suit: "?" })),
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

export function broadcastToPokerTable(tableId: string, event: any) {
  const table = pokerTables.get(tableId);
  if (!table) return;
  for (const sock of (_wss as any)?.clients ?? []) {
    const su = (sock as any).user as AuthedUser | undefined;
    if (!su) continue;
    const isSeated = table.seats.some((s) => s && s.userId === su.id);
    const isSpectator = table.spectators.has(su.id);
    if (isSeated || isSpectator) {
      try {
        send(sock as any, event);
      } catch (e) {
        swallow(e);
      }
    }
  }
}

export function broadcastPokerState(tableId: string) {
  const table = pokerTables.get(tableId);
  if (!table) return;

  for (const sock of (_wss as any)?.clients ?? []) {
    const su = (sock as any).user as AuthedUser | undefined;
    if (!su) continue;
    const isSeated = table.seats.some((s) => s && s.userId === su.id);
    const isSpectator = table.spectators.has(su.id);
    if (isSeated || isSpectator) {
      send(sock as any, {
        type: "poker:state",
        ...buildPokerStateForUser(table, su.id),
      });
    }
  }
}

export function collectBetsIntoPot(table: PokerTable) {
  for (const seat of table.seats) {
    if (seat) {
      table.pot += seat.bet;
      seat.bet = 0;
    }
  }
  table.currentBet = 0;
}

export function buildSidePots(table: PokerTable): SidePot[] {
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
      const eligible = activeBets.filter((_, j) => j >= i).map((b) => b.seatIndex);
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

export function dealCommunityCards(table: PokerTable, count: number) {
  for (let i = 0; i < count; i++) {
    const card = table.deck.pop();
    if (card) table.communityCards.push(card);
  }
}

export function isBettingRoundComplete(table: PokerTable): boolean {
  const active = table.seats.filter((s) => s && !s.folded && !s.allIn) as PokerSeat[];
  if (active.length === 0) return true;
  if (active.length === 1 && table.currentBet === 0) return true;
  return active.every((s) => s.bet === table.currentBet);
}

export function advancePokerGame(table: PokerTable) {
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
    _broadcastToLobby?.("poker", {
      type: "poker:pot-won",
      userId: winner.userId,
      userName: winner.name,
      amount: wonAmount,
    });
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

  const canAct = table.seats.filter((s) => s && !s.folded && !s.allIn) as PokerSeat[];
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

export async function resolveShowdown(table: PokerTable) {
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
    _broadcastToLobby?.("poker", {
      type: "poker:pot-won",
      userId: seat.userId,
      userName: seat.name,
      amount: payout,
    });
  }

  const totalPot = table.pot;
  table.lastShowdownResult = { winners, pot: totalPot };
  table.pot = 0;
  table.handInProgress = false;
  broadcastPokerState(table.tableId);
  broadcastToPokerTable(table.tableId, {
    type: "poker:winner-chip",
    tableId: table.tableId,
    winners: winners.map((w) => ({
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

export function scheduleAutoStart(table: PokerTable) {
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

export function startPokerHand(table: PokerTable) {
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
