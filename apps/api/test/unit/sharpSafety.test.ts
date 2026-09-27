import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { heifIsSafe } from "../../src/lib/sharpSafety";

describe("sharp HEIF guard", () => {
  it("treats libheif below 1.23.2 as unsafe", () => {
    for (const v of ["1.23.1", "1.23.0", "1.22.9", "1.17.6", "0.9.0", "", undefined]) {
      expect(heifIsSafe(v as any), String(v)).toBe(false);
    }
    for (const v of ["1.23.2", "1.23.10", "1.24.0", "2.0.0"]) {
      expect(heifIsSafe(v), v).toBe(true);
    }
  });

  it("refuses to decode an AVIF body even when it arrives labelled as PNG", async () => {
    // Importing the guard applies it. A tiny real AVIF, built by sharp before
    // the block, then fed back as if it were an upload.
    const avif = await sharp({
      create: { width: 8, height: 8, channels: 3, background: { r: 200, g: 40, b: 40 } },
    })
      .avif()
      .toBuffer()
      .catch(() => null);
    if (!avif) return; // this libvips build cannot encode AVIF; nothing to decode
    const bundled = (sharp.versions as any).heif;
    if (heifIsSafe(bundled)) return; // guard intentionally off on a fixed libheif
    await expect(sharp(avif).rotate().webp().toBuffer()).rejects.toThrow();
    // Ordinary formats still work.
    const png = await sharp({
      create: { width: 8, height: 8, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .png()
      .toBuffer();
    await expect(sharp(png).rotate().webp().toBuffer()).resolves.toBeInstanceOf(Buffer);
  });
});
