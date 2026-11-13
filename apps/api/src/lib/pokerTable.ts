import { send, type AuthedUser } from "./roomState";
import { swallow } from "./logger";
import { createDeck, evaluateHand, compareHands, type Card } from "./pokerHands";

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
  /** Chips put into this hand so far, from the rounds already swept into the pot. */
  committed?: number;
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

/**
 * Tables are kept in memory, one per room. Any id used to make one and none
 * was ever removed, so one socket could grow memory without end (red team
 * 2026-11-01, finding 15). Now an id must look like a room's and there's a
 * ceiling; an empty table idle for half an hour is swept.
 */
export const POKER_TABLE_MAX = 300;
const POKER_IDLE_MS = 30 * 60_000;
export const pokerTableIdOk = (id: string) => /^[a-zA-Z0-9_:-]{1,64}$/.test(id);
const lastUsed = new Map<string, number>();

/** May this id get a table: a good id, and an existing table or room below the ceiling. */
export function pokerTableAllowed(tableId: string): boolean {
  if (!pokerTableIdOk(tableId)) return false;
  return pokerTables.has(tableId) || pokerTables.size < POKER_TABLE_MAX;
}

/** Remove empty tables nobody has touched for a while. Returns how many went. */
export function sweepPokerTables(now = Date.now()): number {
  let n = 0;
  for (const [id, t] of pokerTables) {
    const idle = now - (lastUsed.get(id) || 0) > POKER_IDLE_MS;
    if (idle && !t.handInProgress && t.seats.every((s) => s === null)) {
      if (t.autoStartTimer) clearTimeout(t.autoStartTimer);
      pokerTables.delete(id);
      lastUsed.delete(id);
      n++;
    }
  }
  return n;
}
setInterval(() => sweepPokerTables(), 10 * 60_000).unref?.();

export function getOrCreatePokerTable(tableId: string): PokerTable {
  lastUsed.set(tableId, Date.now());
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
      seat.committed = 0;
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
  for (const sock of _wss?.clients ?? []) {
    const su = sock.user as AuthedUser | undefined;
    if (!su) continue;
    const isSeated = table.seats.some((s) => s && s.userId === su.id);
    const isSpectator = table.spectators.has(su.id);
    if (isSeated || isSpectator) {
      try {
        send(sock, event);
      } catch (e) {
        swallow(e);
      }
    }
  }
}

export function broadcastPokerState(tableId: string) {
  const table = pokerTables.get(tableId);
  if (!table) return;

  for (const sock of _wss?.clients ?? []) {
    const su = sock.user as AuthedUser | undefined;
    if (!su) continue;
    const isSeated = table.seats.some((s) => s && s.userId === su.id);
    const isSpectator = table.spectators.has(su.id);
    if (isSeated || isSpectator) {
      send(sock, {
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
      seat.committed = (seat.committed || 0) + seat.bet;
      seat.bet = 0;
    }
  }
  table.currentBet = 0;
}

// Side pots (hardening pass 2026-11-12). The showdown used to hand the whole
// pot to the best hand at the table. Someone all-in for 100 against a bet of
// 300 then won 400, the 200 nobody had matched included; with three players
// the short stack took chips two others had bet only against each other. A
// function named buildSidePots sat here, never called, working a folded
// player's share out and throwing it away.
//
// Now each player can win, from each opponent, no more than they put in
// themselves: the rule at every poker table.

/** What each seat has in the hand, once every round's bets are swept. */
const putIn = (table: PokerTable) =>
  table.seats.map((s) => (s ? Math.max(0, s.committed || 0) : 0));

/** Chips in the pot from someone no longer seated (they left mid-hand). */
function deadMoney(table: PokerTable): number {
  return table.pot - putIn(table).reduce((a, b) => a + b, 0);
}

/** A bet nobody could match goes back to whoever made it, before anything is
 *  won: A bets 300 and B is all-in for 100, so 200 of A's was never in play.
 *  Returns what was handed back. */
export function returnUncalledBet(table: PokerTable): number {
  // With chips from an empty seat in the pot, who matched whom is no longer
  // known: nothing is handed back.
  if (deadMoney(table) !== 0) return 0;
  const put = putIn(table);
  let top = -1;
  let most = 0;
  let next = 0;
  put.forEach((p, i) => {
    if (p > most) {
      next = most;
      most = p;
      top = i;
    } else if (p > next) next = p;
  });
  const seat = top >= 0 ? table.seats[top] : null;
  const extra = most - next;
  if (!seat || seat.folded || extra <= 0) return 0;
  seat.committed = next;
  seat.chips += extra;
  table.pot -= extra;
  return extra;
}

/** The pots at showdown, smallest stake first: each holds what every player
 *  put in up to that stake, and only those who went that far can win it. A
 *  folded player's chips stay in the pots they reached; they can win none. */
export function buildSidePots(table: PokerTable): SidePot[] {
  const put = putIn(table);
  const live = (i: number) => !!table.seats[i] && !table.seats[i]!.folded;
  const everyoneIn = table.seats.map((_, i) => i).filter(live);
  const dead = deadMoney(table);
  // Chips that don't add up (they shouldn't happen): one pot, as it was.
  if (dead < 0 || put.every((p) => p === 0))
    return table.pot > 0 ? [{ amount: table.pot, eligible: everyoneIn }] : [];

  const stakes = [...new Set(everyoneIn.map((i) => put[i]).filter((p) => p > 0))].sort(
    (a, b) => a - b,
  );
  const pots: SidePot[] = [];
  let prev = 0;
  for (const stake of stakes) {
    let amount = 0;
    for (const p of put) amount += Math.max(0, Math.min(p, stake) - prev);
    pots.push({ amount, eligible: everyoneIn.filter((i) => put[i] >= stake) });
    prev = stake;
  }
  if (!pots.length) return table.pot > 0 ? [{ amount: table.pot, eligible: everyoneIn }] : [];
  // A folded player who put in more than anyone still in: into the last pot.
  for (const p of put) pots[pots.length - 1].amount += Math.max(0, p - prev);
  // An empty seat's chips are everyone's to win: into the first.
  pots[0].amount += dead;
  return pots;
}

/** Who wins what: each pot to the best hand among those who can win it, split
 *  evenly on a tie with the odd chip to the first. Seat index to chips won. */
export function settleShowdown(table: PokerTable): Map<number, number> {
  const won = new Map<number, number>();
  for (const pot of buildSidePots(table)) {
    const seats = table.seats.map((s, i) => (pot.eligible.includes(i) ? s : null));
    const best = determineWinners(seats, table.communityCards);
    if (!best.length || pot.amount <= 0) continue;
    const share = Math.floor(pot.amount / best.length);
    const odd = pot.amount - share * best.length;
    best.forEach((idx, k) => won.set(idx, (won.get(idx) || 0) + share + (k === 0 ? odd : 0)));
  }
  return won;
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
    void resolveShowdown(table);
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
      void resolveShowdown(table);
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

  // A bet nobody matched goes back first; then each pot to its best hand.
  returnUncalledBet(table);
  const won = settleShowdown(table);

  const winners: any[] = [];
  for (const [idx, payout] of [...won].sort((a, b) => b[1] - a[1])) {
    const seat = table.seats[idx]!;
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
    void resolveShowdown(table);
    return;
  }
  broadcastPokerState(table.tableId);
}
