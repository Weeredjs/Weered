import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { elementBlocks, findTags, firstInner, readCapped, tagAttrs } from "../../src/lib/htmlScan";
import { parseMeta } from "../../src/lib/embedCheck";
import { parseFeed } from "../../src/lib/lobbyAutomations";

// Reading pages and feeds a stranger's server wrote (lib/htmlScan.ts). Each
// test below is built to the shape that held the API for seconds or minutes
// with the patterns this replaced (fan-out audit, 2026-11-13). Each must finish
// in well under a second, even with the whole suite running.

const time = (fn: () => unknown) => {
  const t = performance.now();
  fn();
  return performance.now() - t;
};

describe("finding tags", () => {
  it("reads ordinary meta tags, links and a title", () => {
    const html =
      '<html><head><title>Club &amp; Co</title><meta property="og:title" content="Hello">' +
      '<META name=description content="A club"><link rel="icon" href="/i.png"></head><body>';
    const metas = findTags(html, "meta").map(tagAttrs);
    expect(metas).toEqual([
      { property: "og:title", content: "Hello" },
      { name: "description", content: "A club" },
    ]);
    expect(findTags(html, "link").map(tagAttrs)[0].href).toBe("/i.png");
    expect(firstInner(html, "title")).toBe("Club &amp; Co");
    expect(findTags(html, "metadata")).toEqual([]);
  });

  it("takes one pass over 256 KB of openings with no close", () => {
    const evil = "<meta ".repeat(43_000) + "<link ".repeat(43_000);
    expect(time(() => findTags(evil, "meta"))).toBeLessThan(500);
    expect(time(() => findTags(evil, "link"))).toBeLessThan(500);
    expect(time(() => firstInner(evil, "title"))).toBeLessThan(500);
    expect(time(() => parseMeta(evil, new URL("https://evil.example/")))).toBeLessThan(1000);
  });

  it("passes over a tag longer than its limit and keeps reading", () => {
    const html = "<meta " + "a".repeat(10_000) + '><meta name="x" content="y">';
    expect(findTags(html, "meta").map(tagAttrs)).toEqual([{ name: "x", content: "y" }]);
  });
});

describe("reading a feed", () => {
  const rss = `<?xml version="1.0"?><rss><channel><title>The Club</title>
    <item><title>First</title><link>https://club.example/1</link><guid>g1</guid></item>
    <item><title><![CDATA[Second]]></title><link>https://club.example/2</link></item>
  </channel></rss>`;
  const atom = `<feed><title>Atom Club</title>
    <entry><title>Post</title><link rel="alternate" href="https://a.example/p"/><id>tag:1</id>
      <author><name>Sam</name></author></entry></feed>`;

  it("reads RSS items and Atom entries as before", () => {
    expect(parseFeed(rss)).toEqual([
      { id: "g1", title: "First", link: "https://club.example/1", name: "The Club" },
      {
        id: "https://club.example/2",
        title: "Second",
        link: "https://club.example/2",
        name: "The Club",
      },
    ]);
    expect(parseFeed(atom)).toEqual([
      { id: "tag:1", title: "Post", link: "https://a.example/p", name: "Sam" },
    ]);
  });

  it("takes one pass over a megabyte of openings with no close", () => {
    expect(time(() => parseFeed("<title>".repeat(150_000)))).toBeLessThan(1000);
    expect(time(() => parseFeed("<item>".repeat(170_000)))).toBeLessThan(1000);
    expect(time(() => parseFeed("<item><title>" + "<link ".repeat(150_000)))).toBeLessThan(1000);
  });

  it("stops at 30 items", () => {
    const many = "<item><title>t</title><link>https://x.example/a</link></item>".repeat(100);
    expect(parseFeed(many)).toHaveLength(30);
    expect(elementBlocks(many, ["item"], { limit: 5 })).toHaveLength(5);
  });
});

// A body that arrives in pieces, as it does from a server, and counts how
// many pieces were asked for.
function inPieces(parts: string[]) {
  let asked = 0;
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    pull(c) {
      if (asked < parts.length) c.enqueue(enc.encode(parts[asked++]));
      else c.close();
    },
  });
  return { res: new Response(body), asked: () => asked };
}

describe("reading a body", () => {
  it("stops at its limit, however much the server sends", async () => {
    const { res, asked } = inPieces(Array.from({ length: 300 }, () => "x".repeat(16 * 1024)));
    const got = await readCapped(res, 64 * 1024);
    expect(got.length).toBeLessThanOrEqual(64 * 1024);
    expect(asked()).toBeLessThan(10);
  });

  it("stops at the mark once it has arrived", async () => {
    const { res, asked } = inPieces([
      "<head><title>t</title>",
      "</head><body>",
      ...Array.from({ length: 100 }, () => "y".repeat(16 * 1024)),
    ]);
    const got = await readCapped(res, 2_000_000, /<\/head\s*>/i);
    expect(got).toContain("</head>");
    expect(asked()).toBeLessThan(5);
  });
});

describe("no route or worker runs a pattern over a stranger's page", () => {
  it("the old tag patterns are gone from the API", () => {
    const SRC = join(__dirname, "..", "..", "src");
    const files: string[] = [];
    const walk = (d: string) => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) walk(p);
        else if (n.endsWith(".ts")) files.push(p);
      }
    };
    walk(SRC);
    const bad: string[] = [];
    for (const f of files) {
      const t = readFileSync(f, "utf8");
      if (f.endsWith("htmlScan.ts")) continue; // names the old patterns in its notes
      if (/<meta\[\^>\]|<meta\\b\[\^>\]|<link\\b\[\^>\]|<title\[\^>\]\*>\(\[\\s\\S\]/.test(t))
        bad.push(relative(SRC, f).replace(/\\/g, "/"));
    }
    expect(bad).toEqual([]);
  });
});

describe("the AI builder's code checks", () => {
  it("still refuse what they refused, open tags included, in one pass", async () => {
    const { cleanCode } = await import("../../src/lib/build/jobs/code");
    const ok = (code: string) => cleanCode({ code: code.padEnd(40, " ") }, "m").ok;
    expect(ok('<div><a href="#top">Top</a></div>')).toBe(true);
    expect(ok('<meta http-equiv="refresh" content="0;url=https://x.example">')).toBe(false);
    expect(ok('<script src="https://x.example/a.js"></script>')).toBe(false);
    expect(ok('<a href="https://x.example">go</a>')).toBe(false);
    expect(ok('<p>hi</p><a\nhref="javascript:alert(1)">x</a>')).toBe(false);
    expect(ok('<p>hi</p><script src="https://x.example/a.js"')).toBe(false);
    const t = performance.now();
    ok("<meta ".repeat(3400));
    ok("<a ".repeat(7000));
    expect(performance.now() - t).toBeLessThan(1000);
  });
});
