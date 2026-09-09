// Hell Let Loose vocabulary, both games.
//
// The RCON protocol is identical between base Hell Let Loose (WWII) and
// Hell Let Loose: Vietnam; what differs is what the numbers mean. Role ids,
// faction ids and the layer-id grammar each have a table here, keyed by game,
// so the route code never has to know which war it is looking at.

export type Game = "hll" | "hllv";

export const STEAM_APP_ID: Record<Game, number> = { hll: 686810, hllv: 3079210 };

export type RoleInfo = { name: string; type: string; lead?: boolean };
export type FactionInfo = { short: string; name: string; side: "allied" | "axis" };

// ---- roles ---------------------------------------------------------------------

const HLL_ROLES: Record<number, RoleInfo> = {
  0: { name: "Rifleman", type: "Infantry" },
  1: { name: "Assault", type: "Infantry" },
  2: { name: "Automatic Rifleman", type: "Infantry" },
  3: { name: "Medic", type: "Infantry" },
  4: { name: "Spotter", type: "Recon", lead: true },
  5: { name: "Support", type: "Infantry" },
  6: { name: "Machine Gunner", type: "Infantry" },
  7: { name: "Anti-Tank", type: "Infantry" },
  8: { name: "Engineer", type: "Infantry" },
  9: { name: "Officer", type: "Infantry", lead: true },
  10: { name: "Sniper", type: "Recon" },
  11: { name: "Crewman", type: "Armor" },
  12: { name: "Tank Commander", type: "Armor", lead: true },
  13: { name: "Commander", type: "Command", lead: true },
  14: { name: "Artillery Observer", type: "Artillery", lead: true },
  15: { name: "Operator", type: "Artillery" },
  16: { name: "Gunner", type: "Artillery" },
};

const HLLV_ROLES: Record<number, RoleInfo> = {
  0: { name: "Rifleman", type: "Infantry" },
  3: { name: "Medic", type: "Infantry" },
  4: { name: "Spotter", type: "Recon", lead: true },
  5: { name: "Specialist", type: "Infantry" },
  6: { name: "Machine Gunner", type: "Infantry" },
  7: { name: "Grenadier", type: "Infantry" },
  8: { name: "Engineer", type: "Infantry" },
  9: { name: "Squad Leader", type: "Infantry", lead: true },
  10: { name: "Sniper", type: "Recon" },
  11: { name: "Crewman", type: "Armor" },
  12: { name: "Tank Commander", type: "Armor", lead: true },
  13: { name: "Support", type: "Mortar" },
  14: { name: "Observer", type: "Mortar", lead: true },
  15: { name: "Gunner", type: "Mortar" },
  16: { name: "Pilot", type: "Helicopter", lead: true },
  17: { name: "Logistics Officer", type: "Helicopter" },
  20: { name: "Commander", type: "Command", lead: true },
};

/** The commander's role id; he is pulled out of the squad list on the board. */
export const COMMANDER_ROLE: Record<Game, number> = { hll: 13, hllv: 20 };

export function roleOf(game: Game, id: number): RoleInfo {
  const t = game === "hll" ? HLL_ROLES : HLLV_ROLES;
  return t[id] || { name: "Unassigned", type: "None" };
}

// ---- factions ------------------------------------------------------------------

const HLL_FACTIONS: Record<number, FactionInfo> = {
  0: { short: "GER", name: "Germany", side: "axis" },
  1: { short: "US", name: "United States", side: "allied" },
  2: { short: "SOV", name: "Soviet Union", side: "allied" },
  3: { short: "CW", name: "Commonwealth", side: "allied" },
  4: { short: "DAK", name: "Afrika Korps", side: "axis" },
  5: { short: "B8A", name: "British Eighth Army", side: "allied" },
  6: { short: "CAN", name: "Canada", side: "allied" },
};

const HLLV_FACTIONS: Record<number, FactionInfo> = {
  1: { short: "US", name: "United States", side: "allied" },
  6: { short: "NVA", name: "North Vietnam", side: "axis" },
};

export function factionOf(game: Game, id: number): FactionInfo | null {
  return (game === "hll" ? HLL_FACTIONS : HLLV_FACTIONS)[id] || null;
}

/** Team from the player's `team` field. In HLL:V the field carries the
 *  faction id (1 / 6); in HLL it does too (0..6). Both resolve through the
 *  faction table, so a player is "allied" or "axis" the way the game means it. */
export function sideOf(game: Game, teamField: number): "allied" | "axis" | "none" {
  return factionOf(game, teamField)?.side ?? "none";
}

// ---- layers --------------------------------------------------------------------

export type Layer = {
  map: string | null;
  mode: string | null;
  attacker: string | null;
  timeOfDay: string | null;
};

const HLLV_MAPS: Record<string, string> = {
  wdeva: "Vạn Tường",
  wdevb: "Quảng Ngãi",
  wdevc: "Huế Outskirts",
  wdevd: "Đăk Tô Airfield",
  wdeve: "Cam Ranh Port",
  wdevf: "Thanh Hòa Bridge",
};

/** Both the long id (`carentan`) and the tag the newer ids use (`CAR`). */
const HLL_MAPS: Record<string, string> = {
  carentan: "Carentan",
  car: "Carentan",
  driel: "Driel",
  drl: "Driel",
  elalamein: "El Alamein",
  ela: "El Alamein",
  elsenbornridge: "Elsenborn Ridge",
  ebr: "Elsenborn Ridge",
  foy: "Foy",
  hill400: "Hill 400",
  hil: "Hill 400",
  hurtgenforest: "Hürtgen Forest",
  hur: "Hürtgen Forest",
  junobeach: "Juno Beach",
  jun: "Juno Beach",
  kharkov: "Kharkov",
  kha: "Kharkov",
  kursk: "Kursk",
  kur: "Kursk",
  mortain: "Mortain",
  mor: "Mortain",
  omahabeach: "Omaha Beach",
  oma: "Omaha Beach",
  purpleheartlane: "Purple Heart Lane",
  phl: "Purple Heart Lane",
  remagen: "Remagen",
  rem: "Remagen",
  smolensk: "Smolensk",
  smo: "Smolensk",
  stmariedumont: "St. Marie du Mont",
  smdm: "St. Marie du Mont",
  stmereeglise: "Ste. Mère Église",
  sme: "Ste. Mère Église",
  stalingrad: "Stalingrad",
  sta: "Stalingrad",
  tobruk: "Tobruk",
  tbk: "Tobruk",
  utahbeach: "Utah Beach",
  uta: "Utah Beach",
};

const ATTACKERS: Record<string, string> = {
  us: "US",
  ger: "GER",
  dak: "DAK",
  sov: "SOV",
  rus: "SOV",
  cw: "CW",
  gb: "CW",
  b8a: "B8A",
  can: "CAN",
  nva: "NVA",
};

const TIMES: Record<string, string> = {
  day: "Day",
  night: "Night",
  dusk: "Dusk",
  dawn: "Dawn",
  morning: "Morning",
  rain: "Rain",
  overcast: "Overcast",
};

const MODES: Record<string, string> = {
  warfare: "Warfare",
  offensive: "Offensive",
  off: "Offensive",
  skirmish: "Skirmish",
  conquest: "Conquest",
  domination: "Domination",
};

/**
 * Turn a layer id into words. The WWII ids come in two grammars —
 * `carentan_warfare_night`, `elsenbornridge_offensiveUS_day` and
 * `REM_L_1945_OffensiveGER`, `SME_S_1944_Day_P_Skirmish` — and Vietnam's are
 * `wdeva_offensivenva_day`. Token by token, so a new map or a new time of
 * day degrades to "unknown" for that one field, never to a blank card.
 */
export function parseLayer(game: Game, id: string): Layer {
  const out: Layer = { map: null, mode: null, attacker: null, timeOfDay: null };
  const raw = String(id || "")
    .trim()
    .split("/")
    .pop()!
    .toLowerCase();
  if (!raw) return out;
  const maps = game === "hll" ? HLL_MAPS : HLLV_MAPS;
  for (const tok of raw.split("_")) {
    if (!tok) continue;
    if (!out.map && maps[tok]) {
      out.map = maps[tok];
      continue;
    }
    if (TIMES[tok]) {
      out.timeOfDay = TIMES[tok];
      continue;
    }
    if (MODES[tok]) {
      out.mode = MODES[tok];
      continue;
    }
    if (ATTACKERS[tok] && out.mode === "Offensive" && !out.attacker) {
      out.attacker = ATTACKERS[tok];
      continue;
    }
    // Glued forms: offensiveus, offensivenva, warfarenight.
    const m = /^(warfare|offensive|off|skirmish|conquest|domination)([a-z0-9]+)$/.exec(tok);
    if (m) {
      out.mode = MODES[m[1]];
      const rest = m[2];
      if (TIMES[rest]) out.timeOfDay = TIMES[rest];
      else if (ATTACKERS[rest]) out.attacker = ATTACKERS[rest];
      continue;
    }
  }
  if (!out.timeOfDay && out.map) out.timeOfDay = "Day";
  return out;
}

/** "Carentan · Offensive · GER attack", or as much of that as the id gave up. */
export function layerLabel(l: Layer): string {
  if (!l.map && !l.mode) return "";
  return [l.map, l.mode, l.attacker ? `${l.attacker} attack` : null].filter(Boolean).join(" · ");
}
