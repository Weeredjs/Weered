import { test, expect } from "@playwright/test";

// A page sits in a box under the bar at the top of every page (ShellGate). The
// box never scrolled, so the foot of a page taller than the window was cut off:
// James 2026-11-08, on his own crew page, "Doesn't scroll. Can't get to the
// save button." A crew's leader opens its editor on a laptop-sized window and
// scrolls with the wheel, as a person does (a script's scrollIntoView moves
// even a box that can't scroll), then clicks Save where it shows. Needs
// registration, so it shares the auth journey's gate (the captcha-free CI
// stack). E2E_API_URL is the API the web build calls.
const API = process.env.E2E_API_URL || "http://localhost:4000";

test.describe("a page taller than the frame", () => {
  test.skip(!process.env.E2E_AUTH, "needs the captcha-free CI stack (E2E_AUTH=1)");
  test.use({ viewport: { width: 1280, height: 720 } });

  test("scrolls to its foot: a crew's leader reaches Save", async ({ page }) => {
    test.setTimeout(90_000);
    const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
    const username = ("cs" + stamp).toLowerCase().slice(0, 24);

    await page.goto("/login?mode=register&next=%2Fhome");
    await page.getByPlaceholder("your_handle").fill(username);
    await page.getByPlaceholder("you@example.com").fill(`${username}@example.com`);
    await page.getByPlaceholder("••••••••••").fill("E2ePassword!123");
    await page.locator(".wl-btn").click();
    await expect(page.locator("html")).toHaveAttribute("data-weered-authed", "1", {
      timeout: 15000,
    });

    // The first-run questions, out of the way: cookies, then the layout gallery.
    await page.goto("/home");
    const cookies = page.getByRole("dialog", { name: /cookie consent/i });
    const gallery = page.getByRole("dialog", { name: /pick a layout/i });
    await expect(cookies.or(gallery).first()).toBeVisible({ timeout: 20000 });
    if (await cookies.isVisible())
      await cookies.getByRole("button", { name: /essentials only/i }).click();
    await expect(gallery).toBeVisible({ timeout: 20000 });
    await gallery.getByRole("button", { name: "Skip", exact: true }).click();
    await expect(gallery).toBeHidden();
    // The notifications prompt waits 5 s, then sits over the foot of the page.
    await page.evaluate(() => localStorage.setItem("weered_push_later", String(Date.now())));

    const crew = await page.evaluate(async (api) => {
      const r = await fetch(`${api}/crews`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Long Page Crew" }),
      });
      return (await r.json().catch(() => ({})))?.crew;
    }, API);
    expect(crew?.id, "the crew was made").toBeTruthy();

    await page.goto(`/crew/${crew.id}`);
    await page.getByRole("button", { name: /edit your crew.s look/i }).click();
    const save = page.getByRole("button", { name: "Save", exact: true });
    await expect(save).toBeAttached();

    // From the top, as a person arrives (the click above may have moved boxes
    // no person could).
    await save.evaluate((el) => {
      for (let p = el.parentElement; p; p = p.parentElement) p.scrollTop = 0;
    });
    const box = page.locator(".weered-center-body");
    const shown = async () => {
      const s = (await save.boundingBox())!;
      const v = (await box.boundingBox())!;
      return s.y >= v.y && s.y + s.height <= v.y + v.height + 1 ? s : null;
    };
    const b = (await box.boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    for (let i = 0; i < 30 && !(await shown()); i++) {
      await page.mouse.wheel(0, 200);
      await page.waitForTimeout(120);
    }

    // Save shows within the box, and a click there saves.
    const s = await shown();
    expect(s, "the wheel brings Save into view").not.toBeNull();
    await page.mouse.click(s!.x + s!.width / 2, s!.y + s!.height / 2);
    await expect(page.getByText("Saved.", { exact: true })).toBeVisible();
  });
});
