import { test, expect } from "@playwright/test";

// A lobby theme may un-clip room cards (overflow: visible, for its corner
// decorations). That must never widen the room column: every Join stays inside
// it, clear of the chat beside it. Read-only and signed out, on the seeded
// destiny2 lobby; every card is made an event card, the case the themes un-clip.
const THEMES = ["destiny2", "windrose"];

test("room cards stay inside the room column under every lobby theme", async ({ page }) => {
  await page.goto("/lobby/destiny2", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".weered-room-join").first()).toBeVisible();
  const column = page.locator(".weered-lobby-hall > :first-child");

  for (const theme of THEMES) {
    await page.evaluate((t) => {
      document.documentElement.dataset.weeredLobby = t;
      document
        .querySelectorAll(".weered-room-card")
        .forEach((c) => c.classList.add("weered-room-card-event"));
    }, theme);
    const fit = await column.evaluate((col) => {
      const right = col.getBoundingClientRect().right;
      const joins = [...col.querySelectorAll(".weered-room-join")].map(
        (j) => j.getBoundingClientRect().right,
      );
      return {
        joins: joins.length,
        overflow: col.scrollWidth - col.clientWidth,
        outside: joins.filter((r) => r > right + 0.5).length,
      };
    });
    expect(fit.joins, `no Join chips rendered under ${theme}`).toBeGreaterThan(0);
    expect(fit, `room column under the ${theme} theme`).toEqual({
      joins: fit.joins,
      overflow: 0,
      outside: 0,
    });
  }
});
