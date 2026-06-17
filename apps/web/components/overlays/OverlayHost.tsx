"use client";

import React, { useEffect } from "react";
import { useOverlay } from "./OverlayProvider";

import RoomDetailsSheet from "./sheets/RoomDetailsSheet";
import DockSheet from "./sheets/DockSheet";
import ProfileSheet from "./sheets/ProfileSheet";
import SettingsSheet from "./sheets/SettingsSheet";

function sheetTitle(type: string | undefined) {
  if (type === "roomDetails") return "Room Details";
  if (type === "profile") return "Profile";
  if (type === "settings") return "Settings";
  if (type === "dock") return "Dock";
  return "Overlay";
}

function SheetBody({
  sheet,
  onClose,
}: {
  sheet: { type: string; payload?: any };
  onClose: () => void;
}) {
  const p = sheet.payload ?? {};
  switch (sheet.type) {
    case "roomDetails":
      return <RoomDetailsSheet roomId={p.roomId ?? "unknown"} />;
    case "profile":
      return <ProfileSheet userId={p.userId ?? "unknown"} />;
    case "settings":
      return <SettingsSheet initialTab={p.tab} />;
    case "dock":
      return <DockSheet payload={p} onClose={onClose} />;
    default:
      return (
        <div className="p-4">
          <div className="text-lg font-semibold">Sheet</div>
          <div className="text-sm opacity-70 mt-1">Unknown sheet: {sheet.type}</div>
        </div>
      );
  }
}

export default function OverlayHost() {
  const { stack, closeSheet, clearSheets } = useOverlay();
  const top = stack.length ? stack[stack.length - 1] : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSheet();
    };
    if (top) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [top, closeSheet]);

  if (!top) return null;

  return (
    <div className="fixed inset-0 z-[1000]">
      <div className="absolute inset-0 bg-black/50" onClick={() => closeSheet()} />

      <div
        className={`absolute right-0 top-0 h-full ${top.type === "settings" ? "w-[640px]" : "w-[420px]"} max-w-[92vw] border-l border-white/10 bg-[var(--weered-bg,#0f1117)] shadow-2xl`}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            {stack.length > 1 ? (
              <button
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10"
                type="button"
                onClick={() => closeSheet()}
              >
                Back
              </button>
            ) : null}
            <div className="text-sm font-semibold opacity-80">{sheetTitle(top.type)}</div>
          </div>

          <button
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10"
            type="button"
            onClick={() => clearSheets()}
          >
            Close
          </button>
        </div>

        <div className="h-[calc(100%-52px)] overflow-auto">
          <SheetBody sheet={top} onClose={closeSheet} />
        </div>
      </div>
    </div>
  );
}
