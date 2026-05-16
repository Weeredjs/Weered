/**
 * Destiny Meta-Game Launcher — Challenge Tracking Worker
 *
 * Polls Bungie API for enrolled players' activity history,
 * evaluates objectives, updates progress, and awards rewards.
 */

import { PrismaClient } from "@prisma/client";
import { resolveActivity, resolveItem } from "./manifest";
import {
  bungieGet,
  fetchRecentActivities,
  fetchPGCR,
  fetchPGCRDetail,
  MODE_NAMES,
  setBungieApiKey as _setBungieApiKey,
  type ActivityEntry,
} from "./lib/bungieActivities";
import { completeTournament } from "./lib/tournamentComplete";

// Re-export so existing import sites (index.ts) keep working.
export const setBungieApiKey = _setBungieApiKey;


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
    activityHashes?: string[];
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




// ── Objective evaluator ─────────────────────────────────────────────────────

// Skull/modifier hashes that signal Master+ tier (Difficult Combatants /
// Deadly Combatants / Deadly element Threats). Used as a fallback when
// activityDifficultyTier is unreliable across activity types — matchmade
// Ultimate Ops can report tier=2 even though gameplay difficulty is Ultimate.
// Source: skulls manifest scan, 2026-05-08. See project_d2_skull_system.md.
const HIGH_TIER_MARKER_HASHES = new Set<string>([
  "1288529377", "3273465074", "510222748", "3237237808", "3237237809", "3237237811", "518782643", "3352453709", "1282797377", "1282797378", "1282797379", "1282797380", "1282797381", "3649914542", "1957676549", "426853779", "3191180704", "3191180705", "3191180706", "3191180710", "3191180711", "56643583", "3272021286", "1288529376", "1806613733", "198058552", "198058553", "198058554", "3103802699", "567947480", "2735568802", "173444685", "2084001784", "2084001786", "2084001787", "2084001788", "2084001789", "3168893556", "2419549505", "2419549506", "2419549507", "2419549508", "2419549509", "2907154606", "2284069897", "3350802550", "307925599", "431730392", "3514038500", "320183569", "3870674195"
]);

function hasHighTierMarker(modifierHashes: string[]): boolean {
  for (const h of modifierHashes) if (HIGH_TIER_MARKER_HASHES.has(String(h))) return true;
  return false;
}

function matchesFilters(activity: ActivityEntry, filters: ObjectiveSpec["filters"]): boolean {
  if (filters.modes?.length && !filters.modes.includes(activity.mode)) return false;
  // Activity-hash whitelist — when present, the run\'s activityHash must be
  // in the set. Lets staff curate "Hand-Picked GM Strikes" challenges scoped
  // to specific maps. Empty array == no filter.
  if (filters.activityHashes && filters.activityHashes.length > 0) {
    if (!filters.activityHashes.includes(String(activity.activityHash))) return false;
  }
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

// Definition-level modifier + tier check. Applied AFTER per-objective filters
// pass — the activity's modifier set must include all required modifier
// hashes and meet the difficulty tier. Empty/null requirements always pass.
function definitionRequirementsMet(
  activityModifierHashes: string[],
  activityDifficultyTier: number | null,
  requiredModifiers: string[],
  requireDifficultyTier: number | null,
): boolean {
  if (requireDifficultyTier != null) {
    // Primary path: trust the integer tier when it's a sensible value.
    const tierOk = activityDifficultyTier != null && activityDifficultyTier >= requireDifficultyTier;
    // Fallback path: when requiring Master+ (tier 4+), accept activities that
    // carry a Difficult/Deadly Combatants or Deadly Threat skull, since those
    // are reliable across activity types where tier integers vary.
    const markerOk = requireDifficultyTier >= 4 && hasHighTierMarker(activityModifierHashes || []);
    if (!tierOk && !markerOk) return false;
  }
  if (requiredModifiers && requiredModifiers.length > 0) {
    if (!activityModifierHashes || activityModifierHashes.length === 0) return false;
    const have = new Set(activityModifierHashes);
    for (const req of requiredModifiers) {
      if (!have.has(req)) return false;
    }
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
        const weaponHashes = new Set(objective.filters.weaponHashes || []);
        const weaponSubTypes = new Set(objective.filters.weaponSubTypes || []);
        for (const w of act.weaponKills) {
          if (weaponHashes.size > 0 && weaponHashes.has(w.hash)) {
            current += w.kills;
          } else if (weaponSubTypes.size > 0) {
            // Resolve weapon hash against manifest to check itemSubType
            const wDef = resolveItem(w.hash);
            if (wDef && weaponSubTypes.has(wDef.itemSubType)) {
              current += w.kills;
            }
          } else if (weaponHashes.size === 0 && weaponSubTypes.size === 0) {
            // No filter — count all weapon kills
            current += w.kills;
          }
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



// Check if any enrollments need weapon kill data (lazy — only fetch PGCR when needed)
function needsModifierData(enrollments: any[]): boolean {
  for (const e of enrollments) {
    const def = e.instance?.definition;
    if (!def) continue;
    const reqs = (def.requiredModifiers as string[]) || [];
    if (reqs.length > 0) return true;
    if (def.requireDifficultyTier != null) return true;
  }
  return false;
}

function needsWeaponData(enrollments: any[]): boolean {
  for (const e of enrollments) {
    const objectives = (e.instance?.definition?.objectives as any[]) || [];
    for (const obj of objectives) {
      if (obj.type === "weapon_kills") return true;
    }
  }
  return false;
}

// ── Main worker ─────────────────────────────────────────────────────────────

const BATCH_SIZE = 50; // Enrollments per cycle
const WORKER_INTERVAL = 30_000; // 30 seconds

// ── WS notification callback type ──────────────────────────────────────────

type ChallengeNotify = (userId: string, event: {
  type: "challenge:progress" | "challenge:completed";
  enrollmentId: string;
  instanceId: string;
  challengeTitle: string;
  progress: Record<string, ObjProgress>;
  notorietyReward?: number;
  paperReward?: number;
  badgeId?: string | null;
}) => void;

// ── Race-credit hook ────────────────────────────────────────────────────────
// Called from the cycle when an enrollment first transitions to COMPLETED.
// For each active CHALLENGE_RACE tournament the user is registered in where
// this challenge def is in the pool (or pool empty + lobby matches), bump
// the entry score by pointsPerCompletion. Then check win condition; if met,
// flip to COMPLETED and run payouts.
async function creditChallengeRace(
  prisma: PrismaClient,
  userId: string,
  defId: string,
  defLobbyId: string | null | undefined,
  createNotification?: (opts: any) => Promise<any>,
  awardPaper?: (userId: string, type: string, amount: number, description: string, refId?: string) => Promise<any>,
) {
  const tournaments: any[] = await (prisma as any).tournament.findMany({
    where: {
      format: "CHALLENGE_RACE",
      status: "ACTIVE",
      entries: { some: { userId } },
    },
  });
  if (tournaments.length === 0) return;

  for (const t of tournaments) {
    const pool: string[] = Array.isArray(t.challengePoolIds) ? t.challengePoolIds : [];
    const poolEmpty = pool.length === 0;
    const inPool = pool.includes(defId);
    // Pool-empty rule: only count if the challenge def's lobby matches the
    // tournament's lobby (so a destiny2 race doesn't credit windrose challenges).
    if (!inPool && !(poolEmpty && t.lobbyId && defLobbyId && t.lobbyId === defLobbyId)) continue;

    const entry = await (prisma as any).tournamentEntry.findFirst({
      where: { tournamentId: t.id, userId },
    });
    if (!entry) continue;

    const points = Math.max(1, t.pointsPerCompletion || 100);
    const updated = await (prisma as any).tournamentEntry.update({
      where: { id: entry.id },
      data: { score: { increment: points } },
    });

    // Notify entrant
    if (createNotification) {
      createNotification({
        userId,
        type: "CHALLENGE_COMPLETED",
        title: `+${points} in ${t.title}`,
        body: `Score: ${updated.score}${t.pointsToWin ? ` / ${t.pointsToWin}` : ""}`,
        actionUrl: t.lobbyId ? `/lobby/${encodeURIComponent(t.lobbyId)}` : null,
        meta: { kind: "tournament_race_credit", tournamentId: t.id, points, score: updated.score },
      }).catch(() => {});
    }

    // Win-condition check
    const wc = String(t.raceWinCondition || "DEADLINE").toUpperCase();
    let shouldComplete = false;

    if (wc === "THRESHOLD" && t.pointsToWin && updated.score >= t.pointsToWin) {
      shouldComplete = true;
    } else if (wc === "ALL_COMPLETED") {
      // All challenges in pool cleared by this user. Pool must be non-empty.
      if (pool.length > 0) {
        const completedCount = await (prisma as any).challengeEnrollment.count({
          where: {
            userId,
            status: "COMPLETED",
            instance: { definitionId: { in: pool } },
          },
        });
        if (completedCount >= pool.length) shouldComplete = true;
      }
    }
    // DEADLINE win condition is handled by the tournament-cycle expiry path.

    if (shouldComplete) {
      console.log(`[tournaments] CHALLENGE_RACE "${t.title}" auto-completing (winner: ${userId})`);
      try {
        await completeTournament(prisma, t.id, { awardPaper, createNotification });
      } catch (err: any) {
        console.warn("[tournaments] auto-complete failed:", err?.message || err);
      }
    }
  }
}

export function startChallengeWorker(
  prisma: PrismaClient,
  awardNotoriety: (userId: string, action: string) => Promise<any>,
  notify?: ChallengeNotify,
  awardPaper?: (userId: string, type: string, amount: number, description: string, refId?: string) => Promise<any>,
  broadcastToLobby?: (lobbyId: string, event: any) => void,
  createNotification?: (opts: any) => Promise<any>,
) {
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

          // 3.5 PGCR fetch — broaden when challenges need weapons OR modifiers/tier
          //   Custom Ops player-picked modifiers come back in PGCR.selectedSkullHashes;
          //   they're not on the activity definition itself, so we MUST hit the PGCR
          //   to populate them. Cache via existing log row to avoid re-pulling.
          const wantWeapons = needsWeaponData(userEnrollments);
          const wantMods    = needsModifierData(userEnrollments);
          // Per-activity cache of skull hashes + tier so we can stuff them into
          // the upsert below without a second lookup.
          const skullByInstance = new Map<string, string[]>();
          const tierByInstance = new Map<string, number | null>();
          if (wantWeapons || wantMods) {
            for (const act of activities) {
              if (!act.activityInstanceId) continue;
              // If we already logged this run with skull data, reuse it.
              const existing = await prisma.bungieActivityLog.findUnique({
                where: { userId_activityInstanceId: { userId, activityInstanceId: act.activityInstanceId } },
                select: { weaponKills: true, modifierHashes: true, difficultyTier: true },
              });
              const existingMods = Array.isArray(existing?.modifierHashes) ? (existing!.modifierHashes as any[]).map(String) : [];
              const haveWeapons = Array.isArray(existing?.weaponKills) && (existing!.weaponKills as any[]).length > 0;
              const haveMods    = existingMods.length > 0;
              const haveTier    = existing?.difficultyTier != null;
              if (haveWeapons && haveMods && haveTier) {
                act.weaponKills = existing!.weaponKills as any;
                skullByInstance.set(act.activityInstanceId, existingMods);
                tierByInstance.set(act.activityInstanceId, existing!.difficultyTier);
                continue;
              }
              // Pull fresh from Bungie. One PGCR call gives us all three.
              const detail = await fetchPGCRDetail(act.activityInstanceId, acct.externalId);
              if (detail.weaponKills.length > 0) act.weaponKills = detail.weaponKills as any;
              skullByInstance.set(act.activityInstanceId, detail.selectedSkullHashes);
              tierByInstance.set(act.activityInstanceId, detail.activityDifficultyTier);
            }
          }

          // 4. Store activities in log (dedupe by instanceId)
          //   modifierHashes blends two sources:
          //     a) static activity definition (Bungie-curated rotational mods)
          //     b) PGCR.selectedSkullHashes (player-picked Custom Ops skulls)
          //   The matcher just does set-membership against requiredModifiers,
          //   so combining them is safe and lets challenges require either kind.
          for (const act of activities) {
            if (!act.activityInstanceId) continue;
            const actDef = resolveActivity(act.activityHash);
            const staticMods = ((actDef?.modifierHashes || []) as any[]).map(String);
            const skulls = skullByInstance.get(act.activityInstanceId) || [];
            const merged = Array.from(new Set([...staticMods, ...skulls]));
            const pgcrTier = tierByInstance.get(act.activityInstanceId);
            const tier = pgcrTier != null ? pgcrTier : (actDef?.difficultyTier ?? null);
            await (prisma as any).bungieActivityLog.upsert({
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
                modifierHashes: merged as any,
                difficultyTier: tier,
              },
              update: {
                ...(act.weaponKills.length > 0 ? { weaponKills: act.weaponKills as any } : {}),
                modifierHashes: merged as any,
                difficultyTier: tier,
              },
            }).catch(() => {});
          }

          // 5. Evaluate each enrollment against new activities
          for (const enrollment of userEnrollments) {
            const def = enrollment.instance.definition;
            const objectives = (def.objectives as any[]) || [];
            const progress = (enrollment.progress as Record<string, ObjProgress>) || {};

            // Filter: only activities after the challenge instance started
            const instanceStart = new Date(enrollment.instance.startsAt).getTime();
            let newActivities = activities.filter(a => new Date(a.period).getTime() >= instanceStart);

            // Further filter by watermark (avoid double-counting)
            const watermark = enrollment.lastActivityInstanceId;
            if (watermark) {
              const wmIdx = newActivities.findIndex(a => a.activityInstanceId === watermark);
              if (wmIdx >= 0) {
                newActivities = newActivities.slice(0, wmIdx); // Activities are newest-first
              }
            }

            if (newActivities.length === 0) {
              await prisma.challengeEnrollment.update({
                where: { id: enrollment.id },
                data: { lastCheckedAt: new Date() },
              });
              continue;
            }

            // Definition-level modifier + tier requirements (filter out
            // activities that don't satisfy them BEFORE per-objective evaluation).
            const reqMods = ((def as any).requiredModifiers as string[]) || [];
            const reqTier = (def as any).requireDifficultyTier as number | null;
            const minPS = (def as any).minPartySize as number | null;
            const maxPS = (def as any).maxPartySize as number | null;
            const filteredActivities = newActivities.filter((act: any) => {
              const actDef = resolveActivity(act.activityHash);
              // Modifier set = static activity-def modifiers UNION PGCR skull hashes.
              // Skull hashes carry the player's Custom Ops choices; without them
              // the matcher would miss every Custom Ops run.
              const staticMods = ((actDef?.modifierHashes || []) as any[]).map(String);
              const skullMods = skullByInstance.get(act.activityInstanceId) || [];
              const mods = Array.from(new Set([...staticMods, ...skullMods]));
              // Tier from PGCR if available; else activity definition's static tier.
              const pgcrTier = tierByInstance.get(act.activityInstanceId);
              const tier = pgcrTier != null ? pgcrTier : (actDef?.difficultyTier ?? null);
              if (!definitionRequirementsMet(mods, tier, reqMods, reqTier)) return false;
              if (minPS != null || maxPS != null) {
                const size = (act as any).fireteamIds?.length || 0;
                if (minPS != null && size < minPS) return false;
                if (maxPS != null && size > maxPS) return false;
              }
              return true;
            });

            // Evaluate each objective
            let allCompleted = true;
            let completedCount = 0;
            for (const obj of objectives as ObjectiveSpec[]) {
              const existing = progress[obj.id] || { current: 0, target: obj.target, completed: false };
              const updated = evaluateObjective(obj, filteredActivities.reverse(), existing); // Oldest first for streak logic
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
              // Only advance the watermark to activities we've actually
              // evaluated this cycle. Using activities[0] here would mark
              // even time-filtered or modifier-rejected runs as "counted",
              // which previously prevented the next-cycle re-evaluation
              // from ever firing. (See: K1 Logistics watermark trap, 2026-05-08.)
              lastActivityInstanceId:
                newActivities[0]?.activityInstanceId
                ?? enrollment.lastActivityInstanceId,
            };

            if (isComplete && enrollment.status !== "COMPLETED") {
              updateData.status = "COMPLETED";
              updateData.completedAt = new Date();

              // Award rewards
              if (def.notorietyReward > 0) {
                awardNotoriety(userId, "CHALLENGE_COMPLETED").catch(() => {});
              }
              if ((def as any).paperReward > 0 && awardPaper) {
                awardPaper(userId, "EARN_CHALLENGE", (def as any).paperReward, `Challenge completed: ${def.title}`, enrollment.instanceId).catch(() => {});
              }

              // Award badge if one is configured
              if (def.badgeId) {
                prisma.userBadge.create({
                  data: { userId, badgeId: def.badgeId },
                }).catch(() => {}); // Ignore dupes
              }

              console.log(`[challenges] ${userId} completed "${def.title}"`);

              // Notify via WebSocket
              if (notify) {
                notify(userId, {
                  type: "challenge:completed",
                  enrollmentId: enrollment.id,
                  instanceId: enrollment.instanceId,
                  challengeTitle: def.title,
                  progress,
                  notorietyReward: def.notorietyReward,
                  paperReward: (def as any).paperReward || 0,
                  badgeId: def.badgeId,
                });
              }
              // Broadcast lobby-wide so the public activity feed surfaces
              // challenge completions. Only fires when the def is scoped to
              // a lobby (LOBBY scope, with lobbyId set).
              if (broadcastToLobby && (def as any).lobbyId) {
                broadcastToLobby((def as any).lobbyId, {
                  type: "challenge:completed",
                  userId,
                  challengeTitle: def.title,
                  lobbyId: (def as any).lobbyId,
                });
              }

              // ── CHALLENGE_RACE credit ─────────────────────────────────
              // For every active CHALLENGE_RACE tournament where this user
              // has a registered entry AND this challenge def is in the
              // pool (or pool empty + lobby matches), increment score by
              // pointsPerCompletion. Then evaluate the win condition.
              try {
                await creditChallengeRace(prisma, userId, def.id, (def as any).lobbyId, createNotification, awardPaper);
              } catch (err: any) {
                console.warn("[challenges] race credit failed:", err?.message || err);
              }
            } else if (newActivities.length > 0 && notify) {
              // Progress updated but not complete — send progress event
              notify(userId, {
                type: "challenge:progress",
                enrollmentId: enrollment.id,
                instanceId: enrollment.instanceId,
                challengeTitle: def.title,
                progress,
              });
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

  // ── Tournament scoring cycle ──────────────────────────────────────────────
  // Runs every 60s, scores active LEADERBOARD tournaments
  // scoringRule JSON: { type: "challenge_completions", definitionIds?: string[] }
  //   or: { type: "total_kills" }, { type: "total_activities" }, { type: "fastest_clear" }

  async function tournamentCycle() {
    try {
      // Handle deadline-expiry for CHALLENGE_RACE separately — runs the
      // shared completeTournament helper so payouts/flair fire.
      const expiredRace = await prisma.tournament.findMany({
        where: { status: "ACTIVE", format: "CHALLENGE_RACE", endsAt: { lt: new Date() } },
        select: { id: true, title: true },
      });
      for (const t of expiredRace) {
        try {
          await completeTournament(prisma as any, t.id, { awardPaper, createNotification });
          console.log(`[tournaments] CHALLENGE_RACE "${t.title}" expired — auto-completed`);
        } catch (err: any) {
          console.warn(`[tournaments] expiry complete failed for ${t.id}:`, err?.message || err);
        }
      }

      const active = await prisma.tournament.findMany({
        where: { status: "ACTIVE", format: "LEADERBOARD" },
        include: { entries: true },
      });
      if (active.length === 0) return;

      for (const tourney of active) {
        // Auto-complete expired tournaments
        if (new Date(tourney.endsAt).getTime() < Date.now()) {
          const ranked = tourney.entries.sort((a, b) => b.score - a.score);
          for (let i = 0; i < ranked.length; i++) {
            await prisma.tournamentEntry.update({
              where: { id: ranked[i].id },
              data: { rank: i + 1 },
            }).catch(() => {});
          }
          await prisma.tournament.update({
            where: { id: tourney.id },
            data: { status: "COMPLETED" },
          });
          console.log(`[tournaments] "${tourney.title}" completed — ${ranked.length} entries ranked`);
          continue;
        }

        const rule = tourney.scoringRule as any;
        if (!rule?.type) continue;

        for (const entry of tourney.entries) {
          if (!entry.userId) continue;
          let score = 0;

          if (rule.type === "challenge_completions") {
            // Count completed challenge enrollments, optionally filtered by definitionId
            const where: any = { userId: entry.userId, status: "COMPLETED" };
            if (rule.definitionIds?.length) {
              where.instance = { definitionId: { in: rule.definitionIds } };
            }
            score = await prisma.challengeEnrollment.count({ where });

          } else if (rule.type === "total_kills") {
            // Sum all kills from activity log during tournament window
            const logs = await prisma.bungieActivityLog.findMany({
              where: {
                userId: entry.userId,
                period: { gte: tourney.startsAt, lte: tourney.endsAt },
              },
              select: { kills: true },
            });
            score = logs.reduce((sum, l) => sum + l.kills, 0);

          } else if (rule.type === "total_activities") {
            score = await prisma.bungieActivityLog.count({
              where: {
                userId: entry.userId,
                period: { gte: tourney.startsAt, lte: tourney.endsAt },
                completed: true,
              },
            });

          } else if (rule.type === "fastest_clear") {
            // Lowest duration for matching activities
            const actHash = rule.activityHash;
            if (actHash) {
              const fastest = await prisma.bungieActivityLog.findFirst({
                where: {
                  userId: entry.userId,
                  activityHash: actHash,
                  completed: true,
                  period: { gte: tourney.startsAt, lte: tourney.endsAt },
                },
                orderBy: { duration: "asc" },
                select: { duration: true },
              });
              // Invert: lower duration = higher score (max seconds minus actual)
              score = fastest ? Math.max(0, 86400 - fastest.duration) : 0;
            }
          }

          if (score !== entry.score) {
            await prisma.tournamentEntry.update({
              where: { id: entry.id },
              data: { score },
            }).catch(() => {});
          }
        }
      }
    } catch (e: any) {
      console.error("[tournaments] Scoring cycle error:", e.message);
    }
  }

  // Run immediately, then on interval
  setTimeout(cycle, 5000);
  setInterval(cycle, WORKER_INTERVAL);

  // Tournament scoring — every 60s
  setTimeout(tournamentCycle, 15000);
  setInterval(tournamentCycle, 60_000);

  // ── Recurring challenge instantiation ──────────────────────────────────────
  // Checks every 5 minutes for recurring definitions that need a new instance.
  // recurSchedule values: "daily", "weekly_tuesday", "weekly_friday", etc.

  async function recurringCycle() {
    try {
      const recurring = await prisma.challengeDefinition.findMany({
        where: { isRecurring: true, status: "ACTIVE" },
        include: {
          instances: {
            orderBy: { startsAt: "desc" },
            take: 1,
          },
        },
      });

      const now = new Date();
      const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      const todayName = dayNames[now.getDay()];

      for (const def of recurring) {
        const schedule = (def.recurSchedule || "").toLowerCase().trim();
        if (!schedule) continue;

        const lastInstance = def.instances[0];
        const lastStart = lastInstance ? new Date(lastInstance.startsAt).getTime() : 0;
        const hoursSinceLast = (now.getTime() - lastStart) / 3600000;

        let shouldCreate = false;
        let durationHours = 24; // default: 1 day

        if (schedule === "daily") {
          shouldCreate = hoursSinceLast >= 20; // allow 4h overlap
          durationHours = 24;
        } else if (schedule.startsWith("weekly_")) {
          const targetDay = schedule.replace("weekly_", "");
          shouldCreate = todayName === targetDay && hoursSinceLast >= 144; // ~6 days
          durationHours = 168; // 7 days
        } else if (schedule === "weekly") {
          // Default to Tuesday reset (Destiny weekly reset)
          shouldCreate = todayName === "tuesday" && hoursSinceLast >= 144;
          durationHours = 168;
        }

        if (shouldCreate) {
          const startsAt = new Date();
          const endsAt = new Date(startsAt.getTime() + durationHours * 3600000);

          // Close previous instance
          if (lastInstance && lastInstance.status === "ACTIVE") {
            await prisma.challengeInstance.update({
              where: { id: lastInstance.id },
              data: { status: "COMPLETED" },
            }).catch(() => {});

            // Mark any active enrollments on old instance as FAILED (didn't finish in time)
            await prisma.challengeEnrollment.updateMany({
              where: { instanceId: lastInstance.id, status: "ACTIVE" },
              data: { status: "FAILED" },
            }).catch(() => {});
          }

          await prisma.challengeInstance.create({
            data: {
              definitionId: def.id,
              startsAt,
              endsAt,
              status: "ACTIVE",
            },
          });

          console.log(`[challenges] Recurring instance created for "${def.title}" (${schedule})`);
        }
      }
    } catch (e: any) {
      console.error("[challenges] Recurring cycle error:", e.message);
    }
  }

  // Recurring — every 5 minutes
  setTimeout(recurringCycle, 20000);
  setInterval(recurringCycle, 300_000);
}
