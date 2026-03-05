"use client";

import React from "react";

export type RoomTab = "chat" | "media" | "activity";

export default function RoomHeader({
  title,
  subtitle,
  memberCount,
  onOpenDetails,
}: {
  title: string;
  subtitle?: string;
  memberCount?: number;
  onOpenDetails?: () => void;
}) {
  const btnBase =
    "rounded-lg border px-3 py-1.5 text-sm transition-colors";

  const btnSecondary =
    btnBase + " border-white/10 bg-white/5 hover:bg-white/10";

  const btnPrimary =
    btnBase + " border-violet-300/25 bg-violet-500/10 hover:bg-violet-500/15 text-violet-100 font-semibold";

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-lg font-semibold">{title}</h1>

            <span className="text-xs rounded-full border border-white/10 px-2 py-0.5 opacity-80">
              room
            </span>

            {typeof memberCount === "number" ? (
              <span className="text-xs opacity-70">{memberCount} members</span>
            ) : null}
          </div>

          {subtitle ? (
            <div className="text-sm opacity-70 truncate">{subtitle}</div>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <button
            className={btnPrimary}
            onClick={() => onOpenDetails?.()}
            type="button"
          >
            Details
          </button>

          <button className={btnSecondary} type="button">
            Invite
          </button>

          <button
            className={btnSecondary}
            onClick={() => {
              try {
                window.dispatchEvent(new CustomEvent("weered:dock:toggle"));
              } catch {}
            }}
            type="button"
          >
            Dock
          </button>
        </div>
      </div>
    </div>
  );
}
