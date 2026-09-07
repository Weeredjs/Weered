"use client";
// One comment and everything said in reply to it.
//
// The API has always returned the tree; this is the part that was missing. A
// node draws itself, then draws its children inside a clickable rail — the
// Reddit gesture, where the line down the left of a conversation collapses it.
import React from "react";
import Markdown from "./Markdown";
import AuthorBadge, { type Author } from "./AuthorBadge";
import { timeAgo } from "./ForumHelpers";
import { treeCount, MAX_DEPTH, INDENT_CAP } from "../../lib/commentTree";

export type CommentT = {
  id: string;
  postId: string;
  parentId: string | null;
  depth: number;
  authorId: string;
  authorName: string;
  body: string;
  score: number;
  createdAt: string;
  author: Author;
  myVote: number;
  removed?: boolean;
  removedAt?: string | null;
  children: CommentT[];
};

export type NodeCtx = {
  meId?: string | null;
  isMod: boolean;
  locked: boolean;
  canReply: boolean;
  highlightId: string | null;
  onVote: (id: string, value: number) => void;
  onReply: (parentId: string, body: string) => Promise<boolean>;
  onReport: (id: string) => void;
  onRemove: (id: string) => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
  openHover: (id: string, name: string, el: HTMLElement) => void;
  hoverClose: (ms: number) => void;
};

const ACCENT = "#a78bfa";
const META: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "rgba(148,163,184,.55)",
  fontSize: 10,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
  padding: 0,
};

export default function CommentNode({ c, ctx }: { c: CommentT; ctx: NodeCtx }) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [replying, setReplying] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const kids = c.children || [];
  const hidden = treeCount(kids);
  const removed = c.removed ?? !!c.removedAt;
  const mine = !!ctx.meId && c.authorId === ctx.meId;
  const highlighted = ctx.highlightId === c.id;
  // The API refuses a reply whose parent is already at the depth limit, so the
  // button goes away rather than failing after someone has written a paragraph.
  const repliable = ctx.canReply && !ctx.locked && c.depth < MAX_DEPTH - 1;

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    const ok = await ctx.onReply(c.id, body);
    setSending(false);
    if (ok) {
      setDraft("");
      setReplying(false);
      setCollapsed(false);
    }
  }

  function permalink() {
    const url = window.location.href.split("#")[0] + "#c-" + c.id;
    try {
      navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard is blocked in some embeds; the anchor still works */
    }
  }

  if (collapsed) {
    return (
      <div id={"c-" + c.id} style={{ padding: "6px 12px" }}>
        <button
          onClick={() => setCollapsed(false)}
          style={{
            ...META,
            display: "flex",
            alignItems: "center",
            gap: 8,
            width: "100%",
            textAlign: "left",
            fontSize: 11,
          }}
        >
          <span style={{ color: ACCENT, fontWeight: 900 }}>[+]</span>
          <span style={{ color: "rgba(229,231,235,.6)" }}>{c.authorName}</span>
          <span style={{ opacity: 0.45 }}>&middot; {c.score} points</span>
          {hidden > 0 && (
            <span style={{ opacity: 0.45 }}>
              &middot; {hidden} {hidden === 1 ? "reply" : "replies"}
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div id={"c-" + c.id}>
      <div
        style={{
          display: "flex",
          gap: 10,
          padding: "10px 12px",
          borderRadius: 10,
          background: highlighted ? "rgba(167,139,250,.09)" : "rgba(255,255,255,.02)",
          border: `1px solid ${highlighted ? "rgba(167,139,250,.35)" : "rgba(255,255,255,.04)"}`,
          transition: "background .4s, border-color .4s",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 1,
            flexShrink: 0,
            width: 28,
          }}
        >
          <button
            onClick={() => ctx.onVote(c.id, c.myVote === 1 ? 0 : 1)}
            aria-label="Upvote"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 2,
              color: c.myVote === 1 ? ACCENT : "rgba(255,255,255,.2)",
              fontSize: 11,
            }}
          >
            &#9650;
          </button>
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: c.score > 0 ? ACCENT : c.score < 0 ? "#ef4444" : "rgba(255,255,255,.3)",
            }}
          >
            {c.score}
          </span>
          <button
            onClick={() => ctx.onVote(c.id, c.myVote === -1 ? 0 : -1)}
            aria-label="Downvote"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 2,
              color: c.myVote === -1 ? "#ef4444" : "rgba(255,255,255,.2)",
              fontSize: 11,
            }}
          >
            &#9660;
          </button>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <button
              onClick={() => setCollapsed(true)}
              title="Collapse"
              style={{ ...META, color: "rgba(148,163,184,.4)", fontWeight: 900, fontSize: 11 }}
            >
              [&minus;]
            </button>
            <AuthorBadge
              name={c.authorName}
              author={c.author}
              size={18}
              authorId={c.authorId}
              onHoverEnter={(e) =>
                ctx.openHover(c.authorId, c.authorName, e.currentTarget as HTMLElement)
              }
              onHoverLeave={() => ctx.hoverClose(160)}
            />
            <span style={{ fontSize: 10, opacity: 0.3 }}>&middot; {timeAgo(c.createdAt)}</span>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
              {ctx.meId && ctx.meId !== c.authorId && (
                <button onClick={() => ctx.onReport(c.id)} title="Report" style={META}>
                  &#9873;
                </button>
              )}
              {ctx.isMod &&
                (removed ? (
                  <button
                    onClick={() => ctx.onRestore(c.id)}
                    style={{ ...META, color: "rgba(34,197,94,.6)" }}
                  >
                    restore
                  </button>
                ) : (
                  <button
                    onClick={() => ctx.onRemove(c.id)}
                    style={{ ...META, color: "rgba(239,68,68,.6)" }}
                  >
                    remove
                  </button>
                ))}
              {(ctx.isMod || mine) && (
                <button
                  onClick={() => ctx.onDelete(c.id)}
                  style={{ ...META, color: "rgba(239,68,68,.4)" }}
                >
                  delete
                </button>
              )}
            </div>
          </div>

          <Markdown
            text={removed && ctx.isMod ? `[removed] ${c.body}` : c.body}
            style={{
              fontSize: 13,
              lineHeight: 1.65,
              color: removed ? "rgba(239,68,68,.6)" : "rgba(229,231,235,.75)",
              wordBreak: "break-word",
              fontStyle: removed ? "italic" : "normal",
            }}
          />

          <div style={{ display: "flex", gap: 12, marginTop: 8, alignItems: "center" }}>
            {repliable && !replying && (
              <button onClick={() => setReplying(true)} style={{ ...META, color: ACCENT }}>
                Reply
              </button>
            )}
            <button onClick={permalink} style={META}>
              {copied ? "link copied" : "link"}
            </button>
            {ctx.canReply && !ctx.locked && c.depth >= MAX_DEPTH - 1 && (
              <span style={{ fontSize: 10, opacity: 0.35 }}>
                As deep as a thread goes &mdash; carry the point on above.
              </span>
            )}
          </div>

          {replying && (
            <div style={{ marginTop: 10 }}>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                autoFocus
                placeholder={"Reply to " + c.authorName + "..."}
                rows={3}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setReplying(false);
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
                }}
                style={{
                  width: "100%",
                  background: "rgba(0,0,0,.25)",
                  border: "1px solid rgba(255,255,255,.1)",
                  borderRadius: 8,
                  color: "rgba(229,231,235,.9)",
                  fontFamily: "inherit",
                  fontSize: 13,
                  lineHeight: 1.6,
                  padding: "8px 10px",
                  resize: "vertical",
                }}
              />
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
                <button
                  onClick={() => {
                    setReplying(false);
                    setDraft("");
                  }}
                  style={{ ...META, fontSize: 11 }}
                >
                  Cancel
                </button>
                <button
                  onClick={send}
                  disabled={!draft.trim() || sending}
                  style={{
                    background: draft.trim() ? "rgba(167,139,250,.18)" : "rgba(255,255,255,.05)",
                    border: "1px solid rgba(167,139,250,.3)",
                    borderRadius: 8,
                    color: draft.trim() ? ACCENT : "rgba(255,255,255,.25)",
                    fontFamily: "inherit",
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "5px 14px",
                    cursor: draft.trim() && !sending ? "pointer" : "default",
                  }}
                >
                  {sending ? "Posting..." : "Reply"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {kids.length > 0 && (
        <div style={{ display: "flex", marginTop: 6 }}>
          {/* The rail is the collapse gesture: click the line beside a
              conversation and the whole conversation folds away. */}
          <button
            onClick={() => setCollapsed(true)}
            title="Collapse thread"
            aria-label="Collapse thread"
            className="weered-thread-rail"
            style={{
              flexShrink: 0,
              width: c.depth < INDENT_CAP ? 22 : 10,
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
            }}
          >
            <span />
          </button>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {kids.map((k) => (
              <CommentNode key={k.id} c={k} ctx={ctx} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
