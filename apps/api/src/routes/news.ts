import { htmlToText, decodeEntities } from "../lib/htmlText";
import { log } from "../lib/logger";
import type { FastifyInstance } from "fastify";
import { fetchWithTimeout } from "../lib/fetchWithTimeout";
import { prisma } from "../lib/prisma";
import { assertSafeUrl } from "../lib/ssrfGuard";
import { BoundedMap } from "../lib/boundedMap";
import { elementBlocks, findTags, firstInner, readCapped, tagAttrs } from "../lib/htmlScan";

// Rows stored before titles were decoded at ingestion still hold entities
// (&#8216;); decoding again on the way out is harmless for clean ones.
const plainTitle = <T extends { title: string }>(a: T): T => ({
  ...a,
  title: decodeEntities(a.title),
});

export default async function newsRoutes(app: FastifyInstance) {
  const newsCache = new BoundedMap<string, { articles: any[]; cachedAt: number }>(100);
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
    const articles = (
      await prisma.newsArticle.findMany({
        where: source ? { category, source } : { category },
        orderBy: source ? { publishedAt: "desc" } : { heat: "desc" },
        take: limit,
      })
    ).map(plainTitle);
    newsCache.set(cacheKey, { articles, cachedAt: Date.now() });
    return reply.send({ ok: true, articles, updatedAt: new Date().toISOString() });
  });

  app.get("/news/trending", async (_req, reply) => {
    const cached = newsCache.get("trending");
    if (cached && Date.now() - cached.cachedAt < NEWS_CACHE_TTL) {
      return reply.send({ ok: true, articles: cached.articles });
    }
    const articles = (
      await prisma.newsArticle.findMany({
        orderBy: { heat: "desc" },
        take: 10,
      })
    ).map(plainTitle);
    newsCache.set("trending", { articles, cachedAt: Date.now() });
    return reply.send({ ok: true, articles });
  });

  const readerCache = new BoundedMap<string, { data: any; cachedAt: number }>(200);
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
      // At most 1 MB, and every tag found in one pass (lib/htmlScan.ts). The
      // patterns this replaced rescanned to the end of the page from every
      // unclosed tag (fan-out audit, 2026-11-13).
      const html = await readCapped(res, 1_000_000);

      const metas: Record<string, string> = {};
      for (const a of findTags(html, "meta").map(tagAttrs)) {
        const key = (a.property || a.name || "").toLowerCase();
        if (key && a.content !== undefined && !(key in metas)) metas[key] = a.content;
      }
      const cdata = (s: string | undefined) =>
        s?.startsWith("<![CDATA[") && s.endsWith("]]>") ? s.slice(9, -3) : s;
      const ogTitle = metas["og:title"] || cdata(firstInner(html, "title", 400)) || "";
      const ogImage = metas["og:image"] || metas["twitter:image"] || null;
      const ogDesc = metas["og:description"] || metas.description || "";
      const ogSiteName = metas["og:site_name"] || "";
      const pubDate =
        metas["article:published_time"] ||
        findTags(html, "time", { limit: 5 })
          .map(tagAttrs)
          .find((a) => a.datetime)?.datetime ||
        null;
      const author = metas.author || metas["article:author"] || null;

      let body = "";
      const rawBody =
        firstInner(html, "article", 1_000_000) || firstInner(html, "main", 1_000_000) || "";

      if (rawBody) {
        const blocks: string[] = [];
        for (const b of elementBlocks(
          rawBody,
          ["h1", "h2", "h3", "h4", "h5", "h6", "p", "figcaption", "blockquote"],
          { limit: 400, blockMax: 20_000 },
        )) {
          const tag = (/^<([a-z0-9]+)/i.exec(b)?.[1] || "p").toLowerCase();
          const gt = b.indexOf(">");
          const closeAt = b.lastIndexOf("</");
          const text = htmlToText(b.slice(gt + 1, closeAt > gt ? closeAt : b.length));
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
        const images: { src: string; alt: string }[] = [];
        for (const a of findTags(rawBody, "img", { limit: 200 }).map(tagAttrs)) {
          const src = a.src || "";
          if (!src || src.length < 20) continue;
          const srcLower = src.toLowerCase();
          if (AD_PATTERNS.some((p) => srcLower.includes(p))) continue;
          if (!srcLower.startsWith("http") && !srcLower.startsWith("//")) continue;
          if (/\b[12]x[12]\b/.test(src)) continue;
          images.push({ src, alt: a.alt || "" });
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

      const decode = (s: string) => decodeEntities(s).trim();

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
