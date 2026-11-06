// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import React from "react";
import { cleanup, render, waitFor } from "@testing-library/react";
import { PREFS_KEY, PREFS_OWNER_KEY } from "../lib/uiPrefs";

// The layout gallery shows for a new account even in a browser where another
// account already answered it (2026-11-01: James made test222 in his own
// browser and went straight in), wherever sign-up lands it, but never over
// the username step (2026-11-05).
vi.mock("../components/setup/LayoutGallery", () => ({
  default: () => <div>pick a layout</div>,
}));
const nav = vi.hoisted(() => ({ path: "/home" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.path }));
const weered = vi.hoisted(() => ({ value: {} as any }));
vi.mock("../components/WeeredProvider", () => ({ useWeered: () => weered.value }));
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
    nav.path = "/home";
    weered.value = {};
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
    await waitFor(() => expect(view.getByText("pick a layout")).toBeTruthy());
  });

  it("asks wherever sign-up lands the account, a lobby too", async () => {
    nav.path = "/lobby/weered";
    localStorage.setItem("weered_user", JSON.stringify({ id: "test23" }));
    accountHas(null);
    const view = render(<SetupGate />);
    await waitFor(() => expect(view.getByText("pick a layout")).toBeTruthy());
  });

  it("doesn't ask an account that answered", async () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ setup: "done" }));
    localStorage.setItem(PREFS_OWNER_KEY, "james");
    localStorage.setItem("weered_user", JSON.stringify({ id: "james" }));
    accountHas({ setup: "done" });
    const view = render(<SetupGate />);
    await new Promise((r) => setTimeout(r, 50));
    expect(view.queryByText("pick a layout")).toBeNull();
    // Its own answer here is enough: no trip to the account.
    expect(fetch).not.toHaveBeenCalled();
  });

  it("waits out the username step and the pages without the shell", async () => {
    localStorage.setItem("weered_user", JSON.stringify({ id: "test24" }));
    accountHas(null);
    for (const path of ["/onboarding", "/login", "/"]) {
      nav.path = path;
      const view = render(<SetupGate />);
      await new Promise((r) => setTimeout(r, 50));
      expect(view.queryByText("pick a layout")).toBeNull();
      cleanup();
    }
    nav.path = "/home";
    weered.value = { wsReady: true, me: { id: "test24", needsUsername: true } };
    const view = render(<SetupGate />);
    await new Promise((r) => setTimeout(r, 50));
    expect(view.queryByText("pick a layout")).toBeNull();
  });
});
