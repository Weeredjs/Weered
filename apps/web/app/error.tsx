"use client";
// A page that crashed, inside Weered's frame. It used to be React's bare
// "Application error" screen. A chunk that failed to load after a deploy
// reloads straight onto the new build (lib/chunkReload.ts); anything else
// gets a way back.
import { useEffect, useState } from "react";
import { isChunkError, reloadForNewBuild } from "../lib/chunkReload";

export default function PageError({ error, reset }: { error: Error; reset: () => void }) {
  const [reloading, setReloading] = useState(false);
  useEffect(() => {
    if (isChunkError(error) && reloadForNewBuild()) setReloading(true);
  }, [error]);
  return (
    <div
      role="alert"
      style={{
        minHeight: "60vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        color: "var(--weered-text, rgba(243,244,246,.95))",
        fontFamily: "inherit",
      }}
    >
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>
          {reloading ? "Weered just updated" : "That page hit a snag"}
        </div>
        <p style={{ opacity: 0.7, fontSize: 14, lineHeight: 1.5, margin: "8px 0 16px" }}>
          {reloading
            ? "Loading the new version…"
            : "Try it again, or reload. If it keeps happening, Send feedback is in the logo menu."}
        </p>
        {!reloading && (
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button type="button" onClick={() => reset()} style={btn(true)}>
              Try again
            </button>
            <button type="button" onClick={() => window.location.reload()} style={btn(false)}>
              Reload
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const btn = (primary: boolean): React.CSSProperties => ({
  padding: "9px 18px",
  borderRadius: 999,
  border: "1px solid var(--weered-accent-ring, rgba(167,139,250,.5))",
  background: primary ? "var(--weered-accent-bg, rgba(124,58,237,.25))" : "transparent",
  color: "inherit",
  fontWeight: 800,
  fontFamily: "inherit",
  cursor: "pointer",
});
