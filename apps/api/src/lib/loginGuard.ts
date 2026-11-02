/**
 * Password guessing against one account. Sign-in was limited per address only,
 * so many addresses could keep guessing at one name (red team 2026-11-01,
 * finding 25). Ten wrong passwords for a name within 15 minutes pause password
 * sign-in for that name until the window passes; a right one clears the count.
 * Google, Discord and the reset email still work while it's paused.
 */
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const WINDOW_MS = 15 * 60_000;
export const LOGIN_FAILS_MAX = 10;
const fails = new Map<string, { n: number; start: number }>();

export function loginPaused(username: string, now = Date.now()): boolean {
  const f = fails.get(username);
  if (!f) return false;
  if (now - f.start > WINDOW_MS) {
    fails.delete(username);
    return false;
  }
  return f.n >= LOGIN_FAILS_MAX;
}

export function loginFailed(username: string, now = Date.now()) {
  const f = fails.get(username);
  if (!f || now - f.start > WINDOW_MS) fails.set(username, { n: 1, start: now });
  else f.n++;
  if (fails.size > 50_000) fails.clear();
}

export function loginSucceeded(username: string) {
  fails.delete(username);
}

/** A sign-in for a name with no password account takes as long as a wrong
 *  password, so the answer's timing doesn't say which names have one (red
 *  team finding 24). Nothing typed can match this hash. */
const NO_ACCOUNT_HASH = bcrypt.hashSync(randomBytes(24).toString("hex"), 10);
export async function noAccountDelay(password: string): Promise<void> {
  await bcrypt.compare(password, NO_ACCOUNT_HASH);
}
