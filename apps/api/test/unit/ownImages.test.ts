import { describe, it, expect } from "vitest";
import { crewImageOk, ownImageOk, ownsUploadName } from "../../src/lib/ownImages";

// Avatars and banners by address (red team 2026-11-01, findings 16 and 17).
const SITE = "https://api.weered.ca";
describe("pictures someone may set by address", () => {
  it("takes their own upload, one of ours, what they have, or nothing", () => {
    expect(ownImageOk("avatars", `${SITE}/avatars/u1-1793500000000.webp`, "u1")).toBe(true);
    expect(ownImageOk("avatars", "/brand/avatars/pilot.svg", "u1")).toBe(true);
    const google = "https://lh3.googleusercontent.com/a/abc=s96-c";
    expect(ownImageOk("avatars", google, "u1", google)).toBe(true);
    expect(ownImageOk("avatars", "", "u1")).toBe(true);
  });

  it("refuses someone else's upload, outside images and tricks", () => {
    expect(ownImageOk("avatars", `${SITE}/avatars/u2-1793500000000.webp`, "u1")).toBe(false);
    expect(ownImageOk("avatars", "https://evil.example/x.png", "u1")).toBe(false);
    expect(ownImageOk("avatars", "https://lh3.googleusercontent.com/a/other", "u1", "x")).toBe(
      false,
    );
    expect(ownImageOk("avatars", "/brand/../uploads/avatars/u2-1.webp", "u1")).toBe(false);
    expect(ownImageOk("banners", `${SITE}/banners/u1-12.webp/../u2-1.webp`, "u1")).toBe(false);
  });

  it("lets an upload delete only the uploader's own old file", () => {
    expect(ownsUploadName("u1-1793500000000.webp", "u1")).toBe(true);
    expect(ownsUploadName("u2-1793500000000.webp", "u1")).toBe(false);
    expect(ownsUploadName("lobby-banner-u1-1.webp", "u1")).toBe(false);
  });
});

// A crew's logo and banner (2026-11-05): the same rule, for the crew's own uploads.
describe("crew pictures by address", () => {
  it("takes the crew's own upload, one of ours, what it has, or nothing", () => {
    expect(crewImageOk(`${SITE}/banners/crew-c1-logo-1793900000000.webp`, "c1")).toBe(true);
    expect(crewImageOk(`${SITE}/banners/crew-c1-banner-1793900000000.webp`, "c1")).toBe(true);
    expect(crewImageOk("/brand/avatars/pilot.svg", "c1")).toBe(true);
    const had = `${SITE}/banners/lobby-crewlogo-u1-1793818426652.webp`;
    expect(crewImageOk(had, "c1", had)).toBe(true);
    expect(crewImageOk("", "c1")).toBe(true);
  });

  it("refuses an outside picture, another crew's file, and anything that isn't one", () => {
    expect(crewImageOk("https://evil.example/x.png", "c1")).toBe(false);
    expect(crewImageOk(`${SITE}/banners/crew-c2-logo-1793900000000.webp`, "c1")).toBe(false);
    expect(crewImageOk(`${SITE}/banners/crew-c1-logo-x.webp`, "c1")).toBe(false);
    expect(crewImageOk(`${SITE}/banners/u1-1793900000000.webp`, "c1")).toBe(false);
    expect(crewImageOk(`${SITE}/banners/crew--logo-1793900000000.webp`, "")).toBe(false);
  });
});
