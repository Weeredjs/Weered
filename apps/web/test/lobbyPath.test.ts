import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LOBBY_ROUTE_NAMES, isKeptAddress, lobbyInPath } from "../lib/lobbyPath";

// Which lobby a page address is inside (hardening pass 2026-11-13). The
// sidebars read it out of the address on their own and took the builder's
// address, /lobby/create, for a lobby called "create": every visit to the
// builder asked the API about it and was told there isn't one.
describe("the lobby a page address names", () => {
  it("is the first segment under /lobby/", () => {
    expect(lobbyInPath("/lobby/study-hall")).toBe("study-hall");
    expect(lobbyInPath("/lobby/vocn/admin")).toBe("vocn");
    expect(lobbyInPath("/lobby/lobby")).toBe("lobby");
    expect(lobbyInPath("/lobby/r%2Fgaming")).toBe("r/gaming");
    expect(lobbyInPath("/lobby/u-abc123")).toBe("u-abc123");
  });

  it("is empty for /lobby itself, the main lobby's page", () => {
    expect(lobbyInPath("/lobby")).toBe("");
    expect(lobbyInPath("/lobby/")).toBe("");
  });

  it("is nothing at the builder, which is the app's own page", () => {
    expect(lobbyInPath("/lobby/create")).toBeNull();
    expect(lobbyInPath("/lobby/create/")).toBeNull();
    for (const name of LOBBY_ROUTE_NAMES) expect(lobbyInPath(`/lobby/${name}`)).toBeNull();
  });

  it("is nothing on any other page", () => {
    for (const path of [
      "/",
      "/home",
      "/room/abc",
      "/lobbyists",
      "/lobbies/x",
      "/about/lobby/x",
      "",
    ])
      expect(lobbyInPath(path), path).toBeNull();
    expect(lobbyInPath(null)).toBeNull();
    expect(lobbyInPath(undefined)).toBeNull();
  });

  it("never throws on a broken escape", () => {
    // decodeURIComponent throws on this, and the sidebars call it while drawing.
    expect(lobbyInPath("/lobby/%E0%A4%A")).toBe("%E0%A4%A");
  });
});

describe("an address the builder can't have", () => {
  it("is one of the app's own, or a member's place", () => {
    expect(isKeptAddress("create")).toBe(true);
    expect(isKeptAddress("settings")).toBe(true);
    expect(isKeptAddress("u-anything")).toBe(true);
    expect(isKeptAddress("creative")).toBe(false);
    expect(isKeptAddress("study-hall")).toBe(false);
  });
});

describe("who reads the lobby out of the address", () => {
  // Two copies of this rule is how the builder came to be asked about as a
  // lobby: the provider knew the builder's address and the sidebars didn't.
  it("is this one helper, in the sidebars and the provider", () => {
    for (const file of ["RightRail.tsx", "WeeredProvider.tsx"]) {
      const src = readFileSync(join(__dirname, "../components", file), "utf8");
      expect(src, file).toContain("lobbyInPath(pathname)");
      expect(src, file).not.toMatch(/pathname\.replace\("\/lobby\/", ""\)/);
    }
  });

  it("builds on a real page: /lobby/create is still the builder", () => {
    // If the builder ever moves, the list above has to move with it.
    expect(() => readFileSync(join(__dirname, "../app/lobby/create/page.tsx"))).not.toThrow();
  });
});
