import { describe, it, expect } from "vitest";
import {
  cleanRoleMap,
  DEFAULT_ROLE_NAMES,
  DEFAULT_ROLE_ICONS,
  ROLE_LEVELS,
} from "../../src/lib/lobbyRoles";

// A lobby's role map is written by whoever can manage roles, and every surface
// that renders a member's name reads it. A partial or hostile payload must never
// be able to leave a lobby with half a map, an unbounded string, or extra levels.
describe("cleanRoleMap — always exactly five levels", () => {
  it("fills missing levels from the fallback", () => {
    const out = cleanRoleMap({ "5": "Steward" }, DEFAULT_ROLE_NAMES, 24);
    expect(Object.keys(out).sort()).toEqual([...ROLE_LEVELS].sort());
    expect(out["5"]).toBe("Steward");
    expect(out["1"]).toBe(DEFAULT_ROLE_NAMES["1"]);
  });

  it("ignores levels outside 1..5 rather than storing them", () => {
    const out = cleanRoleMap({ "9": "Ghost", "0": "Nobody", "5": "Boss" }, DEFAULT_ROLE_NAMES, 24);
    expect(out).not.toHaveProperty("9");
    expect(out).not.toHaveProperty("0");
    expect(out["5"]).toBe("Boss");
  });

  it("truncates to the max length instead of rejecting", () => {
    const out = cleanRoleMap({ "3": "x".repeat(200) }, DEFAULT_ROLE_NAMES, 24);
    expect(out["3"]).toHaveLength(24);
  });

  it("falls back for non-string values (numbers, objects, null)", () => {
    const out = cleanRoleMap(
      { "5": 42, "4": { a: 1 }, "3": null, "2": ["x"] },
      DEFAULT_ROLE_NAMES,
      24,
    );
    expect(out["5"]).toBe(DEFAULT_ROLE_NAMES["5"]);
    expect(out["4"]).toBe(DEFAULT_ROLE_NAMES["4"]);
    expect(out["3"]).toBe(DEFAULT_ROLE_NAMES["3"]);
    expect(out["2"]).toBe(DEFAULT_ROLE_NAMES["2"]);
  });

  it("survives null / undefined / a non-object body", () => {
    for (const bad of [null, undefined, "nope", 7]) {
      const out = cleanRoleMap(bad, DEFAULT_ROLE_NAMES, 24);
      expect(Object.keys(out)).toHaveLength(5);
      expect(out["1"]).toBe(DEFAULT_ROLE_NAMES["1"]);
    }
  });
});

describe("cleanRoleMap — icons", () => {
  it("keeps an emoji and honours the shorter icon cap", () => {
    const out = cleanRoleMap({ "5": "👑", "4": "🛡️".repeat(20) }, DEFAULT_ROLE_ICONS, 8);
    expect(out["5"]).toBe("👑");
    expect(out["4"].length).toBeLessThanOrEqual(8);
  });

  it("treats an empty icon as a real choice — no icon, not a fallback", () => {
    // Explicitly clearing a level must clear it, even though the fallback for
    // that level might be non-empty (e.g. re-saving over a previous icon).
    const out = cleanRoleMap({ "5": "" }, { ...DEFAULT_ROLE_ICONS, "5": "👑" }, 8);
    expect(out["5"]).toBe("");
  });

  it("defaults to no icons at all, so an unconfigured lobby is unchanged", () => {
    const out = cleanRoleMap({}, DEFAULT_ROLE_ICONS, 8);
    expect(Object.values(out).every((v) => v === "")).toBe(true);
  });
});
