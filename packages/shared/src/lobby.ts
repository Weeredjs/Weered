// Lobby + Room types. Source of truth: apps/api/src/index.ts.

export type ModuleType =
  | "NONE"
  | "FEED"
  | "RIOT"       // League of Legends
  | "FORTNITE"
  | "BUNGIE"     // Destiny 2
  | "PUBG"
  | "MLB"
  | "PGA"
  | "WINDROSE"   // Age of Piracy
  | "POKER"
  | "TRADING"    // FakeOut paper trading
  | "CS2"
  | "DOTA2"
  | "POE"        // Path of Exile
  | "MARATHON"
  | "DND"        // Dungeons & Dragons
  | "STUDY"
  | "HEADQUARTERS"
  | "CUSTOM";

export type JoinMode = "OPEN" | "REQUEST" | "INVITE";

export interface Lobby {
  id: string;
  name: string;
  description: string | null;
  verified: boolean;
  pinned: boolean;
  moduleType: ModuleType | string | null;
  accentColor: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  onlineCount: number;
  joinMode?: JoinMode;
  _count?: { rooms: number; members: number };
}

export interface LobbiesResponse {
  ok: boolean;
  lobbies: Lobby[];
}

export interface Room {
  id: string;
  name: string;
  description: string | null;
  locked: boolean;
  pinned: boolean;
  isEvent: boolean;
  ownerId: string;
  lobbyId?: string;
  onlineCount: number;
  onlineUsers: { id: string; name: string; avatar?: string }[];
  _count: { members: number };
}

export interface RoomsResponse {
  ok: boolean;
  rooms: Room[];
}

export interface LobbyMembership {
  role: string;
  roleLevel: number;
}

export interface JoinRequest {
  status: "PENDING" | "APPROVED" | "DENIED";
  denyReason?: string | null;
}

export interface LobbyDetailResponse {
  ok: boolean;
  lobby: Lobby & { rooms: Room[]; joinMode?: JoinMode };
  membership: LobbyMembership | null;
  joinRequest: JoinRequest | null;
}

/** /lobbies/search response — pinned lobbies + matching rooms. */
export interface LobbySearchResponse {
  ok: boolean;
  pinned: (Lobby & { websiteUrl?: string | null })[];
  rooms: {
    id: string;
    name: string;
    locked: boolean;
    lobbyId: string;
    lobby: Pick<Lobby, "id" | "name" | "accentColor" | "logoUrl">;
    _count: { members: number };
  }[];
}
