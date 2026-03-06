"use client";

import React from "react";
import SubredditBrowser from "../../components/SubredditBrowser";
import LobbyChatPanel from "../../components/LobbyChatPanel";
import LobbyHeaderBar from "../../components/LobbyHeaderBar";

export default function LobbyPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "calc(100vh - 32px)", minHeight: 0 }}>
      <LobbyHeaderBar />

      {/* Main 3-column content area */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr 320px", gap: 12, flex: 1, minHeight: 0 }}>

        {/* Col 1: Feed list */}
        <div style={{ border: "1px solid var(--weered-border)", borderRadius: 16, background: "var(--weered-panel2)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <SubredditBrowser subreddit="r/all" view="list" />
        </div>

        {/* Col 2: Post preview */}
        <div style={{ border: "1px solid var(--weered-border)", borderRadius: 16, background: "var(--weered-panel2)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <SubredditBrowser subreddit="r/all" view="preview" />
        </div>

        {/* Col 3: Lobby chat */}
        <div style={{ border: "1px solid var(--weered-border)", borderRadius: 16, background: "var(--weered-panel)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--weered-border)", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
            Lobby Chat
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
            <LobbyChatPanel roomId="room:lobby" />
          </div>
        </div>
      </div>
    </div>
  );
}
