import { Metadata } from "next";

const API = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";
const SITE = "https://weered.ca";

// Per-lobby OG overrides. Default is the generic Weered card + description.
// Add entries here when a lobby has its own branded social card.
const LOBBY_OG_OVERRIDES: Record<string, { ogImage: string; twitterImage?: string; description?: string; title?: string }> = {
  windrose: {
    ogImage: `${SITE}/brand/lobbies/windrose-og-v3.png`,
    description: "The unofficial Windrose community hub. Live Steam player count, Kraken Express dispatches, crew finder, and Captain's Log. Build. Sail. Survive the storm.",
    title: "Windrose — unofficial community hub · Weered",
  },
};

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const id = decodeURIComponent(params.id);
  let name = id;
  let description = `Join the ${id} lobby on Weered. Live rooms, real-time chat, and community presence.`;

  try {
    const res = await fetch(`${API}/lobbies/${encodeURIComponent(id)}`, { next: { revalidate: 300 } });
    if (res.ok) {
      const data = await res.json();
      const lobby = data?.lobby ?? data; // handle both { ok, lobby } and flat shapes
      if (lobby?.name) name = lobby.name;
      if (lobby?.description) description = lobby.description;
    }
  } catch {}

  const override = LOBBY_OG_OVERRIDES[id];
  const title = override?.title ?? `${name} — Weered`;
  const ogDescription = override?.description ?? description;
  const ogImage = override?.ogImage ?? `${SITE}/brand/og-image.png`;
  const twitterImage = override?.twitterImage ?? ogImage;
  const url = `${SITE}/lobby/${encodeURIComponent(id)}`;

  return {
    title,
    description: ogDescription,
    openGraph: {
      title,
      description: ogDescription,
      url,
      type: "website",
      siteName: "Weered",
      images: [{ url: ogImage, width: 1200, height: 630, alt: `${name} on Weered` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: ogDescription,
      images: [twitterImage],
    },
    alternates: { canonical: url },
  };
}

export default function LobbyIdLayout({ children }: { children: React.ReactNode }) {
  return children;
}
