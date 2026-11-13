// What we keep of a feed from someone else's API, and when to leave that API
// alone.
//
// Written for the Helldivers 2 community API (routes/helldivers.ts), measured
// in the hardening pass of 2026-11-12: about 2,500 timeouts and 800 "slow
// down" answers in a week. Its cache dropped everything after 160 seconds, so
// once the API had been slow for three minutes every visitor's request went to
// it directly and waited the full 8 seconds, twice over for the war page, to
// be told there was nothing.
//
// - A newer answer is preferred, an older one is still an answer: what we last
//   heard is served for up to `staleMs` while the feed is failing.
// - After three failures in a row the API is left alone, for a minute at
//   first, doubling to fifteen. One success clears it.

export type Feed = ReturnType<typeof makeFeed>;

export function makeFeed(
  opts: {
    /** How long an answer counts as current. */
    freshMs?: number;
    /** How long an old answer is still better than none. */
    staleMs?: number;
    /** Failures in a row before the API is left alone. */
    failures?: number;
    now?: () => number;
  } = {},
) {
  const freshMs = opts.freshMs ?? 160_000;
  const staleMs = opts.staleMs ?? 30 * 60_000;
  const limit = opts.failures ?? 3;
  const now = opts.now ?? Date.now;
  const kept = new Map<string, { data: any; at: number }>();
  let fails = 0;
  let restUntil = 0;

  return {
    /** A current answer, or null. */
    fresh(key: string): any | null {
      const c = kept.get(key);
      return c && now() - c.at < freshMs ? c.data : null;
    },
    /** The last answer if it isn't too old to show, current or not. */
    last(key: string): any | null {
      const c = kept.get(key);
      return c && now() - c.at < staleMs ? c.data : null;
    },
    set(key: string, data: any) {
      kept.set(key, { data, at: now() });
    },
    /** The API answered. */
    ok() {
      fails = 0;
      restUntil = 0;
    },
    /** It didn't (a timeout, an error, "slow down"). True when this one starts a rest. */
    failed(): boolean {
      fails++;
      if (fails < limit) return false;
      const starting = now() >= restUntil;
      restUntil = now() + Math.min(15 * 60_000, 60_000 * 2 ** (fails - limit));
      return starting;
    },
    /** Leave the API alone for now. */
    resting(): boolean {
      return now() < restUntil;
    },
    /** Minutes of rest left, for the log. */
    restMinutes(): number {
      return Math.max(0, Math.ceil((restUntil - now()) / 60_000));
    },
  };
}
