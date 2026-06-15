import type { FastifyInstance } from "fastify";
import { fetchWithTimeout } from "../lib/fetchWithTimeout";
import { z } from "zod";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../lib/prisma";
import { setAuthCookie, clearAuthCookie } from "../lib/authCookie";
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
};

export default async function authRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, JWT_SECRET, isNameReserved, getSiteConfig, seedWelcomeDM } = opts;

  // env-derived config, exclusive to auth (re-derived here from process.env).
  const DEV_LOGIN_ENABLED = process.env.ALLOW_DEV_LOGIN === "1" || process.env.NODE_ENV === "development";
  const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID     || "";
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
  const GOOGLE_CALLBACK_URL  = process.env.GOOGLE_CALLBACK_URL  || "https://api.weered.ca/auth/google/callback";
  const WEB_URL              = process.env.APP_URL               || "https://weered.ca";

  const REDIRECT_ALLOW = [
    /^https:\/\/([a-z0-9-]+\.)?weered\.ca(\/.*)?$/i,
    /^weered:\/\/[^\s]*$/i,
    /^exp:\/\/[0-9a-z.\-:]+\/--\/[^\s]*$/i,
  ];
  const isAllowedRedirect = (u: string) => REDIRECT_ALLOW.some((re) => re.test(u));

  async function verifyCaptcha(token: unknown, ip: string): Promise<{ ok: true } | { ok: false; reason: string }> {
    const secret = process.env.TURNSTILE_SECRET;
    if (!secret) return { ok: true };
    if (typeof token !== "string" || !token) return { ok: false, reason: "missing_captcha" };
    try {
      const r = await fetchWithTimeout("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ secret, response: token, remoteip: ip }).toString(),
      });
      const j = (await r.json().catch(() => null)) as { success?: boolean; "error-codes"?: string[] } | null;
      if (!j?.success) return { ok: false, reason: (j?.["error-codes"]?.[0] ?? "captcha_failed") };
      return { ok: true };
    } catch (e) {
      console.warn("[turnstile] verify error:", e);
      return { ok: false, reason: "captcha_unreachable" };
    }
  }

  app.post("/auth/dev-login", {
    config: { rateLimit: { max: 30, timeWindow: "10 minutes" } },
  }, async (req, reply) => {
    if (!DEV_LOGIN_ENABLED) return reply.code(404).send({ error: "not_found" });
    const body: any = (req as any).body || {};
    const raw = typeof body.username === "string" ? body.username : "";
    let name = (raw || "").trim().slice(0, 32);
    if (!name) { const suf = Math.floor(Math.random() * 9000 + 1000); name = `Guest-${suf}`; }
    const usernameKey = name.toLowerCase();
    const u = await prisma.user.upsert({
      where: { usernameKey }, update: { name }, create: { usernameKey, name },
    });
    const user = { id: u.id, name: u.name || name };
    const token = jwt.sign({ sub: user.id, name: user.name }, JWT_SECRET, { expiresIn: "7d" });
    return reply.send({ token, user });
  });

  app.post("/dev-login", async (req, reply) => {
    if (!DEV_LOGIN_ENABLED) return reply.code(404).send({ error: "not_found" });
    const r = await (app as any).inject({ method: "POST", url: "/auth/dev-login", payload: (req as any).body || {} });
    reply.code(r.statusCode).headers(r.headers).send(r.json());
  });

  app.post("/auth/register", {
    config: { rateLimit: { max: 5, timeWindow: "1 hour" } },
    schema: {
      tags: ["auth"],
      summary: "Register a new local account",
      body: z.object({
        username: z.string().min(1).max(64),
        password: z.string().min(1).max(512),
        email: z.string().max(254).optional().nullable(),
        captchaToken: z.string().optional().nullable(),
        turnstileToken: z.string().optional().nullable(),
      }).passthrough(),
    },
  }, async (req, reply) => {
    const body: any = (req as any).body || {};
    const rawU = typeof body.username === "string" ? body.username : "";
    const rawP = typeof body.password === "string" ? body.password : "";
    const rawE = typeof body.email === "string" ? body.email : "";
    const captchaToken = body.captchaToken ?? body.turnstileToken;
    const username = (rawU || "").trim().toLowerCase().slice(0, 32);
    const password = (rawP || "").trim();
    const email = (rawE || "").trim().toLowerCase().slice(0, 254) || null;
    if (!username || !password) return reply.code(400).send({ error: "Missing username/password" });
    if (password.length < 6) return reply.code(400).send({ error: "Password too short" });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply.code(400).send({ error: "Invalid email" });
    const cap = await verifyCaptcha(captchaToken, req.ip);
    if (!cap.ok) return reply.code(400).send({ error: "captcha_required", reason: cap.reason });
    if ((await getSiteConfig("registrationOpen")) === "false") return reply.code(403).send({ error: "registration_closed" });
    const existing = await prisma.localAuth.findUnique({ where: { username } }).catch(() => null);
    if (existing) return reply.code(409).send({ error: "Username already exists" });
    if (email) {
      const emailTaken = await prisma.localAuth.findUnique({ where: { email } }).catch(() => null);
      if (emailTaken) return reply.code(409).send({ error: "Email already in use" });
    }
    const reserved = await isNameReserved(username, "USERNAME");
    if (reserved) return reply.code(403).send({ error: "This username is reserved and cannot be used." });
    const user = await prisma.user.create({ data: { name: username, usernameKey: username, email } });
    const passwordHash = await bcrypt.hash(password, 10);

    let verifyToken: string | null = null;
    let verifyTokenExp: Date | null = null;
    if (email) {
      verifyToken = randomBytes(32).toString("hex");
      verifyTokenExp = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }
    await prisma.localAuth.create({
      data: {
        username, passwordHash, userId: user.id, email,
        ...(verifyToken ? { verifyToken, verifyTokenExp } : {}),
      },
    });
    if (email && verifyToken) {
      const tmpl = buildVerifyEmail({ username, token: verifyToken });
      sendMail({ to: email, subject: tmpl.subject, html: tmpl.html }).catch(() => {});
    }
    seedWelcomeDM(user.id).catch(() => {});
    const token = jwt.sign({ sub: user.id, name: user.name }, JWT_SECRET, { expiresIn: "7d" });
    setAuthCookie(reply, token);
    return reply.send({ token, user, pendingVerification: Boolean(email) });
  });

  app.post("/auth/verify-email", {
    config: { rateLimit: { max: 30, timeWindow: "1 hour" } },
  }, async (req, reply) => {
    const body: any = (req as any).body || {};
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token) return reply.code(400).send({ error: "Missing token" });
    const la = await prisma.localAuth.findUnique({ where: { verifyToken: token } }).catch(() => null);
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
    if (user.banned) return reply.code(403).send({ ok: false, error: "banned" });
    const sessionToken = jwt.sign({ sub: user.id, name: user.name }, JWT_SECRET, { expiresIn: "7d" });
    setAuthCookie(reply, sessionToken);
    return reply.send({ ok: true, token: sessionToken, user });
  });

  app.post("/auth/resend-verification", {
    config: { rateLimit: { max: 5, timeWindow: "1 hour" } },
  }, async (req, reply) => {
    const body: any = (req as any).body || {};
    const username = (typeof body.username === "string" ? body.username : "").trim().toLowerCase().slice(0, 32);
    if (!username) return reply.send({ ok: true });
    const la = await prisma.localAuth.findUnique({ where: { username } }).catch(() => null);
    if (la && la.email && !la.emailVerified) {
      const verifyToken = randomBytes(32).toString("hex");
      const verifyTokenExp = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await prisma.localAuth.update({ where: { id: la.id }, data: { verifyToken, verifyTokenExp } });
      const tmpl = buildVerifyEmail({ username, token: verifyToken });
      sendMail({ to: la.email, subject: tmpl.subject, html: tmpl.html }).catch(() => {});
    }
    return reply.send({ ok: true });
  });

  app.post("/auth/forgot-password", {
    config: { rateLimit: { max: 5, timeWindow: "1 hour" } },
  }, async (req, reply) => {
    const body: any = (req as any).body || {};
    const username = (typeof body.username === "string" ? body.username : "").trim().toLowerCase().slice(0, 32);
    const email = (typeof body.email === "string" ? body.email : "").trim().toLowerCase().slice(0, 254);
    let la = null as any;
    if (username) la = await prisma.localAuth.findUnique({ where: { username } }).catch(() => null);
    else if (email) la = await prisma.localAuth.findUnique({ where: { email } }).catch(() => null);
    if (la && la.email) {
      const resetToken = randomBytes(32).toString("hex");
      const resetExp = new Date(Date.now() + 60 * 60 * 1000);
      await prisma.localAuth.update({
        where: { id: la.id },
        data: { passwordResetToken: resetToken, passwordResetTokenExp: resetExp },
      });
      const tmpl = buildResetEmail({ username: la.username, token: resetToken });
      sendMail({ to: la.email, subject: tmpl.subject, html: tmpl.html }).catch(() => {});
    }
    return reply.send({ ok: true });
  });

  app.post("/auth/reset-password", {
    config: { rateLimit: { max: 10, timeWindow: "1 hour" } },
  }, async (req, reply) => {
    const body: any = (req as any).body || {};
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const password = typeof body.password === "string" ? body.password.trim() : "";
    if (!token || !password) return reply.code(400).send({ error: "Missing token or password" });
    if (password.length < 6) return reply.code(400).send({ error: "Password too short" });
    const la = await prisma.localAuth.findUnique({ where: { passwordResetToken: token } }).catch(() => null);
    if (!la) return reply.code(400).send({ error: "Invalid or expired token" });
    if (la.passwordResetTokenExp && la.passwordResetTokenExp.getTime() < Date.now()) {
      return reply.code(400).send({ error: "Token expired" });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.localAuth.update({
      where: { id: la.id },
      data: { passwordHash, passwordResetToken: null, passwordResetTokenExp: null },
    });
    return reply.send({ ok: true });
  });

  app.post("/auth/login", {
    config: { rateLimit: { max: 20, timeWindow: "15 minutes" } },
    schema: {
      tags: ["auth"],
      summary: "Log in with username + password",
      body: z.object({
        username: z.string().min(1).max(64),
        password: z.string().min(1).max(512),
      }).passthrough(),
    },
  }, async (req, reply) => {
    const body: any = (req as any).body || {};
    const rawU = typeof body.username === "string" ? body.username : "";
    const rawP = typeof body.password === "string" ? body.password : "";
    const username = (rawU || "").trim().toLowerCase().slice(0, 32);
    const password = (rawP || "").trim();
    if (!username || !password) return reply.code(400).send({ error: "Missing username/password" });
    const la = await prisma.localAuth.findUnique({ where: { username } }).catch(() => null);
    if (!la) return reply.code(401).send({ error: "Invalid credentials" });
    const ok = await bcrypt.compare(password, la.passwordHash);
    if (!ok) return reply.code(401).send({ error: "Invalid credentials" });
    const user = await prisma.user.findUnique({ where: { id: la.userId } });
    if (!user) return reply.code(401).send({ error: "Invalid credentials" });
    if (user.banned) return reply.code(403).send({ ok: false, error: "banned", message: "Your account has been suspended." });
    const token = jwt.sign({ sub: user.id, name: user.name }, JWT_SECRET, { expiresIn: "7d" });
    setAuthCookie(reply, token);
    return reply.send({ token, user });
  });

  app.get("/auth/ws-ticket", async (req, reply) => {
    const u = authFromHeader((req.headers as any).authorization);
    if (!u) return reply.code(401).send({ ok: false });
    return reply.send({ ok: true, ticket: jwt.sign({ sub: u.id, name: u.name }, JWT_SECRET, { expiresIn: "60s" }) });
  });
  app.post("/auth/logout", async (_req, reply) => {
    clearAuthCookie(reply);
    return reply.send({ ok: true });
  });

  app.get("/auth/google", async (req, reply) => {
    const { redirect } = (req as any).query as { redirect?: string };
    const client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL);
    let state: string | undefined;
    if (redirect && isAllowedRedirect(redirect)) {
      state = jwt.sign({ r: redirect }, JWT_SECRET, { expiresIn: "10m" });
    }
    const url = client.generateAuthUrl({
      access_type: "offline",
      scope: ["profile", "email"],
      prompt: "select_account",
      ...(state ? { state } : {}),
    });
    return reply.redirect(url);
  });

  app.get("/auth/google/callback", async (req, reply) => {
    const { code, state } = (req as any).query as { code?: string; state?: string };
    let customRedirect: string | null = null;
    if (state) {
      try {
        const decoded = jwt.verify(state, JWT_SECRET) as { r?: string };
        if (decoded?.r && isAllowedRedirect(decoded.r)) customRedirect = decoded.r;
      } catch {}
    }
    const finishUrl = (path: string, qs: string) => {
      if (customRedirect) {
        const sep = customRedirect.includes("?") ? "&" : "?";
        return `${customRedirect}${sep}${qs}`;
      }
      return `${WEB_URL}${path}?${qs}`;
    };
    if (!code) return reply.redirect(customRedirect ? `${customRedirect}${customRedirect.includes("?") ? "&" : "?"}error=no_code` : `${WEB_URL}/login?error=no_code`);
    try {
      const client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL);
      const { tokens } = await client.getToken(code);
      client.setCredentials(tokens);
      const ticket = await client.verifyIdToken({ idToken: tokens.id_token!, audience: GOOGLE_CLIENT_ID });
      const payload = ticket.getPayload();
      if (!payload) return reply.redirect(`${WEB_URL}/login?error=no_payload`);
      const googleId = payload.sub;
      const email = payload.email || null;
      const avatar = payload.picture || null;
      const displayName = payload.name || `g_${googleId.slice(0, 12)}`;

      let user = await prisma.user.findFirst({ where: { googleId } });

      if (!user && email) {
        user = await prisma.user.findFirst({ where: { email } });
        if (user) {
          await prisma.user.update({ where: { id: user.id }, data: { googleId, avatar: avatar || undefined } });
        }
      }

      const isNew = !user;
      if (!user) {
        if ((await getSiteConfig("registrationOpen")) === "false") return reply.redirect(customRedirect ? `${customRedirect}${customRedirect.includes("?") ? "&" : "?"}error=registration_closed` : `${WEB_URL}/login?error=registration_closed`);
        const tempName = `g_${googleId.slice(0, 12)}`;
        user = await prisma.user.create({ data: { name: displayName, usernameKey: tempName, googleId, email, avatar } });
        seedWelcomeDM(user.id).catch(() => {});
      }
      if (user.banned) return reply.redirect(customRedirect ? `${customRedirect}${customRedirect.includes("?") ? "&" : "?"}error=account_suspended` : `${WEB_URL}/login?error=account_suspended`);
      const token = jwt.sign({ sub: user.id, name: user.name }, JWT_SECRET, { expiresIn: "7d" });
      setAuthCookie(reply, token);
      const userParam = encodeURIComponent(JSON.stringify({ id: user.id, name: user.name }));
      const qs = `token=${token}&user=${userParam}${isNew ? "&new=1" : ""}`;
      return reply.redirect(finishUrl(isNew ? "/onboarding" : "/auth/google/finish", qs));
    } catch (e) {
      console.error("[google callback]", e);
      return reply.redirect(customRedirect ? `${customRedirect}${customRedirect.includes("?") ? "&" : "?"}error=oauth_failed` : `${WEB_URL}/login?error=oauth_failed`);
    }
  });

  app.get("/auth/username-check", async (req, reply) => {
    const { username } = (req as any).query as { username?: string };
    const clean = (username || "").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 32);
    if (clean.length < 2) return reply.send({ available: false, reason: "too_short" });
    const existing = await prisma.user.findUnique({ where: { usernameKey: clean } }).catch(() => null);
    return reply.send({ available: !existing });
  });

  app.post("/auth/onboarding", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ error: "Unauthorized" });
    const body: any = (req as any).body || {};
    const raw = typeof body.username === "string" ? body.username : "";
    const usernameKey = raw.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 32);
    if (usernameKey.length < 2) return reply.code(400).send({ error: "Username too short" });
    const existing = await prisma.user.findUnique({ where: { usernameKey } }).catch(() => null);
    if (existing && existing.id !== u.id) return reply.code(409).send({ error: "Username taken" });
    const reserved = await isNameReserved(usernameKey, "USERNAME");
    if (reserved) return reply.code(403).send({ error: "This username is reserved and cannot be used." });
    const updated = await prisma.user.update({
      where: { id: u.id },
      data: { name: usernameKey, usernameKey },
    });
    const token = jwt.sign({ sub: updated.id, name: updated.name }, JWT_SECRET, { expiresIn: "7d" });
    return reply.send({ token, user: { id: updated.id, name: updated.name } });
  });
}
