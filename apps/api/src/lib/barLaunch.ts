import { randomBytes } from "node:crypto";

// A room-launched Beyond All Reason game. BAR's own servers do not accept
// outside hosts ("We do not accept private hosting" — BAR infrastructure docs),
// so these games run engine-to-engine: one room member hosts, the rest connect
// to that address. They are unrated. The password is generated here so a
// stranger who learns the host's IP cannot walk in.

export const BAR_MODES = ["team", "ffa", "coop-raptors", "coop-scavengers", "vs-ai"] as const;
export type BarMode = (typeof BAR_MODES)[number];

export type BarLaunchConfig = {
  map: string;
  mode: BarMode;
  teams: number;
  difficulty: "easy" | "normal" | "hard";
  hostUserId: string;
  /** "host:port". Empty only for vs-ai, where every player is on one machine. */
  hostAddress: string;
  password: string;
};

const MAP_RE = /^[A-Za-z0-9 _\-.'()+&]{1,120}$/;
const ADDR_RE = /^[A-Za-z0-9.-]{1,100}(:\d{2,5})?$/;

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

  return {
    map,
    mode,
    teams,
    difficulty,
    hostUserId,
    hostAddress,
    password: randomBytes(6).toString("hex"),
  };
}
