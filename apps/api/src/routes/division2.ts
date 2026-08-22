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

type StatusPayload = {
  updatedAt: string;
  platforms: { platform: string; status: string; maintenance: boolean; impacted: string[] }[];
};

let _statusCache: { data: StatusPayload; exp: number } | null = null;

export default async function division2Routes(app: FastifyInstance) {
  app.get("/division2/status", async (_req, reply) => {
    if (_statusCache && _statusCache.exp > Date.now()) {
      return reply.send({ ok: true, cached: true, ..._statusCache.data });
    }
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
      const data: StatusPayload = {
        updatedAt: String(j?.lastModifiedAt || new Date().toISOString()),
        platforms,
      };
      _statusCache = { data, exp: Date.now() + 5 * 60_000 };
      return reply.send({ ok: true, ...data });
    } catch {
      // Serve stale on upstream failure rather than an empty board.
      if (_statusCache) return reply.send({ ok: true, stale: true, ..._statusCache.data });
      return reply.send({ ok: false, platforms: [] });
    }
  });
}
