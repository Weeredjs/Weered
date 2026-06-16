import { describe, it, expect } from "vitest";
import {
  setAuthCookie,
  clearAuthCookie,
  isWebClient,
  readCookieToken,
  AUTH_COOKIE,
} from "../../src/lib/authCookie";

function mockReply() {
  const headers: Record<string, string> = {};
  return {
    header: (k: string, v: string) => {
      headers[k] = v;
    },
    headers,
  };
}

describe("authCookie", () => {
  it("setAuthCookie sets an httpOnly secure cookie", () => {
    const r = mockReply();
    setAuthCookie(r, "tok123");
    const c = r.headers["Set-Cookie"];
    expect(c).toContain(`${AUTH_COOKIE}=tok123`);
    expect(c).toContain("HttpOnly");
    expect(c).toContain("Secure");
    expect(c).toContain("SameSite=Lax");
    expect(c).toContain("Max-Age=604800");
  });
  it("clearAuthCookie expires the cookie", () => {
    const r = mockReply();
    clearAuthCookie(r);
    expect(r.headers["Set-Cookie"]).toContain("Max-Age=0");
  });
  it("isWebClient detects x-client:web case-insensitively", () => {
    expect(isWebClient({ headers: { "x-client": "web" } })).toBe(true);
    expect(isWebClient({ headers: { "x-client": "WEB" } })).toBe(true);
    expect(isWebClient({ headers: { "x-client": "mobile" } })).toBe(false);
    expect(isWebClient({ headers: {} })).toBe(false);
  });
  it("readCookieToken parses the auth cookie value", () => {
    expect(readCookieToken({ headers: { cookie: `a=1; ${AUTH_COOKIE}=abc; b=2` } })).toBe("abc");
    expect(readCookieToken({ headers: {} })).toBeNull();
    expect(readCookieToken({ headers: { cookie: "other=1" } })).toBeNull();
    expect(readCookieToken({ headers: { cookie: `${AUTH_COOKIE}=a%20b` } })).toBe("a b");
  });
});
