import { prisma } from "./prisma";

/**
 * Resolves current display names for a set of user ids.
 *
 * Messages store `userName` — the author's name AT SEND TIME. That copy is
 * written once and never revisited, so when someone renames, every message they
 * have ever sent keeps showing the old name. Renaming the User row cannot fix
 * it, because the name was copied into each message.
 *
 * The fix is to treat the stored copy as a FALLBACK and resolve the live name
 * from the User record by id at read time. A rename then appears across all
 * history at once, with no backfill and no migration.
 *
 * The stored copy still earns its place: when an account is deleted the user
 * row goes with it, and without the copy that history would render as "?".
 * So the order is: live name, else the name they had when they wrote it.
 *
 * Deliberately NOT cached. A room hydrates once and a crew read is one request,
 * so this is a single indexed lookup on the primary key against a handful of
 * ids — cheaper than the staleness a cache would reintroduce, which is the
 * exact bug being fixed.
 */
export async function resolveUserNames(ids: Iterable<string>): Promise<Map<string, string>> {
  const unique = Array.from(new Set(Array.from(ids).filter(Boolean)));
  const out = new Map<string, string>();
  if (unique.length === 0) return out;
  try {
    const rows = await prisma.user.findMany({
      where: { id: { in: unique } },
      select: { id: true, name: true },
    });
    for (const r of rows) {
      if (r.name) out.set(r.id, r.name);
    }
  } catch {
    // A lookup failure must not cost us the messages themselves — callers fall
    // back to the stored copy, which is what shipped before this existed.
  }
  return out;
}

/** Live name if we have one, else the name stored on the message, else "?". */
export function displayName(
  resolved: Map<string, string>,
  userId: string | null | undefined,
  storedName: string | null | undefined,
): string {
  return (userId ? resolved.get(userId) : undefined) || storedName || "?";
}

/** Live name + avatar + avatarColor per user id, one query. Used to rebuild
 *  message authors from the DB so a reload shows the same avatars the live
 *  broadcast did; without it the backlog renders as letter circles. */
export type UserProfileLite = { name: string; avatar: string | null; avatarColor: string | null };
export async function resolveUserProfiles(
  ids: Iterable<string>,
): Promise<Map<string, UserProfileLite>> {
  const unique = Array.from(new Set(Array.from(ids).filter(Boolean)));
  const out = new Map<string, UserProfileLite>();
  if (unique.length === 0) return out;
  try {
    const rows = await prisma.user.findMany({
      where: { id: { in: unique } },
      select: { id: true, name: true, avatar: true, avatarColor: true },
    });
    for (const r of rows) {
      out.set(r.id, {
        name: r.name || "",
        avatar: r.avatar ?? null,
        avatarColor: r.avatarColor ?? null,
      });
    }
  } catch {
    // Same contract as resolveUserNames: a lookup failure must not cost the messages.
  }
  return out;
}

/** Names-only view of resolveUserProfiles, for displayName(). */
export function namesOf(profiles: Map<string, UserProfileLite>): Map<string, string> {
  const m = new Map<string, string>();
  for (const [id, p] of profiles) if (p.name) m.set(id, p.name);
  return m;
}
