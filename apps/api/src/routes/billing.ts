import { SubTier } from "@prisma/client";
import { log } from "../lib/logger";
import type { FastifyInstance } from "fastify";
import { fetchWithTimeout } from "../lib/fetchWithTimeout";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { createHmac, timingSafeEqual, randomUUID } from "crypto";

type Opts = {
  authFromHeader: (h?: string) => { id: string; name: string } | null;
  getGlobalRole: (userId: string) => Promise<string | null>;
  canAccessStaff: (role: string | null) => boolean;
  canAssignRoles: (role: string | null) => boolean;
  globalAudit: (
    actorId: string,
    actorName: string,
    type: string,
    targetId?: string,
    note?: string,
    meta?: any,
  ) => Promise<void>;
  lobbyAdminAccess: (
    req: any,
    reply: any,
    requiredLevel: number,
  ) => Promise<{
    user: { id: string; name: string };
    lobby: { id: string; revenueSharePct?: number };
  } | null>;
};

export default async function billingRoutes(app: FastifyInstance, opts: Opts) {
  const {
    authFromHeader,
    getGlobalRole,
    canAccessStaff,
    canAssignRoles,
    globalAudit,
    lobbyAdminAccess,
  } = opts;

  app.get("/lobbies/:id/tiers", async (req, reply) => {
    const lobbyId = String((req as any).params?.id || "");
    const lobby = await prisma.lobby.findUnique({ where: { id: lobbyId } });
    if (!lobby) return reply.code(404).send({ ok: false, error: "lobby_not_found" });
    const tiers = await prisma.lobbyTier.findMany({
      where: { lobbyId, active: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        priceMonthly: true,
        grantLevel: true,
        color: true,
        sortOrder: true,
      },
    });
    return reply.send({ ok: true, tiers, roleNames: lobby.roleNames });
  });

  app.get("/lobbies/:id/my-tier", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const lobbyId = String((req as any).params?.id || "");
    const sub = await prisma.lobbyTierSub.findUnique({
      where: { lobbyId_userId: { lobbyId, userId: u.id } },
      include: {
        tier: {
          select: { id: true, name: true, color: true, grantLevel: true, priceMonthly: true },
        },
      },
    });
    if (!sub || sub.status === "canceled") return reply.send({ ok: true, tier: null, sub: null });
    return reply.send({
      ok: true,
      tier: sub.tier,
      sub: {
        status: sub.status,
        currentPeriodEnd: sub.currentPeriodEnd?.toISOString() || null,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      },
    });
  });

  app.get("/lobbies/:id/admin/tiers", async (req, reply) => {
    const ctx = await lobbyAdminAccess(req, reply, 5);
    if (!ctx) return;
    const tiers = await prisma.lobbyTier.findMany({
      where: { lobbyId: ctx.lobby.id },
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { subscribers: true } } },
    });
    return reply.send({ ok: true, tiers, revenueSharePct: ctx.lobby.revenueSharePct ?? 0 });
  });

  app.get("/lobbies/:id/admin/tier-stats", async (req, reply) => {
    const ctx = await lobbyAdminAccess(req, reply, 5);
    if (!ctx) return;
    const subs = await prisma.lobbyTierSub.findMany({
      where: { lobbyId: ctx.lobby.id, status: "active" },
      include: { tier: { select: { id: true, name: true, priceMonthly: true } } },
    });
    const userIds = subs.map((s: any) => s.userId);
    const users =
      userIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, usernameKey: true, avatar: true },
          })
        : [];
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
    const enriched = subs.map((s: any) => ({ ...s, user: userMap[s.userId] || null }));
    return reply.send({ ok: true, subscribers: enriched });
  });

  app.post(
    "/lobbies/:id/admin/tiers",
    {
      schema: { tags: ["billing"], params: z.object({ id: z.string().min(1) }) },
    },
    async (req, reply) => {
      const ctx = await lobbyAdminAccess(req, reply, 5);
      if (!ctx) return;
      const body: any = (req as any).body || {};
      const name = String(body.name || "").trim();
      const description = String(body.description || "").trim();
      const priceMonthly = Math.max(Number(body.priceMonthly) || 0, 100);
      const grantLevel = Math.min(Math.max(Number(body.grantLevel) || 2, 1), 4);
      const color = body.color ? String(body.color).trim() : null;
      const sortOrder = Number(body.sortOrder) || 0;
      if (!name) return reply.code(400).send({ ok: false, error: "name_required" });
      if (priceMonthly < 100)
        return reply.code(400).send({ ok: false, error: "min_price_100_cents" });

      const product = await stripeReq("POST", "/products", {
        name: `${(ctx.lobby as any).name || ctx.lobby.id} — ${name}`,
        "metadata[lobby_id]": ctx.lobby.id,
        "metadata[tier_type]": "lobby_tier",
      });
      if (product.error) return reply.code(500).send({ ok: false, error: "stripe_product_failed" });

      const price = await stripeReq("POST", "/prices", {
        product: product.id,
        unit_amount: String(priceMonthly),
        currency: "usd",
        "recurring[interval]": "month",
      });
      if (price.error) return reply.code(500).send({ ok: false, error: "stripe_price_failed" });

      const tier = await prisma.lobbyTier.create({
        data: {
          lobbyId: ctx.lobby.id,
          name,
          description,
          priceMonthly,
          grantLevel,
          color,
          sortOrder,
          stripePriceId: price.id,
          stripeProductId: product.id,
        },
      });

      await prisma.lobbyAudit.create({
        data: {
          id: randomUUID(),
          lobbyId: ctx.lobby.id,
          type: "tier_created",
          actorId: ctx.user.id,
          actorName: ctx.user.name,
          note: `${name} — $${(priceMonthly / 100).toFixed(2)}/mo`,
        },
      });

      return reply.send({ ok: true, tier });
    },
  );

  app.patch(
    "/lobbies/:id/admin/tiers/:tierId",
    {
      schema: {
        tags: ["billing"],
        params: z.object({ id: z.string().min(1), tierId: z.string().min(1) }),
      },
    },
    async (req, reply) => {
      const ctx = await lobbyAdminAccess(req, reply, 5);
      if (!ctx) return;
      const tierId = String((req as any).params?.tierId || "");
      const existing = await prisma.lobbyTier.findFirst({
        where: { id: tierId, lobbyId: ctx.lobby.id },
      });
      if (!existing) return reply.code(404).send({ ok: false, error: "tier_not_found" });

      const body: any = (req as any).body || {};
      const data: any = {};
      if (body.name !== undefined) data.name = String(body.name).trim();
      if (body.description !== undefined) data.description = String(body.description).trim();
      if (body.grantLevel !== undefined)
        data.grantLevel = Math.min(Math.max(Number(body.grantLevel) || 2, 1), 4);
      if (body.color !== undefined) data.color = body.color ? String(body.color).trim() : null;
      if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder) || 0;
      if (body.active !== undefined) data.active = Boolean(body.active);

      const tier = await prisma.lobbyTier.update({ where: { id: tierId }, data });

      await prisma.lobbyAudit.create({
        data: {
          id: randomUUID(),
          lobbyId: ctx.lobby.id,
          type: "tier_updated",
          actorId: ctx.user.id,
          actorName: ctx.user.name,
          note: existing.name,
        },
      });

      return reply.send({ ok: true, tier });
    },
  );

  app.patch(
    "/lobbies/:id/admin/revenue-share",
    {
      schema: { tags: ["billing"], params: z.object({ id: z.string().min(1) }) },
    },
    async (req, reply) => {
      const ctx = await lobbyAdminAccess(req, reply, 5);
      if (!ctx) return;
      const body: any = (req as any).body || {};
      const pct = Math.min(Math.max(Number(body.revenueSharePct) || 0, 0), 100);
      await prisma.lobby.update({ where: { id: ctx.lobby.id }, data: { revenueSharePct: pct } });
      return reply.send({ ok: true, revenueSharePct: pct });
    },
  );

  const STRIPE_SK = process.env.STRIPE_SECRET_KEY || "";
  const STRIPE_PK = process.env.STRIPE_PUBLISHABLE_KEY || "";
  const STRIPE_WH_SEC = process.env.STRIPE_WEBHOOK_SECRET || "";
  const SITE_URL = process.env.SITE_URL || "https://weered.ca";

  const STRIPE_PRICES: Record<string, string> = {
    INDICTED: process.env.STRIPE_PRICE_INDICTED || "",
    FELON: process.env.STRIPE_PRICE_FELON || "",
  };

  async function stripeReq(method: string, path: string, body?: any) {
    const url = `https://api.stripe.com/v1${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${STRIPE_SK}`,
      "Content-Type": "application/x-www-form-urlencoded",
    };
    const opts: any = { method, headers };
    if (body) {
      const clean: Record<string, string> = {};
      for (const [k, v] of Object.entries(body)) {
        if (v !== undefined && v !== null && v !== "") clean[k] = String(v);
      }
      opts.body = new URLSearchParams(clean).toString();
    }
    const res = await fetchWithTimeout(url, opts);
    const j = await res.json();
    if (j.error) log.error("[stripeReq]", path, JSON.stringify(j.error));
    return j;
  }

  app.get("/subscribe/config", async (_req, reply) => {
    return reply.send({
      ok: true,
      publishableKey: STRIPE_PK,
      prices: {
        INDICTED: { id: STRIPE_PRICES.INDICTED, amount: 600, label: "Indicted — $6/mo" },
        FELON: { id: STRIPE_PRICES.FELON, amount: 1400, label: "Felon — $14/mo" },
      },
    });
  });

  app.get("/subscribe/status", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const sub = await prisma.subscription.findUnique({ where: { userId: u.id } });
    if (!sub) return reply.send({ ok: true, tier: "FREE", status: "inactive" });
    return reply.send({
      ok: true,
      tier: sub.tier,
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd?.toISOString() || null,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    });
  });

  app.post(
    "/subscribe/checkout",
    {
      schema: { tags: ["billing"] },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
      if (!STRIPE_SK) return reply.code(500).send({ ok: false, error: "stripe_not_configured" });

      const body: any = (req as any).body || {};
      const tier = String(body.tier || "").toUpperCase();
      const priceId = STRIPE_PRICES[tier];
      if (!priceId) return reply.code(400).send({ ok: false, error: "invalid_tier" });

      let sub = await prisma.subscription.findUnique({ where: { userId: u.id } });
      let customerId = sub?.stripeCustomerId;

      if (!customerId || customerId === "") {
        const dbUser = await prisma.user.findUnique({
          where: { id: u.id },
          select: { name: true, email: true },
        });
        const customer = await stripeReq("POST", "/customers", {
          email: dbUser?.email || undefined,
          name: dbUser?.name || u.name,
          "metadata[weered_user_id]": u.id,
        });
        customerId = customer.id;
        sub = await prisma.subscription.upsert({
          where: { userId: u.id },
          update: { stripeCustomerId: customerId },
          create: { userId: u.id, stripeCustomerId: customerId, tier: "FREE" },
        });
      }

      const session = await stripeReq("POST", "/checkout/sessions", {
        customer: customerId,
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": "1",
        mode: "subscription",
        success_url: `${SITE_URL}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${SITE_URL}/subscribe`,
        "metadata[weered_user_id]": u.id,
        "metadata[tier]": tier,
      });

      return reply.send({ ok: true, url: session.url, sessionId: session.id });
    },
  );

  app.post(
    "/subscribe/portal",
    {
      schema: { tags: ["billing"] },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
      const sub = await prisma.subscription.findUnique({ where: { userId: u.id } });
      if (!sub?.stripeCustomerId)
        return reply.code(400).send({ ok: false, error: "no_subscription" });

      const session = await stripeReq("POST", "/billing_portal/sessions", {
        customer: sub.stripeCustomerId,
        return_url: `${SITE_URL}/subscribe`,
      });
      return reply.send({ ok: true, url: session.url });
    },
  );

  app.post(
    "/lobbies/:id/tiers/:tierId/checkout",
    {
      schema: {
        tags: ["billing"],
        params: z.object({ id: z.string().min(1), tierId: z.string().min(1) }),
      },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
      if (!STRIPE_SK) return reply.code(500).send({ ok: false, error: "stripe_not_configured" });

      const lobbyId = String((req as any).params?.id || "");
      const tierId = String((req as any).params?.tierId || "");

      const tier = await prisma.lobbyTier.findFirst({
        where: { id: tierId, lobbyId, active: true },
      });
      if (!tier || !tier.stripePriceId)
        return reply.code(404).send({ ok: false, error: "tier_not_found" });

      const existingSub = await prisma.lobbyTierSub.findUnique({
        where: { lobbyId_userId: { lobbyId, userId: u.id } },
      });
      if (existingSub && existingSub.status === "active") {
        return reply.code(400).send({ ok: false, error: "already_subscribed" });
      }

      let customerId: string | null = null;
      const platformSub = await prisma.subscription.findUnique({
        where: { userId: u.id },
      });
      customerId = platformSub?.stripeCustomerId || null;

      if (!customerId) {
        const dbUser = await prisma.user.findUnique({
          where: { id: u.id },
          select: { name: true, email: true },
        });
        const customer = await stripeReq("POST", "/customers", {
          email: dbUser?.email || undefined,
          name: dbUser?.name || u.name,
          "metadata[weered_user_id]": u.id,
        });
        customerId = customer.id;
        await prisma.subscription.upsert({
          where: { userId: u.id },
          update: { stripeCustomerId: customerId },
          create: { userId: u.id, stripeCustomerId: customerId, tier: "FREE" },
        });
      }

      const session = await stripeReq("POST", "/checkout/sessions", {
        customer: customerId,
        "line_items[0][price]": tier.stripePriceId,
        "line_items[0][quantity]": "1",
        mode: "subscription",
        success_url: `${SITE_URL}/lobby/${encodeURIComponent(lobbyId)}?tier_success=true`,
        cancel_url: `${SITE_URL}/lobby/${encodeURIComponent(lobbyId)}`,
        "metadata[weered_user_id]": u.id,
        "metadata[lobby_id]": lobbyId,
        "metadata[lobby_tier_id]": tierId,
        "metadata[sub_type]": "lobby_tier",
      });

      return reply.send({ ok: true, url: session.url, sessionId: session.id });
    },
  );

  app.post(
    "/lobbies/:id/tiers/portal",
    {
      schema: { tags: ["billing"], params: z.object({ id: z.string().min(1) }) },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
      const lobbyId = String((req as any).params?.id || "");

      const sub = await prisma.lobbyTierSub.findUnique({
        where: { lobbyId_userId: { lobbyId, userId: u.id } },
      });
      if (!sub?.stripeCustomerId)
        return reply.code(400).send({ ok: false, error: "no_subscription" });

      const session = await stripeReq("POST", "/billing_portal/sessions", {
        customer: sub.stripeCustomerId,
        return_url: `${SITE_URL}/lobby/${encodeURIComponent(lobbyId)}`,
      });
      return reply.send({ ok: true, url: session.url });
    },
  );

  app.post("/subscribe/webhook", async (req, reply) => {
    const sigHeader = (req.headers as any)["stripe-signature"] || "";
    const rawBody = (req as any).rawBody as Buffer | undefined;

    if (!STRIPE_WH_SEC) {
      log.error("[stripe webhook] STRIPE_WEBHOOK_SECRET not set — rejecting unverifiable webhook");
      return reply.code(503).send({ ok: false, error: "webhook_not_configured" });
    }
    if (!rawBody) {
      return reply.code(400).send({ ok: false, error: "missing_raw_body" });
    }
    {
      const parts: Record<string, string> = {};
      for (const item of sigHeader.split(",")) {
        const [k, v] = item.split("=");
        if (k && v) parts[k.trim()] = v.trim();
      }
      const timestamp = parts["t"];
      const sig = parts["v1"];
      if (!timestamp || !sig)
        return reply.code(400).send({ ok: false, error: "missing_signature" });

      const expected = createHmac("sha256", STRIPE_WH_SEC)
        .update(`${timestamp}.${rawBody.toString("utf8")}`)
        .digest("hex");
      const sigBuf = Buffer.from(sig, "hex");
      const expectedBuf = Buffer.from(expected, "hex");
      if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
        log.error("[stripe webhook] signature mismatch");
        return reply.code(400).send({ ok: false, error: "invalid_signature" });
      }

      const age = Math.floor(Date.now() / 1000) - Number.parseInt(timestamp, 10);
      if (age > 300) {
        log.error("[stripe webhook] timestamp too old:", age, "seconds");
        return reply.code(400).send({ ok: false, error: "timestamp_expired" });
      }
    }

    const event: any = (req as any).body;
    if (!event?.type) return reply.code(400).send({ ok: false });

    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data?.object;
        const userId = session?.metadata?.weered_user_id;
        const subId = session?.subscription;

        if (session?.metadata?.sub_type === "lobby_tier") {
          const lobbyId = session?.metadata?.lobby_id;
          const lobbyTierId = session?.metadata?.lobby_tier_id;
          if (userId && subId && lobbyId && lobbyTierId) {
            const stripeSub = await stripeReq("GET", `/subscriptions/${subId}`);
            await prisma.lobbyTierSub.upsert({
              where: { lobbyId_userId: { lobbyId, userId } },
              update: {
                lobbyTierId,
                stripeSubId: subId,
                status: "active",
                stripeCustomerId: session.customer,
                currentPeriodEnd: stripeSub?.current_period_end
                  ? new Date(stripeSub.current_period_end * 1000)
                  : null,
              },
              create: {
                lobbyTierId,
                lobbyId,
                userId,
                stripeSubId: subId,
                status: "active",
                stripeCustomerId: session.customer,
                currentPeriodEnd: stripeSub?.current_period_end
                  ? new Date(stripeSub.current_period_end * 1000)
                  : null,
              },
            });
            const lobbyTier = await prisma.lobbyTier.findUnique({
              where: { id: lobbyTierId },
            });
            if (lobbyTier) {
              const member = await prisma.lobbyMember.findUnique({
                where: { lobbyId_userId: { lobbyId, userId } },
              });
              if (member) {
                if ((member.roleLevel ?? 1) < lobbyTier.grantLevel) {
                  const lobbyRole =
                    lobbyTier.grantLevel >= 4
                      ? "OWNER"
                      : lobbyTier.grantLevel >= 3
                        ? "MOD"
                        : "MEMBER";
                  await prisma.lobbyMember.update({
                    where: { lobbyId_userId: { lobbyId, userId } },
                    data: { roleLevel: lobbyTier.grantLevel, role: lobbyRole },
                  });
                }
              } else {
                await prisma.lobbyMember.create({
                  data: {
                    lobbyId,
                    userId,
                    roleLevel: lobbyTier.grantLevel,
                    role: "MEMBER",
                    name: "",
                  },
                });
              }
            }
            await prisma.lobbyAudit.create({
              data: {
                id: randomUUID(),
                lobbyId,
                type: "tier_subscribed",
                actorId: userId,
                actorName: "system",
                note: lobbyTier?.name || lobbyTierId,
              },
            });
          }
        } else {
          const tier = session?.metadata?.tier || "INDICTED";
          if (userId && subId) {
            const stripeSub = await stripeReq("GET", `/subscriptions/${subId}`);
            await prisma.subscription.upsert({
              where: { userId },
              update: {
                tier,
                stripeSubId: subId,
                status: "active",
                stripePriceId: stripeSub?.items?.data?.[0]?.price?.id || null,
                currentPeriodEnd: stripeSub?.current_period_end
                  ? new Date(stripeSub.current_period_end * 1000)
                  : null,
              },
              create: {
                userId,
                tier,
                stripeSubId: subId,
                status: "active",
                stripeCustomerId: session.customer,
                stripePriceId: stripeSub?.items?.data?.[0]?.price?.id || null,
                currentPeriodEnd: stripeSub?.current_period_end
                  ? new Date(stripeSub.current_period_end * 1000)
                  : null,
              },
            });
            const userTier = tier === "FELON" ? "FELON" : "INDICTED";
            await prisma.user.update({ where: { id: userId }, data: { tier: userTier } });
            await globalAudit("system", "Stripe", "subscription_activated", userId, undefined, {
              tier,
              subId,
            });
          }
        }
      }

      if (event.type === "customer.subscription.updated") {
        const stripeSub = event.data?.object;
        const subId = stripeSub?.id;
        if (subId) {
          const dbSub = await prisma.subscription.findUnique({
            where: { stripeSubId: subId },
          });
          if (dbSub) {
            await prisma.subscription.update({
              where: { stripeSubId: subId },
              data: {
                status: stripeSub.status,
                cancelAtPeriodEnd: Boolean(stripeSub.cancel_at_period_end),
                currentPeriodEnd: stripeSub.current_period_end
                  ? new Date(stripeSub.current_period_end * 1000)
                  : null,
              },
            });
          }
          const lobbyTierSub = await prisma.lobbyTierSub.findUnique({
            where: { stripeSubId: subId },
          });
          if (lobbyTierSub) {
            await prisma.lobbyTierSub.update({
              where: { stripeSubId: subId },
              data: {
                status: stripeSub.status,
                cancelAtPeriodEnd: Boolean(stripeSub.cancel_at_period_end),
                currentPeriodEnd: stripeSub.current_period_end
                  ? new Date(stripeSub.current_period_end * 1000)
                  : null,
              },
            });
          }
        }
      }

      if (event.type === "customer.subscription.deleted") {
        const stripeSub = event.data?.object;
        const subId = stripeSub?.id;
        if (subId) {
          const dbSub = await prisma.subscription.findUnique({
            where: { stripeSubId: subId },
          });
          if (dbSub) {
            await prisma.subscription.update({
              where: { stripeSubId: subId },
              data: { status: "canceled", tier: "FREE" },
            });
            await prisma.user.update({ where: { id: dbSub.userId }, data: { tier: "INNOCENT" } });
            await globalAudit("system", "Stripe", "subscription_canceled", dbSub.userId);
          }
          const lobbyTierSub = await prisma.lobbyTierSub.findUnique({
            where: { stripeSubId: subId },
          });
          if (lobbyTierSub) {
            await prisma.lobbyTierSub.update({
              where: { stripeSubId: subId },
              data: { status: "canceled" },
            });
            const lobbyTier = await prisma.lobbyTier.findUnique({
              where: { id: lobbyTierSub.lobbyTierId },
            });
            if (lobbyTier) {
              const member = await prisma.lobbyMember.findUnique({
                where: {
                  lobbyId_userId: { lobbyId: lobbyTierSub.lobbyId, userId: lobbyTierSub.userId },
                },
              });
              if (member && member.roleLevel === lobbyTier.grantLevel) {
                await prisma.lobbyMember.update({
                  where: {
                    lobbyId_userId: { lobbyId: lobbyTierSub.lobbyId, userId: lobbyTierSub.userId },
                  },
                  data: { roleLevel: 1, role: "MEMBER" },
                });
              }
            }
            await prisma.lobbyAudit.create({
              data: {
                id: randomUUID(),
                lobbyId: lobbyTierSub.lobbyId,
                type: "tier_canceled",
                actorId: lobbyTierSub.userId,
                actorName: "system",
                note: lobbyTier?.name || "",
              },
            });
          }
        }
      }
    } catch (e) {
      log.error("[stripe webhook]", e);
    }

    return reply.send({ ok: true });
  });

  app.post(
    "/staff/subscriptions/grant",
    {
      schema: { tags: ["billing"] },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
      const role = await getGlobalRole(u.id);
      if (!canAssignRoles(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
      const body: any = (req as any).body || {};
      const targetId = String(body.userId || "");
      const tier = String(body.tier || "").toUpperCase();
      if (!targetId || !["FREE", "INDICTED", "FELON", "KINGPIN"].includes(tier)) {
        return reply.code(400).send({ ok: false, error: "invalid" });
      }
      await prisma.subscription.upsert({
        where: { userId: targetId },
        update: { tier: tier as SubTier, status: tier === "FREE" ? "inactive" : "active" },
        create: {
          userId: targetId,
          tier: tier as SubTier,
          status: tier === "FREE" ? "inactive" : "active",
        },
      });
      const userTier =
        tier === "KINGPIN"
          ? "KINGPIN"
          : tier === "FELON"
            ? "FELON"
            : tier === "INDICTED"
              ? "INDICTED"
              : "INNOCENT";
      await prisma.user.update({ where: { id: targetId }, data: { tier: userTier } });
      await globalAudit(u.id, u.name, "subscription_grant", targetId, undefined, { tier });
      return reply.send({ ok: true, tier });
    },
  );

  app.get("/staff/subscriptions", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
    const subs = await prisma.subscription.findMany({
      orderBy: { updatedAt: "desc" },
      take: 200,
    });
    const userIds = subs.map((s: any) => s.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, usernameKey: true, tier: true, notoriety: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));
    const enriched = subs.map((s: any) => ({
      ...s,
      userName: userMap.get(s.userId)?.name || "",
      usernameKey: userMap.get(s.userId)?.usernameKey || "",
      userTier: userMap.get(s.userId)?.tier || "INNOCENT",
      currentPeriodEnd: s.currentPeriodEnd?.toISOString() || null,
      createdAt: s.createdAt?.toISOString() || null,
      updatedAt: s.updatedAt?.toISOString() || null,
    }));
    return reply.send({ ok: true, subscriptions: enriched });
  });
}
