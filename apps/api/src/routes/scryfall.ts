import type { FastifyInstance } from "fastify";
import { fetchWithTimeout } from "../lib/fetchWithTimeout";

type Opts = {};

const SCRYFALL_UA = "Weered/1.0 (+https://weered.ca; contact: james@weered.ca)";
const SCRYFALL_BASE = "https://api.scryfall.com";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const NEGATIVE_CACHE_TTL_MS = 60 * 60 * 1000;
const MIN_GAP_MS = 100;

export default async function scryfallRoutes(app: FastifyInstance, _opts: Opts) {
  type CardLite = {
    name: string;
    set: string;
    set_name: string;
    mana_cost: string | null;
    type_line: string | null;
    oracle_text: string | null;
    image: string | null;
    image_small: string | null;
    scryfall_uri: string;
    colors: string[];
    cmc: number;
  };

  const cache = new Map<string, { ok: boolean; data: CardLite | null; expiresAt: number }>();
  let lastFetchAt = 0;

  function cacheKey(name: string) {
    return name.trim().toLowerCase();
  }

  function pickImage(card: any): { normal: string | null; small: string | null } {
    if (card?.image_uris?.normal)
      return { normal: card.image_uris.normal, small: card.image_uris.small || null };
    const face = card?.card_faces?.[0];
    if (face?.image_uris?.normal)
      return { normal: face.image_uris.normal, small: face.image_uris.small || null };
    return { normal: null, small: null };
  }

  function flatten(card: any): CardLite {
    const img = pickImage(card);
    const face0 = card?.card_faces?.[0];
    return {
      name: String(card?.name || ""),
      set: String(card?.set || ""),
      set_name: String(card?.set_name || ""),
      mana_cost: card?.mana_cost ?? face0?.mana_cost ?? null,
      type_line: card?.type_line ?? face0?.type_line ?? null,
      oracle_text: card?.oracle_text ?? face0?.oracle_text ?? null,
      image: img.normal,
      image_small: img.small,
      scryfall_uri: String(
        card?.scryfall_uri ||
          `https://scryfall.com/search?q=!${encodeURIComponent(card?.name || "")}`,
      ),
      colors: Array.isArray(card?.colors)
        ? card.colors
        : Array.isArray(face0?.colors)
          ? face0.colors
          : [],
      cmc: Number.isFinite(card?.cmc) ? card.cmc : 0,
    };
  }

  async function throttle() {
    const now = Date.now();
    const gap = now - lastFetchAt;
    if (gap < MIN_GAP_MS) {
      await new Promise((r) => setTimeout(r, MIN_GAP_MS - gap));
    }
    lastFetchAt = Date.now();
  }

  async function fetchCard(name: string): Promise<{ ok: boolean; data: CardLite | null }> {
    const key = cacheKey(name);
    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return { ok: cached.ok, data: cached.data };

    await throttle();
    try {
      const url = `${SCRYFALL_BASE}/cards/named?fuzzy=${encodeURIComponent(name)}`;
      const res = await fetchWithTimeout(url, {
        headers: { "User-Agent": SCRYFALL_UA, Accept: "application/json" },
      });
      if (res.status === 404) {
        cache.set(key, { ok: false, data: null, expiresAt: Date.now() + NEGATIVE_CACHE_TTL_MS });
        return { ok: false, data: null };
      }
      if (!res.ok) return { ok: false, data: null };
      const json: any = await res.json();
      const card = flatten(json);
      cache.set(key, { ok: true, data: card, expiresAt: Date.now() + CACHE_TTL_MS });
      return { ok: true, data: card };
    } catch {
      return { ok: false, data: null };
    }
  }

  app.get("/scryfall/card", async (req, reply) => {
    const name = String((req.query as any)?.name || "")
      .trim()
      .slice(0, 200);
    if (!name) return reply.code(400).send({ ok: false, error: "missing_name" });
    const { ok, data } = await fetchCard(name);
    if (!ok || !data) return reply.code(404).send({ ok: false, error: "not_found", query: name });
    return reply.send({ ok: true, card: data });
  });

  app.get("/scryfall/cards", async (req, reply) => {
    const raw = String((req.query as any)?.names || "");
    const names = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 10);
    if (names.length === 0) return reply.code(400).send({ ok: false, error: "missing_names" });
    const out: Record<string, CardLite | null> = {};
    for (const n of names) {
      const { ok, data } = await fetchCard(n);
      out[n] = ok ? data : null;
    }
    return reply.send({ ok: true, cards: out });
  });
}
