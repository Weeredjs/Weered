import { log, swallow } from "../lib/logger";
import { fetchWithTimeout } from "../lib/fetchWithTimeout";
import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import * as fs from "fs";
import * as path from "path";
import {
  syncManifest,
  enrichProfile,
  enrichMilestones,
  enrichVendorSales,
  resolveItem,
  resolveBucket,
  resolveDamageType,
  resolveActivity,
  isLoaded as manifestLoaded,
  manifestVersion,
  WEAPON_BUCKETS,
  ARMOR_BUCKETS,
  ARMOR_STAT_HASHES,
} from "../manifest";
import { signOAuthState, verifyOAuthState } from "../lib/oauthState";

type Opts = {
  authFromHeader: (h?: string) => { id: string; name?: string } | null;
  awardNotoriety: (userId: string, action: string) => Promise<number | null>;
};

export default async function bungieRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, awardNotoriety } = opts;
  const BUNGIE_API_KEY = process.env.BUNGIE_API_KEY || "";
  const BUNGIE_CLIENT_ID = process.env.BUNGIE_CLIENT_ID || "";
  const BUNGIE_CLIENT_SECRET = process.env.BUNGIE_CLIENT_SECRET || "";
  const BUNGIE_ROOT = "https://www.bungie.net/Platform";
  const SITE_URL = process.env.SITE_URL || "https://weered.ca";

  async function bungieGet(path: string, accessToken?: string) {
    const headers: Record<string, string> = { "X-API-Key": BUNGIE_API_KEY };
    if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
    const res = await fetchWithTimeout(`${BUNGIE_ROOT}${path}`, { headers });
    const j = await res.json();
    if (j.error) log.error("[bungie]", path, JSON.stringify(j.error));
    return j;
  }

  async function bungieGetCached(key: string, path: string, ttlMinutes: number) {
    try {
      const cached = await prisma.bungieCache.findUnique({ where: { key } });
      if (cached && new Date(cached.expiresAt) > new Date()) return cached.data;
    } catch (e) {
      swallow(e);
    }
    if (!BUNGIE_API_KEY) return null;
    try {
      const data = await bungieGet(path);
      const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
      await prisma.bungieCache.upsert({
        where: { key },
        update: { data, fetchedAt: new Date(), expiresAt },
        create: { key, data, fetchedAt: new Date(), expiresAt },
      });
      return data;
    } catch (e) {
      log.error(`[bungie cache] ${key}`, e);
      return null;
    }
  }

  async function bungieGetCachedAuth(
    key: string,
    path: string,
    ttlMinutes: number,
    accessToken: string,
  ) {
    try {
      const cached = await prisma.bungieCache.findUnique({ where: { key } });
      if (cached && new Date(cached.expiresAt) > new Date()) return cached.data;
    } catch (e) {
      swallow(e);
    }
    try {
      const data = await bungieGet(path, accessToken);
      const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
      await prisma.bungieCache.upsert({
        where: { key },
        update: { data, fetchedAt: new Date(), expiresAt },
        create: { key, data, fetchedAt: new Date(), expiresAt },
      });
      return data;
    } catch (e) {
      log.error(`[bungie cache auth] ${key}`, e);
      return null;
    }
  }

  async function refreshBungieToken(account: any): Promise<string | null> {
    if (account.tokenExpiry && new Date(account.tokenExpiry) > new Date())
      return account.accessToken;
    if (!account.refreshToken) {
      log.log("[bungie] No refresh token, user must re-link");
      return null;
    }
    log.log("[bungie] Access token expired, refreshing...");
    try {
      const tokenBody: Record<string, string> = {
        grant_type: "refresh_token",
        refresh_token: account.refreshToken,
        client_id: BUNGIE_CLIENT_ID,
      };
      if (BUNGIE_CLIENT_SECRET) tokenBody.client_secret = BUNGIE_CLIENT_SECRET;

      const tokenRes = await fetchWithTimeout("https://www.bungie.net/Platform/App/OAuth/Token/", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-API-Key": BUNGIE_API_KEY,
        },
        body: new URLSearchParams(tokenBody),
      });
      const tokens = await tokenRes.json();
      if (!tokens.access_token) {
        log.error("[bungie] Token refresh failed:", tokens);
        return null;
      }
      await prisma.userGameAccount.update({
        where: { userId_gameType: { userId: account.userId, gameType: "BUNGIE" } },
        data: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || account.refreshToken,
          tokenExpiry: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
        },
      });
      log.log("[bungie] Token refreshed successfully");
      return tokens.access_token;
    } catch (e) {
      log.error("[bungie] Token refresh error:", e);
      return null;
    }
  }

  app.get("/bungie/xur", async (req, reply) => {
    if (!BUNGIE_API_KEY)
      return reply.send({ ok: true, available: false, error: "bungie_not_configured" });

    const milestoneData = await bungieGetCached("xur_milestone", "/Destiny2/Milestones/", 30);
    const xurMilestone = milestoneData?.Response?.["534869653"];
    if (!xurMilestone) return reply.send({ ok: true, available: false });

    try {
      const cached = await prisma.bungieCache.findUnique({
        where: { key: "xur_vendor_inventory" },
      });
      if (
        cached &&
        new Date(cached.expiresAt) > new Date() &&
        (cached.data as { items?: unknown[] } | null)?.items
      ) {
        return reply.send({
          ok: true,
          available: true,
          items: (cached.data as { items?: unknown[] }).items,
          cachedAt: cached.fetchedAt,
        });
      }
    } catch (e) {
      swallow(e);
    }

    const u = authFromHeader((req as any).headers?.authorization);
    if (!u)
      return reply.send({
        ok: true,
        available: true,
        items: null,
        message: "Link your Bungie account to see Xur's inventory",
      });

    const account = await prisma.userGameAccount.findUnique({
      where: { userId_gameType: { userId: u.id, gameType: "BUNGIE" } },
    });
    if (!account?.accessToken)
      return reply.send({
        ok: true,
        available: true,
        items: null,
        message: "Link your Bungie account to see Xur's inventory",
      });

    const accessToken = await refreshBungieToken(account);
    if (!accessToken)
      return reply.send({ ok: true, available: true, items: null, error: "token_expired" });

    try {
      const profileRes = await bungieGet(
        `/Destiny2/${account.platform}/Profile/${account.externalId}/?components=200`,
        accessToken,
      );
      const chars = profileRes?.Response?.characters?.data || {};
      const charIds = Object.keys(chars);
      if (charIds.length === 0)
        return reply.send({ ok: true, available: true, items: null, error: "no_characters" });

      const sortedChars = charIds.sort(
        (a, b) =>
          new Date(chars[b].dateLastPlayed).getTime() - new Date(chars[a].dateLastPlayed).getTime(),
      );
      const charId = sortedChars[0];

      const vendorData = await bungieGetCachedAuth(
        "xur_vendor_inventory",
        `/Destiny2/${account.platform}/Profile/${account.externalId}/Character/${charId}/Vendors/2190858386/?components=402,304`,
        60,
        accessToken,
      );

      const sales = vendorData?.Response?.sales?.data || {};
      const sockets = vendorData?.Response?.itemComponents?.sockets?.data || {};

      if (Object.keys(sales).length === 0)
        return reply.send({ ok: true, available: true, items: [] });

      const items = manifestLoaded() ? enrichVendorSales(sales, sockets) : [];

      if (items.length > 0) {
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        await prisma.bungieCache.upsert({
          where: { key: "xur_vendor_inventory" },
          update: { data: { items }, fetchedAt: new Date(), expiresAt },
          create: {
            key: "xur_vendor_inventory",
            data: { items },
            fetchedAt: new Date(),
            expiresAt,
          },
        });
      }

      return reply.send({ ok: true, available: true, items, cachedAt: new Date() });
    } catch (e) {
      log.error("[bungie/xur vendor]", e);
      return reply.send({ ok: true, available: true, items: null, error: "vendor_fetch_failed" });
    }
  });

  app.post("/bungie/manifest/sync", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    if (!BUNGIE_API_KEY) return reply.send({ ok: false, error: "bungie_not_configured" });
    const result = await syncManifest(BUNGIE_API_KEY);
    return reply.send(result);
  });

  app.get("/bungie/manifest/status", async (_req, reply) => {
    return reply.send({ ok: true, loaded: manifestLoaded(), version: manifestVersion() });
  });

  app.get("/bungie/my-activities", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const q: any = (req as any).query || {};
    const limit = Math.max(1, Math.min(50, Number(q.limit) || 10));

    const skullsPath = path.join(process.cwd(), "manifest-cache", "skulls.json");
    const modsPath = path.join(process.cwd(), "manifest-cache", "modifiers.json");
    let skulls: Record<string, any> = {};
    let mods: Record<string, any> = {};
    try {
      if (fs.existsSync(skullsPath)) skulls = JSON.parse(fs.readFileSync(skullsPath, "utf-8"));
    } catch (e) {
      swallow(e);
    }
    try {
      if (fs.existsSync(modsPath)) mods = JSON.parse(fs.readFileSync(modsPath, "utf-8"));
    } catch (e) {
      swallow(e);
    }

    const rows = await prisma.bungieActivityLog.findMany({
      where: { userId: u.id },
      orderBy: { period: "desc" },
      take: limit,
    });

    const activities = rows.map((r: any) => {
      const hashes = (Array.isArray(r.modifierHashes) ? r.modifierHashes : []).map(String);
      const named = hashes.map((h: string) => {
        const skull = skulls[h];
        const mod = mods[h];
        const def = skull || mod;
        return {
          hash: h,
          name: def?.name || "(unknown)",
          description: (def?.description || "").replaceAll(/\s+/g, " ").trim().slice(0, 200),
          source: skull ? "skull" : mod ? "activity-modifier" : "unknown",
        };
      });
      return {
        period: r.period,
        instanceId: r.activityInstanceId,
        activityName: r.activityName,
        mode: r.mode,
        modeName: r.modeName,
        difficultyTier: r.difficultyTier,
        completed: r.completed,
        standing: r.standing,
        kills: r.kills,
        deaths: r.deaths,
        duration: r.duration,
        modifiers: named,
      };
    });

    return reply.send({ ok: true, activities });
  });

  app.get("/bungie/activities", async (_req, reply) => {
    try {
      const cachePath = path.join(process.cwd(), "manifest-cache", "activities.json");
      if (!fs.existsSync(cachePath)) {
        return reply.send({ ok: false, error: "manifest_not_synced" });
      }
      const raw = JSON.parse(fs.readFileSync(cachePath, "utf-8")) as Record<
        string,
        { name: string; icon: string; description: string; lightLevel?: number }
      >;

      function baseName(n: string): string {
        return String(n || "")
          .replace(
            /:\s*(Customize|Matchmade|Adept|Hero|Legend|Legendary|Master|Grandmaster|Ultimate|Story|Standard|Normal|Expert)\b.*$/i,
            "",
          )
          .replace(
            /\s*\((Legendary|Master|Grandmaster|Adept|Normal|Heroic|Legend|Expert)\)\s*$/i,
            "",
          )
          .replace(
            /^\s*\((Legendary|Master|Grandmaster|Adept|Normal|Heroic|Legend|Expert)\)\s*/i,
            "",
          )
          .trim();
      }

      function isReal(name: string, _def: any): boolean {
        if (!name) return false;
        if (/^\s*$/.test(name)) return false;
        if (/^(Classified|Z\?\?\?|\?\?\?|Test|Debug)$/i.test(name.trim())) return false;
        if (name.length < 3) return false;
        return true;
      }

      const groups: Record<
        string,
        {
          name: string;
          hashes: string[];
          variants: { hash: string; variant: string }[];
          icon: string;
        }
      > = {};
      for (const [hash, def] of Object.entries(raw)) {
        if (!isReal(def.name, def)) continue;
        const base = baseName(def.name);
        if (!base) continue;
        const variant =
          def.name === base
            ? "Standard"
            : def.name
                .slice(base.length)
                .replace(/^[:\s]+/, "")
                .trim() || "Variant";
        if (!groups[base]) {
          groups[base] = {
            name: base,
            hashes: [],
            variants: [],
            icon: def.icon
              ? def.icon.startsWith("http")
                ? def.icon
                : "https://www.bungie.net" + def.icon
              : "",
          };
        }
        groups[base].hashes.push(hash);
        groups[base].variants.push({ hash, variant });
      }

      const result = Object.values(groups)
        .filter((g) => g.name && !/^[?:\s]+$/.test(g.name) && g.hashes.length >= 1)
        .sort((a, b) => {
          const va = a.variants.length,
            vb = b.variants.length;
          if (va >= 2 && vb < 2) return -1;
          if (vb >= 2 && va < 2) return 1;
          return a.name.localeCompare(b.name);
        });

      return reply.send({
        ok: true,
        version: manifestVersion(),
        total: result.length,
        groups: result,
      });
    } catch (err: any) {
      return reply.send({ ok: false, error: String(err?.message || err) });
    }
  });

  app.get("/bungie/modifiers", async (_req, reply) => {
    try {
      const cachePath = path.join(process.cwd(), "manifest-cache", "modifiers.json");
      if (!fs.existsSync(cachePath)) {
        return reply.send({ ok: false, error: "manifest_not_synced" });
      }
      const raw = JSON.parse(fs.readFileSync(cachePath, "utf-8")) as Record<
        string,
        { name: string; icon: string; description: string }
      >;

      function categorize(name: string): string | null {
        const n = name.toLowerCase();
        if (!name || /^a challenge awaits/i.test(name)) return null;
        if (/raid challenges|boosts gained|^\d+\+ feats/i.test(name)) return null;

        if (/^champion/i.test(name) || /champion foes/i.test(name)) return "champions";
        if (/surge protector/i.test(name)) return "surges";
        if (/\bsurge\b/i.test(n)) return "surges";
        if (/\bthreat\b/i.test(n)) return "threats";
        if (/\bburn\b/i.test(n)) return "burns";
        if (/match game|equipment locked|togetherness|epitaph|locked loadout/i.test(name))
          return "rules";
        if (/^overcharged/i.test(name)) return "overcharged";
        if (/^(?:shielded foes|shielded combatants)/i.test(name)) return "shields";
        return "other";
      }

      const grouped: Record<
        string,
        Array<{ hash: string; name: string; icon: string; description: string }>
      > = {};
      for (const [hash, def] of Object.entries(raw)) {
        const cat = categorize(def.name);
        if (!cat) continue;
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push({
          hash,
          name: def.name,
          icon: def.icon
            ? def.icon.startsWith("http")
              ? def.icon
              : "https://www.bungie.net" + def.icon
            : "",
          description: def.description || "",
        });
      }
      for (const k of Object.keys(grouped)) {
        grouped[k].sort((a, b) => a.name.localeCompare(b.name));
      }

      const flat = Object.values(grouped)
        .flat()
        .sort((a, b) => a.name.localeCompare(b.name));

      return reply.send({
        ok: true,
        version: manifestVersion(),
        total: flat.length,
        grouped,
        flat,
        categories: [
          { key: "rules", label: "Activity Rules" },
          { key: "surges", label: "Damage Surges" },
          { key: "threats", label: "Incoming Threats" },
          { key: "champions", label: "Champions" },
          { key: "shields", label: "Shielded Foes" },
          { key: "overcharged", label: "Overcharged Weapons" },
          { key: "burns", label: "Burns (legacy)" },
          { key: "other", label: "Other Modifiers" },
        ],
      });
    } catch (err: any) {
      return reply.send({ ok: false, error: String(err?.message || err) });
    }
  });

  app.get("/bungie/weekly", async (_req, reply) => {
    const data = await bungieGetCached("weekly_reset", "/Destiny2/Milestones/", 15);
    if (!data) return reply.send({ ok: true, milestones: [], error: "bungie_unavailable" });

    const milestonesRaw = data?.Response || {};

    if (manifestLoaded()) {
      const enriched = enrichMilestones(milestonesRaw);
      return reply.send({
        ok: true,
        milestones: enriched,
        totalMilestones: Object.keys(milestonesRaw).length,
        manifestVersion: manifestVersion(),
      });
    }

    const KNOWN: Record<string, string> = {
      "2029743966": "Nightfall",
      "3603098564": "Crucible Playlist",
      "534869653": "Xur",
      "4253138191": "Raid",
      "1437935813": "Vanguard Ops",
    };
    const summary: any[] = [];
    for (const [hash, ms] of Object.entries(milestonesRaw) as [string, any][]) {
      if (KNOWN[hash]) {
        summary.push({
          hash,
          name: KNOWN[hash],
          activities:
            ms?.activities?.map((a: any) => ({
              hash: a.activityHash,
              challenges: a.challengeObjectiveHashes,
              modifiers: a.modifierHashes,
              phases: a.phaseHashes,
            })) || [],
          availableQuests: ms?.availableQuests?.length || 0,
          startDate: ms?.startDate,
          endDate: ms?.endDate,
        });
      }
    }
    return reply.send({
      ok: true,
      milestones: summary,
      totalMilestones: Object.keys(milestonesRaw).length,
    });
  });

  app.get("/bungie/player/:name", async (req, reply) => {
    if (!BUNGIE_API_KEY) return reply.send({ ok: false, error: "bungie_not_configured" });

    const displayName = String((req as any).params?.name || "");
    if (!displayName) return reply.code(400).send({ ok: false, error: "name_required" });

    try {
      const parts = displayName.split("#");
      const name = parts[0];
      const code = parts[1] || "0";

      const searchRes = await fetchWithTimeout(
        `${BUNGIE_ROOT}/Destiny2/SearchDestinyPlayerByBungieName/-1/`,
        {
          method: "POST",
          headers: { "X-API-Key": BUNGIE_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ displayName: name, displayNameCode: Number(code) }),
        },
      );
      const searchResult = await searchRes.json();
      const players = searchResult?.Response || [];

      if (players.length === 0) return reply.send({ ok: true, found: false, players: [] });

      const player = players[0];
      const memberType = player.membershipType;
      const memberId = player.membershipId;

      const profile = await bungieGet(
        `/Destiny2/${memberType}/Profile/${memberId}/?components=100,200,205,300,302,304`,
      );

      const profileData = profile?.Response;
      const characters = profileData?.characters?.data || {};
      const equipment = profileData?.characterEquipment?.data || {};
      const instances = profileData?.itemComponents?.instances?.data || {};
      const socketData = profileData?.itemComponents?.sockets?.data || {};
      const statData = profileData?.itemComponents?.stats?.data || {};

      const privacyRestricted = profileData?.characterEquipment?.privacy === 2;

      const charSummary = Object.values(characters).map((c: any) => {
        const charId = c.characterId;
        const base: any = {
          characterId: charId,
          classType: c.classType,
          className: ["Titan", "Hunter", "Warlock"][c.classType] || "Unknown",
          light: c.light,
          raceType: c.raceType,
          raceName: ["Human", "Awoken", "Exo"][c.raceType] || "Unknown",
          emblemPath: c.emblemPath ? `https://www.bungie.net${c.emblemPath}` : null,
          emblemBackgroundPath: c.emblemBackgroundPath
            ? `https://www.bungie.net${c.emblemBackgroundPath}`
            : null,
          dateLastPlayed: c.dateLastPlayed,
          minutesPlayedTotal: c.minutesPlayedTotal,
          titleRecordHash: c.titleRecordHash,
        };

        if (!privacyRestricted && manifestLoaded()) {
          const equippedItems = (equipment[charId]?.items || []).map((item: any) => {
            const def = resolveItem(item.itemHash);
            const inst = instances[item.itemInstanceId] || {};
            const bucket = resolveBucket(item.bucketHash || def?.bucketHash || 0);
            const damage = resolveDamageType(inst.damageTypeHash || def?.damageTypeHash || 0);
            const bHash = item.bucketHash || def?.bucketHash || 0;

            let perks: any[] = [];
            const itemSockets = socketData[item.itemInstanceId]?.sockets;
            if (itemSockets && Array.isArray(itemSockets)) {
              perks = itemSockets
                .filter((s: any) => s.plugHash && s.plugHash !== 0)
                .map((s: any) => {
                  const pd = resolveItem(s.plugHash);
                  return pd
                    ? {
                        hash: s.plugHash,
                        name: pd.name,
                        icon: pd.icon ? `https://www.bungie.net${pd.icon}` : "",
                      }
                    : null;
                })
                .filter(Boolean);
            }

            let armorStats: any = undefined;
            if (ARMOR_BUCKETS.has(bHash) && statData[item.itemInstanceId]?.stats) {
              const stats = statData[item.itemInstanceId].stats;
              const m = Number(stats[ARMOR_STAT_HASHES.MOBILITY]?.value || 0);
              const r = Number(stats[ARMOR_STAT_HASHES.RESILIENCE]?.value || 0);
              const rc = Number(stats[ARMOR_STAT_HASHES.RECOVERY]?.value || 0);
              const d = Number(stats[ARMOR_STAT_HASHES.DISCIPLINE]?.value || 0);
              const i = Number(stats[ARMOR_STAT_HASHES.INTELLECT]?.value || 0);
              const s = Number(stats[ARMOR_STAT_HASHES.STRENGTH]?.value || 0);
              armorStats = {
                mobility: m,
                resilience: r,
                recovery: rc,
                discipline: d,
                intellect: i,
                strength: s,
                total: m + r + rc + d + i + s,
              };
            }

            return {
              itemHash: item.itemHash,
              itemInstanceId: item.itemInstanceId,
              bucketHash: bHash,
              name: def?.name || `Unknown`,
              icon: def?.icon ? `https://www.bungie.net${def.icon}` : "",
              tierName: def?.tierName || "Unknown",
              tierType: def?.tierType || 0,
              watermark: def?.watermark ? `https://www.bungie.net${def.watermark}` : "",
              primaryStat: inst.primaryStat?.value || null,
              damageType: damage?.name || null,
              damageIcon: damage?.icon ? `https://www.bungie.net${damage.icon}` : null,
              slotName: bucket?.name || "",
              perks,
              armorStats,
            };
          });

          const weapons = equippedItems.filter((i: any) => WEAPON_BUCKETS.has(i.bucketHash));
          const armor = equippedItems.filter((i: any) => ARMOR_BUCKETS.has(i.bucketHash));
          base.equipped = equippedItems;
          base.weapons = weapons;
          base.armor = armor;
        }

        return base;
      });

      return reply.send({
        ok: true,
        found: true,
        privacyRestricted,
        player: {
          membershipId: memberId,
          membershipType: memberType,
          displayName: player.bungieGlobalDisplayName || player.displayName,
          displayNameCode: player.bungieGlobalDisplayNameCode,
          iconPath: player.iconPath ? `https://www.bungie.net${player.iconPath}` : null,
        },
        characters: charSummary,
        totalCharacters: charSummary.length,
      });
    } catch (e) {
      log.error("[bungie player lookup]", e);
      return reply.code(500).send({ ok: false, error: "lookup_failed" });
    }
  });

  app.get("/bungie/card/:userId", async (req, reply) => {
    if (!BUNGIE_API_KEY) return reply.send({ ok: false });
    const userId = String((req as any).params?.userId || "");
    if (!userId) return reply.code(400).send({ ok: false });

    try {
      const acct = await prisma.userGameAccount.findFirst({
        where: { userId, gameType: "BUNGIE" },
        select: {
          displayName: true,
          platform: true,
          externalId: true,
          cardData: true,
          cardCachedAt: true,
        },
      });
      if (!acct || !acct.displayName) return reply.send({ ok: false });

      if (
        acct.cardData &&
        acct.cardCachedAt &&
        Date.now() - acct.cardCachedAt.getTime() < 300_000
      ) {
        return reply.send({ ok: true, ...(acct.cardData as any) });
      }

      if (!acct.externalId || !acct.platform) return reply.send({ ok: false });
      const memberType = acct.platform;
      const memberId = acct.externalId;

      const profileRes = await bungieGet(
        `/Destiny2/${memberType}/Profile/${memberId}/?components=100,200,1400`,
      );
      const profileData = profileRes?.Response?.profile?.data;
      const chars = profileRes?.Response?.characters?.data || {};
      const commendations = profileRes?.Response?.profileCommendations?.data;

      const RANK_NAMES: Record<number, string> = {
        1: "New Light",
        2: "Explorer",
        3: "Seeker",
        4: "Pathfinder",
        5: "Brave",
        6: "Heroic",
        7: "Fabled",
        8: "Mythic",
        9: "Vanquisher",
        10: "Conqueror",
        11: "Paragon",
      };
      const guardianRank = profileData?.currentGuardianRank ?? null;
      const guardianRankName = guardianRank
        ? RANK_NAMES[guardianRank] || `Rank ${guardianRank}`
        : null;

      const commendationScore = commendations?.totalScore ?? null;

      const characters = Object.values(chars).map((c: any) => ({
        characterId: c.characterId,
        className: ["", "Titan", "Hunter", "Warlock"][c.classType + 1] || "Unknown",
        light: c.light,
        raceName: ["", "Human", "Awoken", "Exo"][c.raceType + 1] || "Unknown",
        emblemBackgroundPath: c.emblemBackgroundPath
          ? `https://www.bungie.net${c.emblemBackgroundPath}`
          : null,
        dateLastPlayed: c.dateLastPlayed,
        minutesPlayedTotal: Number.parseInt(c.minutesPlayedTotal) || 0,
      }));
      characters.sort(
        (a: any, b: any) =>
          new Date(b.dateLastPlayed).getTime() - new Date(a.dateLastPlayed).getTime(),
      );

      let lastActivity: { name: string; mode: string; when: string } | null = null;
      const mainChar = characters[0];
      if (mainChar?.characterId) {
        try {
          const actRes = await bungieGet(
            `/Destiny2/${memberType}/Account/${memberId}/Character/${mainChar.characterId}/Stats/Activities/?count=1&mode=0`,
          );
          const act = actRes?.Response?.activities?.[0];
          if (act) {
            const actDef = resolveActivity(act.activityDetails?.referenceId);
            const MODE_NAMES: Record<number, string> = {
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
            const modeId = act.activityDetails?.mode || 0;
            lastActivity = {
              name: actDef?.name || "Unknown Activity",
              mode: MODE_NAMES[modeId] || `Mode ${modeId}`,
              when: act.period || "",
            };
          }
        } catch (e) {
          swallow(e);
        }
      }

      const card = {
        displayName: acct.displayName,
        characters,
        guardianRank,
        guardianRankName,
        commendationScore,
        lastActivity,
      };

      await prisma.userGameAccount
        .update({
          where: { userId_gameType: { userId, gameType: "BUNGIE" } },
          data: { cardData: card as any, cardCachedAt: new Date() },
        })
        .catch(swallow);

      return reply.send({ ok: true, ...card });
    } catch (e) {
      log.error("[bungie card]", e);
      return reply.send({ ok: false });
    }
  });

  app.get("/auth/bungie", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ error: "Login first" });
    if (!BUNGIE_CLIENT_ID) return reply.code(500).send({ error: "Bungie OAuth not configured" });

    const state = signOAuthState(u.id);
    const url = `https://www.bungie.net/en/OAuth/Authorize?client_id=${BUNGIE_CLIENT_ID}&response_type=code&state=${state}`;
    return reply.redirect(url);
  });

  app.get("/auth/bungie/callback", async (req, reply) => {
    const code = String((req as any).query?.code || "");
    const state = String((req as any).query?.state || "");
    if (!code) return reply.code(400).send({ error: "Missing code" });

    const userId = verifyOAuthState(state);
    if (!userId) return reply.code(400).send({ error: "Invalid state" });

    try {
      const tokenBody: Record<string, string> = {
        grant_type: "authorization_code",
        code,
        client_id: BUNGIE_CLIENT_ID,
      };
      if (BUNGIE_CLIENT_SECRET) tokenBody.client_secret = BUNGIE_CLIENT_SECRET;

      const tokenRes = await fetchWithTimeout("https://www.bungie.net/Platform/App/OAuth/Token/", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-API-Key": BUNGIE_API_KEY,
        },
        body: new URLSearchParams(tokenBody),
      });
      const tokens = await tokenRes.json();

      if (!tokens.access_token) {
        log.error("[bungie oauth] token error", tokens);
        return reply.redirect(`${SITE_URL}/lobby/destiny2?bungie=error`);
      }

      const memberRes = await fetchWithTimeout(
        "https://www.bungie.net/Platform/User/GetMembershipsForCurrentUser/",
        {
          headers: { "X-API-Key": BUNGIE_API_KEY, Authorization: `Bearer ${tokens.access_token}` },
        },
      );
      const memberData = await memberRes.json();
      const memberships = memberData?.Response?.destinyMemberships || [];
      const primary =
        memberships.find((m: any) => m.crossSaveOverride === m.membershipType) || memberships[0];

      await prisma.userGameAccount.upsert({
        where: { userId_gameType: { userId, gameType: "BUNGIE" } },
        update: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || null,
          tokenExpiry: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
          externalId: primary?.membershipId || tokens.membership_id || null,
          displayName: primary?.bungieGlobalDisplayName || primary?.displayName || "",
          platform: String(primary?.membershipType || ""),
        },
        create: {
          userId,
          gameType: "BUNGIE",
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || null,
          tokenExpiry: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
          externalId: primary?.membershipId || tokens.membership_id || null,
          displayName: primary?.bungieGlobalDisplayName || primary?.displayName || "",
          platform: String(primary?.membershipType || ""),
        },
      });

      awardNotoriety(userId, "BUNGIE_LINKED").catch(swallow);
      return reply.redirect(`${SITE_URL}/lobby/destiny2?bungie=success`);
    } catch (e) {
      log.error("[bungie oauth callback]", e);
      return reply.redirect(`${SITE_URL}/lobby/destiny2?bungie=error`);
    }
  });

  app.get("/bungie/me", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });

    const account = await prisma.userGameAccount.findUnique({
      where: { userId_gameType: { userId: u.id, gameType: "BUNGIE" } },
    });
    if (!account?.accessToken) return reply.send({ ok: true, linked: false });

    const accessToken = await refreshBungieToken(account);
    if (!accessToken) {
      return reply.send({
        ok: true,
        linked: true,
        error: "token_expired",
        displayName: account.displayName,
        message: "Your Bungie session expired. Please re-link your account.",
      });
    }

    try {
      const profile = await bungieGet(
        `/Destiny2/${account.platform}/Profile/${account.externalId}/?components=100,102,200,201,205,300,302,304,305`,
        accessToken,
      );

      const profileData = profile?.Response;
      if (!profileData)
        return reply.send({
          ok: true,
          linked: true,
          error: "no_profile_data",
          displayName: account.displayName,
        });

      if (manifestLoaded()) {
        const enriched = enrichProfile(profileData);
        return reply.send({
          ok: true,
          linked: true,
          displayName: account.displayName,
          platform: account.platform,
          externalId: account.externalId,
          manifestVersion: manifestVersion(),
          ...enriched,
        });
      }

      const characters = profileData?.characters?.data || {};
      const charEquipment = profileData?.characterEquipment?.data || {};
      const instances = profileData?.itemComponents?.instances?.data || {};
      const vaultItems = profileData?.profileInventory?.data?.items || [];

      const charSummary = Object.entries(characters).map(([charId, c]: [string, any]) => {
        const equipped = (charEquipment[charId]?.items || []).map((item: any) => {
          const inst = instances[item.itemInstanceId] || {};
          return {
            itemHash: item.itemHash,
            itemInstanceId: item.itemInstanceId,
            bucketHash: item.bucketHash,
            primaryStat: inst.primaryStat?.value || null,
            name: null,
            icon: null,
          };
        });
        return {
          characterId: charId,
          classType: c.classType,
          className: ["Titan", "Hunter", "Warlock"][c.classType] || "Unknown",
          light: c.light,
          raceType: c.raceType,
          raceName: ["Human", "Awoken", "Exo"][c.raceType] || "Unknown",
          emblemPath: c.emblemPath,
          emblemBackgroundPath: c.emblemBackgroundPath,
          dateLastPlayed: c.dateLastPlayed,
          minutesPlayedTotal: c.minutesPlayedTotal,
          equipped,
          weapons: [],
          armor: [],
          inventory: [],
        };
      });

      return reply.send({
        ok: true,
        linked: true,
        displayName: account.displayName,
        platform: account.platform,
        externalId: account.externalId,
        characters: charSummary,
        vault: vaultItems.slice(0, 20),
        vaultCount: vaultItems.length,
      });
    } catch (e) {
      log.error("[bungie/me]", e);
      return reply.send({
        ok: true,
        linked: true,
        error: "fetch_failed",
        displayName: account.displayName,
      });
    }
  });

  app.post("/bungie/equip", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });

    const account = await prisma.userGameAccount.findUnique({
      where: { userId_gameType: { userId: u.id, gameType: "BUNGIE" } },
    });
    if (!account?.accessToken) return reply.code(400).send({ ok: false, error: "not_linked" });

    const accessToken = await refreshBungieToken(account);
    if (!accessToken) return reply.code(401).send({ ok: false, error: "token_expired" });

    const { itemId, characterId } = (req as any).body || {};
    if (!itemId || !characterId)
      return reply.code(400).send({ ok: false, error: "missing_fields" });

    try {
      const result = await fetchWithTimeout(`${BUNGIE_ROOT}/Destiny2/Actions/Items/EquipItem/`, {
        method: "POST",
        headers: {
          "X-API-Key": BUNGIE_API_KEY,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ itemId, characterId, membershipType: Number(account.platform) }),
      });
      const data = await result.json();
      return reply.send({ ok: !data.ErrorCode || data.ErrorCode === 1, data });
    } catch (e) {
      log.error("[bungie/equip]", e);
      return reply.code(500).send({ ok: false, error: "equip_failed" });
    }
  });

  app.post("/bungie/transfer", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });

    const account = await prisma.userGameAccount.findUnique({
      where: { userId_gameType: { userId: u.id, gameType: "BUNGIE" } },
    });
    if (!account?.accessToken) return reply.code(400).send({ ok: false, error: "not_linked" });

    const accessToken = await refreshBungieToken(account);
    if (!accessToken) return reply.code(401).send({ ok: false, error: "token_expired" });

    const { itemReferenceHash, stackSize, transferToVault, itemId, characterId } =
      (req as any).body || {};
    if (!itemId || !characterId || !itemReferenceHash)
      return reply.code(400).send({ ok: false, error: "missing_fields" });

    try {
      const result = await fetchWithTimeout(`${BUNGIE_ROOT}/Destiny2/Actions/Items/TransferItem/`, {
        method: "POST",
        headers: {
          "X-API-Key": BUNGIE_API_KEY,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          itemReferenceHash,
          stackSize: stackSize || 1,
          transferToVault: transferToVault ?? false,
          itemId,
          characterId,
          membershipType: Number(account.platform),
        }),
      });
      const data = await result.json();
      return reply.send({ ok: !data.ErrorCode || data.ErrorCode === 1, data });
    } catch (e) {
      log.error("[bungie/transfer]", e);
      return reply.code(500).send({ ok: false, error: "transfer_failed" });
    }
  });
}
