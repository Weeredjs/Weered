"use client";

import React from "react";
import LobbyChatPanel from "./LobbyChatPanel";

/**
 * Phase B2:
 * Wrapper so the room page can be room-scoped without depending on final chat internals yet.
 * Next step: swap implementation to real room chat stream (roomId) once we locate it.
 */
export default function RoomChatPanel({ roomId }: { roomId: string }) {
  return (
    <div>
      {/* TODO: replace LobbyChatPanel with true room chat bound to roomId */}
      <LobbyChatPanel />
    </div>
  );
}
