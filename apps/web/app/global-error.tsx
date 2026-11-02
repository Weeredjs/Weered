"use client";
// The last line: an error the whole app couldn't survive (the frame itself
// crashed). Next renders this in place of the root layout, so it brings its
// own html and plain styles. A chunk that failed to load after a deploy
// reloads straight onto the new build (lib/chunkReload.ts).
import { useEffect, useState } from "react";
import { isChunkError, reloadForNewBuild } from "../lib/chunkReload";

export default function GlobalError({ error }: { error: Error }) {
  const [reloading, setReloading] = useState(false);
  useEffect(() => {
    if (isChunkError(error) && reloadForNewBuild()) setReloading(true);
  }, [error]);
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#07060f",
          color: "rgba(243,244,246,.95)",
          fontFamily: "system-ui, sans-serif",
          padding: 24,
        }}
      >
        <div role="alert" style={{ maxWidth: 420, textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>
            {reloading ? "Weered just updated" : "Weered hit a snag"}
          </div>
          <p style={{ opacity: 0.7, fontSize: 14, lineHeight: 1.5, margin: "8px 0 16px" }}>
            {reloading
              ? "Loading the new version…"
              : "Reload and you should be right back where you were."}
          </p>
          {!reloading && (
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: "9px 18px",
                borderRadius: 999,
                border: "1px solid rgba(167,139,250,.5)",
                background: "rgba(124,58,237,.25)",
                color: "inherit",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Reload
            </button>
          )}
        </div>
      </body>
    </html>
  );
}
