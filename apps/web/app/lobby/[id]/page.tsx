"use client";

import React from "react";
import { useParams } from "next/navigation";
import SubredditBrowser from "../../../components/SubredditBrowser";
import LobbyChatPanel from "../../../components/LobbyChatPanel";
import LobbyHeaderBar from "../../../components/LobbyHeaderBar";

// Map lobby ID to the subreddit it should show
function subredditFor(lobbyId: string): string {
  // r/something lobbies use their own subreddit
  if (lobbyId.startsWith("r/")) return lobbyId;
  // named lobbies
  const map: Record<string, string> = {
    "lobby":     "r/all",
    "weered.ca": "r/all",
  };
  return map[lobbyId] ?? "r/all";
}

export default function LobbyIdPage() {
  const params  = useParams();
  const lobbyId = decodeURIComponent(String(params?.id ?? "lobby"));
  const subreddit = subredditFor(lobbyId);
  const roomId  = `room:${lobbyId}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "calc(100vh - 32px)", minHeight: 0 }}>
      <LobbyHeaderBar />

      {/* Module — Reddit browser (default) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 12, flex: 1, minHeight: 0 }}>
        <div style={{ border: "1px solid var(--weered-border)", borderRadius: 16, background: "var(--weered-panel2)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <SubredditBrowser subreddit={subreddit} view="list" />
        </div>
        <div style={{ border: "1px solid var(--weered-border)", borderRadius: 16, background: "var(--weered-panel2)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <SubredditBrowser subreddit={subreddit} view="preview" />
        </div>
      </div>

      {/* Chat */}
      <div style={{ border: "1px solid var(--weered-border)", borderRadius: 16, background: "var(--weered-panel)", overflow: "hidden", display: "flex", flexDirection: "column", height: 280, flexShrink: 0 }}>
        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--weered-border)", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
          {lobbyId} · Chat
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          <LobbyChatPanel roomId={roomId} embedded={true} />
        </div>
      </div>
    </div>
  );
}
