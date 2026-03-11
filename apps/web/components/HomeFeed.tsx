"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface FeedItem {
  id: string;
  url: string;
  title: string;
  thumbnail?: string;
  domain: string;
  sourceName: string;
  category: "gaming" | "ufc" | "news" | "sports" | "tech" | "podcasts";
  heat: number;       // 0–100
  usersInRoom: number;
  postedAt: Date;
}

// ─── Mock data (replace with API call to /feed/hot) ───────────────────────────
const MOCK_ITEMS: FeedItem[] = [
  { id: "1", url: "https://ign.com/articles/gta-6-release-date", title: "GTA 6 Release Date Officially Confirmed — Everything We Know About Rockstar's Biggest Game Yet", thumbnail: "https://picsum.photos/seed/gta6/120/80", domain: "ign.com", sourceName: "IGN", category: "gaming", heat: 97, usersInRoom: 34, postedAt: new Date(Date.now() - 12 * 60000) },
  { id: "2", url: "https://espn.com/ufc/jones-vs-aspinall", title: "Jon Jones vs. Tom Aspinall: Full Fight Card, Odds, and Prediction Breakdown for UFC 309", thumbnail: "https://picsum.photos/seed/ufc309/120/80", domain: "espn.com", sourceName: "ESPN", category: "ufc", heat: 91, usersInRoom: 21, postedAt: new Date(Date.now() - 28 * 60000) },
  { id: "3", url: "https://techcrunch.com/openai-gpt5", title: "OpenAI Quietly Begins Rolling Out GPT-5 to Select Enterprise Customers Ahead of Public Launch", thumbnail: "https://picsum.photos/seed/gpt5/120/80", domain: "techcrunch.com", sourceName: "TechCrunch", category: "tech", heat: 88, usersInRoom: 18, postedAt: new Date(Date.now() - 45 * 60000) },
  { id: "4", url: "https://bbc.com/news/world", title: "Breaking: Major Ceasefire Agreement Reached After Months of Diplomatic Talks", thumbnail: "https://picsum.photos/seed/news1/120/80", domain: "bbc.com", sourceName: "BBC News", category: "news", heat: 85, usersInRoom: 12, postedAt: new Date(Date.now() - 55 * 60000) },
  { id: "5", url: "https://nba.com/game/celtics-lakers", title: "Celtics vs. Lakers Live: Final Score, Box Score and Full Game Recap — Triple Overtime Classic", thumbnail: "https://picsum.photos/seed/nba1/120/80", domain: "nba.com", sourceName: "NBA", category: "sports", heat: 82, usersInRoom: 29, postedAt: new Date(Date.now() - 70 * 60000) },
  { id: "6", url: "https://ign.com/ps5-pro-review", title: "PS5 Pro Review: Six Months Later — Is the Upgrade Worth It in 2026?", thumbnail: "https://picsum.photos/seed/ps5pro/120/80", domain: "ign.com", sourceName: "IGN", category: "gaming", heat: 78, usersInRoom: 9, postedAt: new Date(Date.now() - 95 * 60000) },
  { id: "7", url: "https://theverge.com/apple-vision-pro-2", title: "Apple Vision Pro 2 Hands-On: Lighter, Faster, and Finally Has Games Worth Playing", thumbnail: "https://picsum.photos/seed/avp2/120/80", domain: "theverge.com", sourceName: "The Verge", category: "tech", heat: 74, usersInRoom: 7, postedAt: new Date(Date.now() - 110 * 60000) },
  { id: "8", url: "https://mmamania.com/ufc-picks", title: "UFC Main Card Picks and Predictions: Who Wins When the Lights Come On Saturday Night", thumbnail: "https://picsum.photos/seed/ufc2/120/80", domain: "mmamania.com", sourceName: "MMA Mania", category: "ufc", heat: 69, usersInRoom: 5, postedAt: new Date(Date.now() - 130 * 60000) },
  { id: "9", url: "https://theguardian.com/tech-regulation", title: "EU Votes to Impose New AI Transparency Rules — What It Means for Every Tech Company Operating in Europe", thumbnail: "https://picsum.photos/seed/eu1/120/80", domain: "theguardian.com", sourceName: "The Guardian", category: "news", heat: 65, usersInRoom: 4, postedAt: new Date(Date.now() - 155 * 60000) },
  { id: "10", url: "https://spotify.com/podcast/lex-fridman", title: "Lex Fridman #451: Sam Altman on AGI, Power, and the Next Five Years of AI Development", thumbnail: "https://picsum.photos/seed/lex1/120/80", domain: "spotify.com", sourceName: "Spotify Podcasts", category: "podcasts", heat: 61, usersInRoom: 11, postedAt: new Date(Date.now() - 180 * 60000) },
  { id: "11", url: "https://nfl.com/chiefs-ravens", title: "Chiefs vs. Ravens AFC Championship: Mahomes Leads Fourth-Quarter Comeback in Instant Classic", thumbnail: "https://picsum.photos/seed/nfl1/120/80", domain: "nfl.com", sourceName: "NFL", category: "sports", heat: 58, usersInRoom: 6, postedAt: new Date(Date.now() - 200 * 60000) },
  { id: "12", url: "https://kotaku.com/nintendo-switch-2-launch", title: "Nintendo Switch 2 Launch Lineup Deep Dive: Every Game Confirmed, Every Date You Need to Know", thumbnail: "https://picsum.photos/seed/sw2/120/80", domain: "kotaku.com", sourceName: "Kotaku", category: "gaming", heat: 54, usersInRoom: 3, postedAt: new Date(Date.now() - 220 * 60000) },
  { id: "13", url: "https://wired.com/spacex-starship", title: "SpaceX Starship Successfully Completes Its First Full Orbital Flight — What Comes Next", thumbnail: "https://picsum.photos/seed/spacex1/120/80", domain: "wired.com", sourceName: "Wired", category: "tech", heat: 49, usersInRoom: 2, postedAt: new Date(Date.now() - 260 * 60000) },
  { id: "14", url: "https://joe.fm/jre-podcast", title: "JRE #2200: Elon Musk Returns — Mars, Twitter/X, and the Future of Everything", thumbnail: "https://picsum.photos/seed/jre1/120/80", domain: "joe.fm", sourceName: "JRE Podcast", category: "podcasts", heat: 44, usersInRoom: 8, postedAt: new Date(Date.now() - 300 * 60000) },
  { id: "15", url: "https://reuters.com/markets-crash", title: "Markets in Freefall: Dow Drops 800 Points as Fed Signals Surprise Rate Hike on Inflation Data", thumbnail: "https://picsum.photos/seed/market1/120/80", domain: "reuters.com", sourceName: "Reuters", category: "news", heat: 39, usersInRoom: 1, postedAt: new Date(Date.now() - 340 * 60000) },
];

const CATEGORIES = ["all", "gaming", "ufc", "news", "sports", "tech", "podcasts"] as const;
type Category = typeof CATEGORIES[number];

const CAT_LABELS: Record<Category, string> = {
  all: "All", gaming: "Gaming", ufc: "UFC", news: "News",
  sports: "Sports", tech: "Tech", podcasts: "Podcasts",
};

const CAT_COLORS: Record<string, string> = {
  gaming:  "#7C3AED",
  ufc:     "#DC2626",
  news:    "#0EA5E9",
  sports:  "#16A34A",
  tech:    "#D97706",
  podcasts:"#DB2777",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(date: Date): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function roomIdFromUrl(url: string): string {
  // Deterministic room ID from URL — matches what the backend will generate
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = ((hash << 5) - hash) + url.charCodeAt(i);
    hash |= 0;
  }
  return `article_${Math.abs(hash).toString(36).slice(0, 10)}`;
}

function lobbyIdFromDomain(domain: string): string {
  return domain.replace(/^www\./, "");
}

// ─── Heat Bar ─────────────────────────────────────────────────────────────────
function HeatBar({ heat, color }: { heat: number; color: string }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(heat), 80);
    return () => clearTimeout(t);
  }, [heat]);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 80 }}>
      <div style={{
        flex: 1, height: 4, borderRadius: 2,
        background: "rgba(255,255,255,0.07)",
        overflow: "hidden",
      }}>
        <div style={{
          height: "100%",
          width: `${width}%`,
          borderRadius: 2,
          background: `linear-gradient(90deg, ${color}99, ${color})`,
          boxShadow: heat > 80 ? `0 0 6px ${color}88` : "none",
          transition: "width 0.7s cubic-bezier(0.22, 1, 0.36, 1)",
        }} />
      </div>
      <span style={{ fontSize: 10, color: "rgba(148,163,184,0.55)", width: 22, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
        {heat}
      </span>
    </div>
  );
}

// ─── Feed Row ─────────────────────────────────────────────────────────────────
function FeedRow({ item, index, onEnter }: { item: FeedItem; index: number; onEnter: (item: FeedItem) => void }) {
  const [hovered, setHovered] = useState(false);
  const color = CAT_COLORS[item.category] || "#7C3AED";
  const isHot = item.heat >= 80;

  return (
    <div
      onClick={() => onEnter(item)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "grid",
        gridTemplateColumns: "28px 88px 1fr 80px 90px 70px",
        alignItems: "center",
        gap: 10,
        padding: "8px 12px",
        cursor: "pointer",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        background: hovered ? "rgba(255,255,255,0.035)" : "transparent",
        transition: "background 0.12s",
        animation: `feedRowIn 0.3s ${index * 0.03}s both`,
      }}
    >
      {/* Rank */}
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        color: isHot ? color : "rgba(100,116,139,0.4)",
        textAlign: "right",
        fontVariantNumeric: "tabular-nums",
      }}>
        {index + 1}
      </div>

      {/* Thumbnail */}
      <div style={{
        width: 88, height: 56, borderRadius: 8, overflow: "hidden", flexShrink: 0,
        background: "rgba(255,255,255,0.05)",
        border: `1px solid ${hovered ? color + "44" : "rgba(255,255,255,0.07)"}`,
        transition: "border-color 0.15s",
        position: "relative",
      }}>
        {item.thumbnail && (
          <img src={item.thumbnail} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        )}
        {/* Category pip */}
        <div style={{
          position: "absolute", top: 4, left: 4,
          padding: "2px 5px", borderRadius: 3,
          background: color + "dd",
          fontSize: 9, fontWeight: 700, color: "white",
          letterSpacing: "0.06em", textTransform: "uppercase",
        }}>
          {item.category}
        </div>
      </div>

      {/* Title + source */}
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 13,
          fontWeight: 600,
          color: hovered ? "rgba(243,244,246,1)" : "rgba(226,232,240,0.90)",
          lineHeight: 1.35,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          transition: "color 0.12s",
          marginBottom: 4,
        }}>
          {isHot && <span style={{ marginRight: 5, fontSize: 12 }}>🔥</span>}
          {item.title}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            fontSize: 10, color: "rgba(148,163,184,0.5)",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.07)",
            padding: "1px 6px", borderRadius: 4,
            fontWeight: 600,
          }}>
            {item.domain}
          </span>
          <span style={{ fontSize: 10, color: "rgba(100,116,139,0.45)" }}>
            {item.sourceName}
          </span>
        </div>
      </div>

      {/* Heat bar */}
      <HeatBar heat={item.heat} color={color} />

      {/* Users in room */}
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <div style={{
          width: 6, height: 6, borderRadius: "50%",
          background: item.usersInRoom > 0 ? "#22C55E" : "rgba(100,116,139,0.3)",
          boxShadow: item.usersInRoom > 0 ? "0 0 6px #22C55E88" : "none",
          flexShrink: 0,
        }} />
        <span style={{ fontSize: 11, color: "rgba(148,163,184,0.6)", fontVariantNumeric: "tabular-nums" }}>
          {item.usersInRoom > 0 ? `${item.usersInRoom} in room` : "empty"}
        </span>
      </div>

      {/* Time */}
      <div style={{ fontSize: 10, color: "rgba(100,116,139,0.4)", textAlign: "right" }}>
        {timeAgo(item.postedAt)}
      </div>
    </div>
  );
}

// ─── Column Header ─────────────────────────────────────────────────────────────
function ColHeader({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <div style={{
      fontSize: 9, fontWeight: 700, letterSpacing: "0.10em",
      textTransform: "uppercase", color: "rgba(100,116,139,0.45)",
      textAlign: align,
    }}>
      {children}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function HomeFeed() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<Category>("all");
  const [sort, setSort] = useState<"hot" | "new">("hot");

  const filtered = MOCK_ITEMS
    .filter(i => activeCategory === "all" || i.category === activeCategory)
    .sort((a, b) => sort === "hot" ? b.heat - a.heat : b.postedAt.getTime() - a.postedAt.getTime());

  function handleEnter(item: FeedItem) {
    const roomId  = roomIdFromUrl(item.url);
    const lobbyId = lobbyIdFromDomain(item.domain);
    // Navigate to the domain lobby, carrying the article room to auto-open
    router.push(`/lobby/${encodeURIComponent(lobbyId)}?room=${roomId}&article=${encodeURIComponent(item.url)}`);
  }

  return (
    <>
      <style>{`
        @keyframes feedRowIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>

        {/* Toolbar */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
          gap: 10,
        }}>
          {/* Category tabs */}
          <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            {CATEGORIES.map(cat => {
              const active = activeCategory === cat;
              const color  = CAT_COLORS[cat] || "#7C3AED";
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 6,
                    border: active ? `1px solid ${color}66` : "1px solid transparent",
                    background: active ? color + "22" : "transparent",
                    color: active ? color : "rgba(148,163,184,0.5)",
                    fontSize: 11, fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 0.12s",
                    letterSpacing: "0.04em",
                  }}
                >
                  {CAT_LABELS[cat]}
                </button>
              );
            })}
          </div>

          {/* Sort toggle */}
          <div style={{ display: "flex", gap: 1, background: "rgba(255,255,255,0.04)", borderRadius: 7, padding: 2, flexShrink: 0 }}>
            {(["hot", "new"] as const).map(s => (
              <button
                key={s}
                onClick={() => setSort(s)}
                style={{
                  padding: "3px 10px",
                  borderRadius: 5,
                  border: "none",
                  background: sort === s ? "rgba(255,255,255,0.08)" : "transparent",
                  color: sort === s ? "rgba(226,232,240,0.9)" : "rgba(100,116,139,0.5)",
                  fontSize: 11, fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.12s",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                {s === "hot" ? "🔥 Hot" : "✦ New"}
              </button>
            ))}
          </div>
        </div>

        {/* Column headers */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "28px 88px 1fr 80px 90px 70px",
          gap: 10,
          padding: "5px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
          flexShrink: 0,
        }}>
          <ColHeader>#</ColHeader>
          <div />
          <ColHeader>Story</ColHeader>
          <ColHeader>Heat</ColHeader>
          <ColHeader>Room</ColHeader>
          <ColHeader align="right">Posted</ColHeader>
        </div>

        {/* Rows */}
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          {filtered.map((item, i) => (
            <FeedRow key={item.id} item={item} index={i} onEnter={handleEnter} />
          ))}

          {filtered.length === 0 && (
            <div style={{ padding: "40px 20px", textAlign: "center", color: "rgba(100,116,139,0.4)", fontSize: 13 }}>
              No content in this category yet.
            </div>
          )}

          {/* Footer hint */}
          <div style={{ padding: "16px 12px", fontSize: 10, color: "rgba(100,116,139,0.3)", textAlign: "center", letterSpacing: "0.06em" }}>
            CLICK ANY STORY TO ENTER ITS ROOM
          </div>
        </div>
      </div>
    </>
  );
}
