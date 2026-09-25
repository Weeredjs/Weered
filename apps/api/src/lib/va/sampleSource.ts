import type {
  VaAircraft,
  VaAirport,
  VaApplication,
  VaDeparture,
  VaFleet,
  VaGroupFlight,
  VaLiveFlight,
  VaNetwork,
  VaPilot,
  VaPirep,
  VaPirepStatus,
  VaRank,
  VaSlot,
  VaSnapshot,
  VaSource,
  VaWave,
} from "./types";
import {
  FIRST_NAMES,
  LAST_NAMES,
  PILOT_COUNTRIES,
  SIMULATORS,
  VOCN_AIRPORTS,
  VOCN_FLEET,
  VOCN_RANKS,
} from "./vocnData";

/**
 * The SAMPLE virtual airline: a deterministic simulation, not a canned list.
 *
 * Time is cut into 12-minute ticks counted from a fixed EPOCH. At each tick the
 * seeded dice decide whether a free pilot pushes back, from wherever that pilot
 * last parked, to a destination their home base actually serves. The flight
 * crosses a great circle, lands, and files a PIREP at the moment of landing.
 *
 * Everything is a pure function of (seed, tick index), and the simulation only
 * ever runs FORWARD from the epoch, so:
 *  - every request agrees with every other: a flight on the map at 18:02 is the
 *    PIREP at the top of the log at 18:40, with the same landing rate;
 *  - a pilot is never in two places, because a pilot who is airborne or resting
 *    is simply not eligible to be dispatched;
 *  - nothing is stored. The only state that lives in the database is the one
 *    thing a human does here — claiming a group-flight slot (VaSlotClaim).
 *
 * Everything this produces is labelled SAMPLE in the UI and cannot be unlabelled.
 */

const EPOCH_MS = Date.UTC(2026, 8, 1, 0, 0, 0); // 2026-09-01T00:00Z
const TICK_MS = 12 * 60_000;
const HORIZON_MS = 90 * 60_000; // how far ahead "booked departures" look
const PILOT_COUNT = 48;

// Share of each hour (UTC) in which a departure is likely. European VA traffic:
// quiet overnight, building through the afternoon, peaking on evenings (CEST).
const HOUR_CURVE = [
  0.12, 0.08, 0.06, 0.05, 0.05, 0.08, 0.2, 0.35, 0.45, 0.5, 0.55, 0.55, 0.6, 0.65, 0.75, 0.9, 1, 1,
  1, 0.95, 0.85, 0.6, 0.38, 0.22,
];
const BASE_RATE = 0.62;

// ---------------------------------------------------------------- randomness

/** FNV-1a: a stable 32-bit hash of a string, to seed per-tick generators. */
function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: small, fast, good enough for a flight simulation's dice. */
function rngFrom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(r: () => number, xs: readonly T[]): T {
  return xs[Math.floor(r() * xs.length) % xs.length];
}

function weighted<T>(r: () => number, xs: readonly T[], w: (x: T) => number): T | null {
  let total = 0;
  for (const x of xs) total += Math.max(0, w(x));
  if (total <= 0) return null;
  let roll = r() * total;
  for (const x of xs) {
    roll -= Math.max(0, w(x));
    if (roll <= 0) return x;
  }
  return xs[xs.length - 1];
}

/** Box–Muller normal. */
function normal(r: () => number, mean: number, sd: number): number {
  const u = Math.max(1e-9, r());
  const v = r();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ------------------------------------------------------------------- geometry

const RAD = Math.PI / 180;

export function distanceKm(a: VaAirport, b: VaAirport): number {
  const dLat = (b.lat - a.lat) * RAD;
  const dLon = (b.lon - a.lon) * RAD;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Point a fraction f along the great circle from a to b. */
function greatCirclePoint(a: VaAirport, b: VaAirport, f: number): { lat: number; lon: number } {
  const φ1 = a.lat * RAD,
    λ1 = a.lon * RAD,
    φ2 = b.lat * RAD,
    λ2 = b.lon * RAD;
  const d = distanceKm(a, b) / 6371;
  if (d < 1e-9) return { lat: a.lat, lon: a.lon };
  const A = Math.sin((1 - f) * d) / Math.sin(d);
  const B = Math.sin(f * d) / Math.sin(d);
  const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
  const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
  const z = A * Math.sin(φ1) + B * Math.sin(φ2);
  return { lat: Math.atan2(z, Math.hypot(x, y)) / RAD, lon: Math.atan2(y, x) / RAD };
}

function bearing(from: { lat: number; lon: number }, to: { lat: number; lon: number }): number {
  const φ1 = from.lat * RAD,
    φ2 = to.lat * RAD,
    Δλ = (to.lon - from.lon) * RAD;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}

// ---------------------------------------------------------------- the airline

type PilotSim = VaPilot & {
  activity: number; // relative appetite for flying
  skill: number; // shifts the landing-rate distribution
  busyUntil: number;
  joinedMs: number;
  baseMinutes: number;
  basePoints: number;
  basePireps: number;
  landings: number[];
  wideBody: boolean;
};

type Flight = {
  id: string;
  pilot: PilotSim;
  dep: VaAirport;
  arr: VaAirport;
  fleet: VaFleet;
  reg: string;
  flightNumber: string;
  callsign: string;
  depMs: number;
  arrMs: number;
  blockMin: number;
  airMin: number;
  distKm: number;
  landingRate: number;
  roll: number; // one extra die, for status
};

const LONG_HAUL = new Set(["NORTH_AMERICA", "AFRICA_INDIAN_OCEAN"]);

function airportMap(): Map<string, VaAirport> {
  return new Map(VOCN_AIRPORTS.map((a) => [a.iata, a]));
}

/** Route numbers: stable per (hub, destination), odd for the return leg. */
function flightNumberFor(hub: string, dest: string, returning: boolean): string {
  const dests = VOCN_AIRPORTS.filter((a) => a.region !== "HUB").map((a) => a.iata);
  const i = Math.max(0, dests.indexOf(dest));
  const long = LONG_HAUL.has(VOCN_AIRPORTS.find((a) => a.iata === dest)?.region || "");
  const base = long ? (hub === "MUC" ? 300 : 100) : hub === "MUC" ? 2000 : 1000;
  return String(base + i * 2 + (returning ? 1 : 0));
}

function rankFor(ranks: VaRank[], hours: number, points: number, pireps: number): VaRank {
  let best = ranks[0];
  for (const r of ranks) {
    if (r.honorary) continue;
    if (hours >= r.hours && points >= r.points && pireps >= r.pireps) best = r;
  }
  return best;
}

function buildPilots(seed: string, links: Record<string, string>): PilotSim[] {
  const r = rngFrom(hash32(`${seed}:roster`));
  const used = new Set<string>();
  const pilots: PilotSim[] = [];
  let idNum = 1003;
  for (let i = 0; i < PILOT_COUNT; i++) {
    let name = "";
    for (let tries = 0; tries < 20; tries++) {
      name = `${pick(r, FIRST_NAMES)} ${pick(r, LAST_NAMES)}`;
      if (!used.has(name)) break;
    }
    used.add(name);
    idNum += 3 + Math.floor(r() * 9);
    const id = `OCN${idNum}`;
    const hub = r() < 0.64 ? "FRA" : "MUC";
    // A few veterans, a broad middle, a tail of cadets.
    const tier = r();
    const baseHours =
      tier < 0.12
        ? 600 + r() * 900
        : tier < 0.55
          ? 60 + r() * 400
          : tier < 0.85
            ? 10 + r() * 60
            : r() * 8;
    const activity = tier < 0.15 ? 3 + r() * 3 : tier < 0.8 ? 0.6 + r() * 1.4 : 0.15 + r() * 0.5;
    const baseMinutes = Math.round(baseHours * 60);
    const basePireps = Math.round(baseHours / (2.4 + r() * 2));
    const basePoints = Math.round(baseHours * (95 + r() * 40));
    // Most joined before the epoch; three cadets join during the window.
    const joinedMs =
      i >= PILOT_COUNT - 3
        ? EPOCH_MS + (6 + i - (PILOT_COUNT - 3) * 1) * 86_400_000 * 3
        : EPOCH_MS - Math.round((30 + r() * 1100) * 86_400_000);
    const network: VaNetwork = r() < 0.72 ? "VATSIM" : r() < 0.55 ? "IVAO" : "OFFLINE";
    pilots.push({
      id,
      name,
      country: pick(r, PILOT_COUNTRIES),
      hub,
      rankKey: "cdt",
      honoraryKey: null,
      minutes: baseMinutes,
      points: basePoints,
      pireps: basePireps,
      joinedAt: new Date(joinedMs).toISOString(),
      lastFlightAt: null,
      network,
      simulator: pick(r, SIMULATORS),
      favouriteFleet: "A320-200",
      avgLandingFpm: null,
      location: hub,
      userId: links[id] ?? null,
      activity,
      skill: normal(r, 0, 1),
      busyUntil: 0,
      joinedMs,
      baseMinutes,
      basePoints,
      basePireps,
      landings: [],
      wideBody: baseHours > 150 && r() < 0.6,
    });
  }
  // Every real roster has sleepers. Five pilots who were active before the
  // epoch never fly in the window, so the staff desk's inactivity list is real.
  const sleepers = pilots.filter((p) => p.joinedMs < EPOCH_MS - 120 * 86_400_000).slice(-5);
  for (const p of sleepers) p.activity = 0;
  // Honorary ranks go to experienced pilots: two trainers, three ops staff.
  const seniors = [...pilots]
    .filter((p) => p.activity > 0)
    .sort((a, b) => b.baseMinutes - a.baseMinutes);
  seniors.slice(0, 2).forEach((p) => (p.honoraryKey = "ltc"));
  seniors.slice(2, 5).forEach((p) => (p.honoraryKey = "ops"));
  return pilots;
}

function scheduleFlight(
  seed: string,
  tick: number,
  tickMs: number,
  pilots: PilotSim[],
  airports: Map<string, VaAirport>,
  fleetByType: Map<VaFleet, VaAircraft[]>,
  tailBusy: Map<string, number>,
): Flight | null {
  const r = rngFrom(hash32(`${seed}:tick:${tick}`));
  const d = new Date(tickMs);
  const weekend = d.getUTCDay() === 0 || d.getUTCDay() === 6 ? 1.2 : 1;
  if (r() > HOUR_CURVE[d.getUTCHours()] * BASE_RATE * weekend) return null;

  const pilot = weighted(r, pilots, (p) =>
    p.busyUntil <= tickMs && p.joinedMs <= tickMs ? p.activity : 0,
  );
  if (!pilot) return null;

  const dep = airports.get(pilot.location)!;
  let arr: VaAirport;
  let returning = false;
  if (dep.region === "HUB") {
    const dests = VOCN_AIRPORTS.filter((a) => a.region !== "HUB");
    arr = weighted(r, dests, (a) => {
      const long = LONG_HAUL.has(a.region);
      if (long) return pilot.wideBody ? 1.3 : 0.06;
      return pilot.wideBody ? 0.9 : 1.4;
    })!;
  } else {
    // Outstation: fly home, occasionally into the other base.
    arr = airports.get(r() < 0.9 ? pilot.hub : pilot.hub === "FRA" ? "MUC" : "FRA")!;
    returning = true;
  }
  const long = LONG_HAUL.has(arr.region) || LONG_HAUL.has(dep.region);
  const fleet: VaFleet = long ? (r() < 0.14 ? "A330-200" : "A330-300") : "A320-200";
  // A tail is a resource like a pilot: one sector at a time, plus a turnaround.
  // Without this the same registration showed up airborne on two routes at once,
  // which is exactly the thing a sim pilot notices first.
  const free = fleetByType.get(fleet)!.filter((a) => (tailBusy.get(a.reg) || 0) <= tickMs);
  if (!free.length) return null;
  const reg = pick(r, free).reg;
  const distKm = distanceKm(dep, arr);
  const cruiseKmh = fleet === "A320-200" ? 770 : 840;
  const taxi = 14 + Math.floor(r() * 12);
  const airMin = Math.round((distKm / cruiseKmh) * 60 + 18);
  const blockMin = airMin + taxi;
  const depMs = tickMs + Math.floor(r() * TICK_MS);
  const arrMs = depMs + blockMin * 60_000;
  const hubForNumber = returning ? arr.iata : dep.iata;
  const destForNumber = returning ? dep.iata : arr.iata;
  const num = flightNumberFor(hubForNumber === "MUC" ? "MUC" : "FRA", destForNumber, returning);
  const lr = -Math.round(
    Math.min(640, Math.max(38, Math.abs(normal(r, 175 - pilot.skill * 35, 70)))),
  );

  // The pilot rests after landing: busy pilots turn around fast, casual ones
  // disappear for a day or two. This is what spreads the traffic out.
  pilot.busyUntil = arrMs + (2 + r() * (38 / pilot.activity)) * 3_600_000;
  tailBusy.set(reg, arrMs + 45 * 60_000);
  pilot.location = arr.iata;

  return {
    id: `P${tick.toString(36).toUpperCase()}${pilot.id.slice(-3)}`,
    pilot,
    dep,
    arr,
    fleet,
    reg,
    flightNumber: `4Y ${num}`,
    callsign: `OCN${num}`,
    depMs,
    arrMs,
    blockMin,
    airMin,
    distKm,
    landingRate: lr,
    roll: r(),
  };
}

function pirepStatus(f: Flight, nowMs: number): VaPirepStatus {
  const filedMs = f.arrMs;
  if (nowMs - filedMs < 2 * 60_000) return "PROCESSING";
  const fresh = nowMs - filedMs < 5 * 86_400_000; // staff clear the queue within ~5 days
  if (f.roll < 0.004) return "INVALIDATED";
  if (f.roll < 0.012) return "REJECTED";
  // vAMSYS AutoReject-style triggers: a firm arrival, or a rare flag (pause, slew).
  if (f.landingRate < -480 || f.roll > 0.975) return fresh ? "AWAITING_REVIEW" : "ACCEPTED";
  return "ACCEPTED";
}

function pointsFor(f: Flight, status: VaPirepStatus): number {
  if (status === "REJECTED" || status === "INVALIDATED") return 0;
  let p = 100 + Math.floor(f.distKm / 18);
  if (f.landingRate > -120) p += 60;
  else if (f.landingRate > -220) p += 30;
  else if (f.landingRate < -400) p -= 25;
  if (f.pilot.network !== "OFFLINE") p += 20;
  return p;
}

function fuelFor(f: Flight): number {
  const perHour = f.fleet === "A320-200" ? 2450 : f.fleet === "A330-200" ? 5600 : 5900;
  return Math.round(((f.airMin / 60) * perHour + (f.blockMin - f.airMin) * 12) / 10) * 10;
}

function liveOf(f: Flight, nowMs: number): VaLiveFlight {
  const taxiOutMin = Math.min(14, (f.blockMin - f.airMin) * 0.6);
  const elapsedMin = (nowMs - f.depMs) / 60_000;
  const airProgress = Math.min(1, Math.max(0, (elapsedMin - taxiOutMin) / f.airMin));
  const pos = greatCirclePoint(f.dep, f.arr, airProgress);
  const ahead = greatCirclePoint(f.dep, f.arr, Math.min(1, airProgress + 0.01));
  const cruiseFt = f.fleet === "A320-200" ? 36000 : 38000;
  const climbFrac = Math.min(0.22, 25 / f.airMin);
  const descentFrac = Math.min(0.25, 32 / f.airMin);
  let phase: VaLiveFlight["phase"];
  let alt: number;
  let gs: number;
  if (elapsedMin < taxiOutMin || airProgress <= 0) {
    phase = "Taxi";
    alt = 0;
    gs = 14;
  } else if (airProgress < climbFrac) {
    phase = "Climb";
    alt = cruiseFt * (airProgress / climbFrac);
    gs = 250 + 210 * (airProgress / climbFrac);
  } else if (airProgress < 1 - descentFrac) {
    phase = "Cruise";
    alt = cruiseFt;
    gs = f.fleet === "A320-200" ? 452 : 478;
  } else if (airProgress < 1 - descentFrac * 0.25) {
    phase = "Descent";
    alt = cruiseFt * ((1 - airProgress) / descentFrac);
    gs = 280 + 170 * ((1 - airProgress) / descentFrac);
  } else {
    phase = "Approach";
    alt = Math.max(0, cruiseFt * ((1 - airProgress) / descentFrac));
    gs = airProgress >= 1 ? 14 : 150;
  }
  return {
    id: f.id,
    pilotId: f.pilot.id,
    pilotName: f.pilot.name,
    callsign: f.callsign,
    flightNumber: f.flightNumber,
    dep: f.dep.iata,
    arr: f.arr.iata,
    fleet: f.fleet,
    reg: f.reg,
    departedAt: new Date(f.depMs).toISOString(),
    arrivesAt: new Date(f.arrMs).toISOString(),
    takeoffAt: new Date(f.depMs + taxiOutMin * 60_000).toISOString(),
    landingAt: new Date(f.depMs + (taxiOutMin + f.airMin) * 60_000).toISOString(),
    progress: Math.min(1, Math.max(0, (nowMs - f.depMs) / (f.arrMs - f.depMs))),
    phase,
    lat: pos.lat,
    lon: pos.lon,
    heading: Math.round(bearing(pos, ahead)),
    altitudeFt: Math.round(alt / 100) * 100,
    groundSpeedKt: Math.round(gs),
    network: f.pilot.network,
  };
}

// ----------------------------------------------------------- the group flight

/**
 * The FRA/MUC bank that vOCN asked to see. Shaped on vAMSYS Slotted Events:
 * waves, a fixed callsign per slot, a departure time per slot. Registrations are
 * left for dispatch, as a slotted event assigns a type, not a tail.
 */
function buildGroupFlight(seed: string, pilots: PilotSim[]): VaGroupFlight {
  const startsAt = Date.UTC(2026, 9, 10, 16, 0, 0); // Sat 10 Oct 2026, 18:00 CEST
  const r = rngFrom(hash32(`${seed}:bank`));
  const wave = (
    key: string,
    name: string,
    base: string,
    note: string,
    offsetMin: number,
    spacing: number,
    callBase: number,
    gates: string[],
    legs: { arr: string; fleet: VaFleet }[],
  ): VaWave => ({
    key,
    name,
    base,
    note,
    slots: legs.map((leg, i): VaSlot => {
      const call = callBase + i + 1;
      return {
        key: `${key}-${String(i + 1).padStart(2, "0")}`,
        std: new Date(startsAt + (offsetMin + i * spacing) * 60_000).toISOString(),
        callsign: `OCN${call}`,
        flightNumber: `4Y ${call}`,
        dep: base,
        arr: leg.arr,
        fleet: leg.fleet,
        reg: "",
        gate: gates[i % gates.length],
        presetPilotId: null,
      };
    }),
  });
  const A320 = "A320-200" as const;
  const waves: VaWave[] = [
    wave(
      "FRA-W1",
      "Atlantic Sun",
      "FRA",
      "Canaries and Madeira. Longest narrowbody sectors of the night.",
      0,
      4,
      9100,
      ["B20", "B22", "B24", "B26", "B28", "B42", "B44", "B46"],
      ["TFS", "LPA", "FUE", "ACE", "FNC", "TFS", "LPA", "ACE", "FUE", "FNC"].map((arr) => ({
        arr,
        fleet: A320,
      })),
    ),
    wave(
      "FRA-W2",
      "Mediterranean",
      "FRA",
      "Balearics, Crete, Rhodes and Split.",
      45,
      4,
      9200,
      ["A11", "A13", "A15", "A17", "A20", "A22"],
      ["PMI", "IBZ", "HER", "RHO", "SPU", "PMI", "HER", "IBZ", "RHO", "PMI"].map((arr) => ({
        arr,
        fleet: A320,
      })),
    ),
    wave(
      "FRA-HVY",
      "Heavies",
      "FRA",
      "The widebody wave. Halifax leads it out.",
      75,
      6,
      9300,
      ["Z25", "Z50", "Z52", "Z60"],
      [
        { arr: "YHZ", fleet: "A330-300" },
        { arr: "YYZ", fleet: "A330-300" },
        { arr: "MCO", fleet: "A330-300" },
        { arr: "LAS", fleet: "A330-300" },
        { arr: "ZNZ", fleet: "A330-200" },
        { arr: "MRU", fleet: "A330-300" },
      ],
    ),
    wave(
      "MUC-W1",
      "Munich Med",
      "MUC",
      "Out of Terminal 2 into the Mediterranean.",
      15,
      5,
      9400,
      ["G27", "G29", "G31", "H32", "H36"],
      ["PMI", "HER", "RHO", "SPU", "IBZ", "PMI", "HER", "RHO"].map((arr) => ({ arr, fleet: A320 })),
    ),
    wave(
      "MUC-W2",
      "Munich Atlantic",
      "MUC",
      "Munich to the Canaries.",
      60,
      5,
      9500,
      ["G36", "G38", "H45", "H47"],
      ["TFS", "LPA", "FUE", "ACE", "TFS", "LPA"].map((arr) => ({ arr, fleet: A320 })),
    ),
  ];
  // Roughly 55% of slots are already held by sample pilots from that base, so
  // the board reads as an event people are booking into — with room left over.
  const held = new Set<string>();
  for (const w of waves) {
    for (const s of w.slots) {
      if (r() > 0.55) continue;
      const wide = s.fleet !== "A320-200";
      const cand = pilots.filter(
        (p) => p.hub === w.base && !held.has(p.id) && (!wide || p.wideBody) && !p.userId,
      );
      if (!cand.length) continue;
      const p = pick(r, cand);
      held.add(p.id);
      s.presetPilotId = p.id;
    }
  }
  return {
    key: "autumn-sun-bank",
    title: "Herbstsonne: FRA & MUC Autumn Sun Bank",
    subtitle: "Five waves out of Frankfurt and Munich on all three Airbus types",
    briefing:
      "One evening, both bases, the whole network in miniature. Frankfurt launches the Atlantic Sun wave at 18:00 CEST, " +
      "Munich follows at 18:15, and the heavies push from Z-gates at 19:15 with Halifax first out. Book one slot per pilot. " +
      "Your callsign is fixed to the slot; dispatch and file through vAMSYS as normal on the night.",
    startsAt: new Date(startsAt).toISOString(),
    eventId: "vocn-evt-autumn-sun-bank",
    waves,
  };
}

function buildApplications(seed: string, nowMs: number): VaApplication[] {
  const r = rngFrom(hash32(`${seed}:apps`));
  // Each applicant is written as one coherent person. They used to be random
  // fields beside fixed notes, which produced "404 h elsewhere" next to "new to
  // online flying": the kind of contradiction airline staff spot instantly.
  const people: Omit<VaApplication, "id" | "name" | "appliedAt">[] = [
    {
      country: "DE",
      simulator: "MSFS 2024",
      network: "VATSIM",
      hoursElsewhere: 340,
      note: "Flew with a Condor VA for two years, looking for a leisure operation with real events.",
    },
    {
      country: "AT",
      simulator: "MSFS 2024",
      network: "VATSIM",
      hoursElsewhere: 0,
      note: "New to online flying. Completed the VATSIM S1 theory, keen on the A320.",
    },
    {
      country: "CH",
      simulator: "MSFS 2024",
      network: "VATSIM",
      hoursElsewhere: 60,
      note: "Real-world PPL holder, wants the long-haul A330 side.",
    },
    {
      country: "NL",
      simulator: "X-Plane 12",
      network: "IVAO",
      hoursElsewhere: 120,
      note: "Came from the Discord after the last group flight. Mostly evenings CET.",
    },
  ];
  return people.map((p, i) => ({
    ...p,
    id: `APP-${2600 + i * 7}`,
    name: `${pick(r, FIRST_NAMES)} ${pick(r, LAST_NAMES)}`,
    appliedAt: new Date(nowMs - Math.round((0.2 + i * 1.3 + r()) * 86_400_000)).toISOString(),
  }));
}

// ------------------------------------------------------------------ snapshot

export type SampleOptions = {
  seed?: string;
  /** airline pilot id -> Weered user id, from moduleConfig.va.pilotLinks */
  pilotLinks?: Record<string, string>;
  /** rank epaulette images, rank key -> URL, from moduleConfig.va.rankImages */
  rankImages?: Record<string, string>;
};

export function buildSampleSnapshot(nowMs: number, opts: SampleOptions = {}): VaSnapshot {
  const seed = opts.seed || "vocn";
  // pilotLinks is stored userId -> pilotId in config; the roster wants the reverse.
  const byPilot: Record<string, string> = {};
  for (const [userId, pilotId] of Object.entries(opts.pilotLinks || {})) byPilot[pilotId] = userId;

  const airports = airportMap();
  const fleetByType = new Map<VaFleet, VaAircraft[]>();
  for (const a of VOCN_FLEET) {
    const list = fleetByType.get(a.fleet) || [];
    list.push(a);
    fleetByType.set(a.fleet, list);
  }
  const ranks = VOCN_RANKS.map((rk) => ({ ...rk, image: opts.rankImages?.[rk.key] ?? null }));
  const pilots = buildPilots(seed, byPilot);

  const flights: Flight[] = [];
  const tailBusy = new Map<string, number>();
  const endTick = Math.floor((nowMs + HORIZON_MS - EPOCH_MS) / TICK_MS);
  for (let t = 0; t <= endTick; t++) {
    const f = scheduleFlight(
      seed,
      t,
      EPOCH_MS + t * TICK_MS,
      pilots,
      airports,
      fleetByType,
      tailBusy,
    );
    if (f) flights.push(f);
  }

  const pireps: VaPirep[] = [];
  const live: VaLiveFlight[] = [];
  const departures: VaDeparture[] = [];
  const fleetMinutes = new Map<string, Map<VaFleet, number>>();

  for (const f of flights) {
    const p = f.pilot;
    if (f.depMs > nowMs) {
      departures.push({
        id: f.id,
        pilotId: p.id,
        pilotName: p.name,
        callsign: f.callsign,
        flightNumber: f.flightNumber,
        dep: f.dep.iata,
        arr: f.arr.iata,
        fleet: f.fleet,
        reg: f.reg,
        departsAt: new Date(f.depMs).toISOString(),
      });
      continue;
    }
    if (f.arrMs > nowMs) {
      live.push(liveOf(f, nowMs));
      continue;
    }
    const status = pirepStatus(f, nowMs);
    const points = pointsFor(f, status);
    const credited = status === "INVALIDATED" ? 0 : f.blockMin;
    pireps.push({
      id: f.id,
      pilotId: p.id,
      pilotName: p.name,
      callsign: f.callsign,
      flightNumber: f.flightNumber,
      dep: f.dep.iata,
      arr: f.arr.iata,
      fleet: f.fleet,
      reg: f.reg,
      blockMinutes: f.blockMin,
      airborneMinutes: f.airMin,
      landingRateFpm: f.landingRate,
      gForce: Math.round((1.04 + Math.abs(f.landingRate) / 1100) * 100) / 100,
      fuelKg: fuelFor(f),
      points,
      network: p.network,
      simulator: p.simulator,
      status,
      filedAt: new Date(f.arrMs).toISOString(),
    });
    p.minutes += credited;
    p.points += points;
    if (status !== "INVALIDATED") p.pireps += 1;
    p.lastFlightAt = new Date(f.arrMs).toISOString();
    p.landings.push(f.landingRate);
    const fm = fleetMinutes.get(p.id) || new Map<VaFleet, number>();
    fm.set(f.fleet, (fm.get(f.fleet) || 0) + f.blockMin);
    fleetMinutes.set(p.id, fm);
  }
  pireps.sort((a, b) => Date.parse(b.filedAt) - Date.parse(a.filedAt));

  for (const p of pilots) {
    p.rankKey = rankFor(ranks, p.minutes / 60, p.points, p.pireps).key;
    const recent = p.landings.slice(-20);
    p.avgLandingFpm = recent.length
      ? Math.round(recent.reduce((a, b) => a + b, 0) / recent.length)
      : null;
    const fm = fleetMinutes.get(p.id);
    if (fm && fm.size) p.favouriteFleet = [...fm.entries()].sort((a, b) => b[1] - a[1])[0][0];
    else p.favouriteFleet = p.wideBody ? "A330-300" : "A320-200";
  }

  const dayStart = new Date(nowMs);
  dayStart.setUTCHours(0, 0, 0, 0);
  const d30 = nowMs - 30 * 86_400_000;
  const d7 = nowMs - 7 * 86_400_000;
  const in30 = pireps.filter((x) => Date.parse(x.filedAt) >= d30);
  const in7 = pireps.filter((x) => Date.parse(x.filedAt) >= d7);
  const routes = new Map<string, number>();
  for (const x of in30) {
    const k = [x.dep, x.arr].sort().join("-");
    routes.set(k, (routes.get(k) || 0) + 1);
  }
  const top = [...routes.entries()].sort((a, b) => b[1] - a[1])[0];

  const pub = (p: PilotSim): VaPilot => {
    const {
      activity: _a,
      skill: _s,
      busyUntil: _b,
      joinedMs: _j,
      baseMinutes: _bm,
      basePoints: _bp,
      basePireps: _bpi,
      landings: _l,
      wideBody: _w,
      ...rest
    } = p;
    return rest;
  };

  departures.sort((a, b) => Date.parse(a.departsAt) - Date.parse(b.departsAt));
  live.sort((a, b) => Date.parse(a.departedAt) - Date.parse(b.departedAt));

  return {
    source: "sample",
    generatedAt: new Date(nowMs).toISOString(),
    ranks,
    airports: VOCN_AIRPORTS,
    fleet: VOCN_FLEET,
    pilots: pilots.map(pub),
    pireps,
    live,
    departures: departures.filter((d) => Date.parse(d.departsAt) <= nowMs + HORIZON_MS),
    stats: {
      pilots: pilots.filter((p) => p.joinedMs <= nowMs).length,
      activePilots30d: new Set(in30.map((x) => x.pilotId)).size,
      pirepsToday: pireps.filter((x) => Date.parse(x.filedAt) >= dayStart.getTime()).length,
      pireps30d: in30.length,
      hours30d: Math.round(in30.reduce((a, x) => a + x.blockMinutes, 0) / 60),
      liveNow: live.length,
      avgLandingFpm7d: in7.length
        ? Math.round(in7.reduce((a, x) => a + x.landingRateFpm, 0) / in7.length)
        : null,
      busiestRoute: top
        ? { dep: top[0].split("-")[0], arr: top[0].split("-")[1], flights: top[1] }
        : null,
    },
    groupFlights: [buildGroupFlight(seed, pilots)],
    applications: buildApplications(seed, nowMs),
  };
}

export class SampleSource implements VaSource {
  readonly kind = "sample" as const;
  constructor(private readonly opts: SampleOptions) {}
  async snapshot(nowMs: number): Promise<VaSnapshot> {
    return buildSampleSnapshot(nowMs, this.opts);
  }
}
