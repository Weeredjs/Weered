import { Metadata } from "next";

const API = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const id = decodeURIComponent(params.id);
  let name = id;
  let description = `Join the ${id} lobby on Weered. Live rooms, real-time chat, and community presence.`;

  try {
    const res = await fetch(`${API}/lobbies/${encodeURIComponent(id)}`, { next: { revalidate: 300 } });
    if (res.ok) {
      const data = await res.json();
      if (data?.name) name = data.name;
      if (data?.description) description = data.description;
    }
  } catch {}

  return {
    title: `${name} — Weered`,
    description,
    openGraph: {
      title: `${name} — Weered Lobby`,
      description,
      url: `https://weered.ca/lobby/${encodeURIComponent(id)}`,
      images: [{ url: "https://weered.ca/brand/og-image.png", width: 1200, height: 630, alt: `${name} on Weered` }],
    },
    twitter: {
      title: `${name} — Weered`,
      description,
    },
    alternates: { canonical: `https://weered.ca/lobby/${encodeURIComponent(id)}` },
  };
}

export default function LobbyIdLayout({ children }: { children: React.ReactNode }) {
  return children;
}
