"use client";

import React, { useState } from "react";
import GtaLfgBoard from "../GtaLfgBoard";
import RedditFeedTab from "../RedditFeedTab";
import ForumPage from "../forum/ForumPage";

const ACCENT = "#e84393";

type TabId = "lfg" | "reddit" | "forum";
const TABS: { id: TabId; label: string }[] = [
  { id: "lfg", label: "LFG" },
  { id: "reddit", label: "r/GTA6" },
  { id: "forum", label: "Feed" },
];

export default function GtaModulePanel({
  lobbyId,
  redditSub = "gta6",
  accent = ACCENT,
  currentUserId,
  style,
}: {
  lobbyId: string;
  redditSub?: string;
  accent?: string;
  currentUserId?: string;
  style?: React.CSSProperties;
}) {
  const [tab, setTab] = useState<TabId>("lfg");

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1, ...style }}>
      <div
        style={{
          display: "flex",
          gap: 2,
          padding: "6px 12px",
          flexShrink: 0,
          borderBottom: "1px solid rgba(255,255,255,.06)",
          background: `${accent}08`,
        }}
      >
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                padding: "7px 14px",
                cursor: "pointer",
                fontFamily: "var(--font-barlow), 'Barlow Condensed', sans-serif",
                fontWeight: active ? 800 : 700,
                fontSize: 13,
                letterSpacing: "1px",
                textTransform: "uppercase",
                border: "none",
                borderBottom: `2px solid ${active ? accent : "transparent"}`,
                background: "transparent",
                color: active ? "#fff" : "rgba(148,163,184,.8)",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        {tab === "lfg" && (
          <GtaLfgBoard lobbyId={lobbyId} accent={accent} currentUserId={currentUserId} />
        )}
        {tab === "reddit" && <RedditFeedTab sub={redditSub} accent={accent} />}
        {tab === "forum" && <ForumPage lobbyId={lobbyId} />}
      </div>
    </div>
  );
}
