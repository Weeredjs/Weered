import { ModuleType } from "@prisma/client";

// Seed data for the default lobbies + rooms (provisioned by seedLobbies()).
// Pure data — extracted from index.ts to shrink the entrypoint.

export const SEED_LOBBIES = [
  {
    id: "lobby",
    name: "The Lobby",
    description: "General hangout. Everyone starts here.",
    keywords: ["lobby", "general", "home"],
    moduleType: ModuleType.FEED,
    moduleConfig: { subreddit: "r/all" },
  },
  {
    id: "r/all",
    name: "r/all",
    description: "Reddit firehose. All topics welcome.",
    keywords: ["reddit", "all", "general"],
    moduleType: ModuleType.FEED,
    moduleConfig: { subreddit: "r/all" },
  },
  {
    id: "r/gaming",
    name: "r/gaming",
    description: "Gamers of all kinds.",
    keywords: ["reddit", "gaming", "games", "gamer"],
    moduleType: ModuleType.FEED,
    moduleConfig: { subreddit: "r/gaming" },
  },
  {
    id: "r/technology",
    name: "r/technology",
    description: "Tech news, discussion, builds.",
    keywords: ["reddit", "tech", "technology", "coding"],
    moduleType: ModuleType.FEED,
    moduleConfig: { subreddit: "r/technology" },
  },
  {
    id: "destiny2",
    name: "Destiny 2",
    description:
      "Guardians, raids, dungeons, Trials, Gambit, and the Traveler's Light. Live raid races, Bungie API loadouts, LFG for every activity. The unofficial Guardian hub.",
    keywords: [
      "destiny",
      "destiny2",
      "bungie",
      "guardian",
      "warlock",
      "titan",
      "hunter",
      "raid",
      "crucible",
      "gambit",
      "trials",
      "iron banner",
      "nightfall",
      "dungeon",
    ],
    moduleType: ModuleType.BUNGIE,
    moduleConfig: { subreddits: ["r/DestinyTheGame", "r/destiny2"], steamAppId: "1085660" },
    accentColor: "#f58220",
    logoUrl: "/brand/lobbies/destiny2-logo.png",
    bannerUrl: "/brand/lobbies/destiny2-banner.svg",
    websiteUrl: "https://www.bungie.net",
  },
  {
    id: "news",
    name: "News",
    description: "Breaking news and headlines from around the world. CBC, BBC, Reuters, and more.",
    keywords: [
      "news",
      "breaking",
      "headlines",
      "world",
      "canada",
      "politics",
      "tech",
      "business",
      "science",
    ],
    moduleType: ModuleType.NEWS,
    moduleConfig: {},
    accentColor: "#DC2626",
  },
  {
    id: "fakeout",
    name: "FakeOut",
    description:
      "Paper trade crypto with fake money against real Binance prices. Live candlestick charts, instant orders, public leaderboards. All the thrill, none of the risk.",
    keywords: [
      "fakeout",
      "trading",
      "crypto",
      "bitcoin",
      "paper",
      "stocks",
      "market",
      "btc",
      "eth",
      "finance",
      "investing",
      "fake",
    ],
    moduleType: ModuleType.TRADING,
    moduleConfig: {},
    accentColor: "#F5C518",
  },
  {
    id: "dnd",
    name: "Dungeons & Dragons",
    description:
      "The Tavern. Find a party, roll dice, look up spells and monsters, and play at the table. Full SRD compendium, AI NPCs, initiative tracker, and community dice tower.",
    keywords: [
      "dnd",
      "dungeons",
      "dragons",
      "d&d",
      "tabletop",
      "ttrpg",
      "rpg",
      "5e",
      "dungeon master",
      "dm",
      "pathfinder",
      "dice",
      "d20",
      "campaign",
    ],
    moduleType: ModuleType.DND,
    moduleConfig: { twitchCategory: "Dungeons & Dragons" },
    accentColor: "#C4A55A",
    logoUrl: "/brand/lobbies/dnd-logo.png",
    bannerUrl: "/brand/lobbies/dnd-banner.png",
  },
  {
    id: "mtg",
    name: "Magic: The Gathering",
    description:
      "The kitchen table. Find a Commander pod tonight, brew jank decks, share cube lists, swap stories. Scryfall card lookup, Moxfield deck import, pod LFG for paper and online. Casual first.",
    keywords: [
      "mtg",
      "magic",
      "magic the gathering",
      "mtga",
      "mtgo",
      "commander",
      "edh",
      "modern",
      "standard",
      "pioneer",
      "legacy",
      "vintage",
      "pauper",
      "cube",
      "draft",
      "deck",
      "deckbuilder",
      "scryfall",
      "moxfield",
    ],
    moduleType: ModuleType.MTG,
    moduleConfig: { twitchCategory: "Magic: The Gathering" },
    accentColor: "#9C7C3F",
    logoUrl: "/brand/lobbies/mtg-logo.png",
  },
  {
    id: "poe",
    name: "Path of Exile",
    description:
      "Wraeclast awaits. Live economy dashboard powered by poe.ninja, currency trends, item prices, div cards, gem values, and party finder.",
    keywords: [
      "poe",
      "path of exile",
      "exile",
      "wraeclast",
      "arpg",
      "grinding gear",
      "ggg",
      "currency",
      "divine",
      "chaos",
      "mirror",
      "mapping",
      "builds",
    ],
    moduleType: ModuleType.POE,
    moduleConfig: { twitchCategory: "Path of Exile" },
    accentColor: "#AF6025",
    logoUrl: null,
    bannerUrl: null,
    websiteUrl: "https://www.pathofexile.com",
  },
  {
    id: "poe2",
    name: "Path of Exile 2",
    description:
      "Wraeclast, generations on. Live PoE2 economy, league ladder, the passive tree, party finder, and character linking. Currency prices, build talk, and LFG for the campaign and endgame. The unofficial exile hub for Path of Exile 2.",
    keywords: [
      "poe2",
      "path of exile 2",
      "poe 2",
      "exile",
      "wraeclast",
      "arpg",
      "grinding gear",
      "ggg",
      "runes of aldur",
      "exalted",
      "divine",
      "endgame",
      "atlas",
      "builds",
      "trials",
    ],
    moduleType: ModuleType.POE2,
    moduleConfig: { twitchCategory: "Path of Exile 2", steamAppId: "2694490" },
    accentColor: "#c9a24a",
    logoUrl: null,
    bannerUrl: null,
    websiteUrl: "https://www.pathofexile2.com",
  },
  {
    id: "windrose",
    name: "Windrose",
    description:
      "Age of Piracy survival adventure by Kraken Express. Build, sail, survive. Live Steam player count, dev dispatches, Crew Finder, Captain's Log. The unofficial flagship hub.",
    keywords: [
      "windrose",
      "kraken",
      "kraken express",
      "pocketpair",
      "pirate",
      "pirates",
      "age of piracy",
      "survival",
      "souls-like",
      "crosswind",
      "naval",
      "sailing",
      "ship",
      "black flag",
      "co-op",
      "pve",
    ],
    moduleType: ModuleType.WINDROSE,
    moduleConfig: {
      twitchCategory: "Windrose",
      steamAppId: "3041230",
      publisher: "Pocketpair",
      studio: "Kraken Express",
    },
    accentColor: "#b8935a",
    logoUrl: "/brand/lobbies/windrose-logo-official.png",
    bannerUrl: "/brand/lobbies/windrose-banner-v2.svg",
    websiteUrl: "https://playwindrose.com/",
  },
  {
    id: "hq",
    name: "Headquarters",
    description:
      "Weered HQ. Reception, Builders Bench, Newcomers, Changelog. Where the platform itself lives.",
    keywords: ["hq", "headquarters", "weered", "meta"],
    moduleType: ModuleType.HEADQUARTERS,
    moduleConfig: {},
    accentColor: "#5800E5",
  },
  {
    id: "helldivers2",
    name: "Helldivers 2",
    description:
      "Spread Managed Democracy across the galaxy. Live war map, Major Orders, defense campaigns, dispatches, squad finder, loadout sharer. The unofficial Super Earth war room.",
    keywords: [
      "helldivers",
      "helldivers2",
      "hd2",
      "democracy",
      "arrowhead",
      "super earth",
      "terminids",
      "automatons",
      "illuminate",
      "stratagem",
      "galactic war",
      "managed democracy",
    ],
    moduleType: ModuleType.HELLDIVERS2,
    moduleConfig: {
      twitchCategory: "Helldivers 2",
      subreddit: "r/Helldivers",
      steamAppId: "553850",
    },
    accentColor: "#FFD700",
    logoUrl: "/brand/lobbies/helldivers2-logo.png",
    bannerUrl: "/brand/lobbies/helldivers2-banner.png",
    websiteUrl: "https://www.helldivers.com",
  },
  {
    id: "cowork",
    name: "Co-Work",
    description:
      "The lobby for people who work for themselves, by themselves. Solo founders, freelancers, consultants, one-person companies. Working alone is the deal you made. Nobody said you had to sit in an empty room. Co-Work runs on presence: clock in on The Floor and see who else is at it right now, join the synchronized focus sprint that runs at the top of every hour (50 minutes of deep work, 10 of break, everyone on the same clock), put your intentions on the Day Board and check them off where people can see. Deep Work is a listen-only room built for body doubling: cameras optional, mics stay off, the quiet company of other people getting things done. The Watercooler is where the break happens. There is no performative hustle here and nobody is growth-hacking you. It is other people who also chose to work for themselves, at work.",
    keywords: [
      "cowork",
      "coworking",
      "body doubling",
      "solo founder",
      "freelancer",
      "indie hacker",
      "entrepreneur",
      "deep work",
      "focus",
      "accountability",
    ],
    moduleType: ModuleType.COWORK,
    moduleConfig: {},
    accentColor: "#7FA89B",
  },
  {
    id: "hll",
    name: "Hell Let Loose",
    description:
      "The 50v50 WWII platoon shooter where the map is won by squads that talk. Weered's Hell Let Loose lobby is built around the thing that actually decides whether you play tonight: the servers. A live server browser with population, current map and region for every community server on the front; a seeding rally board that pings the lobby when a server needs bodies to get from empty to the 40 players where the game comes alive, with live fill tracking so you can watch the push work; an artillery calculator with the real ballistics for the US 155, German 150, Soviet 122 and British 25-pounder; and dispatches straight from the front. Community servers are the backbone of HLL, and seeding them is the hardest job in the game. This lobby exists to make that a coordinated operation instead of a prayer.",
    keywords: [
      "hll",
      "hell let loose",
      "ww2",
      "wwii",
      "fps",
      "milsim",
      "seeding",
      "artillery",
      "squad",
      "team17",
    ],
    moduleType: ModuleType.HLL,
    moduleConfig: { steamAppId: 686810 },
    accentColor: "#BFA46F",
    websiteUrl: "https://www.hellletloose.com",
  },
  {
    id: "eve",
    name: "EVE Online",
    description:
      "New Eden's capsuleer hub. Link your character with CCP's official ESI for live location, ship, skill training and killboard, plus character/corp lookup and a no-judgement New Pilots lounge for surviving your first 30 days. The unofficial newbro home.",
    keywords: [
      "eve",
      "eve online",
      "ccp",
      "capsuleer",
      "new eden",
      "newbro",
      "null sec",
      "nullsec",
      "wormhole",
      "mining",
      "industry",
      "pvp",
      "corp",
      "corporation",
      "alliance",
      "esi",
      " isk",
      "pilot",
    ],
    moduleType: ModuleType.EVE,
    moduleConfig: { twitchCategory: "EVE Online", subreddit: "r/Eve" },
    accentColor: "#d4af37",
    logoUrl: null,
    bannerUrl: null,
    websiteUrl: "https://www.eveonline.com",
  },
  {
    id: "gta6",
    name: "GTA 6",
    description:
      "The unofficial community hub for Grand Theft Auto VI. Find a crew, build a heist team, post LFG, run voice, and follow the news. Crew finder and player matchmaking for GTA 6 Online, where players actually link up.",
    keywords: [
      "gta6",
      "gta 6",
      "gta vi",
      "grand theft auto 6",
      "grand theft auto vi",
      "gta6 crew",
      "gta 6 crew finder",
      "gta 6 lfg",
      "find gta 6 players",
      "gta 6 community",
      "gta 6 online",
      "gta 6 heist team",
      "gta online",
      "vice city",
      "leonida",
      "rockstar",
    ],
    moduleType: ModuleType.FEED,
    moduleConfig: { subreddit: "r/GTA6" },
    accentColor: "#e84393",
  },
  {
    id: "assettocorsa",
    name: "Assetto Corsa",
    description:
      "The sim racing hub for Assetto Corsa. Live server board — who's on track, which circuit, what session, how long left — plus a race finder, setup talk, and the community's own servers. Bring your league; point the board at your servers and it runs itself.",
    keywords: [
      "assetto corsa",
      "assetto",
      "ac",
      "sim racing",
      "simracing",
      "racing",
      "kunos",
      "gt3",
      "content manager",
      "csp",
      "nordschleife",
      "spa",
      "monza",
      "hotlap",
      "league racing",
      "endurance",
    ],
    moduleType: ModuleType.ASSETTOCORSA,
    moduleConfig: {
      subreddit: "r/assettocorsa",
      twitchCategory: "Assetto Corsa",
      steamAppId: "244210",
      // The server board reads this list. Any community can point it at their
      // own servers; these are FastFox Racing's public ranked servers, which
      // publish the standard AC /INFO endpoint.
      acServers: [
        { host: "fastfox.racing", httpPort: 8084, label: "GT3 · Kunos NoDLC" },
        { host: "fastfox.racing", httpPort: 8092, label: "F1 · Kunos NoDLC" },
      ],
    },
    accentColor: "#e8452f",
    logoUrl: null,
    bannerUrl: null,
    websiteUrl: "https://www.assettocorsa.net",
  },
  // ---------------------------------------------------------------------------
  // FastFox Racing — UNLISTED client preview.
  //
  // Reachable only by direct link: absent from browse, search, the map and the
  // home dashboard (see Lobby.unlisted). Keywords are deliberately empty so it
  // cannot be found by searching either.
  //
  // The Server Board here is REAL — it polls FastFox's two public servers. The
  // Ranked / Recordes / Corridas Limpas tabs render SAMPLE data carried in
  // moduleConfig.demoData and are labelled as such in the UI, because FastFox's
  // real figures live in their own systems and we have not been given access.
  // Driver names in that sample are deliberately synthetic placeholders — real
  // drivers' names beside invented ratings would be a fabricated record about
  // identifiable people.
  // ---------------------------------------------------------------------------
  {
    id: "fastfox",
    name: "FastFox Racing",
    description:
      "Brasil · Sim racing · Assetto Corsa. Ranked leagues, lap records, and clean-racing standards — with the live server board showing who is on track right now.",
    keywords: [], // intentionally empty: unlisted lobbies are not searchable
    unlisted: true,
    moduleType: ModuleType.ASSETTOCORSA,
    moduleConfig: {
      twitchCategory: "Assetto Corsa",
      steamAppId: "244210",
      // FastFox's two PUBLIC servers. Their third (GT3 | Pro Ranked) is
      // members-only and its address is not published, so it is not listed here
      // — they can add it themselves from the admin panel.
      acServers: [
        { host: "fastfox.racing", httpPort: 8084, label: "GT3 · Kunos NoDLC" },
        { host: "fastfox.racing", httpPort: 8092, label: "F1 · Kunos NoDLC" },
      ],
      // Section names taken verbatim from fastfox.racing so the lobby speaks
      // the community's own vocabulary rather than ours.
      demoData: {
        sample: true,
        ranked: {
          title: "Ligas Rankeadas",
          season: "Temporada 2026 · GT3 Pro",
          columns: ["#", "Piloto", "Corridas", "Pódios", "Rating"],
          rows: [
            ["1", "Piloto 01", "24", "11", "2418"],
            ["2", "Piloto 02", "22", "9", "2377"],
            ["3", "Piloto 03", "26", "8", "2341"],
            ["4", "Piloto 04", "19", "6", "2290"],
            ["5", "Piloto 05", "21", "5", "2264"],
            ["6", "Piloto 06", "17", "4", "2231"],
            ["7", "Piloto 07", "23", "3", "2198"],
            ["8", "Piloto 08", "15", "2", "2170"],
          ],
        },
        records: {
          title: "Recordes e Histórico",
          columns: ["Circuito", "Carro", "Piloto", "Tempo"],
          rows: [
            ["Monza", "Ferrari 488 GT3", "Piloto 02", "1:47.412"],
            ["Spa-Francorchamps", "Porsche 911 GT3 R", "Piloto 01", "2:16.883"],
            ["Nürburgring GP", "Mercedes AMG GT3", "Piloto 04", "1:54.207"],
            ["Imola", "BMW M4 GT3", "Piloto 01", "1:41.559"],
            ["Vallelunga", "Audi R8 LMS", "Piloto 03", "1:32.914"],
          ],
        },
        clean: {
          title: "Corridas Limpas",
          blurb:
            "Clean-racing standards are what the community is actually built on. This is where a rating, an incident review and a Largada Segura record would live.",
          columns: ["Piloto", "Corridas", "Incidentes", "Índice"],
          rows: [
            ["Piloto 01", "24", "3", "99.1%"],
            ["Piloto 05", "21", "4", "98.4%"],
            ["Piloto 02", "22", "6", "97.8%"],
            ["Piloto 07", "23", "9", "96.2%"],
          ],
        },
      },
    },
    accentColor: "#fd751a",
    logoUrl: null,
    bannerUrl: null,
    websiteUrl: "https://fastfox.racing",
  },
  {
    id: "division2",
    name: "The Division 2",
    description:
      "The unofficial community hub for Tom Clancy's The Division 2. Find agents, build a raid team, run the Dark Zone, post LFG, run voice, and follow the news. Squad finder and matchmaking for the agents of D.C. and New York, where players actually link up.",
    keywords: [
      "division 2",
      "the division 2",
      "div2",
      "tom clancy",
      "tom clancy's the division 2",
      "division 2 lfg",
      "division 2 squad finder",
      "find division 2 players",
      "division 2 community",
      "dark zone",
      "warlords of new york",
      "shd",
      "agent",
      "raid",
      "dark hours",
      "iron horse",
      "massive entertainment",
      "ubisoft",
    ],
    moduleType: ModuleType.DIVISION2,
    moduleConfig: {
      subreddit: "r/thedivision",
      twitchCategory: "Tom Clancy's The Division 2",
      steamAppId: "2221490",
    },
    accentColor: "#f26b21",
    websiteUrl: "https://www.ubisoft.com/en-us/game/the-division/the-division-2",
  },
  {
    id: "league-of-legends",
    name: "League of Legends",
    description: "League of Legends community lobby. LFG for Solo/Duo, Flex, Clash, and ARAM.",
    keywords: [
      "league",
      "lol",
      "leagueoflegends",
      "riot",
      "moba",
      "ranked",
      "summoner",
      "champion",
    ],
    moduleType: ModuleType.RIOT,
    moduleConfig: { subreddit: "r/leagueoflegends", twitchCategory: "League of Legends" },
    accentColor: "#C89B3C",
  },
  {
    id: "mlb",
    name: "MLB",
    description: "America's pastime. Live scores, standings, stats, and streams.",
    keywords: [
      "mlb",
      "baseball",
      "yankees",
      "dodgers",
      "mets",
      "astros",
      "braves",
      "phillies",
      "padres",
      "cubs",
      "redsox",
      "homerun",
    ],
    moduleType: ModuleType.MLB,
    moduleConfig: { subreddit: "r/baseball", twitchCategory: "MLB The Show 25" },
    accentColor: "#C41E3A",
  },
  {
    id: "counter-strike-2",
    name: "Counter-Strike 2",
    description:
      "Counter-Strike 2 community lobby. 5-stack Premier/Competitive, Faceit, and demo review.",
    keywords: [
      "cs2",
      "counter-strike",
      "csgo",
      "valve",
      "fps",
      "competitive",
      "premier",
      "faceit",
      "lfg",
    ],
    moduleType: ModuleType.CS2,
    moduleConfig: null,
    accentColor: "#DE9B35",
  },
  {
    id: "pubg",
    name: "PUBG: Battlegrounds",
    description:
      "PUBG: Battlegrounds community lobby. Squad and duo finding, custom matches, and scrims.",
    keywords: ["pubg", "battlegrounds", "battleroyale", "fps", "squad", "lfg"],
    moduleType: ModuleType.PUBG,
    moduleConfig: { subreddit: "r/PUBATTLEGROUNDS", twitchCategory: "PUBG: Battlegrounds" },
    accentColor: "#FFAA00",
  },
  {
    id: "fortnite",
    name: "Fortnite",
    description: "Fortnite community lobby. Squads, tournaments, item shop, and stats.",
    keywords: ["fortnite", "epic", "battleroyale", "fortnitebr", "fn"],
    moduleType: ModuleType.FORTNITE,
    moduleConfig: { subreddit: "r/FortNiteBR", twitchCategory: "Fortnite" },
    accentColor: "#5798D4",
  },
  {
    id: "dota-2",
    name: "Dota 2",
    description: "Dota 2 community lobby. Ranked stacks, MMR tracking, and LFG.",
    keywords: ["dota2", "dota", "valve", "moba", "ranked", "mmr", "lfg", "stack"],
    moduleType: ModuleType.DOTA2,
    moduleConfig: null,
    accentColor: "#C23C2A",
  },
];

export const SEED_ROOMS: {
  id: string;
  name: string;
  description: string;
  lobbyId: string;
  defaultModule?: string;
  voiceMode?: "OPEN" | "QUEUED" | "LISTEN_ONLY"; // bootstrap-only (create, never update)
}[] = [
  {
    id: "dnd-tavern",
    name: "The Tavern",
    description:
      "Pull up a chair. General voice & chat for adventurers, DMs, and spectators alike.",
    lobbyId: "dnd",
  },
  {
    id: "dnd-table",
    name: "Campaign Table",
    description:
      "Open play table: roll initiative, share maps, run encounters. Bring your character sheet.",
    lobbyId: "dnd",
  },
  {
    id: "dnd-workshop",
    name: "DM's Workshop",
    description: "Behind the screen. Prep sessions, world-building tips, and DM war stories.",
    lobbyId: "dnd",
  },
  {
    id: "dnd-forge",
    name: "Character Forge",
    description: "Build, theorycraft, and show off your characters. Multiclass debates welcome.",
    lobbyId: "dnd",
  },

  {
    id: "windrose-helm",
    name: "The Helm",
    description: "General chat for all sailors. Trade tips, brag about storms, talk shop.",
    lobbyId: "windrose",
  },
  {
    id: "windrose-crew",
    name: "Crew Finder",
    description: "Looking for 3 for a raid? Need a first mate? Post your flag here.",
    lobbyId: "windrose",
  },
  {
    id: "windrose-captains",
    name: "Captain's Table",
    description: "Voice strategy, PvE routes, soulslite boss tactics, and fleet tactics.",
    lobbyId: "windrose",
  },
  {
    id: "windrose-tradingpost",
    name: "Trading Post",
    description: "Barter loot, swap maps, and haggle over spoils. No scams, savvy?",
    lobbyId: "windrose",
  },
  {
    id: "windrose-log",
    name: "Captain's Log",
    description: "Screenshots, clips, and stories from the open sea. Drop your best shot.",
    lobbyId: "windrose",
  },
  {
    id: "windrose-bug-hunters",
    name: "Bug Hunters",
    description: "Repro steps, workarounds, and friendly noise aimed at Kraken Express.",
    lobbyId: "windrose",
  },

  {
    id: "destiny2-tower",
    name: "The Tower",
    description: "General Guardian gathering. Loadouts, roll talk, gunsmith chatter, all welcome.",
    lobbyId: "destiny2",
  },
  {
    id: "destiny2-lfg-raids",
    name: "LFG · Raids",
    description:
      "Looking for fireteams for current and lore raids. Post role, encounter, platform.",
    lobbyId: "destiny2",
  },
  {
    id: "destiny2-lfg-dungeons",
    name: "LFG · Dungeons",
    description:
      "Dungeon fireteam finder. Solo flawless attempts welcome to post pre-run planning.",
    lobbyId: "destiny2",
  },
  {
    id: "destiny2-crucible",
    name: "Crucible",
    description: "PvP. Trials cards, Comp climbs, Iron Banner lamentations. Pros and scrubs alike.",
    lobbyId: "destiny2",
  },
  {
    id: "destiny2-vanguard",
    name: "Vanguard Intel",
    description:
      "PvE strats. Nightfalls, Onslaught, Exotic Missions. Build-crafting and rotation talk.",
    lobbyId: "destiny2",
  },
  {
    id: "destiny2-gambit",
    name: "Gambit Hall",
    description: "Gambit is still here. Bank motes, invade, have opinions.",
    lobbyId: "destiny2",
  },
  {
    id: "destiny2-gjallarhorn",
    name: "Gjallarhorn Wing",
    description: "Lore, theorycrafting, patch speculation. Any and all non-fireteam discourse.",
    lobbyId: "destiny2",
  },
  {
    id: "destiny2-clip-vault",
    name: "Clip Vault",
    description: "Best plays, worst deaths, most cursed loadouts. Post the shot.",
    lobbyId: "destiny2",
  },

  {
    id: "fakeout-floor",
    name: "The Floor",
    description:
      "Main trading chat. Live charts, live trades, live witnesses. Where everyone hangs.",
    lobbyId: "fakeout",
    defaultModule: "fakeout",
  },
  {
    id: "fakeout-pit",
    name: "The Pit",
    description: "Hot takes, rapid-fire reactions, daily watchlists. Bring volume.",
    lobbyId: "fakeout",
    defaultModule: "fakeout",
  },
  {
    id: "fakeout-newcomers",
    name: "Newcomers",
    description:
      "First time? Start here. Ask anything. Read The Brief. Place your first paper trade with company.",
    lobbyId: "fakeout",
  },

  {
    id: "mtg-library",
    name: "The Library",
    description:
      "General chat for planeswalkers. Decks, meta, salt, and 'is this combo good' debates.",
    lobbyId: "mtg",
  },
  {
    id: "mtg-commander",
    name: "Commander Tables",
    description:
      "Find a Commander pod tonight. Paper, Spelltable, or MTGO. Post your power level, format, and table type.",
    lobbyId: "mtg",
  },
  {
    id: "mtg-brew",
    name: "Brew Lab",
    description:
      "Decklists and theorycraft. Drop a Moxfield link, get feedback. Jank welcome, optimization optional.",
    lobbyId: "mtg",
  },
  {
    id: "mtg-cube",
    name: "The Cube",
    description:
      "Drafting and cube curation. Pod-up for online drafts or share your latest 540-card list.",
    lobbyId: "mtg",
  },
  {
    id: "mtg-going-first",
    name: "Going First",
    description:
      "60-card formats. Modern, Pioneer, Standard, Legacy. Tournament prep, meta reads, sideboard talk.",
    lobbyId: "mtg",
  },

  {
    id: "poe-wraeclast",
    name: "Wraeclast",
    description:
      "General PoE chat. League talk, patch reactions, and the eternal 'is this build dead' discourse.",
    lobbyId: "poe",
  },
  {
    id: "poe-trade",
    name: "Trade Hall",
    description: "Buy, sell, price-check. Currency, items, bulk. Post your shop, no scams.",
    lobbyId: "poe",
  },
  {
    id: "poe-builds",
    name: "Build Lab",
    description:
      "Theorycraft and PoB pastebins. League-starter debates and min-max math. Bring receipts.",
    lobbyId: "poe",
  },
  {
    id: "poe-atlas",
    name: "The Atlas",
    description:
      "Mapping strategy, Atlas trees, juicing, scarabs and sextants. Share your farming setup.",
    lobbyId: "poe",
  },
  {
    id: "poe-bosses",
    name: "Boss Lounge",
    description: "Pinnacle carries, deathless attempts, Uber strats. Mageblood not required.",
    lobbyId: "poe",
  },
  {
    id: "poe-leaguestart",
    name: "League Start",
    description:
      "Fresh economy chaos. Day-1 plans, leveling routes, first-target farming. Race the curve.",
    lobbyId: "poe",
  },

  {
    id: "poe2-wraeclast",
    name: "Wraeclast",
    description:
      "General Path of Exile 2 chat. Campaign, endgame, patch talk, and the 'is my build cooked' discourse.",
    lobbyId: "poe2",
  },
  {
    id: "poe2-trade",
    name: "Trade Hall",
    description: "Buy, sell, price-check PoE2. Currency, gear, runes. Post your shop, no scams.",
    lobbyId: "poe2",
  },
  {
    id: "poe2-builds",
    name: "Build Lab",
    description:
      "Theorycraft PoE2 builds, skill gems, and passive trees. League-starter debates welcome.",
    lobbyId: "poe2",
  },
  {
    id: "poe2-endgame",
    name: "Atlas & Endgame",
    description: "Maps, pinnacle bosses, towers, and endgame farming strategy for Path of Exile 2.",
    lobbyId: "poe2",
  },
  {
    id: "poe2-bosses",
    name: "Boss Lounge",
    description: "Pinnacle carries, deathless runs, and boss strats. Share the fight.",
    lobbyId: "poe2",
  },
  {
    id: "poe2-leaguestart",
    name: "League Start",
    description: "Fresh economy chaos. Day-1 plans, leveling routes, and first-target farming.",
    lobbyId: "poe2",
  },

  {
    id: "league-rift",
    name: "Summoner's Rift",
    description:
      "General League chat. Champion talk, patch hot takes, the eternal Yasuo discourse.",
    lobbyId: "league-of-legends",
  },
  {
    id: "league-lfg-ranked",
    name: "LFG · Ranked",
    description: "Find a duo for Solo/Duo. Roles played, current rank, server in your post.",
    lobbyId: "league-of-legends",
  },
  {
    id: "league-lfg-flex",
    name: "LFG · Flex / Clash",
    description: "Five-stacks for Flex queue and Clash weekends. Bring friends or steal some.",
    lobbyId: "league-of-legends",
  },
  {
    id: "league-aram",
    name: "ARAM Den",
    description:
      "For when you can't be bothered with macro. Reroll talk, snowball strats, just bonk.",
    lobbyId: "league-of-legends",
  },
  {
    id: "league-lab",
    name: "Champion Lab",
    description: "Theorycraft, off-meta builds, runes that shouldn't work but do. Bring receipts.",
    lobbyId: "league-of-legends",
  },

  {
    id: "cs2-lobby",
    name: "The Lobby",
    description: "General CS2 chat. Patch reactions, meta talk, complaints about the M4. Welcome.",
    lobbyId: "counter-strike-2",
  },
  {
    id: "cs2-lfg-premier",
    name: "LFG · Premier",
    description: "Premier queue partners. Post your CS rating + map preferences.",
    lobbyId: "counter-strike-2",
  },
  {
    id: "cs2-lfg-faceit",
    name: "LFG · FACEIT",
    description: "FACEIT lobbies. Level + region in post. No ELO snobbery.",
    lobbyId: "counter-strike-2",
  },
  {
    id: "cs2-aim",
    name: "Aim Training Grounds",
    description: "Routines, aim_botz, Kovaak's, Aim Lab. Share your warmup and your gains.",
    lobbyId: "counter-strike-2",
  },
  {
    id: "cs2-demo",
    name: "Demo Theater",
    description: "Clip review. Drop your demos, get crispy callouts back. Tactical or just funny.",
    lobbyId: "counter-strike-2",
  },

  {
    id: "dota-ancient",
    name: "The Ancient",
    description: "General Dota chat. Patches, Pudge complaints, eternal Aghanim's discourse.",
    lobbyId: "dota-2",
  },
  {
    id: "dota-lfg-ranked",
    name: "LFG · Ranked",
    description: "Stack up. Post your MMR, role queue, region.",
    lobbyId: "dota-2",
  },
  {
    id: "dota-lfg-turbo",
    name: "LFG · Turbo",
    description: "Quick games, low commitment. Just queue and click heads.",
    lobbyId: "dota-2",
  },
  {
    id: "dota-lab",
    name: "Hero Lab",
    description:
      "Off-meta builds, position 5 carry, the eternal Tinker question. Theorycraft welcome.",
    lobbyId: "dota-2",
  },
  {
    id: "dota-fountain",
    name: "Fountain Hooks",
    description: "Best plays, worst feeders, salt mine. Drop your clips.",
    lobbyId: "dota-2",
  },

  {
    id: "pubg-zone",
    name: "Drop Zone",
    description:
      "General PUBG chat. Map rotations, the eternal Pochinki nostalgia, server complaints.",
    lobbyId: "pubg",
  },
  {
    id: "pubg-lfg-squad",
    name: "LFG · Squads",
    description: "Find your fourth. Server, map preference, voice required in post.",
    lobbyId: "pubg",
  },
  {
    id: "pubg-lfg-duo",
    name: "LFG · Duos",
    description: "Two-stacks. Less bickering, more headshots.",
    lobbyId: "pubg",
  },
  {
    id: "pubg-loot",
    name: "Loot Pool",
    description: "Hot drop strategies, vehicle meta, gear talk. From M4 to Mosin.",
    lobbyId: "pubg",
  },
  {
    id: "pubg-vault",
    name: "Clip Vault",
    description: "Best plays, worst luck, last circle stories. Post the shot.",
    lobbyId: "pubg",
  },

  {
    id: "mlb-dugout",
    name: "The Dugout",
    description: "General baseball chat. Standings, trade rumors, the eternal Yankees discourse.",
    lobbyId: "mlb",
  },
  {
    id: "mlb-gameday",
    name: "Game Day Threads",
    description: "Live threads for whatever's on right now. Pitch by pitch, inning by inning.",
    lobbyId: "mlb",
  },
  {
    id: "mlb-stats",
    name: "Sabermetrics",
    description: "WAR, FIP, xwOBA. Numbers people. Bring a CSV.",
    lobbyId: "mlb",
  },
  {
    id: "mlb-trade",
    name: "Trade Talk",
    description: "Rumors, deadlines, hot stove takes. Speculation welcome, math appreciated.",
    lobbyId: "mlb",
  },
  {
    id: "mlb-prospects",
    name: "Prospect Watch",
    description: "Minor leagues, draft talk, future stars. Who's coming up next.",
    lobbyId: "mlb",
  },

  {
    id: "fortnite-island",
    name: "The Island",
    description:
      "General Fortnite chat. Skin drops, map updates, the eternal sweat-vs-casual debate.",
    lobbyId: "fortnite",
  },
  {
    id: "fortnite-lfg-squads",
    name: "LFG · Squads",
    description: "Build squads. Drop region + style (BR / ZB / Reload).",
    lobbyId: "fortnite",
  },
  {
    id: "fortnite-lfg-zb",
    name: "LFG · Zero Build",
    description: "For the no-build lifers. Pure aim, pure cover, pure pain.",
    lobbyId: "fortnite",
  },
  {
    id: "fortnite-comp",
    name: "Comp Corner",
    description: "FNCS, cash cups, scrim discussion. Loadout debates, zone reads.",
    lobbyId: "fortnite",
  },
  {
    id: "fortnite-creative",
    name: "Creative Lobby",
    description: "Map codes, parkour, deathruns, mini-games. Post your favorites.",
    lobbyId: "fortnite",
  },

  {
    id: "gta6-strip",
    name: "The Strip",
    description:
      "General GTA 6 chat. News, leaks, hype, Vice City speculation. Everyone starts here.",
    lobbyId: "gta6",
  },
  {
    id: "gta6-crew-finder",
    name: "Crew Finder",
    description:
      "Find a GTA 6 crew or recruit members. Post your crew, your platform, and your playstyle.",
    lobbyId: "gta6",
  },
  {
    id: "gta6-lfg",
    name: "LFG · Find Players",
    description:
      "Looking for GTA 6 players to run with. Post platform, region, mic, and what you're grinding.",
    lobbyId: "gta6",
  },
  {
    id: "gta6-heists",
    name: "Heist Team",
    description:
      "Build a heist crew. Coordinate roles, set up, and find a reliable team for GTA 6 Online jobs.",
    lobbyId: "gta6",
  },
  {
    id: "gta6-news",
    name: "News & Leaks",
    description:
      "Trailers, official drops, dataminer leaks, release-date watch. Sort the real from the fake.",
    lobbyId: "gta6",
  },
  {
    id: "gta6-clips",
    name: "Clip Vault",
    description: "Best plays, funniest deaths, cinematic shots. Post the clip.",
    lobbyId: "gta6",
  },

  // FastFox Racing (unlisted client preview). Room names use the community's
  // own vocabulary, taken from fastfox.racing.
  {
    id: "ff-paddock",
    name: "Paddock",
    description:
      "General FastFox chat. Servers, mods, wheel settings, and what happened in turn one.",
    lobbyId: "fastfox",
  },
  {
    id: "ff-ranked",
    name: "Ligas Rankeadas",
    description: "Ranked league racing — standings, promotions, and race-night sign-ups.",
    lobbyId: "fastfox",
  },
  {
    id: "ff-recordes",
    name: "Recordes e Histórico",
    description: "Lap records and race history. Post the lap, post the replay.",
    lobbyId: "fastfox",
  },
  {
    id: "ff-corridas-limpas",
    name: "Corridas Limpas",
    description:
      "Incident review and clean-racing standards. Stewards' inquiries and Largada Segura reports.",
    lobbyId: "fastfox",
  },
  {
    id: "ff-setups",
    name: "Setups & Telemetria",
    description: "Share setups, compare telemetry, argue about diff settings and tyre pressures.",
    lobbyId: "fastfox",
  },
  {
    id: "ff-pitwall",
    name: "Pit Wall",
    description: "Voice for race nights — spotting, strategy, and the post-race stewards' inquiry.",
    lobbyId: "fastfox",
  },
  {
    id: "ac-paddock",
    name: "The Paddock",
    description:
      "General Assetto Corsa chat. Servers, mods, CSP, wheel settings, and what went wrong in turn one.",
    lobbyId: "assettocorsa",
  },
  {
    id: "ac-race-finder",
    name: "Race Finder",
    description:
      "Looking for a race. Post the server, class, and time — or jump on whatever's live on the board.",
    lobbyId: "assettocorsa",
  },
  {
    id: "ac-setups",
    name: "Setups & Telemetry",
    description: "Share setups, compare telemetry, argue about diff settings and tyre pressures.",
    lobbyId: "assettocorsa",
  },
  {
    id: "ac-leagues",
    name: "Leagues & Events",
    description: "League seasons, endurance events, sign-ups, and race control notices.",
    lobbyId: "assettocorsa",
  },
  {
    id: "ac-hotlaps",
    name: "Hotlap Hall",
    description: "Post your lap, get told it was a cut. Track records and replay links.",
    lobbyId: "assettocorsa",
  },
  {
    id: "ac-pitwall",
    name: "Pit Wall",
    description: "Voice for race nights — spotting, strategy, and the post-race stewards' inquiry.",
    lobbyId: "assettocorsa",
  },

  {
    id: "division2-basecamp",
    name: "Base of Operations",
    description:
      "General Division 2 chat. News, builds, patch talk, war stories. Everyone starts here.",
    lobbyId: "division2",
  },
  {
    id: "division2-lfg",
    name: "LFG · Find Agents",
    description:
      "Looking for agents to run with. Post platform, region, mic, and what you're farming.",
    lobbyId: "division2",
  },
  {
    id: "division2-raids",
    name: "Raid Team",
    description:
      "Build an 8-agent raid team for Dark Hours or Iron Horse. Coordinate roles, gear, and time.",
    lobbyId: "division2",
  },
  {
    id: "division2-darkzone",
    name: "Dark Zone",
    description:
      "Rogue up or go manhunt. Find a DZ crew, talk extraction, and settle the eternal rogue debate.",
    lobbyId: "division2",
  },
  {
    id: "division2-builds",
    name: "Builds & Gear",
    description: "Share loadouts, talent combos, and god-roll chases. Min-max the SHD tech.",
    lobbyId: "division2",
  },
  {
    id: "division2-news",
    name: "News & Patch Notes",
    description:
      "State of the Game, title updates, seasons, and PTS. Sort the real from the datamined.",
    lobbyId: "division2",
  },

  {
    id: "hq-reception",
    name: "Reception",
    description: "Welcome to Weered HQ. Platform questions, intros, hi.",
    lobbyId: "hq",
  },
  {
    id: "hq-feedback",
    name: "Builder's Bench",
    description: "Feature requests, bug reports, why-doesn't-it-do-X. The dev team reads this.",
    lobbyId: "hq",
  },
  {
    id: "hq-newcomers",
    name: "Newcomers",
    description: "First time on Weered? Start here. Ask anything, no judgment.",
    lobbyId: "hq",
  },
  {
    id: "hq-changelog",
    name: "Changelog",
    description: "What just shipped, what's brewing. Read-only-ish announcements.",
    lobbyId: "hq",
  },
  {
    id: "hq-offtopic",
    name: "Off Topic",
    description: "Whatever isn't about Weered itself. Lowkey vibes, weekend chat.",
    lobbyId: "hq",
  },

  {
    id: "cowork-floor",
    name: "The Floor",
    description:
      "The open office. Say what you're working on, ask the room, think out loud. Main chat for everyone clocked in.",
    lobbyId: "cowork",
  },
  {
    id: "cowork-deepwork",
    name: "Deep Work",
    description:
      "Body doubling, enforced. Listen-only voice: cameras optional, mics stay off. Sit down where people can see you working and get it done.",
    lobbyId: "cowork",
    voiceMode: "LISTEN_ONLY",
  },
  {
    id: "cowork-watercooler",
    name: "The Watercooler",
    description:
      "Where the break goes. Open voice between sprints, for talking shop and complaining about invoices. Be a person for ten minutes.",
    lobbyId: "cowork",
  },
  {
    id: "cowork-standup",
    name: "Standup",
    description:
      "Post your day: what you're shipping, what's blocking you, what you finished yesterday. Async, no meetings.",
    lobbyId: "cowork",
  },

  {
    id: "hll-command-post",
    name: "The Command Post",
    description:
      "Main voice & chat for the front. War stories, match talk, and finding a squad for tonight.",
    lobbyId: "hll",
  },
  {
    id: "hll-seeding-ops",
    name: "Seeding Ops",
    description:
      "The rally line. Call your server and watch the fill bar climb. Every body counts below 40.",
    lobbyId: "hll",
  },
  {
    id: "hll-enlistment",
    name: "Enlistment Office",
    description:
      "Unit recruitment. Post your outfit, your server, your schedule, and what kind of soldiers you need.",
    lobbyId: "hll",
  },
  {
    id: "hll-range",
    name: "The Range",
    description:
      "Tactics school. Artillery math, garrison placement, armor lanes, officer comms. Teach and be taught.",
    lobbyId: "hll",
  },
];
