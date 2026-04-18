"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

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
      background: "#080810",
      color: "rgba(243,244,246,.55)",
      fontFamily: "'DM Mono', monospace",
      fontSize: 12,
      letterSpacing: "0.08em",
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
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@700;800&display=swap');
        .lp-root {
          min-height: 100vh;
          background: #080810;
          color: rgba(243,244,246,0.95);
          font-family: 'DM Mono', monospace;
          position: relative;
          overflow-x: hidden;
        }
        .lp-root::before {
          content: '';
          position: fixed;
          inset: 0;
          background:
            radial-gradient(ellipse 80% 50% at 10% 0%, rgba(124,58,237,0.18) 0%, transparent 60%),
            radial-gradient(ellipse 60% 40% at 90% 100%, rgba(217,70,239,0.10) 0%, transparent 55%);
          pointer-events: none;
          z-index: 0;
        }
        .lp-root::after {
          content: '';
          position: fixed;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
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
          font-family: 'Syne', sans-serif;
          font-weight: 800;
          font-size: 20px;
          letter-spacing: -0.02em;
          color: rgba(243,244,246,0.98);
        }
        .lp-brand img {
          width: 28px;
          height: 28px;
          border-radius: 7px;
        }
        .lp-nav-links {
          display: flex;
          gap: 24px;
          align-items: center;
          font-size: 12px;
          color: rgba(148,163,184,0.65);
        }
        .lp-nav-links a {
          color: inherit;
          text-decoration: none;
          transition: color 0.15s;
        }
        .lp-nav-links a:hover {
          color: rgba(196,181,253,0.95);
        }
        .lp-getin {
          padding: 8px 16px;
          border-radius: 9px;
          background: rgba(124,58,237,0.18);
          border: 1px solid rgba(124,58,237,0.45);
          color: rgba(196,181,253,0.95);
          font-family: 'DM Mono', monospace;
          font-size: 12px;
          font-weight: 700;
          text-decoration: none;
          letter-spacing: 0.04em;
          box-shadow: 0 2px 8px rgba(124,58,237,0.18), inset 0 1px 0 rgba(255,255,255,0.06);
          transition: all 0.15s;
        }
        .lp-getin:hover {
          background: rgba(124,58,237,0.28);
          border-color: rgba(124,58,237,0.6);
          box-shadow: 0 4px 18px rgba(124,58,237,0.32);
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
          letter-spacing: 0.24em;
          text-transform: uppercase;
          color: rgba(196,181,253,0.75);
          margin-bottom: 20px;
          font-weight: 500;
        }
        .lp-headline {
          font-family: 'Syne', sans-serif;
          font-weight: 800;
          font-size: clamp(36px, 7vw, 76px);
          line-height: 1.02;
          letter-spacing: -0.035em;
          background: linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(196,181,253,0.85) 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
          margin: 0 0 22px;
          animation: lpFade 0.7s cubic-bezier(0.22,1,0.36,1) both;
        }
        .lp-sub {
          font-size: clamp(14px, 1.6vw, 17px);
          color: rgba(203,213,225,0.72);
          max-width: 620px;
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
          padding: 14px 28px;
          border-radius: 12px;
          font-family: 'DM Mono', monospace;
          font-size: 14px;
          font-weight: 800;
          letter-spacing: 0.04em;
          text-decoration: none;
          background: linear-gradient(135deg, #7C3AED 0%, #D946EF 100%);
          color: #fff;
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.05),
            0 8px 32px rgba(124,58,237,0.35),
            inset 0 1px 0 rgba(255,255,255,0.18);
          transition: all 0.18s cubic-bezier(0.22,1,0.36,1);
        }
        .lp-btn-primary:hover {
          transform: translateY(-1px);
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.08),
            0 12px 40px rgba(124,58,237,0.5),
            inset 0 1px 0 rgba(255,255,255,0.24);
        }
        .lp-btn-secondary {
          padding: 13px 22px;
          border-radius: 12px;
          font-family: 'DM Mono', monospace;
          font-size: 13px;
          font-weight: 700;
          color: rgba(203,213,225,0.78);
          text-decoration: none;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.02);
          transition: all 0.15s;
        }
        .lp-btn-secondary:hover {
          color: rgba(243,244,246,0.98);
          border-color: rgba(255,255,255,0.18);
          background: rgba(255,255,255,0.05);
        }

        .lp-section {
          position: relative;
          z-index: 2;
          max-width: 1120px;
          margin: 0 auto;
          padding: 40px 32px;
        }
        .lp-section-title {
          font-family: 'Syne', sans-serif;
          font-weight: 800;
          font-size: clamp(24px, 3vw, 32px);
          letter-spacing: -0.02em;
          margin: 0 0 14px;
          color: rgba(243,244,246,0.98);
        }
        .lp-section-sub {
          font-size: 14px;
          color: rgba(148,163,184,0.7);
          margin: 0 0 32px;
          max-width: 560px;
          line-height: 1.55;
        }

        .lp-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 14px;
        }
        .lp-card {
          padding: 22px 20px 20px;
          border-radius: 14px;
          border: 1px solid rgba(124,58,237,0.18);
          background: rgba(12,12,20,0.85);
          backdrop-filter: blur(16px);
          transition: all 0.2s;
        }
        .lp-card:hover {
          border-color: rgba(124,58,237,0.4);
          transform: translateY(-2px);
          box-shadow: 0 12px 32px rgba(0,0,0,0.4), 0 0 24px rgba(124,58,237,0.1);
        }
        .lp-card-icon {
          font-size: 22px;
          margin-bottom: 10px;
          display: block;
        }
        .lp-card-title {
          font-family: 'Syne', sans-serif;
          font-weight: 800;
          font-size: 15px;
          letter-spacing: -0.01em;
          margin: 0 0 6px;
          color: rgba(243,244,246,0.98);
        }
        .lp-card-body {
          font-size: 12px;
          color: rgba(148,163,184,0.72);
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
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.06);
          background: rgba(255,255,255,0.02);
        }
        .lp-diff-mark {
          flex-shrink: 0;
          width: 22px;
          height: 22px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 800;
          background: rgba(124,58,237,0.16);
          color: rgba(196,181,253,0.95);
          border: 1px solid rgba(124,58,237,0.3);
          margin-top: 1px;
        }
        .lp-diff-text {
          font-size: 13px;
          color: rgba(203,213,225,0.85);
          line-height: 1.55;
        }
        .lp-diff-text strong {
          color: rgba(243,244,246,0.98);
          font-weight: 700;
        }

        .lp-foot-cta {
          position: relative;
          z-index: 2;
          max-width: 720px;
          margin: 80px auto 40px;
          padding: 48px 32px;
          text-align: center;
          border-radius: 20px;
          border: 1px solid rgba(124,58,237,0.24);
          background: rgba(12,12,20,0.85);
          backdrop-filter: blur(16px);
          box-shadow: 0 24px 80px rgba(0,0,0,0.5), 0 0 60px rgba(124,58,237,0.08);
        }
        .lp-foot-cta h3 {
          font-family: 'Syne', sans-serif;
          font-weight: 800;
          font-size: clamp(22px, 3vw, 32px);
          letter-spacing: -0.02em;
          margin: 0 0 10px;
          color: rgba(243,244,246,0.98);
        }
        .lp-foot-cta p {
          font-size: 14px;
          color: rgba(148,163,184,0.7);
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
          font-size: 11px;
          color: rgba(148,163,184,0.45);
          letter-spacing: 0.04em;
        }
        .lp-footer a {
          color: inherit;
          text-decoration: none;
          transition: color 0.15s;
        }
        .lp-footer a:hover {
          color: rgba(203,213,225,0.85);
        }
        .lp-footer-sep {
          color: rgba(148,163,184,0.2);
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
      `}</style>

      <div className="lp-root">
        <nav className="lp-nav">
          <div className="lp-brand">
            <img src="/brand/logo/weered-logo-128.png" alt="Weered" />
            weered
          </div>
          <div className="lp-nav-links">
            <a href="#inside">What's inside</a>
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
            <a href="#inside" className="lp-btn-secondary">See what's inside →</a>
          </div>
        </section>

        <section id="inside" className="lp-section">
          <h2 className="lp-section-title">What's inside.</h2>
          <p className="lp-section-sub">
            Weered isn't a bot ecosystem. Everything below is first-class — written to work together.
          </p>
          <div className="lp-grid">
            <div className="lp-card">
              <span className="lp-card-icon">🎮</span>
              <h3 className="lp-card-title">Game integrations, baked in</h3>
              <p className="lp-card-body">Destiny loadouts. League ranks. PoE prices. Fortnite shop. Not bot commands — real apps with authenticated user context.</p>
            </div>
            <div className="lp-card">
              <span className="lp-card-icon">🗣</span>
              <h3 className="lp-card-title">Voice, video, shared screens</h3>
              <p className="lp-card-body">Low-latency voice and video in every room. Shared YouTube, Twitch, and browser. Watch together without leaving chat.</p>
            </div>
            <div className="lp-card">
              <span className="lp-card-icon">💵</span>
              <h3 className="lp-card-title">Paper economy</h3>
              <p className="lp-card-body">A closed-loop currency called Paper. Earn it by showing up, spend it in the store, stake it on tournaments. Your notoriety is tracked.</p>
            </div>
            <div className="lp-card">
              <span className="lp-card-icon">📈</span>
              <h3 className="lp-card-title">FakeOut — paper trading</h3>
              <p className="lp-card-body">$100K of fake money, real Binance price feeds, TradingView charts, lobby leaderboards. First-of-its-kind inside a community platform.</p>
            </div>
            <div className="lp-card">
              <span className="lp-card-icon">📰</span>
              <h3 className="lp-card-title">Live content feed</h3>
              <p className="lp-card-body">Hot stories from Reddit, YouTube, sports APIs, game publishers. Click any story to enter a room with everyone else reading it.</p>
            </div>
            <div className="lp-card">
              <span className="lp-card-icon">🤖</span>
              <h3 className="lp-card-title">The Operator</h3>
              <p className="lp-card-body">A resident AI character, not another bot. @operator in any chat. Knows Weered, knows the games, has attitude.</p>
            </div>
            <div className="lp-card">
              <span className="lp-card-icon">🎲</span>
              <h3 className="lp-card-title">D&D, Poker, Study rooms</h3>
              <p className="lp-card-body">NPC voice generators. Full Texas Hold'em with Paper stakes. Pomodoro study rooms with ambient scenes. Pick your vibe.</p>
            </div>
            <div className="lp-card">
              <span className="lp-card-icon">📍</span>
              <h3 className="lp-card-title">Locator</h3>
              <p className="lp-card-body">Opt-in GPS. Find LFG groups nearby. Regional leaderboards. A heatmap of what's happening in your city.</p>
            </div>
          </div>
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
