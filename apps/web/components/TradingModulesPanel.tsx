"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { getWeeredClient } from "../app/weeredClient";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

function authHeaders(): Record<string, string> {
  try { const t = localStorage.getItem("weered_token") || ""; return t ? { Authorization: `Bearer ${t}` } : {}; } catch { return {}; }
}
async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, { ...opts, headers: { "Content-Type": "application/json", ...authHeaders(), ...(opts?.headers || {}) } });
  return r.json();
}

// ── Styles ──────────────────────────────────────────────────────────────────

const S = {
  card: { borderRadius: 10, border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.03)", padding: "10px 12px" } as React.CSSProperties,
  btn: { padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.05)", fontSize: 12, cursor: "pointer", color: "rgba(243,244,246,.88)" } as React.CSSProperties,
  input: { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,.10)", background: "rgba(0,0,0,.30)", fontSize: 13, color: "rgba(243,244,246,.92)", outline: "none", boxSizing: "border-box" as const },
  label: { fontSize: 10, fontWeight: 700, opacity: 0.45, letterSpacing: ".7px", textTransform: "uppercase" as const, marginBottom: 6 } as React.CSSProperties,
};

const GREEN = "#22c55e";
const RED = "#ef4444";
const ACCENT = "#F5C518"; // gold — trading vibe

// ── Price formatter ─────────────────────────────────────────────────────────

function fmtPrice(p: number | null | undefined): string {
  if (p == null) return "—";
  if (p >= 1) return p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return p.toFixed(6);
}
function fmtPnl(n: number): string {
  const prefix = n >= 0 ? "+" : "";
  return `${prefix}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtPct(n: number): string {
  const prefix = n >= 0 ? "+" : "";
  return `${prefix}${n.toFixed(2)}%`;
}

// ── Chart component (TradingView lightweight-charts) ────────────────────────

function PriceChart({ symbol, accent }: { symbol: string; accent: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let chart: any = null;
    let candleSeries: any = null;
    let volumeSeries: any = null;
    let cleanup = false;

    (async () => {
      // Dynamic import to avoid SSR issues
      const lc = await import("lightweight-charts");
      if (cleanup) return;

      chart = lc.createChart(containerRef.current!, {
        width: containerRef.current!.clientWidth,
        height: 340,
        layout: {
          background: { type: lc.ColorType.Solid, color: "transparent" },
          textColor: "rgba(243,244,246,.5)",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: "rgba(255,255,255,.04)" },
          horzLines: { color: "rgba(255,255,255,.04)" },
        },
        crosshair: { mode: lc.CrosshairMode.Normal },
        rightPriceScale: {
          borderColor: "rgba(255,255,255,.08)",
        },
        timeScale: {
          borderColor: "rgba(255,255,255,.08)",
          timeVisible: true,
          secondsVisible: false,
        },
      });
      chartRef.current = chart;

      // v5 API: addSeries(SeriesType, options)
      candleSeries = chart.addSeries(lc.CandlestickSeries, {
        upColor: GREEN,
        downColor: RED,
        borderUpColor: GREEN,
        borderDownColor: RED,
        wickUpColor: GREEN,
        wickDownColor: RED,
      });
      candleSeriesRef.current = candleSeries;

      volumeSeries = chart.addSeries(lc.HistogramSeries, {
        color: "rgba(80,200,255,.15)",
        priceFormat: { type: "volume" },
        priceScaleId: "",
      });
      volumeSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });
      volumeSeriesRef.current = volumeSeries;

      // Load historical candles
      try {
        const data = await apiFetch(`/trading/candles?symbol=${symbol}&interval=1m&limit=300`);
        if (data.ok && data.candles?.length) {
          candleSeries.setData(data.candles);
          volumeSeries.setData(data.candles.map((c: any) => ({
            time: c.time,
            value: c.volume,
            color: c.close >= c.open ? "rgba(34,197,94,.20)" : "rgba(239,68,68,.20)",
          })));
          chart.timeScale().fitContent();
        }
      } catch (e) { console.error("[chart] candle load failed:", e); }

      // Subscribe to real-time kline updates via WS
      const wc = getWeeredClient();
      wc.send("trading:subscribe", { symbol: symbol.toUpperCase() });

      const handleKline = (msg: any) => {
        if (msg.symbol !== symbol.toUpperCase()) return;
        if (candleSeriesRef.current) {
          candleSeriesRef.current.update({
            time: msg.time,
            open: msg.open,
            high: msg.high,
            low: msg.low,
            close: msg.close,
          });
        }
        if (volumeSeriesRef.current) {
          volumeSeriesRef.current.update({
            time: msg.time,
            value: msg.volume,
            color: msg.close >= msg.open ? "rgba(34,197,94,.20)" : "rgba(239,68,68,.20)",
          });
        }
      };

      const unsub = wc.on("trading:kline", handleKline);

      // Resize observer
      const ro = new ResizeObserver(() => {
        if (chart && containerRef.current) {
          chart.applyOptions({ width: containerRef.current.clientWidth });
        }
      });
      ro.observe(containerRef.current!);

      // Store cleanup refs
      (containerRef.current as any).__cleanup = () => {
        unsub();
        wc.send("trading:unsubscribe", { symbol: symbol.toUpperCase() });
        ro.disconnect();
        chart.remove();
      };
    })();

    return () => {
      cleanup = true;
      if ((containerRef.current as any)?.__cleanup) {
        (containerRef.current as any).__cleanup();
      }
    };
  }, [symbol]);

  return <div ref={containerRef} style={{ width: "100%", borderRadius: 10, overflow: "hidden" }} />;
}

// ── Symbol Selector ─────────────────────────────────────────────────────────

type SymInfo = { symbol: string; name: string; icon: string; price: number | null };

function SymbolBar({ symbols, selected, onSelect, livePrice }: {
  symbols: SymInfo[];
  selected: string;
  onSelect: (s: string) => void;
  livePrice: number | null;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {symbols.map(s => (
          <button
            key={s.symbol}
            onClick={() => onSelect(s.symbol)}
            style={{
              ...S.btn,
              padding: "4px 10px",
              fontSize: 11,
              fontWeight: s.symbol === selected ? 700 : 400,
              background: s.symbol === selected ? "rgba(245,197,24,.15)" : "rgba(255,255,255,.03)",
              border: s.symbol === selected ? "1px solid rgba(245,197,24,.40)" : "1px solid rgba(255,255,255,.06)",
              color: s.symbol === selected ? ACCENT : "rgba(243,244,246,.6)",
            }}
          >
            {s.icon} {s.name}
          </button>
        ))}
      </div>
      {livePrice != null && (
        <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "monospace", color: "rgba(243,244,246,.95)", letterSpacing: "-0.5px" }}>
          ${fmtPrice(livePrice)}
        </div>
      )}
    </div>
  );
}

// ── Order Entry ─────────────────────────────────────────────────────────────

function OrderEntry({ symbol, lobbyId, livePrice, onTrade }: {
  symbol: string;
  lobbyId: string;
  livePrice: number | null;
  onTrade: () => void;
}) {
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [usdAmount, setUsdAmount] = useState("1000");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const quantity = livePrice && parseFloat(usdAmount) > 0 ? parseFloat(usdAmount) / livePrice : 0;

  async function placeOrder() {
    let price = livePrice;
    // Fallback: fetch price if WS feed isn't connected
    if (!price) {
      try {
        const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
        const j = await r.json();
        price = parseFloat(j.price);
      } catch {}
    }
    const qty = price && parseFloat(usdAmount) > 0 ? parseFloat(usdAmount) / price : 0;
    if (!price || qty <= 0) return;
    setLoading(true);
    setResult(null);
    const j = await apiFetch(`/trading/order/${lobbyId}`, {
      method: "POST",
      body: JSON.stringify({ symbol, side, orderType: "MARKET", quantity: qty }),
    });
    setLoading(false);
    if (j.ok) {
      setResult({ ok: true, msg: `${side} ${quantity.toFixed(6)} ${symbol} @ $${fmtPrice(j.filled.price)}` });
      onTrade();
    } else {
      setResult({ ok: false, msg: j.error || "Order failed" });
    }
  }

  const presets = [100, 500, 1000, 5000, 10000];

  return (
    <div style={{ ...S.card, marginBottom: 10 }}>
      <div style={S.label}>TRADE</div>

      {/* Side toggle */}
      <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
        <button
          onClick={() => setSide("BUY")}
          style={{
            flex: 1, padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer",
            fontWeight: 700, fontSize: 13,
            background: side === "BUY" ? GREEN : "rgba(255,255,255,.05)",
            color: side === "BUY" ? "#fff" : "rgba(243,244,246,.4)",
          }}
        >
          LONG
        </button>
        <button
          onClick={() => setSide("SELL")}
          style={{
            flex: 1, padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer",
            fontWeight: 700, fontSize: 13,
            background: side === "SELL" ? RED : "rgba(255,255,255,.05)",
            color: side === "SELL" ? "#fff" : "rgba(243,244,246,.4)",
          }}
        >
          SHORT
        </button>
      </div>

      {/* USD Amount */}
      <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
        {presets.map(p => (
          <button
            key={p}
            onClick={() => setUsdAmount(String(p))}
            style={{
              ...S.btn, padding: "3px 8px", fontSize: 10,
              background: usdAmount === String(p) ? "rgba(245,197,24,.12)" : undefined,
              borderColor: usdAmount === String(p) ? "rgba(245,197,24,.3)" : undefined,
            }}
          >
            ${p.toLocaleString()}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "rgba(243,244,246,.3)", fontSize: 13, fontWeight: 600 }}>$</span>
          <input
            style={{ ...S.input, paddingLeft: 22 }}
            value={usdAmount}
            onChange={e => setUsdAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="USD amount"
          />
        </div>
      </div>

      {quantity > 0 && livePrice && (
        <div style={{ fontSize: 11, opacity: 0.4, marginBottom: 8 }}>
          ≈ {quantity < 0.001 ? quantity.toFixed(8) : quantity.toFixed(6)} {symbol.replace("USDT", "")} @ ${fmtPrice(livePrice)}
        </div>
      )}

      <button
        onClick={placeOrder}
        disabled={loading || parseFloat(usdAmount) <= 0}
        style={{
          width: "100%", padding: "10px 0", borderRadius: 8, border: "none", cursor: "pointer",
          fontWeight: 700, fontSize: 14, letterSpacing: ".3px",
          background: side === "BUY"
            ? "linear-gradient(135deg, #22c55e, #16a34a)"
            : "linear-gradient(135deg, #ef4444, #dc2626)",
          color: "#fff",
          opacity: loading ? 0.5 : 1,
        }}
      >
        {loading ? "Executing..." : `${side === "BUY" ? "LONG" : "SHORT"} ${symbol.replace("USDT", "")}`}
      </button>

      {result && (
        <div style={{
          marginTop: 8, padding: "6px 10px", borderRadius: 8, fontSize: 11,
          background: result.ok ? "rgba(34,197,94,.10)" : "rgba(239,68,68,.10)",
          color: result.ok ? GREEN : RED,
          border: `1px solid ${result.ok ? "rgba(34,197,94,.2)" : "rgba(239,68,68,.2)"}`,
        }}>
          {result.msg}
        </div>
      )}
    </div>
  );
}

// ── Positions ───────────────────────────────────────────────────────────────

function Positions({ positions, lobbyId, onClose }: { positions: any[]; lobbyId: string; onClose: () => void }) {
  const [closing, setClosing] = useState<string | null>(null);

  async function closePosition(posId: string) {
    setClosing(posId);
    await apiFetch(`/trading/close/${lobbyId}/${posId}`, { method: "POST", body: JSON.stringify({}) });
    setClosing(null);
    onClose();
  }

  if (!positions.length) return (
    <div style={{ padding: 16, textAlign: "center", opacity: 0.3, fontSize: 12 }}>No open positions</div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {positions.map((p: any) => {
        const pnl = p.unrealizedPnl || 0;
        const pnlPct = p.entryValue > 0 ? (pnl / p.entryValue) * 100 : 0;
        const isProfit = pnl >= 0;
        return (
          <div key={p.id} style={{ ...S.card, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700,
              background: p.side === "BUY" ? "rgba(34,197,94,.15)" : "rgba(239,68,68,.15)",
              color: p.side === "BUY" ? GREEN : RED,
            }}>
              {p.side === "BUY" ? "LONG" : "SHORT"}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(243,244,246,.9)" }}>{p.symbol.replace("USDT", "")}</div>
              <div style={{ fontSize: 10, opacity: 0.4 }}>
                {p.quantity < 0.01 ? p.quantity.toFixed(6) : p.quantity.toFixed(4)} @ ${fmtPrice(p.entryPrice)}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, fontWeight: 700, fontFamily: "monospace", color: isProfit ? GREEN : RED }}>
                {fmtPnl(pnl)}
              </div>
              <div style={{ fontSize: 10, fontFamily: "monospace", color: isProfit ? GREEN : RED, opacity: 0.7 }}>
                {fmtPct(pnlPct)}
              </div>
            </div>
            <button
              onClick={() => closePosition(p.id)}
              disabled={closing === p.id}
              style={{
                ...S.btn, padding: "4px 8px", fontSize: 10, fontWeight: 600,
                color: "rgba(239,68,68,.8)", borderColor: "rgba(239,68,68,.2)", background: "rgba(239,68,68,.05)",
              }}
            >
              {closing === p.id ? "..." : "CLOSE"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ── Account Summary ─────────────────────────────────────────────────────────

function AccountSummary({ account, paperBalance, onReset }: { account: any; paperBalance?: number; onReset: () => void }) {
  if (!account) return null;
  const isProfit = account.totalPnl >= 0;
  return (
    <div style={{ ...S.card, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <div style={S.label}>PORTFOLIO</div>
        <button onClick={onReset} style={{ ...S.btn, padding: "2px 8px", fontSize: 9, opacity: 0.4 }}>RESET</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <div>
          <div style={{ fontSize: 10, opacity: 0.35 }}>Equity</div>
          <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "monospace", color: "rgba(243,244,246,.95)" }}>
            ${account.equity?.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, opacity: 0.35 }}>Total P&L</div>
          <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "monospace", color: isProfit ? GREEN : RED }}>
            {fmtPnl(account.totalPnl)} <span style={{ fontSize: 11 }}>({fmtPct(account.pnlPercent)})</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, opacity: 0.35 }}>Cash</div>
          <div style={{ fontSize: 12, fontFamily: "monospace", color: "rgba(243,244,246,.7)" }}>
            ${account.cashBalance?.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, opacity: 0.35 }}>Unrealized</div>
          <div style={{ fontSize: 12, fontFamily: "monospace", color: account.unrealizedPnl >= 0 ? GREEN : RED }}>
            {fmtPnl(account.unrealizedPnl)}
          </div>
        </div>
      </div>
      {paperBalance !== undefined && (
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(245,197,24,.12)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 10, color: "#F5C518", opacity: 0.7 }}>Paper Balance</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#F5C518", fontFamily: "monospace" }}>{(paperBalance ?? 0).toLocaleString()} 💵</span>
        </div>
      )}
    </div>
  );
}

// ── Leaderboard ─────────────────────────────────────────────────────────────

function Leaderboard({ lobbyId }: { lobbyId: string }) {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    apiFetch(`/trading/leaderboard/${lobbyId}`).then(j => {
      if (j.ok) setEntries(j.leaderboard || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [lobbyId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 10000); // refresh every 10s
    return () => clearInterval(iv);
  }, [load]);

  if (loading) return <div style={{ padding: 20, textAlign: "center", opacity: 0.3, fontSize: 12 }}>Loading leaderboard...</div>;
  if (!entries.length) return <div style={{ padding: 20, textAlign: "center", opacity: 0.3, fontSize: 12 }}>No traders yet — be the first</div>;

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {entries.map((e, i) => {
        const isProfit = e.totalPnl >= 0;
        return (
          <div key={e.userId} style={{
            ...S.card, padding: "8px 10px",
            display: "flex", alignItems: "center", gap: 8,
            border: i === 0 ? "1px solid rgba(245,197,24,.25)" : undefined,
            background: i === 0 ? "rgba(245,197,24,.05)" : undefined,
          }}>
            <div style={{ fontSize: 14, width: 28, textAlign: "center", fontWeight: 700, color: i < 3 ? ACCENT : "rgba(243,244,246,.3)" }}>
              {i < 3 ? medals[i] : `#${i + 1}`}
            </div>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: e.avatarColor || "rgba(255,255,255,.1)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700, color: "#fff",
            }}>
              {e.userName?.charAt(0)?.toUpperCase() || "?"}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(243,244,246,.9)" }}>{e.userName}</div>
              <div style={{ fontSize: 10, opacity: 0.35 }}>
                {e.openPositions} open · Equity: ${e.equity?.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace", color: isProfit ? GREEN : RED }}>
                {fmtPnl(e.totalPnl)}
              </div>
              <div style={{ fontSize: 10, fontFamily: "monospace", color: isProfit ? GREEN : RED, opacity: 0.7 }}>
                {fmtPct(e.pnlPercent)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Trade Feed (live trades from lobby members) ─────────────────────────────

function TradeFeed() {
  const [trades, setTrades] = useState<any[]>([]);

  useEffect(() => {
    const wc = getWeeredClient();
    const handler = (msg: any) => {
      setTrades(prev => [msg, ...prev].slice(0, 30));
    };
    const unsub = wc.on("trading:trade", handler);
    return unsub;
  }, []);

  if (!trades.length) return null;

  return (
    <div style={{ ...S.card, marginBottom: 10 }}>
      <div style={S.label}>LIVE TRADES</div>
      <div style={{ maxHeight: 120, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
        {trades.map((t, i) => (
          <div key={i} style={{ display: "flex", gap: 6, fontSize: 11, alignItems: "center" }}>
            <span style={{ fontWeight: 600, color: "rgba(243,244,246,.7)" }}>{t.userName}</span>
            <span style={{
              padding: "1px 4px", borderRadius: 3, fontSize: 9, fontWeight: 700,
              background: t.side === "BUY" ? "rgba(34,197,94,.15)" : "rgba(239,68,68,.15)",
              color: t.side === "BUY" ? GREEN : RED,
            }}>
              {t.side === "BUY" ? "LONG" : "SHORT"}
            </span>
            <span style={{ color: "rgba(243,244,246,.5)" }}>{t.symbol?.replace("USDT", "")}</span>
            <span style={{ fontFamily: "monospace", color: "rgba(243,244,246,.4)", fontSize: 10, marginLeft: "auto" }}>
              ${fmtPrice(t.price)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Panel ──────────────────────────────────────────────────────────────

type Tab = "trade" | "leaderboard" | "history";

export default function TradingModulesPanel({ lobbyId, accent }: { lobbyId: string; accent?: string }) {
  const accentColor = accent || ACCENT;
  const [tab, setTab] = useState<Tab>("trade");
  const [symbols, setSymbols] = useState<SymInfo[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState("BTCUSDT");
  const [account, setAccount] = useState<any>(null);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [history, setHistory] = useState<{ orders: any[]; closedPositions: any[] } | null>(null);
  const [paperBalance, setPaperBalance] = useState<number | undefined>(undefined);

  // Load Paper balance
  useEffect(() => {
    apiFetch("/paper/wallet").then(j => {
      if (j.balance !== undefined) setPaperBalance(j.balance);
    }).catch(() => {});
  }, []);

  // Load symbols
  useEffect(() => {
    apiFetch("/trading/symbols").then(j => {
      if (j.ok && j.symbols?.length) setSymbols(j.symbols);
    });
  }, []);

  // Load account
  const loadAccount = useCallback(() => {
    apiFetch(`/trading/account/${lobbyId}`).then(j => {
      if (j.ok) setAccount(j.account);
    });
  }, [lobbyId]);

  useEffect(() => {
    loadAccount();
    const iv = setInterval(loadAccount, 8000); // refresh P&L
    return () => clearInterval(iv);
  }, [loadAccount]);

  // Subscribe to live price for selected symbol
  useEffect(() => {
    const wc = getWeeredClient();
    const handler = (msg: any) => {
      if (msg.symbol === selectedSymbol) {
        setLivePrice(msg.price);
      }
    };
    const unsub = wc.on("trading:price", handler);
    wc.send("trading:subscribe", { symbol: selectedSymbol });

    return () => {
      unsub();
      wc.send("trading:unsubscribe", { symbol: selectedSymbol });
    };
  }, [selectedSymbol]);

  // Load history when tab changes
  useEffect(() => {
    if (tab === "history" && !history) {
      apiFetch(`/trading/history/${lobbyId}`).then(j => {
        if (j.ok) setHistory({ orders: j.orders || [], closedPositions: j.closedPositions || [] });
      });
    }
  }, [tab, lobbyId, history]);

  async function resetAccount() {
    if (!confirm("Reset your paper trading account? All positions and history will be cleared.")) return;
    await apiFetch(`/trading/reset/${lobbyId}`, { method: "POST" });
    setAccount(null);
    setHistory(null);
    loadAccount();
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: "trade", label: "Trade" },
    { id: "leaderboard", label: "Leaderboard" },
    { id: "history", label: "History" },
  ];

  return (
    <div style={{ padding: "0 1px" }}>
      {/* Tab bar */}
      <div style={{ display: "flex", gap: 2, marginBottom: 12, borderBottom: "1px solid rgba(255,255,255,.06)", paddingBottom: 6 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              ...S.btn, padding: "5px 12px", fontSize: 11,
              borderColor: tab === t.id ? `${accentColor}55` : undefined,
              background: tab === t.id ? `${accentColor}15` : undefined,
              color: tab === t.id ? accentColor : "rgba(243,244,246,.5)",
              fontWeight: tab === t.id ? 700 : 400,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "trade" && (
        <>
          {/* Symbol bar */}
          <SymbolBar
            symbols={symbols}
            selected={selectedSymbol}
            onSelect={setSelectedSymbol}
            livePrice={livePrice}
          />

          {/* Chart */}
          <div style={{ marginBottom: 10, borderRadius: 10, border: "1px solid rgba(255,255,255,.06)", overflow: "hidden" }}>
            <PriceChart symbol={selectedSymbol} accent={accentColor} />
          </div>

          {/* Trade feed */}
          <TradeFeed />

          {/* Account summary */}
          <AccountSummary account={account} paperBalance={paperBalance} onReset={resetAccount} />

          {/* Order entry */}
          <OrderEntry
            symbol={selectedSymbol}
            lobbyId={lobbyId}
            livePrice={livePrice}
            onTrade={loadAccount}
          />

          {/* Open positions */}
          {account?.positions?.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={S.label}>OPEN POSITIONS</div>
              <Positions positions={account.positions} lobbyId={lobbyId} onClose={() => {
                loadAccount();
                apiFetch("/paper/wallet").then(j => { if (j.balance !== undefined) setPaperBalance(j.balance); }).catch(() => {});
              }} />
            </div>
          )}
        </>
      )}

      {tab === "leaderboard" && <Leaderboard lobbyId={lobbyId} />}

      {tab === "history" && (
        <div>
          {!history ? (
            <div style={{ padding: 20, textAlign: "center", opacity: 0.3, fontSize: 12 }}>Loading...</div>
          ) : (
            <>
              {history.closedPositions.length > 0 && (
                <>
                  <div style={S.label}>CLOSED POSITIONS</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 16 }}>
                    {history.closedPositions.map((p: any) => {
                      const isProfit = (p.realizedPnl || 0) >= 0;
                      return (
                        <div key={p.id} style={{ ...S.card, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{
                            padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700,
                            background: p.side === "BUY" ? "rgba(34,197,94,.10)" : "rgba(239,68,68,.10)",
                            color: p.side === "BUY" ? GREEN : RED, opacity: 0.6,
                          }}>
                            {p.side === "BUY" ? "LONG" : "SHORT"}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(243,244,246,.7)" }}>{p.symbol.replace("USDT", "")}</div>
                            <div style={{ fontSize: 10, opacity: 0.35 }}>
                              ${fmtPrice(p.entryPrice)} → ${fmtPrice(p.exitPrice)}
                            </div>
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 700, fontFamily: "monospace", color: isProfit ? GREEN : RED }}>
                            {fmtPnl(p.realizedPnl || 0)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              <div style={S.label}>ORDER LOG</div>
              {history.orders.length === 0 ? (
                <div style={{ padding: 16, textAlign: "center", opacity: 0.3, fontSize: 12 }}>No orders yet</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {history.orders.map((o: any) => (
                    <div key={o.id} style={{ display: "flex", gap: 8, fontSize: 11, padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,.03)" }}>
                      <span style={{
                        padding: "1px 5px", borderRadius: 3, fontSize: 9, fontWeight: 700,
                        background: o.side === "BUY" ? "rgba(34,197,94,.12)" : "rgba(239,68,68,.12)",
                        color: o.side === "BUY" ? GREEN : RED,
                      }}>
                        {o.side}
                      </span>
                      <span style={{ color: "rgba(243,244,246,.7)" }}>{o.symbol.replace("USDT", "")}</span>
                      <span style={{ fontFamily: "monospace", opacity: 0.4, marginLeft: "auto" }}>
                        {o.filledPrice ? `$${fmtPrice(o.filledPrice)}` : o.status}
                      </span>
                      <span style={{ fontSize: 9, opacity: 0.25 }}>
                        {o.createdAt ? new Date(o.createdAt).toLocaleTimeString() : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Disclaimer */}
      <div style={{ marginTop: 20, padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.04)" }}>
        <div style={{ fontSize: 9, opacity: 0.25, lineHeight: 1.5 }}>
          FakeOut — paper trading only, no real money at risk. Market data provided by Binance. Prices are real-time but simulated trades have no market impact. Not financial advice.
        </div>
      </div>
    </div>
  );
}