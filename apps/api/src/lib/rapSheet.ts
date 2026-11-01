// A player's rap sheet (2026-11-01, the GTA VI launch): the card anyone can
// share, weered.ca/rap/<name>. What a player says about how and when they play,
// beside what Weered already knows (rank, crew, the "priors" below). Nothing is
// read from a game: no publisher offers an API for it.
//
// The choices are defined here only. The web editor gets them from
// GET /rapsheet/me (CHOICES), so a new playstyle is one line.

export const CHOICES = {
  playstyles: [
    "Heists",
    "Missions",
    "Racing",
    "Car meets",
    "Roleplay",
    "Chaos",
    "PvP",
    "Grinding",
    "Free roam",
    "Story",
    "Photo mode",
    "Stunts",
  ],
  playstylesMax: 5,
  hours: ["Mornings", "Afternoons", "Evenings", "Late nights", "Weekends", "Whenever"],
  hoursMax: 3,
  mic: [
    { id: "yes", label: "Mic on" },
    { id: "sometimes", label: "Sometimes" },
    { id: "no", label: "No mic" },
  ],
  lookingFor: [
    { id: "crew", label: "A crew" },
    { id: "players", label: "People to play with" },
    { id: "nothing", label: "Nothing, just here" },
  ],
  mottoMax: 80,
} as const;

/** GTA VI's day (2026-11-19). Anyone on file before midday UTC, past every
 *  time zone's midnight, was here "before the drop". */
export const LAUNCH_AT = new Date("2026-11-19T12:00:00Z");

export type RapSheetInput = {
  playstyles: string[];
  hours: string[];
  timezone: string;
  mic: string;
  lookingFor: string;
  motto: string;
};

const pickMany = (v: unknown, allowed: readonly string[], max: number): string[] => {
  const seen = new Set<string>();
  for (const x of Array.isArray(v) ? v : []) {
    const s = String(x);
    if (allowed.includes(s)) seen.add(s);
  }
  return [...seen].slice(0, max);
};
const pickOne = (v: unknown, allowed: readonly { id: string }[]): string => {
  const s = String(v ?? "");
  return allowed.some((a) => a.id === s) ? s : "";
};

/** What a player sent, kept to the choices: anything else is dropped, not refused. */
export function cleanRapSheet(body: any): RapSheetInput {
  const tz = String(body?.timezone ?? "").trim();
  return {
    playstyles: pickMany(body?.playstyles, CHOICES.playstyles, CHOICES.playstylesMax),
    hours: pickMany(body?.hours, CHOICES.hours, CHOICES.hoursMax),
    // An IANA zone from the browser (America/Halifax), or nothing.
    timezone: /^[A-Za-z]+(?:\/[A-Za-z0-9_+-]+){0,2}$/.test(tz) && tz.length <= 40 ? tz : "",
    mic: pickOne(body?.mic, CHOICES.mic),
    lookingFor: pickOne(body?.lookingFor, CHOICES.lookingFor),
    motto: String(body?.motto ?? "")
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, CHOICES.mottoMax),
  };
}

/** A PSN online ID as PSN allows them; "" clears it. Same rule as routes/profile.ts. */
export function cleanPsn(
  v: unknown,
): { ok: true; psn: string | null } | { ok: false; message: string } {
  const s = String(v ?? "").trim();
  if (!s) return { ok: true, psn: null };
  if (!/^[A-Za-z][A-Za-z0-9_-]{2,15}$/.test(s))
    return {
      ok: false,
      message:
        "PSN ID must be 3-16 characters, start with a letter, and contain only letters, numbers, dashes, or underscores.",
    };
  return { ok: true, psn: s };
}

/** The wanted-level meter: the nine street ranks (lib/notoriety.ts) as 0 to 5 stars. */
export function starsForRank(index: number): number {
  return Math.max(0, Math.min(5, Math.round((index * 5) / 8)));
}

export type Prior = { id: string; label: string; detail: string };

/**
 * The priors on a sheet, from what Weered knows. Order is the order shown.
 *   crew: the crew this player leads or rides with, if any.
 *   recruits: how many people came in on this player's invites.
 */
export function priorsFor(input: {
  createdAt: Date;
  notoriety: number;
  rankTitle: string;
  crew: { name: string; tag: string; boss: boolean } | null;
  recruits: number;
}): Prior[] {
  const out: Prior[] = [];
  if (input.createdAt < LAUNCH_AT)
    out.push({ id: "drop", label: "Before the drop", detail: "On file before GTA VI came out" });
  if (input.crew) {
    const crew = `${input.crew.tag ? `[${input.crew.tag}] ` : ""}${input.crew.name}`;
    out.push(
      input.crew.boss
        ? { id: "boss", label: "Crew boss", detail: `Runs ${crew}` }
        : { id: "made", label: "Made", detail: `Rides with ${crew}` },
    );
  }
  if (input.recruits >= 3)
    out.push({
      id: "recruiter",
      label: "Recruiter",
      detail: `Brought ${input.recruits} people in`,
    });
  if (input.notoriety >= 1000)
    out.push({ id: "wanted", label: "Most wanted", detail: input.rankTitle });
  return out;
}
