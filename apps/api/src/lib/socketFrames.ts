// What a frame on the chat socket may carry (fan-out audit, 2026-11-13).

/** The fields that name a person, message, room or thing. */
export const ID_FIELDS = [
  "userId",
  "targetId",
  "msgId",
  "messageId",
  "toId",
  "fromId",
  "peerId",
  "crewId",
  "tableId",
  "replyToId",
  "attachmentId",
  "blockId",
  "roomId",
  "lobbyId",
] as const;

/** Longer than any id or room address the site makes. */
export const ID_MAX = 128;

/**
 * True when every id-like field in the frame is a short string or a number.
 * A frame that names someone with a quarter of a megabyte (each one written to
 * the room's audit log and kept in its lists) is dropped before any handler.
 */
export function idsAreShort(msg: Record<string, unknown>): boolean {
  for (const k of ID_FIELDS) {
    const v = msg[k];
    if (v == null) continue;
    if (typeof v === "number") continue;
    if (typeof v !== "string" || v.length > ID_MAX) return false;
  }
  return true;
}

/** How many people one room's mute, ban, moderator or speaker list may hold. */
export const ROOM_LIST_MAX = 500;

/** Room for one more in a room's list (already listed always counts). */
export function roomForOneMore(list: Set<string> | undefined, id: string): boolean {
  if (!list) return true;
  return list.has(id) || list.size < ROOM_LIST_MAX;
}

/**
 * The frame as the socket parser hands it on: a client may wrap its fields in
 * `payload`. The wrapper is opened once and then dropped, and `type` is always
 * the outer one: a frame used to be able to carry a second payload inside the
 * first, which a relay passed on whole and every other browser opened as a
 * frame of any type it liked (a forged chat line, a forged ban).
 */
export function openFrame(o: any): any {
  if (!o || typeof o !== "object" || Array.isArray(o)) return o;
  if (!o.payload || typeof o.payload !== "object" || Array.isArray(o.payload)) {
    if ("payload" in o) {
      const { payload: _drop, ...rest } = o;
      return rest;
    }
    return o;
  }
  const { payload, ...outer } = o;
  const { payload: _inner, type: _t, ...inner } = payload;
  return { ...outer, ...inner, type: o.type };
}
