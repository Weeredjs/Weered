import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";

type Opts = {
  authFromHeader: (h?: string) => { id: string } | null;
};

export default async function storeRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader } = opts;

  app.get("/store", async (req, reply) => {
    const q: any = (req as any).query || {};
    const category = q.category || null;
    const where: any = { available: true };
    if (category) where.category = category;

    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const currentWeek = Math.ceil(((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);

    const items = await (prisma as any).storeItem.findMany({
      where,
      orderBy: [{ featured: "desc" }, { rarity: "desc" }, { createdAt: "desc" }],
      take: 100,
    });

    const filtered = items.filter((i: any) => !i.weeklyRotation || i.rotationWeek === currentWeek || i.rotationWeek === null);

    return reply.send({
      ok: true,
      items: filtered.map((i: any) => ({
        ...i,
        soldOut: i.maxSupply != null && i.totalMinted >= i.maxSupply,
        remaining: i.maxSupply != null ? Math.max(0, i.maxSupply - i.totalMinted) : null,
        createdAt: i.createdAt?.toISOString(),
      })),
      week: currentWeek,
    });
  });

  app.post("/store/buy/:itemId", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const itemId = String((req as any).params?.itemId || "");

    const item = await (prisma as any).storeItem.findUnique({ where: { id: itemId } });
    if (!item || !item.available) return reply.code(404).send({ ok: false, error: "item_not_found" });

    if (item.maxSupply != null && item.totalMinted >= item.maxSupply) {
      return reply.code(400).send({ ok: false, error: "sold_out" });
    }

    const user = await prisma.user.findUnique({ where: { id: u.id }, select: { paper: true } });
    if (!user || (user as any).paper < item.price) {
      return reply.code(400).send({ ok: false, error: "insufficient_paper", need: item.price, have: (user as any)?.paper || 0 });
    }

    if (item.category !== "CONSUMABLE" && item.category !== "COLLECTIBLE") {
      const existing = await (prisma as any).userItem.findFirst({
        where: { userId: u.id, itemId, consumed: false },
      });
      if (existing) return reply.code(400).send({ ok: false, error: "already_owned" });
    }

    try {
      // Race-safe purchase: the pre-reads above are only a fast-path. The
      // affordability + supply checks are re-applied as guarded writes on the
      // locked rows INSIDE the transaction, so concurrent buys can neither
      // overdraft the balance nor over-mint past maxSupply (matches awardPaper).
      const result: any = await prisma.$transaction(async (tx) => {
        const deb = await tx.user.updateMany({
          where: { id: u.id, paper: { gte: item.price } },
          data: { paper: { decrement: item.price } },
        });
        if (deb.count === 0) return { error: "insufficient_paper" };

        let claimedMint: number | null = null;
        if (item.maxSupply != null) {
          const sup = await (tx as any).storeItem.updateMany({
            where: { id: itemId, totalMinted: { lt: item.maxSupply } },
            data: { totalMinted: { increment: 1 } },
          });
          if (sup.count === 0) throw new Error("__SOLD_OUT__"); // rolls back the debit
          const si = await (tx as any).storeItem.findUnique({ where: { id: itemId }, select: { totalMinted: true } });
          claimedMint = (si as any)?.totalMinted ?? null;
        } else {
          await (tx as any).storeItem.update({ where: { id: itemId }, data: { totalMinted: { increment: 1 } } });
        }

        const fresh = await tx.user.findUnique({ where: { id: u.id }, select: { paper: true } });
        const newBalance = (fresh as any)?.paper ?? 0;

        const userItem = await (tx as any).userItem.create({
          data: { userId: u.id, itemId, acquiredFrom: "store", acquiredPrice: item.price, mintNumber: claimedMint },
        });
        await (tx as any).paperTransaction.create({
          data: {
            userId: u.id,
            type: "SPEND_STORE",
            amount: -item.price,
            balance: newBalance,
            description: `Purchased: ${item.name}`,
            refId: itemId,
          },
        });
        return { userItem, mintNumber: claimedMint, balance: newBalance };
      });

      if (result?.error === "insufficient_paper") {
        return reply.code(400).send({ ok: false, error: "insufficient_paper", need: item.price, have: (user as any)?.paper || 0 });
      }

      return reply.send({
        ok: true,
        item: { id: result.userItem.id, name: item.name, rarity: item.rarity, mintNumber: result.mintNumber },
        balance: result.balance,
      });
    } catch (e) {
      if ((e as any)?.message === "__SOLD_OUT__") return reply.code(400).send({ ok: false, error: "sold_out" });
      console.error("[store] purchase error:", e);
      return reply.code(500).send({ ok: false, error: "purchase_failed" });
    }
  });

  app.get("/inventory", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });

    const items = await (prisma as any).userItem.findMany({
      where: { userId: u.id },
      include: { item: true },
      orderBy: { acquiredAt: "desc" },
    });

    return reply.send({
      ok: true,
      items: items.map((ui: any) => ({
        id: ui.id,
        itemId: ui.itemId,
        name: ui.item.name,
        description: ui.item.description,
        category: ui.item.category,
        rarity: ui.item.rarity,
        imageUrl: ui.item.imageUrl,
        equipped: ui.equipped,
        consumed: ui.consumed,
        mintNumber: ui.mintNumber,
        maxSupply: ui.item.maxSupply,
        acquiredFrom: ui.acquiredFrom,
        acquiredPrice: ui.acquiredPrice,
        acquiredAt: ui.acquiredAt?.toISOString(),
        unlockTarget: ui.item.unlockTarget,
        metadata: ui.item.metadata,
      })),
    });
  });

  app.post("/inventory/equip/:userItemId", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const userItemId = String((req as any).params?.userItemId || "");

    const ui = await (prisma as any).userItem.findUnique({ where: { id: userItemId }, include: { item: true } });
    if (!ui || ui.userId !== u.id) return reply.code(404).send({ ok: false, error: "not_found" });
    if (ui.consumed) return reply.code(400).send({ ok: false, error: "consumed" });

    if (!ui.equipped) {
      await (prisma as any).userItem.updateMany({
        where: { userId: u.id, equipped: true, item: { category: ui.item.category } },
        data: { equipped: false },
      });
    }

    await (prisma as any).userItem.update({
      where: { id: userItemId },
      data: { equipped: !ui.equipped },
    });

    return reply.send({ ok: true, equipped: !ui.equipped });
  });

  app.post("/inventory/consume/:userItemId", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const userItemId = String((req as any).params?.userItemId || "");

    const ui = await (prisma as any).userItem.findUnique({ where: { id: userItemId }, include: { item: true } });
    if (!ui || ui.userId !== u.id) return reply.code(404).send({ ok: false, error: "not_found" });
    if (ui.item.category !== "CONSUMABLE") return reply.code(400).send({ ok: false, error: "not_consumable" });
    if (ui.consumed) return reply.code(400).send({ ok: false, error: "already_consumed" });

    await (prisma as any).userItem.update({
      where: { id: userItemId },
      data: { consumed: true, consumedAt: new Date() },
    });

    return reply.send({ ok: true, consumed: true, unlockTarget: ui.item.unlockTarget });
  });

  app.get("/market", async (req, reply) => {
    const q: any = (req as any).query || {};
    const where: any = { status: "ACTIVE" };
    if (q.rarity) where.itemRarity = q.rarity;
    if (q.search) where.itemName = { contains: q.search, mode: "insensitive" };

    const sort = q.sort === "price_asc" ? { price: "asc" as const }
      : q.sort === "price_desc" ? { price: "desc" as const }
      : { createdAt: "desc" as const };

    const listings = await (prisma as any).marketListing.findMany({
      where,
      orderBy: sort,
      take: 50,
    });

    const sellerIds = [...new Set(listings.map((l: any) => l.sellerId))] as string[];
    const sellers = sellerIds.length
      ? await prisma.user.findMany({ where: { id: { in: sellerIds } }, select: { id: true, name: true, avatarColor: true } as any })
      : [];
    const sellerMap = new Map(sellers.map((s: any) => [s.id, s]));

    const itemIds = [...new Set(listings.map((l: any) => l.itemId))] as string[];
    const items = itemIds.length
      ? await (prisma as any).storeItem.findMany({ where: { id: { in: itemIds } }, select: { id: true, imageUrl: true, category: true, description: true } })
      : [];
    const itemMap = new Map(items.map((i: any) => [i.id, i]));

    return reply.send({
      ok: true,
      listings: listings.map((l: any) => {
        const seller = sellerMap.get(l.sellerId) as any;
        const item = itemMap.get(l.itemId) as any;
        return {
          ...l,
          sellerName: seller?.name || "Unknown",
          sellerColor: seller?.avatarColor || null,
          imageUrl: item?.imageUrl || null,
          category: item?.category || null,
          description: item?.description || null,
          createdAt: l.createdAt?.toISOString(),
          expiresAt: l.expiresAt?.toISOString(),
        };
      }),
    });
  });

  app.post("/market/list", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const body: any = (req as any).body || {};

    const userItemId = String(body.userItemId || "");
    const price = parseInt(body.price);
    if (!userItemId || !price || price < 1) return reply.code(400).send({ ok: false, error: "invalid_params" });

    const ui = await (prisma as any).userItem.findUnique({ where: { id: userItemId }, include: { item: true } });
    if (!ui || ui.userId !== u.id) return reply.code(404).send({ ok: false, error: "not_found" });
    if (ui.consumed) return reply.code(400).send({ ok: false, error: "consumed" });

    const existingListing = await (prisma as any).marketListing.findFirst({
      where: { userItemId, status: "ACTIVE" },
    });
    if (existingListing) return reply.code(400).send({ ok: false, error: "already_listed" });

    const listing = await (prisma as any).marketListing.create({
      data: {
        sellerId: u.id,
        userItemId,
        itemId: ui.itemId,
        itemName: ui.item.name,
        itemRarity: ui.item.rarity,
        price,
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });

    if (ui.equipped) {
      await (prisma as any).userItem.update({ where: { id: userItemId }, data: { equipped: false } });
    }

    return reply.send({ ok: true, listing: { ...listing, createdAt: listing.createdAt?.toISOString() } });
  });

  app.post("/market/buy/:listingId", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const listingId = String((req as any).params?.listingId || "");

    const listing = await (prisma as any).marketListing.findUnique({ where: { id: listingId } });
    if (!listing || listing.status !== "ACTIVE") return reply.code(404).send({ ok: false, error: "not_found" });
    if (listing.sellerId === u.id) return reply.code(400).send({ ok: false, error: "cant_buy_own" });

    const buyer = await prisma.user.findUnique({ where: { id: u.id }, select: { paper: true } });
    if (!buyer || (buyer as any).paper < listing.price) {
      return reply.code(400).send({ ok: false, error: "insufficient_paper" });
    }

    try {
      // Race-safe purchase: claim the listing (ACTIVE->SOLD) and debit the buyer
      // as GUARDED writes inside the tx so the same listing can't be sold twice
      // and the buyer can't overdraft; credit the seller via INCREMENT (not an
      // absolute write) so a concurrent change to the seller's balance is never
      // clobbered (the prior absolute writes were a lost-update for both sides).
      const result: any = await prisma.$transaction(async (tx) => {
        const claim = await (tx as any).marketListing.updateMany({
          where: { id: listingId, status: "ACTIVE" },
          data: { status: "SOLD", buyerId: u.id, soldAt: new Date() },
        });
        if (claim.count === 0) return { error: "not_found" };

        const deb = await tx.user.updateMany({
          where: { id: u.id, paper: { gte: listing.price } },
          data: { paper: { decrement: listing.price } },
        });
        if (deb.count === 0) throw new Error("__INSUFFICIENT__"); // rolls back the listing claim

        await tx.user.update({ where: { id: listing.sellerId }, data: { paper: { increment: listing.price } } });
        await (tx as any).userItem.update({
          where: { id: listing.userItemId },
          data: { userId: u.id, acquiredFrom: listing.sellerId, acquiredPrice: listing.price, acquiredAt: new Date(), equipped: false },
        });

        const buyerFresh = await tx.user.findUnique({ where: { id: u.id }, select: { paper: true } });
        const sellerFresh = await tx.user.findUnique({ where: { id: listing.sellerId }, select: { paper: true } });
        const buyerNewBalance = (buyerFresh as any)?.paper ?? 0;
        const sellerNewBalance = (sellerFresh as any)?.paper ?? 0;

        await (tx as any).paperTransaction.create({
          data: { userId: u.id, type: "SPEND_MARKET", amount: -listing.price, balance: buyerNewBalance, description: `Bought: ${listing.itemName}`, refId: listingId },
        });
        await (tx as any).paperTransaction.create({
          data: { userId: listing.sellerId, type: "EARN_TRADE_SOLD", amount: listing.price, balance: sellerNewBalance, description: `Sold: ${listing.itemName}`, refId: listingId },
        });
        return { balance: buyerNewBalance };
      });

      if (result?.error === "not_found") return reply.code(404).send({ ok: false, error: "not_found" });
      return reply.send({ ok: true, balance: result.balance });
    } catch (e) {
      if ((e as any)?.message === "__INSUFFICIENT__") return reply.code(400).send({ ok: false, error: "insufficient_paper" });
      console.error("[market] purchase error:", e);
      return reply.code(500).send({ ok: false, error: "purchase_failed" });
    }
  });

  app.post("/market/cancel/:listingId", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const listingId = String((req as any).params?.listingId || "");

    const listing = await (prisma as any).marketListing.findUnique({ where: { id: listingId } });
    if (!listing || listing.sellerId !== u.id) return reply.code(404).send({ ok: false, error: "not_found" });
    if (listing.status !== "ACTIVE") return reply.code(400).send({ ok: false, error: "not_active" });

    await (prisma as any).marketListing.update({ where: { id: listingId }, data: { status: "CANCELLED" } });
    return reply.send({ ok: true });
  });

  setInterval(async () => {
    try {
      await (prisma as any).marketListing.updateMany({
        where: { status: "ACTIVE", expiresAt: { lte: new Date() } },
        data: { status: "EXPIRED" },
      });
    } catch {}
  }, 5 * 60 * 1000);
}
