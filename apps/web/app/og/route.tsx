import { ImageResponse } from "next/og";

export const runtime = "edge";

// Dynamic OG image — used by routes that don't have a per-route
// override (most invite links, profile shares, raw weered.ca pastes).
// Renders 1200×630 with the current W mark + tagline.
//
// Per-lobby OG cards still take precedence: layout.tsx's
// generateMetadata sets a static image when LOBBY_OG_OVERRIDES has an
// entry. This route is the fallback otherwise.
export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #0a0a14 0%, #14081f 55%, #1a0a25 100%)",
          color: "#fff",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          position: "relative",
        }}
      >
        {/* Soft purple radial behind the mark */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 800,
            height: 800,
            background:
              "radial-gradient(circle at center, rgba(124,58,237,.35) 0%, rgba(124,58,237,.10) 35%, transparent 65%)",
            display: "flex",
          }}
        />

        {/* W mark */}
        <img
          src="https://weered.ca/brand/logo/weered-logo-128.png"
          alt=""
          width={180}
          height={180}
          style={{ borderRadius: 24, marginBottom: 28 }}
        />

        {/* Wordmark */}
        <div
          style={{
            fontSize: 96,
            fontWeight: 900,
            letterSpacing: -3,
            lineHeight: 1,
            background:
              "linear-gradient(135deg, #fff 0%, #d8caff 60%, #a78bfa 100%)",
            backgroundClip: "text",
            color: "transparent",
            display: "flex",
          }}
        >
          weered
        </div>

        {/* Tagline */}
        <div
          style={{
            marginTop: 18,
            fontSize: 26,
            fontWeight: 600,
            letterSpacing: -0.5,
            color: "rgba(232,232,240,.80)",
            display: "flex",
          }}
        >
          Lobbies · Crews · Live rooms
        </div>

        {/* Bottom strip */}
        <div
          style={{
            position: "absolute",
            bottom: 36,
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "rgba(167,139,250,.85)",
            fontFamily: "ui-monospace, Menlo, Monaco, monospace",
          }}
        >
          <span>WEERED.CA</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>REAL-TIME COMMUNITY PLATFORM</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
