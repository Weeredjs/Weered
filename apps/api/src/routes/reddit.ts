import type { FastifyInstance } from "fastify";
import { fetchWithTimeout } from "../lib/fetchWithTimeout";

const ALLOWED_SUBS: Record<string, string> = {
  gta6: "GTA6",
};

type RedditPost = {
  id: string;
  title: string;
  url: string;
  author: string;
  updatedAt: string;
  flair: string;
  thumbnail: string | null;
  excerpt: string;
  hasVideo: boolean;
};

const cache = new Map<string, { posts: RedditPost[]; cachedAt: number }>();
const TTL = 5 * 60 * 1000;

function decodeOnce(s: string): string {
  return s
    .replaceAll(/&lt;/g, "<")
    .replaceAll(/&gt;/g, ">")
    .replaceAll(/&quot;/g, '"')
    .replaceAll(/&apos;/g, "'")
    .replaceAll(/&#x([0-9a-f]+);/gi, (_, h) => {
      try {
        return String.fromCodePoint(Number.parseInt(h, 16));
      } catch {
        return "";
      }
    })
    .replaceAll(/&#(\d+);/g, (_, n) => {
      try {
        return String.fromCodePoint(Number.parseInt(n, 10));
      } catch {
        return "";
      }
    })
    .replaceAll(/&amp;/g, "&");
}
function decode(s: string): string {
  let prev = s,
    out = decodeOnce(s);
  for (let i = 0; i < 2 && out !== prev; i++) {
    prev = out;
    out = decodeOnce(out);
  }
  return out;
}

function extractMedia(contentHtml: string): {
  thumbnail: string | null;
  excerpt: string;
  hasVideo: boolean;
} {
  const c = decode(contentHtml);
  const hasVideo = /v\.redd\.it/.test(c);
  let thumbnail: string | null = null;
  const direct =
    /https?:\/\/i\.redd\.it\/[^\s"'<>]+?\.(?:jpg|jpeg|png|gif|webp)/i.exec(c)?.[0] ||
    /https?:\/\/(?:preview|external-preview)\.redd\.it\/[^\s"'<>]+?\.(?:jpg|jpeg|png|gif|webp)/i.exec(
      c,
    )?.[0] ||
    null;
  if (direct) thumbnail = direct.replaceAll(/&amp;/g, "&");
  const excerpt = c
    .replaceAll(/<[^>]+>/g, " ")
    .replaceAll(/&nbsp;/g, " ")
    .replace(/submitted by.*$/is, "")
    .replaceAll(/\[link\]|\[comments\]/gi, "")
    .replaceAll(/https?:\/\/\S+/g, "")
    .replaceAll(/\s+/g, " ")
    .trim()
    .slice(0, 220);
  const cleanExcerpt = /[a-z0-9]/i.test(excerpt) ? excerpt : "";
  return { thumbnail, excerpt: cleanExcerpt, hasVideo };
}

function parseAtom(xml: string): RedditPost[] {
  const posts: RedditPost[] = [];
  const entryRx = /<entry>([\s\S]*?)<\/entry>/g;
  let m: RegExpExecArray | null;
  while ((m = entryRx.exec(xml)) !== null) {
    const block = m[1];
    const title = decode((/<title>([\s\S]*?)<\/title>/.exec(block)?.[1] || "").trim());
    const url = (/<link[^>]*href="([^"]+)"/.exec(block)?.[1] || "").trim();
    const author = decode(
      (/<author>[\s\S]*?<name>(?:\/u\/)?([^<]+)<\/name>/.exec(block)?.[1] || "").trim(),
    );
    const updatedAt = (/<updated>([^<]+)<\/updated>/.exec(block)?.[1] || "").trim();
    const flair = decode((/<category[^>]*term="([^"]+)"/.exec(block)?.[1] || "").trim());
    const contentHtml = /<content[^>]*>([\s\S]*?)<\/content>/.exec(block)?.[1] || "";
    const idMatch = /comments\/([a-z0-9]+)\//.exec(url);
    const id = idMatch ? idMatch[1] : url;
    if (!title || !url || !url.includes("/comments/")) continue;
    const { thumbnail, excerpt, hasVideo } = extractMedia(contentHtml);
    posts.push({ id, title, url, author, updatedAt, flair, thumbnail, excerpt, hasVideo });
  }
  return posts;
}

export default async function redditRoutes(app: FastifyInstance) {
  app.get("/reddit/:sub", async (req, reply) => {
    const slug = String((req as any).params?.sub || "").toLowerCase();
    const sub = ALLOWED_SUBS[slug];
    if (!sub) return reply.code(404).send({ ok: false, error: "sub_not_allowed" });
    const sortRaw = String((req as any).query?.sort || "hot").toLowerCase();
    const sort = ["hot", "new", "top", "rising"].includes(sortRaw) ? sortRaw : "hot";
    const cacheKey = `${slug}:${sort}`;

    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < TTL) {
      return reply.send({
        ok: true,
        sub,
        posts: cached.posts,
        updatedAt: new Date(cached.cachedAt).toISOString(),
        cached: true,
      });
    }

    try {
      const url = `https://www.reddit.com/r/${encodeURIComponent(sub)}/${sort}.rss?limit=25`;
      const res = await fetchWithTimeout(url, {
        headers: { "User-Agent": "weered:lobby-feed:v1 (by /u/weeeered)" },
      });
      if (!res.ok) {
        if (cached)
          return reply.send({
            ok: true,
            sub,
            posts: cached.posts,
            updatedAt: new Date(cached.cachedAt).toISOString(),
            stale: true,
          });
        return reply.code(502).send({ ok: false, error: "reddit_upstream", status: res.status });
      }
      const xml = await res.text();
      const posts = parseAtom(xml).slice(0, 25);
      cache.set(cacheKey, { posts, cachedAt: Date.now() });
      return reply.send({ ok: true, sub, posts, updatedAt: new Date().toISOString() });
    } catch (_e: any) {
      if (cached)
        return reply.send({
          ok: true,
          sub,
          posts: cached.posts,
          updatedAt: new Date(cached.cachedAt).toISOString(),
          stale: true,
        });
      return reply.code(502).send({ ok: false, error: "reddit_fetch_failed" });
    }
  });
}
