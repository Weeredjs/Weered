import React from "react";
import { Metadata } from "next";
import RequireAuth from "../../components/RequireAuth";

export const metadata: Metadata = {
  title: "Lobbies",
  description: "Browse all Weered lobbies — Destiny 2, League of Legends, Fortnite, Path of Exile, CS2, D&D, paper trading, and more. Find your community.",
  openGraph: {
    title: "Lobbies — Weered",
    description: "Browse all Weered lobbies — gaming, trading, tabletop, and community spaces with voice chat, LFG, and game integrations.",
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
  return <RequireAuth>{children}</RequireAuth>;
}
