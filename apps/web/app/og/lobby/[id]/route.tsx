import { ImageResponse } from "next/og";
import { descriptionLead } from "../../../../lib/descriptionLead";
import { nameSize } from "../../../../lib/shareCards";

// The picture a shared lobby link unfolds into on WhatsApp, Facebook, Discord
// and the rest (2026-11-12, with the share buttons): the lobby's name, what it
// is, and its own colour, at 1200x630. app/lobby/[id]/layout.tsx and
// app/invite/[token]/layout.tsx name it in their link-preview tags. Every
// lobby used to share the same generic Weered card.
//
// Drawn by next/og, which reads PNG and JPEG only, so the one picture on it is
// our own mark; a lobby's banner or logo can be any format and isn't used.
const API_INTERNAL = process.env.WEERED_API_INTERNAL || "http://127.0.0.1:4000";
const W = 1200;
const H = 630;
const VIOLET = "#7c3aed";

type Lobby = {
  id: string;
  name?: string;
  description?: string | null;
  accentColor?: string | null;
};

async function fetchLobby(id: string): Promise<Lobby | null> {
  try {
    const r = await fetch(`${API_INTERNAL}/lobbies/${encodeURIComponent(id)}`, {
      cache: "no-store",
    });
    const j = r.ok ? await r.json() : null;
    const l = j?.lobby ?? j;
    return l?.id ? (l as Lobby) : null;
  } catch {
    return null;
  }
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const lobbyId = decodeURIComponent(id);
  const lobby = await fetchLobby(lobbyId);
  const name = (lobby?.name || "Weered").slice(0, 60);
  const accent = /^#[0-9a-f]{6}$/i.test(lobby?.accentColor || "") ? lobby!.accentColor! : VIOLET;
  const about = lobby?.description
    ? descriptionLead(lobby.description).slice(0, 150)
    : "A place for anything. Voice, video and chat in the browser.";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "56px 64px",
        background: "linear-gradient(135deg, #07050f 0%, #130a26 55%, #1c0d38 100%)",
        color: "#fff",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        position: "relative",
      }}
    >
      {/* The lobby's colour: a glow and a bar down the left. */}
      <div
        style={{
          position: "absolute",
          right: -160,
          top: -200,
          width: 760,
          height: 760,
          background: `radial-gradient(circle at center, ${accent}66 0%, ${accent}1f 38%, transparent 68%)`,
          display: "flex",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 14,
          height: H,
          background: accent,
          display: "flex",
        }}
      />

      <div style={{ display: "flex", alignItems: "center" }}>
        <img
          src="https://weered.ca/brand/logo/weered-logo-128.png"
          alt=""
          width={56}
          height={56}
          style={{ marginRight: 16 }}
        />
        <div style={{ display: "flex", fontSize: 30, fontWeight: 800, letterSpacing: 1 }}>
          Weered
        </div>
        <div
          style={{
            display: "flex",
            marginLeft: 18,
            padding: "6px 16px",
            borderRadius: 999,
            border: `2px solid ${accent}`,
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: 3,
            color: "rgba(255,255,255,.86)",
          }}
        >
          {lobby ? "A LOBBY" : "A PLACE FOR ANYTHING"}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            fontSize: nameSize(name),
            fontWeight: 900,
            letterSpacing: -2,
            lineHeight: 1.04,
            maxWidth: 1040,
          }}
        >
          {name}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 22,
            fontSize: 32,
            lineHeight: 1.3,
            color: "rgba(232,232,240,.82)",
            maxWidth: 1000,
          }}
        >
          {about}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div
          style={{
            display: "flex",
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: 2,
            color: "rgba(255,255,255,.72)",
            fontFamily: "ui-monospace, Menlo, Monaco, monospace",
          }}
        >
          {lobby ? `weered.ca/lobby/${lobbyId}`.slice(0, 52) : "weered.ca"}
        </div>
        <div style={{ display: "flex", fontSize: 24, fontWeight: 700, color: accent }}>
          In your browser. No download.
        </div>
      </div>
    </div>,
    { width: W, height: H },
  );
}
