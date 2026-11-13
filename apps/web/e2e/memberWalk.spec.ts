import { test, expect } from "@playwright/test";
import { stamp as uniqueStamp } from "./names";

// A member's pages, walked signed in (hardening pass, 2026-11-13).
//
// The page sweeps before this were a signed-out visitor's: every address the
// site has, loaded with no account. This is the other half. A new account signs
// up, picks its layout, and opens each page a member can reach. It fails on a
// script error on any of them, and on any answer of 500 from the site or its
// API: both mean something broke, whoever is looking. Everything else the site
// or the API answered with an error status is printed, for a person to read.
//
// Needs an account, so it shares the auth journey's gate (the captcha-free CI
// stack). E2E_API_URL is the API the web build calls.
const API = process.env.E2E_API_URL || "http://localhost:4000";

const PAGES = [
  "/home",
  "/lobby",
  "/lobby/cowork",
  "/lobby/destiny2",
  "/lobby/study-hall",
  "/lobby/create",
  "/explore",
  "/forum",
  "/forum/bookmarks",
  "/forum/mod-queue",
  "/lfg",
  "/map",
  "/store",
  "/rap",
  "/requests",
  "/settings/flair",
  "/subscribe",
  "/premium",
  "/pricing",
  "/staff",
  "/apply",
  "/ban-court",
  "/desktop",
  "/connect/minecraft",
  "/play/chess",
  "/play/fakeout",
  "/about",
  "/features",
  "/contact",
  "/guidelines",
];

test.describe("a member's pages", () => {
  test.skip(!process.env.E2E_AUTH, "needs the captcha-free CI stack (E2E_AUTH=1)");
  test.setTimeout(420_000);

  test("each one loads with no script error and no server error", async ({
    page,
    context,
    baseURL,
  }) => {
    // The cookie question answered, so its notice is never the first dialog.
    await context.addInitScript(() => {
      try {
        localStorage.setItem(
          "weered_cookie_consent",
          JSON.stringify({
            version: 1,
            essential: true,
            functional: false,
            analytics: false,
            acceptedAt: new Date().toISOString(),
          }),
        );
      } catch {}
    });

    const username = ("walk" + uniqueStamp()).toLowerCase().slice(0, 24);
    await page.goto("/login?mode=register&next=%2Fhome");
    await page.getByPlaceholder("your_handle").fill(username);
    await page.getByPlaceholder("you@example.com").fill(`${username}@example.com`);
    await page.getByPlaceholder("••••••••••").fill("E2ePassword!123");
    await page.locator(".wl-btn").click();
    await expect(page.locator("html")).toHaveAttribute("data-weered-authed", "1", {
      timeout: 15000,
    });

    // First run behind it: a member's pages are what they see after choosing.
    await page.goto("/home");
    const gallery = page.getByRole("dialog", { name: /pick a layout/i });
    await expect(gallery).toBeVisible({ timeout: 20000 });
    await gallery.getByRole("button", { name: /^clean in ocean$/i }).click();
    await expect(gallery).toBeHidden();

    const site = new URL(baseURL || "http://localhost:3000").origin;
    const ours = (url: string) => url.startsWith(API) || url.startsWith(site);
    let where = "(signing up)";
    const scriptErrors: string[] = [];
    const serverErrors: string[] = [];
    const otherAnswers: string[] = [];
    page.on("pageerror", (e) => scriptErrors.push(`${where}: ${e.message}`));
    page.on("response", (r) => {
      const status = r.status();
      const url = r.url();
      if (status < 400 || !ours(url)) return;
      const line = `${where}: ${status} ${r.request().method()} ${url.replace(/^https?:\/\/[^/]+/, "")}`;
      if (status === 500) serverErrors.push(line);
      else otherAnswers.push(line);
    });

    const blank: string[] = [];
    for (const path of PAGES) {
      where = path;
      const res = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(res, `no response for ${path}`).not.toBeNull();
      expect(res!.status(), `status for ${path}`).toBeLessThan(400);
      // Time for the page's own requests, and for a page that sends the
      // member on (the staff page does) to finish doing so.
      await page.waitForTimeout(2500);
      const read = () =>
        page
          .locator("body")
          .innerText()
          .then((t) => t.trim().length)
          .catch(() => 0);
      let chars = await read();
      if (chars <= 40) {
        await page.waitForTimeout(1500);
        chars = await read();
      }
      if (chars <= 40) blank.push(path);
    }

    if (otherAnswers.length)
      console.log(
        "[member walk] answered with an error status (not 500), for a person to read:\n" +
          [...new Set(otherAnswers)].join("\n"),
      );
    expect(blank, "pages that rendered next to nothing").toEqual([]);
    expect(scriptErrors, "script errors on a member's pages").toEqual([]);
    expect(serverErrors, "the site or its API answered 500").toEqual([]);
  });
});
