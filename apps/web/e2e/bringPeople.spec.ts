import { test, expect, type BrowserContext, type Page } from "@playwright/test";

// Bringing people in (2026-11-12). An owner's guest link can be sent to
// WhatsApp, Facebook or an email. A friend walks in on it with just a name, and
// from inside makes an account and comes back a member. A stranger with the
// lobby's address sees the lobby itself with a bar that asks, where a blurred
// "Unlock" wall stood, joins through sign-up and arrives a member.
//
// Writing this found two things nobody had seen, both fixed with it:
// - Join worked and the page never showed it: the reply has no "membership"
//   in it, and the page waited for one, so the button stayed, asking again.
// - A guest's visit marked the device as having an account, so "Make an
//   account" opened Sign in.
//
// Needs accounts, so it shares the auth journey's gate (the captcha-free CI
// stack). E2E_API_URL is the API the web build calls.
const API = process.env.E2E_API_URL || "http://localhost:4000";
const LOBBY = "The Wheel House";

test.describe("bringing people in", () => {
  test.skip(!process.env.E2E_AUTH, "needs the captcha-free CI stack (E2E_AUTH=1)");
  test.setTimeout(150_000);

  const stamp = () => `${Date.now()}${Math.floor(Math.random() * 1e6)}`;

  async function register(page: Page, username: string) {
    await expect(page.locator(".wl-btn")).toHaveText("Create account");
    await page.getByPlaceholder("your_handle").fill(username);
    await page.getByPlaceholder("you@example.com").fill(`${username}@example.com`);
    await page.getByPlaceholder("••••••••••").fill("E2ePassword!123");
    await page.locator(".wl-btn").click();
    await expect(page.locator("html")).toHaveAttribute("data-weered-authed", "1", {
      timeout: 15000,
    });
  }

  // A visitor who has already answered the cookie question, so its notice at
  // the foot of the page never sits over a button.
  async function answeredCookies(ctx: BrowserContext) {
    await ctx.addInitScript(() => {
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
  }

  // What the API says this browser is in the lobby: OWNER, MEMBER, GUEST or
  // null. Asked from the page, with its session, as the lobby page asks.
  const roleIn = (page: Page, lobbyId: string) =>
    page
      .evaluate(
        async ({ api, id }) => {
          const r = await fetch(`${api}/lobbies/${encodeURIComponent(id)}`, {
            credentials: "include",
          });
          return ((await r.json().catch(() => null))?.membership?.role as string) ?? null;
        },
        { api: API, id: lobbyId },
      )
      .catch(() => null);

  // The lobby's name on the page. Until the page has read the lobby (and who is
  // looking at it) the address stands there instead.
  const named = (page: Page) =>
    page.getByText(LOBBY, { exact: true }).filter({ visible: true }).first();

  test("a guest link shares out, a guest stays, and a stranger joins through sign-up", async ({
    page,
    browser,
  }) => {
    // The owner, past the first-run questions, with a lobby of their own.
    const owner = ("bo" + stamp()).toLowerCase().slice(0, 24);
    const lobbyId = ("e2e-club-" + stamp()).slice(0, 30);
    await page.goto("/login?mode=register&next=%2Fhome");
    await register(page, owner);
    await page.goto("/home");
    const cookies = page.getByRole("dialog", { name: /cookie consent/i });
    const gallery = page.getByRole("dialog", { name: /pick a layout/i });
    await expect(cookies.or(gallery).first()).toBeVisible({ timeout: 20000 });
    if (await cookies.isVisible())
      await cookies.getByRole("button", { name: /essentials only/i }).click();
    await expect(gallery).toBeVisible({ timeout: 20000 });
    await gallery.getByRole("button", { name: "Skip", exact: true }).click();
    await expect(gallery).toBeHidden();
    const made = await page.evaluate(
      async ({ api, id, name }) => {
        const r = await fetch(`${api}/lobbies`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, name, description: "A members club." }),
        });
        return (await r.json().catch(() => null))?.ok === true;
      },
      { api: API, id: lobbyId, name: LOBBY },
    );
    expect(made, "the owner's lobby is made").toBe(true);

    // Invite: a guest link, and somewhere to send it.
    await page.goto(`/lobby/${lobbyId}`);
    await expect(named(page)).toBeVisible({ timeout: 20000 });
    await page.locator(".weered-lobby-invite").first().click();
    await page.getByText("For guests.").click();
    await page.getByRole("button", { name: "Generate Link" }).click();
    const linkBox = page.locator('input[readonly][value*="/invite/"]');
    await expect(linkBox).toBeVisible({ timeout: 15000 });
    const link = await linkBox.inputValue();
    const sent = encodeURIComponent(link);
    const whatsapp = page.locator('a[data-share="whatsapp"]');
    await expect(whatsapp).toHaveAttribute("href", /^https:\/\/wa\.me\/\?text=/);
    const words = decodeURIComponent((await whatsapp.getAttribute("href")) || "");
    // The words that go with it say a guest needs no account, then the link.
    expect(words).toContain(`Come into ${LOBBY} on Weered. No account needed, just your name:`);
    expect(words.endsWith(link), "WhatsApp's message ends with the link").toBe(true);
    await expect(page.locator('a[data-share="facebook"]')).toHaveAttribute(
      "href",
      `https://www.facebook.com/sharer/sharer.php?u=${sent}`,
    );
    await expect(page.locator('a[data-share="email"]')).toHaveAttribute(
      "href",
      /^mailto:\?subject=/,
    );
    await expect(page.locator('[data-share="copy"]')).toBeVisible();

    // A friend walks in on it with just a name: in as a guest, with no bar
    // asking them to join.
    const token = link.split("/invite/")[1];
    const friendCtx = await browser.newContext();
    await answeredCookies(friendCtx);
    const friend = await friendCtx.newPage();
    await friend.goto(`/invite/${token}`);
    await friend.getByPlaceholder("Your name").fill("Pat");
    await friend.getByRole("button", { name: "Join as a guest" }).click();
    await expect(friend).toHaveURL(new RegExp(`/lobby/${lobbyId}`), { timeout: 20000 });
    await expect(named(friend)).toBeVisible({ timeout: 20000 });
    await expect.poll(() => roleIn(friend, lobbyId), { timeout: 20000 }).toBe("GUEST");
    await expect(friend.locator(".weered-joinbar")).toHaveCount(0);

    // They like it: an account, made from inside, and back in as a member.
    const keep = friend.getByRole("button", { name: "Make an account" });
    await expect(keep).toBeVisible({ timeout: 15000 });
    await keep.click();
    const signUp = new RegExp(`/login\\?mode=register&next=%2Flobby%2F${lobbyId}%3Fjoin%3D1`);
    await expect(friend).toHaveURL(signUp, { timeout: 15000 });
    await register(friend, ("fr" + stamp()).toLowerCase().slice(0, 24));
    await expect(friend).toHaveURL(new RegExp(`/lobby/${lobbyId}`), { timeout: 20000 });
    await expect.poll(() => roleIn(friend, lobbyId), { timeout: 20000 }).toBe("MEMBER");
    await expect(friend.locator("html")).not.toHaveAttribute("data-weered-guest", "1");
    await expect(friend.locator(".weered-joinbar")).toHaveCount(0);
    await friendCtx.close();

    // A stranger with the lobby's address: the lobby itself, and a bar that asks.
    const strangerCtx = await browser.newContext();
    await answeredCookies(strangerCtx);
    const stranger = await strangerCtx.newPage();
    await stranger.goto(`/lobby/${lobbyId}`);
    const bar = stranger.locator(".weered-joinbar");
    await expect(bar).toBeVisible({ timeout: 20000 });
    await expect(bar).toContainText(`You're looking round ${LOBBY}. Join free`);
    await expect(named(stranger)).toBeVisible();
    await expect(stranger.getByText(/Unlock the/i)).toHaveCount(0);
    await bar.getByRole("button", { name: `Join ${LOBBY}` }).click();
    await expect(stranger).toHaveURL(signUp, { timeout: 15000 });
    // They make an account and arrive in the lobby a member: the bar is gone.
    await register(stranger, ("st" + stamp()).toLowerCase().slice(0, 24));
    await expect(stranger).toHaveURL(new RegExp(`/lobby/${lobbyId}`), { timeout: 20000 });
    await expect.poll(() => roleIn(stranger, lobbyId), { timeout: 20000 }).toBe("MEMBER");
    await expect(bar).toHaveCount(0);
    await strangerCtx.close();
  });
});
