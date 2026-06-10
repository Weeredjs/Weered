import { prisma } from "./prisma";

// Shared staff check. Prefers the injected getGlobalRole/canAccessStaff
// (the canonical role resolution); falls back to a direct DB lookup when a
// caller doesn't have them wired. Deduplicates 3 byte-identical copies that
// lived in flair.ts / tournaments.ts / flair-contests.ts.
export async function isStaffUser(
  userId: string,
  getGlobalRole?: (userId: string) => Promise<any>,
  canAccessStaff?: (role: any) => boolean,
): Promise<boolean> {
  if (getGlobalRole && canAccessStaff) {
    const role = await getGlobalRole(userId);
    return canAccessStaff(role);
  }
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { globalRole: true } });
  return ["GOD", "ADMIN", "STAFF"].includes(String(u?.globalRole || ""));
}
