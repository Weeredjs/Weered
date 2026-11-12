// Where someone's from, for the Town Square (James 2026-11-12: "Everyone exists
// here like a shopping mall. Not isolated servers... we are keeping the mall
// angle. That is the entire premise of the platform."). A name in the square
// carries a tag for the lobby that person comes from, and the tag is a door.
//
// Only lobbies already public in Downtown: a held, unlisted or deleted lobby,
// a member's place (u-), a Reddit mirror (r/) and the Town Square itself never
// show. A lobby someone built and owns comes first (its busiest), then the one
// where they hold the highest rank, the newest on a tie. Weered's own built-in
// lobbies (pinned) don't count as owned: staff claimed those, nobody is from
// them by owning one. Staff get no tag at all: they belong to the whole town,
// and their role icon already says so.
import { prisma } from "./prisma";

export type LobbyHome = {
  id: string;
  name: string;
  logoUrl: string | null;
  accentColor: string | null;
};

type Owned = LobbyHome & { ownerId: string | null; members: number; pinned: boolean };
type Membership = { userId: string; roleLevel: number; joinedAt: number; lobby: LobbyHome };

/** The Town Square's own id: everyone is in it, so it tells nothing. */
export const SQUARE_ID = "lobby";
export const MAX_IDS = 50;
const STAFF_ROLES = new Set(["GOD", "STAFF", "SUPPORT"]);

export function shownInSquare(id: string): boolean {
  return !!id && id !== SQUARE_ID && !id.startsWith("u-") && !id.startsWith("r/");
}

/** The choice itself, apart from the database. */
export function pickHomes(
  userIds: string[],
  owned: Owned[],
  memberships: Membership[],
  staff: Set<string> = new Set(),
): Record<string, LobbyHome | null> {
  const out: Record<string, LobbyHome | null> = {};
  for (const uid of userIds) {
    if (staff.has(uid)) {
      out[uid] = null;
      continue;
    }
    const mine = owned
      .filter((l) => l.ownerId === uid && !l.pinned && shownInSquare(l.id))
      .sort((a, b) => b.members - a.members || a.name.localeCompare(b.name))[0];
    const member = memberships
      .filter((m) => m.userId === uid && shownInSquare(m.lobby.id))
      .sort((a, b) => b.roleLevel - a.roleLevel || b.joinedAt - a.joinedAt)[0];
    const home = mine || member?.lobby || null;
    out[uid] = home
      ? { id: home.id, name: home.name, logoUrl: home.logoUrl, accentColor: home.accentColor }
      : null;
  }
  return out;
}

const LISTED = {
  unlisted: false,
  deletedAt: null,
  NOT: [{ id: SQUARE_ID }, { id: { startsWith: "u-" } }, { id: { startsWith: "r/" } }],
};
const SEL = { id: true, name: true, logoUrl: true, accentColor: true } as const;

export async function homeLobbiesOf(raw: string[]): Promise<Record<string, LobbyHome | null>> {
  const ids = [...new Set(raw.map((s) => String(s || "").trim()).filter(Boolean))].slice(
    0,
    MAX_IDS,
  );
  if (!ids.length) return {};
  const [owned, members, roles] = await Promise.all([
    prisma.lobby.findMany({
      where: { ownerId: { in: ids }, ...LISTED },
      select: { ...SEL, ownerId: true, pinned: true, _count: { select: { members: true } } },
    }),
    prisma.lobbyMember.findMany({
      where: { userId: { in: ids }, lobby: LISTED },
      select: { userId: true, roleLevel: true, createdAt: true, lobby: { select: SEL } },
    }),
    prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, globalRole: true } }),
  ]);
  const staff = new Set(
    roles
      .filter((u: any) => STAFF_ROLES.has(String(u.globalRole || "").toUpperCase()))
      .map((u: any) => u.id),
  );
  return pickHomes(
    ids,
    owned.map((l: any) => ({
      id: l.id,
      name: l.name || l.id,
      logoUrl: l.logoUrl ?? null,
      accentColor: l.accentColor ?? null,
      ownerId: l.ownerId ?? null,
      members: l._count?.members ?? 0,
      pinned: !!l.pinned,
    })),
    members.map((m: any) => ({
      userId: m.userId,
      roleLevel: m.roleLevel ?? 1,
      joinedAt: new Date(m.createdAt).getTime(),
      lobby: {
        id: m.lobby.id,
        name: m.lobby.name || m.lobby.id,
        logoUrl: m.lobby.logoUrl ?? null,
        accentColor: m.lobby.accentColor ?? null,
      },
    })),
    staff,
  );
}
