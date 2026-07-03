import { log, swallow } from "../lib/logger";
import type { FastifyInstance } from "fastify";
import { fetchWithTimeout } from "../lib/fetchWithTimeout";
import { z } from "zod";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { readFileSync, writeFileSync } from "fs";
import { sendPush } from "../lib/notifications";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../lib/prisma";
import { setAuthCookie, clearAuthCookie, isWebClient } from "../lib/authCookie";

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
};

export default async function authRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, JWT_SECRET, isNameReserved, getSiteConfig, seedWelcomeDM } = opts;

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
      config: { rateLimit: { max: 5, timeWindow: "1 hour" } },
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
      if (password.length < 6) return reply.code(400).send({ error: "Password too short" });
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return reply.code(400).send({ error: "Invalid email" });
      const cap = await verifyCaptcha(captchaToken, req.ip);
      if (!cap.ok) return reply.code(400).send({ error: "captcha_required", reason: cap.reason });
      if ((await getSiteConfig("registrationOpen")) === "false")
        return reply.code(403).send({ error: "registration_closed" });
      const existing = await prisma.localAuth.findUnique({ where: { username } }).catch(() => null);
      if (existing) return reply.code(409).send({ error: "Username already exists" });
      if (email) {
        const emailTaken = await prisma.localAuth
          .findUnique({ where: { email } })
          .catch(() => null);
        if (emailTaken) return reply.code(409).send({ error: "Email already in use" });
      }
      const reserved = await isNameReserved(username, "USERNAME");
      if (reserved)
        return reply.code(403).send({ error: "This username is reserved and cannot be used." });
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
      if (user.banned) return reply.code(403).send({ ok: false, error: "banned" });
      const sessionToken = jwt.sign({ sub: user.id, name: user.name }, JWT_SECRET, {
        expiresIn: "7d",
      });
      setAuthCookie(reply, sessionToken);
      return authedSend(req, reply, sessionToken, { ok: true, user });
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
      if (la && la.email) {
        const resetToken = randomBytes(32).toString("hex");
        const resetExp = new Date(Date.now() + 60 * 60 * 1000);
        await prisma.localAuth.update({
          where: { id: la.id },
          data: { passwordResetToken: resetToken, passwordResetTokenExp: resetExp },
        });
        const tmpl = buildResetEmail({ username: la.username, token: resetToken });
        sendMail({ to: la.email, subject: tmpl.subject, html: tmpl.html }).catch(swallow);
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
      const la = await prisma.localAuth.findUnique({ where: { username } }).catch(() => null);
      if (!la) return reply.code(401).send({ error: "Invalid credentials" });
      const ok = await bcrypt.compare(password, la.passwordHash);
      if (!ok) return reply.code(401).send({ error: "Invalid credentials" });
      const user = await prisma.user.findUnique({ where: { id: la.userId } });
      if (!user) return reply.code(401).send({ error: "Invalid credentials" });
      if (user.banned)
        return reply
          .code(403)
          .send({ ok: false, error: "banned", message: "Your account has been suspended." });
      const token = jwt.sign({ sub: user.id, name: user.name }, JWT_SECRET, { expiresIn: "7d" });
      setAuthCookie(reply, token);
      return authedSend(req, reply, token, { user });
    },
  );

  app.get("/auth/ws-ticket", async (req, reply) => {
    const u = authFromHeader((req.headers as any).authorization);
    if (!u) return reply.code(401).send({ ok: false });
    const claims: any = { sub: u.id, name: u.name };
    if ((u as any).guest) {
      claims.guest = true;
      claims.scope = (u as any).scope ?? null;
    } else if ((u as any).host) {
      claims.host = true;
      claims.scope = (u as any).scope ?? null;
    }
    return reply.send({
      ok: true,
      ticket: jwt.sign(claims, JWT_SECRET, { expiresIn: "60s" }),
    });
  });

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
      if (!invite || invite.type !== "GUEST" || !invite.targetId) {
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

      const name = rawName || `Guest-${1000 + (randomBytes(2).readUInt16BE(0) % 9000)}`;
      const guestId = `guest_${randomBytes(12).toString("hex")}`;
      // ephemeral user + token live no longer than the invite window, capped at 4h.
      const cap = Date.now() + 90 * 60 * 1000;
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
      } catch (e) {
        swallow(e);
      }
    }
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
      const displayName = payload.name || `g_${googleId.slice(0, 12)}`;

      let user = await prisma.user.findFirst({ where: { googleId } });

      if (!user && email) {
        user = await prisma.user.findFirst({ where: { email } });
        if (user) {
          await prisma.user.update({
            where: { id: user.id },
            data: { googleId, avatar: avatar || undefined },
          });
        }
      }

      const isNew = !user;
      if (!user) {
        if ((await getSiteConfig("registrationOpen")) === "false")
          return reply.redirect(
            customRedirect
              ? `${customRedirect}${customRedirect.includes("?") ? "&" : "?"}error=registration_closed`
              : `${WEB_URL}/login?error=registration_closed`,
          );
        const tempName = `g_${googleId.slice(0, 12)}`;
        user = await prisma.user.create({
          data: { name: displayName, usernameKey: tempName, googleId, email, avatar },
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
      const qs = `token=${token}&user=${userParam}${isNew ? "&new=1" : ""}`;
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
    return reply.send({ token, user: { id: updated.id, name: updated.name } });
  });

  // --- OFFICE HOURS (ECEB walk-in office) ---
  // Persistent open/closed flag: the ECEB site shows a live status, and walk-in
  // foyer invites are only mintable while the advisor is holding hours.
  const OFFICE_STATE_FILE = "/opt/weered/office-hours.json";
  const readOfficeState = () => {
    try {
      const st = JSON.parse(readFileSync(OFFICE_STATE_FILE, "utf8"));
      return {
        open: !!st.open,
        schedule: (st.schedule ?? null) as string | null,
        note: (st.note ?? null) as string | null,
      };
    } catch {
      return { open: false, schedule: null as string | null, note: null as string | null };
    }
  };
  const writeOfficeState = (st: {
    open: boolean;
    schedule: string | null;
    note: string | null;
  }) => {
    writeFileSync(OFFICE_STATE_FILE, JSON.stringify(st));
  };

  // Recent walk-in arrivals (host reception desk). Capped + time-pruned.
  const OFFICE_WAITING_FILE = "/opt/weered/office-waiting.json";
  type Arrival = { name: string; at: number };
  const readWaiting = (): Arrival[] => {
    try {
      const arr = JSON.parse(readFileSync(OFFICE_WAITING_FILE, "utf8"));
      const cutoff = Date.now() - 30 * 60 * 1000;
      return Array.isArray(arr)
        ? arr.filter((a: any) => a && typeof a.at === "number" && a.at > cutoff).slice(-20)
        : [];
    } catch {
      return [];
    }
  };
  const pushWaiting = (name: string) => {
    try {
      const arr = readWaiting();
      arr.push({ name: (name || "Visitor").slice(0, 40), at: Date.now() });
      writeFileSync(OFFICE_WAITING_FILE, JSON.stringify(arr.slice(-20)));
    } catch {
      /* best effort */
    }
  };

  // Public: current office status (drives the ECEB-site fixture + the foyer door).
  app.get("/office/status", async (_req, reply) => {
    const st = readOfficeState();
    return reply.send({ ok: true, open: st.open, schedule: st.schedule, note: st.note });
  });

  // Host-only: flip the office open/closed (or set the schedule/note).
  app.post("/office/set", async (req, reply) => {
    const u = authFromHeader((req.headers as any).authorization);
    if (!u || !(u as any).host) return reply.code(403).send({ ok: false, error: "host_only" });
    const body: any = (req as any).body || {};
    const cur = readOfficeState();
    const next = {
      open: typeof body.open === "boolean" ? body.open : cur.open,
      schedule: typeof body.schedule === "string" ? body.schedule.slice(0, 200) : cur.schedule,
      note: typeof body.note === "string" ? body.note.slice(0, 200) : cur.note,
    };
    writeOfficeState(next);
    return reply.send({ ok: true, ...next });
  });

  // Public walk-in: while open, mint a single-use foyer invite so a visitor can
  // enter with just a name. They still knock; the host still admits.
  app.post(
    "/office/walkin",
    { config: { rateLimit: { max: 20, timeWindow: "10 minutes" } } },
    async (req, reply) => {
      const st = readOfficeState();
      if (!st.open)
        return reply.code(403).send({ ok: false, error: "closed", schedule: st.schedule });
      const host = await prisma.user
        .findUnique({ where: { usernameKey: "eceb-host" }, select: { id: true } })
        .catch(() => null);
      const token = `m_${randomBytes(12).toString("hex")}`;
      await prisma.invite.create({
        data: {
          token,
          type: "GUEST",
          targetId: "mtg-eceb",
          createdBy: host?.id ?? "cmmgisqb70000zzfhh3k9e069",
          maxUses: 1,
          uses: 0,
          expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
        },
      });
      const visitorName =
        typeof (req as any).body?.name === "string" ? (req as any).body.name : "Visitor";
      pushWaiting(visitorName);
      if (host?.id) {
        sendPush(host.id, {
          title: "Someone's at your office door",
          body: `${visitorName} just walked in. Tap to greet them.`,
          url: "/foyer",
          tag: "office-walkin",
        }).catch(() => {});
      }
      return reply.send({ ok: true, url: `/foyer?invite=${token}&title=Office%20Hours` });
    },
  );

  // Host-only: recent walk-in arrivals, for the reception-desk view on the control page.
  app.get("/office/waiting", async (req, reply) => {
    const u = authFromHeader((req.headers as any).authorization);
    if (!u || !(u as any).host) return reply.code(403).send({ ok: false, error: "host_only" });
    return reply.send({ ok: true, waiting: readWaiting() });
  });

  // --- IN-ROOM FATHOM PLAN MODULE (read proxy) ---
  // The office (client browser) never holds the engine token: it calls these
  // host-gated routes same-origin, and the API mints a short-lived office:read
  // token (shared OFFICE_TOKEN_SECRET) to fetch the tenant-scoped plan from the
  // Fathom engine server-side.
  const ENGINE_BASE =
    process.env.FATHOM_ENGINE_URL || "https://agent.eastcoastemployeebenefits.com";
  // A "book" selects which tenant the office reads: the real ECEB book (default)
  // or the Scotia demo book. Constrained to these two — never an arbitrary tenant.
  const bookConfig = (book: string) =>
    book === "demo"
      ? { tenantId: process.env.DEMO_TENANT_ID, brokerId: process.env.DEMO_BROKER_ID }
      : { tenantId: process.env.ECEB_TENANT_ID, brokerId: process.env.ECEB_BROKER_ID };
  const mintOfficeToken = (scope: string[], book: string) => {
    const { tenantId, brokerId } = bookConfig(book);
    return jwt.sign(
      { typ: "office", tenantId, brokerId, meetingId: null, scope },
      process.env.OFFICE_TOKEN_SECRET as string,
      { algorithm: "HS256", issuer: "abb-office", audience: "engine-api", expiresIn: 600 },
    );
  };
  const engineGet = async (path: string, book: string) => {
    const res = await fetch(`${ENGINE_BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${mintOfficeToken(["office:read"], book)}`,
        Origin: "https://office.eastcoastemployeebenefits.com",
      },
    });
    return { status: res.status, text: await res.text() };
  };
  const engineSend = async (method: string, path: string, body: any, book: string) => {
    const res = await fetch(`${ENGINE_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${mintOfficeToken(["office:read", "office:write"], book)}`,
        "Content-Type": "application/json",
        Origin: "https://office.eastcoastemployeebenefits.com",
      },
      body: JSON.stringify(body ?? {}),
    });
    return { status: res.status, text: await res.text() };
  };
  const planGate = (req: any, reply: any): boolean => {
    const u = authFromHeader((req.headers as any).authorization);
    if (!u || !(u as any).host) {
      reply.code(403).send({ ok: false, error: "host_only" });
      return false;
    }
    if (!process.env.OFFICE_TOKEN_SECRET || !process.env.ECEB_TENANT_ID) {
      reply.code(503).send({ ok: false, error: "engine_not_configured" });
      return false;
    }
    return true;
  };

  // Host-only: client picker (proxied to the engine, tenant-scoped there).
  app.get("/office/plan/employers", async (req, reply) => {
    if (!planGate(req, reply)) return;
    const book = String((req.query as any)?.book ?? "eceb");
    const q = encodeURIComponent(String((req.query as any)?.q ?? "").slice(0, 80));
    const r = await engineGet(`/api/office/employers?q=${q}`, book);
    return reply.code(r.status).header("content-type", "application/json").send(r.text);
  });

  // Host-only: full client detail + current plan of record.
  app.get("/office/plan/employer/:id", async (req, reply) => {
    if (!planGate(req, reply)) return;
    const book = String((req.query as any)?.book ?? "eceb");
    const id = encodeURIComponent(String((req.params as any).id));
    const r = await engineGet(`/api/office/employers/${id}`, book);
    return reply.code(r.status).header("content-type", "application/json").send(r.text);
  });

  // Host-only: apply a change-set to the plan of record (creates a new version).
  app.patch("/office/plan/employer/:id", async (req, reply) => {
    if (!planGate(req, reply)) return;
    const book = String((req.query as any)?.book ?? "eceb");
    const id = String((req.params as any).id);
    const r = await engineSend(
      "PATCH",
      `/api/employers/${encodeURIComponent(id)}/plan`,
      (req as any).body,
      book,
    );
    return reply.code(r.status).header("content-type", "application/json").send(r.text);
  });

  // Host-only: send a plan amendment notice to the carrier (Resend, engine-side).
  app.post("/office/plan/amend", async (req, reply) => {
    if (!planGate(req, reply)) return;
    const book = String((req.query as any)?.book ?? "eceb");
    const r = await engineSend("POST", `/api/plan-amendments/send`, (req as any).body, book);
    return reply.code(r.status).header("content-type", "application/json").send(r.text);
  });

  // --- LIVE PLAN PRESENTATION ---
  // The host "presents" a plan snapshot to the room; admitted guests poll it
  // read-only. Guests only ever see exactly what the host chose to present.
  // In-memory by design: ephemeral meeting state (host re-presents after a restart).
  const presentedPlans = new Map<string, { data: any; seq: number; at: number }>();
  let presentedSeq = 0;

  app.post("/office/plan/present", async (req, reply) => {
    const u = authFromHeader((req.headers as any).authorization);
    if (!u || !(u as any).host) return reply.code(403).send({ ok: false, error: "host_only" });
    const office = String((u as any).scope?.office || "");
    if (!office) return reply.code(400).send({ ok: false, error: "no_office_scope" });
    const data = (req as any).body?.data ?? null;
    if (data) {
      if (JSON.stringify(data).length > 200_000)
        return reply.code(400).send({ ok: false, error: "too_large" });
      presentedPlans.set(office, { data, seq: ++presentedSeq, at: Date.now() });
    } else {
      presentedPlans.delete(office);
    }
    return reply.send({ ok: true, presenting: presentedPlans.has(office) });
  });

  app.get("/office/plan/presented", async (req, reply) => {
    const u = authFromHeader((req.headers as any).authorization);
    const uu = u as any;
    if (!u || (!uu.host && !uu.guest))
      return reply.code(403).send({ ok: false, error: "auth_required" });
    const office = String(uu.scope?.office || "");
    const p = office ? presentedPlans.get(office) : undefined;
    if (p && Date.now() - p.at > 4 * 60 * 60 * 1000) {
      presentedPlans.delete(office);
      return reply.send({ ok: true, seq: 0, data: null });
    }
    return reply.send({ ok: true, seq: p?.seq ?? 0, data: p?.data ?? null });
  });

  // Bookmarkable host control page, served same-origin so the toggle needs no CORS.
  app.get("/office/control", async (_req, reply) => {
    reply.header("Content-Type", "text/html; charset=utf-8");
    reply.header("Cache-Control", "no-store");
    try {
      return reply.send(readFileSync("/opt/weered/office-control.html", "utf8"));
    } catch {
      return reply.code(404).send("control not found");
    }
  });
}
