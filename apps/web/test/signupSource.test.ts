// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { captureRef, reportRef } from "../lib/signupSource";

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
});
