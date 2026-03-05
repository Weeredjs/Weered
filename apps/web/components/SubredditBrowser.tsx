"use client";

import React, { useEffect, useMemo, useState } from "react";

type RedditPost = {
  id: string;
  title: string;
  author: string;
  score: number;
  num_comments: number;
  created_utc: number;
  permalink: string;
  selftext?: string;
  url?: string;
  subreddit: string;
};

function fmtTime(utc: number) {
  if (!utc) return "";
  try {
    const diff = Math.floor(Date.now() / 1000) - utc;
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  } catch { return ""; }
}

function isExternalUrl(url?: string, permalink?: string) {
  if (!url) return false;
  try {
    const u = new URL(url);
    return !u.hostname.includes("reddit.com");
  } catch { return false; }
}

export default function SubredditBrowser(props: { subreddit: string }) {
  const subreddit = (props.subreddit || "").replace(/^r\//i, "");
  const [sort, setSort] = useState<"hot" | "new" | "top" | "rising">("hot");
  const [loading, setLoading] = useState(false);
  const [posts, setPosts] = useState<RedditPost[]>([]);
  const [selected, setSelected] = useState<RedditPost | null>(null);
  const [err, setErr] = useState("");

  const header = useMemo(() => `r/${subreddit}`, [subreddit]);

  async function loadFeed() {
    if (!subreddit) return;
    setLoading(true);
    setErr("");
    try {
      const r = await fetch(
        `/api/reddit?sub=${encodeURIComponent(subreddit)}&sort=${sort}&limit=25`,
        { cache: "no-store" }
      );
      const j = await r.json();
      if (!j?.ok && j?.error) throw new Error(j.error);

      const children = j?.data?.children || [];
      const mapped: RedditPost[] = children
        .map((c: any) => c?.data)
        .filter(Boolean);

      setPosts(mapped);
      setSelected(mapped[0] || null);
    } catch (e: any) {
      setErr(String(e?.message || "Failed to load"));
      setPosts([]);
      setSelected(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadFeed(); /* eslint-disable-next-line */ }, [subreddit, sort]);

  const panel: React.CSSProperties = {
    border: "1px solid var(--weered-border)",
    borderRadius: 16,
    background: "var(--weered-panel)",
    padding: 12,
    minHeight: 520,
    overflow: "hidden",
  };

  return (
    <div style={panel}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 1000, fontSize: 16, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {header}
          </div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>
            {loading ? "Loading…" : err ? `Error: ${err}` : `${posts.length} posts • sort: ${sort}`}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {(["hot", "new", "top", "rising"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              style={{
                padding: "7px 10px",
                borderRadius: 12,
                border: "1px solid var(--weered-border2)",
                background: s === sort ? "rgba(124,58,237,.18)" : "rgba(255,255,255,.04)",
                fontWeight: 950,
                cursor: "pointer",
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Two-pane layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1.05fr 1.3fr", gap: 12, height: 470 }}>

        {/* Feed list */}
        <div style={{ border: "1px solid var(--weered-border2)", borderRadius: 14, overflow: "auto", background: "var(--weered-panel2)" }}>
          {posts.map((p) => {
            const active = selected?.id === p.id;
            const isExt  = isExternalUrl(p.url, p.permalink);
            return (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 10px",
                  border: "none",
                  borderBottom: "1px solid rgba(255,255,255,.06)",
                  background: active ? "rgba(124,58,237,.14)" : "transparent",
                  cursor: "pointer",
                  color: "rgba(243,244,246,.98)",
                }}
              >
                <div style={{ fontWeight: 950, marginBottom: 4, lineHeight: 1.2 }}>
                  {p.title}
                </div>
                <div style={{ opacity: 0.65, fontSize: 11, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  {isExt && <span style={{ background: "rgba(124,58,237,.18)", borderRadius: 6, padding: "1px 6px", fontSize: 10 }}>link</span>}
                  <span>💬 {p.num_comments}</span>
                  <span>u/{p.author}</span>
                  <span>{fmtTime(p.created_utc)}</span>
                </div>
              </button>
            );
          })}
          {!posts.length && !loading && (
            <div style={{ padding: 12, opacity: 0.7 }}>No posts.</div>
          )}
          {loading && (
            <div style={{ padding: 12, opacity: 0.7 }}>Loading…</div>
          )}
        </div>

        {/* Post preview */}
        <div style={{ border: "1px solid var(--weered-border2)", borderRadius: 14, overflow: "auto", background: "var(--weered-panel2)", padding: 12 }}>
          {selected ? (
            <>
              <div style={{ fontWeight: 1000, fontSize: 15, marginBottom: 6, lineHeight: 1.25 }}>
                {selected.title}
              </div>

              <div style={{ opacity: 0.65, fontSize: 11, display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                <span>u/{selected.author}</span>
                <span>{fmtTime(selected.created_utc)}</span>
                <span>💬 {selected.num_comments} comments</span>
              </div>

              {isExternalUrl(selected.url) && (
                <a
                  href={selected.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 12,
                    padding: "8px 12px",
                    borderRadius: 12,
                    border: "1px solid rgba(124,58,237,.30)",
                    background: "rgba(124,58,237,.12)",
                    fontWeight: 900,
                    fontSize: 13,
                    color: "rgba(216,180,254,.95)",
                  }}
                >
                  Open link →
                </a>
              )}

              {selected.selftext && (
                <div style={{
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.45,
                  marginBottom: 12,
                  opacity: 0.90,
                  fontSize: 13,
                  background: "rgba(255,255,255,.03)",
                  border: "1px solid rgba(255,255,255,.06)",
                  borderRadius: 12,
                  padding: 10,
                }}>
                  {selected.selftext}
                </div>
              )}

              <a
                href={`https://reddit.com${selected.permalink}`}
                target="_blank"
                rel="noreferrer"
                style={{ opacity: 0.55, fontSize: 11, display: "block", marginTop: 8 }}
              >
                View on Reddit →
              </a>
            </>
          ) : (
            <div style={{ opacity: 0.7 }}>Select a post.</div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 10, opacity: 0.55, fontSize: 11 }}>
        via RSS • no auth required • comments on reddit.com
      </div>
    </div>
  );
}
