import { describe, it, expect } from "vitest";
import { sanitizeUiPrefs } from "../../src/lib/uiPrefs";
import { cleanDrip } from "../../src/lib/buildPlan";

// The side buttons' shape (James 2026-11-04: "everyone should be able to
// change the appearance of those 4 buttons"): a saved choice, and one the
// builder can make from words.
describe("side button shapes", () => {
  it("keeps the four shapes and drops anything else", () => {
    for (const buttons of ["tile", "chevron", "cut", "pill"]) {
      expect(sanitizeUiPrefs({ buttons })).toEqual({ buttons });
    }
    expect(sanitizeUiPrefs({ buttons: "url(x)" })).toEqual({});
  });

  it("is a Nebula choice the builder can make", () => {
    const r = cleanDrip({ look: { buttons: "chevron" }, summary: "Chevrons." }, "press");
    expect(r.look).toEqual({ buttons: "chevron", theme: "nebula" });
    expect(cleanDrip({ look: { buttons: "hexagon" } }, "nebula").look).toEqual({});
  });
});
