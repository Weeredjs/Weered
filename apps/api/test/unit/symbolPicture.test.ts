import { describe, it, expect } from "vitest";
import { sanitizeUiPrefs } from "../../src/lib/uiPrefs";
import { cleanDrip, cleanOps, lobbyForModel } from "../../src/lib/buildPlan";
import { canFloatPicture } from "../../src/lib/tiers";

// "Change the snow to my logo" (James 2026-11-04): your own uploaded picture
// floats in your look, a lobby can float its own logo, and the builder can
// switch either on from words. It never chooses the picture itself.
describe("a picture for the symbol effect", () => {
  const base = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";

  it("keeps only a picture our upload wrote, or none", () => {
    const mine = `${base}/symbols/cmabc123-1730700000000.webp`;
    expect(sanitizeUiPrefs({ fxImage: mine, fxPicture: true })).toEqual({
      fxImage: mine,
      fxPicture: true,
    });
    expect(sanitizeUiPrefs({ fxImage: "none" })).toEqual({ fxImage: "none" });
    for (const bad of [
      "https://evil.example/symbols/x-1.webp",
      `${base}/avatars/cmabc123-1730700000000.webp`,
      `${base}/symbols/../x.webp`,
    ]) {
      expect(sanitizeUiPrefs({ fxImage: bad })).toEqual({});
    }
  });

  it("is Indicted and up", () => {
    expect(canFloatPicture("INNOCENT")).toBe(false);
    expect(canFloatPicture(undefined)).toBe(false);
    expect(canFloatPicture("INDICTED")).toBe(true);
    expect(canFloatPicture("CONDEMNED")).toBe(true);
  });

  it("the builder turns your picture on or off, under Nebula", () => {
    expect(cleanDrip({ look: { fx: "symbol", fxPicture: true } }, "slate").look).toEqual({
      fx: "symbol",
      fxPicture: true,
      theme: "nebula",
    });
    expect(cleanDrip({ look: { fxImage: "https://evil.example/x.webp" } }, "nebula").look).toEqual(
      {},
    );
  });

  it("the builder floats a lobby's logo, and knows whether it has one", () => {
    const [op] = cleanOps(
      { ops: [{ op: "look", effect: "symbol", symbolLogo: true }] },
      new Map(),
      "",
    );
    expect(op).toEqual({ op: "look", effect: "symbol", symbolLogo: true });
    expect(lobbyForModel({ name: "L", logoUrl: `${base}/banners/x.webp` }, {}).hasLogo).toBe(true);
    expect(lobbyForModel({ name: "L", logoUrl: null }, {}).hasLogo).toBe(false);
  });
});

describe("the lobby's card size, from words", () => {
  it("keeps s, m and l and drops anything else", () => {
    const ops = cleanOps(
      {
        ops: [
          { op: "cards", cards: "s" },
          { op: "cards", cards: "xl" },
        ],
      },
      new Map(),
      "",
    );
    expect(ops).toEqual([{ op: "cards", cards: "s" }]);
  });
});
