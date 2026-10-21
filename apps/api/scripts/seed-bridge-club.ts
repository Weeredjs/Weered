// Seeds (or re-seeds) a bridge club's lobby: the club's home online around play
// on BBO or RealBridge. Free, unlisted until the club takes it over.
//
// Idempotent. Safe to run again; it converges rather than duplicating. Writes:
//   - the club lobby (FEED module, role titles, felt-green accent), unlisted
//   - four rooms: Clubhouse, Lesson Room, Post-mortem, Executive (level 4+)
//   - the club's timed weekly sessions as events for the next WEEKS weeks
//   - a pinned welcome post
//   - the owner at level 5
//
// Session times come from the club's own site; a session whose time the club
// does not publish is left out rather than guessed.
//
// Usage:
//   cd apps/api
//   npx tsx --env-file=.env scripts/seed-bridge-club.ts --club mhdbridge --owner weered [--confirm-production]
import { PrismaClient } from "@prisma/client";

type Session = {
  key: string;
  title: string;
  weekday: number;
  time: string;
  where: string;
  about: string;
};
type Club = {
  id: string;
  name: string;
  short: string;
  description: string;
  timezone: string;
  websiteUrl: string;
  keywords: string[];
  sessions: Session[];
};

// weekday: 0 = Sunday ... 6 = Saturday, local to the club's timezone.
const CLUBS: Record<string, Club> = {
  mhdbridge: {
    id: "mhdbridge",
    name: "Medicine Hat Duplicate Bridge Club",
    short: "Medicine Hat",
    description:
      "Five play times a week at the Veiner Centre, 225 Woodman Ave SE: ACBL sanctioned, casual and assisted. Chat between sessions, video rooms for lessons and going over the hands.",
    timezone: "America/Edmonton",
    websiteUrl: "https://www.bridgewebs.com/medicinehat/",
    keywords: ["bridge", "duplicate", "medicine hat", "acbl", "alberta"],
    sessions: [
      {
        key: "assisted",
        title: "Assisted Play",
        weekday: 3,
        time: "12:15",
        where: "South Room, Veiner Centre",
        about: "A brief lesson with Laverne, then assisted play. A fun entry-level game.",
      },
      {
        key: "casual",
        title: "Casual Play",
        weekday: 4,
        time: "17:45",
        where: "North Room, Veiner Centre",
        about: "Casual duplicate.",
      },
      {
        key: "friday-acbl",
        title: "Friday ACBL Sanctioned",
        weekday: 5,
        time: "12:30",
        where: "North Room, Veiner Centre",
        about: "ACBL sanctioned duplicate.",
      },
    ],
  },
};

const WEEKS = 3;
const ACCENT = "#2E7D4F"; // card-table felt
const ROLE_NAMES = {
  "1": "Guest",
  "2": "Member",
  "3": "Director",
  "4": "Executive",
  "5": "Club Admin",
};

const args = process.argv.slice(2);
const argOf = (k: string) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : undefined;
};
const clubKey = String(argOf("--club") || "");
const ownerName = String(argOf("--owner") || "").toLowerCase();
const club = CLUBS[clubKey];
if (!club || !ownerName) {
  console.error(
    `usage: npx tsx scripts/seed-bridge-club.ts --club <${Object.keys(CLUBS).join("|")}> --owner <username> [--confirm-production]`,
  );
  process.exit(1);
}
const isLocal = /@(127\.0\.0\.1|localhost):15432\//.test(process.env.DATABASE_URL || "");
if (!isLocal && !args.includes("--confirm-production")) {
  console.error("REFUSING: DATABASE_URL is not the local test database. Add --confirm-production.");
  process.exit(1);
}

const prisma = new PrismaClient();

/** Offset in ms of `tz` from UTC at instant `t`. */
function tzOffset(t: number, tz: string): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(new Date(t))
      .map((x) => [x.type, x.value]),
  );
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - t;
}

/** The UTC instant of a wall-clock time in `tz` (correct across DST changes). */
function zonedToUtc(y: number, m: number, d: number, hh: number, mm: number, tz: string): Date {
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const first = guess - tzOffset(guess, tz);
  return new Date(guess - tzOffset(first, tz));
}

/** Today's calendar date in `tz` as [y, m, d, weekday]. */
function todayIn(tz: string): [number, number, number, number] {
  const now = Date.now();
  const local = new Date(now + tzOffset(now, tz));
  return [local.getUTCFullYear(), local.getUTCMonth() + 1, local.getUTCDate(), local.getUTCDay()];
}

const ROOMS = [
  {
    key: "clubhouse",
    name: "Clubhouse",
    description: "Chat between sessions: partners wanted, results, news.",
    minLevel: 0,
    defaultModule: null as string | null,
    voiceMode: "OPEN" as const,
  },
  {
    key: "lessons",
    name: "Lesson Room",
    description: "Video for lessons. Share a screen to go through a hand together.",
    minLevel: 0,
    defaultModule: "video",
    voiceMode: "OPEN" as const,
  },
  {
    key: "postmortem",
    name: "Post-mortem",
    description: "After the game: go over the boards face to face.",
    minLevel: 0,
    defaultModule: "video",
    voiceMode: "OPEN" as const,
  },
  {
    key: "executive",
    name: "Executive",
    description: "The club executive's own room.",
    minLevel: 4,
    defaultModule: "video",
    voiceMode: "OPEN" as const,
  },
];

async function main() {
  const owner = await prisma.user.findUnique({ where: { usernameKey: ownerName } });
  if (!owner) throw new Error(`No user "${ownerName}".`);

  const branding = {
    name: club.name,
    description: club.description,
    moduleType: "FEED" as any,
    ownerId: owner.id,
    unlisted: true, // direct link only until the club takes it over
    pinned: false,
    accentColor: ACCENT,
    websiteUrl: club.websiteUrl,
    keywords: club.keywords,
    roleNames: ROLE_NAMES,
    enabledModules: ["voice", "video", "screen", "youtube"],
    // The Join card's list (max 5). The platform default talks about tournaments
    // and themes, which means nothing to a bridge club.
    memberPerks: [
      "Chat with the club between sessions",
      "Find a partner for the next game",
      "Video rooms for lessons and post-mortems",
      "The week's games on the calendar",
      "Club news, first",
    ],
  };
  const lobby = await prisma.lobby.upsert({
    where: { id: club.id },
    update: branding,
    create: { id: club.id, verified: true, ...branding },
  });
  await prisma.lobbyMember.upsert({
    where: { lobbyId_userId: { lobbyId: lobby.id, userId: owner.id } },
    update: { roleLevel: 5, role: "OWNER" },
    create: { lobbyId: lobby.id, userId: owner.id, name: owner.name, roleLevel: 5, role: "OWNER" },
  });

  for (const r of ROOMS) {
    const id = `${club.id}-${r.key}`;
    const data = {
      name: r.name,
      description: r.description,
      lobbyId: lobby.id,
      ownerId: owner.id,
      pinned: true,
      minLevel: r.minLevel,
      accentColor: ACCENT,
      defaultModule: r.defaultModule,
      voiceMode: r.voiceMode,
    };
    await prisma.room.upsert({
      where: { id },
      update: data,
      create: { id, locked: false, ...data },
    });
  }

  const [y, m, d, wd] = todayIn(club.timezone);
  const events: string[] = [];
  for (const s of club.sessions) {
    const [hh, mm] = s.time.split(":").map(Number);
    let ahead = (s.weekday - wd + 7) % 7;
    for (let w = 0; w < WEEKS; w++, ahead += 7) {
      const day = new Date(Date.UTC(y, m - 1, d + ahead));
      const startsAt = zonedToUtc(
        day.getUTCFullYear(),
        day.getUTCMonth() + 1,
        day.getUTCDate(),
        hh,
        mm,
        club.timezone,
      );
      if (startsAt.getTime() < Date.now()) continue;
      const id = `${club.id}-${day.toISOString().slice(0, 10)}-${s.key}`;
      const data = {
        title: s.title,
        description: `${s.about}\n\n${s.where}. Times from the club's website; check there for changes.`,
        category: "club_game",
        startsAt,
        endsAt: null,
        timezone: club.timezone,
        lobbyId: lobby.id,
        status: "PUBLISHED" as const,
        createdById: owner.id,
        createdByName: owner.name || ownerName,
      };
      await prisma.event.upsert({ where: { id }, update: data, create: { id, ...data } });
      events.push(`${id}  ${startsAt.toISOString()}`);
    }
  }

  const welcomeId = `${club.id}-welcome`;
  const welcome = {
    title: `Welcome to ${club.short} bridge online`,
    body: [
      `This is the club's home online. Games stay where they are: at the Veiner Centre, and on BBO or RealBridge when you play online.`,
      "",
      "- **Clubhouse:** chat between sessions. Partners wanted, results, news.",
      "- **Lesson Room:** video for lessons. Share a screen to go through a hand.",
      "- **Post-mortem:** after the game, go over the boards face to face.",
      "- **Events:** the week's sessions, so you know what's on.",
      "",
      "Free for the club. Questions: james@weered.ca.",
    ].join("\n"),
    category: "ANNOUNCEMENT" as const,
    lobbyId: lobby.id,
    authorId: owner.id,
    authorName: owner.name || "Weered",
    pinned: true,
    tags: ["welcome"],
  };
  await prisma.forumPost.upsert({
    where: { id: welcomeId },
    update: welcome,
    create: { id: welcomeId, ...welcome },
  });

  console.log(
    `lobby   /lobby/${club.id}   (unlisted, FEED) owner ${owner.name} (${ownerName}) at level 5`,
  );
  console.log(
    `rooms   ${ROOMS.map((r) => `${club.id}-${r.key}${r.minLevel ? ` [min ${r.minLevel}]` : ""}`).join(", ")}`,
  );
  console.log(
    `events  ${events.length}\n  ${events.sort((a, b) => a.slice(-24).localeCompare(b.slice(-24))).join("\n  ")}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
