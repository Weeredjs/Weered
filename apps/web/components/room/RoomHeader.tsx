"use client";

import React from "react";

export type RoomTab = "chat" | "media" | "activity";

export default function RoomHeader({
  title,
  subtitle,
  memberCount,
  onOpenDetails,
  activeTab = "chat",
  onTabChange,
}: {
  title: string;
  subtitle?: string;
  memberCount?: number;
  onOpenDetails?: () => void;
  activeTab?: RoomTab;
  onTabChange?: (tab: RoomTab) => void;
}) {
  const tabBtn = (tab: RoomTab, label: string) => {
    const isActive = activeTab === tab;
    return (
      <button
        type="button"
        onClick={() => onTabChange?.(tab)}
        className={
          "rounded-lg px-3 py-1.5 text-sm transition " +
          (isActive
            ? "bg-white/10 border border-white/10"
            : "opacity-80 hover:bg-white/5 border border-transparent")
        }
        aria-pressed={isActive}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-lg font-semibold">{title}</h1>
            <span className="text-xs rounded-full border border-white/10 px-2 py-0.5 opacity-80">
              room
            </span>
            {typeof memberCount === "number" && (
              <span className="text-xs opacity-70">{memberCount} members</span>
            )}
          </div>
          {subtitle ? <div className="text-sm opacity-70 truncate">{subtitle}</div> : null}
        </div>

        <div className="flex items-center gap-2">
          <button
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10"
            onClick={onOpenDetails}
            type="button"
          >
            Details
          </button>
          <button
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10"
            type="button"
          >
            Invite
          </button>
          <button
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10"
            type="button"
          >
            ⋯
          </button>
        </div>
      </div>

      <div className="mt-3 flex gap-2 text-sm">
        {tabBtn("chat", "Chat")}
        {tabBtn("media", "Media")}
        {tabBtn("activity", "Activity")}
      </div>
    </div>
  );
}