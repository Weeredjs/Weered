import { log, swallow } from "./lib/logger";
import fs from "fs";
import path from "path";

const BUNGIE_BASE = "https://www.bungie.net";
const CACHE_DIR = path.join(process.cwd(), "manifest-cache");

export interface ItemDef {
  name: string;
  icon: string;
  itemType: number;
  itemSubType: number;
  tierType: number;
  tierName: string;
  bucketHash: number;
  damageTypeHash: number;
  description: string;
  watermark: string;
  socketEntries?: { plugHash: number; socketTypeHash: number }[];
}

export interface ActivityDef {
  name: string;
  icon: string;
  description: string;
  lightLevel: number;
  modifierHashes: string[];
  difficultyTier: number | null;
}

export interface MilestoneDef {
  name: string;
  icon: string;
  description: string;
}

export interface BucketDef {
  name: string;
  category: number;
  sortOrder: number;
}

export interface StatDef {
  name: string;
  description: string;
}

export interface DamageTypeDef {
  name: string;
  icon: string;
  enumValue: number;
}

export interface ClassDef {
  name: string;
}

export interface ModifierDef {
  name: string;
  icon: string;
  description: string;
}

const TIER_NAMES: Record<number, string> = {
  0: "Unknown",
  1: "Currency",
  2: "Common",
  3: "Uncommon",
  4: "Rare",
  5: "Legendary",
  6: "Exotic",
};

export const BUCKET_HASHES = {
  KINETIC: 1498876634,
  ENERGY: 2465295065,
  POWER: 953998645,
  HELMET: 3448274439,
  GAUNTLETS: 3551918588,
  CHEST: 14239492,
  LEGS: 20886954,
  CLASS: 1585787867,
  GHOST: 4023194814,
  VEHICLE: 2025709351,
  SHIP: 284967655,
  SUBCLASS: 3284755031,
  EMBLEM: 4274335291,
  FINISHER: 3683254069,
  ARTIFACT: 1506418338,
};

export const WEAPON_BUCKETS = new Set([
  BUCKET_HASHES.KINETIC,
  BUCKET_HASHES.ENERGY,
  BUCKET_HASHES.POWER,
]);

export const ARMOR_BUCKETS = new Set([
  BUCKET_HASHES.HELMET,
  BUCKET_HASHES.GAUNTLETS,
  BUCKET_HASHES.CHEST,
  BUCKET_HASHES.LEGS,
  BUCKET_HASHES.CLASS,
]);

export const ARMOR_STAT_HASHES = {
  MOBILITY: 2996146975,
  RESILIENCE: 392767087,
  RECOVERY: 1943323491,
  DISCIPLINE: 1735777505,
  INTELLECT: 144602215,
  STRENGTH: 4244567218,
};

const itemIndex = new Map<string, ItemDef>();
const activityIndex = new Map<string, ActivityDef>();
const milestoneIndex = new Map<string, MilestoneDef>();
const bucketIndex = new Map<string, BucketDef>();
const statIndex = new Map<string, StatDef>();
const damageIndex = new Map<string, DamageTypeDef>();
const classIndex = new Map<string, ClassDef>();
const modifierIndex = new Map<string, ModifierDef>();

let _loaded = false;
let _version = "";
let _syncing = false;

export function resolveItem(hash: number | string): ItemDef | null {
  return itemIndex.get(String(hash)) || null;
}
export function resolveActivity(hash: number | string): ActivityDef | null {
  return activityIndex.get(String(hash)) || null;
}
export function resolveMilestone(hash: number | string): MilestoneDef | null {
  return milestoneIndex.get(String(hash)) || null;
}
export function resolveBucket(hash: number | string): BucketDef | null {
  return bucketIndex.get(String(hash)) || null;
}
export function resolveStat(hash: number | string): StatDef | null {
  return statIndex.get(String(hash)) || null;
}
export function resolveDamageType(hash: number | string): DamageTypeDef | null {
  return damageIndex.get(String(hash)) || null;
}
export function resolveClass(hash: number | string): ClassDef | null {
  return classIndex.get(String(hash)) || null;
}
export function resolveModifier(hash: number | string): ModifierDef | null {
  return modifierIndex.get(String(hash)) || null;
}
export function resolveItemPerks(
  plugHashes: number[],
): { hash: number; name: string; icon: string; description: string }[] {
  return plugHashes
    .map((h) => {
      const def = resolveItem(h);
      if (!def) return null;
      return {
        hash: h,
        name: def.name,
        icon: def.icon ? `${BUNGIE_BASE}${def.icon}` : "",
        description: def.description,
      };
    })
    .filter(Boolean) as any;
}
export function isLoaded(): boolean {
  return _loaded;
}
export function manifestVersion(): string {
  return _version;
}

export function enrichProfile(profileData: any) {
  const characters = profileData?.characters?.data || {};
  const equipment = profileData?.characterEquipment?.data || {};
  const inventories = profileData?.characterInventories?.data || {};
  const instances = profileData?.itemComponents?.instances?.data || {};
  const sockets = profileData?.itemComponents?.sockets?.data || {};
  const reusablePlugs = profileData?.itemComponents?.reusablePlugs?.data || {};
  const itemStats = profileData?.itemComponents?.stats?.data || {};
  const vaultItems = profileData?.profileInventory?.data?.items || [];

  const enrichedChars = Object.entries(characters).map(([charId, char]: [string, any]) => {
    const equippedItems = (equipment[charId]?.items || []).map((item: any) =>
      enrichItem(item, instances, sockets, itemStats, reusablePlugs),
    );
    const inventoryItems = (inventories[charId]?.items || []).map((item: any) =>
      enrichItem(item, instances, sockets, itemStats, reusablePlugs),
    );

    const weapons = equippedItems.filter((i: any) => WEAPON_BUCKETS.has(i.bucketHash));
    const armor = equippedItems.filter((i: any) => ARMOR_BUCKETS.has(i.bucketHash));
    const other = equippedItems.filter(
      (i: any) => !WEAPON_BUCKETS.has(i.bucketHash) && !ARMOR_BUCKETS.has(i.bucketHash),
    );

    return {
      characterId: charId,
      classType: char.classType,
      className: ["Titan", "Hunter", "Warlock"][char.classType] || "Unknown",
      raceType: char.raceType,
      raceName: ["Human", "Awoken", "Exo"][char.raceType] || "Unknown",
      light: char.light,
      emblemPath: char.emblemPath,
      emblemBackgroundPath: char.emblemBackgroundPath,
      dateLastPlayed: char.dateLastPlayed,
      minutesPlayedTotal: char.minutesPlayedTotal,
      titleRecordHash: char.titleRecordHash,
      equipped: equippedItems,
      weapons,
      armor,
      otherEquipped: other,
      inventory: inventoryItems,
    };
  });

  const enrichedVault = vaultItems.map((item: any) =>
    enrichItem(item, instances, sockets, itemStats, reusablePlugs),
  );

  return {
    characters: enrichedChars,
    vault: enrichedVault,
    vaultCount: enrichedVault.length,
  };
}

const HIDDEN_PLUG_NAMES = new Set([
  "Empty Mod Socket",
  "Empty Tuning Mod Socket",
  "Default Shader",
  "Default Ornament",
  "Upgrade Armor",
  "Upgrade Weapon",
  "Kill Tracker",
  "Crucible Tracker",
  "Memento Tracker",
  "Empty Catalyst Socket",
  "Empty Activity Mod Socket",
]);

function enrichItem(
  item: any,
  instances: Record<string, any>,
  sockets?: Record<string, any>,
  itemStats?: Record<string, any>,
  reusablePlugs?: Record<string, any>,
) {
  const def = resolveItem(item.itemHash);
  const instance = instances[item.itemInstanceId] || {};
  const bucket = resolveBucket(item.bucketHash || def?.bucketHash || 0);
  const damage = resolveDamageType(instance.damageTypeHash || def?.damageTypeHash || 0);
  const bHash = item.bucketHash || def?.bucketHash || 0;

  let perks: {
    hash: number;
    name: string;
    icon: string;
    description: string;
    isEnabled: boolean;
    isJunk: boolean;
    socketIndex: number;
    availablePlugs?: { hash: number; name: string; icon: string; description: string }[];
  }[] = [];
  const socketData = sockets?.[item.itemInstanceId]?.sockets;
  const reusableData = reusablePlugs?.[item.itemInstanceId]?.plugs;

  if (socketData && Array.isArray(socketData)) {
    perks = socketData
      .map((s: any, idx: number) => {
        if (!s.plugHash || s.plugHash === 0) return null;
        if (s.isVisible === false) return null;
        const plugDef = resolveItem(s.plugHash);
        if (!plugDef || !plugDef.name) return null;
        const isJunk = HIDDEN_PLUG_NAMES.has(plugDef.name);

        let availablePlugs:
          | { hash: number; name: string; icon: string; description: string }[]
          | undefined;
        if (reusableData?.[String(idx)]) {
          availablePlugs = reusableData[String(idx)]
            .filter(
              (rp: any) =>
                rp.plugItemHash && rp.plugItemHash !== s.plugHash && rp.canInsert !== false,
            )
            .map((rp: any) => {
              const rpDef = resolveItem(rp.plugItemHash);
              if (!rpDef || !rpDef.name || HIDDEN_PLUG_NAMES.has(rpDef.name)) return null;
              return {
                hash: rp.plugItemHash,
                name: rpDef.name,
                icon: rpDef.icon ? `${BUNGIE_BASE}${rpDef.icon}` : "",
                description: rpDef.description || "",
              };
            })
            .filter(Boolean)
            .slice(0, 12);
          if (availablePlugs!.length === 0) availablePlugs = undefined;
        }

        return {
          hash: s.plugHash,
          name: plugDef.name,
          icon: plugDef.icon ? `${BUNGIE_BASE}${plugDef.icon}` : "",
          description: plugDef.description || "",
          isEnabled: s.isEnabled ?? true,
          isJunk,
          socketIndex: idx,
          availablePlugs,
        };
      })
      .filter(Boolean) as any;
  } else if (def?.socketEntries) {
    perks = def.socketEntries
      .map((s, idx) => {
        const plugDef = resolveItem(s.plugHash);
        if (!plugDef || !plugDef.name) return null;
        return {
          hash: s.plugHash,
          name: plugDef.name,
          icon: plugDef.icon ? `${BUNGIE_BASE}${plugDef.icon}` : "",
          description: plugDef.description || "",
          isEnabled: true,
          isJunk: HIDDEN_PLUG_NAMES.has(plugDef.name),
          socketIndex: idx,
        };
      })
      .filter(Boolean) as any;
  }

  let armorStats: any = undefined;
  if (ARMOR_BUCKETS.has(bHash) && itemStats?.[item.itemInstanceId]?.stats) {
    const stats = itemStats[item.itemInstanceId].stats;
    const m = Number(stats[ARMOR_STAT_HASHES.MOBILITY]?.value || 0);
    const res = Number(stats[ARMOR_STAT_HASHES.RESILIENCE]?.value || 0);
    const rec = Number(stats[ARMOR_STAT_HASHES.RECOVERY]?.value || 0);
    const d = Number(stats[ARMOR_STAT_HASHES.DISCIPLINE]?.value || 0);
    const i = Number(stats[ARMOR_STAT_HASHES.INTELLECT]?.value || 0);
    const s = Number(stats[ARMOR_STAT_HASHES.STRENGTH]?.value || 0);
    armorStats = {
      mobility: m,
      resilience: res,
      recovery: rec,
      discipline: d,
      intellect: i,
      strength: s,
      total: m + res + rec + d + i + s,
    };
  }

  return {
    itemHash: item.itemHash,
    itemInstanceId: item.itemInstanceId,
    quantity: item.quantity || 1,
    bucketHash: bHash,
    name: def?.name || `Unknown (${item.itemHash})`,
    icon: def?.icon ? `${BUNGIE_BASE}${def.icon}` : "",
    tierName: def?.tierName || "Unknown",
    tierType: def?.tierType || 0,
    itemType: def?.itemType || 0,
    description: def?.description || "",
    watermark: def?.watermark ? `${BUNGIE_BASE}${def.watermark}` : "",
    primaryStat: instance.primaryStat?.value || null,
    damageType: damage?.name || null,
    damageIcon: damage?.icon ? `${BUNGIE_BASE}${damage.icon}` : null,
    isEquipped: instance.isEquipped || false,
    canEquip: instance.canEquip ?? true,
    slotName: bucket?.name || "",
    perks,
    armorStats,
  };
}

export function enrichVendorSales(
  salesData: Record<string, any>,
  socketsData?: Record<string, any>,
) {
  const items: any[] = [];
  for (const [vendorItemIndex, sale] of Object.entries(salesData)) {
    const itemHash = sale.itemHash;
    if (!itemHash) continue;
    const def = resolveItem(itemHash);
    if (!def) continue;

    let perks: { hash: number; name: string; icon: string }[] = [];
    const itemSockets = socketsData?.[vendorItemIndex]?.sockets;
    if (itemSockets && Array.isArray(itemSockets)) {
      perks = itemSockets
        .filter((s: any) => s.plugHash && s.plugHash !== 0)
        .map((s: any) => {
          const plugDef = resolveItem(s.plugHash);
          if (!plugDef || !plugDef.name) return null;
          return {
            hash: s.plugHash,
            name: plugDef.name,
            icon: plugDef.icon ? `${BUNGIE_BASE}${plugDef.icon}` : "",
          };
        })
        .filter(Boolean) as any;
    } else if (def.socketEntries) {
      perks = def.socketEntries
        .map((s) => {
          const plugDef = resolveItem(s.plugHash);
          if (!plugDef || !plugDef.name) return null;
          return {
            hash: s.plugHash,
            name: plugDef.name,
            icon: plugDef.icon ? `${BUNGIE_BASE}${plugDef.icon}` : "",
          };
        })
        .filter(Boolean) as any;
    }

    items.push({
      itemHash,
      vendorItemIndex: Number(vendorItemIndex),
      name: def.name,
      icon: def.icon ? `${BUNGIE_BASE}${def.icon}` : "",
      tierName: def.tierName,
      tierType: def.tierType,
      itemType: def.itemType,
      itemSubType: def.itemSubType,
      bucketHash: def.bucketHash,
      description: def.description,
      watermark: def.watermark ? `${BUNGIE_BASE}${def.watermark}` : "",
      perks,
      costs: sale.costs || [],
    });
  }
  items.sort((a, b) => (b.tierType || 0) - (a.tierType || 0));
  return items;
}

export function enrichMilestones(milestonesData: Record<string, any>) {
  const result: any[] = [];

  for (const [hash, ms] of Object.entries(milestonesData)) {
    const def = resolveMilestone(hash);

    const activities = (ms.activities || []).map((act: any) => {
      const actDef = resolveActivity(act.activityHash);
      const modifiers = (act.modifierHashes || [])
        .map((mh: number) => {
          const mod = resolveModifier(mh);
          return mod
            ? {
                hash: mh,
                name: mod.name,
                icon: `${BUNGIE_BASE}${mod.icon}`,
                description: mod.description,
              }
            : { hash: mh };
        })
        .filter((m: any) => m.name);

      return {
        activityHash: act.activityHash,
        name: actDef?.name || `Activity ${act.activityHash}`,
        icon: actDef?.icon ? `${BUNGIE_BASE}${actDef.icon}` : "",
        description: actDef?.description || "",
        lightLevel: actDef?.lightLevel || 0,
        modifiers,
        phases: act.phaseHashes?.length || 0,
      };
    });

    result.push({
      hash,
      name: def?.name || `Milestone ${hash}`,
      icon: def?.icon ? `${BUNGIE_BASE}${def.icon}` : "",
      description: def?.description || "",
      activities,
      availableQuests: ms.availableQuests?.length || 0,
      startDate: ms.startDate,
      endDate: ms.endDate,
    });
  }

  result.sort((a, b) => {
    const aKnown = a.name.startsWith("Milestone") ? 0 : 1;
    const bKnown = b.name.startsWith("Milestone") ? 0 : 1;
    if (aKnown !== bKnown) return bKnown - aKnown;
    return (b.activities?.length || 0) - (a.activities?.length || 0);
  });

  return result;
}

export async function syncManifest(
  apiKey: string,
): Promise<{ ok: boolean; version: string; counts: Record<string, number> }> {
  if (_syncing) return { ok: false, version: _version, counts: {} };
  _syncing = true;

  try {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

    const metaPath = path.join(CACHE_DIR, "_meta.json");
    let diskMeta: any = null;
    try {
      if (fs.existsSync(metaPath)) {
        diskMeta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
      }
    } catch (e) {
      swallow(e);
    }

    log.log("[manifest] Fetching manifest metadata...");
    const metaRes = await fetch(`${BUNGIE_BASE}/Platform/Destiny2/Manifest/`, {
      headers: { "X-API-Key": apiKey },
    });
    if (!metaRes.ok) throw new Error(`Manifest metadata failed: ${metaRes.status}`);
    const meta = await metaRes.json();
    const version = meta?.Response?.version || "unknown";
    const jsonPaths = meta?.Response?.jsonWorldComponentContentPaths?.en || {};

    log.log(`[manifest] Version: ${version}`);

    if (diskMeta?.version === version && _loaded) {
      log.log("[manifest] Already up to date.");
      _syncing = false;
      return {
        ok: true,
        version,
        counts: { items: itemIndex.size, activities: activityIndex.size },
      };
    }

    if (diskMeta?.version === version && !_loaded) {
      log.log("[manifest] Loading from disk cache...");
      loadFromDisk();
      if (_loaded) {
        _version = version;
        _syncing = false;
        return { ok: true, version, counts: getCounts() };
      }
    }

    const tables: [string, string, (raw: Record<string, any>) => void][] = [
      ["DestinyInventoryItemDefinition", jsonPaths.DestinyInventoryItemDefinition, buildItemIndex],
      ["DestinyActivityDefinition", jsonPaths.DestinyActivityDefinition, buildActivityIndex],
      ["DestinyMilestoneDefinition", jsonPaths.DestinyMilestoneDefinition, buildMilestoneIndex],
      [
        "DestinyInventoryBucketDefinition",
        jsonPaths.DestinyInventoryBucketDefinition,
        buildBucketIndex,
      ],
      ["DestinyStatDefinition", jsonPaths.DestinyStatDefinition, buildStatIndex],
      ["DestinyDamageTypeDefinition", jsonPaths.DestinyDamageTypeDefinition, buildDamageIndex],
      ["DestinyClassDefinition", jsonPaths.DestinyClassDefinition, buildClassIndex],
      [
        "DestinyActivityModifierDefinition",
        jsonPaths.DestinyActivityModifierDefinition,
        buildModifierIndex,
      ],
    ];

    for (const [name, jsonPath, builder] of tables) {
      if (!jsonPath) {
        log.log(`[manifest] Skipping ${name} — no path`);
        continue;
      }
      try {
        const url = `${BUNGIE_BASE}${jsonPath}`;
        log.log(`[manifest] Downloading ${name}...`);
        const res = await fetch(url);
        if (!res.ok) {
          log.error(`[manifest] ${name} failed: ${res.status}`);
          continue;
        }
        const raw = await res.json();
        const count = Object.keys(raw).length;
        log.log(`[manifest] ${name}: ${count} entries`);
        builder(raw);
      } catch (e) {
        log.error(`[manifest] ${name} error:`, e);
      }
    }

    saveToDisk(version);
    _loaded = true;
    _version = version;

    const counts = getCounts();
    log.log("[manifest] Sync complete:", counts);
    _syncing = false;
    return { ok: true, version, counts };
  } catch (e) {
    log.error("[manifest] Sync failed:", e);
    _syncing = false;
    return { ok: false, version: _version, counts: getCounts() };
  }
}

function buildItemIndex(raw: Record<string, any>) {
  itemIndex.clear();
  for (const [hash, def] of Object.entries(raw)) {
    const dp = def?.displayProperties;
    if (!dp?.name) continue;
    const entry: ItemDef = {
      name: dp.name,
      icon: dp.icon || "",
      itemType: def.itemType || 0,
      itemSubType: def.itemSubType || 0,
      tierType: def.inventory?.tierType || 0,
      tierName: TIER_NAMES[def.inventory?.tierType || 0] || "Unknown",
      bucketHash: def.inventory?.bucketTypeHash || 0,
      damageTypeHash: def.defaultDamageTypeHash || 0,
      description: (dp.description || "").slice(0, 200),
      watermark: def.iconWatermark || "",
    };
    const sockets = def.sockets?.socketEntries;
    if (sockets && Array.isArray(sockets)) {
      entry.socketEntries = sockets
        .filter((s: any) => s.singleInitialItemHash && s.singleInitialItemHash !== 0)
        .slice(0, 10)
        .map((s: any) => ({
          plugHash: s.singleInitialItemHash,
          socketTypeHash: s.socketTypeHash || 0,
        }));
    }
    itemIndex.set(hash, entry);
  }
}

function inferTierFromName(n: string): number | null {
  const low = (n || "").toLowerCase();
  if (low.includes("grandmaster")) return 5;
  if (low.includes("master")) return 4;
  if (low.includes("legend")) return 3;
  if (low.includes("hero")) return 2;
  if (low.includes("normal") || low.includes("adept")) return 1;
  return null;
}

function buildActivityIndex(raw: Record<string, any>) {
  activityIndex.clear();
  for (const [hash, def] of Object.entries(raw)) {
    const dp = def?.displayProperties;
    if (!dp?.name) continue;
    const modifierHashes: string[] = Array.isArray(def.modifiers)
      ? def.modifiers
          .map((m: any) => String(m?.activityModifierHash || ""))
          .filter((h: string) => h)
      : [];
    activityIndex.set(hash, {
      name: dp.name,
      icon: dp.icon || "",
      description: (dp.description || "").slice(0, 200),
      lightLevel: def.activityLightLevel || 0,
      modifierHashes,
      difficultyTier: inferTierFromName(dp.name),
    });
  }
}

function buildMilestoneIndex(raw: Record<string, any>) {
  milestoneIndex.clear();
  for (const [hash, def] of Object.entries(raw)) {
    const dp = def?.displayProperties;
    if (!dp?.name) continue;
    milestoneIndex.set(hash, {
      name: dp.name,
      icon: dp.icon || "",
      description: (dp.description || "").slice(0, 200),
    });
  }
}

function buildBucketIndex(raw: Record<string, any>) {
  bucketIndex.clear();
  for (const [hash, def] of Object.entries(raw)) {
    const dp = def?.displayProperties;
    bucketIndex.set(hash, {
      name: dp?.name || "",
      category: def.category || 0,
      sortOrder: def.bucketOrder || 0,
    });
  }
}

function buildStatIndex(raw: Record<string, any>) {
  statIndex.clear();
  for (const [hash, def] of Object.entries(raw)) {
    const dp = def?.displayProperties;
    if (!dp?.name) continue;
    statIndex.set(hash, {
      name: dp.name,
      description: (dp.description || "").slice(0, 120),
    });
  }
}

function buildDamageIndex(raw: Record<string, any>) {
  damageIndex.clear();
  for (const [hash, def] of Object.entries(raw)) {
    const dp = def?.displayProperties;
    if (!dp?.name) continue;
    damageIndex.set(hash, {
      name: dp.name,
      icon: dp.icon || "",
      enumValue: def.enumValue || 0,
    });
  }
}

function buildClassIndex(raw: Record<string, any>) {
  classIndex.clear();
  for (const [hash, def] of Object.entries(raw)) {
    const dp = def?.displayProperties;
    if (!dp?.name) continue;
    classIndex.set(hash, { name: dp.name });
  }
}

function buildModifierIndex(raw: Record<string, any>) {
  modifierIndex.clear();
  for (const [hash, def] of Object.entries(raw)) {
    const dp = def?.displayProperties;
    if (!dp?.name) continue;
    modifierIndex.set(hash, {
      name: dp.name,
      icon: dp.icon || "",
      description: (dp.description || "").slice(0, 200),
    });
  }
}

function saveToDisk(version: string) {
  try {
    const serialize = (m: Map<string, any>) => JSON.stringify(Object.fromEntries(m));
    fs.writeFileSync(path.join(CACHE_DIR, "items.json"), serialize(itemIndex));
    fs.writeFileSync(path.join(CACHE_DIR, "activities.json"), serialize(activityIndex));
    fs.writeFileSync(path.join(CACHE_DIR, "milestones.json"), serialize(milestoneIndex));
    fs.writeFileSync(path.join(CACHE_DIR, "buckets.json"), serialize(bucketIndex));
    fs.writeFileSync(path.join(CACHE_DIR, "stats.json"), serialize(statIndex));
    fs.writeFileSync(path.join(CACHE_DIR, "damage.json"), serialize(damageIndex));
    fs.writeFileSync(path.join(CACHE_DIR, "classes.json"), serialize(classIndex));
    fs.writeFileSync(path.join(CACHE_DIR, "modifiers.json"), serialize(modifierIndex));
    fs.writeFileSync(
      path.join(CACHE_DIR, "_meta.json"),
      JSON.stringify({ version, savedAt: new Date().toISOString() }),
    );
    log.log("[manifest] Saved to disk.");
  } catch (e) {
    log.error("[manifest] Disk save failed:", e);
  }
}

function loadFromDisk() {
  try {
    const load = (file: string, target: Map<string, any>) => {
      const fp = path.join(CACHE_DIR, file);
      if (!fs.existsSync(fp)) return;
      const data = JSON.parse(fs.readFileSync(fp, "utf-8"));
      target.clear();
      for (const [k, v] of Object.entries(data)) target.set(k, v);
    };
    load("items.json", itemIndex);
    load("activities.json", activityIndex);
    load("milestones.json", milestoneIndex);
    load("buckets.json", bucketIndex);
    load("stats.json", statIndex);
    load("damage.json", damageIndex);
    load("classes.json", classIndex);
    load("modifiers.json", modifierIndex);
    _loaded = true;
    log.log("[manifest] Loaded from disk:", getCounts());
  } catch (e) {
    log.error("[manifest] Disk load failed:", e);
  }
}

function getCounts() {
  return {
    items: itemIndex.size,
    activities: activityIndex.size,
    milestones: milestoneIndex.size,
    buckets: bucketIndex.size,
    stats: statIndex.size,
    damageTypes: damageIndex.size,
    classes: classIndex.size,
    modifiers: modifierIndex.size,
  };
}

try {
  loadFromDisk();
} catch (e) {
  swallow(e);
}
