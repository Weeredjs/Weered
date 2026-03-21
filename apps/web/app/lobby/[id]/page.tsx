"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useWeered } from "../../../components/WeeredProvider";
import LobbyContent from "../../../components/LobbyContent";
import LobbyHeaderBar from "../../../components/LobbyHeaderBar";
import LobbyChatDrawer from "../../../components/LobbyChatDrawer";
import LobbyHeroBar from "../../../components/LobbyHeroBar";
import LobbyModulesPanel from "../../../components/LobbyModulesPanel";
import LobbyRoomDirectory from "../../../components/LobbyRoomDirectory";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

// ── Twitch Glitch icon (official shape, used per Twitch brand guidelines) ──

function TwitchIcon({ size = 12, color = "#9146FF", style }: { size?: number; color?: string; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 268" style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0, ...style }}>
      <path d="M17.458 0L0 46.556v185.81h63.983v34.934h34.932l34.898-34.934h52.36L256 162.954V0H17.458zm23.259 23.263H232.73v128.029l-40.739 40.736H128L93.113 226.93v-34.902H40.717V23.263zm64.008 116.405H128V69.844h-23.275v69.824zm63.997 0h23.275V69.844h-23.275v69.824z" fill={color} />
    </svg>
  );
}

const VERIFIED_DOMAINS = new Set([
  "ign.com", "espn.com", "techcrunch.com", "bbc.com", "nba.com",
  "nfl.com", "kotaku.com", "theverge.com", "wired.com", "reuters.com",
  "theguardian.com", "spotify.com",
]);

const MODULE_GAME_NAMES: Record<string, string> = {
  BUNGIE: "Destiny 2",
  TWITCH: "Twitch",
};

type LobbyInfo = {
  moduleType: string;
  accentColor?: string;
  logoUrl?: string;
  bannerUrl?: string;
  description?: string;
  enabledModules?: string[];
  verified?: boolean;
  name?: string;
  _count?: { rooms: number; members: number };
};

export default function LobbyIdPage() {
  const params  = useParams();
  const lobbyId = decodeURIComponent(String(params?.id ?? "lobby"));
  const isVerified = VERIFIED_DOMAINS.has(lobbyId);

  const { join, globalRole } = useWeered() as any;
  const [lobbyInfo, setLobbyInfo] = useState<LobbyInfo | null>(null);
  const [view, setView] = useState<"rooms" | "feed" | "modules">("rooms");

  useEffect(() => {
    if (lobbyId) join(lobbyId);
  }, [lobbyId]);

  useEffect(() => {
    fetch(`${API}/lobbies/${encodeURIComponent(lobbyId)}`)
      .then(r => r.json())
      .then(j => {
        if (j.ok && j.lobby) {
          setLobbyInfo({
            moduleType:     j.lobby.moduleType,
            accentColor:    j.lobby.accentColor,
            logoUrl:        j.lobby.logoUrl,
            bannerUrl:      j.lobby.bannerUrl,
            description:    j.lobby.description,
            enabledModules: j.lobby.enabledModules,
            verified:       j.lobby.verified,
            name:           j.lobby.name,
            _count:         j.lobby._count,
          });
          if (j.lobby.moduleType === "BUNGIE" || j.lobby.moduleType === "TWITCH") {
            setView("modules");
          } else {
            setView("rooms");
          }
        }
      })
      .catch(() => {});
  }, [lobbyId]);

  const hasModules = lobbyInfo?.moduleType === "BUNGIE" || lobbyInfo?.moduleType === "TWITCH";
  const accent     = lobbyInfo?.accentColor || undefined;
  const gameName   = MODULE_GAME_NAMES[lobbyInfo?.moduleType || ""] || lobbyId;
  const isStaff    = globalRole === "GOD" || globalRole === "STAFF" || globalRole === "ADMIN";
  const showAdmin  = lobbyInfo?.verified || isStaff;

  return (
    <div
      style={{
        display: "flex", flexDirection: "column", gap: 12,
        height: "calc(100vh - 32px)", minHeight: 0,
        paddingBottom: 64,
        "--lobby-accent":     accent || "#7C3AED",
        "--lobby-accent-dim": accent ? `${accent}22` : "rgba(124,58,237,0.13)",
        "--lobby-accent-mid": accent ? `${accent}55` : "rgba(124,58,237,0.33)",
      } as React.CSSProperties}
    >
      <LobbyHeaderBar
        title={lobbyInfo?.name || lobbyId}
        lobbyId={lobbyId}
        accentColor={accent}
        logoUrl={lobbyInfo?.logoUrl}
        verified={isVerified || lobbyInfo?.verified}
      />

      <div style={{
        flex: 1, minHeight: 0, position: "relative",
        border: `1px solid ${accent ? `${accent}33` : "var(--weered-border)"}`,
        borderRadius: 16,
        background: "var(--weered-panel2)",
        overflow: "hidden",
        display: "flex", flexDirection: "column",
      }}>
        {accent && (
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 2, zIndex: 10,
            background: `linear-gradient(90deg, transparent, ${accent}88 20%, ${accent} 50%, ${accent}88 80%, transparent)`,
            pointerEvents: "none",
          }} />
        )}

        <LobbyHeroBar
          lobbyId={lobbyId}
          lobbyName={lobbyInfo?.name || lobbyId}
          description={lobbyInfo?.description}
          verified={isVerified || lobbyInfo?.verified || false}
          accentColor={accent}
          logoUrl={lobbyInfo?.logoUrl}
          bannerUrl={lobbyInfo?.bannerUrl}
          roomCount={lobbyInfo?._count?.rooms}
          memberCount={lobbyInfo?._count?.members}
          moduleType={lobbyInfo?.moduleType}
          gameName={hasModules ? gameName : undefined}
        />

        {/* Tab bar — always visible */}
        <div style={{
          display: "flex", gap: 2, padding: "6px 14px",
          borderBottom: "1px solid rgba(255,255,255,.06)",
          background: accent ? `${accent}08` : "transparent",
          flexShrink: 0,
        }}>
          <TabBtn active={view === "rooms"} accent={accent} onClick={() => setView("rooms")}>Rooms</TabBtn>
          {hasModules && (
            <TabBtn active={view === "modules"} accent={accent} onClick={() => setView("modules")}>
              {lobbyInfo?.moduleType === "TWITCH" && (
                <TwitchIcon
                  size={12}
                  color={view === "modules" ? "#9146FF" : "rgba(148,163,184,.5)"}
                  style={{ marginRight: 5 }}
                />
              )}
              Modules
            </TabBtn>
          )}
          <TabBtn active={view === "feed"} accent={undefined} onClick={() => setView("feed")}>Feed</TabBtn>

          {showAdmin && (
            <a
              href={`/lobby/${encodeURIComponent(lobbyId)}/admin`}
              style={{
                marginLeft: "auto", padding: "5px 12px", borderRadius: 7,
                border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.04)",
                fontSize: 11, color: "rgba(148,163,184,.6)", textDecoration: "none",
                display: "flex", alignItems: "center", gap: 5,
                transition: "background .15s, border-color .15s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.08)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,.14)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.04)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,.08)"; }}
            >
              ⚙ Admin
            </a>
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {view === "modules" && hasModules ? (
            <LobbyModulesPanel lobbyId={lobbyId} gameName={gameName} accentColor={accent} style={{ flex: 1, minHeight: 0 }} />
          ) : view === "rooms" ? (
            <LobbyRoomDirectory lobbyId={lobbyId} accentColor={accent} style={{ flex: 1, minHeight: 0 }} />
          ) : (
            <LobbyContent lobbyId={lobbyId} />
          )}
        </div>

        <LobbyChatDrawer
          roomId={lobbyId}
          title={`${lobbyInfo?.name || lobbyId} · Chat`}
          accentColor={accent}
        />
      </div>
    </div>
  );
}

function TabBtn({ active, accent, onClick, children }: { active: boolean; accent?: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: "5px 14px", borderRadius: 7, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer",
      background: active ? (accent ? `${accent}25` : "rgba(124,58,237,.15)") : "transparent",
      color: active ? "rgba(243,244,246,.92)" : "rgba(148,163,184,.6)",
      transition: "background .15s",
      fontFamily: "inherit",
    }}>
      {children}
    </button>
  );
}
