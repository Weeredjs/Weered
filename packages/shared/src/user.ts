// Shared user + profile types used by web, mobile, desktop clients.
// Must stay in sync with API response shapes (apps/api/src/index.ts).

export type GlobalRole = "USER" | "GOD" | "ADMIN" | "STAFF" | "SUPPORT" | "MOD" | "OWNER" | "MEMBER";

export type Tier = "INNOCENT" | "INDICTED" | "FELON" | "KINGPIN";

/** Base user shape as returned from most API endpoints. */
export interface User {
  id: string;
  name: string;
  avatar?: string | null;
  avatarColor?: string | null;
  globalRole?: GlobalRole | null;
  tier?: Tier | null;
  banned?: boolean;
}

/** Full profile as returned by /profile/:id — includes stats + linked platforms. */
export interface Profile extends User {
  bio?: string | null;
  notoriety?: number;
  notorietyRank?: number | null;
  joinedAt?: string | null;
  lastSeen?: string | null;
  roomsHosted?: number;
  steamId?: string | null;
  twitchLogin?: string | null;
  xboxGamertag?: string | null;
  gameAccounts?: { platform: string; handle: string }[];
}

/** Live presence from Steam/Twitch/Xbox integration. */
export type LivePresenceSource = "STEAM" | "TWITCH" | "XBOX";

export interface LivePresence {
  source: LivePresenceSource;
  activity: string;
  detail?: string | null;
  url?: string | null;
  viewers?: number | null;
  updatedAt?: string;
}
