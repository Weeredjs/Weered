// A crew's tag, the [HELL] beside its members' names (2026-11-01, the GTA VI
// launch: "claim your crew tag before the 19th"). One crew per tag, so a tag is
// worth claiming and can be the crew's address, weered.ca/crew/TAG. The tag is
// kept as typed in capitals in Crew.tag; Crew.tagKey holds the same, unique, and
// is null while a crew has no tag.

export const CREW_TAG_MIN = 2;
export const CREW_TAG_MAX = 6;

// Names a crew could pass off as staff, as Weered itself, or as the game's
// makers, plus a few that only invite trouble.
const RESERVED = new Set([
  "ADMIN",
  "ADMINS",
  "STAFF",
  "MOD",
  "MODS",
  "HELP",
  "SUPPORT",
  "WEERED",
  "OFFICIAL",
  "SYSTEM",
  "GOD",
  "ROOT",
  "NULL",
  "UNDEF",
  "GTA",
  "GTAV",
  "GTA5",
  "GTA6",
  "GTAVI",
  "ROCKSTAR",
  "RSTAR",
  "TAKE2",
  "NAZI",
  "KKK",
]);

/** A usable tag (key null when there's none), or why not. */
export type TagCheck =
  | { ok: true; tag: string; key: string | null }
  | { ok: false; error: string; message: string };

/** A tag as typed, made a tag: capitals, letters and numbers only. "" is no tag. */
export function cleanCrewTag(raw: unknown): TagCheck {
  const s = String(raw ?? "")
    .trim()
    .replace(/^\[|\]$/g, "")
    .trim()
    .toUpperCase();
  if (!s) return { ok: true, tag: "", key: null };
  if (!/^[A-Z0-9]+$/.test(s))
    return { ok: false, error: "tag_chars", message: "Tags are letters and numbers only." };
  if (s.length < CREW_TAG_MIN || s.length > CREW_TAG_MAX)
    return {
      ok: false,
      error: "tag_length",
      message: `Tags are ${CREW_TAG_MIN} to ${CREW_TAG_MAX} letters or numbers.`,
    };
  if (RESERVED.has(s))
    return { ok: false, error: "tag_reserved", message: "That tag is reserved. Try another." };
  return { ok: true, tag: s, key: s };
}

/** Is this a tag rather than a crew id? Crew ids are long lowercase cuids. */
export function looksLikeTag(param: string): boolean {
  return /^[A-Za-z0-9]{2,6}$/.test(param);
}

/** Prisma's unique-constraint error, for a tag claimed in the same instant. */
export const isUniqueClash = (e: any) => e?.code === "P2002";
