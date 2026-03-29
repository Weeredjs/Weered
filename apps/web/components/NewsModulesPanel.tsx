"use client";

import React, { useCallback, useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

function authHeaders() {
  try { const t = localStorage.getItem("weered_token") || ""; return t ? { Authorization: `Bearer ${t}` } : {}; } catch { return {}; }
}

async function apiFetch(path: string) {
  const r = await fetch(`${API}${path}`, { headers: { "Content-Type": "application/json", ...authHeaders() } });
  return r.json();
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60_000) return "just now";
    const m = Math.floor(diff / 60_000);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d === 1) return "Yesterday";
    if (d < 7) return `${d}d ago`;
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch { return ""; }
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Types ────────────────────────────────────────────────────────────────────

type Article = {
  id: string;
  guid: string;
  url: string;
  title: string;
  description: string;
  imageUrl: string | null;
  source: string;
  sourceIcon: string | null;
  category: string;
  publishedAt: string;
  heat: number;
};

// ── Categories ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: "top",           label: "Top Stories" },
  { id: "world",         label: "World" },
  { id: "canada",        label: "Canada" },
  { id: "tech",          label: "Tech" },
  { id: "business",      label: "Business" },
  { id: "science",       label: "Science" },
  { id: "sports",        label: "Sports" },
  { id: "entertainment", label: "Entertainment" },
];

// ── Hero Story ───────────────────────────────────────────────────────────────

function HeroStory({ article, accent }: { article: Article; accent: string }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "block", borderRadius: 14, overflow: "hidden",
        position: "relative", minHeight: 220, marginBottom: 16,
        background: "linear-gradient(135deg, rgba(20,20,30,1), rgba(30,20,40,1))",
        textDecoration: "none", color: "#fff",
        border: "1px solid rgba(255,255,255,.08)",
      }}
    >
      {/* Background image via <img> for referrer policy */}
      {article.imageUrl && (
        <img
          src={article.imageUrl}
          alt=""
          referrerPolicy="no-referrer"
          loading="eager"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      )}
      {/* Gradient overlay */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(to top, rgba(0,0,0,.85) 0%, rgba(0,0,0,.45) 45%, rgba(0,0,0,.1) 100%)",
      }} />
      {/* Content */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        padding: "20px 18px",
        display: "flex", flexDirection: "column", gap: 8,
      }}>
        <div style={{
          fontSize: 20, fontWeight: 900, lineHeight: 1.25,
          letterSpacing: "-0.3px",
          textShadow: "0 2px 8px rgba(0,0,0,.6)",
        }}>
          {stripHtml(article.title)}
        </div>
        {article.description && (
          <div style={{
            fontSize: 12, lineHeight: 1.5, opacity: 0.7,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any,
            overflow: "hidden",
          }}>
            {stripHtml(article.description)}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, opacity: 0.6 }}>
          <span style={{ color: accent, fontWeight: 700 }}>{article.source}</span>
          <span style={{ opacity: 0.5 }}>&middot;</span>
          <span>{timeAgo(article.publishedAt)}</span>
        </div>
      </div>
    </a>
  );
}

// ── Primary Story Card ───────────────────────────────────────────────────────

function PrimaryCard({ article, accent }: { article: Article; accent: string }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "flex", gap: 12, padding: "12px 14px",
        borderRadius: 10, background: "rgba(255,255,255,.03)",
        border: "1px solid rgba(255,255,255,.06)",
        textDecoration: "none", color: "inherit",
        transition: "border-color 0.15s, background 0.15s",
        cursor: "pointer",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = `${accent}44`;
        (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.05)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,.06)";
        (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.03)";
      }}
    >
      {/* Text */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{
          fontSize: 13, fontWeight: 700, lineHeight: 1.35,
          display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" as any,
          overflow: "hidden",
        }}>
          {stripHtml(article.title)}
        </div>
        {article.description && (
          <div style={{
            fontSize: 11, lineHeight: 1.45, opacity: 0.45,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any,
            overflow: "hidden",
          }}>
            {stripHtml(article.description)}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, opacity: 0.5, marginTop: "auto" }}>
          <span style={{ color: accent, fontWeight: 700, opacity: 1 }}>{article.source}</span>
          <span>&middot;</span>
          <span>{timeAgo(article.publishedAt)}</span>
        </div>
      </div>
      {/* Thumbnail */}
      {article.imageUrl && (
        <div style={{
          width: 100, height: 72, borderRadius: 8, overflow: "hidden", flexShrink: 0,
          background: "rgba(255,255,255,.05)",
        }}>
          <img
            src={article.imageUrl}
            alt=""
            referrerPolicy="no-referrer"
            loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>
      )}
    </a>
  );
}

// ── Secondary Story Link ─────────────────────────────────────────────────────

function SecondaryLink({ article, accent }: { article: Article; accent: string }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "8px 12px", borderRadius: 8,
        textDecoration: "none", color: "inherit",
        transition: "background 0.12s",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.04)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    >
      <div style={{
        width: 4, height: 4, borderRadius: "50%",
        background: accent, opacity: 0.6, flexShrink: 0,
      }} />
      <div style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {stripHtml(article.title)}
      </div>
      <div style={{ fontSize: 10, opacity: 0.35, flexShrink: 0, whiteSpace: "nowrap" }}>
        {article.source} &middot; {timeAgo(article.publishedAt)}
      </div>
    </a>
  );
}

// ── Trending Sidebar ─────────────────────────────────────────────────────────

function TrendingSidebar({ articles, accent }: { articles: Article[]; accent: string }) {
  if (!articles.length) return null;
  return (
    <div style={{
      borderRadius: 12, background: "rgba(255,255,255,.025)",
      border: "1px solid rgba(255,255,255,.06)",
      padding: "14px 0",
    }}>
      <div style={{
        fontSize: 10, fontWeight: 800, letterSpacing: "1px",
        textTransform: "uppercase", opacity: 0.4,
        padding: "0 14px 10px", borderBottom: "1px solid rgba(255,255,255,.06)",
      }}>
        Trending
      </div>
      {articles.map((a, i) => (
        <a
          key={a.id}
          href={a.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex", alignItems: "flex-start", gap: 10,
            padding: "10px 14px", textDecoration: "none", color: "inherit",
            borderBottom: i < articles.length - 1 ? "1px solid rgba(255,255,255,.04)" : "none",
            transition: "background 0.12s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.04)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >
          <span style={{
            fontSize: 14, fontWeight: 900, color: accent, opacity: 0.7,
            width: 20, textAlign: "right", flexShrink: 0, fontFamily: "monospace",
          }}>
            {i + 1}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 12, fontWeight: 600, lineHeight: 1.35,
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any,
              overflow: "hidden",
            }}>
              {stripHtml(a.title)}
            </div>
            <div style={{ fontSize: 10, opacity: 0.35, marginTop: 3 }}>
              {a.source} &middot; {timeAgo(a.publishedAt)}
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}

// ── Loading skeleton ─────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "16px 0" }}>
      <div style={{ height: 200, borderRadius: 14, background: "rgba(255,255,255,.04)", animation: "shimmer 1.5s ease-in-out infinite" }} />
      {[1,2,3,4].map(i => (
        <div key={i} style={{ height: 72, borderRadius: 10, background: "rgba(255,255,255,.03)", animation: `shimmer 1.5s ease-in-out ${i * 0.15}s infinite` }} />
      ))}
      <style>{`@keyframes shimmer{0%,100%{opacity:0.3}50%{opacity:0.6}}`}</style>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function NewsModulesPanel({ lobbyId, accentColor, style }: {
  lobbyId: string;
  accentColor?: string;
  style?: React.CSSProperties;
}) {
  const accent = accentColor || "#DC2626";
  const [category, setCategory] = useState("top");
  const [articles, setArticles] = useState<Article[]>([]);
  const [trending, setTrending] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFeed = useCallback(async (cat: string) => {
    setLoading(true);
    try {
      const data = await apiFetch(`/news/feed?category=${cat}&limit=30`);
      if (data?.ok) setArticles(data.articles || []);
    } catch {}
    setLoading(false);
  }, []);

  const loadTrending = useCallback(async () => {
    try {
      const data = await apiFetch("/news/trending");
      if (data?.ok) setTrending(data.articles || []);
    } catch {}
  }, []);

  useEffect(() => { loadFeed(category); }, [category, loadFeed]);
  useEffect(() => { loadTrending(); }, [loadTrending]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const iv = setInterval(() => { loadFeed(category); loadTrending(); }, 60_000);
    return () => clearInterval(iv);
  }, [category, loadFeed, loadTrending]);

  const hero = articles[0] || null;
  const primary = articles.slice(1, 7);
  const secondary = articles.slice(7);

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      overflow: "hidden",
      ...style,
    }}>
      {/* ── Category tabs ── */}
      <div style={{
        display: "flex", gap: 2, padding: "8px 12px",
        overflowX: "auto", flexShrink: 0,
        borderBottom: "1px solid rgba(255,255,255,.06)",
        scrollbarWidth: "none",
      }}>
        {CATEGORIES.map(cat => {
          const active = cat.id === category;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(cat.id)}
              style={{
                padding: "6px 14px", borderRadius: 8, border: "none",
                fontSize: 11, fontWeight: 700, fontFamily: "inherit",
                cursor: "pointer", whiteSpace: "nowrap",
                transition: "all 0.15s",
                background: active ? `${accent}20` : "transparent",
                color: active ? accent : "rgba(255,255,255,.45)",
                borderBottom: active ? `2px solid ${accent}` : "2px solid transparent",
              }}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* ── Content area ── */}
      <div style={{
        flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden",
        padding: "14px 14px 24px",
        scrollbarWidth: "thin",
        scrollbarColor: "rgba(255,255,255,.08) transparent",
      }}>
        {loading && !articles.length ? (
          <Skeleton />
        ) : !articles.length ? (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", padding: "60px 0", opacity: 0.3,
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <path d="M7 8h10M7 12h6M7 16h8" />
            </svg>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 12 }}>No articles yet</div>
            <div style={{ fontSize: 11, marginTop: 4 }}>Feed is loading. Check back shortly.</div>
          </div>
        ) : (
          <div style={{
            display: "flex", gap: 16,
            flexWrap: "wrap",
          }}>
            {/* Main feed column */}
            <div style={{ flex: "1 1 340px", minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Hero */}
              {hero && <HeroStory article={hero} accent={accent} />}

              {/* Primary cards */}
              {primary.map(a => (
                <PrimaryCard key={a.id} article={a} accent={accent} />
              ))}

              {/* Secondary links */}
              {secondary.length > 0 && (
                <div style={{
                  marginTop: 8, borderTop: "1px solid rgba(255,255,255,.06)",
                  paddingTop: 8,
                }}>
                  <div style={{
                    fontSize: 10, fontWeight: 800, letterSpacing: "1px",
                    textTransform: "uppercase", opacity: 0.3, marginBottom: 6,
                    paddingLeft: 12,
                  }}>
                    More Headlines
                  </div>
                  {secondary.map(a => (
                    <SecondaryLink key={a.id} article={a} accent={accent} />
                  ))}
                </div>
              )}
            </div>

            {/* Trending sidebar */}
            <div style={{ flex: "0 0 220px", minWidth: 180 }}>
              <TrendingSidebar articles={trending} accent={accent} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
