/**
 * The username a Google or Discord sign-up starts with, before the person picks
 * one (routes/auth.ts and routes/discordAuth.ts make them). Someone who closed
 * the window on the username step kept it for good: nothing asked again, and
 * the step's page sent them to sign-in (James 2026-11-02, "d_20972329"). The
 * socket's auth:ok now says needsUsername, and the web sends them back to it.
 */
export const googleStandIn = (googleId: string) => `g_${googleId.slice(0, 12)}`;
export const discordStandIn = (discordId: string) => `d_${discordId}`;

/** Still on that stand-in: only the account's own provider id makes one. */
export function onStandInName(u: {
  usernameKey?: string | null;
  googleId?: string | null;
  discordId?: string | null;
}): boolean {
  const key = String(u.usernameKey || "");
  if (!key) return false;
  return (
    (!!u.googleId && key === googleStandIn(u.googleId)) ||
    (!!u.discordId && key === discordStandIn(u.discordId))
  );
}
