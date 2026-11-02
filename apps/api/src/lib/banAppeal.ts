import { prisma } from "./prisma";

/** How long after a denied appeal before another can be filed. */
export const APPEAL_COOLDOWN_MS = 30 * 86_400_000;

/**
 * What a banned person is told when they try to sign in: the ban, and where
 * their latest appeal stands, with the staff note. The appeal page promised
 * "you'll see the result the next time you try to sign in", and sign-in said
 * only "banned" (ops audit 2026-11-01).
 */
export async function bannedMessage(userId: string): Promise<string> {
  const base = "Your account has been suspended.";
  const a = await prisma.banAppeal
    .findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { status: true, reviewerNote: true, reviewedAt: true },
    })
    .catch(() => null);
  if (!a) return `${base} You can appeal at weered.ca/ban-court.`;
  if (a.status === "PENDING") return `${base} Your appeal is waiting for a person to review it.`;
  if (a.status !== "DENIED") return base;
  const note = a.reviewerNote ? ` Staff said: "${a.reviewerNote}"` : "";
  const after = a.reviewedAt ? new Date(a.reviewedAt.getTime() + APPEAL_COOLDOWN_MS) : null;
  const again =
    after && after.getTime() > Date.now()
      ? ` You can appeal again after ${after.toDateString()}.`
      : " You can appeal again at weered.ca/ban-court.";
  return `${base} Your appeal was denied.${note}${again}`;
}
