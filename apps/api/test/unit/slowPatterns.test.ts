import { describe, expect, it } from "vitest";
import { normalizeHost } from "../../src/routes/lobbyDesign";
import { slugOf } from "../../src/routes/lobbyExtras";
import { givenChannel } from "../../src/lib/build/common";
import { forumExcerpt } from "../../src/lib/forumPreview";

// Hardening pass 2026-11-12. Four places tidied text with a pattern whose time
// grew with the square of what it was given. On 60,000 characters each took
// 2.4 seconds; on the megabyte a request body may hold, about eleven minutes,
// and the API does one thing at a time, so everyone waited. The domain box was
// the worst: anyone with a lobby could send it, and two public addresses took
// the same text from the query string.
//
// Each now reads a short string and cuts with a plain split. These hold both
// halves: hostile input costs nothing, and ordinary input reads as it did.

/** Run it and say how long it took, in milliseconds. */
function timed<T>(fn: () => T): [T, number] {
  const t = performance.now();
  const out = fn();
  return [out, performance.now() - t];
}
// Was seconds to minutes. Generous for a busy CI machine.
const AT_ONCE = 250;

describe("a custom domain, however it's typed", () => {
  it("refuses a megabyte of question marks at once", () => {
    const [host, ms] = timed(() => normalizeHost("?".repeat(1_000_000) + "\nx"));
    expect(host).toBeNull();
    expect(ms).toBeLessThan(AT_ONCE);
  });

  it("refuses a long run of digits after a colon at once", () => {
    const [host, ms] = timed(() => normalizeHost("club.example.com:" + "1".repeat(500_000) + "x"));
    expect(host).toBeNull();
    expect(ms).toBeLessThan(AT_ONCE);
  });

  it("still reads the name out of what people paste", () => {
    expect(normalizeHost("club.example.com")).toBe("club.example.com");
    expect(normalizeHost("  Club.Example.COM  ")).toBe("club.example.com");
    expect(normalizeHost("https://club.example.com/members?x=1#top")).toBe("club.example.com");
    expect(normalizeHost("http://club.example.com:8443/")).toBe("club.example.com");
    expect(normalizeHost("club.example.com.")).toBe("club.example.com");
    expect(normalizeHost("club.example.com?ref=a")).toBe("club.example.com");
  });

  it("still refuses what isn't a domain someone could own", () => {
    for (const no of ["", "nope", "weered.ca", "x.weered.ca", "localhost", "a b.com", "-bad.com"])
      expect(normalizeHost(no), no).toBeNull();
    expect(normalizeHost(null)).toBeNull();
    expect(normalizeHost("a".repeat(300) + ".com")).toBeNull();
  });
});

describe("a page's address from its title", () => {
  it("is made at once from a hundred thousand dashes", () => {
    const [slug, ms] = timed(() => slugOf("a" + "-".repeat(100_000) + "a"));
    expect(slug).toBe("a");
    expect(ms).toBeLessThan(AT_ONCE);
  });

  it("reads as it did", () => {
    expect(slugOf("  Hello, World!  ")).toBe("hello-world");
    expect(slugOf("Rules & House Style")).toBe("rules-house-style");
    expect(slugOf("Crème brûlée")).toBe("creme-brulee");
    expect(slugOf("---")).toBe("page");
    expect(slugOf("")).toBe("page");
    expect(slugOf("x".repeat(80))).toHaveLength(48);
  });
});

describe("a Twitch channel someone named", () => {
  it("is read at once from half a million slashes", () => {
    const [ch, ms] = timed(() => givenChannel("/".repeat(500_000) + "\nx", "anything"));
    expect(ch).toBeUndefined();
    expect(ms).toBeLessThan(AT_ONCE);
  });

  it("reads as it did", () => {
    expect(givenChannel("https://www.twitch.tv/shroud/videos", "go watch shroud")).toBe("shroud");
    expect(givenChannel("@Shroud", "go watch shroud")).toBe("Shroud");
    // Only a channel the person themselves named.
    expect(givenChannel("someoneelse", "go watch shroud")).toBeUndefined();
    expect(givenChannel("no spaces allowed", "no spaces allowed")).toBeUndefined();
  });
});

describe("a post's preview", () => {
  it("is cut at once from a post made to be slow", () => {
    // A list item of ten thousand asterisks: the line pattern and the one that
    // trims a line's closing marks both ran the whole post before.
    const hostile = "- " + "*".repeat(9_990) + " x";
    const [text, ms] = timed(() => forumExcerpt(hostile));
    expect(typeof text).toBe("string");
    expect(ms).toBeLessThan(AT_ONCE);
  });

  it("is still the start of the post", () => {
    expect(forumExcerpt("## Friday\n\nBring **snacks** and a [deck](https://x.test/d).")).toBe(
      "Friday. Bring snacks and a deck.",
    );
    const long = "word ".repeat(2000);
    expect(forumExcerpt(long).length).toBeLessThanOrEqual(241);
    expect(forumExcerpt(long).endsWith("…")).toBe(true);
  });
});
