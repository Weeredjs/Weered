"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWeered } from "../WeeredProvider";
import { forumFetch, timeAgo, CATEGORY_CONFIG, TIER_COLORS, FONT } from "./ForumHelpers";
import { avatarBg } from "../../lib/avatarColor";

type Post = {
  id: string; title: string; body: string; category: string;
  authorId: string; authorName: string; pinned: boolean; locked: boolean;
  score: number; commentCount: number; createdAt: string;
  author: { name: string; avatar?: string; avatarColor?: string; tier?: string; globalRole?: string } | null;
  myVote: number;
};

const SORTS = [
  { id: "hot", label: "Hot" },
  { id: "new", label: "New" },
  { id: "top", label: "Top" },
];

const CATS = [
  { id: "", label: "All" },
  { id: "BUG_REPORT", label: "Bugs" },
  { id: "FEATURE_REQUEST", label: "Features" },
  { id: "DISCUSSION", label: "Discussion" },
  { id: "ANNOUNCEMENT", label: "News" },
];

export default function ForumPage() {
  const router = useRouter();
  const w: any = useWeered();
  const me = w?.me;

  const [posts, setPosts] = useState<Post[]>([]);
  const [sort, setSort] = useState("hot");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [postCat, setPostCat] = useState("DISCUSSION");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = `sort=${sort}${category ? `&category=${category}` : ""}&limit=25`;
    const data = await forumFetch(`/forum/posts?${params}`);
    if (data?.ok) setPosts(data.posts || []);
    setLoading(false);
  }, [sort, category]);

  useEffect(() => { load(); }, [load]);

  async function handleVote(postId: string, value: number) {
    const data = await forumFetch(`/forum/posts/${postId}/vote`, {
      method: "POST", body: JSON.stringify({ value }),
    });
    if (data?.ok) {
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, score: data.score, myVote: value } : p));
    }
  }

  async function handleSubmit() {
    if (!title.trim() || !body.trim()) return;
    setSubmitting(true);
    const data = await forumFetch("/forum/posts", {
      method: "POST", body: JSON.stringify({ title: title.trim(), body: body.trim(), category: postCat }),
    });
    if (data?.ok) {
      setComposing(false);
      setTitle(""); setBody(""); setPostCat("DISCUSSION");
      load();
    }
    setSubmitting(false);
  }

  return (
    <div style={{ maxWidth: 780, margin: "0 auto", padding: "20px 16px 60px", fontFamily: FONT }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0, letterSpacing: "-0.3px" }}>Forum</h1>
          <div style={{ fontSize: 11, opacity: 0.35, marginTop: 2 }}>Bug reports, feature requests, and community discussion</div>
        </div>
        {me && (
          <button onClick={() => setComposing(true)} style={{
            padding: "8px 16px", borderRadius: 8,
            background: "linear-gradient(135deg, rgba(124,58,237,.7), rgba(167,139,250,.5))",
            border: "1px solid rgba(124,58,237,.4)",
            color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
            fontFamily: "inherit",
          }}>
            + New Post
          </button>
        )}
      </div>

      {/* Sort + Category tabs */}
      <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 2, background: "rgba(255,255,255,.04)", borderRadius: 8, padding: 2 }}>
          {SORTS.map(s => (
            <button key={s.id} onClick={() => setSort(s.id)} style={{
              padding: "5px 12px", borderRadius: 6, border: "none",
              fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              background: sort === s.id ? "rgba(255,255,255,.08)" : "transparent",
              color: sort === s.id ? "rgba(255,255,255,.9)" : "rgba(255,255,255,.4)",
              transition: "all 0.15s",
            }}>{s.label}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {CATS.map(c => {
            const cfg = CATEGORY_CONFIG[c.id];
            const active = category === c.id;
            return (
              <button key={c.id} onClick={() => setCategory(c.id)} style={{
                padding: "4px 10px", borderRadius: 6, border: "none",
                fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                background: active ? (cfg?.bg || "rgba(255,255,255,.08)") : "transparent",
                color: active ? (cfg?.color || "rgba(255,255,255,.8)") : "rgba(255,255,255,.35)",
                transition: "all 0.15s",
              }}>{c.label}</button>
            );
          })}
        </div>
      </div>

      {/* Compose modal */}
      {composing && (
        <div style={{
          marginBottom: 16, padding: "16px 18px", borderRadius: 12,
          background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)",
        }}>
          <input
            value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Post title..."
            maxLength={200}
            style={{
              width: "100%", padding: "10px 12px", borderRadius: 8,
              border: "1px solid rgba(255,255,255,.1)", background: "rgba(0,0,0,.3)",
              color: "rgba(243,244,246,.92)", fontSize: 14, fontWeight: 700,
              outline: "none", boxSizing: "border-box", fontFamily: "inherit",
              marginBottom: 10,
            }}
          />
          <textarea
            value={body} onChange={e => setBody(e.target.value)}
            placeholder="Write your post... (supports markdown)"
            maxLength={10000}
            rows={6}
            style={{
              width: "100%", padding: "10px 12px", borderRadius: 8,
              border: "1px solid rgba(255,255,255,.1)", background: "rgba(0,0,0,.3)",
              color: "rgba(243,244,246,.92)", fontSize: 13, lineHeight: 1.6,
              outline: "none", boxSizing: "border-box", fontFamily: "inherit",
              resize: "vertical", marginBottom: 10,
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 4 }}>
              {Object.entries(CATEGORY_CONFIG).map(([id, cfg]) => (
                <button key={id} onClick={() => setPostCat(id)} style={{
                  padding: "4px 10px", borderRadius: 6, border: `1px solid ${postCat === id ? cfg.color + "55" : "rgba(255,255,255,.06)"}`,
                  background: postCat === id ? cfg.bg : "transparent",
                  color: postCat === id ? cfg.color : "rgba(255,255,255,.3)",
                  fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                }}>{cfg.label}</button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setComposing(false)} style={{
                padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,.1)",
                background: "rgba(255,255,255,.04)", color: "rgba(255,255,255,.5)",
                fontSize: 12, cursor: "pointer", fontFamily: "inherit",
              }}>Cancel</button>
              <button onClick={handleSubmit} disabled={submitting || !title.trim() || !body.trim()} style={{
                padding: "7px 18px", borderRadius: 8, border: "1px solid rgba(124,58,237,.4)",
                background: "rgba(124,58,237,.3)", color: "#fff",
                fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                opacity: submitting || !title.trim() || !body.trim() ? 0.4 : 1,
              }}>{submitting ? "Posting..." : "Post"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Posts list */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[1,2,3,4,5].map(i => (
            <div key={i} style={{ height: 72, borderRadius: 10, background: "rgba(255,255,255,.03)", animation: `shimmer 1.5s ease-in-out ${i * 0.1}s infinite` }} />
          ))}
          <style>{`@keyframes shimmer{0%,100%{opacity:0.3}50%{opacity:0.6}}`}</style>
        </div>
      ) : posts.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0", opacity: 0.3 }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>&#9998;</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>No posts yet</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Be the first to start a discussion</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {posts.map(post => {
            const cat = CATEGORY_CONFIG[post.category];
            const tierColor = TIER_COLORS[post.author?.tier || "INNOCENT"] || "#94a3b8";
            const aColor = post.author?.avatarColor || avatarBg(post.authorName);
            return (
              <div
                key={post.id}
                style={{
                  display: "flex", gap: 10, padding: "12px 14px",
                  borderRadius: 10, background: "rgba(255,255,255,.025)",
                  border: `1px solid ${post.pinned ? "rgba(245,158,11,.2)" : "rgba(255,255,255,.06)"}`,
                  cursor: "pointer", transition: "border-color 0.15s, background 0.15s",
                }}
                onClick={() => router.push(`/forum/${post.id}`)}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.05)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.025)"; }}
              >
                {/* Vote buttons */}
                <div style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                  flexShrink: 0, width: 36,
                }}
                  onClick={e => e.stopPropagation()}
                >
                  <button onClick={() => handleVote(post.id, post.myVote === 1 ? 0 : 1)} style={{
                    background: "none", border: "none", cursor: "pointer", padding: 2,
                    color: post.myVote === 1 ? "#a78bfa" : "rgba(255,255,255,.25)",
                    fontSize: 14, lineHeight: 1,
                  }}>&#9650;</button>
                  <span style={{
                    fontSize: 12, fontWeight: 800,
                    color: post.score > 0 ? "#a78bfa" : post.score < 0 ? "#ef4444" : "rgba(255,255,255,.4)",
                  }}>{post.score}</span>
                  <button onClick={() => handleVote(post.id, post.myVote === -1 ? 0 : -1)} style={{
                    background: "none", border: "none", cursor: "pointer", padding: 2,
                    color: post.myVote === -1 ? "#ef4444" : "rgba(255,255,255,.25)",
                    fontSize: 14, lineHeight: 1,
                  }}>&#9660;</button>
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                    {post.pinned && <span style={{ fontSize: 9, color: "#f59e0b", fontWeight: 800 }}>&#128204; PINNED</span>}
                    {post.locked && <span style={{ fontSize: 9, color: "#ef4444", fontWeight: 800 }}>&#128274; LOCKED</span>}
                    {cat && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
                        background: cat.bg, color: cat.color, border: `1px solid ${cat.color}30`,
                      }}>{cat.label}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.35, marginBottom: 6 }}>
                    {post.title}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, opacity: 0.45 }}>
                    {/* Author avatar */}
                    <div style={{
                      width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                      background: post.author?.avatar ? "transparent" : aColor,
                      overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 8, fontWeight: 900, color: "#fff",
                    }}>
                      {post.author?.avatar ? (
                        <img src={post.author.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : post.authorName[0]?.toUpperCase()}
                    </div>
                    <span style={{ fontWeight: 600 }}>{post.authorName}</span>
                    <span style={{ color: tierColor, fontWeight: 700, fontSize: 8 }}>{post.author?.tier}</span>
                    <span>&middot;</span>
                    <span>{timeAgo(post.createdAt)}</span>
                    <span>&middot;</span>
                    <span>{post.commentCount} comment{post.commentCount !== 1 ? "s" : ""}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
