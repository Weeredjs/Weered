"use client";

import React, { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

const stencil: React.CSSProperties = {
  fontFamily: '"Stencil Std","Black Ops One","Impact",sans-serif',
  letterSpacing: "1.5px",
  textTransform: "uppercase",
};

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
  if (d > 0) return `${d}D ${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

export default function HelldiversMajorOrderPanel({ style }: { style?: React.CSSProperties }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const r = await fetch(`${API}/helldivers/major-orders`);
        const j = await r.json();
        if (!alive) return;
        if (j?.ok) setOrders(j.orders || []);
      } catch {}
      finally { if (alive) setLoading(false); }
    }
    load();
    const t = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  // Live ticking countdown.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (loading) {
    return (
      <div style={panelBase(style)}>
        <div style={{ padding: 16, textAlign: "center", color: "rgba(255,215,0,.4)", fontSize: 12 }}>
          Receiving Super Earth comms…
        </div>
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <div style={panelBase(style)}>
        <div style={{ padding: 14, textAlign: "center" }}>
          <div style={{ ...stencil, fontSize: 12, color: "rgba(255,215,0,.55)", marginBottom: 4 }}>
            ▌Ministry of Defense
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,.5)" }}>
            No active Major Order. Stand by for orders, Helldiver.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={panelBase(style)}>
      {orders.map((o, i) => {
        const remaining = o.expiresAt ? o.expiresAt - now : null;
        return (
          <div key={o.id} style={{
            padding: 14,
            borderTop: i === 0 ? "none" : "1px solid rgba(255,215,0,.12)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ ...stencil, fontSize: 10, color: "rgba(255,215,0,.6)", marginBottom: 2 }}>
                  ▌Major Order — Priority Directive
                </div>
                <div style={{ ...stencil, fontSize: 16, color: "#FFD700", fontWeight: 800 }}>
                  {o.title}
                </div>
              </div>
              {remaining !== null && (
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,.5)", letterSpacing: ".5px", textTransform: "uppercase" }}>
                    Time Remaining
                  </div>
                  <div style={{
                    ...stencil,
                    fontSize: 18,
                    color: remaining < 86400_000 ? "#b91c1c" : "#FFD700",
                    fontWeight: 800,
                    fontVariantNumeric: "tabular-nums",
                  }}>
                    {formatCountdown(remaining)}
                  </div>
                </div>
              )}
            </div>

            {(o.brief || o.description) && (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,.75)", lineHeight: 1.45, marginBottom: 10, fontStyle: "italic" }}>
                {o.brief || o.description}
              </div>
            )}

            {/* Progress bar */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 3, color: "rgba(255,215,0,.7)", letterSpacing: ".5px", textTransform: "uppercase" }}>
                <span>Objective Progress</span>
                <span style={{ fontWeight: 800 }}>{o.progressPct}%</span>
              </div>
              <div style={{
                height: 8,
                borderRadius: 2,
                background: "rgba(0,0,0,.5)",
                border: "1px solid rgba(255,215,0,.2)",
                overflow: "hidden",
              }}>
                <div style={{
                  width: `${Math.max(0, Math.min(100, o.progressPct))}%`,
                  height: "100%",
                  background: "linear-gradient(90deg, #FFD700, #f0b500)",
                  transition: "width .5s",
                }} />
              </div>
            </div>

            {/* Reward */}
            {o.reward && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "rgba(255,255,255,.85)" }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 22, height: 22, borderRadius: "50%",
                  background: "rgba(255,215,0,.18)",
                  border: "1px solid rgba(255,215,0,.5)",
                  color: "#FFD700", fontSize: 13, fontWeight: 800,
                }}>★</span>
                <span style={{ fontSize: 11, color: "rgba(255,215,0,.7)", letterSpacing: ".5px", textTransform: "uppercase" }}>Reward:</span>
                <span style={{ ...stencil, color: "#FFD700", fontWeight: 700 }}>
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
  // Reward type 1 = Medals (most common). Fall back gracefully.
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
