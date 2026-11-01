import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { cutoffNow } from "./sessionCutoff";

/**
 * Which account a sign-in with Google or Discord belongs to (red team
 * 2026-11-01, finding 1).
 *
 * An email match used to be trusted outright. Anyone could register with
 * someone else's address and a password, never verify it, and the owner's
 * first Google sign-in landed in that account while the squatter's password
 * still opened it. Now an email match links only when the provider vouches for
 * the address, never over a different identity from the same provider. If
 * nobody ever proved the address for the account's password, that password is
 * switched off and every earlier session signed out, so whoever set it is
 * locked out; the owner can set a new one through the reset email. An account
 * made by a provider that vouched for its address, with no password, is
 * already proven.
 *
 * Returns the account to sign in (null means make a new one) and the address a
 * new account may keep (null when unverified or already held).
 */
export type ProviderField = "googleId" | "discordId";
export type ProviderIdentity = { id: string; email: string | null; emailVerified: boolean };

export async function accountForIdentity(
  db: any,
  field: ProviderField,
  who: ProviderIdentity,
  avatar?: string | null,
): Promise<{ user: any | null; email: string | null }> {
  const linked = await db.user.findFirst({ where: { [field]: who.id } });
  if (linked) return { user: linked, email: null };
  if (!who.email || !who.emailVerified) return { user: null, email: null };

  const holder = await db.user.findFirst({ where: { email: who.email } });
  if (!holder) return { user: null, email: who.email };
  if (holder[field] && holder[field] !== who.id) return { user: null, email: null };

  const local = await db.localAuth.findUnique({ where: { userId: holder.id } });
  const byProvider = !local && !!(holder.googleId || holder.discordId);
  const proven =
    byProvider || (!!local && local.emailVerified === true && local.email === who.email);
  const user = await db.user.update({
    where: { id: holder.id },
    data: {
      [field]: who.id,
      ...(holder.avatar || !avatar ? {} : { avatar }),
      ...(proven ? {} : { tokensValidAfter: cutoffNow() }),
    },
  });
  if (local && !proven) {
    await db.localAuth.update({
      where: { id: local.id },
      data: {
        passwordHash: await bcrypt.hash(randomBytes(32).toString("hex"), 10),
        passwordResetToken: null,
        passwordResetTokenExp: null,
        verifyToken: null,
        verifyTokenExp: null,
        ...(local.email === who.email ? { emailVerified: true } : {}),
      },
    });
  }
  return { user, email: null };
}

/** Google's form of it (routes/auth.ts). */
export type GoogleIdentity = { googleId: string; email: string | null; emailVerified: boolean };
export function accountForGoogle(db: any, g: GoogleIdentity, avatar?: string | null) {
  return accountForIdentity(
    db,
    "googleId",
    { id: g.googleId, email: g.email, emailVerified: g.emailVerified },
    avatar,
  );
}
