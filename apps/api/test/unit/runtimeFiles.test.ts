import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// Two rules about what lives in the site's folder on the server
// (hardening pass, 2026-11-13).
//
// 1. A file the API writes there while it runs is never part of the
//    repository. The repository is public, and a nightly job on the server
//    commits and pushes whatever it finds in that folder. The office's note
//    board (visitors' private notes) was one .gitignore line short of being
//    published that way; it was caught the first night, while still empty.
//
// 2. A setting is read when it is used, not when a file loads. Every file
//    loads before index.ts reads apps/api/.env, and the process manager hands
//    the API its own saved copy of some settings. A load-time reader keeps the
//    saved copy when the setting changes in .env.

const API = join(__dirname, "..", "..");
const SRC = join(API, "src");
const ROOT = join(API, "..", "..");

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sources(p, out);
    else if (name.endsWith(".ts") && !name.endsWith(".d.ts")) out.push(p);
  }
  return out;
}

describe("files the API writes in the site's folder", () => {
  const ignored = readFileSync(join(ROOT, ".gitignore"), "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  // The one file there that IS the repository's: a page, not data.
  const SHIPPED = new Set(["office-control.html"]);

  it("are all ignored by git", () => {
    const written = new Set<string>();
    for (const file of sources(SRC)) {
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(/"\/opt\/weered\/([A-Za-z0-9._-]+)"/g)) written.add(m[1]);
    }
    expect(written.size).toBeGreaterThanOrEqual(4);
    const published = [...written].filter((name) => !SHIPPED.has(name) && !ignored.includes(name));
    expect(published, "written at run time but not in .gitignore").toEqual([]);
  });
});

describe("the voice key is read when a token is signed", () => {
  it("routes/voice.ts reads no LIVEKIT setting at load time", () => {
    const text = readFileSync(join(SRC, "routes", "voice.ts"), "utf8");
    // Top-level statements start at column 0; the settings are read inside
    // livekitSettings(), which is indented.
    const topLevel = text.split("\n").filter((l) => /^(const|let|var|export const)\s/.test(l));
    const loadTime = topLevel.filter((l) => l.includes("process.env.LIVEKIT"));
    expect(loadTime).toEqual([]);
    expect(text).toContain("export function livekitSettings()");
  });

  it("no route file keeps a top-level copy of a LIVEKIT or JWT setting", () => {
    const kept: string[] = [];
    for (const file of sources(join(SRC, "routes"))) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((l, i) => {
        if (
          /^(export\s+)?(const|let|var)\s/.test(l) &&
          /process\.env\.(LIVEKIT_|JWT_SECRET)/.test(l)
        )
          kept.push(`${relative(SRC, file).replace(/\\/g, "/")}:${i + 1}`);
      });
    }
    expect(kept).toEqual([]);
  });
});
