/**
 * Weered's staff ladder, one rule for the ops page and the server (ops audit
 * 2026-11-01: the page offered "→ STAFF" to STAFF and ADMIN though only GOD
 * could use it, while a non-GOD could make ADMIN, which has the same powers,
 * and demote other staff).
 *
 * You act only on people below you, and give only roles below your own.
 * STAFF and ADMIN share a rung; GOD is above everyone, and only GOD makes or
 * removes staff. apps/web/app/staff/shared.tsx carries the same rule.
 */
export const RANK: Record<string, number> = { USER: 0, SUPPORT: 1, STAFF: 2, ADMIN: 2, GOD: 3 };
const ROLES = ["USER", "SUPPORT", "STAFF", "ADMIN", "GOD"] as const;

const rank = (role: unknown) => RANK[String(role || "USER").toUpperCase()] ?? 0;

/** Roles this person may give (only to someone they may act on). */
export function rolesToGive(actor: unknown): string[] {
  const a = String(actor || "").toUpperCase();
  if (a === "GOD") return [...ROLES];
  if (a === "STAFF" || a === "ADMIN") return ROLES.filter((r) => rank(r) < rank(a));
  return [];
}

/** May this person kick, ban or change the role of that one? */
export function mayActOn(actor: unknown, target: unknown): boolean {
  const a = String(actor || "").toUpperCase();
  const t = String(target || "USER").toUpperCase();
  if (a === "GOD") return true;
  return rank(t) < rank(a);
}

/** The whole check for a role change. */
export function mayGiveRole(actor: unknown, target: unknown, role: unknown): boolean {
  return mayActOn(actor, target) && rolesToGive(actor).includes(String(role || "").toUpperCase());
}
