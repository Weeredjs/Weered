"use client";

import React, { useState, useCallback } from "react";
import HelldiversStratagemsPanel from "./HelldiversStratagemsPanel";
import HelldiversSquadFinder from "./HelldiversSquadFinder";

const ACCENT = "#FFD700";

const TABS = [
  { id: "squad" as const, label: "Squad Finder", icon: "🪖" },
  { id: "stratagems" as const, label: "Stratagems", icon: "🎯" },
];
type TabId = (typeof TABS)[number]["id"];

export default function HelldiversSliceBPanel({
  lobbyId,
  accentColor,
  currentUserId,
  style,
}: {
  lobbyId: string;
  accentColor?: string;
  currentUserId?: string;
  style?: React.CSSProperties;
}) {
  const accent = accentColor || ACCENT;
  const [tab, setTab] = useState<TabId>("squad");

  return (
    <div
      style={{
        padding: 0,
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(180deg, rgba(0,0,0,.75), rgba(10,10,10,.85))",
        borderRadius: 8,
        ...style,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 4,
          padding: "10px 14px",
          borderBottom: `1px solid ${accent}25`,
          background: `linear-gradient(180deg, ${accent}10, transparent)`,
        }}
      >
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: "7px 14px",
                borderRadius: 6,
                border: active ? `1px solid ${accent}` : "1px solid rgba(255,255,255,.10)",
                background: active ? `${accent}1A` : "rgba(255,255,255,.03)",
                color: active ? accent : "rgba(243,244,246,.78)",
                fontWeight: active ? 800 : 600,
                fontSize: 12,
                letterSpacing: ".8px",
                textTransform: "uppercase",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <span style={{ marginRight: 6 }}>{t.icon}</span>
              {t.label}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        {tab === "squad" && (
          <HelldiversSquadFinder
            lobbyId={lobbyId}
            accentColor={accent}
            currentUserId={currentUserId}
          />
        )}
        {tab === "stratagems" && (
          <HelldiversStratagemsPanel lobbyId={lobbyId} accentColor={accent} />
        )}
      </div>
    </div>
  );
}
