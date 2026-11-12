import { prisma } from "./prisma";
import { log, swallow } from "./logger";
import { lobbyUrl, pingIndexNow } from "./indexNow";

/**
 * Lobbies are free for everyone (James 2026-11-02: "everyone gets lobbies,
 * free, no expiry"). A free account's new lobby starts held: unlisted, so it
 * reads by link but stays out of Explore, search and the map, until three
 * people besides its owner have joined. Then it lists like any other. Paid and
 * staff accounts' lobbies list at once. Holding uses `unlisted` itself, so
 * every listing surface keeps working unchanged; `listingHeld` marks the ones
 * this sweep may release (staff-unlisted lobbies are never touched).
 */
export const FREE_LOBBIES = 3;
export const LISTING_MEMBERS = 3;

/** Release every held lobby that has earned its listing. Returns how many. */
export async function releaseEarnedListings(): Promise<number> {
  const held = await prisma.lobby.findMany({
    where: { listingHeld: true },
    select: { id: true, ownerId: true },
  });
  if (!held.length) return 0;
  const counts = await prisma.lobbyMember.groupBy({
    by: ["lobbyId"],
    where: { lobbyId: { in: held.map((l) => l.id) } },
    _count: { userId: true },
  });
  const members = new Map(counts.map((c) => [c.lobbyId, c._count.userId]));
  const earned = held.filter(
    (l) => (members.get(l.id) || 0) - (l.ownerId ? 1 : 0) >= LISTING_MEMBERS,
  );
  if (!earned.length) return 0;
  await prisma.lobby.updateMany({
    where: { id: { in: earned.map((l) => l.id) }, listingHeld: true },
    data: { unlisted: false, listingHeld: false },
  });
  log.log("[listing] released", earned.map((l) => l.id).join(","));
  // Public now: tell the search engines (lib/indexNow.ts).
  void pingIndexNow(earned.map((l) => lobbyUrl(l.id)));
  return earned.length;
}

/** Every ten minutes, and once shortly after boot. */
export function startListingSweep() {
  const run = () => void releaseEarnedListings().catch(swallow);
  setTimeout(run, 30_000).unref?.();
  setInterval(run, 10 * 60_000).unref?.();
}
