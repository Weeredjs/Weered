import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PRELOADED_FONTS } from "../lib/fonts";

// The display fonts come from our own server (styles/01-fonts.css), not from
// Google: next/font/google's build-time download failed CI and deploys more
// often than not by 2026-11-07. Every rule has its file, every file a rule, the
// English files are the ones preloaded, and nothing reaches back to Google.
const WEB = join(__dirname, "..");
const css = readFileSync(join(WEB, "app/styles/01-fonts.css"), "utf8");
const FILES = join(WEB, "public/brand/fonts");

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(tsx?|css)$/.test(name) ? [path] : [];
  });
}

describe("self-hosted fonts", () => {
  const used = [...css.matchAll(/url\(\/brand\/fonts\/([^)]+)\)/g)].map((m) => m[1]);

  it("every rule has its file and every file a rule", () => {
    const onDisk = readdirSync(FILES);
    expect(used.filter((f) => !onDisk.includes(f))).toEqual([]);
    expect(onDisk.filter((f) => !used.includes(f))).toEqual([]);
  });

  it("preloads the English (latin) file of every face, and only those", () => {
    const latin = [...css.matchAll(/\/\* latin \*\/\s*@font-face \{[^}]*url\(([^)]+)\)/g)].map(
      (m) => m[1],
    );
    expect([...PRELOADED_FONTS].sort()).toEqual([...new Set(latin)].sort());
  });

  it("defines the font variables the styles use", () => {
    for (const v of ["pirata", "cormorant", "rajdhani", "barlow", "saira-stencil"]) {
      expect(css).toMatch(new RegExp(`--font-${v}: "[^"]+", "[^"]+ Fallback";`));
    }
  });

  it("nothing loads fonts from Google", () => {
    const offenders = ["app", "components", "lib"]
      .flatMap((d) => sources(join(WEB, d)))
      .filter((f) =>
        /from ["']next\/font\/google["']|fonts\.(googleapis|gstatic)\.com/.test(
          readFileSync(f, "utf8"),
        ),
      );
    expect(offenders).toEqual([]);
  });
});
