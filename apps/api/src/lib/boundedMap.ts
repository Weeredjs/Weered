/**
 * A Map that holds at most `max` entries: adding one more lets go of the oldest.
 *
 * For anything the process keeps for as long as it runs and files under what a
 * caller sent: a search, a card name, a subreddit, an address to read, a
 * member's id. A plain Map never lets go of an entry, so one of those grows
 * with every new key for as long as the process runs. Every cache and rate
 * window in the API is one of these, or checks its own size (hardening pass,
 * 2026-11-13; test/unit/boundedMap.test.ts keeps it so).
 *
 * The oldest entry is the first one put in (a Map keeps that order). For a
 * cache that costs one extra upstream call later; for a rate window it forgives
 * the member who has waited longest. Neither matters next to the ceiling.
 */
export class BoundedMap<K, V> extends Map<K, V> {
  private readonly max: number;

  constructor(max: number) {
    super();
    this.max = Math.max(1, Math.floor(max));
  }

  set(key: K, value: V): this {
    if (!this.has(key) && this.size >= this.max) {
      const oldest = this.keys().next();
      if (!oldest.done) this.delete(oldest.value);
    }
    return super.set(key, value);
  }
}
