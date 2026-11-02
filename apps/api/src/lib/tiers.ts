/**
 * What each paid tier unlocks (James 2026-11-02: "anything that doesn't have
 * scaling costs is free"; each tier includes everything below it).
 *
 *   INNOCENT   free: up to three lobbies, a place at weered.ca/u/<code>, all flair
 *   INDICTED   $6: yourname.weered.ca for your place, the full build suite
 *   FELON      $14: one lobby at <lobby>.weered.ca, AI-built blocks and games
 *   CONDEMNED  $25: three lobbies at <lobby>.weered.ca, your own domain
 *   KINGPIN    given by staff, never sold: everything, no limits
 *
 * Global staff get Kingpin's reach wherever these are checked. One place for
 * the rule, so a page and the server never disagree.
 */
export const TIERS = ["INNOCENT", "INDICTED", "FELON", "CONDEMNED", "KINGPIN"] as const;
export type Tier = (typeof TIERS)[number];
/** The tiers Stripe sells, cheapest first. */
export const SOLD_TIERS = ["INDICTED", "FELON", "CONDEMNED"] as const;

const RANK: Record<string, number> = {
  INNOCENT: 0,
  INDICTED: 1,
  FELON: 2,
  CONDEMNED: 3,
  KINGPIN: 4,
};

export function tierAtLeast(tier: unknown, min: Tier): boolean {
  return (RANK[String(tier || "INNOCENT").toUpperCase()] ?? 0) >= RANK[min];
}
export const isPaidTier = (tier: unknown) => tierAtLeast(tier, "INDICTED");

/** yourname.weered.ca for your place. */
export const hasVanityName = (tier: unknown) => tierAtLeast(tier, "INDICTED");
/** AI-built blocks and games in a lobby (custom modules). */
export const canBuildModules = (tier: unknown) => tierAtLeast(tier, "FELON");
/** A lobby on a domain of your own (club.com). */
export const canOwnDomain = (tier: unknown) => tierAtLeast(tier, "CONDEMNED");

/** How many of your lobbies may have <lobby>.weered.ca. */
export function subdomainAllowance(tier: unknown): number {
  const t = String(tier || "").toUpperCase();
  if (t === "KINGPIN") return Infinity;
  if (t === "CONDEMNED") return 3;
  if (t === "FELON") return 1;
  return 0;
}
