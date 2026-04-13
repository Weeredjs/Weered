"use client";
import React, { useEffect, useState } from "react";

const GLYPHS = "アイウエオカキクケコサシスセソタチツテトナニヌネノ01";
function Glyph({ delay }: { delay: number }) {
  const [char, setChar] = useState(GLYPHS[0]);
  useEffect(() => {
    const t = setTimeout(() => {
      const iv = setInterval(() => setChar(GLYPHS[Math.floor(Math.random() * GLYPHS.length)]), 80);
      setTimeout(() => clearInterval(iv), 600);
    }, delay);
    return () => clearTimeout(t);
  }, [delay]);
  return <span style={{ color: "rgba(124,58,237,0.4)", fontFamily: "monospace" }}>{char}</span>;
}

export default function AboutContent() {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setTimeout(() => setVisible(true), 100); }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@700;800;900&display=swap');
        .about-root {
          height: 100%;
          overflow-y: auto;
          background: #050810;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          padding: 60px 24px;
          font-family: 'DM Mono', monospace;
          position: relative;
          overflow-x: hidden;
        }
        .about-root::before {
          content: '';
          position: fixed;
          inset: 0;
          background:
            radial-gradient(ellipse 70% 50% at 15% 10%, rgba(124,58,237,0.15) 0%, transparent 60%),
            radial-gradient(ellipse 50% 40% at 85% 90%, rgba(217,70,239,0.08) 0%, transparent 55%);
          pointer-events: none;
        }
        .about-root::after {
          content: '';
          position: fixed;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px);
          background-size: 52px 52px;
          pointer-events: none;
          mask-image: radial-gradient(ellipse 90% 90% at 50% 50%, black 20%, transparent 100%);
        }
        .about-inner {
          position: relative;
          z-index: 1;
          width: min(680px, 100%);
          opacity: 0;
          transform: translateY(20px);
          transition: opacity 0.8s ease, transform 0.8s ease;
        }
        .about-inner.visible { opacity: 1; transform: translateY(0); }
        .about-wordmark {
          font-family: 'Syne', sans-serif;
          font-weight: 900;
          font-size: clamp(52px, 10vw, 96px);
          letter-spacing: -4px;
          line-height: 1;
          background: linear-gradient(135deg, #fff 0%, rgba(167,139,250,0.8) 60%, rgba(124,58,237,0.6) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 6px;
        }
        .about-tagline {
          font-size: 11px;
          letter-spacing: 0.25em;
          text-transform: uppercase;
          color: rgba(124,58,237,0.6);
          margin-bottom: 64px;
        }
        .about-divider {
          width: 40px;
          height: 1px;
          background: linear-gradient(90deg, rgba(124,58,237,0.6), transparent);
          margin: 40px 0;
        }
        .about-block {
          margin-bottom: 48px;
        }
        .about-label {
          font-size: 10px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: rgba(124,58,237,0.5);
          margin-bottom: 16px;
        }
        .about-text {
          font-size: 15px;
          line-height: 1.9;
          color: rgba(232,232,240,0.75);
          font-family: 'DM Mono', monospace;
        }
        .about-text em {
          font-style: normal;
          color: rgba(167,139,250,0.9);
        }
        .about-footer {
          margin-top: 80px;
          padding-top: 24px;
          border-top: 1px solid rgba(255,255,255,0.05);
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 11px;
          color: rgba(255,255,255,0.15);
        }
        .about-nav {
          display: flex;
          gap: 24px;
        }
        .about-nav a {
          color: rgba(167,139,250,0.4);
          text-decoration: none;
          font-size: 11px;
          letter-spacing: 0.1em;
          transition: color 0.2s;
        }
        .about-nav a:hover { color: rgba(167,139,250,0.8); }
      `}</style>

      <div className="about-root">
        <div className={`about-inner${visible ? " visible" : ""}`}>

          <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
            {Array.from({ length: 8 }).map((_, i) => <Glyph key={i} delay={i * 120} />)}
          </div>

          <div className="about-wordmark">weered</div>
          <div className="about-tagline">communities · presence · rooms</div>

          <div className="about-block">
            <div className="about-label">// origin</div>
            <div className="about-text">
              Built in the dark.<br />
              No roadmap. No investors. No announcements.<br />
              Just a question: <em>what if online spaces felt like somewhere you actually wanted to be?</em>
            </div>
          </div>

          <div className="about-divider" />

          <div className="about-block">
            <div className="about-label">// what this is</div>
            <div className="about-text">
              Weered is a <em>real-time community platform</em>.<br />
              Think lobbies, not servers. Rooms, not channels. Presence, not status dots.<br /><br />
              <em>Lobbies</em> are living spaces — communities built around games, trading, studying, business, whatever pulls people in.
              Each one has its own identity, roles, events, and deep integrations.<br /><br />
              <em>Rooms</em> are where things happen. Voice chat, video, screen share, watch parties, poker tables, study sessions.
              Drop into a room and you&apos;re there — not lurking in a sidebar, actually <em>present</em>.<br /><br />
              <em>Modules</em> plug directly into the things you care about.
              Destiny 2 guardian lookup. League of Legends leaderboards. CS2 squad finder. Fortnite stats.
              Dota 2 player search. Live Twitch streams. Paper trading with real Binance prices.
              Poker with virtual currency. AI-powered practice tests. Pomodoro focus timers.<br /><br />
              <em>The Operator</em> — our AI — lives in every chat. Type @operator and ask anything. It knows the platform, and it&apos;s got attitude.<br /><br />
              <em>Paper</em> — virtual currency. Earn it from trading profits, challenges, daily bonuses. Spend it in the Store, use it at the poker table, trade items with other users.<br /><br />
              The feed, the chat, the rooms — they all orbit <em>presence</em>.
              Who is here. What they&apos;re doing. Right now.
            </div>
          </div>

          <div className="about-divider" />

          <div className="about-block">
            <div className="about-label">// how it feels</div>
            <div className="about-text">
              Every platform looks like every other platform.<br />
              Weered doesn&apos;t.<br />
              The aesthetic is intentional — <em>dark, cinematic, a little dangerous</em>.<br />
              It&apos;s supposed to feel like a place, not a product.
            </div>
          </div>

          <div className="about-divider" />

          <div className="about-block">
            <div className="about-label">// who runs this</div>
            <div className="about-text">
              Someone who got tired of every platform feeling the same.<br />
              That&apos;s all you get for now.<br />
              <em>You know the username.</em>
            </div>
          </div>

          <div className="about-divider" />

          <div className="about-block">
            <div className="about-label">// status</div>
            <div className="about-text">
              Early access. Growing fast.<br />
              30+ lobbies. Voice, video, screen share. Poker. Paper trading. AI quiz generator. Focus rooms.<br />
              New features ship daily. The rough edges are temporary. The vision isn&apos;t.<br />
              <em>If you&apos;re here now, you were supposed to find it.</em>
            </div>
          </div>

          <div className="about-footer">
            <span>&copy; weered.ca</span>
            <nav className="about-nav">
              <a href="/premium">premium</a>
              <a href="/contact">contact</a>
              <a href="/login">enter</a>
            </nav>
          </div>

        </div>
      </div>
    </>
  );
}
