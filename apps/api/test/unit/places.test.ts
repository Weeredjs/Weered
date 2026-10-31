import { describe, it, expect } from "vitest";
import { gateOf, isPlaceId, placeIdForHost, placeLabel } from "../../src/routes/places";

// Your place: <label>.weered.ca and weered.ca/u/<label> are someone's lobby
// "u-<label>". Weered's own subdomains must never resolve to a member.

describe("placeLabel", () => {
  it("makes a name into an address", () => {
    expect(placeLabel("Donkey")).toBe("donkey");
    expect(placeLabel("the_operator")).toBe("the-operator");
    expect(placeLabel("  Mr. Big!! ")).toBe("mr-big");
    expect(placeLabel("x".repeat(50))).toHaveLength(30);
    expect(placeLabel("a".repeat(29) + "-b")).toBe("a".repeat(29));
  });
});

describe("placeIdForHost", () => {
  it("maps <label>.weered.ca to the place's lobby", () => {
    expect(placeIdForHost("donkey.weered.ca")).toBe("u-donkey");
    expect(placeIdForHost("Mr-Big.weered.ca")).toBe("u-mr-big");
  });

  it("never maps Weered's own hosts, deeper names or other domains", () => {
    for (const h of [
      "weered.ca",
      "www.weered.ca",
      "api.weered.ca",
      "ws.weered.ca",
      "livekit.weered.ca",
      "admin.weered.ca",
      "a.b.weered.ca",
      "donkey.weered.ca.evil.com",
      "donkey.example.com",
      "-bad.weered.ca",
    ])
      expect(placeIdForHost(h), h).toBeNull();
  });
});

describe("gateOf / isPlaceId", () => {
  it("reads the gate from a place's config, anyone by default", () => {
    expect(gateOf({ moduleConfig: { gate: "friends" } })).toBe("friends");
    expect(gateOf({ moduleConfig: { gate: "me" } })).toBe("me");
    expect(gateOf({ moduleConfig: { gate: "nonsense" } })).toBe("anyone");
    expect(gateOf({ moduleConfig: null })).toBe("anyone");
    expect(gateOf(null)).toBe("anyone");
  });
  it("knows a place by its id", () => {
    expect(isPlaceId("u-donkey")).toBe(true);
    expect(isPlaceId("helldivers2")).toBe(false);
    expect(isPlaceId(null)).toBe(false);
  });
});
