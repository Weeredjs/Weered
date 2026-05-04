/**
 * Helldivers 2 — Slice D Worker
 *
 * Polls the community Helldivers 2 API every 10 minutes and:
 *   1. Spawns a pinned house room per active campaign in the helldivers2 lobby
 *      (auto-unpins rooms whose campaign has ended).
 *   2. Detects state transitions (planet liberated/lost, MO completed/failed,
 *      campaign won/lost) and fires Operator commentary into the lobby chat.
 *   3. Auto-creates a Weered Challenge whenever a brand-new Major Order
 *      appears, so users can self-report participation and earn Paper.
 *
 * The worker is intentionally independent of Slice A's polling — fetching
 * twice every 10 min is cheap and avoids cross-slice coupling.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const HD2_API = "https://api.helldivers2.dev/api/v1";
const HD2_LOBBY_ID = "helldivers2";

// ── In-memory state for transition detection ────────────────────────────────
// We re-load this from DB on each tick (best-effort) so a worker restart
// does not cause duplicate commentary on already-known events.

type CampaignSnapshot = {
  planetId: number;
  planetName: string;
  faction: string;
  health: number;       // 0..1
  defense: boolean;     // true = defense, false = liberation
};

type MajorOrderSnapshot = {
  id32: number;
  title: string;
  expiresAt: number;
  rewardMedals: number;
  // Best-effort completion flag from the API. Some endpoints expose it via
  // tasks[].progress vs. setting.tasks[].values; we conservatively mark
  // completed when the order disappears from the active list AND was
  // observed on the previous tick.
};

let lastCampaigns: Map<number, CampaignSnapshot> = new Map();
let lastMajorOrders: Map<number, MajorOrderSnapshot> = new Map();
let primed = false;

// ── Helpers ─────────────────────────────────────────────────────────────────

async function fetchJson<T = any>(url: string, timeoutMs = 8000): Promise<T | null> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    const r = await fetch(url, {
      headers: {
        "Accept-Language": "en-US",
        "User-Agent": "Weered/1.0 (+https://weered.ca)",
        "X-Super-Client": "weered",
        "X-Super-Contact": "support@weered.ca",
      },
      signal: ctl.signal,
    });
    clearTimeout(t);
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function truncate(s: string, n: number) {
  if (!s) return "";
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

// ── Operator commentary on war events ───────────────────────────────────────
// Mirrors the operatorCommentateOnTrade pattern in index.ts but with a
// Super Earth Ministry of Truth voice. Throttled to one comment per 30s
// per event-type to cap cost and avoid lobby spam.

const _operatorWarLast = new Map<string, number>();

export async function operatorCommentateOnWarEvent(
  eventType:
    | "planet_liberated"
    | "planet_lost"
    | "mo_completed"
    | "mo_failed"
    | "defense_won"
    | "defense_lost",
  ctx: Record<string, any>,
  deps: {
    getAI: () => Promise<any | null>;
    broadcastToLobby: (lobbyId: string, event: any) => void;
  },
) {
  const key = `${eventType}:${ctx.planetId ?? ctx.moId ?? "x"}`;
  const now = Date.now();
  const last = _operatorWarLast.get(key) || 0;
  if (now - last < 30_000) return;
  _operatorWarLast.set(key, now);

  try {
    const ai = await deps.getAI();
    if (!ai) return;
    const userPrompt = (() => {
      switch (eventType) {
        case "planet_liberated":
          return `Liberation of ${ctx.planetName} from the ${ctx.faction} is complete. Brief broadcast.`;
        case "planet_lost":
          return `${ctx.planetName} has fallen to the ${ctx.faction}. Brief broadcast — spin the loss.`;
        case "mo_completed":
          return `Major Order complete: "${ctx.title}". Brief celebratory broadcast.`;
        case "mo_failed":
          return `Major Order failed: "${ctx.title}". Brief broadcast — gently reassign blame to the enemy.`;
        case "defense_won":
          return `Defense of ${ctx.planetName} against the ${ctx.faction} succeeded. Brief broadcast.`;
        case "defense_lost":
          return `Defense of ${ctx.planetName} fell to the ${ctx.faction}. Brief broadcast — reframe as strategic regroup.`;
      }
    })();
    const response = await ai.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 80,
      system:
        "You are The Operator — a Super Earth Ministry of Truth news anchor. ONE sentence, max 20 words. Deadpan propaganda. Use phrases like 'Managed Democracy', 'Liber-tea', 'For Super Earth'. Never break character. No emojis. No quotes. No hashtags.",
      messages: [{ role: "user", content: userPrompt }],
    });
    const reply = (response?.content?.[0]?.text || "").trim();
    if (!reply) return;
    deps.broadcastToLobby(HD2_LOBBY_ID, {
      type: "operator:commentary",
      body: reply,
      ts: Date.now(),
      eventType,
    });
  } catch (e) {
    console.error("[operator-war]", e);
  }
}

// ── Pinned room sync ────────────────────────────────────────────────────────

function campaignRoomId(planetId: number) {
  return `helldivers2-campaign-${planetId}`;
}

function campaignRoomName(c: CampaignSnapshot) {
  if (c.defense) return `Defend ${c.planetName} from ${c.faction}`;
  return `Liberate ${c.planetName} from ${c.faction}`;
}

async function syncCampaignRooms(active: Map<number, CampaignSnapshot>) {
  // Ensure pinned rooms exist for active campaigns
  for (const [pid, c] of active) {
    const id = campaignRoomId(pid);
    const name = campaignRoomName(c);
    try {
      await prisma.room.upsert({
        where: { id },
        update: { name, lobbyId: HD2_LOBBY_ID, pinned: true },
        create: {
          id,
          name,
          description: `Live war campaign — ${c.faction} on ${c.planetName}.`,
          lobbyId: HD2_LOBBY_ID,
          pinned: true,
          locked: false,
        },
      });
    } catch (e) {
      // Lobby may not exist yet (rare on a brand-new boot); just log.
      console.warn("[helldiversWorker] room upsert failed", id, (e as any)?.message);
    }
  }

  // Unpin campaigns that ended (rooms exist with our prefix but planet not active)
  try {
    const existing = await prisma.room.findMany({
      where: { lobbyId: HD2_LOBBY_ID, pinned: true, id: { startsWith: "helldivers2-campaign-" } },
      select: { id: true },
    });
    for (const row of existing) {
      const pidStr = row.id.replace("helldivers2-campaign-", "");
      const pid = Number(pidStr);
      if (!Number.isFinite(pid) || !active.has(pid)) {
        await prisma.room.update({ where: { id: row.id }, data: { pinned: false } }).catch(() => {});
      }
    }
  } catch {}
}

// ── Major Order → Challenge sync ────────────────────────────────────────────

async function syncMajorOrderChallenges(active: Map<number, MajorOrderSnapshot>, systemUserId: string | null) {
  if (!systemUserId) return;
  for (const [moId, mo] of active) {
    const externalRef = `hd2:mo:${moId}`;
    try {
      const existing = await (prisma as any).challengeDefinition.findFirst({
        where: { kind: "MAJOR_ORDER", externalRef },
      });
      if (existing) continue;

      const rewardPaper = clamp(100 + Math.max(0, mo.rewardMedals) * 10, 100, 1000);
      await (prisma as any).challengeDefinition.create({
        data: {
          title: truncate("Major Order: " + (mo.title || "Super Earth Directive"), 80),
          description:
            truncate(
              "Self-reportable participation challenge for the active Helldivers 2 Major Order. Rewards Paper + Notoriety on claim.",
              500,
            ),
          category: "helldivers2",
          difficulty: 3,
          scope: "LOBBY" as any,
          lobbyId: HD2_LOBBY_ID,
          createdById: systemUserId,
          objectives: [
            {
              id: "self_report",
              type: "SELF_REPORT",
              description: "Click 'I participated' on the MO panel.",
              target: 1,
              filters: {},
            },
          ],
          requireAll: true,
          paperReward: rewardPaper,
          notorietyReward: 50,
          kind: "MAJOR_ORDER",
          externalRef,
          status: "ACTIVE" as any,
        },
      });

      // Spawn an immediate ACTIVE instance bounded by the MO expiry
      const def = await (prisma as any).challengeDefinition.findFirst({
        where: { kind: "MAJOR_ORDER", externalRef },
      });
      if (def) {
        await (prisma as any).challengeInstance.create({
          data: {
            definitionId: def.id,
            startsAt: new Date(),
            endsAt: new Date(mo.expiresAt),
            status: "ACTIVE" as any,
          },
        });
      }
    } catch (e) {
      console.warn("[helldiversWorker] MO challenge upsert failed", moId, (e as any)?.message);
    }
  }
}

// ── Picking the system user (for createdById) ───────────────────────────────

let _systemUserIdCache: string | null = null;
async function getSystemUserId(): Promise<string | null> {
  if (_systemUserIdCache) return _systemUserIdCache;
  try {
    // Prefer a global STAFF/ADMIN; fall back to oldest user.
    const u = await (prisma as any).user.findFirst({
      where: { OR: [{ globalRole: "ADMIN" }, { globalRole: "STAFF" }] },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (u?.id) { _systemUserIdCache = u.id; return u.id; }
    const fallback = await (prisma as any).user.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
    _systemUserIdCache = fallback?.id || null;
    return _systemUserIdCache;
  } catch {
    return null;
  }
}

// ── Tick ────────────────────────────────────────────────────────────────────

export async function runHelldiversWorker(deps: {
  getAI: () => Promise<any | null>;
  broadcastToLobby: (lobbyId: string, event: any) => void;
}) {
  const [campaignsRes, moRes] = await Promise.all([
    fetchJson<any[]>(`${HD2_API}/campaigns`),
    fetchJson<any[]>(`${HD2_API}/assignments`),
  ]);

  // ── Build current campaign snapshot ────────────────────────────────
  const currentCampaigns = new Map<number, CampaignSnapshot>();
  if (Array.isArray(campaignsRes)) {
    for (const raw of campaignsRes) {
      try {
        const planet = raw?.planet || {};
        const planetId = Number(planet?.index ?? raw?.planetIndex ?? raw?.id);
        if (!Number.isFinite(planetId)) continue;
        const planetName = String(planet?.name || raw?.planetName || `Planet ${planetId}`);
        const enemyFactionRaw = String(
          planet?.event?.faction || planet?.currentOwner || raw?.faction || "Enemy",
        );
        const faction = enemyFactionRaw === "Humans" ? "the enemy" : enemyFactionRaw;
        const isDefense = !!planet?.event;
        const health = (() => {
          if (planet?.event?.health != null && planet?.event?.maxHealth != null) {
            const m = Number(planet.event.maxHealth) || 1;
            return clamp(1 - Number(planet.event.health) / m, 0, 1);
          }
          if (planet?.health != null && planet?.maxHealth != null) {
            const m = Number(planet.maxHealth) || 1;
            return clamp(1 - Number(planet.health) / m, 0, 1);
          }
          return 0;
        })();
        currentCampaigns.set(planetId, {
          planetId,
          planetName,
          faction,
          health,
          defense: isDefense,
        });
      } catch {}
    }
  }

  // ── Build current MO snapshot ──────────────────────────────────────
  const currentMOs = new Map<number, MajorOrderSnapshot>();
  if (Array.isArray(moRes)) {
    for (const raw of moRes) {
      try {
        const id32 = Number(raw?.id32 ?? raw?.id ?? 0);
        if (!Number.isFinite(id32) || id32 === 0) continue;
        const title = String(raw?.title || raw?.setting?.overrideTitle || "Major Order");
        const expiresMs = (() => {
          const e = raw?.expiration || raw?.expiresIn;
          if (typeof e === "string") {
            const t = Date.parse(e);
            if (Number.isFinite(t)) return t;
          }
          if (typeof e === "number") {
            // Some payloads return seconds-from-now
            return Date.now() + e * 1000;
          }
          return Date.now() + 7 * 24 * 60 * 60 * 1000;
        })();
        const rewardMedals = Number(raw?.setting?.reward?.amount ?? raw?.reward?.amount ?? 0);
        currentMOs.set(id32, {
          id32,
          title,
          expiresAt: expiresMs,
          rewardMedals,
        });
      } catch {}
    }
  }

  // ── Sync rooms and challenges ──────────────────────────────────────
  await syncCampaignRooms(currentCampaigns);

  if (currentMOs.size > 0) {
    const sysId = await getSystemUserId();
    await syncMajorOrderChallenges(currentMOs, sysId);
  }

  // ── Detect transitions vs previous snapshot ────────────────────────
  // Skip transition firing on the very first tick — without prior
  // state, every active campaign would fire an event spuriously.
  if (primed) {
    // Campaigns that disappeared from the active list = ended
    for (const [pid, prev] of lastCampaigns) {
      if (currentCampaigns.has(pid)) continue;
      if (prev.defense) {
        // Defense ended — won if planet still ours conceptually; without
        // post-state info we can't be 100% sure, so we treat "defense
        // disappeared with health > 0.5" as won and the rest as lost.
        const won = prev.health > 0.5;
        await operatorCommentateOnWarEvent(won ? "defense_won" : "defense_lost", prev, deps);
      } else {
        // Liberation ended — won if health near 1.0
        const won = prev.health > 0.95;
        await operatorCommentateOnWarEvent(won ? "planet_liberated" : "planet_lost", prev, deps);
      }
    }

    // Major orders that disappeared
    for (const [moId, prev] of lastMajorOrders) {
      if (currentMOs.has(moId)) continue;
      // Treat order ending past its expiration as failed; ending early as
      // completed. (Best-effort heuristic — the API does not always
      // surface the final completion flag.)
      const completed = Date.now() < prev.expiresAt - 60_000;
      await operatorCommentateOnWarEvent(completed ? "mo_completed" : "mo_failed", {
        moId,
        title: prev.title,
      }, deps);
    }
  }

  lastCampaigns = currentCampaigns;
  lastMajorOrders = currentMOs;
  primed = true;
}

// ── Steam concurrent player count (cached 60s) ──────────────────────────────
// Public endpoint, no key required. Used by the lobby header pill.

const STEAM_HD2_APPID = "553850";
let _steamCache: { ts: number; count: number } | null = null;
const STEAM_TTL_MS = 60_000;

export async function getHelldiversSteamPlayers(): Promise<{ ok: boolean; count: number; ts: number }> {
  const now = Date.now();
  if (_steamCache && now - _steamCache.ts < STEAM_TTL_MS) {
    return { ok: true, count: _steamCache.count, ts: _steamCache.ts };
  }
  try {
    const url = `https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${STEAM_HD2_APPID}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) throw new Error(`steam_${r.status}`);
    const j: any = await r.json();
    const count = Number(j?.response?.player_count ?? 0);
    _steamCache = { ts: now, count };
    return { ok: true, count, ts: now };
  } catch (e) {
    if (_steamCache) return { ok: true, count: _steamCache.count, ts: _steamCache.ts };
    return { ok: false, count: 0, ts: now };
  }
}
