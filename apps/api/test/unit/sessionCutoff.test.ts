import { describe, expect, it } from "vitest";
import { cutoffNow, issuedBeforeCutoff } from "../../src/lib/sessionCutoff";

describe("session cut-off", () => {
  it("has no effect until a cut-off is set", () => {
    expect(issuedBeforeCutoff(1_700_000_000, null)).toBe(false);
    expect(issuedBeforeCutoff(1_700_000_000, undefined)).toBe(false);
  });

  it("refuses tokens issued before the cut-off second", () => {
    const cut = new Date(1_700_000_100_000);
    expect(issuedBeforeCutoff(1_700_000_099, cut)).toBe(true);
    expect(issuedBeforeCutoff(0, cut)).toBe(true);
    expect(issuedBeforeCutoff(undefined, cut)).toBe(true); // a token with no iat is not trusted
  });

  it("keeps a token minted in the same second as the cut-off, or later", () => {
    const cut = new Date(1_700_000_100_000);
    expect(issuedBeforeCutoff(1_700_000_100, cut)).toBe(false);
    expect(issuedBeforeCutoff(1_700_000_101, cut)).toBe(false);
  });

  it("stores the cut-off to the whole second", () => {
    const c = cutoffNow();
    expect(c.getTime() % 1000).toBe(0);
    // A login in the same second as a reset must survive it.
    expect(issuedBeforeCutoff(Math.floor(Date.now() / 1000), c)).toBe(false);
  });
});
