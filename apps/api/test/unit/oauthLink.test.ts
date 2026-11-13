import { beforeAll, describe, expect, it } from "vitest";
import { finishLink, linkCookie, linkNonce, signOAuthState } from "../../src/lib/oauthState";

// Linking a game account finishes only in the browser that started it
// (fan-out audit, 2026-11-13): an attacker's link, approved by a victim, used
// to file the victim's game account under the attacker's Weered account.
describe("game account links", () => {
  beforeAll(() => {
    process.env.JWT_SECRET ||= "unit-test-secret";
  });

  it("finish for the account that started, in the browser that started", () => {
    const n = linkNonce();
    const state = signOAuthState("user-a", n);
    expect(finishLink(state, n)).toBe("user-a");
  });

  it("refuse a link finished in another browser", () => {
    const state = signOAuthState("attacker", linkNonce());
    expect(finishLink(state, "")).toBeNull();
    expect(finishLink(state, linkNonce())).toBeNull();
  });

  it("refuse a state with no browser value, and a forged one", () => {
    expect(finishLink(signOAuthState("a"), "")).toBeNull();
    const n = linkNonce();
    const state = signOAuthState("a", n);
    expect(finishLink(state.slice(0, -2) + "xx", n)).toBeNull();
  });

  it("the cookie is short-lived, http-only and scoped to the link's own paths", () => {
    const c = linkCookie("bungie", "abc");
    expect(c).toMatch(/^weered_link_bungie=abc;/);
    expect(c).toContain("HttpOnly");
    expect(c).toContain("Secure");
    expect(c).toContain("Path=/auth/bungie");
    expect(c).toContain("Max-Age=600");
  });
});
