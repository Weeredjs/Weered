"use client";

import { useEffect, useRef } from "react";

const FAVICON_DEFAULT = "/brand/logo/weered-logo-32.png";
const FAVICON_DOT = "/brand/logo/weered-logo-32-dot.png";
const STORAGE_MUTE = "weered_sound_muted";

let lastChimeAt = 0;
const CHIME_DEBOUNCE_MS = 1500;

function findFaviconLink(): HTMLLinkElement | null {
  if (typeof document === "undefined") return null;
  return (
    (document.querySelector('link[rel~="icon"]') as HTMLLinkElement) ||
    (document.querySelector('link[rel="shortcut icon"]') as HTMLLinkElement) ||
    null
  );
}

function setFavicon(url: string) {
  let link = findFaviconLink();
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  if (link.href !== new URL(url, window.location.origin).href) {
    link.href = url;
  }
}

function setTitle(count: number, baseTitle: string) {
  if (typeof document === "undefined") return;
  const stripped = baseTitle.replace(/^\(\d+\)\s+/, "");
  document.title = count > 0 ? `(${count}) ${stripped}` : stripped;
}

function playChime() {
  try {
    if (typeof window === "undefined") return;
    const muted = localStorage.getItem(STORAGE_MUTE) === "1";
    if (muted) return;
    const now = Date.now();
    if (now - lastChimeAt < CHIME_DEBOUNCE_MS) return;
    lastChimeAt = now;

    const AudioCtx: typeof AudioContext =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.12);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.2);
    o.onended = () => ctx.close().catch(() => {});
  } catch {}
}

export function useUnreadIndicator() {
  const countRef = useRef(0);
  const baseTitleRef = useRef<string>("");

  useEffect(() => {
    if (typeof document === "undefined") return;
    baseTitleRef.current = document.title.replace(/^\(\d+\)\s+/, "");
    console.log("[unread] hook mounted; base title:", baseTitleRef.current);

    function bump() {
      console.log(
        "[unread] bump() called; current count:",
        countRef.current,
        "focused:",
        document.hasFocus(),
      );
      playChime();
      const focused =
        typeof document !== "undefined" &&
        document.visibilityState === "visible" &&
        document.hasFocus();
      if (focused) return;
      countRef.current += 1;
      setTitle(countRef.current, baseTitleRef.current);
      setFavicon(FAVICON_DOT);
    }

    function clear() {
      if (countRef.current === 0) return;
      countRef.current = 0;
      setTitle(0, baseTitleRef.current);
      setFavicon(FAVICON_DEFAULT);
    }

    function onVisibility() {
      if (document.visibilityState === "visible") clear();
    }

    function onFocus() {
      clear();
    }

    function onTick(_e: Event) {
      console.log("[unread] received weered:unread-tick");
      bump();
    }

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("weered:unread-tick", onTick as EventListener);

    function onSwMessage(e: MessageEvent) {
      if (e?.data?.type === "weered:push-suppressed") bump();
    }
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", onSwMessage);
    }

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("weered:unread-tick", onTick as EventListener);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", onSwMessage);
      }
    };
  }, []);
}
