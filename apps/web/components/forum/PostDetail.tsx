"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWeered } from "../WeeredProvider";
import { forumFetch, timeAgo, CATEGORY_CONFIG, FONT } from "./ForumHelpers";
import Markdown from "./Markdown";
import { avatarBg } from "../../lib/avatarColor";
import { useUserHover } from "../UserHoverCard";
import { useOverlay } from "../overlays/OverlayProvider";
import { weeredConfirm } from "../../lib/confirm";
import { weeredForumReport } from "../../lib/forumReport";
import AuthorBadge, { type Author } from "./AuthorBadge";
import CommentNode, { type CommentT, type NodeCtx } from "./CommentNode";
import { treeInsert, treeMap, treeRemove } from "../../lib/commentTree";
import MarkdownComposer from "./MarkdownComposer";
import LinkPreviewCard from "../LinkPreviewCard";
import { previewUrls } from "../../lib/forumLinks";

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
  author: Author;
  myVote: number;
};

export default function PostDetail({
  postId,
  embedded = false,
}: {
  postId: string;
  embedded?: boolean;
}) {
  // Inside a lobby the thread is the whole centre column, so it gets the column.
  // 780px is a reading measure for the standalone /forum/[postId] page, where
  // nothing else is on screen; in a lobby it just leaves two dead gutters either
  // side of the part people actually type in.
  const shell: React.CSSProperties = embedded
    ? { maxWidth: "none", margin: 0, padding: "0 0 24px" }
    : { maxWidth: 780, margin: "0 auto" };
  const router = useRouter();
  const w: any = useWeered();
  const me = w?.me;
  const { replaceTop } = useOverlay();

  const {
    openHover,
    scheduleClose: hoverClose,
    card: hoverCard,
  } = useUserHover({
    onViewProfile: (id) => replaceTop("profile", { userId: id }),
    onMessage: (id, name) => {
      try {
        window.dispatchEvent(
          new CustomEvent("weered:dock:open", { detail: { mode: "dm", peer: { id, name } } }),
        );
      } catch {}
    },
  });

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<CommentT[]>([]);
  const [isMod, setIsMod] = useState(false);
  const [loading, setLoading] = useState(true);
  const [commentBody, setCommentBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await forumFetch(`/forum/posts/${postId}`);
    if (data?.ok) {
      setPost(data.post);
      setComments(data.comments || []);
      setIsMod(data.isMod || false);
    }
    setLoading(false);
  }, [postId]);

  useEffect(() => {
    load();
  }, [load]);

  // A permalink to a comment is what lets someone carry a point out of the
  // thread and back into it. Runs once the tree is on screen, or there is
  // nothing to scroll to yet.
  useEffect(() => {
    if (loading) return;
    const hash = typeof window === "undefined" ? "" : window.location.hash;
    if (!hash.startsWith("#c-")) return;
    const id = hash.slice(3);
    const el = document.getElementById("c-" + id);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    setHighlightId(id);
    const t = window.setTimeout(() => setHighlightId(null), 2600);
    return () => window.clearTimeout(t);
  }, [loading, comments]);

  async function handlePostVote(value: number) {
    if (!post) return;
    const data = await forumFetch(`/forum/posts/${postId}/vote`, {
      method: "POST",
      body: JSON.stringify({ value }),
    });
    if (data?.ok) setPost((prev) => (prev ? { ...prev, score: data.score, myVote: value } : prev));
  }

  async function handleCommentVote(commentId: string, value: number) {
    const data = await forumFetch(`/forum/comments/${commentId}/vote`, {
      method: "POST",
      body: JSON.stringify({ value }),
    });
    if (data?.ok) {
      setComments((prev) =>
        treeMap(prev, commentId, (c) => ({ ...c, score: data.score, myVote: value })),
      );
    }
  }

  /** A reply to a specific comment. Returns whether it landed, so the node can
   *  keep the draft on screen when the API says no rather than eating it. */
  async function handleReply(parentId: string, body: string): Promise<boolean> {
    const data = await forumFetch(`/forum/posts/${postId}/comments`, {
      method: "POST",
      body: JSON.stringify({ body, parentId }),
    });
    if (!data?.ok) return false;
    setComments((prev) => treeInsert(prev, parentId, { ...data.comment, children: [] }));
    setPost((prev) => (prev ? { ...prev, commentCount: prev.commentCount + 1 } : prev));
    return true;
  }

  async function handleComment() {
    if (!commentBody.trim()) return;
    setSubmitting(true);
    const data = await forumFetch(`/forum/posts/${postId}/comments`, {
      method: "POST",
      body: JSON.stringify({ body: commentBody.trim() }),
    });
    if (data?.ok) {
      setComments((prev) => treeInsert(prev, null, { ...data.comment, children: [] }));
      setCommentBody("");
      setPost((prev) => (prev ? { ...prev, commentCount: prev.commentCount + 1 } : prev));
    }
    setSubmitting(false);
  }

  async function handlePin() {
    if (!post) return;
    await forumFetch(`/forum/posts/${postId}/pin`, {
      method: "POST",
      body: JSON.stringify({ pinned: !post.pinned }),
    });
    load();
  }
  async function handleLock() {
    if (!post) return;
    const path = post.locked ? `/forum/posts/${postId}/unlock` : `/forum/posts/${postId}/lock`;
    await forumFetch(path, { method: "POST", body: JSON.stringify({}) });
    load();
  }
  async function handleRemovePost() {
    const reason = window.prompt("Removal reason (visible in audit log):", "") || "";
    await forumFetch(`/forum/posts/${postId}/remove`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
    load();
  }
  async function handleRestorePost() {
    await forumFetch(`/forum/posts/${postId}/restore`, { method: "POST" });
    load();
  }
  async function handleReportPost() {
    await weeredForumReport({ postId });
  }
  async function handleReportComment(commentId: string) {
    await weeredForumReport({ commentId });
  }
  async function handleRemoveComment(commentId: string) {
    const reason = window.prompt("Removal reason:", "") || "";
    await forumFetch(`/forum/comments/${commentId}/remove`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
    load();
  }
  async function handleRestoreComment(commentId: string) {
    await forumFetch(`/forum/comments/${commentId}/restore`, { method: "POST" });
    load();
  }
  async function handleDeletePost() {
    const ok = await weeredConfirm({
      title: "Delete this post?",
      body: "Comments and votes go with it. Can't be undone.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    await forumFetch(`/forum/posts/${postId}`, { method: "DELETE" });
    router.push("/forum");
  }
  async function handleDeleteComment(commentId: string) {
    const ok = await weeredConfirm({
      title: "Delete this comment?",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    await forumFetch(`/forum/comments/${commentId}`, { method: "DELETE" });
    let gone = 1;
    setComments((prev) => {
      const r = treeRemove(prev, commentId);
      gone = r.removed || 1;
      return r.nodes;
    });
    setPost((prev) =>
      prev ? { ...prev, commentCount: Math.max(0, prev.commentCount - gone) } : prev,
    );
  }

  const nodeCtx: NodeCtx = {
    meId: me?.id || null,
    isMod,
    locked: !!post?.locked,
    canReply: !!me,
    highlightId,
    onVote: handleCommentVote,
    onReply: handleReply,
    onReport: handleReportComment,
    onRemove: handleRemoveComment,
    onRestore: handleRestoreComment,
    onDelete: handleDeleteComment,
    openHover,
    hoverClose,
  };

  if (loading)
    return (
      <div style={{ ...shell, padding: shell.padding ?? "20px 16px", fontFamily: FONT }}>
        {[90, 40, 100, 100, 80, 100].map((w, i) => (
          <div
            key={i}
            style={{
              height: i === 0 ? 24 : 14,
              width: `${w}%`,
              borderRadius: 4,
              background: "rgba(255,255,255,.04)",
              marginBottom: 10,
              animation: `shimmer 1.5s ease-in-out ${i * 0.1}s infinite`,
            }}
          />
        ))}
        <style>{`@keyframes shimmer{0%,100%{opacity:0.3}50%{opacity:0.6}}`}</style>
      </div>
    );

  if (!post)
    return (
      <div
        style={{
          ...shell,
          padding: embedded ? "24px 0" : "40px 16px",
          textAlign: "center",
          fontFamily: FONT,
        }}
      >
        <div style={{ fontSize: 14, opacity: 0.4 }}>Post not found</div>
        <button
          onClick={() => router.push("/forum")}
          style={{
            marginTop: 12,
            padding: "8px 16px",
            borderRadius: 8,
            background: "rgba(255,255,255,.06)",
            border: "1px solid rgba(255,255,255,.1)",
            color: "rgba(167,139,250,.8)",
            fontSize: 12,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Back to Forum
        </button>
      </div>
    );

  const cat = CATEGORY_CONFIG[post.category];

  return (
    <div
      style={{
        ...shell,
        padding: embedded ? "0 0 24px" : "20px 16px 60px",
        fontFamily: FONT,
        height: embedded ? undefined : "100%",
        overflow: embedded ? undefined : "auto",
      }}
    >
      {!embedded && (
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
      )}

      <div
        style={{
          display: "flex",
          gap: 12,
          padding: "16px 18px",
          borderRadius: 12,
          background: "rgba(255,255,255,.025)",
          border: `1px solid ${post.pinned ? "rgba(245,158,11,.2)" : "rgba(255,255,255,.06)"}`,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            flexShrink: 0,
            width: 40,
          }}
        >
          <button
            onClick={() => handlePostVote(post.myVote === 1 ? 0 : 1)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 4,
              color: post.myVote === 1 ? "#a78bfa" : "rgba(255,255,255,.25)",
              fontSize: 16,
            }}
          >
            &#9650;
          </button>
          <span
            style={{
              fontSize: 14,
              fontWeight: 900,
              color:
                post.score > 0 ? "#a78bfa" : post.score < 0 ? "#ef4444" : "rgba(255,255,255,.4)",
            }}
          >
            {post.score}
          </span>
          <button
            onClick={() => handlePostVote(post.myVote === -1 ? 0 : -1)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 4,
              color: post.myVote === -1 ? "#ef4444" : "rgba(255,255,255,.25)",
              fontSize: 16,
            }}
          >
            &#9660;
          </button>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexWrap: "wrap",
              marginBottom: 8,
            }}
          >
            {post.pinned && (
              <span style={{ fontSize: 9, color: "#f59e0b", fontWeight: 800 }}>
                &#128204; PINNED
              </span>
            )}
            {post.locked && (
              <span style={{ fontSize: 9, color: "#ef4444", fontWeight: 800 }}>
                &#128274; LOCKED
              </span>
            )}
            {cat && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 4,
                  background: cat.bg,
                  color: cat.color,
                  border: `1px solid ${cat.color}30`,
                }}
              >
                {cat.label}
              </span>
            )}
          </div>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 900,
              lineHeight: 1.3,
              margin: "0 0 10px",
              letterSpacing: "-0.2px",
            }}
          >
            {post.title}
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <AuthorBadge
              name={post.authorName}
              author={post.author}
              authorId={post.authorId}
              onHoverEnter={(e) =>
                openHover(post.authorId, post.authorName, e.currentTarget as HTMLElement)
              }
              onHoverLeave={() => hoverClose(160)}
            />
            <span style={{ fontSize: 10, opacity: 0.35 }}>&middot; {timeAgo(post.createdAt)}</span>
          </div>
          <Markdown
            text={post.body}
            style={{
              fontSize: 13.5,
              lineHeight: 1.75,
              color: "rgba(229,231,235,.78)",
              wordBreak: "break-word",
            }}
          />
          {previewUrls(post.body).map((u) => (
            <LinkPreviewCard key={u} url={u} />
          ))}

          {(isMod || post.authorId === me?.id || me) && (
            <div
              style={{
                display: "flex",
                gap: 6,
                marginTop: 16,
                paddingTop: 12,
                borderTop: "1px solid rgba(255,255,255,.06)",
                flexWrap: "wrap",
              }}
            >
              {isMod && (
                <>
                  <button onClick={handlePin} style={modBtn}>
                    {post.pinned ? "Unpin" : "Pin"}
                  </button>
                  <button onClick={handleLock} style={modBtn}>
                    {post.locked ? "Unlock" : "Lock"}
                  </button>
                  {(post as any).removedAt ? (
                    <button onClick={handleRestorePost} style={modBtn}>
                      Restore
                    </button>
                  ) : (
                    <button
                      onClick={handleRemovePost}
                      style={{
                        ...modBtn,
                        color: "rgba(239,68,68,.7)",
                        borderColor: "rgba(239,68,68,.2)",
                      }}
                    >
                      Remove
                    </button>
                  )}
                  <button
                    onClick={() => router.push(`/forum/mod-queue?postId=${postId}`)}
                    style={modBtn}
                  >
                    View reports
                  </button>
                </>
              )}
              {(isMod || post.authorId === me?.id) && (
                <button
                  onClick={handleDeletePost}
                  style={{
                    ...modBtn,
                    color: "rgba(239,68,68,.7)",
                    borderColor: "rgba(239,68,68,.2)",
                  }}
                >
                  Delete
                </button>
              )}
              {me && me.id !== post.authorId && (
                <button onClick={handleReportPost} style={{ ...modBtn, marginLeft: "auto" }}>
                  &#9873; Report
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          opacity: 0.4,
          letterSpacing: "1px",
          textTransform: "uppercase",
          marginBottom: 12,
        }}
      >
        {post.commentCount} Comment{post.commentCount !== 1 ? "s" : ""}
      </div>

      {me && !post.locked ? (
        <div
          style={{
            display: "flex",
            gap: 10,
            marginBottom: 20,
            padding: "12px 14px",
            borderRadius: 10,
            background: "rgba(255,255,255,.02)",
            border: "1px solid rgba(255,255,255,.06)",
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              flexShrink: 0,
              background: me?.avatar ? "transparent" : avatarBg(me?.name || ""),
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 900,
              color: "#fff",
            }}
          >
            {me?.avatar ? (
              <img
                src={me.avatar}
                alt={(me?.name || "User") + " avatar"}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              (me?.name || "?")[0]?.toUpperCase()
            )}
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <MarkdownComposer
              value={commentBody}
              onChange={setCommentBody}
              placeholder="Write a comment... drag or paste an image"
              maxLength={5000}
              rows={3}
              minimal
            />
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={handleComment}
                disabled={submitting || !commentBody.trim()}
                style={{
                  padding: "6px 14px",
                  borderRadius: 8,
                  border: "1px solid rgba(124,58,237,.35)",
                  background: "rgba(124,58,237,.25)",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  opacity: submitting || !commentBody.trim() ? 0.4 : 1,
                }}
              >
                {submitting ? "Posting..." : "Reply"}
              </button>
            </div>
          </div>
        </div>
      ) : post.locked ? (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 10,
            background: "rgba(239,68,68,.06)",
            border: "1px solid rgba(239,68,68,.15)",
            fontSize: 12,
            opacity: 0.5,
            marginBottom: 20,
          }}
        >
          This post is locked. No new comments can be added.
        </div>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {comments.map((c) => (
          <CommentNode key={c.id} c={c} ctx={nodeCtx} />
        ))}

        {comments.length === 0 && (
          <div style={{ textAlign: "center", padding: "28px 0", fontSize: 12 }}>
            <div style={{ fontWeight: 700, color: "rgba(243,244,246,.65)" }}>No replies yet.</div>
            <div style={{ marginTop: 2, color: "rgba(148,163,184,.5)" }}>
              Be the first voice on this thread.
            </div>
          </div>
        )}
      </div>
      {hoverCard}
    </div>
  );
}

const modBtn: React.CSSProperties = {
  padding: "4px 10px",
  borderRadius: 6,
  border: "1px solid rgba(255,255,255,.1)",
  background: "rgba(255,255,255,.04)",
  color: "rgba(255,255,255,.5)",
  fontSize: 10,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
};
