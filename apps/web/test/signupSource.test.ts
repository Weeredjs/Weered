// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { captureRef, referrerHost, reportRef } from "../lib/signupSource";

// The outreach's measure (2026-11-04): the first ?ref= a browser arrives with,
// reported once an account exists, once per account.
beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

const heldRef = () => JSON.parse(localStorage.getItem("weered:ref") || "null")?.ref;

describe("where a visitor came from", () => {
  it("keeps the first ref and ignores later ones and junk", () => {
    captureRef("?ref=sept-organizers");
    captureRef("?ref=reddit-gta6");
    expect(heldRef()).toBe("sept-organizers");
    localStorage.clear();
    captureRef("?ref=<script>");
    captureRef("?ref=");
    expect(heldRef()).toBeUndefined();
  });

  it("lets a ref go after 30 days", () => {
    const day = 86400_000;
    captureRef("?ref=old", Date.now() - 31 * day);
    captureRef("?ref=new");
    expect(heldRef()).toBe("new");
  });

  it("reports once per account", async () => {
    const fetch = vi.fn(async () => ({ ok: true }));
    vi.stubGlobal("fetch", fetch);
    captureRef("?ref=accounts");
    await reportRef("https://api.example", "u1");
    await reportRef("https://api.example", "u1");
    await reportRef("https://api.example", "u2");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse((fetch.mock.calls[0] as any)[1].body)).toEqual({ ref: "accounts" });
  });

  // 2026-11-12: nine in ten sign-ups carried no ?ref=, while the logs showed
  // Google, GitHub and Reddit sending people in.
  it("keeps the site that sent the first visit and the page it landed on", async () => {
    const held = () => JSON.parse(localStorage.getItem("weered:ref") || "null");
    captureRef("", Date.now(), {
      referrer: "https://www.google.com/",
      host: "weered.ca",
      path: "/lobby/league-of-legends",
    });
    expect(held()).toMatchObject({ from: "google.com", landing: "/lobby/league-of-legends" });
    // A later visit from somewhere else doesn't replace it.
    captureRef("?ref=reddit-da", Date.now(), {
      referrer: "https://reddit.com/",
      host: "weered.ca",
      path: "/",
    });
    expect(held().from).toBe("google.com");
    const fetch = vi.fn(async () => ({ ok: true }));
    vi.stubGlobal("fetch", fetch);
    await reportRef("https://api.example", "u9");
    expect(JSON.parse((fetch.mock.calls[0] as any)[1].body)).toEqual({
      from: "google.com",
      landing: "/lobby/league-of-legends",
    });
  });

  it("counts an empty referrer as direct, and our own pages and sign-in bounces as nothing", () => {
    expect(referrerHost("", "weered.ca")).toBe("direct");
    expect(referrerHost("https://weered.ca/home", "weered.ca")).toBe("");
    expect(referrerHost("https://accounts.google.com/o/oauth2", "weered.ca")).toBe("");
    expect(referrerHost("https://github.com/x", "weered.ca")).toBe("github.com");
    // A bounce back from sign-in on a first visit keeps nothing.
    captureRef("", Date.now(), {
      referrer: "https://accounts.google.com/",
      host: "weered.ca",
      path: "/onboarding",
    });
    expect(localStorage.getItem("weered:ref")).toBeNull();
  });
});
