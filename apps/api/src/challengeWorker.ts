/**
 * Destiny Meta-Game Launcher — Challenge Tracking Worker
 *
 * Polls Bungie API for enrolled players' activity history,
 * evaluates objectives, updates progress, and awards rewards.
 */

import { PrismaClient } from "@prisma/client";
import { resolveActivity } from "./manifest";

// ── Rate Limiter ────────────────────────────────────────────────────────────

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
      // Safety: drain queue on next refill
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

// ── Types ───────────────────────────────────────────────────────────────────

type ObjectiveSpec = {
  id: string;
  type: string;
  description: string;
  target: number;
  filters: {
    modes?: number[];
    activityHashes?: string[];
    weaponSubTypes?: number[];
    weaponHashes?: string[];
    requireCompletion?: boolean;
    requireWin?: boolean;
    maxDuration?: number;
    minKills?: number;
    minKd?: number;
    consecutiveWins?: number;
  };
};

type ObjProgress = {
  current: number;
  target: number;
  completed: boolean;
  // For streak tracking
  currentStreak?: number;
};

type ActivityEntry = {
  activityInstanceId: string;
  activityHash: string;
  mode: number;
  period: string;
  kills: number;
  deaths: number;
  assists: number;
  score: number;
  standing: number; // 0=Victory
  completed: boolean;
  duration: number;
  weaponKills: { hash: string; kills: number }[];
};

// ── Mode name mapping ───────────────────────────────────────────────────────

const MODE_NAMES: Record<number, string> = {
  0: "None", 2: "Story", 3: "Strike", 4: "Raid", 5: "PvP", 6: "Patrol",
  7: "PvE", 10: "Control", 12: "Clash", 16: "Nightfall", 18: "Heroic",
  19: "Mayhem", 25: "Rumble", 31: "Supremacy", 37: "Survival",
  38: "Countdown", 39: "Trials", 43: "Iron Banner", 46: "Scorched",
  48: "Gambit", 63: "Reckoning", 69: "Dungeon", 73: "Offensive",
  75: "Dares", 84: "Quickplay",
};

// ── Bungie API helper ───────────────────────────────────────────────────────

let _bungieApiKey = "";
const BUNGIE_ROOT = "https://www.bungie.net/Platform";

export function setBungieApiKey(key: string) { _bungieApiKey = key; }

async function bungieGet(path: string): Promise<any> {
  await rateLimiter.acquire();
  const res = await fetch(`${BUNGIE_ROOT}${path}`, {
    headers: { "X-API-Key": _bungieApiKey },
  });
  return res.json();
}

// ── Objective evaluator ─────────────────────────────────────────────────────

function matchesFilters(activity: ActivityEntry, filters: ObjectiveSpec["filters"]): boolean {
  if (filters.modes?.length && !filters.modes.includes(activity.mode)) return false;
  if (filters.activityHashes?.length && !filters.activityHashes.includes(activity.activityHash)) return false;
  if (filters.requireCompletion && !activity.completed) return false;
  if (filters.requireWin && activity.standing !== 0) return false;
  if (filters.maxDuration && activity.duration > filters.maxDuration) return false;
  if (filters.minKills && activity.kills < filters.minKills) return false;
  if (filters.minKd) {
    const kd = activity.deaths > 0 ? activity.kills / activity.deaths : activity.kills;
    if (kd < filters.minKd) return false;
  }
  return true;
}

function evaluateObjective(
  objective: ObjectiveSpec,
  activities: ActivityEntry[],
  existing: ObjProgress,
): ObjProgress {
  if (existing.completed) return existing;

  let current = existing.current;
  let currentStreak = existing.currentStreak ?? 0;

  for (const act of activities) {
    if (!matchesFilters(act, objective.filters)) {
      // Reset streak on non-matching if streak-based
      if (objective.type === "win_streak") currentStreak = 0;
      continue;
    }

    switch (objective.type) {
      case "kills":
        current += act.kills;
        break;

      case "weapon_kills": {
        const weaponTypes = new Set(objective.filters.weaponSubTypes || []);
        const weaponHashes = new Set(objective.filters.weaponHashes || []);
        for (const w of act.weaponKills) {
          if (weaponHashes.size > 0 && weaponHashes.has(w.hash)) current += w.kills;
          // Note: weaponSubType matching requires PGCR + manifest lookup
          // For now, count all weapon kills if no specific hashes given
          else if (weaponTypes.size > 0) current += w.kills; // TODO: filter by subType
        }
        break;
      }

      case "activities":
        current += 1;
        break;

      case "wins":
        if (act.standing === 0) current += 1;
        break;

      case "speed_clear":
        if (act.completed && (!objective.filters.maxDuration || act.duration <= objective.filters.maxDuration)) {
          current += 1;
        }
        break;

      case "win_streak":
        if (act.standing === 0) {
          currentStreak += 1;
          current = Math.max(current, currentStreak);
        } else {
          currentStreak = 0;
        }
        break;

      case "kd_threshold": {
        const kd = act.deaths > 0 ? act.kills / act.deaths : act.kills;
        if (kd >= (objective.filters.minKd || 0)) current += 1;
        break;
      }

      case "stat_total":
        current += act.kills + act.assists;
        break;

      default:
        break;
    }
  }

  return {
    current: Math.min(current, objective.target),
    target: objective.target,
    completed: current >= objective.target,
    currentStreak: objective.type === "win_streak" ? currentStreak : undefined,
  };
}

// ── Fetch activity history ──────────────────────────────────────────────────

async function fetchRecentActivities(
  membershipType: string,
  membershipId: string,
  characterId: string,
  count = 25,
): Promise<ActivityEntry[]> {
  const res = await bungieGet(
    `/Destiny2/${membershipType}/Account/${membershipId}/Character/${characterId}/Stats/Activities/?count=${count}&mode=0`
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
      weaponKills: [], // Populated from PGCR if needed
    };
  });
}

// ── Main worker ─────────────────────────────────────────────────────────────

const BATCH_SIZE = 50; // Enrollments per cycle
const WORKER_INTERVAL = 30_000; // 30 seconds

export function startChallengeWorker(prisma: PrismaClient, awardNotoriety: (userId: string, action: string) => Promise<any>) {
  console.log("[challenges] Worker started — polling every 30s");

  async function cycle() {
    try {
      // 1. Find active enrollments needing check
      const enrollments = await prisma.challengeEnrollment.findMany({
        where: {
          status: "ACTIVE",
          instance: { status: "ACTIVE" },
        },
        include: {
          instance: { include: { definition: true } },
        },
        orderBy: { lastCheckedAt: { sort: "asc", nulls: "first" } },
        take: BATCH_SIZE,
      });

      if (enrollments.length === 0) return;

      // 2. Group by userId to batch API calls
      const byUser = new Map<string, typeof enrollments>();
      for (const e of enrollments) {
        const list = byUser.get(e.userId) || [];
        list.push(e);
        byUser.set(e.userId, list);
      }

      // 3. Process each user
      for (const [userId, userEnrollments] of byUser) {
        try {
          // Get Bungie account
          const acct = await prisma.userGameAccount.findFirst({
            where: { userId, gameType: "BUNGIE" },
            select: { externalId: true, platform: true },
          });
          if (!acct?.externalId || !acct.platform) {
            // No Bungie account — skip but update timestamp
            await prisma.challengeEnrollment.updateMany({
              where: { id: { in: userEnrollments.map(e => e.id) } },
              data: { lastCheckedAt: new Date() },
            });
            continue;
          }

          // Get character IDs
          const profileRes = await bungieGet(
            `/Destiny2/${acct.platform}/Profile/${acct.externalId}/?components=100`
          );
          const charIds = profileRes?.Response?.profile?.data?.characterIds || [];
          if (charIds.length === 0) continue;

          // Fetch activity history for most recent character
          // (sort characters by dateLastPlayed from component 200 would be better, use first for now)
          const activities = await fetchRecentActivities(
            acct.platform, acct.externalId, charIds[0], 25
          );

          if (activities.length === 0) {
            await prisma.challengeEnrollment.updateMany({
              where: { id: { in: userEnrollments.map(e => e.id) } },
              data: { lastCheckedAt: new Date() },
            });
            continue;
          }

          // 4. Store activities in log (dedupe by instanceId)
          for (const act of activities) {
            if (!act.activityInstanceId) continue;
            const actDef = resolveActivity(act.activityHash);
            await prisma.bungieActivityLog.upsert({
              where: { userId_activityInstanceId: { userId, activityInstanceId: act.activityInstanceId } },
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
              update: {}, // No update — already logged
            }).catch(() => {}); // Ignore dupe errors
          }

          // 5. Evaluate each enrollment against new activities
          for (const enrollment of userEnrollments) {
            const def = enrollment.instance.definition;
            const objectives = (def.objectives as any[]) || [];
            const progress = (enrollment.progress as Record<string, ObjProgress>) || {};

            // Filter to activities newer than watermark
            const watermark = enrollment.lastActivityInstanceId;
            let newActivities = activities;
            if (watermark) {
              const wmIdx = activities.findIndex(a => a.activityInstanceId === watermark);
              if (wmIdx >= 0) {
                newActivities = activities.slice(0, wmIdx); // Activities are newest-first
              }
            }

            if (newActivities.length === 0) {
              await prisma.challengeEnrollment.update({
                where: { id: enrollment.id },
                data: { lastCheckedAt: new Date() },
              });
              continue;
            }

            // Evaluate each objective
            let allCompleted = true;
            let completedCount = 0;
            for (const obj of objectives as ObjectiveSpec[]) {
              const existing = progress[obj.id] || { current: 0, target: obj.target, completed: false };
              const updated = evaluateObjective(obj, newActivities.reverse(), existing); // Oldest first for streak logic
              progress[obj.id] = updated;
              if (updated.completed) completedCount++;
              else allCompleted = false;
            }

            // Check completion
            const isComplete = def.requireAll
              ? allCompleted
              : completedCount >= (def.requireCount || objectives.length);

            const updateData: any = {
              progress: progress as any,
              lastCheckedAt: new Date(),
              lastActivityInstanceId: activities[0]?.activityInstanceId || enrollment.lastActivityInstanceId,
            };

            if (isComplete && enrollment.status !== "COMPLETED") {
              updateData.status = "COMPLETED";
              updateData.completedAt = new Date();

              // Award rewards
              if (def.notorietyReward > 0) {
                awardNotoriety(userId, "CHALLENGE_COMPLETED").catch(() => {});
              }

              console.log(`[challenges] ${userId} completed "${def.title}"`);
            }

            await prisma.challengeEnrollment.update({
              where: { id: enrollment.id },
              data: updateData,
            });
          }
        } catch (e: any) {
          console.error(`[challenges] Error processing user ${userId}:`, e.message);
        }
      }
    } catch (e: any) {
      console.error("[challenges] Worker cycle error:", e.message);
    }
  }

  // Run immediately, then on interval
  setTimeout(cycle, 5000);
  setInterval(cycle, WORKER_INTERVAL);
}
