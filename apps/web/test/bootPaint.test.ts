// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BAR_TEXT_ON_JS, DEFAULT_LOOK, barTextOn, paintUiPrefs } from "../lib/uiPrefs";

// The look is painted twice: by the boot script in app/layout.tsx before first
// paint, and by lib/uiPrefs.ts paintUiPrefs when a setting changes or the
// account's look is pulled (once a session). On every other page load the boot
// script is all there is, so whatever it leaves out stays left out.
//
// It left out the text colour of a section bar. With a bar colour of your own,
// the titles took the colourway's "text on an accent" instead, which on Void
// and Graphite is near-black: black titles on a dark bar (James's second
// account, 2026-11-13).
const WEB = join(__dirname, "..");
const layout = readFileSync(join(WEB, "app/layout.tsx"), "utf8");
const prefsSource = readFileSync(join(WEB, "lib/uiPrefs.ts"), "utf8");

const fromBootScript = new Function(`return (${BAR_TEXT_ON_JS})`)() as (hex: string) => string;

describe("the text on a section bar", () => {
  it("is light on a dark bar and dark on a light one", () => {
    expect(barTextOn("#121416")).toBe("#ffffff");
    expect(barTextOn("#000000")).toBe("#ffffff");
    expect(barTextOn("#8b5cf6")).toBe("#ffffff");
    expect(barTextOn("#f5f5f5")).toBe("#111114");
    expect(barTextOn("#ffffff")).toBe("#111114");
  });

  it("is worked out the same way before first paint as after", () => {
    const steps = [0, 18, 51, 96, 128, 160, 187, 204, 230, 255];
    let tried = 0;
    for (const r of steps)
      for (const g of steps)
        for (const b of steps) {
          const hex = "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
          expect(fromBootScript(hex), hex).toBe(barTextOn(hex));
          tried++;
        }
    expect(tried).toBe(1000);
  });

  it("a dark bar on Void gets light titles from paintUiPrefs", () => {
    paintUiPrefs({ ...DEFAULT_LOOK, palette: "void", bars: "solid", barColor: "#121416" });
    const style = document.documentElement.style;
    expect(style.getPropertyValue("--nb-bar")).toBe("#121416");
    expect(style.getPropertyValue("--nb-bar-on")).toBe("#ffffff");
    paintUiPrefs({ ...DEFAULT_LOOK });
    expect(style.getPropertyValue("--nb-bar-on")).toBe("");
  });
});

describe("the boot script paints everything paintUiPrefs does", () => {
  it("sets the bar's text colour, by the shared rule", () => {
    expect(layout).toContain("'--nb-bar-on'");
    expect(layout).toContain("${BAR_TEXT_ON_JS}");
  });

  it("knows every attribute and bar variable that paintUiPrefs sets", () => {
    const start = prefsSource.indexOf("export function paintUiPrefs");
    const end = prefsSource.indexOf("\n}\n", start);
    expect(start).toBeGreaterThan(0);
    const body = prefsSource.slice(start, end);
    const names = new Set([
      ...(body.match(/data-weered-[a-z-]+/g) || []),
      ...(body.match(/--nb-bar[a-z-]*/g) || []),
    ]);
    expect(names.size).toBeGreaterThan(8);
    const missing = [...names].filter((n) => !layout.includes(n));
    expect(missing, "painted later but not before first paint").toEqual([]);
  });
});
