import { describe, expect, it } from "vitest";
import { afterUsernameStep, usernameStepFor } from "../lib/usernameStep";

// A Google or Discord sign-up that skipped the username step goes back to it
// (James 2026-11-02, "d_20972329"), and returns where it was afterwards.
describe("usernameStepFor", () => {
  const owes = { needsUsername: true };

  it("leaves everyone with a username alone", () => {
    expect(usernameStepFor({}, "/home")).toBeNull();
    expect(usernameStepFor(null, "/home")).toBeNull();
  });

  it("sends an account that owes one back to the step, remembering the page", () => {
    expect(usernameStepFor(owes, "/home")).toBe("/onboarding");
    expect(usernameStepFor(owes, "/lobby/gta6", "?tab=lfg")).toBe(
      `/onboarding?next=${encodeURIComponent("/lobby/gta6?tab=lfg")}`,
    );
  });

  it("keeps sign-in, the step itself and the rules pages open", () => {
    for (const p of ["/onboarding", "/login", "/terms", "/privacy", "/verify-email"])
      expect(usernameStepFor(owes, p)).toBeNull();
  });
});

describe("afterUsernameStep", () => {
  it("goes back to a page on this site, never off it", () => {
    expect(afterUsernameStep("/lobby/gta6")).toBe("/lobby/gta6");
    expect(afterUsernameStep("//evil.example")).toBe("/home");
    expect(afterUsernameStep("/\\evil.example")).toBe("/home");
    expect(afterUsernameStep("https://evil.example")).toBe("/home");
    expect(afterUsernameStep(null)).toBe("/home");
  });
});
