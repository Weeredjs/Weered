"use client";

import React, { useEffect, useMemo, useState } from "react";

import Link from "next/link";

import { useSearchParams } from "next/navigation";

import SubredditBrowser from "../../components/SubredditBrowser";

import LobbyRoomsList from "../../components/LobbyRoomsList";
import LobbyChatPanel from "../../components/LobbyChatPanel";

import { useWeered } from "../../components/WeeredProvider";
import LobbyHeaderBar from "../../components/LobbyHeaderBar";

function Avatar(props: { name: string; size?: number }) {
  const s = props.size || 28;
  const n = String(props.name || "?");
  const parts = n.trim().split(/\s+/).filter(Boolean);
  const initials =
    (parts[0]?.[0] || "?") +
    (parts.length > 1 ? (parts[parts.length - 1]?.[0] || "") : (parts[0]?.[1] || ""));

  return (
    <div
      style={{
        width: s,
        height: s,
        borderRadius: 999,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 800,
        fontSize: Math.max(12, Math.floor(s * 0.42)),
        background: "rgba(124,58,237,0.18)",
        border: "1px solid var(--weered-border)",
        color: "rgba(255,255,255,0.92)",
        userSelect: "none",
      }}
      title={n}
    >
      {initials.toUpperCase()}
    </div>
  );
}
export default function LobbyPage() {
  // If you later want subreddit from query params, wire it here.
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <LobbyHeaderBar />

      {/* Top row: Rooms (left) + Subreddit browser (center) */}
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 12, alignItems: "start", minWidth: 0 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ border: "1px solid var(--weered-border)", borderRadius: 16, padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontWeight: 800 }}>Rooms</div>
            </div>
            <LobbyRoomsList />
          </div>
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ border: "1px solid var(--weered-border)", borderRadius: 16, padding: 12, height: 540, overflow: "hidden" }}>
            <SubredditBrowser subreddit="r/all" />
          </div>
        </div>
      </div>

      {/* Bottom: Main Lobby Chat */}
      <div style={{ border: "1px solid var(--weered-border)", borderRadius: 16, padding: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Main Lobby Chat</div>
        <LobbyChatPanel />
      </div>
    </div>
  );
}

