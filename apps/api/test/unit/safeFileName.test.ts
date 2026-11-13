import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { safeFileName } from "../../src/lib/safeFileName";

// The name of a stored file, as asked for in an address (lib/safeFileName.ts).

describe("safeFileName", () => {
  it("keeps a stored file's name as it is", () => {
    expect(safeFileName("a1b2c3.webp")).toBe("a1b2c3.webp");
    expect(safeFileName("user_12-avatar.t.webp")).toBe("user_12-avatar.t.webp");
  });

  it("can't leave its folder", () => {
    expect(safeFileName("../../etc/passwd")).toBe("....etcpasswd");
    expect(safeFileName("..\\..\\secret")).toBe("....secret");
    expect(safeFileName("a/b")).toBe("ab");
  });

  it("is never dots alone: '..' names the folder above", () => {
    for (const dots of [".", "..", "...", "%2e%2e", "../", "..\\"]) {
      const name = safeFileName(decodeURIComponent(dots));
      expect(name, dots).toBe("");
    }
  });

  it("is empty for nothing, and short for anything", () => {
    expect(safeFileName(undefined)).toBe("");
    expect(safeFileName(null)).toBe("");
    expect(safeFileName("")).toBe("");
    expect(safeFileName("x".repeat(5000))).toHaveLength(120);
  });

  it("is what every route that serves a file by name uses", () => {
    const routes = join(__dirname, "..", "..", "src", "routes");
    const byHand: string[] = [];
    for (const name of readdirSync(routes)) {
      const text = readFileSync(join(routes, name), "utf8");
      // The old way: strip the name in place, which lets ".." through.
      if (/params\?\.filename[^\n]*replaceAll\(/.test(text)) byHand.push(name);
    }
    expect(byHand).toEqual([]);
  });
});
