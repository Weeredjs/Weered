import type { WebSocketServer } from "ws";

// Trading price-stream WebSocket (extracted from index.ts). A SEPARATE
// wss.on("connection") that attaches to every socket alongside the main
// handler, serving the FakeOut live price feed (trading:subscribe/unsubscribe).
// The engine deps (subscribeBinanceSymbol + the symbolSubscribers/livePrices
// maps + send + safeJson) live inside main() in index.ts and are injected.
type Opts = {
  send: (ws: any, msg: any) => void;
  safeJson: (raw: any) => any | null;
  subscribeBinanceSymbol: (symbol: string) => void;
  symbolSubscribers: Map<string, Set<any>>;
  livePrices: Map<string, { price: number; time: number }>;
};

export default function setupTradingSocket(wss: WebSocketServer, opts: Opts) {
  const { send, safeJson, subscribeBinanceSymbol, symbolSubscribers, livePrices } = opts;

  wss.on("connection", (rawWs) => {
    const ws = rawWs as any;
    (ws as any)._tradingSubs = new Set<string>();

    ws.on("message", (raw: any) => {
      const msg = safeJson(raw);
      if (!msg) return;

      if (msg.type === "trading:subscribe") {
        const sym = String(msg.symbol || "").toLowerCase();
        if (!sym) return;
        subscribeBinanceSymbol(sym);
        if (!symbolSubscribers.has(sym)) symbolSubscribers.set(sym, new Set());
        symbolSubscribers.get(sym)!.add(ws);
        (ws as any)._tradingSubs.add(sym);
        const p = livePrices.get(sym);
        if (p) send(ws, { type: "trading:price", symbol: sym.toUpperCase(), price: p.price, time: p.time });
      }

      if (msg.type === "trading:unsubscribe") {
        const sym = String(msg.symbol || "").toLowerCase();
        symbolSubscribers.get(sym)?.delete(ws);
        (ws as any)._tradingSubs?.delete(sym);
      }
    });

    ws.on("close", () => {
      const subs = (ws as any)._tradingSubs as Set<string> | undefined;
      if (subs) {
        for (const sym of subs) {
          symbolSubscribers.get(sym)?.delete(ws);
        }
      }
    });
  });
}
