// The layout gallery's pictures: Home in each first-run layout and colourway
// (apps/web/lib/layoutGallery.ts), shot on the local stack
// (scripts/local/README.md) into apps/web/public/brand/layouts/.
//
//   cd apps/api
//   $env:DATABASE_URL = "postgresql://weered:weered@127.0.0.1:15432/weered_local"
//   npx tsx scripts/layout-shots.ts <username> [layout-look ...]
//
// Local only: it signs in as <username> with a session cookie minted from the
// local secret (the login route rate-limits) and refuses any database but the
// local one. The viewer's own prefs are put back afterwards.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import jwt from "jsonwebtoken";
import sharp from "sharp";
import { Prisma, PrismaClient } from "@prisma/client";

// The web app's modules are CommonJS to tsx, so they come in through require.
const web = createRequire(import.meta.url);
const { presetLayout } = web("../../web/lib/shellLayout.ts");
const { GALLERY_LAYOUTS, GALLERY_LOOKS } = web("../../web/lib/layoutGallery.ts");
const { DEFAULT_LOOK, LOOK_EPOCH, LOOK_EPOCH_KEY, PREFS_KEY, PREFS_OWNER_KEY } = web(
  "../../web/lib/uiPrefs.ts",
);

const BASE = process.env.SHOTS_BASE || "http://bar.localhost:8080";
const DB = process.env.DATABASE_URL || "";
if (!/@127\.0\.0\.1:15432\//.test(DB)) {
  console.error("Local database only: set DATABASE_URL to the 127.0.0.1:15432 one.");
  process.exit(1);
}
const SECRET = process.env.JWT_SECRET || "local-only-secret";
// A breath between shots: each Home load makes ~100 API calls, and the API
// allows 600 a minute from one address (src/index.ts). Past it, Home comes up
// empty: nobody here, no chat, no card look.
const PAUSE_MS = Number(process.env.SHOTS_PAUSE_MS || 20_000);
const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, "../../web/public/brand/layouts");
const { chromium } = createRequire(path.resolve(here, "../../web/package.json"))(
  "@playwright/test",
);

const [who, ...only] = process.argv.slice(2);
if (!who) {
  console.error("usage: npx tsx scripts/layout-shots.ts <username> [layout-look ...]");
  process.exit(1);
}

const prisma = new PrismaClient();
const user = await prisma.user.findUnique({ where: { usernameKey: who.toLowerCase() } });
if (!user) {
  console.error(`No account ${who} on this database.`);
  process.exit(1);
}
const before = user.uiPrefs;

const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 1,
  serviceWorkers: "block",
});
const host = new URL(BASE).hostname;
await ctx.addCookies([
  {
    name: "weered_token",
    value: jwt.sign({ sub: user.id, name: user.name }, SECRET, { expiresIn: "1h" }),
    domain: host,
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
  },
]);
// No "+5 XP" toasts in the pictures.
await ctx.addInitScript(
  `window.addEventListener("weered:notoriety:award", function (e) { e.stopImmediatePropagation(); }, true);`,
);
const page = await ctx.newPage();
await page.goto(BASE + "/login", { waitUntil: "domcontentloaded", timeout: 180_000 });
mkdirSync(OUT, { recursive: true });

try {
  for (const layout of GALLERY_LAYOUTS) {
    for (const look of GALLERY_LOOKS) {
      const key = `${layout.id}-${look.id}`;
      if (only.length && !only.includes(key)) continue;
      const prefs = {
        ...DEFAULT_LOOK,
        palette: look.palette,
        ...(look.accent ? { accent: look.accent } : {}),
        shell: presetLayout(layout.id),
        setup: "done",
        setupAt: new Date().toISOString(),
      };
      await page.waitForTimeout(PAUSE_MS);
      // The account and this browser agree, so neither repaints the other.
      await prisma.user.update({ where: { id: user.id }, data: { uiPrefs: prefs as any } });
      const me = { id: user.id, name: user.name, username: user.usernameKey, avatar: user.avatar };
      const store: [string, string][] = [
        [PREFS_KEY, JSON.stringify(prefs)],
        [PREFS_OWNER_KEY, user.id],
        [LOOK_EPOCH_KEY, LOOK_EPOCH],
        ["weered_user", JSON.stringify(me)],
        ["weered_cookie_consent", JSON.stringify({ version: 1, essential: true })],
        ["weered_push_later", String(Date.now())],
        ["weered_ios_pwa_later", String(Date.now())],
        // Both sides open, so the picture shows the whole layout.
        ["weered_right_collapsed", "0"],
        ["weered_left_collapsed", "0"],
      ];
      // A string, not a function: tsx's helpers don't exist in the page.
      await page.evaluate(
        `${JSON.stringify(store)}.forEach(function (e) { localStorage.setItem(e[0], e[1]); })`,
      );
      await page.goto(BASE + "/home", { waitUntil: "domcontentloaded", timeout: 180_000 });
      await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
      await page.locator(".weered-wayin-search").first().waitFor({ timeout: 120_000 });
      // Presence, the chat's lines, avatars and the fonts.
      await page.waitForTimeout(4500);
      const png = await page.screenshot();
      const file = path.join(OUT, `${key}.webp`);
      await sharp(png).resize(800, 500).webp({ quality: 80 }).toFile(file);
      console.log("shot", key);
    }
  }
} finally {
  await prisma.user.update({
    where: { id: user.id },
    data: { uiPrefs: before === null ? Prisma.DbNull : (before as any) },
  });
  await browser.close();
  await prisma.$disconnect();
}
