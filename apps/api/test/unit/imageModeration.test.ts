import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { dHash, hamming } from "../../src/lib/imageModeration";

// 32x32 vertical stripes (4px black / 4px white) — structured enough that the
// horizontal-neighbor dHash is non-degenerate, with no single hard edge whose
// lossy ringing would move the hash.
function stripesRaw(size = 32): Buffer {
  const raw = Buffer.alloc(size * size * 3);
  for (let i = 0; i < size * size; i++) {
    const x = i % size;
    const v = x % 8 < 4 ? 0 : 255;
    raw[i * 3] = v;
    raw[i * 3 + 1] = v;
    raw[i * 3 + 2] = v;
  }
  return raw;
}
const stripes = () => sharp(stripesRaw(), { raw: { width: 32, height: 32, channels: 3 } });

describe("imageModeration primitives", () => {
  it("dHash is 16 hex chars, non-degenerate, and deterministic", async () => {
    const png = await stripes().png().toBuffer();
    const a = await dHash(png);
    const b = await dHash(png);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(a).not.toBe("0000000000000000");
    expect(a).not.toBe("ffffffffffffffff");
    expect(a).toBe(b); // same bytes → same hash
  });

  it("dHash is format-independent for lossless encodings", async () => {
    // png and lossless webp decode to identical pixels, so the perceptual hash
    // must match — this is the property the ban ledger relies on.
    const png = await stripes().png().toBuffer();
    const webp = await stripes().webp({ lossless: true }).toBuffer();
    expect(hamming(await dHash(png), await dHash(webp))).toBeLessThanOrEqual(4);
  });

  it("hamming counts differing bits and guards bad input", () => {
    expect(hamming("0000000000000000", "0000000000000000")).toBe(0);
    expect(hamming("0000000000000001", "0000000000000000")).toBe(1);
    expect(hamming("ffffffffffffffff", "0000000000000000")).toBe(64);
    expect(hamming("f0f0f0f0f0f0f0f0", "0f0f0f0f0f0f0f0f")).toBe(64);
    expect(hamming("short", "0000000000000000")).toBe(64); // wrong length → max distance
  });
});
