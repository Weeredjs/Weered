import type { Metadata } from "next";
import { inviteCard, type Invite } from "../../../lib/shareCards";

// What an invite link unfolds into when it's shared (2026-11-12, with the share
// buttons): who invited you, where to, and that lobby's own card. The page is a
// client page with no tags of its own, so every invite used to unfold into the
// site's generic card. Invite links are never indexed.
const API_INTERNAL = process.env.WEERED_API_INTERNAL || "http://127.0.0.1:4000";
const SITE = "https://weered.ca";

export async function generateMetadata(props: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await props.params;
  let inv: Invite | null = null;
  try {
    const r = await fetch(`${API_INTERNAL}/invites/${encodeURIComponent(token)}`, {
      cache: "no-store",
    });
    const j = r.ok ? await r.json() : null;
    if (j?.ok) inv = j.invite as Invite;
  } catch {}
  const card = inviteCard(inv);
  const image = card.lobbyId
    ? `${SITE}/og/lobby/${encodeURIComponent(card.lobbyId)}`
    : `${SITE}/og`;
  return {
    title: { absolute: card.title },
    description: card.description,
    robots: { index: false, follow: false },
    openGraph: {
      title: card.title,
      description: card.description,
      type: "website",
      siteName: "Weered",
      images: [{ url: image, width: 1200, height: 630, alt: card.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: card.title,
      description: card.description,
      images: [image],
    },
  };
}

export default function InviteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
