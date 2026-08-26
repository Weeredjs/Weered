/**
 * Public read-only "N viewing" registry — ephemeral in-memory presence for
 * anonymous visitors on lobby pages, who are not in the WS presence system.
 * No DB, no auth.
 *
 * Every lobby page is public, so this cannot be allowlist-bounded; instead hard
 * caps plus TTL pruning (which drops empty buckets) keep the map bounded, so a
 * flood of junk ids self-heals within one TTL.
 */

const VIEWER_TTL_MS = 45_000;
const MAX_TRACKED_LOBBIES = 500; // distinct lobby buckets held at once
const MAX_VIEWERS_PER_LOBBY = 5000; // sids counted per lobby
const viewerReg = new Map<string, Map<string, number>>();

/**
 * Record an anonymous viewer on a lobby and return the current live count.
 * Refuses to open a NEW bucket once at the cap — that protects against a flood
 * of distinct junk lobby ids, while existing buckets keep updating normally.
 */
export function touchLobbyViewer(lobbyId: string, sid: string): number {
  const now = Date.now();
  let m = viewerReg.get(lobbyId);
  if (!m) {
    if (viewerReg.size >= MAX_TRACKED_LOBBIES) return 0;
    m = new Map();
    viewerReg.set(lobbyId, m);
  }
  if (m.size < MAX_VIEWERS_PER_LOBBY || m.has(sid)) m.set(sid, now);
  for (const [k, ts] of m) if (now - ts > VIEWER_TTL_MS) m.delete(k);
  if (m.size === 0) {
    viewerReg.delete(lobbyId); // drop the empty bucket so the map self-heals
    return 0;
  }
  return m.size;
}
