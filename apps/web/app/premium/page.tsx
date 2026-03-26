"use client";
import React, { useEffect, useState } from "react";

const tiers = [
  {
    id: "innocent",
    name: "Innocent",
    price: "Free",
    sub: "for now",
    color: "#94a3b8",
    glow: "rgba(148,163,184,0.15)",
    border: "rgba(148,163,184,0.2)",
    features: [
      "Full access to all public lobbies",
      "Join and create rooms",
      "Lobby chat and presence",
      "Standard username styling",
      "The feed. All of it.",
    ],
    cta: "You're already here.",
    ctaLink: "/subscribe",
    ctaStyle: "ghost",
  },
  {
    id: "indicted",
    name: "Indicted",
    price: "$6",
    sub: "/ month",
    color: "#a78bfa",
    glow: "rgba(88,0,229,0.2)",
    border: "rgba(88,0,229,0.35)",
    badge: "most popular",
    features: [
      "Everything in Innocent",
      "Own 1 branded lobby",
      "Colored username + custom icon",
      "Custom fonts & text color in chat",
      "Unlimited video streaming",
      "Early access to new features",
    ],
    cta: "Get Indicted",
    ctaLink: "/subscribe",
    ctaStyle: "primary",
  },
  {
    id: "felon",
    name: "Felon",
    price: "$14",
    sub: "/ month",
    color: "#f97316",
    glow: "rgba(249,115,22,0.15)",
    border: "rgba(249,115,22,0.3)",
    features: [
      "Everything in Indicted",
      "Own up to 3 verified lobbies",
      "Lobby mod tools + custom modules",
      "Verified badge on your lobbies",
      "Direct line to platform support",
      "Your lobbies surface on Home",
    ],
    cta: "Become a Felon",
    ctaLink: "/subscribe",
    ctaStyle: "orange",
  },
  {
    id: "kingpin",
    name: "Kingpin",
    price: "???",
    sub: "",
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
    cta: "You don't apply for this.",
    ctaLink: null,
    ctaStyle: "locked",
  },
];

export default function PremiumPage() {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setTimeout(() => setVisible(true), 100); }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@700;800;900&display=swap');
        .prem-root {
          min-height: 100vh;
          background: #050810;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 60px 24px 80px;
          font-family: 'DM Mono', monospace;
          position: relative;
          overflow: hidden;
        }
        .prem-root::before {
          content: '';
          position: fixed;
          inset: 0;
          background:
            radial-gradient(ellipse 70% 50% at 10% 5%, rgba(88,0,229,0.12) 0%, transparent 55%),
            radial-gradient(ellipse 50% 40% at 90% 95%, rgba(249,115,22,0.07) 0%, transparent 55%);
          pointer-events: none;
        }
        .prem-root::after {
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
        .prem-inner {
          position: relative;
          z-index: 1;
          width: min(1000px, 100%);
          opacity: 0;
          transform: translateY(16px);
          transition: opacity 0.7s ease, transform 0.7s ease;
        }
        .prem-inner.visible { opacity: 1; transform: translateY(0); }
        .prem-header { text-align: center; margin-bottom: 64px; }
        .prem-eyebrow {
          font-size: 10px;
          letter-spacing: 0.25em;
          text-transform: uppercase;
          color: rgba(88,0,229,0.55);
          margin-bottom: 16px;
        }
        .prem-title {
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
        .prem-sub {
          font-size: 13px;
          color: rgba(255,255,255,0.3);
          max-width: 400px;
          margin: 0 auto;
          line-height: 1.7;
        }
        .prem-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 16px;
          margin-bottom: 48px;
        }
        .prem-card {
          border-radius: 16px;
          padding: 28px 24px;
          position: relative;
          display: flex;
          flex-direction: column;
          transition: transform 0.2s;
        }
        .prem-card:hover { transform: translateY(-2px); }
        .prem-badge {
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
        .prem-tier-name {
          font-family: 'Syne', sans-serif;
          font-weight: 800;
          font-size: 22px;
          letter-spacing: -0.5px;
          margin-bottom: 4px;
        }
        .prem-price {
          font-size: 32px;
          font-weight: 700;
          font-family: 'Syne', sans-serif;
          letter-spacing: -1px;
          margin-bottom: 2px;
          line-height: 1;
        }
        .prem-price-sub {
          font-size: 11px;
          color: rgba(255,255,255,0.3);
          margin-bottom: 24px;
        }
        .prem-features {
          list-style: none;
          padding: 0;
          margin: 0 0 28px;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .prem-features li {
          font-size: 12px;
          color: rgba(255,255,255,0.6);
          display: flex;
          align-items: flex-start;
          gap: 8px;
          line-height: 1.5;
        }
        .prem-features li::before {
          content: '—';
          opacity: 0.4;
          flex-shrink: 0;
          margin-top: 1px;
        }
        .prem-features li.muted { color: rgba(255,255,255,0.25); font-style: italic; }
        .prem-cta {
          width: 100%;
          padding: 11px;
          border-radius: 10px;
          font-family: 'DM Mono', monospace;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
          text-align: center;
          text-decoration: none;
          display: block;
        }
        .prem-footer {
          text-align: center;
          font-size: 11px;
          color: rgba(255,255,255,0.15);
          border-top: 1px solid rgba(255,255,255,0.05);
          padding-top: 32px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .prem-footer a {
          color: rgba(167,139,250,0.4);
          text-decoration: none;
          transition: color 0.2s;
        }
        .prem-footer a:hover { color: rgba(167,139,250,0.8); }
        .prem-nav { display: flex; gap: 24px; }
      `}</style>

      <div className="prem-root">
        <div className={`prem-inner${visible ? " visible" : ""}`}>

          <div className="prem-header">
            <div style={{ marginBottom: 20, display: "flex", justifyContent: "center" }}>
              <img src="/brand/logo/weered-shieldlogo-512.png" alt="Weered" style={{ width: 120, height: 120, filter: "drop-shadow(0 0 32px rgba(88,0,229,0.35))" }} />
            </div>
            <div className="prem-eyebrow">// access levels</div>
            <div className="prem-title">Choose your status.</div>
            <div className="prem-sub">Some things cost money. Most things don't. One thing can't be bought.</div>
          </div>

          <div className="prem-grid">
            {tiers.map((tier, i) => (
              <div key={tier.id} className="prem-card" style={{
                background: `rgba(12,12,20,0.85)`,
                border: `1px solid ${tier.border}`,
                boxShadow: `0 0 40px ${tier.glow}, inset 0 1px 0 rgba(255,255,255,0.04)`,
                animationDelay: `${i * 0.1}s`,
              }}>
                {tier.badge && (
                  <div className="prem-badge" style={{
                    background: tier.id === "kingpin" ? "rgba(252,211,77,0.15)" : "rgba(88,0,229,0.2)",
                    border: `1px solid ${tier.border}`,
                    color: tier.color,
                  }}>{tier.badge}</div>
                )}

                <div className="prem-tier-name" style={{ color: tier.color }}>{tier.name}</div>
                <div className="prem-price" style={{ color: "rgba(255,255,255,0.9)" }}>{tier.price}</div>
                <div className="prem-price-sub">{tier.sub || "\u00a0"}</div>

                <ul className="prem-features">
                  {tier.features.map((f, fi) => (
                    <li key={fi} className={f === "———" ? "muted" : ""}>{f}</li>
                  ))}
                </ul>

                {tier.ctaLink ? (
                  <a href={tier.ctaLink} className="prem-cta" style={
                    tier.ctaStyle === "primary" ? {
                      background: "linear-gradient(135deg, rgba(88,0,229,0.85), rgba(217,70,239,0.75))",
                      border: "1px solid rgba(88,0,229,0.45)",
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
                  }>{tier.cta}</a>
                ) : (
                  <div className="prem-cta" style={{
                    background: "rgba(252,211,77,0.05)",
                    border: "1px solid rgba(252,211,77,0.15)",
                    color: "rgba(252,211,77,0.35)",
                    cursor: "default",
                    fontStyle: "italic",
                  }}>{tier.cta}</div>
                )}
              </div>
            ))}
          </div>

          <div className="prem-footer">
            <span>© weered.ca</span>
            <nav className="prem-nav">
              <a href="/about">about</a>
              <a href="/contact">contact</a>
              <a href="/login">enter</a>
            </nav>
          </div>

        </div>
      </div>
    </>
  );
}
