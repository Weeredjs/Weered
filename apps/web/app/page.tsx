"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import LandingActivityTicker from "../components/LandingActivityTicker";
import LandingLobbyCard, { type FeaturedLobby } from "../components/LandingLobbyCard";
import LandingLobbyPreviewModal from "../components/LandingLobbyPreviewModal";

const LP_API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

function AuthRouter({ onUnauthed }: { onUnauthed: (next: string) => void }) {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    const n = sp?.get("next") || "";
    const next = n && n.startsWith("/") ? n : "/home";
    try {
      const tok = localStorage.getItem("weered_token") || "";
      if (tok) router.replace(next);
      else onUnauthed(next);
    } catch {
      onUnauthed(next);
    }
  }, [router, sp, onUnauthed]);

  return null;
}

export default function Page() {
  const [showLanding, setShowLanding] = useState(false);
  const [nextPath, setNextPath] = useState("/home");

  return (
    <>
      <Suspense fallback={null}>
        <AuthRouter
          onUnauthed={(next) => {
            setNextPath(next);
            setShowLanding(true);
          }}
        />
      </Suspense>
      {showLanding ? <Landing nextPath={nextPath} /> : <InitialSplash />}
    </>
  );
}

function InitialSplash() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "grid",
      placeItems: "center",
      background: "#1a1a1c",
      color: "rgba(198,188,168,.65)",
      fontFamily: "var(--font-rajdhani), 'Rajdhani', system-ui, sans-serif",
      fontSize: 13,
      fontWeight: 600,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
    }}>
      connecting…
    </div>
  );
}

function Landing({ nextPath }: { nextPath: string }) {
  const getIn = `/login?next=${encodeURIComponent(nextPath)}`;

  return (
    <>
      <style>{`
        .lp-root {
          min-height: 100vh;
          background: #1a1a1c;
          color: rgba(240,232,214,0.96);
          font-family: var(--font-rajdhani), 'Rajdhani', system-ui, sans-serif;
          position: relative;
          overflow-x: hidden;
        }
        .lp-root::before {
          content: '';
          position: fixed;
          inset: 0;
          background:
            radial-gradient(ellipse 80% 50% at 10% 0%, rgba(217,169,66,0.10) 0%, transparent 60%),
            radial-gradient(ellipse 60% 40% at 90% 100%, rgba(183,138,40,0.08) 0%, transparent 55%);
          pointer-events: none;
          z-index: 0;
        }
        .lp-root::after {
          content: '';
          position: fixed;
          inset: 0;
          background-image:
            linear-gradient(rgba(217,169,66,0.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(217,169,66,0.035) 1px, transparent 1px);
          background-size: 48px 48px;
          pointer-events: none;
          z-index: 0;
          mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%);
        }
        .lp-nav {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 32px;
          max-width: 1200px;
          margin: 0 auto;
        }
        .lp-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          font-family: var(--font-barlow), 'Barlow Condensed', 'Rajdhani', sans-serif;
          font-weight: 800;
          font-size: 22px;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          color: rgba(240,232,214,0.98);
        }
        .lp-brand img {
          width: 28px;
          height: 28px;
          border-radius: 4px;
        }
        .lp-nav-links {
          display: flex;
          gap: 24px;
          align-items: center;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.04em;
          color: rgba(198,188,168,0.70);
          text-transform: uppercase;
        }
        .lp-nav-links a {
          color: inherit;
          text-decoration: none;
          transition: color 0.15s;
        }
        .lp-nav-links a:hover {
          color: rgba(217,169,66,0.95);
        }
        .lp-getin {
          padding: 8px 16px;
          border-radius: 4px;
          background: rgba(217,169,66,0.14);
          border: 1px solid rgba(217,169,66,0.50);
          color: #e6bd6e;
          font-family: var(--font-barlow), 'Barlow Condensed', sans-serif;
          font-size: 13px;
          font-weight: 800;
          text-decoration: none;
          letter-spacing: 0.10em;
          text-transform: uppercase;
          box-shadow: 0 2px 6px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,248,220,0.08);
          transition: all 0.15s;
        }
        .lp-getin:hover {
          background: rgba(217,169,66,0.22);
          border-color: rgba(217,169,66,0.72);
          color: #f3d48a;
          box-shadow: 0 4px 14px rgba(217,169,66,0.22), inset 0 1px 0 rgba(255,248,220,0.12);
          transform: translateY(-1px);
        }
        .lp-hero {
          position: relative;
          z-index: 2;
          max-width: 960px;
          margin: 0 auto;
          padding: 80px 32px 100px;
          text-align: center;
        }
        .lp-eyebrow {
          font-size: 11px;
          letter-spacing: 0.32em;
          text-transform: uppercase;
          color: rgba(217,169,66,0.85);
          margin-bottom: 20px;
          font-weight: 700;
        }
        .lp-headline {
          font-family: var(--font-barlow), 'Barlow Condensed', 'Rajdhani', sans-serif;
          font-weight: 800;
          font-size: clamp(42px, 8vw, 96px);
          line-height: 0.98;
          letter-spacing: -0.01em;
          text-transform: uppercase;
          background: linear-gradient(180deg, #f0e8d6 0%, #e6bd6e 55%, #a87a1c 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
          text-shadow: 0 2px 0 rgba(0,0,0,0.25);
          margin: 0 0 22px;
          animation: lpFade 0.7s cubic-bezier(0.22,1,0.36,1) both;
        }
        .lp-sub {
          font-size: clamp(15px, 1.6vw, 18px);
          color: rgba(240,232,214,0.74);
          max-width: 640px;
          margin: 0 auto 40px;
          line-height: 1.6;
          animation: lpFade 0.9s cubic-bezier(0.22,1,0.36,1) 0.08s both;
        }
        .lp-hero-cta {
          display: inline-flex;
          gap: 10px;
          align-items: center;
          animation: lpFade 1s cubic-bezier(0.22,1,0.36,1) 0.15s both;
        }
        .lp-btn-primary {
          padding: 14px 30px;
          border-radius: 4px;
          font-family: var(--font-barlow), 'Barlow Condensed', sans-serif;
          font-size: 15px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          text-decoration: none;
          background: linear-gradient(180deg, #e6bd6e 0%, #d9a942 50%, #a87a1c 100%);
          color: #1a1a1c;
          box-shadow:
            inset 0 1px 0 rgba(255,248,220,0.35),
            inset 0 -1px 0 rgba(0,0,0,0.25),
            0 2px 0 rgba(0,0,0,0.3),
            0 8px 24px rgba(217,169,66,0.25);
          transition: all 0.18s cubic-bezier(0.22,1,0.36,1);
        }
        .lp-btn-primary:hover {
          transform: translateY(-1px);
          background: linear-gradient(180deg, #f3d48a 0%, #e6bd6e 50%, #b78a28 100%);
          box-shadow:
            inset 0 1px 0 rgba(255,248,220,0.45),
            inset 0 -1px 0 rgba(0,0,0,0.25),
            0 4px 0 rgba(0,0,0,0.3),
            0 12px 32px rgba(217,169,66,0.38);
        }
        .lp-btn-secondary {
          padding: 13px 24px;
          border-radius: 4px;
          font-family: var(--font-barlow), 'Barlow Condensed', sans-serif;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.10em;
          text-transform: uppercase;
          color: rgba(240,232,214,0.80);
          text-decoration: none;
          border: 1px solid rgba(217,169,66,0.25);
          background: rgba(32,32,34,0.60);
          transition: all 0.15s;
        }
        .lp-btn-secondary:hover {
          color: #f3d48a;
          border-color: rgba(217,169,66,0.55);
          background: rgba(217,169,66,0.10);
        }

        .lp-section {
          position: relative;
          z-index: 2;
          max-width: 1120px;
          margin: 0 auto;
          padding: 40px 32px;
        }
        .lp-section-title {
          font-family: var(--font-barlow), 'Barlow Condensed', sans-serif;
          font-weight: 800;
          font-size: clamp(28px, 3.2vw, 40px);
          letter-spacing: 0.01em;
          text-transform: uppercase;
          margin: 0 0 14px;
          color: rgba(240,232,214,0.98);
          border-left: 3px solid #d9a942;
          padding-left: 14px;
        }
        .lp-section-sub {
          font-size: 15px;
          color: rgba(198,188,168,0.72);
          margin: 0 0 32px;
          max-width: 580px;
          line-height: 1.55;
        }

        .lp-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 14px;
        }
        .lp-card {
          padding: 22px 20px 20px;
          border-radius: 4px;
          border: 0;
          background: linear-gradient(180deg, rgba(36,36,38,0.96) 0%, rgba(22,22,24,0.97) 100%);
          box-shadow:
            inset 0 1px 0 rgba(255,248,220,0.05),
            inset 0 -1px 0 rgba(0,0,0,0.5),
            0 0 0 1px rgba(217,169,66,0.18),
            0 2px 0 rgba(0,0,0,0.25),
            0 6px 18px rgba(0,0,0,0.35);
          transition: all 0.2s;
        }
        .lp-card:hover {
          transform: translateY(-2px);
          box-shadow:
            inset 0 1px 0 rgba(255,248,220,0.08),
            inset 0 -1px 0 rgba(0,0,0,0.5),
            0 0 0 1px rgba(217,169,66,0.45),
            0 4px 0 rgba(0,0,0,0.28),
            0 14px 32px rgba(0,0,0,0.45),
            0 0 24px rgba(217,169,66,0.08);
        }
        .lp-card-icon {
          font-size: 22px;
          margin-bottom: 10px;
          display: block;
          filter: sepia(0.4) hue-rotate(-15deg) saturate(0.9);
        }
        .lp-card-title {
          font-family: var(--font-barlow), 'Barlow Condensed', sans-serif;
          font-weight: 800;
          font-size: 16px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          margin: 0 0 6px;
          color: #e6bd6e;
        }
        .lp-card-body {
          font-size: 13px;
          color: rgba(240,232,214,0.72);
          line-height: 1.55;
          margin: 0;
        }

        .lp-diff {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 22px;
        }
        .lp-diff-row {
          display: flex;
          gap: 14px;
          align-items: flex-start;
          padding: 14px 18px;
          border-radius: 4px;
          border: 1px solid rgba(217,169,66,0.14);
          background: rgba(32,32,34,0.55);
          box-shadow: inset 0 1px 0 rgba(255,248,220,0.03);
        }
        .lp-diff-mark {
          flex-shrink: 0;
          width: 24px;
          height: 24px;
          border-radius: 3px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 800;
          background: linear-gradient(180deg, #e6bd6e 0%, #d9a942 50%, #a87a1c 100%);
          color: #1a1a1c;
          box-shadow:
            inset 0 1px 0 rgba(255,248,220,0.35),
            inset 0 -1px 0 rgba(0,0,0,0.25);
          margin-top: 1px;
        }
        .lp-diff-text {
          font-size: 14px;
          color: rgba(240,232,214,0.82);
          line-height: 1.55;
        }
        .lp-diff-text strong {
          color: #e6bd6e;
          font-weight: 700;
        }

        .lp-foot-cta {
          position: relative;
          z-index: 2;
          max-width: 720px;
          margin: 80px auto 40px;
          padding: 48px 32px;
          text-align: center;
          border-radius: 4px;
          border: 0;
          background: linear-gradient(180deg, rgba(36,36,38,0.96) 0%, rgba(22,22,24,0.97) 100%);
          box-shadow:
            inset 0 1px 0 rgba(255,248,220,0.05),
            inset 0 -1px 0 rgba(0,0,0,0.5),
            0 0 0 1px rgba(217,169,66,0.28),
            0 4px 0 rgba(0,0,0,0.3),
            0 24px 80px rgba(0,0,0,0.5),
            0 0 60px rgba(217,169,66,0.06);
        }
        .lp-foot-cta h3 {
          font-family: var(--font-barlow), 'Barlow Condensed', sans-serif;
          font-weight: 800;
          font-size: clamp(26px, 3vw, 38px);
          letter-spacing: 0.02em;
          text-transform: uppercase;
          margin: 0 0 10px;
          color: rgba(240,232,214,0.98);
        }
        .lp-foot-cta p {
          font-size: 15px;
          color: rgba(198,188,168,0.75);
          margin: 0 0 26px;
          line-height: 1.55;
        }

        .lp-footer {
          position: relative;
          z-index: 2;
          display: flex;
          gap: 18px;
          flex-wrap: wrap;
          justify-content: center;
          align-items: center;
          padding: 30px 32px 40px;
          font-size: 12px;
          color: rgba(198,188,168,0.50);
          letter-spacing: 0.10em;
          text-transform: uppercase;
          font-weight: 600;
        }
        .lp-footer a {
          color: inherit;
          text-decoration: none;
          transition: color 0.15s;
        }
        .lp-footer a:hover {
          color: rgba(217,169,66,0.90);
        }
        .lp-footer-sep {
          color: rgba(217,169,66,0.28);
        }

        @keyframes lpFade {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 640px) {
          .lp-nav { padding: 16px 20px; }
          .lp-nav-links { display: none; }
          .lp-hero { padding: 56px 20px 60px; }
          .lp-section { padding: 28px 20px; }
          .lp-foot-cta { margin: 50px 20px 30px; padding: 36px 22px; }
          .lp-hero-cta { flex-direction: column; }
        }

        /* ── Activity ticker ───────────────────────────────────── */
        .lp-ticker {
          position: relative;
          z-index: 2;
          max-width: 1120px;
          margin: 0 auto;
          padding: 10px 20px 0;
          display: flex;
          align-items: center;
          gap: 14px;
          font-family: var(--font-rajdhani), 'Rajdhani', sans-serif;
        }
        .lp-ticker-label {
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #e6bd6e;
          background: rgba(217,169,66,.07);
          border: 1px solid rgba(217,169,66,.25);
          border-radius: 3px;
        }
        .lp-ticker-pulse {
          width: 6px; height: 6px; border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 0 0 rgba(34,197,94,.55);
          animation: lp-ticker-pulse 1.6s infinite;
        }
        @keyframes lp-ticker-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(34,197,94,.55); }
          70%  { box-shadow: 0 0 0 6px rgba(34,197,94,0); }
          100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
        }
        .lp-ticker-track {
          flex: 1;
          overflow: hidden;
          height: 28px;
          display: flex;
          align-items: center;
          mask-image: linear-gradient(90deg, transparent, #000 32px, #000 calc(100% - 32px), transparent);
          -webkit-mask-image: linear-gradient(90deg, transparent, #000 32px, #000 calc(100% - 32px), transparent);
        }
        .lp-ticker-marquee {
          display: inline-flex;
          align-items: center;
          gap: 0;
          white-space: nowrap;
          animation: lp-ticker-scroll 60s linear infinite;
        }
        .lp-ticker:hover .lp-ticker-marquee { animation-play-state: paused; }
        @keyframes lp-ticker-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .lp-ticker-item {
          display: inline-flex;
          align-items: baseline;
          gap: 8px;
          font-size: 13px;
          color: rgba(240,232,214,.78);
        }
        .lp-ticker-dot {
          width: 5px; height: 5px; border-radius: 50%;
          background: #d9a942;
          align-self: center;
        }
        .lp-ticker-text { color: rgba(240,232,214,.88); }
        .lp-ticker-ts   { color: rgba(198,188,168,.45); font-size: 11px; }
        .lp-ticker-sep  { color: rgba(198,188,168,.25); padding: 0 14px; }
        .lp-ticker-empty {
          font-size: 12px;
          color: rgba(198,188,168,.55);
          font-style: italic;
          letter-spacing: 0.04em;
        }

        /* ── Lobby wall ─────────────────────────────────────────── */
        .lp-wall {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 16px;
          perspective: 1200px;
        }
        .lp-wall-card {
          position: relative;
          appearance: none;
          background: #161616;
          border: 0;
          padding: 0;
          height: 220px;
          border-radius: 6px;
          overflow: hidden;
          cursor: pointer;
          color: inherit;
          text-align: left;
          font: inherit;
          will-change: transform;
          transition: transform 220ms cubic-bezier(.2,.7,.2,1), box-shadow 220ms;
          box-shadow:
            0 0 0 1px color-mix(in srgb, var(--lp-card-accent, #D9A942) 22%, rgba(0,0,0,.4)),
            0 12px 28px rgba(0,0,0,.45);
        }
        .lp-wall-card:hover {
          box-shadow:
            0 0 0 1px color-mix(in srgb, var(--lp-card-accent, #D9A942) 60%, rgba(0,0,0,.4)),
            0 0 36px color-mix(in srgb, var(--lp-card-accent, #D9A942) 28%, transparent),
            0 20px 36px rgba(0,0,0,.55);
        }
        .lp-wall-card-bg {
          position: absolute; inset: 0;
          background-size: cover;
          background-position: center;
          opacity: 0.55;
          transform: scale(1.05);
          transition: transform 600ms cubic-bezier(.2,.7,.2,1), opacity 220ms;
        }
        .lp-wall-card:hover .lp-wall-card-bg {
          transform: scale(1.12);
          opacity: 0.7;
        }
        .lp-wall-card-scrim {
          position: absolute; inset: 0;
          background: linear-gradient(180deg, rgba(20,20,22,0.05) 0%, rgba(20,20,22,0.55) 50%, rgba(14,14,16,0.92) 100%);
        }
        .lp-wall-card-glare {
          position: absolute; inset: 0;
          pointer-events: none;
          background: radial-gradient(circle at var(--lp-card-px, 50%) var(--lp-card-py, 50%), color-mix(in srgb, var(--lp-card-accent, #D9A942) 22%, transparent) 0%, transparent 45%);
          opacity: 0;
          transition: opacity 220ms;
        }
        .lp-wall-card:hover .lp-wall-card-glare { opacity: 1; }
        .lp-wall-card-body {
          position: relative;
          z-index: 1;
          height: 100%;
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .lp-wall-card-top {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .lp-wall-card-logo {
          width: 36px; height: 36px;
          border-radius: 6px;
          object-fit: cover;
          background: rgba(0,0,0,.4);
          border: 1px solid rgba(255,255,255,.08);
        }
        .lp-wall-card-logo--placeholder {
          display: grid; place-items: center;
          font-family: var(--font-pirata), serif;
          font-size: 16px;
          color: var(--lp-card-accent, #D9A942);
        }
        .lp-wall-card-titles { min-width: 0; flex: 1; }
        .lp-wall-card-name {
          font-family: var(--font-barlow), 'Barlow Condensed', sans-serif;
          font-weight: 800;
          font-size: 17px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: rgba(240,232,214,.98);
          line-height: 1.1;
        }
        .lp-wall-card-tag {
          font-size: 11px;
          color: rgba(198,188,168,.55);
          font-family: ui-monospace, monospace;
          margin-top: 2px;
        }
        .lp-wall-card-desc {
          font-size: 13px;
          color: rgba(240,232,214,.78);
          line-height: 1.45;
          font-family: var(--font-cormorant), serif;
        }
        .lp-wall-card-foot {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .lp-wall-card-live {
          display: inline-flex; align-items: center; gap: 6px;
          color: rgba(198,188,168,.7);
        }
        .lp-wall-card-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: rgba(198,188,168,.35);
        }
        .lp-wall-card-dot.is-on {
          background: #22c55e;
          box-shadow: 0 0 6px rgba(34,197,94,.7);
        }
        .lp-wall-card-cta {
          color: var(--lp-card-accent, #D9A942);
          font-weight: 700;
        }

        /* ── Preview modal ────────────────────────────────────── */
        .lp-modal-back {
          position: fixed; inset: 0; z-index: 1000;
          background: rgba(8,8,10,.78);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          display: grid; place-items: center;
          padding: 32px 16px;
          animation: lp-modal-in 140ms ease-out both;
        }
        @keyframes lp-modal-in { from { opacity: 0; } to { opacity: 1; } }
        .lp-modal-card {
          position: relative;
          width: 100%;
          max-width: 560px;
          max-height: calc(100vh - 64px);
          overflow: auto;
          background: #18181a;
          border: 1px solid color-mix(in srgb, var(--lp-modal-accent, #D9A942) 35%, rgba(0,0,0,.4));
          border-radius: 8px;
          box-shadow: 0 30px 80px rgba(0,0,0,.6),
                      0 0 0 1px color-mix(in srgb, var(--lp-modal-accent, #D9A942) 20%, transparent);
          color: rgba(240,232,214,.92);
          font-family: var(--font-rajdhani), 'Rajdhani', sans-serif;
        }
        .lp-modal-close {
          position: absolute; top: 8px; right: 10px; z-index: 4;
          background: rgba(0,0,0,.4); color: #d9a942;
          border: 1px solid rgba(217,169,66,.3);
          border-radius: 4px;
          width: 28px; height: 28px;
          font-size: 18px; line-height: 1;
          cursor: pointer;
        }
        .lp-modal-banner {
          height: 140px;
          background: linear-gradient(135deg, #2a2218 0%, #1a1a1c 100%);
          background-size: cover; background-position: center;
          position: relative;
        }
        .lp-modal-banner-scrim {
          position: absolute; inset: 0;
          background: linear-gradient(180deg, transparent 30%, #18181a 100%);
        }
        .lp-modal-head {
          display: flex; gap: 12px; align-items: center;
          padding: 16px 20px 8px;
          margin-top: -28px;
          position: relative;
          z-index: 2;
        }
        .lp-modal-logo {
          width: 56px; height: 56px;
          border-radius: 8px;
          object-fit: cover;
          background: #0e0e10;
          border: 2px solid color-mix(in srgb, var(--lp-modal-accent, #D9A942) 50%, #0e0e10);
        }
        .lp-modal-name {
          font-family: var(--font-barlow), 'Barlow Condensed', sans-serif;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          font-size: 22px;
          color: rgba(240,232,214,.98);
        }
        .lp-modal-id {
          font-family: ui-monospace, monospace;
          font-size: 11px;
          color: rgba(198,188,168,.55);
        }
        .lp-modal-counts { margin-left: auto; }
        .lp-modal-live {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 11px;
          letter-spacing: .06em;
          text-transform: uppercase;
          color: rgba(198,188,168,.7);
        }
        .lp-modal-desc {
          padding: 4px 20px 12px;
          font-size: 14px;
          color: rgba(240,232,214,.85);
          line-height: 1.55;
          font-family: var(--font-cormorant), serif;
        }
        .lp-modal-kw {
          display: flex; gap: 6px; flex-wrap: wrap;
          padding: 0 20px 8px;
        }
        .lp-modal-kw-pill {
          font-size: 10px;
          padding: 2px 8px;
          border-radius: 99px;
          background: rgba(217,169,66,.08);
          border: 1px solid rgba(217,169,66,.22);
          color: rgba(230,189,110,.85);
          letter-spacing: .04em;
          text-transform: lowercase;
        }
        .lp-modal-section-label {
          padding: 12px 20px 6px;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(198,188,168,.55);
        }
        .lp-modal-feed {
          padding: 0 20px 12px;
          display: flex; flex-direction: column; gap: 6px;
        }
        .lp-modal-feed-row {
          display: flex; align-items: baseline; gap: 8px;
          font-size: 13px;
          color: rgba(240,232,214,.82);
          padding: 4px 0;
          border-bottom: 1px solid rgba(217,169,66,.05);
        }
        .lp-modal-feed-dot {
          width: 5px; height: 5px; border-radius: 50%;
          align-self: center;
          flex: 0 0 auto;
        }
        .lp-modal-feed-text { flex: 1; }
        .lp-modal-feed-ts   { color: rgba(198,188,168,.45); font-size: 11px; }
        .lp-modal-empty {
          font-style: italic;
          color: rgba(198,188,168,.5);
          font-size: 13px;
          padding: 8px 0;
        }
        .lp-modal-cta-row {
          display: flex; gap: 10px;
          padding: 12px 20px 18px;
          border-top: 1px solid rgba(217,169,66,.1);
          flex-wrap: wrap;
        }
        .lp-modal-cta { flex: 1; text-align: center; }

        @media (max-width: 640px) {
          .lp-ticker { padding: 8px 16px 0; }
          .lp-ticker-label { font-size: 9px; padding: 3px 8px; }
          .lp-wall { grid-template-columns: 1fr; }
          .lp-wall-card { height: 200px; }
        }
      `}</style>

      <div className="lp-root">
        <nav className="lp-nav">
          <div className="lp-brand">
            <img src="/brand/logo/weered-logo-128.png" alt="Weered" />
            weered
          </div>
          <div className="lp-nav-links">
            <a href="#inside">The lobbies</a>
            <a href="#different">Why it's different</a>
            <Link href={getIn} className="lp-getin">get_in()</Link>
          </div>
        </nav>

        <section className="lp-hero">
          <div className="lp-eyebrow">The platform that isn't a bot</div>
          <h1 className="lp-headline">
            More than chat.<br />A place.
          </h1>
          <p className="lp-sub">
            Lobbies, rooms, voice, video, and deep game integrations — all built in, not bolted on. Weered is where gamers, creators, and communities actually hang out.
          </p>
          <div className="lp-hero-cta">
            <Link href={getIn} className="lp-btn-primary">get_in()</Link>
            <a href="#inside" className="lp-btn-secondary">See the wall →</a>
          </div>
        </section>

        <LandingActivityTicker />

        <section id="inside" className="lp-section">
          <h2 className="lp-section-title">The lobbies are open.</h2>
          <p className="lp-section-sub">
            Every tile is a real lobby with real members. Click one to peek inside — read-only — then get_in() to actually sit at the table.
          </p>
          <LobbyWall loginHref={getIn} />
        </section>

        <section id="different" className="lp-section">
          <h2 className="lp-section-title">Why it's different.</h2>
          <p className="lp-section-sub">
            You already have a chat app. Weered isn't trying to replace it — it's doing things it won't.
          </p>
          <div className="lp-diff">
            <div className="lp-diff-row">
              <div className="lp-diff-mark">✓</div>
              <div className="lp-diff-text">
                <strong>No invite links.</strong> Communities are discoverable by default. Lobbies live on the front page. People find you because they care about what you do — not because someone slid them a link.
              </div>
            </div>
            <div className="lp-diff-row">
              <div className="lp-diff-mark">✓</div>
              <div className="lp-diff-text">
                <strong>Game integrations are apps, not bots.</strong> Your Destiny clan leader can actually manage loadouts from inside Weered. Your League room shows real match state. This isn't a chat command — it's a real UI layer with authenticated context per user.
              </div>
            </div>
            <div className="lp-diff-row">
              <div className="lp-diff-mark">✓</div>
              <div className="lp-diff-text">
                <strong>An economy that works.</strong> Earning notoriety means something. Paper buys stuff. Tournaments have stakes. Your presence on the platform leaves marks.
              </div>
            </div>
            <div className="lp-diff-row">
              <div className="lp-diff-mark">✓</div>
              <div className="lp-diff-text">
                <strong>One place, many vibes.</strong> Same platform serves gamers, pickleballers, fishermen, storm chasers, D&D tables. Pick your vertical. The experience adapts.
              </div>
            </div>
          </div>
        </section>

        <section className="lp-foot-cta">
          <h3>Get in.</h3>
          <p>Free. Takes 30 seconds. Pick a handle and you're running.</p>
          <Link href={getIn} className="lp-btn-primary">get_in()</Link>
        </section>

        <footer className="lp-footer">
          <a href="/about">about</a>
          <span className="lp-footer-sep">·</span>
          <a href="/terms">terms</a>
          <span className="lp-footer-sep">·</span>
          <a href="/privacy">privacy</a>
          <span className="lp-footer-sep">·</span>
          <a href="/guidelines">guidelines</a>
          <span className="lp-footer-sep">·</span>
          <a href="/contact">contact</a>
          <span className="lp-footer-sep">·</span>
          <span>© weered.ca</span>
        </footer>
      </div>
    </>
  );
}


function LobbyWall({ loginHref }: { loginHref: string }) {
  const [lobbies, setLobbies] = useState<FeaturedLobby[] | null>(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState<FeaturedLobby | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`${LP_API}/public/lobbies/featured`, { cache: "no-store" });
        const j = await r.json();
        if (!alive) return;
        if (Array.isArray(j?.lobbies)) setLobbies(j.lobbies);
        else setError(true);
      } catch { if (alive) setError(true); }
    })();
    return () => { alive = false; };
  }, []);

  if (lobbies === null && !error) {
    return <div style={{ padding: 24, color: "rgba(198,188,168,.55)", fontSize: 13 }}>Lighting the lanterns…</div>;
  }
  if (error || (lobbies && !lobbies.length)) {
    return <div style={{ padding: 24, color: "rgba(198,188,168,.55)", fontSize: 13 }}>The wall will fill in shortly.</div>;
  }
  return (
    <>
      <div className="lp-wall">
        {lobbies!.map(l => (
          <LandingLobbyCard key={l.id} lobby={l} onOpen={setOpen} />
        ))}
      </div>
      {open && (
        <LandingLobbyPreviewModal
          lobby={open}
          loginHref={loginHref}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}
