import { prisma } from "./prisma";
import { send } from "./roomState";
import { log, swallow } from "./logger";

// Notoriety economy (config + ledger + rank-ups) extracted from index.ts.
// wss (rank-up WS push) + createNotification injected from main().
let _wss: any = null;
let _createNotification: (opts: any) => Promise<any> = async () => null;
export function setNotorietyDeps(deps: {
  wss?: any;
  createNotification?: (opts: any) => Promise<any>;
}) {
  if (deps.wss) _wss = deps.wss;
  if (deps.createNotification) _createNotification = deps.createNotification;
}

export const NOTORIETY_ACTIONS: Record<
  string,
  { points: number; once?: boolean; cooldown?: number }
> = {
  BIO_COMPLETE: { points: 50, once: true },
  FIRST_ROOM_HOSTED: { points: 100, once: true },
  ROOM_25_USERS: { points: 250, once: false },
  SUBREDDIT_LINKED: { points: 75, once: true },
  DAILY_ACTIVE: { points: 10, once: false, cooldown: 86400000 },
  CHAT_MESSAGE: { points: 2, once: false, cooldown: 30000 },
  ROOM_JOINED: { points: 5, once: false, cooldown: 60000 },
  VOICE_JOINED: { points: 15, once: false, cooldown: 300000 },
  CHALLENGE_COMPLETED: { points: 200, once: false, cooldown: 0 },
  FIRST_CHALLENGE: { points: 100, once: true },
  CREW_CREATED: { points: 100, once: true },
  CREW_JOINED: { points: 25, once: false },
  FRIEND_ADDED: { points: 15, once: false },
  LOBBY_CREATED: { points: 200, once: false },
  AVATAR_SET: { points: 30, once: true },
  BUNGIE_LINKED: { points: 75, once: true },
  FIRST_FAKEOUT_TRADE: { points: 100, once: true },
  FAKEOUT_TRADE: { points: 5, once: false, cooldown: 60000 },
  FAKEOUT_PROFIT: { points: 25, once: false, cooldown: 0 },
  LFG_COMPLETED: { points: 20, once: false, cooldown: 600000 },
  HD2_MAJOR_ORDER: { points: 50, once: false },
};

export const NOTORIETY_RANKS = [
  { title: "Street Rat", min: 0 },
  { title: "Corner Boy", min: 100 },
  { title: "Hustler", min: 300 },
  { title: "Shot Caller", min: 500 },
  { title: "Enforcer", min: 1000 },
  { title: "Made Man", min: 1500 },
  { title: "Underboss", min: 3000 },
  { title: "Crime Lord", min: 5000 },
  { title: "Kingpin", min: 10000 },
];

export function getNotorietyRank(n: number): {
  title: string;
  min: number;
  next: { title: string; min: number } | null;
} {
  let rank = NOTORIETY_RANKS[0];
  for (const r of NOTORIETY_RANKS) {
    if (n >= r.min) rank = r;
  }
  const idx = NOTORIETY_RANKS.indexOf(rank);
  const next = idx < NOTORIETY_RANKS.length - 1 ? NOTORIETY_RANKS[idx + 1] : null;
  return { ...rank, next };
}

export const notorietyCooldowns = new Map<string, number>();

export async function awardNotoriety(userId: string, action: string): Promise<number | null> {
  const cfg = NOTORIETY_ACTIONS[action];
  if (!cfg) return null;

  try {
    if (cfg.cooldown) {
      const key = `${userId}:${action}`;
      const last = notorietyCooldowns.get(key) || 0;
      if (Date.now() - last < cfg.cooldown) return null;
      notorietyCooldowns.set(key, Date.now());
    }

    if (cfg.once) {
      const existing = await prisma.notorietyEvent.findFirst({
        where: { userId, action },
      });

      if (existing) return null;
    }

    const userBefore = await prisma.user.findUnique({
      where: { id: userId },
      select: { notoriety: true, name: true },
    });
    const scoreBefore = userBefore?.notoriety || 0;
    const rankBefore = getNotorietyRank(scoreBefore);

    await prisma.$transaction([
      prisma.notorietyEvent.create({ data: { userId, action, points: cfg.points } }),
      prisma.user.update({
        where: { id: userId },
        data: { notoriety: { increment: cfg.points } },
      }),
    ]);

    const scoreAfter = scoreBefore + cfg.points;
    const rankAfter = getNotorietyRank(scoreAfter);

    for (const sock of _wss?.clients ?? []) {
      if (sock.user?.id === userId) {
        send(sock, { type: "notoriety:award", action, points: cfg.points });
        if (rankAfter.title !== rankBefore.title) {
          send(sock, {
            type: "notoriety:rankup",
            oldRank: rankBefore.title,
            newRank: rankAfter.title,
            score: scoreAfter,
          });
        }
      }
    }

    if (rankAfter.title !== rankBefore.title) {
      _createNotification({
        userId,
        type: "NOTORIETY_RANKUP",
        title: `You are now a ${rankAfter.title}!`,
        body: `Promoted from ${rankBefore.title} at ${scoreAfter.toLocaleString()} notoriety`,
        actionUrl: `/profile/${userId}`,
      }).catch(swallow);
    }

    return cfg.points;
  } catch (e) {
    log.error("[notoriety] award failed", action, userId, e);
    return null;
  }
}
