"use client";

import React from "react";
import { ui } from "./weeredUi";

type Props = {
  title?: string;
  subtitle?: string;
};

export default function LobbyHeaderBar({ title = "Lobby", subtitle }: Props) {
  function toggleDock() {
    window.dispatchEvent(new CustomEvent("weered:dock:toggle"));
  }

  return (
    <div className={`${ui.panel} mb-3`}>
      <div className={ui.panelHeader}>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className={ui.panelTitle}>{title}</div>
            {subtitle ? <div className={`${ui.muted} text-xs truncate`}>{subtitle}</div> : null}
          </div>
          <div className={`${ui.muted} text-xs mt-0.5`}>
            Global chat + subreddit browser. Dock overlays the organizer.
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" className={ui.btn} onClick={toggleDock}>
            Dock
          </button>
        </div>
      </div>
    </div>
  );
}