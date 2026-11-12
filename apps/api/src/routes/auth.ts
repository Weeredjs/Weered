import { log, swallow } from "../lib/logger";
import type { FastifyInstance } from "fastify";
import { fetchWithTimeout } from "../lib/fetchWithTimeout";
import { z } from "zod";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { randomBytes, randomInt } from "crypto";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../lib/prisma";
import { bannedMessage } from "../lib/banAppeal";
import { registrationBlock } from "../lib/registration";
import { cutoffNow } from "../lib/sessionCutoff";
import { isOfficeRoom } from "../lib/officeRooms";
import { accountForGoogle } from "../lib/googleLink";
import { cleanDisplayName } from "../lib/displayName";
import { loginFailed, loginPaused, loginSucceeded, noAccountDelay } from "../lib/loginGuard";
import { setAuthCookie, clearAuthCookie, isWebClient, readCookie } from "../lib/authCookie";
import wsTicketRoute from "./wsTicket";
import officeRoutes from "./office";

// Web auth lives in the httpOnly cookie (set via setAuthCookie); only non-web
// clients (mobile/desktop, which don't use cookies) get the token in the body.
// Web is identified by the x-client:web header the browser fetch-patch sends.
function authedSend(req: any, reply: any, token: string, extra: Record<string, any> = {}) {
  return reply.send(isWebClient(req) ? extra : { token, ...extra });
}
import { sendMail, buildVerifyEmail, buildResetEmail } from "../lib/email";

// Auth routes (extracted from index.ts): local register/login/logout, email
// verification + password reset, Google OAuth, dev-login, username-check,
// onboarding. Cookie helpers live in lib/authCookie so the cookie name +
// attributes stay byte-identical with the global onRequest hook in index.ts.
type Opts = {
  authFromHeader: (h?: string) => { id: string; name: string } | null;
  JWT_SECRET: string;
  isNameReserved: (name: string, scope: "LOBBY" | "USERNAME" | "BOTH") => Promise<boolean>;
  getSiteConfig: (key: string) => Promise<string | null>;
  seedWelcomeDM: (toUserId: string) => Promise<void>;
  // live room presence (roomId -> { users: Map<userId, ...> }); used to gate the
  // presented-plan read on actual consult-room admission.
  rooms: any;
  // GOD-or-allowlist check: lets a normal Weered session act as office host.
  isOfficeStaff: (userId?: string) => Promise<boolean>;
};

export default async function authRoutes(app: FastifyInstance, opts: Opts) {
  const {
    authFromHeader,
    JWT_SECRET,
    isNameReserved,
    getSiteConfig,
    seedWelcomeDM,
    rooms,
    isOfficeStaff,
  } = opts;

  // env-derived config, exclusive to auth (re-derived here from process.env).
  const DEV_LOGIN_ENABLED =
    process.env.ALLOW_DEV_LOGIN === "1" || process.env.NODE_ENV === "development";
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
  const GOOGLE_CALLBACK_URL =
    process.env.GOOGLE_CALLBACK_URL || "https://api.weered.ca/auth/google/callback";
  const WEB_URL = process.env.APP_URL || "https://weered.ca";

  const REDIRECT_ALLOW = [
    /^https:\/\/([a-z0-9-]+\.)?weered\.ca(\/.*)?$/i,
    /^weered:\/\/[^\s]*$/i,
    /^exp:\/\/[0-9a-z.\-:]+\/--\/[^\s]*$/i,
  ];
  const isAllowedRedirect = (u: string) => REDIRECT_ALLOW.some((re) => re.test(u));
  const GOOGLE_STATE_COOKIE = "weered_oauth_g";

  async function verifyCaptcha(
    token: unknown,
    ip: string,
  ): Promise<{ ok: true } | { ok: false; reason: string }> {
    const secret = process.env.TURNSTILE_SECRET;
    if (!secret) return { ok: true };
    if (typeof token !== "string" || !token) return { ok: false, reason: "missing_captcha" };
    try {
      const r = await fetchWithTimeout(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ secret, response: token, remoteip: ip }).toString(),
        },
      );
      const j = (await r.json().catch(() => null)) as {
        success?: boolean;
        "error-codes"?: string[];
      } | null;
      if (!j?.success) return { ok: false, reason: j?.["error-codes"]?.[0] ?? "captcha_failed" };
      return { ok: true };
    } catch (e) {
      log.warn("[turnstile] verify error:", e);
      return { ok: false, reason: "captcha_unreachable" };
    }
  }

  app.post(
    "/auth/dev-login",
    {
      config: { rateLimit: { max: 30, timeWindow: "10 minutes" } },
    },
    async (req, reply) => {
      if (!DEV_LOGIN_ENABLED) return reply.code(404).send({ error: "not_found" });
      const body: any = (req as any).body || {};
      const raw = typeof body.username === "string" ? body.username : "";
      let name = (raw || "").trim().slice(0, 32);
      if (!name) {
        const suf = Math.floor(Math.random() * 9000 + 1000);
        name = `Guest-${suf}`;
      }
      const usernameKey = name.toLowerCase();
      const u = await prisma.user.upsert({
        where: { usernameKey },
        update: { name },
        create: { usernameKey, name },
      });
      const user = { id: u.id, name: u.name || name };
      const token = jwt.sign({ sub: user.id, name: user.name }, JWT_SECRET, { expiresIn: "7d" });
      return reply.send({ token, user });
    },
  );

  app.post("/dev-login", async (req, reply) => {
    if (!DEV_LOGIN_ENABLED) return reply.code(404).send({ error: "not_found" });
    const r = await (app as any).inject({
      method: "POST",
      url: "/auth/dev-login",
      payload: (req as any).body || {},
    });
    reply.code(r.statusCode).headers(r.headers).send(r.json());
  });

  app.post(
    "/auth/register",
    {
      // Five new accounts an hour from one address. REGISTER_MAX_PER_HOUR raises
      // it for the end-to-end stack only, where every test signs up from the
      // same address and one retry used to trip it; unset (as on the live
      // site), it is five.
      config: {
        rateLimit: {
          max: Math.max(5, Number(process.env.REGISTER_MAX_PER_HOUR) || 5),
          timeWindow: "1 hour",
        },
      },
      schema: {
        tags: ["auth"],
        summary: "Register a new local account",
        body: z
          .object({
            username: z.string().min(1).max(64),
            password: z.string().min(1).max(512),
            email: z.string().max(254).optional().nullable(),
            captchaToken: z.string().optional().nullable(),
            turnstileToken: z.string().optional().nullable(),
          })
          .passthrough(),
      },
    },
    async (req, reply) => {
      const body: any = (req as any).body || {};
      const rawU = typeof body.username === "string" ? body.username : "";
      const rawP = typeof body.password === "string" ? body.password : "";
      const rawE = typeof body.email === "string" ? body.email : "";
      const captchaToken = body.captchaToken ?? body.turnstileToken;
      const username = (rawU || "").trim().toLowerCase().slice(0, 32);
      const password = (rawP || "").trim();
      const email = (rawE || "").trim().toLowerCase().slice(0, 254) || null;
      if (!username || !password)
        return reply.code(400).send({ error: "Missing username/password" });
      // Same rule as onboarding. Without it a member registered with their email
      // as their username (2026-10-03), and it showed as their name in chat.
      if (username.includes("@"))
        return reply.code(400).send({
          error: "Use a username, not your email address. Letters, numbers and underscores.",
        });
      if (!/^[a-z0-9_]{2,32}$/.test(username))
        return reply
          .code(400)
          .send({ error: "Usernames use letters, numbers and underscores only (2 to 32)." });
      if (password.length < 6) return reply.code(400).send({ error: "Password too short" });
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return reply.code(400).send({ error: "Invalid email" });
      const cap = await verifyCaptcha(captchaToken, req.ip);
      if (!cap.ok) return reply.code(400).send({ error: "captcha_required", reason: cap.reason });
      const blocked = await registrationBlock(getSiteConfig);
      if (blocked) return reply.code(403).send({ error: blocked });
      const existing = await prisma.localAuth.findUnique({ where: { username } }).catch(() => null);
      if (existing) return reply.code(409).send({ error: "Username already exists" });
      if (email) {
        // A Google account holds its address on User alone; without this check
        // the create below hit the unique index and answered 500.
        const emailTaken =
          (await prisma.localAuth.findUnique({ where: { email } }).catch(() => null)) ||
          (await prisma.user
            .findFirst({ where: { email }, select: { id: true } })
            .catch(() => null));
        if (emailTaken) return reply.code(409).send({ error: "Email already in use" });
      }
      const reserved = await isNameReserved(username, "USERNAME");
      if (reserved)
        return reply.code(403).send({ error: "This username is reserved and cannot be used." });
      // A User row can exist without LocalAuth (Google signups, system accounts
      // like the Operator) — colliding with its usernameKey must be a clean 409,
      // not a unique-constraint 500.
      const nameTaken = await prisma.user
        .findUnique({ where: { usernameKey: username } })
        .catch(() => null);
      if (nameTaken) return reply.code(409).send({ error: "Username already exists" });
      const user = await prisma.user.create({
        data: { name: username, usernameKey: username, email },
      });
      const passwordHash = await bcrypt.hash(password, 10);

      let verifyToken: string | null = null;
      let verifyTokenExp: Date | null = null;
      if (email) {
        verifyToken = randomBytes(32).toString("hex");
        verifyTokenExp = new Date(Date.now() + 24 * 60 * 60 * 1000);
      }
      await prisma.localAuth.create({
        data: {
          username,
          passwordHash,
          userId: user.id,
          email,
          ...(verifyToken ? { verifyToken, verifyTokenExp } : {}),
        },
      });
      if (email && verifyToken) {
        const tmpl = buildVerifyEmail({ username, token: verifyToken });
        sendMail({ to: email, subject: tmpl.subject, html: tmpl.html }).catch(swallow);
      }
      seedWelcomeDM(user.id).catch(swallow);
      const token = jwt.sign({ sub: user.id, name: user.name }, JWT_SECRET, { expiresIn: "7d" });
      setAuthCookie(reply, token);
      return authedSend(req, reply, token, { user, pendingVerification: Boolean(email) });
    },
  );

  app.post(
    "/auth/verify-email",
    {
      config: { rateLimit: { max: 30, timeWindow: "1 hour" } },
    },
    async (req, reply) => {
      const body: any = (req as any).body || {};
      const token = typeof body.token === "string" ? body.token.trim() : "";
      if (!token) return reply.code(400).send({ error: "Missing token" });
      const la = await prisma.localAuth
        .findUnique({ where: { verifyToken: token } })
        .catch(() => null);
      if (!la) return reply.code(400).send({ error: "Invalid or expired token" });
      if (la.verifyTokenExp && la.verifyTokenExp.getTime() < Date.now()) {
        return reply.code(400).send({ error: "Token expired" });
      }
      await prisma.localAuth.update({
        where: { id: la.id },
        data: { emailVerified: true, verifyToken: null, verifyTokenExp: null },
      });
      const user = await prisma.user.findUnique({ where: { id: la.userId } });
      if (!user) return reply.code(500).send({ error: "Account record missing" });
      if (user.banned)
        return reply
          .code(403)
          .send({ ok: false, error: "banned", message: await bannedMessage(user.id) });
      // The link proves the address and nothing more. It used to sign in
      // whoever opened it: a 24-hour login link, and someone who registered
      // with your address got you signed in to their account when you clicked
      // (red team 2026-11-01, finding 23). A browser already signed in to this
      // account stays signed in; anyone else signs in the usual way.
      const me = authFromHeader((req.headers as any).authorization);
      if (me?.id !== user.id) return reply.send({ ok: true, signedIn: false });
      return reply.send({ ok: true, signedIn: true, user });
    },
  );

  app.post(
    "/auth/resend-verification",
    {
      config: { rateLimit: { max: 5, timeWindow: "1 hour" } },
    },
    async (req, reply) => {
      const body: any = (req as any).body || {};
      const username = (typeof body.username === "string" ? body.username : "")
        .trim()
        .toLowerCase()
        .slice(0, 32);
      if (!username) return reply.send({ ok: true });
      const la = await prisma.localAuth.findUnique({ where: { username } }).catch(() => null);
      if (la && la.email && !la.emailVerified) {
        const verifyToken = randomBytes(32).toString("hex");
        const verifyTokenExp = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await prisma.localAuth.update({
          where: { id: la.id },
          data: { verifyToken, verifyTokenExp },
        });
        const tmpl = buildVerifyEmail({ username, token: verifyToken });
        sendMail({ to: la.email, subject: tmpl.subject, html: tmpl.html }).catch(swallow);
      }
      return reply.send({ ok: true });
    },
  );

  app.post(
    "/auth/forgot-password",
    {
      config: { rateLimit: { max: 5, timeWindow: "1 hour" } },
    },
    async (req, reply) => {
      const body: any = (req as any).body || {};
      const username = (typeof body.username === "string" ? body.username : "")
        .trim()
        .toLowerCase()
        .slice(0, 32);
      const email = (typeof body.email === "string" ? body.email : "")
        .trim()
        .toLowerCase()
        .slice(0, 254);
      let la = null as any;
      if (username)
        la = await prisma.localAuth.findUnique({ where: { username } }).catch(() => null);
      else if (email)
        la = await prisma.localAuth.findUnique({ where: { email } }).catch(() => null);
      // The same answer, as fast, whether or not the account exists: the write
      // and the email happen after it (red team finding 24).
      if (la && la.email) {
        const resetToken = randomBytes(32).toString("hex");
        const resetExp = new Date(Date.now() + 60 * 60 * 1000);
        const tmpl = buildResetEmail({ username: la.username, token: resetToken });
        void prisma.localAuth
          .update({
            where: { id: la.id },
            data: { passwordResetToken: resetToken, passwordResetTokenExp: resetExp },
          })
          .then(() => sendMail({ to: la.email, subject: tmpl.subject, html: tmpl.html }))
          .catch(swallow);
      }
      return reply.send({ ok: true });
    },
  );

  app.post(
    "/auth/reset-password",
    {
      config: { rateLimit: { max: 10, timeWindow: "1 hour" } },
    },
    async (req, reply) => {
      const body: any = (req as any).body || {};
      const token = typeof body.token === "string" ? body.token.trim() : "";
      const password = typeof body.password === "string" ? body.password.trim() : "";
      if (!token || !password) return reply.code(400).send({ error: "Missing token or password" });
      if (password.length < 6) return reply.code(400).send({ error: "Password too short" });
      const la = await prisma.localAuth
        .findUnique({ where: { passwordResetToken: token } })
        .catch(() => null);
      if (!la) return reply.code(400).send({ error: "Invalid or expired token" });
      if (la.passwordResetTokenExp && la.passwordResetTokenExp.getTime() < Date.now()) {
        return reply.code(400).send({ error: "Token expired" });
      }
      const passwordHash = await bcrypt.hash(password, 10);
      await prisma.localAuth.update({
        where: { id: la.id },
        data: { passwordHash, passwordResetToken: null, passwordResetTokenExp: null },
      });
      // A new password ends every existing session: a stolen token used to
      // outlive the reset for its full 7 days (audit 2026-09-27).
      await prisma.user.update({
        where: { id: la.userId },
        data: { tokensValidAfter: cutoffNow() },
      });
      return reply.send({ ok: true });
    },
  );

  app.post(
    "/auth/login",
    {
      config: { rateLimit: { max: 20, timeWindow: "15 minutes" } },
      schema: {
        tags: ["auth"],
        summary: "Log in with username + password",
        body: z
          .object({
            username: z.string().min(1).max(64),
            password: z.string().min(1).max(512),
          })
          .passthrough(),
      },
    },
    async (req, reply) => {
      const body: any = (req as any).body || {};
      const rawU = typeof body.username === "string" ? body.username : "";
      const rawP = typeof body.password === "string" ? body.password : "";
      const username = (rawU || "").trim().toLowerCase().slice(0, 32);
      const password = (rawP || "").trim();
      if (!username || !password)
        return reply.code(400).send({ error: "Missing username/password" });
      // Ten wrong tries on one name pause it for 15 minutes (lib/loginGuard.ts).
      if (loginPaused(username))
        return reply.code(429).send({
          error: "too_many_tries",
          message: "Too many tries for this name. Wait a few minutes, or reset your password.",
        });
      const la = await prisma.localAuth.findUnique({ where: { username } }).catch(() => null);
      if (!la) {
        await noAccountDelay(password);
        loginFailed(username);
        return reply.code(401).send({ error: "Invalid credentials" });
      }
      const ok = await bcrypt.compare(password, la.passwordHash);
      if (!ok) {
        loginFailed(username);
        return reply.code(401).send({ error: "Invalid credentials" });
      }
      loginSucceeded(username);
      const user = await prisma.user.findUnique({ where: { id: la.userId } });
      if (!user) return reply.code(401).send({ error: "Invalid credentials" });
      if (user.banned)
        return reply
          .code(403)
          .send({ ok: false, error: "banned", message: await bannedMessage(user.id) });
      const token = jwt.sign({ sub: user.id, name: user.name }, JWT_SECRET, { expiresIn: "7d" });
      setAuthCookie(reply, token);
      return authedSend(req, reply, token, { user });
    },
  );

  // The socket's ticket, where sessions roll (routes/wsTicket.ts).
  wsTicketRoute(app, { authFromHeader, JWT_SECRET });

  // Frictionless guest join: validate a GUEST invite -> ephemeral scoped user -> short-lived
  // token bound to ONE lobby. Never sets the account cookie; token returned in body only
  // (white-label client stores it in sessionStorage + sends as Authorization header).
  app.post(
    "/auth/guest",
    { config: { rateLimit: { max: 50, timeWindow: "1 hour" } } },
    async (req, reply) => {
      const body: any = (req as any).body || {};
      const inviteToken = String(body.inviteToken || body.invite || "").trim();
      const rawName = String(body.name || "")
        .trim()
        .slice(0, 40);
      if (!inviteToken) return reply.code(400).send({ ok: false, error: "missing_invite" });

      const invite = await prisma.invite.findUnique({ where: { token: inviteToken } });
      // The office's own links only: a lobby's guest link is routes/guestJoin.ts.
      if (
        !invite ||
        invite.type !== "GUEST" ||
        !invite.targetId ||
        !isOfficeRoom(invite.targetId)
      ) {
        return reply.code(404).send({ ok: false, error: "invalid_invite" });
      }
      if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
        return reply.code(410).send({ ok: false, error: "expired" });
      }
      const consumed = await prisma.invite.updateMany({
        where:
          invite.maxUses > 0
            ? { token: inviteToken, uses: { lt: invite.maxUses } }
            : { token: inviteToken },
        data: { uses: { increment: 1 } },
      });
      if (consumed.count !== 1) {
        return reply.code(409).send({ ok: false, error: "used_up" });
      }

      // randomInt is rejection-sampled → no modulo bias in the guest suffix.
      const name = rawName || `Guest-${randomInt(1000, 10000)}`;
      const guestId = `guest_${randomBytes(12).toString("hex")}`;
      // ephemeral user + token live no longer than the invite window, capped at
      // 3h: a renewal review can run past 90 minutes (2026-11-11).
      const cap = Date.now() + 3 * 60 * 60 * 1000;
      const expMs = invite.expiresAt ? Math.min(invite.expiresAt.getTime(), cap) : cap;
      const ttlSec = Math.max(60, Math.floor((expMs - Date.now()) / 1000));

      const user = await prisma.user.create({
        data: { usernameKey: guestId, name, isGuest: true, guestExpiresAt: new Date(expMs) },
        select: { id: true, name: true },
      });

      const office = invite.targetId;
      // office = a room-prefix namespace (e.g. "mtg-eceb"); foyer is the open waiting room.
      // lobbyId kept = foyer for back-compat with the current single-room foyer page.
      const scope = { office, foyer: `${office}-foyer`, lobbyId: `${office}-foyer` };
      const token = jwt.sign({ sub: user.id, name: user.name, guest: true, scope }, JWT_SECRET, {
        expiresIn: ttlSec,
      });
      return reply.send({
        ok: true,
        token,
        scope,
        expiresIn: ttlSec,
        user: { id: user.id, name: user.name },
      });
    },
  );
  app.post("/auth/logout", async (_req, reply) => {
    clearAuthCookie(reply);
    return reply.send({ ok: true });
  });

  app.get("/auth/google", async (req, reply) => {
    const { redirect } = (req as any).query as { redirect?: string };
    const client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL);
    // The state always carries a nonce that must come back with this browser's
    // cookie, so a sign-in only finishes where it started: nobody can hand a
    // visitor a callback that signs them into an account of theirs (red team
    // 2026-11-01, finding 10). Same as Discord's (routes/discordAuth.ts).
    const nonce = randomBytes(16).toString("hex");
    const state = jwt.sign(
      { n: nonce, ...(redirect && isAllowedRedirect(redirect) ? { r: redirect } : {}) },
      JWT_SECRET,
      { expiresIn: "10m" },
    );
    reply.header(
      "Set-Cookie",
      `${GOOGLE_STATE_COOKIE}=${nonce}; HttpOnly; Secure; SameSite=Lax; Path=/auth/google; Max-Age=600`,
    );
    const url = client.generateAuthUrl({
      access_type: "offline",
      scope: ["profile", "email"],
      prompt: "select_account",
      state,
    });
    return reply.redirect(url);
  });

  app.get("/auth/google/callback", async (req, reply) => {
    const { code, state } = (req as any).query as { code?: string; state?: string };
    let customRedirect: string | null = null;
    let nonce = "";
    if (state) {
      try {
        const decoded = jwt.verify(state, JWT_SECRET) as { r?: string; n?: string };
        nonce = String(decoded?.n || "");
        if (decoded?.r && isAllowedRedirect(decoded.r)) customRedirect = decoded.r;
      } catch (e) {
        swallow(e);
      }
    }
    if (!nonce || readCookie(req, GOOGLE_STATE_COOKIE) !== nonce)
      return reply.redirect(`${WEB_URL}/login?error=oauth_state`);
    const finishUrl = (path: string, qs: string) => {
      if (customRedirect) {
        const sep = customRedirect.includes("?") ? "&" : "?";
        return `${customRedirect}${sep}${qs}`;
      }
      return `${WEB_URL}${path}?${qs}`;
    };
    if (!code)
      return reply.redirect(
        customRedirect
          ? `${customRedirect}${customRedirect.includes("?") ? "&" : "?"}error=no_code`
          : `${WEB_URL}/login?error=no_code`,
      );
    try {
      const client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL);
      const { tokens } = await client.getToken(code);
      client.setCredentials(tokens);
      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token!,
        audience: GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (!payload) return reply.redirect(`${WEB_URL}/login?error=no_payload`);
      const googleId = payload.sub;
      const email = payload.email || null;
      const avatar = payload.picture || null;
      // The profile's name, unless it would pass for Weered (lib/displayName.ts).
      const displayName = (await cleanDisplayName(payload.name)) || `g_${googleId.slice(0, 12)}`;

      // An email match links only when it's safe (lib/googleLink.ts).
      const found = await accountForGoogle(
        prisma,
        { googleId, email, emailVerified: payload.email_verified === true },
        avatar,
      );
      let user = found.user;

      const isNew = !user;
      if (!user) {
        const blocked = await registrationBlock(getSiteConfig);
        if (blocked)
          return reply.redirect(
            customRedirect
              ? `${customRedirect}${customRedirect.includes("?") ? "&" : "?"}error=${blocked}`
              : `${WEB_URL}/login?error=${blocked}`,
          );
        const tempName = `g_${googleId.slice(0, 12)}`;
        user = await prisma.user.create({
          data: { name: displayName, usernameKey: tempName, googleId, email: found.email, avatar },
        });
        seedWelcomeDM(user.id).catch(swallow);
      }
      if (user.banned)
        return reply.redirect(
          customRedirect
            ? `${customRedirect}${customRedirect.includes("?") ? "&" : "?"}error=account_suspended`
            : `${WEB_URL}/login?error=account_suspended`,
        );
      const token = jwt.sign({ sub: user.id, name: user.name }, JWT_SECRET, { expiresIn: "7d" });
      setAuthCookie(reply, token);
      const userParam = encodeURIComponent(JSON.stringify({ id: user.id, name: user.name }));
      // The web has the cookie, so its address carries only who signed in; an
      // app (weered:// or exp://) still needs the token (red team finding 23).
      const appReturn = !!customRedirect && !/^https:\/\//i.test(customRedirect);
      const qs = `${appReturn ? `token=${token}&` : ""}user=${userParam}${isNew ? "&new=1" : ""}`;
      return reply.redirect(finishUrl(isNew ? "/onboarding" : "/auth/google/finish", qs));
    } catch (e) {
      log.error("[google callback]", e);
      return reply.redirect(
        customRedirect
          ? `${customRedirect}${customRedirect.includes("?") ? "&" : "?"}error=oauth_failed`
          : `${WEB_URL}/login?error=oauth_failed`,
      );
    }
  });

  app.get("/auth/username-check", async (req, reply) => {
    const { username } = (req as any).query as { username?: string };
    const clean = (username || "")
      .toLowerCase()
      .replaceAll(/[^a-z0-9_]/g, "")
      .slice(0, 32);
    if (clean.length < 2) return reply.send({ available: false, reason: "too_short" });
    const existing = await prisma.user
      .findUnique({ where: { usernameKey: clean } })
      .catch(() => null);
    return reply.send({ available: !existing });
  });

  app.post("/auth/onboarding", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ error: "Unauthorized" });
    const body: any = (req as any).body || {};
    const raw = typeof body.username === "string" ? body.username : "";
    const usernameKey = raw
      .toLowerCase()
      .replaceAll(/[^a-z0-9_]/g, "")
      .slice(0, 32);
    if (usernameKey.length < 2) return reply.code(400).send({ error: "Username too short" });
    const existing = await prisma.user.findUnique({ where: { usernameKey } }).catch(() => null);
    if (existing && existing.id !== u.id) return reply.code(409).send({ error: "Username taken" });
    const reserved = await isNameReserved(usernameKey, "USERNAME");
    if (reserved)
      return reply.code(403).send({ error: "This username is reserved and cannot be used." });
    const updated = await prisma.user.update({
      where: { id: u.id },
      data: { name: usernameKey, usernameKey },
    });
    const token = jwt.sign({ sub: updated.id, name: updated.name }, JWT_SECRET, {
      expiresIn: "7d",
    });
    // A new session for the new name: the cookie for the web, the body for apps.
    setAuthCookie(reply, token);
    return authedSend(req, reply, token, { user: { id: updated.id, name: updated.name } });
  });

  // The ECEB office: hours, the door, walk-ins and the plan module (routes/office.ts).
  await officeRoutes(app, { authFromHeader, rooms, isOfficeStaff, JWT_SECRET });
}
