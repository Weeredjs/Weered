// Seeds 6 starter FlairItems and grants Founder to user "donkey".
// Run with: node /tmp/flair-seed.js (cwd /opt/weered/apps/api)
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const ITEMS = [
  {
    slug: "founder",
    name: "Founder",
    description: "Early Weered architect.",
    kind: "BADGE",
    rarity: "LEGENDARY",
    source: "MANUAL",
    color: "#facc15",
    imageUrl: "https://api.dicebear.com/7.x/shapes/svg?seed=founder",
  },
  {
    slug: "beta-tester",
    name: "Beta Tester",
    description: "Stuck around through the rough patches.",
    kind: "BADGE",
    rarity: "EPIC",
    source: "MANUAL",
    color: "#a78bfa",
    imageUrl: "https://api.dicebear.com/7.x/shapes/svg?seed=beta-tester",
  },
  {
    slug: "og-nameplate",
    name: "OG",
    description: "Original gangster nameplate.",
    kind: "NAMEPLATE",
    rarity: "RARE",
    source: "MANUAL",
    color: "#f58220",
    imageUrl: null,
  },
  {
    slug: "tournament-champion-banner",
    name: "Tournament Champion",
    description: "Tournament victor banner.",
    kind: "BANNER",
    rarity: "EPIC",
    source: "MANUAL",
    color: "#facc15",
    imageUrl: "https://api.dicebear.com/7.x/shapes/svg?seed=tournament-champion",
  },
  {
    slug: "first-blood-banner",
    name: "First Blood",
    description: "First match decisive winner.",
    kind: "BANNER",
    rarity: "RARE",
    source: "MANUAL",
    color: "#ef4444",
    imageUrl: "https://api.dicebear.com/7.x/shapes/svg?seed=first-blood",
  },
  {
    slug: "weered-hustler",
    name: "Hustler",
    description: "Climbed the notoriety ladder.",
    kind: "BADGE",
    rarity: "COMMON",
    source: "MANUAL",
    color: "#22c55e",
    imageUrl: "https://api.dicebear.com/7.x/shapes/svg?seed=hustler",
  },
];

(async () => {
  const created = [];
  for (const item of ITEMS) {
    const existing = await prisma.flairItem.findUnique({ where: { slug: item.slug } });
    if (existing) {
      console.log("[exists]", item.slug, existing.id);
      created.push(existing);
      continue;
    }
    const f = await prisma.flairItem.create({
      data: {
        slug: item.slug,
        name: item.name,
        description: item.description,
        kind: item.kind,
        rarity: item.rarity,
        source: item.source,
        color: item.color,
        imageUrl: item.imageUrl,
        meta: {},
      },
    });
    console.log("[created]", f.slug, f.id);
    created.push(f);
  }

  // Grant founder to donkey
  const founder = created.find(f => f.slug === "founder");
  if (founder) {
    const donkey = await prisma.user.findFirst({
      where: { OR: [{ usernameKey: "donkey" }, { name: { equals: "donkey", mode: "insensitive" } }] },
      select: { id: true, name: true, equippedFlairId: true },
    });
    if (donkey) {
      const existing = await prisma.userFlair.findUnique({
        where: { userId_flairItemId: { userId: donkey.id, flairItemId: founder.id } },
      });
      if (!existing) {
        await prisma.userFlair.create({
          data: { userId: donkey.id, flairItemId: founder.id, acquiredFrom: "manual:seed" },
        });
        console.log("[granted] founder -> donkey", donkey.id);
      } else {
        console.log("[grant exists] founder -> donkey", donkey.id);
      }
      if (!donkey.equippedFlairId) {
        await prisma.user.update({ where: { id: donkey.id }, data: { equippedFlairId: founder.id } });
        console.log("[equipped] founder -> donkey");
      }
    } else {
      console.log("[skip] no user with usernameKey=donkey");
    }
  }

  console.log("Done.");
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
