import type { FastifyInstance } from "fastify";

// Poker HTTP routes (extracted from index.ts): table state view + cash-out.
// LIVE MONEY. The poker engine (pokerTables Map + buildPokerStateForUser +
// broadcastPokerState) and the poker WS message handlers stay in index.ts;
// they are injected here BY REFERENCE so the routes act on the same live table
// state the WS handlers mutate. awardPaper is the shared race-safe credit fn.
// The cash-out double-credit guard (clear the seat + broadcast BEFORE awarding)
// is preserved verbatim.
type Opts = {
  authFromHeader: (h?: string) => { id: string; name?: string } | null;
  pokerTables: Map<string, any>;
  buildPokerStateForUser: (table: any, userId?: string) => any;
  broadcastPokerState: (tableId: string) => void;
  awardPaper: (userId: string, type: string, amount: number, description: string, refId?: string) => Promise<{ balance: number } | null>;
};

export default async function pokerRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, pokerTables, buildPokerStateForUser, broadcastPokerState, awardPaper } = opts;

  app.get("/poker/:tableId", async (req, reply) => {
    const tableId = String((req as any).params?.tableId || "").trim();
    if (!tableId) return reply.code(400).send({ ok: false, error: "missing tableId" });

    const table = pokerTables.get(tableId);
    if (!table) return reply.send({ ok: true, table: null, message: "No active table" });

    const u = authFromHeader((req as any).headers?.authorization);
    return reply.send({ ok: true, table: buildPokerStateForUser(table, u?.id) });
  });

  app.post("/poker/:tableId/cashout", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });

    const tableId = String((req as any).params?.tableId || "").trim();
    if (!tableId) return reply.code(400).send({ ok: false, error: "missing tableId" });

    const table = pokerTables.get(tableId);
    if (!table) return reply.code(404).send({ ok: false, error: "Table not found" });

    const seatIdx = table.seats.findIndex((s: any) => s && s.userId === u.id);
    if (seatIdx === -1) return reply.code(400).send({ ok: false, error: "Not seated at this table" });

    const seat = table.seats[seatIdx]!;

    if (table.handInProgress && !seat.folded) {
      return reply.code(400).send({ ok: false, error: "Cannot cash out during an active hand. Fold first or wait for the hand to end." });
    }

    const chips = seat.chips;
    if (chips <= 0) {
      table.seats[seatIdx] = null;
      broadcastPokerState(tableId);
      return reply.send({ ok: true, cashed: 0, balance: 0 });
    }

    // Clear the seat synchronously BEFORE awarding so a concurrent cashout
    // cannot double-credit the same chips.
    table.seats[seatIdx] = null;
    broadcastPokerState(tableId);
    try {
      const res = await awardPaper(u.id, "POKER_CASHOUT", chips, `Cashed out ${chips} chips from poker table ${tableId}`, tableId);
      if (!res) return reply.code(500).send({ ok: false, error: "Cashout failed" });
      return reply.send({ ok: true, cashed: chips, balance: res.balance });
    } catch (e) {
      console.error("[poker:cashout] Error:", e);
      return reply.code(500).send({ ok: false, error: "Cashout failed" });
    }
  });
}
