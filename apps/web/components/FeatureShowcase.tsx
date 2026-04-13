"use client";

import React, { useState } from "react";

// ── Feature Showcase Overlay ─────────────────────────────────────────────────
// "What can you do here?" — accessible from home page top bar

interface Props { open: boolean; onClose: () => void }

const SECTIONS = [
  {
    title: "Your Own Lobby",
    icon: "🏠",
    color: "#7C3AED",
    items: [
      { label: "Business HQ", desc: "Virtual office with directory, team status, and announcements. Run your company from a Weered lobby." },
      { label: "Community Hub", desc: "Build your own community around anything — gaming, music, anime, crypto, fitness, book clubs. Your rules, your space." },
      { label: "Custom Branding", desc: "Your logo, banner images, role hierarchy. Five-tier permission system with custom role titles." },
      { label: "Moderation Tools", desc: "Ban management, audit logging, chat lock, room-level roles. You're the boss." },
    ],
  },
  {
    title: "Voice & Video Rooms",
    icon: "🎙️",
    color: "#22c55e",
    items: [
      { label: "Voice Chat", desc: "Low-latency voice powered by LiveKit. Join any room and talk." },
      { label: "Video & Screen Share", desc: "Face cam, screen share, or both. Great for study groups, watch parties, or team standups." },
      { label: "YouTube Sync", desc: "Search YouTube, pick a video, and everyone in the room watches together. Built-in search — no URL pasting needed." },
      { label: "Twitch Streams", desc: "Embed any Twitch stream directly in your room. Watch together with voice chat." },
    ],
  },
  {
    title: "Game Integrations",
    icon: "🎮",
    color: "#f59e0b",
    items: [
      { label: "Destiny 2", desc: "Bungie API — character viewer, exotic collection, raid stats, vendor sales. Full guardian profile." },
      { label: "League of Legends", desc: "Riot API — summoner lookup, ranked stats, champion rotation, leaderboards." },
      { label: "Fortnite", desc: "Player stats, item shop, cosmetics browser, in-game news feed." },
      { label: "PUBG", desc: "Krafton API — player stats, weapon mastery, match history with full telemetry, seasonal leaderboards." },
      { label: "CS2 & Dota 2", desc: "Squad finders with rank/region filters. Stack up with people who actually play your role." },
      { label: "LFG (Looking for Group)", desc: "Every game lobby has a built-in squad finder. Filter by rank, region, playstyle. No more solo queue." },
    ],
  },
  {
    title: "Paper Economy",
    icon: "💵",
    color: "#D4A017",
    items: [
      { label: "Paper Currency", desc: "Earn Paper from daily bonuses, FakeOut profits, and challenges. Spend it in the store or at the poker table." },
      { label: "Notoriety (XP)", desc: "Level up from Innocent to Kingpin. Every action earns Notoriety — post, chat, trade, play." },
      { label: "FakeOut Paper Trading", desc: "Real-time crypto charts, $100K fake money, leaderboards. Practice trading risk-free." },
      { label: "Texas Hold'em", desc: "Real poker engine with Paper buy-ins. Sit down, bet, bluff, win. Up to 6 players per table." },
      { label: "Store & Marketplace", desc: "Spend Paper on cosmetics, badges, and items. Trade with other users on the marketplace." },
    ],
  },
  {
    title: "Productivity & Study",
    icon: "📚",
    color: "#3b82f6",
    items: [
      { label: "Focus Timer", desc: "Pomodoro timer with animated ring. 25/5 or custom intervals. Study alone or with a group." },
      { label: "AI Practice Tests", desc: "Paste your notes, and The Operator generates quiz questions. Score tracked with results breakdown." },
      { label: "Study Rooms", desc: "Ambient backgrounds (library, coffee shop, rain). Find study partners. Voice optional." },
    ],
  },
  {
    title: "The Operator (AI)",
    icon: "🤖",
    color: "#a78bfa",
    items: [
      { label: "In Every Room", desc: "Type @operator or /ask in any chat. Powered by Claude Haiku 4.5 — fast, sharp, always on." },
      { label: "GTA Street Personality", desc: "Not your typical assistant. The Operator talks like a character, not a chatbot." },
      { label: "AI Quiz Generator", desc: "Paste notes into the Study module and The Operator builds practice tests on the fly." },
    ],
  },
  {
    title: "Social Layer",
    icon: "📡",
    color: "#ec4899",
    items: [
      { label: "Crews", desc: "Private group chats that persist across rooms. Your squad, always connected." },
      { label: "DMs & Friends", desc: "Direct messages, friend requests, online status. The basics, done right." },
      { label: "Live Map", desc: "Opt-in GPS map showing where users are active worldwide. ~5km hex grid — privacy first." },
      { label: "Forum", desc: "Community board for long-form posts, announcements, and mod applications." },
      { label: "Activity Feed", desc: "See what's happening — who joined, who's streaming, who hit a new tier." },
    ],
  },
];

const WISHLIST = [
  { label: "Fantasy Football", desc: "Draft rooms with voice, live game day watch parties, AI start/sit advice from The Operator.", status: "Planned" },
  { label: "Tournament Brackets", desc: "Single elimination and round robin formats with Paper prize pools.", status: "Planned" },
  { label: "Spotify Listen Along", desc: "See what the room host is playing, album art, Listen Along links.", status: "Exploring" },
  { label: "NFL / NBA / MLB Live", desc: "Real-time scores, play-by-play, and watch party rooms synced to game time.", status: "Exploring" },
  { label: "Custom Game Modules", desc: "Request any game integration. If there's an API, we can build it. Seriously.", status: "Open" },
  { label: "Mobile App", desc: "Native iOS and Android apps with push notifications and voice.", status: "Planned" },
  { label: "Betting with Paper", desc: "Prop bets, prediction markets, and wagers between friends — all in Paper currency.", status: "Exploring" },
];

export default function FeatureShowcase({ open, onClose }: Props) {
  const [tab, setTab] = useState<"features" | "wishlist">("features");
  if (!open) return null;

  return (
    <>
      <style>{`
        .showcase-overlay { position: fixed; inset: 0; z-index: 9999; background: rgba(3,3,8,0.92); backdrop-filter: blur(12px); display: flex; align-items: center; justify-content: center; }
        .showcase-card { background: rgba(12,12,20,0.97); border: 1px solid rgba(124,58,237,0.2); border-radius: 20px; width: 90vw; max-width: 780px; max-height: 85vh; display: flex; flex-direction: column; overflow: hidden; }
        .showcase-header { padding: 28px 32px 0; flex-shrink: 0; }
        .showcase-title { font-size: 24px; font-weight: 900; letter-spacing: -0.5px; background: linear-gradient(135deg, #fff 30%, #a78bfa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .showcase-sub { font-size: 13px; color: rgba(148,163,184,0.6); margin-top: 6px; line-height: 1.6; }
        .showcase-sub em { color: #a78bfa; font-style: normal; font-weight: 600; }
        .showcase-tabs { display: flex; gap: 4px; margin-top: 18px; }
        .showcase-tab { padding: 8px 18px; border-radius: 8px 8px 0 0; font-size: 12px; font-weight: 700; cursor: pointer; border: none; letter-spacing: 0.04em; transition: all 0.15s; font-family: inherit; }
        .showcase-tab-active { background: rgba(124,58,237,0.15); color: #a78bfa; border-bottom: 2px solid #7C3AED; }
        .showcase-tab-inactive { background: transparent; color: rgba(255,255,255,0.3); border-bottom: 2px solid transparent; }
        .showcase-tab-inactive:hover { color: rgba(255,255,255,0.5); }
        .showcase-body { flex: 1; overflow-y: auto; padding: 20px 32px 32px; scrollbar-width: thin; scrollbar-color: rgba(124,58,237,0.2) transparent; }
        .showcase-section { margin-bottom: 24px; }
        .showcase-section-head { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
        .showcase-section-icon { font-size: 18px; }
        .showcase-section-title { font-size: 15px; font-weight: 800; letter-spacing: -0.3px; }
        .showcase-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .showcase-item { padding: 12px 14px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.05); background: rgba(255,255,255,0.02); transition: all 0.12s; }
        .showcase-item:hover { background: rgba(124,58,237,0.06); border-color: rgba(124,58,237,0.15); }
        .showcase-item-label { font-size: 12px; font-weight: 700; color: rgba(243,244,246,0.9); margin-bottom: 3px; }
        .showcase-item-desc { font-size: 11px; color: rgba(148,163,184,0.5); line-height: 1.5; }
        .showcase-close { position: absolute; top: 16px; right: 20px; background: none; border: none; color: rgba(255,255,255,0.3); font-size: 20px; cursor: pointer; padding: 4px 8px; border-radius: 6px; transition: all 0.12s; }
        .showcase-close:hover { color: rgba(255,255,255,0.7); background: rgba(255,255,255,0.06); }
        .showcase-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 9px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin-left: 8px; }
        .showcase-powered { padding: 16px 32px; border-top: 1px solid rgba(255,255,255,0.04); font-size: 11px; color: rgba(148,163,184,0.3); text-align: center; flex-shrink: 0; }
        .showcase-powered em { color: rgba(167,139,250,0.5); font-style: normal; }
        @media (max-width: 640px) {
          .showcase-card { width: 95vw; max-height: 90vh; border-radius: 14px; }
          .showcase-header { padding: 20px 18px 0; }
          .showcase-body { padding: 14px 18px 24px; }
          .showcase-title { font-size: 19px; }
          .showcase-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="showcase-overlay" onClick={onClose}>
        <div className="showcase-card" onClick={e => e.stopPropagation()} style={{ position: "relative" }}>
          <button className="showcase-close" onClick={onClose}>✕</button>

          <div className="showcase-header">
            <div className="showcase-title">What Can You Build Here?</div>
            <div className="showcase-sub">
              Weered is a lobby-first platform where <em>every room is customizable</em>. Voice, video, game stats, trading, poker, AI — all built in.
              Create your own lobby for your business, community, or squad. Every feature below is live right now.
            </div>
            <div className="showcase-tabs">
              <button className={`showcase-tab ${tab === "features" ? "showcase-tab-active" : "showcase-tab-inactive"}`} onClick={() => setTab("features")}>
                Live Features
              </button>
              <button className={`showcase-tab ${tab === "wishlist" ? "showcase-tab-active" : "showcase-tab-inactive"}`} onClick={() => setTab("wishlist")}>
                Wishlist & Roadmap
              </button>
            </div>
          </div>

          <div className="showcase-body">
            {tab === "features" ? (
              <>
                {SECTIONS.map(section => (
                  <div key={section.title} className="showcase-section">
                    <div className="showcase-section-head">
                      <span className="showcase-section-icon">{section.icon}</span>
                      <span className="showcase-section-title" style={{ color: section.color }}>{section.title}</span>
                    </div>
                    <div className="showcase-grid">
                      {section.items.map(item => (
                        <div key={item.label} className="showcase-item">
                          <div className="showcase-item-label">{item.label}</div>
                          <div className="showcase-item-desc">{item.desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div>
                <div style={{ fontSize: 13, color: "rgba(148,163,184,0.5)", marginBottom: 16, lineHeight: 1.7 }}>
                  Weered sits on <em style={{ color: "#a78bfa", fontStyle: "normal", fontWeight: 600 }}>Claude Opus 4.6</em> — the same AI building these features in real time.
                  If there's an API for it, we can integrate it. If there isn't, we'll build it anyway.
                  <strong style={{ color: "rgba(255,255,255,0.6)" }}> Request a module and watch it ship.</strong>
                </div>
                <div className="showcase-grid">
                  {WISHLIST.map(item => {
                    const statusColor = item.status === "Planned" ? "#22c55e" : item.status === "Exploring" ? "#f59e0b" : "#3b82f6";
                    return (
                      <div key={item.label} className="showcase-item">
                        <div className="showcase-item-label">
                          {item.label}
                          <span className="showcase-badge" style={{ background: `${statusColor}22`, color: statusColor }}>{item.status}</span>
                        </div>
                        <div className="showcase-item-desc">{item.desc}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: 24, padding: "16px 18px", borderRadius: 12, border: "1px solid rgba(124,58,237,0.2)", background: "rgba(124,58,237,0.05)", textAlign: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(243,244,246,0.8)", marginBottom: 4 }}>Got an idea?</div>
                  <div style={{ fontSize: 11, color: "rgba(148,163,184,0.5)", lineHeight: 1.6 }}>
                    Post it in the Forum or tell The Operator. If it makes sense, it gets built. No feature request forms. No 6-month roadmaps. Just ship.
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="showcase-powered">
            Built with <em>Claude Opus 4.6</em> by Anthropic — custom modules built on demand
          </div>
        </div>
      </div>
    </>
  );
}
