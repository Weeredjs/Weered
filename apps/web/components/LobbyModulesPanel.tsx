"use client";
import React, { useState, useCallback } from "react";
import TournamentsPanel from "./TournamentsPanel";
import ModuleTabBar from "./ModuleTabBar";
import { useWatchHere } from "../lib/useWatchHere";
import { ACCENT_DESTINY, currentUserId } from "./D2Shared";
import { ChallengeBoard } from "./D2Challenges";
import { BungieWeekly, GuardianLookup, MyGuardian } from "./D2Guardian";
import { LfgBoard } from "./D2Lfg";
import { TwitchStreams } from "./D2Twitch";

const TABS = [
  { id: "streams", label: "Live Streams", icon: "📺" },
  { id: "lfg", label: "Fireteams", icon: "🔥" },
  { id: "challenges", label: "Challenges", icon: "🎯" },
  { id: "tournaments", label: "Tournaments", icon: "🏆" },
  { id: "weekly", label: "Weekly Reset", icon: "📋" },
  { id: "guardian", label: "Guardian Lookup", icon: "🔍" },
  { id: "myguardian", label: "My Guardian", icon: "⚔" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function LobbyModulesPanel({
  lobbyId,
  gameName = "Destiny 2",
  accentColor = ACCENT_DESTINY,
  style,
  currentUserId,
  isStaff,
}: {
  lobbyId: string;
  gameName?: string;
  accentColor?: string;
  style?: React.CSSProperties;
  currentUserId?: string;
  isStaff?: boolean;
}) {
  const [tab, setTab] = useState<TabId>("streams");
  useWatchHere(
    useCallback(() => {
      setTab("streams");
    }, []),
  );

  return (
    <div
      style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, ...style }}
    >
      <ModuleTabBar
        tabs={TABS}
        active={tab}
        onSelect={(id) => setTab(id as TabId)}
        accent={accentColor}
      />

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: tab === "myguardian" ? "hidden" : "auto",
          padding: tab === "myguardian" ? 0 : "14px 14px 14px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {tab === "streams" && (
          <TwitchStreams gameName={gameName} lobbyId={lobbyId} accentColor={accentColor} />
        )}
        {tab === "lfg" && <LfgBoard lobbyId={lobbyId} />}
        {tab === "challenges" && <ChallengeBoard lobbyId={lobbyId} />}
        {tab === "tournaments" && (
          <TournamentsPanel lobbyId={lobbyId} currentUserId={currentUserId} isStaff={isStaff} />
        )}
        {tab === "weekly" && <BungieWeekly accentColor={accentColor} />}
        {tab === "guardian" && <GuardianLookup />}
        {tab === "myguardian" && <MyGuardian accentColor={accentColor} />}
      </div>

      <div
        style={{
          padding: "6px 14px 8px",
          flexShrink: 0,
          borderTop: "1px solid rgba(255,255,255,.04)",
        }}
      >
        <p
          style={{
            fontSize: 9,
            color: "rgba(100,116,139,.35)",
            lineHeight: 1.4,
            margin: 0,
            textAlign: "center",
          }}
        >
          Weered is not affiliated with, endorsed by, or sponsored by Bungie, Inc. Destiny, Destiny
          2, and all related logos and trademarks are the property of Bungie, Inc.
        </p>
      </div>
    </div>
  );
}
