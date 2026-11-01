import { prisma } from "./prisma";

/**
 * Blocks hold everywhere one person can reach another, not just direct
 * messages: group threads and invites used to add and message people with no
 * look at blocks, push notifications included (red team 2026-11-01, finding 13).
 */

/** Is there a block between these two, either way? */
export async function blockedEitherWay(a: string, b: string): Promise<boolean> {
  if (!a || !b || a === b) return false;
  const row = await prisma.userBlock
    .findFirst({
      where: {
        OR: [
          { blockerId: a, blockedId: b },
          { blockerId: b, blockedId: a },
        ],
      },
      select: { blockerId: true },
    })
    .catch(() => null);
  return !!row;
}

/** Of these people, the ones with a block with \`me\` either way. */
export async function blockedWith(me: string, others: string[]): Promise<Set<string>> {
  const ids = others.filter((x) => x && x !== me);
  if (!me || ids.length === 0) return new Set();
  const rows = await prisma.userBlock
    .findMany({
      where: {
        OR: [
          { blockerId: me, blockedId: { in: ids } },
          { blockedId: me, blockerId: { in: ids } },
        ],
      },
      select: { blockerId: true, blockedId: true },
    })
    .catch(() => [] as { blockerId: string; blockedId: string }[]);
  return new Set(rows.map((r) => (r.blockerId === me ? r.blockedId : r.blockerId)));
}
