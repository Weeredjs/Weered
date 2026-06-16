import { describe, it, expect, beforeAll } from "vitest";
import { createHmac } from "node:crypto";
import { signOAuthState, verifyOAuthState } from "../../src/lib/oauthState";

beforeAll(() => {
  process.env.JWT_SECRET = "test-oauth-secret";
});

describe("oauthState", () => {
  it("round-trips a userId through sign/verify", () => {
    expect(verifyOAuthState(signOAuthState("user-123"))).toBe("user-123");
  });
  it("rejects a tampered payload", () => {
    const [payload, sig] = signOAuthState("user-123").split(".");
    const flipped = payload.slice(0, -1) + (payload.slice(-1) === "A" ? "B" : "A");
    expect(verifyOAuthState(`${flipped}.${sig}`)).toBeNull();
  });
  it("rejects a tampered signature", () => {
    expect(verifyOAuthState(signOAuthState("user-123") + "x")).toBeNull();
  });
  it("rejects malformed state", () => {
    expect(verifyOAuthState("garbage")).toBeNull();
    expect(verifyOAuthState("")).toBeNull();
  });
  it("rejects an expired state", () => {
    const old = Buffer.from(JSON.stringify({ u: "u1", t: Date.now() - 11 * 60 * 1000 })).toString(
      "base64url",
    );
    const sig = createHmac("sha256", process.env.JWT_SECRET!).update(old).digest("base64url");
    expect(verifyOAuthState(`${old}.${sig}`)).toBeNull();
  });
  it("throws when signing without a secret in production", () => {
    const s = process.env.JWT_SECRET,
      e = process.env.NODE_ENV;
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = "production";
    try {
      expect(() => signOAuthState("u1")).toThrow();
    } finally {
      process.env.JWT_SECRET = s;
      process.env.NODE_ENV = e;
    }
  });
});
