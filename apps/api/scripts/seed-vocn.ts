// Seeds (or re-seeds) the vOCN Crew Hub: an UNLISTED client-preview lobby for a
// virtual airline, running on the SAMPLE data source (lib/va/sampleSource.ts).
//
// Idempotent. Safe to run again after any change; it converges rather than
// duplicating. What it writes:
//   - the `vocn` lobby: VIRTUAL_AIRLINE module, vOCN branding, role titles,
//     moduleConfig.va (airline, links, pilot links)
//   - seven rooms, gated by Room.minLevel: one public, five crew, one staff
//   - the lobby's upcoming events, including the FRA/MUC group flight
//   - the owner at level 5
//   - two demo logins for the client, ONLY if VOCN_DEMO_PASSWORD is set:
//       vocn-pilot  level 2 (crew),  linked to a sample Senior First Officer
//       vocn-staff  level 4 (staff), linked to a sample Operations Staff pilot
//     The password is never written to the repo; pass it in the environment.
//
// Usage (local):
//   cd apps/api
//   DATABASE_URL=postgresql://weered:weered@127.0.0.1:15432/weered_local \
//   VOCN_DEMO_PASSWORD='…' npx tsx scripts/seed-vocn.ts --owner <username>
//
// Against any non-local database it refuses unless --confirm-production is given.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { buildSampleSnapshot } from "../src/lib/va/sampleSource";

const LOBBY_ID = "vocn";
const SEED = "vocn";

const args = process.argv.slice(2);
const argOf = (k: string) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : undefined;
};
const ownerName = String(argOf("--owner") || "").toLowerCase();
const url = process.env.DATABASE_URL || "";
const isLocal = /@(127\.0\.0\.1|localhost):15432\//.test(url);
if (!ownerName) {
  console.error("usage: npx tsx scripts/seed-vocn.ts --owner <username> [--confirm-production]");
  process.exit(1);
}
if (!isLocal && !args.includes("--confirm-production")) {
  console.error(
    "REFUSING: DATABASE_URL is not the local test database. Add --confirm-production to seed it.",
  );
  process.exit(1);
}

const prisma = new PrismaClient();
const B = "/brand/vocn";

const ROLE_NAMES = {
  "1": "Visitor",
  "2": "Crew",
  "3": "Duty Officer",
  "4": "Operations Staff",
  "5": "Director",
};
const ROLE_ICONS = { "1": "🧳", "2": "✈️", "3": "🎧", "4": "📋", "5": "⭐" };

// minLevel: 0 = anyone, 2 = verified crew, 4 = staff (see Room.minLevel)
const ROOMS = [
  {
    id: "vocn-arrivals",
    name: "Arrivals Hall",
    description:
      "Thinking about joining vOCN? Pull up a seat and ask the crew anything. Open to everyone.",
    minLevel: 0,
    icon: "arrivals",
    defaultModule: null as string | null,
    voiceMode: "OPEN" as const,
  },
  {
    id: "vocn-crew-lounge",
    name: "Crew Lounge",
    description: "Between sectors. Chat, voice, and whatever is on the stream tonight.",
    minLevel: 2,
    icon: "lounge",
    defaultModule: "voice",
    voiceMode: "OPEN" as const,
  },
  {
    id: "vocn-flight-deck",
    name: "Flight Deck",
    description:
      "Shared cockpit voice for flying together: two crews, one frequency, no Discord hop.",
    minLevel: 2,
    icon: "flightdeck",
    defaultModule: "voice",
    voiceMode: "OPEN" as const,
  },
  {
    id: "vocn-briefing",
    name: "Briefing Room",
    description: "Event briefings and crew meetings on video. Raise a hand to speak.",
    minLevel: 2,
    icon: "briefing",
    defaultModule: "video",
    voiceMode: "QUEUED" as const,
  },
  {
    id: "vocn-dispatch",
    name: "Dispatch",
    description: "Group-flight night: wave calls, gate changes and the departure board, live.",
    minLevel: 2,
    icon: "dispatch",
    defaultModule: null,
    voiceMode: "OPEN" as const,
  },
  {
    id: "vocn-training",
    name: "Training Centre",
    description: "Type-rating workshops and checkrides. Screen share the MCDU, walk the flows.",
    minLevel: 2,
    icon: "training",
    defaultModule: "screen",
    voiceMode: "OPEN" as const,
  },
  {
    id: "vocn-staff-ops",
    name: "Staff Ops",
    description: "Operations staff only: PIREP review, rosters, event planning.",
    minLevel: 4,
    icon: "staff",
    defaultModule: "voice",
    voiceMode: "OPEN" as const,
  },
];

const EVENTS = [
  {
    id: "vocn-evt-a330-workshop",
    title: "A330 Type Rating Workshop",
    category: "training",
    startsAt: "2026-09-30T18:30:00Z",
    endsAt: "2026-09-30T20:00:00Z",
    description:
      "For First Officers moving onto the widebody. Cold-and-dark to taxi on the A330, the differences from the A320 family, and a practice FRA-YHZ dispatch. Training Centre, screen share on.",
  },
  {
    id: "vocn-evt-atlantic-crossing",
    title: "Atlantic Crossing: Frankfurt to Halifax",
    category: "event",
    startsAt: "2026-10-04T12:00:00Z",
    endsAt: "2026-10-04T20:00:00Z",
    description:
      "A single-route event on the heavies: Frankfurt to Halifax Stanfield on the A330-300, the seasonal transatlantic leisure route. Oceanic clearance practice beforehand in the Briefing Room.",
  },
  {
    id: "vocn-evt-autumn-sun-bank",
    title: "Herbstsonne: FRA & MUC Autumn Sun Bank",
    category: "group_flight",
    startsAt: "2026-10-10T16:00:00Z",
    endsAt: "2026-10-10T20:30:00Z",
    description:
      "Five waves out of Frankfurt and Munich on all three Airbus types. Book one slot on the departure board; your callsign is fixed to the slot. Dispatch opens in the Dispatch room an hour before the first wave.",
  },
  {
    id: "vocn-evt-winter-meeting",
    title: "Crew Meeting: Winter Schedule 2026/27",
    category: "meeting",
    startsAt: "2026-10-22T18:00:00Z",
    endsAt: "2026-10-22T19:00:00Z",
    description:
      "The winter network, new routes out of Munich, and the A350 plan. Briefing Room, open to all crew.",
  },
];

const LINKS = [
  {
    label: "Join vOCN",
    url: "https://vamsys.io/register/vocn",
    note: "Apply through vAMSYS",
    audience: "public",
  },
  {
    label: "vOCN website",
    url: "https://virtualocn.de",
    note: "Fleet, network and operations",
    audience: "public",
  },
  {
    label: "vAMSYS pilot login",
    url: "https://vamsys.io/login/vocn",
    note: "Book, dispatch and file PIREPs",
    audience: "crew",
  },
  {
    label: "vOCN EFB",
    url: "https://virtualocn.de",
    note: "Opens inside the hub once the EFB allows framing from crew.virtualocn.de",
    embed: false,
    audience: "crew",
  },
  {
    label: "SimBrief Dispatch",
    url: "https://dispatch.simbrief.com",
    note: "Flight planning and OFP",
    audience: "crew",
  },
  {
    label: "Navigraph Charts",
    url: "https://charts.navigraph.com",
    note: "Charts and airport data",
    audience: "crew",
  },
  {
    label: "VATSIM Radar",
    url: "https://vatsim-radar.com",
    note: "Who is online, and who is controlling",
    audience: "crew",
  },
  {
    label: "vOCN live map",
    url: "https://virtualocn.de/live-map",
    note: "The airline's own live map",
    audience: "public",
  },
];

async function main() {
  const owner = await prisma.user.findUnique({ where: { usernameKey: ownerName } });
  if (!owner) throw new Error(`No user "${ownerName}". Register it first.`);

  // Demo accounts first, so their pilot links are in the config the lobby gets.
  const pilotLinks: Record<string, string> = {};
  const demoLevels = new Map<string, number>();
  const demoPassword = process.env.VOCN_DEMO_PASSWORD || "";
  const demo: string[] = [];
  if (demoPassword) {
    if (demoPassword.length < 12)
      throw new Error("VOCN_DEMO_PASSWORD must be at least 12 characters.");
    // Pick the sample pilots the demo logins will BE. Deterministic: same seed,
    // same pilots, every run.
    const snap = buildSampleSnapshot(Date.now(), { seed: SEED });
    const crewPilot =
      snap.pilots.find(
        (p) => p.rankKey === "sfo" && p.hub === "FRA" && !p.honoraryKey && p.lastFlightAt,
      ) || snap.pilots.find((p) => !p.honoraryKey && p.lastFlightAt)!;
    const staffPilot = snap.pilots.find((p) => p.honoraryKey === "ops")!;
    const hash = await bcrypt.hash(demoPassword, 10);
    for (const [username, pilot, level] of [
      ["vocn-pilot", crewPilot, 2],
      ["vocn-staff", staffPilot, 4],
    ] as const) {
      const user = await prisma.user.upsert({
        where: { usernameKey: username },
        update: { name: pilot.name },
        create: { usernameKey: username, name: pilot.name },
      });
      await prisma.localAuth.upsert({
        where: { username },
        update: { passwordHash: hash },
        create: { username, passwordHash: hash, userId: user.id },
      });
      pilotLinks[user.id] = pilot.id;
      demo.push(`${username.padEnd(11)} level ${level}  ${pilot.name} (${pilot.id})`);
      demoLevels.set(user.id, level);
    }
  }

  const moduleConfig = {
    va: {
      source: "sample",
      seed: SEED,
      airline: {
        name: "vOCN",
        legalName: "vOCN Virtual",
        icao: "OCN",
        iata: "4Y",
        tagline: "Leisure routes from Frankfurt and Munich across Europe and the world.",
        website: "https://virtualocn.de",
        registerUrl: "https://vamsys.io/register/vocn",
        loginUrl: "https://vamsys.io/login/vocn",
        disclaimer:
          "vOCN Virtual is an independent, non-commercial flight simulation community, not affiliated with Discover Airlines or the Lufthansa Group.",
      },
      links: LINKS,
      pilotLinks,
      rankImages: {},
    },
  };

  const lobby = await prisma.lobby.upsert({
    where: { id: LOBBY_ID },
    update: {
      name: "vOCN Crew Hub",
      moduleType: "VIRTUAL_AIRLINE" as any,
      moduleConfig: moduleConfig as any,
      ownerId: owner.id,
      unlisted: true,
      pinned: false,
      accentColor: "#FFCD00",
      logoUrl: `${B}/logo.png`,
      bannerUrl: `${B}/banner-a330.webp`,
      roleNames: ROLE_NAMES,
      roleIcons: ROLE_ICONS,
      enabledModules: ["voice", "video", "screen", "youtube", "twitch"],
    },
    create: {
      id: LOBBY_ID,
      name: "vOCN Crew Hub",
      description:
        "The crew side of vOCN Virtual: live flights, PIREPs, ranks and group flights out of Frankfurt and Munich, on top of vAMSYS.",
      moduleType: "VIRTUAL_AIRLINE" as any,
      moduleConfig: moduleConfig as any,
      ownerId: owner.id,
      unlisted: true, // a client preview: direct link only, never in browse or search
      pinned: false,
      verified: true,
      keywords: [],
      accentColor: "#FFCD00",
      logoUrl: `${B}/logo.png`,
      bannerUrl: `${B}/banner-a330.webp`,
      websiteUrl: "https://virtualocn.de",
      roleNames: ROLE_NAMES,
      roleIcons: ROLE_ICONS,
      enabledModules: ["voice", "video", "screen", "youtube", "twitch"],
    },
  });

  // The owner is level 5 explicitly: POST /lobbies never writes this row.
  await prisma.lobbyMember.upsert({
    where: { lobbyId_userId: { lobbyId: lobby.id, userId: owner.id } },
    update: { roleLevel: 5, role: "OWNER" },
    create: { lobbyId: lobby.id, userId: owner.id, name: owner.name, roleLevel: 5, role: "OWNER" },
  });
  for (const [userId, level] of demoLevels) {
    const u = await prisma.user.findUnique({ where: { id: userId } });
    await prisma.lobbyMember.upsert({
      where: { lobbyId_userId: { lobbyId: lobby.id, userId } },
      update: { roleLevel: level, role: level >= 4 ? "MOD" : "MEMBER" },
      create: {
        lobbyId: lobby.id,
        userId,
        name: u?.name || "",
        roleLevel: level,
        role: level >= 4 ? "MOD" : "MEMBER",
      },
    });
  }

  for (const r of ROOMS) {
    const data = {
      name: r.name,
      description: r.description,
      lobbyId: lobby.id,
      ownerId: owner.id,
      pinned: true,
      minLevel: r.minLevel,
      iconUrl: `${B}/rooms/${r.icon}-icon.webp`,
      bannerUrl: `${B}/rooms/${r.icon}-banner.webp`,
      accentColor: "#FFCD00",
      defaultModule: r.defaultModule,
      voiceMode: r.voiceMode,
    };
    await prisma.room.upsert({
      where: { id: r.id },
      update: data,
      create: { id: r.id, locked: false, ...data },
    });
  }

  for (const e of EVENTS) {
    const data = {
      title: e.title,
      description: e.description,
      category: e.category,
      startsAt: new Date(e.startsAt),
      endsAt: new Date(e.endsAt),
      timezone: "Europe/Berlin",
      lobbyId: lobby.id,
      status: "PUBLISHED" as const,
      createdById: owner.id,
      createdByName: owner.name || ownerName,
    };
    await prisma.event.upsert({ where: { id: e.id }, update: data, create: { id: e.id, ...data } });
  }

  console.log(`lobby   /lobby/${LOBBY_ID}   (unlisted, VIRTUAL_AIRLINE, sample data)`);
  console.log(`owner   ${owner.name} (${ownerName}) at level 5`);
  console.log(
    `rooms   ${ROOMS.map((r) => `${r.name}${r.minLevel ? ` [min ${r.minLevel}]` : ""}`).join(", ")}`,
  );
  console.log(`events  ${EVENTS.length}`);
  if (demo.length) for (const d of demo) console.log(`demo    ${d}`);
  else console.log("demo    skipped (set VOCN_DEMO_PASSWORD to create the two demo logins)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
