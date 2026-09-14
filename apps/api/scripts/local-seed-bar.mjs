// Seeds the LOCAL test database with a populated Beyond All Reason lobby.
//
// Linked names are taken from BAR's live data at seed time, so the Live board
// shows members genuinely in a game and Matches shows genuine recent results.
// Fake members never log in; they only exist to be linked and listed.
//
// Refuses to run unless DATABASE_URL points at a local database, because this
// writes users and lobbies.
//
//   cd apps/api
//   DATABASE_URL=postgresql://weered:weered@127.0.0.1:15432/weered_local \
//     node scripts/local-seed-bar.mjs <your-local-username>
//
// Register <your-local-username> through the local site first; the script makes
// that account the lobby owner and links it to a live BAR player too.

import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL || "";
if (!/@(127\.0\.0\.1|localhost):15432\//.test(url)) {
  console.error("REFUSING: DATABASE_URL is not the local test database (127.0.0.1:15432).");
  process.exit(1);
}

const ownerName = String(process.argv[2] || "").toLowerCase();
if (!ownerName) {
  console.error("usage: node scripts/local-seed-bar.mjs <your-local-username>");
  process.exit(1);
}

const LOBBY_ID = "bar-local";
const ROOM_ID = "bar-local-war-room";
const prisma = new PrismaClient();

async function bar(path) {
  const r = await fetch(`https://api.bar-rts.com${path}`, { signal: AbortSignal.timeout(20_000) });
  if (!r.ok) throw new Error(`bar-rts ${path} -> ${r.status}`);
  return r.json();
}

async function main() {
  const owner = await prisma.user.findUnique({ where: { usernameKey: ownerName } });
  if (!owner) throw new Error(`No local user "${ownerName}". Register it on the local site first.`);

  // People in a running game right now, then people with recent public matches.
  const battles = await bar("/battles");
  const inGame = [];
  for (const b of battles) {
    const running = b?.gameStatus === "running" || b?.founder?.status?.ingame;
    if (!running) continue;
    for (const p of b.players || []) {
      if (p?.status?.bot || !p?.username) continue;
      if (!inGame.includes(p.username)) inGame.push(p.username);
    }
  }
  const replays = await bar("/replays?page=1&limit=15");
  const recent = [];
  for (const r of replays.data || []) {
    for (const t of r.AllyTeams || []) {
      for (const p of t.Players || []) {
        if (p?.name && !recent.includes(p.name) && !inGame.includes(p.name)) recent.push(p.name);
      }
    }
  }
  const picks = [...inGame.slice(0, 5), ...recent.slice(0, 4)];
  if (picks.length < 3)
    throw new Error("BAR returned too few players to seed with; try again in a minute.");

  const lobby = await prisma.lobby.upsert({
    where: { id: LOBBY_ID },
    update: { moduleType: "BAR", ownerId: owner.id },
    create: {
      id: LOBBY_ID,
      name: "Beyond All Reason (local)",
      description: "Local test lobby for the BAR module.",
      moduleType: "BAR",
      accentColor: "#4FA3E0",
      ownerId: owner.id,
      unlisted: true,
      enabledModules: ["voice", "screen", "video", "youtube", "twitch"],
      keywords: ["bar", "beyond all reason", "rts"],
    },
  });

  await prisma.room.upsert({
    where: { id: ROOM_ID },
    update: { lobbyId: lobby.id, ownerId: owner.id },
    create: { id: ROOM_ID, name: "War Room", lobbyId: lobby.id, ownerId: owner.id },
  });

  // The owner is linked to the first live player so the board shows "you" in a game.
  await prisma.user.update({ where: { id: owner.id }, data: { barUsername: picks[0] } });
  await prisma.lobbyMember.upsert({
    where: { lobbyId_userId: { lobbyId: lobby.id, userId: owner.id } },
    update: { roleLevel: 5 },
    create: { lobbyId: lobby.id, userId: owner.id, name: owner.name, roleLevel: 5 },
  });

  const seeded = [];
  for (const [i, barName] of picks.slice(1).entries()) {
    const key = `barfake${i + 1}`;
    const user = await prisma.user.upsert({
      where: { usernameKey: key },
      update: { barUsername: barName },
      create: { usernameKey: key, name: `Crew ${i + 1}`, barUsername: barName },
    });
    await prisma.lobbyMember.upsert({
      where: { lobbyId_userId: { lobbyId: lobby.id, userId: user.id } },
      update: {},
      create: { lobbyId: lobby.id, userId: user.id, name: user.name },
    });
    seeded.push(`${user.name} -> ${barName}${inGame.includes(barName) ? " (in game now)" : ""}`);
  }

  console.log(`lobby  http://bar.localhost:8080/lobby/${LOBBY_ID}?view=modules`);
  console.log(`room   http://bar.localhost:8080/room/${ROOM_ID}`);
  console.log(
    `owner  ${owner.name} -> ${picks[0]}${inGame.includes(picks[0]) ? " (in game now)" : ""}`,
  );
  for (const s of seeded) console.log(`member ${s}`);
}

main()
  .catch((e) => {
    console.error(e.message || e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
