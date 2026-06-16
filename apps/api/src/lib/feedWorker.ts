import { prisma } from "./prisma";
import { log } from "./logger";
import { rooms, articleRoomMeta } from "./roomState";

// News/feed worker extracted from index.ts. Pulls from HN/ESPN/iTunes/YouTube,
// scores by recency + live room occupancy, and persists FeedItems. No WS deps
// (reads the in-memory `rooms` map for occupancy; never broadcasts).

export interface RawItem {
  url: string;
  title: string;
  thumbnail?: string;
  domain: string;
  sourceName: string;
  category: string;
  postedAt: Date;
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function roomIdFromUrl(url: string): string {
  let h = 0;
  for (let i = 0; i < url.length; i++) {
    h = (h << 5) - h + url.charCodeAt(i);
    h |= 0;
  }
  return `article_${Math.abs(h).toString(36).slice(0, 10)}`;
}

export function recencyScore(postedAt: Date): number {
  const ageHours = (Date.now() - postedAt.getTime()) / 3600000;
  if (ageHours < 1) return 70;
  if (ageHours < 3) return 60;
  if (ageHours < 6) return 50;
  if (ageHours < 12) return 38;
  if (ageHours < 24) return 25;
  if (ageHours < 48) return 12;
  return 5;
}

export async function fetchHackerNews(): Promise<RawItem[]> {
  try {
    const res = await fetch(
      "https://hn.algolia.com/api/v1/search?tags=story&hitsPerPage=15&numericFilters=points>50",
    );
    const data = (await res.json()) as any;
    return (data.hits || [])
      .filter((h: any) => h.url)
      .map((h: any) => ({
        url: h.url,
        title: h.title,
        domain: domainOf(h.url),
        sourceName: "Hacker News",
        category: "tech",
        postedAt: new Date(h.created_at),
      }));
  } catch (e) {
    log.warn("[feed] HN fetch failed:", e);
    return [];
  }
}

export async function fetchESPNRss(
  feedUrl: string,
  category: string,
  sourceName: string,
): Promise<RawItem[]> {
  try {
    const res = await fetch(feedUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Weered/1.0)" },
    });
    const xml = await res.text();
    const items: RawItem[] = [];
    const itemRx = /<item>([\s\S]*?)<\/item>/g;
    const titleRx = /<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/;
    const linkRx = /<link>(?:<!\[CDATA\[)?(https?[^<]+?)(?:\]\]>)?<\/link>/;
    const dateRx = /<pubDate>(.*?)<\/pubDate>/;
    const imgRx = /<media:thumbnail[^>]+url=\"([^"]+)\"/;
    let m: RegExpExecArray | null;
    while ((m = itemRx.exec(xml)) !== null) {
      const block = m[1];
      const title = titleRx.exec(block)?.[1]?.trim();
      const link = linkRx.exec(block)?.[1]?.trim();
      const dateStr = dateRx.exec(block)?.[1];
      const thumb = imgRx.exec(block)?.[1];
      if (!title || !link) continue;
      items.push({
        url: link,
        title,
        thumbnail: thumb,
        domain: domainOf(link),
        sourceName,
        category,
        postedAt: dateStr ? new Date(dateStr) : new Date(),
      });
    }
    return items.slice(0, 12);
  } catch (e) {
    log.warn(`[feed] ESPN RSS ${feedUrl} failed:`, e);
    return [];
  }
}

export async function fetchItunesPodcasts(): Promise<RawItem[]> {
  try {
    const terms = ["true+crime", "comedy", "news", "sports", "technology"];
    const term = terms[Math.floor(Math.random() * terms.length)];
    const res = await fetch(
      `https://itunes.apple.com/search?media=podcast&entity=podcastEpisode&term=${term}&limit=10&sort=recent`,
    );
    const data = (await res.json()) as any;
    return (data.results || [])
      .map((r: any) => ({
        url: r.trackViewUrl || r.collectionViewUrl,
        title: r.trackName || r.collectionName,
        thumbnail: r.artworkUrl100,
        domain: "podcasts.apple.com",
        sourceName: r.collectionName || "Apple Podcasts",
        category: "podcasts",
        postedAt: r.releaseDate ? new Date(r.releaseDate) : new Date(),
      }))
      .filter((r: any) => r.url && r.title);
  } catch (e) {
    log.warn("[feed] iTunes fetch failed:", e);
    return [];
  }
}

export async function fetchYouTubeRss(
  channelId: string,
  sourceName: string,
  category: string,
): Promise<RawItem[]> {
  try {
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
    const xml = await res.text();
    const items: RawItem[] = [];
    const entryRx = /<entry>([\s\S]*?)<\/entry>/g;
    const titleRx = /<title>(.*?)<\/title>/;
    const linkRx = /<link rel=\"alternate\" href=\"([^"]+)\"/;
    const dateRx = /<published>(.*?)<\/published>/;
    const thumbRx = /<media:thumbnail url=\"([^"]+)\"/;
    let m: RegExpExecArray | null;
    while ((m = entryRx.exec(xml)) !== null) {
      const block = m[1];
      const title = titleRx.exec(block)?.[1]?.trim();
      const link = linkRx.exec(block)?.[1]?.trim();
      const dateStr = dateRx.exec(block)?.[1];
      const thumb = thumbRx.exec(block)?.[1];
      if (!title || !link) continue;
      items.push({
        url: link,
        title,
        thumbnail: thumb,
        domain: "youtube.com",
        sourceName,
        category,
        postedAt: dateStr ? new Date(dateStr) : new Date(),
      });
    }
    return items.slice(0, 8);
  } catch (e) {
    log.warn(`[feed] YouTube RSS ${channelId} failed:`, e);
    return [];
  }
}

export async function runFeedWorker() {
  log.log("[feed] worker starting fetch...");
  try {
    const [hn, espnUfc, espnNfl, espnNba, podcasts, ign, gamespot] = await Promise.all([
      fetchHackerNews(),
      fetchESPNRss("https://www.espn.com/espn/rss/mma/news", "ufc", "ESPN MMA"),
      fetchESPNRss("https://www.espn.com/espn/rss/nfl/news", "sports", "ESPN NFL"),
      fetchESPNRss("https://www.espn.com/espn/rss/nba/news", "sports", "ESPN NBA"),
      fetchItunesPodcasts(),
      fetchYouTubeRss("UCKy1dAqELo0zrOtPkf0eTMw", "IGN", "gaming"),
      fetchYouTubeRss("UCbu2SsF-Or3Rsn3NxqODImQ", "GameSpot", "gaming"),
    ]);

    const all: RawItem[] = [
      ...hn,
      ...espnUfc,
      ...espnNfl,
      ...espnNba,
      ...podcasts,
      ...ign,
      ...gamespot,
    ];
    const seen = new Set<string>();
    const deduped = all.filter((i) => {
      if (!i.url || seen.has(i.url)) return false;
      seen.add(i.url);
      return true;
    });

    let upserted = 0;
    for (const item of deduped) {
      const roomId = roomIdFromUrl(item.url);
      const roomState = rooms.get(roomId);
      const usersInRoom = roomState ? roomState.users.size : 0;
      const heat = Math.min(100, recencyScore(item.postedAt) + Math.min(30, usersInRoom * 5));

      await prisma.feedItem
        .upsert({
          where: { url: item.url },
          update: {
            heat,
            usersInRoom,
            fetchedAt: new Date(),
            title: item.title,
            thumbnail: item.thumbnail ?? null,
          },
          create: {
            url: item.url,
            title: item.title,
            thumbnail: item.thumbnail ?? null,
            domain: item.domain,
            sourceName: item.sourceName,
            category: item.category,
            heat,
            usersInRoom,
            postedAt: item.postedAt,
          },
        })
        .catch((e: any) => log.warn("[feed] upsert failed:", e?.message));
      const shortTitle = item.title.length > 60 ? item.title.slice(0, 57) + "…" : item.title;
      articleRoomMeta.set(roomId, { name: shortTitle, thumbnail: item.thumbnail || undefined });
      if (roomState) {
        roomState.name = shortTitle;
        if (item.thumbnail) roomState.thumbnail = item.thumbnail;
      }
      upserted++;
    }
    log.log(`[feed] worker done — ${upserted} items upserted`);
  } catch (e) {
    log.error("[feed] worker error:", e);
  }
}
