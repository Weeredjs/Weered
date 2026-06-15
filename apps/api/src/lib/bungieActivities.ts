import { fetchWithTimeout } from "./fetchWithTimeout";
import type { PrismaClient } from "@prisma/client";
import { resolveActivity } from "../manifest";

class BungieRateLimiter {
  private tokens: number;
  private maxTokens: number;
  private lastRefill: number = Date.now();
  private queue: Array<{ resolve: () => void }> = [];

  constructor(maxPerSecond = 20) {
    this.tokens = maxPerSecond;
    this.maxTokens = maxPerSecond;
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens > 0) {
      this.tokens--;
      return;
    }
    return new Promise((resolve) => {
      this.queue.push({ resolve });
      setTimeout(() => this.refill(), 1100);
    });
  }

  private refill() {
    const now = Date.now();
    if (now - this.lastRefill >= 1000) {
      this.tokens = Math.min(this.maxTokens, this.tokens + this.maxTokens);
      this.lastRefill = now;
      while (this.queue.length > 0 && this.tokens > 0) {
        this.tokens--;
        this.queue.shift()!.resolve();
      }
    }
  }
}

const rateLimiter = new BungieRateLimiter(20);

let _bungieApiKey = "";
const BUNGIE_ROOT = "https://www.bungie.net/Platform";

export function setBungieApiKey(key: string) {
  _bungieApiKey = key;
}
export function getBungieApiKey() {
  return _bungieApiKey;
}

export async function bungieGet(path: string): Promise<any> {
  await rateLimiter.acquire();
  const res = await fetchWithTimeout(`${BUNGIE_ROOT}${path}`, {
    headers: { "X-API-Key": _bungieApiKey },
  });
  const _t = await res.text();
  try {
    return JSON.parse(_t);
  } catch {
    return null;
  }
}

export const MODE_NAMES: Record<number, string> = {
  0: "None",
  2: "Story",
  3: "Strike",
  4: "Raid",
  5: "PvP",
  6: "Patrol",
  7: "PvE",
  10: "Control",
  12: "Clash",
  16: "Nightfall",
  18: "Heroic",
  19: "Mayhem",
  25: "Rumble",
  31: "Supremacy",
  37: "Survival",
  38: "Countdown",
  39: "Trials",
  43: "Iron Banner",
  46: "Scorched",
  48: "Gambit",
  63: "Reckoning",
  69: "Dungeon",
  73: "Offensive",
  75: "Dares",
  84: "Quickplay",
};

export type ActivityEntry = {
  activityInstanceId: string;
  activityHash: string;
  mode: number;
  period: string;
  kills: number;
  deaths: number;
  assists: number;
  score: number;
  standing: number;
  completed: boolean;
  duration: number;
  weaponKills: { hash: string; kills: number }[];
};

export async function fetchRecentActivities(
  membershipType: string | number,
  membershipId: string,
  characterId: string,
  count = 25,
): Promise<ActivityEntry[]> {
  const res = await bungieGet(
    `/Destiny2/${membershipType}/Account/${membershipId}/Character/${characterId}/Stats/Activities/?count=${count}&mode=0`,
  );
  const activities = res?.Response?.activities || [];
  return activities.map((a: any) => {
    const vals = a.values || {};
    return {
      activityInstanceId: a.activityDetails?.instanceId || "",
      activityHash: String(a.activityDetails?.referenceId || ""),
      mode: a.activityDetails?.mode || 0,
      period: a.period || "",
      kills: vals.kills?.basic?.value ?? 0,
      deaths: vals.deaths?.basic?.value ?? 0,
      assists: vals.assists?.basic?.value ?? 0,
      score: vals.score?.basic?.value ?? 0,
      standing: vals.standing?.basic?.value ?? 1,
      completed: vals.completed?.basic?.value === 1 || vals.completionReason?.basic?.value === 0,
      duration: vals.activityDurationSeconds?.basic?.value ?? 0,
      weaponKills: [],
    };
  });
}

export type PgcrDetail = {
  weaponKills: { hash: string; kills: number }[];
  selectedSkullHashes: string[];
  activityDifficultyTier: number | null;
};

export async function fetchPGCR(
  activityInstanceId: string,
  membershipId: string,
): Promise<{ hash: string; kills: number }[]> {
  const d = await fetchPGCRDetail(activityInstanceId, membershipId);
  return d.weaponKills;
}

export async function fetchPGCRDetail(
  activityInstanceId: string,
  membershipId: string,
): Promise<PgcrDetail> {
  const empty: PgcrDetail = {
    weaponKills: [],
    selectedSkullHashes: [],
    activityDifficultyTier: null,
  };
  try {
    const res = await bungieGet(`/Destiny2/Stats/PostGameCarnageReport/${activityInstanceId}/`);
    const r = res?.Response;
    if (!r) return empty;
    const entries = r.entries || [];
    const playerEntry = entries.find(
      (e: any) => String(e.player?.destinyUserInfo?.membershipId) === membershipId,
    );
    const weapons = playerEntry?.extended?.weapons || [];
    const weaponKills = weapons
      .map((w: any) => ({
        hash: String(w.referenceId || ""),
        kills: w.values?.uniqueWeaponKills?.basic?.value ?? 0,
      }))
      .filter((w: any) => w.kills > 0);

    const skulls = Array.isArray(r.selectedSkullHashes)
      ? r.selectedSkullHashes.map((h: any) => String(h)).filter((h: string) => h && h !== "0")
      : [];
    const uniqueSkulls = Array.from(new Set(skulls)) as string[];
    return {
      weaponKills,
      selectedSkullHashes: uniqueSkulls,
      activityDifficultyTier:
        typeof r.activityDifficultyTier === "number" ? r.activityDifficultyTier : null,
    };
  } catch {
    return empty;
  }
}

export async function pollAndStoreActivities(
  prisma: PrismaClient,
  userId: string,
  opts: { count?: number; force?: boolean } = {},
): Promise<ActivityEntry[]> {
  const acct = await prisma.userGameAccount.findFirst({
    where: { userId, gameType: "BUNGIE" },
    select: { externalId: true, platform: true },
  });
  if (!acct?.externalId || !acct.platform) return [];

  const profileRes = await bungieGet(
    `/Destiny2/${acct.platform}/Profile/${acct.externalId}/?components=100,200`,
  );
  const charIds: string[] = profileRes?.Response?.profile?.data?.characterIds || [];
  if (charIds.length === 0) return [];

  const charData = profileRes?.Response?.characters?.data || {};
  const sortedCharIds = charIds.slice().sort((a, b) => {
    const da = new Date(charData[a]?.dateLastPlayed || 0).getTime();
    const db = new Date(charData[b]?.dateLastPlayed || 0).getTime();
    return db - da;
  });

  const activities = await fetchRecentActivities(
    acct.platform,
    acct.externalId,
    sortedCharIds[0],
    opts.count ?? 25,
  );

  for (const act of activities) {
    if (!act.activityInstanceId) continue;
    const actDef = resolveActivity(act.activityHash);
    await prisma.bungieActivityLog
      .upsert({
        where: {
          userId_activityInstanceId: { userId, activityInstanceId: act.activityInstanceId },
        },
        create: {
          userId,
          membershipId: acct.externalId,
          activityInstanceId: act.activityInstanceId,
          activityHash: act.activityHash,
          activityName: actDef?.name || "",
          mode: act.mode,
          modeName: MODE_NAMES[act.mode] || "",
          period: new Date(act.period),
          kills: act.kills,
          deaths: act.deaths,
          assists: act.assists,
          score: act.score,
          standing: act.standing,
          completed: act.completed,
          duration: act.duration,
          weaponKills: act.weaponKills as any,
        },
        update: {},
      })
      .catch(() => {});
  }

  return activities;
}
