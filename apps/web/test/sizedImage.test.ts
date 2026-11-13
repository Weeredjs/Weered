import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { resizerTakes, sizedImage } from "../lib/sizedImage";

// The site's image resizer fetches a picture, resizes it and keeps a copy.
// Until the hardening pass of 2026-11-12 its list of hosts ended with "**":
// any https address on the internet. That made weered.ca an open image proxy,
// each new address costing the server a download and a resize, and the access
// log already showed scanners aiming it at internal addresses (refused).
const require = createRequire(import.meta.url);

describe("what the resizer may fetch", () => {
  const config = require("../next.config.js");
  const patterns: { protocol: string; hostname: string }[] = config.images.remotePatterns;

  it("is a list of named hosts, https only, with no catch-all", () => {
    expect(patterns.length).toBeGreaterThan(5);
    for (const p of patterns) {
      expect(p.protocol).toBe("https");
      // A name, or every name under one: never "**" or "**.com".
      expect(p.hostname, p.hostname).toMatch(/^(\*\*\.)?[a-z0-9-]+(\.[a-z0-9-]+)+$/);
      expect(p.hostname.replace(/^\*\*\./, "").split(".").length, p.hostname).toBeGreaterThan(1);
    }
    expect(patterns.some((p) => p.hostname === "weered.ca")).toBe(true);
    expect(patterns.some((p) => p.hostname === "**.weered.ca")).toBe(true);
  });
});

describe("whether a page sends a picture through the resizer", () => {
  it("does for our own files and the hosts on the list", () => {
    expect(resizerTakes("/brand/lobbies/study-banner-1.png")).toBe(true);
    expect(resizerTakes("https://api.weered.ca/banners/lobby-banner-abc.webp")).toBe(true);
    expect(resizerTakes("https://weered.ca/og-image.png")).toBe(true);
    expect(resizerTakes("https://i.redd.it/abc.jpg")).toBe(true);
    expect(resizerTakes("https://lh3.googleusercontent.com/a/photo")).toBe(true);
  });

  it("doesn't for anyone else's host, so the browser loads those itself", () => {
    expect(resizerTakes("https://example.com/banner.png")).toBe(false);
    expect(resizerTakes("https://evilweered.ca/x.png")).toBe(false);
    expect(resizerTakes("https://weered.ca.example.net/x.png")).toBe(false);
    // The bare domain isn't "a name under it".
    expect(resizerTakes("https://googleusercontent.com/x.png")).toBe(false);
    expect(resizerTakes("http://169.254.169.254/latest/meta-data/")).toBe(false);
    expect(resizerTakes("https://169.254.169.254/x.png")).toBe(false);
    expect(resizerTakes("http://weered.ca/x.png")).toBe(false);
  });

  it("doesn't for what the resizer refuses or flattens", () => {
    expect(resizerTakes("/brand/logo/weered-logo.svg")).toBe(false);
    expect(resizerTakes("https://api.weered.ca/banners/x.gif")).toBe(false);
    expect(resizerTakes("/brand/lobbies/a.png?v=2")).toBe(false);
    // A local path outside /brand isn't one of our static files.
    expect(resizerTakes("/banners/x.webp")).toBe(false);
    expect(resizerTakes("")).toBe(false);
    expect(resizerTakes(null)).toBe(false);
    expect(resizerTakes("not a link")).toBe(false);
  });
});

describe("a resized address", () => {
  it("is made for our own pictures, and left alone for the rest", () => {
    expect(sizedImage("/brand/lobbies/study-banner-1.png", 640)).toBe(
      "/_next/image?url=%2Fbrand%2Flobbies%2Fstudy-banner-1.png&w=640&q=75",
    );
    expect(sizedImage("https://example.com/banner.png")).toBe("https://example.com/banner.png");
    expect(sizedImage(null)).toBe("");
  });
});
