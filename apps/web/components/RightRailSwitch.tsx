"use client";

import React from "react";
import { usePathname } from "next/navigation";
import RightRail from "./RightRail";
import RightRailRoom from "./RightRailRoom";

function lobbyFromPath(pathname: string): string | null {
  if (pathname === "/lobby") return "lobby";
  if (pathname.startsWith("/lobby/")) {
    return decodeURIComponent(pathname.slice("/lobby/".length)) || "lobby";
  }
  return null;
}

export default function RightRailSwitch() {
  const pathname = usePathname() || "";

  if (pathname.startsWith("/room/")) {
    const roomId = decodeURIComponent(pathname.slice("/room/".length)).split("/")[0] || "unknown";
    return <RightRailRoom roomId={roomId} />;
  }

  const lobbyId = lobbyFromPath(pathname);
  if (lobbyId !== null) {
    return <RightRail lobbyId={lobbyId} />;
  }

  return <RightRail />;
}
