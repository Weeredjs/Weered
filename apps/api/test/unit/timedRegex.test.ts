import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { MEMBER_PATTERN_TEXT_MAX, testWithin } from "../../src/lib/timedRegex";

// A pattern a member wrote runs with a time limit, or not at all
// (lib/timedRegex.ts; hardening pass 2026-11-13).

const SRC = join(__dirname, "..", "..", "src");
function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sources(p, out);
    else if (name.endsWith(".ts") && !name.endsWith(".d.ts")) out.push(p);
  }
  return out;
}

describe("testWithin", () => {
  it("matches, and doesn't, like the pattern itself", () => {
    expect(testWithin("buy\\s+now", "i", "Please BUY   now")).toEqual({
      matched: true,
      timedOut: false,
      invalid: false,
    });
    expect(testWithin("buy\\s+now", "i", "nothing for sale").matched).toBe(false);
    expect(testWithin("^Sale$", "", "sale").matched).toBe(false);
    expect(testWithin("^Sale$", "i", "sale").matched).toBe(true);
  });

  it("stops a pattern that would run for hours, and says so", () => {
    const t = performance.now();
    const r = testWithin("^(a+)+$", "i", "a".repeat(40) + "!", 100);
    const ms = performance.now() - t;
    expect(r).toEqual({ matched: false, timedOut: true, invalid: false });
    // Left alone this pattern runs for hours; the limit is a tenth of a second.
    expect(ms).toBeLessThan(10_000);
    // And the next one runs as if nothing happened.
    expect(testWithin("b+", "i", "abba").matched).toBe(true);
  });

  it("stops the same kind of pattern on ordinary text", () => {
    const r = testWithin(
      "^(.*)*x$",
      "",
      "Sicilian Defense: Najdorf Variation, English Attack",
      100,
    );
    expect(r.timedOut || r.matched === false).toBe(true);
  });

  it("answers 'invalid' for a pattern that isn't one", () => {
    expect(testWithin("(unclosed", "i", "text")).toEqual({
      matched: false,
      timedOut: false,
      invalid: true,
    });
  });

  it("takes only the flags a member's pattern may carry", () => {
    // "g" and "y" make test() remember where it stopped; "d" builds indices.
    // An unlisted flag falls back to "i".
    expect(testWithin("SALE", "gy", "a sale").matched).toBe(true);
    expect(testWithin("sale", "notflags", "A SALE").matched).toBe(true);
  });

  it("reads at most the first 20,000 characters", () => {
    const long = "x".repeat(MEMBER_PATTERN_TEXT_MAX) + "needle";
    expect(testWithin("needle", "i", long).matched).toBe(false);
    expect(testWithin("needle", "i", "needle" + long).matched).toBe(true);
  });

  it("gives the same answer however many times it is asked", () => {
    // No clock in this one, and few calls: each starts a watchdog, and how
    // long that takes depends on what else the machine is doing (a third of a
    // millisecond idle, a fiftieth of a second with every core busy, which is
    // how the whole suite runs).
    let hits = 0;
    for (let i = 0; i < 30; i++)
      if (testWithin("spam|scam", "i", i % 3 ? "an ordinary post" : "a SCAM post").matched) hits++;
    expect(hits).toBe(10);
  }, 30_000);
});

describe("a pattern from stored data never runs bare", () => {
  // `new RegExp(` on something that is not a literal: either the text put
  // into it is escaped (a name, a tag), or it goes through testWithin.
  const KNOWN: Record<string, string> = {
    "lib/timedRegex.ts": "the guarded runner itself",
    "lib/lobbyHost.ts": "the host's name, escaped with escapeRe",
    "lib/uiPrefs.ts": "the site's own address, escaped",
    "lib/pressure.ts": "fixed field names from /proc/meminfo",
    "lib/gameNews.ts": "fixed tag names",
    "index.ts": "fixed tag names",
    "routes/eve.ts": "fixed tag names",
    "routes/activity.ts": "fixed property names",
    "routes/forum-mod.ts": "compiles a rule's pattern to check it is one; never runs it",
  };

  it("every place that builds a pattern at run time is one of the known, safe ones", () => {
    const unknown: string[] = [];
    for (const file of sources(SRC)) {
      const rel = relative(SRC, file).replace(/\\/g, "/");
      const text = readFileSync(file, "utf8");
      if (!/new RegExp\(\s*[^"'`/\s]/.test(text) && !/new RegExp\(\s*`[^`]*\$\{/.test(text))
        continue;
      if (!KNOWN[rel]) unknown.push(rel);
    }
    expect(unknown, "builds a pattern at run time: use testWithin, or escape and list it").toEqual(
      [],
    );
  });

  it("the forum's auto-moderation and the chess filter run theirs through testWithin", () => {
    const forum = readFileSync(join(SRC, "routes", "forum-mod.ts"), "utf8");
    const chess = readFileSync(join(SRC, "chessChallengeWorker.ts"), "utf8");
    expect(forum).toContain("testWithin(");
    expect(forum).not.toMatch(/\bre\.test\(/);
    expect(chess).toContain("testWithin(");
    expect(chess).not.toMatch(/new RegExp\(/);
  });
});
