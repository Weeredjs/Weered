"use client";

import React from "react";
import SubredditBrowser from "../../components/SubredditBrowser";
import LobbyChatPanel from "../../components/LobbyChatPanel";
import LobbyHeaderBar from "../../components/LobbyHeaderBar";

export default function LobbyPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "calc(100vh - 32px)", minHeight: 0 }}>
      <LobbyHeaderBar />

      {/* Feed: two columns, takes most of the height */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 12, flex: 1, minHeight: 0 }}>
        <div style={{ border: "1px solid var(--weered-border)", borderRadius: 16, background: "var(--weered-panel2)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <SubredditBrowser subreddit="r/all" view="list" />
        </div>
        <div style={{ border: "1px solid var(--weered-border)", borderRadius: 16, background: "var(--weered-panel2)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <SubredditBrowser subreddit="r/all" view="preview" />
        </div>
      </div>

      {/* Chat: full width strip at bottom */}
      <div style={{ border: "1px solid var(--weered-border)", borderRadius: 16, background: "var(--weered-panel)", overflow: "hidden", display: "flex", flexDirection: "column", height: 220, flexShrink: 0 }}>
        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--weered-border)", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
          Lobby Chat
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          <LobbyChatPanel roomId="room:lobby" />
        </div>
      </div>
    </div>
  );
}