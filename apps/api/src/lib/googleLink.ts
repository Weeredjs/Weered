import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { cutoffNow } from "./sessionCutoff";

/**
 * Which account a Google sign-in belongs to (red team 2026-11-01, finding 1).
 *
 * An email match used to be trusted outright. Anyone could register with
 * someone else's address and a password, never verify it, and the owner's
 * first Google sign-in landed in that account while the squatter's password
 * still opened it. Now an email match links only when Google vouches for the
 * address, never over a different Google identity. If nobody ever proved the
 * address for the account's password, that password is switched off and every
 * earlier session is signed out, so whoever set it is locked out. The owner
 * can set a new password through the reset email.
 *
 * Returns the account to sign in (null means make a new one) and the address
 * a new account may keep (null when unverified or already held).
 */
export type GoogleIdentity = { googleId: string; email: string | null; emailVerified: boolean };

export async function accountForGoogle(
  db: any,
  id: GoogleIdentity,
  avatar?: string | null,
): Promise<{ user: any | null; email: string | null }> {
  const linked = await db.user.findFirst({ where: { googleId: id.googleId } });
  if (linked) return { user: linked, email: null };
  if (!id.email || !id.emailVerified) return { user: null, email: null };

  const holder = await db.user.findFirst({ where: { email: id.email } });
  if (!holder) return { user: null, email: id.email };
  if (holder.googleId && holder.googleId !== id.googleId) return { user: null, email: null };

  const local = await db.localAuth.findUnique({ where: { userId: holder.id } });
  const proven = !!local && local.emailVerified === true && local.email === id.email;
  const user = await db.user.update({
    where: { id: holder.id },
    data: {
      googleId: id.googleId,
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
        ...(local.email === id.email ? { emailVerified: true } : {}),
      },
    });
  }
  return { user, email: null };
}
