import { test, expect } from "@playwright/test";

// First-run setup: a brand-new account meets the full-screen setup on Home,
// can skip it, and is not asked again. Needs registration, so it shares the
// auth journey's gate (the captcha-free CI stack).
test.describe("first-run setup", () => {
  test.skip(!process.env.E2E_AUTH, "needs the captcha-free CI stack (E2E_AUTH=1)");

  test("a new account is offered setup once and can skip it", async ({ page }) => {
    const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
    const username = ("su" + stamp).toLowerCase().slice(0, 24);

    await page.goto("/login?mode=register&next=%2Fhome");
    await page.getByPlaceholder("your_handle").fill(username);
    await page.getByPlaceholder("you@example.com").fill(`${username}@example.com`);
    await page.getByPlaceholder("••••••••••").fill("E2ePassword!123");
    await page.locator(".wl-btn").click();
    await expect(page.locator("html")).toHaveAttribute("data-weered-authed", "1", {
      timeout: 15000,
    });

    await page.goto("/home");
    const setup = page.getByRole("dialog", { name: /make it yours/i });
    await expect(setup).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole("button", { name: /set it up/i })).toBeVisible();

    await page.getByRole("button", { name: "Skip" }).click();
    await expect(setup).toBeHidden();

    // Skipping is remembered on the account, so Home stays clear.
    await page.reload();
    await page.waitForTimeout(2500);
    await expect(page.getByRole("dialog", { name: /make it yours/i })).toHaveCount(0);
  });
});
