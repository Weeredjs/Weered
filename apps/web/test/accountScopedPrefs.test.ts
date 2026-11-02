// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import {
  DEFAULT_LOOK,
  PREFS_KEY,
  PREFS_OWNER_KEY,
  prefsAreMine,
  pullUiPrefs,
  readUiPrefs,
} from "../lib/uiPrefs";
import { AVATAR_DEFAULT_BG, MY_COLOR_KEY, PICTURE_FILL, avatarFill } from "../lib/avatarColor";

// What this browser keeps belongs to the account it was pulled for. A new
// account made in a browser someone else used must be asked the start question
// and start from Weered's look (2026-11-01: James's new account skipped it).

type Sent = { method: string; body: any };
let sent: Sent[] = [];

function signIn(id: string, extra: object = {}) {
  localStorage.setItem("weered_user", JSON.stringify({ id, ...extra }));
}
function accountHas(prefs: object | null) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      const method = init?.method || "GET";
      sent.push({ method, body: init?.body ? JSON.parse(String(init.body)) : null });
      return new Response(JSON.stringify(method === "GET" ? { ok: true, prefs } : { ok: true }));
    }),
  );
}
const patches = () => sent.filter((s) => s.method === "PATCH");

describe("account-scoped prefs", () => {
  beforeEach(() => {
    localStorage.clear();
    sent = [];
  });
  afterEach(() => vi.unstubAllGlobals());

  it("drops another account's look, layout, colour and setup for a new account", async () => {
    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({ palette: "ember", setup: "done", rail: { order: [], hidden: [] } }),
    );
    localStorage.setItem(PREFS_OWNER_KEY, "james");
    localStorage.setItem(MY_COLOR_KEY, "#14b8a6");
    signIn("newbie");
    accountHas(null);

    const p = await pullUiPrefs();
    expect(p?.setup).toBeUndefined();
    expect(p?.palette).toBe(DEFAULT_LOOK.palette);
    expect(p?.rail).toBeUndefined();
    // Nothing of James's is written to the new account.
    expect(patches()).toHaveLength(0);
    expect(localStorage.getItem(MY_COLOR_KEY)).toBeNull();
    expect(readUiPrefs().setup).toBeUndefined();
    expect(prefsAreMine()).toBe(true);
  });

  it("never seeds the setup answer from a browser, even one with no owner yet", async () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ palette: "ocean", setup: "done" }));
    signIn("first");
    accountHas(null);

    const p = await pullUiPrefs();
    expect(p?.setup).toBeUndefined();
    expect(patches()).toHaveLength(1);
    expect(patches()[0].body.prefs).toEqual({ palette: "ocean" });
  });

  it("takes the setup answer from the account, and keeps this browser's own look", async () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ stars: false, setup: "skipped" }));
    localStorage.setItem(PREFS_OWNER_KEY, "me");
    signIn("me");
    accountHas({ palette: "ocean", setup: "done" });

    const p = await pullUiPrefs();
    expect(p).toMatchObject({ stars: false, palette: "ocean", setup: "done" });
    expect(prefsAreMine()).toBe(true);
  });

  it("leaves a guest's browser alone", async () => {
    signIn("guest1", { isGuest: true });
    accountHas(null);
    expect(await pullUiPrefs()).toBeNull();
    expect(sent).toHaveLength(0);
    expect(localStorage.getItem(PREFS_OWNER_KEY)).toBeNull();
  });
});

describe("avatarFill", () => {
  beforeEach(() => localStorage.clear());

  it("puts the chosen colour behind a picture and behind an initial", () => {
    expect(avatarFill(true, "a", false, "#ec4899")).toBe("#ec4899");
    expect(avatarFill(false, "a", false, "#ec4899")).toBe("#ec4899");
  });

  it("falls back to a faint fill behind a picture and the default behind an initial", () => {
    expect(avatarFill(true, "a", false, null)).toBe(PICTURE_FILL);
    expect(avatarFill(false, "a", false, null)).toBe(AVATAR_DEFAULT_BG);
  });

  it("uses this browser's own colour only for the viewer's own avatar", () => {
    localStorage.setItem(MY_COLOR_KEY, "#22c55e");
    expect(avatarFill(true, "a", true, null)).toBe("#22c55e");
    expect(avatarFill(true, "a", false, null)).toBe(PICTURE_FILL);
  });
});
