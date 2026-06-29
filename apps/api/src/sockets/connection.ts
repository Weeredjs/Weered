import { swallow } from "../lib/logger";
import { prisma } from "../lib/prisma";

// Connection-lifecycle WS handlers extracted from index.ts wss.on("connection"):
// handleAuthHello -- the auth:hello entry gate, still dispatched FIRST (before the
// !ws.user guard) because it is what sets ws.user; and handleClose -- the
// ws.on("close") cleanup (pending-knock removal, debounced crew offline presence
// via setTimeout, leaveRoom). Both fan crew:presence out over wss.clients. ws is
// `any`; wss + rooms injected by reference. handleClose is sync (it schedules its
// own async work). Every bare return; (incl. the invalid-token / banned exits and
// the nested crew-IIFE early return) is preserved verbatim.

export async function handleAuthHello(
  ws: any,
  msg: any,
  opts: {
    verifyToken: (token?: string) => any;
    hydrateGlobalRole: (user: any) => Promise<any>;
    isGloballyBanned: (userId: string) => Promise<boolean>;
    send: (ws: any, msg: any) => void;
    awardNotoriety: (userId: string, action: string) => Promise<number | null>;
    wss: any;
  },
): Promise<void> {
  const { verifyToken, hydrateGlobalRole, isGloballyBanned, send, awardNotoriety, wss } = opts;

  if (msg.type === "auth:hello") {
    const u = verifyToken(msg.token);
    if (!u) {
      send(ws, { type: "auth:fail", reason: "Invalid token" });
      return;
    }
    if ((u as any).guest) {
      const gu = await prisma.user
        .findUnique({
          where: { id: u.id },
          select: { isGuest: true, banned: true, guestExpiresAt: true },
        })
        .catch(() => null);
      if (
        !gu ||
        !gu.isGuest ||
        gu.banned ||
        (gu.guestExpiresAt && gu.guestExpiresAt.getTime() < Date.now())
      ) {
        send(ws, { type: "auth:fail", reason: "Guest session ended." });
        try {
          ws.close(4001, "guest_revoked");
        } catch (e) {
          swallow(e);
        }
        return;
      }
      ws.user = { ...u, globalRole: "USER", tier: "INNOCENT" } as any;
      send(ws, {
        type: "auth:ok",
        user: {
          id: ws.user.id,
          name: ws.user.name,
          globalRole: "USER",
          tier: "INNOCENT",
          isGuest: true,
        },
      });
      return;
    }
    if ((u as any).host) {
      ws.user = { ...u, globalRole: "USER", tier: "INNOCENT" } as any;
      send(ws, {
        type: "auth:ok",
        user: {
          id: ws.user.id,
          name: ws.user.name,
          globalRole: "USER",
          tier: "INNOCENT",
          isHost: true,
        },
      });
      return;
    }
    ws.user = await hydrateGlobalRole(u);
    if (await isGloballyBanned(ws.user.id)) {
      send(ws, { type: "auth:fail", reason: "Your account has been suspended." });
      try {
        ws.close(4003, "banned");
      } catch (e) {
        swallow(e);
      }
      return;
    }
    send(ws, {
      type: "auth:ok",
      user: {
        id: ws.user.id,
        name: ws.user.name,
        globalRole: ws.user.globalRole,
        tier: ws.user.tier || "INNOCENT",
        avatarColor: ws.user.avatarColor,
        avatar: ws.user.avatar,
        panelBgColor: ws.user.panelBgColor,
        panelAccentColor: ws.user.panelAccentColor,
        pillBgColor: ws.user.pillBgColor,
        pillAccentColor: ws.user.pillAccentColor,
      },
    });
    awardNotoriety(ws.user.id, "DAILY_ACTIVE").catch(swallow);
    (async () => {
      try {
        const memberships = await prisma.crewMember.findMany({
          where: { userId: ws.user!.id },
          select: { crewId: true },
        });
        if (!memberships.length) return;
        const crewIds = memberships.map((m: any) => m.crewId);
        const mates = await prisma.crewMember.findMany({
          where: { crewId: { in: crewIds }, userId: { not: ws.user!.id } },
          select: { userId: true, crewId: true },
        });
        const payload = {
          type: "crew:presence",
          userId: ws.user!.id,
          name: ws.user!.name,
          online: true,
        };
        for (const mate of mates) {
          for (const sock of wss.clients) {
            if (sock.user?.id === mate.userId) send(sock, payload);
          }
        }
      } catch (e) {
        swallow(e);
      }
    })();
    return;
  }
}

export function handleClose(
  ws: any,
  opts: {
    rooms: Map<string, any>;
    isUserOnline: (userId: string) => boolean;
    send: (ws: any, msg: any) => void;
    leaveRoom: (ws: any) => void;
    wss: any;
  },
): void {
  const { rooms, isUserOnline, send, leaveRoom, wss } = opts;

  if (ws.pendingRoomId && ws.user) {
    const r = rooms.get(ws.pendingRoomId);
    if (r) {
      const set = r.pending.get(ws.user.id);
      if (set) set.delete(ws);
      if (set && set.size === 0) r.pending.delete(ws.user.id);
    }
  }
  if (ws.user) {
    const closingUserId = ws.user.id;
    const closingUserName = ws.user.name;
    setTimeout(() => {
      if (!isUserOnline(closingUserId)) {
        (async () => {
          try {
            const memberships = await prisma.crewMember.findMany({
              where: { userId: closingUserId },
              select: { crewId: true },
            });
            if (!memberships.length) return;
            const crewIds = memberships.map((m: any) => m.crewId);
            const mates = await prisma.crewMember.findMany({
              where: { crewId: { in: crewIds }, userId: { not: closingUserId } },
              select: { userId: true },
            });
            const payload = {
              type: "crew:presence",
              userId: closingUserId,
              name: closingUserName,
              online: false,
            };
            for (const mate of mates) {
              for (const sock of wss.clients) {
                if (sock.user?.id === mate.userId) send(sock, payload);
              }
            }
          } catch (e) {
            swallow(e);
          }
        })();
      }
    }, 2000);
  }
  leaveRoom(ws);
}
