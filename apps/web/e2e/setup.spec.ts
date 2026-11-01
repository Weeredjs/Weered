import { test, expect } from "@playwright/test";

// First sign-in: a brand-new account meets the start prompt over its Home
// (components/setup/StartPrompt.tsx), picks how much it wants on screen, and is
// not asked again. Needs registration, so it shares the auth journey's gate
// (the captcha-free CI stack).
test.describe("first-run start prompt", () => {
  test.skip(!process.env.E2E_AUTH, "needs the captcha-free CI stack (E2E_AUTH=1)");

  test("a new account is asked once, and its answer is kept", async ({ page }) => {
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
    const prompt = page.getByRole("dialog", { name: /how much do you want on screen/i });
    await expect(prompt).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole("button", { name: /show me everything/i })).toBeVisible();

    await page.getByRole("button", { name: /keep it clean/i }).click();
    await expect(prompt).toBeHidden();

    // The answer is kept on the account, so Home stays clear.
    await page.reload();
    await page.waitForTimeout(2500);
    await expect(page.getByRole("dialog", { name: /how much do you want on screen/i })).toHaveCount(
      0,
    );
  });
});
