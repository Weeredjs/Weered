// Seeds (or re-seeds) the Downgrade lobby: a prop for the promo (James
// 2026-11-04: "Oh you like discord? It can downgrade to that"). An ordinary
// Weered lobby whose page has the Downgrade button (web
// components/familiar/Downgrade.tsx), with rooms named the way the old place
// names channels: lowercase text channels, and voice channels.
//
// Idempotent. Writes the lobby (unlisted, FEED), its rooms, and the owner at
// level 5. People and chat are not seeded: on prod they're whoever shows up;
// the filming copy has its own cast.
//
// Usage:
//   cd apps/api
//   npx tsx --env-file=.env scripts/seed-downgrade-lobby.ts --owner weered [--confirm-production]
import { PrismaClient } from "@prisma/client";

const args = process.argv.slice(2);
const at = args.indexOf("--owner");
const ownerName = at >= 0 ? String(args[at + 1] || "") : "";
if (!ownerName) {
  console.error(
    "usage: npx tsx scripts/seed-downgrade-lobby.ts --owner <username> [--confirm-production]",
  );
  process.exit(1);
}
const isLocal = /@(127\.0\.0\.1|localhost):15432\//.test(process.env.DATABASE_URL || "");
if (!isLocal && !args.includes("--confirm-production")) {
  console.error("REFUSING: DATABASE_URL is not the local test database. Add --confirm-production.");
  process.exit(1);
}
const prisma = new PrismaClient();

const LOBBY_ID = "downgrade";
const ROOMS = [
  {
    key: "announcements",
    name: "announcements",
    description: "Read-only. Like it used to be.",
    module: null,
  },
  { key: "memes", name: "memes", description: "Post them here.", module: null },
  { key: "clips", name: "clips", description: "Best plays. Worst plays.", module: null },
  { key: "lfg", name: "looking-for-group", description: "Find a squad.", module: null },
  { key: "voice-general", name: "General", description: "Voice.", module: "voice" },
  { key: "voice-gaming", name: "Gaming", description: "Voice.", module: "voice" },
  { key: "voice-afk", name: "AFK", description: "Voice.", module: "voice" },
];

async function main() {
  const owner = await prisma.user.findUnique({ where: { usernameKey: ownerName.toLowerCase() } });
  if (!owner) throw new Error(`No user "${ownerName}".`);
  const fields = {
    name: "Downgrade",
    description: "Like the old place. On purpose. Press Downgrade to see it.",
    moduleType: "FEED" as any,
    ownerId: owner.id,
    unlisted: true,
    pinned: false,
  };
  const lobby = await prisma.lobby.upsert({
    where: { id: LOBBY_ID },
    update: fields,
    create: { id: LOBBY_ID, ...fields },
  });
  await prisma.lobbyMember.upsert({
    where: { lobbyId_userId: { lobbyId: lobby.id, userId: owner.id } },
    update: { roleLevel: 5, role: "OWNER" },
    create: { lobbyId: lobby.id, userId: owner.id, name: owner.name, roleLevel: 5, role: "OWNER" },
  });
  for (const r of ROOMS) {
    const id = `${LOBBY_ID}-${r.key}`;
    const data = {
      name: r.name,
      description: r.description,
      lobbyId: lobby.id,
      ownerId: owner.id,
      pinned: true,
      defaultModule: r.module,
      voiceMode: "OPEN" as const,
    };
    await prisma.room.upsert({
      where: { id },
      update: data,
      create: { id, locked: false, ...data },
    });
  }
  console.log(`lobby   /lobby/${LOBBY_ID}   (unlisted) owner ${owner.name} at level 5`);
  console.log(`rooms   ${ROOMS.map((r) => r.name).join(", ")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
