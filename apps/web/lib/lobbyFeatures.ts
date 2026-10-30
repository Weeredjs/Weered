// A lobby's "What's inside" switches (the create-lobby composer's step 4 and
// Admin → What's inside), read from and written to where they really live:
//   - voice, video, screen, youtube, twitch: Lobby.enabledModules, the tools
//     every room offers (components/room/RoomCanvas.tsx honours it);
//   - events, requests, home: tabs and blocks in the lobby's layout.
import type { FeatureId } from "../components/composer/catalog";
import {
  newBlock,
  sanitizeLayout,
  starterBlocks,
  stockLayout,
  type LobbyLayout,
} from "./lobbyLayout";

export type Features = Record<FeatureId, boolean>;

export function featuresOf(enabledModules: string[], layout: unknown): Features {
  const L = sanitizeLayout(layout) || stockLayout();
  const tabOn = (id: string) => L.tabs.some((t) => t.id === id && !t.hidden);
  return {
    voice: enabledModules.includes("voice"),
    video: enabledModules.includes("video"),
    screen: enabledModules.includes("screen"),
    youtube: enabledModules.includes("youtube"),
    twitch: enabledModules.includes("twitch"),
    events: tabOn("events"),
    requests: tabOn("requests"),
    home: tabOn("home"),
  };
}

/** The layout after the switches go from `was` to `now`. Switching Events or
 *  the request board off hides its tab and takes its blocks off Home; on,
 *  shows the tab and puts a block back. Only switches that changed touch the
 *  blocks, so a block the owner removed on purpose stays gone when they save
 *  something else. */
export function applyFeatures(
  L: LobbyLayout,
  was: Features,
  now: Features,
  hasGame: boolean,
): LobbyLayout {
  const tabs = L.tabs.map((t) =>
    t.id === "home" || t.id === "events" || t.id === "requests" ? { ...t, hidden: !now[t.id] } : t,
  );
  let blocks = L.blocks;
  if (was.events && !now.events) blocks = blocks.filter((b) => b.type !== "events");
  if (was.requests && !now.requests) blocks = blocks.filter((b) => b.type !== "requests");
  if (now.home) {
    if (!was.home && blocks.length === 0)
      blocks = starterBlocks(hasGame).filter((b) => now.events || b.type !== "events");
    if (now.events && !was.events && !blocks.some((b) => b.type === "events"))
      blocks = [...blocks, newBlock("events")];
    if (now.requests && !was.requests && !blocks.some((b) => b.type === "requests"))
      blocks = [...blocks, newBlock("requests")];
  }
  let landing = L.landing;
  if (!now.home && landing === "home") landing = "rooms";
  if (now.home && !was.home) landing = "home";
  if (landing === "events" && !now.events) landing = "rooms";
  if (landing === "requests" && !now.requests) landing = "rooms";
  return { ...L, tabs, blocks, landing };
}
