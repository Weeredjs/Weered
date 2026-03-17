"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import LobbyContent from "../../../components/LobbyContent";
import LobbyHeaderBar from "../../../components/LobbyHeaderBar";
import LobbyChatDrawer from "../../../components/LobbyChatDrawer";
import LobbyHeroBar from "../../../components/LobbyHeroBar";
import LobbyModulesPanel from "../../../components/LobbyModulesPanel";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

// Domains that have verified status
const VERIFIED_DOMAINS = new Set([
  "ign.com", "espn.com", "techcrunch.com", "bbc.com", "nba.com",
  "nfl.com", "kotaku.com", "theverge.com", "wired.com", "reuters.com",
  "theguardian.com", "spotify.com",
]);

// Lobbies with special module types get the modules panel
const MODULE_GAME_NAMES: Record<string, string> = {
  BUNGIE: "Destiny 2",
};

type LobbyInfo = {
  moduleType: string;
  accentColor?: string;
  enabledModules?: string[];
  verified?: boolean;
  name?: string;
};

export default function LobbyIdPage() {
  const params  = useParams();
  const lobbyId = decodeURIComponent(String(params?.id ?? "lobby"));
  const roomId  = `room:${lobbyId}`;
  const isVerified = VERIFIED_DOMAINS.has(lobbyId);

  const [lobbyInfo, setLobbyInfo] = useState<LobbyInfo | null>(null);
  const [view, setView] = useState<"feed" | "modules">("feed");

  // Fetch lobby info to determine if it has special modules
  useEffect(() => {
    fetch(`${API}/lobbies/${encodeURIComponent(lobbyId)}`)
      .then(r => r.json())
      .then(j => {
        if (j.ok && j.lobby) {
          setLobbyInfo({
            moduleType: j.lobby.moduleType,
            accentColor: j.lobby.accentColor,
            enabledModules: j.lobby.enabledModules,
            verified: j.lobby.verified,
            name: j.lobby.name,
          });
          // Auto-show modules for Bungie/Twitch-type lobbies
          if (j.lobby.moduleType === "BUNGIE" || j.lobby.moduleType === "TWITCH") {
            setView("modules");
          }
        }
      })
      .catch(() => {});
  }, [lobbyId]);

  const hasModules = lobbyInfo?.moduleType === "BUNGIE" || lobbyInfo?.moduleType === "TWITCH";
  const accent = lobbyInfo?.accentColor || undefined;
  const gameName = MODULE_GAME_NAMES[lobbyInfo?.moduleType || ""] || lobbyId;

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
        {/* Verified lobby hero bar */}
        <LobbyHeroBar
          lobbyId={lobbyId}
          lobbyName={lobbyInfo?.name || lobbyId}
          verified={isVerified || lobbyInfo?.verified || false}
        />

        {/* View toggle for lobbies with modules */}
        {hasModules && (
          <div style={{
            display: "flex", gap: 2, padding: "6px 14px",
            borderBottom: "1px solid rgba(255,255,255,.06)",
            background: accent ? `${accent}06` : "transparent",
            flexShrink: 0,
          }}>
            <button
              onClick={() => setView("modules")}
              style={{
                padding: "5px 14px", borderRadius: 7, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer",
                background: view === "modules" ? (accent ? `${accent}25` : "rgba(124,58,237,.15)") : "transparent",
                color: view === "modules" ? "rgba(243,244,246,.92)" : "rgba(148,163,184,.6)",
                transition: "background .15s",
              }}
            >
              Modules
            </button>
            <button
              onClick={() => setView("feed")}
              style={{
                padding: "5px 14px", borderRadius: 7, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer",
                background: view === "feed" ? "rgba(255,255,255,.08)" : "transparent",
                color: view === "feed" ? "rgba(243,244,246,.85)" : "rgba(148,163,184,.6)",
                transition: "background .15s",
              }}
            >
              Feed
            </button>
            {lobbyInfo?.verified && (
              <a
                href={`/lobby/${encodeURIComponent(lobbyId)}/admin`}
                style={{
                  marginLeft: "auto", padding: "5px 12px", borderRadius: 7,
                  border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.04)",
                  fontSize: 11, color: "rgba(148,163,184,.6)", textDecoration: "none",
                  display: "flex", alignItems: "center", gap: 5,
                }}
              >
                Admin
              </a>
            )}
          </div>
        )}

        {/* Content area */}
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {view === "modules" && hasModules ? (
            <LobbyModulesPanel
              lobbyId={lobbyId}
              gameName={gameName}
              accentColor={accent}
              style={{ flex: 1, minHeight: 0 }}
            />
          ) : (
            <LobbyContent lobbyId={lobbyId} />
          )}
        </div>

        <LobbyChatDrawer roomId={roomId} title={`${lobbyId} · Chat`} />
      </div>
    </div>
  );
}
