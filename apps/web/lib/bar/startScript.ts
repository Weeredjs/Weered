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

export type BarConfig = {
  map: string;
  mode: BarMode;
  teams: number;
  difficulty: BarDifficulty;
  hostUserId: string;
  hostAddress: string;
  password: string;
};

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

  const aiNames: string[] =
    cfg.mode === "coop-raptors"
      ? [AI.raptors]
      : cfg.mode === "coop-scavengers"
        ? [AI.scavengers]
        : cfg.mode === "vs-ai"
          ? humans.map(() => AI.skirmish)
          : [];
  const aiAlly = aiNames.length ? ally("ai") : -1;

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
    line(1, "StartPosType=2;");

    block(1, "MODOPTIONS", () => {
      if (cfg.mode === "coop-raptors") line(2, `raptor_difficulty=${cfg.difficulty};`);
      if (cfg.mode === "coop-scavengers") line(2, `scav_difficulty=${cfg.difficulty};`);
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

    aiNames.forEach((shortName, k) => {
      const team = humans.length + k;
      block(1, `TEAM${team}`, () => {
        line(2, `TeamLeader=${hostIdx};`);
        line(2, `AllyTeam=${aiAlly};`);
      });
      block(1, `AI${k}`, () => {
        line(2, `Name=${shortName}${k + 1};`);
        line(2, `ShortName=${shortName};`);
        line(2, `Team=${team};`);
        line(2, `Host=${hostIdx};`);
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
