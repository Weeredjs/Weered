import React from "react";
import { Metadata } from "next";

// No sign-in gate here: each route below carries its own (/lobby's page,
// create/layout.tsx, [id]/layout.tsx). The gate renders a placeholder on the
// server, and here it also swallowed [id]'s crawler summary (LobbySeoSlab), so
// every lobby page reached search engines and AI crawlers as an empty shell.

export const metadata: Metadata = {
  title: "Town Square",
  description: "The Town Square: everyone on Weered talks here, and every lobby is one door away.",
  openGraph: {
    title: "Town Square — Weered",
    description: "Everyone on Weered talks here, and every lobby is one door away.",
    url: "https://weered.ca/lobby",
  },
  twitter: {
    card: "summary_large_image",
    title: "Town Square — Weered",
    description: "Everyone on Weered talks here, and every lobby is one door away.",
  },
  alternates: { canonical: "https://weered.ca/lobby" },
};

export default function LobbyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
