// A game's news for its lobby's news stage (web components/NewsStage.tsx; James
// 2026-11-04: "a full article with image and video of actual game news from IGN
// or something that cycles"). Three sources, newest first:
//   - the game's own Steam announcements, which carry header images and
//     YouTube trailers (the feed the Intel boards already read, in full);
//   - stories from IGN, GameSpot, PC Gamer, Eurogamer and Polygon that name
//     the game (their feeds hold only the latest few dozen, so a quiet game
//     has none: Steam keeps the stage full);
//   - IGN's YouTube videos that name it.
// Press feeds are fetched together at most every 30 minutes for every game;
// a game's mix is kept 15 minutes.
import { fetchWithTimeout } from "./fetchWithTimeout";
import { decodeEntities, stripTags } from "./htmlText";
import { elementBlocks, findTags, firstInner, readCapped, tagAttrs } from "./htmlScan";
import { swallow } from "./logger";
import { BoundedMap } from "./boundedMap";

export type GameNewsItem = {
  title: string;
  url: string;
  /** ISO date. */
  date: string;
  source: string;
  snippet: string;
  /** An https picture for the story, when it has one. */
  image?: string;
  /** A YouTube video id, when the story is or carries a video. */
  video?: string;
  /** From the game's own announcements. */
  official?: boolean;
};

type Game = { name: string; steam?: number; words: string[] };
/** The games with a news stage, by the key the web asks for. */
export const NEWS_GAMES: Record<string, Game> = {
  destiny2: { name: "Destiny 2", steam: 1085660, words: ["Destiny 2"] },
  division2: { name: "The Division 2", steam: 2221490, words: ["Division 2"] },
  eve: { name: "EVE Online", steam: 8500, words: ["EVE Online"] },
  hll: { name: "Hell Let Loose", steam: 686810, words: ["Hell Let Loose"] },
  windrose: { name: "Windrose", steam: 3041230, words: ["Windrose"] },
  fortnite: { name: "Fortnite", words: ["Fortnite"] },
  helldivers2: { name: "Helldivers 2", steam: 553850, words: ["Helldivers 2"] },
  poe: { name: "Path of Exile", steam: 238960, words: ["Path of Exile"] },
  cs2: { name: "Counter-Strike 2", steam: 730, words: ["Counter-Strike 2", "CS2"] },
  dota2: { name: "Dota 2", steam: 570, words: ["Dota 2"] },
  pubg: { name: "PUBG", steam: 578080, words: ["PUBG"] },
  gta6: { name: "GTA 6", words: ["GTA 6", "GTA VI", "Grand Theft Auto VI"] },
};

const PRESS = [
  { source: "IGN", url: "https://feeds.feedburner.com/ign/games-all" },
  { source: "GameSpot", url: "https://www.gamespot.com/feeds/game-news" },
  { source: "PC Gamer", url: "https://www.pcgamer.com/rss/" },
  { source: "Eurogamer", url: "https://www.eurogamer.net/feed" },
  { source: "Polygon", url: "https://www.polygon.com/rss/index.xml" },
  {
    source: "IGN video",
    url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCKy1dAqELo0zrOtPkf0eTMw",
  },
];
const UA = {
  "User-Agent": "Mozilla/5.0 (compatible; WeeredBot/1.0; +https://weered.ca)",
  Accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8",
};
const PRESS_TTL = 30 * 60_000;
const GAME_TTL = 15 * 60_000;
const MAX_ITEMS = 20;

const httpsUrl = (u: string | undefined): string | undefined => {
  const v = decodeEntities(String(u || "").trim());
  return /^https:\/\/[^\s"'<>]+$/i.test(v) ? v : undefined;
};
const iso = (d: string | undefined): string | undefined => {
  const t = Date.parse(String(d || "").trim());
  return Number.isNaN(t) ? undefined : new Date(t).toISOString();
};
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
// stripTags leaves a space where each tag was: "<b>New York</b>." reads
// "New York ." until the space before the punctuation goes.
const plain = (s: string | undefined) =>
  decodeEntities(stripTags(String(s || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")))
    .replace(/\s+/g, " ")
    .replace(/ ([.,;:!?)])/g, "$1")
    .trim();
// One pass per tag (lib/htmlScan.ts), as everywhere a feed is read.
const tagText = (block: string, name: string) => firstInner(block, name, 4000);

/** RSS items and Atom entries, with their date, picture and any YouTube id. */
export function parsePress(xml: string, source: string): GameNewsItem[] {
  const out: GameNewsItem[] = [];
  for (const b of elementBlocks(xml, ["item", "entry"], { limit: 120 })) {
    const title = plain(tagText(b, "title"));
    const links = findTags(b, "link", { limit: 20 }).map(tagAttrs);
    const url = httpsUrl(
      links.find((a) => (a.rel || "").toLowerCase() === "alternate" && a.href)?.href ||
        links.find((a) => a.href)?.href ||
        plain(tagText(b, "link")),
    );
    const date = iso(
      tagText(b, "pubDate") ||
        tagText(b, "published") ||
        tagText(b, "updated") ||
        tagText(b, "dc:date"),
    );
    if (!title || !url || !date) continue;
    const video = /<yt:videoId>([\w-]{6,20})<\/yt:videoId>/i.exec(b)?.[1];
    const image =
      httpsUrl(/<media:content[^>]*url="([^"]+)"[^>]*medium="image"/i.exec(b)?.[1]) ||
      httpsUrl(/<media:content[^>]*medium="image"[^>]*url="([^"]+)"/i.exec(b)?.[1]) ||
      httpsUrl(/<media:thumbnail[^>]*url="([^"]+)"/i.exec(b)?.[1]) ||
      httpsUrl(/<enclosure[^>]*url="([^"]+)"[^>]*type="image/i.exec(b)?.[1]) ||
      httpsUrl(/<enclosure[^>]*type="image[^"]*"[^>]*url="([^"]+)"/i.exec(b)?.[1]) ||
      httpsUrl(/<media:content[^>]*url="([^"]+\.(?:jpe?g|png|webp)[^"]*)"/i.exec(b)?.[1]) ||
      httpsUrl(/<img[^>]*src="([^"]+)"/i.exec(decodeEntities(b))?.[1]);
    const snippet = clip(
      plain(
        tagText(b, "description") ||
          tagText(b, "media:description") ||
          tagText(b, "summary") ||
          tagText(b, "content"),
      ),
      260,
    );
    out.push({ title: clip(title, 200), url, date, source, snippet, image, video });
  }
  return out;
}

const STEAM_IMAGE = "https://clan.akamai.steamstatic.com/images/";

/** A Steam announcement: its first picture, its first YouTube video, and its
 *  words without the markup. Pictureless ones get the game's capsule art. */
export function steamItem(n: any, appId: number): GameNewsItem | null {
  const title = plain(n?.title);
  const url = httpsUrl(n?.url);
  if (!title || !url || !n?.date) return null;
  const body = String(n.contents || "");
  const clan = /\{STEAM_CLAN_IMAGE\}\/([^\s"'[\]<>]+?\.(?:jpe?g|png|gif|webp))/i.exec(body)?.[1];
  const image =
    (clan ? `${STEAM_IMAGE}${clan}` : undefined) ||
    httpsUrl(/\[img(?:\s+src="([^"]+)"[^\]]*)?\]/i.exec(body)?.[1]) ||
    httpsUrl(/\[img\]\s*(https:[^[\s]+)\s*\[\/img\]/i.exec(body)?.[1]) ||
    httpsUrl(/<img[^>]*src="([^"]+)"/i.exec(body)?.[1]) ||
    `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/capsule_616x353.jpg`;
  const video =
    /previewyoutube[=:"]+([\w-]{6,20})/i.exec(body)?.[1] ||
    /youtube\.com\/watch\?v=([\w-]{6,20})/i.exec(body)?.[1] ||
    /youtu\.be\/([\w-]{6,20})/i.exec(body)?.[1];
  const words = plain(
    body
      .replace(/\[(img|previewyoutube|video)[^\]]*\][\s\S]*?\[\/\1\]/gi, " ")
      .replace(/\{STEAM_CLAN_IMAGE\}\S*/g, " ")
      .replace(/\[\/?[a-z0-9*]+(?:[= ][^\]]*)?\]/gi, " ")
      .replace(/https?:\/\/\S+/g, " "),
  );
  return {
    title: clip(title, 200),
    url,
    date: new Date(Number(n.date) * 1000).toISOString(),
    source: "Official",
    snippet: clip(words, 260),
    image,
    video,
    official: true,
  };
}

/** Does the story name the game? Whole words, any case. */
export function namesGame(item: GameNewsItem, words: string[]): boolean {
  const hay = `${item.title} ${item.snippet}`;
  return words.some((w) =>
    new RegExp(`(^|[^\\w])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\w])`, "i").test(hay),
  );
}

let press: { at: number; items: GameNewsItem[] } | null = null;
let pressLoading: Promise<GameNewsItem[]> | null = null;
async function pressStories(): Promise<GameNewsItem[]> {
  if (press && Date.now() - press.at < PRESS_TTL) return press.items;
  if (!pressLoading)
    pressLoading = Promise.all(
      PRESS.map(async (p) => {
        try {
          const r = await fetchWithTimeout(p.url, { headers: UA }, 10_000);
          return r.ok ? parsePress(await readCapped(r, 2_000_000), p.source) : [];
        } catch (e) {
          swallow(e);
          return [];
        }
      }),
    )
      .then((lists) => {
        const items = lists.flat();
        // A run where every feed failed keeps the last good set.
        if (items.length || !press) press = { at: Date.now(), items };
        return press.items;
      })
      .finally(() => {
        pressLoading = null;
      });
  return pressLoading;
}

async function steamAnnouncements(appId: number): Promise<GameNewsItem[]> {
  try {
    const r = await fetchWithTimeout(
      `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=${appId}` +
        `&count=10&maxlength=0&format=json&feeds=steam_community_announcements`,
      { headers: UA },
      10_000,
    );
    if (!r.ok) return [];
    const j: any = await r.json();
    return (j?.appnews?.newsitems || [])
      .map((n: any) => steamItem(n, appId))
      .filter(Boolean) as GameNewsItem[];
  } catch (e) {
    swallow(e);
    return [];
  }
}

const games = new BoundedMap<string, { at: number; items: GameNewsItem[] }>(200);

/** A game's stage: its announcements and the press that names it, newest first. */
export async function gameNews(key: string): Promise<GameNewsItem[] | null> {
  const game = NEWS_GAMES[key];
  if (!game) return null;
  const hit = games.get(key);
  if (hit && Date.now() - hit.at < GAME_TTL) return hit.items;
  const [official, stories] = await Promise.all([
    game.steam ? steamAnnouncements(game.steam) : Promise.resolve([]),
    pressStories(),
  ]);
  const seen = new Set<string>();
  const items = [...official, ...stories.filter((s) => namesGame(s, game.words))]
    .filter((i) => (seen.has(i.url) ? false : (seen.add(i.url), true)))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, MAX_ITEMS);
  // A failed run keeps what the game had.
  if (items.length || !hit) games.set(key, { at: Date.now(), items });
  return games.get(key)!.items;
}
