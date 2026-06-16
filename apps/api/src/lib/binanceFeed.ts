import { WebSocket as WsClient } from "ws";
import { send, type Sock } from "./roomState";
import { log, swallow } from "./logger";

// Binance live-price feed (FakeOut paper-trading source), extracted from
// main(). Maintains one upstream WS per subscribed symbol and fans out
// trade/kline ticks to the Socks in symbolSubscribers. State maps are
// exported so the trading routes + WS dispatcher + shutdown loop share them.

export const BINANCE_WS_BASE = "wss://stream.binance.com:9443";
export const BINANCE_REST = "https://api.binance.com";

export const livePrices = new Map<string, { price: number; time: number }>();
export const binanceSubs = new Map<string, WsClient>();
export const symbolSubscribers = new Map<string, Set<Sock>>();

export const DEFAULT_SYMBOLS = [
  "btcusdt",
  "ethusdt",
  "solusdt",
  "dogeusdt",
  "bnbusdt",
  "xrpusdt",
  "adausdt",
  "avaxusdt",
  "maticusdt",
  "linkusdt",
];

export function subscribeBinanceSymbol(symbol: string) {
  const sym = symbol.toLowerCase();
  if (binanceSubs.has(sym)) return;

  const wsUrl = `${BINANCE_WS_BASE}/ws/${sym}@kline_1m/${sym}@trade`;
  const upstream = new WsClient(wsUrl);

  upstream.on("open", () => {
    log.log(`[trading] Binance WS connected: ${sym}`);
  });

  upstream.on("message", (raw: Buffer) => {
    try {
      const data = JSON.parse(raw.toString());
      if (data.e === "trade") {
        const price = parseFloat(data.p);
        livePrices.set(sym, { price, time: Date.now() });
        const subs = symbolSubscribers.get(sym);
        if (subs && subs.size > 0) {
          const msg = {
            type: "trading:price",
            symbol: sym.toUpperCase(),
            price,
            time: data.T,
            qty: parseFloat(data.q),
          };
          for (const sock of subs) {
            try {
              send(sock, msg);
            } catch (e) {
              swallow(e);
            }
          }
        }
      } else if (data.e === "kline") {
        const k = data.k;
        const subs = symbolSubscribers.get(sym);
        if (subs && subs.size > 0) {
          const msg = {
            type: "trading:kline",
            symbol: sym.toUpperCase(),
            time: k.t / 1000,
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: parseFloat(k.c),
            volume: parseFloat(k.v),
            closed: k.x,
          };
          for (const sock of subs) {
            try {
              send(sock, msg);
            } catch (e) {
              swallow(e);
            }
          }
        }
      }
    } catch (e) {
      swallow(e);
    }
  });

  upstream.on("close", () => {
    log.log(`[trading] Binance WS closed: ${sym}, reconnecting in 5s`);
    binanceSubs.delete(sym);
    setTimeout(() => subscribeBinanceSymbol(sym), 5000);
  });

  upstream.on("error", (e: any) => {
    log.error(`[trading] Binance WS error: ${sym}`, e.message);
  });

  binanceSubs.set(sym, upstream);
}
