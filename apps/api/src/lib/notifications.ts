import webpush from "web-push";
import { WebSocketServer } from "ws";
import { prisma } from "./prisma";
import { send, type Sock } from "./roomState";
import { NotificationType } from "@prisma/client";
import { log, swallow } from "./logger";

// Notification + push delivery (web-push + Expo) + DM helpers, extracted
// from index.ts. wss is injected from main() so the online-check and
// in-app delivery can reach every connected socket.
let _wss: WebSocketServer | null = null;
export function setNotificationsWss(w: WebSocketServer) {
  _wss = w;
}

export const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:support@weered.ca";
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

export function dmDeliver(toUserId: string, payload: object) {
  for (const sock of (_wss as any)?.clients ?? []) {
    if ((sock as any).user?.id === toUserId) {
      send(sock as any, payload);
    }
  }
}

export function send_to_user(userId: string, payload: object) {
  dmDeliver(userId, payload);
}

export function isUserOnline(userId: string): boolean {
  for (const sock of (_wss as any)?.clients ?? []) {
    if ((sock as any).user?.id === userId) return true;
  }
  return false;
}

let _operatorUserId: string | null = null;
export async function getOperatorUserId(): Promise<string> {
  if (_operatorUserId) return _operatorUserId;
  try {
    const op = await prisma.user.upsert({
      where: { usernameKey: "operator" },
      update: {},
      create: {
        usernameKey: "operator",
        name: "The Operator",
        avatar: "/brand/roles/operator.svg",
        avatarColor: "#D4A017",
        bio: "I'm the system. Type /help anywhere if you need a hand.",
      },
    });
    _operatorUserId = op.id;
    return op.id;
  } catch (e) {
    log.error("[getOperatorUserId]", e);
    throw e;
  }
}

export async function seedWelcomeDM(toUserId: string): Promise<void> {
  try {
    const fromId = await getOperatorUserId();
    if (fromId === toUserId) return;
    const body = `Welcome aboard. This is the Burner — your DMs, friends, and crew all dock here. Tap a tab to explore.

We're sailing on the Windrose lobby right now (link in the rail). Find a crew, post a bounty on a Kraken tooth, browse mods. Voice rooms work everywhere.

If you get stuck, just hit me back here. — The Operator 🏴‍☠️`;
    const dm = await prisma.directMessage.create({
      data: { fromId, toId: toUserId, body },
    });
    dmDeliver(toUserId, {
      type: "dm:in",
      dm: {
        id: dm.id,
        fromId,
        toId: toUserId,
        body: dm.body,
        createdAt: dm.createdAt,
        fromName: "The Operator",
      },
    });
  } catch (e) {
    log.error("[seedWelcomeDM]", e);
  }
}

export async function sendWebPush(
  userId: string,
  data: { title: string; body: string; url?: string; tag?: string },
) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(data),
      );
    } catch (e: any) {
      if (e.statusCode === 404 || e.statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(swallow);
      }
    }
  }
}

export async function sendExpoPush(
  userId: string,
  data: { title: string; body: string; url?: string; tag?: string },
) {
  const tokens = await prisma.expoPushToken.findMany({ where: { userId } });
  if (tokens.length === 0) return;
  const messages = tokens.map((t: any) => ({
    to: t.token,
    title: data.title,
    body: data.body || "",
    sound: "default",
    data: { url: data.url || "/", tag: data.tag },
  }));
  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages),
    });
    if (!res.ok) return;
    const json: any = await res.json().catch(() => null);
    const tickets: any[] = json?.data || [];
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      const token = tokens[i];
      if (!token) continue;
      if (ticket?.status === "error" && ticket?.details?.error === "DeviceNotRegistered") {
        await prisma.expoPushToken.delete({ where: { id: token.id } }).catch(swallow);
      }
    }
  } catch (e) {
    swallow(e);
  }
}

export async function sendPush(
  userId: string,
  data: { title: string; body: string; url?: string; tag?: string },
) {
  await Promise.all([sendWebPush(userId, data), sendExpoPush(userId, data)]);
}

export async function createNotification(opts: {
  userId: string;
  type: string;
  title: string;
  body?: string;
  actionUrl?: string;
  actorId?: string;
  actorName?: string;
  meta?: any;
}) {
  try {
    const notif = await prisma.notification.create({
      data: {
        userId: opts.userId,
        type: opts.type as NotificationType,
        title: opts.title,
        body: opts.body || "",
        actionUrl: opts.actionUrl || null,
        actorId: opts.actorId || null,
        actorName: opts.actorName || null,
        meta: opts.meta || undefined,
      },
    });
    let matched = 0;
    const socketUserIds: string[] = [];
    for (const sock of (_wss as any)?.clients ?? []) {
      const sid = (sock as any).user?.id;
      if (sid) socketUserIds.push(sid);
      if (sid === opts.userId) {
        matched++;
        send(sock as Sock, {
          type: "notification:new",
          notification: {
            ...notif,
            createdAt: notif.createdAt?.toISOString?.() || notif.createdAt,
          },
        });
      }
    }
    log.log(
      "[notification]",
      opts.type,
      "target=" + opts.userId,
      "total_clients=" + ((_wss as any)?.clients ?? []).size,
      "authed_count=" + socketUserIds.length,
      "matched=" + matched,
    );
    if (matched === 0 && socketUserIds.length > 0) {
      log.log("[notification] target not found among:", JSON.stringify(socketUserIds.slice(0, 10)));
    }
    if (!isUserOnline(opts.userId)) {
      sendPush(opts.userId, {
        title: opts.title,
        body: opts.body || "",
        url: opts.actionUrl || "/home",
        tag: `notif:${opts.type}:${notif.id}`,
      }).catch(swallow);
    }
  } catch (e) {
    log.error("[notification] create failed", e);
  }
}
