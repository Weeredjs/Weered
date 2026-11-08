import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { NO_SHELL_ROUTES } from "../lib/lobbyThemes";

// A page in the frame sits in a box under the bar at the top of every page
// (components/ShellGate.tsx). James 2026-11-08, on his own crew page: "Doesn't
// scroll. Can't get to the save button." The box never scrolled, and pages
// sized themselves to the window, which is taller than the box.
const WEB = path.resolve(__dirname, "..");
const BAR_CSS = fs.readFileSync(path.join(WEB, "app/styles/42-bar.css"), "utf8");

/** In the frame, as ShellGate decides it from the path. */
const framed = (route: string) =>
  !NO_SHELL_ROUTES.some((r) => route === r || route.startsWith(r + "/"));

/** Each framed route's own files: its page and the views beside it. */
function framedFiles(dir = path.join(WEB, "app"), out: string[] = []): string[] {
  const ents = fs.readdirSync(dir, { withFileTypes: true });
  if (ents.some((e) => e.name === "page.tsx")) {
    const route =
      "/" +
      path
        .relative(path.join(WEB, "app"), dir)
        .split(path.sep)
        .filter((s) => s && !/^\(.*\)$/.test(s))
        .join("/");
    if (framed(route))
      for (const e of ents)
        if (e.isFile() && /\.tsx?$/.test(e.name))
          out.push(path.relative(WEB, path.join(dir, e.name)).split(path.sep).join("/"));
  }
  for (const e of ents) if (e.isDirectory()) framedFiles(path.join(dir, e.name), out);
  return out;
}

// A height or min-height from the window (100vh, 100dvh, calc(100vh - ...)).
const WINDOW_SIZED = /(?<![\w-])(?:min-?[hH]eight|height)\s*:[^;]*?\b100[dsl]?vh/;

describe("a page in the frame", () => {
  it("scrolls in its box when it is taller than the box", () => {
    // A phone scrolls the whole column already (40-core-layout.css).
    const wide = BAR_CSS.match(/@media \(min-width: 768px\) \{\s*\.weered-center-body \{([^}]*)\}/);
    expect(wide?.[1]).toMatch(/overflow-y:\s*auto/);
    expect(wide?.[1]).toMatch(/overflow-x:\s*hidden/);
  });

  it("sizes itself to the box, never the window", () => {
    // var(--weered-page-h, 100vh): the box in the frame, the window outside it.
    expect(BAR_CSS).toMatch(/\.weered-center-body \{[^}]*--weered-page-h:\s*100%/);
    const hits: string[] = [];
    // The not-found page shows in the frame for any path that isn't a page.
    for (const f of [...framedFiles(), "app/not-found.tsx"])
      fs.readFileSync(path.join(WEB, f), "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (WINDOW_SIZED.test(line.replace(/var\(--weered-page-h,\s*100vh\)/g, "")))
            hits.push(`${f}:${i + 1}`);
        });
    expect(hits).toEqual([]);
  });

  it("finds the pages in the frame and leaves the rest", () => {
    const files = framedFiles();
    expect(files).toContain("app/crew/[crewId]/CrewView.tsx");
    expect(files).toContain("app/profile/[userId]/page.tsx");
    expect(files.some((f) => f.startsWith("app/terms/") || f === "app/page.tsx")).toBe(false);
  });
});
