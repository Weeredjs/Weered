/**
 * Per-user daily allowance for model calls.
 *
 * Every call is paid for from the one ANTHROPIC_API_KEY, and three paths let an
 * account (or, for /ai/search, anyone at all) spend it with no limit of its own:
 * /ai/search, /ai/quiz and the chat @operator (audit 2026-09-27). The NPC chat
 * route already had its own daily cap; this gives the others one.
 *
 * Kept in memory: a restart resets the day's counts, which errs toward letting
 * people through rather than locking them out.
 */
const used = new Map<string, { day: string; n: number }>();

export const AI_DAILY = {
  search: 50,
  quiz: 20,
  operator: 30,
} as const;

/** Spend one call from the user's allowance for `bucket`; false when it is gone. */
export function takeAiBudget(userId: string, bucket: keyof typeof AI_DAILY): boolean {
  if (!userId) return false;
  const day = new Date().toISOString().slice(0, 10);
  const key = `${bucket}:${userId}`;
  const cur = used.get(key);
  const n = cur && cur.day === day ? cur.n : 0;
  if (n >= AI_DAILY[bucket]) return false;
  if (used.size > 50_000) used.clear();
  used.set(key, { day, n: n + 1 });
  return true;
}
