"use client";

import React from "react";
import { API, authHeaders } from "../../lib/apiClient";

/**
 * Shared pieces for the virtual-airline crew hub (moduleType VIRTUAL_AIRLINE).
 *
 * The palette is vOCN's own (virtualocn.de: navy #002554, blue #003e7b,
 * sunflower #ffcd00, ink #15263c), set dark because Weered is dark and because
 * their own night imagery reads best on it. Their Lufthansa typefaces are
 * licensed to them, not to us, so headings use Barlow Condensed, which Weered
 * already loads, and the board uses it in capitals like an airport display.
 */

export const VA = {
  night: "#000c1d",
  deep: "#001634",
  navy: "#002554",
  blue: "#003e7b",
  sky: "#1e73af",
  ice: "#b8cddd",
  sun: "#ffcd00",
  text: "#eaf2fa",
  muted: "#8ea5be",
  faint: "#5d7590",
  line: "rgba(184,205,221,.13)",
  card: "rgba(0,37,84,.42)",
  ok: "#3ecf8e",
  bad: "#ff6b6b",
  info: "#5fb4e8",
} as const;

export const HEAD_FONT = "var(--font-barlow), 'Barlow Condensed', 'Arial Narrow', sans-serif";

// ------------------------------------------------------------------ types

export type Fleet = "A320-200" | "A330-200" | "A330-300";
export type PirepStatus =
  | "PROCESSING"
  | "ACCEPTED"
  | "AWAITING_REVIEW"
  | "REJECTED"
  | "INVALIDATED";

export type Rank = {
  key: string;
  name: string;
  abbr: string;
  hours: number;
  points: number;
  pireps: number;
  stripes: number;
  honorary?: boolean;
  image?: string | null;
};

export type Airport = {
  icao: string;
  iata: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  region: string;
};

export type Pilot = {
  id: string;
  name: string;
  country: string;
  hub: string;
  rankKey: string;
  honoraryKey: string | null;
  minutes: number;
  points: number;
  pireps: number;
  joinedAt: string;
  lastFlightAt: string | null;
  network: string;
  simulator: string;
  favouriteFleet: Fleet;
  avgLandingFpm: number | null;
  location: string;
  active?: boolean;
  isMe?: boolean;
};

export type Pirep = {
  id: string;
  pilotId?: string;
  pilotName?: string;
  callsign: string;
  flightNumber: string;
  dep: string;
  arr: string;
  fleet: Fleet;
  reg: string;
  blockMinutes: number;
  airborneMinutes: number;
  landingRateFpm: number;
  gForce: number;
  fuelKg: number;
  points: number;
  network: string;
  simulator: string;
  status: PirepStatus;
  filedAt: string;
};

export type LiveFlight = {
  id: string;
  pilotId?: string;
  pilotName?: string;
  callsign: string;
  flightNumber: string;
  dep: string;
  arr: string;
  fleet: Fleet;
  reg: string;
  departedAt: string;
  arrivesAt: string;
  takeoffAt: string;
  landingAt: string;
  progress: number;
  phase: string;
  lat: number;
  lon: number;
  heading: number;
  altitudeFt: number;
  groundSpeedKt: number;
  network: string;
};

export type Departure = {
  id: string;
  pilotId: string;
  pilotName: string;
  callsign: string;
  flightNumber: string;
  dep: string;
  arr: string;
  fleet: Fleet;
  reg: string;
  departsAt: string;
};

export type VaLink = {
  label: string;
  url: string;
  note?: string;
  embed?: boolean;
  audience?: string;
};

export type Airline = {
  name: string;
  legalName?: string;
  icao: string;
  iata: string;
  tagline?: string;
  website?: string;
  registerUrl?: string;
  loginUrl?: string;
  disclaimer?: string;
};

export type Hub = {
  ok: true;
  sample: boolean;
  generatedAt: string;
  airline: Airline;
  me: { level: number; isStaff: boolean; signedIn: boolean; pilotId: string | null };
  stats: {
    pilots: number;
    activePilots30d: number;
    pirepsToday: number;
    pireps30d: number;
    hours30d: number;
    liveNow: number;
    avgLandingFpm7d: number | null;
    busiestRoute: { dep: string; arr: string; flights: number } | null;
  };
  ranks: Rank[];
  airports: Airport[];
  live: LiveFlight[];
  departures: Departure[];
  pireps: Pirep[];
  leaders: {
    hours: { pilotId: string; name: string; rankKey?: string; minutes: number }[];
    landings: {
      pilotId: string;
      name: string;
      rankKey?: string;
      landingRateFpm: number;
      route: string;
      fleet: Fleet;
    }[];
  } | null;
  groupFlight: {
    key: string;
    title: string;
    subtitle: string;
    startsAt: string;
    eventId: string | null;
    slots: number;
    booked: number;
    waves: { key: string; name: string; base: string; slots: number }[];
  } | null;
  links: VaLink[];
};

export const CREW_LEVEL = 2;
export const STAFF_LEVEL = 4;

// ------------------------------------------------------------------ fetch

/** Status-aware fetch: the hub needs to tell "not crew" (403) from "not signed in" (401). */
export async function vaFetch<T = any>(
  path: string,
  init?: { method?: "GET" | "POST"; body?: unknown },
): Promise<{ status: number; data: T | null }> {
  try {
    const r = await fetch(`${API}${path}`, {
      method: init?.method || "GET",
      cache: "no-store",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      // Fastify refuses a JSON content type with an empty body, so a POST
      // always carries at least {}.
      body: init?.method === "POST" ? JSON.stringify(init.body ?? {}) : undefined,
    });
    const data = await r.json().catch(() => null);
    return { status: r.status, data };
  } catch {
    return { status: 0, data: null };
  }
}

// ------------------------------------------------------------- formatting

export function hhmm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

export function hours(minutes: number): string {
  return Math.floor(minutes / 60).toLocaleString("en-GB");
}

export function utcTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** Central European time, which is what vOCN's pilots live in. */
export function cetTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Berlin",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return utcTime(iso);
  }
}

export function ago(iso: string | null, now = Date.now()): string {
  if (!iso) return "never";
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 36) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

export function countdown(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((Date.parse(iso) - now) / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function flagOf(cc: string): string {
  const c = (cc || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return "";
  return String.fromCodePoint(...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}

/**
 * Country as a small code chip. Not a flag emoji: Windows ships no flag glyphs,
 * so on the platform most sim pilots use, a flag renders as two bare letters
 * that look like a bug. A chip looks deliberate everywhere.
 */
export function Country({ cc }: { cc?: string | null }) {
  const c = (cc || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return null;
  return (
    <span
      title={c}
      style={{
        display: "inline-block",
        font: `700 10px/1 ${HEAD_FONT}`,
        letterSpacing: ".08em",
        padding: "2px 4px",
        borderRadius: 3,
        marginRight: 6,
        verticalAlign: "1px",
        color: VA.ice,
        background: "rgba(184,205,221,.1)",
        border: "1px solid rgba(184,205,221,.2)",
      }}
    >
      {c}
    </span>
  );
}

/** Landing rate colour: the number every VA pilot checks first. */
export function landingColor(fpm: number): string {
  const v = Math.abs(fpm);
  if (v <= 120) return VA.ok;
  if (v <= 250) return VA.info;
  if (v <= 400) return VA.sun;
  return VA.bad;
}

export function rankOf(ranks: Rank[], key?: string | null): Rank | undefined {
  return key ? ranks.find((r) => r.key === key) : undefined;
}

// ------------------------------------------------------------------ geo

const RAD = Math.PI / 180;

/** Same great-circle maths as the server, so a plane can move between polls. */
export function greatCircle(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
  f: number,
) {
  const φ1 = a.lat * RAD,
    λ1 = a.lon * RAD,
    φ2 = b.lat * RAD,
    λ2 = b.lon * RAD;
  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((φ2 - φ1) / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2,
      ),
    );
  if (d < 1e-9) return { lat: a.lat, lon: a.lon };
  const A = Math.sin((1 - f) * d) / Math.sin(d);
  const B = Math.sin(f * d) / Math.sin(d);
  const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
  const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
  const z = A * Math.sin(φ1) + B * Math.sin(φ2);
  return { lat: Math.atan2(z, Math.hypot(x, y)) / RAD, lon: Math.atan2(y, x) / RAD };
}

export function bearing(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const φ1 = a.lat * RAD,
    φ2 = b.lat * RAD,
    Δλ = (b.lon - a.lon) * RAD;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}

/** Where a live flight is at `now`, between the server's polls. */
export function positionAt(
  f: LiveFlight,
  dep: Airport | undefined,
  arr: Airport | undefined,
  now: number,
) {
  const t0 = Date.parse(f.takeoffAt);
  const t1 = Date.parse(f.landingAt);
  // No airports or no timings (an older API, a partial payload): stay where the
  // server last put the aircraft. A NaN here throws inside Leaflet and takes the
  // whole map down with it.
  if (!dep || !arr || !Number.isFinite(t0) || !Number.isFinite(t1))
    return { lat: f.lat, lon: f.lon, heading: f.heading, air: f.progress };
  const air = Math.min(1, Math.max(0, (now - t0) / Math.max(1, t1 - t0)));
  const p = greatCircle(dep, arr, air);
  const ahead = greatCircle(dep, arr, Math.min(1, air + 0.005));
  return { ...p, heading: air >= 1 ? f.heading : bearing(p, ahead), air };
}

// ---------------------------------------------------------------- pieces

/**
 * An epaulette: the configured 85x36 image when there is one (the vAMSYS
 * size), otherwise gold bars on navy, drawn. Captains wear four.
 */
export function Epaulette({ rank, height = 18 }: { rank?: Rank; height?: number }) {
  if (!rank) return null;
  const w = Math.round((height * 85) / 36);
  if (rank.image)
    return (
      <img
        src={rank.image}
        alt={rank.name}
        title={rank.name}
        width={w}
        height={height}
        style={{ display: "block" }}
      />
    );
  const bars = Math.max(1, Math.min(4, rank.stripes));
  const barH = 3;
  const gap = 2.2;
  const total = bars * barH + (bars - 1) * gap;
  const top = (18 - total) / 2;
  return (
    <svg
      width={w}
      height={height}
      viewBox="0 0 42 18"
      role="img"
      aria-label={rank.name}
      style={{ display: "block", flexShrink: 0 }}
    >
      <title>{rank.name}</title>
      <path
        d="M1 2.5 Q1 1 2.5 1 H35 L41 9 L35 17 H2.5 Q1 17 1 15.5 Z"
        fill="#061a3a"
        stroke="rgba(255,205,0,.35)"
        strokeWidth=".8"
      />
      {Array.from({ length: bars }, (_, i) => (
        <rect
          key={i}
          x="5"
          y={top + i * (barH + gap)}
          width="27"
          height={barH}
          rx=".6"
          fill={VA.sun}
        />
      ))}
      {rank.key === "scp" ? (
        <circle cx="36.5" cy="9" r="1.9" fill={VA.sun} />
      ) : (
        <circle cx="36.5" cy="9" r="1.3" fill="#8a6d00" />
      )}
    </svg>
  );
}

const STATUS_STYLE: Record<PirepStatus, { label: string; color: string }> = {
  // vAMSYS's own colours: blue, green, yellow, red, red.
  PROCESSING: { label: "Processing", color: VA.info },
  ACCEPTED: { label: "Accepted", color: VA.ok },
  AWAITING_REVIEW: { label: "Awaiting review", color: VA.sun },
  REJECTED: { label: "Rejected", color: VA.bad },
  INVALIDATED: { label: "Invalidated", color: VA.bad },
};

export function StatusChip({ status }: { status: PirepStatus }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.PROCESSING;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: ".02em",
        color: s.color,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          background: s.color,
          boxShadow: `0 0 6px ${s.color}`,
        }}
      />
      {s.label}
    </span>
  );
}

/** Permanent sample label. It can be reworded but never removed while sample data shows. */
export function SampleBanner({ text }: { text?: string }) {
  return (
    <div
      role="note"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "7px 12px",
        borderRadius: 8,
        border: `1px solid ${VA.sun}40`,
        background: `linear-gradient(90deg, ${VA.sun}14, transparent)`,
        color: VA.ice,
        fontSize: 12,
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: ".1em",
          padding: "2px 7px",
          borderRadius: 4,
          background: VA.sun,
          color: VA.navy,
          flexShrink: 0,
        }}
      >
        SAMPLE
      </span>
      <span>
        {text ||
          "Demo data. Pilots, flights and reports are generated to show how the hub works; in production they come from vAMSYS."}
      </span>
    </div>
  );
}

export function Card({
  title,
  right,
  children,
  style,
  pad = 16,
}: {
  title?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
  pad?: number;
}) {
  return (
    <section
      style={{
        background: VA.card,
        border: `1px solid ${VA.line}`,
        borderRadius: 14,
        padding: pad,
        minWidth: 0,
        backdropFilter: "blur(6px)",
        ...style,
      }}
    >
      {(title || right) && (
        <header
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <h3
            style={{
              margin: 0,
              fontFamily: HEAD_FONT,
              fontWeight: 700,
              fontSize: 15,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: VA.ice,
            }}
          >
            {title}
          </h3>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

/** A locked door, with the reason in the airline's own terms. */
export function Locked({
  need,
  signedIn,
  airline,
}: {
  need: "crew" | "staff";
  signedIn: boolean;
  airline: Airline | null;
}) {
  const name = airline?.name || "the airline";
  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        padding: "56px 20px",
        textAlign: "center",
        color: VA.muted,
      }}
    >
      <div style={{ fontSize: 34, marginBottom: 10 }}>{need === "staff" ? "📋" : "🔒"}</div>
      <div
        style={{
          fontFamily: HEAD_FONT,
          fontSize: 22,
          letterSpacing: ".06em",
          color: VA.text,
          textTransform: "uppercase",
        }}
      >
        {need === "staff" ? "Operations staff only" : `${name} crew only`}
      </div>
      <p style={{ maxWidth: 440, lineHeight: 1.55, margin: "10px 0 0" }}>
        {need === "staff"
          ? "The staff desk opens for operations staff and directors."
          : signedIn
            ? `This area opens once your account is verified as a ${name} pilot. In production that happens when you sign in with vAMSYS.`
            : `Sign in to continue. The crew area opens once your account is verified as a ${name} pilot.`}
      </p>
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontSize: 11,
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color: VA.muted,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: HEAD_FONT,
          fontSize: 30,
          fontWeight: 700,
          color: VA.text,
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {sub ? <div style={{ fontSize: 12, color: VA.faint, marginTop: 2 }}>{sub}</div> : null}
    </div>
  );
}

export function useNow(intervalMs = 1000): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
