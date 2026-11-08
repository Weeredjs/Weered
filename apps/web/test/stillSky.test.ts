// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_LOOK, paintUiPrefs } from "../lib/uiPrefs";

// James 2026-11-08: "Can we have the background animation off by default.
// Stars are fine." Nebula's sky holds still unless Moving sky is chosen.
const WEB = join(__dirname, "..");
const css = readFileSync(join(WEB, "app/styles/95-nebula.css"), "utf8");
const attr = () => document.documentElement.getAttribute("data-weered-sky-motion");

describe("the sky", () => {
  it("holds still by default and moves only when chosen", () => {
    expect(DEFAULT_LOOK.skyMotion).toBe(false);
    paintUiPrefs({ ...DEFAULT_LOOK });
    expect(attr()).toBeNull();
    paintUiPrefs({ ...DEFAULT_LOOK, skyMotion: true });
    expect(attr()).toBe("on");
    paintUiPrefs({ ...DEFAULT_LOOK });
    expect(attr()).toBeNull();
  });

  it("stops the clouds, aurora, drift, shooting stars and lean, not the twinkle", () => {
    const still = 'html:not([data-weered-sky-motion="on"])';
    expect(css).toContain(
      `${still} :is(.nb-cloud, .nb-aurora, .nb-stars) {\n  animation: none !important;`,
    );
    expect(css).toContain(`${still} .nb-sky > * {\n  translate: none !important;`);
    expect(css).toContain(`${still} .nb-shooting {\n  display: none;`);
    // The bright stars keep their twinkle: nothing still-sky touches .nb-sparkles i.
    expect(css).not.toMatch(/sky-motion[^{]*\.nb-sparkles i/);
  });

  it("is chosen before the first paint, so a moving sky never starts still", () => {
    const layout = readFileSync(join(WEB, "app/layout.tsx"), "utf8");
    expect(layout).toContain(
      "up.skyMotion === true) d.setAttribute('data-weered-sky-motion', 'on')",
    );
  });
});
