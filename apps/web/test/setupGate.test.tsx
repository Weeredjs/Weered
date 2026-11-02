// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import React from "react";
import { cleanup, render, waitFor } from "@testing-library/react";
import { PREFS_KEY, PREFS_OWNER_KEY } from "../lib/uiPrefs";

// The start question shows for a new account even in a browser where another
// account already answered it (2026-11-01: James made test222 in his own
// browser and went straight in).
vi.mock("../components/setup/StartPrompt", () => ({
  default: () => <div>start question</div>,
}));
import SetupGate from "../components/setup/SetupGate";

function accountHas(prefs: object | null) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ ok: true, prefs }))),
  );
}

describe("SetupGate", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("weered_cookie_consent", "essential");
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("asks a new account, though this browser answered for someone else", async () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ setup: "done" }));
    localStorage.setItem(PREFS_OWNER_KEY, "james");
    localStorage.setItem("weered_user", JSON.stringify({ id: "test222" }));
    accountHas(null);
    const view = render(<SetupGate />);
    await waitFor(() => expect(view.getByText("start question")).toBeTruthy());
  });

  it("doesn't ask an account that answered", async () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ setup: "done" }));
    localStorage.setItem(PREFS_OWNER_KEY, "james");
    localStorage.setItem("weered_user", JSON.stringify({ id: "james" }));
    accountHas({ setup: "done" });
    const view = render(<SetupGate />);
    await new Promise((r) => setTimeout(r, 50));
    expect(view.queryByText("start question")).toBeNull();
    // Its own answer here is enough: no trip to the account.
    expect(fetch).not.toHaveBeenCalled();
  });
});
