// How long a lobby's words can be.
//
// The API refuses more (apps/api/src/lib/lobbyFields.ts LOBBY_LIMITS; a test
// there keeps these numbers in step), so the forms stop at the same place.
// They stop with maxLength, which leaves text that is already there alone.
// The boxes used to cut on every keystroke, to 200 or 500 characters, so
// touching a staff-written description of 1,800 shortened it (hardening pass
// 2026-11-13).
export const LOBBY_TEXT = { name: 100, description: 2000 } as const;
