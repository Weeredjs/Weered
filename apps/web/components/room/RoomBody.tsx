"use client";

import React from "react";

export default function RoomBody({
  left,
  right,
}: {
  left: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
<div className="mt-3 grid gap-3 lg:grid-cols-[1fr_360px]" style={{height: "calc(100vh - 200px)", minHeight: 0}}>
      <div className="min-w-0 rounded-xl border border-white/10 bg-black/20 p-3" style={{display:"flex",flexDirection:"column",minHeight:0,overflow:"hidden"}}>
        {left}
      </div>
      <div className="rounded-xl border border-white/10 bg-black/20 p-3 hidden lg:block sticky top-24 max-h-[calc(100vh-120px)] overflow-auto">
        {right ?? (
          <div className="opacity-70">
            <div className="text-sm font-semibold mb-2">Media / Activity</div>
            <div className="text-sm">
              Placeholder panel for tiles, links, activity feed, etc.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

