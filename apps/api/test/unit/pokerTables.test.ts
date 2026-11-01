import { describe, it, expect } from "vitest";
import {
  pokerTables,
  getOrCreatePokerTable,
  pokerTableAllowed,
  sweepPokerTables,
  POKER_TABLE_MAX,
} from "../../src/lib/pokerTable";

// Poker tables can't be made for any id or kept forever (red team 2026-11-01, finding 15).
describe("poker tables", () => {
  it("take only ids that look like a room's", () => {
    expect(pokerTableAllowed("room-abc_1")).toBe(true);
    expect(pokerTableAllowed("x".repeat(65))).toBe(false);
    expect(pokerTableAllowed("../../etc")).toBe(false);
    expect(pokerTableAllowed("")).toBe(false);
  });

  it("stop at a ceiling, except for tables already there", () => {
    pokerTables.clear();
    for (let i = 0; i < POKER_TABLE_MAX; i++) getOrCreatePokerTable(`t${i}`);
    expect(pokerTableAllowed("one-more")).toBe(false);
    expect(pokerTableAllowed("t5")).toBe(true);
    pokerTables.clear();
  });

  it("sweep empty tables left idle", () => {
    pokerTables.clear();
    getOrCreatePokerTable("idle");
    const busy = getOrCreatePokerTable("busy");
    busy.seats[0] = { userId: "u" } as any;
    expect(sweepPokerTables(Date.now() + 31 * 60_000)).toBe(1);
    expect(pokerTables.has("idle")).toBe(false);
    expect(pokerTables.has("busy")).toBe(true);
    pokerTables.clear();
  });
});
