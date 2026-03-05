"use client";

import React from "react";
import SubredditBrowser from "../../components/SubredditBrowser";
import LobbyChatPanel from "../../components/LobbyChatPanel";
import LobbyHeaderBar from "../../components/LobbyHeaderBar";

export default function LobbyPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <LobbyHeaderBar />

      {/* Top: Subreddit browser (full width) */}
      <div style={{ minWidth: 0 }}>
  <div className="weered-panel p-3" style={{ height: 540, overflow: "hidden" }}>
    <div className="weered-panel2 p-2" style={{ height: "100%", overflow: "hidden" }}>
      <SubredditBrowser subreddit="r/all" />
        </div></div></div>

      {/* Bottom: Main Lobby Chat */}
      <div style={{ border: "1px solid var(--weered-border)", borderRadius: 16, padding: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Main Lobby Chat</div>
        <LobbyChatPanel roomId="room:lobby" />
      </div>
    </div>
  );
}

