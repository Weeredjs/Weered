import { describe, expect, it } from "vitest";
import {
  CORE_IDS,
  CORE_META,
  LEGACY_HOME,
  SHELL_PRESETS,
  findItem,
  hideItem,
  isCore,
  keyOf,
  newShellBlock,
  nudgeItem,
  placeItem,
  presetLayout,
  railFromShell,
  SHELL_MAX_BLOCKS,
  isSitePath,
  sanitizeShell,
  sanitizeShellBlock,
  shellFromPrefs,
  stockShell,
  type ShellLayout,
} from "../lib/shellLayout";
import { customPalette, paletteColours } from "../lib/uiPrefs";
import { cleanSymbol, sanitizeLayout } from "../lib/lobbyLayout";

/** Every built-in section is in exactly one region or switched off, and
 *  each sits somewhere it's allowed. */
function expectWhole(l: ShellLayout) {
  const seen: string[] = [];
  for (const region of ["left", "right", "home"] as const) {
    for (const it of l[region]) {
      if (!isCore(it)) continue;
      expect(CORE_META[it].regions).toContain(region);
      seen.push(it);
    }
  }
  seen.push(...l.hidden);
  expect([...seen].sort()).toEqual([...CORE_IDS].sort());
  expect(l.left).toContain("nav");
}

describe("the viewer's own layout", () => {
  it("starts from a stock layout with every section once", () => {
    expectWhole(stockShell());
  });

  it("cleans a stored layout: wrong regions, repeats and unknowns go", () => {
    const l = sanitizeShell({
      left: ["card", "ticker", "friends", "friends", "bogus", { type: "game", id: "x" }],
      right: ["favs", "rooms"],
      home: ["pulse"],
      hidden: ["nav", "presence"],
    })!;
    // favs can't sit on the right, so it goes back to its stock place (after
    // nav, presence being off) with recent after it; nav can't be switched off.
    expect(l.left).toEqual(["card", "nav", "favs", "recent", "friends"]);
    // The panel sections it didn't list come back in their stock order.
    expect(l.right).toEqual(["whoshere", "rooms", "crew", "discover"]);
    expect(l.hidden).toContain("presence");
    expect(l.hidden).not.toContain("nav");
    expectWhole(l);
  });

  it("puts a section it has never heard of back in its stock place", () => {
    // A layout saved before "recent" existed: it comes back after favs.
    const l = sanitizeShell({
      left: ["card", "nav", "presence", "favs"],
      right: [],
      home: [],
      hidden: [],
    })!;
    expect(l.left).toEqual(["card", "nav", "presence", "favs", "recent"]);
    expectWhole(l);
  });

  it("keeps block ids unique and block settings clean", () => {
    const l = sanitizeShell({
      left: [
        { id: "b1", type: "links", props: { items: [{ label: "x", url: "javascript:alert(1)" }] } },
        { id: "b1", type: "welcome", props: { href: "//evil.example", cta: "Go" } },
        { id: "b3", type: "rooms", props: { lobbyId: "../../etc" } },
      ],
    })!;
    const blocks = l.left.filter((x) => !isCore(x)) as any[];
    expect(new Set(blocks.map((b) => b.id)).size).toBe(3);
    expect(blocks[0].props.items).toEqual([{ label: "x", url: "" }]);
    expect(blocks[1].props.href).toBe("");
    expect(blocks[2].props.lobbyId).toBe("");
  });

  it("carries the first setup's sidebar order over", () => {
    const l = shellFromPrefs({
      rail: { order: ["favs", "card", "nav"], hidden: ["presence", "nav"] },
    });
    expect(l.left).toEqual(["favs", "card", "nav", "recent"]);
    expect(l.hidden).toEqual([...stockShell().hidden, "presence"]);
    expectWhole(l);
    expect(railFromShell(l)).toEqual({
      order: ["favs", "card", "nav", "recent", "presence"],
      hidden: ["presence"],
    });
  });

  it("moves friends into the left sidebar and back", () => {
    let l = placeItem(stockShell(), "friends", "left", 2);
    expect(l.left.slice(0, 3)).toEqual(["card", "nav", "friends"]);
    expect(l.right).not.toContain("friends");
    l = placeItem(l, "friends", "right", 0);
    expect(l.right[0]).toBe("friends");
    expectWhole(l);
  });

  it("refuses to move a section where it can't live", () => {
    const s = stockShell();
    expect(placeItem(s, "favs", "right", 0)).toBe(s);
    expect(placeItem(s, "pulse", "left", 0)).toBe(s);
    expect(placeItem(s, "friends", "home", 0)).toBe(s);
  });

  it("counts a move within a region from where the item was", () => {
    // card, nav, presence, favs, recent: drop "card" before "favs" (index 3).
    const l = placeItem(stockShell(), "card", "left", 3);
    expect(l.left).toEqual(["nav", "presence", "card", "favs", "recent"]);
    expect(nudgeItem(l, "card", 1).left).toEqual(["nav", "presence", "favs", "card", "recent"]);
  });

  it("switches sections off, deletes blocks, and never drops a locked one", () => {
    const b = newShellBlock("countdown");
    let l = placeItem(stockShell(), b, "home", 0);
    l = hideItem(l, "presence");
    expect(l.hidden).toContain("presence");
    l = hideItem(l, b.id);
    expect(findItem(l, b.id)).toBeNull();
    expect(hideItem(l, "nav")).toBe(l);
    // Bringing a switched-off section back takes it out of hidden.
    l = placeItem(l, "presence", "left", 0);
    expect(l.hidden).not.toContain("presence");
    expectWhole(l);
  });

  it("builds every preset into a whole layout", () => {
    for (const p of SHELL_PRESETS) {
      const l = presetLayout(p.id)!;
      expect(l.preset).toBe(p.id);
      expectWhole(l);
    }
    // Presets with blocks get fresh ids each time.
    const a = presetLayout("streamer")!;
    const b = presetLayout("streamer")!;
    const ids = (l: ShellLayout) => [...l.left, ...l.right].filter((x) => !isCore(x)).map(keyOf);
    expect(ids(a)).not.toEqual(ids(b));
  });

  it("an edit forgets which preset the layout came from", () => {
    const l = presetLayout("focus")!;
    expect(placeItem(l, "crew", "left", 0).preset).toBeUndefined();
  });
});

describe("what a layout may hold", () => {
  it("takes only real Weered paths for a Banner button", () => {
    expect(isSitePath("/lobby/timbos?view=events")).toBe(true);
    expect(isSitePath("/forum")).toBe(true);
    for (const bad of ["//evil.example", "/\\evil.example", "/x y", "javascript:alert(1)", "lobby"])
      expect(isSitePath(bad)).toBe(false);
    const b = sanitizeShellBlock({ id: "b1", type: "welcome", props: { href: "/\\evil.example" } });
    expect(b?.props.href).toBe("");
  });

  it("keeps every block on a long Home (the block total is the limit)", () => {
    const blocks = Array.from({ length: 14 }, (_, i) => ({
      id: `h${i}`,
      type: "countdown",
      props: {},
    }));
    const l = sanitizeShell({ ...stockShell(), home: [...stockShell().home, ...blocks] })!;
    expect(l.home.filter((x) => !isCore(x))).toHaveLength(14);
  });

  it("stops at the block total", () => {
    const blocks = Array.from({ length: 35 }, (_, i) => ({
      id: `k${i}`,
      type: "links",
      props: {},
    }));
    const l = sanitizeShell({ left: blocks })!;
    expect(l.left.filter((x) => !isCore(x))).toHaveLength(SHELL_MAX_BLOCKS);
  });
});

describe("effects", () => {
  it("keeps a floating symbol to three characters as people see them", () => {
    expect(cleanSymbol("🔥")).toBe("🔥");
    expect(cleanSymbol("  ab\u0007c d ")).toBe("abc");
    expect(cleanSymbol("👨‍👩‍👧x")).toBe("👨‍👩‍👧x");
    expect(cleanSymbol("   ")).toBeUndefined();
    expect(cleanSymbol(5)).toBeUndefined();
  });

  it("keeps the new lobby effects and the symbol", () => {
    const l = sanitizeLayout({ theme: { effect: "symbol", symbol: "⭐" } })!;
    expect(l.theme.effect).toBe("symbol");
    expect(l.theme.symbol).toBe("⭐");
    expect(sanitizeLayout({ theme: { effect: "blizzard" } })!.theme.effect).toBe("blizzard");
    expect(sanitizeLayout({ theme: { effect: "lasers" } })!.theme.effect).toBeUndefined();
  });

  it("keeps a Webpage block's https link and height", () => {
    const b = sanitizeShellBlock({
      id: "w1",
      type: "web",
      props: { url: "https://example.com/x", height: "l" },
    })!;
    expect(b.props).toMatchObject({ url: "https://example.com/x", height: "l" });
    const bad = sanitizeShellBlock({
      id: "w2",
      type: "web",
      props: { url: "javascript:alert(1)", height: "huge" },
    })!;
    expect(bad.props).toMatchObject({ url: "", height: "m" });
  });
});

describe("custom colourway", () => {
  it("derives a full colourway from one colour", () => {
    const c = customPalette("#ff3366");
    for (const k of ["a", "b", "c", "hi", "bg", "ink", "on"] as const)
      expect(c[k]).toMatch(/^#[0-9a-f]{6}$/);
    expect(c.on).toBe("#ffffff");
    // A pale colour gets dark text on its buttons.
    expect(customPalette("#f5f5f0").on).toBe("#111114");
  });

  it("falls back to violet for anything unknown", () => {
    expect(paletteColours(undefined).name).toBe("Violet");
    expect(paletteColours("custom", "nope").a).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("Home without repeats, 2026-11-10", () => {
  // The build blocks (Create and Change), every lobby drifting past, then the
  // chat. Search and Downtown are the bar's, on every page.
  const STOCK_HOME = ["build", "carousel", "homechat"];
  const TILES = ["search", "browse", "create", "change"];
  const OFF = [...TILES, "pulse", "live", "featured", "news", "upgrade", "ticker", "hero"];

  it("is the build blocks, the carousel and the chat, the rest off", () => {
    const s = stockShell();
    expect(s.home).toEqual(STOCK_HOME);
    expect(s.hidden).toEqual(expect.arrayContaining(OFF));
    expectWhole(s);
  });

  it("moves a Home still in an old stock order to the new one", () => {
    for (const home of [
      LEGACY_HOME,
      ["build", "pulse", "live", "featured", "news", "upgrade"],
      ["search", "browse", "create", "change", "homechat"],
      ["search", "browse", "create", "change", "carousel", "homechat"],
      ["build", "search", "browse", "create", "change", "carousel", "homechat"],
    ]) {
      const l = sanitizeShell({ ...stockShell(), home: [...home], hidden: [] })!;
      expect(l.home).toEqual(STOCK_HOME);
      expect(l.hidden).toEqual(expect.arrayContaining(OFF));
      expectWhole(l);
    }
  });

  it("gives a layout still on its preset the preset as it is now", () => {
    const l = sanitizeShell({
      ...stockShell(),
      preset: "clean",
      home: ["build", "pulse", "live"],
    })!;
    expect(l).toEqual(presetLayout("clean"));
    expect(l.home).toEqual(["build", "homechat"]);
  });

  it("keeps a Home arranged by hand, with the ways in switched off there", () => {
    const l = sanitizeShell({
      ...stockShell(),
      home: ["featured", "ticker", "news", "upgrade", "pulse", "live"],
      hidden: ["hero", "popular", "dms", "activity", "visited"],
    })!;
    expect(l.home).toEqual(["featured", "ticker", "news", "upgrade", "pulse", "live"]);
    expect(l.hidden).toEqual(expect.arrayContaining([...STOCK_HOME, ...TILES]));
    expectWhole(l);
  });

  it("leaves a layout that already has the ways in where its owner put them", () => {
    const l = sanitizeShell({
      ...stockShell(),
      left: ["card", "nav", "homechat", "favs"],
      home: ["pulse", "search"],
      hidden: [...stockShell().hidden, "build", "browse", "create", "change"],
    })!;
    // (Presence and Recent, never named, come back in their stock places.)
    expect(l.left).toEqual(["card", "nav", "presence", "homechat", "favs", "recent"]);
    // The carousel came after it was saved, so it lands in its stock place:
    // after the build blocks, which are off here, so first.
    expect(l.home).toEqual(["carousel", "pulse", "search"]);
    expectWhole(l);
  });

  it("lets the ways in and the chat live in either sidebar too", () => {
    let l = placeItem(stockShell(), "homechat", "left", 2);
    expect(l.left[2]).toBe("homechat");
    l = placeItem(l, "browse", "right", 0);
    expect(l.right[0]).toBe("browse");
    expect(l.home).toEqual(["build", "carousel"]);
    expect(l.hidden).not.toContain("browse");
    expectWhole(l);
  });

  it("puts the carousel between the ways in and the chat, where a layout has both", () => {
    for (const id of ["weered", "social", "everything"]) {
      const home = presetLayout(id)!.home;
      const before = id === "everything" ? "change" : "build";
      expect(home[home.indexOf(before) + 1]).toBe("carousel");
      expect(home[home.indexOf("carousel") + 1]).toBe("homechat");
    }
    // Clean, Focus and Minimal keep to what they say they are.
    for (const id of ["clean", "focus", "minimal"])
      expect(presetLayout(id)!.hidden).toContain("carousel");
    expect(placeItem(stockShell(), "carousel", "left", 0)).toEqual(stockShell());
  });

  it("lets the upgrade card be switched off like the rest", () => {
    const l = hideItem(placeItem(stockShell(), "upgrade", "home", 0), "upgrade");
    expect(l.home).not.toContain("upgrade");
    expect(l.hidden).toContain("upgrade");
  });

  it("keeps every preset whole, the build blocks first on its Home, no tile repeating the bar", () => {
    for (const p of SHELL_PRESETS) {
      const l = presetLayout(p.id)!;
      expectWhole(l);
      expect(l.home[0]).toBe("build");
      if (p.id !== "everything") for (const t of TILES) expect(l.home).not.toContain(t);
    }
    expect(
      presetLayout("everything")!.hidden.filter((h) => CORE_META[h].regions.includes("home")),
    ).toEqual([]);
  });
});
