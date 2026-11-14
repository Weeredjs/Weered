import { describe, expect, it } from "vitest";
import { compareVersions } from "../../src/routes/desktop";

// GitHub listed desktop-v0.1.9 ahead of desktop-v0.1.10 and the update feed
// took the first one, so 0.1.10 was never offered (2026-11-14).
describe("desktop versions", () => {
  it("compares by number, not as text", () => {
    expect(compareVersions("0.1.10", "0.1.9")).toBeGreaterThan(0);
    expect(compareVersions("0.2.0", "0.1.99")).toBeGreaterThan(0);
    expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
    const tags = ["0.1.9", "0.1.10", "0.1.8"].sort((a, b) => compareVersions(b, a));
    expect(tags[0]).toBe("0.1.10");
  });
});
