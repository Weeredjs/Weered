import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AccessToken } from "livekit-server-sdk";

// LiveKit voice token minting (extracted from index.ts). The LIVEKIT_* config
// and the AccessToken SDK are voice-exclusive and live here. Room state + the
// room helpers are shared and injected; `rooms` MUST be the same live Map
// reference the WS voice handlers mutate, or publish permissions desync.
const LIVEKIT_URL = process.env.LIVEKIT_URL || process.env.LIVEKIT_WS_URL || "ws://127.0.0.1:7880";
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || "";

type Opts = {
  authFromHeader: (h?: string) => { id: string; name: string; globalRole?: string } | null;
  rooms: Map<string, any>;
  ensureRoomLoaded: (roomId: string) => Promise<any>;
  normalizeRoomId: (input: string) => string;
  isModOrOwner: (room: any, userId?: string, globalRole?: string) => boolean;
  awardNotoriety: (userId: string, action: string) => Promise<number | null>;
};

export default async function voiceRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, rooms, ensureRoomLoaded, normalizeRoomId, isModOrOwner, awardNotoriety } = opts;

  app.post("/voice/token", {
  schema: { tags: ["voice"] },
}, async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) return reply.code(500).send({ ok: false, error: "livekit_not_configured" });
    const body: any = (req as any).body || {};
    const roomIdRaw = String(body.roomId || body.room || "").trim().slice(0, 64);
    if (!roomIdRaw) return reply.code(400).send({ ok: false, error: "missing_roomId" });

    const cleaned = roomIdRaw.startsWith("room:") ? roomIdRaw.slice(5) : roomIdRaw;
    const lookup = normalizeRoomId(cleaned);
    let canPublish = true;
    try {
      const room = lookup ? rooms.get(lookup) || (await ensureRoomLoaded(lookup).catch(() => null)) : null;
      if (room) {
        const isOwnerOrMod = isModOrOwner(room, u.id, (u as any).globalRole);
        const mode = room.voiceMode || "OPEN";
        if (mode === "OPEN") {
          canPublish = true;
        } else if (mode === "LISTEN_ONLY") {
          canPublish = isOwnerOrMod;
        } else {
          canPublish = isOwnerOrMod || (room.voiceSpeakers ? room.voiceSpeakers.has(u.id) : false);
        }
      }
    } catch {}

    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity: u.id, name: u.name });
    at.addGrant({ roomJoin: true, room: roomIdRaw, canPublish, canSubscribe: true, canPublishData: true });
    const token = await at.toJwt();
    awardNotoriety(u.id, "VOICE_JOINED").catch(() => {});
    return reply.send({ ok: true, url: LIVEKIT_URL, token, canPublish });
  });
}
