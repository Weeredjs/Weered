import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { dHash, hamming } from "../../src/lib/imageModeration";

// A 16x16 left-black / right-white split — gives a non-degenerate hash with a
// clear vertical transition, so re-encoding it must land within Hamming-4.
async function splitImage(fmt: "png" | "jpeg" | "webp"): Promise<Buffer> {
  const w = 16,
    h = 16;
  const raw = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    const x = i % w;
    const v = x < w / 2 ? 0 : 255;
    raw[i * 3] = v;
    raw[i * 3 + 1] = v;
    raw[i * 3 + 2] = v;
  }
  return sharp(raw, { raw: { width: w, height: h, channels: 3 } })[fmt]().toBuffer();
}

describe("imageModeration primitives", () => {
  it("dHash is 16 hex chars, non-degenerate, and stable across re-encodes", async () => {
    const a = await dHash(await splitImage("png"));
    const b = await dHash(await splitImage("webp"));
    const c = await dHash(await splitImage("jpeg"));
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(a).not.toBe("0000000000000000");
    // Same image, different codecs → perceptual hash barely moves.
    expect(hamming(a, b)).toBeLessThanOrEqual(4);
    expect(hamming(a, c)).toBeLessThanOrEqual(4);
  });

  it("hamming counts differing bits and guards bad input", () => {
    expect(hamming("0000000000000000", "0000000000000000")).toBe(0);
    expect(hamming("0000000000000001", "0000000000000000")).toBe(1);
    expect(hamming("ffffffffffffffff", "0000000000000000")).toBe(64);
    expect(hamming("f0f0f0f0f0f0f0f0", "0f0f0f0f0f0f0f0f")).toBe(64);
    expect(hamming("short", "0000000000000000")).toBe(64); // wrong length → max distance
  });
});
