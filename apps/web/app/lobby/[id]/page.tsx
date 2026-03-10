"use client";

import React from "react";
import { useParams } from "next/navigation";
import ContentHub from "../../../components/ContentHub";
import LobbyChatPanel from "../../../components/LobbyChatPanel";
import LobbyHeaderBar from "../../../components/LobbyHeaderBar";

export default function LobbyIdPage() {
  const params  = useParams();
  const lobbyId = decodeURIComponent(String(params?.id ?? "lobby"));
  const roomId  = `room:${lobbyId}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "calc(100vh - 32px)", minHeight: 0 }}>
      <LobbyHeaderBar />

      {/* Content Hub — full width, replaces SubredditBrowser */}
      <div style={{ flex: 1, minHeight: 0, border: "1px solid var(--weered-border)", borderRadius: 16, background: "var(--weered-panel2)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <ContentHub />
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
