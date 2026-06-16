import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { NOTORIETY_ACTIONS, NOTORIETY_RANKS } from "../../../../packages/shared/src/notoriety";

// Parse the source-of-truth config straight out of apps/api/src/index.ts (by
// text, so we don't import index.ts and trigger its boot side-effects). This is
// what turns the shared mirror from a parallel copy that can silently drift into
// a CI-enforced guard.
function prodNotoriety(): { actions: string[]; ranks: { title: string; min: number }[] } {
  const src = readFileSync(
    fileURLToPath(new URL("../../src/lib/notoriety.ts", import.meta.url)),
    "utf8",
  );

  const aStart = src.indexOf("const NOTORIETY_ACTIONS");
  const aBody = src.slice(aStart, src.indexOf("};", aStart) + 2);
  const actions = [...aBody.matchAll(/^\s+([A-Z][A-Z0-9_]*):\s*\{/gm)].map((m) => m[1]);

  const rStart = src.indexOf("const NOTORIETY_RANKS");
  const rBody = src.slice(rStart, src.indexOf("];", rStart) + 2);
  const ranks = [...rBody.matchAll(/title:\s*"([^"]+)",\s*min:\s*(\d+)/g)].map((m) => ({
    title: m[1],
    min: Number(m[2]),
  }));

  return { actions, ranks };
}

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

  // ── Drift guards: the shared mirror MUST match the API source of truth ──
  it("shared NOTORIETY_ACTIONS mirrors the API config (no drift)", () => {
    const { actions } = prodNotoriety();
    expect(actions.length).toBeGreaterThan(0);
    expect([...actions].sort()).toEqual([...NOTORIETY_ACTIONS].sort());
  });

  it("shared NOTORIETY_RANKS mirrors the API config (no drift)", () => {
    const { ranks } = prodNotoriety();
    expect(ranks.length).toBe(NOTORIETY_RANKS.length);
    expect(ranks).toEqual(NOTORIETY_RANKS.map((r) => ({ title: r.title, min: r.min })));
  });
});
