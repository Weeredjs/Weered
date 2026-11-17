// Engine start scripts for room-launched Beyond All Reason games.
//
// Every client in the room builds the SAME host script from the SAME launch
// snapshot, so engine player names line up without a round trip: the host runs
// the full script, everyone else only needs the host's address, their own name
// and the room password. Format: RecoilEngine doc/StartScriptFormat.txt.
//
// These games never touch BAR's servers (BAR does not accept outside hosts), so
// they are unrated and never reach BAR's replay service.

export type BarMode = "team" | "ffa" | "coop-raptors" | "coop-scavengers" | "vs-ai";
export type BarDifficulty = "easy" | "normal" | "hard";

/** BARb difficulty profiles, as BAR's own lobby names them. */
export type BarProfile = "easy" | "medium" | "hard" | "hard_aggressive";
export const BAR_PROFILE_LABEL: Record<BarProfile, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  hard_aggressive: "Hard Aggressive",
};

/** A Crew vs AI game plan (validated again by the API, which is the authority). */
export type BarSetup = {
  name: string;
  enemies: BarProfile[];
  allies: BarProfile[];
  /** 0 fixed map starts, 1 random, 2 choose in game. */
  startPosType: 0 | 1 | 2;
  modoptions: Record<string, string>;
};

export type BarConfig = {
  map: string;
  mode: BarMode;
  teams: number;
  difficulty: BarDifficulty;
  hostUserId: string;
  hostAddress: string;
  password: string;
  setup?: BarSetup;
};

const PROFILE_FOR: Record<BarDifficulty, BarProfile> = {
  easy: "easy",
  normal: "medium",
  hard: "hard",
};
const PROFILES: BarProfile[] = ["easy", "medium", "hard", "hard_aggressive"];
const OPT_KEY_RE = /^[a-z][a-z0-9_]{0,47}$/;
const OPT_VAL_RE = /^[A-Za-z0-9+/_.,:-]*={0,2}$/;
export const SETUP_CODE_PREFIX = "WBAR1.";

/**
 * Decode a setup code ("WBAR1." + base64url JSON {map, setup}). Returns null on
 * anything malformed; the dialog shows that instead of guessing.
 */
export function parseSetupCode(code: string): { map: string; setup: BarSetup } | null {
  const text = String(code || "").replace(/\s+/g, "");
  if (!text.startsWith(SETUP_CODE_PREFIX) || text.length > 70_000) return null;
  let obj: any;
  try {
    const b64 = text.slice(SETUP_CODE_PREFIX.length).replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64 + "===".slice((b64.length + 3) % 4));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    obj = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
  const map = String(obj?.map || "").trim();
  const s = obj?.setup;
  if (!/^[A-Za-z0-9 _\-.'()+&]{1,120}$/.test(map) || !s || typeof s !== "object") return null;
  const list = (v: unknown, max: number) =>
    Array.isArray(v) && v.length <= max && v.every((p) => PROFILES.includes(p as BarProfile))
      ? (v as BarProfile[])
      : null;
  const enemies = list(s.enemies, 10);
  const allies = list(s.allies ?? [], 6);
  if (!enemies || !allies || enemies.length === 0) return null;
  const startPosType = Number(s.startPosType ?? 0);
  if (![0, 1, 2].includes(startPosType)) return null;
  const modoptions: Record<string, string> = {};
  for (const [k, v] of Object.entries(s.modoptions ?? {})) {
    if (!OPT_KEY_RE.test(k) || !OPT_VAL_RE.test(String(v))) return null;
    modoptions[k] = String(v);
  }
  const name = String(s.name || "Custom game").slice(0, 40);
  return {
    map,
    setup: { name, enemies, allies, startPosType: startPosType as 0 | 1 | 2, modoptions },
  };
}

/** "Last Stand · 4 AIs (2 Hard, 2 Medium) · 1 AI ally · 3 custom options" */
export function describeSetup(s: BarSetup): string {
  const count = (list: BarProfile[]) => {
    const by = new Map<BarProfile, number>();
    for (const p of list) by.set(p, (by.get(p) || 0) + 1);
    return [...by].map(([p, n]) => `${n} ${BAR_PROFILE_LABEL[p]}`).join(", ");
  };
  const parts = [
    s.name,
    `${s.enemies.length} enemy AI${s.enemies.length === 1 ? "" : "s"} (${count(s.enemies)})`,
  ];
  if (s.allies.length)
    parts.push(
      `${s.allies.length} AI all${s.allies.length === 1 ? "y" : "ies"} (${count(s.allies)})`,
    );
  const opts = Object.keys(s.modoptions).length;
  if (opts) parts.push(`${opts} game option${opts === 1 ? "" : "s"}`);
  return parts.join(" · ");
}

export type RosterEntry = { userId: string; name: string };

export const BAR_MODE_LABEL: Record<BarMode, string> = {
  team: "Team battle",
  ffa: "Free for all",
  "coop-raptors": "Co-op vs Raptors",
  "coop-scavengers": "Co-op vs Scavengers",
  "vs-ai": "Crew vs AI",
};

// Short names as they appear in BAR's own replays, sampled 2026-09-14.
const AI = { raptors: "RaptorsAI", scavengers: "ScavengersAI", skirmish: "BARb" } as const;
export const BAR_DEFAULT_PORT = 8452;

export function splitAddress(addr: string): { host: string; port: number } {
  // Parsed by hand rather than with a lazy regex, which backtracks on long input.
  const text = String(addr || "").trim();
  const colon = text.lastIndexOf(":");
  const tail = colon >= 0 ? text.slice(colon + 1) : "";
  if (colon > 0 && tail.length >= 2 && tail.length <= 5 && /^\d+$/.test(tail)) {
    return { host: text.slice(0, colon), port: Number(tail) };
  }
  return { host: text, port: BAR_DEFAULT_PORT };
}

function trimUnderscores(s: string): string {
  let start = 0;
  let end = s.length;
  while (start < end && s[start] === "_") start++;
  while (end > start && s[end - 1] === "_") end--;
  return s.slice(start, end);
}

/** Engine player names: unique (case-insensitively), no spaces, at most 20 characters. */
export function assignNames(entries: RosterEntry[]): Map<string, string> {
  const out = new Map<string, string>();
  const used = new Set<string>();
  for (const e of entries) {
    const base =
      trimUnderscores(String(e.name || "").replace(/[^A-Za-z0-9_[\]-]+/g, "_")).slice(0, 18) ||
      "player";
    let name = base;
    let n = 2;
    while (used.has(name.toLowerCase())) name = `${base.slice(0, 16)}_${n++}`;
    used.add(name.toLowerCase());
    out.set(e.userId, name);
  }
  return out;
}

type Plan = { players: RosterEntry[]; spectators: RosterEntry[] };

/** Players in slot order, then observers. The host always gets an entry: it runs the AIs. */
function planRoster(players: RosterEntry[], observers: RosterEntry[], hostUserId: string): Plan {
  const spectators = observers.filter((o) => !players.some((p) => p.userId === o.userId));
  const hostPresent =
    players.some((p) => p.userId === hostUserId) || spectators.some((s) => s.userId === hostUserId);
  if (!hostPresent) spectators.unshift({ userId: hostUserId, name: "host" });
  return { players, spectators };
}

export function buildHostScript(game: string, cfg: BarConfig, plan: Plan): string {
  const entries = [...plan.players, ...plan.spectators];
  const names = assignNames(entries);
  const humans = plan.players;
  const hostIdx = Math.max(
    0,
    entries.findIndex((e) => e.userId === cfg.hostUserId),
  );
  const { port } = splitAddress(cfg.hostAddress);

  // Ally teams must be numbered 0..n-1 with no gaps, so allocate on first use.
  const allyIds = new Map<string, number>();
  const ally = (key: string) => {
    if (!allyIds.has(key)) allyIds.set(key, allyIds.size);
    return allyIds.get(key) as number;
  };
  const humanAlly = humans.map((_, i) =>
    cfg.mode === "team"
      ? ally(`h${i % Math.max(2, cfg.teams)}`)
      : cfg.mode === "ffa"
        ? ally(`p${i}`)
        : ally("crew"),
  );

  // AI teams follow the humans, so with fixed starts (StartPosType 0) the humans
  // take the map's first start positions, then AI allies, then the enemy.
  type AiSeat = { shortName: string; allyTeam: number; profile?: BarProfile };
  const setup = cfg.mode === "vs-ai" ? cfg.setup : undefined;
  const ais: AiSeat[] = [];
  if (cfg.mode === "coop-raptors") ais.push({ shortName: AI.raptors, allyTeam: ally("ai") });
  if (cfg.mode === "coop-scavengers") ais.push({ shortName: AI.scavengers, allyTeam: ally("ai") });
  if (cfg.mode === "vs-ai" && setup) {
    for (const p of setup.allies)
      ais.push({ shortName: AI.skirmish, allyTeam: ally("crew"), profile: p });
    for (const p of setup.enemies)
      ais.push({ shortName: AI.skirmish, allyTeam: ally("ai"), profile: p });
  } else if (cfg.mode === "vs-ai") {
    const profile = PROFILE_FOR[cfg.difficulty] || "medium";
    humans.forEach(() => ais.push({ shortName: AI.skirmish, allyTeam: ally("ai"), profile }));
  }
  const modoptions: Record<string, string> = { ...(setup?.modoptions || {}) };

  const out: string[] = [];
  const line = (depth: number, s: string) => out.push("\t".repeat(depth) + s);
  const block = (depth: number, head: string, body: () => void) => {
    line(depth, `[${head}]`);
    line(depth, "{");
    body();
    line(depth, "}");
  };

  block(0, "GAME", () => {
    line(1, `GameType=${game};`);
    line(1, `MapName=${cfg.map};`);
    line(1, "IsHost=1;");
    line(1, "HostIP=;");
    line(1, `HostPort=${port};`);
    line(1, `MyPlayerName=${names.get(cfg.hostUserId) || "host"};`);
    line(1, `MyPasswd=${cfg.password};`);
    line(1, `NumPlayers=${humans.length};`);
    line(1, `StartPosType=${setup ? setup.startPosType : 2};`);

    block(1, "MODOPTIONS", () => {
      if (cfg.mode === "coop-raptors") line(2, `raptor_difficulty=${cfg.difficulty};`);
      if (cfg.mode === "coop-scavengers") line(2, `scav_difficulty=${cfg.difficulty};`);
      for (const [k, v] of Object.entries(modoptions)) {
        if (OPT_KEY_RE.test(k) && OPT_VAL_RE.test(v)) line(2, `${k}=${v};`);
      }
    });

    entries.forEach((e, idx) => {
      block(1, `PLAYER${idx}`, () => {
        line(2, `Name=${names.get(e.userId)};`);
        line(2, `Password=${cfg.password};`);
        const team = humans.indexOf(e);
        if (team >= 0) {
          line(2, "Spectator=0;");
          line(2, `Team=${team};`);
        } else {
          line(2, "Spectator=1;");
        }
      });
    });

    humans.forEach((_, i) => {
      block(1, `TEAM${i}`, () => {
        line(2, `TeamLeader=${i};`);
        line(2, `AllyTeam=${humanAlly[i]};`);
      });
    });

    ais.forEach((ai, k) => {
      const team = humans.length + k;
      block(1, `TEAM${team}`, () => {
        line(2, `TeamLeader=${hostIdx};`);
        line(2, `AllyTeam=${ai.allyTeam};`);
      });
      block(1, `AI${k}`, () => {
        line(2, `Name=${ai.shortName}${k + 1};`);
        line(2, `ShortName=${ai.shortName};`);
        line(2, `Team=${team};`);
        line(2, `Host=${hostIdx};`);
        if (ai.profile) block(2, "Options", () => line(3, `profile=${ai.profile};`));
      });
    });

    for (let a = 0; a < allyIds.size; a++) {
      block(1, `ALLYTEAM${a}`, () => line(2, "NumAllies=0;"));
    }
  });

  return out.join("\n") + "\n";
}

export function buildClientScript(cfg: BarConfig, myName: string): string {
  const { host, port } = splitAddress(cfg.hostAddress);
  return [
    "[GAME]",
    "{",
    `\tHostIP=${host};`,
    `\tHostPort=${port};`,
    `\tMyPlayerName=${myName};`,
    `\tMyPasswd=${cfg.password};`,
    "\tIsHost=0;",
    "}",
    "",
  ].join("\n");
}

export function scriptFor(args: {
  game: string;
  cfg: BarConfig;
  players: RosterEntry[];
  observers: RosterEntry[];
  myUserId: string;
}): { script: string; role: "host" | "client"; name: string } | { error: string } {
  const plan = planRoster(args.players, args.observers, args.cfg.hostUserId);
  const name = assignNames([...plan.players, ...plan.spectators]).get(args.myUserId);
  if (!name) return { error: "You aren't in this launch. Stay in the room while it fires." };
  if (args.players.length === 0) return { error: "Nobody slotted in as a player." };
  if (args.myUserId === args.cfg.hostUserId) {
    return { script: buildHostScript(args.game, args.cfg, plan), role: "host", name };
  }
  if (!args.cfg.hostAddress) {
    return { error: "This game has no host address, so only the host's PC can run it." };
  }
  return { script: buildClientScript(args.cfg, name), role: "client", name };
}
