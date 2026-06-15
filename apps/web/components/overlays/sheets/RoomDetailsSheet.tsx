"use client";

import React from "react";

export default function RoomDetailsSheet({ roomId }: { roomId: string }) {
  return (
    <div className="p-4">
      <div className="text-lg font-semibold">Room Details</div>
      <div className="text-sm opacity-70 mt-1">context: {roomId}</div>

      <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="text-sm font-semibold mb-1">About</div>
        <div className="text-sm opacity-70">
          Placeholder for description, privacy, invite links, pinned items, etc.
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="text-sm font-semibold mb-2">Actions</div>
        <div className="flex flex-col gap-2">
          <button
            className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm hover:bg-white/10"
            type="button"
          >
            Invite link (placeholder)
          </button>
          <button
            className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm hover:bg-white/10"
            type="button"
          >
            Leave room (placeholder)
          </button>
        </div>
      </div>
    </div>
  );
}
