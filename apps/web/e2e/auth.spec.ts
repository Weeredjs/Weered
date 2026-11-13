import { test, expect } from "@playwright/test";
import { stamp as uniqueStamp } from "./names";

// Authenticated journey. Registration needs a captcha-free backend, which only
// the CI stack provides (no TURNSTILE_SECRET) -> gated behind E2E_AUTH so it
// doesn't run against the live captcha-protected droplet. Registers a fresh
// user through the real UI and confirms it lands authenticated in /home.
test.describe("auth journey", () => {
  test.skip(!process.env.E2E_AUTH, "needs the captcha-free CI stack (E2E_AUTH=1)");

  test("register a new account and reach the authenticated app", async ({ page }) => {
    const stamp = uniqueStamp();
    const username = ("e2e" + stamp).toLowerCase().slice(0, 24);

    await page.goto("/login?mode=register&next=%2Fhome");
    await page.getByPlaceholder("your_handle").fill(username);
    await page.getByPlaceholder("you@example.com").fill(`${username}@example.com`);
    await page.getByPlaceholder("••••••••••").fill("E2ePassword!123");
    // The tab and the submit button are both "Create account"; submit is .wl-btn.
    await page.locator(".wl-btn").click();

    // set on a successful register/login
    await expect(page.locator("html")).toHaveAttribute("data-weered-authed", "1", {
      timeout: 15000,
    });

    // the auth cookie now lets us into the app (not bounced back to /login)
    await page.goto("/home");
    await expect(page).toHaveURL(/\/home/);
    const text = (await page.locator("body").innerText()).trim();
    expect(text.length, "authenticated home should render content").toBeGreaterThan(20);

    // The device remembers the name for Sign in, even after the socket signs in.
    await page.waitForTimeout(3000);
    expect(await page.evaluate(() => localStorage.getItem("weered:returning"))).toBe(username);
  });
});

// A session that ran out (7 days after sign-in) while the browser still
// remembers the member: the site stayed "signed in" over an empty chat and
// Sign in bounced back to /home (2026-11-03). No account needed: the
// remembered member is made up and has no cookie.
test.describe("an ended session", () => {
  const remember = () =>
    localStorage.setItem("weered_user", JSON.stringify({ id: "e2e-ended", name: "ended_member" }));

  test("goes to Sign in with the name filled in", async ({ page }) => {
    await page.goto("/login");
    await page.evaluate(remember);
    await page.evaluate(() => localStorage.setItem("weered:returning", "ended_member"));
    await page.goto("/home");
    await expect(page).toHaveURL(/\/login\?error=session_ended&next=%2Fhome/, { timeout: 15000 });
    await expect(page.getByText("Your session ran out. Sign in again.")).toBeVisible();
    await expect(page.getByPlaceholder("your_handle")).toHaveValue("ended_member");
    expect(await page.evaluate(() => localStorage.getItem("weered_user"))).toBeNull();
  });

  test("Sign in stays put instead of bouncing to /home", async ({ page }) => {
    await page.goto("/login");
    await page.evaluate(remember);
    await page.goto("/login");
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByPlaceholder("your_handle")).toBeVisible();
  });
});
