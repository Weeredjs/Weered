"use client";

import { useCallback, useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

type RedditPost = {
  id: string;
  title: string;
  url: string;
  author: string;
  updatedAt: string;
  flair: string;
  thumbnail?: string | null;
  excerpt?: string;
  hasVideo?: boolean;
};

function ago(iso: string): string {
  const t = new Date(iso).getTime();
  if (isNaN(t)) return "";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}

function Thumb({ src }: { src: string }) {
  const [ok, setOk] = useState(true);
  if (!ok) return null;
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setOk(false)}
      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
    />
  );
}

export default function RedditFeedTab({
  sub,
  accent = "#e84393",
}: {
  sub: string;
  accent?: string;
}) {
  const [posts, setPosts] = useState<RedditPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<"hot" | "new" | "top" | "rising">("hot");
  const [err, setErr] = useState(false);
  const [subName, setSubName] = useState(sub);

  const load = useCallback(() => {
    setLoading(true);
    setErr(false);
    fetch(`${API}/reddit/${encodeURIComponent(sub)}?sort=${sort}`)
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok) {
          setPosts(j.posts || []);
          setSubName(j.sub || sub);
        } else setErr(true);
      })
      .catch(() => setErr(true))
      .finally(() => setLoading(false));
  }, [sub, sort]);

  useEffect(() => {
    load();
    const i = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(i);
  }, [load]);

  const SORTS: (typeof sort)[] = ["hot", "new", "top", "rising"];

  return (
    <div
      style={{
        padding: "14px 16px",
        color: "rgba(243,244,246,.92)",
        fontFamily: "var(--font-rajdhani), system-ui, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "var(--font-barlow), 'Barlow Condensed', sans-serif",
              fontWeight: 800,
              fontSize: 18,
              letterSpacing: "0.5px",
              textTransform: "uppercase",
            }}
          >
            r/{subName}
          </div>
          <div style={{ fontSize: 11, color: "rgba(148,163,184,.7)" }}>
            Live from Reddit. Tap a post to open the thread.
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {SORTS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSort(s)}
              style={{
                padding: "5px 11px",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
                textTransform: "capitalize",
                border: `1px solid ${sort === s ? accent : "rgba(255,255,255,.12)"}`,
                background: sort === s ? `${accent}22` : "transparent",
                color: sort === s ? "#f9a8d4" : "rgba(148,163,184,.85)",
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading && posts.length === 0 ? (
        <div
          style={{
            fontSize: 13,
            color: "rgba(148,163,184,.6)",
            padding: "24px 0",
            textAlign: "center",
          }}
        >
          Loading r/{subName}…
        </div>
      ) : err ? (
        <div
          style={{
            fontSize: 13,
            color: "rgba(148,163,184,.6)",
            padding: "24px 0",
            textAlign: "center",
            fontStyle: "italic",
          }}
        >
          Couldn't reach Reddit right now.{" "}
          <button
            type="button"
            onClick={load}
            style={{
              background: "transparent",
              border: "none",
              color: "#f9a8d4",
              cursor: "pointer",
              textDecoration: "underline",
              fontFamily: "inherit",
              fontSize: 13,
            }}
          >
            Retry
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {posts.map((p) => (
            <a
              key={p.id}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex",
                alignItems: "stretch",
                gap: 12,
                padding: "10px 12px",
                background: "rgba(255,255,255,.02)",
                border: "1px solid rgba(255,255,255,.07)",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              {(p.thumbnail || p.hasVideo) && (
                <div
                  style={{
                    position: "relative",
                    width: 84,
                    height: 64,
                    flexShrink: 0,
                    background: "rgba(0,0,0,.3)",
                    border: "1px solid rgba(255,255,255,.06)",
                    overflow: "hidden",
                  }}
                >
                  {p.thumbnail && <Thumb src={p.thumbnail} />}
                  {p.hasVideo && (
                    <span
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: p.thumbnail ? "rgba(0,0,0,.35)" : "transparent",
                        color: "#fff",
                        fontSize: 18,
                      }}
                    >
                      ▶
                    </span>
                  )}
                </div>
              )}
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "rgba(243,244,246,.96)",
                    lineHeight: 1.35,
                  }}
                >
                  {p.title}
                </div>
                {p.excerpt && p.excerpt.length > 2 && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "rgba(203,213,225,.7)",
                      lineHeight: 1.4,
                      marginTop: 3,
                      overflow: "hidden",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical" as any,
                    }}
                  >
                    {p.excerpt}
                  </div>
                )}
                <div
                  style={{
                    fontSize: 10,
                    color: "rgba(148,163,184,.6)",
                    fontFamily: "ui-monospace, monospace",
                    letterSpacing: "0.3px",
                    marginTop: 5,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  {p.flair && (
                    <span
                      style={{
                        color: "#f9a8d4",
                        border: `1px solid ${accent}44`,
                        padding: "0 5px",
                        fontSize: 9,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      {p.flair}
                    </span>
                  )}
                  {p.hasVideo && <span style={{ color: "#f9a8d4" }}>▶ Video</span>}
                  {p.author && <span>u/{p.author}</span>}
                  {p.updatedAt && <span>· {ago(p.updatedAt)} ago</span>}
                </div>
              </div>
              <span
                style={{ fontSize: 11, color: "rgba(148,163,184,.4)", flexShrink: 0, marginTop: 2 }}
              >
                ↗
              </span>
            </a>
          ))}
          <div style={{ textAlign: "center", marginTop: 8 }}>
            <a
              href={`https://www.reddit.com/r/${subName}/`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 11,
                color: "rgba(148,163,184,.6)",
                textDecoration: "none",
                letterSpacing: "0.5px",
              }}
            >
              Open r/{subName} on Reddit ↗
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
