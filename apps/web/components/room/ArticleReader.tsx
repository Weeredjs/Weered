"use client";

import React, { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

type ArticleData = {
  title: string;
  description: string;
  image: string | null;
  siteName: string;
  author: string | null;
  publishedAt: string | null;
  body: string;
  url: string;
};

function timeAgo(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return ""; }
}

export default function ArticleReader({ url, onClose }: { url: string; onClose?: () => void }) {
  const [article, setArticle] = useState<ArticleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [imgOk, setImgOk] = useState(true);

  useEffect(() => {
    if (!url) return;
    setLoading(true);
    setError("");
    setImgOk(true);
    fetch(`${API}/news/reader?url=${encodeURIComponent(url)}`)
      .then(r => r.json())
      .then(d => {
        if (d.ok) setArticle(d);
        else setError(d.error || "Failed to load article");
      })
      .catch(() => setError("Failed to load article"))
      .finally(() => setLoading(false));
  }, [url]);

  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 20 }}>
      {[85, 60, 100, 95, 80, 100, 90].map((w, i) => (
        <div key={i} style={{ height: i === 0 ? 20 : 13, width: `${w}%`, borderRadius: 4, background: "rgba(255,255,255,.04)", animation: `shimmer 1.5s ease-in-out ${i * 0.1}s infinite` }} />
      ))}
      <style>{`@keyframes shimmer{0%,100%{opacity:0.3}50%{opacity:0.6}}`}</style>
    </div>
  );

  if (error || !article) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, gap: 10, fontFamily: FONT_STACK }}>
      <div style={{ fontSize: 12, opacity: 0.4 }}>{error || "Could not load article"}</div>
      <a href={url} target="_blank" rel="noopener noreferrer" style={{
        padding: "7px 14px", borderRadius: 8,
        background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)",
        color: "rgba(167,139,250,.9)", fontSize: 11, fontWeight: 600, textDecoration: "none",
      }}>
        Open in browser &rarr;
      </a>
    </div>
  );

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      height: "100%", overflow: "hidden",
      fontFamily: FONT_STACK,
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "6px 12px",
        borderBottom: "1px solid rgba(255,255,255,.06)",
        flexShrink: 0, background: "rgba(255,255,255,.02)",
        fontSize: 10,
      }}>
        <span style={{ opacity: 0.3 }}>📰</span>
        <span style={{ flex: 1, opacity: 0.4, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {article.siteName || new URL(url).hostname}
        </span>
        <a href={url} target="_blank" rel="noopener noreferrer" style={{
          padding: "2px 7px", borderRadius: 5,
          border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.04)",
          color: "rgba(167,139,250,.7)", fontSize: 10, fontWeight: 600, textDecoration: "none",
        }}>
          Source &rarr;
        </a>
        {onClose && (
          <button onClick={onClose} style={{
            padding: "2px 6px", borderRadius: 5, border: "1px solid rgba(255,255,255,.08)",
            background: "rgba(255,255,255,.04)", color: "rgba(148,163,184,.5)",
            fontSize: 10, cursor: "pointer", fontFamily: "inherit",
          }}>
            &times;
          </button>
        )}
      </div>

      <div style={{
        flex: 1, overflowY: "auto",
        padding: "16px 20px 32px",
        maxWidth: 680, width: "100%",
        scrollbarWidth: "thin",
        scrollbarColor: "rgba(255,255,255,.08) transparent",
      }}>
        {article.image && imgOk && (
          <div style={{ marginBottom: 16, borderRadius: 10, overflow: "hidden" }}>
            <img
              src={article.image}
              alt={article.title + " image"}
              referrerPolicy="no-referrer"
              style={{ width: "100%", height: "auto", maxHeight: 220, objectFit: "cover", display: "block" }}
              onLoad={e => {
                const img = e.target as HTMLImageElement;
                if (img.naturalWidth < 100 || img.naturalHeight < 60) {
                  setImgOk(false);
                }
              }}
              onError={() => setImgOk(false)}
            />
          </div>
        )}

        <h1 style={{
          fontSize: 19, fontWeight: 800, lineHeight: 1.35,
          letterSpacing: "-0.2px", margin: "0 0 8px",
          color: "rgba(243,244,246,.95)",
          fontFamily: FONT_STACK,
        }}>
          {article.title}
        </h1>

        <div style={{
          display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
          fontSize: 10, opacity: 0.4, marginBottom: 16,
          paddingBottom: 12, borderBottom: "1px solid rgba(255,255,255,.06)",
        }}>
          {article.siteName && <span style={{ fontWeight: 700 }}>{article.siteName}</span>}
          {article.author && <><span>&middot;</span><span>{article.author}</span></>}
          {article.publishedAt && <><span>&middot;</span><span>{timeAgo(article.publishedAt)}</span></>}
        </div>

        <div style={{
          fontSize: 13.5, lineHeight: 1.75, color: "rgba(229,231,235,.78)",
          fontFamily: FONT_STACK,
          wordBreak: "break-word",
        }}>
          {article.body.split("\n\n").map((block, i) => {
            const imgMatch = block.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
            if (imgMatch) {
              return (
                <div key={i} style={{ margin: "14px 0", borderRadius: 8, overflow: "hidden" }}>
                  <img
                    src={imgMatch[2]} alt={imgMatch[1]}
                    referrerPolicy="no-referrer" loading="lazy"
                    style={{ width: "100%", height: "auto", display: "block", maxHeight: 260, objectFit: "cover" }}
                    onLoad={e => { const img = e.target as HTMLImageElement; if (img.naturalWidth < 100) img.parentElement!.style.display = "none"; }}
                    onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }}
                  />
                </div>
              );
            }
            if (block.startsWith("## ")) {
              return <h2 key={i} style={{ fontSize: 15, fontWeight: 700, margin: "20px 0 8px", color: "rgba(243,244,246,.88)", fontFamily: FONT_STACK }}>{block.slice(3)}</h2>;
            }
            if (block.startsWith("> ")) {
              return (
                <blockquote key={i} style={{
                  margin: "12px 0", padding: "10px 14px",
                  borderLeft: "3px solid rgba(167,139,250,.35)",
                  background: "rgba(167,139,250,.04)",
                  borderRadius: "0 6px 6px 0", fontStyle: "italic", opacity: 0.8,
                  fontSize: 13,
                }}>
                  {block.slice(2)}
                </blockquote>
              );
            }
            return <p key={i} style={{ margin: "0 0 12px" }}>{block}</p>;
          })}
        </div>

        <div style={{
          marginTop: 20, paddingTop: 12,
          borderTop: "1px solid rgba(255,255,255,.06)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: 9, opacity: 0.2 }}>
            via {article.siteName || new URL(url).hostname}
          </span>
          <a href={url} target="_blank" rel="noopener noreferrer" style={{
            padding: "5px 12px", borderRadius: 6,
            background: "rgba(167,139,250,.08)", border: "1px solid rgba(167,139,250,.18)",
            color: "rgba(167,139,250,.7)", fontSize: 10, fontWeight: 600, textDecoration: "none",
          }}>
            Read original &rarr;
          </a>
        </div>
      </div>
    </div>
  );
}
