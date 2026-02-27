"use client";

import React from "react";

export default function SettingsSheet() {
  return (
    <div className="p-4">
      <div className="text-lg font-semibold">Settings</div>
      <div className="text-sm opacity-70 mt-1">Overlay-centric settings panel</div>

      <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="text-sm font-semibold mb-2">Appearance</div>
        <div className="text-sm opacity-70">Theme + density + layout toggles (placeholder)</div>
      </div>

      <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="text-sm font-semibold mb-2">Privacy</div>
        <div className="text-sm opacity-70">Session + presence visibility (placeholder)</div>
      </div>
    </div>
  );
}