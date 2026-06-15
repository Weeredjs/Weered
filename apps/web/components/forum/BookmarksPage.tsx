"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWeered } from "../WeeredProvider";
import { forumFetch, timeAgo, CATEGORY_CONFIG, TIER_COLORS, FONT } from "./ForumHelpers";
import { avatarBg } from "../../lib/avatarColor";

type Post = {
  id: string;
  title: string;
  body: string;
  category: string;
  authorId: string;
  authorName: string;
  pinned: boolean;
  locked: boolean;
  score: number;
  commentCount: number;
  createdAt: string;
  author: {
    name: string;
    avatar?: string;
    avatarColor?: string;
    tier?: string;
    globalRole?: string;
  } | null;
  myVote: number;
  myBookmarked?: boolean;
  bookmarkedAt?: string;
};

export default function BookmarksPage() {
  const router = useRouter();
  const w: any = useWeered();
  const me = w?.me;
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!me) {
      router.push("/forum");
      return;
    }
    (async () => {
      setLoading(true);
      const data = await forumFetch("/forum/me/bookmarks?limit=50");
      if (data?.ok) setPosts(data.posts || []);
      setLoading(false);
    })();
  }, [me, router]);

  async function handleUnbookmark(postId: string) {
    const data = await forumFetch(`/forum/posts/${postId}/bookmark`, { method: "DELETE" });
    if (data?.ok) setPosts((prev) => prev.filter((p) => p.id !== postId));
  }

  return (
    <div
      style={{
        maxWidth: 780,
        margin: "0 auto",
        padding: "20px 16px 60px",
        fontFamily: FONT,
        height: "100%",
        overflow: "auto",
      }}
    >
      <button
        onClick={() => router.push("/forum")}
        style={{
          background: "none",
          border: "none",
          color: "rgba(167,139,250,.6)",
          fontSize: 12,
          cursor: "pointer",
          fontFamily: "inherit",
          padding: 0,
          marginBottom: 16,
        }}
      >
        &larr; Back to Forum
      </button>

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0, letterSpacing: "-0.3px" }}>
          Saved posts
        </h1>
        <div style={{ fontSize: 11, opacity: 0.4, marginTop: 2 }}>
          Threads you bookmarked. Yours alone.
        </div>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{ height: 72, borderRadius: 10, background: "rgba(255,255,255,.03)" }}
            />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div style={{ textAlign: "center", padding: "56px 20px" }}>
          <div style={{ fontSize: 26, marginBottom: 10, opacity: 0.35 }}>★</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(243,244,246,.75)" }}>
            Nothing saved yet.
          </div>
          <div style={{ fontSize: 12, marginTop: 4, color: "rgba(148,163,184,.55)" }}>
            Hit the star on any post to save it here.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {posts.map((post) => {
            const cat = CATEGORY_CONFIG[post.category];
            const tierColor = TIER_COLORS[post.author?.tier || "INNOCENT"] || "#94a3b8";
            const aColor = post.author?.avatarColor || avatarBg(post.authorName);
            return (
              <div
                key={post.id}
                style={{
                  display: "flex",
                  gap: 10,
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: "rgba(255,255,255,.025)",
                  border: "1px solid rgba(255,255,255,.06)",
                  cursor: "pointer",
                }}
                onClick={() => router.push(`/forum/${post.id}`)}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.05)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.025)";
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      flexWrap: "wrap",
                      marginBottom: 4,
                    }}
                  >
                    {cat && (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          padding: "1px 6px",
                          borderRadius: 4,
                          background: cat.bg,
                          color: cat.color,
                          border: `1px solid ${cat.color}30`,
                        }}
                      >
                        {cat.label}
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUnbookmark(post.id);
                      }}
                      title="Unsave"
                      style={{
                        marginLeft: "auto",
                        background: "none",
                        border: "none",
                        padding: 2,
                        color: "#fbbf24",
                        fontSize: 14,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        lineHeight: 1,
                      }}
                    >
                      ★
                    </button>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.35, marginBottom: 6 }}>
                    {post.title}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 10,
                      opacity: 0.45,
                    }}
                  >
                    <div
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        flexShrink: 0,
                        background: post.author?.avatar ? "transparent" : aColor,
                        overflow: "hidden",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 8,
                        fontWeight: 900,
                        color: "#fff",
                      }}
                    >
                      {post.author?.avatar ? (
                        <img
                          src={post.author.avatar}
                          alt={post.authorName + " avatar"}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        post.authorName[0]?.toUpperCase()
                      )}
                    </div>
                    <span style={{ fontWeight: 600 }}>{post.authorName}</span>
                    <span style={{ color: tierColor, fontWeight: 700, fontSize: 8 }}>
                      {post.author?.tier}
                    </span>
                    <span>&middot;</span>
                    <span>{timeAgo(post.createdAt)}</span>
                    <span>&middot;</span>
                    <span>
                      {post.commentCount} comment{post.commentCount !== 1 ? "s" : ""}
                    </span>
                    {post.bookmarkedAt && (
                      <>
                        <span>&middot;</span>
                        <span>saved {timeAgo(post.bookmarkedAt)}</span>
                      </>
                    )}
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
