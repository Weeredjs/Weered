"use client";

import React, { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

type Order = {
  id: number;
  title: string;
  brief: string;
  description: string;
  reward: any;
  rewards: any[];
  tasks: any[];
  progress: number[];
  progressPct: number;
  expiresIn: number | null;
  expiresAt: number | null;
};

function formatCountdown(ms: number): string {
  if (ms <= 0) return "Expired";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0)
    return `${d}D ${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

type LastOutcome = { title: string; outcome: "WON" | "LOST" | "ENDED"; ts: number } | null;

export default function HelldiversMajorOrderPanel({ style }: { style?: React.CSSProperties }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [lastOutcome, setLastOutcome] = useState<LastOutcome>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const r = await fetch(`${API}/helldivers/major-orders`);
        const j = await r.json();
        if (!alive) return;
        if (j?.ok) setOrders(j.orders || []);
      } catch {
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    const t = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (orders && orders.length > 0) {
      setLastOutcome(null);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`${API}/helldivers/dispatches?limit=30`);
        const j = await r.json();
        if (!alive || !j?.ok) return;
        const items: any[] = j.dispatches || j.events || [];
        for (const d of items) {
          const msg = String(d.message || d.text || d.body || "").toUpperCase();
          if (!msg.includes("MAJOR ORDER")) continue;
          const outcome: "WON" | "LOST" | "ENDED" =
            msg.includes("WON") || msg.includes("VICTORY") || msg.includes("SUCCESS")
              ? "WON"
              : msg.includes("LOST") || msg.includes("FAIL") || msg.includes("DEFEAT")
                ? "LOST"
                : "ENDED";
          const raw = String(d.message || d.text || d.body || "")
            .replace(/<\/?i(?:=\d+)?>/g, "")
            .replace(/\s+/g, " ")
            .trim();
          const title = raw.split(/[.!?]/)[0].slice(0, 80);
          const ts = Number(d.published || d.publishedAt || d.ts || 0) || Date.now();
          setLastOutcome({ title, outcome, ts });
          return;
        }
        setLastOutcome(null);
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, [orders, loading]);

  if (loading) {
    return (
      <div style={panelBase(style)}>
        <div
          style={{ padding: 16, textAlign: "center", color: "rgba(255,215,0,.4)", fontSize: 12 }}
        >
          Receiving Super Earth comms…
        </div>
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    const ago = lastOutcome ? Math.max(0, Date.now() - lastOutcome.ts) : 0;
    const agoLabel = (() => {
      if (!lastOutcome) return "";
      const h = Math.floor(ago / 3600_000);
      if (h < 1) return "just now";
      if (h < 24) return h + "h ago";
      const d = Math.floor(h / 24);
      return d + "d ago";
    })();
    const outcomeColor =
      lastOutcome?.outcome === "WON"
        ? "#22c55e"
        : lastOutcome?.outcome === "LOST"
          ? "#ef4444"
          : "rgba(255,215,0,.7)";
    return (
      <div style={panelBase(style)}>
        <div style={{ padding: 14, textAlign: "center" }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 1.2,
              color: "rgba(255,215,0,.7)",
              marginBottom: 6,
              textTransform: "uppercase",
            }}
          >
            ▌ Ministry of Defense
          </div>
          <div
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,.5)",
              marginBottom: lastOutcome ? 8 : 0,
            }}
          >
            No active Major Order. Stand by for orders, Helldiver.
          </div>
          {lastOutcome && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "4px 10px",
                borderRadius: 4,
                background: "rgba(0,0,0,.35)",
                border: `1px solid ${outcomeColor}3a`,
              }}
            >
              <span
                style={{
                  fontFamily: "ui-monospace, monospace",
                  fontSize: 9,
                  fontWeight: 900,
                  letterSpacing: "1.2px",
                  color: outcomeColor,
                }}
              >
                LAST · {lastOutcome.outcome}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,.7)",
                  maxWidth: 360,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {lastOutcome.title}
              </span>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,.4)" }}>{agoLabel}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={panelBase(style)}>
      <div
        style={{
          padding: "8px 14px",
          borderBottom: "1px solid rgba(255,215,0,.18)",
          background: "rgba(255,215,0,.05)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 1.4,
            color: "rgba(255,215,0,.85)",
            textTransform: "uppercase",
          }}
        >
          ▌ Ministry of Truth
        </span>
        <span
          style={{
            fontSize: 10,
            color: "rgba(255,255,255,.45)",
            letterSpacing: 0.4,
            textTransform: "uppercase",
          }}
        >
          {orders.length} priority {orders.length === 1 ? "directive" : "directives"}
        </span>
      </div>
      {orders.map((o, i) => {
        const remaining = o.expiresAt ? o.expiresAt - now : null;
        const expanded = expandedOrderId === o.id;
        return (
          <div
            key={o.id}
            style={{
              borderTop: i === 0 ? "none" : "1px solid rgba(255,215,0,.10)",
            }}
          >
            <button
              type="button"
              onClick={() => setExpandedOrderId(expanded ? null : o.id)}
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                color: "inherit",
                padding: "10px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
                cursor: "pointer",
                fontFamily: "inherit",
                textAlign: "left",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,.4)", lineHeight: 1 }}>
                  {expanded ? "▾" : "▸"}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    color: "#FFD700",
                    fontWeight: 700,
                    letterSpacing: 0.3,
                    flex: 1,
                    minWidth: 0,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {o.title}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: "rgba(255,215,0,.7)",
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {o.progressPct}%
                </span>
                {remaining !== null && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      fontVariantNumeric: "tabular-nums",
                      color: remaining < 86400_000 ? "#fca5a5" : "rgba(255,255,255,.55)",
                      minWidth: 56,
                      textAlign: "right",
                    }}
                  >
                    {formatCountdown(remaining)}
                  </span>
                )}
              </div>
              <div
                style={{
                  height: 4,
                  borderRadius: 2,
                  background: "rgba(0,0,0,.5)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${Math.max(0, Math.min(100, o.progressPct))}%`,
                    height: "100%",
                    background: "linear-gradient(90deg, #FFD700, #f0b500)",
                    transition: "width .5s",
                  }}
                />
              </div>
            </button>

            {expanded && (o.brief || o.description) && (
              <div
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,.75)",
                  lineHeight: 1.45,
                  padding: "0 14px 10px 30px",
                  fontStyle: "italic",
                }}
              >
                {o.brief || o.description}
              </div>
            )}

            {expanded && o.reward && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                  color: "rgba(255,255,255,.85)",
                  padding: "0 14px 12px 30px",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: "rgba(255,215,0,.18)",
                    border: "1px solid rgba(255,215,0,.5)",
                    color: "#FFD700",
                    fontSize: 13,
                    fontWeight: 800,
                  }}
                >
                  ★
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: "rgba(255,215,0,.7)",
                    letterSpacing: ".5px",
                    textTransform: "uppercase",
                  }}
                >
                  Reward:
                </span>
                <span style={{ color: "#FFD700", fontWeight: 700, letterSpacing: 0.5 }}>
                  {o.reward.amount || o.reward.value || ""} {rewardLabel(o.reward.type)}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function rewardLabel(type: any): string {
  const t = Number(type);
  if (t === 1) return "Medals";
  if (t === 2) return "Super Credits";
  if (t === 3) return "Requisition";
  return type ? `Type ${type}` : "";
}

function panelBase(style?: React.CSSProperties): React.CSSProperties {
  return {
    borderRadius: 10,
    border: "2px solid rgba(255,215,0,.4)",
    background: "linear-gradient(180deg, rgba(40,30,5,.85), rgba(20,15,2,.92))",
    boxShadow: "inset 0 0 30px rgba(255,215,0,.05)",
    color: "rgba(255,255,255,.9)",
    overflow: "hidden",
    ...style,
  };
}
