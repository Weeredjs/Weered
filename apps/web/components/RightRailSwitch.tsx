"use client";

import React from "react";
import { usePathname } from "next/navigation";
import RightRail from "./RightRail";
import RightRailRoom from "./RightRailRoom";

// Derive the current lobbyId from the URL:
//   /lobby           → "lobby"
//   /lobby/r/gaming  → "r/gaming"
//   /room/<id>       → no lobby context (room rail handles it)
//   /home            → no lobby (Home page, no right rail needed)
function lobbyFromPath(pathname: string): string | null {
  if (pathname === "/lobby") return "lobby";
  if (pathname.startsWith("/lobby/")) {
    return decodeURIComponent(pathname.slice("/lobby/".length)) || "lobby";
  }
  return null;
}

export default function RightRailSwitch() {
  const pathname = usePathname() || "";

  // Room page — use room-specific rail
  if (pathname.startsWith("/room/")) {
    const roomId = decodeURIComponent(pathname.slice("/room/".length)).split("/")[0] || "unknown";
    return <RightRailRoom roomId={roomId} />;
  }

  // Lobby page (current or future /lobby/[id]) — pass lobbyId to rail
  const lobbyId = lobbyFromPath(pathname);
  if (lobbyId !== null) {
    return <RightRail lobbyId={lobbyId} />;
  }

  // Home, settings, etc. — default rail with no lobby context
  return <RightRail />;
}
