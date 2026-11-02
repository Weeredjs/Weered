import { describe, it, expect } from "vitest";
import { streamQuality, subdomainAllowance, tierAtLeast } from "../../src/lib/tiers";

// What each plan unlocks (2026-11-02); each includes the one below.
describe("the plans", () => {
  it("rank in order, Kingpin above all", () => {
    expect(tierAtLeast("KINGPIN", "CONDEMNED")).toBe(true);
    expect(tierAtLeast("FELON", "CONDEMNED")).toBe(false);
    expect(tierAtLeast(undefined, "INDICTED")).toBe(false);
    expect(subdomainAllowance("KINGPIN")).toBe(Infinity);
  });

  it("set a lobby's call quality from its owner's plan", () => {
    expect(streamQuality("INNOCENT")).toBe("standard");
    expect(streamQuality("INDICTED")).toBe("standard");
    expect(streamQuality("FELON")).toBe("hd");
    expect(streamQuality("CONDEMNED")).toBe("max");
    expect(streamQuality("INNOCENT", true)).toBe("max");
  });
});
