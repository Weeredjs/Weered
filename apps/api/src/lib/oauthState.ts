import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Signed OAuth state for account-linking flows. The state carries the
// initiating user's id, signed with JWT_SECRET so it cannot be forged. This
// prevents account-linking CSRF: an attacker can't mint a valid state for a
// victim's userId, so they can't link their game account to someone else's.

const TTL_MS = 10 * 60 * 1000;

function b64url(s: string): string {
  return Buffer.from(s).toString("base64url");
}
function secret(): string {
  const s = process.env.JWT_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "development") return "weered-dev-secret";
  throw new Error(
    "FATAL: JWT_SECRET is not set — refusing to sign OAuth state with a default secret.",
  );
}

/**
 * Linking a game account must finish in the browser that started it. The
 * signed state names the Weered account, but a state can be handed to someone
 * else: an attacker's link, approved by a victim, filed the victim's Bungie,
 * EVE or Path of Exile account (with its keys) under the attacker's Weered
 * account (fan-out audit, 2026-11-13). So the start also leaves a short cookie
 * in the starting browser, holding a value carried in the state, and the end
 * of the link insists on it, as Discord sign-in already does.
 */
export function linkCookieName(game: string): string {
  return `weered_link_${game}`;
}
export function linkCookie(game: string, value: string): string {
  return `${linkCookieName(game)}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/auth/${game}; Max-Age=600`;
}
/** A random value for that cookie. */
export function linkNonce(): string {
  return randomBytes(16).toString("hex");
}

export function signOAuthState(userId: string, nonce = ""): string {
  const payload = b64url(JSON.stringify({ u: userId, t: Date.now(), n: nonce }));
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

/** The account a link is for, when its state is good AND the cookie matches. */
export function finishLink(state: string, cookieValue: string): string | null {
  const v = readOAuthState(state);
  if (!v || !v.n || !cookieValue || v.n.length !== cookieValue.length) return null;
  if (!timingSafeEqual(Buffer.from(v.n), Buffer.from(cookieValue))) return null;
  return v.u;
}

function readOAuthState(state: string): { u: string; n: string } | null {
  const dot = state.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const { u, t, n } = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!u || typeof t !== "number" || Date.now() - t > TTL_MS) return null;
    return { u: String(u), n: String(n || "") };
  } catch {
    return null;
  }
}

export function verifyOAuthState(state: string): string | null {
  const dot = state.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const { u, t } = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!u || typeof t !== "number" || Date.now() - t > TTL_MS) return null;
    return u;
  } catch {
    return null;
  }
}
