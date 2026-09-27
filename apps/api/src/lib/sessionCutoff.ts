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

/** True when a token issued at `iatSec` (seconds) predates the account's cut-off. */
export function issuedBeforeCutoff(
  iatSec: number | null | undefined,
  validAfter: Date | null | undefined,
): boolean {
  if (!validAfter) return false;
  const iat = Number(iatSec) || 0;
  return iat < Math.floor(validAfter.getTime() / 1000);
}
