import { prisma } from "./prisma";

/** Subscription statuses Stripe is still billing (or retrying) for. */
export const STRIPE_LIVE_STATUSES = ["active", "trialing", "past_due"];

/**
 * Is this member's tier one Stripe is billing for? Staff must not change it by
 * hand: Stripe's next update sets the tier back from the plan (billing.ts
 * webhook), so the change would quietly come undone. Change it in Stripe.
 */
export async function paidThroughStripe(userId: string): Promise<boolean> {
  const s = await prisma.subscription.findUnique({
    where: { userId },
    select: { stripeSubId: true, status: true },
  });
  return !!(s?.stripeSubId && STRIPE_LIVE_STATUSES.includes(s.status));
}
