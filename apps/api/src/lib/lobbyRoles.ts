/**
 * Lobby role presentation — the titles and icons a lobby shows beside its
 * members' names.
 *
 * Permissions are fixed per level (1..5); only the PRESENTATION is per-lobby, so
 * a racing league can run Owner/Steward/Marshal with its own icons while the
 * permission model underneath stays identical everywhere.
 *
 * Members carry only their level in presence. Every surface resolves the title
 * and icon from these maps, so editing an icon updates it everywhere at once
 * instead of leaving stale copies on each connected user.
 */

export const ROLE_LEVELS = ["1", "2", "3", "4", "5"] as const;

export const DEFAULT_ROLE_NAMES: Record<string, string> = {
  "5": "Owner",
  "4": "Admin",
  "3": "Moderator",
  "2": "Trusted",
  "1": "Member",
};

/** No icons until an owner sets them — an unconfigured lobby looks exactly as it
 *  did before this feature existed. */
export const DEFAULT_ROLE_ICONS: Record<string, string> = {
  "5": "",
  "4": "",
  "3": "",
  "2": "",
  "1": "",
};

/**
 * Coerce a submitted level->string map into exactly the five levels, trimmed to
 * `max` characters. Anything missing or non-string falls back to `fallback`, so
 * a partial or hostile payload can never leave a lobby with half a role map.
 *
 * Shared by the title and icon maps so the two cannot drift apart.
 */
export function cleanRoleMap(
  input: unknown,
  fallback: Record<string, string>,
  max: number,
): Record<string, string> {
  // Must be a real object. A bare string indexes by CHARACTER ("nope"[1] === "o"),
  // and an array indexes by position — both would sail through the typeof check
  // below and quietly rename a lobby's roles to single letters.
  const src =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const out: Record<string, string> = {};
  for (const k of ROLE_LEVELS) {
    out[k] = typeof src[k] === "string" ? (src[k] as string).slice(0, max) : (fallback[k] ?? "");
  }
  return out;
}

/**
 * Role icons: an emoji or short text (8 chars, as before), OR an image path
 * Weered hosts under /brand/. Only same-origin /brand/ paths are accepted as
 * images, never URLs: an arbitrary URL here would make every member's browser
 * fetch from wherever a lobby admin pointed it. Mirrors isRoleIconPath in
 * apps/web/components/RoleGlyph.tsx.
 */
export const ROLE_ICON_PATH = /^\/brand\/[A-Za-z0-9_\-/]+\.(svg|png|webp)$/;

export function cleanRoleIcons(
  input: unknown,
  fallback: Record<string, string>,
): Record<string, string> {
  const src =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const out: Record<string, string> = {};
  for (const k of ROLE_LEVELS) {
    const v = src[k];
    if (typeof v !== "string") out[k] = fallback[k] ?? "";
    else if (v.length <= 120 && ROLE_ICON_PATH.test(v)) out[k] = v;
    else out[k] = v.slice(0, 8);
  }
  return out;
}
