import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isPushEndpoint } from "../../src/routes/notifications";

// Fan-out audit, 2026-11-13: where a member could mint Paper, or point this
// server at an address of their choosing.

const SRC = join(__dirname, "..", "..", "src");

describe("push subscriptions", () => {
  it("take the browsers' own push services and nothing else", () => {
    for (const ok of [
      "https://fcm.googleapis.com/fcm/send/abc",
      "https://wns2-bl2p.notify.windows.com/w/?token=x",
      "https://updates.push.services.mozilla.com/wpush/v2/x",
      "https://web.push.apple.com/QK1",
    ])
      expect(isPushEndpoint(ok), ok).toBe(true);
    for (const bad of [
      "https://attacker.example/x",
      "http://fcm.googleapis.com/x",
      "https://fcm.googleapis.com.evil.example/x",
      "https://fcm.googleapis.com:8443/x",
      "https://127.0.0.1/x",
      { endpoint: "https://fcm.googleapis.com/x" },
      "https://fcm.googleapis.com/" + "x".repeat(3000),
    ])
      expect(isPushEndpoint(bad), String(bad).slice(0, 60)).toBe(false);
  });
});

describe("FakeOut pending orders", () => {
  const src = readFileSync(join(SRC, "routes", "trading.ts"), "utf8");
  it("fill at the market price, never at the price typed", () => {
    expect(src).toContain("const fillPrice = cp;");
    expect(src).not.toContain("const fillPrice = order.price;");
  });
  it("are placed only near the market, and only a handful per account", () => {
    expect(src).toContain("price_out_of_range");
    expect(src).toContain("too_many_pending");
  });
});

describe("voice passes", () => {
  const src = readFileSync(join(SRC, "routes", "voice.ts"), "utf8");
  it("live ten minutes, and the office's call needs a seat", () => {
    expect(src).toMatch(/ttl:\s*"10m"/);
    expect(src).toMatch(/isOfficeRoom\(lookup\) && !isOwnerOrMod && !room\.users\?\.has\(u\.id\)/);
  });
});
