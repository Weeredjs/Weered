import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { heifIsSafe, isAllowedRaster } from "../../src/lib/sharpSafety";

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

describe("upload signature check", () => {
  const pad = (b: number[]) => Buffer.concat([Buffer.from(b), Buffer.alloc(16)]);
  it("lets PNG, JPEG, GIF and WebP through", () => {
    expect(isAllowedRaster(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
    expect(isAllowedRaster(pad([0xff, 0xd8, 0xff, 0xe0]))).toBe(true);
    expect(isAllowedRaster(Buffer.concat([Buffer.from("GIF89a"), Buffer.alloc(16)]))).toBe(true);
    const webp = Buffer.concat([
      Buffer.from("RIFF"),
      Buffer.alloc(4),
      Buffer.from("WEBP"),
      Buffer.alloc(8),
    ]);
    expect(isAllowedRaster(webp)).toBe(true);
  });
  it("refuses SVG, HTML, AVIF and anything short, whatever the declared type", () => {
    expect(isAllowedRaster(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBe(
      false,
    );
    expect(isAllowedRaster(Buffer.from('<?xml version="1.0"?><svg/>'))).toBe(false);
    expect(isAllowedRaster(Buffer.from("<html><body>x</body></html>"))).toBe(false);
    expect(
      isAllowedRaster(Buffer.concat([Buffer.alloc(4), Buffer.from("ftypavif"), Buffer.alloc(8)])),
    ).toBe(false);
    expect(isAllowedRaster(Buffer.from([0x89, 0x50]))).toBe(false);
  });
});
