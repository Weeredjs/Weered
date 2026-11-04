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
/** A picture of your own floating in your look's symbol effect (2026-11-04).
 *  Paid by James's yes to "Indicted and up"; return true here to free it. */
export const canFloatPicture = (tier: unknown) => tierAtLeast(tier, "INDICTED");

/** How many of your lobbies may have <lobby>.weered.ca. */
export function subdomainAllowance(tier: unknown): number {
  const t = String(tier || "").toUpperCase();
  if (t === "KINGPIN") return Infinity;
  if (t === "CONDEMNED") return 3;
  if (t === "FELON") return 1;
  return 0;
}

/**
 * Video quality a lobby's calls get, from its owner's plan. Cams and screen
 * share run through Weered's own server (LiveKit on the droplet), so they're
 * the one thing that costs per use; Twitch and YouTube embeds cost nothing.
 *   standard  free: cams 640x480, screen share 720p at 15 fps
 *   hd        Felon: cams 720p, screen share 1080p at 30 fps
 *   max       Condemned, Kingpin, staff: cams 1080p, screen share 1080p at 60 fps
 */
export type StreamQuality = "standard" | "hd" | "max";
export function streamQuality(tier: unknown, staff = false): StreamQuality {
  if (staff || tierAtLeast(tier, "CONDEMNED")) return "max";
  if (tierAtLeast(tier, "FELON")) return "hd";
  return "standard";
}
