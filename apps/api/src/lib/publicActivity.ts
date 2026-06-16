export type PublicActivity = {
  id: string;
  ts: number;
  kind: string;
  lobbyId?: string;
  roomId?: string;
  text: string;
  textReal?: string;
  userId?: string;
  userName?: string;
  accent?: string;
};

const BUFFER: PublicActivity[] = [];
const MAX = 100;
const TTL_MS = 60 * 60 * 1000;

let _seq = 0;
function nextId() {
  _seq = (_seq + 1) % 1_000_000;
  return `act_${Date.now().toString(36)}_${_seq}`;
}

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

const ROLE_BY_LOBBY: Record<string, string[]> = {
  dnd: ["a wizard", "a rogue", "a paladin", "a ranger", "a bard", "a cleric"],
  fakeout: ["a trader", "a desk", "a whale", "a degen", "a swing trader"],
  windrose: ["a hunter", "a bounty seeker"],
  destiny: ["a guardian", "a titan", "a hunter"],
  poker: ["a card sharp", "a grinder"],
  study: ["a scholar", "a study partner"],
  league: ["a summoner"],
  cs2: ["an operator"],
  dota2: ["an ancient"],
  pubg: ["a survivor"],
  fortnite: ["a builder"],
  poe: ["an exile"],
  mlb: ["a fan"],
  nhl: ["a fan"],
  pga: ["a fan"],
  marathon: ["a runner"],
  hq: ["a regular"],
  news: ["a reader"],
};
export function anonymousFor(lobbyId?: string): string {
  const key = String(lobbyId || "").toLowerCase();
  const pool = ROLE_BY_LOBBY[key];
  if (pool && pool.length) return pool[Math.floor(Math.random() * pool.length)];
  return "someone";
}

const _lastByKey = new Map<string, number>();
export function shouldEmit(key: string, minGapMs: number): boolean {
  const now = Date.now();
  const prev = _lastByKey.get(key) || 0;
  if (now - prev < minGapMs) return false;
  _lastByKey.set(key, now);
  return true;
}

const SYNTHETIC_POOL: Array<() => Omit<PublicActivity, "id" | "ts">> = [
  () => {
    const r = anonymousFor("dnd");
    return {
      kind: "dice",
      lobbyId: "dnd",
      text: r + " rolled 1d20+5 → 22",
      textReal: r + " rolled 1d20+5 → 22",
      accent: "#D9A942",
    };
  },
  () => {
    const r = anonymousFor("dnd");
    return {
      kind: "dice",
      lobbyId: "dnd",
      text: r + " rolled a NAT 20 on 1d20",
      textReal: r + " rolled a NAT 20 on 1d20",
      accent: "#22c55e",
    };
  },
  () => {
    const r = anonymousFor("dnd");
    return {
      kind: "dice",
      lobbyId: "dnd",
      text: r + " fumbled a NAT 1 on 1d20",
      textReal: r + " fumbled a NAT 1 on 1d20",
      accent: "#ef4444",
    };
  },
  () => {
    const r = anonymousFor("dnd");
    return {
      kind: "tavern",
      lobbyId: "dnd",
      text: r + " posted to the Tavern Board",
      textReal: r + " posted to the Tavern Board",
      accent: "#C4A55A",
    };
  },
  () => {
    const r = anonymousFor("dnd");
    return {
      kind: "campaign",
      lobbyId: "dnd",
      text: r + "’s party earned 500 XP",
      textReal: r + "’s party earned 500 XP",
      accent: "#fde68a",
    };
  },

  () => {
    const r = anonymousFor("fakeout");
    const sym = ["BTC", "ETH", "SOL", "DOGE"][Math.floor(Math.random() * 4)];
    return {
      kind: "trade",
      lobbyId: "fakeout",
      text: r + " opened a long on " + sym,
      textReal: r + " opened a long on " + sym,
      accent: "#22c55e",
    };
  },
  () => {
    const r = anonymousFor("fakeout");
    const sym = ["BTC", "ETH", "SOL"][Math.floor(Math.random() * 3)];
    const pnl = Math.floor(Math.random() * 900) + 100;
    return {
      kind: "trade",
      lobbyId: "fakeout",
      text: r + " closed " + sym + " for +$" + pnl,
      textReal: r + " closed " + sym + " for +$" + pnl,
      accent: "#22c55e",
    };
  },
  () => {
    const r = anonymousFor("fakeout");
    const sym = ["BTC", "ETH", "SOL"][Math.floor(Math.random() * 3)];
    const pnl = Math.floor(Math.random() * 600) + 50;
    return {
      kind: "trade",
      lobbyId: "fakeout",
      text: r + " closed " + sym + " for -$" + pnl,
      textReal: r + " closed " + sym + " for -$" + pnl,
      accent: "#ef4444",
    };
  },

  () => {
    const r = anonymousFor("poker");
    const amt = (Math.floor(Math.random() * 9) + 2) * 50;
    return {
      kind: "poker",
      lobbyId: "poker",
      text: r + " won $" + amt + " Paper at the table",
      textReal: r + " won $" + amt + " Paper at the table",
      accent: "#22c55e",
    };
  },

  () => {
    const r = anonymousFor("windrose");
    return {
      kind: "bounty",
      lobbyId: "windrose",
      text: r + " claimed a Crewmate bounty",
      textReal: r + " claimed a Crewmate bounty",
      accent: "#b8935a",
    };
  },
  () => {
    const r = anonymousFor("windrose");
    return {
      kind: "bounty",
      lobbyId: "windrose",
      text: r + " posted a new bounty: hunt the Kraken",
      textReal: r + " posted a new bounty: hunt the Kraken",
      accent: "#b8935a",
    };
  },

  () => {
    const r = anonymousFor("destiny");
    return {
      kind: "challenge",
      lobbyId: "destiny2",
      text: r + " cleared a weekly Nightfall",
      textReal: r + " cleared a weekly Nightfall",
      accent: "#f58220",
    };
  },

  () => {
    const r = anonymousFor("");
    return {
      kind: "room",
      lobbyId: "",
      text: r + " opened a new room",
      textReal: r + " opened a new room",
      accent: "#9aa3b2",
    };
  },
  () => {
    const r = anonymousFor("");
    return {
      kind: "challenge",
      lobbyId: "",
      text: r + " earned a notoriety badge",
      textReal: r + " earned a notoriety badge",
      accent: "#fde68a",
    };
  },
];

export function seedSyntheticActivity(): void {
  if (BUFFER.length >= 6) return;
  const pick = SYNTHETIC_POOL[Math.floor(Math.random() * SYNTHETIC_POOL.length)];
  pushActivity(pick());
}

// Event -> public-ticker classifier, moved here from index.ts to sit beside
// the shouldEmit/anonymousFor/pushActivity helpers it drives.
export function capturePublicActivity(event: any, ctx: { lobbyId?: string; roomId?: string }) {
  const t = String(event?.type || "");
  if (!t) return;
  const lobbyHint = ctx.lobbyId || (event?.lobbyId ? String(event.lobbyId) : "");
  const userId = event?.userId ? String(event.userId) : undefined;
  const userName = event?.userName
    ? String(event.userName)
    : event?.user?.name
      ? String(event.user.name)
      : undefined;
  if (t === "dice:roll") {
    const isCrit = !!event.isNat20;
    const isFumble = !!event.isNat1;
    const key = `dice:${lobbyHint}:${isCrit ? "20" : isFumble ? "1" : "any"}`;
    if (!isCrit && !isFumble && !shouldEmit(key, 18_000)) return;
    const who = anonymousFor(lobbyHint);
    const realWho = userName || "someone";
    const expr = String(event.expression || "1d20");
    const total = Number(event.total || 0);
    const fmt = (w: string) =>
      isCrit
        ? `${w} rolled a NAT 20 on ${expr}`
        : isFumble
          ? `${w} fumbled a NAT 1 on ${expr}`
          : `${w} rolled ${expr} → ${total}`;
    pushActivity({
      kind: "dice",
      lobbyId: lobbyHint,
      text: fmt(who),
      textReal: fmt(realWho),
      userId,
      userName,
      accent: isCrit ? "#22c55e" : isFumble ? "#ef4444" : "#D9A942",
    });
    return;
  }
  if (t === "trading:trade") {
    const notional = Math.abs(Number(event?.trade?.notional || event?.notional || 0));
    if (notional < 1000) return;
    if (!shouldEmit(`trade:${lobbyHint}`, 6_000)) return;
    const sym = String(event?.trade?.symbol || event?.symbol || "BTCUSDT").replace(/USDT$/i, "");
    const side = String(event?.trade?.side || event?.side || "").toLowerCase();
    const verb = side === "sell" ? "closed" : "opened";
    const who = anonymousFor("fakeout");
    const realWho = userName || event?.trade?.userName || "someone";
    const fmt = (w: string) =>
      `${w} ${verb} a $${Math.round(notional).toLocaleString()} ${sym} position`;
    pushActivity({
      kind: "trade",
      lobbyId: lobbyHint || "fakeout",
      text: fmt(who),
      textReal: fmt(realWho),
      userId,
      userName: realWho,
      accent: "#22c55e",
    });
    return;
  }
  if (t === "trading:close" || t === "trading:position-closed") {
    const pnl = Number(event?.pnl ?? event?.realized ?? 0);
    if (Math.abs(pnl) < 500) return;
    if (!shouldEmit(`tradeclose:${lobbyHint}`, 8_000)) return;
    const who = anonymousFor("fakeout");
    const realWho = userName || "someone";
    const sign = pnl >= 0 ? "+" : "-";
    const fmt = (w: string) =>
      `${w} closed a position for ${sign}$${Math.abs(Math.round(pnl)).toLocaleString()}`;
    pushActivity({
      kind: "trade",
      lobbyId: lobbyHint || "fakeout",
      text: fmt(who),
      textReal: fmt(realWho),
      userId,
      userName: realWho,
      accent: pnl >= 0 ? "#22c55e" : "#ef4444",
    });
    return;
  }
  if (t === "room:created") {
    const name = String(event?.room?.name || event?.name || "a new room");
    if (!shouldEmit(`room:${lobbyHint}:${name}`, 30_000)) return;
    const fmt = () => `a new room opened: ${name}`;
    pushActivity({
      kind: "room",
      lobbyId: lobbyHint,
      text: fmt(),
      textReal: userName ? `${userName} opened a new room: ${name}` : fmt(),
      userId,
      userName,
      accent: "#D9A942",
    });
    return;
  }
  if (t === "tavern:posted" || t === "lfg:posted") {
    if (!shouldEmit(`tavern:${lobbyHint}`, 12_000)) return;
    const who = anonymousFor(lobbyHint || "dnd");
    const realWho = userName || "someone";
    const fmt = (w: string) => `${w} posted to the Tavern Board`;
    pushActivity({
      kind: "tavern",
      lobbyId: lobbyHint || "dnd",
      text: fmt(who),
      textReal: fmt(realWho),
      userId,
      userName: realWho,
      accent: "#D9A942",
    });
    return;
  }
  if (t === "windrose:build:posted") {
    if (!shouldEmit(`windrose-build:${userId || "any"}`, 5_000)) return;
    const who = anonymousFor("windrose");
    const realWho = userName || "a captain";
    const buildTitle = String(event?.title || "a build").slice(0, 40);
    const fmt = (w: string) => `${w} filed a Logbook entry: "${buildTitle}"`;
    pushActivity({
      kind: "build",
      lobbyId: "windrose",
      text: fmt(who),
      textReal: fmt(realWho),
      userId,
      userName: realWho,
      accent: "#e8c48a",
    });
    return;
  }
  if (t === "poker:pot-won" || t === "poker:hand-won") {
    const amount = Math.abs(Number(event?.amount || event?.pot || 0));
    if (amount < 200) return;
    if (!shouldEmit(`poker:${lobbyHint}`, 8_000)) return;
    const who = anonymousFor("poker");
    const realWho = userName || "someone";
    const fmt = (w: string) => `${w} took a ${amount.toLocaleString()} Paper pot`;
    pushActivity({
      kind: "poker",
      lobbyId: lobbyHint || "poker",
      text: fmt(who),
      textReal: fmt(realWho),
      userId,
      userName: realWho,
      accent: "#fcd34d",
    });
    return;
  }
  if (t === "windrose:bounty:claimed" || t === "windrose:bounty:posted") {
    if (!shouldEmit(`windrose:${t}`, 10_000)) return;
    const who = anonymousFor("windrose");
    const realWho = userName || "someone";
    const verb = t.endsWith(":posted") ? "posted" : "claimed";
    const fmt = (w: string) => `${w} ${verb} a bounty`;
    pushActivity({
      kind: "bounty",
      lobbyId: lobbyHint || "windrose",
      text: fmt(who),
      textReal: fmt(realWho),
      userId,
      userName: realWho,
      accent: "#a78bfa",
    });
    return;
  }
  if (t === "challenge:completed") {
    if (!shouldEmit(`destiny:${lobbyHint}`, 12_000)) return;
    const who = anonymousFor("destiny");
    const realWho = userName || "someone";
    const fmt = (w: string) => `${w} cleared a Destiny challenge`;
    pushActivity({
      kind: "challenge",
      lobbyId: lobbyHint || "destiny",
      text: fmt(who),
      textReal: fmt(realWho),
      userId,
      userName: realWho,
      accent: "#60a5fa",
    });
    return;
  }
  if (t === "campaign:ledger") {
    const entry = event?.entry || {};
    const entryType = String(entry.type || "").toUpperCase();
    const delta = Number(entry.delta || 0);
    const desc = String(entry.description || "")
      .trim()
      .slice(0, 48);
    if (!shouldEmit(`campaign:${lobbyHint}:${entryType}`, 12_000)) return;
    const who = anonymousFor(lobbyHint || "dnd");
    const realWho = userName || "someone";
    let fmt: (w: string) => string;
    if (entryType === "GOLD" && delta > 0) {
      const amt = Math.abs(delta).toLocaleString();
      fmt = (_w) => (desc ? `the party found ${amt} gp — ${desc}` : `the party found ${amt} gp`);
    } else if (entryType === "GOLD" && delta < 0) {
      const amt = Math.abs(delta).toLocaleString();
      fmt = (_w) => (desc ? `the party spent ${amt} gp — ${desc}` : `the party spent ${amt} gp`);
    } else if (entryType === "XP") {
      const amt = Math.abs(delta).toLocaleString();
      fmt = (w) => `${w} earned ${amt} XP`;
    } else if (entryType === "ITEM") {
      fmt = (w) => `${w} found ${desc || "an item"}`;
    } else {
      fmt = (_w) =>
        desc ? `the chronicle gained an entry — ${desc}` : `the party logged a chronicle entry`;
    }
    pushActivity({
      kind: "campaign",
      lobbyId: lobbyHint || "dnd",
      text: fmt(who),
      textReal: fmt(realWho),
      userId,
      userName: realWho,
      accent: "#C4A55A",
    });
    return;
  }
}
