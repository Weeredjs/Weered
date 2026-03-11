"use client";

import React from "react";
import { useParams } from "next/navigation";
import ContentHub from "../../../components/ContentHub";
import LobbyHeaderBar from "../../../components/LobbyHeaderBar";
import LobbyChatDrawer from "../../../components/LobbyChatDrawer";

export default function LobbyIdPage() {
  const params  = useParams();
  const lobbyId = decodeURIComponent(String(params?.id ?? "lobby"));
  const roomId  = `room:${lobbyId}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "calc(100vh - 32px)", minHeight: 0 }}>
      <LobbyHeaderBar />

      <div style={{
        flex: 1,
        minHeight: 0,
        position: "relative",
        border: "1px solid var(--weered-border)",
        borderRadius: 16,
        background: "var(--weered-panel2)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}>
        <ContentHub />
        <LobbyChatDrawer roomId={roomId} title={`${lobbyId} · Chat`} />
      </div>
    </div>
  );
}
