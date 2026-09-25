import { describe, it, expect } from "vitest";
import { cleanRoleIcons } from "../../src/lib/lobbyRoles";

// Role icons may be images since 2026-09-25, but only images Weered hosts. An
// arbitrary URL in a lobby's role map would make every member's browser fetch
// from wherever that lobby's admin pointed it.

const FALLBACK = { "1": "", "2": "", "3": "", "4": "", "5": "" };

describe("cleanRoleIcons", () => {
  it("keeps emoji and short text, trimmed to 8 characters as before", () => {
    const out = cleanRoleIcons({ "1": "✈️", "2": "CAPTAIN-LONG" }, FALLBACK);
    expect(out["1"]).toBe("✈️");
    expect(out["2"]).toBe("CAPTAIN-");
  });

  it("keeps a same-origin /brand/ image path whole", () => {
    const p = "/brand/vocn/badges/badge-captain.svg";
    expect(cleanRoleIcons({ "3": p }, FALLBACK)["3"]).toBe(p);
  });

  it("never keeps a URL, a traversal, or a script scheme as an image", () => {
    for (const bad of [
      "https://evil.example/pixel.png",
      "//evil.example/x.svg",
      "/brand/../../etc/passwd.png",
      "javascript:alert(1)",
      "/brand/x.svg?y=1",
      "/api/secret.png",
    ]) {
      const v = cleanRoleIcons({ "1": bad }, FALLBACK)["1"];
      expect(v).toBe(bad.slice(0, 8)); // falls back to plain 8-char text, rendered as text
    }
  });

  it("falls back per level when a value is missing or not a string", () => {
    const out = cleanRoleIcons({ "1": 42 as any }, { ...FALLBACK, "1": "🧳" });
    expect(out["1"]).toBe("🧳");
  });
});
