"use client";

import React, { useEffect, useRef, useState } from "react";
import EmptyState from "./EmptyState";
import LoadingState from "./LoadingState";

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

type View = "list" | "preview" | "both";

function fmtTime(utc: number) {
  if (!utc) return "";
  try {
    const diff = Math.floor(Date.now() / 1000) - utc;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  } catch {
    return "";
  }
}

function isExternalUrl(url?: string) {
  if (!url) return false;
  try {
    return !new URL(url).hostname.includes("reddit.com");
  } catch {
    return false;
  }
}

const listeners = new Set<(p: RedditPost | null) => void>();
const sortListeners = new Set<(s: string) => void>();
let sharedPosts: RedditPost[] = [];
let sharedSelected: RedditPost | null = null;
let sharedSort: "hot" | "new" | "top" | "rising" = "hot";
const sharedSub = "all";

function setSharedSelected(p: RedditPost | null) {
  sharedSelected = p;
  listeners.forEach((fn) => fn(p));
}

function setSharedSort(s: "hot" | "new" | "top" | "rising") {
  sharedSort = s;
  sortListeners.forEach((fn) => fn(s));
}

export default function SubredditBrowser({
  subreddit,
  view = "both",
}: {
  subreddit: string;
  view?: View;
}) {
  const sub = (subreddit || "").replace(/^r\//i, "");

  const [sort, setSort] = useState<"hot" | "new" | "top" | "rising">(sharedSort);
  const [posts, setPosts] = useState<RedditPost[]>(sharedPosts);
  const [selected, setSelected] = useState<RedditPost | null>(sharedSelected);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const loadedFor = useRef("");

  useEffect(() => {
    const fn = (p: RedditPost | null) => setSelected(p);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  useEffect(() => {
    const fn = (s: any) => setSort(s);
    sortListeners.add(fn);
    return () => {
      sortListeners.delete(fn);
    };
  }, []);

  async function loadFeed(s = sort) {
    const key = `${sub}:${s}`;
    if (loadedFor.current === key) return;
    loadedFor.current = key;
    setLoading(true);
    setErr("");
    try {
      const r = await fetch(`/api/reddit?sub=${encodeURIComponent(sub)}&sort=${s}&limit=25`, {
        cache: "no-store",
      });
      const j = await r.json();
      if (!j?.ok && j?.error) throw new Error(j.error);
      const mapped: RedditPost[] = (j?.data?.children || [])
        .map((c: any) => c?.data)
        .filter(Boolean);
      sharedPosts = mapped;
      setPosts(mapped);
      const first = mapped[0] || null;
      setSharedSelected(first);
    } catch (e: any) {
      setErr(String(e?.message || "Failed to load"));
      setPosts([]);
      setSharedSelected(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadedFor.current = "";
    loadFeed();
  }, [sub, sort]);

  function handleSort(s: "hot" | "new" | "top" | "rising") {
    setSharedSort(s);
    setSort(s);
    loadedFor.current = "";
    loadFeed(s);
  }

  if (view === "list")
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
        <div
          style={{
            padding: "10px 12px",
            borderBottom: "1px solid var(--weered-border)",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              marginBottom: 8,
            }}
          >
            <div>
              <div style={{ fontWeight: 1000, fontSize: 15 }}>r/{sub}</div>
              <div style={{ fontSize: 11, opacity: 0.6 }}>
                {loading ? "Loading…" : err ? `Error: ${err}` : `${posts.length} posts · ${sort}`}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {(["hot", "new", "top", "rising"] as const).map((s) => (
              <button
                key={s}
                onClick={() => handleSort(s)}
                style={{
                  padding: "5px 10px",
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  border: "1px solid var(--weered-border)",
                  background: s === sort ? "rgba(124,58,237,.20)" : "rgba(255,255,255,.04)",
                  color: s === sort ? "rgba(216,180,254,.95)" : "rgba(203,213,225,.80)",
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          {loading && <LoadingState compact label="Loading posts" />}
          {!loading && !posts.length && <EmptyState compact title="No posts." />}
          {posts.map((p) => {
            const active = selected?.id === p.id;
            const isExt = isExternalUrl(p.url);
            return (
              <button
                key={p.id}
                onClick={() => setSharedSelected(p)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 12px",
                  border: "none",
                  borderBottom: "1px solid rgba(255,255,255,.05)",
                  background: active ? "rgba(124,58,237,.14)" : "transparent",
                  cursor: "pointer",
                  color: "rgba(243,244,246,.98)",
                  borderLeft: active ? "3px solid rgba(124,58,237,.70)" : "3px solid transparent",
                }}
              >
                <div style={{ fontWeight: 850, lineHeight: 1.25, marginBottom: 4, fontSize: 13 }}>
                  {p.title}
                </div>
                <div
                  style={{
                    opacity: 0.6,
                    fontSize: 11,
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  {isExt && (
                    <span
                      style={{
                        background: "rgba(124,58,237,.18)",
                        borderRadius: 5,
                        padding: "1px 5px",
                        fontSize: 10,
                      }}
                    >
                      link
                    </span>
                  )}
                  <span>💬 {p.num_comments}</span>
                  <span>u/{p.author}</span>
                  <span>{fmtTime(p.created_utc)}</span>
                </div>
              </button>
            );
          })}
        </div>

        <div
          style={{
            padding: "6px 12px",
            borderTop: "1px solid var(--weered-border)",
            fontSize: 10,
            opacity: 0.4,
          }}
        >
          via RSS · no auth required
        </div>
      </div>
    );

  if (view === "preview")
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
        <div
          style={{
            padding: "10px 14px",
            borderBottom: "1px solid var(--weered-border)",
            flexShrink: 0,
            fontWeight: 800,
            fontSize: 13,
          }}
        >
          Post Preview
        </div>
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: 14 }}>
          {selected ? (
            <>
              <div style={{ fontWeight: 1000, fontSize: 16, lineHeight: 1.3, marginBottom: 8 }}>
                {selected.title}
              </div>
              <div
                style={{
                  opacity: 0.6,
                  fontSize: 11,
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  marginBottom: 14,
                }}
              >
                <span>u/{selected.author}</span>
                <span>{fmtTime(selected.created_utc)}</span>
                <span>💬 {selected.num_comments} comments</span>
                <span>r/{selected.subreddit}</span>
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
                    marginBottom: 14,
                    padding: "8px 14px",
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
                <div
                  style={{
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.5,
                    marginBottom: 14,
                    fontSize: 13,
                    opacity: 0.9,
                    background: "rgba(255,255,255,.03)",
                    border: "1px solid rgba(255,255,255,.06)",
                    borderRadius: 12,
                    padding: 12,
                  }}
                >
                  {selected.selftext.slice(0, 1200)}
                  {selected.selftext.length > 1200 ? "…" : ""}
                </div>
              )}

              <a
                href={`https://reddit.com${selected.permalink}`}
                target="_blank"
                rel="noreferrer"
                style={{ opacity: 0.5, fontSize: 11, display: "block" }}
              >
                View on Reddit →
              </a>
            </>
          ) : (
            <div style={{ opacity: 0.5, fontSize: 13 }}>Select a post from the feed.</div>
          )}
        </div>
      </div>
    );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 12, height: "100%" }}>
      <SubredditBrowser subreddit={subreddit} view="list" />
      <SubredditBrowser subreddit={subreddit} view="preview" />
    </div>
  );
}
