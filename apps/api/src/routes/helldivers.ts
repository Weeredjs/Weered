import { log, swallow } from "../lib/logger";
import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";

type Opts = {
  authFromHeader?: (h?: string) => { id: string; name?: string } | null;
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
  const TTL_MS = 160_000; // outlives the 120s refresh so a failed cycle serves stale, not empty

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
      // The community API allows roughly 5 requests per 10s. The old parallel
      // burst fired all five at once (plus the worker's own two), so the tail
      // requests — planets and dispatches — got 429'd every single cycle.
      // Sequential with spacing keeps a full refresh comfortably under the cap.
      const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const PATHS: [string, string][] = [
        ["war", "/war"],
        ["assignments", "/assignments"],
        ["dispatches", "/dispatches"],
        ["campaigns", "/campaigns"],
        ["planets", "/planets"],
      ];
      for (let i = 0; i < PATHS.length; i++) {
        const [key, path] = PATHS[i];
        const data = await hd2Get(path);
        if (data) cacheSet(key, data);
        if (i < PATHS.length - 1) await delay(2500);
      }
    } catch (e) {
      log.warn(`[helldivers2] warmCache failed: ${(e as any)?.message || e}`);
    }
  }

  warmCache().catch(swallow);
  setInterval(() => {
    warmCache().catch(swallow);
  }, 120_000);

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

  // ---- Stratagem Hero arcade leaderboard --------------------------------

  app.get("/helldivers/strat-hero/leaderboard", async (req, reply) => {
    const u = _opts.authFromHeader?.((req as any).headers?.authorization);
    const top = await prisma.helldiversStratScore.findMany({
      orderBy: { score: "desc" },
      take: 20,
      select: { userId: true, name: true, score: true, rounds: true },
    });
    let me: any = null;
    if (u) {
      const mine = await prisma.helldiversStratScore.findUnique({ where: { userId: u.id } });
      if (mine) {
        const above = await prisma.helldiversStratScore.count({
          where: { score: { gt: mine.score } },
        });
        me = { score: mine.score, rounds: mine.rounds, rank: above + 1 };
      }
    }
    return reply.send({ ok: true, top, me });
  });

  app.post("/helldivers/strat-hero/score", async (req, reply) => {
    const u = _opts.authFromHeader?.((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const body: any = (req as any).body || {};
    const score = Math.floor(Number(body.score));
    const rounds = Math.floor(Number(body.rounds));
    // Sanity fence: per-arrow scoring with round bonuses tops out well under
    // this even for absurdly long runs. Client scores are trust-based; the cap
    // keeps the board embarrassment-free, not tamper-proof.
    if (!Number.isFinite(score) || score < 0 || score > 250_000)
      return reply.code(400).send({ ok: false, error: "bad_score" });
    if (!Number.isFinite(rounds) || rounds < 0 || rounds > 60)
      return reply.code(400).send({ ok: false, error: "bad_rounds" });

    const user = await prisma.user.findUnique({ where: { id: u.id }, select: { name: true } });
    const name = (user?.name || "Helldiver").slice(0, 40);
    const existing = await prisma.helldiversStratScore.findUnique({ where: { userId: u.id } });
    if (!existing || score > existing.score) {
      await prisma.helldiversStratScore.upsert({
        where: { userId: u.id },
        update: { score, rounds, name },
        create: { userId: u.id, score, rounds, name },
      });
    }
    const best = Math.max(score, existing?.score || 0);
    const above = await prisma.helldiversStratScore.count({ where: { score: { gt: best } } });
    return reply.send({
      ok: true,
      best,
      rank: above + 1,
      improved: !existing || score > existing.score,
    });
  });
}
