import { prisma } from "./prisma";
import { log, swallow } from "./logger";
import { leaveRoom, rooms, send } from "./roomState";
import { forgetWeeredHosts } from "./weeredHosts";
import { getSiteConfig, setSiteConfig } from "./siteConfig";
import { logLobbyAudit } from "./lobbyAudit";
import { createNotification } from "./notifications";

/**
 * Deleting a lobby (James 2026-11-02: "30 day is smart", "Top mod").
 *
 * A delete hides the lobby everywhere at once: off every list, its address and
 * custom domain released, its invites dead, everyone in its rooms sent out,
 * and its owner's free slot back. For 30 days staff can bring it back and
 * nobody can take its id (the row is still there); then purgeDeletedLobbies
 * erases it and everything filed under its id, so a new lobby that takes the
 * name later starts empty.
 *
 * An owner who deletes their account hands each lobby to its top moderator
 * (highest rank of 3 and up, the longest-standing first); a lobby with none is
 * deleted the same way, and their own place too.
 */
export const HOLD_DAYS = 30;
const HOLD_MS = HOLD_DAYS * 24 * 3600_000;

// Lobbies deleted and not yet erased: read on every room join, so in memory.
const deleted = new Set<string>();
export const isLobbyDeleted = (id?: string | null) => !!id && deleted.has(id);

export async function loadDeletedLobbies() {
  try {
    const rows = await prisma.lobby.findMany({
      where: { deletedAt: { not: null } },
      select: { id: true },
    });
    deleted.clear();
    for (const r of rows) deleted.add(r.id);
  } catch (e) {
    swallow(e);
  }
}

type Who = { id: string; name: string };
type Result = { ok: true } | { ok: false; error: string; message: string };

/** The rooms that belong to a lobby: its own chat, its admin room, the rest. */
async function roomIdsOf(lobbyId: string): Promise<string[]> {
  const rows = await prisma.room
    .findMany({ where: { OR: [{ lobbyId }, { id: lobbyId }] }, select: { id: true } })
    .catch(() => [] as { id: string }[]);
  return [...new Set([...rows.map((r) => r.id), lobbyId, `@admin-${lobbyId}`])];
}

/** Everyone in the lobby's live rooms goes back to the Home Lobby. */
function closeLiveRooms(lobbyId: string, by: string) {
  for (const [rid, room] of [...rooms]) {
    if (room.lobbyId !== lobbyId && rid !== lobbyId && rid !== `@admin-${lobbyId}`) continue;
    for (const s of [...room.sockets]) {
      send(s, { type: "room:closed", roomId: rid, by });
      leaveRoom(s);
    }
    rooms.delete(rid);
  }
}

export async function deleteLobby(lobbyId: string, by: Who, note?: string): Promise<Result> {
  const lobby = await prisma.lobby.findUnique({
    where: { id: lobbyId },
    select: {
      id: true,
      name: true,
      unlisted: true,
      subdomain: true,
      featured: true,
      pinned: true,
      customDomain: true,
      deletedAt: true,
    },
  });
  if (!lobby || lobby.deletedAt)
    return { ok: false, error: "not_found", message: "That lobby doesn't exist." };
  const paying = await prisma.lobbyTierSub.count({
    where: { lobbyId, status: { in: ["active", "past_due"] } },
  });
  if (paying > 0)
    return {
      ok: false,
      error: "paying_members",
      message: `${paying} member${paying === 1 ? " pays" : "s pay"} this lobby every month. Their memberships have to end before it can be deleted.`,
    };

  const roomIds = await roomIdsOf(lobbyId);
  await prisma.lobby.update({
    where: { id: lobbyId },
    data: {
      deletedAt: new Date(),
      deletedById: by.id,
      deletedRestore: {
        unlisted: lobby.unlisted,
        subdomain: lobby.subdomain,
        featured: lobby.featured,
        pinned: lobby.pinned,
        customDomain: lobby.customDomain,
      },
      unlisted: true,
      subdomain: false,
      featured: false,
      pinned: false,
      customDomain: null,
      domainStatus: null,
      domainVerifiedAt: null,
    },
  });
  deleted.add(lobbyId);

  // Its invites stop working now, not in 30 days; nobody's recents list it.
  await prisma.invite.deleteMany({ where: { targetId: { in: roomIds } } }).catch(swallow);
  await prisma.recentVisit.deleteMany({ where: { lobbyId } }).catch(swallow);
  if ((await getSiteConfig("featuredLobbyId").catch(() => null)) === lobbyId)
    await setSiteConfig("featuredLobbyId", "").catch(swallow);
  closeLiveRooms(lobbyId, by.name);
  forgetWeeredHosts();
  await logLobbyAudit({
    lobbyId,
    type: "lobby_deleted",
    actorId: by.id,
    actorName: by.name,
    note: note || lobby.name,
  }).catch(swallow);
  return { ok: true };
}

export async function restoreLobby(lobbyId: string, by: Who): Promise<Result> {
  const lobby = await prisma.lobby.findUnique({
    where: { id: lobbyId },
    select: { deletedAt: true, deletedRestore: true },
  });
  if (!lobby?.deletedAt)
    return { ok: false, error: "not_deleted", message: "That lobby isn't deleted." };
  const was: any = lobby.deletedRestore || {};
  // Its custom domain comes back only if nobody has claimed it since.
  const domain =
    was.customDomain &&
    !(await prisma.lobby.findFirst({
      where: { customDomain: was.customDomain },
      select: { id: true },
    }))
      ? String(was.customDomain)
      : null;
  await prisma.lobby.update({
    where: { id: lobbyId },
    data: {
      deletedAt: null,
      deletedById: null,
      deletedRestore: null as any,
      unlisted: !!was.unlisted,
      subdomain: !!was.subdomain,
      featured: !!was.featured,
      pinned: !!was.pinned,
      customDomain: domain,
      domainStatus: domain ? "pending" : null,
    },
  });
  deleted.delete(lobbyId);
  forgetWeeredHosts();
  await logLobbyAudit({
    lobbyId,
    type: "lobby_restored",
    actorId: by.id,
    actorName: by.name,
  }).catch(swallow);
  return { ok: true };
}

/**
 * Tables that file things under a lobby's id without a link the database
 * follows: erased by hand, so a lobby that takes the name later starts empty.
 * (Everything linked to Lobby goes with it; rooms are only unlinked by the
 * database, so they're removed here too.)
 */
const FILED_BY_LOBBY = [
  "featureRequest",
  "lfgPost",
  "challengeDefinition",
  "tournament",
  "paperAccount",
  "tradingCompetition",
  "windroseBounty",
  "flairContest",
  "forumSection",
  "forumModAction",
  "forumAutoModRule",
  "startggAuth",
  "slippiEntry",
  "musterMember",
  "drill",
  "stationAssignment",
  "station",
  "vaSlotClaim",
  "lobbyTierSub",
  "recentVisit",
] as const;

/** Erase one lobby for good. False when something wouldn't go: it stays held. */
export async function purgeLobby(lobbyId: string): Promise<boolean> {
  let clean = true;
  const roomIds = await roomIdsOf(lobbyId);
  for (const model of FILED_BY_LOBBY) {
    try {
      await (prisma as any)[model].deleteMany({ where: { lobbyId } });
    } catch (e) {
      clean = false;
      log.warn(`[lobby purge] ${lobbyId}: ${model} would not clear`, e);
    }
  }
  try {
    await prisma.invite.deleteMany({ where: { targetId: { in: roomIds } } });
    await prisma.room.deleteMany({ where: { id: { in: roomIds } } });
  } catch (e) {
    clean = false;
    log.warn(`[lobby purge] ${lobbyId}: rooms would not clear`, e);
  }
  if (!clean) return false;
  try {
    await prisma.lobby.delete({ where: { id: lobbyId } });
    deleted.delete(lobbyId);
    return true;
  } catch (e) {
    log.warn(`[lobby purge] ${lobbyId}: the lobby would not go`, e);
    return false;
  }
}

/** Erase every lobby whose 30 days are up. */
export async function purgeDeletedLobbies(now = Date.now()): Promise<number> {
  const due = await prisma.lobby
    .findMany({
      where: { deletedAt: { lt: new Date(now - HOLD_MS) } },
      select: { id: true },
      take: 50,
    })
    .catch(() => [] as { id: string }[]);
  let n = 0;
  for (const l of due) if (await purgeLobby(l.id)) n++;
  return n;
}

/** An owner deleting their account: each lobby to its top moderator, or gone. */
export async function handOffLobbies(userId: string, name: string) {
  const owned = await prisma.lobby
    .findMany({
      where: { ownerId: userId, deletedAt: null },
      select: { id: true, name: true },
    })
    .catch(() => [] as { id: string; name: string }[]);
  for (const l of owned) {
    try {
      const heir = l.id.startsWith("u-")
        ? null
        : await prisma.lobbyMember.findFirst({
            where: { lobbyId: l.id, userId: { not: userId }, roleLevel: { gte: 3 } },
            orderBy: [{ roleLevel: "desc" }, { createdAt: "asc" }],
            select: { id: true, userId: true, name: true },
          });
      if (!heir) {
        await deleteLobby(l.id, { id: userId, name }, "owner deleted their account");
        continue;
      }
      await prisma.$transaction([
        prisma.lobby.update({ where: { id: l.id }, data: { ownerId: heir.userId } }),
        prisma.lobbyMember.update({
          where: { id: heir.id },
          data: { role: "OWNER", roleLevel: 5 },
        }),
        prisma.lobbyMember.deleteMany({ where: { lobbyId: l.id, userId } }),
      ]);
      forgetWeeredHosts();
      await logLobbyAudit({
        lobbyId: l.id,
        type: "owner_handoff",
        actorId: userId,
        actorName: name,
        targetId: heir.userId,
        note: `${heir.name || "their top moderator"} now owns it`,
      }).catch(swallow);
      await createNotification({
        userId: heir.userId,
        type: "SYSTEM",
        title: `You now own ${l.name || l.id}`,
        body: "Its owner deleted their account, and you were its top moderator.",
        actionUrl: `/lobby/${encodeURIComponent(l.id)}`,
      }).catch(swallow);
    } catch (e) {
      log.warn(`[lobby handoff] ${l.id}`, e);
    }
  }
}

let sweeping = false;
export function startLobbyPurgeSweep() {
  if (sweeping) return;
  sweeping = true;
  void loadDeletedLobbies();
  const run = () =>
    void purgeDeletedLobbies()
      .then((n) => n && log.info(`[lobby purge] erased ${n} lobb${n === 1 ? "y" : "ies"}`))
      .catch(swallow);
  setTimeout(run, 60_000).unref();
  setInterval(run, 6 * 3600_000).unref();
}
