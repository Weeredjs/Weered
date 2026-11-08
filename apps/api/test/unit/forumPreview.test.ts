import { describe, it, expect } from "vitest";
import { forumExcerpt, forumImage, listedBody } from "../../src/lib/forumPreview";

// The forum list's cards (James 2026-11-08: the forum with expanded
// "Thumbnail and previews").
const SITE = "https://api.weered.ca";
const UPLOAD = `${SITE}/forum-img/cmmgisqb-1794170998957-b816d816b5cb3d40.webp`;

describe("a post's picture in the list", () => {
  it("is its first forum upload or Weered picture, wherever it sits", () => {
    expect(forumImage(`Words first.\n\n![banner](${UPLOAD})`)).toBe(UPLOAD);
    expect(forumImage(`${"x".repeat(5000)}\n![late](${UPLOAD})`)).toBe(UPLOAD);
    expect(forumImage("![mark](/brand/weered-mark.png)")).toBe("/brand/weered-mark.png");
  });

  it("is never an outside address, a trick path or a link", () => {
    expect(forumImage("![x](https://evil.example/pixel.png)")).toBeNull();
    expect(forumImage(`![x](${SITE}/forum-img/../avatars/u1-1.webp)`)).toBeNull();
    expect(forumImage("![x](/brand/../uploads/avatars/u1-1.webp)")).toBeNull();
    expect(forumImage(`[a link](${UPLOAD})`)).toBeNull();
    expect(forumImage("No pictures here.")).toBeNull();
    // An outside picture first doesn't hide ours after it.
    expect(forumImage(`![x](https://evil.example/a.png) ![y](${UPLOAD})`)).toBe(UPLOAD);
  });
});

describe("a post's opening words in the list", () => {
  it("reads as plain text: no pictures, link addresses or markdown marks", () => {
    const body = [
      `![The November Update](${UPLOAD})`,
      "",
      "The streets got a **remodel**.",
      "",
      "## One bar. One search.",
      "",
      "- Four ways in: **Search** and _Downtown_.",
      "> Quoted *line*.",
      "Make your sheet at [weered.ca/rap](https://weered.ca/rap), `||like this||`.",
      "```",
      "code stays out",
      "```",
    ].join("\n");
    expect(forumExcerpt(body)).toBe(
      "The streets got a remodel. One bar. One search. Four ways in: Search and Downtown. Quoted line. Make your sheet at weered.ca/rap, ||like this||.",
    );
  });

  it("ends a heading or list item as a sentence", () => {
    expect(forumExcerpt("## Heads up\n\nThis one has no picture.\n\n- Indicted\n- Felon!")).toBe(
      "Heads up. This one has no picture. Indicted. Felon!",
    );
    expect(forumExcerpt("- **Done.**\n- **Bold item**")).toBe("Done. Bold item.");
  });

  it("keeps an asterisk or underscore that isn't emphasis", () => {
    expect(forumExcerpt("5 * 3 = 15 and snake_case_name stay")).toBe(
      "5 * 3 = 15 and snake_case_name stay",
    );
  });

  it("stops at a word near the limit", () => {
    const out = forumExcerpt("word ".repeat(100), 40);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(41);
    expect(out).not.toMatch(/\s…$/);
  });
});

describe("a post as a list sends it", () => {
  it("carries the start of its body, its preview and its picture", () => {
    const l = listedBody({ body: `Hello.\n![b](${UPLOAD})`, removedAt: null });
    expect(l).toEqual({ body: `Hello.\n![b](${UPLOAD})`, preview: "Hello.", image: UPLOAD });
  });

  it("shows nothing of a removed post", () => {
    expect(listedBody({ body: `Gone.\n![b](${UPLOAD})`, removedAt: new Date() })).toEqual({
      body: "[removed by mod]",
      preview: "",
      image: null,
    });
  });
});
