import { prisma } from "./prisma";
import { SITE_CONFIG_DEFAULTS } from "./siteConfig";

type ReadConfig = (key: string) => Promise<string | null>;

/**
 * Can one more account be made? The Config switch first, then the cap: real
 * accounts below `registrationCap` (0 = no cap). James 2026-10-31: "Cap
 * registrations at 1000", a brake on a sudden flood. Sign-up and a first
 * Google sign-in both ask. Meeting-invite guests don't count and aren't
 * stopped: they expire within 90 minutes and a meeting link has to work.
 */
export async function registrationBlock(
  read: ReadConfig,
): Promise<"registration_closed" | "registration_full" | null> {
  if ((await read("registrationOpen")) === "false") return "registration_closed";
  const cap = Number((await read("registrationCap")) ?? SITE_CONFIG_DEFAULTS.registrationCap);
  if (Number.isFinite(cap) && cap > 0 && (await accountCount()) >= cap) return "registration_full";
  return null;
}

/** Accounts that count toward the cap: not invite guests, not deleted. */
export function accountCount(): Promise<number> {
  return prisma.user.count({ where: { isGuest: false, deletedAt: null } });
}
