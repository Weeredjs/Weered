"use client";

// The front page's film (cut 3, James 2026-11-04: "Good for the site. Throw it
// up."): a minute of Weered, muted and looping under the buttons, with a Sound
// on button. The files are served from disk by Caddy at /media/film/ (outside
// git and outside Next), so a re-cut is a copy up under a new name, not a
// deploy of the files; the names below then move to the new cut.
import React, { useEffect, useRef, useState } from "react";

export const FILM = {
  hd: "/media/film/weered-cut3-1080.mp4",
  sd: "/media/film/weered-cut3-720.mp4",
  poster: "/media/film/weered-cut3-poster.jpg",
};

/** Which file, and whether it may start by itself: phones and data savers get
 *  the 720p file; reduced motion and data savers get a still and a play button. */
export function pickFilm(o: { small: boolean; saveData: boolean; calm: boolean }) {
  return { src: o.small || o.saveData ? FILM.sd : FILM.hd, still: o.calm || o.saveData };
}

export default function LandingFilm() {
  const ref = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [still, setStill] = useState(false);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    // Signed-in visitors are on their way to /home: don't pull a film for them.
    if (document.documentElement.hasAttribute("data-weered-authed")) return;
    const saveData = (navigator as any).connection?.saveData === true;
    const mq = (q: string) => !!window.matchMedia?.(q).matches;
    const f = pickFilm({
      small: mq("(max-width: 900px)"),
      saveData,
      calm: mq("(prefers-reduced-motion: reduce)"),
    });
    setSrc(f.src);
    setStill(f.still);
  }, []);

  // It plays only while it's on screen.
  useEffect(() => {
    const v = ref.current;
    if (!v || !src || still || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) v.play().catch(() => {});
        else v.pause();
      },
      { threshold: 0.25 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [src, still]);

  const withSound = () => {
    const v = ref.current;
    if (!v) return;
    v.currentTime = 0;
    v.muted = false;
    setMuted(false);
    setStill(false);
    v.play().catch(() => {});
  };
  const mute = () => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    setMuted(true);
  };

  return (
    <div className="lp-film">
      <video
        ref={ref}
        src={src ?? undefined}
        poster={src ? FILM.poster : undefined}
        muted={muted}
        loop
        playsInline
        preload={still ? "none" : "auto"}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        aria-label="A minute of Weered: a lobby built from one sentence, rooms, a place of your own, a crew and the lobbies to explore"
      />
      {src &&
        (still && !playing ? (
          <button type="button" className="lp-film-play" onClick={withSound}>
            ▶ Watch · 1 min
          </button>
        ) : (
          <button
            type="button"
            className="lp-film-sound"
            onClick={muted ? withSound : mute}
            aria-pressed={!muted}
          >
            {muted ? "🔊 Sound on" : "🔇 Mute"}
          </button>
        ))}
    </div>
  );
}
