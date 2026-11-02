import { prisma } from "./prisma";
import { isStaffRole } from "./lobbyAuth";
import { hasVanityName, subdomainAllowance } from "./tiers";
import { PLACE_PREFIX, placeForHost, placeIdForHost, placeLabel } from "../routes/places";

/**
 * <label>.weered.ca, every way it can answer (2026-11-02 pricing):
 *   1. an older named place (made before places moved to codes), as before
 *   2. a lobby whose id is <label>, with its address switched on, while its
 *      owner's plan covers it: Felon one lobby, Condemned three, Kingpin and
 *      staff any number (the earliest-made ones count first, so a downgrade
 *      quietly turns the extras off)
 *   3. the place of the paying member whose username is <label>: the $6 tier's
 *      yourname.weered.ca
 * Nothing else answers; the web sends a made-up name back to weered.ca.
 */

type Owner = { tier: string | null; globalRole: string | null };

async function ownerOf(userId: string | null | undefined): Promise<Owner | null> {
  if (!userId) return null;
  return prisma.user
    .findUnique({ where: { id: userId }, select: { tier: true, globalRole: true } })
    .catch(() => null);
}

/** How many lobbies this owner may give an address (Infinity for staff). */
export function addressAllowance(owner: Owner | null): number {
  if (!owner) return 0;
  return isStaffRole(owner.globalRole) ? Infinity : subdomainAllowance(owner.tier);
}

/** Lobby <label>, if its address is on and its owner's plan covers it. */
export async function subdomainLobby(label: string): Promise<string | null> {
  const l = await prisma.lobby
    .findUnique({ where: { id: label }, select: { id: true, subdomain: true, ownerId: true } })
    .catch(() => null);
  if (!l?.subdomain) return null;
  const allowed = addressAllowance(await ownerOf(l.ownerId));
  if (!allowed) return null;
  if (allowed === Infinity) return l.id;
  const first = await prisma.lobby.findMany({
    where: { ownerId: l.ownerId, subdomain: true },
    orderBy: { createdAt: "asc" },
    take: allowed,
    select: { id: true },
  });
  return first.some((x) => x.id === l.id) ? l.id : null;
}

/** The member whose username reads as <label> (underscores become hyphens). */
async function memberNamed(label: string) {
  return prisma.user
    .findFirst({
      where: { usernameKey: { in: [label, label.replace(/-/g, "_")] }, deletedAt: null },
      select: { id: true, tier: true, globalRole: true },
    })
    .catch(() => null);
}

/** The place at a paying member's name, yourname.weered.ca. */
export async function vanityPlace(label: string): Promise<string | null> {
  const u = await memberNamed(label);
  if (!u || !(hasVanityName(u.tier) || isStaffRole(u.globalRole))) return null;
  const p = await prisma.lobby
    .findFirst({
      where: { ownerId: u.id, id: { startsWith: PLACE_PREFIX } },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    })
    .catch(() => null);
  return p?.id ?? null;
}

const cache = new Map<string, { id: string | null; at: number }>();
/** Forget answers after a change (an address switched, a plan bought). */
export function forgetWeeredHosts() {
  cache.clear();
}

/** The lobby a <label>.weered.ca host shows, or null. Cached a minute. */
export async function weeredHostLobby(host: string): Promise<string | null> {
  const placeId = placeIdForHost(host);
  if (!placeId) return null;
  const label = placeId.slice(PLACE_PREFIX.length);
  const hit = cache.get(label);
  if (hit && Date.now() - hit.at < 60_000) return hit.id;
  const id =
    (await placeForHost(host)) ?? (await subdomainLobby(label)) ?? (await vanityPlace(label));
  cache.set(label, { id, at: Date.now() });
  if (cache.size > 5000) cache.clear();
  return id;
}

/** Why a lobby can't take <id>.weered.ca, or null if it can. */
export async function addressProblem(
  lobbyId: string,
  ownerId: string | null,
): Promise<string | null> {
  const host = `${lobbyId}.weered.ca`;
  if (!placeIdForHost(host) || placeLabel(lobbyId) !== lobbyId) return "bad_label";
  if (await placeForHost(host)) return "taken";
  const member = await memberNamed(lobbyId);
  if (
    member &&
    member.id !== ownerId &&
    (hasVanityName(member.tier) || isStaffRole(member.globalRole))
  )
    return "taken";
  return null;
}

/** yourname.weered.ca for this member's place, when it really answers there. */
export async function vanityHostFor(userId: string, placeId: string): Promise<string | null> {
  const u = await prisma.user
    .findUnique({
      where: { id: userId },
      select: { usernameKey: true, tier: true, globalRole: true },
    })
    .catch(() => null);
  if (!u || !(hasVanityName(u.tier) || isStaffRole(u.globalRole))) return null;
  const label = placeLabel(u.usernameKey);
  if (label.length < 2) return null;
  const host = `${label}.weered.ca`;
  return (await weeredHostLobby(host)) === placeId ? host : null;
}
