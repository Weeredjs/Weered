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
  operatorCommentateOnTrade?: (lobbyId: string, context: string) => Promise<void>;
};

export default async function tradingRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, awardPaper, awardNotoriety, livePrices, broadcastToLobby, notifyUser, operatorCommentateOnTrade } = opts;
  const BINANCE_REST = "https://api.binance.com";

  function getLivePrice(symbol: string): number | null {
    const p = livePrices.get(symbol.toLowerCase());
    return p ? p.price : null;
  }

  // ── Paper Account modes ─────────────────────────────────────────────────
  // CASUAL: $100K start, low Paper conversion, no Notoriety. For-fun.
  // RANKED: $1K start, 10× Paper conversion, counts toward Notoriety XP.
  // Mode comes from the query (?mode=RANKED|CASUAL) and defaults to CASUAL
  // for backward-compat with existing accounts (which all have mode=CASUAL
  // post-migration).
  type PaperMode = "CASUAL" | "RANKED";
  function parseMode(req: any): PaperMode {
    const m = String(req?.query?.mode || (req?.body as any)?.mode || "CASUAL").toUpperCase();
    return m === "RANKED" ? "RANKED" : "CASUAL";
  }
  function startBalanceFor(mode: PaperMode): number {
    return mode === "RANKED" ? 1000 : 100000;
  }
  // Paper-per-$100-of-profit multiplier. Ranked is 10× to make $1K
  // accounts produce comparable rewards to $100K accounts at the same
  // % return — but the leaderboard separates them.
  function paperRateMultiplierFor(mode: PaperMode): number {
    return mode === "RANKED" ? 10 : 1;
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
// Crypto pairs are wired through Binance WS. FX + metals are flagged
// `comingSoon` so the picker can show them as direction-of-travel without
// letting users open paper orders against feeds we haven't bridged yet.
const TRADING_SYMBOLS: { symbol: string; name: string; icon: string; assetClass?: "crypto" | "fx" | "metal"; comingSoon?: boolean }[] = [
  { symbol: "BTCUSDT", name: "Bitcoin", icon: "₿", assetClass: "crypto" },
  { symbol: "ETHUSDT", name: "Ethereum", icon: "Ξ", assetClass: "crypto" },
  { symbol: "SOLUSDT", name: "Solana", icon: "◎", assetClass: "crypto" },
  { symbol: "BNBUSDT", name: "BNB", icon: "⬡", assetClass: "crypto" },
  { symbol: "XRPUSDT", name: "XRP", icon: "✕", assetClass: "crypto" },
  { symbol: "DOGEUSDT", name: "Dogecoin", icon: "Ð", assetClass: "crypto" },
  { symbol: "ADAUSDT", name: "Cardano", icon: "₳", assetClass: "crypto" },
  { symbol: "AVAXUSDT", name: "Avalanche", icon: "🔺", assetClass: "crypto" },
  { symbol: "MATICUSDT", name: "Polygon", icon: "⬡", assetClass: "crypto" },
  { symbol: "LINKUSDT", name: "Chainlink", icon: "⬡", assetClass: "crypto" },
  { symbol: "DOTUSDT", name: "Polkadot", icon: "●", assetClass: "crypto" },
  { symbol: "LTCUSDT", name: "Litecoin", icon: "Ł", assetClass: "crypto" },
  { symbol: "NEARUSDT", name: "NEAR", icon: "Ⓝ", assetClass: "crypto" },
  { symbol: "APTUSDT", name: "Aptos", icon: "◈", assetClass: "crypto" },
  { symbol: "ARBUSDT", name: "Arbitrum", icon: "⬡", assetClass: "crypto" },
  { symbol: "OPUSDT", name: "Optimism", icon: "⭕", assetClass: "crypto" },
  { symbol: "SUIUSDT", name: "Sui", icon: "💧", assetClass: "crypto" },
  { symbol: "PEPEUSDT", name: "Pepe", icon: "🐸", assetClass: "crypto" },
  { symbol: "SHIBUSDT", name: "Shiba Inu", icon: "🐕", assetClass: "crypto" },
  { symbol: "TRUMPUSDT", name: "Trump", icon: "🇺🇸", assetClass: "crypto" },

  // FX majors — feed wiring in progress (twelvedata mid-rate poll).
  { symbol: "EURUSD", name: "EUR/USD", icon: "€", assetClass: "fx", comingSoon: true },
  { symbol: "GBPUSD", name: "GBP/USD", icon: "£", assetClass: "fx", comingSoon: true },
  { symbol: "USDJPY", name: "USD/JPY", icon: "¥", assetClass: "fx", comingSoon: true },
  { symbol: "USDCAD", name: "USD/CAD", icon: "C$", assetClass: "fx", comingSoon: true },
  { symbol: "AUDUSD", name: "AUD/USD", icon: "A$", assetClass: "fx", comingSoon: true },
  { symbol: "EURJPY", name: "EUR/JPY", icon: "€¥", assetClass: "fx", comingSoon: true },
  { symbol: "EURGBP", name: "EUR/GBP", icon: "€£", assetClass: "fx", comingSoon: true },
  { symbol: "XAUUSD", name: "Gold", icon: "Au", assetClass: "metal", comingSoon: true },
];

app.get("/trading/symbols", async (_req, reply) => {
  // Attach live prices
  const out = TRADING_SYMBOLS.map(s => ({
    ...s,
    price: s.comingSoon ? null : (livePrices.get(s.symbol.toLowerCase())?.price || null),
  }));
  return reply.send({ ok: true, symbols: out });
});

// ── Paper Trading Engine ──────────────────────────────────────────────────

function getLivePrice(symbol: string): number | null {
  const p = livePrices.get(symbol.toLowerCase());
  return p ? p.price : null;
}

// GET /trading/account/:lobbyId?mode=RANKED|CASUAL — get or create paper account
app.get("/trading/account/:lobbyId", async (req, reply) => {
  const u = authFromHeader((req as any).headers?.authorization);
  if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
  const lobbyId = String((req as any).params?.lobbyId || "");
  const mode = parseMode(req);
  const startBal = startBalanceFor(mode);

  let account = await (prisma as any).paperAccount.findFirst({
    where: { userId: u.id, lobbyId, competitionId: null, mode },
    include: { positions: { where: { status: "OPEN" } }, orders: { where: { status: "PENDING" }, orderBy: { createdAt: "desc" }, take: 20 } },
  });

  if (!account) {
    account = await (prisma as any).paperAccount.create({
      data: { userId: u.id, lobbyId, mode, cashBalance: startBal, startBalance: startBal, realizedPnl: 0 },
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
      mode: account.mode,
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
  // Optional SL/TP at inception. Validated against the live mark below
  // once we know it. Both are absolute price levels; the position worker
  // (5s loop) auto-closes when the live price crosses either.
  const rawStopLoss = body.stopLoss !== undefined && body.stopLoss !== null && body.stopLoss !== "" ? parseFloat(body.stopLoss) : null;
  const rawTakeProfit = body.takeProfit !== undefined && body.takeProfit !== null && body.takeProfit !== "" ? parseFloat(body.takeProfit) : null;
  const stopLoss = (rawStopLoss !== null && Number.isFinite(rawStopLoss) && rawStopLoss > 0) ? rawStopLoss : null;
  const takeProfit = (rawTakeProfit !== null && Number.isFinite(rawTakeProfit) && rawTakeProfit > 0) ? rawTakeProfit : null;

  if (!symbol || !["BUY", "SELL"].includes(side)) {
    return reply.code(400).send({ ok: false, error: "invalid_params" });
  }
  if (!quantity || quantity <= 0) {
    return reply.code(400).send({ ok: false, error: "invalid_quantity" });
  }

  // Get or create account (mode-scoped)
  const mode = parseMode(req);
  const startBal = startBalanceFor(mode);
  const paperMul = paperRateMultiplierFor(mode);
  let account = await (prisma as any).paperAccount.findFirst({
    where: { userId: u.id, lobbyId, competitionId: null, mode },
    include: { positions: { where: { status: "OPEN", symbol } } },
  });
  if (!account) {
    account = await (prisma as any).paperAccount.create({
      data: { userId: u.id, lobbyId, mode, cashBalance: startBal, startBalance: startBal, realizedPnl: 0 },
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

  // Validate SL/TP against the entry side. Long: SL below entry, TP above.
  // Short: SL above entry, TP below. Reject backwards levels at the door
  // so the worker doesn't have to defend against them later.
  if (stopLoss !== null) {
    if (side === "BUY"  && stopLoss >= currentPrice) return reply.code(400).send({ ok: false, error: "sl_must_be_below_entry", message: `For a long, stop loss must be below ${currentPrice}.` });
    if (side === "SELL" && stopLoss <= currentPrice) return reply.code(400).send({ ok: false, error: "sl_must_be_above_entry", message: `For a short, stop loss must be above ${currentPrice}.` });
  }
  if (takeProfit !== null) {
    if (side === "BUY"  && takeProfit <= currentPrice) return reply.code(400).send({ ok: false, error: "tp_must_be_above_entry", message: `For a long, take profit must be above ${currentPrice}.` });
    if (side === "SELL" && takeProfit >= currentPrice) return reply.code(400).send({ ok: false, error: "tp_must_be_below_entry", message: `For a short, take profit must be below ${currentPrice}.` });
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
          const paperEarned = Math.max(1, Math.floor(pnl / 100)) * paperMul;
          awardPaper(u.id, "EARN_FAKEOUT", paperEarned, `FakeOut short profit: $${pnl.toFixed(2)} on ${symbol}`, shortPos.id).catch(() => {});
          if (mode === "RANKED") awardNotoriety(u.id, "FAKEOUT_PROFIT").catch(() => {});
        }
        // If buying more than closing, open new long with remainder
        const remaining = quantity - shortPos.quantity;
        if (remaining > 0) {
          const remainCost = currentPrice * remaining;
          await (prisma as any).paperPosition.create({
            data: { accountId: account.id, symbol, side: "BUY", quantity: remaining, entryPrice: currentPrice, entryValue: remainCost, stopLoss, takeProfit },
          });
          await (prisma as any).paperAccount.update({
            where: { id: account.id },
            data: { cashBalance: { decrement: remainCost } },
          });
        }
      } else {
        // New long position
        await (prisma as any).paperPosition.create({
          data: { accountId: account.id, symbol, side: "BUY", quantity, entryPrice: currentPrice, entryValue: cost, stopLoss, takeProfit },
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
          const paperEarned = Math.max(1, Math.floor(pnl / 100)) * paperMul;
          awardPaper(u.id, "EARN_FAKEOUT", paperEarned, `FakeOut long profit: $${pnl.toFixed(2)} on ${symbol}`, longPos.id).catch(() => {});
          if (mode === "RANKED") awardNotoriety(u.id, "FAKEOUT_PROFIT").catch(() => {});
        }
        // If selling more than closing, open short with remainder
        const remaining = quantity - longPos.quantity;
        if (remaining > 0) {
          const remainValue = currentPrice * remaining;
          await (prisma as any).paperPosition.create({
            data: { accountId: account.id, symbol, side: "SELL", quantity: remaining, entryPrice: currentPrice, entryValue: remainValue, stopLoss, takeProfit },
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
          const paperEarned = Math.max(1, Math.floor(pnl / 100)) * paperMul;
          awardPaper(u.id, "EARN_FAKEOUT", paperEarned, `FakeOut partial profit: $${pnl.toFixed(2)} on ${symbol}`, longPos.id).catch(() => {});
          if (mode === "RANKED") awardNotoriety(u.id, "FAKEOUT_PROFIT").catch(() => {});
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
          data: { accountId: account.id, symbol, side: "SELL", quantity, entryPrice: currentPrice, entryValue: cost, stopLoss, takeProfit },
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

  // Award Notoriety for trading — ranked only. Casual mode is for fun.
  if (mode === "RANKED") {
    awardNotoriety(u.id, "FIRST_FAKEOUT_TRADE").catch(() => {});
    awardNotoriety(u.id, "FAKEOUT_TRADE").catch(() => {});
  }

  // Broadcast trade to lobby room (everyone sees trades). `notional` is
  // included so the public-activity capture filter (≥$1k threshold) can
  // see the trade size without recomputing.
  const tradeEvent = { type: "trading:trade", userId: u.id, userName: u.name, symbol, side, quantity, price: currentPrice, notional: currentPrice * quantity, time: Date.now() };
  broadcastToLobby(lobbyId, tradeEvent);

  // Operator commentary on noteworthy trades. Look up any position this
  // user just closed to surface realized PnL — falls back to entry size for
  // big new positions. Throttling lives inside operatorCommentateOnTrade.
  if (operatorCommentateOnTrade) {
    (async () => {
      try {
        const recentClose = await (prisma as any).paperPosition.findFirst({
          where: {
            accountId: account.id,
            status: "CLOSED",
            closedAt: { gte: new Date(Date.now() - 5000) },
          },
          orderBy: { closedAt: "desc" },
        });
        const closedPnl: number | null = recentClose?.realizedPnl ?? null;
        const sym = symbol.replace(/USDT$/, "");
        const sideLabel = side === "BUY" ? "long" : "short";
        let ctx = "";
        if (closedPnl !== null && Math.abs(closedPnl) >= 500) {
          if (closedPnl > 0) {
            ctx = `${u.name} just closed a ${sym} trade for a +$${closedPnl.toFixed(0)} profit.`;
          } else {
            ctx = `${u.name} just closed a ${sym} trade taking a -$${Math.abs(closedPnl).toFixed(0)} loss.`;
          }
        } else if (cost >= 20000) {
          ctx = `${u.name} just opened a $${cost.toFixed(0)} ${sideLabel} on ${sym} at $${currentPrice.toFixed(2)}.`;
        }
        if (ctx) await operatorCommentateOnTrade(lobbyId, ctx);
      } catch {}
    })();
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
    data: { status: "CLOSED", exitPrice: currentPrice, realizedPnl: pnl, closedAt: new Date(), closeReason: "MANUAL" },
  });
  await (prisma as any).paperAccount.update({
    where: { id: pos.accountId },
    data: { cashBalance: { increment: pos.entryValue + pnl }, realizedPnl: { increment: pnl } },
  });

  // Award Paper for profitable trades. Ranked mode pays 10× and grants
  // Notoriety; casual is for-fun and pays the base rate without XP.
  const accountMode: PaperMode = (pos.account?.mode === "RANKED" ? "RANKED" : "CASUAL");
  const paperMul = paperRateMultiplierFor(accountMode);
  if (pnl > 0) {
    const paperEarned = Math.max(1, Math.floor(pnl / 100)) * paperMul;
    awardPaper(u.id, "EARN_FAKEOUT", paperEarned, `FakeOut profit: $${pnl.toFixed(2)} on ${pos.symbol}`, positionId).catch(() => {});
    if (accountMode === "RANKED") awardNotoriety(u.id, "FAKEOUT_PROFIT").catch(() => {});
  }

  // Operator commentary on closed positions with meaningful PnL.
  if (operatorCommentateOnTrade && Math.abs(pnl) >= 500) {
    const lobbyId = String((req as any).params?.lobbyId || pos.account.lobbyId || "");
    if (lobbyId) {
      const sym = pos.symbol.replace(/USDT$/, "");
      const ctx = pnl > 0
        ? `${u.name} just closed a ${sym} trade for a +$${pnl.toFixed(0)} profit.`
        : `${u.name} just closed a ${sym} trade taking a -$${Math.abs(pnl).toFixed(0)} loss.`;
      operatorCommentateOnTrade(lobbyId, ctx).catch(() => {});
    }
  }

  return reply.send({ ok: true, pnl, exitPrice: currentPrice });
});

// PATCH /trading/position/:positionId/exits — alter stopLoss / takeProfit
// on an OPEN position. Sending null for a field clears that exit.
app.patch("/trading/position/:positionId/exits", async (req, reply) => {
  const u = authFromHeader((req as any).headers?.authorization);
  if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
  const positionId = String((req as any).params?.positionId || "");
  const body: any = (req as any).body || {};

  const pos = await (prisma as any).paperPosition.findUnique({
    where: { id: positionId },
    include: { account: true },
  });
  if (!pos || pos.account.userId !== u.id) return reply.code(404).send({ ok: false, error: "not_found" });
  if (pos.status !== "OPEN") return reply.code(400).send({ ok: false, error: "already_closed" });

  // null clears, undefined leaves untouched, number sets.
  const data: any = {};
  if (Object.prototype.hasOwnProperty.call(body, "stopLoss")) {
    if (body.stopLoss === null || body.stopLoss === "") {
      data.stopLoss = null;
    } else {
      const sl = parseFloat(body.stopLoss);
      if (!Number.isFinite(sl) || sl <= 0) return reply.code(400).send({ ok: false, error: "invalid_stopLoss" });
      if (pos.side === "BUY"  && sl >= pos.entryPrice) return reply.code(400).send({ ok: false, error: "sl_must_be_below_entry", message: `For a long, stop loss must be below ${pos.entryPrice}.` });
      if (pos.side === "SELL" && sl <= pos.entryPrice) return reply.code(400).send({ ok: false, error: "sl_must_be_above_entry", message: `For a short, stop loss must be above ${pos.entryPrice}.` });
      data.stopLoss = sl;
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, "takeProfit")) {
    if (body.takeProfit === null || body.takeProfit === "") {
      data.takeProfit = null;
    } else {
      const tp = parseFloat(body.takeProfit);
      if (!Number.isFinite(tp) || tp <= 0) return reply.code(400).send({ ok: false, error: "invalid_takeProfit" });
      if (pos.side === "BUY"  && tp <= pos.entryPrice) return reply.code(400).send({ ok: false, error: "tp_must_be_above_entry", message: `For a long, take profit must be above ${pos.entryPrice}.` });
      if (pos.side === "SELL" && tp >= pos.entryPrice) return reply.code(400).send({ ok: false, error: "tp_must_be_below_entry", message: `For a short, take profit must be below ${pos.entryPrice}.` });
      data.takeProfit = tp;
    }
  }
  if (Object.keys(data).length === 0) return reply.code(400).send({ ok: false, error: "no_changes" });

  const updated = await (prisma as any).paperPosition.update({
    where: { id: positionId },
    data,
  });
  return reply.send({ ok: true, position: { id: updated.id, stopLoss: updated.stopLoss, takeProfit: updated.takeProfit } });
});

// GET /trading/leaderboard/:lobbyId?mode=RANKED|CASUAL — ranked by total P&L
app.get("/trading/leaderboard/:lobbyId", async (req, reply) => {
  const lobbyId = String((req as any).params?.lobbyId || "");
  const mode = parseMode(req);

  const accounts = await (prisma as any).paperAccount.findMany({
    where: { lobbyId, competitionId: null, mode },
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

// GET /trading/history/:lobbyId?mode=RANKED|CASUAL — order history
app.get("/trading/history/:lobbyId", async (req, reply) => {
  const u = authFromHeader((req as any).headers?.authorization);
  if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
  const lobbyId = String((req as any).params?.lobbyId || "");
  const mode = parseMode(req);

  const account = await (prisma as any).paperAccount.findFirst({
    where: { userId: u.id, lobbyId, competitionId: null, mode },
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

// GET /trading/lobby-feed/:lobbyId?mode=RANKED|CASUAL — chronological
// stream of recent trade events across every account in the lobby. Powers
// the lobby's Feed tab so a visitor can watch the action without picking
// a room. Returns last 60 events: filled market orders + closed positions
// (closes carry realized PnL). The frontend stitches WS trading:trade
// events on top for live additions.
app.get("/trading/lobby-feed/:lobbyId", async (req, reply) => {
  const lobbyId = String((req as any).params?.lobbyId || "");
  const mode = parseMode(req);

  const since = new Date(Date.now() - 6 * 60 * 60 * 1000); // last 6 hours

  // Pull recent FILLED orders and CLOSED positions in parallel.
  const [orders, closedPositions] = await Promise.all([
    (prisma as any).paperOrder.findMany({
      where: {
        status: "FILLED",
        filledAt: { gte: since },
        account: { lobbyId, competitionId: null, mode },
      },
      include: { account: { select: { userId: true, mode: true } } },
      orderBy: { filledAt: "desc" },
      take: 60,
    }),
    (prisma as any).paperPosition.findMany({
      where: {
        status: "CLOSED",
        closedAt: { gte: since },
        account: { lobbyId, competitionId: null, mode },
      },
      include: { account: { select: { userId: true, mode: true } } },
      orderBy: { closedAt: "desc" },
      take: 60,
    }),
  ]);

  // One user lookup for everyone referenced.
  const userIds = Array.from(new Set([
    ...orders.map((o: any) => o.account.userId),
    ...closedPositions.map((p: any) => p.account.userId),
  ]));
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, avatarColor: true, avatar: true } })
    : [];
  const userMap = new Map(users.map(u => [u.id, u]));

  // Merge into a single chronological feed.
  type FeedItem = {
    type: "open" | "close";
    ts: number;
    userId: string;
    userName: string;
    avatar?: string | null;
    avatarColor?: string | null;
    symbol: string;
    side: string;
    quantity: number;
    price: number;
    pnl?: number;
    mode: string;
  };
  const items: FeedItem[] = [];
  for (const o of orders) {
    const u = userMap.get(o.account.userId);
    items.push({
      type: "open",
      ts: o.filledAt ? new Date(o.filledAt).getTime() : Date.now(),
      userId: o.account.userId,
      userName: u?.name || "trader",
      avatar: u?.avatar || null,
      avatarColor: u?.avatarColor || null,
      symbol: o.symbol,
      side: o.side,
      quantity: o.quantity,
      price: o.filledPrice || 0,
      mode: o.account.mode,
    });
  }
  for (const p of closedPositions) {
    const u = userMap.get(p.account.userId);
    items.push({
      type: "close",
      ts: p.closedAt ? new Date(p.closedAt).getTime() : Date.now(),
      userId: p.account.userId,
      userName: u?.name || "trader",
      avatar: u?.avatar || null,
      avatarColor: u?.avatarColor || null,
      symbol: p.symbol,
      side: p.side,
      quantity: p.quantity,
      price: p.exitPrice || 0,
      pnl: p.realizedPnl ?? undefined,
      mode: p.account.mode,
    });
  }
  items.sort((a, b) => b.ts - a.ts);
  return reply.send({ ok: true, items: items.slice(0, 80) });
});

// POST /trading/reset/:lobbyId — reset account (start fresh) for the
// requested mode. ?mode=RANKED|CASUAL, defaults to CASUAL.
app.post("/trading/reset/:lobbyId", async (req, reply) => {
  const u = authFromHeader((req as any).headers?.authorization);
  if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
  const lobbyId = String((req as any).params?.lobbyId || "");
  const mode = parseMode(req);
  const startBal = startBalanceFor(mode);

  const account = await (prisma as any).paperAccount.findFirst({
    where: { userId: u.id, lobbyId, competitionId: null, mode },
  });
  if (!account) return reply.send({ ok: true });

  // Delete all positions and orders, reset balance to mode start.
  await (prisma as any).paperPosition.deleteMany({ where: { accountId: account.id } });
  await (prisma as any).paperOrder.deleteMany({ where: { accountId: account.id } });
  await (prisma as any).paperAccount.update({
    where: { id: account.id },
    data: { cashBalance: startBal, startBalance: startBal, realizedPnl: 0 },
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

// ── SL/TP auto-close worker ───────────────────────────────────────────────
// Walks every open position with an SL or TP set, compares the live mark
// against the trigger, and auto-closes when it crosses. Mirrors the
// manual-close logic so the resulting trade stream is identical to a
// user-driven close — same broadcast, same Paper award, same Notoriety,
// same Operator commentary.
setInterval(async () => {
  try {
    const positions = await (prisma as any).paperPosition.findMany({
      where: {
        status: "OPEN",
        OR: [{ stopLoss: { not: null } }, { takeProfit: { not: null } }],
      },
      include: { account: true },
    });
    for (const pos of positions) {
      const cp = getLivePrice(pos.symbol);
      if (!cp) continue;

      let trigger: "STOP_LOSS" | "TAKE_PROFIT" | null = null;
      if (pos.side === "BUY") {
        if (pos.stopLoss   !== null && cp <= pos.stopLoss)   trigger = "STOP_LOSS";
        else if (pos.takeProfit !== null && cp >= pos.takeProfit) trigger = "TAKE_PROFIT";
      } else {
        if (pos.stopLoss   !== null && cp >= pos.stopLoss)   trigger = "STOP_LOSS";
        else if (pos.takeProfit !== null && cp <= pos.takeProfit) trigger = "TAKE_PROFIT";
      }
      if (!trigger) continue;

      // Fill at the trigger level (not the current mark) so the user sees
      // exactly what they asked for. In a real exchange this is "stop with
      // limit"; we simulate it cleanly because we control the engine.
      const exitPrice = trigger === "STOP_LOSS" ? pos.stopLoss : pos.takeProfit;
      const pnl = pos.side === "BUY"
        ? (exitPrice - pos.entryPrice) * pos.quantity
        : (pos.entryPrice - exitPrice) * pos.quantity;

      try {
        await (prisma as any).paperPosition.update({
          where: { id: pos.id },
          data: { status: "CLOSED", exitPrice, realizedPnl: pnl, closedAt: new Date(), closeReason: trigger },
        });
        await (prisma as any).paperAccount.update({
          where: { id: pos.accountId },
          data: { cashBalance: { increment: pos.entryValue + pnl }, realizedPnl: { increment: pnl } },
        });
      } catch (e) {
        console.error("[trading] sl/tp close error:", e);
        continue;
      }

      // Paper + Notoriety on profitable exits, mirroring manual close.
      const accountMode: PaperMode = (pos.account?.mode === "RANKED" ? "RANKED" : "CASUAL");
      const paperMul = paperRateMultiplierFor(accountMode);
      if (pnl > 0) {
        const paperEarned = Math.max(1, Math.floor(pnl / 100)) * paperMul;
        awardPaper(pos.account.userId, "EARN_FAKEOUT", paperEarned, `FakeOut ${trigger === "TAKE_PROFIT" ? "TP" : "SL"} hit: $${pnl.toFixed(2)} on ${pos.symbol}`, pos.id).catch(() => {});
        if (accountMode === "RANKED") awardNotoriety(pos.account.userId, "FAKEOUT_PROFIT").catch(() => {});
      }

      // Notify the user + broadcast a close-style trade event so chat
      // chips and the lobby feed pick it up.
      notifyUser(pos.account.userId, { type: "trading:position_closed", positionId: pos.id, reason: trigger, pnl, exitPrice });
      const lookupUser = await prisma.user.findUnique({ where: { id: pos.account.userId }, select: { name: true } });
      const userName = lookupUser?.name || "trader";
      // `notional` is required for the public-activity capture filter's
      // ≥$1k threshold to evaluate. Same fix as the user-driven trade
      // broadcast above; auto-closes were silently dropped before.
      broadcastToLobby(pos.account.lobbyId, {
        type: "trading:trade",
        userId: pos.account.userId,
        userName,
        symbol: pos.symbol,
        side: pos.side === "BUY" ? "SELL" : "BUY", // close direction
        quantity: pos.quantity,
        price: exitPrice,
        notional: pos.quantity * exitPrice,
        time: Date.now(),
        closeReason: trigger,
        pnl,
      });

      // Operator commentary on auto-closes with meaningful PnL.
      if (operatorCommentateOnTrade && Math.abs(pnl) >= 500) {
        const sym = pos.symbol.replace(/USDT$/, "");
        const ctx = trigger === "TAKE_PROFIT"
          ? `${userName} just hit take-profit on ${sym} for +$${pnl.toFixed(0)}.`
          : `${userName} just got stopped out on ${sym} for -$${Math.abs(pnl).toFixed(0)}.`;
        operatorCommentateOnTrade(pos.account.lobbyId, ctx).catch(() => {});
      }
    }
  } catch (e) { console.error("[trading] sl/tp worker error:", e); }
}, 5000); // check every 5 seconds
}
