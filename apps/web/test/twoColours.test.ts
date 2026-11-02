import { describe, it, expect } from "vitest";
import { customPalette } from "../lib/uiPrefs";

// Your colour with a second colour: the deep accent and the second glow take its hue.
describe("two-colour colourway", () => {
  it("keeps one colour's palette when there's no second", () => {
    expect(customPalette("#8b5cf6", "none")).toEqual(customPalette("#8b5cf6"));
  });

  it("runs the gradient into the second colour", () => {
    const one = customPalette("#8b5cf6");
    const two = customPalette("#8b5cf6", "#22c55e");
    expect(two.a).toBe(one.a);
    expect(two.b).not.toBe(one.b);
    expect(two.c).not.toBe(one.c);
    // Green's hue, not violet's: more green than blue in the deep accent.
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(two.b.slice(i, i + 2), 16));
    expect(g).toBeGreaterThan(b);
    expect(g).toBeGreaterThan(r);
  });
});
