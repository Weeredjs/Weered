"use client";

import { usePathname } from "next/navigation";
import RightRail from "./RightRail";
import RightRailRoom from "./RightRailRoom";
import { lobbyInPath } from "../lib/lobbyPath";

export default function RightRailSwitch() {
  const pathname = usePathname() || "";

  if (pathname.startsWith("/room/")) {
    const roomId = decodeURIComponent(pathname.slice("/room/".length)).split("/")[0] || "unknown";
    return <RightRailRoom roomId={roomId} />;
  }

  // The lobby is the first segment only, and the builder's address is no lobby
  // (lib/lobbyPath.ts). This used to take the whole rest of the address, so a
  // lobby's admin page asked about a lobby called "<id>/admin" and the builder
  // about one called "create".
  const lobbyId = lobbyInPath(pathname);
  if (lobbyId !== null) {
    return <RightRail lobbyId={lobbyId || "lobby"} />;
  }

  return <RightRail />;
}
