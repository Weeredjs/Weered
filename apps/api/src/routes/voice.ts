import { swallow } from "../lib/logger";
import type { FastifyInstance } from "fastify";
import { AccessToken } from "livekit-server-sdk";
import { prisma } from "../lib/prisma";
import { canEnterGatedRoom } from "../lib/lobbyAccess";
import { isPlaceId } from "./places";
import { isOfficeRoom } from "../lib/officeRooms";
import { guestMayEnter } from "../lib/guestScope";
import { streamQuality } from "../lib/tiers";
import { isStaffRole } from "../lib/lobbyAuth";

// LiveKit voice token minting (extracted from index.ts). The LIVEKIT_* config
// and the AccessToken SDK are voice-exclusive and live here. Room state + the
// room helpers are shared and injected; `rooms` MUST be the same live Map
// reference the WS voice handlers mutate, or publish permissions desync.
//
// The settings are read when a token is signed, never when this file loads.
// Every file loads before index.ts reads apps/api/.env, so a setting read at
// load time comes from the process's starting environment instead, and the
// process manager hands the API a saved copy of some settings (these three
// among them). While the copies agree nothing shows; change the key in .env
// and a load-time reader keeps signing with the old one (2026-11-13).
export function livekitSettings() {
  return {
    url: process.env.LIVEKIT_URL || process.env.LIVEKIT_WS_URL || "ws://127.0.0.1:7880",
    key: process.env.LIVEKIT_API_KEY || "",
    secret: process.env.LIVEKIT_API_SECRET || "",
  };
}

type Opts = {
  authFromHeader: (h?: string) => { id: string; name: string; globalRole?: string } | null;
  rooms: Map<string, any>;
  /** Loads a room that exists; never creates one. */
  loadExistingRoom: (roomId: string) => Promise<any | null>;
  normalizeRoomId: (input: string) => string;
  isModOrOwner: (room: any, userId?: string, globalRole?: string) => boolean;
  awardNotoriety: (userId: string, action: string) => Promise<number | null>;
  // GOD-or-allowlist: office staff get voice in the mtg-* meeting namespace
  isOfficeStaff: (userId?: string) => Promise<boolean>;
};

export default async function voiceRoutes(app: FastifyInstance, opts: Opts) {
  const {
    authFromHeader,
    loadExistingRoom,
    normalizeRoomId,
    isModOrOwner,
    awardNotoriety,
    isOfficeStaff,
  } = opts;

  app.post(
    "/voice/token",
    {
      schema: { tags: ["voice"] },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
      const lk = livekitSettings();
      if (!lk.key || !lk.secret)
        return reply.code(500).send({ ok: false, error: "livekit_not_configured" });
      const body: any = (req as any).body || {};
      const roomIdRaw = String(body.roomId || body.room || "")
        .trim()
        .slice(0, 64);
      if (!roomIdRaw) return reply.code(400).send({ ok: false, error: "missing_roomId" });

      const cleaned = roomIdRaw.startsWith("room:") ? roomIdRaw.slice(5) : roomIdRaw;
      const lookup = normalizeRoomId(cleaned);
      {
        const _u = u as any;
        if (_u.guest || _u.host) {
          if (!(await guestMayEnter(_u, lookup)))
            return reply.code(403).send({ ok: false, error: "out_of_scope" });
        } else if (isOfficeRoom(lookup)) {
          // office staff (GOD / allowlist) get voice in the meeting namespace
          if (!(await isOfficeStaff(_u.id))) {
            return reply.code(403).send({ ok: false, error: "private_meeting" });
          }
        }
      }
      // Lobby-level gate (Room.minLevel). Without this a staff room's socket was
      // guarded but its voice was not: anyone holding the id could mint a token
      // and listen in. Read from the DB rather than the in-memory room so it is
      // current, and fail CLOSED — an unreadable gate is a refused token.
      {
        let gate: { minLevel: number; lobbyId: string | null } | null;
        try {
          gate = await prisma.room.findUnique({
            where: { id: lookup },
            select: { minLevel: true, lobbyId: true },
          });
        } catch (e) {
          swallow(e);
          return reply.code(503).send({ ok: false, error: "gate_unavailable" });
        }
        // Members' places are text only: talking happens in lobbies
        // (routes/places.ts, James 2026-10-31).
        if (
          isPlaceId(lookup) ||
          isPlaceId(gate?.lobbyId) ||
          (lookup.startsWith("lobby:") && isPlaceId(lookup.slice("lobby:".length)))
        )
          return reply.code(403).send({ ok: false, error: "text_only" });
        if (
          gate &&
          gate.minLevel > 0 &&
          !(await canEnterGatedRoom(u as any, gate.lobbyId, gate.minLevel))
        ) {
          return reply
            .code(403)
            .send({ ok: false, error: "level_required", minLevel: gate.minLevel });
        }
      }
      // Admission (audit 2026-09-27). Joining a room enforces its password, its
      // lock/knock and its bans; voice enforced none of them, so a token for the
      // locked ECEB consult room let an unadmitted guest hear (and publish into)
      // a live consult. A room that admits people one at a time now requires the
      // caller to be in it, which means doJoin already let them in. Open rooms
      // are unchanged. The room is never created here: no token for made-up ids.
      const room = await loadExistingRoom(lookup).catch(() => null);
      if (!room) return reply.code(404).send({ ok: false, error: "room_not_found" });
      if (room.banned?.has(u.id)) return reply.code(403).send({ ok: false, error: "banned" });
      // Session tokens carry no role, so read it: staff are mods everywhere, and
      // their voice must not depend on the join landing first (and staff could
      // not speak in LISTEN_ONLY rooms before this, for the same reason).
      const globalRole = (u as any).guest
        ? null
        : await prisma.user
            .findUnique({ where: { id: u.id }, select: { globalRole: true } })
            .then((r) => r?.globalRole ?? null)
            .catch(() => null);
      // A lobby ban and a running kick hold for voice as they do at the room's
      // door (index.ts doJoin, same staff exemptions): a banned or just-kicked
      // person used to get a fresh token and be back in the call, able to speak
      // (red team 2026-11-01, finding 8).
      {
        const g = String(globalRole || "").toUpperCase();
        if (!(u as any).guest && !["STAFF", "ADMIN", "GOD"].includes(g)) {
          const ban = await prisma.lobbyBan
            .findUnique({
              where: { lobbyId_userId: { lobbyId: room.lobbyId || room.roomId, userId: u.id } },
              select: { id: true },
            })
            .catch(() => null);
          if (ban) return reply.code(403).send({ ok: false, error: "lobby_banned" });
        }
        const until = room.kickedUntil?.get(u.id);
        if (until && until > Date.now() && !["GOD", "STAFF", "SUPPORT", "ADMIN"].includes(g))
          return reply.code(403).send({ ok: false, error: "kicked" });
      }
      const isOwnerOrMod = isModOrOwner(room, u.id, globalRole ?? undefined);
      if ((room.locked || room.passwordHash) && !isOwnerOrMod && !room.users?.has(u.id)) {
        return reply.code(403).send({ ok: false, error: "not_admitted" });
      }
      // The office's rooms: only someone seated in the room gets its call,
      // door open or not. With the door open, a visitor could take a pass
      // without ever walking in, so the door never closed behind them.
      if (isOfficeRoom(lookup) && !isOwnerOrMod && !room.users?.has(u.id)) {
        return reply.code(403).send({ ok: false, error: "not_admitted" });
      }

      let canPublish = true;
      try {
        const mode = room.voiceMode || "OPEN";
        if (mode === "OPEN") {
          canPublish = true;
        } else if (mode === "LISTEN_ONLY") {
          canPublish = isOwnerOrMod;
        } else {
          canPublish = isOwnerOrMod || (room.voiceSpeakers ? room.voiceSpeakers.has(u.id) : false);
        }
      } catch (e) {
        swallow(e);
      }

      // Ten minutes to connect. A pass is checked only when someone connects,
      // and the SDK's default life is six hours: a visitor who kept one could
      // rejoin a call long after leaving it, or after a kick or a ban. The
      // voice server renews the pass of someone already in a call itself, so a
      // call in progress is unaffected (fan-out audit, 2026-11-13).
      const at = new AccessToken(lk.key, lk.secret, {
        identity: u.id,
        name: u.name,
        ttl: "10m",
      });
      at.addGrant({
        roomJoin: true,
        room: lookup,
        canPublish,
        canSubscribe: true,
        canPublishData: true,
      });
      const token = await at.toJwt();
      if (!(u as any).guest) awardNotoriety(u.id, "VOICE_JOINED").catch(swallow);
      // Cams and screen share at the quality the lobby owner's plan pays for
      // (lib/tiers.ts streamQuality); the app sets its capture to match.
      const owner = await prisma.lobby
        .findUnique({
          where: { id: room.lobbyId || room.roomId },
          select: { ownerId: true },
        })
        .then((l) =>
          l?.ownerId
            ? prisma.user.findUnique({
                where: { id: l.ownerId },
                select: { tier: true, globalRole: true },
              })
            : null,
        )
        .catch(() => null);
      const quality = streamQuality(owner?.tier, isStaffRole(owner?.globalRole));
      return reply.send({ ok: true, url: lk.url, token, canPublish, quality });
    },
  );
}
