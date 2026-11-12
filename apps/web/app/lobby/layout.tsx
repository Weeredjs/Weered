import React from "react";
import { Metadata } from "next";

// No sign-in gate here: each route below carries its own (/lobby's page,
// create/layout.tsx, [id]/layout.tsx). The gate renders a placeholder on the
// server, and here it also swallowed [id]'s crawler summary (LobbySeoSlab), so
// every lobby page reached search engines and AI crawlers as an empty shell.

export const metadata: Metadata = {
  title: "Lobbies",
  description:
    "Browse all Weered lobbies — Destiny 2, League of Legends, Fortnite, Path of Exile, CS2, D&D, paper trading, and more. Find your community.",
  openGraph: {
    title: "Lobbies — Weered",
    description:
      "Browse all Weered lobbies — gaming, trading, tabletop, and community spaces with voice chat, LFG, and game integrations.",
    url: "https://weered.ca/lobby",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lobbies — Weered",
    description: "Browse all Weered lobbies — gaming, trading, tabletop, and community spaces.",
  },
  alternates: { canonical: "https://weered.ca/lobby" },
};

export default function LobbyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
