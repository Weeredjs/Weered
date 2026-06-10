import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v || 0));
  const width = clamp(Number(searchParams.get("w")), 320, 1920) || 1200;
  const height = clamp(Number(searchParams.get("h")), 180, 1080) || 630;
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

        <img
          src="https://weered.ca/brand/logo/weered-logo-128.png"
          alt=""
          width={180}
          height={180}
          style={{ borderRadius: 24, marginBottom: 28 }}
        />

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
    { width, height }
  );
}
