import { prisma } from "./prisma";
import { log, swallow } from "./logger";

export type ReactionAgg = { emoji: string; count: number; users: string[] };

// Chat/mention/reaction helpers extracted from index.ts (prisma + regex only).

export const MENTION_RE = /@([a-zA-Z0-9][a-zA-Z0-9_-]{1,31})/g;
export const RESERVED_MENTIONS = new Set([
  "operator",
  "everyone",
  "all",
  "here",
  "admin",
  "mods",
  "staff",
]);

export async function resolveMentions(
  body: string,
  senderId: string,
): Promise<{ id: string; name: string }[]> {
  const handles = new Set<string>();
  let match: RegExpExecArray | null;
  MENTION_RE.lastIndex = 0;
  while ((match = MENTION_RE.exec(body)) !== null) {
    const h = match[1].toLowerCase();
    if (RESERVED_MENTIONS.has(h)) continue;
    handles.add(h);
  }
  if (handles.size === 0) return [];
  try {
    const users = await prisma.user.findMany({
      where: { usernameKey: { in: Array.from(handles) } },
      select: { id: true, name: true, usernameKey: true },
    });
    return users
      .filter((u) => u.id !== senderId)
      .map((u) => ({ id: u.id, name: u.name || u.usernameKey }));
  } catch {
    return [];
  }
}

export async function toggleReactionOnTarget(
  targetType: "ROOM_MESSAGE" | "DIRECT_MESSAGE" | "CREW_MESSAGE",
  targetId: string,
  userId: string,
  emoji: string,
): Promise<{ ok: true; reactions: ReactionAgg[] } | { ok: false; reason: string }> {
  try {
    const existing = await prisma.reaction.findUnique({
      where: { targetType_targetId_userId_emoji: { targetType, targetId, userId, emoji } },
    });
    if (existing) {
      await prisma.reaction.delete({ where: { id: existing.id } });
    } else {
      const distinctRows = await prisma.reaction.groupBy({
        by: ["emoji"],
        where: { targetType, targetId },
      });
      if (distinctRows.length >= 20 && !distinctRows.find((d: any) => d.emoji === emoji)) {
        return { ok: false, reason: "Too many different reactions on this message." };
      }
      await prisma.reaction.create({ data: { targetType, targetId, userId, emoji } });
    }
    const rows = await prisma.reaction.findMany({
      where: { targetType, targetId },
      select: { emoji: true, userId: true },
    });
    const agg: Record<string, { count: number; users: string[] }> = {};
    for (const r of rows) {
      if (!agg[r.emoji]) agg[r.emoji] = { count: 0, users: [] };
      agg[r.emoji].count++;
      if (agg[r.emoji].users.length < 12) agg[r.emoji].users.push(r.userId);
    }
    const reactions: ReactionAgg[] = Object.entries(agg).map(([emoji, v]) => ({
      emoji,
      count: v.count,
      users: v.users,
    }));
    return { ok: true, reactions };
  } catch (e) {
    log.error("[reactionToggle]", e);
    return { ok: false, reason: "reaction_failed" };
  }
}

export async function fetchReactionsForTargets(
  targetType: "ROOM_MESSAGE" | "DIRECT_MESSAGE" | "CREW_MESSAGE",
  targetIds: string[],
): Promise<Record<string, ReactionAgg[]>> {
  const byMsg: Record<string, ReactionAgg[]> = {};
  if (targetIds.length === 0) return byMsg;
  try {
    const rows = await prisma.reaction.findMany({
      where: { targetType, targetId: { in: targetIds } },
      select: { targetId: true, emoji: true, userId: true },
    });
    const nested: Record<string, Record<string, { count: number; users: string[] }>> = {};
    for (const r of rows) {
      if (!nested[r.targetId]) nested[r.targetId] = {};
      if (!nested[r.targetId][r.emoji]) nested[r.targetId][r.emoji] = { count: 0, users: [] };
      nested[r.targetId][r.emoji].count++;
      if (nested[r.targetId][r.emoji].users.length < 12)
        nested[r.targetId][r.emoji].users.push(r.userId);
    }
    for (const [mid, agg] of Object.entries(nested)) {
      byMsg[mid] = Object.entries(agg).map(([e, v]) => ({
        emoji: e,
        count: v.count,
        users: v.users,
      }));
    }
  } catch (e) {
    swallow(e);
  }
  return byMsg;
}

export const CHAT_RATE_MAX = 6;
export const CHAT_RATE_WINDOW_MS = 10_000;
export const CHAT_MAX_URLS = 3;
export const recentChatSends = new Map<string, number[]>();

export function checkChatRateLimit(userId: string): {
  ok: boolean;
  reason?: string;
  retryInMs?: number;
} {
  const now = Date.now();
  const arr = recentChatSends.get(userId) || [];
  const fresh = arr.filter((ts) => now - ts < CHAT_RATE_WINDOW_MS);
  if (fresh.length >= CHAT_RATE_MAX) {
    const oldest = fresh[0];
    const retryInMs = CHAT_RATE_WINDOW_MS - (now - oldest);
    recentChatSends.set(userId, fresh);
    return { ok: false, reason: "Slow down — too many messages in a short window.", retryInMs };
  }
  fresh.push(now);
  recentChatSends.set(userId, fresh);
  return { ok: true };
}

export const URL_RE = /https?:\/\/[^\s<>"')\]]+/gi;
export function checkUrlSpam(body: string): { ok: boolean; reason?: string } {
  const matches = body.match(URL_RE);
  const count = matches ? matches.length : 0;
  if (count > CHAT_MAX_URLS) {
    return { ok: false, reason: `Too many links in one message (max ${CHAT_MAX_URLS}).` };
  }
  return { ok: true };
}

setInterval(() => {
  const now = Date.now();
  for (const [uid, arr] of recentChatSends) {
    const fresh = arr.filter((ts) => now - ts < CHAT_RATE_WINDOW_MS);
    if (fresh.length === 0) recentChatSends.delete(uid);
    else recentChatSends.set(uid, fresh);
  }
}, 60_000);
