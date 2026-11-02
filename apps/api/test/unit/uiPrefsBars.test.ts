import { describe, it, expect } from "vitest";
import { mergeUiPrefs, sanitizeUiPrefs } from "../../src/lib/uiPrefs";

// Two colours and section bars (2026-11-02): kept when valid, cleared by "none".
describe("look prefs: second colour and section bars", () => {
  it("keeps valid values and drops the rest", () => {
    expect(sanitizeUiPrefs({ accent2: "#22c55e", bars: "slant", barColor: "#0f766e" })).toEqual({
      accent2: "#22c55e",
      bars: "slant",
      barColor: "#0f766e",
    });
    expect(sanitizeUiPrefs({ accent2: "red", bars: "zigzag", barColor: "url(x)" })).toEqual({});
  });

  it("clears a colour with an explicit none, since saves merge", () => {
    const was = { accent2: "#22c55e", barColor: "#0f766e", bars: "solid" };
    expect(mergeUiPrefs(was, { accent2: "none", barColor: "none", bars: "off" })).toMatchObject({
      accent2: "none",
      barColor: "none",
      bars: "off",
    });
  });
});
