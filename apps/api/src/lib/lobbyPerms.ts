/**
 * Lobby permission table.
 *
 * Extracted from routes/lobbies.ts so other route modules can gate on the same
 * levels rather than re-deriving them. Duplicating this table would be the kind
 * of drift that silently grants an action in one place and denies it in another.
 *
 * Levels are the lobby-local hierarchy (5 = owner, 1 = member) and are separate
 * from the GLOBAL role (STAFF/ADMIN/GOD), which overrides everything.
 */
export const LEVEL_PERMS: Record<number, string[]> = {
  5: ["kick", "ban", "manage_rooms", "edit_branding", "manage_roles", "pin_rooms", "admin_chat"],
  4: ["kick", "ban", "manage_rooms", "edit_branding", "pin_rooms", "admin_chat"],
  3: ["kick", "ban", "manage_rooms", "pin_rooms", "admin_chat"],
  2: ["kick", "admin_chat"],
  1: [],
};

export function hasLobbyPerm(level: number, perm: string, overrideRole: string | null): boolean {
  if (overrideRole && ["STAFF", "ADMIN", "GOD"].includes(overrideRole)) return true;
  return (LEVEL_PERMS[level] || []).includes(perm);
}
