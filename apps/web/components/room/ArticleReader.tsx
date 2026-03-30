"use client";

import React, { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

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

  useEffect(() => {
    if (!url) return;
    setLoading(true);
    setError("");
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
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 24, animation: "shimmer 1.5s ease-in-out infinite" }}>
      <div style={{ height: 200, borderRadius: 12, background: "rgba(255,255,255,.04)" }} />
      <div style={{ height: 28, width: "80%", borderRadius: 6, background: "rgba(255,255,255,.04)" }} />
      <div style={{ height: 14, width: "40%", borderRadius: 4, background: "rgba(255,255,255,.03)" }} />
      <div style={{ height: 14, width: "100%", borderRadius: 4, background: "rgba(255,255,255,.03)" }} />
      <div style={{ height: 14, width: "95%", borderRadius: 4, background: "rgba(255,255,255,.03)" }} />
      <div style={{ height: 14, width: "88%", borderRadius: 4, background: "rgba(255,255,255,.03)" }} />
      <style>{`@keyframes shimmer{0%,100%{opacity:0.3}50%{opacity:0.6}}`}</style>
    </div>
  );

  if (error || !article) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, gap: 12 }}>
      <div style={{ fontSize: 13, opacity: 0.4 }}>{error || "Could not load article"}</div>
      <a href={url} target="_blank" rel="noopener noreferrer" style={{
        padding: "8px 16px", borderRadius: 8,
        background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)",
        color: "rgba(167,139,250,.9)", fontSize: 12, fontWeight: 600,
        textDecoration: "none",
      }}>
        Open in browser &rarr;
      </a>
    </div>
  );

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      height: "100%", overflow: "hidden",
    }}>
      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 14px",
        borderBottom: "1px solid rgba(255,255,255,.06)",
        flexShrink: 0,
        background: "rgba(255,255,255,.02)",
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".5">
          <rect x="3" y="3" width="18" height="18" rx="3" /><path d="M7 8h10M7 12h6M7 16h8" />
        </svg>
        <span style={{ flex: 1, fontSize: 11, fontWeight: 600, opacity: 0.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {article.siteName || new URL(url).hostname}
        </span>
        <a href={url} target="_blank" rel="noopener noreferrer" style={{
          padding: "3px 8px", borderRadius: 6,
          border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.04)",
          color: "rgba(167,139,250,.7)", fontSize: 10, fontWeight: 600,
          textDecoration: "none",
        }}>
          Source &rarr;
        </a>
        {onClose && (
          <button onClick={onClose} style={{
            padding: "3px 8px", borderRadius: 6,
            border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.04)",
            color: "rgba(148,163,184,.6)", fontSize: 11, cursor: "pointer",
            fontFamily: "inherit",
          }}>
            &times;
          </button>
        )}
      </div>

      {/* Scrollable article content */}
      <div style={{
        flex: 1, overflowY: "auto", padding: "20px 24px 40px",
        scrollbarWidth: "thin",
        scrollbarColor: "rgba(255,255,255,.08) transparent",
      }}>
        {/* Hero image */}
        {article.image && (
          <div style={{ marginBottom: 20, borderRadius: 12, overflow: "hidden", maxHeight: 300 }}>
            <img
              src={article.image}
              alt=""
              referrerPolicy="no-referrer"
              style={{ width: "100%", height: "auto", maxHeight: 300, objectFit: "cover", display: "block" }}
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>
        )}

        {/* Title */}
        <h1 style={{
          fontSize: 22, fontWeight: 900, lineHeight: 1.3,
          letterSpacing: "-0.3px", margin: "0 0 12px",
          color: "rgba(243,244,246,.95)",
        }}>
          {article.title}
        </h1>

        {/* Meta */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
          fontSize: 11, opacity: 0.45, marginBottom: 24,
          paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,.06)",
        }}>
          {article.siteName && <span style={{ fontWeight: 700 }}>{article.siteName}</span>}
          {article.author && <><span>&middot;</span><span>{article.author}</span></>}
          {article.publishedAt && <><span>&middot;</span><span>{timeAgo(article.publishedAt)}</span></>}
        </div>

        {/* Body */}
        <div style={{ fontSize: 14, lineHeight: 1.85, color: "rgba(229,231,235,.82)" }}>
          {article.body.split("\n\n").map((block, i) => {
            // Image block: ![alt](src)
            const imgMatch = block.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
            if (imgMatch) {
              return (
                <div key={i} style={{ margin: "20px 0", borderRadius: 10, overflow: "hidden" }}>
                  <img
                    src={imgMatch[2]}
                    alt={imgMatch[1]}
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    style={{ width: "100%", height: "auto", display: "block", maxHeight: 360, objectFit: "cover" }}
                    onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }}
                  />
                  {imgMatch[1] && (
                    <div style={{ fontSize: 11, opacity: 0.35, padding: "6px 0", fontStyle: "italic" }}>{imgMatch[1]}</div>
                  )}
                </div>
              );
            }
            // Header block: ## text
            if (block.startsWith("## ")) {
              return <h2 key={i} style={{ fontSize: 17, fontWeight: 800, margin: "28px 0 12px", color: "rgba(243,244,246,.9)" }}>{block.slice(3)}</h2>;
            }
            // Blockquote: > text
            if (block.startsWith("> ")) {
              return (
                <blockquote key={i} style={{
                  margin: "16px 0", padding: "12px 16px",
                  borderLeft: "3px solid rgba(167,139,250,.4)",
                  background: "rgba(167,139,250,.04)",
                  borderRadius: "0 8px 8px 0",
                  fontStyle: "italic", opacity: 0.8,
                }}>
                  {block.slice(2)}
                </blockquote>
              );
            }
            // Normal paragraph
            return <p key={i} style={{ margin: "0 0 16px" }}>{block}</p>;
          })}
        </div>

        {/* Footer */}
        <div style={{
          marginTop: 32, paddingTop: 16,
          borderTop: "1px solid rgba(255,255,255,.06)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: 10, opacity: 0.25 }}>
            Extracted from {article.siteName || new URL(url).hostname}
          </span>
          <a href={url} target="_blank" rel="noopener noreferrer" style={{
            padding: "6px 14px", borderRadius: 8,
            background: "rgba(167,139,250,.1)", border: "1px solid rgba(167,139,250,.2)",
            color: "rgba(167,139,250,.8)", fontSize: 11, fontWeight: 600,
            textDecoration: "none",
          }}>
            Read original &rarr;
          </a>
        </div>
      </div>
    </div>
  );
}
