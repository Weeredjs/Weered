// Pure Texas Hold'em hand math — no I/O, no shared state. Extracted from
// index.ts so the evaluator can be unit-tested and the entrypoint shrinks.

export type Card = { rank: string; suit: string };

export const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
export const SUITS: ("h" | "d" | "c" | "s")[] = ["h", "d", "c", "s"];

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return shuffleDeck(deck);
}

export function shuffleDeck(deck: Card[]): Card[] {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

export function rankValue(r: string): number {
  const idx = RANKS.indexOf(r);
  return idx >= 0 ? idx + 2 : 0;
}

export function combinations<T>(arr: T[], k: number): T[][] {
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

export function evaluate5(cards: Card[]): {
  rank: number;
  name: string;
  kickers: number[];
  best: Card[];
} {
  const vals = cards.map((c) => rankValue(c.rank)).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);

  const isFlush = suits.every((s) => s === suits[0]);

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
    return {
      rank: 8,
      name: straightHigh === 14 ? "Royal Flush" : "Straight Flush",
      kickers: [straightHigh],
      best: cards,
    };
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
    const kickers = vals.filter((v) => v !== trip);
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
    const kickers = vals.filter((v) => v !== pair);
    return { rank: 1, name: "Pair", kickers: [pair, ...kickers], best: cards };
  }
  return { rank: 0, name: "High Card", kickers: vals, best: cards };
}

export function evaluateHand(cards: Card[]): {
  rank: number;
  name: string;
  best: Card[];
  kickers: number[];
} {
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

export function compareHands(
  a: { rank: number; kickers: number[] },
  b: { rank: number; kickers: number[] },
): number {
  if (a.rank !== b.rank) return a.rank > b.rank ? 1 : -1;
  for (let i = 0; i < Math.max(a.kickers.length, b.kickers.length); i++) {
    const ak = a.kickers[i] ?? 0;
    const bk = b.kickers[i] ?? 0;
    if (ak !== bk) return ak > bk ? 1 : -1;
  }
  return 0;
}
