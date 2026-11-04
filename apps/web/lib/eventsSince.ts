/** Where a lobby's upcoming events start: an hour ago, so one under way stays.
 *  The API lists events oldest first and caps the list, so asking without a
 *  `from` gave a lobby with a long past its history and dropped what's next
 *  (the Events tab, HLL's tonight strip and the VA hub, found 2026-11-04;
 *  the Home calendar block had the same fix on its own). */
export function eventsSince(now = Date.now()): string {
  return new Date(now - 3600_000).toISOString();
}
