import { describe, it, expect } from "vitest";
import { isRealDate, sizeProblem } from "../../src/lib/fieldSize";

// A size limit for each field a route stores (hardening pass 2026-11-13).
// The event, tournament and challenge routes stored whatever they were sent:
// a megabyte of description, or of objectives, per request.
describe("a field over its limit", () => {
  const limits = { title: 10, notes: 20, rules: 30 };

  it("is refused, with the field and both numbers", () => {
    const p = sizeProblem({ title: "x".repeat(2345) }, { title: 2000 });
    expect(p?.error).toBe("too_long");
    expect(p?.field).toBe("title");
    expect(p?.message).toContain("2,000");
    expect(p?.message).toContain("2,345");
  });

  it("passes at the limit and under it", () => {
    expect(sizeProblem({ title: "x".repeat(10), notes: "" }, limits)).toBeNull();
    expect(sizeProblem({ title: "short" }, limits)).toBeNull();
  });

  it("measures a list or an object by its size as JSON", () => {
    expect(sizeProblem({ rules: { a: 1 } }, limits)).toBeNull();
    expect(sizeProblem({ rules: new Array(40).fill(1) }, limits)?.field).toBe("rules");
    expect(sizeProblem({ rules: { deep: { er: "x".repeat(40) } } }, limits)?.field).toBe("rules");
  });

  it("skips a field that wasn't sent, so an edit can send one", () => {
    expect(sizeProblem({}, limits)).toBeNull();
    expect(sizeProblem({ title: null, notes: undefined }, limits)).toBeNull();
    expect(sizeProblem(null, limits)).toBeNull();
    expect(sizeProblem(undefined, limits)).toBeNull();
  });

  it("leaves fields it has no limit for alone", () => {
    expect(sizeProblem({ other: "x".repeat(5000) }, limits)).toBeNull();
  });

  it("refuses what can't be written down at all", () => {
    const loop: any = {};
    loop.self = loop;
    expect(sizeProblem({ rules: loop }, limits)?.error).toBe("too_long");
  });

  it("answers a megabyte as fast as a word", () => {
    const t = performance.now();
    expect(sizeProblem({ title: "x".repeat(1_000_000) }, limits)?.field).toBe("title");
    expect(performance.now() - t).toBeLessThan(20);
  });
});

describe("a date and time", () => {
  it("is something a calendar can read", () => {
    expect(isRealDate("2026-11-13T18:00:00Z")).toBe(true);
    expect(isRealDate("2026-11-13")).toBe(true);
    expect(isRealDate(1794500000000)).toBe(true);
    expect(isRealDate(new Date())).toBe(true);
  });

  it("is not anything else", () => {
    for (const bad of [null, undefined, "", "next tuesday", "2026-13-45", {}, [], true])
      expect(isRealDate(bad), JSON.stringify(bad)).toBe(false);
    expect(isRealDate("2026-11-13" + " ".repeat(100))).toBe(false);
  });
});
