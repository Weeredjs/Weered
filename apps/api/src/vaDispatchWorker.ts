import { randomUUID } from "crypto";
import { prisma } from "./lib/prisma";
import { log, swallow } from "./lib/logger";
import { vaConfigOf, vaSnapshot } from "./lib/va/source";
import type { VaPirep, VaSnapshot } from "./lib/va/types";

/**
 * Dispatch: the virtual airline's voice in its Dispatch room.
 *
 * The Division 2 "Operator" is an AI brief broadcast live and never stored.
 * This is the opposite on purpose: templated (no model call, no cost), and
 * posted through the same path a member's message takes (in-memory room list,
 * RoomMessage row, chat:new broadcast), so it persists and anyone opening the
 * room later reads the history.
 *
 * It says two things: a PIREP was filed (with a verdict on the landing), and a
 * member booked a group-flight slot. The first pass after a restart only
 * records what is already there, so a deploy never re-announces old flights.
 *
 * Enabled per lobby by moduleConfig.va.dispatch = { roomId, userId }.
 */

type Deps = {
  ensureRoomLoaded: (roomId: string) => Promise<any>;
  broadcastToRoom: (roomId: string, event: any) => void;
};

type LobbyState = { primed: boolean; seen: Set<string>; lastClaimAt: number };
const STATE = new Map<string, LobbyState>();
const MAX_PER_TICK = 3; // a burst of landings reads as a feed, not a flood
const FRESH_MS = 15 * 60_000; // never narrate a report older than this

function hhmm(min: number): string {
  return `${Math.floor(min / 60)}:${String(Math.round(min % 60)).padStart(2, "0")}`;
}

/** The line for a filed PIREP. Exported for tests. */
export function landingLine(p: VaPirep, city: string): string {
  const first = (p.pilotName || "").split(" ")[0] || "crew";
  const fpm = p.landingRateFpm;
  const head = `${p.callsign} on blocks at ${city} (${p.arr}) after ${hhmm(p.blockMinutes)}.`;
  if (p.status === "AWAITING_REVIEW" || fpm < -400)
    return `${head} ${fpm} fpm. The report is with staff for review.`;
  if (fpm >= -120) return `${head} ${fpm} fpm. Butter, ${first}.`;
  if (fpm >= -250) return `${head} ${fpm} fpm, nicely done.`;
  return `${head} ${fpm} fpm, a positive one.`;
}

/** The line for a member booking a slot. Exported for tests. */
export function bookingLine(
  snap: VaSnapshot,
  flightKey: string,
  slotKey: string,
  who: string,
  booked: number,
): string | null {
  const gf = snap.groupFlights.find((f) => f.key === flightKey);
  const wave = gf?.waves.find((w) => w.slots.some((s) => s.key === slotKey));
  const slot = wave?.slots.find((s) => s.key === slotKey);
  if (!gf || !wave || !slot) return null;
  const city = snap.airports.find((a) => a.iata === slot.arr)?.city || slot.arr;
  const total = gf.waves.reduce((n, w) => n + w.slots.length, 0);
  return `${slot.callsign} ${slot.dep} to ${city}, gate ${slot.gate} in the ${wave.name} wave, just went to ${who}. ${booked} of ${total} slots booked for the bank.`;
}

async function post(deps: Deps, roomId: string, user: { id: string; name: string }, body: string) {
  const room = await deps.ensureRoomLoaded(roomId);
  const m = {
    id: randomUUID(),
    user: {
      id: user.id,
      name: user.name,
      role: "member",
      avatarColor: "#FFCD00",
      avatar: "/brand/vocn/mark.png",
    },
    body,
    ts: Date.now(),
  };
  if (Array.isArray(room?.msgs)) {
    room.msgs.push(m);
    if (room.msgs.length > 200) room.msgs.splice(0, room.msgs.length - 200);
  }
  await prisma.roomMessage.create({
    data: { id: m.id, roomId, userId: user.id, userName: user.name, body, ts: new Date(m.ts) },
  });
  deps.broadcastToRoom(roomId, { type: "chat:new", roomId, msg: m });
}

export async function runVaDispatchWorker(deps: Deps): Promise<void> {
  let lobbies: { id: string; moduleConfig: unknown }[] = [];
  try {
    lobbies = await prisma.lobby.findMany({
      where: { moduleType: "VIRTUAL_AIRLINE" as any },
      select: { id: true, moduleConfig: true },
    });
  } catch (e) {
    swallow(e);
    return;
  }
  for (const lobby of lobbies) {
    try {
      const cfg = vaConfigOf(lobby.moduleConfig);
      const d = (lobby.moduleConfig as any)?.va?.dispatch;
      if (!cfg || !d?.roomId || !d?.userId) continue;
      const user = await prisma.user.findUnique({
        where: { id: String(d.userId) },
        select: { id: true, name: true },
      });
      if (!user) continue;
      const snap = await vaSnapshot(lobby.id, cfg);
      const now = Date.now();
      let st = STATE.get(lobby.id);
      if (!st) {
        st = { primed: false, seen: new Set(), lastClaimAt: now };
        STATE.set(lobby.id, st);
      }

      // Landings.
      const fresh = snap.pireps.filter(
        (p) => !st!.seen.has(p.id) && now - Date.parse(p.filedAt) < FRESH_MS,
      );
      for (const p of snap.pireps.slice(0, 400)) st.seen.add(p.id);
      if (st.seen.size > 5000) st.seen = new Set(snap.pireps.slice(0, 400).map((p) => p.id));

      // Bookings by members since the last pass.
      const claims = await prisma.vaSlotClaim.findMany({
        where: { lobbyId: lobby.id, claimedAt: { gt: new Date(st.lastClaimAt) } },
        orderBy: { claimedAt: "asc" },
      });
      // Advance only past claims actually seen. Jumping to "now" on an empty pass
      // would skip a booking written between the query and that moment.
      if (claims.length) st.lastClaimAt = claims[claims.length - 1].claimedAt.getTime();

      if (!st.primed) {
        st.primed = true; // first pass after boot: record, do not narrate
        continue;
      }

      const lines: string[] = [];
      for (const p of fresh
        .filter((p) => p.status !== "PROCESSING")
        .sort((a, b) => Date.parse(a.filedAt) - Date.parse(b.filedAt))) {
        const city = snap.airports.find((a) => a.iata === p.arr)?.city || p.arr;
        lines.push(landingLine(p, city));
      }
      if (claims.length) {
        const gfKey = claims[0].flightKey;
        const gf = snap.groupFlights.find((f) => f.key === gfKey);
        const preset = gf
          ? gf.waves.flatMap((w) => w.slots).filter((s) => s.presetPilotId).length
          : 0;
        const members = await prisma.vaSlotClaim.count({
          where: { lobbyId: lobby.id, flightKey: gfKey },
        });
        for (const c of claims) {
          const line = bookingLine(
            snap,
            c.flightKey,
            c.slotKey,
            c.userName || "a crew member",
            preset + members,
          );
          if (line) lines.push(line);
        }
      }
      for (const line of lines.slice(-MAX_PER_TICK)) await post(deps, String(d.roomId), user, line);
    } catch (e) {
      log.warn("[va-dispatch]", lobby.id, e);
    }
  }
}
