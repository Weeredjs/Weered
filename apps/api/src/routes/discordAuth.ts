import type { FastifyInstance } from "fastify";
import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";
import { prisma } from "../lib/prisma";
import { log, swallow } from "../lib/logger";
import { registrationBlock } from "../lib/registration";
import { setAuthCookie } from "../lib/authCookie";
import { accountForIdentity } from "../lib/googleLink";

// Sign in with Discord (2026-11-01): the people trying Weered mostly come from
// Discord, and their members can sign in with the account they already have.
//
//   GET /auth/providers          which sign-in services are switched on
//   GET /auth/discord            off to Discord, holding a nonce for this browser
//   GET /auth/discord/callback   back from Discord: link or make the account
//
// The OAuth state carries a nonce that must match a short cookie set on the
// way out, so a sign-in only finishes in the browser that started it (nobody
// can sign a visitor into an account of theirs). Accounts are matched the way
// Google's are (lib/googleLink.ts): an address links only when Discord says
// it's verified. DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET switch it on.
type Opts = {
  JWT_SECRET: string;
  getSiteConfig: (key: string) => Promise<string | null>;
  seedWelcomeDM: (userId: string) => Promise<unknown>;
  /** Tests stand in for Discord here. */
  fetchImpl?: typeof fetch;
};

const STATE_COOKIE = "weered_oauth";

function readCookie(req: any, name: string): string {
  for (const part of String(req.headers?.cookie || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return "";
}

export default async function discordAuthRoutes(app: FastifyInstance, opts: Opts) {
  const { JWT_SECRET, getSiteConfig, seedWelcomeDM } = opts;
  const http = opts.fetchImpl || fetch;
  const CLIENT_ID = process.env.DISCORD_CLIENT_ID || "";
  const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || "";
  const CALLBACK =
    process.env.DISCORD_CALLBACK_URL || "https://api.weered.ca/auth/discord/callback";
  const WEB_URL = process.env.APP_URL || "https://weered.ca";
  const on = !!(CLIENT_ID && CLIENT_SECRET);
  const fail = (reply: any, error: string) => reply.redirect(`${WEB_URL}/login?error=${error}`);

  app.get("/auth/providers", async () => ({
    ok: true,
    google: !!process.env.GOOGLE_CLIENT_ID,
    discord: on,
  }));

  app.get("/auth/discord", async (_req, reply) => {
    if (!on) return fail(reply, "discord_unavailable");
    const nonce = randomBytes(16).toString("hex");
    const state = jwt.sign({ p: "discord", n: nonce }, JWT_SECRET, { expiresIn: "10m" });
    reply.header(
      "Set-Cookie",
      `${STATE_COOKIE}=${nonce}; HttpOnly; Secure; SameSite=Lax; Path=/auth/discord; Max-Age=600`,
    );
    const u = new URL("https://discord.com/oauth2/authorize");
    u.searchParams.set("client_id", CLIENT_ID);
    u.searchParams.set("response_type", "code");
    u.searchParams.set("redirect_uri", CALLBACK);
    u.searchParams.set("scope", "identify email");
    u.searchParams.set("state", state);
    return reply.redirect(u.toString());
  });

  app.get("/auth/discord/callback", async (req, reply) => {
    const q: any = (req as any).query || {};
    if (q.error) return fail(reply, "discord_cancelled");
    let nonce = "";
    try {
      const d: any = jwt.verify(String(q.state || ""), JWT_SECRET);
      if (d?.p === "discord") nonce = String(d.n || "");
    } catch {}
    if (!nonce || readCookie(req, STATE_COOKIE) !== nonce) return fail(reply, "oauth_state");
    if (!on || !q.code) return fail(reply, "no_code");
    try {
      const tok = await http("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          grant_type: "authorization_code",
          code: String(q.code),
          redirect_uri: CALLBACK,
        }).toString(),
      });
      if (!tok.ok) return fail(reply, "oauth_failed");
      const access = String(((await tok.json()) as any)?.access_token || "");
      const meRes = await http("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${access}` },
      });
      if (!meRes.ok) return fail(reply, "oauth_failed");
      const me: any = await meRes.json();
      const discordId = String(me?.id || "");
      if (!/^\d{5,25}$/.test(discordId)) return fail(reply, "oauth_failed");
      const email = typeof me.email === "string" && me.email ? me.email : null;
      const avatar = /^[a-z0-9_]{1,64}$/i.test(String(me.avatar || ""))
        ? `https://cdn.discordapp.com/avatars/${discordId}/${me.avatar}.png?size=256`
        : null;
      const displayName = String(me.global_name || me.username || `d_${discordId.slice(-8)}`).slice(
        0,
        32,
      );

      const found = await accountForIdentity(
        prisma,
        "discordId",
        { id: discordId, email, emailVerified: me.verified === true },
        avatar,
      );
      let user = found.user;
      const isNew = !user;
      if (!user) {
        const blocked = await registrationBlock(getSiteConfig);
        if (blocked) return fail(reply, blocked);
        user = await prisma.user.create({
          data: {
            name: displayName,
            usernameKey: `d_${discordId}`,
            discordId,
            email: found.email,
            avatar,
          },
        });
        Promise.resolve(seedWelcomeDM(user.id)).catch(swallow);
      }
      if (user.banned) return fail(reply, "account_suspended");
      const token = jwt.sign({ sub: user.id, name: user.name }, JWT_SECRET, { expiresIn: "7d" });
      setAuthCookie(reply, token);
      // The session is the cookie; the page only needs who signed in.
      const who = encodeURIComponent(JSON.stringify({ id: user.id, name: user.name }));
      return reply.redirect(
        isNew
          ? `${WEB_URL}/onboarding?user=${who}&new=1`
          : `${WEB_URL}/auth/discord/finish?user=${who}`,
      );
    } catch (e) {
      log.error("[discord callback]", e);
      return fail(reply, "oauth_failed");
    }
  });
}
