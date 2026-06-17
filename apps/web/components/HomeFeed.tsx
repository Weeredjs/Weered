"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import StoryInterceptModal from "./StoryInterceptModal";
import EmptyState from "./EmptyState";
import LoadingState from "./LoadingState";

export interface FeedItem {
  id: string;
  url: string;
  title: string;
  thumbnail?: string;
  domain: string;
  sourceName: string;
  category: "gaming" | "ufc" | "news" | "sports" | "tech" | "podcasts";
  heat: number;
  usersInRoom: number;
  postedAt: Date;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";

function useLiveFeed(category: Category, sort: "hot" | "new", domain?: string) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  async function load() {
    try {
      const params = new URLSearchParams({ category, sort });
      if (domain) params.set("domain", domain);
      const res = await fetch(`${API_BASE}/feed/hot?${params}`);
      const data = await res.json();
      const mapped = (data.items || []).map((i: any) => ({
        ...i,
        postedAt: new Date(i.postedAt),
        fetchedAt: new Date(i.fetchedAt),
      }));
      setItems(mapped);
      setUpdatedAt(new Date(data.updatedAt));
    } catch (e) {
      console.warn("[HomeFeed] fetch failed", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    load();
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, [category, sort]);

  return { items, loading, updatedAt };
}

const CATEGORIES = ["all", "gaming", "ufc", "news", "sports", "tech", "podcasts"] as const;
type Category = (typeof CATEGORIES)[number];

const CAT_LABELS: Record<Category, string> = {
  all: "All",
  gaming: "Gaming",
  ufc: "UFC",
  news: "News",
  sports: "Sports",
  tech: "Tech",
  podcasts: "Podcasts",
};

const CAT_COLORS: Record<string, string> = {
  gaming: "#7C3AED",
  ufc: "#DC2626",
  news: "#0EA5E9",
  sports: "#16A34A",
  tech: "#D97706",
  podcasts: "#DB2777",
};

const VERIFIED_DOMAINS = new Set([
  "ign.com",
  "espn.com",
  "techcrunch.com",
  "bbc.com",
  "nba.com",
  "nfl.com",
  "kotaku.com",
  "theverge.com",
  "wired.com",
  "reuters.com",
  "theguardian.com",
  "spotify.com",
]);

function timeAgo(date: Date): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function roomIdFromUrl(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = (hash << 5) - hash + url.charCodeAt(i);
    hash |= 0;
  }
  return `article_${Math.abs(hash).toString(36).slice(0, 10)}`;
}

function lobbyIdFromDomain(domain: string): string {
  return domain.replace(/^www\./, "");
}

function HeatBar({ heat, color }: { heat: number; color: string }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(heat), 80);
    return () => clearTimeout(t);
  }, [heat]);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 80 }}>
      <div
        style={{
          flex: 1,
          height: 4,
          borderRadius: 2,
          background: "rgba(255,255,255,0.07)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${width}%`,
            borderRadius: 2,
            background: `linear-gradient(90deg, ${color}99, ${color})`,
            boxShadow: heat > 80 ? `0 0 6px ${color}88` : "none",
            transition: "width 0.7s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        />
      </div>
      <span
        style={{
          fontSize: 10,
          color: "rgba(148,163,184,0.55)",
          width: 22,
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {heat}
      </span>
    </div>
  );
}

function FeedRow({
  item,
  index,
  onEnter,
}: {
  item: FeedItem;
  index: number;
  onEnter: (item: FeedItem, rect: DOMRect) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const color = CAT_COLORS[item.category] || "#7C3AED";
  const isHot = item.heat >= 80;

  return (
    <div
      onClick={(e) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        onEnter(item, rect);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          onEnter(item, rect);
        }
      }}
      tabIndex={0}
      role="button"
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
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: isHot ? color : "rgba(100,116,139,0.4)",
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {index + 1}
      </div>

      <div
        style={{
          width: 88,
          height: 56,
          borderRadius: 8,
          overflow: "hidden",
          flexShrink: 0,
          background: "rgba(255,255,255,0.05)",
          border: `1px solid ${hovered ? color + "44" : "rgba(255,255,255,0.07)"}`,
          transition: "border-color 0.15s",
          position: "relative",
        }}
      >
        {item.thumbnail && (
          <Image
            src={item.thumbnail}
            alt={item.title + " thumbnail"}
            fill
            sizes="88px"
            loading="lazy"
            style={{ objectFit: "cover", display: "block" }}
            unoptimized={item.thumbnail.startsWith("/")}
          />
        )}
        <div
          style={{
            position: "absolute",
            top: 4,
            left: 4,
            padding: "2px 5px",
            borderRadius: 3,
            background: color + "dd",
            fontSize: 9,
            fontWeight: 700,
            color: "white",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          {item.category}
        </div>
      </div>

      <div style={{ minWidth: 0 }}>
        <div
          style={{
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
          }}
        >
          {isHot && <span style={{ marginRight: 5, fontSize: 12 }}>🔥</span>}
          {item.title}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              fontSize: 10,
              color: "rgba(148,163,184,0.5)",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.07)",
              padding: "1px 6px",
              borderRadius: 4,
              fontWeight: 600,
            }}
          >
            {item.domain}
          </span>
          {VERIFIED_DOMAINS.has(item.domain) && (
            <span
              title="Verified Lobby"
              style={{
                fontSize: 9,
                fontWeight: 800,
                color: "#22C55E",
                background: "rgba(34,197,94,0.10)",
                border: "1px solid rgba(34,197,94,0.20)",
                padding: "1px 5px",
                borderRadius: 4,
                letterSpacing: "0.06em",
              }}
            >
              ✓ VERIFIED
            </span>
          )}
          <span style={{ fontSize: 10, color: "rgba(100,116,139,0.45)" }}>{item.sourceName}</span>
        </div>
      </div>

      <HeatBar heat={item.heat} color={color} />

      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: item.usersInRoom > 0 ? "#22C55E" : "rgba(100,116,139,0.3)",
            boxShadow: item.usersInRoom > 0 ? "0 0 6px #22C55E88" : "none",
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 11,
            color: "rgba(148,163,184,0.6)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {item.usersInRoom > 0 ? `${item.usersInRoom} in room` : "empty"}
        </span>
      </div>

      <div style={{ fontSize: 10, color: "rgba(100,116,139,0.4)", textAlign: "right" }}>
        {timeAgo(item.postedAt)}
      </div>
    </div>
  );
}

function ColHeader({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <div
      style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.10em",
        textTransform: "uppercase",
        color: "rgba(100,116,139,0.45)",
        textAlign: align,
      }}
    >
      {children}
    </div>
  );
}

export default function HomeFeed({
  domain,
  defaultCategory,
}: { domain?: string; defaultCategory?: string } = {}) {
  const router = useRouter();
  const initialCat =
    defaultCategory && CATEGORIES.includes(defaultCategory as Category)
      ? (defaultCategory as Category)
      : "all";
  const [activeCategory, setActiveCategory] = useState<Category>(initialCat);
  const [sort, setSort] = useState<"hot" | "new">("hot");

  const { items, loading, updatedAt } = useLiveFeed(activeCategory, sort, domain);
  const filtered = items;
  const [interceptItem, setInterceptItem] = useState<FeedItem | null>(null);
  const [interceptRect, setInterceptRect] = useState<DOMRect | null>(null);

  function handleEnter(item: FeedItem, rect: DOMRect) {
    setInterceptRect(rect);
    setInterceptItem(item);
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 12px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            flexShrink: 0,
            gap: 10,
          }}
        >
          <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            {CATEGORIES.map((cat) => {
              const active = activeCategory === cat;
              const color = CAT_COLORS[cat] || "#7C3AED";
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
                    fontSize: 11,
                    fontWeight: 700,
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

          <div
            style={{
              display: "flex",
              gap: 1,
              background: "rgba(255,255,255,0.04)",
              borderRadius: 7,
              padding: 2,
              flexShrink: 0,
            }}
          >
            {(["hot", "new"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                style={{
                  padding: "3px 10px",
                  borderRadius: 5,
                  border: "none",
                  background: sort === s ? "rgba(255,255,255,0.08)" : "transparent",
                  color: sort === s ? "rgba(226,232,240,0.9)" : "rgba(100,116,139,0.5)",
                  fontSize: 11,
                  fontWeight: 700,
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

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "28px 88px 1fr 80px 90px 70px",
            gap: 10,
            padding: "5px 12px",
            borderBottom: "1px solid rgba(255,255,255,0.04)",
            flexShrink: 0,
          }}
        >
          <ColHeader>#</ColHeader>
          <div />
          <ColHeader>Story</ColHeader>
          <ColHeader>Heat</ColHeader>
          <ColHeader>Room</ColHeader>
          <ColHeader align="right">Posted</ColHeader>
        </div>

        <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          {loading && items.length === 0 && <LoadingState label="Pulling the feed" />}
          {filtered.map((item, i) => (
            <FeedRow key={item.id} item={item} index={i} onEnter={handleEnter} />
          ))}

          {!loading && filtered.length === 0 && (
            <EmptyState
              title="Nothing's hot right now."
              hint="The feed updates every minute. Check back soon."
            />
          )}

          <div
            style={{
              padding: "16px 12px",
              fontSize: 10,
              color: "rgba(100,116,139,0.3)",
              textAlign: "center",
              letterSpacing: "0.06em",
              display: "flex",
              justifyContent: "center",
              gap: 16,
            }}
          >
            <span>CLICK ANY STORY TO ENTER ITS ROOM</span>
            {updatedAt && (
              <span style={{ color: "rgba(100,116,139,0.2)" }}>UPDATED {timeAgo(updatedAt)}</span>
            )}
          </div>
        </div>
      </div>

      <StoryInterceptModal
        item={interceptItem}
        originRect={interceptRect}
        onClose={() => {
          setInterceptItem(null);
          setInterceptRect(null);
        }}
      />
    </>
  );
}
