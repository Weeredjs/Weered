import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hasAccount, whoIsHere } from "../lib/hasAccount";

// Who is signed in on this browser, from what the sign-in pages remember
// (hardening pass 2026-11-12 and 13). Pages only an account can use asked the
// API anyway with nobody signed in, and each was refused: a red line in the
// console for every signed-out visitor.
const remember = (value: string | null) =>
  vi.stubGlobal("localStorage", { getItem: (k: string) => (k === "weered_user" ? value : null) });
afterEach(() => vi.unstubAllGlobals());

describe("who is signed in on this browser", () => {
  it("is nobody when nothing is remembered", () => {
    remember(null);
    expect(whoIsHere()).toBe("nobody");
    expect(hasAccount()).toBe(false);
  });

  it("is an account", () => {
    remember(JSON.stringify({ id: "u1", name: "someone" }));
    expect(whoIsHere()).toBe("account");
    expect(hasAccount()).toBe(true);
  });

  it("is a guest, who has no account", () => {
    remember(JSON.stringify({ id: "g1", name: "Guest", isGuest: true }));
    expect(whoIsHere()).toBe("guest");
    expect(hasAccount()).toBe(false);
  });

  it("is nobody when the note is broken or storage is shut", () => {
    remember("{not json");
    expect(whoIsHere()).toBe("nobody");
    remember(JSON.stringify({ name: "no id" }));
    expect(whoIsHere()).toBe("nobody");
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("storage is blocked");
      },
    });
    expect(whoIsHere()).toBe("nobody");
  });
});

describe("pages only an account can use", () => {
  it("check who is here before they ask the API", () => {
    for (const [file, call] of [
      ["app/rap/page.tsx", "/rapsheet/me"],
      ["app/staff/page.tsx", '"/staff/me"'],
      ["app/forum/mod-queue/page.tsx", "/forum/reports?"],
      ["app/subscribe/SubscribeContent.tsx", '"/subscribe/status"'],
    ]) {
      const src = readFileSync(join(__dirname, "..", file), "utf8");
      const asks = src.indexOf(call);
      const checks = [src.indexOf("hasAccount()"), src.indexOf("whoIsHere()")].filter(
        (i) => i >= 0,
      );
      expect(asks, `${file} still makes the call`).toBeGreaterThan(-1);
      expect(checks.length, `${file} checks who is here`).toBeGreaterThan(0);
      expect(Math.min(...checks), `${file} checks first`).toBeLessThan(asks);
    }
  });
});
