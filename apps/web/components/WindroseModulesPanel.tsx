"use client";
import React, { useState, useMemo } from "react";
import { useWatchHere } from "../lib/useWatchHere";
import WindroseBuildBrowser from "./WindroseBuildBrowser";
import {
  CompassRose,
  PAL,
  S,
  SLIM_TAB_IDS,
  TABS,
  TabId,
  WR_FONT_MONO,
  WR_FONT_SERIF,
} from "./WrShared";
import { BountiesTab } from "./WrBounties";
import { CrewTab } from "./WrCrew";
import { FlagshipTab } from "./WrFlagship";
import { LogTab } from "./WrLog";
import { AboutTab, ModsTab } from "./WrMods";
import { PortsOfCallTab } from "./WrPorts";
import { StreamsTab } from "./WrStreams";

export default function WindroseModulesPanel({
  lobbyId,
  gameName,
  accentColor: _accent,
  style,
  slim,
}: {
  lobbyId: string;
  gameName: string;
  accentColor?: string;
  style?: React.CSSProperties;
  slim?: boolean;
}) {
  const visibleTabs = useMemo(
    () => (slim ? TABS.filter((t) => SLIM_TAB_IDS.includes(t.id)) : TABS),
    [slim],
  );
  const [tab, setTab] = useState<TabId>(() => {
    if (slim) return "bounties";
    try {
      if (typeof window !== "undefined") {
        const v = (window as any).__weeredPendingStream as
          | { channel?: string; ts?: number }
          | undefined;
        if (v?.channel && typeof v.ts === "number" && Date.now() - v.ts < 5000) return "streams";
      }
    } catch {}
    return "flagship";
  });
  useWatchHere(
    React.useCallback(() => {
      if (!slim) setTab("streams");
    }, [slim]),
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Pirata+One&family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&display=swap');
        @keyframes windrose-wave {
          0%,100% { transform: translateY(0) rotate(0); }
          50% { transform: translateY(-2px) rotate(0.3deg); }
        }
        @keyframes windrose-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .windrose-tab {
          padding: 9px 14px;
          border: 1px solid ${PAL.brass}30;
          border-bottom: none;
          background: ${PAL.stormDeep};
          color: ${PAL.parchDim};
          font-family: ${WR_FONT_SERIF};
          font-size: 12px;
          letter-spacing: 1.4px;
          text-transform: uppercase;
          cursor: pointer;
          transition: all .15s;
          margin-right: 2px;
          margin-top: 2px;
          position: relative;
          top: 1px;
          white-space: nowrap;
        }
        @media (max-width: 1500px) {
          .windrose-tab { padding: 8px 11px; letter-spacing: 1px; font-size: 11px; }
        }
        .windrose-tab:hover:not(.active) { color: ${PAL.brass}; border-color: ${PAL.brass}55; background: ${PAL.stormMid}; }
        .windrose-tab.active {
          color: ${PAL.brassHi};
          border-color: ${PAL.brass};
          background: linear-gradient(180deg, ${PAL.stormFoam}, ${PAL.stormMid});
          font-weight: 700;
        }
        .windrose-tab.active::after {
          content: ''; position: absolute; bottom: -1px; left: 0; right: 0;
          height: 2px; background: ${PAL.brass};
        }
      `}</style>

      <div
        style={{
          ...S.shell,
          ...(style || {}),
          flex: "initial",
          minHeight: "auto",
          overflow: "visible",
        }}
      >
        {!slim && (
          <div style={S.plaque}>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ ...S.label, marginBottom: 2 }}>A Kraken Express Voyage</div>
                <img
                  src="/brand/lobbies/windrose-wordmark-official.png"
                  alt="Windrose"
                  style={{
                    height: 54,
                    width: "auto",
                    maxWidth: 420,
                    objectFit: "contain",
                    filter: `drop-shadow(0 2px 8px ${PAL.brass}55)`,
                  }}
                />
                <div style={{ fontSize: 12, color: PAL.parchDim, fontStyle: "italic" }}>
                  Build. Sail. Survive the storm. <span style={{ color: PAL.brass }}>·</span> Early
                  Access &middot; 2026
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: 4,
                  }}
                >
                  <div style={{ ...S.label, fontSize: 9 }}>Community Hub</div>
                  <div
                    style={{
                      fontFamily: WR_FONT_MONO,
                      fontSize: 10,
                      color: PAL.parchDim,
                      opacity: 0.7,
                    }}
                  >
                    unofficial
                  </div>
                </div>
                <div
                  style={{
                    animation: "windrose-spin 90s linear infinite",
                    flexShrink: 0,
                    opacity: 0.8,
                  }}
                >
                  <CompassRose size={48} />
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={S.tabBar}>
          {visibleTabs.map((t) => (
            <button
              key={t.id}
              className={`windrose-tab ${tab === t.id ? "active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={S.body}>
          {tab === "flagship" && <FlagshipTab />}
          {tab === "logbook" && <WindroseBuildBrowser />}
          {tab === "log" && <LogTab />}
          {tab === "crew" && <CrewTab lobbyId={lobbyId} />}
          {tab === "bounties" && <BountiesTab />}
          {tab === "ports" && <PortsOfCallTab />}
          {tab === "mods" && <ModsTab />}
          {tab === "streams" && <StreamsTab gameName={gameName} lobbyId={lobbyId} />}
          {tab === "about" && <AboutTab />}
        </div>
      </div>
    </>
  );
}
