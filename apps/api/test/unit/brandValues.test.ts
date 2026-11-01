import { describe, it, expect } from "vitest";
import { brandProblem, isSafeLink } from "../../src/lib/brandValues";

describe("lobby branding values (red team 2026-11-01, finding 5)", () => {
  it("takes colours written as #rrggbb, and nothing else", () => {
    expect(brandProblem({ accentColor: "#7c3aed" })).toBeNull();
    expect(brandProblem({ accentColor: "" })).toBeNull();
    expect(brandProblem({ accentColor: "red" })).toBeTruthy();
    expect(brandProblem({ accentColor: '#fff"><img src=x onerror=alert(1)>' })).toBeTruthy();
  });

  it("takes https links and paths on this site", () => {
    expect(isSafeLink("https://upload.wikimedia.org/a.png")).toBe(true);
    expect(isSafeLink("/brand/eceb.png")).toBe(true);
    expect(isSafeLink("")).toBe(true);
  });

  it("refuses scripts, other schemes and anything that breaks out of an attribute", () => {
    expect(isSafeLink("javascript:alert(1)")).toBe(false);
    expect(isSafeLink("data:image/svg+xml,<svg onload=alert(1)>")).toBe(false);
    expect(isSafeLink("//evil.example/x.png")).toBe(false);
    expect(isSafeLink('https://x.example/a.png") center/cover;" onmouseover="alert(1)')).toBe(
      false,
    );
    expect(isSafeLink("http://x.example/a.png")).toBe(false);
    expect(brandProblem({ logoUrl: "javascript:alert(1)" })).toBeTruthy();
  });

  it("lets a website be plain http", () => {
    expect(brandProblem({ websiteUrl: "http://club.example" })).toBeNull();
    expect(brandProblem({ websiteUrl: "javascript:alert(1)" })).toBeTruthy();
  });
});
