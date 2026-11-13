import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
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
  // Four copies of this rule is how the builder came to be asked about as a
  // lobby: the provider knew the builder's address, and the two sidebars and
  // the theme did not. One of them also took a lobby's admin page for a lobby
  // called "<id>/admin".
  const sources = (): Array<[string, string]> => {
    const out: Array<[string, string]> = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) {
          if (e.name !== "node_modules" && e.name !== ".next") walk(p);
        } else if (/\.tsx?$/.test(e.name)) out.push([p, readFileSync(p, "utf8")]);
      }
    };
    for (const d of ["components", "app", "lib"]) walk(join(__dirname, "..", d));
    return out;
  };

  it("is this one helper, in the sidebars, the theme and the provider", () => {
    for (const file of [
      "RightRail.tsx",
      "RightRailSwitch.tsx",
      "SpaceTheme.tsx",
      "WeeredProvider.tsx",
    ])
      expect(readFileSync(join(__dirname, "../components", file), "utf8"), file).toContain(
        "lobbyInPath(pathname)",
      );
  });

  it("is nobody else: no file cuts a lobby out of the address by hand", () => {
    const byHand = [
      /\.replace\("\/lobby\/", ?""\)/, // pathname.replace("/lobby/", "")
      /\.slice\("\/lobby\/"\.length\)/, // pathname.slice("/lobby/".length)
      /startsWith\("\/lobby\/"\)[\s\S]{0,80}split\("\/"\)\[2\]/, // …split("/")[2]
    ];
    const found = sources()
      .filter(([p]) => !p.endsWith(join("lib", "lobbyPath.ts")))
      .filter(([, src]) => byHand.some((re) => re.test(src)))
      .map(([p]) => p.split(/[\\/]apps[\\/]web[\\/]/)[1]);
    expect(found).toEqual([]);
  });

  it("builds on a real page: /lobby/create is still the builder", () => {
    // If the builder ever moves, the list above has to move with it.
    expect(() => readFileSync(join(__dirname, "../app/lobby/create/page.tsx"))).not.toThrow();
  });
});
