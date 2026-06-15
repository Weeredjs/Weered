import { describe, it, expect } from "vitest";
import {
  evaluate5,
  evaluateHand,
  compareHands,
  createDeck,
  type Card,
} from "../../src/lib/pokerHands";

// Card builder: c("A","h"). Ranks match RANKS ("10" for ten, not "T").
const c = (rank: string, suit: string): Card => ({ rank, suit });

describe("pokerHands.evaluate5 — hand categories (rank 8=SF .. 0=high)", () => {
  const cases: [string, Card[], number][] = [
    ["royal flush", [c("10", "h"), c("J", "h"), c("Q", "h"), c("K", "h"), c("A", "h")], 8],
    ["straight flush", [c("5", "s"), c("6", "s"), c("7", "s"), c("8", "s"), c("9", "s")], 8],
    ["four of a kind", [c("A", "h"), c("A", "d"), c("A", "c"), c("A", "s"), c("K", "h")], 7],
    ["full house", [c("K", "h"), c("K", "d"), c("K", "c"), c("Q", "h"), c("Q", "s")], 6],
    ["flush", [c("A", "h"), c("J", "h"), c("8", "h"), c("5", "h"), c("2", "h")], 5],
    ["straight", [c("5", "s"), c("6", "h"), c("7", "d"), c("8", "c"), c("9", "s")], 4],
    ["three of a kind", [c("9", "h"), c("9", "d"), c("9", "c"), c("A", "h"), c("K", "s")], 3],
    ["two pair", [c("A", "h"), c("A", "d"), c("K", "c"), c("K", "h"), c("Q", "s")], 2],
    ["one pair", [c("A", "h"), c("A", "d"), c("K", "c"), c("Q", "h"), c("J", "s")], 1],
    ["high card", [c("A", "h"), c("J", "d"), c("8", "c"), c("5", "h"), c("2", "s")], 0],
  ];
  for (const [label, hand, rank] of cases) {
    it(`ranks ${label} as ${rank}`, () => {
      expect(evaluate5(hand).rank).toBe(rank);
    });
  }

  it("treats the ace-low wheel (A-2-3-4-5) as a straight", () => {
    const wheel = [c("A", "h"), c("2", "d"), c("3", "c"), c("4", "h"), c("5", "s")];
    expect(evaluate5(wheel).rank).toBe(4);
  });
});

describe("pokerHands.compareHands — ordering", () => {
  const fullHouse = evaluate5([c("K", "h"), c("K", "d"), c("K", "c"), c("Q", "h"), c("Q", "s")]);
  const flush = evaluate5([c("A", "h"), c("J", "h"), c("8", "h"), c("5", "h"), c("2", "h")]);
  const pairAces = evaluate5([c("A", "h"), c("A", "d"), c("K", "c"), c("Q", "h"), c("J", "s")]);
  const pairKings = evaluate5([c("K", "h"), c("K", "d"), c("A", "c"), c("Q", "h"), c("J", "s")]);

  it("higher category beats lower", () => {
    expect(compareHands(fullHouse, flush)).toBe(1);
    expect(compareHands(flush, fullHouse)).toBe(-1);
  });
  it("same category breaks on kicker", () => {
    expect(compareHands(pairAces, pairKings)).toBe(1);
  });
  it("identical hands tie", () => {
    expect(compareHands(pairAces, pairAces)).toBe(0);
  });
});

describe("pokerHands.evaluateHand — best 5 of 7", () => {
  it("finds the flush hidden in 7 cards", () => {
    const seven = [
      c("A", "h"),
      c("J", "h"),
      c("8", "h"),
      c("5", "h"),
      c("2", "h"), // flush
      c("K", "d"),
      c("Q", "s"),
    ];
    expect(evaluateHand(seven).rank).toBe(5);
  });
  it("finds quads from 2 hole + community", () => {
    const seven = [
      c("9", "h"),
      c("9", "d"), // hole
      c("9", "c"),
      c("9", "s"),
      c("A", "h"),
      c("K", "d"),
      c("Q", "s"),
    ];
    const r = evaluateHand(seven);
    expect(r.rank).toBe(7);
  });
});

describe("pokerHands.createDeck", () => {
  it("builds 52 unique cards", () => {
    const d = createDeck();
    expect(d).toHaveLength(52);
    expect(new Set(d.map((x) => x.rank + x.suit)).size).toBe(52);
  });
});
