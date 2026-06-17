"use client";

import React, { useState } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
}

const PILLARS = [
  {
    icon: "🎮",
    color: "#a78bfa",
    title: "The game lobby, reborn",
    line: "Every game gets its own lobby — voice, crews, and live presence built in. The MPlayer/Xfire feeling, back and better.",
  },
  {
    icon: "🔊",
    color: "#22c55e",
    title: "Talk, watch, play together",
    line: "Low-latency voice and video, screen share, synced YouTube and Twitch. Pull up a room and hang.",
  },
  {
    icon: "🧭",
    color: "#60a5fa",
    title: "It knows your game",
    line: "Live stats, LFG with roles and reliability, squad finders. The lobby actually understands what you're playing.",
  },
  {
    icon: "💸",
    color: "#fbbf24",
    title: "An economy with stakes",
    line: "Earn Notoriety from Innocent to Kingpin. Paper currency, poker, paper-trading. Your presence leaves marks.",
  },
  {
    icon: "🤖",
    color: "#ec4899",
    title: "The Operator",
    line: "An AI in every room that talks like a character, not a chatbot. Ask it anything. It's got attitude.",
  },
  {
    icon: "🏠",
    color: "#7C3AED",
    title: "Make it yours",
    line: "Spin up your own lobby for your crew, community, or business. Your branding, your roles, your rules.",
  },
];

const SECTIONS = [
  {
    title: "Your Own Lobby",
    icon: "🏠",
    color: "#7C3AED",
    items: [
      {
        label: "Community Hub",
        desc: "Build a community around anything — gaming, music, anime, crypto, fitness, book clubs.",
      },
      {
        label: "Business HQ",
        desc: "Virtual office with directory, team status, and announcements.",
      },
      {
        label: "Custom Branding",
        desc: "Your logo, banners, and a five-tier role hierarchy with custom titles.",
      },
      {
        label: "Moderation Tools",
        desc: "Ban management, audit logging, chat lock, room-level roles.",
      },
    ],
  },
  {
    title: "Voice & Video Rooms",
    icon: "🎙️",
    color: "#22c55e",
    items: [
      {
        label: "Voice Chat",
        desc: "Low-latency voice powered by LiveKit. Join any room and talk.",
      },
      {
        label: "Video & Screen Share",
        desc: "Face cam, screen share, or both. Watch parties, study groups, standups.",
      },
      { label: "YouTube Sync", desc: "Search YouTube and everyone in the room watches together." },
      { label: "Twitch Streams", desc: "Embed any Twitch stream directly in your room." },
    ],
  },
  {
    title: "Game Integrations & LFG",
    icon: "🎮",
    color: "#f59e0b",
    items: [
      {
        label: "Live Game Data",
        desc: "Destiny 2, League, Fortnite, PUBG, CS2, Dota 2 — stats, profiles, vendors, leaderboards.",
      },
      {
        label: "LFG with Roles + Reputation",
        desc: "Post a session, claim a role, build a reliability track record. No more flaky randoms.",
      },
      {
        label: "Squad Finders",
        desc: "Filter by rank, region, and playstyle. Stack with people who play your role.",
      },
      {
        label: "GTA 6 Hub",
        desc: "Crew finder, heist teams, live news, countdown — aging ahead of launch.",
      },
    ],
  },
  {
    title: "Paper Economy",
    icon: "💵",
    color: "#D4A017",
    items: [
      {
        label: "Notoriety (XP)",
        desc: "Level Innocent → Kingpin. Every action earns it — post, chat, trade, play.",
      },
      {
        label: "Paper Currency",
        desc: "Earn from daily bonuses, FakeOut profits, and challenges. Spend in the store or at poker.",
      },
      {
        label: "FakeOut Trading",
        desc: "Real-time crypto charts, $100K fake money, leaderboards. Risk-free.",
      },
      {
        label: "Texas Hold'em",
        desc: "Real poker engine with Paper buy-ins. Up to 6 players per table.",
      },
    ],
  },
  {
    title: "Social & Study",
    icon: "📡",
    color: "#ec4899",
    items: [
      {
        label: "Crews",
        desc: "Private group chats that persist across rooms. Your squad, always connected.",
      },
      {
        label: "DMs, Friends & Forum",
        desc: "Direct messages, friend requests, online status, and a community board.",
      },
      {
        label: "Focus & Study Rooms",
        desc: "Pomodoro timer, ambient backgrounds, AI practice tests from your notes.",
      },
      {
        label: "Locator",
        desc: "Opt-in map of where users are active. ~5km hex grid — privacy first.",
      },
    ],
  },
];

const WISHLIST = [
  {
    label: "Fantasy Football",
    desc: "Draft rooms with voice, live game-day watch parties, AI start/sit advice.",
    status: "Planned",
  },
  {
    label: "Tournament Brackets",
    desc: "Single elimination and round robin with Paper prize pools.",
    status: "Planned",
  },
  {
    label: "Spotify Listen Along",
    desc: "See what the room host is playing, album art, Listen Along links.",
    status: "Exploring",
  },
  {
    label: "NFL / NBA / MLB Live",
    desc: "Real-time scores, play-by-play, watch parties synced to game time.",
    status: "Exploring",
  },
  {
    label: "Custom Game Modules",
    desc: "Request any game integration. If there's an API, we can build it.",
    status: "Open",
  },
  {
    label: "Mobile App",
    desc: "Native iOS and Android with push notifications and voice.",
    status: "Planned",
  },
];

export default function FeatureShowcase({ open, onClose }: Props) {
  const [tab, setTab] = useState<"features" | "wishlist">("features");
  const [showAll, setShowAll] = useState(false);
  if (!open) return null;

  return (
    <>
      <style>{`
        .showcase-overlay { position: fixed; inset: 0; z-index: 9999; background: rgba(3,3,8,0.92); backdrop-filter: blur(12px); display: flex; align-items: center; justify-content: center; }
        .showcase-card { background: rgba(12,12,20,0.97); border: 1px solid rgba(124,58,237,0.2); border-radius: 20px; width: 90vw; max-width: 820px; max-height: 86vh; display: flex; flex-direction: column; overflow: hidden; }
        .showcase-header { padding: 26px 32px 0; flex-shrink: 0; }
        .showcase-eyebrow { font-size: 10px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: #a78bfa; opacity: 0.8; }
        .showcase-title { font-size: 30px; font-weight: 900; letter-spacing: -1px; line-height: 1.05; margin-top: 6px; background: linear-gradient(135deg, #fff 35%, #a78bfa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .showcase-sub { font-size: 14px; color: rgba(203,213,225,0.7); margin-top: 8px; line-height: 1.55; max-width: 620px; }
        .showcase-tabs { display: flex; gap: 4px; margin-top: 18px; }
        .showcase-tab { padding: 8px 18px; border-radius: 8px 8px 0 0; font-size: 12px; font-weight: 700; cursor: pointer; border: none; letter-spacing: 0.04em; transition: all 0.15s; font-family: inherit; }
        .showcase-tab-active { background: rgba(124,58,237,0.15); color: #a78bfa; border-bottom: 2px solid #7C3AED; }
        .showcase-tab-inactive { background: transparent; color: rgba(255,255,255,0.3); border-bottom: 2px solid transparent; }
        .showcase-tab-inactive:hover { color: rgba(255,255,255,0.5); }
        .showcase-body { flex: 1; overflow-y: auto; padding: 22px 32px 32px; scrollbar-width: thin; scrollbar-color: rgba(124,58,237,0.2) transparent; }
        .pillar-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .pillar { padding: 18px 18px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.06); background: rgba(255,255,255,0.02); transition: all 0.15s; }
        .pillar:hover { transform: translateY(-2px); border-color: rgba(124,58,237,0.3); background: rgba(124,58,237,0.05); }
        .pillar-icon { font-size: 26px; line-height: 1; }
        .pillar-title { font-family: var(--font-barlow,'Barlow Condensed'),sans-serif; text-transform: uppercase; font-weight: 800; font-size: 18px; letter-spacing: 0.3px; margin-top: 10px; }
        .pillar-line { font-size: 12.5px; color: rgba(203,213,225,0.65); line-height: 1.5; margin-top: 5px; }
        .showcase-expand { width: 100%; margin-top: 20px; padding: 11px; cursor: pointer; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; color: #a78bfa; font-family: var(--font-barlow,'Barlow Condensed'),sans-serif; font-weight: 800; font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase; }
        .showcase-section { margin-top: 22px; }
        .showcase-section-head { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
        .showcase-section-icon { font-size: 17px; }
        .showcase-section-title { font-size: 14px; font-weight: 800; letter-spacing: -0.3px; }
        .showcase-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .showcase-item { padding: 11px 13px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.05); background: rgba(255,255,255,0.02); transition: all 0.12s; }
        .showcase-item:hover { background: rgba(124,58,237,0.06); border-color: rgba(124,58,237,0.15); }
        .showcase-item-label { font-size: 12px; font-weight: 700; color: rgba(243,244,246,0.9); margin-bottom: 3px; }
        .showcase-item-desc { font-size: 11px; color: rgba(148,163,184,0.55); line-height: 1.5; }
        .showcase-close { position: absolute; top: 16px; right: 20px; background: none; border: none; color: rgba(255,255,255,0.3); font-size: 20px; cursor: pointer; padding: 4px 8px; border-radius: 6px; transition: all 0.12s; }
        .showcase-close:hover { color: rgba(255,255,255,0.7); background: rgba(255,255,255,0.06); }
        .showcase-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 9px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin-left: 8px; }
        .showcase-powered { padding: 14px 32px; border-top: 1px solid rgba(255,255,255,0.04); font-size: 11px; color: rgba(148,163,184,0.3); text-align: center; flex-shrink: 0; }
        .showcase-powered em { color: rgba(167,139,250,0.5); font-style: normal; }
        @media (max-width: 640px) {
          .showcase-card { width: 95vw; max-height: 92vh; border-radius: 14px; }
          .showcase-header { padding: 20px 18px 0; }
          .showcase-body { padding: 16px 18px 24px; }
          .showcase-title { font-size: 22px; }
          .pillar-grid { grid-template-columns: 1fr; }
          .showcase-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div
        className="showcase-overlay"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClose();
          }
        }}
        tabIndex={0}
        role="button"
      >
        <div
          className="showcase-card"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.stopPropagation();
            }
          }}
          tabIndex={0}
          role="button"
          style={{ position: "relative" }}
        >
          <button className="showcase-close" onClick={onClose}>
            ✕
          </button>

          <div className="showcase-header">
            <div className="showcase-eyebrow">What is Weered?</div>
            <div className="showcase-title">
              More gamery than the
              <br />
              launchers you already use.
            </div>
            <div className="showcase-sub">
              Weered brings back the game lobby — a place that actually knows what you're playing
              and who's around. Here's the gist.
            </div>
            <div className="showcase-tabs">
              <button
                className={`showcase-tab ${tab === "features" ? "showcase-tab-active" : "showcase-tab-inactive"}`}
                onClick={() => setTab("features")}
              >
                The Gist
              </button>
              <button
                className={`showcase-tab ${tab === "wishlist" ? "showcase-tab-active" : "showcase-tab-inactive"}`}
                onClick={() => setTab("wishlist")}
              >
                What's Next
              </button>
            </div>
          </div>

          <div className="showcase-body">
            {tab === "features" ? (
              <>
                <div className="pillar-grid">
                  {PILLARS.map((p) => (
                    <div key={p.title} className="pillar">
                      <div className="pillar-icon">{p.icon}</div>
                      <div className="pillar-title" style={{ color: p.color }}>
                        {p.title}
                      </div>
                      <div className="pillar-line">{p.line}</div>
                    </div>
                  ))}
                </div>

                <button className="showcase-expand" onClick={() => setShowAll((s) => !s)}>
                  {showAll ? "Show less" : "Explore everything →"}
                </button>
                {showAll &&
                  SECTIONS.map((section) => (
                    <div key={section.title} className="showcase-section">
                      <div className="showcase-section-head">
                        <span className="showcase-section-icon">{section.icon}</span>
                        <span className="showcase-section-title" style={{ color: section.color }}>
                          {section.title}
                        </span>
                      </div>
                      <div className="showcase-grid">
                        {section.items.map((item) => (
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
                <div
                  style={{
                    fontSize: 13,
                    color: "rgba(148,163,184,0.6)",
                    marginBottom: 16,
                    lineHeight: 1.7,
                  }}
                >
                  Weered ships fast. If there's an API for it, we can integrate it. If there isn't,
                  we'll build it anyway.
                  <strong style={{ color: "rgba(255,255,255,0.6)" }}>
                    {" "}
                    Request a module and watch it ship.
                  </strong>
                </div>
                <div className="showcase-grid">
                  {WISHLIST.map((item) => {
                    const statusColor =
                      item.status === "Planned"
                        ? "#22c55e"
                        : item.status === "Exploring"
                          ? "#f59e0b"
                          : "#3b82f6";
                    return (
                      <div key={item.label} className="showcase-item">
                        <div className="showcase-item-label">
                          {item.label}
                          <span
                            className="showcase-badge"
                            style={{ background: `${statusColor}22`, color: statusColor }}
                          >
                            {item.status}
                          </span>
                        </div>
                        <div className="showcase-item-desc">{item.desc}</div>
                      </div>
                    );
                  })}
                </div>
                <div
                  style={{
                    marginTop: 22,
                    padding: "16px 18px",
                    borderRadius: 12,
                    border: "1px solid rgba(124,58,237,0.2)",
                    background: "rgba(124,58,237,0.05)",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "rgba(243,244,246,0.8)",
                      marginBottom: 4,
                    }}
                  >
                    Got an idea?
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(148,163,184,0.55)", lineHeight: 1.6 }}>
                    Post it in the Forum or tell The Operator. No feature-request forms. No 6-month
                    roadmaps. Just ship.
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="showcase-powered">
            Built fast, shipped live — custom modules built on demand
          </div>
        </div>
      </div>
    </>
  );
}
