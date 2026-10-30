import { describe, expect, it } from "vitest";
import { checkEmbed, frameDecision, knownEmbed, parseMeta } from "../../src/lib/embedCheck";

const hdr = (o: Record<string, string>) => ({
  get: (k: string) => o[k.toLowerCase()] ?? null,
});

describe("may this page be shown inside a section?", () => {
  it("refuses DENY and SAMEORIGIN, ignores ALLOW-FROM", () => {
    expect(frameDecision(hdr({ "x-frame-options": "DENY" }))).toBe(false);
    expect(frameDecision(hdr({ "x-frame-options": "SAMEORIGIN, SAMEORIGIN" }))).toBe(false);
    expect(frameDecision(hdr({ "x-frame-options": "ALLOW-FROM https://weered.ca" }))).toBe(true);
    expect(frameDecision(hdr({}))).toBe(true);
  });

  it("reads frame-ancestors: named hosts refuse, a wildcard allows", () => {
    expect(
      frameDecision(
        hdr({ "content-security-policy": "default-src 'self'; frame-ancestors 'self'" }),
      ),
    ).toBe(false);
    expect(
      frameDecision(
        hdr({ "content-security-policy": "frame-ancestors 'self' https://app.notion.com" }),
      ),
    ).toBe(false);
    expect(frameDecision(hdr({ "content-security-policy": "frame-ancestors *" }))).toBe(true);
    expect(frameDecision(hdr({ "content-security-policy": "frame-ancestors https:" }))).toBe(true);
    expect(frameDecision(hdr({ "content-security-policy": "default-src 'self'" }))).toBe(true);
  });
});

describe("official embeds", () => {
  it("turns Google and Figma links into their embed addresses", () => {
    expect(knownEmbed(new URL("https://docs.google.com/document/d/e/2PACX-1x/pub"))).toBe(
      "https://docs.google.com/document/d/e/2PACX-1x/pub?embedded=true",
    );
    expect(knownEmbed(new URL("https://docs.google.com/spreadsheets/d/e/2PACX-1y/pubhtml"))).toBe(
      "https://docs.google.com/spreadsheets/d/e/2PACX-1y/pubhtml?widget=true&headers=false",
    );
    expect(knownEmbed(new URL("https://docs.google.com/presentation/d/e/2PACX-1z/pub"))).toBe(
      "https://docs.google.com/presentation/d/e/2PACX-1z/embed",
    );
    expect(knownEmbed(new URL("https://docs.google.com/document/d/abc_123/edit#heading=h"))).toBe(
      "https://docs.google.com/document/d/abc_123/preview",
    );
    expect(knownEmbed(new URL("https://www.figma.com/design/Ab12/My-File"))).toBe(
      "https://www.figma.com/embed?embed_host=weered&url=" +
        encodeURIComponent("https://www.figma.com/design/Ab12/My-File"),
    );
    expect(knownEmbed(new URL("https://discord.com/widget?id=123"))).toBe(
      "https://discord.com/widget?id=123",
    );
    expect(knownEmbed(new URL("https://example.com/page"))).toBeNull();
  });
});

describe("link cards", () => {
  it("takes the title, description, picture and icon from <head>", () => {
    const html = `<!doctype html><html><head>
      <title>Plain &amp; simple</title>
      <meta content="Club nights &amp; results" property="og:description">
      <meta property="og:title" content="Medicine Hat Bridge">
      <meta property="og:image" content="/img/card.png">
      <meta property="og:site_name" content="MH Bridge">
      <link rel="icon" href="//cdn.example.com/fav.png">
      </head><body><meta property="og:title" content="not this"></body></html>`;
    const m = parseMeta(html, new URL("https://club.example.com/home"));
    expect(m.title).toBe("Medicine Hat Bridge");
    expect(m.description).toBe("Club nights & results");
    expect(m.image).toBe("https://club.example.com/img/card.png");
    expect(m.icon).toBe("https://cdn.example.com/fav.png");
    expect(m.site).toBe("MH Bridge");
  });

  it("drops non-https pictures and falls back to the title tag and host", () => {
    const m = parseMeta(
      `<head><title> Just <b>a</b> page </title><meta property="og:image" content="http://x.test/a.png"></head>`,
      new URL("https://www.example.org/"),
    );
    expect(m.title).toBe("Just a page");
    expect(m.image).toBeUndefined();
    expect(m.site).toBe("example.org");
    expect(m.icon).toBe("https://www.example.org/favicon.ico");
  });

  it("refuses anything but https without fetching", async () => {
    expect(await checkEmbed("http://example.com")).toEqual({ ok: false, error: "https_only" });
    expect(await checkEmbed("javascript:alert(1)")).toEqual({ ok: false, error: "https_only" });
    expect(await checkEmbed("not a url")).toEqual({ ok: false, error: "bad_url" });
  });

  it("answers official embeds without fetching", async () => {
    const r = await checkEmbed("https://discord.com/widget?id=42");
    expect(r).toMatchObject({
      ok: true,
      frameable: true,
      embedUrl: "https://discord.com/widget?id=42",
    });
  });
});
