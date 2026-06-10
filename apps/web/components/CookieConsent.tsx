"use client";

import React, { useEffect, useState } from "react";

const STORAGE_KEY = "weered_cookie_consent";
const CURRENT_VERSION = 1;

type Consent = {
  version: number;
  essential: true;
  functional: boolean;
  analytics: boolean;
  acceptedAt: string;
};

function loadConsent(): Consent | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p || typeof p !== "object") return null;
    if (p.version !== CURRENT_VERSION) return null;
    return p as Consent;
  } catch { return null; }
}

function saveConsent(c: Consent) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(c)); } catch {}
  try { window.dispatchEvent(new CustomEvent("weered:cookie:consent", { detail: c })); } catch {}
}

export function getConsent(): Consent | null {
  if (typeof window === "undefined") return null;
  return loadConsent();
}

export function openConsentBanner() {
  try { window.dispatchEvent(new CustomEvent("weered:cookie:open")); } catch {}
}

export default function CookieConsent() {
  const [show, setShow] = useState(false);
  const [mount, setMount] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const c = loadConsent();
    if (!c) {
      const t = setTimeout(() => { setShow(true); setTimeout(() => setMount(true), 10); }, 700);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    function onOpen() { setShow(true); setTimeout(() => setMount(true), 10); }
    window.addEventListener("weered:cookie:open", onOpen);
    return () => window.removeEventListener("weered:cookie:open", onOpen);
  }, []);

  function accept(all: boolean) {
    if (busy) return;
    setBusy(true);
    saveConsent({
      version: CURRENT_VERSION,
      essential: true,
      functional: all,
      analytics: all,
      acceptedAt: new Date().toISOString(),
    });
    setMount(false);
    setTimeout(() => { setShow(false); setBusy(false); }, 180);
  }

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      style={{
        position: "fixed",
        left: 16,
        right: 16,
        bottom: 16,
        zIndex: 10000,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          pointerEvents: "auto",
          width: "100%",
          maxWidth: 560,
          background: "var(--weered-panel, rgba(20,18,16,0.98))",
          border: "1px solid var(--weered-border2, rgba(148,163,184,0.28))",
          borderRadius: 14,
          padding: "16px 16px 14px",
          boxShadow: "0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04), 0 0 40px var(--weered-accent-ring, rgba(124,58,237,0.10))",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          opacity: mount ? 1 : 0,
          transform: mount ? "translateY(0)" : "translateY(20px)",
          transition: "opacity 0.22s cubic-bezier(0.22,1,0.36,1), transform 0.26s cubic-bezier(0.22,1,0.36,1)",
          fontFamily: "inherit",
          color: "var(--weered-text, rgba(243,244,246,0.95))",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 16 }}>🍪</span>
          <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-0.01em" }}>Cookies & storage</div>
        </div>
        <div style={{ fontSize: 12, lineHeight: 1.55, color: "var(--weered-muted, rgba(148,163,184,0.78))", marginBottom: 12 }}>
          Weered uses local storage for the essentials — your login session, theme, and settings. Nothing is shared with third parties by default. You can accept functional preferences (theme sync across tabs) and analytics (helps us see what's broken), or just the essentials.{" "}
          <a href="/privacy" style={{ color: "var(--weered-accent-text, rgba(196,181,253,0.95))", textDecoration: "underline", textUnderlineOffset: 3 }}>
            Privacy policy
          </a>.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => accept(false)}
            disabled={busy}
            style={{
              flex: "1 1 160px",
              padding: "9px 14px",
              borderRadius: 9,
              border: "1px solid var(--weered-border, rgba(148,163,184,0.2))",
              background: "transparent",
              color: "var(--weered-muted, rgba(148,163,184,0.88))",
              fontSize: 12,
              fontWeight: 700,
              fontFamily: "inherit",
              cursor: busy ? "default" : "pointer",
              letterSpacing: "0.02em",
            }}
          >
            Essentials only
          </button>
          <button
            type="button"
            onClick={() => accept(true)}
            disabled={busy}
            style={{
              flex: "1 1 160px",
              padding: "9px 14px",
              borderRadius: 9,
              border: "1px solid var(--weered-accent-ring, rgba(124,58,237,0.45))",
              background: "var(--weered-accent-bg, rgba(124,58,237,0.18))",
              color: "var(--weered-accent-text, rgba(196,181,253,0.95))",
              fontSize: 12,
              fontWeight: 800,
              fontFamily: "inherit",
              cursor: busy ? "default" : "pointer",
              letterSpacing: "0.02em",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
