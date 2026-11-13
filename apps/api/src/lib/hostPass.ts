import { prisma } from "./prisma";
import { issuedBeforeCutoff } from "./sessionCutoff";

/**
 * Does an office host pass still stand?
 *
 * A pass traded for at /office/host-pass names the account that traded for it
 * (`by`). It stands while that account does: not banned or deleted, still
 * office staff, and not signed out everywhere since the pass was made. A pass
 * used to outlive all of that for its 12 hours (fan-out audit, 2026-11-13), so
 * resetting the password did not shut out whoever had copied one.
 *
 * A pass with no `by` was minted by scripts/host-link.sh, which needs the
 * server's own secret; rotating that secret is how those are revoked.
 */
export async function hostPassStands(
  decoded: any,
  isOfficeStaff: (userId?: string) => Promise<boolean>,
): Promise<boolean> {
  const by = typeof decoded?.by === "string" ? decoded.by : "";
  if (!by) return true;
  try {
    const u = await prisma.user.findUnique({
      where: { id: by },
      select: { banned: true, deletedAt: true, tokensValidAfter: true } as any,
    });
    if (!u || (u as any).banned || (u as any).deletedAt) return false;
    if (issuedBeforeCutoff(decoded?.iat, (u as any).tokensValidAfter)) return false;
    return await isOfficeStaff(by);
  } catch {
    return false;
  }
}
