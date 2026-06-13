import { MetadataRoute } from "next";

const BASE = "https://weered.ca";
const API = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date().toISOString();

  const statics: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE}/home`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${BASE}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/premium`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/lobby`, lastModified: now, changeFrequency: "hourly", priority: 0.8 },
    { url: `${BASE}/explore`, lastModified: now, changeFrequency: "daily", priority: 0.6 },
    { url: `${BASE}/compare`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/lfg`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/forum`, lastModified: now, changeFrequency: "hourly", priority: 0.7 },
    { url: `${BASE}/why-not-discord`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/safety`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/features`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/guidelines`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE}/map`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
    { url: `${BASE}/desktop`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
  
    { url: `${BASE}/alternatives/discord`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE}/tournaments/destiny-2`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE}/play/chess`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE}/play/path-of-exile`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE}/play/fakeout`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
  ];

  const SKIP_LOBBIES = new Set(["lobby", "weered.ca", "path-of-exile", "hq"]);
  const isRedditMirror = (id: string) => id.startsWith("r/") || id.startsWith("r%2F");

  let lobbyEntries: MetadataRoute.Sitemap = [];
  try {
    const res = await fetch(`${API}/lobbies`, { next: { revalidate: 3600 } });
    const data = await res.json();
    if (data?.ok && Array.isArray(data.lobbies)) {
      lobbyEntries = data.lobbies
        .filter((l: any) => l?.id && !SKIP_LOBBIES.has(l.id) && !isRedditMirror(l.id))
        .map((l: any) => ({
          url: `${BASE}/lobby/${encodeURIComponent(l.id)}`,
          lastModified: now,
          changeFrequency: "daily" as const,
          priority: l.pinned ? 0.8 : 0.6,
        }));
    }
  } catch {}

  let aboutEntries: MetadataRoute.Sitemap = [];
  try {
    const res = await fetch(`${API}/lobbies`, { next: { revalidate: 3600 } });
    const data = await res.json();
    if (data?.ok && Array.isArray(data.lobbies)) {
      aboutEntries = data.lobbies
        .filter((l: any) => l?.id && !SKIP_LOBBIES.has(l.id) && !isRedditMirror(l.id))
        .filter((l: any) => typeof l?.description === "string" && l.description.length >= 500)
        .map((l: any) => ({
          url: `${BASE}/about/lobby/${encodeURIComponent(l.id)}`,
          lastModified: now,
          changeFrequency: "weekly" as const,
          priority: 0.5,
        }));
    }
  } catch {}

  let lfgEntries: MetadataRoute.Sitemap = [];
  try {
    const lfgData = require("../data/lfg-guides.json");
    const guides = lfgData?.guides ?? [];
    lfgEntries = guides.map((g: any) => ({
      url: `${BASE}/lfg/${g.lobby_id}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    }));
  } catch {}

  let compareEntries: MetadataRoute.Sitemap = [];
  try {
    const competitorsData = require("../data/competitors.json");
    const competitors = competitorsData?.competitors ?? [];
    compareEntries = competitors.map((c: any) => ({
      url: `${BASE}/compare/weered-vs/${c.id}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    }));
  } catch {}

  let forumEntries: MetadataRoute.Sitemap = [];
  try {
    const res = await fetch(`${API}/forum/posts?sort=new&limit=200`, { next: { revalidate: 3600 } });
    const data = await res.json();
    if (data?.ok && Array.isArray(data.posts)) {
      forumEntries = data.posts.map((post: any) => {
        const score = Number(post.score || 0);
        const priority = Math.max(0.4, Math.min(0.7, 0.4 + score / 200));
        return {
          url: `${BASE}/forum/${encodeURIComponent(post.id)}`,
          lastModified: post.updatedAt || post.createdAt || now,
          changeFrequency: "daily" as const,
          priority,
        };
      });
    }
  } catch {}

  return [...statics, ...lobbyEntries, ...aboutEntries, ...compareEntries, ...lfgEntries, ...forumEntries];
}
