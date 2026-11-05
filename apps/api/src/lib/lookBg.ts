import { isPaidTier } from "./tiers";
import { isStaffRole } from "./lobbyAuth";

/**
 * A paid member's background (James 2026-11-02): their ID card, profile, the
 * card people open from their name, and their row in presence and friends
 * lists. "c:#rrggbb" one colour, "g:#rrggbb,#rrggbb" two as a gradient,
 * "banner" their banner picture. Indicted ($6) and up, staff and Medics. It stops
 * showing when a plan ends and comes back with it; the setting is kept.
 * Drawn by web lib/lookBg.ts.
 */
const ONE = /^c:#[0-9a-f]{6}$/;
const TWO = /^g:#[0-9a-f]{6},#[0-9a-f]{6}$/;

/** A stored value, null to clear it, or undefined when it isn't one. */
export function cleanLookBg(v: unknown): string | null | undefined {
  if (v === null || v === "" || v === "none") return null;
  if (typeof v !== "string") return undefined;
  const s = v.trim().toLowerCase();
  return ONE.test(s) || TWO.test(s) || s === "banner" ? s : undefined;
}

/** Paid plans and staff, and Medics (SUPPORT): a look, not a power, so it
 *  doesn't go through isStaffRole (James 2026-11-05, the admin account). */
export const mayHaveLookBg = (u: { tier?: string | null; globalRole?: string | null }) =>
  isPaidTier(u.tier) ||
  isStaffRole(u.globalRole) ||
  String(u.globalRole || "").toUpperCase() === "SUPPORT";

/** What other people see: the background, with the banner it uses, or nothing. */
export function shownLookBg(u: {
  lookBg?: string | null;
  bannerUrl?: string | null;
  tier?: string | null;
  globalRole?: string | null;
}): { lookBg?: string; bannerUrl?: string } {
  if (!u.lookBg || !mayHaveLookBg(u)) return {};
  if (u.lookBg === "banner") return u.bannerUrl ? { lookBg: "banner", bannerUrl: u.bannerUrl } : {};
  return { lookBg: u.lookBg };
}
