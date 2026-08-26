/**
 * The modules a room may persist — as its default module, or in its disabled
 * list.
 *
 * This list previously existed as two identical inline copies in routes/rooms.ts
 * and had drifted badly: every game module added after dnd (windrose,
 * helldivers, hll, chess, gta, eve) was missing from BOTH, so those modules
 * rendered fine in the client but were silently discarded on save. The failure
 * is quiet — an unrecognised value becomes null rather than an error — which is
 * exactly why it went unnoticed. One exported constant, so the next module added
 * to the client has a single place to be registered.
 *
 * Kept in sync with ALL_MODULES in apps/web/components/room/RoomCanvas.tsx.
 * "office" is deliberately absent: it is staff-gated in meeting rooms and
 * carries its own access rules rather than being a freely settable room module.
 */
export const VALID_ROOM_MODULES = [
  "voice",
  "video",
  "screen",
  "youtube",
  "twitch",
  "browser",
  "article",
  "poker",
  "fakeout",
  "destiny",
  "league",
  "fortnite",
  "pubg",
  "hq",
  "cs2",
  "dota2",
  "study",
  "dnd",
  "windrose",
  "helldivers",
  "hll",
  "chess",
  "gta",
  "eve",
  "assetto",
] as const;

export function isValidRoomModule(m: string): boolean {
  return (VALID_ROOM_MODULES as readonly string[]).includes(m);
}
