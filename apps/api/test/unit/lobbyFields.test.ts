import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ModuleType } from "@prisma/client";
import {
  LOBBY_LIMITS,
  LOBBY_ROUTE_NAMES,
  isLobbyKind,
  lobbyAddressProblem,
  lobbyWordsProblem,
} from "../../src/lib/lobbyFields";

// One set of rules for a lobby's address and words, for the route that makes
// one and the routes that edit one (hardening pass 2026-11-13). Before it,
// POST /lobbies took any text of any length, and the edit routes cut a long
// description to 500 characters and answered "Saved."

describe("a new lobby's address", () => {
  it("takes what the builder and the phone app produce", () => {
    for (const ok of ["study-hall", "a1", "destiny2", "night--shift", "x".repeat(40)])
      expect(lobbyAddressProblem(ok), ok).toBeNull();
  });

  it("refuses anything else from a member", () => {
    for (const bad of [
      "",
      " ",
      "a",
      "x".repeat(41),
      "Has-Caps",
      "two words",
      "a/b",
      "-lead",
      "trail-",
      "a.b",
      "a?b",
      "a#b",
      "../etc",
      "dеstiny2", // a Cyrillic "e": a look-alike of a real lobby's address
      "café",
      "a‮b",
    ])
      expect(lobbyAddressProblem(bad)?.error, JSON.stringify(bad)).toBe("bad_address");
    for (const notText of [undefined, null, 7, {}, ["a"]])
      expect(lobbyAddressProblem(notText)?.error).toBe("bad_address");
  });

  it("keeps the app's own addresses from everyone, staff too", () => {
    for (const name of LOBBY_ROUTE_NAMES) {
      expect(lobbyAddressProblem(name)?.error, name).toBe("name_reserved");
      expect(lobbyAddressProblem(name, true)?.error, name).toBe("name_reserved");
      expect(lobbyAddressProblem(name.toUpperCase(), true)?.error).toBe("name_reserved");
      expect(lobbyAddressProblem(` ${name} `, true)?.error).toBe("name_reserved");
    }
    // The builder lives at /lobby/create: a lobby there could never be opened.
    expect(LOBBY_ROUTE_NAMES).toContain("create");
  });

  it("lets staff keep the seeded addresses that predate the rule", () => {
    for (const seeded of ["r/all", "r/gaming", "r/technology"])
      expect(lobbyAddressProblem(seeded, true)).toBeNull();
    expect(lobbyAddressProblem("x".repeat(65), true)?.error).toBe("bad_address");
  });

  it("answers a megabyte as fast as a word", () => {
    const huge = "a".repeat(1_000_000) + "!";
    const t = performance.now();
    expect(lobbyAddressProblem(huge)?.error).toBe("bad_address");
    expect(lobbyAddressProblem(huge, true)?.error).toBe("bad_address");
    expect(performance.now() - t).toBeLessThan(50);
  });
});

describe("a lobby's words", () => {
  it("takes text up to each limit", () => {
    expect(
      lobbyWordsProblem({
        name: "n".repeat(LOBBY_LIMITS.name),
        description: "d".repeat(LOBBY_LIMITS.description),
        keywords: Array.from({ length: LOBBY_LIMITS.keywords }, () =>
          "k".repeat(LOBBY_LIMITS.keyword),
        ),
        logoUrl: "https://x.test/" + "l".repeat(LOBBY_LIMITS.link - 15),
        bannerUrl: null,
        websiteUrl: "",
      }),
    ).toBeNull();
  });

  it("holds what real lobbies hold today", () => {
    // The longest staff-written description is 1,819 characters and one lobby
    // has 23 keywords. The old edit limits (500 and 20) were below both.
    expect(LOBBY_LIMITS.description).toBeGreaterThanOrEqual(1819);
    expect(LOBBY_LIMITS.keywords).toBeGreaterThanOrEqual(23);
    expect(LOBBY_LIMITS.name).toBeGreaterThanOrEqual(42);
  });

  it("refuses more, and says how much it was given", () => {
    const long = lobbyWordsProblem({ description: "d".repeat(2345) });
    expect(long?.error).toBe("bad_text");
    expect(long?.message).toContain("2,000");
    expect(long?.message).toContain("2,345");
    expect(lobbyWordsProblem({ name: "n".repeat(101) })?.error).toBe("bad_text");
    expect(lobbyWordsProblem({ websiteUrl: "https://x.test/" + "w".repeat(500) })?.error).toBe(
      "bad_text",
    );
    expect(lobbyWordsProblem({ keywords: new Array(31).fill("k") })?.error).toBe("bad_text");
    expect(lobbyWordsProblem({ keywords: ["k".repeat(41)] })?.error).toBe("bad_text");
  });

  it("refuses what isn't text", () => {
    expect(lobbyWordsProblem({ name: "   " })?.error).toBe("bad_text");
    expect(lobbyWordsProblem({ name: 7 })?.error).toBe("bad_text");
    expect(lobbyWordsProblem({ description: { toString: () => "x" } })?.error).toBe("bad_text");
    expect(lobbyWordsProblem({ keywords: "gaming" })?.error).toBe("bad_text");
    expect(lobbyWordsProblem({ keywords: [1, 2] })?.error).toBe("bad_text");
  });

  it("checks only what was sent, so an edit can send one field", () => {
    expect(lobbyWordsProblem({})).toBeNull();
    expect(lobbyWordsProblem({ name: null, description: undefined, keywords: null })).toBeNull();
    expect(lobbyWordsProblem({ description: "" })).toBeNull();
  });

  it("never walks a list it is going to refuse", () => {
    const flood = new Array(500_000).fill(1);
    const t = performance.now();
    expect(lobbyWordsProblem({ keywords: flood })?.error).toBe("bad_text");
    expect(performance.now() - t).toBeLessThan(20);
  });
});

describe("a lobby's kind", () => {
  it("is one of the kinds there are", () => {
    for (const kind of Object.values(ModuleType)) expect(isLobbyKind(kind)).toBe(true);
    for (const bad of ["", "none", "MADE_UP", 3, null, undefined, ["NONE"]])
      expect(isLobbyKind(bad)).toBe(false);
  });
});

describe("the web's copy of these rules", () => {
  const web = (file: string) =>
    readFileSync(join(__dirname, "../../../web/lib", file), "utf8").replaceAll(/\/\/.*$/gm, "");
  const listIn = (src: string, name: string) =>
    [
      ...(new RegExp(`${name}[^=]*=\\s*\\[([^\\]]*)\\]`).exec(src)?.[1] ?? "").matchAll(
        /"([^"]+)"/g,
      ),
    ]
      .map((m) => m[1])
      .sort();
  const numberIn = (src: string, key: string) =>
    Number(new RegExp(`\\b${key}:\\s*(\\d+)`).exec(src)?.[1] ?? Number.NaN);

  it("keeps the same addresses for the app", () => {
    // The sidebars and the provider decide what is a lobby from this list
    // (apps/web/lib/lobbyPath.ts). If the two drift, a lobby can be made that
    // the pages treat as one of their own.
    expect(listIn(web("lobbyPath.ts"), "LOBBY_ROUTE_NAMES")).toEqual([...LOBBY_ROUTE_NAMES].sort());
  });

  it("stops the forms where the API stops", () => {
    const src = web("lobbyLimits.ts");
    expect(numberIn(src, "name")).toBe(LOBBY_LIMITS.name);
    expect(numberIn(src, "description")).toBe(LOBBY_LIMITS.description);
  });
});
