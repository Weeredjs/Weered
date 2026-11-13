import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FAKEOUT_DAILY_CAP, fakeoutOwed, payFakeoutProfit } from "../../src/lib/fakeoutPaper";
import { movePosition } from "../../src/routes/trading";

// Fan-out audit, 2026-11-13: FakeOut paid Paper on every winning close, losses
// and resets were free, and parallel orders closed one position many times.

type Tx = { userId: string; amount: number; refId: string; createdAt: Date };

function fakeDb(account: { userId: string; realizedPnl: number }, ledger: Tx[]) {
  return {
    paperAccount: {
      findUnique: async () => ({ ...account, competitionId: null }),
    },
    paperPosition: { findMany: async () => [] as Array<{ id: string }> },
    paperTransaction: {
      aggregate: async ({ where }: any) => {
        const rows = ledger.filter(
          (t) =>
            t.userId === where.userId &&
            (!where.refId || where.refId.in.includes(t.refId)) &&
            (!where.createdAt || t.createdAt >= where.createdAt.gte),
        );
        return { _sum: { amount: rows.length ? rows.reduce((s, t) => s + t.amount, 0) : null } };
      },
    },
  };
}

function award(ledger: Tx[]) {
  return async (userId: string, _t: string, amount: number, _d: string, refId?: string) => {
    await new Promise((r) => setTimeout(r, 5));
    ledger.push({ userId, amount, refId: refId || "", createdAt: new Date() });
    return { balance: 0 };
  };
}

describe("FakeOut Paper", () => {
  it("pays for profit in hundreds, less what was already paid", () => {
    expect(fakeoutOwed(250, 1, 0)).toBe(2);
    expect(fakeoutOwed(250, 1, 2)).toBe(0);
    expect(fakeoutOwed(1000, 10, 50)).toBe(50);
    expect(fakeoutOwed(99, 10, 0)).toBe(0); // a tiny win pays nothing
    expect(fakeoutOwed(-5000, 1, 0)).toBe(0);
    expect(fakeoutOwed(Number.NaN, 1, 0)).toBe(0);
  });

  it("does not pay twice when closes finish together", async () => {
    const ledger: Tx[] = [];
    const deps = {
      db: fakeDb({ userId: "u", realizedPnl: 500 }, ledger),
      awardPaper: award(ledger),
    };
    const paid = await Promise.all(
      Array.from({ length: 10 }, () => payFakeoutProfit(deps, "u", "acct", 1, "x")),
    );
    expect(paid.reduce((s, p) => s + p, 0)).toBe(5);
    expect(ledger.reduce((s, t) => s + t.amount, 0)).toBe(5);
  });

  it("pays a reset account again only past its old best", async () => {
    const ledger: Tx[] = [{ userId: "u", amount: 8, refId: "acct", createdAt: new Date(0) }];
    const deps = {
      db: fakeDb({ userId: "u", realizedPnl: 500 }, ledger),
      awardPaper: award(ledger),
    };
    expect(await payFakeoutProfit(deps, "u", "acct", 1, "x")).toBe(0);
  });

  it("stops at the daily cap", async () => {
    const ledger: Tx[] = [
      { userId: "u", amount: FAKEOUT_DAILY_CAP - 3, refId: "other", createdAt: new Date() },
    ];
    const deps = {
      db: fakeDb({ userId: "u", realizedPnl: 1_000_000 }, ledger),
      awardPaper: award(ledger),
    };
    expect(await payFakeoutProfit(deps, "u", "acct", 1, "x")).toBe(3);
    expect(await payFakeoutProfit(deps, "u", "acct", 1, "x")).toBe(0);
  });

  it("refuses a position that changed since it was read", async () => {
    const tx = { paperPosition: { updateMany: async () => ({ count: 0 }) } };
    await expect(movePosition(tx, { id: "p", quantity: 1 }, { status: "CLOSED" })).rejects.toThrow(
      "POSITION_MOVED",
    );
  });

  it("every position write in the trading routes is guarded", () => {
    const src = readFileSync(join(__dirname, "..", "..", "src", "routes", "trading.ts"), "utf8");
    // The only plain update left is the stop-loss / take-profit edit.
    expect(src.match(/paperPosition\.update\(/g)?.length ?? 0).toBe(1);
    expect(src).not.toMatch(/"EARN_FAKEOUT",\s*paperEarned/);
  });

  it("windrose bounty moves claim their state before money moves", () => {
    const src = readFileSync(join(__dirname, "..", "..", "src", "routes", "windrose.ts"), "utf8");
    expect(src).not.toMatch(/windroseBounty\.update\(/);
  });
});
