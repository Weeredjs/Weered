"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import StoryInterceptModal from "./StoryInterceptModal";
import type { FeedItem } from "./HomeFeed";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
const GAMING_ACCENT = "#7C3AED";

type Pin = {
  id: string;
  label: string;
  value: string;
  sub?: string;
  href?: string;
  accent: string;
  logo?: string;
};
type NewsItem = {
  id: string;
  title: string;
  url: string;
  source?: string;
  imageUrl?: string | null;
  heat?: number;
  publishedAt?: string;
};

function daysUntil(iso: string): number {
  const t = new Date(iso + "T00:00:00Z").getTime();
  return Math.ceil((t - Date.now()) / 86400000);
}

const GTA6_LOGO =
  "https://upload.wikimedia.org/wikipedia/fr/thumb/6/61/GTA_VI_logo.svg/1280px-GTA_VI_logo.svg.png";
const D2_LOGO = "/brand/lobbies/destiny2-logo.png";

const PIN_RULES: { compute: () => Pin | null }[] = [
  {
    compute: () => {
      const d = daysUntil("2026-11-19");
      if (d < 0)
        return {
          id: "gta6",
          label: "GTA 6 — OUT NOW",
          value: "Launched",
          sub: "Find a crew →",
          href: "/lobby/gta6",
          accent: "#e84393",
          logo: GTA6_LOGO,
        };
      return {
        id: "gta6",
        label: "GTA 6 Countdown",
        value: `${d} days`,
        sub: "Nov 19 · find your crew now",
        href: "/lobby/gta6",
        accent: "#e84393",
        logo: GTA6_LOGO,
      };
    },
  },
  {
    compute: () => {
      const now = new Date();
      const day = now.getUTCDay();
      const hrsToTue = ((((2 - day) % 7) + 7) % 7) * 24 - now.getUTCHours() + 17;
      const h = ((hrsToTue % 168) + 168) % 168;
      if (h <= 24)
        return {
          id: "d2",
          label: "Destiny 2 Reset",
          value: h <= 1 ? "Now" : `${Math.round(h)}h`,
          sub: "Weekly reset · new activities",
          href: "/lobby/destiny2",
          accent: "#f58220",
          logo: D2_LOGO,
        };
      return {
        id: "d2",
        label: "Destiny 2",
        value: `${Math.round(h / 24)}d`,
        sub: "to weekly reset",
        href: "/lobby/destiny2",
        accent: "#f58220",
        logo: D2_LOGO,
      };
    },
  },
];

function PinLogo({ src, accent }: { src: string; accent: string }) {
  const [ok, setOk] = useState(true);
  if (!ok) return null;
  return (
    <div
      style={{
        width: 36,
        height: 36,
        flexShrink: 0,
        borderRadius: 2,
        background: `${accent}18`,
        border: `1px solid ${accent}33`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <img
        src={src}
        alt=""
        onError={() => setOk(false)}
        style={{ width: "100%", height: "100%", objectFit: "contain", padding: 3 }}
      />
    </div>
  );
}

function toFeedItem(n: NewsItem): FeedItem {
  let domain = "";
  try {
    domain = new URL(n.url).hostname.replace(/^www\./, "");
  } catch {}
  return {
    id: n.id,
    url: n.url,
    title: n.title,
    thumbnail: n.imageUrl || undefined,
    domain: domain || n.source || "news",
    sourceName: n.source || domain || "News",
    category: "gaming",
    heat: n.heat ?? 0,
    usersInRoom: 0,
    postedAt: new Date(n.publishedAt || Date.now()),
  };
}

function NewsThumb({ src, w, h }: { src?: string | null; w: number; h: number }) {
  const [ok, setOk] = useState(Boolean(src));
  return (
    <div
      style={{
        position: "relative",
        width: w,
        height: h,
        flexShrink: 0,
        borderRadius: 2,
        overflow: "hidden",
        background: `linear-gradient(135deg, ${GAMING_ACCENT}33, rgba(10,10,18,.9))`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {ok && src ? (
        <img
          src={src}
          alt=""
          onError={() => setOk(false)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <span style={{ fontSize: h > 60 ? 26 : 16, opacity: 0.5 }}>📰</span>
      )}
    </div>
  );
}

export default function HomePinnedNews() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [active, setActive] = useState<FeedItem | null>(null);
  const [originRect, setOriginRect] = useState<DOMRect | null>(null);
  const pins = PIN_RULES.map((r) => {
    try {
      return r.compute();
    } catch {
      return null;
    }
  }).filter(Boolean) as Pin[];

  useEffect(() => {
    fetch(`${API}/news/feed?category=gaming&limit=6`)
      .then((r) => r.json())
      .then((j) => setNews(Array.isArray(j?.articles) ? j.articles.slice(0, 4) : []))
      .catch(() => {});
  }, []);

  function openStory(e: React.MouseEvent, n: NewsItem) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setOriginRect(rect);
    setActive(toFeedItem(n));
  }

  if (pins.length === 0 && news.length === 0) return null;

  const lead = news[0];
  const rest = news.slice(1, 4);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(220px, 320px) 1fr",
        gap: 12,
        marginTop: 24,
      }}
      className="weered-home-pinnews"
    >
      <div>
        <div style={sectionLabel}>📌 Pinned</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {pins.map((p) => {
            const inner = (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 11,
                  padding: "9px 12px",
                  background: `linear-gradient(135deg, ${p.accent}14, rgba(255,255,255,.02))`,
                  border: `1px solid ${p.accent}40`,
                  borderRadius: 2,
                }}
              >
                {p.logo && <PinLogo src={p.logo} accent={p.accent} />}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      letterSpacing: "1px",
                      textTransform: "uppercase",
                      color: p.accent,
                    }}
                  >
                    {p.label}
                  </div>
                  <div
                    style={{
                      fontSize: 19,
                      fontWeight: 900,
                      color: "rgba(243,244,246,.97)",
                      letterSpacing: "-0.5px",
                      lineHeight: 1.05,
                    }}
                  >
                    {p.value}
                  </div>
                  {p.sub && (
                    <div
                      style={{
                        fontSize: 9,
                        color: "rgba(148,163,184,.7)",
                        marginTop: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {p.sub}
                    </div>
                  )}
                </div>
              </div>
            );
            return p.href ? (
              <Link key={p.id} href={p.href} style={{ textDecoration: "none" }}>
                {inner}
              </Link>
            ) : (
              <div key={p.id}>{inner}</div>
            );
          })}
        </div>
      </div>

      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <div style={{ ...sectionLabel, marginBottom: 0 }}>📰 Gaming News</div>
          <Link
            href="/lobby/news"
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.6px",
              textTransform: "uppercase",
              color: "rgba(167,139,250,.9)",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              border: "1px solid rgba(124,58,237,.3)",
              borderRadius: 2,
              padding: "4px 10px",
              transition: "all .15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(124,58,237,.6)";
              (e.currentTarget as HTMLElement).style.background = "rgba(124,58,237,.1)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(124,58,237,.3)";
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            Open News Lobby →
          </Link>
        </div>

        {lead && (
          <button
            type="button"
            onClick={(e) => openStory(e, lead)}
            style={{
              width: "100%",
              textAlign: "left",
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex",
              gap: 12,
              padding: 10,
              marginBottom: 8,
              background: `linear-gradient(135deg, ${GAMING_ACCENT}12, rgba(255,255,255,.02))`,
              border: `1px solid ${GAMING_ACCENT}38`,
              borderRadius: 2,
              color: "inherit",
              transition: "border-color .15s, transform .12s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = `${GAMING_ACCENT}80`;
              (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = `${GAMING_ACCENT}38`;
              (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
            }}
          >
            <NewsThumb src={lead.imageUrl} w={120} h={78} />
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 6,
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                  <span
                    style={{
                      fontSize: 8,
                      fontWeight: 900,
                      letterSpacing: "1px",
                      textTransform: "uppercase",
                      color: "#fff",
                      background: GAMING_ACCENT,
                      borderRadius: 2,
                      padding: "2px 6px",
                    }}
                  >
                    Top Story
                  </span>
                  {lead.source && (
                    <span
                      style={{
                        fontSize: 9,
                        color: "rgba(148,163,184,.6)",
                        fontFamily: "ui-monospace, monospace",
                        letterSpacing: "0.4px",
                        textTransform: "uppercase",
                      }}
                    >
                      {lead.source}
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: "rgba(243,244,246,.96)",
                    lineHeight: 1.28,
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical" as any,
                  }}
                >
                  {lead.title}
                </div>
              </div>
              <span
                style={{
                  alignSelf: "flex-start",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 10,
                  fontWeight: 700,
                  color: "rgba(167,139,250,.92)",
                }}
              >
                💬 Discuss on Weered →
              </span>
            </div>
          </button>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {rest.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={(e) => openStory(e, n)}
              style={{
                width: "100%",
                textAlign: "left",
                cursor: "pointer",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                background: "rgba(255,255,255,.02)",
                border: "1px solid rgba(255,255,255,.06)",
                borderRadius: 2,
                color: "inherit",
                transition: "all .15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = `${GAMING_ACCENT}50`;
                (e.currentTarget as HTMLElement).style.background = "rgba(124,58,237,.06)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,.06)";
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.02)";
              }}
            >
              <NewsThumb src={n.imageUrl} w={48} h={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "rgba(243,244,246,.92)",
                    lineHeight: 1.3,
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical" as any,
                  }}
                >
                  {n.title}
                </div>
                {n.source && (
                  <div
                    style={{
                      fontSize: 9,
                      color: "rgba(148,163,184,.5)",
                      fontFamily: "ui-monospace, monospace",
                      letterSpacing: "0.4px",
                      textTransform: "uppercase",
                      marginTop: 2,
                    }}
                  >
                    {n.source}
                  </div>
                )}
              </div>
              <span style={{ flexShrink: 0, fontSize: 13, opacity: 0.5 }}>💬</span>
            </button>
          ))}
        </div>
      </div>

      <StoryInterceptModal item={active} originRect={originRect} onClose={() => setActive(null)} />

      <style>{`
        @media (max-width: 760px) {
          .weered-home-pinnews { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

const sectionLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "1.5px",
  textTransform: "uppercase",
  color: "var(--weered-accent-text, rgba(167,139,250,.85))",
  marginBottom: 10,
  opacity: 0.9,
};
