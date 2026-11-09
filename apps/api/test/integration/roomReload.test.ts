import { describe, it, expect, afterAll } from "vitest";
import crypto from "crypto";
import { prisma } from "../../src/lib/prisma";
import { ensureRoomLoaded, isModOrOwner, rooms } from "../../src/lib/roomState";
import { handleChat } from "../../src/sockets/messaging";
import { handleRoomMod } from "../../src/sockets/roomMod";

// What a room still has when it comes back from the database: after a deploy,
// or after an idle hour out of memory. Pictures came off their messages that
// way (James 2026-11-08: "The screenshots got pulled on last deploy"), and so
// did pins, mutes and slow mode; a busy room also came back showing its first
// 80 messages ever instead of its latest.

const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
const roomIds: string[] = [];
const userIds: string[] = [];
const attIds: string[] = [];

async function newUser(tag: string) {
  const u = await prisma.user.create({
    data: { usernameKey: `itest_reload_${tag}_${stamp}`, name: `reload ${tag}` },
    select: { id: true },
  });
  userIds.push(u.id);
  return u.id;
}

async function newRoom(data: Record<string, any> = {}) {
  const id = `itest-reload-${roomIds.length}-${stamp}`;
  await prisma.room.create({ data: { id, name: "Reload test", ...data } });
  roomIds.push(id);
  return id;
}

async function newPicture(uploaderId: string, roomId: string, status = "ACTIVE") {
  const f = crypto.randomBytes(10).toString("hex");
  const a = await prisma.chatAttachment.create({
    data: {
      uploaderId,
      roomId,
      url: `/chat/media/${f}.webp`,
      thumbUrl: `/chat/media/${f}.t.webp`,
      width: 1920,
      height: 1080,
      status,
    },
  });
  attIds.push(a.id);
  return a;
}

/** The handlers save in the background; wait for the row to say so. */
async function until<T>(read: () => Promise<T>, ok: (v: T) => boolean): Promise<T> {
  for (let i = 0; i < 50; i++) {
    const v = await read();
    if (ok(v)) return v;
    await new Promise((r) => setTimeout(r, 40));
  }
  return read();
}

/** Out of memory, as a restart or an idle hour leaves it, and back in. */
async function reload(roomId: string): Promise<any> {
  rooms.delete(roomId);
  return ensureRoomLoaded(roomId);
}

afterAll(async () => {
  for (const id of roomIds) rooms.delete(id);
  await prisma.chatAttachment.deleteMany({ where: { id: { in: attIds } } }).catch(() => {});
  await prisma.room.deleteMany({ where: { id: { in: roomIds } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => {});
  await prisma.$disconnect();
});

describe("a room that reloads", () => {
  it("keeps the picture on its message, its pins, its mutes and its slow mode", async () => {
    const owner = await newUser("owner");
    const roomId = await newRoom({ ownerId: owner });
    const room = await reload(roomId);
    room.users.set(owner, { id: owner, name: "reload owner" });
    const ws = { user: { id: owner, name: "reload owner" }, roomId };
    const sent: any[] = [];
    const chatOpts = {
      normalizeRoomId: (x: string) => x,
      loadExistingRoom: async (id: string) => rooms.get(id) ?? null,
      rooms,
      send: (_ws: any, m: any) => sent.push(m),
      broadcast: () => {},
      isModOrOwner,
      checkUrlSpam: () => ({ ok: true }),
      checkChatRateLimit: () => ({ ok: true }),
      roleOf: () => "owner",
      awardNotoriety: async () => null,
      resolveMentions: async () => [],
      createNotification: async () => {},
      getAI: async () => null,
      buildOperatorSystemPrompt: () => "",
    } as any;
    const modCtx = (r: any) => ({
      room: r,
      roomId,
      actorId: owner,
      actorName: "reload owner",
      actorIsMod: true,
      actorIsOwner: true,
    });
    const modOpts = {
      publishState: () => {},
      broadcast: () => {},
      persistRoomBasics: async () => {},
      audit: () => {},
      removeKnock: () => {},
      removePending: () => {},
      doJoin: async () => {},
      send: () => {},
      getGlobalRole: async () => "USER",
      canAccessStaff: () => false,
      findSocketsByUser: () => [],
      isOwner: (r: any, uid?: string) => !!uid && r.ownerId === uid,
      rooms,
      wss: { clients: new Set() },
    } as any;
    const message = (id: string) => prisma.roomMessage.findUnique({ where: { id } }) as any;
    const roomRow = () => prisma.room.findUnique({ where: { id: roomId } }) as any;

    const pic = await newPicture(owner, roomId);
    await handleChat(
      ws,
      {
        type: "chat:send",
        roomId,
        body: "Also here is the small res screen.",
        attachmentId: pic.id,
      },
      chatOpts,
    );
    expect(sent.filter((m) => m.type === "chat:rejected")).toEqual([]);
    const msgId = room.msgs.at(-1).id;
    await until(
      () => message(msgId),
      (m: any) => m?.attachmentId === pic.id,
    );
    await handleChat(ws, { type: "chat:pin", msgId }, chatOpts);
    await until(
      () => message(msgId),
      (m: any) => !!m?.pinnedAt,
    );
    await handleRoomMod(ws, { type: "mod:mute", userId: "troll" }, modCtx(room), modOpts);
    await handleRoomMod(ws, { type: "room:slow", seconds: 30 }, modCtx(room), modOpts);
    await until(roomRow, (r: any) => r?.slowSec === 30 && r?.mutedUserIds?.includes("troll"));

    const again = await reload(roomId);
    expect(again).not.toBe(room);
    expect(again.msgs.find((m: any) => m.id === msgId)?.attachment).toEqual({
      id: pic.id,
      url: pic.url,
      thumbUrl: pic.thumbUrl,
      w: 1920,
      h: 1080,
      trusted: false,
      expiresAt: null,
    });
    expect([...again.pinnedMsgs]).toEqual([msgId]);
    expect(again.muted.has("troll")).toBe(true);
    expect(again.slowSec).toBe(30);

    // Undoing them is kept too.
    await handleChat(ws, { type: "chat:unpin", msgId }, chatOpts);
    await handleRoomMod(ws, { type: "mod:unmute", userId: "troll" }, modCtx(again), modOpts);
    await handleRoomMod(ws, { type: "room:slow", seconds: 0 }, modCtx(again), modOpts);
    await until(
      () => message(msgId),
      (m: any) => m && !m.pinnedAt,
    );
    await until(roomRow, (r: any) => r?.slowSec === 0 && r?.mutedUserIds?.length === 0);
    const third = await reload(roomId);
    expect(third.pinnedMsgs.size).toBe(0);
    expect(third.muted.size).toBe(0);
    expect(third.slowSec).toBe(0);
    expect(third.msgs.find((m: any) => m.id === msgId)?.attachment?.id).toBe(pic.id);
  });

  it("comes back with its newest 80 messages, an older pinned one, and only pictures still up", async () => {
    const author = await newUser("author");
    const roomId = await newRoom();
    const shown = await newPicture(author, roomId);
    const hidden = await newPicture(author, roomId, "HIDDEN");
    const t0 = Date.now() - 90 * 60_000;
    const ids = Array.from({ length: 90 }, (_, i) => `${roomId}-m${String(i).padStart(2, "0")}`);
    await prisma.roomMessage.createMany({
      data: ids.map((id, i) => ({
        id,
        roomId,
        userId: author,
        userName: "reload author",
        body: `message ${i}`,
        ts: new Date(t0 + i * 60_000),
        attachmentId: i === 85 ? shown.id : i === 86 ? hidden.id : null,
        pinnedAt: i === 2 || i === 88 ? new Date() : null,
      })),
    });

    const r = await reload(roomId);
    expect(r.msgs.map((m: any) => m.id)).toEqual([ids[2], ...ids.slice(10)]);
    expect(r.msgs.find((m: any) => m.id === ids[85])?.attachment?.id).toBe(shown.id);
    expect(r.msgs.find((m: any) => m.id === ids[86])?.attachment).toBeUndefined();
    expect(new Set(r.pinnedMsgs)).toEqual(new Set([ids[2], ids[88]]));
  });
});
