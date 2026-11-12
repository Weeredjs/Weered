// Downtown's order (James 2026-11-12, "Yes" to putting "anything" in the front
// rows). It was built-in lobbies by who's on, then by members, and so its
// first three rows were ten games: the town said "games" while the front page
// said "a place for anything".
//
// Now: the Town Square first, then the front-row lobbies (Lobby.featured, set
// from Ops > Lobbies) woven one-for-one into the rest, so the first rows show
// the range of the town. Each list keeps the old order within itself.

export type Orderable = {
  id: string;
  pinned: boolean;
  featured?: boolean;
  onlineCount: number;
  _count: { members: number };
};

/** The Town Square: the room everyone on Weered shares. */
export const SQUARE_ID = "lobby";

const byPresence = <T extends Orderable>(a: T, b: T) =>
  a.pinned !== b.pinned
    ? a.pinned
      ? -1
      : 1
    : b.onlineCount - a.onlineCount || b._count.members - a._count.members;

export function downtownOrder<T extends Orderable>(lobbies: T[]): T[] {
  const square = lobbies.filter((l) => l.id === SQUARE_ID);
  const front = lobbies.filter((l) => l.id !== SQUARE_ID && l.featured).sort(byPresence);
  const rest = lobbies.filter((l) => l.id !== SQUARE_ID && !l.featured).sort(byPresence);
  const out = [...square];
  for (let i = 0; i < Math.max(front.length, rest.length); i++) {
    if (i < front.length) out.push(front[i]);
    if (i < rest.length) out.push(rest[i]);
  }
  return out;
}
