// Where each name in the Town Square is from (api lib/lobbyHomes.ts), asked
// for in batches: every tag on screen within 40 ms goes out as one request of
// up to 50 people, and the answers are kept for ten minutes.

export type LobbyHome = {
  id: string;
  name: string;
  logoUrl: string | null;
  accentColor: string | null;
};
export type HomesFetcher = (ids: string[]) => Promise<Record<string, LobbyHome | null>>;

const API = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";
const TTL = 10 * 60_000;
const FAIL_TTL = 60_000;
const BATCH = 50;
const WAIT_MS = 40;

const cache = new Map<string, { home: LobbyHome | null; until: number }>();
const waiting = new Map<string, Array<(h: LobbyHome | null) => void>>();
let timer: ReturnType<typeof setTimeout> | null = null;

const defaultFetcher: HomesFetcher = async (ids) => {
  const r = await fetch(`${API}/lobbies/homes?ids=${ids.map(encodeURIComponent).join(",")}`);
  const j = await r.json();
  return j?.ok && j.homes && typeof j.homes === "object" ? j.homes : {};
};

/** What's known now: a home, null (none), or undefined (not asked yet). */
export function cachedHome(userId: string, now = Date.now()): LobbyHome | null | undefined {
  const c = cache.get(userId);
  if (!c) return undefined;
  if (now > c.until) {
    cache.delete(userId);
    return undefined;
  }
  return c.home;
}

export function homeOf(
  userId: string,
  fetcher: HomesFetcher = defaultFetcher,
): Promise<LobbyHome | null> {
  const known = cachedHome(userId);
  if (known !== undefined) return Promise.resolve(known);
  return new Promise((resolve) => {
    const list = waiting.get(userId);
    if (list) list.push(resolve);
    else waiting.set(userId, [resolve]);
    if (!timer) timer = setTimeout(() => void flush(fetcher), WAIT_MS);
  });
}

async function flush(fetcher: HomesFetcher) {
  timer = null;
  const batch = [...waiting.keys()].slice(0, BATCH);
  const resolvers = batch.map((id) => [id, waiting.get(id) || []] as const);
  batch.forEach((id) => waiting.delete(id));
  // More than one batch was waiting: the rest go next.
  if (waiting.size && !timer) timer = setTimeout(() => void flush(fetcher), 0);
  let homes: Record<string, LobbyHome | null> = {};
  let ok = true;
  try {
    homes = await fetcher(batch);
  } catch {
    ok = false;
  }
  const now = Date.now();
  for (const [id, fns] of resolvers) {
    const home = (ok && homes[id]) || null;
    cache.set(id, { home, until: now + (ok ? TTL : FAIL_TTL) });
    fns.forEach((fn) => fn(home));
  }
}

/** Tests only. */
export function resetHomes() {
  cache.clear();
  waiting.clear();
  if (timer) clearTimeout(timer);
  timer = null;
}
