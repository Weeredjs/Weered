import { OrderSide } from "@prisma/client";
import { log, swallow } from "../lib/logger";
import type { FastifyInstance } from "fastify";
import { fetchWithTimeout } from "../lib/fetchWithTimeout";
import { prisma } from "../lib/prisma";
import { z } from "zod";

type Opts = {
  authFromHeader: (h?: string) => { id: string; name: string } | null;
  awardPaper: (
    userId: string,
    type: string,
    amount: number,
    description: string,
    refId?: string,
  ) => Promise<{ balance: number } | null>;
  awardNotoriety: (userId: string, action: string) => Promise<number | null>;
  livePrices: Map<string, { price: number; time: number }>;
  broadcastToLobby: (lobbyId: string, event: any) => void;
  notifyUser: (userId: string, event: any) => void;
  operatorCommentateOnTrade?: (lobbyId: string, context: string) => Promise<void>;
};

export default async function tradingRoutes(app: FastifyInstance, opts: Opts) {
  const {
    authFromHeader,
    awardPaper,
    awardNotoriety,
    livePrices,
    broadcastToLobby,
    notifyUser,
    operatorCommentateOnTrade,
  } = opts;
  const BINANCE_REST = "https://api.binance.com";

  function getLivePrice(symbol: string): number | null {
    const p = livePrices.get(symbol.toLowerCase());
    return p ? p.price : null;
  }

  type PaperMode = "CASUAL" | "RANKED";
  function parseMode(req: any): PaperMode {
    const m = String(req?.query?.mode || req?.body?.mode || "CASUAL").toUpperCase();
    return m === "RANKED" ? "RANKED" : "CASUAL";
  }
  function startBalanceFor(mode: PaperMode): number {
    return mode === "RANKED" ? 1000 : 100000;
  }
  function paperRateMultiplierFor(mode: PaperMode): number {
    return mode === "RANKED" ? 10 : 1;
  }

  app.get("/trading/candles", async (req, reply) => {
    const q: any = (req as any).query || {};
    const symbol = String(q.symbol || "BTCUSDT").toUpperCase();
    const interval = String(q.interval || "1m");
    const limit = Math.min(parseInt(q.limit) || 200, 1000);

    try {
      const url = `${BINANCE_REST}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
      const resp = await fetchWithTimeout(url);
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
      log.error("[trading/candles]", e);
      return reply.send({ ok: false, error: "fetch_failed" });
    }
  });

  const TRADING_SYMBOLS: {
    symbol: string;
    name: string;
    icon: string;
    assetClass?: "crypto" | "fx" | "metal";
    comingSoon?: boolean;
  }[] = [
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
    const out = TRADING_SYMBOLS.map((s) => ({
      ...s,
      price: s.comingSoon ? null : livePrices.get(s.symbol.toLowerCase())?.price || null,
    }));
    return reply.send({ ok: true, symbols: out });
  });

  app.get("/trading/account/:lobbyId", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const lobbyId = String((req as any).params?.lobbyId || "");
    const mode = parseMode(req);
    const startBal = startBalanceFor(mode);

    let account = await prisma.paperAccount.findFirst({
      where: { userId: u.id, lobbyId, competitionId: null, mode },
      include: {
        positions: { where: { status: "OPEN" } },
        orders: { where: { status: "PENDING" }, orderBy: { createdAt: "desc" }, take: 20 },
      },
    });

    if (!account) {
      account = await prisma.paperAccount.create({
        data: {
          userId: u.id,
          lobbyId,
          mode,
          cashBalance: startBal,
          startBalance: startBal,
          realizedPnl: 0,
        },
        include: {
          positions: { where: { status: "OPEN" } },
          orders: { where: { status: "PENDING" } },
        },
      });
    }

    let unrealizedPnl = 0;
    const positionsWithPnl = account.positions.map((p: any) => {
      const currentPrice = getLivePrice(p.symbol);
      let pnl = 0;
      if (currentPrice) {
        pnl =
          p.side === "BUY"
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
        pendingOrders: account.orders.map((o: any) => ({
          ...o,
          createdAt: o.createdAt?.toISOString(),
        })),
        createdAt: account.createdAt?.toISOString(),
      },
    });
  });

  app.post(
    "/trading/order/:lobbyId",
    {
      schema: {
        tags: ["trading"],
        summary: "Place a market / limit / stop order (FakeOut paper trading)",
        body: z
          .object({
            symbol: z.string().min(1).max(20),
            side: z.string().min(1),
            orderType: z.string().optional(),
            quantity: z.coerce.number(),
          })
          .passthrough(),
      },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
      const lobbyId = String((req as any).params?.lobbyId || "");
      const body: any = (req as any).body || {};

      const symbol = String(body.symbol || "").toUpperCase();
      const side: string = String(body.side || "").toUpperCase();
      const orderType = String(body.orderType || "MARKET").toUpperCase();
      const quantity = parseFloat(body.quantity);
      const limitPrice = body.price ? parseFloat(body.price) : null;
      const rawStopLoss =
        body.stopLoss !== undefined && body.stopLoss !== null && body.stopLoss !== ""
          ? parseFloat(body.stopLoss)
          : null;
      const rawTakeProfit =
        body.takeProfit !== undefined && body.takeProfit !== null && body.takeProfit !== ""
          ? parseFloat(body.takeProfit)
          : null;
      const stopLoss =
        rawStopLoss !== null && Number.isFinite(rawStopLoss) && rawStopLoss > 0
          ? rawStopLoss
          : null;
      const takeProfit =
        rawTakeProfit !== null && Number.isFinite(rawTakeProfit) && rawTakeProfit > 0
          ? rawTakeProfit
          : null;

      if (!symbol || !["BUY", "SELL"].includes(side)) {
        return reply.code(400).send({ ok: false, error: "invalid_params" });
      }
      if (!quantity || quantity <= 0) {
        return reply.code(400).send({ ok: false, error: "invalid_quantity" });
      }

      const mode = parseMode(req);
      const startBal = startBalanceFor(mode);
      const paperMul = paperRateMultiplierFor(mode);
      let account = await prisma.paperAccount.findFirst({
        where: { userId: u.id, lobbyId, competitionId: null, mode },
        include: { positions: { where: { status: "OPEN", symbol } } },
      });
      if (!account) {
        account = await prisma.paperAccount.create({
          data: {
            userId: u.id,
            lobbyId,
            mode,
            cashBalance: startBal,
            startBalance: startBal,
            realizedPnl: 0,
          },
          include: { positions: { where: { status: "OPEN", symbol } } },
        });
      }

      if (orderType === "LIMIT" || orderType === "STOP") {
        if (!limitPrice || limitPrice <= 0) {
          return reply.code(400).send({ ok: false, error: "limit_price_required" });
        }
        const order = await prisma.paperOrder.create({
          data: {
            accountId: account.id,
            symbol,
            side: side as OrderSide,
            orderType,
            quantity,
            price: limitPrice,
            status: "PENDING",
          },
        });
        return reply.send({
          ok: true,
          order: { ...order, createdAt: order.createdAt?.toISOString() },
        });
      }

      const currentPrice = getLivePrice(symbol);
      if (!currentPrice) {
        return reply.code(400).send({
          ok: false,
          error: "no_price_data",
          message: "No live price available for " + symbol,
        });
      }

      if (stopLoss !== null) {
        if (side === "BUY" && stopLoss >= currentPrice)
          return reply.code(400).send({
            ok: false,
            error: "sl_must_be_below_entry",
            message: `For a long, stop loss must be below ${currentPrice}.`,
          });
        if (side === "SELL" && stopLoss <= currentPrice)
          return reply.code(400).send({
            ok: false,
            error: "sl_must_be_above_entry",
            message: `For a short, stop loss must be above ${currentPrice}.`,
          });
      }
      if (takeProfit !== null) {
        if (side === "BUY" && takeProfit <= currentPrice)
          return reply.code(400).send({
            ok: false,
            error: "tp_must_be_above_entry",
            message: `For a long, take profit must be above ${currentPrice}.`,
          });
        if (side === "SELL" && takeProfit >= currentPrice)
          return reply.code(400).send({
            ok: false,
            error: "tp_must_be_below_entry",
            message: `For a short, take profit must be below ${currentPrice}.`,
          });
      }

      const cost = currentPrice * quantity;

      // Awards are fired AFTER the DB transaction commits, so a rolled-back trade
      // never leaks Paper / notoriety.
      const pendingAwards: { paper: number; desc: string; refId: string }[] = [];

      try {
        if (side === "BUY") {
          // Fast-path UX rejection; the authoritative overdraft guard is the conditional debit below.
          if (cost > account.cashBalance) {
            return reply.code(400).send({
              ok: false,
              error: "insufficient_funds",
              available: account.cashBalance,
              required: cost,
            });
          }
          await prisma.$transaction(async (tx: any) => {
            const existing = account.positions.find((p: any) => p.side === "BUY");
            if (existing) {
              // Averaging into an existing long: debit the added cost (guarded) THEN grow the position.
              const debited = await tx.paperAccount.updateMany({
                where: { id: account.id, cashBalance: { gte: cost } },
                data: { cashBalance: { decrement: cost } },
              });
              if (debited.count === 0) throw new Error("INSUFFICIENT_FUNDS");
              const newQty = existing.quantity + quantity;
              const newEntry =
                (existing.entryPrice * existing.quantity + currentPrice * quantity) / newQty;
              await tx.paperPosition.update({
                where: { id: existing.id },
                data: { quantity: newQty, entryPrice: newEntry, entryValue: newEntry * newQty },
              });
            } else {
              const shortPos = account.positions.find((p: any) => p.side === "SELL");
              if (shortPos) {
                const pnl = (shortPos.entryPrice - currentPrice) * shortPos.quantity;
                await tx.paperPosition.update({
                  where: { id: shortPos.id },
                  data: {
                    status: "CLOSED",
                    exitPrice: currentPrice,
                    realizedPnl: pnl,
                    closedAt: new Date(),
                  },
                });
                await tx.paperAccount.update({
                  where: { id: account.id },
                  data: {
                    cashBalance: { increment: shortPos.entryValue + pnl },
                    realizedPnl: { increment: pnl },
                  },
                });
                if (pnl > 0)
                  pendingAwards.push({
                    paper: Math.max(1, Math.floor(pnl / 100)) * paperMul,
                    desc: `FakeOut short profit: $${pnl.toFixed(2)} on ${symbol}`,
                    refId: shortPos.id,
                  });
                const remaining = quantity - shortPos.quantity;
                if (remaining > 0) {
                  const remainCost = currentPrice * remaining;
                  const debited = await tx.paperAccount.updateMany({
                    where: { id: account.id, cashBalance: { gte: remainCost } },
                    data: { cashBalance: { decrement: remainCost } },
                  });
                  if (debited.count === 0) throw new Error("INSUFFICIENT_FUNDS");
                  await tx.paperPosition.create({
                    data: {
                      accountId: account.id,
                      symbol,
                      side: "BUY",
                      quantity: remaining,
                      entryPrice: currentPrice,
                      entryValue: remainCost,
                      stopLoss,
                      takeProfit,
                    },
                  });
                }
              } else {
                const debited = await tx.paperAccount.updateMany({
                  where: { id: account.id, cashBalance: { gte: cost } },
                  data: { cashBalance: { decrement: cost } },
                });
                if (debited.count === 0) throw new Error("INSUFFICIENT_FUNDS");
                await tx.paperPosition.create({
                  data: {
                    accountId: account.id,
                    symbol,
                    side: "BUY",
                    quantity,
                    entryPrice: currentPrice,
                    entryValue: cost,
                    stopLoss,
                    takeProfit,
                  },
                });
              }
            }
          });
        } else {
          await prisma.$transaction(async (tx: any) => {
            const longPos = account.positions.find((p: any) => p.side === "BUY");
            if (longPos) {
              if (quantity >= longPos.quantity) {
                const pnl = (currentPrice - longPos.entryPrice) * longPos.quantity;
                await tx.paperPosition.update({
                  where: { id: longPos.id },
                  data: {
                    status: "CLOSED",
                    exitPrice: currentPrice,
                    realizedPnl: pnl,
                    closedAt: new Date(),
                  },
                });
                await tx.paperAccount.update({
                  where: { id: account.id },
                  data: {
                    cashBalance: { increment: longPos.entryValue + pnl },
                    realizedPnl: { increment: pnl },
                  },
                });
                if (pnl > 0)
                  pendingAwards.push({
                    paper: Math.max(1, Math.floor(pnl / 100)) * paperMul,
                    desc: `FakeOut long profit: $${pnl.toFixed(2)} on ${symbol}`,
                    refId: longPos.id,
                  });
                const remaining = quantity - longPos.quantity;
                if (remaining > 0) {
                  const remainValue = currentPrice * remaining;
                  const debited = await tx.paperAccount.updateMany({
                    where: { id: account.id, cashBalance: { gte: remainValue } },
                    data: { cashBalance: { decrement: remainValue } },
                  });
                  if (debited.count === 0) throw new Error("INSUFFICIENT_FUNDS");
                  await tx.paperPosition.create({
                    data: {
                      accountId: account.id,
                      symbol,
                      side: "SELL",
                      quantity: remaining,
                      entryPrice: currentPrice,
                      entryValue: remainValue,
                      stopLoss,
                      takeProfit,
                    },
                  });
                }
              } else {
                const pnl = (currentPrice - longPos.entryPrice) * quantity;
                const newQty = longPos.quantity - quantity;
                await tx.paperPosition.update({
                  where: { id: longPos.id },
                  data: { quantity: newQty, entryValue: longPos.entryPrice * newQty },
                });
                await tx.paperAccount.update({
                  where: { id: account.id },
                  data: {
                    cashBalance: { increment: longPos.entryPrice * quantity + pnl },
                    realizedPnl: { increment: pnl },
                  },
                });
                if (pnl > 0)
                  pendingAwards.push({
                    paper: Math.max(1, Math.floor(pnl / 100)) * paperMul,
                    desc: `FakeOut partial profit: $${pnl.toFixed(2)} on ${symbol}`,
                    refId: longPos.id,
                  });
              }
            } else {
              // Opening / adding to a short requires margin = notional; guarded so it can't overdraft.
              const debited = await tx.paperAccount.updateMany({
                where: { id: account.id, cashBalance: { gte: cost } },
                data: { cashBalance: { decrement: cost } },
              });
              if (debited.count === 0) throw new Error("INSUFFICIENT_FUNDS");
              const existingShort = account.positions.find((p: any) => p.side === "SELL");
              if (existingShort) {
                const newQty = existingShort.quantity + quantity;
                const newEntry =
                  (existingShort.entryPrice * existingShort.quantity + currentPrice * quantity) /
                  newQty;
                await tx.paperPosition.update({
                  where: { id: existingShort.id },
                  data: { quantity: newQty, entryPrice: newEntry, entryValue: newEntry * newQty },
                });
              } else {
                await tx.paperPosition.create({
                  data: {
                    accountId: account.id,
                    symbol,
                    side: "SELL",
                    quantity,
                    entryPrice: currentPrice,
                    entryValue: cost,
                    stopLoss,
                    takeProfit,
                  },
                });
              }
            }
          });
        }
      } catch (e: any) {
        if (e && e.message === "INSUFFICIENT_FUNDS") {
          return reply.code(400).send({
            ok: false,
            error: "insufficient_funds",
            available: account.cashBalance,
            required: cost,
          });
        }
        throw e;
      }

      // Economy awards fire only after the trade is durably committed.
      for (const a of pendingAwards) {
        awardPaper(u.id, "EARN_FAKEOUT", a.paper, a.desc, a.refId).catch(swallow);
        if (mode === "RANKED") awardNotoriety(u.id, "FAKEOUT_PROFIT").catch(swallow);
      }
      await prisma.paperOrder.create({
        data: {
          accountId: account.id,
          symbol,
          side: side as OrderSide,
          orderType: "MARKET",
          quantity,
          filledPrice: currentPrice,
          filledAt: new Date(),
          status: "FILLED",
        },
      });

      if (mode === "RANKED") {
        awardNotoriety(u.id, "FIRST_FAKEOUT_TRADE").catch(swallow);
        awardNotoriety(u.id, "FAKEOUT_TRADE").catch(swallow);
      }

      const tradeEvent = {
        type: "trading:trade",
        userId: u.id,
        userName: u.name,
        symbol,
        side,
        quantity,
        price: currentPrice,
        notional: currentPrice * quantity,
        time: Date.now(),
      };
      broadcastToLobby(lobbyId, tradeEvent);

      if (operatorCommentateOnTrade) {
        (async () => {
          try {
            const recentClose = await prisma.paperPosition.findFirst({
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
          } catch (e) {
            swallow(e);
          }
        })();
      }

      return reply.send({ ok: true, filled: { symbol, side, quantity, price: currentPrice } });
    },
  );

  app.post("/trading/close/:lobbyId/:positionId", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const positionId = String((req as any).params?.positionId || "");

    const pos = await prisma.paperPosition.findUnique({
      where: { id: positionId },
      include: { account: true },
    });
    if (!pos || pos.account.userId !== u.id)
      return reply.code(404).send({ ok: false, error: "not_found" });
    if (pos.status !== "OPEN") return reply.code(400).send({ ok: false, error: "already_closed" });

    const currentPrice = getLivePrice(pos.symbol);
    if (!currentPrice) return reply.code(400).send({ ok: false, error: "no_price_data" });

    const pnl =
      pos.side === "BUY"
        ? (currentPrice - pos.entryPrice) * pos.quantity
        : (pos.entryPrice - currentPrice) * pos.quantity;

    // Idempotent close: only the request that actually flips OPEN->CLOSED credits
    // the account, so two concurrent closes cannot double-pay.
    const claimed = await prisma.paperPosition.updateMany({
      where: { id: positionId, status: "OPEN" },
      data: {
        status: "CLOSED",
        exitPrice: currentPrice,
        realizedPnl: pnl,
        closedAt: new Date(),
        closeReason: "MANUAL",
      },
    });
    if (claimed.count === 0) return reply.code(400).send({ ok: false, error: "already_closed" });
    await prisma.paperAccount.update({
      where: { id: pos.accountId },
      data: { cashBalance: { increment: pos.entryValue + pnl }, realizedPnl: { increment: pnl } },
    });

    const accountMode: PaperMode = pos.account?.mode === "RANKED" ? "RANKED" : "CASUAL";
    const paperMul = paperRateMultiplierFor(accountMode);
    if (pnl > 0) {
      const paperEarned = Math.max(1, Math.floor(pnl / 100)) * paperMul;
      awardPaper(
        u.id,
        "EARN_FAKEOUT",
        paperEarned,
        `FakeOut profit: $${pnl.toFixed(2)} on ${pos.symbol}`,
        positionId,
      ).catch(swallow);
      if (accountMode === "RANKED") awardNotoriety(u.id, "FAKEOUT_PROFIT").catch(swallow);
    }

    if (operatorCommentateOnTrade && Math.abs(pnl) >= 500) {
      const lobbyId = String((req as any).params?.lobbyId || pos.account.lobbyId || "");
      if (lobbyId) {
        const sym = pos.symbol.replace(/USDT$/, "");
        const ctx =
          pnl > 0
            ? `${u.name} just closed a ${sym} trade for a +$${pnl.toFixed(0)} profit.`
            : `${u.name} just closed a ${sym} trade taking a -$${Math.abs(pnl).toFixed(0)} loss.`;
        operatorCommentateOnTrade(lobbyId, ctx).catch(swallow);
      }
    }

    return reply.send({ ok: true, pnl, exitPrice: currentPrice });
  });

  app.patch("/trading/position/:positionId/exits", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const positionId = String((req as any).params?.positionId || "");
    const body: any = (req as any).body || {};

    const pos = await prisma.paperPosition.findUnique({
      where: { id: positionId },
      include: { account: true },
    });
    if (!pos || pos.account.userId !== u.id)
      return reply.code(404).send({ ok: false, error: "not_found" });
    if (pos.status !== "OPEN") return reply.code(400).send({ ok: false, error: "already_closed" });

    const data: any = {};
    if (Object.prototype.hasOwnProperty.call(body, "stopLoss")) {
      if (body.stopLoss === null || body.stopLoss === "") {
        data.stopLoss = null;
      } else {
        const sl = parseFloat(body.stopLoss);
        if (!Number.isFinite(sl) || sl <= 0)
          return reply.code(400).send({ ok: false, error: "invalid_stopLoss" });
        if (pos.side === "BUY" && sl >= pos.entryPrice)
          return reply.code(400).send({
            ok: false,
            error: "sl_must_be_below_entry",
            message: `For a long, stop loss must be below ${pos.entryPrice}.`,
          });
        if (pos.side === "SELL" && sl <= pos.entryPrice)
          return reply.code(400).send({
            ok: false,
            error: "sl_must_be_above_entry",
            message: `For a short, stop loss must be above ${pos.entryPrice}.`,
          });
        data.stopLoss = sl;
      }
    }
    if (Object.prototype.hasOwnProperty.call(body, "takeProfit")) {
      if (body.takeProfit === null || body.takeProfit === "") {
        data.takeProfit = null;
      } else {
        const tp = parseFloat(body.takeProfit);
        if (!Number.isFinite(tp) || tp <= 0)
          return reply.code(400).send({ ok: false, error: "invalid_takeProfit" });
        if (pos.side === "BUY" && tp <= pos.entryPrice)
          return reply.code(400).send({
            ok: false,
            error: "tp_must_be_above_entry",
            message: `For a long, take profit must be above ${pos.entryPrice}.`,
          });
        if (pos.side === "SELL" && tp >= pos.entryPrice)
          return reply.code(400).send({
            ok: false,
            error: "tp_must_be_below_entry",
            message: `For a short, take profit must be below ${pos.entryPrice}.`,
          });
        data.takeProfit = tp;
      }
    }
    if (Object.keys(data).length === 0)
      return reply.code(400).send({ ok: false, error: "no_changes" });

    const updated = await prisma.paperPosition.update({
      where: { id: positionId },
      data,
    });
    return reply.send({
      ok: true,
      position: { id: updated.id, stopLoss: updated.stopLoss, takeProfit: updated.takeProfit },
    });
  });

  app.get("/trading/leaderboard/:lobbyId", async (req, reply) => {
    const lobbyId = String((req as any).params?.lobbyId || "");
    const mode = parseMode(req);

    const accounts = await prisma.paperAccount.findMany({
      where: { lobbyId, competitionId: null, mode },
      include: { positions: { where: { status: "OPEN" } } },
    });

    const userIds = accounts.map((a: any) => a.userId);
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, avatarColor: true, avatar: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const leaderboard = accounts.map((a: any) => {
      let unrealizedPnl = 0;
      for (const p of a.positions) {
        const cp = getLivePrice(p.symbol);
        if (cp) {
          unrealizedPnl +=
            p.side === "BUY" ? (cp - p.entryPrice) * p.quantity : (p.entryPrice - cp) * p.quantity;
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

  app.get("/trading/history/:lobbyId", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const lobbyId = String((req as any).params?.lobbyId || "");
    const mode = parseMode(req);

    const account = await prisma.paperAccount.findFirst({
      where: { userId: u.id, lobbyId, competitionId: null, mode },
    });
    if (!account) return reply.send({ ok: true, orders: [], closedPositions: [] });

    const orders = await prisma.paperOrder.findMany({
      where: { accountId: account.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const closedPositions = await prisma.paperPosition.findMany({
      where: { accountId: account.id, status: "CLOSED" },
      orderBy: { closedAt: "desc" },
      take: 50,
    });

    return reply.send({
      ok: true,
      orders: orders.map((o: any) => ({
        ...o,
        createdAt: o.createdAt?.toISOString(),
        filledAt: o.filledAt?.toISOString(),
      })),
      closedPositions: closedPositions.map((p: any) => ({
        ...p,
        openedAt: p.openedAt?.toISOString(),
        closedAt: p.closedAt?.toISOString(),
      })),
    });
  });

  app.get("/trading/lobby-feed/:lobbyId", async (req, reply) => {
    const lobbyId = String((req as any).params?.lobbyId || "");
    const mode = parseMode(req);

    const since = new Date(Date.now() - 6 * 60 * 60 * 1000);

    const [orders, closedPositions] = await Promise.all([
      prisma.paperOrder.findMany({
        where: {
          status: "FILLED",
          filledAt: { gte: since },
          account: { lobbyId, competitionId: null, mode },
        },
        include: { account: { select: { userId: true, mode: true } } },
        orderBy: { filledAt: "desc" },
        take: 60,
      }),
      prisma.paperPosition.findMany({
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

    const userIds = Array.from(
      new Set([
        ...orders.map((o: any) => o.account.userId),
        ...closedPositions.map((p: any) => p.account.userId),
      ]),
    );
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, avatarColor: true, avatar: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

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

  app.post("/trading/reset/:lobbyId", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const lobbyId = String((req as any).params?.lobbyId || "");
    const mode = parseMode(req);
    const startBal = startBalanceFor(mode);

    const account = await prisma.paperAccount.findFirst({
      where: { userId: u.id, lobbyId, competitionId: null, mode },
    });
    if (!account) return reply.send({ ok: true });

    await prisma.paperPosition.deleteMany({ where: { accountId: account.id } });
    await prisma.paperOrder.deleteMany({ where: { accountId: account.id } });
    await prisma.paperAccount.update({
      where: { id: account.id },
      data: { cashBalance: startBal, startBalance: startBal, realizedPnl: 0 },
    });

    return reply.send({ ok: true });
  });

  app.post("/trading/competition/:lobbyId", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const lobbyId = String((req as any).params?.lobbyId || "");
    const body: any = (req as any).body || {};

    const comp = await prisma.tradingCompetition.create({
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

    return reply.send({
      ok: true,
      competition: {
        ...comp,
        startTime: comp.startTime.toISOString(),
        endTime: comp.endTime.toISOString(),
        createdAt: comp.createdAt.toISOString(),
      },
    });
  });

  app.get("/trading/competitions/:lobbyId", async (req, reply) => {
    const lobbyId = String((req as any).params?.lobbyId || "");

    const comps = await prisma.tradingCompetition.findMany({
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

  app.post("/trading/competition/:compId/join", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const compId = String((req as any).params?.compId || "");

    const comp = await prisma.tradingCompetition.findUnique({ where: { id: compId } });
    if (!comp) return reply.code(404).send({ ok: false, error: "not_found" });
    if (comp.status === "ENDED")
      return reply.code(400).send({ ok: false, error: "competition_ended" });

    const existing = await prisma.paperAccount.findFirst({
      where: { userId: u.id, lobbyId: comp.lobbyId, competitionId: compId },
    });
    if (existing)
      return reply.send({ ok: true, accountId: existing.id, message: "already_enrolled" });

    const account = await prisma.paperAccount.create({
      data: {
        userId: u.id,
        lobbyId: comp.lobbyId,
        competitionId: compId,
        cashBalance: comp.startBalance,
        startBalance: comp.startBalance,
        realizedPnl: 0,
      },
    });

    return reply.send({ ok: true, accountId: account.id });
  });

  app.get("/trading/competition/:compId/leaderboard", async (req, reply) => {
    const compId = String((req as any).params?.compId || "");

    const accounts = await prisma.paperAccount.findMany({
      where: { competitionId: compId },
      include: { positions: { where: { status: "OPEN" } } },
    });

    const userIds = accounts.map((a: any) => a.userId);
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, avatarColor: true, avatar: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const leaderboard = accounts.map((a: any) => {
      let unrealizedPnl = 0;
      for (const p of a.positions) {
        const cp = getLivePrice(p.symbol);
        if (cp) {
          unrealizedPnl +=
            p.side === "BUY" ? (cp - p.entryPrice) * p.quantity : (p.entryPrice - cp) * p.quantity;
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
        openPositions: a.positions.length,
      };
    });

    leaderboard.sort((a: any, b: any) => b.totalPnl - a.totalPnl);
    return reply.send({ ok: true, leaderboard });
  });

  setInterval(async () => {
    try {
      const now = new Date();
      await prisma.tradingCompetition.updateMany({
        where: { status: "UPCOMING", startTime: { lte: now } },
        data: { status: "ACTIVE" },
      });
      const ending = await prisma.tradingCompetition.findMany({
        where: { status: "ACTIVE", endTime: { lte: now } },
      });
      for (const comp of ending) {
        await prisma.tradingCompetition.update({
          where: { id: comp.id },
          data: { status: "ENDED" },
        });
        const accounts = await prisma.paperAccount.findMany({
          where: { competitionId: comp.id },
          include: { positions: { where: { status: "OPEN" } } },
        });
        const ranked = accounts
          .map((a: any) => {
            let unrealizedPnl = 0;
            for (const p of a.positions) {
              const cp = getLivePrice(p.symbol);
              if (cp)
                unrealizedPnl +=
                  p.side === "BUY"
                    ? (cp - p.entryPrice) * p.quantity
                    : (p.entryPrice - cp) * p.quantity;
            }
            return { userId: a.userId, totalPnl: a.cashBalance + unrealizedPnl - a.startBalance };
          })
          .sort((a: any, b: any) => b.totalPnl - a.totalPnl);
        const prizes = [500, 250, 100];
        for (let i = 0; i < Math.min(3, ranked.length); i++) {
          if (ranked[i].totalPnl > 0) {
            awardPaper(
              ranked[i].userId,
              "EARN_COMPETITION",
              prizes[i],
              `${i === 0 ? "1st" : i === 1 ? "2nd" : "3rd"} place: ${comp.name}`,
              comp.id,
            ).catch(swallow);
          }
        }
        log.log(`[trading] Competition "${comp.name}" ended — ${ranked.length} participants`);
      }
    } catch (e) {
      log.error("[trading] competition worker error:", e);
    }
  }, 60 * 1000);

  setInterval(async () => {
    try {
      const pending = await prisma.paperOrder.findMany({
        where: { status: "PENDING" },
        include: { account: { include: { positions: { where: { status: "OPEN" } } } } },
      });
      for (const order of pending) {
        const cp = getLivePrice(order.symbol);
        if (!cp) continue;
        if (order.price == null) continue;

        let shouldFill = false;
        if (order.orderType === "LIMIT") {
          if (order.side === "BUY" && cp <= order.price) shouldFill = true;
          if (order.side === "SELL" && cp >= order.price) shouldFill = true;
        } else if (order.orderType === "STOP") {
          if (order.side === "BUY" && cp >= order.price) shouldFill = true;
          if (order.side === "SELL" && cp <= order.price) shouldFill = true;
        }

        if (shouldFill) {
          const fillPrice = order.price;
          const cost = fillPrice * order.quantity;

          // Guarded margin debit + fill in one transaction: a concurrent market order
          // can't overdraft the account, and a filled order can't be double-counted.
          try {
            await prisma.$transaction(async (tx: any) => {
              const debited = await tx.paperAccount.updateMany({
                where: { id: order.accountId, cashBalance: { gte: cost } },
                data: { cashBalance: { decrement: cost } },
              });
              if (debited.count === 0) throw new Error("INSUFFICIENT_FUNDS");
              await tx.paperPosition.create({
                data: {
                  accountId: order.accountId,
                  symbol: order.symbol,
                  side: order.side,
                  quantity: order.quantity,
                  entryPrice: fillPrice,
                  entryValue: cost,
                },
              });
              await tx.paperOrder.update({
                where: { id: order.id },
                data: { status: "FILLED", filledPrice: fillPrice, filledAt: new Date() },
              });
            });
          } catch (e: any) {
            if (e && e.message === "INSUFFICIENT_FUNDS") continue; // can't afford now; leave PENDING for a later tick
            throw e;
          }

          notifyUser(order.account.userId, {
            type: "trading:order_filled",
            orderId: order.id,
            symbol: order.symbol,
            side: order.side,
            quantity: order.quantity,
            price: fillPrice,
          });
        }
      }
    } catch (e) {
      log.error("[trading] limit fill check error:", e);
    }
  }, 5000);

  setInterval(async () => {
    try {
      const positions = await prisma.paperPosition.findMany({
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
          if (pos.stopLoss !== null && cp <= pos.stopLoss) trigger = "STOP_LOSS";
          else if (pos.takeProfit !== null && cp >= pos.takeProfit) trigger = "TAKE_PROFIT";
        } else {
          if (pos.stopLoss !== null && cp >= pos.stopLoss) trigger = "STOP_LOSS";
          else if (pos.takeProfit !== null && cp <= pos.takeProfit) trigger = "TAKE_PROFIT";
        }
        if (!trigger) continue;

        const exitPrice = trigger === "STOP_LOSS" ? pos.stopLoss : pos.takeProfit;
        if (exitPrice == null) continue;
        const pnl =
          pos.side === "BUY"
            ? (exitPrice - pos.entryPrice) * pos.quantity
            : (pos.entryPrice - exitPrice) * pos.quantity;

        try {
          await prisma.paperPosition.update({
            where: { id: pos.id },
            data: {
              status: "CLOSED",
              exitPrice,
              realizedPnl: pnl,
              closedAt: new Date(),
              closeReason: trigger,
            },
          });
          await prisma.paperAccount.update({
            where: { id: pos.accountId },
            data: {
              cashBalance: { increment: pos.entryValue + pnl },
              realizedPnl: { increment: pnl },
            },
          });
        } catch (e) {
          log.error("[trading] sl/tp close error:", e);
          continue;
        }

        const accountMode: PaperMode = pos.account?.mode === "RANKED" ? "RANKED" : "CASUAL";
        const paperMul = paperRateMultiplierFor(accountMode);
        if (pnl > 0) {
          const paperEarned = Math.max(1, Math.floor(pnl / 100)) * paperMul;
          awardPaper(
            pos.account.userId,
            "EARN_FAKEOUT",
            paperEarned,
            `FakeOut ${trigger === "TAKE_PROFIT" ? "TP" : "SL"} hit: $${pnl.toFixed(2)} on ${pos.symbol}`,
            pos.id,
          ).catch(swallow);
          if (accountMode === "RANKED")
            awardNotoriety(pos.account.userId, "FAKEOUT_PROFIT").catch(swallow);
        }

        notifyUser(pos.account.userId, {
          type: "trading:position_closed",
          positionId: pos.id,
          reason: trigger,
          pnl,
          exitPrice,
        });
        const lookupUser = await prisma.user.findUnique({
          where: { id: pos.account.userId },
          select: { name: true },
        });
        const userName = lookupUser?.name || "trader";
        broadcastToLobby(pos.account.lobbyId, {
          type: "trading:trade",
          userId: pos.account.userId,
          userName,
          symbol: pos.symbol,
          side: pos.side === "BUY" ? "SELL" : "BUY",
          quantity: pos.quantity,
          price: exitPrice,
          notional: pos.quantity * exitPrice,
          time: Date.now(),
          closeReason: trigger,
          pnl,
        });

        if (operatorCommentateOnTrade && Math.abs(pnl) >= 500) {
          const sym = pos.symbol.replace(/USDT$/, "");
          const ctx =
            trigger === "TAKE_PROFIT"
              ? `${userName} just hit take-profit on ${sym} for +$${pnl.toFixed(0)}.`
              : `${userName} just got stopped out on ${sym} for -$${Math.abs(pnl).toFixed(0)}.`;
          operatorCommentateOnTrade(pos.account.lobbyId, ctx).catch(swallow);
        }
      }
    } catch (e) {
      log.error("[trading] sl/tp worker error:", e);
    }
  }, 5000);
}
