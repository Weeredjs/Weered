"use client";

import { useState, useEffect, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeedItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  thumbnail?: string;
  source: string;
  subreddit?: string;
  score?: number;
  comments?: number;
  age: string;
  isGTA6?: boolean;
  isVideo?: boolean;
  author?: string;
}

interface Channel {
  id: string;
  label: string;
  icon: string;
  color: string;
  sources: { type: "reddit"; sub: string }[];
  gta6Keywords?: string[];
}

// ─── Channel Config ───────────────────────────────────────────────────────────

const CHANNELS: Channel[] = [
  {
    id: "gaming",
    label: "Gaming",
    icon: "🎮",
    color: "#a855f7",
    sources: [
      { type: "reddit", sub: "gaming" },
      { type: "reddit", sub: "GTA6" },
      { type: "reddit", sub: "games" },
    ],
    gta6Keywords: ["gta 6", "gta6", "grand theft auto 6", "rockstar"],
  },
  {
    id: "ufc",
    label: "UFC",
    icon: "🥊",
    color: "#ef4444",
    sources: [
      { type: "reddit", sub: "ufc" },
      { type: "reddit", sub: "MMA" },
    ],
  },
  {
    id: "news",
    label: "News",
    icon: "📰",
    color: "#3b82f6",
    sources: [
      { type: "reddit", sub: "worldnews" },
      { type: "reddit", sub: "news" },
    ],
  },
  {
    id: "sports",
    label: "Sports",
    icon: "⚽",
    color: "#22c55e",
    sources: [
      { type: "reddit", sub: "sports" },
      { type: "reddit", sub: "nba" },
      { type: "reddit", sub: "soccer" },
    ],
  },
  {
    id: "tech",
    label: "Tech",
    icon: "💻",
    color: "#06b6d4",
    sources: [
      { type: "reddit", sub: "technology" },
      { type: "reddit", sub: "programming" },
    ],
  },
  {
    id: "podcasts",
    label: "Podcasts",
    icon: "🎙️",
    color: "#f59e0b",
    sources: [
      { type: "reddit", sub: "podcasts" },
      { type: "reddit", sub: "joerogan" },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(utcSeconds: number): string {
  const diff = Math.floor(Date.now() / 1000) - utcSeconds;
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function formatScore(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

async function fetchReddit(sub: string): Promise<FeedItem[]> {
  const res = await fetch(
    `https://www.reddit.com/r/${sub}/hot.json?limit=15&raw_json=1`,
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data?.data?.children ?? [])
    .filter((c: any) => !c.data.stickied)
    .map((c: any) => {
      const p = c.data;
      let thumb =
        p.thumbnail &&
        p.thumbnail.startsWith("http") &&
        !["self", "default", "nsfw", "spoiler"].includes(p.thumbnail)
          ? p.thumbnail
          : undefined;
      // prefer preview image if available
      if (p.preview?.images?.[0]?.resolutions?.length) {
        const res = p.preview.images[0].resolutions;
        thumb = res[Math.min(2, res.length - 1)]?.url?.replace(/&amp;/g, "&");
      }
      return {
        id: p.id,
        title: p.title,
        summary: p.selftext?.slice(0, 200) || "",
        url: p.url,
        thumbnail: thumb,
        source: `r/${sub}`,
        subreddit: sub,
        score: p.score,
        comments: p.num_comments,
        age: timeAgo(p.created_utc),
        isVideo: p.is_video || p.url?.includes("youtube") || p.url?.includes("youtu.be"),
        author: p.author,
      } as FeedItem;
    });
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function ItemModal({
  item,
  channelColor,
  onClose,
}: {
  item: FeedItem;
  channelColor: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(6px)",
        animation: "fadeIn 0.15s ease",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          width: "min(640px, 92vw)",
          background: "#111114",
          border: `1px solid ${channelColor}33`,
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: `0 0 60px ${channelColor}22, 0 24px 48px rgba(0,0,0,0.6)`,
          animation: "slideUp 0.2s ease",
        }}
      >
        {item.thumbnail && (
          <div style={{ position: "relative", height: 220, overflow: "hidden" }}>
            <img
              src={item.thumbnail}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(to bottom, transparent 40%, #111114)",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                background: channelColor + "22",
                border: `1px solid ${channelColor}44`,
                borderRadius: 6,
                padding: "3px 8px",
                fontSize: 11,
                color: channelColor,
                fontFamily: "monospace",
              }}
            >
              {item.source}
            </div>
          </div>
        )}
        <div style={{ padding: "20px 24px 24px" }}>
          {!item.thumbnail && (
            <span
              style={{
                display: "inline-block",
                background: channelColor + "18",
                border: `1px solid ${channelColor}33`,
                borderRadius: 6,
                padding: "2px 8px",
                fontSize: 11,
                color: channelColor,
                marginBottom: 10,
                fontFamily: "monospace",
              }}
            >
              {item.source}
            </span>
          )}
          <h2
            style={{
              margin: "0 0 10px",
              fontSize: 18,
              fontWeight: 700,
              color: "#f1f1f3",
              lineHeight: 1.4,
              letterSpacing: "-0.01em",
            }}
          >
            {item.title}
          </h2>
          {item.summary && (
            <p
              style={{
                margin: "0 0 16px",
                fontSize: 13,
                color: "#888",
                lineHeight: 1.6,
              }}
            >
              {item.summary}
              {item.summary.length >= 200 ? "…" : ""}
            </p>
          )}
          <div
            style={{
              display: "flex",
              gap: 16,
              fontSize: 12,
              color: "#555",
              marginBottom: 20,
              alignItems: "center",
            }}
          >
            {item.author && <span>u/{item.author}</span>}
            <span>{item.age} ago</span>
            {item.score !== undefined && (
              <span style={{ color: "#888" }}>▲ {formatScore(item.score)}</span>
            )}
            {item.comments !== undefined && (
              <span style={{ color: "#888" }}>💬 {item.comments}</span>
            )}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 1,
                display: "block",
                textAlign: "center",
                padding: "10px 0",
                background: channelColor,
                color: "#fff",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
                letterSpacing: "0.02em",
              }}
            >
              Open Link →
            </a>
            <a
              href={`https://reddit.com/r/${item.subreddit}/comments/${item.id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: "10px 16px",
                background: "#1a1a1f",
                border: "1px solid #2a2a32",
                color: "#888",
                borderRadius: 8,
                fontSize: 13,
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              Comments
            </a>
            <button
              onClick={onClose}
              style={{
                padding: "10px 14px",
                background: "#1a1a1f",
                border: "1px solid #2a2a32",
                color: "#555",
                borderRadius: 8,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── GTA 6 Hero Card ──────────────────────────────────────────────────────────

function GTA6HeroCard({ item, onClick }: { item: FeedItem; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        position: "relative",
        borderRadius: 12,
        overflow: "hidden",
        cursor: "pointer",
        marginBottom: 12,
        height: 130,
        background: item.thumbnail
          ? `url(${item.thumbnail}) center/cover`
          : "linear-gradient(135deg, #1a0533 0%, #2d0a5e 50%, #0f0f1a 100%)",
        border: "1px solid #a855f744",
        transition: "transform 0.2s, box-shadow 0.2s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
        (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 32px #a855f733";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(to right, rgba(0,0,0,0.85) 40%, transparent)",
        }}
      />
      <div style={{ position: "relative", padding: "16px 18px", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              background: "linear-gradient(90deg, #a855f7, #ec4899)",
              borderRadius: 4,
              padding: "2px 8px",
              fontSize: 10,
              fontWeight: 700,
              color: "#fff",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            🔥 GTA 6
          </span>
          <span style={{ fontSize: 11, color: "#a855f788" }}>{item.age} ago</span>
        </div>
        <div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "#f1f1f3",
              lineHeight: 1.35,
              marginBottom: 4,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {item.title}
          </div>
          <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#a855f799" }}>
            {item.score !== undefined && <span>▲ {formatScore(item.score)}</span>}
            {item.comments !== undefined && <span>💬 {item.comments}</span>}
            <span>{item.source}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Feed Card ────────────────────────────────────────────────────────────────

function FeedCard({
  item,
  channelColor,
  onClick,
}: {
  item: FeedItem;
  channelColor: string;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        gap: 12,
        padding: "10px 12px",
        borderRadius: 8,
        cursor: "pointer",
        background: hovered ? "#16161c" : "transparent",
        border: `1px solid ${hovered ? channelColor + "22" : "transparent"}`,
        transition: "all 0.15s ease",
        alignItems: "flex-start",
      }}
    >
      {item.thumbnail ? (
        <img
          src={item.thumbnail}
          alt=""
          style={{
            width: 72,
            height: 52,
            objectFit: "cover",
            borderRadius: 6,
            flexShrink: 0,
            background: "#1a1a22",
          }}
        />
      ) : (
        <div
          style={{
            width: 72,
            height: 52,
            borderRadius: 6,
            flexShrink: 0,
            background: channelColor + "12",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
          }}
        >
          {item.isVideo ? "▶" : "📄"}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: hovered ? "#f1f1f3" : "#ccc",
            lineHeight: 1.35,
            marginBottom: 4,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            transition: "color 0.15s",
          }}
        >
          {item.title}
        </div>
        <div
          style={{
            display: "flex",
            gap: 10,
            fontSize: 11,
            color: "#555",
            alignItems: "center",
          }}
        >
          <span style={{ color: channelColor + "aa", fontFamily: "monospace" }}>
            {item.source}
          </span>
          <span>{item.age}</span>
          {item.score !== undefined && (
            <span>▲ {formatScore(item.score)}</span>
          )}
          {item.comments !== undefined && (
            <span>💬 {item.comments}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ContentHub() {
  const [activeChannel, setActiveChannel] = useState("gaming");
  const [feeds, setFeeds] = useState<Record<string, FeedItem[]>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [selectedItem, setSelectedItem] = useState<FeedItem | null>(null);
  const [sort, setSort] = useState<"hot" | "new">("hot");

  const channel = CHANNELS.find((c) => c.id === activeChannel)!;

  const loadChannel = useCallback(
    async (channelId: string) => {
      if (feeds[channelId] || loading[channelId]) return;
      setLoading((l) => ({ ...l, [channelId]: true }));
      const ch = CHANNELS.find((c) => c.id === channelId)!;
      const results = await Promise.all(
        ch.sources.map((s) => fetchReddit(s.sub))
      );
      const flat = results
        .flat()
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      // dedupe by id
      const seen = new Set<string>();
      const deduped = flat.filter((i) => {
        if (seen.has(i.id)) return false;
        seen.add(i.id);
        return true;
      });
      // tag GTA6
      if (ch.gta6Keywords) {
        deduped.forEach((item) => {
          if (
            ch.gta6Keywords!.some((kw) =>
              item.title.toLowerCase().includes(kw)
            )
          ) {
            item.isGTA6 = true;
          }
        });
      }
      setFeeds((f) => ({ ...f, [channelId]: deduped }));
      setLoading((l) => ({ ...l, [channelId]: false }));
    },
    [feeds, loading]
  );

  useEffect(() => {
    loadChannel(activeChannel);
  }, [activeChannel]);

  const items = feeds[activeChannel] ?? [];
  const gta6Items = items.filter((i) => i.isGTA6);
  const regularItems = items.filter((i) => !i.isGTA6);
  const showGTA6Hero = activeChannel === "gaming" && gta6Items.length > 0;
  const heroItem = gta6Items[0];
  const displayItems =
    sort === "hot"
      ? [...(showGTA6Hero ? gta6Items.slice(1) : []), ...regularItems]
      : [...items].reverse();

  return (
    <>
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { transform: translateY(16px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        @keyframes shimmer {
          0% { background-position: -400px 0 }
          100% { background-position: 400px 0 }
        }
        .ch-tab:hover { opacity: 1 !important; }
        .ch-scroll::-webkit-scrollbar { width: 4px; }
        .ch-scroll::-webkit-scrollbar-track { background: transparent; }
        .ch-scroll::-webkit-scrollbar-thumb { background: #2a2a35; border-radius: 4px; }
        .ch-scroll::-webkit-scrollbar-thumb:hover { background: #3a3a48; }
      `}</style>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          background: "#0d0d11",
          borderRadius: 12,
          overflow: "hidden",
          border: "1px solid #1e1e28",
        }}
      >
        {/* ── Channel Tabs ── */}
        <div
          style={{
            display: "flex",
            gap: 2,
            padding: "10px 12px 0",
            borderBottom: "1px solid #1e1e28",
            background: "#0d0d11",
            overflowX: "auto",
            flexShrink: 0,
          }}
        >
          {CHANNELS.map((ch) => {
            const isActive = ch.id === activeChannel;
            return (
              <button
                key={ch.id}
                className="ch-tab"
                onClick={() => setActiveChannel(ch.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 12px",
                  border: "none",
                  borderRadius: "8px 8px 0 0",
                  background: isActive ? "#16161e" : "transparent",
                  color: isActive ? ch.color : "#666",
                  fontSize: 12,
                  fontWeight: isActive ? 700 : 500,
                  cursor: "pointer",
                  opacity: isActive ? 1 : 0.7,
                  transition: "all 0.15s",
                  whiteSpace: "nowrap",
                  borderBottom: isActive
                    ? `2px solid ${ch.color}`
                    : "2px solid transparent",
                  letterSpacing: "0.02em",
                }}
              >
                <span>{ch.icon}</span>
                <span>{ch.label}</span>
                {loading[ch.id] && (
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: ch.color,
                      opacity: 0.6,
                      animation: "pulse 1s infinite",
                    }}
                  />
                )}
              </button>
            );
          })}
          <div style={{ flex: 1 }} />
          {/* Sort toggle */}
          <div
            style={{
              display: "flex",
              gap: 2,
              alignItems: "center",
              paddingBottom: 4,
            }}
          >
            {(["hot", "new"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: "none",
                  background: sort === s ? channel.color + "22" : "transparent",
                  color: sort === s ? channel.color : "#555",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* ── Feed ── */}
        <div
          className="ch-scroll"
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "10px 8px",
          }}
        >
          {loading[activeChannel] ? (
            // Skeleton loader
            <div style={{ padding: "4px 4px" }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 12,
                    padding: "10px 12px",
                    marginBottom: 2,
                  }}
                >
                  <div
                    style={{
                      width: 72,
                      height: 52,
                      borderRadius: 6,
                      background:
                        "linear-gradient(90deg, #16161e 25%, #1e1e28 50%, #16161e 75%)",
                      backgroundSize: "400px 100%",
                      animation: "shimmer 1.4s infinite",
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        height: 13,
                        borderRadius: 4,
                        background:
                          "linear-gradient(90deg, #16161e 25%, #1e1e28 50%, #16161e 75%)",
                        backgroundSize: "400px 100%",
                        animation: "shimmer 1.4s infinite",
                        marginBottom: 6,
                        width: "85%",
                      }}
                    />
                    <div
                      style={{
                        height: 11,
                        borderRadius: 4,
                        background:
                          "linear-gradient(90deg, #16161e 25%, #1e1e28 50%, #16161e 75%)",
                        backgroundSize: "400px 100%",
                        animation: "shimmer 1.4s infinite",
                        width: "55%",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: 200,
                color: "#444",
                fontSize: 13,
                gap: 8,
              }}
            >
              <span style={{ fontSize: 32 }}>{channel.icon}</span>
              <span>No content loaded</span>
              <button
                onClick={() => {
                  setFeeds((f) => {
                    const n = { ...f };
                    delete n[activeChannel];
                    return n;
                  });
                  loadChannel(activeChannel);
                }}
                style={{
                  marginTop: 4,
                  padding: "6px 14px",
                  border: `1px solid ${channel.color}44`,
                  borderRadius: 6,
                  background: "transparent",
                  color: channel.color,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              {/* GTA 6 Hero */}
              {showGTA6Hero && heroItem && (
                <div style={{ padding: "0 4px 4px" }}>
                  <GTA6HeroCard
                    item={heroItem}
                    onClick={() => setSelectedItem(heroItem)}
                  />
                </div>
              )}

              {/* Regular feed */}
              <div>
                {displayItems.slice(0, 30).map((item) => (
                  <FeedCard
                    key={item.id}
                    item={item}
                    channelColor={channel.color}
                    onClick={() => setSelectedItem(item)}
                  />
                ))}
              </div>

              {/* Footer */}
              <div
                style={{
                  textAlign: "center",
                  padding: "16px 0 8px",
                  fontSize: 11,
                  color: "#333",
                  letterSpacing: "0.04em",
                }}
              >
                Powered by public feeds · Content opens on source site
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Modal ── */}
      {selectedItem && (
        <ItemModal
          item={selectedItem}
          channelColor={channel.color}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </>
  );
}
