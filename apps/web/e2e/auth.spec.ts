import { test, expect } from "@playwright/test";

// Authenticated journey. Registration needs a captcha-free backend, which only
// the CI stack provides (no TURNSTILE_SECRET) -> gated behind E2E_AUTH so it
// doesn't run against the live captcha-protected droplet. Registers a fresh
// user through the real UI and confirms it lands authenticated in /home.
test.describe("auth journey", () => {
  test.skip(!process.env.E2E_AUTH, "needs the captcha-free CI stack (E2E_AUTH=1)");

  test("register a new account and reach the authenticated app", async ({ page }) => {
    const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
    const username = ("e2e" + stamp).toLowerCase().slice(0, 24);

    await page.goto("/login?next=%2Fhome");
    await page.getByRole("button", { name: "register", exact: true }).click();
    await page.getByPlaceholder("your_handle").fill(username);
    await page.getByPlaceholder("you@example.com").fill(`${username}@example.com`);
    await page.getByPlaceholder("••••••••••").fill("E2ePassword!123");
    await page.getByRole("button", { name: /create_account/i }).click();

    // set on a successful register/login, before the pending-verification branch
    await expect(page.locator("html")).toHaveAttribute("data-weered-authed", "1", {
      timeout: 15000,
    });

    // the auth cookie now lets us into the app (not bounced back to /login)
    await page.goto("/home");
    await expect(page).toHaveURL(/\/home/);
    const text = (await page.locator("body").innerText()).trim();
    expect(text.length, "authenticated home should render content").toBeGreaterThan(20);
  });
});
