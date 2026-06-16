import { describe, it, expect } from "vitest";
import {
  normRole,
  roleDisplayDock,
  decodeJwtClaims,
  b64UrlDecode,
  fmtRelative,
  fmtDateSep,
} from "../components/dock/shellHelpers";

describe("shellHelpers", () => {
  it("normRole uppercases + trims", () => {
    expect(normRole(" staff ")).toBe("STAFF");
    expect(normRole(null)).toBe("");
  });
  it("roleDisplayDock maps roles, windrose-themed", () => {
    expect(roleDisplayDock("GOD")).toBe("GODFATHER");
    expect(roleDisplayDock("GOD", "windrose")).toBe("ADMIRAL");
    expect(roleDisplayDock("UNKNOWN")).toBe("UNKNOWN");
  });
  it("b64UrlDecode + decodeJwtClaims", () => {
    expect(b64UrlDecode(Buffer.from("hello").toString("base64url"))).toBe("hello");
    const payload = Buffer.from(JSON.stringify({ sub: "u1" })).toString("base64url");
    expect(decodeJwtClaims(`h.${payload}.s`).sub).toBe("u1");
    expect(decodeJwtClaims("notajwt")).toBeNull();
    expect(decodeJwtClaims(null)).toBeNull();
  });
  it("fmtRelative + fmtDateSep bucket times", () => {
    expect(fmtRelative(new Date().toISOString())).toBe("now");
    expect(fmtRelative(new Date(Date.now() - 5 * 60000).toISOString())).toBe("5m");
    expect(fmtRelative(new Date(Date.now() - 2 * 3600000).toISOString())).toBe("2h");
    expect(fmtDateSep(new Date().toISOString())).toBe("Today");
  });
});
