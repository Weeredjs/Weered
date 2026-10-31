import { describe, it, expect } from "vitest";
import { placeIdForHost, placeLabel } from "../../src/routes/places";

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
