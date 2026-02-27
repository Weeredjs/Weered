"use client";

import React, { useMemo, useState } from "react";
import RoomHeader, { RoomTab } from "./RoomHeader";
import RoomBody from "./RoomBody";
import RoomChatPanel from "../RoomChatPanel";
import { useOverlay } from "../overlays/OverlayProvider";

export default function RoomCanvas({ roomId }: { roomId: string }) {
  const roomLabel = (() => {
    try { return decodeURIComponent(roomId || ""); } catch { return roomId || ""; }
  })();
  const { openSheet } = useOverlay();
  const [tab, setTab] = useState<RoomTab>("chat");

  const rightPane = useMemo(() => {
    if (tab === "media") {
      return (
        <div className="opacity-80">
          <div className="text-sm font-semibold mb-2">Media</div>
          <div className="text-sm opacity-70">
            Placeholder grid for tiles (images, links, livekit, embeds).
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="h-20 rounded-lg border border-white/10 bg-white/5" />
            <div className="h-20 rounded-lg border border-white/10 bg-white/5" />
            <div className="h-20 rounded-lg border border-white/10 bg-white/5" />
            <div className="h-20 rounded-lg border border-white/10 bg-white/5" />
          </div>
        </div>
      );
    }
    if (tab === "activity") {
      return (
        <div className="opacity-80">
          <div className="text-sm font-semibold mb-2">Activity</div>
          <div className="text-sm opacity-70">Placeholder feed for joins, pins, uploads, mod actions.</div>
          <div className="mt-3 space-y-2">
            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ testuser2 joined</div>
            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ room created</div>
            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ message pinned (soon)</div>
          </div>
        </div>
      );
    }
    return (
      <div className="opacity-80">
        <div className="text-sm font-semibold mb-2">Room Details</div>
        <div className="text-sm opacity-70">Use this pane for context, links, or pinned content.</div>
      </div>
    );
  }, [tab]);

  const leftPane = useMemo(() => {
    if (tab !== "chat") {
      return (
        <div className="opacity-80">
          <div className="text-sm font-semibold mb-2">{tab === "media" ? "Media" : "Activity"}</div>
          <div className="text-sm opacity-70">
            Center panel is reserved for chat by default. We can later make Media/Activity take over the canvas.
          </div>
        </div>
      );
    }

    return (
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="text-sm font-semibold">Room Chat</div>
          <span className="text-xs rounded-full border border-white/10 px-2 py-0.5 opacity-80">
            {roomId}
          </span>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <RoomChatPanel roomId={roomId} />
        </div>
      </div>
    );
  }, [tab, roomId]);

  return (
    <div className="min-w-0">
      <RoomHeader
        onOpenDetails={() => openSheet("roomDetails", { roomId })}
        title={`room: ${roomLabel}`}
        subtitle="Fancy room page prototype"
        memberCount={2}
        activeTab={tab}
        onTabChange={setTab}
      />
<RoomBody left={leftPane} right={rightPane} />
    </div>
  );
}