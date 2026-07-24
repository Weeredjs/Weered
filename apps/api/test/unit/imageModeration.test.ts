import { describe, it, expect, vi, beforeEach } from "vitest";
import sharp from "sharp";

// Control the lib's DB + ML dependencies without a database or real models.
const H = vi.hoisted(() => ({
  blocked: [] as { phash: string }[],
  preds: [{ className: "Neutral", probability: 0.99 }] as { className: string; probability: number }[],
  userUpdate: vi.fn(async () => ({})),
}));
vi.mock("../../src/lib/prisma", () => ({
  prisma: {
    blockedImageHash: { findMany: async () => H.blocked },
    user: { update: H.userUpdate },
  },
}));
vi.mock("@tensorflow/tfjs", () => ({ tensor3d: () => ({ dispose: () => {} }) }));
vi.mock("nsfwjs", () => ({ load: async () => ({ classify: async () => H.preds }) }));

import {
  dHash,
  hamming,
  isHashBlocked,
  moderateProfileImage,
  screenImage,
} from "../../src/lib/imageModeration";

// 32x32 vertical stripes (4px black / 4px white) — a structured, non-degenerate
// image with no single hard edge whose lossy ringing would move the hash.
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

beforeEach(() => {
  H.blocked = [];
  H.preds = [{ className: "Neutral", probability: 0.99 }];
  H.userUpdate.mockClear();
  delete process.env.NSFW_SCREEN;
});

describe("dHash / hamming", () => {
  it("dHash is 16 hex chars, non-degenerate, and deterministic", async () => {
    const png = await stripes().png().toBuffer();
    const a = await dHash(png);
    const b = await dHash(png);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(a).not.toBe("0000000000000000");
    expect(a).not.toBe("ffffffffffffffff");
    expect(a).toBe(b);
  });

  it("dHash is format-independent for lossless encodings", async () => {
    const png = await stripes().png().toBuffer();
    const webp = await stripes().webp({ lossless: true }).toBuffer();
    expect(hamming(await dHash(png), await dHash(webp))).toBeLessThanOrEqual(4);
  });

  it("hamming counts differing bits and guards bad input", () => {
    expect(hamming("0000000000000000", "0000000000000000")).toBe(0);
    expect(hamming("0000000000000001", "0000000000000000")).toBe(1);
    expect(hamming("ffffffffffffffff", "0000000000000000")).toBe(64);
    expect(hamming("f0f0f0f0f0f0f0f0", "0f0f0f0f0f0f0f0f")).toBe(64);
    expect(hamming("short", "0000000000000000")).toBe(64);
  });
});

describe("isHashBlocked", () => {
  it("is false for an empty phash or an empty ledger", async () => {
    expect(await isHashBlocked("")).toBe(false);
    expect(await isHashBlocked("0123456789abcdef")).toBe(false);
  });
  it("is true within Hamming-4 of a ledger entry", async () => {
    H.blocked = [{ phash: "0000000000000000" }];
    expect(await isHashBlocked("0000000000000001")).toBe(true); // distance 1
    expect(await isHashBlocked("ffffffffffffffff")).toBe(false); // distance 64
  });
});

describe("moderateProfileImage", () => {
  it("sanitizes a valid image to WebP and returns a phash + dims", async () => {
    const png = await stripes().png().toBuffer();
    const res = await moderateProfileImage(png, { userId: "u1", square: true, maxDim: 512 });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.phash).toMatch(/^[0-9a-f]{16}$/);
      expect(res.width).toBeGreaterThan(0);
      // Output is a WebP (RIFF....WEBP header), never the raw upload.
      expect(res.webp.subarray(0, 4).toString("ascii")).toBe("RIFF");
      expect(res.webp.subarray(8, 12).toString("ascii")).toBe("WEBP");
    }
  });

  it("blocks a ledgered hash and media-bans the uploader", async () => {
    const png = await stripes().png().toBuffer();
    const first = await moderateProfileImage(png, { userId: "u2", square: true });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    H.blocked = [{ phash: first.phash }]; // same input re-encodes to the same phash
    const second = await moderateProfileImage(png, { userId: "u2", square: true });
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.code).toBe(403);
      expect(second.error).toBe("blocked_content");
    }
    expect(H.userUpdate).toHaveBeenCalledTimes(1);
  });

  it("rejects a non-image buffer", async () => {
    const res = await moderateProfileImage(Buffer.from("definitely not an image"), { userId: "u3" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe(400);
      expect(res.error).toBe("bad_image");
    }
  });
});

describe("screenImage", () => {
  it("passes through when NSFW_SCREEN is off", async () => {
    const webp = await stripes().webp().toBuffer();
    expect(await screenImage(webp)).toEqual({ ok: true });
  });

  it("allows a neutral image when screening is on", async () => {
    process.env.NSFW_SCREEN = "1";
    const webp = await stripes().webp().toBuffer();
    expect((await screenImage(webp)).ok).toBe(true);
  });

  it("blocks an explicit image when screening is on", async () => {
    process.env.NSFW_SCREEN = "1";
    H.preds = [{ className: "Porn", probability: 0.95 }];
    const webp = await stripes().webp().toBuffer();
    const r = await screenImage(webp);
    expect(r.ok).toBe(false);
    expect(r.label).toBe("Porn");
  });
});
