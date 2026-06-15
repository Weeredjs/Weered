"use client";

import React, { useState } from "react";
import HelldiversMajorOrderPanel from "./HelldiversMajorOrderPanel";
import LobbyPlayingNowPanel from "./LobbyPlayingNowPanel";
import HelldiversWarMapPanel from "./HelldiversWarMapPanel";
import HelldiversDispatchesPanel from "./HelldiversDispatchesPanel";
import HelldiversSquadFinder from "./HelldiversSquadFinder";
import HelldiversStratagemsPanel from "./HelldiversStratagemsPanel";
import HelldiversLoadoutBrowser from "./HelldiversLoadoutBrowser";

const ACCENT = "#FFD700";

const TABS = [
  { id: "war" as const, label: "War Map" },
  { id: "squad" as const, label: "Squad Finder" },
  { id: "stratagems" as const, label: "Stratagems" },
  { id: "loadouts" as const, label: "Loadouts" },
];
type TabId = (typeof TABS)[number]["id"];

export default function HelldiversModulesPanel({
  lobbyId,
  accentColor,
  currentUserId,
  style,
  hideSquad = false,
}: {
  lobbyId: string;
  accentColor?: string;
  currentUserId?: string;
  style?: React.CSSProperties;
  hideSquad?: boolean;
}) {
  const accent = accentColor || ACCENT;
  const visibleTabs = hideSquad ? TABS.filter((t) => t.id !== "squad") : TABS;
  const [tab, setTab] = useState<TabId>("war");
  const [chatOpen, setChatOpen] = useState(false);

  React.useEffect(() => {
    function onDrawer(e: Event) {
      const detail = (e as CustomEvent)?.detail;
      setChatOpen(!!detail?.open);
    }
    window.addEventListener("weered:chat:drawer", onDrawer);
    return () => window.removeEventListener("weered:chat:drawer", onDrawer);
  }, []);

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "grid",
        gridTemplateColumns: chatOpen ? "minmax(0, 1fr)" : "minmax(0, 1fr) minmax(280px, 360px)",
        gap: 10,
        padding: 10,
        transition: "grid-template-columns .2s",
        ...style,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0, minHeight: 0 }}>
        <HelldiversMajorOrderPanel />

        <LobbyPlayingNowPanel
          appId="553850"
          lobbyId="helldivers2"
          accentColor={accent}
          gameLabel="Helldivers 2"
        />

        <div
          role="tablist"
          aria-label="Helldivers 2 modules"
          style={{
            display: "flex",
            gap: 4,
            padding: 4,
            borderRadius: 6,
            background: "rgba(0,0,0,.35)",
            border: `1px solid ${accent}1f`,
            flexWrap: "wrap",
          }}
        >
          {visibleTabs.map((t) => {
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: 4,
                  border: `1px solid ${active ? accent : "transparent"}`,
                  background: active ? `${accent}1a` : "transparent",
                  color: active ? accent : "rgba(243,244,246,.65)",
                  fontFamily: "ui-monospace, 'JetBrains Mono', monospace",
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "1.4px",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  transition: "all .15s",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
          {tab === "war" && <HelldiversWarMapPanel />}
          {tab === "squad" && (
            <HelldiversSquadFinder
              lobbyId={lobbyId}
              accentColor={accent}
              currentUserId={currentUserId}
            />
          )}
          {tab === "stratagems" && <HelldiversStratagemsPanel />}
          {tab === "loadouts" && <HelldiversLoadoutBrowser lobbyAccent={accent} />}
        </div>
      </div>

      {!chatOpen && (
        <div style={{ minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <HelldiversDispatchesPanel
            style={{ flex: 1, minHeight: 0, maxHeight: "none" }}
            limit={20}
          />
        </div>
      )}
    </div>
  );
}
