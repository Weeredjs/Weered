import { Metadata } from "next";
import LobbySeoSlab from "./LobbySeoSlab";
import SyncAuthedAttribute from "./SyncAuthedAttribute";

const API = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";
const SITE = "https://weered.ca";

const LOBBY_OG_OVERRIDES: Record<
  string,
  { ogImage: string; twitterImage?: string; description?: string; title?: string }
> = {
  windrose: {
    ogImage: `${SITE}/brand/lobbies/windrose-og-v3.png`,
    description:
      "The unofficial Windrose community hub. Live Steam player count, Kraken Express dispatches, crew finder, and Captain's Log. Build. Sail. Survive the storm.",
    title: "Windrose — unofficial community hub · Weered",
  },
  destiny2: {
    ogImage: `${SITE}/brand/lobbies/destiny2-og-v1.png`,
    description:
      "The unofficial Guardian hub. Verified-via-Bungie-API tournaments, race brackets for Pantheon 2.0, Trials and Crucible competitions, and Hall-of-Fame champion flair. Hosting community races into Shadow & Order (June 9, 2026). Find your fireteam.",
    title: "Destiny 2 community hub — Pantheon 2.0 races, verified tournaments · Weered",
  },
};

export async function generateMetadata(props: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const params = await props.params;
  const id = decodeURIComponent(params.id);
  let name = id;
  let description = `Join the ${id} lobby on Weered. Live rooms, real-time chat, and community presence.`;

  try {
    const res = await fetch(`${API}/lobbies/${encodeURIComponent(id)}`, {
      next: { revalidate: 300 },
    });
    if (res.ok) {
      const data = await res.json();
      const lobby = data?.lobby ?? data;
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

async function fetchLobbyName(id: string): Promise<string> {
  try {
    const res = await fetch(`${API}/lobbies/${encodeURIComponent(id)}`, {
      next: { revalidate: 600 },
    });
    if (res.ok) {
      const data = await res.json();
      const lobby = data?.lobby ?? data;
      return lobby?.name || id;
    }
  } catch {}
  return id;
}

export default async function LobbyIdLayout(props: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;

  const { children } = props;

  const id = decodeURIComponent(params.id);
  const name = await fetchLobbyName(id);
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE },
      { "@type": "ListItem", position: 2, name: "Lobbies", item: `${SITE}/lobby` },
      { "@type": "ListItem", position: 3, name, item: `${SITE}/lobby/${encodeURIComponent(id)}` },
    ],
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <script
        dangerouslySetInnerHTML={{
          __html: `try{if(localStorage.getItem('weered_token'))document.documentElement.setAttribute('data-weered-authed','1');}catch(e){}`,
        }}
      />
      <SyncAuthedAttribute />
      <LobbySeoSlab lobbyId={id} />
      {children}
    </>
  );
}
