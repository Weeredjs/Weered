// The stage modules a room can show, which ones each kind of lobby offers,
// the everyday tools a lobby switches on and off, and the office rooms'
// wording for them. Split out of RoomCanvas.tsx, which builds a room's
// module list from these.
import type { StageMode } from "./RoomStage";

export const ALL_MODULES: {
  id: NonNullable<StageMode>;
  label: string;
  icon: string;
  live: boolean;
}[] = [
  { id: "voice", icon: "🎙", label: "Humans", live: true },
  { id: "youtube", icon: "__youtube__", label: "YouTube", live: true },
  { id: "twitch", icon: "__twitch__", label: "Twitch", live: true },
  { id: "browser", icon: "🌐", label: "Browser", live: true },
  { id: "article", icon: "📰", label: "Article", live: true },
  { id: "screen", icon: "🖥", label: "Screen", live: true },
  { id: "poker", icon: "♦", label: "Poker", live: true },
  { id: "fakeout", icon: "📈", label: "FakeOut", live: true },
  { id: "destiny", icon: "⚔", label: "Destiny", live: true },
  { id: "league", icon: "🏆", label: "League", live: true },
  { id: "fortnite", icon: "🎯", label: "Fortnite", live: true },
  { id: "pubg", icon: "🪖", label: "PUBG", live: true },
  { id: "hq", icon: "🏢", label: "HQ", live: true },
  { id: "cs2", icon: "💀", label: "CS2", live: true },
  { id: "dota2", icon: "⚔", label: "Dota 2", live: true },
  { id: "study", icon: "📚", label: "Focus", live: true },
  { id: "dnd", icon: "🐉", label: "D&D", live: true },
  { id: "windrose", icon: "⚓", label: "Windrose", live: true },
  { id: "helldivers", icon: "💀", label: "Helldivers", live: true },
  { id: "hll", icon: "🎖", label: "HLL", live: true },
  { id: "hllv", icon: "🚁", label: "Vietnam", live: true },
  { id: "chess", icon: "♟", label: "Chess", live: true },
  { id: "gta", icon: "🌴", label: "GTA", live: true },
  { id: "eve", icon: "🛰", label: "EVE", live: true },
  { id: "assetto", icon: "🏁", label: "Assetto", live: true },
  { id: "va", icon: "✈", label: "Crew Hub", live: true },
];

export const LOBBY_MODULE_MAP: Record<string, string[]> = {
  POKER: ["voice", "poker"],
  TRADING: ["voice", "fakeout", "video", "screen"],
  BUNGIE: ["voice", "destiny", "youtube", "twitch", "video", "screen"],
  RIOT: ["voice", "league", "youtube", "twitch", "video", "screen"],
  FORTNITE: ["voice", "fortnite", "youtube", "twitch", "video", "screen"],
  PUBG: ["voice", "pubg", "youtube", "twitch", "video", "screen"],
  MARATHON: ["voice", "youtube", "twitch", "video", "screen"],
  HEADQUARTERS: ["voice", "hq", "video", "screen"],
  CS2: ["voice", "cs2", "youtube", "twitch", "video", "screen"],
  DOTA2: ["voice", "dota2", "youtube", "twitch", "video", "screen"],
  STUDY: ["voice", "study", "video", "screen"],
  DND: ["voice", "dnd", "youtube", "browser", "video", "screen"],
  WINDROSE: ["voice", "windrose", "youtube", "twitch", "video", "screen"],
  HELLDIVERS2: ["voice", "helldivers", "youtube", "twitch", "video", "screen"],
  HLL: ["voice", "hll", "youtube", "twitch", "video", "screen"],
  HLLV: ["voice", "hllv", "youtube", "twitch", "video", "screen"],
  // Screen share is the point: the host's game goes out to the room.
  BAR: ["voice", "screen", "video", "youtube", "twitch"],
  CHESS: ["voice", "chess", "youtube", "twitch", "video", "screen"],
  EVE: ["voice", "eve", "youtube", "twitch", "video", "screen"],
  // The server board belongs in the room as much as the lobby — a race night
  // happens in voice with the grid on screen, not on a separate page.
  ASSETTOCORSA: ["voice", "assetto", "youtube", "twitch", "video", "screen"],
  // The airline's Crew Hub opens on the room stage from the last tab.
  VIRTUAL_AIRLINE: ["voice", "youtube", "twitch", "browser", "video", "screen", "va"],
};

export const DEFAULT_ROOM_MODULES = ["voice", "youtube", "twitch", "browser", "video", "screen"];

// The everyday tools a lobby switches on and off ("What's inside": the
// create-lobby composer, and Admin → What's inside), stored as
// Lobby.enabledModules. A game's own module comes with the lobby type and is
// always offered.
export const LOBBY_SWITCHED = ["voice", "video", "screen", "youtube", "twitch"];

// Office rooms (mtg-*) present the same modules under advisory-office language.
// Display-only remap applied at the single point MODULES is built, so the header
// pills, bottom bar, and any other consumer all pick it up. Module ids, wiring,
// and behavior are untouched; non-office rooms never enter this path.
export const OFFICE_MODULE_SKIN: Record<string, { label: string; icon?: string }> = {
  voice: { label: "Conversation" },
  youtube: { label: "Walkthrough", icon: "▶" },
  twitch: { label: "Broadcast", icon: "◉" },
  browser: { label: "Co-browse" },
  screen: { label: "Screen" },
  video: { label: "Faces" },
  office: { label: "The Review" },
};
