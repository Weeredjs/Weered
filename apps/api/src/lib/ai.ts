import { getAllSiteConfig } from "./siteConfig";
import { log, swallow } from "./logger";

// AI availability + lazy Anthropic SDK loader + cached SiteConfig flags,
// extracted from index.ts. The SDK is import()'d on first use so the API
// boots without it. getSiteFlags refreshes lazily (<=15s) so per-request
// hooks never hammer the DB.

let _anthropicModule: any = null;
let _anthropicLoaded = false;

// Cached SiteConfig flags (aiEnabled, maintenanceMode), refreshed lazily (<=15s)
// so per-request hooks never hammer the DB. registrationOpen is read directly.
let _siteFlags: Record<string, string> = {};
let _siteFlagsAt = 0;
export async function getSiteFlags(): Promise<Record<string, string>> {
  const now = Date.now();
  if (now - _siteFlagsAt > 15000) {
    try {
      _siteFlags = await getAllSiteConfig();
      _siteFlagsAt = now;
    } catch (e) {
      swallow(e);
    }
  }
  return _siteFlags;
}

export async function getAI(): Promise<any | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  if ((await getSiteFlags()).aiEnabled === "false") return null;
  if (!_anthropicLoaded) {
    _anthropicLoaded = true;
    try {
      _anthropicModule = await import("@anthropic-ai/sdk");
    } catch (e) {
      log.error("[ai] Failed to load @anthropic-ai/sdk:", e);
      _anthropicModule = null;
    }
  }
  if (!_anthropicModule) return null;
  const Cls = _anthropicModule.default || _anthropicModule.Anthropic || _anthropicModule;
  return new Cls({ apiKey: key });
}

export function isAIAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY) && _siteFlags.aiEnabled !== "false";
}
