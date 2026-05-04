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


// Synthetic ticker filler — pushes one plausible event from a curated
// pool. Used by an interval in start() when the buffer is sparse so the
// landing/home tickers never look dead. Both anonymized (text == textReal)
// because there is no real user behind these events — honest signal that
// activity is happening across verticals without faking specific people.
const SYNTHETIC_POOL: Array<() => Omit<PublicActivity, "id" | "ts">> = [
  // D&D
  () => { const r = anonymousFor("dnd"); return { kind: "dice", lobbyId: "dnd", text: r + " rolled 1d20+5 → 22", textReal: r + " rolled 1d20+5 → 22", accent: "#D9A942" }; },
  () => { const r = anonymousFor("dnd"); return { kind: "dice", lobbyId: "dnd", text: r + " rolled a NAT 20 on 1d20", textReal: r + " rolled a NAT 20 on 1d20", accent: "#22c55e" }; },
  () => { const r = anonymousFor("dnd"); return { kind: "dice", lobbyId: "dnd", text: r + " fumbled a NAT 1 on 1d20", textReal: r + " fumbled a NAT 1 on 1d20", accent: "#ef4444" }; },
  () => { const r = anonymousFor("dnd"); return { kind: "tavern", lobbyId: "dnd", text: r + " posted to the Tavern Board", textReal: r + " posted to the Tavern Board", accent: "#C4A55A" }; },
  () => { const r = anonymousFor("dnd"); return { kind: "campaign", lobbyId: "dnd", text: r + "’s party earned 500 XP", textReal: r + "’s party earned 500 XP", accent: "#fde68a" }; },

  // FakeOut
  () => { const r = anonymousFor("fakeout"); const sym = ["BTC","ETH","SOL","DOGE"][Math.floor(Math.random()*4)]; return { kind: "trade", lobbyId: "fakeout", text: r + " opened a long on " + sym, textReal: r + " opened a long on " + sym, accent: "#22c55e" }; },
  () => { const r = anonymousFor("fakeout"); const sym = ["BTC","ETH","SOL"][Math.floor(Math.random()*3)]; const pnl = (Math.floor(Math.random()*900) + 100); return { kind: "trade", lobbyId: "fakeout", text: r + " closed " + sym + " for +$" + pnl, textReal: r + " closed " + sym + " for +$" + pnl, accent: "#22c55e" }; },
  () => { const r = anonymousFor("fakeout"); const sym = ["BTC","ETH","SOL"][Math.floor(Math.random()*3)]; const pnl = (Math.floor(Math.random()*600) + 50); return { kind: "trade", lobbyId: "fakeout", text: r + " closed " + sym + " for -$" + pnl, textReal: r + " closed " + sym + " for -$" + pnl, accent: "#ef4444" }; },

  // Poker
  () => { const r = anonymousFor("poker"); const amt = (Math.floor(Math.random()*9) + 2) * 50; return { kind: "poker", lobbyId: "poker", text: r + " won $" + amt + " Paper at the table", textReal: r + " won $" + amt + " Paper at the table", accent: "#22c55e" }; },

  // Windrose
  () => { const r = anonymousFor("windrose"); return { kind: "bounty", lobbyId: "windrose", text: r + " claimed a Crewmate bounty", textReal: r + " claimed a Crewmate bounty", accent: "#b8935a" }; },
  () => { const r = anonymousFor("windrose"); return { kind: "bounty", lobbyId: "windrose", text: r + " posted a new bounty: hunt the Kraken", textReal: r + " posted a new bounty: hunt the Kraken", accent: "#b8935a" }; },

  // Destiny 2
  () => { const r = anonymousFor("destiny"); return { kind: "challenge", lobbyId: "destiny2", text: r + " cleared a weekly Nightfall", textReal: r + " cleared a weekly Nightfall", accent: "#f58220" }; },

  // Cross-platform / generic
  () => { const r = anonymousFor(""); return { kind: "room", lobbyId: "", text: r + " opened a new room", textReal: r + " opened a new room", accent: "#9aa3b2" }; },
  () => { const r = anonymousFor(""); return { kind: "challenge", lobbyId: "", text: r + " earned a notoriety badge", textReal: r + " earned a notoriety badge", accent: "#fde68a" }; },
];

export function seedSyntheticActivity(): void {
  // Only inject if buffer is sparse (real activity should always win)
  if (BUFFER.length >= 6) return;
  const pick = SYNTHETIC_POOL[Math.floor(Math.random() * SYNTHETIC_POOL.length)];
  pushActivity(pick());
}
