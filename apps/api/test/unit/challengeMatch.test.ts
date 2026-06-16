import { describe, it, expect } from "vitest";
import { matchesFilters, definitionRequirementsMet } from "../../src/challengeWorker";

// The pure predicates that decide whether a Destiny activity counts toward a
// challenge objective. Anti-cheat-relevant: a session must actually satisfy the
// filters (mode/win/kills/modifiers) to credit progress.
const act = (over: any = {}): any => ({
  mode: 5,
  activityHash: "100",
  completed: true,
  standing: 0, // 0 = win
  duration: 600,
  kills: 20,
  deaths: 4,
  modifierHashes: [],
  ...over,
});

describe("matchesFilters - challenge objective matching", () => {
  it("an empty filter matches any activity", () => {
    expect(matchesFilters(act(), {} as any)).toBe(true);
  });
  it("modes filter gates on the activity mode", () => {
    expect(matchesFilters(act({ mode: 5 }), { modes: [5, 6] } as any)).toBe(true);
    expect(matchesFilters(act({ mode: 9 }), { modes: [5, 6] } as any)).toBe(false);
  });
  it("activityHashes filter gates on the activity hash", () => {
    expect(matchesFilters(act({ activityHash: "100" }), { activityHashes: ["100"] } as any)).toBe(
      true,
    );
    expect(matchesFilters(act({ activityHash: "999" }), { activityHashes: ["100"] } as any)).toBe(
      false,
    );
  });
  it("requireCompletion + requireWin are enforced", () => {
    expect(matchesFilters(act({ completed: false }), { requireCompletion: true } as any)).toBe(
      false,
    );
    expect(matchesFilters(act({ standing: 1 }), { requireWin: true } as any)).toBe(false);
    expect(matchesFilters(act({ standing: 0 }), { requireWin: true } as any)).toBe(true);
  });
  it("minKills + minKd thresholds are enforced", () => {
    expect(matchesFilters(act({ kills: 3 }), { minKills: 10 } as any)).toBe(false);
    expect(matchesFilters(act({ kills: 20 }), { minKills: 10 } as any)).toBe(true);
    expect(matchesFilters(act({ kills: 20, deaths: 10 }), { minKd: 3 } as any)).toBe(false); // kd 2
    expect(matchesFilters(act({ kills: 20, deaths: 4 }), { minKd: 3 } as any)).toBe(true); // kd 5
  });
  it("requiredModifiers must all be present", () => {
    expect(
      matchesFilters(act({ modifierHashes: ["m1", "m2"] }), { requiredModifiers: ["m1"] } as any),
    ).toBe(true);
    expect(
      matchesFilters(act({ modifierHashes: ["m2"] }), { requiredModifiers: ["m1"] } as any),
    ).toBe(false);
  });
});

describe("definitionRequirementsMet - difficulty tier + modifiers", () => {
  it("difficulty tier must be met", () => {
    expect(definitionRequirementsMet([], 5, [], 3)).toBe(true);
    expect(definitionRequirementsMet([], 2, [], 3)).toBe(false);
  });
  it("a high-tier modifier marker can stand in for a tier>=4 requirement", () => {
    expect(definitionRequirementsMet(["426853779"], null, [], 4)).toBe(true); // marker present
    expect(definitionRequirementsMet([], null, [], 4)).toBe(false); // no tier, no marker
  });
  it("required modifiers must all be present", () => {
    expect(definitionRequirementsMet(["m1", "m2"], 5, ["m1"], null)).toBe(true);
    expect(definitionRequirementsMet(["m2"], 5, ["m1"], null)).toBe(false);
  });
});
