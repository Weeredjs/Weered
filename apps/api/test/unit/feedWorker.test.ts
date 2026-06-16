import { describe, it, expect } from "vitest";
import { domainOf, roomIdFromUrl, recencyScore } from "../../src/lib/feedWorker";

describe("feedWorker helpers", () => {
  it("domainOf strips www, returns hostname, falls back on garbage", () => {
    expect(domainOf("https://www.example.com/path?q=1")).toBe("example.com");
    expect(domainOf("https://sub.foo.org")).toBe("sub.foo.org");
    expect(domainOf("not a url")).toBe("not a url");
  });
  it("roomIdFromUrl is deterministic and prefixed", () => {
    const a = roomIdFromUrl("https://x.com/article");
    expect(a).toBe(roomIdFromUrl("https://x.com/article"));
    expect(a.startsWith("article_")).toBe(true);
    expect(roomIdFromUrl("https://y.com")).not.toBe(a);
  });
  it("recencyScore decays with age", () => {
    expect(recencyScore(new Date())).toBe(70);
    expect(recencyScore(new Date(Date.now() - 2 * 3600000))).toBe(60);
    expect(recencyScore(new Date(Date.now() - 5 * 3600000))).toBe(50);
    expect(recencyScore(new Date(Date.now() - 100 * 3600000))).toBe(5);
  });
});
