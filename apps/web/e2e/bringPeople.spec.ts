import { test, expect, type BrowserContext, type Page } from "@playwright/test";

// Bringing people in (2026-11-12). An owner builds a lobby and the builder
// stops on "Now bring your people": a guest link that goes to WhatsApp,
// Facebook or an email. A friend walks in on it with just a name, and from
// inside makes an account and comes back a member. A stranger with the lobby's
// address sees the lobby itself with a bar that asks, where a blurred "Unlock"
// wall stood, joins through sign-up and arrives a member.
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

test.describe("bringing people in", () => {
  test.skip(!process.env.E2E_AUTH, "needs the captcha-free CI stack (E2E_AUTH=1)");
  test.setTimeout(180_000);

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

  // Who the lobby page takes this browser for, once it has read the lobby:
  // data-viewer is "member" (the owner, a member, a guest in on a link) or
  // "visitor".
  const lobbyPage = (page: Page) => page.locator(".weered-lobby-page");

  // The link a share row sends, and the words that go with it.
  async function sharesOut(row: ReturnType<Page["locator"]>, link: string, words: string) {
    const whatsapp = row.locator('a[data-share="whatsapp"]');
    await expect(whatsapp).toHaveAttribute("href", /^https:\/\/wa\.me\/\?text=/);
    const said = decodeURIComponent((await whatsapp.getAttribute("href")) || "");
    expect(said).toContain(words);
    expect(said.endsWith(link), "WhatsApp's message ends with the link").toBe(true);
    await expect(row.locator('a[data-share="facebook"]')).toHaveAttribute(
      "href",
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`,
    );
    await expect(row.locator('a[data-share="email"]')).toHaveAttribute(
      "href",
      /^mailto:\?subject=/,
    );
    await expect(row.locator('[data-share="copy"]')).toBeVisible();
  }

  test("a built lobby's guest link shares out, a guest stays, a stranger joins", async ({
    page,
    browser,
  }) => {
    // The owner, past the first-run questions.
    const owner = ("bo" + stamp()).toLowerCase().slice(0, 24);
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

    // The builder, by hand: a name is all it needs. A name of its own each
    // run, because the builder makes the address from it.
    const lobbyName = `Wheel House ${Math.floor(100000 + Math.random() * 900000)}`;
    const lobbyId = lobbyName.toLowerCase().replaceAll(" ", "-");
    await page.goto("/lobby/create");
    await page.locator("#cz-lobby-name").fill(lobbyName);
    const create = page.locator("button.cz-btn", { hasText: /create lobby/i }).first();
    await expect(create).toBeVisible({ timeout: 20000 });
    await create.click();
    const built = page.getByRole("dialog", { name: "Creating your lobby" });
    await expect(built.getByText(`Claiming weered.ca/lobby/${lobbyId}`)).toBeVisible();
    await expect(built.getByText(`${lobbyName} is open`)).toBeVisible({ timeout: 60000 });

    // It stops on "Now bring your people": a guest link that works for a week,
    // somewhere to send it, and the lasting link underneath.
    await expect(built.getByText("Now bring your people")).toBeVisible();
    const shown = built.locator("[data-bring-link]");
    await expect(shown).toContainText("/invite/", { timeout: 15000 });
    const token = ((await shown.textContent()) || "").split("/invite/")[1].trim();
    const guestWords = `Come into ${lobbyName} on Weered. No account needed, just your name:`;
    await expect(built.getByText(/It works for a week\./)).toBeVisible();
    await sharesOut(
      built.locator(".weered-share-row"),
      `https://weered.ca/invite/${token}`,
      guestWords,
    );
    await expect(built.getByRole("button", { name: `weered.ca/lobby/${lobbyId}` })).toBeVisible();

    // Invite, in the lobby itself, has the same row under a link it makes.
    await page.goto(`/lobby/${lobbyId}`);
    await expect(lobbyPage(page)).toHaveAttribute("data-viewer", "member", { timeout: 20000 });
    await page.locator(".weered-lobby-invite").first().click();
    await page.getByText("For guests.").click();
    // exact: the window's own backdrop is a button too, named by all its text.
    await page.getByRole("button", { name: "Generate Link", exact: true }).click();
    const linkBox = page.locator('input[readonly][value*="/invite/"]');
    await expect(linkBox).toBeVisible({ timeout: 15000 });
    await sharesOut(page.locator(".weered-share-row"), await linkBox.inputValue(), guestWords);

    // A friend walks in on the builder's link with just a name: in as a
    // guest, with no bar asking them to join.
    const friendCtx = await browser.newContext();
    await answeredCookies(friendCtx);
    const friend = await friendCtx.newPage();
    await friend.goto(`/invite/${token}`);
    await friend.getByPlaceholder("Your name").fill("Pat");
    await friend.getByRole("button", { name: "Join as a guest", exact: true }).click();
    await expect(friend).toHaveURL(new RegExp(`/lobby/${lobbyId}`), { timeout: 20000 });
    await expect(lobbyPage(friend)).toHaveAttribute("data-viewer", "member", { timeout: 20000 });
    await expect.poll(() => roleIn(friend, lobbyId), { timeout: 20000 }).toBe("GUEST");
    await expect(friend.locator(".weered-joinbar")).toHaveCount(0);

    // They like it: an account, made from inside, and back in as a member.
    const keep = friend.getByRole("button", { name: "Make an account", exact: true });
    await expect(keep).toBeVisible({ timeout: 15000 });
    await keep.click();
    const signUp = new RegExp(`/login\\?mode=register&next=%2Flobby%2F${lobbyId}%3Fjoin%3D1`);
    await expect(friend).toHaveURL(signUp, { timeout: 15000 });
    await register(friend, ("fr" + stamp()).toLowerCase().slice(0, 24));
    await expect(friend).toHaveURL(new RegExp(`/lobby/${lobbyId}`), { timeout: 20000 });
    await expect.poll(() => roleIn(friend, lobbyId), { timeout: 20000 }).toBe("MEMBER");
    await expect(lobbyPage(friend)).toHaveAttribute("data-viewer", "member");
    await expect(friend.locator("html")).not.toHaveAttribute("data-weered-guest", "1");
    await expect(friend.locator(".weered-joinbar")).toHaveCount(0);
    await friendCtx.close();

    // A stranger with the lobby's address: the lobby itself, and a bar that asks.
    const strangerCtx = await browser.newContext();
    await answeredCookies(strangerCtx);
    const stranger = await strangerCtx.newPage();
    await stranger.goto(`/lobby/${lobbyId}`);
    await expect(lobbyPage(stranger)).toHaveAttribute("data-viewer", "visitor", {
      timeout: 20000,
    });
    const bar = stranger.locator(".weered-joinbar");
    await expect(bar).toBeVisible();
    await expect(bar).toContainText(`You're looking round ${lobbyName}. Join free`);
    await expect(stranger.getByText(/Unlock the/i)).toHaveCount(0);
    await bar.getByRole("button", { name: `Join ${lobbyName}` }).click();
    await expect(stranger).toHaveURL(signUp, { timeout: 15000 });
    // They make an account and arrive in the lobby a member: the bar is gone.
    await register(stranger, ("st" + stamp()).toLowerCase().slice(0, 24));
    await expect(stranger).toHaveURL(new RegExp(`/lobby/${lobbyId}`), { timeout: 20000 });
    await expect.poll(() => roleIn(stranger, lobbyId), { timeout: 20000 }).toBe("MEMBER");
    await expect(lobbyPage(stranger)).toHaveAttribute("data-viewer", "member");
    await expect(bar).toHaveCount(0);
    await strangerCtx.close();
  });
});
