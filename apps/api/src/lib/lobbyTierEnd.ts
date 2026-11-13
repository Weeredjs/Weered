import { prisma } from "./prisma";
import { fetchWithTimeout } from "./fetchWithTimeout";
import { log, swallow } from "./logger";

/**
 * Someone out of a lobby stops paying for its tier.
 *
 * Leaving used to mark the tier "canceled" in our database and nothing more, so
 * Stripe went on billing a member who had no record of paying (fan-out audit,
 * 2026-11-13). Kicks and bans did not touch the tier at all. Now Stripe is told
 * to end the subscription at the close of the period already paid for; its
 * webhook then ends the tier here the usual way.
 */
const LIVE = ["active", "trialing", "past_due"];

export async function endLobbyTier(
  lobbyId: string,
  userId: string,
  stripePost: (path: string, body: Record<string, string>) => Promise<any> = defaultStripePost,
): Promise<number> {
  const subs = await prisma.lobbyTierSub
    .findMany({
      where: { lobbyId, userId, status: { in: LIVE } },
      select: { id: true, stripeSubId: true },
    })
    .catch(() => [] as Array<{ id: string; stripeSubId: string | null }>);
  let ended = 0;
  for (const s of subs) {
    if (!s.stripeSubId) continue;
    try {
      const r = await stripePost(`/subscriptions/${encodeURIComponent(s.stripeSubId)}`, {
        cancel_at_period_end: "true",
      });
      if (r?.error) {
        log.error("[lobbyTierEnd]", s.id, String(r.error?.code || r.error?.type || "error"));
        continue;
      }
      await prisma.lobbyTierSub
        .update({ where: { id: s.id }, data: { cancelAtPeriodEnd: true } })
        .catch(swallow);
      ended++;
    } catch (e) {
      swallow(e);
    }
  }
  return ended;
}

async function defaultStripePost(path: string, body: Record<string, string>) {
  const key = process.env.STRIPE_SECRET_KEY || "";
  if (!key) return { error: { code: "stripe_not_configured" } };
  const res = await fetchWithTimeout(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body).toString(),
  });
  return res.json();
}
