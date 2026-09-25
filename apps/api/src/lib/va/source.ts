import type { VaSnapshot, VaSource } from "./types";
import { SampleSource } from "./sampleSource";

/**
 * Which data a virtual-airline lobby runs on, and the one place stage two plugs in.
 *
 * Configuration lives in `Lobby.moduleConfig.va`:
 *   source       "sample" today. "vamsys" once an airline grants an Operations
 *                API client — a VamsysSource implementing VaSource goes here, and
 *                nothing downstream changes.
 *   seed         varies the sample airline between lobbies.
 *   airline      name, codes and the airline's own links (register, login, site).
 *   links        the EFB and other tools shown on the crew's Links tab.
 *   pilotLinks   Weered userId -> airline pilot id. With vAMSYS sign-in this is
 *                written at login; for the sample it is set by the seed script.
 *   rankImages   rank key -> 85x36 epaulette URL.
 */

export type VaLink = {
  label: string;
  url: string;
  note?: string;
  embed?: boolean; // the tool allows being framed, so it can open inside the hub
  audience?: "public" | "crew" | "staff";
};

export type VaConfig = {
  source: "sample";
  seed: string;
  airline: {
    name: string;
    legalName?: string;
    icao: string;
    iata: string;
    callsign: string;
    tagline?: string;
    website?: string;
    registerUrl?: string;
    loginUrl?: string;
    disclaimer?: string;
  };
  links: VaLink[];
  pilotLinks: Record<string, string>;
  rankImages: Record<string, string>;
};

export function vaConfigOf(moduleConfig: unknown): VaConfig | null {
  const va = (moduleConfig as any)?.va;
  if (!va || typeof va !== "object") return null;
  const obj = (x: unknown) => (x && typeof x === "object" && !Array.isArray(x) ? (x as any) : {});
  return {
    source: "sample",
    seed: typeof va.seed === "string" && va.seed ? va.seed.slice(0, 40) : "vocn",
    airline: {
      name: String(obj(va.airline).name || "Virtual Airline"),
      ...obj(va.airline),
    },
    links: Array.isArray(va.links) ? va.links.filter((l: any) => l && l.label && l.url) : [],
    pilotLinks: obj(va.pilotLinks),
    rankImages: obj(va.rankImages),
  };
}

const TTL_MS = 20_000;
const cache = new Map<string, { at: number; snap: VaSnapshot }>();

function sourceFor(cfg: VaConfig): VaSource {
  // Only one kind exists today. The switch is here so the second one is a case,
  // not a refactor.
  return new SampleSource({
    seed: cfg.seed,
    pilotLinks: cfg.pilotLinks,
    rankImages: cfg.rankImages,
  });
}

/** A snapshot for this lobby, at most TTL_MS old. */
export async function vaSnapshot(lobbyId: string, cfg: VaConfig): Promise<VaSnapshot> {
  const key = `${lobbyId}:${cfg.seed}:${JSON.stringify(cfg.pilotLinks)}:${JSON.stringify(cfg.rankImages)}`;
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && now - hit.at < TTL_MS) return hit.snap;
  const snap = await sourceFor(cfg).snapshot(now);
  cache.set(key, { at: now, snap });
  if (cache.size > 50) cache.delete(cache.keys().next().value as string);
  return snap;
}
