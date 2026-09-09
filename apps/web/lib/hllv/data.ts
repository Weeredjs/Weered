// Hell Let Loose: Vietnam — the game's own facts, as data.
//
// Everything here is reference material a unit uses at the planning table:
// the six launch maps, the seventeen roles, the vehicle park per side, and the
// mortar table. Sources: the game's RCON vocabulary (map codes, role ids) and
// the community-verified mortar chart. None of it depends on a server being
// reachable, which is the point — the Field Manual and the Fire Direction
// tools work at 03:00 with nothing linked.

export const HLLV_APP_ID = 3079210;

export type HllvMap = {
  code: string; // the dev's layer prefix (wdeva…) — what RCON reports
  name: string;
  year: number;
  tag: string;
  /** Which way the US line runs, reading the map north-up. */
  usFrom: "west" | "east" | "south";
  brief: string;
};

export const HLLV_MAPS: HllvMap[] = [
  {
    code: "wdeva",
    name: "Vạn Tường",
    year: 1965,
    tag: "VAN",
    usFrom: "east",
    brief:
      "Operation Starlite. Coastal hamlets, paddies and hedgerow between them — the first big US–VC set piece of the war. Tight infantry fighting; long sightlines are rare.",
  },
  {
    code: "wdevb",
    name: "Quảng Ngãi",
    year: 1965,
    tag: "QUA",
    usFrom: "west",
    brief:
      "Lowland province town and its approaches. Built-up centre with open ground around it; armour matters on the flanks, infantry decides the middle.",
  },
  {
    code: "wdevc",
    name: "Huế Outskirts",
    year: 1968,
    tag: "HUE",
    usFrom: "south",
    brief:
      "Tet. The fringes of the old capital: walls, compounds, the river line. Urban, vertical, unforgiving to anyone crossing a street without smoke.",
  },
  {
    code: "wdevd",
    name: "Đăk Tô Airfield",
    year: 1967,
    tag: "DAK",
    usFrom: "west",
    brief:
      "Central Highlands. An airstrip in a bowl of jungle hills; the strip is open and lethal, the hills around it are where the fight actually is.",
  },
  {
    code: "wdeve",
    name: "Cam Ranh Port",
    year: 1969,
    tag: "CAM",
    usFrom: "west",
    brief:
      "The deep-water port and its logistics sprawl. Docks, fuel farm, warehouses — hard cover everywhere, boats in play on the water side.",
  },
  {
    code: "wdevf",
    name: "Thanh Hòa Bridge",
    year: 1965,
    tag: "THA",
    usFrom: "south",
    brief:
      "The Dragon's Jaw. A bridge the US Air Force spent seven years failing to drop; here the fight is for the crossings and the AA positions covering them.",
  },
];

export const HLLV_MODES = [
  { id: "warfare", name: "Warfare", brief: "Five sectors, both sides push. The standard 50 v 50." },
  {
    id: "offensive",
    name: "Offensive",
    brief:
      "One side attacks, one defends, sector by sector against the clock. US or NVA can attack.",
  },
  {
    id: "domination",
    name: "Domination",
    brief: "Hold more of the map than the other side, for longer.",
  },
  { id: "conquest", name: "Conquest", brief: "Capture-and-hold across scattered points." },
] as const;

export type HllvRole = {
  id: number;
  name: string;
  type: "Infantry" | "Recon" | "Armor" | "Mortar" | "Helicopter" | "Command";
  lead?: boolean;
  usOnly?: boolean;
  brief: string;
};

export const HLLV_ROLES: HllvRole[] = [
  {
    id: 20,
    name: "Commander",
    type: "Command",
    lead: true,
    brief: "One per side. Runs the map: garrisons, supply drops, air and armour allocation.",
  },
  {
    id: 9,
    name: "Squad Leader",
    type: "Infantry",
    lead: true,
    brief:
      "Places outposts, calls garrisons, talks to Command. The squad exists because this seat is filled.",
  },
  { id: 0, name: "Rifleman", type: "Infantry", brief: "The line. Carries ammo for the squad." },
  {
    id: 3,
    name: "Medic",
    type: "Infantry",
    brief: "Revives. In single-life realism, the difference between a squad and a memory.",
  },
  {
    id: 5,
    name: "Specialist",
    type: "Infantry",
    brief: "Close-quarters kit — shotgun and flamethrower class.",
  },
  {
    id: 6,
    name: "Machine Gunner",
    type: "Infantry",
    brief: "Suppression. Sets the line the other side cannot cross.",
  },
  {
    id: 7,
    name: "Grenadier",
    type: "Infantry",
    brief: "M79 / RPG. Indirect fire over cover; the answer to a machine gun.",
  },
  {
    id: 8,
    name: "Engineer",
    type: "Infantry",
    brief: "Builds. Nodes, defences, repairs; NVA engineers dig the tunnels.",
  },
  {
    id: 4,
    name: "Spotter",
    type: "Recon",
    lead: true,
    brief: "Leads the recon team. Eyes for artillery and mortars.",
  },
  {
    id: 10,
    name: "Sniper",
    type: "Recon",
    brief: "Two-man team with the spotter. Hunts leaders and mortar crews.",
  },
  {
    id: 12,
    name: "Tank Commander",
    type: "Armor",
    lead: true,
    brief: "Commands the crew. M48 Patton or T-54.",
  },
  { id: 11, name: "Crewman", type: "Armor", brief: "Driver and gunner seats." },
  {
    id: 14,
    name: "Observer",
    type: "Mortar",
    lead: true,
    brief: "Leads the mortar team. Calls the fire mission; the Fire Direction tab is his.",
  },
  {
    id: 15,
    name: "Gunner",
    type: "Mortar",
    brief: "Lays the tube. Reads elevation in degrees, not mils.",
  },
  {
    id: 13,
    name: "Support",
    type: "Mortar",
    brief: "Ammunition for the tube. A mortar without support is three rounds.",
  },
  {
    id: 16,
    name: "Pilot",
    type: "Helicopter",
    lead: true,
    usOnly: true,
    brief: "Flies the Huey. US only — the NVA have no air.",
  },
  {
    id: 17,
    name: "Logistics Officer",
    type: "Helicopter",
    usOnly: true,
    brief: "Rides the Huey; supply and transport on the ground side.",
  },
];

export type HllvVehicle = {
  name: string;
  side: "US" | "NVA" | "Both";
  type: string;
  brief: string;
};

export const HLLV_VEHICLES: HllvVehicle[] = [
  {
    name: "M48 Patton",
    side: "US",
    type: "Medium tank",
    brief: "90 mm. The US armour piece; slow, well-armoured, the T-54's equal.",
  },
  {
    name: "T-54",
    side: "NVA",
    type: "Medium tank",
    brief: "100 mm. NVA main battle tank. Trades blows with the Patton.",
  },
  {
    name: "Bell UH-1 Iroquois",
    side: "US",
    type: "Helicopter · transport",
    brief: "The Huey. Lifts a squad; lands them where the roads do not go.",
  },
  {
    name: "Bell UH-1 Iroquois",
    side: "US",
    type: "Helicopter · supply",
    brief: "The Huey with supplies aboard. A garrison anywhere the pilot can put it down.",
  },
  {
    name: "M35 Truck",
    side: "US",
    type: "Truck · transport / supply",
    brief: "The road-bound way to move people and boxes.",
  },
  {
    name: "GAZ-63",
    side: "NVA",
    type: "Truck · transport / supply",
    brief: "NVA truck. Same two jobs.",
  },
  {
    name: "PBR",
    side: "US",
    type: "Boat",
    brief: "Patrol Boat, River. Armed; the fast way along the water.",
  },
  { name: "NVA Boat", side: "NVA", type: "Boat", brief: "Riverine transport for the North." },
  {
    name: "DShKM",
    side: "NVA",
    type: "Anti-aircraft gun",
    brief: "12.7 mm. The NVA answer to the Huey; a placed emplacement, not a vehicle.",
  },
  {
    name: "Mortar",
    side: "Both",
    type: "Indirect fire",
    brief: "Crewed by the three-man mortar team. Ranged in degrees — see Fire Direction.",
  },
];

/**
 * The mortar table. Elevation in DEGREES against range in metres; the same
 * table serves both sides. Cross-checked against two independent community
 * charts (175 m → 67°, 225 m → 49°, 450 m → 0°). Anything between rows is
 * linear interpolation, which is what the in-game dial rewards.
 */
export const MORTAR_TABLE: ReadonlyArray<readonly [number, number]> = [
  [100, 85],
  [125, 79],
  [150, 73],
  [175, 67],
  [200, 55],
  [225, 49],
  [250, 43],
  [275, 36],
  [300, 30],
  [350, 24],
  [375, 18],
  [400, 12],
  [425, 6],
  [450, 0],
];

export const MORTAR_MIN = MORTAR_TABLE[0][0];
export const MORTAR_MAX = MORTAR_TABLE[MORTAR_TABLE.length - 1][0];

/** Range → elevation, one decimal. Clamped to the envelope. */
export function mortarAngle(rangeM: number): number {
  const r = Math.min(MORTAR_MAX, Math.max(MORTAR_MIN, rangeM));
  for (let i = 1; i < MORTAR_TABLE.length; i++) {
    const [r0, a0] = MORTAR_TABLE[i - 1];
    const [r1, a1] = MORTAR_TABLE[i];
    if (r <= r1) return Math.round((a0 + ((r - r0) * (a1 - a0)) / (r1 - r0)) * 10) / 10;
  }
  return 0;
}

/** Elevation → range, for reading a dial back. */
export function mortarRange(angleDeg: number): number {
  const a = Math.min(85, Math.max(0, angleDeg));
  for (let i = 1; i < MORTAR_TABLE.length; i++) {
    const [r0, a0] = MORTAR_TABLE[i - 1];
    const [r1, a1] = MORTAR_TABLE[i];
    if (a >= a1) return Math.round(r0 + ((a0 - a) * (r1 - r0)) / (a0 - a1));
  }
  return MORTAR_MAX;
}

/** Pretty name for a layer id the server reports, e.g. wdeva_offensiveus_day. */
export function prettyLayer(id: string | null | undefined): string {
  const m = /^([a-z]+)_([a-z]+)_([a-z]+)$/i.exec(String(id || "").toLowerCase());
  if (!m) return id || "—";
  const map = HLLV_MAPS.find((x) => x.code === m[1])?.name || m[1];
  const mode =
    m[2] === "offensivenva"
      ? "Offensive · NVA attack"
      : m[2] === "offensiveus"
        ? "Offensive · US attack"
        : m[2].charAt(0).toUpperCase() + m[2].slice(1);
  const t = m[3] !== "day" ? ` · ${m[3].charAt(0).toUpperCase() + m[3].slice(1)}` : "";
  return `${map} · ${mode}${t}`;
}

/** Seconds → m:ss for the match clock. */
export function fmtClock(secs: number): string {
  const s = Math.max(0, Math.floor(secs));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}
