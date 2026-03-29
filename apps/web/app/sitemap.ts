import { MetadataRoute } from "next";

const BASE = "https://weered.ca";
const API = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date().toISOString();

  // Static pages
  const statics: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE}/home`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${BASE}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/premium`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE}/lobby`, lastModified: now, changeFrequency: "hourly", priority: 0.8 },
  ];

  // Dynamic lobby pages
  let lobbyEntries: MetadataRoute.Sitemap = [];
  try {
    const res = await fetch(`${API}/lobbies`, { next: { revalidate: 3600 } });
    const data = await res.json();
    if (data?.ok && Array.isArray(data.lobbies)) {
      lobbyEntries = data.lobbies.map((l: any) => ({
        url: `${BASE}/lobby/${encodeURIComponent(l.id)}`,
        lastModified: now,
        changeFrequency: "daily" as const,
        priority: l.pinned ? 0.8 : 0.6,
      }));
    }
  } catch {}

  return [...statics, ...lobbyEntries];
}
