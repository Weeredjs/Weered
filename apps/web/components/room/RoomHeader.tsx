"use client";

import React from "react";

// RoomTab kept for any external imports that still reference it
export type RoomTab = "chat" | "media" | "activity" | "details";

export default function RoomHeader({
  title,
  memberCount,
  locked,
  onInvite,
}: {
  title: string;
  memberCount?: number;
  locked?: boolean;
  onInvite?: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5 px-4 h-11 border-b border-white/[0.07] flex-shrink-0">
      {/* Room name */}
      <h1 className="font-semibold text-[14px] truncate leading-none">{title}</h1>

      {/* Room badge */}
      <span className="text-[10px] font-semibold tracking-wide uppercase rounded-full border border-white/10 px-2 py-0.5 text-white/40 flex-shrink-0">
        room
      </span>

      {/* Lock indicator */}
      {locked && (
        <span className="text-[10px] font-semibold tracking-wide uppercase rounded-full border border-amber-400/20 bg-amber-400/5 px-2 py-0.5 text-amber-300/60 flex-shrink-0">
          locked
        </span>
      )}

      {/* Online count */}
      {typeof memberCount === "number" && (
        <div className="flex items-center gap-1.5 text-[11px] text-white/40 flex-shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_5px_rgba(74,222,128,0.6)]" />
          {memberCount} online
        </div>
      )}

      {/* Actions — pushed right */}
      <div className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          onClick={onInvite}
          className="text-[11px] font-semibold px-3 py-1.5 rounded-md border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] text-white/60 hover:text-white/90 transition-colors"
        >
          + Invite
        </button>
        <button
          type="button"
          onClick={() => {
            try { window.dispatchEvent(new CustomEvent("weered:dock:toggle")); } catch {}
          }}
          className="text-[11px] font-semibold px-3 py-1.5 rounded-md border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] text-white/60 hover:text-white/90 transition-colors"
        >
          Dock
        </button>
      </div>
    </div>
  );
}
