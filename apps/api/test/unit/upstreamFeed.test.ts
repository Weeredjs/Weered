import { describe, expect, it } from "vitest";
import { makeFeed } from "../../src/lib/upstreamFeed";

// A feed from someone else's API (lib/upstreamFeed.ts, hardening pass
// 2026-11-12). The Helldivers 2 API timed out about 2,500 times in a week;
// every visitor's request then waited the full 8 seconds on it, to be told
// there was nothing, while what we'd heard three minutes earlier was thrown
// away.
function clock() {
  let t = 1_000_000;
  return { now: () => t, pass: (ms: number) => (t += ms) };
}
const MIN = 60_000;

describe("what we keep of a feed", () => {
  it("is current for a while, then old but still an answer, then gone", () => {
    const c = clock();
    const feed = makeFeed({ freshMs: 160_000, staleMs: 30 * MIN, now: c.now });
    feed.set("war", { players: 9 });
    expect(feed.fresh("war")).toEqual({ players: 9 });

    c.pass(161_000);
    expect(feed.fresh("war")).toBeNull();
    expect(feed.last("war")).toEqual({ players: 9 });

    c.pass(30 * MIN);
    expect(feed.last("war")).toBeNull();
    expect(feed.last("nothing kept")).toBeNull();
  });
});

describe("when the API is left alone", () => {
  it("is asked again after one or two failures, and left alone after three", () => {
    const c = clock();
    const feed = makeFeed({ now: c.now });
    expect(feed.failed()).toBe(false);
    expect(feed.failed()).toBe(false);
    expect(feed.resting()).toBe(false);
    // The third in a row starts a rest, and says so once.
    expect(feed.failed()).toBe(true);
    expect(feed.resting()).toBe(true);
    expect(feed.restMinutes()).toBe(1);
  });

  it("rests a minute, then twice as long each time it's still failing, to fifteen", () => {
    const c = clock();
    const feed = makeFeed({ now: c.now });
    feed.failed();
    feed.failed();
    feed.failed();
    c.pass(MIN + 1);
    expect(feed.resting()).toBe(false);

    const rests: number[] = [];
    for (let i = 0; i < 6; i++) {
      // Asked again after the rest, and it fails again: a new, longer rest.
      expect(feed.failed()).toBe(true);
      rests.push(feed.restMinutes());
      c.pass(feed.restMinutes() * MIN + 1);
    }
    expect(rests).toEqual([2, 4, 8, 15, 15, 15]);
  });

  it("is back to normal after one good answer", () => {
    const c = clock();
    const feed = makeFeed({ now: c.now });
    for (let i = 0; i < 5; i++) feed.failed();
    expect(feed.resting()).toBe(true);
    feed.ok();
    expect(feed.resting()).toBe(false);
    // And it takes three in a row again.
    expect(feed.failed()).toBe(false);
    expect(feed.failed()).toBe(false);
    expect(feed.failed()).toBe(true);
  });

  it("a failure that lands during a rest doesn't announce another", () => {
    const c = clock();
    const feed = makeFeed({ now: c.now });
    feed.failed();
    feed.failed();
    expect(feed.failed()).toBe(true);
    // A request already on its way when the rest began comes back failed.
    expect(feed.failed()).toBe(false);
    expect(feed.resting()).toBe(true);
  });
});
