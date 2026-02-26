"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { ui } from "./weeredUi";

type Props = {
  contextLabel?: string;
};

export default function RightRail({ contextLabel = "lobby" }: Props) {
  const pathname = usePathname();
  const ctx = (() => {
    if (!pathname) return contextLabel;
    if (pathname === "/lobby") return "lobby";
    if (pathname.startsWith("/room/")) return "room: " + decodeURIComponent(pathname.replace("/room/",""));
    return pathname;
  })();

  // Pure UI shell for now. We'll wire real data after layout is nailed.
  const participants = [
    { name: "you", role: "owner" },
    { name: "mod-1", role: "mod" },
    { name: "user-7", role: "member" },
  ];

  return (
    <aside className="hidden xl:block w-[320px] shrink-0">
      <div className={`${ui.panel} sticky top-3`}>
        <div className={ui.panelHeader}>
          <div className="min-w-0">
            <div className={ui.panelTitle}>Organizer</div>
            <div className={`${ui.muted} text-xs truncate`}>context: {ctx}</div>
          </div>
          <span className={ui.chip}>tools</span>
        </div>

        <div className={ui.panelBody}>
          <div className="mb-4">
            <div className={`${ui.muted} text-xs mb-2`}>Participants</div>
            <div className="flex flex-wrap gap-2">
              {participants.map((p) => (
                <span key={p.name} className={ui.chip}>
                  <span className="font-medium">{p.name}</span>
                  <span className={ui.muted}>.</span>
                  <span className="uppercase text-[10px] tracking-wide">{p.role}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <div className={`${ui.muted} text-xs mb-2`}>Quick actions</div>
            <div className="grid grid-cols-2 gap-2">
              <a className={ui.btn} href="/lobby">Lobby</a>
              <a className={ui.btn} href="/lobby?r=r/all">r/all</a>
<button className={ui.btn} type="button">
                @me
              </button>
            </div>
          </div>

          <div>
            <div className={`${ui.muted} text-xs mb-2`}>Moderator / Admin</div>
            <div className="space-y-2">
              <button className={ui.btn} type="button">Pin message (placeholder)</button>
              <button className={ui.btn} type="button">Mute user (placeholder)</button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}