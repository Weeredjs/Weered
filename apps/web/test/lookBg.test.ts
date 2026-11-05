import { describe, expect, it } from "vitest";
import { lookBgCss, lookBgProps, mayPickLookBg, parseLookBg } from "../lib/lookBg";

// A paid member's background as the page draws it (lib/lookBg.ts).
describe("lookBg", () => {
  it("reads the three kinds and nothing else", () => {
    expect(parseLookBg("c:#7c3aed")).toEqual({ kind: "colour", a: "#7c3aed" });
    expect(parseLookBg("g:#7c3aed,#22d3ee")).toEqual({
      kind: "gradient",
      a: "#7c3aed",
      b: "#22d3ee",
    });
    expect(parseLookBg("banner")).toEqual({ kind: "banner" });
    expect(parseLookBg("red")).toBeNull();
  });

  it("draws a lighter wash for a row than for a card", () => {
    expect(lookBgCss("c:#7c3aed", null, "row")).toContain("#7c3aed66");
    expect(lookBgCss("c:#7c3aed", null, "card")).toContain("#7c3aedcc");
  });

  it("lays a banner across the top of a tall panel instead of blowing it up", () => {
    const panel = lookBgCss("banner", "/b.webp", "panel")!;
    expect(panel).toContain('url("/b.webp") center top / 100% auto no-repeat');
    expect(panel).not.toContain("cover");
    expect(lookBgCss("banner", "/b.webp", "card")).toContain("cover");
    expect(lookBgCss("c:#7c3aed", null, "panel")).toBe(lookBgCss("c:#7c3aed", null, "card"));
  });

  it('never lets a banner address out of url("")', () => {
    expect(lookBgCss("banner", "/uploads/banners/a.webp", "card")).toContain(
      'url("/uploads/banners/a.webp")',
    );
    expect(lookBgCss("banner", 'x"),url(https://evil.example/t', "card")).toBeNull();
    expect(lookBgCss("banner", "javascript:alert(1)", "row")).toBeNull();
    expect(lookBgCss("banner", "http://plain.example/a.png", "row")).toBeNull();
    expect(lookBgCss("banner", null, "row")).toBeNull();
  });

  it("hands an element its class and variable, or nothing", () => {
    expect(lookBgProps("c:#112233", null, "row")).toMatchObject({ className: "weered-look-bg" });
    expect(lookBgProps(null, null, "row")).toBeNull();
  });

  it("knows who can pick one", () => {
    expect(mayPickLookBg({ tier: "INDICTED" })).toBe(true);
    expect(mayPickLookBg({ tier: "INNOCENT" })).toBe(false);
    expect(mayPickLookBg({ tier: "INNOCENT", globalRole: "STAFF" })).toBe(true);
    expect(mayPickLookBg({ tier: "INNOCENT", globalRole: "SUPPORT" })).toBe(true);
    expect(mayPickLookBg(null)).toBe(false);
  });
});
