import { test, expect } from "@playwright/test";

// Read-only E2E across the public (no-auth) surface. Each page must render real
// content in a real browser AND raise no uncaught JS exception (a render/
// hydration crash that a status-200 check would miss). No data is created.
const PUBLIC_PAGES = [
  "/",
  "/login",
  "/why-not-discord",
  "/terms",
  "/explore",
  "/tournaments/destiny-2",
  "/subscribe",
];

for (const path of PUBLIC_PAGES) {
  test(`public page renders without uncaught errors: ${path}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    const res = await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(res, `no response for ${path}`).not.toBeNull();
    expect(res!.status(), `status for ${path}`).toBeLessThan(400);

    // real content, not a blank shell or bare error
    const text = (await page.locator("body").innerText()).trim();
    expect(text.length, `too little rendered text on ${path}`).toBeGreaterThan(40);

    expect(errors, `uncaught JS error(s) on ${path}: ${errors.join(" | ")}`).toEqual([]);
  });
}

test.describe("landing flow", () => {
  test("renders the headline + Get in CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Weered/i);
    await expect(page.getByRole("heading", { name: /a place for anything/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "Get in" }).first()).toBeVisible();
  });

  test("Get in navigates to the login page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Get in" }).first().click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator("body")).toContainText(/weered/i);
  });
});
