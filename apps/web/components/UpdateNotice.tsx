"use client";

// A window left open across a deploy (the installed app, mostly) keeps running
// the build it loaded until it reloads: pages arrive fresh (public/sw.js never
// caches HTML), but the code already in the window doesn't. When the window
// comes back into view, and every 15 minutes, this asks the server which build
// it serves (app/build-info) and offers a reload when it has moved on.
import { useEffect, useState } from "react";

const MINE = process.env.NEXT_PUBLIC_SENTRY_RELEASE || "dev";

export default function UpdateNotice() {
  const [fresh, setFresh] = useState(false);
  useEffect(() => {
    if (MINE === "dev") return;
    let last = 0;
    const check = async () => {
      if (Date.now() - last < 60_000) return;
      last = Date.now();
      try {
        const r = await fetch("/build-info", { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        const theirs = typeof j?.release === "string" ? j.release : "";
        if (theirs && theirs !== "dev" && theirs !== MINE) setFresh(true);
      } catch {}
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    const t = setInterval(() => void check(), 15 * 60_000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(t);
    };
  }, []);
  if (!fresh) return null;
  return (
    <div
      role="status"
      className="weered-update-notice"
      style={{
        position: "fixed",
        left: "50%",
        bottom: "calc(18px + env(safe-area-inset-bottom, 0px))",
        transform: "translateX(-50%)",
        zIndex: 99000,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 10px 9px 16px",
        borderRadius: 999,
        background: "rgba(14,12,26,.94)",
        border: "1px solid rgba(167,139,250,.45)",
        boxShadow: "0 16px 40px -14px rgba(0,0,0,.8)",
        color: "#fff",
        fontSize: 13,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      A new version is ready
      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{
          padding: "6px 14px",
          borderRadius: 999,
          border: 0,
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: 12.5,
          fontWeight: 800,
          color: "#fff",
          background: "#7c3aed",
        }}
      >
        Reload
      </button>
      <button
        type="button"
        aria-label="Later"
        onClick={() => setFresh(false)}
        style={{
          width: 28,
          height: 28,
          borderRadius: 999,
          border: 0,
          cursor: "pointer",
          color: "rgba(255,255,255,.7)",
          background: "transparent",
          fontSize: 14,
        }}
      >
        ✕
      </button>
    </div>
  );
}
