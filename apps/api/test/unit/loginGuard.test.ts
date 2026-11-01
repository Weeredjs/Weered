import { describe, it, expect } from "vitest";
import {
  loginFailed,
  loginPaused,
  loginSucceeded,
  LOGIN_FAILS_MAX,
} from "../../src/lib/loginGuard";

// Guessing one account's password from many addresses (red team 2026-11-01, finding 25).
describe("password guesses per name", () => {
  it("pauses a name after ten wrong tries, for the window only", () => {
    const t = Date.now();
    for (let i = 0; i < LOGIN_FAILS_MAX - 1; i++) loginFailed("victim", t);
    expect(loginPaused("victim", t)).toBe(false);
    loginFailed("victim", t);
    expect(loginPaused("victim", t)).toBe(true);
    expect(loginPaused("someone-else", t)).toBe(false);
    expect(loginPaused("victim", t + 16 * 60_000)).toBe(false);
  });

  it("clears on a right password", () => {
    const t = Date.now();
    for (let i = 0; i < 5; i++) loginFailed("me", t);
    loginSucceeded("me");
    for (let i = 0; i < LOGIN_FAILS_MAX - 1; i++) loginFailed("me", t);
    expect(loginPaused("me", t)).toBe(false);
  });
});
