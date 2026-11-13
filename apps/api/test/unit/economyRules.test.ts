import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  TURN_LIMIT_MS,
  pokerTables,
  sweepStalledTurns,
  takeAllStacks,
  type PokerTable,
} from "../../src/lib/pokerTable";

// Fan-out audit, 2026-11-13: Paper that vanished, Paper that never paid, and a
// poker hand anyone could freeze.

const SRC = join(__dirname, "..", "..", "src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".ts") ? [p] : [];
  });
}

describe("Paper types", () => {
  it("every type handed to awardPaper is one the database knows", () => {
    const schema = readFileSync(join(__dirname, "..", "..", "prisma", "schema.prisma"), "utf8");
    const block = schema.match(/enum PaperTxType \{([\s\S]*?)\}/)![1];
    const known = new Set(
      block
        .split("\n")
        .map((l) => l.trim().split(/\s/)[0])
        .filter(Boolean),
    );
    const bad: string[] = [];
    for (const f of walk(SRC)) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/awardPaper\(\s*[^,]+,\s*"([A-Z_]+)"/g))
        if (!known.has(m[1])) bad.push(`${f.slice(SRC.length)}: ${m[1]}`);
    }
    expect(bad).toEqual([]);
  });
});

function table(over: Partial<PokerTable> = {}): PokerTable {
  return {
    tableId: "t-test",
    seats: [],
    spectators: new Set(),
    communityCards: [],
    deck: [],
    pot: 0,
    sidePots: [],
    currentBet: 0,
    dealerIndex: 0,
    turnIndex: 0,
    phase: "flop",
    blinds: { small: 5, big: 10 },
    minBuyin: 100,
    maxBuyin: 1000,
    lastShowdownResult: null,
    lastAction: null,
    handInProgress: true,
    autoStartTimer: null,
    ...over,
  } as PokerTable;
}

const seat = (userId: string, i: number, over: Record<string, unknown> = {}) => ({
  userId,
  name: userId,
  chips: 100,
  cards: [],
  folded: false,
  allIn: false,
  bet: 0,
  seatIndex: i,
  committed: 0,
  ...over,
});

describe("poker", () => {
  it("a restart hands every stack back, with what was in the hand", () => {
    pokerTables.clear();
    const t = table({
      pot: 60,
      seats: [seat("a", 0, { chips: 90, bet: 10, committed: 30 }), seat("b", 1, { committed: 30 })],
    });
    pokerTables.set(t.tableId, t);
    const back = takeAllStacks();
    expect(back).toEqual([
      { userId: "a", tableId: "t-test", amount: 130 },
      { userId: "b", tableId: "t-test", amount: 130 },
    ]);
    expect(t.seats.every((s) => s === null)).toBe(true);
    expect(takeAllStacks()).toEqual([]); // nothing twice
    pokerTables.clear();
  });

  it("a turn left too long is taken: fold when owing", () => {
    pokerTables.clear();
    const t = table({
      currentBet: 20,
      seats: [seat("a", 0, { bet: 0 }), seat("b", 1, { bet: 20 })],
    });
    pokerTables.set(t.tableId, t);
    const start = 1_000_000;
    expect(sweepStalledTurns(start)).toBe(0);
    expect(sweepStalledTurns(start + TURN_LIMIT_MS - 1)).toBe(0);
    expect(sweepStalledTurns(start + TURN_LIMIT_MS + 1)).toBe(1);
    expect(t.lastAction).toMatchObject({ userId: "a", action: "fold" });
    pokerTables.clear();
  });
});
