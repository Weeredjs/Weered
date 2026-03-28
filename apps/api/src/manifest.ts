/**
 * Bungie Manifest Cache & Hash Resolver
 * 
 * Downloads Destiny 2 manifest definition tables from Bungie CDN,
 * strips them to lightweight indices, caches to disk, and serves
 * hash → {name, icon, ...} lookups from memory.
 *
 * Usage:
 *   import { syncManifest, resolveItem, resolveActivity, ... } from "./manifest";
 *   await syncManifest(BUNGIE_API_KEY);         // call once on startup
 *   const item = resolveItem(1234567890);        // → { name, icon, tier, ... }
 */

import fs from "fs";
import path from "path";

const BUNGIE_BASE = "https://www.bungie.net";
const CACHE_DIR = path.join(process.cwd(), "manifest-cache");

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Tier / Type lookups ───────────────────────────────────────────────────────

const TIER_NAMES: Record<number, string> = {
  0: "Unknown", 1: "Currency", 2: "Common", 3: "Uncommon",
  4: "Rare", 5: "Legendary", 6: "Exotic",
};

// Well-known bucket hashes for equipment slots
export const BUCKET_HASHES = {
  KINETIC:   1498876634,
  ENERGY:    2465295065,
  POWER:     953998645,
  HELMET:    3448274439,
  GAUNTLETS: 3551918588,
  CHEST:     14239492,
  LEGS:      20886954,
  CLASS:     1585787867,
  GHOST:     4023194814,
  VEHICLE:   2025709351,
  SHIP:      284967655,
  SUBCLASS:  3284755031,
  EMBLEM:    4274335291,
  FINISHER:  3683254069,
  ARTIFACT:  1506418338,
};

export const WEAPON_BUCKETS = new Set([
  BUCKET_HASHES.KINETIC, BUCKET_HASHES.ENERGY, BUCKET_HASHES.POWER,
]);

export const ARMOR_BUCKETS = new Set([
  BUCKET_HASHES.HELMET, BUCKET_HASHES.GAUNTLETS, BUCKET_HASHES.CHEST,
  BUCKET_HASHES.LEGS, BUCKET_HASHES.CLASS,
]);

// Well-known armor stat hashes
export const ARMOR_STAT_HASHES = {
  MOBILITY:    2996146975,
  RESILIENCE:  392767087,
  RECOVERY:    1943323491,
  DISCIPLINE:  1735777505,
  INTELLECT:   144602215,
  STRENGTH:    4244567218,
};

// ── In-memory indices ─────────────────────────────────────────────────────────

const itemIndex     = new Map<string, ItemDef>();
const activityIndex = new Map<string, ActivityDef>();
const milestoneIndex = new Map<string, MilestoneDef>();
const bucketIndex   = new Map<string, BucketDef>();
const statIndex     = new Map<string, StatDef>();
const damageIndex   = new Map<string, DamageTypeDef>();
const classIndex    = new Map<string, ClassDef>();
const modifierIndex = new Map<string, ModifierDef>();

let _loaded = false;
let _version = "";
let _syncing = false;

// ── Resolvers ─────────────────────────────────────────────────────────────────

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
export function resolveItemPerks(plugHashes: number[]): { hash: number; name: string; icon: string; description: string }[] {
  return plugHashes
    .map(h => {
      const def = resolveItem(h);
      if (!def) return null;
      return { hash: h, name: def.name, icon: def.icon ? `${BUNGIE_BASE}${def.icon}` : "", description: def.description };
    })
    .filter(Boolean) as any;
}
export function isLoaded(): boolean { return _loaded; }
export function manifestVersion(): string { return _version; }

// ── Enrichment helpers ────────────────────────────────────────────────────────

/**
 * Given raw Bungie profile response (from components 200,201,205,300,102),
 * return enriched character data with resolved item names/icons/stats.
 */
export function enrichProfile(profileData: any) {
  const characters = profileData?.characters?.data || {};
  const equipment  = profileData?.characterEquipment?.data || {};
  const inventories = profileData?.characterInventories?.data || {};
  const instances  = profileData?.itemComponents?.instances?.data || {};
  const sockets    = profileData?.itemComponents?.sockets?.data || {};
  const itemStats  = profileData?.itemComponents?.stats?.data || {};
  const vaultItems = profileData?.profileInventory?.data?.items || [];

  // Build enriched characters
  const enrichedChars = Object.entries(characters).map(([charId, char]: [string, any]) => {
    const equippedItems = (equipment[charId]?.items || []).map((item: any) => enrichItem(item, instances, sockets, itemStats));
    const inventoryItems = (inventories[charId]?.items || []).map((item: any) => enrichItem(item, instances, sockets, itemStats));

    // Group equipped by slot
    const weapons = equippedItems.filter((i: any) => WEAPON_BUCKETS.has(i.bucketHash));
    const armor   = equippedItems.filter((i: any) => ARMOR_BUCKETS.has(i.bucketHash));
    const other   = equippedItems.filter((i: any) => !WEAPON_BUCKETS.has(i.bucketHash) && !ARMOR_BUCKETS.has(i.bucketHash));

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

  // Enrich vault
  const enrichedVault = vaultItems.map((item: any) => enrichItem(item, instances, sockets, itemStats));

  return {
    characters: enrichedChars,
    vault: enrichedVault,
    vaultCount: enrichedVault.length,
  };
}

function enrichItem(
  item: any,
  instances: Record<string, any>,
  sockets?: Record<string, any>,
  itemStats?: Record<string, any>,
) {
  const def = resolveItem(item.itemHash);
  const instance = instances[item.itemInstanceId] || {};
  const bucket = resolveBucket(item.bucketHash || def?.bucketHash || 0);
  const damage = resolveDamageType(instance.damageTypeHash || def?.damageTypeHash || 0);
  const bHash = item.bucketHash || def?.bucketHash || 0;

  // Resolve perks from component 304 socket data (live instance perks)
  let perks: { hash: number; name: string; icon: string; isEnabled: boolean }[] = [];
  const socketData = sockets?.[item.itemInstanceId]?.sockets;
  if (socketData && Array.isArray(socketData)) {
    perks = socketData
      .filter((s: any) => s.plugHash && s.plugHash !== 0)
      .map((s: any) => {
        const plugDef = resolveItem(s.plugHash);
        if (!plugDef || !plugDef.name) return null;
        return {
          hash: s.plugHash,
          name: plugDef.name,
          icon: plugDef.icon ? `${BUNGIE_BASE}${plugDef.icon}` : "",
          isEnabled: s.isEnabled ?? true,
        };
      })
      .filter(Boolean) as any;
  } else if (def?.socketEntries) {
    // Fallback: use manifest default perks
    perks = def.socketEntries
      .map(s => {
        const plugDef = resolveItem(s.plugHash);
        if (!plugDef || !plugDef.name) return null;
        return { hash: s.plugHash, name: plugDef.name, icon: plugDef.icon ? `${BUNGIE_BASE}${plugDef.icon}` : "", isEnabled: true };
      })
      .filter(Boolean) as any;
  }

  // Armor stats from component 302
  let armorStats: any = undefined;
  if (ARMOR_BUCKETS.has(bHash) && itemStats?.[item.itemInstanceId]?.stats) {
    const stats = itemStats[item.itemInstanceId].stats;
    const m = Number(stats[ARMOR_STAT_HASHES.MOBILITY]?.value || 0);
    const res = Number(stats[ARMOR_STAT_HASHES.RESILIENCE]?.value || 0);
    const rec = Number(stats[ARMOR_STAT_HASHES.RECOVERY]?.value || 0);
    const d = Number(stats[ARMOR_STAT_HASHES.DISCIPLINE]?.value || 0);
    const i = Number(stats[ARMOR_STAT_HASHES.INTELLECT]?.value || 0);
    const s = Number(stats[ARMOR_STAT_HASHES.STRENGTH]?.value || 0);
    armorStats = { mobility: m, resilience: res, recovery: rec, discipline: d, intellect: i, strength: s, total: m + res + rec + d + i + s };
  }

  return {
    itemHash: item.itemHash,
    itemInstanceId: item.itemInstanceId,
    quantity: item.quantity || 1,
    bucketHash: bHash,
    // Resolved fields
    name: def?.name || `Unknown (${item.itemHash})`,
    icon: def?.icon ? `${BUNGIE_BASE}${def.icon}` : "",
    tierName: def?.tierName || "Unknown",
    tierType: def?.tierType || 0,
    itemType: def?.itemType || 0,
    description: def?.description || "",
    watermark: def?.watermark ? `${BUNGIE_BASE}${def.watermark}` : "",
    // Instance data
    primaryStat: instance.primaryStat?.value || null,
    damageType: damage?.name || null,
    damageIcon: damage?.icon ? `${BUNGIE_BASE}${damage.icon}` : null,
    isEquipped: instance.isEquipped || false,
    canEquip: instance.canEquip ?? true,
    // Slot name
    slotName: bucket?.name || "",
    // Perks & stats (Phase 2)
    perks,
    armorStats,
  };
}

/**
 * Enrich Xur vendor sale items with manifest data + socket perks
 */
export function enrichVendorSales(
  salesData: Record<string, any>,
  socketsData?: Record<string, any>,
) {
  const items: any[] = [];
  for (const [vendorItemIndex, sale] of Object.entries(salesData)) {
    const itemHash = (sale as any).itemHash;
    if (!itemHash) continue;
    const def = resolveItem(itemHash);
    if (!def) continue;

    // Resolve perks from component 304 vendor socket data
    let perks: { hash: number; name: string; icon: string }[] = [];
    const itemSockets = socketsData?.[vendorItemIndex]?.sockets;
    if (itemSockets && Array.isArray(itemSockets)) {
      perks = itemSockets
        .filter((s: any) => s.plugHash && s.plugHash !== 0)
        .map((s: any) => {
          const plugDef = resolveItem(s.plugHash);
          if (!plugDef || !plugDef.name) return null;
          return { hash: s.plugHash, name: plugDef.name, icon: plugDef.icon ? `${BUNGIE_BASE}${plugDef.icon}` : "" };
        })
        .filter(Boolean) as any;
    } else if (def.socketEntries) {
      perks = def.socketEntries
        .map(s => {
          const plugDef = resolveItem(s.plugHash);
          if (!plugDef || !plugDef.name) return null;
          return { hash: s.plugHash, name: plugDef.name, icon: plugDef.icon ? `${BUNGIE_BASE}${plugDef.icon}` : "" };
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
      costs: (sale as any).costs || [],
    });
  }
  // Exotics first, then by tier
  items.sort((a, b) => (b.tierType || 0) - (a.tierType || 0));
  return items;
}

/**
 * Enrich weekly milestones with resolved names and activity details
 */
export function enrichMilestones(milestonesData: Record<string, any>) {
  const result: any[] = [];

  for (const [hash, ms] of Object.entries(milestonesData)) {
    const def = resolveMilestone(hash);

    const activities = (ms.activities || []).map((act: any) => {
      const actDef = resolveActivity(act.activityHash);
      const modifiers = (act.modifierHashes || []).map((mh: number) => {
        const mod = resolveModifier(mh);
        return mod ? { hash: mh, name: mod.name, icon: `${BUNGIE_BASE}${mod.icon}`, description: mod.description } : { hash: mh };
      }).filter((m: any) => m.name);

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

  // Sort: named milestones first, then by activity count
  result.sort((a, b) => {
    const aKnown = a.name.startsWith("Milestone") ? 0 : 1;
    const bKnown = b.name.startsWith("Milestone") ? 0 : 1;
    if (aKnown !== bKnown) return bKnown - aKnown;
    return (b.activities?.length || 0) - (a.activities?.length || 0);
  });

  return result;
}

// ── Sync / Download ───────────────────────────────────────────────────────────

/**
 * Download manifest definitions from Bungie CDN and build in-memory indices.
 * Safe to call multiple times — will skip if already syncing.
 * Caches stripped indices to disk for fast restart.
 */
export async function syncManifest(apiKey: string): Promise<{ ok: boolean; version: string; counts: Record<string, number> }> {
  if (_syncing) return { ok: false, version: _version, counts: {} };
  _syncing = true;

  try {
    // Ensure cache dir exists
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

    // Check if we have a recent cache on disk
    const metaPath = path.join(CACHE_DIR, "_meta.json");
    let diskMeta: any = null;
    try {
      if (fs.existsSync(metaPath)) {
        diskMeta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
      }
    } catch {}

    // Fetch manifest metadata from Bungie
    console.log("[manifest] Fetching manifest metadata...");
    const metaRes = await fetch(`${BUNGIE_BASE}/Platform/Destiny2/Manifest/`, {
      headers: { "X-API-Key": apiKey },
    });
    if (!metaRes.ok) throw new Error(`Manifest metadata failed: ${metaRes.status}`);
    const meta = await metaRes.json();
    const version = meta?.Response?.version || "unknown";
    const jsonPaths = meta?.Response?.jsonWorldComponentContentPaths?.en || {};

    console.log(`[manifest] Version: ${version}`);

    // If disk cache is same version and loaded, skip download
    if (diskMeta?.version === version && _loaded) {
      console.log("[manifest] Already up to date.");
      _syncing = false;
      return { ok: true, version, counts: { items: itemIndex.size, activities: activityIndex.size } };
    }

    // If disk cache is same version but not loaded in memory, load from disk
    if (diskMeta?.version === version && !_loaded) {
      console.log("[manifest] Loading from disk cache...");
      loadFromDisk();
      if (_loaded) {
        _version = version;
        _syncing = false;
        return { ok: true, version, counts: getCounts() };
      }
    }

    // Download needed definition tables
    const tables: [string, string, (raw: Record<string, any>) => void][] = [
      ["DestinyInventoryItemDefinition", jsonPaths.DestinyInventoryItemDefinition, buildItemIndex],
      ["DestinyActivityDefinition", jsonPaths.DestinyActivityDefinition, buildActivityIndex],
      ["DestinyMilestoneDefinition", jsonPaths.DestinyMilestoneDefinition, buildMilestoneIndex],
      ["DestinyInventoryBucketDefinition", jsonPaths.DestinyInventoryBucketDefinition, buildBucketIndex],
      ["DestinyStatDefinition", jsonPaths.DestinyStatDefinition, buildStatIndex],
      ["DestinyDamageTypeDefinition", jsonPaths.DestinyDamageTypeDefinition, buildDamageIndex],
      ["DestinyClassDefinition", jsonPaths.DestinyClassDefinition, buildClassIndex],
      ["DestinyActivityModifierDefinition", jsonPaths.DestinyActivityModifierDefinition, buildModifierIndex],
    ];

    for (const [name, jsonPath, builder] of tables) {
      if (!jsonPath) { console.log(`[manifest] Skipping ${name} — no path`); continue; }
      try {
        const url = `${BUNGIE_BASE}${jsonPath}`;
        console.log(`[manifest] Downloading ${name}...`);
        const res = await fetch(url);
        if (!res.ok) { console.error(`[manifest] ${name} failed: ${res.status}`); continue; }
        const raw = await res.json();
        const count = Object.keys(raw).length;
        console.log(`[manifest] ${name}: ${count} entries`);
        builder(raw);
      } catch (e) {
        console.error(`[manifest] ${name} error:`, e);
      }
    }

    // Save stripped indices to disk
    saveToDisk(version);
    _loaded = true;
    _version = version;

    const counts = getCounts();
    console.log("[manifest] Sync complete:", counts);
    _syncing = false;
    return { ok: true, version, counts };

  } catch (e) {
    console.error("[manifest] Sync failed:", e);
    _syncing = false;
    return { ok: false, version: _version, counts: getCounts() };
  }
}

// ── Index builders ────────────────────────────────────────────────────────────

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
    // Extract default socket plugs (perks/mods) — cap at 10 per item
    const sockets = def.sockets?.socketEntries;
    if (sockets && Array.isArray(sockets)) {
      entry.socketEntries = sockets
        .filter((s: any) => s.singleInitialItemHash && s.singleInitialItemHash !== 0)
        .slice(0, 10)
        .map((s: any) => ({ plugHash: s.singleInitialItemHash, socketTypeHash: s.socketTypeHash || 0 }));
    }
    itemIndex.set(hash, entry);
  }
}

function buildActivityIndex(raw: Record<string, any>) {
  activityIndex.clear();
  for (const [hash, def] of Object.entries(raw)) {
    const dp = def?.displayProperties;
    if (!dp?.name) continue;
    activityIndex.set(hash, {
      name: dp.name,
      icon: dp.icon || "",
      description: (dp.description || "").slice(0, 200),
      lightLevel: def.activityLightLevel || 0,
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

// ── Disk persistence ──────────────────────────────────────────────────────────

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
    fs.writeFileSync(path.join(CACHE_DIR, "_meta.json"), JSON.stringify({ version, savedAt: new Date().toISOString() }));
    console.log("[manifest] Saved to disk.");
  } catch (e) {
    console.error("[manifest] Disk save failed:", e);
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
    console.log("[manifest] Loaded from disk:", getCounts());
  } catch (e) {
    console.error("[manifest] Disk load failed:", e);
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

/**
 * Try to load from disk on import (non-blocking).
 * Full sync (with CDN download) requires calling syncManifest().
 */
try { loadFromDisk(); } catch {}
