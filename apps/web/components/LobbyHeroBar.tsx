"use client";

import React, { useState, useEffect } from "react";

interface HeroPromo {
  type: "event" | "pinned" | "custom";
  title: string;
  subtitle?: string;
  cta?: string;
  ctaUrl?: string;
  accentColor?: string;
  backgroundImage?: string;
}

interface Props {
  lobbyId: string;
  lobbyName: string;
  verified?: boolean;
  promo?: HeroPromo;
}

// Default promo per domain — will eventually come from DB / lobby owner config
function defaultPromo(lobbyId: string): HeroPromo | null {
  const promos: Record<string, HeroPromo> = {
    "ign.com": {
      type: "event",
      title: "GTA 6 Launch Week Coverage",
      subtitle: "Live reactions, reviews, and community rooms — all week long on IGN",
      cta: "Join the Event Room",
      ctaUrl: "#",
      accentColor: "#E11D48",
      backgroundImage: "https://picsum.photos/seed/ign-hero/800/200",
    },
    "espn.com": {
      type: "event",
      title: "UFC 309 Watch Party",
      subtitle: "Jones vs. Aspinall — Live commentary room opens 30 min before main card",
      cta: "Enter Watch Party",
      ctaUrl: "#",
      accentColor: "#D97706",
      backgroundImage: "https://picsum.photos/seed/espn-hero/800/200",
    },
    "techcrunch.com": {
      type: "pinned",
      title: "TechCrunch Disrupt 2026 — Live Coverage",
      subtitle: "Catch all the announcements and join the discussion in real time",
      cta: "Open Coverage Room",
      ctaUrl: "#",
      accentColor: "#0EA5E9",
      backgroundImage: "https://picsum.photos/seed/tc-hero/800/200",
    },
  };
  return promos[lobbyId] || null;
}

export default function LobbyHeroBar({ lobbyId, lobbyName, verified = false, promo: propPromo }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted]     = useState(false);

  const promo = propPromo || defaultPromo(lobbyId);
  const accent = promo?.accentColor || "#7C3AED";

  useEffect(() => { setMounted(true); }, []);

  if (!promo) return null; // No promo = no bar

  return (
    <>
      <style>{`
        @keyframes heroSlideDown {
          from { opacity: 0; transform: translateY(-100%); max-height: 0; }
          to   { opacity: 1; transform: translateY(0);     max-height: 200px; }
        }
        @keyframes heroSlideUp {
          from { opacity: 1; max-height: 200px; }
          to   { opacity: 0; max-height: 0; }
        }
        .hero-bar-content {
          overflow: hidden;
          transition: max-height 0.38s cubic-bezier(0.22,1,0.36,1), opacity 0.28s ease;
        }
        .hero-bar-content.open   { max-height: 200px; opacity: 1; }
        .hero-bar-content.closed { max-height: 0;     opacity: 0; }
        .hero-cta-btn {
          padding: 7px 16px;
          border-radius: 8px;
          border: none;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s;
          letter-spacing: 0.03em;
        }
        .hero-cta-btn:hover { transform: translateY(-1px); filter: brightness(1.1); }
        .hero-collapse-btn {
          display: flex; align-items: center; gap: 5px;
          padding: 4px 8px; border-radius: 6px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
          color: rgba(148,163,184,0.5);
          font-size: 10px; font-weight: 700;
          cursor: pointer; transition: all 0.15s;
          letter-spacing: 0.05em; text-transform: uppercase;
        }
        .hero-collapse-btn:hover { background: rgba(255,255,255,0.08); color: rgba(148,163,184,0.8); }
      `}</style>

      <div style={{
        position: "relative",
        zIndex: 10,
        flexShrink: 0,
        borderBottom: collapsed ? "none" : `1px solid ${accent}22`,
        background: "transparent",
      }}>
        {/* Collapsed pill — shown when bar is collapsed */}
        {collapsed && (
          <div
            onClick={() => setCollapsed(false)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "6px 14px",
              background: `linear-gradient(90deg, ${accent}18, transparent)`,
              borderBottom: `1px solid ${accent}22`,
              cursor: "pointer",
              transition: "background 0.15s",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: accent, boxShadow: `0 0 6px ${accent}` }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: accent, letterSpacing: "0.05em" }}>
                {promo.type === "event" ? "● LIVE EVENT" : "📌 PINNED"}
              </span>
              <span style={{ fontSize: 11, color: "rgba(148,163,184,0.5)" }}>
                {promo.title}
              </span>
            </div>
            <span style={{ fontSize: 10, color: "rgba(100,116,139,0.4)", letterSpacing: "0.04em" }}>
              EXPAND ↓
            </span>
          </div>
        )}

        {/* Full hero content */}
        <div className={`hero-bar-content ${collapsed ? "closed" : "open"}`}>
          <div style={{
            position: "relative",
            minHeight: 90,
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
          }}>
            {/* Background image */}
            {promo.backgroundImage && (
              <div style={{
                position: "absolute", inset: 0,
                backgroundImage: `url(${promo.backgroundImage})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                filter: "brightness(0.25) saturate(0.6)",
              }} />
            )}

            {/* Gradient overlay — makes text float above the image */}
            <div style={{
              position: "absolute", inset: 0,
              background: `linear-gradient(90deg, rgba(10,10,18,0.97) 0%, rgba(10,10,18,0.80) 50%, rgba(10,10,18,0.60) 100%)`,
            }} />

            {/* Left accent bar */}
            <div style={{
              position: "absolute", left: 0, top: 0, bottom: 0,
              width: 3,
              background: `linear-gradient(to bottom, ${accent}, ${accent}44)`,
              boxShadow: `0 0 16px ${accent}66`,
            }} />

            {/* Content */}
            <div style={{
              position: "relative", zIndex: 1,
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 14px 14px 20px", width: "100%", gap: 12,
            }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                {/* Type badge */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                  {promo.type === "event" && (
                    <span style={{
                      padding: "2px 7px", borderRadius: 4,
                      background: accent + "33", border: `1px solid ${accent}55`,
                      fontSize: 9, fontWeight: 800, color: accent,
                      letterSpacing: "0.12em", textTransform: "uppercase",
                    }}>
                      ● LIVE EVENT
                    </span>
                  )}
                  {promo.type === "pinned" && (
                    <span style={{
                      padding: "2px 7px", borderRadius: 4,
                      background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                      fontSize: 9, fontWeight: 800, color: "rgba(148,163,184,0.7)",
                      letterSpacing: "0.12em", textTransform: "uppercase",
                    }}>
                      📌 PINNED
                    </span>
                  )}
                  {verified && (
                    <span style={{
                      padding: "2px 7px", borderRadius: 4,
                      background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)",
                      fontSize: 9, fontWeight: 800, color: "#22C55E",
                      letterSpacing: "0.10em",
                    }}>
                      ✓ VERIFIED
                    </span>
                  )}
                </div>

                <div style={{
                  fontSize: 15, fontWeight: 800,
                  color: "rgba(243,244,246,0.97)",
                  lineHeight: 1.25, marginBottom: 4,
                  textShadow: `0 0 20px ${accent}44`,
                }}>
                  {promo.title}
                </div>

                {promo.subtitle && (
                  <div style={{
                    fontSize: 11, color: "rgba(148,163,184,0.55)",
                    lineHeight: 1.5,
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 1,
                    WebkitBoxOrient: "vertical",
                  }}>
                    {promo.subtitle}
                  </div>
                )}
              </div>

              {/* Right side — CTA + collapse */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
                {promo.cta && (
                  <button
                    className="hero-cta-btn"
                    style={{
                      background: `linear-gradient(135deg, ${accent}cc, ${accent}88)`,
                      color: "white",
                      boxShadow: `0 4px 20px ${accent}44`,
                    }}
                    onClick={() => promo.ctaUrl && promo.ctaUrl !== "#" && window.open(promo.ctaUrl, "_blank")}
                  >
                    {promo.cta} →
                  </button>
                )}
                <button
                  className="hero-collapse-btn"
                  onClick={() => setCollapsed(true)}
                >
                  collapse ↑
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
