import type { Metadata } from "next";
import Link from "next/link";
import fs from "fs";
import path from "path";

const SITE = "https://weered.ca";

type Guide = {
  lobby_id: string;
  game_name: string;
  noun_singular: string;
  tldr: string;
};

const DATA_PATH = path.join(process.cwd(), "data", "lfg-guides.json");
const GUIDES: Guide[] = (() => {
  try {
    const raw = fs.readFileSync(DATA_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return (parsed?.guides || []) as Guide[];
  } catch {
    return [];
  }
})();

export const metadata: Metadata = {
  title: "LFG guides — how to find groups for any game on Weered",
  description: "Per-game guides for finding fireteams, parties, squads, pods, and teams on Weered. Destiny 2, League of Legends, MTG, Path of Exile, Helldivers 2, D&D and more.",
  alternates: { canonical: `${SITE}/lfg` },
  openGraph: {
    title: "LFG guides on Weered",
    description: "How to find groups for any game on Weered — Destiny 2 fireteams, MTG pods, PoE parties, D&D campaigns, and more.",
    url: `${SITE}/lfg`,
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function LfgIndexPage() {
  return (
    <main style={{
      padding: "32px 20px",
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      maxWidth: 860,
      margin: "0 auto",
      lineHeight: 1.55,
      color: "#e8e8ea",
    }}>
      <header style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 12, opacity: 0.6, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>LFG guides</p>
        <h1 style={{ fontSize: 32, margin: "0 0 12px", lineHeight: 1.15 }}>How to find a group on Weered</h1>
        <p style={{ fontSize: 17, opacity: 0.92 }}>
          Per-game guides for finding fireteams, parties, squads, pods, and teams on Weered.
          Each guide covers the activity types the lobby supports, how Weered's integration with
          the game differs from native LFG, and the common questions players ask.
        </p>
      </header>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {GUIDES.map((g) => (
          <Link
            key={g.lobby_id}
            href={`/lfg/${g.lobby_id}`}
            style={{
              display: "block",
              padding: 16,
              borderRadius: 8,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "inherit",
              textDecoration: "none",
            }}
          >
            <h2 style={{ fontSize: 18, marginTop: 0, marginBottom: 6, color: "#7c9dff" }}>
              {g.game_name} {g.noun_singular} finder
            </h2>
            <p style={{ fontSize: 13, opacity: 0.8, marginBottom: 0 }}>
              {g.tldr.slice(0, 140)}{g.tldr.length > 140 ? "..." : ""}
            </p>
          </Link>
        ))}
      </section>

      <footer style={{
        borderTop: "1px solid rgba(255,255,255,0.1)",
        paddingTop: 16,
        marginTop: 40,
        fontSize: 14,
        opacity: 0.75,
      }}>
        <p style={{ marginBottom: 8 }}>
          Don't see your game? The lobby probably exists even if a dedicated guide doesn't yet.{" "}
          <Link href="/lobby" style={{ color: "#7c9dff" }}>Browse all lobbies →</Link>
        </p>
        <p style={{ marginBottom: 0 }}>
          Open Weered: <Link href="/" style={{ color: "#7c9dff" }}>{SITE}</Link>
        </p>
      </footer>
    </main>
  );
}

export const revalidate = 3600;
