import { log } from "../lib/logger";
import type { FastifyInstance } from "fastify";
import { fetchWithTimeout } from "../lib/fetchWithTimeout";
import { prisma } from "../lib/prisma";
import { assertSafeUrl } from "../lib/ssrfGuard";

export default async function newsRoutes(app: FastifyInstance) {
  const newsCache = new Map<string, { articles: any[]; cachedAt: number }>();
  const NEWS_CACHE_TTL = 5 * 60 * 1000;

  app.get("/news/feed", async (req, reply) => {
    const category = String((req as any).query?.category || "top").toLowerCase();
    const limit = Math.min(Number((req as any).query?.limit) || 30, 60);
    const source = String((req as any).query?.source || "").trim();
    const cacheKey = `feed:${category}:${source}:${limit}`;
    const cached = newsCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < NEWS_CACHE_TTL) {
      return reply.send({
        ok: true,
        articles: cached.articles,
        updatedAt: new Date(cached.cachedAt).toISOString(),
      });
    }
    const articles = await prisma.newsArticle.findMany({
      where: source ? { category, source } : { category },
      orderBy: source ? { publishedAt: "desc" } : { heat: "desc" },
      take: limit,
    });
    newsCache.set(cacheKey, { articles, cachedAt: Date.now() });
    return reply.send({ ok: true, articles, updatedAt: new Date().toISOString() });
  });

  app.get("/news/trending", async (_req, reply) => {
    const cached = newsCache.get("trending");
    if (cached && Date.now() - cached.cachedAt < NEWS_CACHE_TTL) {
      return reply.send({ ok: true, articles: cached.articles });
    }
    const articles = await prisma.newsArticle.findMany({
      orderBy: { heat: "desc" },
      take: 10,
    });
    newsCache.set("trending", { articles, cachedAt: Date.now() });
    return reply.send({ ok: true, articles });
  });

  const readerCache = new Map<string, { data: any; cachedAt: number }>();
  const READER_CACHE_TTL = 30 * 60 * 1000;

  app.get("/news/reader", async (req, reply) => {
    const url = String((req as any).query?.url || "").trim();
    if (!url || !url.startsWith("http"))
      return reply.code(400).send({ ok: false, error: "url required" });

    // SSRF defense: the reader only ever opens articles already in the feed.
    // Restrict to URLs we ingested from trusted RSS sources, and additionally
    // block any URL that resolves to a private/metadata address.
    const known = await prisma.newsArticle.findFirst({ where: { url }, select: { id: true } });
    if (!known) return reply.code(403).send({ ok: false, error: "url_not_allowed" });
    try {
      await assertSafeUrl(url);
    } catch {
      return reply.code(403).send({ ok: false, error: "url_not_allowed" });
    }

    const cached = readerCache.get(url);
    if (cached && Date.now() - cached.cachedAt < READER_CACHE_TTL) {
      return reply.send(cached.data);
    }

    try {
      const res = await fetchWithTimeout(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; Weered/1.0; +https://weered.ca)" },
        redirect: "follow",
      });
      if (!res.ok) return reply.code(502).send({ ok: false, error: "fetch_failed" });
      const html = await res.text();

      const ogTitle =
        html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)?.[1] ||
        html.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i)?.[1] ||
        "";
      const ogImage =
        html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)?.[1] ||
        html.match(/<meta[^>]+name="twitter:image"[^>]+content="([^"]+)"/i)?.[1] ||
        null;
      const ogDesc =
        html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i)?.[1] ||
        html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i)?.[1] ||
        "";
      const ogSiteName =
        html.match(/<meta[^>]+property="og:site_name"[^>]+content="([^"]+)"/i)?.[1] || "";
      const pubDate =
        html.match(/<meta[^>]+property="article:published_time"[^>]+content="([^"]+)"/i)?.[1] ||
        html.match(/<time[^>]+datetime="([^"]+)"/i)?.[1] ||
        null;
      const author =
        html.match(/<meta[^>]+name="author"[^>]+content="([^"]+)"/i)?.[1] ||
        html.match(/<meta[^>]+property="article:author"[^>]+content="([^"]+)"/i)?.[1] ||
        null;

      let body = "";
      const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
      const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
      const rawBody = articleMatch?.[1] || mainMatch?.[1] || "";

      if (rawBody) {
        const blocks: string[] = [];
        const blockRx = /<(h[1-6]|p|figcaption|blockquote)[^>]*>([\s\S]*?)<\/\1>/gi;
        let bm: RegExpExecArray | null;
        while ((bm = blockRx.exec(rawBody)) !== null) {
          const tag = bm[1].toLowerCase();
          const text = bm[2]
            .replaceAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, "$2")
            .replaceAll(/<[^>]+>/g, "")
            .replaceAll(/&amp;/g, "&")
            .replaceAll(/&lt;/g, "<")
            .replaceAll(/&gt;/g, ">")
            .replaceAll(/&quot;/g, '"')
            .replaceAll(/&#39;/g, "'")
            .replaceAll(/&apos;/g, "'")
            .replaceAll(/&#x27;/g, "'")
            .replaceAll(/&#x2F;/g, "/")
            .replaceAll(/&#(\d+);/g, (_: string, n: string) => String.fromCodePoint(Number(n)))
            .replaceAll(/&#x([0-9a-fA-F]+);/g, (_: string, h: string) =>
              String.fromCodePoint(Number.parseInt(h, 16)),
            )
            .replaceAll(/&nbsp;/g, " ")
            .replaceAll(/\s+/g, " ")
            .trim();
          if (!text || text.length < 10) continue;
          if (tag.startsWith("h")) {
            blocks.push(`## ${text}`);
          } else if (tag === "blockquote") {
            blocks.push(`> ${text}`);
          } else {
            blocks.push(text);
          }
        }
        body = blocks.join("\n\n");

        const AD_PATTERNS = [
          "logo",
          "icon",
          "avatar",
          "1x1",
          "tracking",
          "pixel",
          "beacon",
          "doubleclick",
          "googlesyndication",
          "googleads",
          "adsystem",
          "adservice",
          "amazon-adsystem",
          "facebook.com/tr",
          "chartbeat",
          "scorecardresearch",
          "taboola",
          "outbrain",
          "sharethrough",
          "sponsor",
          "promo",
          "badge",
          "widget",
          "button",
          "banner",
          "advert",
          "newsletter",
          "signup",
          "data:image",
          "base64",
          ".gif",
          "spacer",
          "blank",
          "transparent",
          "tinyimg",
          "placeholder",
          "lazy",
          "emoji",
          "smiley",
        ];
        const imgRx = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
        const imgAltRx = /\balt=["']([^"']*)["']/i;
        const images: { src: string; alt: string }[] = [];
        let im: RegExpExecArray | null;
        while ((im = imgRx.exec(rawBody)) !== null) {
          const src = im[1];
          if (!src || src.length < 20) continue;
          const srcLower = src.toLowerCase();
          if (AD_PATTERNS.some((p) => srcLower.includes(p))) continue;
          if (!srcLower.startsWith("http") && !srcLower.startsWith("//")) continue;
          if (/\b[12]x[12]\b/.test(src)) continue;
          images.push({ src, alt: (imgAltRx.exec(im[0]) || [])[1] || "" });
        }
        if (images.length && body) {
          const paras = body.split("\n\n");
          for (let i = 0; i < Math.min(images.length, 2); i++) {
            const pos = Math.min(2 + i * 4, paras.length);
            if (pos < paras.length) {
              paras.splice(pos, 0, `![${images[i].alt}](${images[i].src})`);
            }
          }
          body = paras.join("\n\n");
        }
      }

      const decode = (s: string) =>
        s
          .replaceAll(/&amp;/g, "&")
          .replaceAll(/&lt;/g, "<")
          .replaceAll(/&gt;/g, ">")
          .replaceAll(/&quot;/g, '"')
          .replaceAll(/&#39;/g, "'")
          .replaceAll(/&apos;/g, "'")
          .replaceAll(/&#x27;/g, "'")
          .replaceAll(/&#x2F;/g, "/")
          .replaceAll(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
          .replaceAll(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(Number.parseInt(h, 16)))
          .replaceAll(/&nbsp;/g, " ")
          .trim();

      const data = {
        ok: true,
        title: decode(ogTitle),
        description: decode(ogDesc),
        image: ogImage,
        siteName: decode(ogSiteName),
        author: author ? decode(author) : null,
        publishedAt: pubDate,
        body: body || decode(ogDesc),
        url,
      };

      readerCache.set(url, { data, cachedAt: Date.now() });
      return reply.send(data);
    } catch (e) {
      log.warn("[news] reader failed:", url, e);
      return reply.code(502).send({ ok: false, error: "extraction_failed" });
    }
  });
}
