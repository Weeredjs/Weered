import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { shortMessage, shortStringList } from "../../src/lib/zodSafe";

// GHSA-mrhx-c7xc-m3w5, reproduced on this API in the hardening pass of
// 2026-11-12: a megabyte of [1,1,1,...] to POST /groups, no sign-in, made
// 480,000 validation issues and a 66 MB error reply (lib/zodSafe.ts).

const SRC = join(__dirname, "..", "..", "src");
function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sources(p, out);
    else if (name.endsWith(".ts")) out.push(p);
  }
  return out;
}

describe("a list in a request", () => {
  const body = z.object({ memberIds: shortStringList(500).optional() }).passthrough();

  it("is refused once, whole, however long it is", () => {
    const t = performance.now();
    const r = body.safeParse({ memberIds: new Array(480_000).fill(1) });
    const ms = performance.now() - t;
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues).toHaveLength(1);
    // z.array() took about 400 ms here and kept 480,000 issues.
    expect(ms).toBeLessThan(100);
  });

  it("takes what the page sends", () => {
    expect(body.safeParse({ memberIds: ["a", "b"] }).success).toBe(true);
    expect(body.safeParse({}).success).toBe(true);
    expect(body.safeParse({ memberIds: [] }).success).toBe(true);
    expect(body.safeParse({ memberIds: ["a", 2] }).success).toBe(false);
    expect(body.safeParse({ memberIds: "a" }).success).toBe(false);
    expect(body.safeParse({ memberIds: new Array(501).fill("a") }).success).toBe(false);
  });

  it("has no other way in: nothing in the API uses z.array()", () => {
    const users = sources(SRC)
      .filter((f) => !f.endsWith("zodSafe.ts"))
      // Code only: a comment may say the name.
      .filter((f) =>
        /\bz\s*\.\s*array\s*\(/.test(
          readFileSync(f, "utf8")
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/\/\/.*/g, ""),
        ),
      )
      .map((f) => f.slice(SRC.length + 1));
    expect(
      users,
      "z.array() keeps an issue for every wrong element; use shortStringList() or a z.custom() that checks the length first (lib/zodSafe.ts)",
    ).toEqual([]);
  });
});

describe("what a validation error says back", () => {
  it("is held to a length a person would read", () => {
    expect(shortMessage("body/name Required")).toBe("body/name Required");
    expect(shortMessage("x".repeat(66_000_000))).toHaveLength(301);
    expect(shortMessage("")).toBe("Invalid request");
    expect(shortMessage(undefined)).toBe("Invalid request");
  });
});
