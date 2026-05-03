// In-memory ring buffer of public activity events surfaced on the
// logged-out landing page. Pure side-effect free, no DB. Anonymized at
// publish time — handles are reduced to category descriptors.

export type PublicActivity = {
  id: string;
  ts: number;
  kind: string;       // e.g. "dice", "trade", "room", "tavern", "poker", "pin"
  lobbyId?: string;
  roomId?: string;
  text: string;       // anonymized one-liner for the public ticker
  textReal?: string;  // non-anonymized one-liner for authenticated surfaces
  userId?: string;
  userName?: string;
  accent?: string;
};

const BUFFER: PublicActivity[] = [];
const MAX = 100;
const TTL_MS = 60 * 60 * 1000;

let _seq = 0;
function nextId() { _seq = (_seq + 1) % 1_000_000; return `act_${Date.now().toString(36)}_${_seq}`; }

export function pushActivity(ev: Omit<PublicActivity, "id" | "ts"> & { ts?: number }): void {
  const now = Date.now();
  const e: PublicActivity = { id: nextId(), ts: ev.ts ?? now, ...ev };
  BUFFER.push(e);
  if (BUFFER.length > MAX) BUFFER.splice(0, BUFFER.length - MAX);
}

export function getActivity(limit = 30): PublicActivity[] {
  const cutoff = Date.now() - TTL_MS;
  while (BUFFER.length && BUFFER[0].ts < cutoff) BUFFER.shift();
  return BUFFER.slice(-limit).reverse();
}

// Soft-paraphrase a player handle into a category descriptor based on
// lobby context. Never echoes the raw name.
const ROLE_BY_LOBBY: Record<string, string[]> = {
  dnd:       ["a wizard", "a rogue", "a paladin", "a ranger", "a bard", "a cleric"],
  fakeout:   ["a trader", "a desk", "a whale", "a degen", "a swing trader"],
  windrose:  ["a hunter", "a bounty seeker"],
  destiny:   ["a guardian", "a titan", "a hunter"],
  poker:     ["a card sharp", "a grinder"],
  study:     ["a scholar", "a study partner"],
  league:    ["a summoner"],
  cs2:       ["an operator"],
  dota2:     ["an ancient"],
  pubg:      ["a survivor"],
  fortnite:  ["a builder"],
  poe:       ["an exile"],
  mlb:       ["a fan"],
  nhl:       ["a fan"],
  pga:       ["a fan"],
  marathon:  ["a runner"],
  hq:        ["a regular"],
  news:      ["a reader"],
};
export function anonymousFor(lobbyId?: string): string {
  const key = String(lobbyId || "").toLowerCase();
  const pool = ROLE_BY_LOBBY[key];
  if (pool && pool.length) return pool[Math.floor(Math.random() * pool.length)];
  return "someone";
}

// Throttle by event-key so identical chatter doesn't flood the wall.
const _lastByKey = new Map<string, number>();
export function shouldEmit(key: string, minGapMs: number): boolean {
  const now = Date.now();
  const prev = _lastByKey.get(key) || 0;
  if (now - prev < minGapMs) return false;
  _lastByKey.set(key, now);
  return true;
}
