"use client";

import React from "react";
import { useParams } from "next/navigation";
import HomeFeed from "../../../components/HomeFeed";
import LobbyHeaderBar from "../../../components/LobbyHeaderBar";
import LobbyChatDrawer from "../../../components/LobbyChatDrawer";
import LobbyHeroBar from "../../../components/LobbyHeroBar";

// Domains that have verified status
const VERIFIED_DOMAINS = new Set([
  "ign.com", "espn.com", "techcrunch.com", "bbc.com", "nba.com",
  "nfl.com", "kotaku.com", "theverge.com", "wired.com", "reuters.com",
  "theguardian.com", "spotify.com",
]);

export default function LobbyIdPage() {
  const params  = useParams();
  const lobbyId = decodeURIComponent(String(params?.id ?? "lobby"));
  const roomId  = `room:${lobbyId}`;
  const isVerified = VERIFIED_DOMAINS.has(lobbyId);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "calc(100vh - 32px)", minHeight: 0 }}>
      <LobbyHeaderBar />

      <div style={{
        flex: 1, minHeight: 0, position: "relative",
        border: "1px solid var(--weered-border)",
        borderRadius: 16,
        background: "var(--weered-panel2)",
        overflow: "hidden",
        display: "flex", flexDirection: "column",
      }}>
        {/* Verified lobby hero bar — floats above feed, collapsible */}
        <LobbyHeroBar
          lobbyId={lobbyId}
          lobbyName={lobbyId}
          verified={isVerified}
        />

        {/* Feed fills remaining space */}
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <HomeFeed />
        </div>

        <LobbyChatDrawer roomId={roomId} title={`${lobbyId} · Chat`} />
      </div>
    </div>
  );
}
