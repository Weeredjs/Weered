/**
 * Nexus Mods poller — cache Windrose mod metadata so the lobby
 * can render crew-scoped mod intel without hammering Nexus on
 * every request. Runs daily; no-ops if NEXUSMODS_API_KEY is unset.
 */

import { PrismaClient } from "@prisma/client";

const NEXUS_BASE = "https://api.nexusmods.com/v1";
const GAME_SLUG = "windrose";
const USER_AGENT = "Weered/0.1 (+https://weered.ca; mods-browser)";

type NexusMod = {
  mod_id: number;
  name: string;
  summary?: string;
  description?: string;
  picture_url?: string;
  author?: string;
  uploaded_by?: string;
  category_id?: number;
  endorsement_count?: number;
  mod_downloads?: number;
  version?: string;
  updated_time?: string;
  created_time?: string;
  status?: string;
  available?: boolean;
};

async function nexusFetch<T>(apiKey: string, path: string): Promise<T | null> {
  try {
    const res = await fetch(`${NEXUS_BASE}${path}`, {
      headers: { apikey: apiKey, "User-Agent": USER_AGENT, Accept: "application/json" },
    });
    if (!res.ok) {
      console.warn(`[nexusPoller] ${path} → ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (e) {
    console.warn(`[nexusPoller] ${path} failed`, e);
    return null;
  }
}

async function upsertMod(prisma: PrismaClient, m: NexusMod): Promise<void> {
  if (!m?.mod_id) return;
  if (m.available === false || m.status === "hidden" || m.status === "under_moderation") return;

  const sourceId = String(m.mod_id);
  const url = `https://www.nexusmods.com/${GAME_SLUG}/mods/${m.mod_id}`;

  await (prisma as any).mod.upsert({
    where: { source_sourceId: { source: "NEXUS", sourceId } },
    update: {
      name: m.name || "",
      summary: m.summary || "",
      description: m.description || "",
      author: m.author || m.uploaded_by || "",
      thumbnailUrl: m.picture_url || null,
      sourceUrl: url,
      endorsements: m.endorsement_count ?? 0,
      downloads: m.mod_downloads ?? 0,
      sourceUpdatedAt: m.updated_time ? new Date(m.updated_time) : null,
      fetchedAt: new Date(),
    },
    create: {
      source: "NEXUS",
      sourceId,
      gameSlug: GAME_SLUG,
      name: m.name || "",
      summary: m.summary || "",
      description: m.description || "",
      author: m.author || m.uploaded_by || "",
      thumbnailUrl: m.picture_url || null,
      sourceUrl: url,
      endorsements: m.endorsement_count ?? 0,
      downloads: m.mod_downloads ?? 0,
      sourceUpdatedAt: m.updated_time ? new Date(m.updated_time) : null,
    },
  });
}

async function runPollOnce(prisma: PrismaClient, apiKey: string): Promise<number> {
  // Pull three feeds and dedupe — covers hot, fresh, and updated.
  const paths = [
    `/games/${GAME_SLUG}/mods/trending.json`,
    `/games/${GAME_SLUG}/mods/latest_added.json`,
    `/games/${GAME_SLUG}/mods/latest_updated.json`,
  ];

  const seen = new Set<number>();
  let upserts = 0;

  for (const p of paths) {
    const batch = await nexusFetch<NexusMod[]>(apiKey, p);
    if (!Array.isArray(batch)) continue;
    for (const m of batch) {
      if (!m?.mod_id || seen.has(m.mod_id)) continue;
      seen.add(m.mod_id);
      await upsertMod(prisma, m);
      upserts++;
    }
  }
  return upserts;
}

export function startNexusPoller(prisma: PrismaClient): void {
  const apiKey = (process.env.NEXUSMODS_API_KEY || "").trim();
  if (!apiKey) {
    console.log("[nexusPoller] NEXUSMODS_API_KEY not set — poller disabled");
    return;
  }

  const tick = async () => {
    try {
      const n = await runPollOnce(prisma, apiKey);
      console.log(`[nexusPoller] upserted ${n} mods`);
    } catch (e) {
      console.warn("[nexusPoller] tick failed", e);
    }
  };

  // First run after 30s so the server can settle, then every 12h.
  setTimeout(() => { void tick(); }, 30_000);
  setInterval(() => { void tick(); }, 12 * 60 * 60 * 1000);
  console.log("[nexusPoller] started");
}

/** On-demand single-mod fetch (e.g., when a chat URL links to a mod
 *  we haven't seen). Resolves and upserts; returns the upserted row. */
export async function fetchAndUpsertMod(
  prisma: PrismaClient,
  nexusModId: number,
): Promise<void> {
  const apiKey = (process.env.NEXUSMODS_API_KEY || "").trim();
  if (!apiKey) return;
  const m = await nexusFetch<NexusMod>(apiKey, `/games/${GAME_SLUG}/mods/${nexusModId}.json`);
  if (m) await upsertMod(prisma, m);
}
