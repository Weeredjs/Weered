"use client";

import React from "react";
import HomeFeed from "../../components/HomeFeed";
import LobbyHeaderBar from "../../components/LobbyHeaderBar";
import LobbyChatDrawer from "../../components/LobbyChatDrawer";

export default function LobbyPage() {
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
        <HomeFeed />
        <LobbyChatDrawer roomId="room:lobby" title="Lobby Chat" />
      </div>
    </div>
  );
}
