import { describe, expect, it } from "vitest";
import { mergeUiPrefs, RAIL_SECTIONS, sanitizeUiPrefs, shellRejected } from "../../src/lib/uiPrefs";

describe("UI prefs", () => {
  it("keeps known values and drops everything else", () => {
    expect(
      sanitizeUiPrefs({
        theme: "nebula",
        palette: "ocean",
        stars: false,
        density: "compact",
        setup: "done",
        interests: ["games", "work", "games", "hacking"],
        evil: "<script>",
      }),
    ).toEqual({
      theme: "nebula",
      palette: "ocean",
      stars: false,
      density: "compact",
      setup: "done",
      interests: ["games", "work"],
    });
  });

  it("keeps every Nebula colourway the web offers", () => {
    // apps/web/lib/uiPrefs.ts PALETTES; a colourway missing here is saved
    // in the browser but silently dropped from the account.
    for (const palette of ["violet", "ocean", "ember", "aurora", "graphite", "void"]) {
      expect(sanitizeUiPrefs({ palette }).palette).toBe(palette);
    }
  });

  it("rejects bad values without throwing", () => {
    expect(sanitizeUiPrefs(null)).toEqual({});
    expect(sanitizeUiPrefs("nebula")).toEqual({});
    expect(sanitizeUiPrefs([1, 2])).toEqual({});
    expect(sanitizeUiPrefs({ theme: "hotdog", palette: 3, stars: "yes" })).toEqual({});
  });

  it("lists every sidebar section once and never hides navigation", () => {
    const p = sanitizeUiPrefs({
      rail: { order: ["favs", "favs", "card"], hidden: ["nav", "presence"] },
    });
    expect(p.rail?.order).toEqual(["favs", "card", "nav", "presence", "recent"]);
    expect(p.rail?.order).toHaveLength(RAIL_SECTIONS.length);
    expect(p.rail?.hidden).toEqual(["presence"]);
  });

  it("merges a patch over what is stored", () => {
    const merged = mergeUiPrefs(
      { theme: "press", setup: "skipped" },
      { theme: "nebula", palette: "ember" },
    );
    expect(merged).toEqual({ theme: "nebula", setup: "skipped", palette: "ember" });
  });

  it("normalises the setup timestamp", () => {
    expect(sanitizeUiPrefs({ setupAt: "2026-10-29T12:00:00Z" }).setupAt).toBe(
      "2026-10-29T12:00:00.000Z",
    );
    expect(sanitizeUiPrefs({ setupAt: "yesterday" }).setupAt).toBeUndefined();
  });

  it("keeps a custom colourway, its colour and the type", () => {
    expect(sanitizeUiPrefs({ palette: "custom", accent: "#12ab9F", font: "serif" })).toEqual({
      palette: "custom",
      accent: "#12ab9F",
      font: "serif",
    });
    expect(sanitizeUiPrefs({ accent: "red", font: "comic" })).toEqual({});
  });

  it("keeps the viewer's own layout, in its regions only", () => {
    const p = sanitizeUiPrefs({
      shell: {
        v: 1,
        preset: "social",
        left: [
          "card",
          "nav",
          "friends",
          "ticker", // a Home section can't sit in a sidebar
          {
            id: "b1",
            type: "links",
            size: "m",
            props: { title: "Mine", items: [{ label: "x", url: "https://x.y" }] },
          },
        ],
        right: [
          "friends",
          "rooms",
          { id: "b1", type: "music", props: {} },
          { id: "b2", type: "game" },
        ],
        home: ["pulse", "favs"],
        hidden: ["presence", "nav", "friends", "bogus", "presence"],
      },
    });
    expect(p.shell).toEqual({
      v: 1,
      preset: "social",
      left: [
        "card",
        "nav",
        "friends",
        {
          id: "b1",
          type: "links",
          size: "m",
          props: { title: "Mine", items: [{ label: "x", url: "https://x.y" }] },
        },
      ],
      // A second "friends" and a reused block id are dropped; "game" isn't a shell block.
      right: ["rooms"],
      home: ["pulse"],
      hidden: ["presence"],
    });
  });

  it("drops an oversized or malformed layout", () => {
    const big = { left: [{ id: "b1", type: "rules", props: { body: "x".repeat(30_000) } }] };
    expect(sanitizeUiPrefs({ shell: big }).shell).toBeUndefined();
    expect(sanitizeUiPrefs({ shell: "left" }).shell).toBeUndefined();
    expect(sanitizeUiPrefs({ shell: [1] }).shell).toBeUndefined();
  });

  it("keeps the look's structure, effect and symbol", () => {
    expect(
      sanitizeUiPrefs({
        palette: "blizzard",
        shape: "cut",
        lines: "hard",
        texture: "dots",
        backdrop: "grid",
        fx: "symbol",
        fxIntensity: 9,
        fxSymbol: "  🔥\u0007 ",
      }),
    ).toEqual({
      palette: "blizzard",
      shape: "cut",
      lines: "hard",
      texture: "dots",
      backdrop: "grid",
      fx: "symbol",
      fxIntensity: 1.5,
      fxSymbol: "🔥",
    });
    expect(sanitizeUiPrefs({ shape: "blob", fx: "lasers", fxSymbol: "   " })).toEqual({});
    expect(sanitizeUiPrefs({ fxFront: true }).fxFront).toBe(true);
    expect(sanitizeUiPrefs({ fxFront: "yes" }).fxFront).toBeUndefined();
  });

  it("keeps a Webpage block in the layout", () => {
    const p = sanitizeUiPrefs({
      shell: { left: [{ id: "w1", type: "web", props: { url: "https://example.com" } }] },
    });
    expect((p.shell!.left[0] as any).type).toBe("web");
  });

  it("says when a layout would be dropped, so the route can refuse it", () => {
    const big = { left: [{ id: "b1", type: "rules", props: { body: "x".repeat(30_000) } }] };
    expect(shellRejected({ shell: big })).toBe(true);
    expect(shellRejected({ shell: "left" })).toBe(true);
    expect(shellRejected({ shell: { left: ["card"] } })).toBe(false);
    expect(shellRejected({ theme: "nebula" })).toBe(false);
    expect(shellRejected({ shell: null })).toBe(false);
  });

  it("bounds what a block's settings can hold", () => {
    const p = sanitizeUiPrefs({
      shell: {
        left: [
          {
            id: "b9",
            type: "welcome",
            props: {
              title: "t".repeat(3000),
              deep: { a: { b: { c: 1 } } },
              "bad key": 1,
              n: Infinity,
            },
          },
        ],
      },
    });
    const b = p.shell!.left[0] as any;
    expect(b.props.title).toHaveLength(2000);
    expect(b.props.deep).toEqual({ a: {} });
    expect(b.props["bad key"]).toBeUndefined();
    expect(b.props.n).toBeUndefined();
  });
});
