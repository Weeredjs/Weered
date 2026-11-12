import { describe, it, expect } from "vitest";
import { guestMayCall } from "../../src/lib/guestAllow";

// Guest deny-by-default (index.ts). The office board joined the list on
// 2026-11-12, after an end-to-end run on prod found visitors stopped at
// guest_forbidden with an empty board.
describe("what a guest token may call", () => {
  it("reaches the meeting's own routes and the office board", () => {
    for (const p of ["/auth/ws-ticket", "/voice/token", "/office/plan/presented", "/office/board"])
      expect(guestMayCall("GET", p, false)).toBe(true);
    expect(guestMayCall("POST", "/office/board", false)).toBe(true);
    expect(guestMayCall("DELETE", "/office/board/n_0a1b2c3d4e5f", false)).toBe(true);
  });

  it("is refused everywhere else", () => {
    for (const [m, p] of [
      ["GET", "/office/waiting"],
      ["POST", "/office/set"],
      ["GET", "/office/plan/employers"],
      ["GET", "/office/board/n_abc"],
      ["DELETE", "/office/board/../set"],
      ["DELETE", "/office/board/"],
      ["GET", "/profile/me"],
    ] as const)
      expect(guestMayCall(m, p, false)).toBe(false);
  });

  it("lets a lobby's guest read that lobby (GET), as before", () => {
    expect(guestMayCall("GET", "/lobbies/destiny2", true)).toBe(true);
  });
});
