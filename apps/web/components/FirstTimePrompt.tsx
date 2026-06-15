"use client";

import React, { useEffect, useState } from "react";
import { useWeered } from "./WeeredProvider";
import { useOverlay } from "./overlays/OverlayProvider";

const DISMISS_KEY = "weered:onboarded:profile";

const CLIP = "polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)";
const ctaPrimary: React.CSSProperties = {
  clipPath: CLIP,
  padding: "8px 16px",
  border: "none",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: ".03em",
  color: "#fff",
  background: "#7C3AED",
  boxShadow: "inset 0 0 0 1px rgba(196,181,253,.6), 0 0 14px rgba(124,58,237,.5)",
};
const ctaGhost: React.CSSProperties = {
  clipPath: CLIP,
  padding: "8px 16px",
  border: "none",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: ".03em",
  color: "rgba(245,205,90,.95)",
  background: "rgba(138,94,18,.20)",
  boxShadow: "inset 0 0 0 1px rgba(212,175,55,.45)",
};

export default function FirstTimePrompt() {
  const { me } = useWeered() as any;
  const { openSheet } = useOverlay();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!me?.id) return;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {}
    if (dismissed) return;
    if (!me?.avatar) setShow(true);
  }, [me?.id, me?.avatar]);

  if (!show) return null;

  const name = String(me?.name || me?.username || "newcomer");
  const initial = name.trim().slice(0, 1).toUpperCase() || "?";
  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setShow(false);
  };
  const customize = () => {
    dismiss();
    openSheet("profile", { userId: me?.id });
  };
  const themes = () => {
    dismiss();
    openSheet("settings", { tab: "appearance" });
  };

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 3,
        marginTop: 14,
        border: "1px solid rgba(124,58,237,.4)",
        background:
          "linear-gradient(115deg, rgba(124,58,237,.18) 0%, rgba(18,14,26,.55) 48%, rgba(138,94,18,.16) 100%)",
        display: "flex",
        alignItems: "center",
        gap: 18,
        padding: "16px 18px",
      }}
    >
      <style>{`@keyframes weeredFtpGlow{0%,100%{opacity:.5;transform:translate(-50%,-50%) scale(1)}50%{opacity:.85;transform:translate(-50%,-50%) scale(1.14)}}`}</style>
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: "12%",
          top: "50%",
          width: 240,
          height: 240,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(167,139,250,.35) 0%, transparent 65%)",
          filter: "blur(8px)",
          animation: "weeredFtpGlow 5s ease-in-out infinite",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div style={{ position: "relative", zIndex: 1, flexShrink: 0 }}>
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: "50%",
            background: "#8a5e12",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: 26,
            fontWeight: 900,
            boxShadow:
              "0 0 0 3px rgba(10,10,18,.9), 0 0 0 4px rgba(167,139,250,.7), 0 0 18px rgba(124,58,237,.5)",
          }}
        >
          {initial}
        </div>
        <span
          aria-hidden
          style={{
            position: "absolute",
            bottom: -2,
            right: -2,
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: "#7C3AED",
            border: "2px solid #14101e",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
          </svg>
        </span>
      </div>

      <div style={{ position: "relative", zIndex: 1, flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: ".18em",
            textTransform: "uppercase",
            color: "rgba(167,139,250,.85)",
          }}
        >
          New here?
        </div>
        <div
          style={{
            fontSize: 17,
            fontWeight: 900,
            color: "#fff",
            lineHeight: 1.15,
            marginTop: 3,
            letterSpacing: "-.01em",
          }}
        >
          Welcome to Weered, <span style={{ color: "#c4b5fd" }}>{name}</span>.
        </div>
        <div style={{ fontSize: 12.5, color: "rgba(226,232,240,.7)", marginTop: 3 }}>
          Make it yours — set an avatar, pick your colors, and choose a theme.
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 11, flexWrap: "wrap" }}>
          <button onClick={customize} style={ctaPrimary}>
            Customize profile
          </button>
          <button onClick={themes} style={ctaGhost}>
            Themes &amp; appearance →
          </button>
        </div>
      </div>

      <button
        onClick={dismiss}
        aria-label="Dismiss"
        title="Dismiss"
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          zIndex: 2,
          width: 24,
          height: 24,
          borderRadius: 3,
          border: "1px solid rgba(255,255,255,.12)",
          background: "rgba(0,0,0,.25)",
          color: "rgba(255,255,255,.55)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}
