import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { guestMayCall, hostMayCall } from "../../src/lib/guestAllow";

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

// A host pass (the office's advisor link) is fenced the same way: the office's
// own routes, and the ones that let it into a room and out (2026-11-13).
describe("what a host pass may call", () => {
  it("reaches the office and the room", () => {
    for (const p of [
      "/office/set",
      "/office/waiting",
      "/office/board",
      "/office/board/n_0a1b2c3d4e5f",
      "/office/plan/employers",
      "/office/plan/employer/abc",
      "/office/plan/present",
      "/office/plan/presented",
      "/office/status",
      "/auth/ws-ticket",
      "/auth/logout",
      "/voice/token",
    ])
      expect(hostMayCall(p), p).toBe(true);
  });

  it("is refused everywhere else", () => {
    for (const p of [
      "/profile/me",
      "/lobbies",
      "/lobbies/destiny2/admin/branding",
      "/chat/upload",
      "/forum/posts",
      "/staff/users",
      "/officex",
      "/office",
      "/auth/login",
      "/",
    ])
      expect(hostMayCall(p), p).toBe(false);
  });

  it("covers every address the office pages call", () => {
    // The office pages (apps/web/app/foyer) call the API as `${API}/...`. Each
    // of those is one a host pass may call, or the visitor's own sign-in.
    const foyer = join(__dirname, "..", "..", "..", "web", "app", "foyer");
    const called = new Set<string>();
    for (const name of readdirSync(foyer)) {
      if (!name.endsWith(".tsx")) continue;
      const text = readFileSync(join(foyer, name), "utf8");
      for (const m of text.matchAll(/\$\{API\}(\/[a-zA-Z/_-]+)/g)) called.add(m[1]);
    }
    expect(called.size).toBeGreaterThan(10);
    const VISITOR_SIGN_IN = "/auth/guest"; // called with no pass at all
    const shut = [...called].filter((p) => p !== VISITOR_SIGN_IN && !hostMayCall(p));
    expect(shut).toEqual([]);
  });
});
