import { describe, it, expect } from "vitest";
import { DESTINY_MODIFIERS, TABS } from "../../src/lib/destinyModifiers";

describe("destinyModifiers catalog", () => {
  it("DESTINY_MODIFIERS is a populated, well-formed catalog", () => {
    expect(Array.isArray(DESTINY_MODIFIERS)).toBe(true);
    expect(DESTINY_MODIFIERS.length).toBeGreaterThan(20);
    for (const m of DESTINY_MODIFIERS as any[]) {
      expect(typeof m.tab).toBe("string");
      expect(typeof m.category).toBe("string");
    }
  });
  it("TABS covers the six tabs with slot counts where expected", () => {
    const keys = TABS.map((t) => t.key);
    for (const k of ["TIER", "BOON", "CHALLENGE", "BUILDCRAFT", "GAMEPLAY", "RULE"]) {
      expect(keys).toContain(k);
    }
    expect(TABS.find((t) => t.key === "BOON")?.slots).toBe(3);
    expect(TABS.find((t) => t.key === "CHALLENGE")?.slots).toBe(5);
  });
});
