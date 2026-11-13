/**
 * Signing an account out everywhere.
 *
 * Session tokens are stateless 7-day JWTs, so a token issued before a password
 * reset kept working until it expired: resetting a password did not lock out
 * whoever had stolen the session (audit 2026-09-27). User.tokensValidAfter is
 * the cut-off: a token whose iat is earlier is refused, by the HTTP hook in
 * index.ts and by the socket auth:hello.
 *
 * Stored to the whole second, because that is a JWT iat's precision: a token
 * minted in the same second as the cut-off (say, the login right after a
 * reset) must still count as newer.
 */
export function cutoffNow(): Date {
  return new Date(Math.floor(Date.now() / 1000) * 1000);
}

/**
 * What the HTTP hook in index.ts last read about each account (banned,
 * deleted, its cut-off), kept 15 seconds so a busy page doesn't cost a query
 * per request. Anything that changes those fields forgets the account here,
 * so the change holds from the next request: for 15 seconds after a reset, a
 * stolen session could otherwise still mint a fresh token that outlived the
 * reset (fan-out audit, 2026-11-13).
 */
export const accountChecks = new Map<
  string,
  { ok: boolean; validAfter: Date | null; at: number }
>();
export function forgetAccount(userId: string): void {
  accountChecks.delete(userId);
}

/** True when a token issued at `iatSec` (seconds) predates the account's cut-off. */
export function issuedBeforeCutoff(
  iatSec: number | null | undefined,
  validAfter: Date | null | undefined,
): boolean {
  if (!validAfter) return false;
  const iat = Number(iatSec) || 0;
  return iat < Math.floor(validAfter.getTime() / 1000);
}
