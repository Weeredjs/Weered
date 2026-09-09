// Shared bits for the RCON-linked server module (Hell Let Loose, both wars):
// API base, auth, the style sheet, and the wire types the tabs read. Kept
// here so the tab files stay small enough to read in one sitting (and under
// the deploy tripwire).
import type React from "react";

export const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

export type Game = "hll" | "hllv";

export function authHeaders(): Record<string, string> {
  try {
    const t = localStorage.getItem("weered_token") || "";
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

export type Faction = { short: string; name: string } | null;

export type Session = {
  serverName: string;
  mapId: string;
  mapName: string;
  map: string | null;
  mode: string | null;
  attacker: string | null;
  timeOfDay: string | null;
  remaining: number;
  matchTime: number;
  players: number;
  maxPlayers: number;
  allied: number;
  axis: number;
  alliedScore: number;
  axisScore: number;
  alliedFaction: Faction;
  axisFaction: Faction;
  queue: number;
  maxQueue: number;
  vipQueue: number;
  alliedMorale: number;
  axisMorale: number;
  initialMorale: number;
};

export type RotationEntry = {
  id: string;
  name: string;
  position: number;
  map: string | null;
  mode: string | null;
  attacker: string | null;
};

export type LinkedServer = {
  id: string;
  game: Game;
  name: string;
  note: string;
  status: string;
  error: string | null;
  lastSeenAt: string | null;
  live: Session | null;
  rotation: { current: number; maps: RotationEntry[] } | null;
  rhythmId: string;
  /** Rhythm comes from Steam's list, which has been sampling the box for weeks. */
  aggregate: boolean;
};

export type RosterPlayer = {
  name: string;
  clan: string | null;
  level: number;
  team: "allied" | "axis" | "none";
  roleId: number;
  role: string;
  roleType: string;
  lead: boolean;
  squad: string | null;
  squadIndex: number;
  score: { combat: number; offense: number; defense: number; support: number };
  kills: number;
  deaths: number;
  teamKills: number;
};

export type RosterSquad = { name: string; index: number; type: string; players: RosterPlayer[] };
export type RosterTeam = {
  faction: Faction;
  count: number;
  commander: RosterPlayer | null;
  squads: RosterSquad[];
  unassigned: RosterPlayer[];
};
export type Roster = {
  total: number;
  allied: RosterTeam;
  axis: RosterTeam;
  unassigned: RosterPlayer[];
};

/** Side label: the faction the server reports, else the generic side. */
export function sideName(f: Faction, side: "allied" | "axis"): string {
  return f?.short || (side === "allied" ? "Allies" : "Axis");
}

/** What a live session is called on a card: "Carentan · Warfare · Night". */
export function matchTitle(s: Session): string {
  const bits = [s.map, s.mode, s.attacker ? `${s.attacker} attack` : null].filter(Boolean);
  return bits.length ? bits.join(" · ") : s.mapName || s.mapId || "—";
}

/** Olive over canvas. The lobby's own accent overrides this at the panel. */
export const ACCENT = "#8FA35A";
export const ALLIED = "#9CC3E6";
export const AXIS = "#E08A7A";

export const S: Record<string, React.CSSProperties> = {
  wrap: { display: "flex", flexDirection: "column", overflow: "hidden" },
  body: { flex: 1, minHeight: 0, overflow: "auto", padding: "4px 14px 20px" },
  kick: {
    fontSize: 10.5,
    fontWeight: 700,
    letterSpacing: ".16em",
    textTransform: "uppercase",
    color: "var(--weered-accent-2, rgba(191,164,111,.85))",
    margin: "14px 0 8px",
  },
  card: {
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.07)",
    borderRadius: 10,
    padding: "12px 14px",
    marginBottom: 10,
  },
  muted: { color: "rgba(148,163,184,.75)", fontSize: 12.5, lineHeight: 1.55 },
  row: { display: "flex", alignItems: "center", gap: 10 },
  btn: {
    padding: "6px 12px",
    borderRadius: 6,
    border: "1px solid var(--weered-border2, rgba(191,164,111,.5))",
    background: "var(--weered-accent-bg, rgba(191,164,111,.14))",
    color: "var(--weered-accent-2, #E3D3AC)",
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  btnQuiet: {
    padding: "6px 12px",
    borderRadius: 6,
    border: "1px solid rgba(255,255,255,.14)",
    background: "transparent",
    color: "rgba(226,232,240,.85)",
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  input: {
    padding: "7px 10px",
    borderRadius: 6,
    border: "1px solid rgba(255,255,255,.14)",
    background: "rgba(0,0,0,.25)",
    color: "rgba(236,242,250,.95)",
    fontSize: 13,
    fontFamily: "inherit",
  },
  badge: {
    fontSize: 9.5,
    fontWeight: 800,
    letterSpacing: ".1em",
    padding: "2px 7px",
    borderRadius: 999,
  },
  big: {
    fontSize: 28,
    fontWeight: 800,
    fontVariantNumeric: "tabular-nums",
    color: "rgba(236,242,250,.98)",
    lineHeight: 1,
  },
};

/** What a link failure means, in words a unit officer can act on. */
export function linkError(code: string | null | undefined): string {
  switch (code) {
    case "bad_password":
      return "The server refused that RCON password.";
    case "private_host":
      return "That address points somewhere we cannot reach from the outside.";
    case "invalid_host":
    case "dns_empty":
      return "That hostname does not resolve.";
    case "bad_port":
      return "RCON ports are 1024–65535.";
    case "connect_timeout":
    case "connect_failed":
      return "Nothing answered on that host and port. Check the RCON port, not the game port.";
    case "timeout":
      return "It connected but did not answer in time.";
    case "protocol":
      return "Something answered, but not like a Hell Let Loose server.";
    case "mods_only":
      return "Officers only — you need moderator on this lobby.";
    case "full":
      return "This lobby has as many servers linked as it can hold.";
    case "missing_fields":
      return "Name, host, port and password are all needed.";
    default:
      return "Link failed.";
  }
}
