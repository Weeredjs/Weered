// Seed script for reserved names
// Run: node seed-reserved.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const RESERVED = [
  // Platform names
  { name: "weered", scope: "BOTH", reason: "Platform brand" },
  { name: "weeredca", scope: "BOTH", reason: "Platform brand" },
  { name: "weerd", scope: "BOTH", reason: "Platform brand" },
  { name: "admin", scope: "BOTH", reason: "System role" },
  { name: "administrator", scope: "BOTH", reason: "System role" },
  { name: "moderator", scope: "BOTH", reason: "System role" },
  { name: "mod", scope: "BOTH", reason: "System role" },
  { name: "staff", scope: "BOTH", reason: "System role" },
  { name: "support", scope: "BOTH", reason: "System role" },
  { name: "system", scope: "BOTH", reason: "System role" },
  { name: "official", scope: "BOTH", reason: "System role" },
  { name: "help", scope: "BOTH", reason: "System role" },
  { name: "bot", scope: "BOTH", reason: "System role" },
  { name: "root", scope: "BOTH", reason: "System role" },
  { name: "godfather", scope: "BOTH", reason: "Platform role" },
  { name: "kingpin", scope: "BOTH", reason: "Platform tier" },
  { name: "felon", scope: "BOTH", reason: "Platform tier" },
  { name: "indicted", scope: "BOTH", reason: "Platform tier" },
  { name: "innocent", scope: "BOTH", reason: "Platform tier" },

  // Major tech brands
  { name: "microsoft", scope: "BOTH", reason: "Brand protection" },
  { name: "google", scope: "BOTH", reason: "Brand protection" },
  { name: "apple", scope: "BOTH", reason: "Brand protection" },
  { name: "amazon", scope: "BOTH", reason: "Brand protection" },
  { name: "meta", scope: "BOTH", reason: "Brand protection" },
  { name: "facebook", scope: "BOTH", reason: "Brand protection" },
  { name: "instagram", scope: "BOTH", reason: "Brand protection" },
  { name: "tiktok", scope: "BOTH", reason: "Brand protection" },
  { name: "twitter", scope: "BOTH", reason: "Brand protection" },
  { name: "x", scope: "BOTH", reason: "Brand protection" },
  { name: "discord", scope: "BOTH", reason: "Competitor" },
  { name: "reddit", scope: "BOTH", reason: "Competitor" },
  { name: "twitch", scope: "BOTH", reason: "Brand protection" },
  { name: "youtube", scope: "BOTH", reason: "Brand protection" },
  { name: "spotify", scope: "BOTH", reason: "Brand protection" },
  { name: "netflix", scope: "BOTH", reason: "Brand protection" },
  { name: "valve", scope: "BOTH", reason: "Brand protection" },
  { name: "steam", scope: "BOTH", reason: "Brand protection" },
  { name: "epicgames", scope: "BOTH", reason: "Brand protection" },
  { name: "riotgames", scope: "BOTH", reason: "Brand protection" },
  { name: "riot", scope: "BOTH", reason: "Brand protection" },
  { name: "blizzard", scope: "BOTH", reason: "Brand protection" },
  { name: "activision", scope: "BOTH", reason: "Brand protection" },
  { name: "bungie", scope: "BOTH", reason: "Brand protection" },
  { name: "nintendo", scope: "BOTH", reason: "Brand protection" },
  { name: "sony", scope: "BOTH", reason: "Brand protection" },
  { name: "playstation", scope: "BOTH", reason: "Brand protection" },
  { name: "xbox", scope: "BOTH", reason: "Brand protection" },
  { name: "nvidia", scope: "BOTH", reason: "Brand protection" },
  { name: "amd", scope: "BOTH", reason: "Brand protection" },
  { name: "openai", scope: "BOTH", reason: "Brand protection" },
  { name: "anthropic", scope: "BOTH", reason: "Brand protection" },
  { name: "claude", scope: "BOTH", reason: "Brand protection" },

  // Fashion/lifestyle brands
  { name: "nike", scope: "BOTH", reason: "Brand protection" },
  { name: "adidas", scope: "BOTH", reason: "Brand protection" },
  { name: "supreme", scope: "BOTH", reason: "Brand protection" },

  // Political / high-profile
  { name: "trump", scope: "BOTH", reason: "Public figure" },
  { name: "donaldtrump", scope: "BOTH", reason: "Public figure" },
  { name: "biden", scope: "BOTH", reason: "Public figure" },
  { name: "joebiden", scope: "BOTH", reason: "Public figure" },
  { name: "obama", scope: "BOTH", reason: "Public figure" },
  { name: "clinton", scope: "BOTH", reason: "Public figure" },
  { name: "musk", scope: "BOTH", reason: "Public figure" },
  { name: "elonmusk", scope: "BOTH", reason: "Public figure" },
  { name: "bezos", scope: "BOTH", reason: "Public figure" },
  { name: "zuckerberg", scope: "BOTH", reason: "Public figure" },
  { name: "trudeau", scope: "BOTH", reason: "Public figure" },

  // Government / sensitive
  { name: "police", scope: "BOTH", reason: "Sensitive term" },
  { name: "fbi", scope: "BOTH", reason: "Government agency" },
  { name: "cia", scope: "BOTH", reason: "Government agency" },
  { name: "rcmp", scope: "BOTH", reason: "Government agency" },
  { name: "government", scope: "BOTH", reason: "Sensitive term" },
  { name: "canada", scope: "LOBBY", reason: "Country name" },
  { name: "usa", scope: "LOBBY", reason: "Country name" },
  { name: "unitedstates", scope: "LOBBY", reason: "Country name" },

  // Sports leagues
  { name: "nfl", scope: "LOBBY", reason: "League brand" },
  { name: "nba", scope: "LOBBY", reason: "League brand" },
  { name: "mlb", scope: "LOBBY", reason: "League brand" },
  { name: "nhl", scope: "LOBBY", reason: "League brand — use nhl-hockey or similar" },
  { name: "fifa", scope: "LOBBY", reason: "League brand" },
  { name: "ufc", scope: "LOBBY", reason: "League brand — use ufc-mma or similar" },
];

async function main() {
  let added = 0;
  let skipped = 0;
  for (const entry of RESERVED) {
    try {
      await prisma.reservedName.create({
        data: { name: entry.name, scope: entry.scope, reason: entry.reason, addedBy: "system" },
      });
      added++;
    } catch (e) {
      // P2002 = unique constraint (already exists)
      skipped++;
    }
  }
  console.log(`Done: ${added} added, ${skipped} skipped (already existed)`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
