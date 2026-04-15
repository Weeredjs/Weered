import React from "react";
import { Metadata } from "next";
import RequireAuth from "../../components/RequireAuth";

export const metadata: Metadata = {
  title: "Home",
  description: "Your Weered dashboard — live lobbies, active rooms, friends online, and recent activity. Jump into voice chat, find a game, or explore communities.",
  openGraph: {
    title: "Home — Weered",
    description: "Your Weered dashboard — live lobbies, active rooms, friends online, and recent activity.",
    url: "https://weered.ca/home",
  },
  twitter: {
    card: "summary_large_image",
    title: "Home — Weered",
    description: "Your Weered dashboard — live lobbies, active rooms, friends online, and recent activity.",
  },
  alternates: { canonical: "https://weered.ca/home" },
};

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}
