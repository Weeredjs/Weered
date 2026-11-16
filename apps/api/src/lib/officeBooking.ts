// Follow-up bookings for the ECEB office (James 2026-11-16: "a booking
// calendar that syncs with outlook and can be included in the office to book
// followups ... do whatever is clean and works. Without migrating anything").
//
// His Outlook is IMAP only (no server calendar), so Weered keeps the bookings
// and publishes them as a private calendar feed (calendar.ics behind a key)
// that Outlook subscribes to once. Each booking also mails an invite (.ics).
// One JSON file, like the board and the office hours: no schema change.
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";

export const TZ = "America/Halifax";
export const BOOKING_FILE = () =>
  process.env.OFFICE_BOOKINGS_FILE || "/opt/weered/office-bookings.json";

/** Weekday ("0" Sunday … "6" Saturday) → open ranges, local "HH:MM". */
export type Hours = Record<string, Array<[string, string]>>;

export type Settings = {
  hours: Hours;
  /** Length of a follow-up, minutes. */
  slotMin: number;
  /** Nobody books sooner than this many hours ahead. */
  leadHours: number;
  /** How far ahead the calendar opens, days. */
  horizonDays: number;
  /** Times James is away: ISO instants. */
  blocks: Array<{ id: string; start: string; end: string; note?: string }>;
  /** The secret in the calendar feed's address. */
  feedKey: string;
};

export type Booking = {
  id: string;
  start: string; // ISO, UTC
  end: string;
  name: string;
  email: string;
  note?: string;
  by: "host" | "visitor";
  createdAt: string;
  cancelledAt?: string;
  remindedAt?: string;
};

export type Store = { settings: Settings; bookings: Booking[] };

export const MAX_FUTURE_PER_EMAIL = 2;
export const MAX_FUTURE = 200;

export function defaultSettings(): Settings {
  const day: Array<[string, string]> = [["09:00", "17:00"]];
  return {
    hours: { "1": day, "2": day, "3": day, "4": day, "5": day },
    slotMin: 30,
    leadHours: 12,
    horizonDays: 30,
    blocks: [],
    feedKey: randomBytes(18).toString("base64url"),
  };
}

export function readStore(file = BOOKING_FILE()): Store {
  try {
    if (existsSync(file)) {
      const j = JSON.parse(readFileSync(file, "utf8"));
      // The stored key is kept: cleanSettings carries the base's key, and a
      // fresh default here made a new one on every read (feed answered 404).
      const base = defaultSettings();
      if (typeof j?.settings?.feedKey === "string" && j.settings.feedKey.length >= 20)
        base.feedKey = j.settings.feedKey;
      const settings = cleanSettings(j?.settings, base);
      const bookings = Array.isArray(j?.bookings) ? j.bookings.filter(isBooking) : [];
      const s = { settings, bookings };
      if (!j?.settings?.feedKey) writeStore(s, file);
      return s;
    }
  } catch {
    /* a broken file reads as a fresh one; the write below keeps the key */
  }
  const fresh = { settings: defaultSettings(), bookings: [] };
  try {
    writeStore(fresh, file);
  } catch {
    /* read-only in tests */
  }
  return fresh;
}

export function writeStore(s: Store, file = BOOKING_FILE()): void {
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(s, null, 2));
  renameSync(tmp, file);
}

const isBooking = (b: any): b is Booking =>
  !!b && typeof b.id === "string" && typeof b.start === "string" && typeof b.end === "string";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Settings as sent by the host, held to sane values. */
export function cleanSettings(raw: any, base: Settings): Settings {
  const r = raw && typeof raw === "object" ? raw : {};
  const hours: Hours = {};
  const src = r.hours && typeof r.hours === "object" ? r.hours : base.hours;
  for (const d of ["0", "1", "2", "3", "4", "5", "6"]) {
    const ranges = Array.isArray(src[d]) ? src[d] : [];
    const ok = ranges
      .filter(
        (x: any) =>
          Array.isArray(x) && HHMM.test(String(x[0])) && HHMM.test(String(x[1])) && x[0] < x[1],
      )
      .slice(0, 4)
      .map((x: any) => [String(x[0]), String(x[1])] as [string, string]);
    if (ok.length) hours[d] = ok;
  }
  const num = (v: any, lo: number, hi: number, dflt: number) =>
    Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Math.round(Number(v)))) : dflt;
  const blocks = (Array.isArray(r.blocks) ? r.blocks : base.blocks)
    .filter((b: any) => b && !isNaN(Date.parse(b.start)) && !isNaN(Date.parse(b.end)))
    .filter((b: any) => Date.parse(b.end) > Date.parse(b.start))
    .slice(0, 100)
    .map((b: any) => ({
      id: typeof b.id === "string" && b.id ? b.id.slice(0, 40) : randomUUID(),
      start: new Date(b.start).toISOString(),
      end: new Date(b.end).toISOString(),
      ...(b.note ? { note: String(b.note).slice(0, 80) } : {}),
    }));
  return {
    hours,
    slotMin: [15, 20, 30, 45, 60, 90].includes(Number(r.slotMin))
      ? Number(r.slotMin)
      : base.slotMin,
    leadHours: num(r.leadHours, 0, 168, base.leadHours),
    horizonDays: num(r.horizonDays, 1, 90, base.horizonDays),
    blocks,
    feedKey: base.feedKey,
  };
}

// --- Time, in Halifax ---------------------------------------------------------

/** Minutes the zone is ahead of UTC at this instant (Halifax: -240 or -180). */
export function zoneOffsetMin(at: number, tz = TZ): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(new Date(at))
      .map((x) => [x.type, x.value]),
  );
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - Math.floor(at / 1000) * 1000) / 60000);
}

/** A wall-clock time in the zone → the instant (ms). */
export function localToUtc(date: string, hhmm: string, tz = TZ): number {
  const [y, m, d] = date.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  let t = guess - zoneOffsetMin(guess, tz) * 60000;
  t = guess - zoneOffsetMin(t, tz) * 60000; // settle across a DST change
  return t;
}

/** The zone's calendar date ("YYYY-MM-DD") and weekday at an instant. */
export function localDay(at: number, tz = TZ): { date: string; weekday: number } {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(at));
  const [y, m, d] = date.split("-").map(Number);
  return { date, weekday: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
}

const addDays = (date: string, n: number) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

const overlaps = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 && b0 < a1;

export const active = (b: Booking) => !b.cancelledAt;

/** Open start times (ISO) from now through the horizon. */
export function openSlots(store: Store, now = Date.now()): string[] {
  const { settings: s } = store;
  const taken = store.bookings
    .filter(active)
    .map((b) => [Date.parse(b.start), Date.parse(b.end)] as const)
    .concat(s.blocks.map((b) => [Date.parse(b.start), Date.parse(b.end)] as const));
  const earliest = now + s.leadHours * 3600_000;
  const out: string[] = [];
  const today = localDay(now).date;
  for (let i = 0; i <= s.horizonDays; i++) {
    const date = addDays(today, i);
    const weekday = localDay(localToUtc(date, "12:00")).weekday;
    for (const [from, to] of s.hours[String(weekday)] || []) {
      const end = localToUtc(date, to);
      for (let t = localToUtc(date, from); t + s.slotMin * 60000 <= end; t += s.slotMin * 60000) {
        const t1 = t + s.slotMin * 60000;
        if (t < earliest) continue;
        if (taken.some(([a, b]) => overlaps(t, t1, a, b))) continue;
        out.push(new Date(t).toISOString());
      }
    }
  }
  return out;
}

const EMAIL = /^[^\s@<>"',;]{1,64}@[^\s@<>"',;]{1,190}\.[a-z]{2,24}$/i;
export const cleanEmail = (v: unknown) => {
  const e = String(v || "").trim();
  return EMAIL.test(e) ? e : "";
};
export const cleanText = (v: unknown, max: number) =>
  String(v || "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .trim()
    .slice(0, max);

/** Book a slot, or say why not. */
export function book(
  store: Store,
  input: { start: unknown; name: unknown; email: unknown; note?: unknown; by: "host" | "visitor" },
  now = Date.now(),
): { ok: true; booking: Booking } | { ok: false; error: string } {
  const start = typeof input.start === "string" ? input.start : "";
  if (!openSlots(store, now).includes(start)) return { ok: false, error: "slot_taken" };
  const name = cleanText(input.name, 80);
  const email = cleanEmail(input.email);
  if (!name) return { ok: false, error: "name_required" };
  if (!email) return { ok: false, error: "email_invalid" };
  const future = store.bookings.filter((b) => active(b) && Date.parse(b.end) > now);
  if (future.length >= MAX_FUTURE) return { ok: false, error: "calendar_full" };
  if (
    input.by === "visitor" &&
    future.filter((b) => b.email.toLowerCase() === email.toLowerCase()).length >=
      MAX_FUTURE_PER_EMAIL
  )
    return { ok: false, error: "already_booked" };
  const t = Date.parse(start);
  const booking: Booking = {
    id: randomUUID(),
    start: new Date(t).toISOString(),
    end: new Date(t + store.settings.slotMin * 60000).toISOString(),
    name,
    email,
    ...(input.note ? { note: cleanText(input.note, 400) } : {}),
    by: input.by,
    createdAt: new Date(now).toISOString(),
  };
  store.bookings.push(booking);
  // Keep the file small: drop what ended over 90 days ago.
  store.bookings = store.bookings.filter((b) => Date.parse(b.end) > now - 90 * 86400_000);
  return { ok: true, booking };
}

// --- Calendar text ------------------------------------------------------------

const icsTime = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsText = (s: string) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/([,;])/g, "\\$1");
/** RFC 5545 lines fold at 75 octets. */
const fold = (line: string) => {
  const out: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest) > 74) {
    let n = 74;
    while (Buffer.byteLength(rest.slice(0, n)) > 74) n--;
    out.push(rest.slice(0, n));
    rest = " " + rest.slice(n);
  }
  out.push(rest);
  return out.join("\r\n");
};

export function icsEvent(
  b: Booking,
  opts: { summary: string; description: string; location: string; stamp?: string },
): string[] {
  return [
    "BEGIN:VEVENT",
    `UID:${b.id}@office.eastcoastemployeebenefits.com`,
    `DTSTAMP:${icsTime(opts.stamp || b.createdAt)}`,
    `DTSTART:${icsTime(b.start)}`,
    `DTEND:${icsTime(b.end)}`,
    `SUMMARY:${icsText(opts.summary)}`,
    `DESCRIPTION:${icsText(opts.description)}`,
    `LOCATION:${icsText(opts.location)}`,
    `URL:${opts.location}`,
    ...(b.cancelledAt ? ["STATUS:CANCELLED"] : ["STATUS:CONFIRMED"]),
    "END:VEVENT",
  ];
}

export function icsCalendar(events: string[][], name: string, method?: "PUBLISH"): string {
  return (
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Weered//ECEB office//EN",
      "CALSCALE:GREGORIAN",
      ...(method ? [`METHOD:${method}`] : []),
      `X-WR-CALNAME:${icsText(name)}`,
      "X-PUBLISHED-TTL:PT15M",
      ...events.flat(),
      "END:VCALENDAR",
    ]
      .map(fold)
      .join("\r\n") + "\r\n"
  );
}

/** "Tuesday, November 18 at 2:30 p.m." in Halifax, with the zone named. */
export function whenText(iso: string): string {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(d);
  const time = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
  return `${day} at ${time} Atlantic time`;
}
