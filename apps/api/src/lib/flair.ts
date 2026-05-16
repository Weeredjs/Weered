/**
 * Shared flair helpers — used by tournaments (winner gets flair),
 * contests (winning artist gets flair), and the flair routes.
 */

import type { PrismaClient } from "@prisma/client";

export type FlairKind = "BADGE" | "BANNER" | "NAMEPLATE";
export type FlairSource = "MANUAL" | "TOURNAMENT" | "CONTEST" | "ACHIEVEMENT" | "PURCHASE";

/**
 * Grant a FlairItem to a user. Idempotent — uses (userId, flairItemId) unique
 * constraint on UserFlair. Auto-equips if the user has no equipped flair.
 *
 * Returns { granted: boolean, alreadyOwned: boolean, equipped: boolean }.
 */
export async function grantFlairToUser(
  prisma: PrismaClient,
  userId: string,
  flairItemId: string,
  acquiredFrom?: string,
): Promise<{ granted: boolean; alreadyOwned: boolean; equipped: boolean }> {
  // Check existing ownership
  const existing = await (prisma as any).userFlair.findUnique({
    where: { userId_flairItemId: { userId, flairItemId } },
  });
  if (existing) return { granted: false, alreadyOwned: true, equipped: false };

  await (prisma as any).userFlair.create({
    data: { userId, flairItemId, acquiredFrom: acquiredFrom || "manual" },
  });

  // Auto-equip if no current equipped flair
  const u = await (prisma as any).user.findUnique({
    where: { id: userId },
    select: { equippedFlairId: true },
  });
  let equipped = false;
  if (!u?.equippedFlairId) {
    await (prisma as any).user.update({
      where: { id: userId },
      data: { equippedFlairId: flairItemId },
    });
    equipped = true;
  }

  return { granted: true, alreadyOwned: false, equipped };
}

/**
 * Look up the equipped flair details for a user. Returns null if none.
 */
export async function getEquippedFlair(
  prisma: PrismaClient,
  userId: string,
): Promise<{ id: string; slug: string; name: string; kind: FlairKind; imageUrl: string | null; color: string | null; rarity: string } | null> {
  const u = await (prisma as any).user.findUnique({
    where: { id: userId },
    select: { equippedFlairId: true },
  });
  if (!u?.equippedFlairId) return null;
  const f = await (prisma as any).flairItem.findUnique({
    where: { id: u.equippedFlairId },
    select: { id: true, slug: true, name: true, kind: true, imageUrl: true, color: true, rarity: true },
  });
  return f || null;
}

/**
 * Bulk-load equipped flair for multiple users in one query. Use this in
 * member lists / leaderboards / chat history rather than calling
 * getEquippedFlair in a loop.
 */
export async function getEquippedFlairBatch(
  prisma: PrismaClient,
  userIds: string[],
): Promise<Record<string, { id: string; slug: string; name: string; kind: FlairKind; imageUrl: string | null; color: string | null; rarity: string }>> {
  if (userIds.length === 0) return {};
  const users = await (prisma as any).user.findMany({
    where: { id: { in: userIds }, equippedFlairId: { not: null } },
    select: { id: true, equippedFlairId: true },
  });
  const flairIds = users.map((u: any) => u.equippedFlairId).filter(Boolean);
  if (flairIds.length === 0) return {};
  const flairs = await (prisma as any).flairItem.findMany({
    where: { id: { in: flairIds } },
    select: { id: true, slug: true, name: true, kind: true, imageUrl: true, color: true, rarity: true },
  });
  const fById: Record<string, any> = {};
  for (const f of flairs) fById[f.id] = f;
  const out: Record<string, any> = {};
  for (const u of users) {
    const f = fById[u.equippedFlairId];
    if (f) out[u.id] = f;
  }
  return out;
}

/**
 * Mint a new FlairItem. Returns the created record.
 * `slug` should be unique — use prefixes like `tournament-{id}-champion`,
 * `contest-{id}-winner`, etc.
 */
export async function mintFlairItem(
  prisma: PrismaClient,
  data: {
    slug: string;
    name: string;
    description?: string;
    kind: FlairKind;
    imageUrl?: string | null;
    color?: string | null;
    rarity?: string;
    source: FlairSource;
    sourceRefId?: string | null;
    createdById?: string | null;
    meta?: any;
  },
): Promise<{ id: string; slug: string }> {
  const created = await (prisma as any).flairItem.create({
    data: {
      slug: data.slug,
      name: data.name,
      description: data.description || "",
      kind: data.kind,
      imageUrl: data.imageUrl || null,
      color: data.color || null,
      rarity: data.rarity || "COMMON",
      source: data.source,
      sourceRefId: data.sourceRefId || null,
      createdById: data.createdById || null,
      meta: data.meta || {},
    },
    select: { id: true, slug: true },
  });
  return created;
}
