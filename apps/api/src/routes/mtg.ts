import { swallow } from "../lib/logger";
import type { FastifyInstance } from "fastify";
import { fetchWithTimeout } from "../lib/fetchWithTimeout";

type Opts = {};

const UA = "Weered/1.0 (+https://weered.ca; contact: james@weered.ca)";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const NEG_TTL_MS = 30 * 60 * 1000;

type DeckLite = {
  source: "moxfield" | "archidekt";
  id: string;
  name: string;
  format: string | null;
  author: string | null;
  cardCount: number | null;
  colors: string[];
  commanders: string[];
  url: string;
  thumbnail: string | null;
};

async function fetchMoxfield(deckId: string): Promise<DeckLite | null> {
  try {
    const res = await fetchWithTimeout(
      `https://api.moxfield.com/v2/decks/all/${encodeURIComponent(deckId)}`,
      {
        headers: { "User-Agent": UA, Accept: "application/json" },
      },
    );
    if (!res.ok) return null;
    const j: any = await res.json();
    const commanders: string[] = [];
    const commandersBlock = j?.commanders ?? j?.boards?.commanders?.cards ?? {};
    for (const k of Object.keys(commandersBlock)) {
      const c = commandersBlock[k];
      const n = c?.card?.name || c?.name;
      if (n) commanders.push(n);
    }
    const colors: string[] = Array.isArray(j?.colors)
      ? j.colors
      : Array.isArray(j?.colorIdentity)
        ? j.colorIdentity
        : [];
    const cardCount =
      typeof j?.mainboardCount === "number"
        ? j.mainboardCount
        : typeof j?.boards?.mainboard?.count === "number"
          ? j.boards.mainboard.count
          : null;
    const thumbnail = commanders[0]
      ? `https://api.scryfall.com/cards/named?format=image&version=art_crop&fuzzy=${encodeURIComponent(commanders[0])}`
      : null;
    return {
      source: "moxfield",
      id: deckId,
      name: String(j?.name || "Untitled deck"),
      format: j?.format ?? null,
      author: j?.createdByUser?.userName ?? j?.createdByUser?.displayName ?? null,
      cardCount,
      colors,
      commanders,
      url: `https://www.moxfield.com/decks/${deckId}`,
      thumbnail,
    };
  } catch {
    return null;
  }
}

async function fetchArchidekt(deckId: string): Promise<DeckLite | null> {
  try {
    const res = await fetchWithTimeout(
      `https://archidekt.com/api/decks/${encodeURIComponent(deckId)}/`,
      {
        headers: { "User-Agent": UA, Accept: "application/json" },
      },
    );
    if (!res.ok) return null;
    const j: any = await res.json();
    const commanders: string[] = [];
    if (Array.isArray(j?.cards)) {
      for (const c of j.cards) {
        const cats: string[] = Array.isArray(c?.categories) ? c.categories : [];
        if (cats.some((x) => /commander/i.test(x))) {
          const n = c?.card?.oracleCard?.name || c?.card?.name;
          if (n) commanders.push(n);
        }
      }
    }
    const colors = Array.isArray(j?.deckFormat?.colors)
      ? j.deckFormat.colors
      : Array.isArray(j?.colors)
        ? j.colors
        : [];
    const cardCount = typeof j?.size === "number" ? j.size : null;
    const thumbnail = commanders[0]
      ? `https://api.scryfall.com/cards/named?format=image&version=art_crop&fuzzy=${encodeURIComponent(commanders[0])}`
      : null;
    return {
      source: "archidekt",
      id: deckId,
      name: String(j?.name || "Untitled deck"),
      format: j?.deckFormat?.name ?? j?.format ?? null,
      author: j?.owner?.username ?? null,
      cardCount,
      colors,
      commanders,
      url: `https://archidekt.com/decks/${deckId}`,
      thumbnail,
    };
  } catch {
    return null;
  }
}

function parseUrl(raw: string): { source: "moxfield" | "archidekt"; id: string } | null {
  try {
    const u = new URL(raw);
    if (/(^|\.)moxfield\.com$/.test(u.hostname)) {
      const m = u.pathname.match(/^\/decks\/([\w-]+)/);
      if (m) return { source: "moxfield", id: m[1] };
    }
    if (/(^|\.)archidekt\.com$/.test(u.hostname)) {
      const m = u.pathname.match(/^\/decks\/(\d+)/);
      if (m) return { source: "archidekt", id: m[1] };
    }
  } catch (e) {
    swallow(e);
  }
  return null;
}

export default async function mtgRoutes(app: FastifyInstance, _opts: Opts) {
  const cache = new Map<string, { ok: boolean; data: DeckLite | null; expiresAt: number }>();

  app.get("/mtg/deck", async (req, reply) => {
    const url = String((req.query as any)?.url || "")
      .trim()
      .slice(0, 500);
    if (!url) return reply.code(400).send({ ok: false, error: "missing_url" });
    const parsed = parseUrl(url);
    if (!parsed) return reply.code(400).send({ ok: false, error: "unsupported_url" });
    const key = `${parsed.source}:${parsed.id}`;
    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      if (!cached.ok || !cached.data)
        return reply.code(404).send({ ok: false, error: "not_found" });
      return reply.send({ ok: true, deck: cached.data });
    }
    const data =
      parsed.source === "moxfield"
        ? await fetchMoxfield(parsed.id)
        : await fetchArchidekt(parsed.id);
    if (!data) {
      cache.set(key, { ok: false, data: null, expiresAt: Date.now() + NEG_TTL_MS });
      return reply.code(404).send({ ok: false, error: "not_found" });
    }
    cache.set(key, { ok: true, data, expiresAt: Date.now() + CACHE_TTL_MS });
    return reply.send({ ok: true, deck: data });
  });
}
