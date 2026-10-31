import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as api from "../../api/src/lib/looks";
import {
  FRAME_PRESETS,
  FRAME_STYLES,
  LOOK_LABEL,
  NAME_MOTIONS,
  NAME_PRESETS,
  cornerFrameVars,
  encodeFrame,
  encodeName,
  frameFx,
  nameFx,
  parseFrame,
  parseName,
} from "../lib/looks";
import { moduleGlyph, roomMonogram } from "../lib/roomGlyph";

// The server saves a look (api lib/looks.ts) and the page draws it (lib/looks.ts,
// styles/56-looks.css and 80-chrome-min.css). Both lists stay the same, every
// preset has its style, and their own colours survive a save.
const STYLES = join(__dirname, "../app/styles");
const css = readdirSync(STYLES)
  .filter((f) => f.endsWith(".css"))
  .map((f) => readFileSync(join(STYLES, f), "utf8"))
  .join("\n");

describe("looks: server and page agree", () => {
  it("same presets, motions and styles", () => {
    expect([...api.NAME_PRESETS]).toEqual([...NAME_PRESETS]);
    expect([...api.FRAME_PRESETS]).toEqual([...FRAME_PRESETS]);
    expect([...api.NAME_MOTIONS]).toEqual([...NAME_MOTIONS]);
    expect([...api.FRAME_STYLES]).toEqual([...FRAME_STYLES]);
  });

  it("every preset draws and has a name in the picker", () => {
    for (const p of NAME_PRESETS) {
      expect(css, p).toMatch(new RegExp(`\\.weered-name-${p}\\b`));
      expect(LOOK_LABEL[p], p).toBeTruthy();
    }
    for (const p of FRAME_PRESETS) {
      expect(css, p).toMatch(new RegExp(`\\.weered-frame-${p}\\b`));
      expect(css, `corner ${p}`).toContain(`[data-uc-frame="${p}"]`);
      expect(LOOK_LABEL[p], p).toBeTruthy();
    }
    // Ring, double and glow are the rings frameFx works out (--ffx); the rest move or dash.
    expect(css).toMatch(/\.weered-frame-custom \{\s*box-shadow: var\(--ffx\)/);
    for (const s of FRAME_STYLES.filter((x) => !["ring", "double", "glow"].includes(x)))
      expect(css, s).toContain(`.weered-frame-custom.is-${s}`);
  });

  it("names keep their text clip: no `background:` shorthand on a name effect", () => {
    // The shorthand resets background-clip, and the name draws as a solid bar.
    const looks = readFileSync(join(STYLES, "56-looks.css"), "utf8");
    const nameRules = looks.match(/[^}]*\.weered-name-[a-z-]+[^{]*\{[^}]*\}/g) || [];
    expect(nameRules.length).toBeGreaterThan(10);
    for (const r of nameRules) expect(r, r.slice(0, 80)).not.toMatch(/(^|[\s;{])background:/);
  });

  it("their own colours survive a save", () => {
    const name = { colors: ["#ff00aa", "#22ccff"], glow: true, motion: "shimmer" as const };
    const savedName = api.cleanNameEffect(encodeName(name));
    expect(parseName(savedName)).toEqual(name);
    expect(api.cleanNameEffect({ colors: ["#FF00AA"], glow: false, motion: "pulse" })).toBe(
      "c:#ff00aa:g0:pulse",
    );

    const frame = { colors: ["#ffd700", "#8b5cf6", "#22c55e"], style: "cycle" as const };
    expect(parseFrame(api.cleanFrame(encodeFrame(frame)))).toEqual(frame);
  });

  it("the server turns away anything that isn't a look", () => {
    for (const bad of [
      "c:red:g1:none",
      "c:#ff0000:g1:spin",
      "c:#1,#2,#3,#4:g0:none",
      "url(x)",
      "expression(1)",
    ]) {
      expect(api.cleanNameEffect(bad), bad).toBeUndefined();
    }
    expect(
      api.cleanNameEffect({ colors: ["#000000", "#111111", "#222222", "#333333"] }),
    ).toBeUndefined();
    expect(api.cleanFrame("c:#ff0000;background:url(x):ring")).toBeUndefined();
    expect(api.cleanFrame("c:#ff0000:wobble")).toBeUndefined();
    expect(api.cleanNameEffect("none")).toBeNull();
    expect(api.cleanFrame("")).toBeNull();
  });
});

describe("looks: what a name and a frame get", () => {
  it("a preset is its class; their own is a class and its colours", () => {
    expect(nameFx("gold")).toEqual({ className: "weered-name-gold" });
    expect(nameFx("nonsense")).toEqual({});
    const own = nameFx("c:#ff00aa,#22ccff:g1:pulse");
    expect(own.className).toBe("weered-name-custom is-glow is-pulse");
    expect((own.style as any)["--nfx"]).toBe("linear-gradient(90deg, #ff00aa, #22ccff)");

    // One colour is still a gradient: names paint through background-image.
    expect((nameFx("c:#ff00aa:g0:none").style as any)["--nfx"]).toBe(
      "linear-gradient(90deg, #ff00aa, #ff00aa)",
    );
    expect(frameFx("holo")).toEqual({ className: "weered-frame-holo" });
    const f = frameFx("c:#ffd700:dashed");
    expect(f.className).toBe("weered-frame-custom is-dashed");
    expect((f.style as any)["--fc1"]).toBe("#ffd700");
    expect(cornerFrameVars("gold")).toBeNull();
    expect(cornerFrameVars("c:#ffd700,#8b5cf6:ring")?.["--uc-ffx"]).toContain("linear-gradient");
  });
});

describe("a room's face without an icon", () => {
  it("what it opens with, else its initials, never a diamond", () => {
    expect(moduleGlyph("voice")).toBe("🎙️");
    expect(moduleGlyph("YouTube")).toBe("📺");
    expect(moduleGlyph("unknown")).toBe("");
    expect(moduleGlyph(null)).toBe("");
    expect(roomMonogram("Clip Share")).toBe("CS");
    expect(roomMonogram("The Tower")).toBe("T");
    expect(roomMonogram("raid-night 2")).toBe("RN");
    expect(roomMonogram("🎮 gaming")).toBe("G");
    expect(roomMonogram("")).toBe("#");
  });
});
