import { describe, expect, it } from "vitest";
import {
  buildSidePots,
  collectBetsIntoPot,
  returnUncalledBet,
  settleShowdown,
  type PokerSeat,
  type PokerTable,
} from "../../src/lib/pokerTable";
import type { Card } from "../../src/lib/pokerHands";

// Side pots (hardening pass 2026-11-12). The showdown gave the whole pot to
// the best hand at the table: someone all-in for 100 against a bet of 300 won
// 400, and with three players a short stack took chips the other two had bet
// only against each other. Each player can now win, from each opponent, no
// more than they put in themselves.

const c = (rank: string, suit: string): Card => ({ rank, suit });
// A board nobody improves on beyond their own pair: 2 7 9 J K, four suits.
const BOARD = [c("2", "c"), c("7", "d"), c("9", "s"), c("J", "h"), c("K", "c")];
const ACES = [c("A", "s"), c("A", "h")]; // a pair of aces: the best here
const KINGS = [c("K", "d"), c("Q", "d")]; // a pair of kings
const NOTHING = [c("3", "c"), c("4", "d")]; // king high

function seat(
  i: number,
  cards: Card[],
  committed: number,
  over: Partial<PokerSeat> = {},
): PokerSeat {
  return {
    userId: `u${i}`,
    name: `P${i}`,
    chips: 0,
    cards,
    folded: false,
    allIn: false,
    bet: 0,
    seatIndex: i,
    committed,
    ...over,
  };
}
function table(seats: (PokerSeat | null)[], pot?: number, board = BOARD): PokerTable {
  return {
    tableId: "t",
    seats,
    communityCards: board,
    pot: pot ?? seats.reduce((n, s) => n + (s?.committed || 0), 0),
    sidePots: [],
    currentBet: 0,
  } as unknown as PokerTable;
}
/** Hand an unmatched bet back, settle, and return chips per seat afterwards. */
function play(t: PokerTable): number[] {
  returnUncalledBet(t);
  for (const [i, won] of settleShowdown(t)) t.seats[i]!.chips += won;
  return t.seats.map((s) => (s ? s.chips : 0));
}

describe("a short stack all-in", () => {
  it("wins only what was matched: 100 against a bet of 300 wins 200, not 400", () => {
    const t = table([seat(0, KINGS, 300), seat(1, ACES, 100, { allIn: true })]);
    expect(returnUncalledBet(t)).toBe(200);
    expect(t.pot).toBe(200);
    expect(t.seats[0]!.chips).toBe(200);
    expect([...settleShowdown(t)]).toEqual([[1, 200]]);
  });

  it("loses only what they put in", () => {
    const t = table([seat(0, ACES, 300), seat(1, KINGS, 100, { allIn: true })]);
    // The big stack gets its unmatched 200 back and wins the 200 in play.
    expect(play(t)).toEqual([400, 0]);
  });

  it("with three in, takes the main pot and leaves the rest to the two who bet it", () => {
    const t = table([
      seat(0, KINGS, 300),
      seat(1, ACES, 100, { allIn: true }),
      seat(2, NOTHING, 300),
    ]);
    expect(returnUncalledBet(t)).toBe(0);
    expect(buildSidePots(t)).toEqual([
      { amount: 300, eligible: [0, 1, 2] },
      { amount: 400, eligible: [0, 2] },
    ]);
    // Aces take the main pot; kings beat king-high for the side pot.
    expect(play(t)).toEqual([400, 300, 0]);
  });
});

describe("chips from a player who folded", () => {
  it("stay in the pots they reached, and can't be won back by them", () => {
    const t = table([
      seat(0, KINGS, 300),
      seat(1, ACES, 100, { allIn: true }),
      seat(2, ACES, 200, { folded: true }),
    ]);
    // 300 against a folded 200: the last 100 was never matched.
    expect(returnUncalledBet(t)).toBe(100);
    expect(buildSidePots(t)).toEqual([
      { amount: 300, eligible: [0, 1] },
      { amount: 200, eligible: [0] },
    ]);
    expect(play(t)).toEqual([100 + 200, 300, 0]);
  });

  it("above everyone still in go to the last pot", () => {
    // Broadway on the board: both live players play it and tie.
    const board = [c("A", "s"), c("K", "s"), c("Q", "d"), c("J", "c"), c("10", "h")];
    const t = table(
      [seat(0, NOTHING, 100), seat(1, KINGS, 100), seat(2, ACES, 101, { folded: true })],
      undefined,
      board,
    );
    expect(returnUncalledBet(t)).toBe(0); // the most was put in by someone who folded
    expect(buildSidePots(t)).toEqual([{ amount: 301, eligible: [0, 1] }]);
    // An even split, the odd chip to the first.
    expect(play(t)).toEqual([151, 150, 0]);
  });
});

describe("what can't be worked out is left as it was", () => {
  it("chips from a seat now empty go to the first pot, and no bet is handed back", () => {
    // Two put in 100 each; a third put in 250 and left the table.
    const t = table([seat(0, ACES, 100), seat(1, KINGS, 300), null], 650);
    expect(returnUncalledBet(t)).toBe(0);
    expect(buildSidePots(t)).toEqual([
      { amount: 200 + 250, eligible: [0, 1] },
      { amount: 200, eligible: [1] },
    ]);
    // Aces take the main pot with the empty seat's chips in it; the 200 only
    // one player put in comes back to them as a pot of their own.
    expect(play(t)).toEqual([450, 200, 0]);
  });

  it("a table that never counted what each player put in pays one pot to the best hand", () => {
    const t = table(
      [seat(0, KINGS, 0, { committed: undefined }), seat(1, ACES, 0, { committed: undefined })],
      400,
    );
    expect(returnUncalledBet(t)).toBe(0);
    expect(play(t)).toEqual([0, 400]);
  });
});

describe("every chip in the pot is paid out, and none made up", () => {
  it("whatever the stacks", () => {
    const hands = [ACES, KINGS, NOTHING, [c("9", "h"), c("9", "d")], [c("5", "s"), c("6", "s")]];
    for (const stakes of [
      [50, 50, 50],
      [10, 200, 200, 75],
      [300, 100, 300, 300, 20],
      [1, 2, 3, 4, 5],
      [500, 0, 500],
    ]) {
      const seats = stakes.map((put, i) =>
        seat(i, hands[i], put, { allIn: put < Math.max(...stakes), folded: put === 0 }),
      );
      const t = table(seats);
      const before = t.pot;
      const after = play(t);
      expect(
        after.reduce((a, b) => a + b, 0),
        stakes.join("/"),
      ).toBe(before);
      // Nobody ends with more than everyone else put in up to their own stake, plus their own.
      stakes.forEach((put, i) => {
        const most = stakes.reduce((n, other) => n + Math.min(other, put), 0);
        expect(after[i], `${stakes.join("/")} seat ${i}`).toBeLessThanOrEqual(most);
      });
    }
  });
});

describe("what each player has put in", () => {
  it("is counted as each round's bets are swept into the pot", () => {
    const t = table([seat(0, ACES, 0, { bet: 20 }), seat(1, KINGS, 0, { bet: 20 })], 0);
    collectBetsIntoPot(t);
    t.seats[0]!.bet = 80;
    t.seats[1]!.bet = 30;
    collectBetsIntoPot(t);
    expect(t.pot).toBe(150);
    expect(t.seats.map((s) => s!.committed)).toEqual([100, 50]);
    expect(t.seats.map((s) => s!.bet)).toEqual([0, 0]);
  });
});
