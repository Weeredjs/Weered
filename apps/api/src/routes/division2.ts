import type { FastifyInstance } from "fastify";
import { fetchWithTimeout } from "../lib/fetchWithTimeout";

// Official Ubisoft server-status feed — the same endpoint their public status
// page (ubisoft.com/.../the-division-2/status) calls from its own JS. The
// Ubi-AppId header value is that page's public web-app id, not a secret; the
// three applicationIds are The Division 2 on PC / PS4 / Xbox One.
const UBI_STATUS_URL =
  "https://public-ubiservices.ubi.com/v1/applications/gameStatuses?applicationIds=" +
  [
    "6c6b8cd7-d901-4cd5-8279-07ba92088f06", // PC
    "6f220906-8a24-4b6a-a356-db5498501572", // PS4
    "7d9bbf16-d76d-43e1-9e82-1e64b4dd5543", // Xbox One
  ].join(",");
const UBI_WEB_APPID = "5c5d3b21-e1fc-4460-9213-87b4cd440d44";

const PLATFORM_LABEL: Record<string, string> = {
  PC: "PC",
  ORBIS: "PlayStation",
  DURANGO: "Xbox",
};

export type Division2Status = {
  updatedAt: string;
  platforms: { platform: string; status: string; maintenance: boolean; impacted: string[] }[];
};

let _statusCache: { data: Division2Status; exp: number } | null = null;

// Shared by the /division2/status route and the Division 2 worker (Operator
// sit-reps) so both ride one cache and Ubisoft sees one caller.
export async function fetchDivision2Status(): Promise<Division2Status | null> {
  if (_statusCache && _statusCache.exp > Date.now()) return _statusCache.data;
  try {
    const r = await fetchWithTimeout(UBI_STATUS_URL, {
      headers: {
        "Ubi-AppId": UBI_WEB_APPID,
        "User-Agent": "Weered/1.0 (contact: legal@weered.ca)",
        Accept: "application/json",
      },
    });
    if (!r.ok) throw new Error(`ubi status ${r.status}`);
    const j: any = await r.json();
    const platforms = (Array.isArray(j?.gameStatuses) ? j.gameStatuses : []).map((g: any) => ({
      platform: PLATFORM_LABEL[String(g.platformType)] || String(g.platformType || "?"),
      status: String(g.status || "unknown"),
      maintenance: Boolean(g.isMaintenance),
      impacted: Array.isArray(g.impactedFeatures) ? g.impactedFeatures.map(String) : [],
    }));
    const data: Division2Status = {
      updatedAt: String(j?.lastModifiedAt || new Date().toISOString()),
      platforms,
    };
    _statusCache = { data, exp: Date.now() + 5 * 60_000 };
    return data;
  } catch {
    return _statusCache?.data ?? null;
  }
}

// Official announcements (patch notes, State of the Game, events) via Steam's
// keyless ISteamNews feed for the Division 2 app. Cached 15 min.
const STEAM_NEWS_URL =
  "https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=2221490&count=8&maxlength=280";

type NewsItem = { title: string; url: string; date: string; source: string; snippet: string };
let _newsCache: { data: NewsItem[]; exp: number } | null = null;

function stripMarkup(s: string): string {
  return s
    .replace(/\[img\][^[]*\[\/img\]/gi, "")
    .replace(/\[[^\]]{1,24}\]/g, "") // bbcode tags
    .replace(/<[^>]+>/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchDivision2News(): Promise<NewsItem[]> {
  if (_newsCache && _newsCache.exp > Date.now()) return _newsCache.data;
  const r = await fetchWithTimeout(STEAM_NEWS_URL, {
    headers: { "User-Agent": "Weered/1.0 (contact: legal@weered.ca)", Accept: "application/json" },
  });
  if (!r.ok) throw new Error(`steam news ${r.status}`);
  const j: any = await r.json();
  const items: NewsItem[] = (j?.appnews?.newsitems || [])
    .filter((n: any) => n && n.title && n.url)
    .map((n: any) => ({
      title: String(n.title),
      url: String(n.url),
      date: new Date((Number(n.date) || 0) * 1000).toISOString(),
      source: String(n.feedlabel || "Steam"),
      snippet: stripMarkup(String(n.contents || "")).slice(0, 180),
    }));
  _newsCache = { data: items, exp: Date.now() + 15 * 60_000 };
  return items;
}

export default async function division2Routes(app: FastifyInstance) {
  app.get("/division2/status", async (_req, reply) => {
    const data = await fetchDivision2Status();
    if (data) return reply.send({ ok: true, ...data });
    return reply.send({ ok: false, platforms: [] });
  });

  app.get("/division2/news", async (_req, reply) => {
    try {
      const items = await fetchDivision2News();
      return reply.send({ ok: true, items });
    } catch {
      // Serve stale on upstream failure rather than an empty board.
      if (_newsCache) return reply.send({ ok: true, stale: true, items: _newsCache.data });
      return reply.send({ ok: false, items: [] });
    }
  });
}
