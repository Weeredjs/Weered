// Notoriety (XP) action types — a MIRROR of the source-of-truth config in
// apps/api/src/index.ts (the `NOTORIETY_ACTIONS` Record). The parity test in
// apps/api/test/unit/notoriety.test.ts text-parses the API's keys + ranks and
// fails CI if this mirror drifts, so the two can't silently diverge again.

export const NOTORIETY_ACTIONS = [
  "BIO_COMPLETE",
  "FIRST_ROOM_HOSTED",
  "ROOM_25_USERS",
  "SUBREDDIT_LINKED",
  "DAILY_ACTIVE",
  "CHAT_MESSAGE",
  "ROOM_JOINED",
  "VOICE_JOINED",
  "CHALLENGE_COMPLETED",
  "FIRST_CHALLENGE",
  "CREW_CREATED",
  "CREW_JOINED",
  "FRIEND_ADDED",
  "LOBBY_CREATED",
  "AVATAR_SET",
  "BUNGIE_LINKED",
  "FIRST_FAKEOUT_TRADE",
  "FAKEOUT_TRADE",
  "FAKEOUT_PROFIT",
  "LFG_COMPLETED",
] as const;

export type NotorietyAction = (typeof NOTORIETY_ACTIONS)[number];

/** Notoriety rank titles (cosmetic only — does NOT affect paid tier). */
export const NOTORIETY_RANKS = [
  { title: "Street Rat",  min: 0     },
  { title: "Corner Boy",  min: 100   },
  { title: "Hustler",     min: 300   },
  { title: "Shot Caller", min: 500   },
  { title: "Enforcer",    min: 1000  },
  { title: "Made Man",    min: 1500  },
  { title: "Underboss",   min: 3000  },
  { title: "Crime Lord",  min: 5000  },
  { title: "Kingpin",     min: 10000 },
] as const;

export type NotorietyRank = (typeof NOTORIETY_RANKS)[number]["title"];
