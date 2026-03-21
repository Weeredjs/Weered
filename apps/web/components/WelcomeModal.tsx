"use client";

import React, { useEffect, useState } from "react";

const WELCOME_KEY = "weered:welcome:seen:v1";

const FEATURES = [
  {
    icon: "🏠",
    title: "Lobbies",
    desc: "Browse verified communities — gaming, music, sports, culture. Each lobby has its own rooms, chat, and modules.",
  },
  {
    icon: "🚪",
    title: "Rooms",
    desc: "Join or create rooms inside any lobby. Text chat, voice chat, or just hang. Rooms are where it happens.",
  },
  {
    icon: "🎙",
    title: "Voice",
    desc: "Hop into a Voice room and talk — works in the background. Game, browse, whatever. Your squad stays connected.",
  },
  {
    icon: "👥",
    title: "Friends & Crew",
    desc: "Add friends, send DMs, form a Crew (Dojo). See who's online and what they're up to. Jump in with one click.",
  },
  {
    icon: "🎭",
    title: "Your Profile",
    desc: "Pick an avatar, set your bio, earn notoriety. Your identity on the platform — make it yours.",
  },
];

export default function WelcomeModal() {
  const [show, setShow] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(WELCOME_KEY)) return;
      // Small delay so the page loads first
      const t = setTimeout(() => setShow(true), 800);
      return () => clearTimeout(t);
    } catch {}
  }, []);

  useEffect(() => {
    if (show) {
      const t = setTimeout(() => setEntered(true), 50);
      return () => clearTimeout(t);
    }
  }, [show]);

  function dismiss() {
    setEntered(false);
    setTimeout(() => {
      setShow(false);
      try { localStorage.setItem(WELCOME_KEY, "1"); } catch {}
    }, 300);
  }

  if (!show) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={dismiss}
        style={{
          position: "fixed", inset: 0, zIndex: 99998,
          background: "rgba(0,0,0,.7)",
          backdropFilter: "blur(8px)",
          opacity: entered ? 1 : 0,
          transition: "opacity .3s ease",
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: "fixed", zIndex: 99999,
          top: "50%", left: "50%",
          transform: entered
            ? "translate(-50%, -50%) scale(1)"
            : "translate(-50%, -46%) scale(0.96)",
          opacity: entered ? 1 : 0,
          transition: "transform .35s cubic-bezier(.22,1,.36,1), opacity .3s ease",
          width: "min(460px, 92vw)",
          maxHeight: "min(680px, 88vh)",
          borderRadius: 20,
          border: "1px solid rgba(148,163,184,.12)",
          background: "linear-gradient(170deg, rgba(15,15,25,0.98) 0%, rgba(8,8,16,0.99) 100%)",
          boxShadow: "0 24px 80px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.04) inset",
          overflow: "hidden",
          display: "flex", flexDirection: "column",
        }}
      >
        {/* Header glow */}
        <div style={{
          position: "absolute", top: -60, left: "50%", transform: "translateX(-50%)",
          width: 300, height: 120, borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(124,58,237,.25) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        {/* Top accent line */}
        <div style={{
          height: 2,
          background: "linear-gradient(90deg, transparent, rgba(124,58,237,.6) 30%, rgba(167,139,250,.8) 50%, rgba(124,58,237,.6) 70%, transparent)",
        }} />

        {/* Content */}
        <div style={{ padding: "28px 28px 8px", position: "relative", zIndex: 1 }}>
          {/* Brand mark */}
          <div style={{
            fontSize: 9, fontWeight: 900, letterSpacing: "4px", textTransform: "uppercase",
            color: "rgba(167,139,250,.6)", marginBottom: 10,
          }}>
            WEERED.CA
          </div>

          <div style={{
            fontWeight: 900, fontSize: 24, lineHeight: 1.15,
            letterSpacing: "-0.5px", marginBottom: 6,
            color: "rgba(243,244,246,.96)",
          }}>
            Welcome to the lobby.
          </div>

          <div style={{
            fontSize: 13, color: "rgba(148,163,184,.65)", lineHeight: 1.5,
            marginBottom: 20,
          }}>
            A fireteam for the internet. Here's the quick rundown.
          </div>
        </div>

        {/* Feature list */}
        <div style={{
          flex: 1, overflowY: "auto", padding: "0 28px 20px",
          display: "flex", flexDirection: "column", gap: 6,
        }}>
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              style={{
                display: "flex", alignItems: "flex-start", gap: 14,
                padding: "12px 14px",
                borderRadius: 14,
                background: "rgba(255,255,255,.025)",
                border: "1px solid rgba(255,255,255,.05)",
                transition: "background .15s, border-color .15s",
                animationDelay: `${i * 0.06}s`,
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.05)";
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,.10)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.025)";
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,.05)";
              }}
            >
              <div style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                background: "rgba(124,58,237,.10)",
                border: "1px solid rgba(124,58,237,.18)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18,
              }}>
                {f.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontWeight: 800, fontSize: 13, color: "rgba(243,244,246,.92)",
                  letterSpacing: "-0.1px", marginBottom: 3,
                }}>
                  {f.title}
                </div>
                <div style={{
                  fontSize: 11.5, color: "rgba(148,163,184,.55)", lineHeight: 1.45,
                }}>
                  {f.desc}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: "16px 28px 24px",
          borderTop: "1px solid rgba(255,255,255,.05)",
          display: "flex", flexDirection: "column", gap: 10,
        }}>
          <button
            onClick={dismiss}
            style={{
              width: "100%", padding: "13px 20px",
              borderRadius: 12, border: "none",
              background: "linear-gradient(135deg, rgba(124,58,237,.9), rgba(167,139,250,.85))",
              color: "#fff", fontWeight: 800, fontSize: 14,
              cursor: "pointer", fontFamily: "inherit",
              letterSpacing: "-0.2px",
              boxShadow: "0 4px 20px rgba(124,58,237,.35)",
              transition: "transform .15s, box-shadow .15s",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
              (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 28px rgba(124,58,237,.45)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
              (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 20px rgba(124,58,237,.35)";
            }}
          >
            Let's go
          </button>

          <div style={{
            fontSize: 10, color: "rgba(148,163,184,.35)", textAlign: "center",
            letterSpacing: "0.3px",
          }}>
            You can revisit this anytime from Settings
          </div>
        </div>
      </div>
    </>
  );
}
