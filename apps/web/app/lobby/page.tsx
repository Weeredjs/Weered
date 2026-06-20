"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import LobbyHeaderBar from "../../components/LobbyHeaderBar";
import LobbyChatDrawer from "../../components/LobbyChatDrawer";
import { onActivate } from "@/lib/a11y";

const API = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";
function authHeaders(): Record<string, string> {
  try {
    const t = localStorage.getItem("weered_token") || "";
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

type LobbyCard = {
  id: string;
  name: string;
  description: string;
  verified: boolean;
  pinned: boolean;
  accentColor?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  onlineCount: number;
  role?: string;
  roleLevel?: number;
  _count: { rooms: number; members: number };
};
type UpcomingEvent = {
  id: string;
  title: string;
  description: string;
  category: string;
  startsAt: string;
  endsAt?: string | null;
  lobby?: { id: string; name: string; logoUrl?: string | null } | null;
};

const ANNOUNCEMENTS = [
  {
    id: "1",
    title: "Tournaments Are Live",
    body: "Create leaderboard tournaments in your lobby. Challenge your members and award badges to top performers.",
    icon: "🏆",
    color: "#F59E0B",
  },
  {
    id: "2",
    title: "Paid Tiers & Monetization",
    body: "Lobby owners can now create subscription tiers with Stripe. Set up paid roles with custom perks and revenue sharing.",
    icon: "💎",
    color: "#7C3AED",
  },
  {
    id: "3",
    title: "Video Chat & Screen Share",
    body: "Full LiveKit-powered video rooms with camera grids, screen sharing, and presenter view. Built into every lobby.",
    icon: "📹",
    color: "#0EA5E9",
  },
];

const PLATFORM_TIERS = [
  {
    name: "Innocent",
    price: "Free",
    color: "#64748B",
    features: ["Join any lobby", "Chat & forums", "Basic profile", "Browse rooms"],
  },
  {
    name: "Indicted",
    price: "$6/mo",
    color: "#7C3AED",
    features: [
      "Colored username",
      "Video streaming",
      "Custom fonts",
      "Create 1 lobby",
      "Challenge participation",
    ],
  },
  {
    name: "Felon",
    price: "$14/mo",
    color: "#DC2626",
    features: [
      "Everything in Indicted",
      "Own up to 3 lobbies",
      "Paid tier creation",
      "Revenue sharing",
      "Priority support",
    ],
  },
];

const TOOLKIT_SECTIONS = [
  {
    title: "Rooms & Modules",
    icon: "🧩",
    color: "#7C3AED",
    desc: "Create rooms with pluggable modules: voice chat, video, YouTube sync, Twitch embeds, article readers, Reddit feeds, and custom iframes. Each room is its own configurable space.",
    features: [
      "Voice & video rooms (LiveKit)",
      "YouTube / Twitch sync viewing",
      "Article reader module",
      "Reddit feed integration",
      "Custom iframe embeds",
      "Room lock & password protection",
    ],
  },
  {
    title: "Moderation & Roles",
    icon: "🛡️",
    color: "#0EA5E9",
    desc: "Five-level role hierarchy with custom titles. Granular permissions for chat, rooms, and admin tools. Ban management, audit logging, and chat lock controls.",
    features: [
      "5-level role system with custom names",
      "Per-room lock & chat lock",
      "Kick / ban with reasons",
      "Full audit log of all actions",
      "Role-based admin panel access",
    ],
  },
  {
    title: "Challenges & Tournaments",
    icon: "🎯",
    color: "#F59E0B",
    desc: "Build custom challenges with 8 objective types: kills, wins, K/D targets, speed clears, weapon-specific goals, and more. Run tournaments with live leaderboards and auto-award badges.",
    features: [
      "8 objective types (kills, wins, K/D, speed, weapon kills...)",
      "Recurring daily/weekly challenges",
      "Tournament leaderboards",
      "Badge system with rarity tiers",
      "Real-time WebSocket progress",
      "PGCR weapon kill tracking",
    ],
  },
  {
    title: "Events & Promotion",
    icon: "📅",
    color: "#16A34A",
    desc: "Schedule events with categories, cover images, and timezone support. Request staff promotion to surface your event platform-wide.",
    features: [
      "Event creation & scheduling",
      "Category tagging",
      "Global promotion pipeline",
      "Cover images & descriptions",
    ],
  },
  {
    title: "Branding & Customization",
    icon: "🎨",
    color: "#DB2777",
    desc: "Full lobby theming: accent colors, logos, banners, custom descriptions, and search keywords. Your lobby, your brand.",
    features: [
      "Accent color theming",
      "Logo & banner upload",
      "Custom description & keywords",
      "Website URL embedding",
    ],
  },
  {
    title: "Monetization",
    icon: "💰",
    color: "#10B981",
    desc: "Create paid subscription tiers for your lobby via Stripe. Subscribers auto-receive role upgrades. Configure revenue sharing for payouts.",
    features: [
      "Custom paid tiers (Stripe)",
      "Auto role-grant on subscribe",
      "Billing portal for members",
      "Revenue share configuration",
      "Tier badge colors",
    ],
  },
];

function timeUntil(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff < 0) return "now";
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 1) return `${Math.floor(diff / 60000)}m`;
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function SectionHeader({ title, icon }: { title: string; icon: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span
        style={{
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "rgba(148,163,184,0.7)",
        }}
      >
        {title}
      </span>
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
    </div>
  );
}

function AnnouncementCard({ a }: { a: (typeof ANNOUNCEMENTS)[0] }) {
  return (
    <div
      style={{
        flex: "1 1 220px",
        maxWidth: 340,
        padding: "14px 16px",
        borderRadius: 12,
        border: `1px solid ${a.color}22`,
        background: `${a.color}08`,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 20 }}>{a.icon}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(243,244,246,0.9)" }}>
          {a.title}
        </span>
      </div>
      <p style={{ fontSize: 11, lineHeight: 1.5, color: "rgba(148,163,184,0.7)", margin: 0 }}>
        {a.body}
      </p>
    </div>
  );
}

function EventCard({ ev }: { ev: UpcomingEvent }) {
  const ac = "#7C3AED";
  return (
    <div
      style={{
        padding: "10px 14px",
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(255,255,255,0.02)",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 8,
          background: `${ac}18`,
          border: `1px solid ${ac}33`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 16,
          flexShrink: 0,
        }}
      >
        📅
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{ fontSize: 12, fontWeight: 700, color: "rgba(243,244,246,0.9)", lineHeight: 1.3 }}
        >
          {ev.title}
        </div>
        {ev.lobby && (
          <div style={{ fontSize: 10, color: "rgba(148,163,184,0.5)", marginTop: 2 }}>
            {ev.lobby.name}
          </div>
        )}
      </div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: ac,
          background: `${ac}18`,
          padding: "3px 8px",
          borderRadius: 6,
          letterSpacing: "0.04em",
          flexShrink: 0,
        }}
      >
        in {timeUntil(ev.startsAt)}
      </div>
    </div>
  );
}

function LobbyCardComp({ lobby, showRole }: { lobby: LobbyCard; showRole?: boolean }) {
  const [hovered, setHovered] = useState(false);
  const ac = lobby.accentColor || "#7C3AED";
  const hasOnline = lobby.onlineCount > 0;

  return (
    <Link
      href={`/lobby/${encodeURIComponent(lobby.id)}`}
      style={{ textDecoration: "none", color: "inherit" }}
    >
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          padding: "14px 16px",
          borderRadius: 12,
          border: `1px solid ${hovered ? ac + "44" : "rgba(255,255,255,0.06)"}`,
          background: hovered ? `${ac}0a` : "rgba(255,255,255,0.02)",
          transition: "all 0.15s",
          cursor: "pointer",
          display: "flex",
          gap: 12,
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            flexShrink: 0,
            background: lobby.logoUrl ? "none" : `${ac}22`,
            border: `1px solid ${ac}33`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {lobby.logoUrl ? (
            <img
              src={lobby.logoUrl}
              alt={`${lobby.name} logo`}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <span style={{ fontSize: 18, fontWeight: 800, color: ac }}>
              {(lobby.name || "?")[0].toUpperCase()}
            </span>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(243,244,246,0.95)" }}>
              {lobby.name}
            </span>
            {lobby.verified && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  color: "#22C55E",
                  background: "rgba(34,197,94,0.12)",
                  border: "1px solid rgba(34,197,94,0.25)",
                  padding: "1px 5px",
                  borderRadius: 4,
                }}
              >
                VERIFIED
              </span>
            )}
            {showRole && lobby.roleLevel && lobby.roleLevel >= 4 && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: ac,
                  background: `${ac}18`,
                  padding: "1px 5px",
                  borderRadius: 4,
                }}
              >
                OWNER
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "rgba(148,163,184,0.5)",
              marginTop: 2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {lobby.description || "No description"}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 4,
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: hasOnline ? "#22C55E" : "rgba(100,116,139,0.3)",
                boxShadow: hasOnline ? "0 0 6px #22C55E88" : "none",
              }}
            />
            <span
              style={{
                fontSize: 11,
                color: hasOnline ? "rgba(34,197,94,0.8)" : "rgba(100,116,139,0.4)",
                fontWeight: 600,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {lobby.onlineCount} online
            </span>
          </div>
          <span style={{ fontSize: 10, color: "rgba(100,116,139,0.35)" }}>
            {lobby._count.members} members · {lobby._count.rooms} rooms
          </span>
        </div>
      </div>
    </Link>
  );
}

function ToolkitCard({ section }: { section: (typeof TOOLKIT_SECTIONS)[0] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        borderRadius: 12,
        border: `1px solid ${section.color}22`,
        background: `${section.color}06`,
        overflow: "hidden",
        transition: "all 0.2s",
      }}
    >
      <div
        onClick={() => setExpanded(!expanded)}
        onKeyDown={onActivate(() => setExpanded(!expanded))}
        role="button"
        tabIndex={0}
        style={{
          padding: "14px 16px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <span
          style={{
            fontSize: 22,
            width: 40,
            height: 40,
            borderRadius: 10,
            background: `${section.color}15`,
            border: `1px solid ${section.color}25`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {section.icon}
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(243,244,246,0.95)" }}>
            {section.title}
          </div>
          <div
            style={{ fontSize: 11, color: "rgba(148,163,184,0.55)", marginTop: 2, lineHeight: 1.4 }}
          >
            {section.desc}
          </div>
        </div>
        <span
          style={{
            fontSize: 12,
            color: "rgba(148,163,184,0.4)",
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
            flexShrink: 0,
          }}
        >
          ▼
        </span>
      </div>

      {expanded && (
        <div
          style={{
            padding: "0 16px 14px 68px",
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
          }}
        >
          {section.features.map((f, i) => (
            <div
              key={i}
              style={{
                fontSize: 11,
                padding: "4px 10px",
                borderRadius: 6,
                background: `${section.color}12`,
                border: `1px solid ${section.color}20`,
                color: "rgba(226,232,240,0.8)",
                fontWeight: 500,
              }}
            >
              {f}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TierColumn({ tier }: { tier: (typeof PLATFORM_TIERS)[0] }) {
  const isFree = tier.price === "Free";
  return (
    <div
      style={{
        flex: "1 1 180px",
        maxWidth: 260,
        padding: "18px 16px",
        borderRadius: 12,
        border: `1px solid ${tier.color}33`,
        background: `${tier.color}08`,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div>
        <div style={{ fontSize: 16, fontWeight: 800, color: tier.color }}>{tier.name}</div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: "rgba(243,244,246,0.95)",
            marginTop: 4,
          }}
        >
          {tier.price}
        </div>
      </div>
      <div style={{ width: "100%", height: 1, background: `${tier.color}22` }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {tier.features.map((f, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 7,
              fontSize: 11,
              color: "rgba(226,232,240,0.75)",
              lineHeight: 1.4,
            }}
          >
            <span style={{ color: tier.color, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>
              ✓
            </span>
            {f}
          </div>
        ))}
      </div>
      {!isFree && (
        <Link href="/settings" style={{ textDecoration: "none" }}>
          <button
            style={{
              marginTop: 6,
              width: "100%",
              padding: "8px 0",
              borderRadius: 8,
              border: `1px solid ${tier.color}55`,
              background: `${tier.color}22`,
              color: "rgba(243,244,246,0.95)",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              transition: "background 0.15s",
            }}
          >
            Subscribe
          </button>
        </Link>
      )}
    </div>
  );
}

export default function LobbyPage() {
  const [allLobbies, setAllLobbies] = useState<LobbyCard[]>([]);
  const [myLobbies, setMyLobbies] = useState<LobbyCard[]>([]);
  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/lobbies`)
        .then((r) => r.json())
        .catch(() => ({ ok: false })),
      fetch(`${API}/me/lobbies`, { headers: authHeaders() })
        .then((r) => r.json())
        .catch(() => ({ ok: false })),
      fetch(`${API}/events/upcoming?limit=5`)
        .then((r) => r.json())
        .catch(() => ({ ok: false })),
    ]).then(([lobbyRes, myRes, eventRes]) => {
      if (lobbyRes.ok) setAllLobbies(lobbyRes.lobbies || []);
      if (myRes.ok) setMyLobbies(myRes.lobbies || []);
      if (eventRes.ok) setEvents(eventRes.events || []);
      setLoading(false);
    });
  }, []);

  const loggedIn = myLobbies.length > 0;

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh", minHeight: 0 }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 28,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          minHeight: 0,
        }}
      >
        <LobbyHeaderBar />

        <div
          style={{
            flex: 1,
            minHeight: 0,
            position: "relative",
            border: "1px solid var(--weered-border)",
            borderRadius: 16,
            background: "var(--weered-panel2)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "20px 24px 40px" }}>
            <style>{`
            @keyframes lobbyFadeIn {
              from { opacity: 0; transform: translateY(8px); }
              to   { opacity: 1; transform: translateY(0); }
            }
            .lobby-section {
              animation: lobbyFadeIn 0.35s ease-out both;
              margin-bottom: 32px;
            }
            .lobby-section:nth-child(2) { animation-delay: 0.06s; }
            .lobby-section:nth-child(3) { animation-delay: 0.12s; }
            .lobby-section:nth-child(4) { animation-delay: 0.18s; }
            .lobby-section:nth-child(5) { animation-delay: 0.24s; }
            @media (max-width: 767px) {
              .lobby-page-content { padding: 14px 12px 40px !important; }
              .tier-row { flex-direction: column !important; }
              .tier-row > div { max-width: 100% !important; }
            }
          `}</style>

            {loading ? (
              <div
                style={{
                  padding: "60px 0",
                  textAlign: "center",
                  color: "rgba(100,116,139,0.4)",
                  fontSize: 12,
                  letterSpacing: "0.08em",
                }}
              >
                LOADING...
              </div>
            ) : (
              <>
                <div className="lobby-section">
                  <SectionHeader title="What's Happening" icon="📢" />
                  <div
                    style={{
                      display: "flex",
                      gap: 12,
                      flexWrap: "wrap",
                      marginBottom: events.length > 0 ? 16 : 0,
                    }}
                  >
                    {ANNOUNCEMENTS.map((a) => (
                      <AnnouncementCard key={a.id} a={a} />
                    ))}
                  </div>

                  {events.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: "rgba(148,163,184,0.45)",
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          marginBottom: 8,
                        }}
                      >
                        UPCOMING EVENTS
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {events.map((ev) => (
                          <EventCard key={ev.id} ev={ev} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {loggedIn && (
                  <div className="lobby-section">
                    <SectionHeader title="Your Lobbies" icon="⭐" />
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {myLobbies.map((l) => (
                        <LobbyCardComp key={l.id} lobby={l} showRole />
                      ))}
                    </div>
                  </div>
                )}

                <div className="lobby-section">
                  <SectionHeader
                    title={loggedIn ? "Discover Lobbies" : "Active Lobbies"}
                    icon="🌐"
                  />
                  {allLobbies.length === 0 ? (
                    <div
                      style={{
                        padding: "20px 0",
                        textAlign: "center",
                        color: "rgba(100,116,139,0.4)",
                        fontSize: 12,
                      }}
                    >
                      No lobbies yet. Be the first to create one.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {allLobbies
                        .sort(
                          (a, b) =>
                            b.onlineCount - a.onlineCount || b._count.members - a._count.members,
                        )
                        .map((l) => (
                          <LobbyCardComp key={l.id} lobby={l} />
                        ))}
                    </div>
                  )}
                </div>

                <div className="lobby-section">
                  <SectionHeader title="Build Your Lobby" icon="🔧" />

                  <div style={{ marginBottom: 20 }}>
                    <p
                      style={{
                        fontSize: 13,
                        color: "rgba(226,232,240,0.75)",
                        lineHeight: 1.6,
                        margin: "0 0 6px",
                      }}
                    >
                      Every lobby comes with a full suite of admin tools: rooms, moderation, events,
                      monetization, and game integrations. Here's what each tier unlocks and how to
                      use it all.
                    </p>
                  </div>

                  <div style={{ marginBottom: 24 }}>
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: "rgba(148,163,184,0.45)",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        marginBottom: 12,
                      }}
                    >
                      PLATFORM TIERS
                    </div>
                    <div
                      className="tier-row"
                      style={{ display: "flex", gap: 12, flexWrap: "wrap" }}
                    >
                      {PLATFORM_TIERS.map((t) => (
                        <TierColumn key={t.name} tier={t} />
                      ))}
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: "rgba(148,163,184,0.45)",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        marginBottom: 12,
                      }}
                    >
                      THE OWNER TOOLKIT
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {TOOLKIT_SECTIONS.map((s) => (
                        <ToolkitCard key={s.title} section={s} />
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <LobbyChatDrawer roomId="room:lobby" title="Lobby Chat" />
        </div>
      </div>
    </div>
  );
}
