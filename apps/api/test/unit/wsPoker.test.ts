import { describe, it, expect } from "vitest";
import { handlePoker } from "../../src/sockets/poker";

// Regression guard for the poker:leave cash-out double-credit (ceb8ced): the
// seat must be nulled SYNCHRONOUSLY before the awardPaper await, so two
// near-simultaneous leave frames can never both read seat.chips and double-mint
// the POKER_CASHOUT. Driven through the extracted handler with a mock socket.

function mkTable() {
  return {
    seats: [
      { userId: "alice", chips: 500, cards: [], folded: false },
      null,
      null,
      null,
      null,
      null,
    ],
    spectators: new Set<string>(),
    handInProgress: false,
    turnIndex: -1,
  };
}
function mkOpts(tables: Map<string, any>, awarded: any[]) {
  return {
    getOrCreatePokerTable: (id: string) => tables.get(id),
    broadcastPokerState: () => {},
    startPokerHand: () => {},
    buildPokerStateForUser: () => ({}),
    advancePokerGame: () => {},
    activePlayersInHand: () => [],
    activeSeatCount: () => 0,
    broadcastToPokerTable: () => {},
    awardPaper: async (uid: string, type: string, amt: number) => {
      awarded.push({ uid, type, amt });
      return { balance: amt };
    },
    pokerTables: tables,
    send: () => {},
  } as any;
}
const ws = { user: { id: "alice", name: "Alice" } };

describe("ws handlePoker - poker:leave cash-out", () => {
  it("credits the chip stack exactly once and nulls the seat", async () => {
    const tables = new Map([["t1", mkTable()]]);
    const awarded: any[] = [];
    await handlePoker(ws, { type: "poker:leave", tableId: "t1" }, mkOpts(tables, awarded));
    expect(awarded).toEqual([{ uid: "alice", type: "POKER_CASHOUT", amt: 500 }]);
    expect(tables.get("t1").seats[0]).toBeNull();

    // a second leave finds no seat -> no second credit
    await handlePoker(ws, { type: "poker:leave", tableId: "t1" }, mkOpts(tables, awarded));
    expect(awarded.length).toBe(1);
  });

  it("two concurrent leave frames credit the cash-out only ONCE (no TOCTOU)", async () => {
    const tables = new Map([["t1", mkTable()]]);
    const awarded: any[] = [];
    const opts = mkOpts(tables, awarded);
    await Promise.all([
      handlePoker(ws, { type: "poker:leave", tableId: "t1" }, opts),
      handlePoker(ws, { type: "poker:leave", tableId: "t1" }, opts),
    ]);
    expect(awarded.length).toBe(1);
    expect(awarded[0].amt).toBe(500);
  });

  it("leaving with zero chips credits nothing", async () => {
    const t = mkTable();
    t.seats[0]!.chips = 0;
    const tables = new Map([["t1", t]]);
    const awarded: any[] = [];
    await handlePoker(ws, { type: "poker:leave", tableId: "t1" }, mkOpts(tables, awarded));
    expect(awarded.length).toBe(0);
    expect(tables.get("t1").seats[0]).toBeNull();
  });
});

// Found 2026-09-27: poker:join checked for an empty seat, awaited the buy-in,
// then filled the seat, so concurrent joins could overwrite each other's seat
// (a paid buy-in lost) or seat one user twice.
describe("ws handlePoker - poker:join concurrency", () => {
  function joinTable() {
    return {
      seats: [null, null, null],
      spectators: new Set<string>(),
      phase: "waiting",
      minBuyin: 100,
      maxBuyin: 1000,
    };
  }
  function slowOpts(tables: Map<string, any>, charged: string[]) {
    const opts = mkOpts(tables, []);
    opts.awardPaper = async (uid: string) => {
      charged.push(uid);
      await new Promise((r) => setTimeout(r, 20)); // the ledger write takes a moment
      return { balance: 0 };
    };
    return opts;
  }

  it("two players joining at once get different seats and both keep their buy-in", async () => {
    const tables = new Map([["t2", joinTable()]]);
    const charged: string[] = [];
    const opts = slowOpts(tables, charged);
    await Promise.all([
      handlePoker(
        { user: { id: "bob", name: "Bob" } },
        { type: "poker:join", tableId: "t2", buyin: 200 },
        opts,
      ),
      handlePoker(
        { user: { id: "cat", name: "Cat" } },
        { type: "poker:join", tableId: "t2", buyin: 300 },
        opts,
      ),
    ]);
    const seated = tables.get("t2").seats.filter(Boolean);
    expect(charged.sort()).toEqual(["bob", "cat"]);
    expect(seated.map((s: any) => s.userId).sort()).toEqual(["bob", "cat"]);
    expect(new Set(seated.map((s: any) => s.seatIndex)).size).toBe(2);
  });

  it("one player sending join twice at once is seated and charged once", async () => {
    const tables = new Map([["t3", joinTable()]]);
    const charged: string[] = [];
    const opts = slowOpts(tables, charged);
    const dan = { user: { id: "dan", name: "Dan" } };
    await Promise.all([
      handlePoker(dan, { type: "poker:join", tableId: "t3", buyin: 200 }, opts),
      handlePoker(dan, { type: "poker:join", tableId: "t3", buyin: 200 }, opts),
    ]);
    expect(charged).toEqual(["dan"]);
    expect(tables.get("t3").seats.filter(Boolean).length).toBe(1);
  });
});
