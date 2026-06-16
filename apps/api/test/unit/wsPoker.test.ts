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
