"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { getWeeredClient } from "../app/weeredClient";
import { weeredConfirm } from "../lib/confirm";
import EmptyState from "./EmptyState";
import LoadingState from "./LoadingState";
import ModuleTabBar from "./ModuleTabBar";
import TheBrief, { useTheBrief } from "./TheBrief";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

function authHeaders(): Record<string, string> {
  try { const t = localStorage.getItem("weered_token") || ""; return t ? { Authorization: `Bearer ${t}` } : {}; } catch { return {}; }
}
async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, { ...opts, headers: { "Content-Type": "application/json", ...authHeaders(), ...(opts?.headers || {}) } });
  return r.json();
}

const S = {
  card: { borderRadius: 2, border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.03)", padding: "10px 12px" } as React.CSSProperties,
  btn: { padding: "6px 12px", borderRadius: 2, border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.05)", fontSize: 12, cursor: "pointer", color: "rgba(243,244,246,.88)" } as React.CSSProperties,
  input: { width: "100%", padding: "8px 12px", borderRadius: 2, border: "1px solid rgba(255,255,255,.10)", background: "rgba(0,0,0,.30)", fontSize: 13, color: "rgba(243,244,246,.92)", outline: "none", boxSizing: "border-box" as const },
  label: { fontSize: 10, fontWeight: 700, opacity: 0.45, letterSpacing: ".7px", textTransform: "uppercase" as const, marginBottom: 6 } as React.CSSProperties,
};

const GREEN = "#22c55e";
const RED = "#ef4444";
const ACCENT = "#F5C518";

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

const TIMEFRAMES: { id: string; label: string }[] = [
  { id: "1m",  label: "1m"  },
  { id: "5m",  label: "5m"  },
  { id: "15m", label: "15m" },
  { id: "1h",  label: "1h"  },
  { id: "4h",  label: "4h"  },
  { id: "1d",  label: "1D"  },
  { id: "1w",  label: "1W"  },
];

function PriceChart({ symbol, accent, timeframe = "1m" }: { symbol: string; accent: string; timeframe?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);

  function zoomIn() {
    const ts = chartRef.current?.timeScale();
    if (!ts) return;
    const range = ts.getVisibleLogicalRange();
    if (!range) return;
    const span = range.to - range.from;
    const next = span * 0.7;
    const center = (range.from + range.to) / 2;
    ts.setVisibleLogicalRange({ from: center - next / 2, to: center + next / 2 });
  }
  function zoomOut() {
    const ts = chartRef.current?.timeScale();
    if (!ts) return;
    const range = ts.getVisibleLogicalRange();
    if (!range) return;
    const span = range.to - range.from;
    const next = span * 1.4;
    const center = (range.from + range.to) / 2;
    ts.setVisibleLogicalRange({ from: center - next / 2, to: center + next / 2 });
  }
  function zoomReset() {
    chartRef.current?.timeScale()?.fitContent();
  }

  useEffect(() => {
    if (!containerRef.current) return;
    let chart: any = null;
    let candleSeries: any = null;
    let volumeSeries: any = null;
    let cleanup = false;

    (async () => {
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
        handleScroll: {
          mouseWheel: false,
          pressedMouseMove: true,
          horzTouchDrag: true,
          vertTouchDrag: false,
        },
        handleScale: {
          mouseWheel: false,
          pinch: true,
          axisPressedMouseMove: true,
          axisDoubleClickReset: true,
        },
      });
      chartRef.current = chart;

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

      try {
        const data = await apiFetch(`/trading/candles?symbol=${symbol}&interval=${timeframe}&limit=300`);
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

      const ro = new ResizeObserver(() => {
        if (chart && containerRef.current) {
          chart.applyOptions({ width: containerRef.current.clientWidth });
        }
      });
      ro.observe(containerRef.current!);

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
  }, [symbol, timeframe]);

  const zoomBtn: React.CSSProperties = {
    width: 26, height: 26, padding: 0,
    borderRadius: 2,
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(0,0,0,.55)",
    color: "rgba(243,244,246,.85)",
    fontSize: 13, fontWeight: 700, lineHeight: 1,
    cursor: "pointer",
    backdropFilter: "blur(6px)",
  };

  return (
    <div style={{ position: "relative" }}>
      <div ref={containerRef} style={{ width: "100%", borderRadius: 2, overflow: "hidden" }} />
      <div style={{ position: "absolute", top: 8, left: 8, display: "flex", gap: 4, zIndex: 2 }}>
        <button type="button" onClick={zoomReset}  style={{ ...zoomBtn, width: "auto", padding: "0 8px", fontSize: 10, letterSpacing: "0.5px" }} title="Fit content">FIT</button>
        <button type="button" onClick={zoomOut}    style={zoomBtn} aria-label="Zoom out" title="Zoom out">−</button>
        <button type="button" onClick={zoomIn}     style={zoomBtn} aria-label="Zoom in"  title="Zoom in">+</button>
      </div>
    </div>
  );
}

type SymInfo = { symbol: string; name: string; icon: string; price: number | null; assetClass?: "crypto" | "fx" | "metal"; comingSoon?: boolean };

function SymbolBar({ symbols, selected, onSelect, livePrice }: {
  symbols: SymInfo[];
  selected: string;
  onSelect: (s: string) => void;
  livePrice: number | null;
}) {
  const live = symbols.filter(s => !s.comingSoon);
  const soon = symbols.filter(s => s.comingSoon);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {live.map(s => (
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
      {soon.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ ...S.label, marginBottom: 0 }}>FX · soon</span>
          {soon.map(s => (
            <button
              key={s.symbol}
              type="button"
              disabled
              title="FX feeds wiring up — twelvedata polled mid-rate. Live shortly."
              style={{
                ...S.btn,
                padding: "4px 10px",
                fontSize: 11,
                opacity: 0.45,
                cursor: "not-allowed",
                background: "rgba(255,255,255,.02)",
                border: "1px dashed rgba(255,255,255,.08)",
                color: "rgba(243,244,246,.5)",
              }}
            >
              {s.icon} {s.name}
            </button>
          ))}
        </div>
      )}
      {livePrice != null && (
        <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "monospace", color: "rgba(243,244,246,.95)", letterSpacing: "-0.5px" }}>
          ${fmtPrice(livePrice)}
        </div>
      )}
    </div>
  );
}

function OrderEntry({ symbol, lobbyId, livePrice, mode, onTrade }: {
  symbol: string;
  lobbyId: string;
  livePrice: number | null;
  mode: "CASUAL" | "RANKED";
  onTrade: () => void;
}) {
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const defaultUsd = mode === "RANKED" ? "100" : "1000";
  const [usdAmount, setUsdAmount] = useState(defaultUsd);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [showExits, setShowExits] = useState(false);
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");

  const quantity = livePrice && parseFloat(usdAmount) > 0 ? parseFloat(usdAmount) / livePrice : 0;
  const slNum = stopLoss ? parseFloat(stopLoss) : null;
  const tpNum = takeProfit ? parseFloat(takeProfit) : null;
  const slRisk = (slNum != null && livePrice) ? (side === "BUY" ? (livePrice - slNum) : (slNum - livePrice)) * quantity : null;
  const tpReward = (tpNum != null && livePrice) ? (side === "BUY" ? (tpNum - livePrice) : (livePrice - tpNum)) * quantity : null;

  async function placeOrder() {
    let price = livePrice;
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
    const body: any = { symbol, side, orderType: "MARKET", quantity: qty, mode };
    if (slNum && slNum > 0) body.stopLoss = slNum;
    if (tpNum && tpNum > 0) body.takeProfit = tpNum;
    const j = await apiFetch(`/trading/order/${lobbyId}?mode=${mode}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    setLoading(false);
    if (j.ok) {
      setResult({ ok: true, msg: `${side} ${quantity.toFixed(6)} ${symbol} @ $${fmtPrice(j.filled.price)}` });
      onTrade();
      setStopLoss("");
      setTakeProfit("");
    } else {
      setResult({ ok: false, msg: j.message || j.error || "Order failed" });
    }
  }

  const presets = [100, 500, 1000, 5000, 10000];

  return (
    <div style={{ ...S.card, marginBottom: 10 }}>
      <div style={S.label}>TRADE</div>

      <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
        <button
          onClick={() => setSide("BUY")}
          style={{
            flex: 1, padding: "8px 0", borderRadius: 2, border: "none", cursor: "pointer",
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
            flex: 1, padding: "8px 0", borderRadius: 2, border: "none", cursor: "pointer",
            fontWeight: 700, fontSize: 13,
            background: side === "SELL" ? RED : "rgba(255,255,255,.05)",
            color: side === "SELL" ? "#fff" : "rgba(243,244,246,.4)",
          }}
        >
          SHORT
        </button>
      </div>

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

      <div style={{ marginBottom: 8 }}>
        <button
          type="button"
          onClick={() => setShowExits(s => !s)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "5px 10px", borderRadius: 2,
            cursor: "pointer",
            fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase",
            fontWeight: 800,
            border: showExits || slNum || tpNum
              ? "1px solid rgba(245,197,24,.45)"
              : "1px solid rgba(255,255,255,.14)",
            background: showExits || slNum || tpNum
              ? "rgba(245,197,24,.12)"
              : "rgba(255,255,255,.04)",
            color: showExits || slNum || tpNum
              ? "rgb(253,230,138)"
              : "rgba(243,244,246,.7)",
            transition: "all 0.12s",
          }}
          onMouseEnter={e => {
            if (showExits || slNum || tpNum) return;
            (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.07)";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(245,197,24,.30)";
            (e.currentTarget as HTMLElement).style.color = "rgba(253,230,138,.85)";
          }}
          onMouseLeave={e => {
            if (showExits || slNum || tpNum) return;
            (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.04)";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,.14)";
            (e.currentTarget as HTMLElement).style.color = "rgba(243,244,246,.7)";
          }}
        >
          <span style={{ fontSize: 11 }}>🛑</span>
          {showExits ? "Hide exits" : (slNum || tpNum) ? `Edit exits · ${slNum ? "SL" : ""}${slNum && tpNum ? "+" : ""}${tpNum ? "TP" : ""}` : "Set stop loss / take profit"}
          <span style={{ opacity: 0.5, fontSize: 9 }}>{showExits ? "▾" : "▸"}</span>
        </button>
        {showExits && (
          <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }}>
            <div>
              <div style={{ fontSize: 9, color: "rgba(243,244,246,0.4)", letterSpacing: ".4px", textTransform: "uppercase", marginBottom: 3 }}>
                Stop loss · {side === "BUY" ? "below" : "above"} {livePrice ? `$${fmtPrice(livePrice)}` : "entry"}
              </div>
              <input
                style={{ ...S.input, fontFamily: "monospace" }}
                value={stopLoss}
                onChange={e => setStopLoss(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder={side === "BUY" ? "lower trigger price" : "upper trigger price"}
              />
              {slRisk != null && Number.isFinite(slRisk) && slRisk > 0 && (
                <div style={{ fontSize: 10, color: RED, marginTop: 2, fontFamily: "monospace" }}>
                  exit risk: -${slRisk.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
              )}
            </div>
            <div>
              <div style={{ fontSize: 9, color: "rgba(243,244,246,0.4)", letterSpacing: ".4px", textTransform: "uppercase", marginBottom: 3 }}>
                Take profit · {side === "BUY" ? "above" : "below"} {livePrice ? `$${fmtPrice(livePrice)}` : "entry"}
              </div>
              <input
                style={{ ...S.input, fontFamily: "monospace" }}
                value={takeProfit}
                onChange={e => setTakeProfit(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder={side === "BUY" ? "upper trigger price" : "lower trigger price"}
              />
              {tpReward != null && Number.isFinite(tpReward) && tpReward > 0 && (
                <div style={{ fontSize: 10, color: GREEN, marginTop: 2, fontFamily: "monospace" }}>
                  exit reward: +${tpReward.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={placeOrder}
        disabled={loading || parseFloat(usdAmount) <= 0}
        style={{
          width: "100%", padding: "10px 0", borderRadius: 2, border: "none", cursor: "pointer",
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
          marginTop: 8, padding: "6px 10px", borderRadius: 2, fontSize: 11,
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

function Positions({ positions, lobbyId, onClose }: { positions: any[]; lobbyId: string; onClose: () => void }) {
  const [closing, setClosing] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function closePosition(posId: string) {
    setClosing(posId);
    await apiFetch(`/trading/close/${lobbyId}/${posId}`, { method: "POST", body: JSON.stringify({}) });
    setClosing(null);
    onClose();
  }

  if (!positions.length) return (
    <EmptyState compact title="No open positions." hint="Place a trade to get started." />
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {positions.map((p: any) => {
        const pnl = p.unrealizedPnl || 0;
        const pnlPct = p.entryValue > 0 ? (pnl / p.entryValue) * 100 : 0;
        const isProfit = pnl >= 0;
        const hasExits = p.stopLoss != null || p.takeProfit != null;
        return (
          <div key={p.id} style={{ ...S.card, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                padding: "2px 6px", borderRadius: 2, fontSize: 10, fontWeight: 700,
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

            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, fontFamily: "monospace", flexWrap: "wrap" }}>
              {p.stopLoss != null ? (
                <span title="Stop loss" style={{ padding: "1px 6px", borderRadius: 2, background: "rgba(239,68,68,.10)", border: "1px solid rgba(239,68,68,.25)", color: "rgba(252,165,165,.85)" }}>
                  SL ${fmtPrice(p.stopLoss)}
                </span>
              ) : (
                <span style={{ opacity: 0.3, padding: "1px 6px" }}>SL —</span>
              )}
              {p.takeProfit != null ? (
                <span title="Take profit" style={{ padding: "1px 6px", borderRadius: 2, background: "rgba(34,197,94,.10)", border: "1px solid rgba(34,197,94,.25)", color: "rgba(167,243,208,.85)" }}>
                  TP ${fmtPrice(p.takeProfit)}
                </span>
              ) : (
                <span style={{ opacity: 0.3, padding: "1px 6px" }}>TP —</span>
              )}
              <button
                type="button"
                onClick={() => setEditingId(editingId === p.id ? null : p.id)}
                style={{
                  marginLeft: "auto", background: "none", border: "none", padding: 0,
                  fontSize: 9, letterSpacing: ".4px", textTransform: "uppercase",
                  color: "rgba(255,255,255,.45)", fontWeight: 700, cursor: "pointer",
                }}
              >
                {editingId === p.id ? "▾ close" : (hasExits ? "▸ edit" : "▸ set exits")}
              </button>
            </div>
            {editingId === p.id && (
              <ExitsEditor
                position={p}
                onSaved={() => { setEditingId(null); onClose(); }}
                onCancel={() => setEditingId(null)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ExitsEditor({ position, onSaved, onCancel }: {
  position: any;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [sl, setSl] = useState(position.stopLoss != null ? String(position.stopLoss) : "");
  const [tp, setTp] = useState(position.takeProfit != null ? String(position.takeProfit) : "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    setSaving(true); setErr("");
    const body: any = {};
    body.stopLoss = sl === "" ? null : parseFloat(sl);
    body.takeProfit = tp === "" ? null : parseFloat(tp);
    const j = await apiFetch(`/trading/position/${position.id}/exits`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (j?.ok) onSaved();
    else setErr(j?.message || j?.error || "save failed");
  }

  return (
    <div style={{
      marginTop: 4, padding: 8, borderRadius: 2,
      border: "1px solid rgba(255,255,255,.06)", background: "rgba(0,0,0,.2)",
      display: "flex", flexDirection: "column", gap: 6,
    }}>
      <div style={{ display: "flex", gap: 6 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, color: "rgba(252,165,165,.8)", letterSpacing: ".4px", textTransform: "uppercase", marginBottom: 3 }}>
            Stop loss · {position.side === "BUY" ? "below" : "above"} ${fmtPrice(position.entryPrice)}
          </div>
          <input
            style={{ ...S.input, fontFamily: "monospace", fontSize: 11, padding: "6px 8px" }}
            value={sl}
            onChange={e => setSl(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="—"
          />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, color: "rgba(167,243,208,.85)", letterSpacing: ".4px", textTransform: "uppercase", marginBottom: 3 }}>
            Take profit · {position.side === "BUY" ? "above" : "below"} ${fmtPrice(position.entryPrice)}
          </div>
          <input
            style={{ ...S.input, fontFamily: "monospace", fontSize: 11, padding: "6px 8px" }}
            value={tp}
            onChange={e => setTp(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="—"
          />
        </div>
      </div>
      {err && <div style={{ fontSize: 10, color: RED }}>{err}</div>}
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={onCancel}
          style={{ ...S.btn, padding: "4px 10px", fontSize: 10 }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          style={{
            ...S.btn, padding: "4px 10px", fontSize: 10, fontWeight: 700,
            borderColor: "rgba(245,197,24,.30)", background: "rgba(245,197,24,.10)", color: "rgb(253,230,138)",
          }}
        >
          {saving ? "..." : "Save"}
        </button>
      </div>
    </div>
  );
}

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

function Leaderboard({ lobbyId, mode }: { lobbyId: string; mode: "CASUAL" | "RANKED" }) {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    apiFetch(`/trading/leaderboard/${lobbyId}?mode=${mode}`).then(j => {
      if (j.ok) setEntries(j.leaderboard || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [lobbyId, mode]);

  useEffect(() => {
    setLoading(true);
    load();
    const iv = setInterval(load, 10000);
    return () => clearInterval(iv);
  }, [load]);

  if (loading) return <div style={{ padding: 20, textAlign: "center", opacity: 0.3, fontSize: 12 }}>Loading leaderboard...</div>;
  if (!entries.length) return <EmptyState compact title="No traders yet." hint="Be the first on the board." />;

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

function LobbyPnlTicker({ lobbyId, mode }: { lobbyId: string; mode: "CASUAL" | "RANKED" }) {
  const [entries, setEntries] = useState<any[]>([]);

  useEffect(() => {
    let live = true;
    const load = () => {
      apiFetch(`/trading/leaderboard/${lobbyId}?mode=${mode}`).then(j => {
        if (!live) return;
        if (j.ok) setEntries((j.leaderboard || []).slice(0, 8));
      }).catch(() => {});
    };
    load();
    const iv = setInterval(load, 5000);
    return () => { live = false; clearInterval(iv); };
  }, [lobbyId, mode]);

  if (entries.length < 2) return null;

  const loop = [...entries, ...entries];
  const RANK_BADGES = ["1ST", "2ND", "3RD", "4TH", "5TH", "6TH", "7TH", "8TH"];

  return (
    <>
      <style>{`
        @keyframes pnlTickerScroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .pnl-ticker-track { animation: pnlTickerScroll 45s linear infinite; }
        .pnl-ticker-root:hover .pnl-ticker-track { animation-play-state: paused; }
      `}</style>
      <div
        className="pnl-ticker-root"
        style={{
          marginBottom: 10,
          padding: "6px 0 6px 0",
          paddingLeft: 76,
          borderRadius: 2,
          border: "1px solid rgba(255,255,255,.06)",
          borderLeft: `2px solid ${ACCENT}`,
          background: "linear-gradient(90deg, rgba(245,197,24,.04) 0%, rgba(245,197,24,.08) 50%, rgba(245,197,24,.04) 100%)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div style={{
          position: "absolute", left: 6, top: "50%", transform: "translateY(-50%)",
          zIndex: 3,
          padding: "3px 7px", borderRadius: 2,
          fontSize: 9, fontWeight: 800, letterSpacing: "0.6px", textTransform: "uppercase",
          border: `1px solid ${ACCENT}55`,
          background: mode === "RANKED" ? "rgba(245,197,24,.18)" : "rgba(255,255,255,.04)",
          color: mode === "RANKED" ? ACCENT : "rgba(243,244,246,.65)",
          fontFamily: "monospace",
          whiteSpace: "nowrap",
        }} title={mode === "RANKED" ? "Ranked $1K leaderboard" : "Casual $100K leaderboard"}>
          {mode === "RANKED" ? "RANKED" : "CASUAL"} · TOP {Math.min(entries.length, 8)}
        </div>
        <div style={{
          position: "absolute",
          top: 0, bottom: 0, left: 70,
          width: 24,
          background: "linear-gradient(90deg, rgba(11,11,16,.95), transparent)",
          pointerEvents: "none",
          zIndex: 2,
        }} />
        <div style={{
          position: "absolute",
          top: 0, bottom: 0, right: 0,
          width: 32,
          background: "linear-gradient(270deg, rgba(11,11,16,.95), transparent)",
          pointerEvents: "none",
          zIndex: 2,
        }} />
        <div className="pnl-ticker-track" style={{ display: "inline-flex", gap: 28, whiteSpace: "nowrap" }}>
          {loop.map((e: any, i: number) => {
            const isUp = (e.totalPnl || 0) >= 0;
            const color = isUp ? GREEN : RED;
            const idx = i % entries.length;
            return (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11, fontFamily: "monospace" }}>
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.5px", color: ACCENT, opacity: 0.65 }}>
                  {RANK_BADGES[idx] || `#${idx + 1}`}
                </span>
                <span style={{ fontWeight: 700, color: "rgba(243,244,246,.85)" }}>{e.userName || "—"}</span>
                <span style={{ fontWeight: 700, color }}>
                  {fmtPnl(e.totalPnl || 0)}
                </span>
                <span style={{ color, opacity: 0.7 }}>
                  ({fmtPct(e.pnlPercent || 0)})
                </span>
                {e.openPositions > 0 && (
                  <span style={{ fontSize: 9, color: "rgba(243,244,246,.35)", letterSpacing: "0.5px" }}>
                    {e.openPositions} OPEN
                  </span>
                )}
              </span>
            );
          })}
        </div>
      </div>
    </>
  );
}

type Tab = "trade" | "leaderboard" | "history";

type PaperMode = "CASUAL" | "RANKED";
const MODE_STORAGE_KEY = "weered:fakeout:mode";

export default function TradingModulesPanel({ lobbyId, accent }: { lobbyId: string; accent?: string }) {
  const accentColor = accent || ACCENT;
  const [tab, setTab] = useState<Tab>("trade");
  const [symbols, setSymbols] = useState<SymInfo[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState("BTCUSDT");
  const [selectedTimeframe, setSelectedTimeframe] = useState("1m");
  const [mode, setMode] = useState<PaperMode>(() => {
    if (typeof window === "undefined") return "CASUAL";
    try { return (localStorage.getItem(MODE_STORAGE_KEY) as PaperMode) === "RANKED" ? "RANKED" : "CASUAL"; }
    catch { return "CASUAL"; }
  });
  useEffect(() => {
    try { localStorage.setItem(MODE_STORAGE_KEY, mode); } catch {}
  }, [mode]);
  const [account, setAccount] = useState<any>(null);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [history, setHistory] = useState<{ orders: any[]; closedPositions: any[] } | null>(null);
  const [paperBalance, setPaperBalance] = useState<number | undefined>(undefined);

  const brief = useTheBrief();

  useEffect(() => {
    apiFetch("/paper/wallet").then(j => {
      if (j.balance !== undefined) setPaperBalance(j.balance);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    apiFetch("/trading/symbols").then(j => {
      if (j.ok && j.symbols?.length) setSymbols(j.symbols);
    });
  }, []);

  const loadAccount = useCallback(() => {
    apiFetch(`/trading/account/${lobbyId}?mode=${mode}`).then(j => {
      if (j.ok) setAccount(j.account);
    });
  }, [lobbyId, mode]);

  useEffect(() => {
    loadAccount();
    const iv = setInterval(loadAccount, 8000);
    return () => clearInterval(iv);
  }, [loadAccount]);

  useEffect(() => { setHistory(null); }, [mode]);

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

  useEffect(() => {
    if (tab === "history" && !history) {
      apiFetch(`/trading/history/${lobbyId}?mode=${mode}`).then(j => {
        if (j.ok) setHistory({ orders: j.orders || [], closedPositions: j.closedPositions || [] });
      });
    }
  }, [tab, lobbyId, history, mode]);

  async function resetAccount() {
    const startBack = mode === "RANKED" ? "$1K" : "$100K";
    const ok = await weeredConfirm({
      title: `Reset your ${mode === "RANKED" ? "Ranked" : "Casual"} account?`,
      body: `All positions, orders, and P&L history for this mode get wiped. You start back at ${startBack}.`,
      confirmLabel: "Reset",
      destructive: true,
    });
    if (!ok) return;
    await apiFetch(`/trading/reset/${lobbyId}`, { method: "POST", body: JSON.stringify({ mode }) });
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
    <div style={{ padding: "0 1px", flex: 1, minHeight: 0, overflowY: "auto" }}>
      <LobbyPnlTicker lobbyId={lobbyId} mode={mode} />

      <TheBrief open={brief.open} onClose={brief.hide} />
      <button
        type="button"
        onClick={brief.show}
        title="Reopen The Brief — the FakeOut walkthrough"
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          marginBottom: 10, padding: "5px 12px",
          borderRadius: 2,
          border: `1px solid ${accentColor}40`,
          background: `${accentColor}0d`,
          color: accentColor, fontSize: 10, fontWeight: 800,
          letterSpacing: "0.6px", textTransform: "uppercase",
          cursor: "pointer", transition: "all 0.15s",
        }}
        onMouseEnter={e => { e.currentTarget.style.background = `${accentColor}1a`; }}
        onMouseLeave={e => { e.currentTarget.style.background = `${accentColor}0d`; }}
      >
        <span style={{ fontSize: 11 }}>📓</span> The Brief
      </button>

      <div style={{
        display: "flex",
        alignItems: "stretch",
        gap: 6,
        marginBottom: 10,
        padding: 4,
        borderRadius: 2,
        border: "1px solid rgba(255,255,255,.06)",
        background: "rgba(0,0,0,.20)",
      }}>
        {(["CASUAL", "RANKED"] as const).map(m => {
          const active = mode === m;
          const isRanked = m === "RANKED";
          return (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              style={{
                flex: 1,
                padding: "7px 10px",
                borderRadius: 2,
                border: active ? `1px solid ${accentColor}55` : "1px solid transparent",
                background: active
                  ? (isRanked ? "linear-gradient(135deg, rgba(245,197,24,.18), rgba(239,68,68,.10))" : "rgba(255,255,255,.04)")
                  : "transparent",
                color: active ? "rgba(243,244,246,.95)" : "rgba(243,244,246,.45)",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.15s",
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase" }}>{m === "RANKED" ? "Ranked" : "Casual"}</span>
                <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.6, fontFamily: "monospace" }}>
                  {m === "RANKED" ? "$1K start" : "$100K start"}
                </span>
              </div>
              <div style={{ fontSize: 9, marginTop: 3, opacity: 0.55, letterSpacing: "0.3px" }}>
                {m === "RANKED" ? "10× Paper · Notoriety XP · split leaderboard" : "for fun · no XP · base Paper rate"}
              </div>
            </button>
          );
        })}
      </div>

      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        marginBottom: 10,
        padding: "5px 10px",
        borderRadius: 2,
        border: "1px dashed rgba(255,255,255,.08)",
        background: "rgba(255,255,255,.015)",
        fontSize: 10,
        letterSpacing: "0.4px",
        color: "rgba(243,244,246,.45)",
      }}>
        <span style={{ textTransform: "uppercase", fontWeight: 700, opacity: 0.7 }}>in the works</span>
        <span>FX feeds (twelvedata) · MyFXBook verified-stats sync · crew portfolios</span>
      </div>

      <ModuleTabBar tabs={TABS} active={tab} onSelect={(id) => setTab(id as Tab)} accent={accentColor} />

      {tab === "trade" && (
        <>
          <SymbolBar
            symbols={symbols}
            selected={selectedSymbol}
            onSelect={setSelectedSymbol}
            livePrice={livePrice}
          />

          <div style={{ display: "flex", gap: 4, marginBottom: 8, alignItems: "center" }}>
            <span style={{ ...S.label, marginBottom: 0, marginRight: 6 }}>Timeframe</span>
            {TIMEFRAMES.map(t => {
              const active = selectedTimeframe === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTimeframe(t.id)}
                  style={{
                    padding: "3px 9px",
                    borderRadius: 2,
                    border: `1px solid ${active ? `${accentColor}55` : "rgba(255,255,255,.08)"}`,
                    background: active ? `${accentColor}15` : "rgba(255,255,255,.03)",
                    color: active ? accentColor : "rgba(243,244,246,.55)",
                    fontSize: 10,
                    fontWeight: active ? 700 : 500,
                    letterSpacing: "0.5px",
                    cursor: "pointer",
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          <div style={{ marginBottom: 10, borderRadius: 2, border: "1px solid rgba(255,255,255,.06)", overflow: "hidden" }}>
            <PriceChart symbol={selectedSymbol} accent={accentColor} timeframe={selectedTimeframe} />
          </div>

          <TradeFeed />

          <AccountSummary account={account} paperBalance={paperBalance} onReset={resetAccount} />

          <OrderEntry
            symbol={selectedSymbol}
            lobbyId={lobbyId}
            livePrice={livePrice}
            mode={mode}
            onTrade={loadAccount}
          />

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

      {tab === "leaderboard" && <Leaderboard lobbyId={lobbyId} mode={mode} />}

      {tab === "history" && (
        <div>
          {!history ? (
            <LoadingState compact label="Loading" />
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
                            padding: "2px 6px", borderRadius: 2, fontSize: 10, fontWeight: 700,
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
                <EmptyState compact title="No orders yet." />
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

      <div style={{ marginTop: 20, padding: "8px 10px", borderRadius: 2, background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.04)" }}>
        <div style={{ fontSize: 9, opacity: 0.25, lineHeight: 1.5 }}>
          FakeOut — paper trading only, no real money at risk. Market data provided by Binance. Prices are real-time but simulated trades have no market impact. Not financial advice.
        </div>
      </div>
    </div>
  );
}