"use client";

import React from "react";

// The forum list's cards (James 2026-11-08: the forum with expanded
// "Thumbnail and previews", as Reddit's card view). Cards: a post's opening
// words under its title, then its first picture, large. Compact: the row as it
// was, the picture small beside it. The API picks both (api
// lib/forumPreview.ts), and only ever a picture Weered keeps.

export type ForumView = "cards" | "compact";
const VIEW_KEY = "weered:forum-view";

/** Cards unless this device chose Compact. */
export function useForumView(): [ForumView, (v: ForumView) => void] {
  const [view, setView] = React.useState<ForumView>("cards");
  React.useEffect(() => {
    try {
      if (localStorage.getItem(VIEW_KEY) === "compact") setView("compact");
    } catch {}
  }, []);
  const choose = React.useCallback((v: ForumView) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {}
  }, []);
  return [view, choose];
}

const ICONS: Record<ForumView, React.ReactNode> = {
  cards: (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <rect
        x="1.5"
        y="1.5"
        width="11"
        height="7.5"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path d="M1.5 11.5h11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  compact: (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <path
        d="M1.5 3h11M1.5 7h11M1.5 11h11"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  ),
};

/** Cards or Compact, beside the sorts. */
export function ForumViewToggle({
  view,
  onChange,
}: {
  view: ForumView;
  onChange: (v: ForumView) => void;
}) {
  return (
    <div
      role="group"
      aria-label="How posts show"
      style={{
        display: "flex",
        gap: 2,
        background: "rgba(255,255,255,.04)",
        borderRadius: 999,
        padding: 3,
      }}
    >
      {(["cards", "compact"] as ForumView[]).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={view === v}
          title={v === "cards" ? "Cards: previews and pictures" : "Compact: titles"}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 30,
            height: 24,
            borderRadius: 999,
            cursor: "pointer",
            border:
              view === v ? "1px solid var(--weered-accent-1, #7c3aed)" : "1px solid transparent",
            background:
              view === v ? "var(--weered-accent-bg, rgba(124,58,237,.14))" : "transparent",
            color:
              view === v ? "var(--weered-text, rgba(243,244,246,.92))" : "rgba(255,255,255,.45)",
          }}
        >
          {ICONS[v]}
        </button>
      ))}
    </div>
  );
}

// The server only sends a forum upload or a /brand/ path; this keeps url("")
// safe even if it ever sent something else.
const safeForCss = (src: string) => /^[\w\-/.:]+$/.test(src);

/** Under a post's title, in Cards: its opening words, then its picture. */
export function PostCardPreview({ preview, image }: { preview?: string; image?: string | null }) {
  if (!preview && !image) return null;
  return (
    <>
      {preview && (
        <div
          className="weered-forum-excerpt"
          style={{
            fontSize: 13,
            fontWeight: 400,
            lineHeight: 1.55,
            color: "rgba(229,231,235,.62)",
            marginBottom: image ? 10 : 8,
            display: "-webkit-box",
            WebkitLineClamp: image ? 2 : 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {preview}
        </div>
      )}
      {image && (
        <div
          className="weered-forum-media"
          style={{
            position: "relative",
            display: "flex",
            justifyContent: "center",
            margin: "0 0 10px",
            borderRadius: 10,
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,.07)",
            background: "rgba(0,0,0,.35)",
          }}
        >
          {/* The picture blurred behind itself, where it doesn't fill the width. */}
          {safeForCss(image) && (
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: -24,
                backgroundImage: `url("${image}")`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                filter: "blur(22px) brightness(.4)",
              }}
            />
          )}
          <img
            src={image}
            alt=""
            loading="lazy"
            decoding="async"
            style={{
              position: "relative",
              display: "block",
              maxWidth: "100%",
              maxHeight: 460,
              objectFit: "contain",
            }}
          />
        </div>
      )}
    </>
  );
}

/** Beside a post, in Compact: its picture, small. */
export function PostThumb({ image }: { image?: string | null }) {
  if (!image) return null;
  return (
    <img
      className="weered-forum-thumb"
      src={image}
      alt=""
      loading="lazy"
      decoding="async"
      style={{
        width: 88,
        height: 60,
        flexShrink: 0,
        alignSelf: "center",
        objectFit: "cover",
        borderRadius: 8,
        border: "1px solid rgba(255,255,255,.08)",
        background: "rgba(0,0,0,.3)",
      }}
    />
  );
}
