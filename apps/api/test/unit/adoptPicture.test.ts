import { describe, expect, it } from "vitest";
import {
  adoptPicture,
  fileSafeId,
  isOutsidePicture,
  pictureName,
} from "../../src/lib/adoptPicture";

// Pictures linked from other sites are copied in (James 2026-11-13).
describe("adoptPicture", () => {
  it("knows an outside address from our own", () => {
    expect(isOutsidePicture("https://upload.wikimedia.org/x.png")).toBe(true);
    expect(isOutsidePicture("http://example.com/x.png")).toBe(true);
    expect(isOutsidePicture("https://api.weered.ca/banners/a-1.webp")).toBe(false);
    expect(isOutsidePicture("https://weered.ca/brand/x.png")).toBe(false);
    expect(isOutsidePicture("/brand/lobbies/stem-logo.png")).toBe(false);
    expect(isOutsidePicture("https://weered.ca.evil.com/x.png")).toBe(true);
    expect(isOutsidePicture(null)).toBe(false);
  });

  it("passes our own addresses and empties through without fetching", async () => {
    const o = { kind: "banners" as const, name: "lobby-x-logo", uploaderId: "u1", maxDim: 512 };
    expect(await adoptPicture("/brand/a.png", o)).toEqual({
      ok: true,
      url: "/brand/a.png",
      copied: false,
    });
    expect(await adoptPicture("", o)).toEqual({ ok: true, url: "", copied: false });
    expect(await adoptPicture(null, o)).toEqual({ ok: true, url: null, copied: false });
  });

  it("names files only with file-safe characters", () => {
    expect(fileSafeId("stem")).toBe("stem");
    expect(fileSafeId("a.b/../c")).toMatch(/^[a-f0-9]{16}$/);
    expect(fileSafeId("a.b")).not.toBe(fileSafeId("a_b"));
    expect(pictureName.lobby("x", "logo")).toBe("lobby-x-logo");
    expect(pictureName.room("HJhvdn", "banner")).toBe("room-HJhvdn-banner");
  });

  it("refuses an address it cannot fetch instead of storing the link", async () => {
    const r = await adoptPicture("https://127.0.0.1/x.png", {
      kind: "banners",
      name: "lobby-x-logo",
      uploaderId: "u1",
      maxDim: 512,
    });
    expect(r.ok).toBe(false);
  });
});
