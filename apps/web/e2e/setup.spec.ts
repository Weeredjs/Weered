import { test, expect } from "@playwright/test";
import { stamp as uniqueStamp } from "./names";

// First sign-in: a brand-new account meets the layout gallery
// (components/setup/LayoutGallery.tsx), picks a layout in a colourway, lands on
// Home's build blocks, and is not asked again. Needs registration, so it shares
// the auth journey's gate (the captcha-free CI stack).
test.describe("first-run layout gallery", () => {
  test.skip(!process.env.E2E_AUTH, "needs the captcha-free CI stack (E2E_AUTH=1)");

  test("a new account picks a layout once, and its answer is kept", async ({ page }) => {
    const stamp = uniqueStamp();
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
    // One question at a time: the cookie question first, then the gallery.
    const cookies = page.getByRole("dialog", { name: /cookie consent/i });
    const gallery = page.getByRole("dialog", { name: /pick a layout/i });
    await expect(cookies.or(gallery).first()).toBeVisible({ timeout: 20000 });
    if (await cookies.isVisible())
      await cookies.getByRole("button", { name: /essentials only/i }).click();
    await expect(gallery).toBeVisible({ timeout: 20000 });
    await expect(gallery.getByText(/you can change any of this later/i)).toBeVisible();

    await gallery.getByRole("button", { name: /^clean in ocean$/i }).click();
    await expect(gallery).toBeHidden();
    await expect(page).toHaveURL(/\/home/);
    // Home is the build blocks (Create and Change) and the chat; search and
    // Downtown are the bar's, so the four tiles don't repeat them (2026-11-10).
    await expect(page.locator(".home-build-wrap").first()).toBeVisible();
    await expect(page.locator(".weered-ubar-search").first()).toBeVisible();
    await expect(page.locator(".weered-wayin")).toHaveCount(0);

    // The answer is kept on the account, so Home stays clear.
    await page.reload();
    await page.waitForTimeout(2500);
    await expect(page.getByRole("dialog", { name: /pick a layout/i })).toHaveCount(0);
  });
});
