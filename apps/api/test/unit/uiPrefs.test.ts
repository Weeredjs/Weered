import { describe, expect, it } from "vitest";
import { mergeUiPrefs, RAIL_SECTIONS, sanitizeUiPrefs } from "../../src/lib/uiPrefs";

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
});
