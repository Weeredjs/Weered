/**
 * Virtual-airline data, shaped on vAMSYS's own resources.
 *
 * Field names follow what vAMSYS publishes for pilots, ranks and PIREPs
 * (Orwell docs: ranks carry hours/points/PIREP thresholds and an 85x36
 * epaulette; PIREPs carry block and airborne time, landing rate in FPM, G-force,
 * fuel, points, network, and one of five statuses). The point of matching them
 * is stage two: when a real airline connects its vAMSYS Operations API, only the
 * SOURCE changes (see source.ts). Nothing downstream of VaSnapshot should know
 * or care whether the numbers came from the sample generator or from vAMSYS.
 */

export type VaFleet = "A320-200" | "A330-200" | "A330-300";

export type VaNetwork = "VATSIM" | "IVAO" | "OFFLINE";

/** vAMSYS's five PIREP statuses, verbatim in meaning. */
export type VaPirepStatus =
  | "PROCESSING"
  | "ACCEPTED"
  | "AWAITING_REVIEW"
  | "REJECTED"
  | "INVALIDATED";

export type VaAirport = {
  icao: string;
  iata: string;
  name: string;
  city: string;
  country: string; // ISO 3166-1 alpha-2
  lat: number;
  lon: number;
  region: "HUB" | "MED" | "ATLANTIC" | "NORTH_AMERICA" | "AFRICA_INDIAN_OCEAN";
};

export type VaAircraft = { reg: string; fleet: VaFleet };

/** A rank on the ladder. Honorary ranks have no thresholds (vAMSYS: awarded by hand). */
export type VaRank = {
  key: string;
  name: string;
  abbr: string;
  hours: number;
  points: number;
  pireps: number;
  stripes: number; // epaulette bars, drawn when no image is configured
  honorary?: boolean;
  image?: string | null; // 85x36 epaulette, the vAMSYS size
};

export type VaPilot = {
  id: string; // the airline's pilot id, e.g. "OCN1042"
  name: string;
  country: string;
  hub: string; // IATA
  rankKey: string;
  honoraryKey: string | null;
  minutes: number; // credited block time, all time
  points: number;
  pireps: number;
  joinedAt: string;
  lastFlightAt: string | null;
  network: VaNetwork;
  simulator: string;
  favouriteFleet: VaFleet;
  avgLandingFpm: number | null; // mean of the last 20 landings
  location: string; // IATA of where the aircraft last parked with this pilot
  userId: string | null; // linked Weered account, when there is one
};

export type VaPirep = {
  id: string;
  pilotId: string;
  pilotName: string;
  callsign: string;
  flightNumber: string;
  dep: string; // IATA
  arr: string; // IATA
  fleet: VaFleet;
  reg: string;
  blockMinutes: number;
  airborneMinutes: number;
  landingRateFpm: number; // negative, as vAMSYS reports it
  gForce: number;
  fuelKg: number;
  points: number;
  network: VaNetwork;
  simulator: string;
  status: VaPirepStatus;
  filedAt: string;
};

export type VaFlightPhase = "Taxi" | "Climb" | "Cruise" | "Descent" | "Approach";

export type VaLiveFlight = {
  id: string;
  pilotId: string;
  pilotName: string;
  callsign: string;
  flightNumber: string;
  dep: string;
  arr: string;
  fleet: VaFleet;
  reg: string;
  departedAt: string;
  arrivesAt: string;
  /** Wheels-up and touchdown. Between them the aircraft is on the great circle
   *  dep->arr, so a client can move it smoothly with the same maths. */
  takeoffAt: string;
  landingAt: string;
  progress: number; // 0..1
  phase: VaFlightPhase;
  lat: number;
  lon: number;
  heading: number;
  altitudeFt: number;
  groundSpeedKt: number;
  network: VaNetwork;
};

/** A booked departure that has not left yet (vAMSYS: a booking). */
export type VaDeparture = {
  id: string;
  pilotId: string;
  pilotName: string;
  callsign: string;
  flightNumber: string;
  dep: string;
  arr: string;
  fleet: VaFleet;
  reg: string;
  departsAt: string;
};

/** One bookable departure slot in a group flight (vAMSYS: Slotted Events). */
export type VaSlot = {
  key: string;
  std: string; // scheduled time of departure
  callsign: string;
  flightNumber: string;
  dep: string;
  arr: string;
  fleet: VaFleet;
  reg: string;
  gate: string;
  /** Held by a sample pilot in the generated data; null = open to claim. */
  presetPilotId: string | null;
};

export type VaWave = {
  key: string;
  name: string;
  base: string; // IATA
  note: string;
  slots: VaSlot[];
};

export type VaGroupFlight = {
  key: string;
  title: string;
  subtitle: string;
  briefing: string;
  startsAt: string;
  eventId: string | null; // the Weered Event it is announced as, if any
  waves: VaWave[];
};

export type VaStats = {
  pilots: number;
  activePilots30d: number;
  pirepsToday: number;
  pireps30d: number;
  hours30d: number;
  liveNow: number;
  avgLandingFpm7d: number | null;
  busiestRoute: { dep: string; arr: string; flights: number } | null;
};

export type VaApplication = {
  id: string;
  name: string;
  country: string;
  simulator: string;
  network: VaNetwork;
  hoursElsewhere: number;
  appliedAt: string;
  note: string;
};

export type VaSnapshot = {
  source: "sample" | "vamsys";
  generatedAt: string;
  ranks: VaRank[];
  airports: VaAirport[];
  fleet: VaAircraft[];
  pilots: VaPilot[];
  pireps: VaPirep[]; // newest first
  live: VaLiveFlight[];
  departures: VaDeparture[]; // soonest first
  stats: VaStats;
  groupFlights: VaGroupFlight[];
  applications: VaApplication[];
};

/** The swap point for stage two. The sample generator implements it today. */
export interface VaSource {
  readonly kind: "sample" | "vamsys";
  snapshot(nowMs: number): Promise<VaSnapshot>;
}
