import { describe, expect, it } from "vitest";
import {
  CORE_IDS,
  CORE_META,
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
  expect(l.home).toContain("upgrade");
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
    expect(l.hidden).toEqual(["presence"]);
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
    expect(hideItem(l, "upgrade")).toBe(l);
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
