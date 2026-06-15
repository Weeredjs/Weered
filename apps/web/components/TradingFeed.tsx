"use client";

import React, { useCallback, useEffect, useState } from "react";
import { getWeeredClient } from "../app/weeredClient";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
const GREEN = "#22c55e";
const RED = "#ef4444";
const ACCENT = "#F5C518";

function authHeaders(): Record<string, string> {
  try {
    const t = localStorage.getItem("weered_token") || "";
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

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
  mode?: string;
};

function fmtTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 24 * 60 * 60_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function fmtMoney(n: number): string {
  if (n >= 1)
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n.toFixed(6);
}

export default function TradingFeed({
  lobbyId,
  mode = "CASUAL",
  accent,
}: {
  lobbyId: string;
  mode?: "CASUAL" | "RANKED";
  accent?: string;
}) {
  const accentColor = accent || ACCENT;
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await fetch(
        `${API}/trading/lobby-feed/${encodeURIComponent(lobbyId)}?mode=${mode}`,
        {
          headers: { ...authHeaders() },
        },
      );
      const j = await r.json();
      if (j?.ok && Array.isArray(j.items)) setItems(j.items);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [lobbyId, mode]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    const wc = getWeeredClient();
    const handler = (msg: any) => {
      const item: FeedItem = {
        type: "open",
        ts: Number(msg.time || Date.now()),
        userId: String(msg.userId || ""),
        userName: String(msg.userName || "trader"),
        symbol: String(msg.symbol || ""),
        side: String(msg.side || "").toUpperCase(),
        quantity: Number(msg.quantity || 0),
        price: Number(msg.price || 0),
      };
      if (!item.symbol) return;
      setItems((prev) => [item, ...prev].slice(0, 100));
    };
    const unsub = wc.on("trading:trade", handler);
    return unsub;
  }, []);

  if (loading) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(243,244,246,0.4)",
          fontSize: 12,
        }}
      >
        Loading the floor…
      </div>
    );
  }

  if (!items.length) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          padding: 32,
          color: "rgba(243,244,246,0.5)",
        }}
      >
        <div style={{ fontSize: 36, opacity: 0.4 }}>📈</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(243,244,246,0.75)" }}>
          The tape is quiet.
        </div>
        <div style={{ fontSize: 11, opacity: 0.6, textAlign: "center", maxWidth: 320 }}>
          No trades in the last few hours. Be the one to print first — or wait, it usually picks up.
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflow: "auto",
        padding: "12px 16px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.6px",
          textTransform: "uppercase",
          color: "rgba(243,244,246,.4)",
          marginBottom: 4,
        }}
      >
        Live Feed · {mode === "RANKED" ? "Ranked" : "Casual"} · last {items.length}
      </div>
      {items.map((it, idx) => {
        const isClose = it.type === "close";
        const isLong = it.side === "BUY";
        const pnlPos = (it.pnl || 0) > 0;
        const pnlNeg = (it.pnl || 0) < 0;
        const sym = it.symbol.replace(/USDT$/, "");
        const notional = it.quantity * it.price;
        const stripeColor = isClose
          ? pnlPos
            ? GREEN
            : pnlNeg
              ? RED
              : "rgba(255,255,255,.15)"
          : isLong
            ? GREEN
            : RED;

        const verb = isClose
          ? pnlPos
            ? "closed for profit"
            : pnlNeg
              ? "took a loss"
              : "closed flat"
          : isLong
            ? "went long"
            : "shorted";

        return (
          <div
            key={`${it.userId}-${it.ts}-${idx}`}
            style={{
              display: "flex",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,.06)",
              background: "rgba(255,255,255,.02)",
              borderLeft: `3px solid ${stripeColor}88`,
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 999,
                flexShrink: 0,
                background: it.avatar
                  ? "rgba(255,255,255,.08)"
                  : it.avatarColor || "rgba(124,58,237,.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 700,
                color: "rgba(243,244,246,.9)",
                overflow: "hidden",
              }}
            >
              {it.avatar ? (
                <img
                  src={it.avatar}
                  alt={it.userName}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                it.userName.slice(0, 1).toUpperCase()
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                <span style={{ fontWeight: 700, color: "rgba(243,244,246,.95)" }}>
                  {it.userName}
                </span>
                <span style={{ color: "rgba(243,244,246,.55)" }}>{verb}</span>
                <span style={{ fontWeight: 700, color: "rgba(243,244,246,.85)" }}>{sym}</span>
                {isClose && it.pnl !== undefined && (
                  <span
                    style={{
                      fontWeight: 800,
                      color: pnlPos ? GREEN : pnlNeg ? RED : "rgba(243,244,246,.5)",
                      fontFamily: "monospace",
                    }}
                  >
                    {it.pnl >= 0 ? "+" : ""}$
                    {Math.abs(it.pnl).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                )}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 3,
                  fontSize: 10,
                  color: "rgba(243,244,246,.45)",
                  fontFamily: "monospace",
                }}
              >
                <span>
                  {it.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })} @ $
                  {fmtMoney(it.price)}
                </span>
                <span>·</span>
                <span>
                  ${notional.toLocaleString(undefined, { maximumFractionDigits: 0 })} notional
                </span>
                <span style={{ marginLeft: "auto", opacity: 0.6 }}>{fmtTime(it.ts)}</span>
              </div>
            </div>
          </div>
        );
      })}
      <div
        style={{
          fontSize: 10,
          color: "rgba(243,244,246,.3)",
          textAlign: "center",
          padding: "16px 0 8px",
        }}
      >
        That&apos;s the tape. New trades land at the top in real time.
      </div>
    </div>
  );
}
