import { log } from "../lib/logger";
import type { FastifyInstance } from "fastify";

type Opts = {
  authFromHeader?: (h?: string) => { id: string } | null;
};

export default async function helldiversRoutes(app: FastifyInstance, _opts: Opts = {}) {
  const HD2_BASE = "https://api.helldivers2.dev/api/v1";
  const HD2_HEADERS: Record<string, string> = {
    "User-Agent": "Weered/1.0 (https://weered.ca)",
    "X-Super-Client": "Weered",
    "X-Super-Contact": process.env.HD2_CONTACT || "james@weered.ca",
    Accept: "application/json",
  };

  const cache = new Map<string, { data: any; expiresAt: number }>();
  const TTL_MS = 60_000;

  function cacheGet(key: string) {
    const c = cache.get(key);
    if (c && c.expiresAt > Date.now()) return c.data;
    return null;
  }
  function cacheSet(key: string, data: any) {
    cache.set(key, { data, expiresAt: Date.now() + TTL_MS });
  }

  async function hd2Get(path: string): Promise<any | null> {
    try {
      // Bound the upstream call so a hung/slow community API can't pin the
      // handler; expected upstream failures (rate-limit / 5xx / network) are
      // operational WARNINGS, not errors — graceful degradation returns null
      // and the route serves stale/empty cache.
      const res = await fetch(`${HD2_BASE}${path}`, {
        headers: HD2_HEADERS,
        signal: AbortSignal.timeout(8000),
      });
      if (res.status === 429) {
        log.warn("[helldivers2] rate limited", path);
        return null;
      }
      if (res.status === 404) return null;
      if (!res.ok) {
        log.warn(`[helldivers2] upstream ${res.status} ${path}`);
        return null;
      }
      return await res.json();
    } catch (e) {
      log.warn(`[helldivers2] fetch failed ${path}: ${(e as any)?.message || e}`);
      return null;
    }
  }

  async function warmCache() {
    try {
      const [war, assignments, dispatches, campaigns, planets] = await Promise.all([
        hd2Get("/war"),
        hd2Get("/assignments"),
        hd2Get("/dispatches"),
        hd2Get("/campaigns"),
        hd2Get("/planets"),
      ]);
      if (war) cacheSet("war", war);
      if (assignments) cacheSet("assignments", assignments);
      if (dispatches) cacheSet("dispatches", dispatches);
      if (campaigns) cacheSet("campaigns", campaigns);
      if (planets) cacheSet("planets", planets);
    } catch (e) {
      log.warn(`[helldivers2] warmCache failed: ${(e as any)?.message || e}`);
    }
  }

  warmCache().catch(() => {});
  setInterval(() => {
    warmCache().catch(() => {});
  }, 60_000);

  async function getOrFetch(key: string, path: string) {
    const hit = cacheGet(key);
    if (hit) return hit;
    const fresh = await hd2Get(path);
    if (fresh) cacheSet(key, fresh);
    return fresh;
  }

  app.get("/helldivers/war", async (_req, reply) => {
    const war = await getOrFetch("war", "/war");
    if (!war) return reply.code(502).send({ ok: false, error: "war_unavailable" });

    const planets = (await getOrFetch("planets", "/planets")) || [];
    let totalPlayers = 0;
    let activePlanets = 0;
    if (Array.isArray(planets)) {
      for (const p of planets) {
        const players = Number(p?.statistics?.playerCount || 0);
        if (players > 0) {
          totalPlayers += players;
          activePlanets++;
        }
      }
    }

    return reply.send({
      ok: true,
      started: war.started,
      ended: war.ended,
      now: war.now,
      clientVersion: war.clientVersion,
      factions: war.factions || [],
      impactMultiplier: war.impactMultiplier,
      statistics: war.statistics || null,
      totalPlayers,
      activePlanets,
    });
  });

  app.get("/helldivers/major-orders", async (_req, reply) => {
    const data = await getOrFetch("assignments", "/assignments");
    if (!data) return reply.send({ ok: true, orders: [] });

    const list = Array.isArray(data) ? data : [];
    const orders = list.map((a: any) => {
      const tasks = a.setting?.tasks || [];
      const progress = a.progress || [];
      let pct = 0;
      let denom = 0;
      tasks.forEach((t: any, i: number) => {
        const target = Number(t?.values?.[2] || t?.values?.[0] || 0);
        const cur = Number(progress[i] || 0);
        if (target > 0) {
          pct += Math.min(100, (cur / target) * 100);
          denom++;
        }
      });
      const overallPct = denom > 0 ? Math.round(pct / denom) : 0;

      return {
        id: a.id,
        title: a.setting?.overrideTitle || a.title || "Major Order",
        brief: a.setting?.overrideBrief || a.briefing || "",
        description: a.setting?.taskDescription || a.description || "",
        type: a.setting?.type,
        flags: a.setting?.flags,
        reward: a.setting?.reward || a.setting?.rewards?.[0] || null,
        rewards: a.setting?.rewards || [],
        tasks,
        progress,
        progressPct: overallPct,
        expiresIn: a.expiresIn,
        expiresAt: typeof a.expiresIn === "number" ? Date.now() + a.expiresIn * 1000 : null,
      };
    });

    return reply.send({ ok: true, orders });
  });

  app.get("/helldivers/dispatches", async (req, reply) => {
    const q = (req as any).query || {};
    const limit = Math.min(50, Math.max(1, Number(q.limit) || 20));
    const data = await getOrFetch("dispatches", "/dispatches");
    if (!data) return reply.send({ ok: true, dispatches: [] });

    const list = Array.isArray(data) ? data : [];
    const sorted = [...list].sort((a: any, b: any) => {
      const ta = new Date(a.published || 0).getTime();
      const tb = new Date(b.published || 0).getTime();
      return tb - ta;
    });

    const dispatches = sorted.slice(0, limit).map((d: any) => ({
      id: d.id,
      published: d.published,
      type: d.type,
      message: d.message || "",
    }));

    return reply.send({ ok: true, dispatches });
  });

  app.get("/helldivers/campaigns", async (_req, reply) => {
    const data = await getOrFetch("campaigns", "/campaigns");
    if (!data) return reply.send({ ok: true, campaigns: [] });

    const list = Array.isArray(data) ? data : [];
    const campaigns = list.map((c: any) => {
      const planet = c.planet || {};
      const event = planet.event || null;
      const isDefense = !!event;
      const liberation = Number(planet?.statistics?.percentage ?? planet?.health ?? 0);
      let liberationPct = 0;
      if (
        typeof planet.health === "number" &&
        typeof planet.maxHealth === "number" &&
        planet.maxHealth > 0
      ) {
        liberationPct = Math.round(((planet.maxHealth - planet.health) / planet.maxHealth) * 100);
      }
      let defensePct = 0;
      if (
        event &&
        typeof event.health === "number" &&
        typeof event.maxHealth === "number" &&
        event.maxHealth > 0
      ) {
        defensePct = Math.round(((event.maxHealth - event.health) / event.maxHealth) * 100);
      }

      return {
        id: c.id,
        type: c.type,
        count: c.count,
        isDefense,
        planet: {
          index: planet.index,
          name: planet.name,
          sector: planet.sector,
          biome: planet.biome,
          hazards: planet.hazards || [],
          currentOwner: planet.currentOwner,
          initialOwner: planet.initialOwner,
          regenPerSecond: planet.regenPerSecond,
          maxHealth: planet.maxHealth,
          health: planet.health,
          liberationPct,
          players: planet?.statistics?.playerCount || 0,
        },
        event: event
          ? {
              id: event.id,
              eventType: event.eventType,
              faction: event.faction,
              health: event.health,
              maxHealth: event.maxHealth,
              startTime: event.startTime,
              endTime: event.endTime,
              defensePct,
            }
          : null,
      };
    });

    return reply.send({ ok: true, campaigns });
  });

  app.get("/helldivers/planets/:planetId", async (req, reply) => {
    const planetId = String((req as any).params?.planetId || "");
    if (!planetId) return reply.code(400).send({ ok: false, error: "planet_id_required" });

    let planet: any = await hd2Get(`/planets/${encodeURIComponent(planetId)}`);
    if (!planet) {
      const all = (await getOrFetch("planets", "/planets")) || [];
      if (Array.isArray(all)) {
        planet = all.find(
          (p: any) =>
            String(p.index) === planetId || String(p.name).toLowerCase() === planetId.toLowerCase(),
        );
      }
    }
    if (!planet) return reply.code(404).send({ ok: false, error: "planet_not_found" });

    let liberationPct = 0;
    if (
      typeof planet.health === "number" &&
      typeof planet.maxHealth === "number" &&
      planet.maxHealth > 0
    ) {
      liberationPct = Math.round(((planet.maxHealth - planet.health) / planet.maxHealth) * 100);
    }

    return reply.send({
      ok: true,
      planet: {
        index: planet.index,
        name: planet.name,
        sector: planet.sector,
        biome: planet.biome,
        hazards: planet.hazards || [],
        currentOwner: planet.currentOwner,
        initialOwner: planet.initialOwner,
        regenPerSecond: planet.regenPerSecond,
        maxHealth: planet.maxHealth,
        health: planet.health,
        liberationPct,
        position: planet.position || null,
        waypoints: planet.waypoints || [],
        disabled: planet.disabled,
        attacking: planet.attacking || [],
        statistics: planet.statistics || null,
        event: planet.event || null,
        history: planet.history || [],
      },
    });
  });
}
