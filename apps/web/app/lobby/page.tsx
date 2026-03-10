"use client";

import React from "react";
import ContentHub from "../../components/ContentHub";
import LobbyChatPanel from "../../components/LobbyChatPanel";
import LobbyHeaderBar from "../../components/LobbyHeaderBar";

export default function LobbyPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "calc(100vh - 32px)", minHeight: 0 }}>
      <LobbyHeaderBar />

      {/* Content Hub — full width, replaces SubredditBrowser */}
      <div style={{ flex: 1, minHeight: 0, border: "1px solid var(--weered-border)", borderRadius: 16, background: "var(--weered-panel2)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <ContentHub />
      </div>

      {/* Chat: full width strip at bottom */}
      <div style={{ border: "1px solid var(--weered-border)", borderRadius: 16, background: "var(--weered-panel)", overflow: "hidden", display: "flex", flexDirection: "column", height: 280, flexShrink: 0 }}>
        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--weered-border)", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
          Lobby Chat
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          <LobbyChatPanel roomId="room:lobby" embedded={true} />
        </div>
      </div>
    </div>
  );
}
