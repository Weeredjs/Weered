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
  try {
    const d = new Date(utc * 1000);
    return d.toLocaleString();
  } catch {
    return "";
  }
}

export default function SubredditBrowser(props: { subreddit: string }) {
  const subreddit = (props.subreddit || "").replace(/^r\//i, "");
  const [sort, setSort] = useState<"hot" | "new" | "top" | "rising">("hot");
  const [loading, setLoading] = useState(false);
  const [posts, setPosts] = useState<RedditPost[]>([]);
  const [selected, setSelected] = useState<RedditPost | null>(null);
  const [comments, setComments] = useState<string[]>([]);
  const [err, setErr] = useState<string>("");

  const header = useMemo(() => `r/${subreddit}`, [subreddit]);

  async function loadFeed() {
    if (!subreddit) return;
    setLoading(true);
    setErr("");
    try {
      const r = await fetch(`/api/reddit?sub=${encodeURIComponent(subreddit)}&sort=${sort}&limit=30`, { cache: "no-store" });
      const j = await r.json();

      const children = j?.data?.children || [];
      const mapped: RedditPost[] = children
        .map((c: any) => c?.data)
        .filter(Boolean)
        .map((d: any) => ({
          id: d.id,
          title: d.title,
          author: d.author,
          score: d.score,
          num_comments: d.num_comments,
          created_utc: d.created_utc,
          permalink: d.permalink,
          selftext: d.selftext,
          url: d.url,
          subreddit: d.subreddit,
        }));

      setPosts(mapped);
      setSelected(mapped[0] || null);
    } catch (e: any) {
      setErr(String(e?.message || e || "Failed to load"));
      setPosts([]);
      setSelected(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadComments(permalink: string) {
    setComments([]);
    try {
      const r = await fetch(`/api/reddit/post?permalink=${encodeURIComponent(permalink)}`, { cache: "no-store" });
      const j = await r.json();
      const listing = Array.isArray(j) ? j[1] : null;
      const kids = listing?.data?.children || [];
      const top = kids
        .map((x: any) => x?.data?.body)
        .filter((b: any) => typeof b === "string" && b.trim())
        .slice(0, 12);
      setComments(top);
    } catch {
      setComments([]);
    }
  }

  useEffect(() => { loadFeed(); /* eslint-disable-next-line */ }, [subreddit, sort]);

  useEffect(() => {
    if (selected?.permalink) loadComments(selected.permalink);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.permalink]);

  const panel: React.CSSProperties = {
    border: "1px solid rgba(148,163,184,.18)",
    borderRadius: 16,
    background: "rgba(15,23,42,.92)",
    padding: 12,
    minHeight: 520,
    overflow: "hidden",
  };

  return (
    <div style={panel}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 1000, fontSize: 16, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {header}
          </div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>
            {loading ? "Loading…" : (err ? `Error: ${err}` : `${posts.length} posts • sort: ${sort}`)}
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
                border: "1px solid rgba(148,163,184,.24)",
                background: s === sort ? "rgba(124,58,237,.18)" : "rgba(255,255,255,.06)",
                fontWeight: 950,
                cursor: "pointer",
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.05fr 1.3fr", gap: 12, height: 470 }}>
        {/* Feed list */}
        <div style={{ border: "1px solid rgba(148,163,184,.14)", borderRadius: 14, overflow: "auto", background: "rgba(255,255,255,.03)" }}>
          {posts.map((p) => {
            const active = selected?.id === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 10px",
                  border: "none",
                  borderBottom: "1px solid rgba(148,163,184,.08)",
                  background: active ? "rgba(124,58,237,.14)" : "transparent",
                  cursor: "pointer",
                  color: "rgba(243,244,246,.98)",
                }}
              >
                <div style={{ fontWeight: 950, marginBottom: 6, lineHeight: 1.2 }}>
                  {p.title}
                </div>
                <div style={{ opacity: 0.72, fontSize: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <span>▲ {p.score}</span>
                  <span>💬 {p.num_comments}</span>
                  <span>u/{p.author}</span>
                </div>
              </button>
            );
          })}
          {!posts.length && !loading ? <div style={{ padding: 12, opacity: 0.7 }}>No posts.</div> : null}
        </div>

        {/* Post preview */}
        <div style={{ border: "1px solid rgba(148,163,184,.14)", borderRadius: 14, overflow: "auto", background: "rgba(255,255,255,.03)", padding: 12 }}>
          {selected ? (
            <>
              <div style={{ fontWeight: 1000, fontSize: 16, marginBottom: 6 }}>{selected.title}</div>
              <div style={{ opacity: 0.72, fontSize: 12, display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                <span>u/{selected.author}</span>
                <span>{fmtTime(selected.created_utc)}</span>
                <span>▲ {selected.score}</span>
                <span>💬 {selected.num_comments}</span>
              </div>

              {selected.selftext ? (
                <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.35, marginBottom: 12, opacity: 0.95 }}>
                  {selected.selftext}
                </div>
              ) : null}

              {selected.url && !selected.url.includes("reddit.com") ? (
                <a
                  href={selected.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: "inline-block", marginBottom: 12, fontWeight: 900 }}
                >
                  Open link ↗
                </a>
              ) : null}

              <div style={{ marginTop: 8, fontWeight: 950, opacity: 0.9 }}>Top comments</div>
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 10 }}>
                {comments.map((c, i) => (
                  <div key={i} style={{ border: "1px solid rgba(148,163,184,.12)", borderRadius: 12, padding: 10, background: "rgba(0,0,0,.10)" }}>
                    <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.35, opacity: 0.95 }}>{c}</div>
                  </div>
                ))}
                {!comments.length ? <div style={{ opacity: 0.65 }}>No comments loaded.</div> : null}
              </div>
            </>
          ) : (
            <div style={{ opacity: 0.7 }}>Select a post.</div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 10, opacity: 0.7, fontSize: 12 }}>
        v1 proxy viewer • no iframe • next: caching + auth + vote/comment actions (later)
      </div>
    </div>
  );
}