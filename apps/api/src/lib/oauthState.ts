import { createHmac, timingSafeEqual } from "node:crypto";

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

export function signOAuthState(userId: string): string {
  const payload = b64url(JSON.stringify({ u: userId, t: Date.now() }));
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
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
