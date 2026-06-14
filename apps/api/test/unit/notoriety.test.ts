import { describe, it, expect } from "vitest";
import { NOTORIETY_ACTIONS, NOTORIETY_RANKS } from "../../../../packages/shared/src/notoriety";

describe("notoriety / economy ladder", () => {
  it("rank ladder is monotonic and starts at 0", () => {
    expect(NOTORIETY_RANKS[0].min).toBe(0);
    for (let i = 1; i < NOTORIETY_RANKS.length; i++) {
      expect(NOTORIETY_RANKS[i].min).toBeGreaterThan(NOTORIETY_RANKS[i - 1].min);
    }
  });

  it("rank titles are unique", () => {
    const titles = NOTORIETY_RANKS.map((r) => r.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("actions are unique, non-empty", () => {
    expect(new Set(NOTORIETY_ACTIONS).size).toBe(NOTORIETY_ACTIONS.length);
    for (const a of NOTORIETY_ACTIONS) expect(a.length).toBeGreaterThan(0);
  });

  it("resolves a score to the correct rank (ladder lookup)", () => {
    const rankFor = (score: number) =>
      [...NOTORIETY_RANKS].reverse().find((r) => score >= r.min)!.title;
    expect(rankFor(0)).toBe("Street Rat");
    expect(rankFor(99)).toBe("Street Rat");
    expect(rankFor(100)).toBe("Corner Boy");
    expect(rankFor(4999)).toBe("Underboss");
    expect(rankFor(10000)).toBe("Kingpin");
    expect(rankFor(999999)).toBe("Kingpin");
  });
});
