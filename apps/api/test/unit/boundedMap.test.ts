import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { BoundedMap } from "../../src/lib/boundedMap";

// A Map kept for the life of the process and keyed by what a caller sent never
// lets go of an entry. Every cache and rate window in the API has a ceiling:
// forty-four became a BoundedMap in the hardening pass of 2026-11-13, the rest
// check their own size (lib/boundedMap.ts).

const SRC = join(__dirname, "..", "..", "src");
function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sources(p, out);
    else if (name.endsWith(".ts") && !name.endsWith(".d.ts")) out.push(p);
  }
  return out;
}

describe("BoundedMap", () => {
  it("holds at most its ceiling and lets go of the oldest", () => {
    const m = new BoundedMap<string, number>(3);
    for (const [i, k] of ["a", "b", "c", "d", "e"].entries()) m.set(k, i);
    expect(m.size).toBe(3);
    expect([...m.keys()]).toEqual(["c", "d", "e"]);
    expect(m.get("a")).toBeUndefined();
    expect(m.get("e")).toBe(4);
  });

  it("writing a key it already holds lets go of nothing", () => {
    const m = new BoundedMap<string, number>(2);
    m.set("a", 1).set("b", 2);
    m.set("a", 10);
    expect(m.size).toBe(2);
    expect(m.get("a")).toBe(10);
    expect(m.get("b")).toBe(2);
  });

  it("stays at its ceiling under a flood of new keys", () => {
    const m = new BoundedMap<string, { data: string }>(500);
    for (let i = 0; i < 100_000; i++) m.set("q" + i, { data: "x" });
    expect(m.size).toBe(500);
    expect(m.has("q99999")).toBe(true);
    expect(m.has("q0")).toBe(false);
  });

  it("is a Map everywhere else", () => {
    const m = new BoundedMap<string, number>(5);
    m.set("a", 1);
    expect(m instanceof Map).toBe(true);
    expect(m.has("a")).toBe(true);
    expect(m.delete("a")).toBe(true);
    expect(m.size).toBe(0);
    m.set("b", 2);
    m.clear();
    expect([...m]).toEqual([]);
  });

  it("a ceiling under one still holds one", () => {
    const m = new BoundedMap<string, number>(0);
    m.set("a", 1);
    m.set("b", 2);
    expect([...m.keys()]).toEqual(["b"]);
  });
});

describe("every cache the API keeps has a ceiling", () => {
  // A cache is a Map whose entries carry a time (when it was read, or when it
  // runs out), or one simply named a cache. Each is a BoundedMap, or its file
  // checks its size by hand.
  const TIMED = /\b(expiresAt|exp|cachedAt|ts|at)\s*:/;
  const DECLARED = /^\s*(?:export\s+)?(?:const|let)\s+(\w+)\s*(?::[^=]+)?=\s*new Map</;

  it("no plain Map is used as one", () => {
    const loose: string[] = [];
    for (const file of sources(SRC)) {
      const text = readFileSync(file, "utf8");
      const lines = text.split("\n");
      lines.forEach((line, i) => {
        const m = DECLARED.exec(line);
        if (!m) return;
        const name = m[1];
        // The declaration may run on to the next line or two.
        const whole = lines.slice(i, i + 3).join(" ");
        const decl = whole.slice(0, whole.indexOf(">(") + 1 || undefined);
        if (!TIMED.test(decl) && !/cache/i.test(name)) return;
        const sized = new RegExp("\\b" + name + "\\.size\\b").test(text);
        if (!sized) loose.push(`${relative(SRC, file).replace(/\\/g, "/")}:${i + 1} ${name}`);
      });
    }
    expect(loose, "a cache with no ceiling: make it a BoundedMap").toEqual([]);
  });
});
