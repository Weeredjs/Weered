import { describe, it, expect } from "vitest";
import { hunterTier, posterTier } from "../components/WrBounties";

describe("WrBounties tiers", () => {
  it("hunterTier by kill count", () => {
    expect(hunterTier(50)?.label).toBe("Reaper");
    expect(hunterTier(20)?.label).toBe("Marshal");
    expect(hunterTier(5)?.label).toBe("Tracker");
    expect(hunterTier(1)?.label).toBe("Outlaw");
    expect(hunterTier(0)).toBeNull();
  });
  it("posterTier by post count", () => {
    expect(posterTier(50)?.label).toBe("Kingmaker");
    expect(posterTier(0)).toBeNull();
  });
});
