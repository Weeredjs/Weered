import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";

// /trading/* — FakeOut paper trading. REST layer only: candles proxy,
// symbol catalog, account + positions + market orders + close +
// leaderboard + history + reset + competitions. Plus two background
// workers: 60s competition status sweep (UPCOMING→ACTIVE→ENDED with
// prize payout), 5s limit/stop-order fill checker.
//
// Binance WebSocket bridge, the live-prices map, and the per-client
// trading:subscribe handler stay in main() — they're long-lived
// streaming infra hooked into the global wss.
type Opts = {
  authFromHeader: (h?: string) => { id: string; name: string } | null;
  awardPaper: (userId: string, type: string, amount: number, description: string, refId?: string) => Promise<{ balance: number } | null>;
  awardNotoriety: (userId: string, action: string) => Promise<number | null>;
  livePrices: Map<string, { price: number; time: number }>;
  broadcastToLobby: (lobbyId: string, event: any) => void;
  notifyUser: (userId: string, event: any) => void;
};

export default async function tradingRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, awardPaper, awardNotoriety, livePrices, broadcastToLobby, notifyUser } = opts;
  const BINANCE_REST = "https://api.binance.com";

  function getLivePrice(symbol: string): number | null {
    const p = livePrices.get(symbol.toLowerCase());
    return p ? p.price : null;
  }

// ── REST: Historical candles (proxy Binance) ──────────────────────────────
app.get("/trading/candles", async (req, reply) => {
  const q: any = (req as any).query || {};
  const symbol = String(q.symbol || "BTCUSDT").toUpperCase();
  const interval = String(q.interval || "1m");
  const limit = Math.min(parseInt(q.limit) || 200, 1000);

  try {
    const url = `${BINANCE_REST}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (!Array.isArray(data)) return reply.send({ ok: false, error: "binance_error" });

    const candles = data.map((c: any) => ({
      time: c[0] / 1000,
      open: parseFloat(c[1]),
      high: parseFloat(c[2]),
      low: parseFloat(c[3]),
      close: parseFloat(c[4]),
      volume: parseFloat(c[5]),
    }));
    return reply.send({ ok: true, candles });
  } catch (e) {
    console.error("[trading/candles]", e);
    return reply.send({ ok: false, error: "fetch_failed" });
  }
});

// ── REST: Available symbols ───────────────────────────────────────────────
const TRADING_SYMBOLS = [
  { symbol: "BTCUSDT", name: "Bitcoin", icon: "₿" },
  { symbol: "ETHUSDT", name: "Ethereum", icon: "Ξ" },
  { symbol: "SOLUSDT", name: "Solana", icon: "◎" },
  { symbol: "BNBUSDT", name: "BNB", icon: "⬡" },
  { symbol: "XRPUSDT", name: "XRP", icon: "✕" },
  { symbol: "DOGEUSDT", name: "Dogecoin", icon: "Ð" },
  { symbol: "ADAUSDT", name: "Cardano", icon: "₳" },
  { symbol: "AVAXUSDT", name: "Avalanche", icon: "🔺" },
  { symbol: "MATICUSDT", name: "Polygon", icon: "⬡" },
  { symbol: "LINKUSDT", name: "Chainlink", icon: "⬡" },
  { symbol: "DOTUSDT", name: "Polkadot", icon: "●" },
  { symbol: "LTCUSDT", name: "Litecoin", icon: "Ł" },
  { symbol: "NEARUSDT", name: "NEAR", icon: "Ⓝ" },
  { symbol: "APTUSDT", name: "Aptos", icon: "◈" },
  { symbol: "ARBUSDT", name: "Arbitrum", icon: "⬡" },
  { symbol: "OPUSDT", name: "Optimism", icon: "⭕" },
  { symbol: "SUIUSDT", name: "Sui", icon: "💧" },
  { symbol: "PEPEUSDT", name: "Pepe", icon: "🐸" },
  { symbol: "SHIBUSDT", name: "Shiba Inu", icon: "🐕" },
  { symbol: "TRUMPUSDT", name: "Trump", icon: "🇺🇸" },
];

app.get("/trading/symbols", async (_req, reply) => {
  // Attach live prices
  const out = TRADING_SYMBOLS.map(s => ({
    ...s,
    price: livePrices.get(s.symbol.toLowerCase())?.price || null,
  }));
  return reply.send({ ok: true, symbols: out });
});

// ── Paper Trading Engine ──────────────────────────────────────────────────

function getLivePrice(symbol: string): number | null {
  const p = livePrices.get(symbol.toLowerCase());
  return p ? p.price : null;
}

// GET /trading/account/:lobbyId — get or create paper account
app.get("/trading/account/:lobbyId", async (req, reply) => {
  const u = authFromHeader((req as any).headers?.authorization);
  if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
  const lobbyId = String((req as any).params?.lobbyId || "");

  let account = await (prisma as any).paperAccount.findFirst({
    where: { userId: u.id, lobbyId, competitionId: null },
    include: { positions: { where: { status: "OPEN" } }, orders: { where: { status: "PENDING" }, orderBy: { createdAt: "desc" }, take: 20 } },
  });

  if (!account) {
    account = await (prisma as any).paperAccount.create({
      data: { userId: u.id, lobbyId, cashBalance: 100000, startBalance: 100000, realizedPnl: 0 },
      include: { positions: { where: { status: "OPEN" } }, orders: { where: { status: "PENDING" } } },
    });
  }

  // Calculate unrealized P&L for open positions
  let unrealizedPnl = 0;
  const positionsWithPnl = account.positions.map((p: any) => {
    const currentPrice = getLivePrice(p.symbol);
    let pnl = 0;
    if (currentPrice) {
      pnl = p.side === "BUY"
        ? (currentPrice - p.entryPrice) * p.quantity
        : (p.entryPrice - currentPrice) * p.quantity;
    }
    unrealizedPnl += pnl;
    return { ...p, currentPrice, unrealizedPnl: pnl, openedAt: p.openedAt?.toISOString() };
  });

  const equity = account.cashBalance + unrealizedPnl;
  const totalPnl = equity - account.startBalance;
  const pnlPercent = account.startBalance > 0 ? (totalPnl / account.startBalance) * 100 : 0;

  return reply.send({
    ok: true,
    account: {
      id: account.id,
      cashBalance: account.cashBalance,
      startBalance: account.startBalance,
      equity,
      realizedPnl: account.realizedPnl,
      unrealizedPnl,
      totalPnl,
      pnlPercent,
      positions: positionsWithPnl,
      pendingOrders: account.orders.map((o: any) => ({ ...o, createdAt: o.createdAt?.toISOString() })),
      createdAt: account.createdAt?.toISOString(),
    },
  });
});

// POST /trading/order/:lobbyId — place an order
app.post("/trading/order/:lobbyId", async (req, reply) => {
  const u = authFromHeader((req as any).headers?.authorization);
  if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
  const lobbyId = String((req as any).params?.lobbyId || "");
  const body: any = (req as any).body || {};

  const symbol = String(body.symbol || "").toUpperCase();
  const side: string = String(body.side || "").toUpperCase();
  const orderType = String(body.orderType || "MARKET").toUpperCase();
  const quantity = parseFloat(body.quantity);
  const limitPrice = body.price ? parseFloat(body.price) : null;

  if (!symbol || !["BUY", "SELL"].includes(side)) {
    return reply.code(400).send({ ok: false, error: "invalid_params" });
  }
  if (!quantity || quantity <= 0) {
    return reply.code(400).send({ ok: false, error: "invalid_quantity" });
  }

  // Get or create account
  let account = await (prisma as any).paperAccount.findFirst({
    where: { userId: u.id, lobbyId, competitionId: null },
    include: { positions: { where: { status: "OPEN", symbol } } },
  });
  if (!account) {
    account = await (prisma as any).paperAccount.create({
      data: { userId: u.id, lobbyId, cashBalance: 100000, startBalance: 100000, realizedPnl: 0 },
      include: { positions: { where: { status: "OPEN", symbol } } },
    });
  }

  // Limit orders: store and return
  if (orderType === "LIMIT" || orderType === "STOP") {
    if (!limitPrice || limitPrice <= 0) {
      return reply.code(400).send({ ok: false, error: "limit_price_required" });
    }
    const order = await (prisma as any).paperOrder.create({
      data: { accountId: account.id, symbol, side, orderType, quantity, price: limitPrice, status: "PENDING" },
    });
    return reply.send({ ok: true, order: { ...order, createdAt: order.createdAt?.toISOString() } });
  }

  // Market orders: execute immediately
  const currentPrice = getLivePrice(symbol);
  if (!currentPrice) {
    return reply.code(400).send({ ok: false, error: "no_price_data", message: "No live price available for " + symbol });
  }

  const cost = currentPrice * quantity;

  if (side === "BUY") {
    // Check cash
    if (cost > account.cashBalance) {
      return reply.code(400).send({ ok: false, error: "insufficient_funds", available: account.cashBalance, required: cost });
    }

    // Check if we have an existing open position in same direction
    const existing = account.positions.find((p: any) => p.side === "BUY");
    if (existing) {
      // Average into existing position
      const newQty = existing.quantity + quantity;
      const newEntry = ((existing.entryPrice * existing.quantity) + (currentPrice * quantity)) / newQty;
      await (prisma as any).paperPosition.update({
        where: { id: existing.id },
        data: { quantity: newQty, entryPrice: newEntry, entryValue: newEntry * newQty },
      });
    } else {
      // Check if we have a SHORT — close it first
      const shortPos = account.positions.find((p: any) => p.side === "SELL");
      if (shortPos) {
        const pnl = (shortPos.entryPrice - currentPrice) * shortPos.quantity;
        await (prisma as any).paperPosition.update({
          where: { id: shortPos.id },
          data: { status: "CLOSED", exitPrice: currentPrice, realizedPnl: pnl, closedAt: new Date() },
        });
        await (prisma as any).paperAccount.update({
          where: { id: account.id },
          data: { cashBalance: { increment: shortPos.entryValue + pnl }, realizedPnl: { increment: pnl } },
        });
        if (pnl > 0) {
          const paperEarned = Math.max(1, Math.floor(pnl / 100));
          awardPaper(u.id, "EARN_FAKEOUT", paperEarned, `FakeOut short profit: $${pnl.toFixed(2)} on ${symbol}`, shortPos.id).catch(() => {});
          awardNotoriety(u.id, "FAKEOUT_PROFIT").catch(() => {});
        }
        // If buying more than closing, open new long with remainder
        const remaining = quantity - shortPos.quantity;
        if (remaining > 0) {
          const remainCost = currentPrice * remaining;
          await (prisma as any).paperPosition.create({
            data: { accountId: account.id, symbol, side: "BUY", quantity: remaining, entryPrice: currentPrice, entryValue: remainCost },
          });
          await (prisma as any).paperAccount.update({
            where: { id: account.id },
            data: { cashBalance: { decrement: remainCost } },
          });
        }
      } else {
        // New long position
        await (prisma as any).paperPosition.create({
          data: { accountId: account.id, symbol, side: "BUY", quantity, entryPrice: currentPrice, entryValue: cost },
        });
        await (prisma as any).paperAccount.update({
          where: { id: account.id },
          data: { cashBalance: { decrement: cost } },
        });
      }
    }

    if (!account.positions.find((p: any) => p.side === "SELL")) {
      // Only deduct if we didn't already handle above
      if (!account.positions.find((p: any) => p.side === "BUY") && !account.positions.find((p: any) => p.side === "SELL")) {
        // Already handled above
      }
    }
  } else {
    // SELL side
    // Check if we have a long position to close
    const longPos = account.positions.find((p: any) => p.side === "BUY");
    if (longPos) {
      if (quantity >= longPos.quantity) {
        // Close entire long position
        const pnl = (currentPrice - longPos.entryPrice) * longPos.quantity;
        await (prisma as any).paperPosition.update({
          where: { id: longPos.id },
          data: { status: "CLOSED", exitPrice: currentPrice, realizedPnl: pnl, closedAt: new Date() },
        });
        await (prisma as any).paperAccount.update({
          where: { id: account.id },
          data: { cashBalance: { increment: longPos.entryValue + pnl }, realizedPnl: { increment: pnl } },
        });
        if (pnl > 0) {
          const paperEarned = Math.max(1, Math.floor(pnl / 100));
          awardPaper(u.id, "EARN_FAKEOUT", paperEarned, `FakeOut long profit: $${pnl.toFixed(2)} on ${symbol}`, longPos.id).catch(() => {});
          awardNotoriety(u.id, "FAKEOUT_PROFIT").catch(() => {});
        }
        // If selling more than closing, open short with remainder
        const remaining = quantity - longPos.quantity;
        if (remaining > 0) {
          const remainValue = currentPrice * remaining;
          await (prisma as any).paperPosition.create({
            data: { accountId: account.id, symbol, side: "SELL", quantity: remaining, entryPrice: currentPrice, entryValue: remainValue },
          });
          await (prisma as any).paperAccount.update({
            where: { id: account.id },
            data: { cashBalance: { decrement: remainValue } },
          });
        }
      } else {
        // Partial close
        const pnl = (currentPrice - longPos.entryPrice) * quantity;
        const newQty = longPos.quantity - quantity;
        await (prisma as any).paperPosition.update({
          where: { id: longPos.id },
          data: { quantity: newQty, entryValue: longPos.entryPrice * newQty },
        });
        await (prisma as any).paperAccount.update({
          where: { id: account.id },
          data: { cashBalance: { increment: (longPos.entryPrice * quantity) + pnl }, realizedPnl: { increment: pnl } },
        });
        if (pnl > 0) {
          const paperEarned = Math.max(1, Math.floor(pnl / 100));
          awardPaper(u.id, "EARN_FAKEOUT", paperEarned, `FakeOut partial profit: $${pnl.toFixed(2)} on ${symbol}`, longPos.id).catch(() => {});
          awardNotoriety(u.id, "FAKEOUT_PROFIT").catch(() => {});
        }
      }
    } else {
      // Open short position (or add to existing short)
      const existingShort = account.positions.find((p: any) => p.side === "SELL");
      if (existingShort) {
        const newQty = existingShort.quantity + quantity;
        const newEntry = ((existingShort.entryPrice * existingShort.quantity) + (currentPrice * quantity)) / newQty;
        await (prisma as any).paperPosition.update({
          where: { id: existingShort.id },
          data: { quantity: newQty, entryPrice: newEntry, entryValue: newEntry * newQty },
        });
      } else {
        await (prisma as any).paperPosition.create({
          data: { accountId: account.id, symbol, side: "SELL", quantity, entryPrice: currentPrice, entryValue: cost },
        });
      }
      await (prisma as any).paperAccount.update({
        where: { id: account.id },
        data: { cashBalance: { decrement: cost } },
      });
    }
  }

  // Record the filled order
  await (prisma as any).paperOrder.create({
    data: { accountId: account.id, symbol, side, orderType: "MARKET", quantity, filledPrice: currentPrice, filledAt: new Date(), status: "FILLED" },
  });

  // Award Notoriety for trading
  awardNotoriety(u.id, "FIRST_FAKEOUT_TRADE").catch(() => {});
  awardNotoriety(u.id, "FAKEOUT_TRADE").catch(() => {});

  // Broadcast trade to lobby room (everyone sees trades)
  const tradeEvent = { type: "trading:trade", userId: u.id, userName: u.name, symbol, side, quantity, price: currentPrice, time: Date.now() };
  for (const sock of wss.clients) {
    const s = sock as Sock;
    if (s.roomId === `lobby:${lobbyId}` || s.roomId === lobbyId) {
      try { send(s, tradeEvent); } catch {}
    }
  }

  return reply.send({ ok: true, filled: { symbol, side, quantity, price: currentPrice } });
});

// POST /trading/close/:lobbyId/:positionId — close a specific position
app.post("/trading/close/:lobbyId/:positionId", async (req, reply) => {
  const u = authFromHeader((req as any).headers?.authorization);
  if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
  const positionId = String((req as any).params?.positionId || "");

  const pos = await (prisma as any).paperPosition.findUnique({
    where: { id: positionId },
    include: { account: true },
  });
  if (!pos || pos.account.userId !== u.id) return reply.code(404).send({ ok: false, error: "not_found" });
  if (pos.status !== "OPEN") return reply.code(400).send({ ok: false, error: "already_closed" });

  const currentPrice = getLivePrice(pos.symbol);
  if (!currentPrice) return reply.code(400).send({ ok: false, error: "no_price_data" });

  const pnl = pos.side === "BUY"
    ? (currentPrice - pos.entryPrice) * pos.quantity
    : (pos.entryPrice - currentPrice) * pos.quantity;

  await (prisma as any).paperPosition.update({
    where: { id: positionId },
    data: { status: "CLOSED", exitPrice: currentPrice, realizedPnl: pnl, closedAt: new Date() },
  });
  await (prisma as any).paperAccount.update({
    where: { id: pos.accountId },
    data: { cashBalance: { increment: pos.entryValue + pnl }, realizedPnl: { increment: pnl } },
  });

  // Award Paper for profitable trades (1 Paper per $100 profit, min 1 if profitable)
  if (pnl > 0) {
    const paperEarned = Math.max(1, Math.floor(pnl / 100));
    awardPaper(u.id, "EARN_FAKEOUT", paperEarned, `FakeOut profit: $${pnl.toFixed(2)} on ${pos.symbol}`, positionId).catch(() => {});
    awardNotoriety(u.id, "FAKEOUT_PROFIT").catch(() => {});
  }

  return reply.send({ ok: true, pnl, exitPrice: currentPrice });
});

// GET /trading/leaderboard/:lobbyId — ranked by total P&L
app.get("/trading/leaderboard/:lobbyId", async (req, reply) => {
  const lobbyId = String((req as any).params?.lobbyId || "");

  const accounts = await (prisma as any).paperAccount.findMany({
    where: { lobbyId, competitionId: null },
    include: { positions: { where: { status: "OPEN" } } },
  });

  const userIds = accounts.map((a: any) => a.userId);
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, avatarColor: true, avatar: true } })
    : [];
  const userMap = new Map(users.map(u => [u.id, u]));

  const leaderboard = accounts.map((a: any) => {
    let unrealizedPnl = 0;
    for (const p of a.positions) {
      const cp = getLivePrice(p.symbol);
      if (cp) {
        unrealizedPnl += p.side === "BUY"
          ? (cp - p.entryPrice) * p.quantity
          : (p.entryPrice - cp) * p.quantity;
      }
    }
    const equity = a.cashBalance + unrealizedPnl;
    const totalPnl = equity - a.startBalance;
    const pnlPercent = a.startBalance > 0 ? (totalPnl / a.startBalance) * 100 : 0;
    const user = userMap.get(a.userId);

    return {
      userId: a.userId,
      userName: user?.name || "Unknown",
      avatarColor: user?.avatarColor || null,
      avatar: user?.avatar || null,
      equity,
      totalPnl,
      pnlPercent,
      realizedPnl: a.realizedPnl,
      unrealizedPnl,
      openPositions: a.positions.length,
    };
  });

  leaderboard.sort((a: any, b: any) => b.totalPnl - a.totalPnl);

  return reply.send({ ok: true, leaderboard });
});

// GET /trading/history/:lobbyId — order history
app.get("/trading/history/:lobbyId", async (req, reply) => {
  const u = authFromHeader((req as any).headers?.authorization);
  if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
  const lobbyId = String((req as any).params?.lobbyId || "");

  const account = await (prisma as any).paperAccount.findFirst({
    where: { userId: u.id, lobbyId, competitionId: null },
  });
  if (!account) return reply.send({ ok: true, orders: [], closedPositions: [] });

  const orders = await (prisma as any).paperOrder.findMany({
    where: { accountId: account.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const closedPositions = await (prisma as any).paperPosition.findMany({
    where: { accountId: account.id, status: "CLOSED" },
    orderBy: { closedAt: "desc" },
    take: 50,
  });

  return reply.send({
    ok: true,
    orders: orders.map((o: any) => ({ ...o, createdAt: o.createdAt?.toISOString(), filledAt: o.filledAt?.toISOString() })),
    closedPositions: closedPositions.map((p: any) => ({ ...p, openedAt: p.openedAt?.toISOString(), closedAt: p.closedAt?.toISOString() })),
  });
});

// POST /trading/reset/:lobbyId — reset account (start fresh)
app.post("/trading/reset/:lobbyId", async (req, reply) => {
  const u = authFromHeader((req as any).headers?.authorization);
  if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
  const lobbyId = String((req as any).params?.lobbyId || "");

  const account = await (prisma as any).paperAccount.findFirst({
    where: { userId: u.id, lobbyId, competitionId: null },
  });
  if (!account) return reply.send({ ok: true });

  // Delete all positions and orders, reset balance
  await (prisma as any).paperPosition.deleteMany({ where: { accountId: account.id } });
  await (prisma as any).paperOrder.deleteMany({ where: { accountId: account.id } });
  await (prisma as any).paperAccount.update({
    where: { id: account.id },
    data: { cashBalance: 100000, startBalance: 100000, realizedPnl: 0 },
  });

  return reply.send({ ok: true });
});

// ── Trading Competition endpoints ─────────────────────────────────────────

// POST /trading/competition/:lobbyId — create competition
app.post("/trading/competition/:lobbyId", async (req, reply) => {
  const u = authFromHeader((req as any).headers?.authorization);
  if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
  const lobbyId = String((req as any).params?.lobbyId || "");
  const body: any = (req as any).body || {};

  const comp = await (prisma as any).tradingCompetition.create({
    data: {
      lobbyId,
      name: String(body.name || "Trading Competition").slice(0, 100),
      description: String(body.description || "").slice(0, 500),
      startBalance: parseFloat(body.startBalance) || 100000,
      startTime: new Date(body.startTime || Date.now()),
      endTime: new Date(body.endTime),
      status: new Date(body.startTime || Date.now()) <= new Date() ? "ACTIVE" : "UPCOMING",
      createdById: u.id,
    },
  });

  return reply.send({ ok: true, competition: { ...comp, startTime: comp.startTime.toISOString(), endTime: comp.endTime.toISOString(), createdAt: comp.createdAt.toISOString() } });
});

// GET /trading/competitions/:lobbyId — list competitions
app.get("/trading/competitions/:lobbyId", async (req, reply) => {
  const lobbyId = String((req as any).params?.lobbyId || "");

  const comps = await (prisma as any).tradingCompetition.findMany({
    where: { lobbyId },
    orderBy: { startTime: "desc" },
    take: 20,
  });

  return reply.send({
    ok: true,
    competitions: comps.map((c: any) => ({
      ...c,
      startTime: c.startTime?.toISOString(),
      endTime: c.endTime?.toISOString(),
      createdAt: c.createdAt?.toISOString(),
    })),
  });
});

// POST /trading/competition/:compId/join — join a competition
app.post("/trading/competition/:compId/join", async (req, reply) => {
  const u = authFromHeader((req as any).headers?.authorization);
  if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
  const compId = String((req as any).params?.compId || "");

  const comp = await (prisma as any).tradingCompetition.findUnique({ where: { id: compId } });
  if (!comp) return reply.code(404).send({ ok: false, error: "not_found" });
  if (comp.status === "ENDED") return reply.code(400).send({ ok: false, error: "competition_ended" });

  // Check if already enrolled
  const existing = await (prisma as any).paperAccount.findFirst({
    where: { userId: u.id, lobbyId: comp.lobbyId, competitionId: compId },
  });
  if (existing) return reply.send({ ok: true, accountId: existing.id, message: "already_enrolled" });

  const account = await (prisma as any).paperAccount.create({
    data: { userId: u.id, lobbyId: comp.lobbyId, competitionId: compId, cashBalance: comp.startBalance, startBalance: comp.startBalance, realizedPnl: 0 },
  });

  return reply.send({ ok: true, accountId: account.id });
});

// GET /trading/competition/:compId/leaderboard — competition leaderboard
app.get("/trading/competition/:compId/leaderboard", async (req, reply) => {
  const compId = String((req as any).params?.compId || "");

  const accounts = await (prisma as any).paperAccount.findMany({
    where: { competitionId: compId },
    include: { positions: { where: { status: "OPEN" } } },
  });

  const userIds = accounts.map((a: any) => a.userId);
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, avatarColor: true, avatar: true } })
    : [];
  const userMap = new Map(users.map(u => [u.id, u]));

  const leaderboard = accounts.map((a: any) => {
    let unrealizedPnl = 0;
    for (const p of a.positions) {
      const cp = getLivePrice(p.symbol);
      if (cp) {
        unrealizedPnl += p.side === "BUY"
          ? (cp - p.entryPrice) * p.quantity
          : (p.entryPrice - cp) * p.quantity;
      }
    }
    const equity = a.cashBalance + unrealizedPnl;
    const totalPnl = equity - a.startBalance;
    const pnlPercent = a.startBalance > 0 ? (totalPnl / a.startBalance) * 100 : 0;
    const user = userMap.get(a.userId);
    return { userId: a.userId, userName: user?.name || "Unknown", avatarColor: user?.avatarColor || null, avatar: user?.avatar || null, equity, totalPnl, pnlPercent, openPositions: a.positions.length };
  });

  leaderboard.sort((a: any, b: any) => b.totalPnl - a.totalPnl);
  return reply.send({ ok: true, leaderboard });
});

// ── Competition status worker (activate/end competitions) ─────────────────
setInterval(async () => {
  try {
    const now = new Date();
    // Activate upcoming competitions
    await (prisma as any).tradingCompetition.updateMany({
      where: { status: "UPCOMING", startTime: { lte: now } },
      data: { status: "ACTIVE" },
    });
    // End expired competitions and award Paper to winners
    const ending = await (prisma as any).tradingCompetition.findMany({
      where: { status: "ACTIVE", endTime: { lte: now } },
    });
    for (const comp of ending) {
      await (prisma as any).tradingCompetition.update({ where: { id: comp.id }, data: { status: "ENDED" } });
      // Calculate final standings and award Paper
      const accounts = await (prisma as any).paperAccount.findMany({
        where: { competitionId: comp.id },
        include: { positions: { where: { status: "OPEN" } } },
      });
      const ranked = accounts.map((a: any) => {
        let unrealizedPnl = 0;
        for (const p of a.positions) {
          const cp = getLivePrice(p.symbol);
          if (cp) unrealizedPnl += p.side === "BUY" ? (cp - p.entryPrice) * p.quantity : (p.entryPrice - cp) * p.quantity;
        }
        return { userId: a.userId, totalPnl: (a.cashBalance + unrealizedPnl) - a.startBalance };
      }).sort((a: any, b: any) => b.totalPnl - a.totalPnl);
      const prizes = [500, 250, 100]; // 1st, 2nd, 3rd
      for (let i = 0; i < Math.min(3, ranked.length); i++) {
        if (ranked[i].totalPnl > 0) {
          awardPaper(ranked[i].userId, "EARN_COMPETITION", prizes[i], `${i === 0 ? "1st" : i === 1 ? "2nd" : "3rd"} place: ${comp.name}`, comp.id).catch(() => {});
        }
      }
      console.log(`[trading] Competition "${comp.name}" ended — ${ranked.length} participants`);
    }
  } catch (e) { console.error("[trading] competition worker error:", e); }
}, 60 * 1000); // check every minute

// ── Limit order fill checker ──────────────────────────────────────────────
setInterval(async () => {
  try {
    const pending = await (prisma as any).paperOrder.findMany({
      where: { status: "PENDING" },
      include: { account: { include: { positions: { where: { status: "OPEN" } } } } },
    });
    for (const order of pending) {
      const cp = getLivePrice(order.symbol);
      if (!cp) continue;

      let shouldFill = false;
      if (order.orderType === "LIMIT") {
        if (order.side === "BUY" && cp <= order.price) shouldFill = true;
        if (order.side === "SELL" && cp >= order.price) shouldFill = true;
      } else if (order.orderType === "STOP") {
        if (order.side === "BUY" && cp >= order.price) shouldFill = true;
        if (order.side === "SELL" && cp <= order.price) shouldFill = true;
      }

      if (shouldFill) {
        // Execute the fill at the limit price
        const fillPrice = order.price;
        const cost = fillPrice * order.quantity;

        if (order.side === "BUY" && cost > order.account.cashBalance) continue; // insufficient funds

        await (prisma as any).paperOrder.update({
          where: { id: order.id },
          data: { status: "FILLED", filledPrice: fillPrice, filledAt: new Date() },
        });

        if (order.side === "BUY") {
          await (prisma as any).paperPosition.create({
            data: { accountId: order.accountId, symbol: order.symbol, side: "BUY", quantity: order.quantity, entryPrice: fillPrice, entryValue: cost },
          });
          await (prisma as any).paperAccount.update({
            where: { id: order.accountId },
            data: { cashBalance: { decrement: cost } },
          });
        } else {
          await (prisma as any).paperPosition.create({
            data: { accountId: order.accountId, symbol: order.symbol, side: "SELL", quantity: order.quantity, entryPrice: fillPrice, entryValue: cost },
          });
          await (prisma as any).paperAccount.update({
            where: { id: order.accountId },
            data: { cashBalance: { decrement: cost } },
          });
        }

        // Notify user via WS
        notifyUser(order.account.userId, { type: "trading:order_filled", orderId: order.id, symbol: order.symbol, side: order.side, quantity: order.quantity, price: fillPrice });
      }
    }
  } catch (e) { console.error("[trading] limit fill check error:", e); }
}, 5000); // check every 5 seconds
}
