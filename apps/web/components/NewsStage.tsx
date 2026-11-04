"use client";

// A game's news as a stage (James 2026-11-04: "have those still in a narrow
// list. Maybe 1/3 then a full article with image and video of actual game news
// from IGN or something that cycles"). Two thirds: one story at a time with its
// picture or trailer, cycling every few seconds, held while the pointer is on
// it or a video plays. One third: the headlines, either the module's own list
// (EVE's press round-up) or the stage's stories. Stories come from api
// lib/gameNews.ts: the game's own Steam announcements, plus press and IGN videos
// that name it. One column on a narrow screen.
import React, { useEffect, useMemo, useState } from "react";
import { useMotionOff } from "../lib/motion";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
const CYCLE_MS = 9000;
const CYCLE_MAX = 12;

export type StageStory = {
  title: string;
  url: string;
  date: string;
  source: string;
  snippet?: string;
  image?: string;
  video?: string;
  official?: boolean;
};

const when = (d: string) => {
  const t = Date.parse(d);
  return Number.isNaN(t)
    ? ""
    : new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export default function NewsStage({
  game,
  accent = "#8b5cf6",
  list,
  listTitle = "Headlines",
  extra,
  fallbackImage,
}: {
  /** The stage's stories: a key in api lib/gameNews.ts NEWS_GAMES. */
  game: string;
  accent?: string;
  /** The module's own headlines for the narrow column; absent = the stories. */
  list?: StageStory[];
  listTitle?: string;
  /** The module's own stories, shown first (Fortnite's in-game news). */
  extra?: StageStory[];
  /** A picture for a story that has none (the lobby's banner). */
  fallbackImage?: string;
}) {
  const [fetched, setStories] = useState<StageStory[] | null>(null);
  const stories = useMemo(
    () => (fetched === null && !extra?.length ? null : [...(extra || []), ...(fetched || [])]),
    [extra, fetched],
  );
  const [active, setActive] = useState(0);
  const [held, setHeld] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const still = useMotionOff();

  useEffect(() => {
    let live = true;
    fetch(`${API}/news/game/${encodeURIComponent(game)}`)
      .then((r) => r.json())
      .then((j) => live && setStories(j?.ok && Array.isArray(j.items) ? j.items : []))
      .catch(() => live && setStories([]));
    return () => {
      live = false;
    };
  }, [game]);

  const count = Math.min(stories?.length || 0, CYCLE_MAX);
  useEffect(() => {
    if (!count || held || playing || still) return;
    const t = setTimeout(() => setActive((a) => (a + 1) % count), CYCLE_MS);
    return () => clearTimeout(t);
  }, [count, active, held, playing, still]);

  const show = (i: number) => {
    setActive(i);
    setPlaying(null);
  };
  const headlines = list && list.length ? list : stories || [];
  const story = stories && stories.length ? stories[Math.min(active, stories.length - 1)] : null;
  const picture = story?.image || fallbackImage;

  return (
    <div className="weered-news-stage">
      <article
        className="weered-news-feature"
        onMouseEnter={() => setHeld(true)}
        onMouseLeave={() => setHeld(false)}
        onFocus={() => setHeld(true)}
        onBlur={() => setHeld(false)}
        style={{ borderColor: `${accent}33` }}
      >
        <div className="weered-news-media">
          {story && playing === story.video ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${story.video}?autoplay=1&rel=0`}
              title={story.title}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          ) : picture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={picture} alt="" loading="lazy" />
          ) : (
            <div
              className="weered-news-blank"
              style={{ background: `linear-gradient(135deg, ${accent}33, transparent)` }}
            />
          )}
          {story?.video && playing !== story.video && (
            <button
              type="button"
              className="weered-news-play"
              onClick={() => setPlaying(story.video!)}
              aria-label={`Play the video: ${story.title}`}
              // Inline, so the Corners setting leaves it round (98-nebula-structure.css).
              style={{ background: accent, borderRadius: "50%" }}
            >
              ▶
            </button>
          )}
          {count > 1 && !still && !playing && (
            <span
              key={`${active}-${held}`}
              className="weered-news-timer"
              style={{
                background: accent,
                animationDuration: `${CYCLE_MS}ms`,
                animationPlayState: held ? "paused" : "running",
              }}
            />
          )}
        </div>
        {story ? (
          <div className="weered-news-words">
            <div className="weered-news-meta">
              {story.official ? (
                <span
                  className="weered-news-badge"
                  style={{ background: `${accent}33`, color: accent }}
                >
                  Official
                </span>
              ) : (
                <span>{story.source}</span>
              )}
              <span>{when(story.date)}</span>
              {count > 1 && (
                <span className="weered-news-count">
                  {Math.min(active, count - 1) + 1} / {count}
                </span>
              )}
            </div>
            <h3>{story.title}</h3>
            {story.snippet && <p>{story.snippet}</p>}
            {story.url && (
              <a
                href={story.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: accent }}
              >
                Read the full story ↗
              </a>
            )}
          </div>
        ) : (
          <div className="weered-news-words">
            <p>{stories === null ? "Loading the news…" : "No news right now."}</p>
          </div>
        )}
      </article>

      <aside className="weered-news-list">
        <div className="weered-news-list-title">{listTitle}</div>
        {headlines.map((h, i) => {
          // A headline that is also a story features it; anything else opens.
          const at = !list?.length
            ? i
            : h.url && stories
              ? stories.findIndex((s) => s.url === h.url)
              : -1;
          const on = at >= 0 && at === active;
          const inner = (
            <>
              {h.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={h.image} alt="" loading="lazy" />
              )}
              <span className="weered-news-head">
                <span className="weered-news-head-title">{h.title}</span>
                <span className="weered-news-head-meta">
                  {[h.official ? "Official" : h.source, when(h.date)].filter(Boolean).join(" · ")}
                </span>
              </span>
            </>
          );
          return at >= 0 ? (
            <button
              key={h.url + i}
              type="button"
              className="weered-news-head-row"
              data-on={on || undefined}
              onClick={() => show(at)}
              style={on ? { borderLeftColor: accent } : undefined}
            >
              {inner}
            </button>
          ) : (
            <a
              key={h.url + i}
              className="weered-news-head-row"
              href={h.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {inner}
            </a>
          );
        })}
      </aside>
    </div>
  );
}
