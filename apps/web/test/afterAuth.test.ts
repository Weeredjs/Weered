// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { joinSignupPath, rememberAfterAuth, takeAfterAuth } from "../lib/afterAuth";

// An invited friend who signs up with Google or Discord comes back to the lobby
// they were invited to, not to /home (2026-11-12 review).
beforeEach(() => sessionStorage.clear());

describe("where someone was headed", () => {
  it("comes back once after Google or Discord, then is forgotten", () => {
    rememberAfterAuth("/lobby/nyan-sakura-lounge?join=1");
    expect(takeAfterAuth()).toBe("/lobby/nyan-sakura-lounge?join=1");
    expect(takeAfterAuth()).toBe("/home");
  });

  it("keeps nothing for the default, and never another site", () => {
    rememberAfterAuth("/home");
    expect(takeAfterAuth("/home")).toBe("/home");
    // A backslash after the first slash reads as another site in some browsers.
    const backslashed = "/" + String.fromCharCode(92) + "evil.example";
    for (const bad of ["//evil.example/x", "https://evil.example", backslashed, ""]) {
      rememberAfterAuth(bad);
      expect(takeAfterAuth()).toBe("/home");
    }
    // Planted by something else in the tab: still refused.
    sessionStorage.setItem("weered_after_auth", "//evil.example");
    expect(takeAfterAuth()).toBe("/home");
  });

  it("sends a signed-out Join to Create account, headed back to join", () => {
    expect(joinSignupPath("nyan-sakura-lounge")).toBe(
      "/login?mode=register&next=%2Flobby%2Fnyan-sakura-lounge%3Fjoin%3D1",
    );
    expect(joinSignupPath("r/all")).toContain("%2Flobby%2Fr%252Fall%3Fjoin%3D1");
  });
});
