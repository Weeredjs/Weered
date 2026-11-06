"use client";

// Where the bar at the top of every page says you are (James 2026-11-06:
// "Just have that universal bar the same everywhere"). A page that knows its
// place better than its address does (a lobby, a room, a crew) says so with
// useShellPlace; every other page gets a name from its path.

import { useEffect, useSyncExternalStore } from "react";

export type ShellPlace = {
  kind: "home" | "lobby" | "room" | "crew" | "page";
  title: string;
  /** Where the name leads when clicked: a room's lobby, say. */
  href?: string;
  logoUrl?: string | null;
  accentColor?: string | null;
  verified?: boolean;
  /** A lobby's id: Invite and Report act on it. A room carries its lobby's. */
  lobbyId?: string;
  roomId?: string;
  /** A room shows its lobby's name; this is its own, for an invite. */
  roomName?: string;
  crewId?: string;
  steamAppId?: string | null;
};

let published: ShellPlace | null = null;
let turn = 0;
const listeners = new Set<() => void>();

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** A page names its place for as long as it's on screen. */
export function useShellPlace(place: ShellPlace | null) {
  const key = place ? JSON.stringify(place) : "";
  useEffect(() => {
    if (!key) return;
    const mine = ++turn;
    published = JSON.parse(key);
    listeners.forEach((fn) => fn());
    return () => {
      // A newer page may already have named its own place.
      if (turn !== mine) return;
      published = null;
      listeners.forEach((fn) => fn());
    };
  }, [key]);
}

/** What the bar shows: the page's own word, else one from the address. */
export function useBarPlace(pathname: string): ShellPlace {
  const mine = useSyncExternalStore(
    subscribe,
    () => published,
    () => null,
  );
  return mine ?? placeForPath(pathname);
}

const PAGES: [prefix: string, title: string][] = [
  ["/home", "Home"],
  ["/lobby/create", "Create a lobby"],
  ["/lobby", "The Lobby"],
  ["/room/article", "Article"],
  ["/room", "Room"],
  ["/forum/bookmarks", "Saved posts"],
  ["/forum/mod-queue", "Mod queue"],
  ["/forum", "Forum"],
  ["/store", "Store"],
  ["/subscribe", "Upgrade"],
  ["/map", "Map"],
  ["/requests", "Requests"],
  ["/ban-court", "Ban Court"],
  ["/profile", "Profile"],
  ["/crew", "Crew"],
  ["/space", "Space"],
  ["/invite", "Invite"],
  ["/settings/flair", "Flair"],
  ["/onboarding", "Welcome"],
  ["/setup", "Pick a layout"],
  ["/windrose", "Windrose"],
  ["/connect", "Connect"],
  ["/preview", "Preview"],
  ["/auth", "Signing in"],
];

export function placeForPath(pathname: string): ShellPlace {
  const path = pathname || "/";
  if (path === "/home") return { kind: "home", title: "Home" };
  const lobby = /^\/lobby\/([^/]+)/.exec(path);
  if (lobby && lobby[1] !== "create") {
    const id = decodeURIComponent(lobby[1]);
    return { kind: "lobby", title: id, lobbyId: id };
  }
  for (const [prefix, title] of PAGES) {
    if (path === prefix || path.startsWith(prefix + "/")) return { kind: "page", title };
  }
  return { kind: "page", title: "Weered" };
}
