// Poker WS handlers extracted from the index.ts main message handler:
// poker:join/spectate/leave/start/action. The poker engine helpers + the
// pokerTables Map + the PokerTable types remain in index.ts (shared with the
// HTTP pokerRoutes); they are injected here BY REFERENCE -- pokerTables is the
// SAME live Map, and awardPaper is the real Paper-economy ledger fn (live money:
// buy-in deduction + the POKER_CASHOUT chip return, whose single-transaction
// guard is preserved verbatim). Void handler (dispatcher matches the poker:
// type-set + returns), so every bare return; -- the insufficient-balance /
// not-your-turn guards and the setTimeout auto-start -- is preserved verbatim.
type Opts = {
  getOrCreatePokerTable: (tableId: string) => any;
  broadcastPokerState: (tableId: string) => void;
  startPokerHand: (table: any) => void;
  buildPokerStateForUser: (table: any, userId?: string) => any;
  advancePokerGame: (table: any) => void;
  activePlayersInHand: (table: any) => any[];
  activeSeatCount: (table: any) => number;
  broadcastToPokerTable: (tableId: string, event: any) => void;
  awardPaper: (userId: string, type: string, amount: number, description: string, refId?: string) => Promise<{ balance: number } | null>;
  pokerTables: Map<string, any>;
  send: (ws: any, msg: any) => void;
};

export async function handlePoker(ws: any, msg: any, opts: Opts): Promise<void> {
  const { getOrCreatePokerTable, broadcastPokerState, startPokerHand, buildPokerStateForUser, advancePokerGame, activePlayersInHand, activeSeatCount, broadcastToPokerTable, awardPaper, pokerTables, send } = opts;

  if (msg.type === "poker:join") {
    const tableId = String(msg.tableId || "").trim();
    const buyin = Number(msg.buyin || 0);
    if (!ws.user || !tableId || !buyin) return;

    const table = getOrCreatePokerTable(tableId);

    if (buyin < table.minBuyin || buyin > table.maxBuyin) {
      send(ws, { type: "poker:error", error: `Buy-in must be between ${table.minBuyin} and ${table.maxBuyin} Paper` });
      return;
    }

    if (table.seats.some((s: any) => s && s.userId === ws.user!.id)) {
      send(ws, { type: "poker:error", error: "Already seated at this table" });
      return;
    }

    const emptySeatIndex = table.seats.findIndex((s: any) => s === null);
    if (emptySeatIndex === -1) {
      send(ws, { type: "poker:error", error: "Table is full" });
      return;
    }

    try {
      const res = await awardPaper(ws.user.id, "POKER_BUYIN", -buyin, `Poker buy-in at table ${tableId}`, tableId);
      if (!res) {
        send(ws, { type: "poker:error", error: "Insufficient Paper balance" });
        return;
      }
    } catch (e) {
      console.error("[poker:join] Paper deduction failed:", e);
      send(ws, { type: "poker:error", error: "Failed to process buy-in" });
      return;
    }

    table.seats[emptySeatIndex] = {
      userId: ws.user.id,
      name: ws.user.name,
      chips: buyin,
      cards: [],
      folded: false,
      allIn: false,
      bet: 0,
      seatIndex: emptySeatIndex,
    };

    table.spectators.delete(ws.user.id);

    console.log(`[poker] ${ws.user.name} joined table ${tableId} seat ${emptySeatIndex} with ${buyin} chips`);
    broadcastPokerState(tableId);

    const seatedCount = table.seats.filter((s: any) => s !== null).length;
    if (seatedCount >= 2 && table.phase === "waiting") {
      setTimeout(() => {
        const t = pokerTables.get(tableId);
        if (t && t.phase === "waiting" && t.seats.filter((s: any) => s !== null).length >= 2) {
          startPokerHand(t);
        }
      }, 2000);
    }
    return;
  }

  if (msg.type === "poker:spectate") {
    const tableId = String(msg.tableId || "").trim();
    if (!ws.user || !tableId) return;
    const table = getOrCreatePokerTable(tableId);
    if (!table.seats.some((s: any) => s && s.userId === ws.user!.id)) {
      table.spectators.add(ws.user.id);
    }
    send(ws, { type: "poker:state", ...buildPokerStateForUser(table, ws.user.id) });
    return;
  }

  if (msg.type === "poker:leave") {
    const tableId = String(msg.tableId || "").trim();
    if (!ws.user || !tableId) return;
    const table = pokerTables.get(tableId);
    if (!table) return;

    const seatIdx = table.seats.findIndex((s: any) => s && s.userId === ws.user!.id);
    if (seatIdx === -1) {
      table.spectators.delete(ws.user.id);
      return;
    }

    const seat = table.seats[seatIdx]!;

    if (table.handInProgress && seat.cards.length > 0 && !seat.folded) {
      seat.folded = true;
    }

    // Claim the seat SYNCHRONOUSLY before any await. The WS dispatcher runs a
    // detached async IIFE per message with no per-socket serialization, so two
    // near-simultaneous poker:leave frames would both pass the seat check, both
    // read seat.chips, and double-credit the cash-out (a paper-minting TOCTOU +
    // doubled POKER_CASHOUT ledger rows). Null the seat first so a concurrent
    // leave finds nothing, then credit via the atomic, guarded awardPaper.
    const chipsToReturn = seat.chips;
    const wasTheirTurn = table.turnIndex === seatIdx;
    table.seats[seatIdx] = null;

    if (chipsToReturn > 0) {
      await awardPaper(ws.user.id, "POKER_CASHOUT", chipsToReturn, `Left poker table ${tableId} with ${chipsToReturn} chips`, tableId);
    }

    console.log(`[poker] ${ws.user.name} left table ${tableId}`);

    send(ws, { type: "poker:state", ...buildPokerStateForUser(table, ws.user.id), youLeft: true });

    if (wasTheirTurn && table.handInProgress) {
      advancePokerGame(table);
    } else {
      broadcastPokerState(tableId);
    }

    if (table.handInProgress && activePlayersInHand(table).length <= 1) {
      advancePokerGame(table);
    }
    return;
  }

  if (msg.type === "poker:start") {
    const tableId = String(msg.tableId || "").trim();
    if (!ws.user || !tableId) return;
    const table = pokerTables.get(tableId);
    if (!table) { send(ws, { type: "poker:error", error: "Table not found" }); return; }

    if (!table.seats.some((s: any) => s && s.userId === ws.user!.id)) {
      send(ws, { type: "poker:error", error: "Not seated at this table" });
      return;
    }

    if (table.handInProgress) {
      send(ws, { type: "poker:error", error: "Hand already in progress" });
      return;
    }

    if (activeSeatCount(table) < 2) {
      send(ws, { type: "poker:error", error: "Need at least 2 players" });
      return;
    }

    startPokerHand(table);
    return;
  }

  if (msg.type === "poker:action") {
    const tableId = String(msg.tableId || "").trim();
    const action = String(msg.action || "").trim().toLowerCase();
    const amount = Number(msg.amount || 0);
    if (!ws.user || !tableId || !action) return;

    const table = pokerTables.get(tableId);
    if (!table || !table.handInProgress) {
      send(ws, { type: "poker:error", error: "No active hand" });
      return;
    }

    const seatIdx = table.seats.findIndex((s: any) => s && s.userId === ws.user!.id);
    if (seatIdx === -1) { send(ws, { type: "poker:error", error: "Not seated" }); return; }

    const seat = table.seats[seatIdx]!;

    if (table.turnIndex !== seatIdx) {
      send(ws, { type: "poker:error", error: "Not your turn" });
      return;
    }

    if (seat.folded || seat.allIn) {
      send(ws, { type: "poker:error", error: "Cannot act" });
      return;
    }

    const toCall = table.currentBet - seat.bet;

    let actionAmount: number | undefined;

    if (action === "fold") {
      seat.folded = true;
    } else if (action === "check") {
      if (toCall > 0) {
        send(ws, { type: "poker:error", error: "Cannot check — must call, raise, or fold" });
        return;
      }
    } else if (action === "call") {
      if (toCall <= 0) {
      } else {
        const callAmount = Math.min(toCall, seat.chips);
        seat.chips -= callAmount;
        seat.bet += callAmount;
        if (seat.chips === 0) seat.allIn = true;
        actionAmount = callAmount;
      }
    } else if (action === "raise") {
      if (amount <= 0) { send(ws, { type: "poker:error", error: "Raise amount required" }); return; }

      const totalBet = amount;
      const raiseAmount = totalBet - seat.bet;

      if (raiseAmount <= 0 || raiseAmount > seat.chips) {
        send(ws, { type: "poker:error", error: "Invalid raise amount" });
        return;
      }

      if (totalBet < table.currentBet * 2 && raiseAmount < seat.chips) {
        send(ws, { type: "poker:error", error: `Minimum raise is ${table.currentBet * 2}` });
        return;
      }

      seat.chips -= raiseAmount;
      seat.bet = totalBet;
      table.currentBet = totalBet;
      if (seat.chips === 0) seat.allIn = true;
      actionAmount = totalBet;
    } else if (action === "allin") {
      const allInAmount = seat.chips;
      seat.bet += allInAmount;
      seat.chips = 0;
      seat.allIn = true;
      if (seat.bet > table.currentBet) {
        table.currentBet = seat.bet;
      }
      actionAmount = allInAmount;
    } else {
      send(ws, { type: "poker:error", error: `Unknown action: ${action}` });
      return;
    }

    table.lastAction = { userId: seat.userId, action, amount: actionAmount };

    broadcastToPokerTable(table.tableId, {
      type: "poker:action-chip",
      tableId: table.tableId,
      userId: seat.userId,
      userName: seat.name,
      action,
      amount: actionAmount,
      time: Date.now(),
    });

    advancePokerGame(table);
    return;
  }
}
