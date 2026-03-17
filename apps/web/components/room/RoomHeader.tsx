"use client";

import React from "react";

export type RoomTab = "chat" | "media" | "activity" | "details";

export type ModulePill = {
  id: string;
  label: string;
  icon: string;
  live: boolean;
  active: boolean;
};

export default function RoomHeader({
  title,
  memberCount,
  locked,
  thumbnail,
  pills,
  onPillClick,
  onDetailsClick,
  showDetails,
}: {
  title: string;
  memberCount?: number;
  locked?: boolean;
  thumbnail?: string | null;
  pills?: ModulePill[];
  onPillClick?: (id: string) => void;
  onDetailsClick?: () => void;
  showDetails?: boolean;
}) {
  return (
    <div className="flex-shrink-0 border-b border-white/[0.07]" style={{ position: "relative", overflow: "hidden" }}>
      {/* Faded thumbnail background */}
      {thumbnail && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 0,
          backgroundImage: `url(${thumbnail})`,
          backgroundSize: "cover", backgroundPosition: "center",
          opacity: 0.12,
          filter: "blur(8px) saturate(1.4)",
          transform: "scale(1.08)",
          pointerEvents: "none",
        }} />
      )}
      {/* ── Main header row ── */}
      <div className="flex items-center gap-2.5 px-4 h-11" style={{ position: "relative", zIndex: 1 }}>
        <h1 className="font-semibold text-[14px] truncate leading-none" style={{ maxWidth: "55%" }}>{title}</h1>

        <span className="text-[10px] font-semibold tracking-wide uppercase rounded-full border border-white/10 px-2 py-0.5 text-white/40 flex-shrink-0">
          room
        </span>

        {locked && (
          <span className="text-[10px] font-semibold tracking-wide uppercase rounded-full border border-amber-400/20 bg-amber-400/5 px-2 py-0.5 text-amber-300/60 flex-shrink-0">
            locked
          </span>
        )}

        {typeof memberCount === "number" && (
          <div className="flex items-center gap-1.5 text-[11px] text-white/40 flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_5px_rgba(74,222,128,0.6)]" />
            {memberCount} online
          </div>
        )}

        <div className="ml-auto flex items-center gap-1.5">
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

      {/* ── Module pills row — only rendered when pills are passed in ── */}
      {pills && pills.length > 0 && (
        <div className="flex items-center gap-1.5 px-4 pb-2 flex-wrap" style={{ position: "relative", zIndex: 1 }}>
          {pills.map((m) => (
            <button
              key={m.id}
              type="button"
              disabled={!m.live}
              onClick={() => m.live && onPillClick?.(m.id)}
              className={[
                "text-[10px] font-bold tracking-wide px-2.5 py-1 rounded-full border transition-all duration-150 font-mono",
                m.active
                  ? "border-violet-400/35 bg-violet-500/15 text-violet-200"
                  : m.live
                    ? "border-green-500/25 bg-green-500/[0.06] text-green-300/60 hover:bg-green-500/12 hover:text-green-200 cursor-pointer"
                    : "border-white/[0.06] text-white/20 cursor-default",
              ].join(" ")}
            >
              {m.icon} {m.label}
              {m.active && <span className="ml-1 text-[9px]">on</span>}
              {!m.live && !m.active && <span className="ml-1 text-[8px] opacity-40">soon</span>}
            </button>
          ))}
          {onDetailsClick && (
            <button
              type="button"
              onClick={onDetailsClick}
              className={[
                "text-[10px] font-bold tracking-wide px-2.5 py-1 rounded-full border transition-all duration-150 ml-auto font-mono",
                showDetails
                  ? "border-white/20 bg-white/[0.08] text-white/70"
                  : "border-white/[0.06] text-white/25 hover:text-white/50 hover:border-white/15",
              ].join(" ")}
            >
              {showDetails ? "close details" : "... details"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
