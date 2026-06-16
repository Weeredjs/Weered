import { test, expect } from "@playwright/test";

// First real-browser smoke: the landing page boots (React renders, not a blank
// shell or error) and its primary CTA routes to the login page. Read-only — no
// data is created.
test.describe("landing", () => {
  test("renders the landing page with its lobbies section", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Weered/i);
    await expect(page.getByRole("heading", { name: /the lobbies are open/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "get_in()" }).first()).toBeVisible();
  });

  test("get_in() navigates to the login page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "get_in()" }).first().click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator("body")).toContainText(/weered/i);
  });
});
