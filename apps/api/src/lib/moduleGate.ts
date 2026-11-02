import { prisma } from "./prisma";
import { isStaffRole } from "./lobbyAuth";
import { canBuildModules } from "./tiers";

/** Does this lobby owner's plan cover AI-built blocks and games (Felon and
 *  up, lib/tiers.ts)? A staff-owned lobby always does. */
export async function ownerBuildsModules(ownerId: string | null | undefined): Promise<boolean> {
  if (!ownerId) return false;
  const o = await prisma.user
    .findUnique({ where: { id: ownerId }, select: { tier: true, globalRole: true } })
    .catch(() => null);
  return !!o && (canBuildModules(o.tier) || isStaffRole(o.globalRole));
}
