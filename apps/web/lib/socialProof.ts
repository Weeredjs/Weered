// Counts a stranger reads as a ghost town (James 2026-11-10, "what would make
// it not appealing to humans"): 48 lobbies saying "4 members", a carousel of
// "0 members", rooms saying "5 joined" beside a chat of crickets. A member
// count shows only once it says something good; "online" and "here now" show
// whenever someone is actually there.
export const MEMBER_FLOOR = 25;

/** Is this member count worth showing? */
export function showMembers(n: unknown): boolean {
  const v = Number(n);
  return Number.isFinite(v) && v >= MEMBER_FLOOR;
}

/** "1,204 members", or "" below the floor. */
export function memberLabel(n: unknown): string {
  return showMembers(n) ? `${Number(n).toLocaleString()} members` : "";
}
