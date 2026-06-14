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
  const { normalizeRoomId, ensureRoomLoaded, rooms, send, broadcast, isModOrOwner, checkUrlSpam, checkChatRateLimit, roleOf, awardNotoriety, resolveMentions, createNotification, getAI, buildOperatorSystemPrompt } = opts;

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
    broadcast(room, { type: "chat:pins", roomId: room.roomId, pinned: Array.from((room as any).pinned) });
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
    if (!urlCheck.ok) { send(ws, { type: "chat:rejected", roomId, reason: urlCheck.reason }); return; }
    const rate = checkChatRateLimit(ws.user.id);
    if (!rate.ok) { send(ws, { type: "chat:rejected", roomId, reason: rate.reason, retryInMs: rate.retryInMs }); return; }
    if (room.lobbyId) {
      const cache = (room as any).modPolicy as { blockedWords: string[]; blockedDomains: string[]; newAccountChatHours: number; expiresAt: number } | undefined;
      let policy = cache && cache.expiresAt > Date.now() ? cache : null;
      if (!policy) {
        try {
          const l: any = await (prisma as any).lobby.findUnique({
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
        } catch { policy = { blockedWords: [], blockedDomains: [], newAccountChatHours: 0, expiresAt: Date.now() + 60_000 }; }
      }
      if (policy.newAccountChatHours > 0) {
        try {
          const u = await prisma.user.findUnique({ where: { id: ws.user.id }, select: { createdAt: true } });
          if (u && (Date.now() - u.createdAt.getTime()) < policy.newAccountChatHours * 3600 * 1000) {
            send(ws, { type: "chat:rejected", roomId, reason: "account_too_new", message: `New accounts must wait ${policy.newAccountChatHours}h before chatting in this lobby.` });
            return;
          }
        } catch {}
      }
      if (policy.blockedWords.length > 0) {
        const lower = body.toLowerCase();
        const hit = policy.blockedWords.find(w => w && lower.includes(String(w).toLowerCase()));
        if (hit) {
          send(ws, { type: "chat:rejected", roomId, reason: "blocked_word" });
          return;
        }
      }
      if (policy.blockedDomains.length > 0) {
        const urls = body.match(/https?:\/\/[^\s)]+/gi) || [];
        const bad = urls.find(u => policy!.blockedDomains.some(d => d && u.toLowerCase().includes(String(d).toLowerCase())));
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
        const att: any = await (prisma as any).chatAttachment.findUnique({ where: { id: attachmentId } });
        if (att && att.uploaderId === ws.user.id && att.status === "ACTIVE"
            && Date.now() - new Date(att.createdAt).getTime() < 15 * 60_000) {
          attachment = { id: att.id, url: att.url, thumbUrl: att.thumbUrl, w: att.width, h: att.height, trusted: att.trusted, expiresAt: att.expiresAt ? new Date(att.expiresAt).toISOString() : null };
          if (!att.roomId) void (prisma as any).chatAttachment.update({ where: { id: att.id }, data: { roomId: room.roomId } }).catch(() => {});
        }
      } catch {}
      if (!attachment) { send(ws, { type: "chat:rejected", roomId, reason: "bad_attachment" }); return; }
    }
    const u = room.users.get(ws.user.id)!;
    const m: any = { id: randomUUID(), user: { id: u.id, name: u.name, role: roleOf(room, u.id), avatarColor: (u as any).avatarColor, avatar: (u as any).avatar }, body, ts: Date.now(), replyTo, attachment };
    room.msgs.push(m);
    if (room.msgs.length > 200) room.msgs.splice(0, room.msgs.length - 200);
    if (room.roomId !== "lobby") {
      void prisma.roomMessage.create({
        data: {
          id: m.id, roomId: room.roomId, userId: m.user.id, userName: m.user.name, body: m.body, ts: new Date(m.ts),
          replyToId: replyTo?.id ?? null,
          replyToUserId: replyTo?.userId ?? null,
          replyToUserName: replyTo?.userName ?? null,
          replyToBody: replyTo?.body ?? null,
        } as any,
      }).catch(() => {});
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
      const question = body.replace(/@operator/gi, "").replace(/^\/ask\s*/i, "").trim();
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
                  user: { id: "operator", name: "The Operator", role: "SYSTEM" as any, avatarColor: "#D4A017", avatar: "/brand/roles/operator.svg" },
                  body: reply,
                  ts: Date.now(),
                };
                room.msgs.push(botMsg);
                if (room.msgs.length > 200) room.msgs.splice(0, room.msgs.length - 200);
                broadcast(room, { type: "chat:new", roomId, msg: botMsg });
              }
            } catch (e) { console.error("[operator]", e); }
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
      void prisma.roomMessage.update({
        where: { id: msgId },
        data: { body: newBody, editedAt: new Date(editedAt) },
      }).catch(() => {});
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
      void prisma.roomMessage.update({
        where: { id: msgId },
        data: { body: "", deletedAt: new Date(deletedAt) },
      }).catch(() => {});
    }
    broadcast(room, { type: "chat:deleted", roomId: rId, msgId, deletedAt });
    return;
  }
}
