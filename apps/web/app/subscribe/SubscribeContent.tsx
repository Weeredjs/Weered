"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { weeredToast } from "../../lib/toast";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

function authHeaders() {
  try { const t = localStorage.getItem("weered_token") || ""; return t ? { Authorization: `Bearer ${t}` } : {}; } catch { return {}; }
}

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, { ...opts, headers: { "Content-Type": "application/json", ...authHeaders(), ...(opts?.headers || {}) } });
  return r.json();
}

const TIERS = [
  {
    id: "FREE", name: "Innocent", price: "Free", sub: "for now", monthly: 0,
    color: "#94a3b8",
    glow: "rgba(148,163,184,0.15)",
    border: "rgba(148,163,184,0.2)",
    features: [
      "Full access to all public lobbies",
      "Join and create rooms",
      "Voice chat & presence",
      "Join fireteams (LFG)",
      "The feed. All of it.",
    ],
    ctaStyle: "ghost",
  },
  {
    id: "INDICTED", name: "Indicted", price: "$6", sub: "/ month", monthly: 6,
    color: "#a78bfa",
    glow: "rgba(88,0,229,0.2)",
    border: "rgba(88,0,229,0.35)",
    badge: "most popular",
    features: [
      "Everything in Innocent",
      "Own 1 branded lobby",
      "Forum moderation for your lobby",
      "Colored username + custom icon",
      "Custom fonts & text color in chat",
      "Unlimited video streaming",
      "Early access to new features",
    ],
    ctaStyle: "primary",
  },
  {
    id: "FELON", name: "Felon", price: "$14", sub: "/ month", monthly: 14,
    color: "#f97316",
    glow: "rgba(249,115,22,0.15)",
    border: "rgba(249,115,22,0.3)",
    features: [
      "Everything in Indicted",
      "Own up to 3 branded lobbies",
      "Full forum moderation — pin, lock, delete",
      "Lobby mod tools + custom modules",
      "Verified badge on your lobbies",
      "Direct line to platform support",
      "Your lobbies surface on Home",
    ],
    ctaStyle: "orange",
  },
  {
    id: "KINGPIN", name: "Kingpin", price: "—", sub: "sealed", monthly: -1,
    color: "#fcd34d",
    glow: "rgba(252,211,77,0.12)",
    border: "rgba(252,211,77,0.25)",
    badge: "earned",
    features: [
      "Not applied for.",
      "Not purchased.",
      "Not explained.",
      "———",
      "You'll know if it's yours.",
    ],
    ctaStyle: "locked",
  },
];

export default function SubscribeContent() {
  const searchParams = useSearchParams();
  const success = searchParams.get("success") === "true";
  const [sub, setSub] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    apiFetch("/subscribe/status").then(j => { if (j.ok) setSub(j); setLoading(false); }).catch(() => setLoading(false));
    setTimeout(() => setVisible(true), 100);
  }, []);

  async function checkout(tier: string) {
    setChecking(tier);
    const j = await apiFetch("/subscribe/checkout", { method: "POST", body: JSON.stringify({ tier }) });
    if (j.ok && j.url) window.location.href = j.url;
    else { weeredToast.error(j.message || j.error || "Checkout failed."); setChecking(null); }
  }

  async function manageSubscription() {
    const j = await apiFetch("/subscribe/portal", { method: "POST", body: JSON.stringify({}) });
    if (j.ok && j.url) window.location.href = j.url;
    else weeredToast.error(j.message || j.error || "Failed to open billing portal.");
  }

  const currentTier = sub?.tier || "FREE";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@700;800;900&display=swap');
        .sub-root {
          min-height: 100vh;
          background: #050810;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 60px 24px 80px;
          font-family: 'DM Mono', monospace;
          position: relative;
          overflow-x: hidden;
        }
        .sub-root::before {
          content: '';
          position: fixed;
          inset: 0;
          background:
            radial-gradient(ellipse 70% 50% at 10% 5%, rgba(88,0,229,0.12) 0%, transparent 55%),
            radial-gradient(ellipse 50% 40% at 90% 95%, rgba(249,115,22,0.07) 0%, transparent 55%);
          pointer-events: none;
        }
        .sub-root::after {
          content: '';
          position: fixed;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.016) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.016) 1px, transparent 1px);
          background-size: 52px 52px;
          pointer-events: none;
          mask-image: radial-gradient(ellipse 90% 90% at 50% 50%, black 20%, transparent 100%);
        }
        .sub-inner {
          position: relative;
          z-index: 1;
          width: min(1000px, 100%);
          opacity: 0;
          transform: translateY(16px);
          transition: opacity 0.7s ease, transform 0.7s ease;
        }
        .sub-inner.visible { opacity: 1; transform: translateY(0); }
        .sub-header { text-align: center; margin-bottom: 48px; }
        .sub-eyebrow {
          font-size: 10px;
          letter-spacing: 0.25em;
          text-transform: uppercase;
          color: rgba(88,0,229,0.55);
          margin-bottom: 16px;
        }
        .sub-title {
          font-family: 'Syne', sans-serif;
          font-weight: 900;
          font-size: clamp(36px, 6vw, 64px);
          letter-spacing: -2px;
          background: linear-gradient(135deg, #fff 0%, rgba(167,139,250,0.8) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          line-height: 1.05;
          margin-bottom: 16px;
        }
        .sub-subtitle {
          font-size: 13px;
          color: rgba(255,255,255,0.3);
          max-width: 400px;
          margin: 0 auto;
          line-height: 1.7;
        }
        .sub-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 16px;
          margin-bottom: 48px;
        }
        .sub-card {
          border-radius: 16px;
          padding: 28px 24px;
          position: relative;
          display: flex;
          flex-direction: column;
          transition: transform 0.2s;
          background: rgba(12,12,20,0.85);
        }
        .sub-card:hover { transform: translateY(-2px); }
        .sub-badge {
          position: absolute;
          top: -10px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 9px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          padding: 3px 10px;
          border-radius: 999px;
          white-space: nowrap;
          font-weight: 700;
        }
        .sub-tier-name {
          font-family: 'Syne', sans-serif;
          font-weight: 800;
          font-size: 22px;
          letter-spacing: -0.5px;
          margin-bottom: 4px;
        }
        .sub-price {
          font-size: 32px;
          font-weight: 700;
          font-family: 'Syne', sans-serif;
          letter-spacing: -1px;
          margin-bottom: 2px;
          line-height: 1;
          color: rgba(255,255,255,0.9);
        }
        .sub-price-sub {
          font-size: 11px;
          color: rgba(255,255,255,0.3);
          margin-bottom: 24px;
        }
        .sub-features {
          list-style: none;
          padding: 0;
          margin: 0 0 28px;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .sub-features li {
          font-size: 12px;
          color: rgba(255,255,255,0.6);
          display: flex;
          align-items: flex-start;
          gap: 8px;
          line-height: 1.5;
        }
        .sub-features li::before {
          content: '—';
          opacity: 0.4;
          flex-shrink: 0;
          margin-top: 1px;
        }
        .sub-features li.muted { color: rgba(255,255,255,0.25); font-style: italic; }
        .sub-cta {
          width: 100%;
          padding: 11px;
          border-radius: 10px;
          font-family: 'DM Mono', monospace;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
          text-align: center;
          display: block;
          border: none;
        }
        .sub-cta:hover { transform: translateY(-1px); }
        .sub-cta:disabled { opacity: 0.6; cursor: wait; }
        .sub-status {
          margin-bottom: 32px;
          padding: 16px 24px;
          border-radius: 14px;
          background: rgba(88,0,229,0.08);
          border: 1px solid rgba(88,0,229,0.25);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }
        .sub-footer {
          text-align: center;
          font-size: 11px;
          color: rgba(255,255,255,0.15);
          border-top: 1px solid rgba(255,255,255,0.05);
          padding-top: 32px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .sub-footer a {
          color: rgba(167,139,250,0.4);
          text-decoration: none;
          transition: color 0.2s;
        }
        .sub-footer a:hover { color: rgba(167,139,250,0.8); }
        .sub-nav { display: flex; gap: 24px; }
      `}</style>

      <div className="sub-root">
        <div className={`sub-inner${visible ? " visible" : ""}`}>

          <div className="sub-header">
            <div className="sub-eyebrow">// access levels</div>
            <div className="sub-title">Choose your status.</div>
            <div className="sub-subtitle">Some things cost money. Most things don't. One thing can't be bought.</div>
          </div>

          {success && (
            <div style={{
              marginBottom: 32, padding: "16px 24px", borderRadius: 14, textAlign: "center",
              background: "rgba(16,185,129,.08)", border: "1px solid rgba(16,185,129,.25)",
              color: "rgb(167,243,208)", fontSize: 13, fontWeight: 600,
              fontFamily: "'DM Mono', monospace",
            }}>
              Subscription activated. Welcome to the crew.
            </div>
          )}

          {sub?.status === "active" && (
            <div className="sub-status">
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "rgba(243,244,246,.9)" }}>
                  Current plan: <span style={{ color: "rgb(216,180,254)" }}>{currentTier}</span>
                </div>
                {sub.currentPeriodEnd && (
                  <div style={{ fontSize: 11, opacity: 0.5, marginTop: 3 }}>
                    {sub.cancelAtPeriodEnd ? "Cancels" : "Renews"} on {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                  </div>
                )}
              </div>
              <button
                onClick={manageSubscription}
                style={{
                  padding: "8px 16px", borderRadius: 8,
                  border: "1px solid rgba(255,255,255,.15)",
                  background: "rgba(255,255,255,.06)",
                  color: "rgba(243,244,246,.8)",
                  fontSize: 11, fontWeight: 600, cursor: "pointer",
                  fontFamily: "'DM Mono', monospace",
                  transition: "all .15s",
                }}
              >
                Manage Billing
              </button>
            </div>
          )}

          <div className="sub-grid">
            {TIERS.map((tier, i) => {
              const isCurrent = currentTier === tier.id;
              const isUpgrade = tier.monthly > 0 && (currentTier === "FREE" || (currentTier === "INDICTED" && tier.id === "FELON"));
              const isKingpin = tier.id === "KINGPIN";

              return (
                <div key={tier.id} className="sub-card" style={{
                  border: isCurrent ? `2px solid ${tier.border}` : `1px solid ${tier.border}`,
                  boxShadow: `0 0 40px ${tier.glow}, inset 0 1px 0 rgba(255,255,255,0.04)`,
                }}>
                  {tier.badge && (
                    <div className="sub-badge" style={{
                      background: tier.id === "KINGPIN" ? "rgba(252,211,77,0.15)" : "rgba(88,0,229,0.2)",
                      border: `1px solid ${tier.border}`,
                      color: tier.color,
                    }}>{tier.badge}</div>
                  )}

                  {isCurrent && (
                    <div style={{
                      position: "absolute", top: 12, right: 12,
                      fontSize: 9, padding: "2px 8px", borderRadius: 999,
                      background: tier.border, color: "#050810",
                      fontWeight: 800, letterSpacing: ".5px",
                    }}>CURRENT</div>
                  )}

                  <div className="sub-tier-name" style={{ color: tier.color }}>{tier.name}</div>
                  <div className="sub-price">{tier.price}</div>
                  <div className="sub-price-sub">{tier.sub || "\u00a0"}</div>

                  <ul className="sub-features">
                    {tier.features.map((f, fi) => (
                      <li key={fi} className={f === "———" ? "muted" : ""}>{f}</li>
                    ))}
                  </ul>

                  {isKingpin ? (
                    <div className="sub-cta" style={{
                      background: "rgba(252,211,77,0.05)",
                      border: "1px solid rgba(252,211,77,0.15)",
                      color: "rgba(252,211,77,0.35)",
                      cursor: "default", fontStyle: "italic",
                    }}>You don't apply for this.</div>
                  ) : isCurrent ? (
                    <div className="sub-cta" style={{
                      background: "rgba(255,255,255,.04)",
                      border: "1px solid rgba(255,255,255,.10)",
                      color: "rgba(255,255,255,.45)",
                      cursor: "default",
                    }}>Active</div>
                  ) : isUpgrade ? (
                    <button
                      className="sub-cta"
                      onClick={() => checkout(tier.id)}
                      disabled={!!checking}
                      style={
                        tier.ctaStyle === "primary" ? {
                          background: "linear-gradient(135deg, rgba(88,0,229,0.85), rgba(217,70,239,0.75))",
                          color: "#fff",
                          boxShadow: "0 4px 20px rgba(88,0,229,0.25)",
                        } : tier.ctaStyle === "orange" ? {
                          background: "rgba(249,115,22,0.12)",
                          border: "1px solid rgba(249,115,22,0.3)",
                          color: "rgba(253,186,116,0.9)",
                        } : {
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          color: "rgba(255,255,255,0.4)",
                        }
                      }
                    >
                      {checking === tier.id ? "Redirecting..." : `Upgrade to ${tier.name}`}
                    </button>
                  ) : (
                    <div className="sub-cta" style={{
                      background: "rgba(255,255,255,.04)",
                      border: "1px solid rgba(255,255,255,.06)",
                      color: "rgba(255,255,255,.3)",
                      cursor: "default",
                    }}>{tier.monthly === 0 ? "You're already here." : "Contact support"}</div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="sub-footer">
            <span>© weered.ca</span>
            <nav className="sub-nav">
              <a href="/lobby">lobby</a>
              <a href="/premium">details</a>
              <a href="/about">about</a>
            </nav>
          </div>

        </div>
      </div>
    </>
  );
}
