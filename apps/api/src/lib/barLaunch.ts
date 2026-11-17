import { randomBytes } from "node:crypto";

// A room-launched Beyond All Reason game. BAR's own servers do not accept
// outside hosts ("We do not accept private hosting" — BAR infrastructure docs),
// so these games run engine-to-engine: one room member hosts, the rest connect
// to that address. They are unrated. The password is generated here so a
// stranger who learns the host's IP cannot walk in.

export const BAR_MODES = ["team", "ffa", "coop-raptors", "coop-scavengers", "vs-ai"] as const;
export type BarMode = (typeof BAR_MODES)[number];

/** BARb difficulty profiles, as BAR's own lobby names them (luarules/configs/barb). */
export const BAR_PROFILES = ["easy", "medium", "hard", "hard_aggressive"] as const;
export type BarProfile = (typeof BAR_PROFILES)[number];

/**
 * A full Crew vs AI game plan, pasted into the setup dialog as a setup code:
 * how many BARb opponents (and allies) at which difficulty, how starts are
 * assigned, and BAR game options, including tweakdefs/tweakunits (base64) for
 * custom units. Every option reaches every player through the host, so a
 * friend's game gets the same units without installing anything.
 */
export type BarSetup = {
  name: string;
  enemies: BarProfile[];
  allies: BarProfile[];
  /** 0 fixed map starts, 1 random, 2 choose in game. */
  startPosType: 0 | 1 | 2;
  modoptions: Record<string, string>;
};

export type BarLaunchConfig = {
  map: string;
  mode: BarMode;
  teams: number;
  difficulty: "easy" | "normal" | "hard";
  hostUserId: string;
  /** "host:port". Empty only for vs-ai, where every player is on one machine. */
  hostAddress: string;
  password: string;
  setup?: BarSetup;
};

const MAP_RE = /^[A-Za-z0-9 _\-.'()+&]{1,120}$/;
const ADDR_RE = /^[A-Za-z0-9.-]{1,100}(:\d{2,5})?$/;
// Option keys and values go into the start script verbatim, so neither may
// carry the script's own syntax (; [ ] { } = or a newline).
const OPT_KEY_RE = /^[a-z][a-z0-9_]{0,47}$/;
const OPT_VAL_RE = /^[A-Za-z0-9+/_.,:-]*={0,2}$/;
const OPT_TOTAL_MAX = 48_000;

function profiles(input: unknown, max: number): BarProfile[] | null {
  if (!Array.isArray(input) || input.length > max) return null;
  const out: BarProfile[] = [];
  for (const p of input) {
    const v = String(p) as BarProfile;
    if (!BAR_PROFILES.includes(v)) return null;
    out.push(v);
  }
  return out;
}

export function parseBarSetup(input: any): BarSetup | null {
  if (!input || typeof input !== "object") return null;
  const enemies = profiles(input.enemies, 10);
  const allies = profiles(input.allies ?? [], 6);
  if (!enemies || !allies || enemies.length === 0) return null;
  const spt = Number(input.startPosType ?? 0);
  if (![0, 1, 2].includes(spt)) return null;
  const modoptions: Record<string, string> = {};
  let total = 0;
  const raw = input.modoptions ?? {};
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  for (const [k, v] of Object.entries(raw)) {
    const val = String(v);
    if (!OPT_KEY_RE.test(k) || !OPT_VAL_RE.test(val)) return null;
    total += k.length + val.length;
    if (total > OPT_TOTAL_MAX || Object.keys(modoptions).length >= 60) return null;
    modoptions[k] = val;
  }
  const name =
    String(input.name || "Custom game")
      .replace(/[^A-Za-z0-9 '\-:,.!]/g, "")
      .trim()
      .slice(0, 40) || "Custom game";
  return { name, enemies, allies, startPosType: spt as 0 | 1 | 2, modoptions };
}

export function parseBarLaunch(
  input: any,
  room: { users: { has: (id: string) => boolean } },
): BarLaunchConfig | null {
  if (!input || typeof input !== "object") return null;

  const map = String(input.map || "").trim();
  if (!MAP_RE.test(map)) return null;

  const mode = String(input.mode || "") as BarMode;
  if (!BAR_MODES.includes(mode)) return null;

  const hostUserId = String(input.hostUserId || "");
  if (!hostUserId || !room.users.has(hostUserId)) return null;

  const hostAddress = String(input.hostAddress || "").trim();
  if (mode !== "vs-ai" && !ADDR_RE.test(hostAddress)) return null;
  if (hostAddress && !ADDR_RE.test(hostAddress)) return null;

  const rawTeams = Math.round(Number(input.teams) || 2);
  const teams =
    mode === "team"
      ? Math.min(4, Math.max(2, rawTeams))
      : mode === "ffa"
        ? Math.min(8, Math.max(2, rawTeams))
        : 1;

  const difficulty = ["easy", "normal", "hard"].includes(input.difficulty)
    ? (input.difficulty as BarLaunchConfig["difficulty"])
    : "normal";

  // A game plan only applies to Crew vs AI; a malformed one rejects the launch
  // rather than silently starting a different game than the one asked for.
  let setup: BarSetup | undefined;
  if (input.setup != null) {
    if (mode !== "vs-ai") return null;
    const parsed = parseBarSetup(input.setup);
    if (!parsed) return null;
    setup = parsed;
  }

  return {
    map,
    mode,
    teams,
    difficulty,
    hostUserId,
    hostAddress,
    password: randomBytes(6).toString("hex"),
    ...(setup ? { setup } : {}),
  };
}
