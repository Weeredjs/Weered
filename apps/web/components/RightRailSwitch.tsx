"use client";

import React from "react";
import { usePathname } from "next/navigation";
import RightRail from "./RightRail";
import RightRailRoom from "./RightRailRoom";

export default function RightRailSwitch() {
  const pathname = usePathname() || "";

  // /room/<id>
  if (pathname.startsWith("/room/")) {
    const roomId = decodeURIComponent(pathname.slice("/room/".length)).split("/")[0] || "unknown";
    return <RightRailRoom roomId={roomId} />;
  }

  return <RightRail />;
}