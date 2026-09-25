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
// Role icons: vOCN's rank badge set (48x48), one per access level. Served by
// Weered under /brand/, the only image paths cleanRoleIcons accepts.
const BADGE = (n: string) => `${B}/badges/badge-${n}.svg`;
const ROLE_ICONS = {
  "1": BADGE("cadet"),
  "2": BADGE("first-officer"),
  "3": BADGE("captain"),
  "4": BADGE("staff"),
  "5": BADGE("senior-captain"),
};

// Rank insignia: vOCN's lapel set (200x64), keyed by the sample ladder's ranks.
const RANK = (n: string) => `${B}/ranks/rank-${n}.svg`;
const RANK_IMAGES = {
  cdt: RANK("1-cadet"),
  so: RANK("2-second-officer"),
  fo: RANK("3-first-officer"),
  sfo: RANK("3s-senior-first-officer"),
  cpt: RANK("4-captain"),
  scp: RANK("4s-senior-captain"),
  ltc: RANK("4-captain"), // honorary trainer: a captain's lapel
  ops: RANK("staff"),
};

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

// Crew Notices. Deliberately about vOCN's own operation (its event, its rooms,
// its published fleet plan), never real-world airport procedures that a sim
// pilot could fact-check against the AIP and find wrong.
const NOTICES: {
  id: string;
  title: string;
  body: string;
  category: "ANNOUNCEMENT" | "DISCUSSION";
  tags: string[];
  at: string;
  pinned?: boolean;
}[] = [
  {
    id: "vocn-notice-welcome",
    title: "Welcome to the vOCN Crew Hub",
    category: "ANNOUNCEMENT",
    pinned: true,
    tags: ["welcome"],
    at: "2026-09-22T08:00:00Z",
    body: [
      "This is the crew side of vOCN: one place for what is otherwise spread across vAMSYS, the website and Discord.",
      "",
      "- **Crew Hub** shows who is flying, what just landed, where you stand and what is coming up.",
      "- **Departures** is the group-flight board: book one slot, and your callsign is fixed to it.",
      "- **Crew Rooms**: the Flight Deck for flying together on voice, the Briefing Room for events and training, the Crew Lounge for everything else.",
      "",
      "vAMSYS stays where you book, dispatch and file. Nothing here replaces it.",
    ].join("\n"),
  },
  {
    id: "vocn-notice-bank",
    title: "Herbstsonne: the Autumn Sun Bank is open for booking",
    category: "ANNOUNCEMENT",
    tags: ["event", "group-flight"],
    at: "2026-09-24T17:30:00Z",
    body: [
      "Saturday 10 October, from 18:00 CEST. Five waves out of Frankfurt and Munich on all three Airbus types, with the heavies pushing at 19:15 and Halifax first out.",
      "",
      "Book one slot on the Departures board. Your callsign is fixed to the slot; dispatch and file through vAMSYS as normal on the night. The briefing is in the Briefing Room an hour before the first wave.",
    ].join("\n"),
  },
  {
    id: "vocn-notice-workshop",
    title: "A330 type rating workshop, Wednesday",
    category: "ANNOUNCEMENT",
    tags: ["training"],
    at: "2026-09-24T21:00:00Z",
    body: [
      "For First Officers moving onto the widebody: cold-and-dark to taxi on the A330, the differences from the A320 family, and a practice Frankfurt to Halifax dispatch.",
      "",
      "Wednesday 30 September, 20:30 CEST, in the Training Centre. Screen share will be on, so bring questions about the MCDU.",
    ].join("\n"),
  },
  {
    id: "vocn-notice-winter",
    title: "Crew meeting 22 October: winter network and the A350 plan",
    category: "DISCUSSION",
    tags: ["meeting", "fleet"],
    at: "2026-09-25T11:00:00Z",
    body: [
      "The winter schedule, the routes out of Munich, and what the A350-900 arriving from mid-2027 means for the long-haul side.",
      "",
      "Put questions here beforehand and we will work through them in the Briefing Room on the night.",
    ].join("\n"),
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

  // Dispatch: the airline's voice in its Dispatch room (src/vaDispatchWorker.ts).
  // A system account with no LocalAuth, so it can never be signed into.
  const dispatchUser = await prisma.user.upsert({
    where: { usernameKey: "vocn-dispatch" },
    update: { name: "vOCN Dispatch", avatar: `${B}/mark.png`, avatarColor: "#FFCD00" },
    create: {
      usernameKey: "vocn-dispatch",
      name: "vOCN Dispatch",
      avatar: `${B}/mark.png`,
      avatarColor: "#FFCD00",
    },
  });

  const moduleConfig = {
    va: {
      dispatch: { roomId: "vocn-dispatch", userId: dispatchUser.id },
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
        liveMapUrl: "https://virtualocn.de/live-map",
        disclaimer:
          "vOCN Virtual is an independent, non-commercial flight simulation community, not affiliated with Discover Airlines or the Lufthansa Group.",
      },
      links: LINKS,
      pilotLinks,
      rankImages: RANK_IMAGES,
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
      logoUrl: `${B}/mark.png`,
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
      logoUrl: `${B}/mark.png`,
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

  // Crew Notices (the lobby's Feed is its forum). Posted by the sample Operations
  // Staff pilot when the demo logins exist, the owner otherwise. Tagged "sample"
  // and saying so in the body: they are demo content, not vOCN's words.
  const staffUser = await prisma.user.findUnique({ where: { usernameKey: "vocn-staff" } });
  const poster = staffUser ?? owner;
  for (const n of NOTICES) {
    const data = {
      title: n.title,
      body: `${n.body}\n\n_Sample notice for the Crew Hub demo._`,
      category: n.category,
      lobbyId: lobby.id,
      authorId: poster.id,
      authorName: poster.name || "Operations",
      pinned: !!n.pinned,
      tags: ["sample", ...n.tags],
      createdAt: new Date(n.at),
    };
    await prisma.forumPost.upsert({
      where: { id: n.id },
      update: data,
      create: { id: n.id, ...data },
    });
  }

  console.log(`lobby   /lobby/${LOBBY_ID}   (unlisted, VIRTUAL_AIRLINE, sample data)`);
  console.log(`owner   ${owner.name} (${ownerName}) at level 5`);
  console.log(
    `rooms   ${ROOMS.map((r) => `${r.name}${r.minLevel ? ` [min ${r.minLevel}]` : ""}`).join(", ")}`,
  );
  console.log(`events  ${EVENTS.length}`);
  console.log(`notices ${NOTICES.length} (posted as ${poster.name})`);
  if (demo.length) for (const d of demo) console.log(`demo    ${d}`);
  else console.log("demo    skipped (set VOCN_DEMO_PASSWORD to create the two demo logins)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
