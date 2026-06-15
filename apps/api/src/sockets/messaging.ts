import { log } from "../lib/logger";
import { prisma } from "../lib/prisma";
import { randomUUID } from "crypto";

// Chat WS handlers extracted from the index.ts main message handler:
// chat:pin/unpin/typing/send/edit/delete. Void async handler (dispatcher
// matches the "chat:" prefix + returns), so every bare return; is preserved
// verbatim -- including the callback-returns inside chat:send's nested async
// IIFEs (mention notifications + the @operator/ /ask LLM path, model id
// claude-haiku-4-5-20251001 unchanged). rooms is the live Map (in-memory
// room.msgs/pinned/modPolicy mutated through it).
type Opts = {
  normalizeRoomId: (input: string) => string;
  ensureRoomLoaded: (roomId: string) => Promise<any>;
  rooms: Map<string, any>;
  send: (ws: any, msg: any) => void;
  broadcast: (room: any, msg: any) => void;
  isModOrOwner: (room: any, userId?: string, globalRole?: string) => boolean;
  checkUrlSpam: (body: string) => { ok: boolean; reason?: string };
  checkChatRateLimit: (userId: string) => { ok: boolean; reason?: string; retryInMs?: number };
  roleOf: (room: any, userId: string) => any;
  awardNotoriety: (userId: string, action: string) => Promise<number | null>;
  resolveMentions: (body: string, senderId: string) => Promise<Array<{ id: string }>>;
  createNotification: (opts: any) => Promise<any>;
  getAI: () => Promise<any>;
  buildOperatorSystemPrompt: (lobbyId: string) => string;
};

export async function handleChat(ws: any, msg: any, opts: Opts): Promise<void> {
  const {
    normalizeRoomId,
    ensureRoomLoaded,
    rooms,
    send,
    broadcast,
    isModOrOwner,
    checkUrlSpam,
    checkChatRateLimit,
    roleOf,
    awardNotoriety,
    resolveMentions,
    createNotification,
    getAI,
    buildOperatorSystemPrompt,
  } = opts;

  if (msg.type === "chat:pin" || msg.type === "chat:unpin") {
    if (!ws.user?.id || !ws.roomId) return;
    const room = rooms.get(ws.roomId);
    if (!room) return;
    if (!isModOrOwner(room, ws.user.id, ws.user.globalRole)) return;
    const msgId = String((msg as any).msgId || "");
    if (!msgId) return;
    (room as any).pinned = (room as any).pinned || new Set<string>();
    if (msg.type === "chat:pin") {
      if ((room as any).pinned.size >= 10) {
        send(ws, { type: "chat:pin:error", reason: "Pinned limit is 10. Unpin one first." });
        return;
      }
      (room as any).pinned.add(msgId);
    } else {
      (room as any).pinned.delete(msgId);
    }
    broadcast(room, {
      type: "chat:pins",
      roomId: room.roomId,
      pinned: Array.from((room as any).pinned),
    });
    return;
  }

  if (msg.type === "chat:typing") {
    if (!ws.user?.id || !ws.roomId) return;
    const room = rooms.get(ws.roomId);
    if (!room || !room.users.has(ws.user.id)) return;
    broadcast(room, {
      type: "chat:typing",
      roomId: room.roomId,
      user: { id: ws.user.id, name: ws.user.name },
    });
    return;
  }

  if (msg.type === "chat:send") {
    const roomId = normalizeRoomId(String(msg.roomId || ""));
    const body = String(msg.body || "").trim();
    const attachmentId = String((msg as any).attachmentId || "").slice(0, 40);
    if (!roomId || (!body && !attachmentId)) return;
    const room = await ensureRoomLoaded(roomId);
    if (!room.users.has(ws.user.id)) return;
    if (room.banned.has(ws.user.id)) return;
    if (room.muted.has(ws.user.id)) return;
    const urlCheck = checkUrlSpam(body);
    if (!urlCheck.ok) {
      send(ws, { type: "chat:rejected", roomId, reason: urlCheck.reason });
      return;
    }
    const rate = checkChatRateLimit(ws.user.id);
    if (!rate.ok) {
      send(ws, { type: "chat:rejected", roomId, reason: rate.reason, retryInMs: rate.retryInMs });
      return;
    }
    if (room.lobbyId) {
      const cache = (room as any).modPolicy as
        | {
            blockedWords: string[];
            blockedDomains: string[];
            newAccountChatHours: number;
            expiresAt: number;
          }
        | undefined;
      let policy = cache && cache.expiresAt > Date.now() ? cache : null;
      if (!policy) {
        try {
          const l: any = await prisma.lobby.findUnique({
            where: { id: room.lobbyId },
            select: { blockedWords: true, blockedDomains: true, newAccountChatHours: true },
          });
          policy = {
            blockedWords: Array.isArray(l?.blockedWords) ? l.blockedWords : [],
            blockedDomains: Array.isArray(l?.blockedDomains) ? l.blockedDomains : [],
            newAccountChatHours: Number(l?.newAccountChatHours || 0),
            expiresAt: Date.now() + 60_000,
          };
          (room as any).modPolicy = policy;
        } catch {
          policy = {
            blockedWords: [],
            blockedDomains: [],
            newAccountChatHours: 0,
            expiresAt: Date.now() + 60_000,
          };
        }
      }
      if (policy.newAccountChatHours > 0) {
        try {
          const u = await prisma.user.findUnique({
            where: { id: ws.user.id },
            select: { createdAt: true },
          });
          if (u && Date.now() - u.createdAt.getTime() < policy.newAccountChatHours * 3600 * 1000) {
            send(ws, {
              type: "chat:rejected",
              roomId,
              reason: "account_too_new",
              message: `New accounts must wait ${policy.newAccountChatHours}h before chatting in this lobby.`,
            });
            return;
          }
        } catch {}
      }
      if (policy.blockedWords.length > 0) {
        const lower = body.toLowerCase();
        const hit = policy.blockedWords.find((w) => w && lower.includes(String(w).toLowerCase()));
        if (hit) {
          send(ws, { type: "chat:rejected", roomId, reason: "blocked_word" });
          return;
        }
      }
      if (policy.blockedDomains.length > 0) {
        const urls = body.match(/https?:\/\/[^\s)]+/gi) || [];
        const bad = urls.find((u) =>
          policy!.blockedDomains.some(
            (d) => d && u.toLowerCase().includes(String(d).toLowerCase()),
          ),
        );
        if (bad) {
          send(ws, { type: "chat:rejected", roomId, reason: "blocked_domain" });
          return;
        }
      }
    }
    let replyTo: any;
    const replyToId = typeof msg.replyToId === "string" ? msg.replyToId : "";
    if (replyToId) {
      const parent = room.msgs.find((x: any) => x.id === replyToId);
      if (parent && !parent.deletedAt) {
        replyTo = {
          id: parent.id,
          userId: parent.user.id,
          userName: parent.user.name,
          body: String(parent.body || "").slice(0, 120),
        };
      }
    }
    let attachment: any;
    if (attachmentId) {
      try {
        const att: any = await prisma.chatAttachment.findUnique({ where: { id: attachmentId } });
        if (
          att &&
          att.uploaderId === ws.user.id &&
          att.status === "ACTIVE" &&
          Date.now() - new Date(att.createdAt).getTime() < 15 * 60_000
        ) {
          attachment = {
            id: att.id,
            url: att.url,
            thumbUrl: att.thumbUrl,
            w: att.width,
            h: att.height,
            trusted: att.trusted,
            expiresAt: att.expiresAt ? new Date(att.expiresAt).toISOString() : null,
          };
          if (!att.roomId)
            void prisma.chatAttachment
              .update({ where: { id: att.id }, data: { roomId: room.roomId } })
              .catch(() => {});
        }
      } catch {}
      if (!attachment) {
        send(ws, { type: "chat:rejected", roomId, reason: "bad_attachment" });
        return;
      }
    }
    const u = room.users.get(ws.user.id)!;
    const m: any = {
      id: randomUUID(),
      user: {
        id: u.id,
        name: u.name,
        role: roleOf(room, u.id),
        avatarColor: (u as any).avatarColor,
        avatar: (u as any).avatar,
      },
      body,
      ts: Date.now(),
      replyTo,
      attachment,
    };
    room.msgs.push(m);
    if (room.msgs.length > 200) room.msgs.splice(0, room.msgs.length - 200);
    if (room.roomId !== "lobby") {
      void prisma.roomMessage
        .create({
          data: {
            id: m.id,
            roomId: room.roomId,
            userId: m.user.id,
            userName: m.user.name,
            body: m.body,
            ts: new Date(m.ts),
            replyToId: replyTo?.id ?? null,
            replyToUserId: replyTo?.userId ?? null,
            replyToUserName: replyTo?.userName ?? null,
            replyToBody: replyTo?.body ?? null,
          } as any,
        })
        .catch(() => {});
    }
    broadcast(room, { type: "chat:new", roomId, msg: m });
    room.lastActiveAt = Date.now();
    awardNotoriety(ws.user.id, "CHAT_MESSAGE").catch(() => {});
    (async () => {
      try {
        const mentioned = await resolveMentions(body, ws.user!.id);
        const roomPath = room.lobbyId ? `/lobby/${room.lobbyId}` : `/room/${room.roomId}`;
        for (const u of mentioned) {
          createNotification({
            userId: u.id,
            type: "MENTION",
            title: `${ws.user!.name} mentioned you in ${room.name || "a lobby"}`,
            body: body.slice(0, 120),
            actorId: ws.user!.id,
            actorName: ws.user!.name,
            actionUrl: roomPath,
          }).catch(() => {});
        }
      } catch {}
    })();
    if (body.toLowerCase().includes("@operator") || body.toLowerCase().startsWith("/ask ")) {
      const question = body
        .replace(/@operator/gi, "")
        .replace(/^\/ask\s*/i, "")
        .trim();
      if (question.length > 0) {
        (async () => {
          try {
            const ai = await getAI();
            if (!ai) return;
            const response = await ai.messages.create({
              model: "claude-haiku-4-5-20251001",
              max_tokens: 300,
              system: buildOperatorSystemPrompt(room.lobbyId || ""),
              messages: [{ role: "user", content: question }],
            });
            const reply = response?.content?.[0]?.text || "";
            if (reply) {
              const botMsg = {
                id: randomUUID(),
                user: {
                  id: "operator",
                  name: "The Operator",
                  role: "SYSTEM" as any,
                  avatarColor: "#D4A017",
                  avatar: "/brand/roles/operator.svg",
                },
                body: reply,
                ts: Date.now(),
              };
              room.msgs.push(botMsg);
              if (room.msgs.length > 200) room.msgs.splice(0, room.msgs.length - 200);
              broadcast(room, { type: "chat:new", roomId, msg: botMsg });
            }
          } catch (e) {
            log.error("[operator]", e);
          }
        })();
      }
    }
    return;
  }

  if (msg.type === "chat:edit") {
    const rId = normalizeRoomId(String(msg.roomId || ""));
    const msgId = String(msg.msgId || "");
    const newBody = String(msg.body || "").trim();
    if (!rId || !msgId || !newBody) return;
    const room = await ensureRoomLoaded(rId);
    if (room.banned.has(ws.user.id)) return;
    const target = room.msgs.find((m: any) => m.id === msgId);
    if (!target) return;
    if (target.deletedAt) return;
    if (target.user.id !== ws.user.id) return;
    if (target.body === newBody) return;
    if (Date.now() - target.ts > 15 * 60 * 1000) return;
    target.body = newBody;
    const editedAt = Date.now();
    target.editedAt = editedAt;
    if (room.roomId !== "lobby") {
      void prisma.roomMessage
        .update({
          where: { id: msgId },
          data: { body: newBody, editedAt: new Date(editedAt) },
        })
        .catch(() => {});
    }
    broadcast(room, { type: "chat:edited", roomId: rId, msgId, body: newBody, editedAt });
    return;
  }

  if (msg.type === "chat:delete") {
    const rId = normalizeRoomId(String(msg.roomId || ""));
    const msgId = String(msg.msgId || "");
    if (!rId || !msgId) return;
    const room = await ensureRoomLoaded(rId);
    const target = room.msgs.find((m: any) => m.id === msgId);
    if (!target) return;
    if (target.deletedAt) return;
    const isSender = target.user.id === ws.user.id;
    const isMod = isModOrOwner(room, ws.user.id, ws.user.globalRole);
    if (!isSender && !isMod) return;
    const deletedAt = Date.now();
    target.deletedAt = deletedAt;
    target.body = "";
    if (room.roomId !== "lobby") {
      void prisma.roomMessage
        .update({
          where: { id: msgId },
          data: { body: "", deletedAt: new Date(deletedAt) },
        })
        .catch(() => {});
    }
    broadcast(room, { type: "chat:deleted", roomId: rId, msgId, deletedAt });
    return;
  }
}

// Crew + direct-message WS handlers extracted from the index.ts main message
// handler: crew:send/edit/delete/react + dm:send/read/edit/delete/react. Void
// async handler (dispatched via the isCrewOrDm prefix check kept in index.ts, so
// the room-required preamble guard still exempts crew/dm). Self-resolving via
// ws.user; wss passed in (request-time, already assigned) for crew/dm fan-out.
export async function handleCrewDm(
  ws: any,
  msg: any,
  opts: {
    checkUrlSpam: (body: string) => { ok: boolean; reason?: string };
    checkChatRateLimit: (userId: string) => { ok: boolean; reason?: string; retryInMs?: number };
    createNotification: (opts: any) => Promise<any>;
    dmDeliver: (toUserId: string, payload: any) => void;
    isUserOnline: (userId: string) => boolean;
    resolveMentions: (body: string, senderId: string) => Promise<Array<{ id: string }>>;
    resolveUserId: (raw: string) => Promise<string>;
    send: (ws: any, msg: any) => void;
    sendPush: (userId: string, data: any) => Promise<any>;
    toggleReactionOnTarget: (
      targetType: any,
      targetId: string,
      userId: string,
      emoji: string,
    ) => Promise<any>;
    awardNotoriety: (userId: string, action: string) => Promise<number | null>;
    wss: any;
  },
): Promise<void> {
  const {
    checkUrlSpam,
    checkChatRateLimit,
    createNotification,
    dmDeliver,
    isUserOnline,
    resolveMentions,
    resolveUserId,
    send,
    sendPush,
    toggleReactionOnTarget,
    awardNotoriety,
    wss,
  } = opts;

  if (msg.type === "crew:send") {
    const crewId = String(msg.crewId || "").trim();
    const body = String(msg.body || "")
      .trim()
      .slice(0, 2000);
    const fromId = ws.user?.id;
    if (!fromId || !crewId || !body) return;
    const urlCheck = checkUrlSpam(body);
    if (!urlCheck.ok) {
      send(ws, { type: "crew:rejected", crewId, reason: urlCheck.reason });
      return;
    }
    const rate = checkChatRateLimit(fromId);
    if (!rate.ok) {
      send(ws, { type: "crew:rejected", crewId, reason: rate.reason, retryInMs: rate.retryInMs });
      return;
    }

    try {
      const membership = await prisma.crewMember.findFirst({
        where: { crewId, userId: fromId },
      });
      if (!membership) return;

      let crewReplyData: any = {};
      const crewReplyToId = typeof msg.replyToId === "string" ? msg.replyToId : "";
      if (crewReplyToId) {
        const parent = await prisma.crewMessage.findUnique({ where: { id: crewReplyToId } });
        if (parent && !parent.deletedAt && parent.crewId === crewId) {
          crewReplyData = {
            replyToId: parent.id,
            replyToUserId: parent.userId,
            replyToUserName: parent.userName || "?",
            replyToBody: String(parent.body || "").slice(0, 120),
          };
        }
      }

      const message = await prisma.crewMessage.create({
        data: {
          crewId,
          userId: fromId,
          userName: ws.user?.name || "Unknown",
          body,
          ...crewReplyData,
        },
        select: {
          id: true,
          crewId: true,
          userId: true,
          userName: true,
          body: true,
          createdAt: true,
          replyToId: true,
          replyToUserId: true,
          replyToUserName: true,
          replyToBody: true,
        },
      });

      const members = await prisma.crewMember.findMany({
        where: { crewId },
        select: { userId: true },
      });

      const payload = {
        type: "crew:message",
        crewId,
        message: { ...message, createdAt: message.createdAt.toISOString() },
      };
      for (const sock of wss.clients) {
        const sockUser = (sock as any).user;
        if (sockUser && members.some((m: any) => m.userId === sockUser.id)) {
          send(sock as any, payload);
        }
      }

      for (const m of members) {
        if (m.userId === fromId) continue;
        if (!isUserOnline(m.userId)) {
          sendPush(m.userId, {
            title: `Crew message from ${ws.user?.name}`,
            body: body.slice(0, 120),
            url: "/home",
            tag: `crew:${crewId}`,
          }).catch(() => {});
        }
      }

      awardNotoriety(fromId, "CHAT_MESSAGE").catch(() => {});

      (async () => {
        try {
          const mentioned = await resolveMentions(body, fromId);
          if (mentioned.length === 0) return;
          const memberRows = await prisma.crewMember.findMany({
            where: { crewId },
            select: { userId: true },
          });
          const memberSet = new Set<string>(memberRows.map((r: any) => r.userId));
          for (const u of mentioned) {
            if (!memberSet.has(u.id)) continue;
            createNotification({
              userId: u.id,
              type: "MENTION",
              title: `${ws.user?.name || "Someone"} mentioned you in crew chat`,
              body: body.slice(0, 120),
              actorId: fromId,
              actorName: ws.user?.name || undefined,
              actionUrl: "/home",
              meta: { crewId },
            }).catch(() => {});
          }
        } catch {}
      })();
    } catch (e) {
      log.error("[crew:send]", e);
    }
    return;
  }

  if (msg.type === "crew:edit") {
    const msgId = String(msg.msgId || "");
    const newBody = String(msg.body || "")
      .trim()
      .slice(0, 2000);
    const meId = ws.user?.id;
    if (!msgId || !newBody || !meId) return;
    try {
      const row = await prisma.crewMessage.findUnique({ where: { id: msgId } });
      if (!row) return;
      if (row.userId !== meId) return;
      if (row.deletedAt) return;
      if (row.body === newBody) return;
      if (Date.now() - new Date(row.createdAt).getTime() > 15 * 60 * 1000) return;
      const editedAt = new Date();
      await prisma.crewMessage.update({ where: { id: msgId }, data: { body: newBody, editedAt } });
      const members = await prisma.crewMember.findMany({
        where: { crewId: row.crewId },
        select: { userId: true },
      });
      const memberIds = new Set(members.map((m: any) => m.userId));
      const payload = {
        type: "crew:edited",
        crewId: row.crewId,
        msgId,
        body: newBody,
        editedAt: editedAt.toISOString(),
      };
      for (const sock of wss.clients) {
        const sockUser = (sock as any).user;
        if (sockUser && memberIds.has(sockUser.id)) send(sock as any, payload);
      }
    } catch (e) {
      log.error("[crew:edit]", e);
    }
    return;
  }

  if (msg.type === "crew:delete") {
    const msgId = String(msg.msgId || "");
    const meId = ws.user?.id;
    if (!msgId || !meId) return;
    try {
      const row = await prisma.crewMessage.findUnique({ where: { id: msgId } });
      if (!row) return;
      if (row.deletedAt) return;
      const membership = await prisma.crewMember.findFirst({
        where: { crewId: row.crewId, userId: meId },
      });
      const isMod = membership?.role === "LEADER" || membership?.role === "OFFICER";
      if (row.userId !== meId && !isMod) return;
      const deletedAt = new Date();
      await prisma.crewMessage.update({ where: { id: msgId }, data: { body: "", deletedAt } });
      const members = await prisma.crewMember.findMany({
        where: { crewId: row.crewId },
        select: { userId: true },
      });
      const memberIds = new Set(members.map((m: any) => m.userId));
      const payload = {
        type: "crew:deleted",
        crewId: row.crewId,
        msgId,
        deletedAt: deletedAt.toISOString(),
      };
      for (const sock of wss.clients) {
        const sockUser = (sock as any).user;
        if (sockUser && memberIds.has(sockUser.id)) send(sock as any, payload);
      }
    } catch (e) {
      log.error("[crew:delete]", e);
    }
    return;
  }

  if (msg.type === "crew:react") {
    const msgId = String(msg.msgId || "");
    const emoji = String(msg.emoji || "")
      .trim()
      .slice(0, 12);
    const meId = ws.user?.id;
    if (!msgId || !emoji || !meId) return;
    try {
      const row = await prisma.crewMessage.findUnique({ where: { id: msgId } });
      if (!row) return;
      if (row.deletedAt) return;
      const membership = await prisma.crewMember.findFirst({
        where: { crewId: row.crewId, userId: meId },
      });
      if (!membership) return;
      const res = await toggleReactionOnTarget("CREW_MESSAGE", msgId, meId, emoji);
      if (!res.ok) {
        send(ws, { type: "reaction:rejected", msgId, reason: res.reason });
        return;
      }
      const members = await prisma.crewMember.findMany({
        where: { crewId: row.crewId },
        select: { userId: true },
      });
      const memberIds = new Set(members.map((m: any) => m.userId));
      const payload = {
        type: "crew:reaction",
        crewId: row.crewId,
        msgId,
        reactions: res.reactions,
      };
      for (const sock of wss.clients) {
        const sockUser = (sock as any).user;
        if (sockUser && memberIds.has(sockUser.id)) send(sock as any, payload);
      }
    } catch (e) {
      log.error("[crew:react]", e);
    }
    return;
  }

  if (msg.type === "dm:send") {
    const rawToId = String(msg.toId || "").trim();
    const body = String(msg.body || "")
      .trim()
      .slice(0, 2000);
    const fromId = ws.user?.id;
    log.log(
      `[dm:send] fromId=${fromId || "(none)"} rawToId=${JSON.stringify(rawToId)} bodyLen=${body.length}`,
    );
    if (!fromId) {
      send(ws, { type: "dm:rejected", reason: "Session expired. Refresh the page." });
      return;
    }
    if (!rawToId) {
      send(ws, { type: "dm:rejected", reason: "No recipient selected." });
      return;
    }
    if (!body) {
      send(ws, { type: "dm:rejected", reason: "Empty message." });
      return;
    }
    const urlCheck = checkUrlSpam(body);
    if (!urlCheck.ok) {
      send(ws, { type: "dm:rejected", reason: urlCheck.reason });
      return;
    }
    const rate = checkChatRateLimit(fromId);
    if (!rate.ok) {
      send(ws, { type: "dm:rejected", reason: rate.reason, retryInMs: rate.retryInMs });
      return;
    }
    const toId = await resolveUserId(rawToId);
    try {
      const blocked = await prisma.userBlock.findFirst({
        where: {
          OR: [
            { blockerId: fromId, blockedId: toId },
            { blockerId: toId, blockedId: fromId },
          ],
        },
        select: { blockerId: true },
      });
      if (blocked) {
        const reason =
          blocked.blockerId === fromId
            ? "You've blocked this user. Unblock them in Settings to send messages."
            : "Message not delivered.";
        send(ws, { type: "dm:rejected", reason });
        return;
      }
    } catch {}
    let dmReplyData: any = {};
    const dmReplyToId = typeof msg.replyToId === "string" ? msg.replyToId : "";
    if (dmReplyToId) {
      try {
        const parent = await prisma.directMessage.findUnique({ where: { id: dmReplyToId } });
        if (parent && !(parent as any).deletedAt) {
          const sameThread =
            (parent.fromId === fromId && parent.toId === toId) ||
            (parent.fromId === toId && parent.toId === fromId);
          if (sameThread) {
            const parentUser = await prisma.user.findUnique({
              where: { id: parent.fromId },
              select: { name: true },
            });
            dmReplyData = {
              replyToId: parent.id,
              replyToUserId: parent.fromId,
              replyToUserName: parentUser?.name || "?",
              replyToBody: String(parent.body || "").slice(0, 120),
            };
          }
        }
      } catch {}
    }
    try {
      const dm = await prisma.directMessage.create({
        data: { fromId, toId, body, ...dmReplyData },
        select: {
          id: true,
          fromId: true,
          toId: true,
          body: true,
          createdAt: true,
          replyToId: true,
          replyToUserId: true,
          replyToUserName: true,
          replyToBody: true,
        } as any,
      });
      const payload = {
        type: "dm:message",
        message: { ...dm, createdAt: (dm as any).createdAt.toISOString() },
      };
      dmDeliver(toId, payload);
      sendPush(toId, {
        title: `DM from ${ws.user?.name || "Someone"}`,
        body: body.slice(0, 120),
        url: "/home",
        tag: `dm:${fromId}`,
      }).catch(() => {});
      createNotification({
        userId: toId,
        type: "DM_RECEIVED",
        title: `${ws.user?.name || "Someone"} sent you a message`,
        body: body.slice(0, 120),
        actorId: fromId,
        actorName: ws.user?.name || undefined,
        actionUrl: "/home",
        meta: { fromId },
      }).catch(() => {});
    } catch (e) {
      log.error("[dm:send]", e);
    }
    return;
  }

  if (msg.type === "dm:read") {
    const fromId = String(msg.fromId || "").trim();
    const toId = ws.user?.id;
    if (!fromId || !toId) return;
    try {
      await prisma.directMessage.updateMany({
        where: { fromId, toId, readAt: null },
        data: { readAt: new Date() },
      });
      send(ws, { type: "dm:read:ack", fromId });
    } catch (e) {
      log.error("[dm:read]", e);
    }
    return;
  }

  if (msg.type === "dm:edit") {
    const msgId = String(msg.msgId || "");
    const newBody = String(msg.body || "")
      .trim()
      .slice(0, 2000);
    const meId = ws.user?.id;
    if (!msgId || !newBody || !meId) return;
    try {
      const dm = await prisma.directMessage.findUnique({ where: { id: msgId } });
      if (!dm) return;
      if (dm.fromId !== meId) return;
      if ((dm as any).deletedAt) return;
      if (dm.body === newBody) return;
      if (Date.now() - new Date(dm.createdAt).getTime() > 15 * 60 * 1000) return;
      const editedAt = new Date();
      await prisma.directMessage.update({
        where: { id: msgId },
        data: { body: newBody, editedAt },
      });
      const payload = {
        type: "dm:edited",
        msgId,
        fromId: dm.fromId,
        toId: dm.toId,
        body: newBody,
        editedAt: editedAt.toISOString(),
      };
      dmDeliver(dm.toId, payload);
      dmDeliver(dm.fromId, payload);
    } catch (e) {
      log.error("[dm:edit]", e);
    }
    return;
  }

  if (msg.type === "dm:delete") {
    const msgId = String(msg.msgId || "");
    const meId = ws.user?.id;
    if (!msgId || !meId) return;
    try {
      const dm = await prisma.directMessage.findUnique({ where: { id: msgId } });
      if (!dm) return;
      if (dm.fromId !== meId) return;
      if ((dm as any).deletedAt) return;
      const deletedAt = new Date();
      await prisma.directMessage.update({
        where: { id: msgId },
        data: { body: "", deletedAt },
      });
      const payload = {
        type: "dm:deleted",
        msgId,
        fromId: dm.fromId,
        toId: dm.toId,
        deletedAt: deletedAt.toISOString(),
      };
      dmDeliver(dm.toId, payload);
      dmDeliver(dm.fromId, payload);
    } catch (e) {
      log.error("[dm:delete]", e);
    }
    return;
  }

  if (msg.type === "dm:react") {
    const msgId = String(msg.msgId || "");
    const emoji = String(msg.emoji || "")
      .trim()
      .slice(0, 12);
    const meId = ws.user?.id;
    if (!msgId || !emoji || !meId) return;
    try {
      const dm = await prisma.directMessage.findUnique({ where: { id: msgId } });
      if (!dm) return;
      if ((dm as any).deletedAt) return;
      if (dm.fromId !== meId && dm.toId !== meId) return;
      const res = await toggleReactionOnTarget("DIRECT_MESSAGE", msgId, meId, emoji);
      if (!res.ok) {
        send(ws, { type: "reaction:rejected", msgId, reason: res.reason });
        return;
      }
      const payload = {
        type: "dm:reaction",
        msgId,
        fromId: dm.fromId,
        toId: dm.toId,
        reactions: res.reactions,
      };
      dmDeliver(dm.toId, payload);
      dmDeliver(dm.fromId, payload);
    } catch (e) {
      log.error("[dm:react]", e);
    }
    return;
  }
}

// Message-reaction WS handler (reaction:toggle) extracted from the index.ts
// main message handler. Self-resolving (own roomId via normalizeRoomId), so it
// stays a PRE-preamble dispatch. Non-lobby rooms persist reactions via the
// (FK-less) Reaction table; the lobby keeps them in-memory on the live room.msgs
// object. Void async handler -- every bare return; (incl. the >=20 distinct-emoji
// reaction:rejected guards) is preserved verbatim.
export async function handleReactionToggle(
  ws: any,
  msg: any,
  opts: {
    normalizeRoomId: (input: string) => string;
    ensureRoomLoaded: (roomId: string) => Promise<any>;
    send: (ws: any, msg: any) => void;
    broadcast: (room: any, msg: any) => void;
  },
): Promise<void> {
  const { normalizeRoomId, ensureRoomLoaded, send, broadcast } = opts;

  if (msg.type === "reaction:toggle") {
    const rId = normalizeRoomId(String(msg.roomId || ""));
    const msgId = String(msg.msgId || "");
    const emoji = String(msg.emoji || "")
      .trim()
      .slice(0, 12);
    if (!rId || !msgId || !emoji) return;
    const room = await ensureRoomLoaded(rId);
    if (room.banned.has(ws.user.id)) return;
    const target = room.msgs.find((m: any) => m.id === msgId);
    if (!target || target.deletedAt) return;

    if (room.roomId !== "lobby") {
      try {
        const existing = await prisma.reaction.findUnique({
          where: {
            targetType_targetId_userId_emoji: {
              targetType: "ROOM_MESSAGE",
              targetId: msgId,
              userId: ws.user.id,
              emoji,
            },
          },
        });
        if (existing) {
          await prisma.reaction.delete({ where: { id: existing.id } });
        } else {
          const distinctCount = await prisma.reaction.groupBy({
            by: ["emoji"],
            where: { targetType: "ROOM_MESSAGE", targetId: msgId },
          });
          if (distinctCount.length >= 20 && !distinctCount.find((d: any) => d.emoji === emoji)) {
            send(ws, {
              type: "reaction:rejected",
              roomId: rId,
              msgId,
              reason: "Too many different reactions on this message.",
            });
            return;
          }
          await prisma.reaction.create({
            data: { targetType: "ROOM_MESSAGE", targetId: msgId, userId: ws.user.id, emoji },
          });
        }
        const rows = await prisma.reaction.findMany({
          where: { targetType: "ROOM_MESSAGE", targetId: msgId },
          select: { emoji: true, userId: true },
        });
        const agg: Record<string, { count: number; users: string[] }> = {};
        for (const r of rows) {
          if (!agg[r.emoji]) agg[r.emoji] = { count: 0, users: [] };
          agg[r.emoji].count++;
          if (agg[r.emoji].users.length < 12) agg[r.emoji].users.push(r.userId);
        }
        const reactions = Object.entries(agg).map(([e, v]) => ({
          emoji: e,
          count: v.count,
          users: v.users,
        }));
        target.reactions = reactions;
        broadcast(room, { type: "reaction:changed", roomId: rId, msgId, reactions });
      } catch (e) {
        log.error("[reaction:toggle]", e);
      }
    } else {
      target.reactions = target.reactions || [];
      const existing = target.reactions.find((r: any) => r.emoji === emoji);
      if (existing) {
        if (existing.users.includes(ws.user!.id)) {
          existing.users = existing.users.filter((u: any) => u !== ws.user!.id);
          existing.count = Math.max(0, existing.count - 1);
          if (existing.count === 0)
            target.reactions = target.reactions.filter((r: any) => r.emoji !== emoji);
        } else {
          existing.users.push(ws.user!.id);
          existing.count++;
        }
      } else {
        if (target.reactions.length >= 20) {
          send(ws, {
            type: "reaction:rejected",
            roomId: rId,
            msgId,
            reason: "Too many different reactions on this message.",
          });
          return;
        }
        target.reactions.push({ emoji, count: 1, users: [ws.user.id] });
      }
      broadcast(room, {
        type: "reaction:changed",
        roomId: rId,
        msgId,
        reactions: target.reactions,
      });
    }
    return;
  }
}
