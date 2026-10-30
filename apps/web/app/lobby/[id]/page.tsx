"use client";

import React, { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useWeered } from "../../../components/WeeredProvider";
import { weeredConfirm } from "../../../lib/confirm";
import LobbyHeaderBar from "../../../components/LobbyHeaderBar";
import JoinLobbyOverlay from "../../../components/JoinLobbyOverlay";
import LobbyChatDrawer from "../../../components/LobbyChatDrawer";
import LobbyHeroBar from "../../../components/LobbyHeroBar";
import TournamentLiveStrip from "../../../components/TournamentLiveStrip";
import FlairContestStrip from "../../../components/FlairContestStrip";
import TimbosPanel from "../../../components/TimbosPanel";
import StartggPanel from "../../../components/StartggPanel";
import { TIMBOS_LOBBY_ID } from "../../../lib/timbosCopy";
import { LFG_BOARD_LOBBIES, REDDIT_TAB_LOBBIES } from "../../../lib/lobbySections";
import {
  isForcedThemeLobby,
  isThemeableLobby,
  useKeepDefaultTheme,
  useBilingualLobby,
  useLobbyView,
  lobbyHasModules,
  usePublishLobbyViews,
} from "../../../lib/lobbyChrome";
import { applyChrome, currentChrome, rememberSkin } from "../../../lib/lobbyThemes";
import LobbySplash, {
  WINDROSE_SPLASH_PALETTE,
  DESTINY_SPLASH_PALETTE,
} from "../../../components/LobbySplash";
import LobbyHall from "../../../components/LobbyHall";
import LobbyTierCards from "../../../components/LobbyTierCards";
import LobbyEvents from "../../../components/LobbyEvents";
import GuestLaunchBar from "../../../components/GuestLaunchBar";

import BungieLinkPill from "../../../components/BungieLinkPill";
import LobbyAmbient from "../../../components/LobbyAmbient";
import LobbyJoinGate, { type LobbyInfo } from "./LobbyJoinGate";
import LobbyHomeCanvas from "../../../components/lobby-design/LobbyHomeCanvas";
import LobbySparkle from "../../../components/lobby-design/LobbySparkle";
import { useLobbyDesign } from "../../../components/lobby-design/useLobbyDesign";
import { TAB_DEFAULT_LABEL, newBlock, type BlockType, type TabId } from "../../../lib/lobbyLayout";
import { FONT_STACK, PRESET_BY_ID } from "../../../lib/lobbyThemePresets";
import { useWatchHere, clearPendingStream } from "../../../lib/useWatchHere";

// Per-vertical panels are code-split: a lobby only downloads its own module.
const panelLoading = () => (
  <div
    style={{
      flex: 1,
      display: "grid",
      placeItems: "center",
      minHeight: 200,
      color: "rgba(148,163,184,.4)",
      fontSize: 12,
    }}
  >
    Loading module\u2026
  </div>
);
const LobbyModulesPanel = dynamic(() => import("../../../components/LobbyModulesPanel"), {
  loading: panelLoading,
  ssr: false,
});
const ChessModulesPanel = dynamic(() => import("../../../components/ChessModulesPanel"), {
  loading: panelLoading,
  ssr: false,
});
const MarathonModulesPanel = dynamic(() => import("../../../components/MarathonModulesPanel"), {
  loading: panelLoading,
  ssr: false,
});
const MlbModulesPanel = dynamic(() => import("../../../components/MlbModulesPanel"), {
  loading: panelLoading,
  ssr: false,
});
const PgaModulesPanel = dynamic(() => import("../../../components/PgaModulesPanel"), {
  loading: panelLoading,
  ssr: false,
});
const NewsModulesPanel = dynamic(() => import("../../../components/NewsModulesPanel"), {
  loading: panelLoading,
  ssr: false,
});
const LeagueModulesPanel = dynamic(() => import("../../../components/LeagueModulesPanel"), {
  loading: panelLoading,
  ssr: false,
});
const FortniteModulesPanel = dynamic(() => import("../../../components/FortniteModulesPanel"), {
  loading: panelLoading,
  ssr: false,
});
const TradingModulesPanel = dynamic(() => import("../../../components/TradingModulesPanel"), {
  loading: panelLoading,
  ssr: false,
});
const PokerTable = dynamic(() => import("../../../components/PokerTable"), {
  loading: panelLoading,
  ssr: false,
});
const HeadquartersModulesPanel = dynamic(
  () => import("../../../components/HeadquartersModulesPanel"),
  { loading: panelLoading, ssr: false },
);
const CS2ModulesPanel = dynamic(() => import("../../../components/CS2ModulesPanel"), {
  loading: panelLoading,
  ssr: false,
});
const Dota2ModulesPanel = dynamic(() => import("../../../components/Dota2ModulesPanel"), {
  loading: panelLoading,
  ssr: false,
});
const StudyModulesPanel = dynamic(() => import("../../../components/StudyModulesPanel"), {
  loading: panelLoading,
  ssr: false,
});
const PubgModulesPanel = dynamic(() => import("../../../components/PubgModulesPanel"), {
  loading: panelLoading,
  ssr: false,
});
const DndModulesPanel = dynamic(() => import("../../../components/DndModulesPanel"), {
  loading: panelLoading,
  ssr: false,
});
const MtgModulesPanel = dynamic(() => import("../../../components/MtgModulesPanel"), {
  loading: panelLoading,
  ssr: false,
});
const PoeModulesPanel = dynamic(() => import("../../../components/PoeModulesPanel"), {
  loading: panelLoading,
  ssr: false,
});
const Poe2ModulesPanel = dynamic(() => import("../../../components/Poe2ModulesPanel"), {
  loading: panelLoading,
  ssr: false,
});
const AssettoCorsaModulesPanel = dynamic(
  () => import("../../../components/AssettoCorsaModulesPanel"),
  { loading: panelLoading, ssr: false },
);
const Division2ModulesPanel = dynamic(() => import("../../../components/Division2ModulesPanel"), {
  loading: panelLoading,
  ssr: false,
});
const EveModulesPanel = dynamic(() => import("../../../components/EveModulesPanel"), {
  loading: panelLoading,
  ssr: false,
});
const WindroseModulesPanel = dynamic(() => import("../../../components/WindroseModulesPanel"), {
  loading: panelLoading,
  ssr: false,
});
const HelldiversWarMapPanel = dynamic(() => import("../../../components/HelldiversWarMapPanel"), {
  loading: panelLoading,
  ssr: false,
});
const HelldiversMajorOrderPanel = dynamic(
  () => import("../../../components/HelldiversMajorOrderPanel"),
  { loading: panelLoading, ssr: false },
);
const HelldiversDispatchesPanel = dynamic(
  () => import("../../../components/HelldiversDispatchesPanel"),
  { loading: panelLoading, ssr: false },
);
const HelldiversSliceBPanel = dynamic(() => import("../../../components/HelldiversSliceBPanel"), {
  loading: panelLoading,
  ssr: false,
});
const HelldiversLoadoutBrowser = dynamic(
  () => import("../../../components/HelldiversLoadoutBrowser"),
  { loading: panelLoading, ssr: false },
);
const HelldiversModulesPanel = dynamic(() => import("../../../components/HelldiversModulesPanel"), {
  loading: panelLoading,
  ssr: false,
});
const HllModulesPanel = dynamic(() => import("../../../components/HllModulesPanel"), {
  loading: panelLoading,
  ssr: false,
});
const HllvModulesPanel = dynamic(() => import("../../../components/hllv/HllvModulesPanel"), {
  loading: panelLoading,
  ssr: false,
});
const BarModulesPanel = dynamic(() => import("../../../components/bar/BarModulesPanel"), {
  loading: panelLoading,
  ssr: false,
});
const VaModulesPanel = dynamic(() => import("../../../components/va/VaModulesPanel"), {
  loading: panelLoading,
  ssr: false,
});
const CoworkModulesPanel = dynamic(() => import("../../../components/CoworkModulesPanel"), {
  loading: panelLoading,
  ssr: false,
});
const LobbyDesigner = dynamic(() => import("../../../components/lobby-design/LobbyDesigner"), {
  ssr: false,
});
const RequestBoard = dynamic(() => import("../../../components/RequestBoard"), { ssr: false });
const ForumPage = dynamic(() => import("../../../components/forum/ForumPage"), {
  loading: panelLoading,
  ssr: false,
});
const TradingFeed = dynamic(() => import("../../../components/TradingFeed"), {
  loading: panelLoading,
  ssr: false,
});
const GtaLfgBoard = dynamic(() => import("../../../components/GtaLfgBoard"), {
  loading: panelLoading,
  ssr: false,
});
const RedditFeedTab = dynamic(() => import("../../../components/RedditFeedTab"), {
  loading: panelLoading,
  ssr: false,
});

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

function authHeaders(): Record<string, string> {
  try {
    const t = localStorage.getItem("weered_token") || "";
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

const VERIFIED_DOMAINS = new Set([
  "ign.com",
  "espn.com",
  "techcrunch.com",
  "bbc.com",
  "nba.com",
  "nfl.com",
  "kotaku.com",
  "theverge.com",
  "wired.com",
  "reuters.com",
  "theguardian.com",
  "spotify.com",
]);

const MODULE_GAME_NAMES: Record<string, string> = {
  BUNGIE: "Destiny 2",
  TWITCH: "Twitch",
  MARATHON: "Marathon",
  RIOT: "League of Legends",
  FORTNITE: "Fortnite",
  TRADING: "FakeOut",
  POKER: "Poker",
  HEADQUARTERS: "Headquarters",
  CS2: "Counter-Strike 2",
  DOTA2: "Dota 2",
  STUDY: "Study",
  PUBG: "PUBG: Battlegrounds",
  DND: "Dungeons & Dragons",
  POE: "Path of Exile",
  POE2: "Path of Exile 2",
  DIVISION2: "The Division 2",
  ASSETTOCORSA: "Assetto Corsa",
  WINDROSE: "Windrose",
  EVE: "EVE Online",
  HLL: "Hell Let Loose",
  COWORK: "Co-Work",
};

type Membership = { role: string; roleLevel: number } | null;
type JoinRequestStatus = { status: string; createdAt: string; denyReason?: string | null } | null;

export default function LobbyIdPage() {
  const params = useParams();
  const lobbyId = decodeURIComponent(String(params?.id ?? "lobby"));
  const isVerified = VERIFIED_DOMAINS.has(lobbyId);

  const { join, globalRole, me } = useWeered();
  const [lobbyInfo, setLobbyInfo] = useState<LobbyInfo | null>(null);
  const [membership, setMembership] = useState<Membership>(null);
  const [joinRequest, setJoinRequest] = useState<JoinRequestStatus>(null);
  const [memberChecked, setMemberChecked] = useState(false);
  // Modules for preview lobbies, ?view= overrides — lib/lobbyChrome.ts.
  const [view, setView] = useLobbyView(lobbyId);

  useWatchHere(
    React.useCallback(() => {
      setView("modules");
    }, []),
  );

  useEffect(() => {
    clearPendingStream();
  }, [lobbyId]);

  const searchParams = useSearchParams();
  useEffect(() => {
    if (typeof window === "undefined") return;
    let ch: string | null = null;
    try {
      const v = (window as any).__weeredHomeJoinStream as
        | { channel?: string; ts?: number }
        | undefined;
      if (v?.channel && typeof v.ts === "number" && Date.now() - v.ts < 8000) {
        ch = v.channel;
      }
      delete (window as any).__weeredHomeJoinStream;
    } catch {}
    if (!ch) ch = searchParams?.get("stream") || null;
    if (!ch) return;

    const channel = ch;
    const t = setTimeout(() => {
      try {
        window.dispatchEvent(new CustomEvent("weered:stream:watchhere", { detail: { channel } }));
      } catch {}
    }, 200);
    return () => clearTimeout(t);
  }, [searchParams, lobbyId]);
  const [feedHasNew, setFeedHasNew] = useState(false);

  useEffect(() => {
    const key = `weered:feedSeen:${lobbyId}`;
    fetch(`${API}/forum/posts?lobbyId=${encodeURIComponent(lobbyId)}&sort=new&limit=1`, {
      headers: authHeaders(),
    })
      .then((r) => r.json())
      .then((j) => {
        const latest = j?.posts?.[0];
        if (!latest) return;
        const seen = localStorage.getItem(key);
        if (!seen || new Date(latest.createdAt).getTime() > Number(seen)) {
          setFeedHasNew(true);
        }
      })
      .catch(() => {});
  }, [lobbyId]);

  useEffect(() => {
    if (view === "feed") {
      setFeedHasNew(false);
      try {
        localStorage.setItem(`weered:feedSeen:${lobbyId}`, String(Date.now()));
      } catch {}
    }
  }, [view, lobbyId]);

  const isStaff = globalRole === "GOD" || globalRole === "STAFF" || globalRole === "ADMIN";
  const isOwner = !!(me?.id && lobbyInfo?.ownerId && me.id === lobbyInfo.ownerId);
  const isMember = !!membership || isStaff || isOwner;

  function loadLobby() {
    fetch(`${API}/lobbies/${encodeURIComponent(lobbyId)}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok && j.lobby) {
          setLobbyInfo({
            moduleType: j.lobby.moduleType,
            moduleConfig: j.lobby.moduleConfig || null,
            accentColor: j.lobby.accentColor,
            logoUrl: j.lobby.logoUrl,
            bannerUrl: j.lobby.bannerUrl,
            description: j.lobby.description,
            enabledModules: j.lobby.enabledModules,
            verified: j.lobby.verified,
            name: j.lobby.name,
            ownerId: j.lobby.ownerId || null,
            joinMode: j.lobby.joinMode || "OPEN",
            memberPerks: Array.isArray(j.lobby.memberPerks) ? j.lobby.memberPerks : [],
            layout: j.lobby.layout ?? null,
            customDomain: j.lobby.customDomain ?? null,
            domainStatus: j.lobby.domainStatus ?? null,
            _count: j.lobby._count,
            tiers: j.lobby.tiers || [],
          });
          setMembership(j.membership || null);
          setJoinRequest(j.joinRequest || null);
          setMemberChecked(true);
        }
      })
      .catch(() => {
        setMemberChecked(true);
      });
  }

  useEffect(() => {
    setLobbyInfo(null);
    loadLobby();
  }, [lobbyId]);

  const keepDefaultTheme = useKeepDefaultTheme();

  // A lobby's skin shows unless the viewer turned on "Keep default theme".
  // Forced lobbies (demo and prospect rooms) show it to everyone, members or
  // not; the other themeable lobbies to members only.
  const wantLobbyTheme =
    !keepDefaultTheme &&
    (isForcedThemeLobby(lobbyId) || (isThemeableLobby(lobbyId) && memberChecked && isMember));

  // Settle the skin once it is known (a member-only skin waits for the member
  // check, so a skin painted from the cache is not pulled and re-added), and
  // remember a member's skin so the next load paints it before hydration.
  useEffect(() => {
    if (!lobbyId) return;
    const forced = isForcedThemeLobby(lobbyId);
    const themeable = isThemeableLobby(lobbyId);
    if (!(keepDefaultTheme || forced || !themeable || memberChecked)) return;
    const d = document.documentElement;
    if (wantLobbyTheme) d.setAttribute("data-weered-lobby", lobbyId);
    else if (d.getAttribute("data-weered-lobby") === lobbyId)
      d.removeAttribute("data-weered-lobby");
    if (themeable && !forced && !keepDefaultTheme)
      rememberSkin("lobby", lobbyId, wantLobbyTheme ? lobbyId : null);
  }, [lobbyId, wantLobbyTheme, memberChecked, keepDefaultTheme]);
  // Leaving: settle on what the next page wants instead of wiping the skin,
  // which flashed the default theme between two themed pages.
  useEffect(
    () => () => {
      const [skin, min] = currentChrome(location.pathname, location.search);
      applyChrome(skin, min);
    },
    [lobbyId],
  );

  useBilingualLobby(lobbyId);

  useEffect(() => {
    if (!lobbyId) return;
    const params = new URLSearchParams(window.location.search);
    const forceMin = params.get("chrome") === "min";
    const forceFull = params.get("chrome") === "full";
    const known =
      !isThemeableLobby(lobbyId) ||
      isForcedThemeLobby(lobbyId) ||
      keepDefaultTheme ||
      (!!lobbyInfo && memberChecked);
    if (!known && !forceMin && !forceFull) return;
    const wantMin = forceMin || (!forceFull && !wantLobbyTheme);
    const d = document.documentElement;
    if (wantMin) d.setAttribute("data-weered-chrome", "min");
    else d.removeAttribute("data-weered-chrome");
  }, [lobbyId, lobbyInfo?.moduleType, lobbyInfo, wantLobbyTheme, memberChecked, keepDefaultTheme]);

  useEffect(() => {
    if (lobbyId && memberChecked && isMember) join(lobbyId);
  }, [lobbyId, memberChecked, isMember]);

  // ── Design mode ──────────────────────────────────────────────────────
  const canDesign = isStaff || isOwner || (membership?.roleLevel ?? 0) >= 4;
  const design = useLobbyDesign(
    lobbyId,
    lobbyInfo?.layout ?? null,
    canDesign,
    memberChecked && !!lobbyInfo,
  );
  const L = design.effective; // null = the stock layout
  const dTheme = L?.theme || {};
  const dPreset = dTheme.preset ? PRESET_BY_ID[dTheme.preset] : null;
  const displayFont = FONT_STACK[dTheme.font || "default"];
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [domain, setDomain] = useState<{ host: string | null; status: string | null }>({
    host: null,
    status: null,
  });
  useEffect(() => {
    setDomain({ host: lobbyInfo?.customDomain ?? null, status: lobbyInfo?.domainStatus ?? null });
  }, [lobbyInfo?.customDomain, lobbyInfo?.domainStatus]);

  const hasModules = lobbyHasModules(lobbyId, lobbyInfo?.moduleType);
  const hasLfgBoard = LFG_BOARD_LOBBIES.has(lobbyId);
  const hasStartgg = !!(lobbyInfo?.moduleConfig as any)?.startgg?.ref;
  usePublishLobbyViews(lobbyId, hasModules, hasStartgg); // feeds the scoped rail
  const redditSub = REDDIT_TAB_LOBBIES[lobbyId];
  const KNOWN_ACCENTS: Record<string, string> = { gta6: "#e84393" };
  const accent = dTheme.accent || lobbyInfo?.accentColor || KNOWN_ACCENTS[lobbyId] || undefined;
  const gameName =
    lobbyInfo?.moduleConfig?.twitchCategory ||
    MODULE_GAME_NAMES[lobbyInfo?.moduleType || ""] ||
    lobbyId;
  const showAdmin = isStaff || isOwner || (membership && membership.roleLevel >= 3);

  // The lobby's game module. Keyed on the lobby, not a ModuleType — lib/lobbyChrome.ts.
  // Shared by the Modules tab and the Home canvas's game block.
  const modulesPanel = !hasModules ? null : lobbyId === TIMBOS_LOBBY_ID ? (
    <TimbosPanel lobbyId={lobbyId} accent={accent} />
  ) : lobbyInfo?.moduleType === "MARATHON" ? (
    <MarathonModulesPanel
      lobbyId={lobbyId}
      accentColor={accent}
      style={{ flex: 1, minHeight: 0 }}
    />
  ) : lobbyInfo?.moduleType === "MLB" ? (
    <MlbModulesPanel lobbyId={lobbyId} accentColor={accent} style={{ flex: 1, minHeight: 0 }} />
  ) : lobbyInfo?.moduleType === "PGA" ? (
    <PgaModulesPanel lobbyId={lobbyId} accentColor={accent} style={{ flex: 1, minHeight: 0 }} />
  ) : lobbyInfo?.moduleType === "NEWS" ? (
    <NewsModulesPanel lobbyId={lobbyId} accentColor={accent} style={{ flex: 1, minHeight: 0 }} />
  ) : lobbyInfo?.moduleType === "RIOT" ? (
    <LeagueModulesPanel
      lobbyId={lobbyId}
      gameName={gameName}
      accentColor={accent}
      style={{ flex: 1, minHeight: 0 }}
    />
  ) : lobbyInfo?.moduleType === "FORTNITE" ? (
    <FortniteModulesPanel
      lobbyId={lobbyId}
      gameName={gameName}
      accentColor={accent}
      style={{ flex: 1, minHeight: 0 }}
    />
  ) : lobbyInfo?.moduleType === "TRADING" ? (
    <TradingModulesPanel lobbyId={lobbyId} accent={accent} />
  ) : lobbyInfo?.moduleType === "POKER" ? (
    <PokerTable roomId={lobbyId} myId={me?.id || ""} myName={me?.name || ""} />
  ) : lobbyInfo?.moduleType === "HEADQUARTERS" ? (
    <HeadquartersModulesPanel
      lobbyId={lobbyId}
      accentColor={accent}
      style={{ flex: 1, minHeight: 0 }}
    />
  ) : lobbyInfo?.moduleType === "CS2" ? (
    <CS2ModulesPanel
      lobbyId={lobbyId}
      gameName={gameName}
      accentColor={accent}
      style={{ flex: 1, minHeight: 0 }}
    />
  ) : lobbyInfo?.moduleType === "DOTA2" ? (
    <Dota2ModulesPanel
      lobbyId={lobbyId}
      gameName={gameName}
      accentColor={accent}
      style={{ flex: 1, minHeight: 0 }}
    />
  ) : lobbyInfo?.moduleType === "STUDY" ? (
    <StudyModulesPanel lobbyId={lobbyId} accentColor={accent} style={{ flex: 1, minHeight: 0 }} />
  ) : lobbyInfo?.moduleType === "PUBG" ? (
    <PubgModulesPanel
      lobbyId={lobbyId}
      gameName={gameName}
      accentColor={accent}
      style={{ flex: 1, minHeight: 0 }}
    />
  ) : lobbyInfo?.moduleType === "DND" ? (
    <DndModulesPanel
      lobbyId={lobbyId}
      gameName={gameName}
      accentColor={accent}
      style={{ flex: 1, minHeight: 0 }}
    />
  ) : lobbyInfo?.moduleType === "POE" ? (
    <PoeModulesPanel
      lobbyId={lobbyId}
      gameName={gameName}
      accentColor={accent}
      style={{ flex: 1, minHeight: 0 }}
    />
  ) : lobbyInfo?.moduleType === "POE2" ? (
    <Poe2ModulesPanel
      lobbyId={lobbyId}
      gameName={gameName}
      accentColor={accent}
      style={{ flex: 1, minHeight: 0 }}
    />
  ) : lobbyInfo?.moduleType === "DIVISION2" ? (
    <Division2ModulesPanel
      lobbyId={lobbyId}
      gameName={gameName}
      accentColor={accent}
      style={{ flex: 1, minHeight: 0 }}
    />
  ) : lobbyInfo?.moduleType === "ASSETTOCORSA" ? (
    <AssettoCorsaModulesPanel
      lobbyId={lobbyId}
      gameName={gameName}
      accentColor={accent}
      demoData={(lobbyInfo as any)?.moduleConfig?.demoData}
      style={{ flex: 1, minHeight: 0 }}
    />
  ) : lobbyInfo?.moduleType === "WINDROSE" ? (
    <WindroseModulesPanel
      lobbyId={lobbyId}
      gameName={gameName}
      accentColor={accent}
      style={{ flex: 1, minHeight: 0 }}
    />
  ) : lobbyInfo?.moduleType === "HELLDIVERS2" ? (
    <HelldiversModulesPanel
      lobbyId={lobbyId}
      accentColor={accent}
      currentUserId={me?.id}
      style={{ flex: 1, minHeight: 0 }}
    />
  ) : lobbyInfo?.moduleType === "HLL" ? (
    <HllModulesPanel
      lobbyId={lobbyId}
      accentColor={accent}
      currentUserId={me?.id}
      style={{ flex: 1, minHeight: 0 }}
    />
  ) : lobbyInfo?.moduleType === "HLLV" ? (
    <HllvModulesPanel
      lobbyId={lobbyId}
      accentColor={accent}
      currentUserId={me?.id}
      style={{ flex: 1, minHeight: 0 }}
    />
  ) : lobbyInfo?.moduleType === "VIRTUAL_AIRLINE" ? (
    <VaModulesPanel lobbyId={lobbyId} style={{ flex: 1, minHeight: 0 }} />
  ) : lobbyInfo?.moduleType === "BAR" ? (
    <BarModulesPanel lobbyId={lobbyId} accentColor={accent} style={{ flex: 1, minHeight: 0 }} />
  ) : lobbyInfo?.moduleType === "COWORK" ? (
    <CoworkModulesPanel
      lobbyId={lobbyId}
      accentColor={accent}
      currentUserId={me?.id}
      style={{ flex: 1, minHeight: 0 }}
    />
  ) : lobbyInfo?.moduleType === "CHESS" ? (
    <ChessModulesPanel
      lobbyId={lobbyId}
      currentUserId={me?.id}
      isStaff={["GOD", "ADMIN", "STAFF"].includes(globalRole || "")}
      style={{ flex: 1, minHeight: 0 }}
    />
  ) : lobbyInfo?.moduleType === "EVE" ? (
    <EveModulesPanel
      lobbyId={lobbyId}
      gameName={gameName}
      accentColor={accent}
      style={{ flex: 1, minHeight: 0 }}
    />
  ) : lobbyInfo?.moduleType === "MTG" ? (
    <MtgModulesPanel lobbyId={lobbyId} style={{ flex: 1, minHeight: 0 }} />
  ) : lobbyInfo?.moduleType === "BUNGIE" ? (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflow: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <TournamentLiveStrip lobbyId={lobbyId} currentUserId={me?.id} />
      <FlairContestStrip lobbyId={lobbyId} />
      <LobbyModulesPanel
        lobbyId={lobbyId}
        gameName={gameName}
        accentColor={accent}
        currentUserId={me?.id}
        isStaff={["GOD", "ADMIN", "STAFF"].includes(globalRole || "")}
        style={{ flex: 1, minHeight: 0 }}
      />
    </div>
  ) : (
    <LobbyModulesPanel
      lobbyId={lobbyId}
      gameName={gameName}
      accentColor={accent}
      style={{ flex: 1, minHeight: 0 }}
    />
  );

  // Which tabs this lobby can show at all, and in what order.
  const tabAvailable: Record<TabId, boolean> = {
    home: true,
    rooms: true,
    modules: hasModules,
    feed: true,
    events: true,
    lfg: hasLfgBoard,
    reddit: !!redditSub,
    brackets: hasStartgg,
    requests: true,
  };
  const availableTabs = (Object.keys(tabAvailable) as TabId[]).filter((t) => tabAvailable[t]);
  const tabOrder: { id: TabId; label?: string; hidden?: boolean }[] = L
    ? L.tabs.filter((t) => tabAvailable[t.id] && (!t.hidden || design.designing))
    : (["rooms", "lfg", "reddit", "modules", "feed", "events"] as TabId[])
        .filter((t) => tabAvailable[t])
        .map((id) => ({ id }));

  // A designed lobby opens on its landing tab (unless the link names a view).
  const landedFor = React.useRef("");
  useEffect(() => {
    if (!lobbyInfo || landedFor.current === lobbyId) return;
    landedFor.current = lobbyId;
    if (searchParams?.get("view")) return;
    const live = design.effective;
    if (live && live.landing !== "rooms" && tabAvailable[live.landing]) setView(live.landing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobbyInfo, lobbyId]);

  function renderTab(t: { id: TabId; label?: string; hidden?: boolean }) {
    const label =
      t.label ||
      (t.id === "feed" && lobbyInfo?.moduleType === "TRADING"
        ? "The Tape"
        : TAB_DEFAULT_LABEL[t.id]);
    const ghost = t.hidden ? { opacity: 0.35, textDecoration: "line-through" } : null;
    const wrap = (el: React.ReactNode) =>
      ghost ? (
        <span key={t.id} style={ghost as React.CSSProperties} title="Hidden from members">
          {el}
        </span>
      ) : (
        <React.Fragment key={t.id}>{el}</React.Fragment>
      );
    if (t.id === "modules")
      return wrap(
        <ModulesTab
          active={view === "modules"}
          moduleType={lobbyInfo?.moduleType}
          label={t.label}
          onClick={() => setView("modules")}
        />,
      );
    if (t.id === "reddit")
      return wrap(
        <TabBtn active={view === "reddit"} accent={accent} onClick={() => setView("reddit")}>
          {t.label || `r/${REDDIT_TAB_LOBBIES[lobbyId] === "gta6" ? "GTA6" : redditSub}`}
        </TabBtn>,
      );
    return wrap(
      <TabBtn
        active={view === t.id}
        accent={accent}
        anchor={t.id === "rooms"}
        onClick={() => setView(t.id)}
      >
        {label}
        {t.id === "feed" && feedHasNew && view !== "feed" && (
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "#22c55e",
              boxShadow: "0 0 6px #22c55e",
              display: "inline-block",
              marginLeft: 5,
              verticalAlign: "middle",
            }}
          />
        )}
      </TabBtn>,
    );
  }

  return (
    <>
      <GuestLaunchBar
        lobbyId={lobbyId}
        lobbyName={lobbyInfo?.name || "this lobby"}
        loggedIn={!!me?.id}
      />
      {/* No join wall on preview lobbies — see lib/lobbyChrome.ts. */}
      {memberChecked && !isMember && lobbyInfo && !isForcedThemeLobby(lobbyId) && (
        <JoinLobbyOverlay
          lobbyId={lobbyId}
          lobbyName={lobbyInfo.name || lobbyId}
          themeable={isThemeableLobby(lobbyId)}
          memberPerks={Array.isArray(lobbyInfo.memberPerks) ? lobbyInfo.memberPerks : []}
          accentColor={lobbyInfo.accentColor || undefined}
          joinMode={lobbyInfo.joinMode || "OPEN"}
          onJoin={async () => {
            try {
              const r = await fetch(`${API}/lobbies/${encodeURIComponent(lobbyId)}/join`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...authHeaders() },
                body: JSON.stringify({}),
              });
              const j = await r.json();
              if (j.ok && j.membership) {
                setMembership(j.membership);
                setMemberChecked(true);
              }
            } catch {}
          }}
        />
      )}
      {lobbyId === "windrose" && isMember && (
        <LobbySplash
          lobbyId="windrose"
          ogImage="/brand/lobbies/windrose-og-v3.png"
          ariaLabel="Welcome to the Windrose hub"
          palette={WINDROSE_SPLASH_PALETTE}
          liveCount={{
            endpoint: "/windrose/live-players",
            label: "Sailing right now",
            suffix: "pirates · Steam live",
          }}
        />
      )}
      {lobbyId === "destiny2" && isMember && (
        <LobbySplash
          lobbyId="destiny2"
          ogImage="/brand/lobbies/destiny2-og-v1.png"
          ariaLabel="Welcome to the Destiny 2 hub"
          palette={DESTINY_SPLASH_PALETTE}
          ctaLabel="Open the Tower →"
          liveCount={{
            endpoint: "/destiny/live-players",
            label: "Guardians on Steam",
            suffix: "live · right now",
          }}
        />
      )}
      <div
        className="weered-lobby-page"
        style={
          {
            display: "flex",
            flexDirection: "column",
            gap: 8,
            // 16px is the shell's top padding. --wtb-h is the desktop title bar and
            // --shell-footer-h the SiteFooter strip (both 0px in a plain browser);
            // ignoring them pushed the chat composer's button row under the footer.
            height: "calc(100vh - 16px - var(--wtb-h, 0px) - var(--shell-footer-h, 0px))",
            minHeight: 0,
            "--lobby-accent": accent || "#5800E5",
            "--lobby-accent-dim": accent ? `${accent}22` : "rgba(88,0,229,0.13)",
            "--lobby-accent-mid": accent ? `${accent}55` : "rgba(88,0,229,0.33)",
          } as React.CSSProperties
        }
      >
        <LobbyHeaderBar
          title={lobbyInfo?.name || lobbyId}
          lobbyId={lobbyId}
          accentColor={accent}
          logoUrl={lobbyInfo?.logoUrl}
          verified={isVerified || lobbyInfo?.verified}
          steamAppId={(lobbyInfo as any)?.moduleConfig?.steamAppId || null}
        />

        <div
          className="weered-lobby-body"
          style={{
            flex: 1,
            minHeight: 0,
            position: "relative",
            border: `1px solid ${accent ? `${accent}33` : "var(--weered-border)"}`,
            borderRadius: 3,
            background: dPreset
              ? `linear-gradient(${dPreset.veil}, ${dPreset.veil}), ${dPreset.art}`
              : "var(--weered-panel2)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            animation:
              dTheme.entrance && dTheme.entrance !== "none"
                ? `weeredEnter-${dTheme.entrance} .8s cubic-bezier(.2,.8,.2,1) both`
                : undefined,
          }}
        >
          <LobbyAmbient
            effect={dTheme.effect}
            accent={accent}
            intensity={dTheme.intensity ?? 1}
            symbol={dTheme.symbol}
          />
          {accent && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 2,
                zIndex: 10,
                background: `linear-gradient(90deg, transparent, ${accent}88 20%, ${accent} 50%, ${accent}88 80%, transparent)`,
                pointerEvents: "none",
              }}
            />
          )}

          {L?.hero === "hidden" ? null : L?.hero === "compact" ? (
            <div
              style={{
                position: "relative",
                zIndex: 1,
                display: "flex",
                alignItems: "baseline",
                gap: 12,
                padding: "12px 16px 8px",
                borderBottom: "1px solid rgba(255,255,255,.06)",
              }}
            >
              <span
                style={{ fontFamily: displayFont, fontSize: 22, fontWeight: 900, color: "#fff" }}
              >
                {lobbyInfo?.name || lobbyId}
              </span>
              {lobbyInfo?.description && (
                <span
                  style={{
                    fontSize: 13,
                    opacity: 0.65,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    minWidth: 0,
                  }}
                >
                  {lobbyInfo.description}
                </span>
              )}
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: 12,
                  color: accent,
                  fontWeight: 800,
                  whiteSpace: "nowrap",
                }}
              >
                {lobbyInfo?._count?.members ?? 0} members
              </span>
            </div>
          ) : (
            <div style={{ position: "relative", zIndex: 1 }}>
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
                steamAppId={lobbyInfo?.moduleConfig?.steamAppId}
              />
            </div>
          )}

          {memberChecked &&
          !isMember &&
          lobbyInfo &&
          lobbyInfo.joinMode &&
          lobbyInfo.joinMode !== "OPEN" ? (
            <LobbyJoinGate
              lobbyId={lobbyId}
              lobbyInfo={lobbyInfo}
              joinRequest={joinRequest}
              accent={accent || "#5800E5"}
              onJoined={loadLobby}
            />
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  gap: 2,
                  padding: "6px 14px",
                  borderBottom: "1px solid rgba(255,255,255,.06)",
                  background: accent ? `${accent}08` : "transparent",
                  flexShrink: 0,
                  position: "relative",
                  zIndex: 1,
                  fontFamily: L ? displayFont : undefined,
                  flexWrap: "wrap",
                }}
              >
                {tabOrder.map(renderTab)}
                {lobbyInfo?.moduleType === "BUNGIE" && (
                  <div style={{ display: "flex", alignItems: "center", marginLeft: 8 }}>
                    <BungieLinkPill size="xs" />
                  </div>
                )}

                {memberChecked &&
                  !membership &&
                  !isStaff &&
                  !isOwner &&
                  (!lobbyInfo?.joinMode || lobbyInfo.joinMode === "OPEN") &&
                  me?.id && (
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch(
                            `${API}/lobbies/${encodeURIComponent(lobbyId)}/join`,
                            {
                              method: "POST",
                              headers: { "Content-Type": "application/json", ...authHeaders() },
                              body: "{}",
                            },
                          );
                          const j = await res.json();
                          if (j.ok) loadLobby();
                        } catch {}
                      }}
                      style={{
                        marginLeft: 4,
                        padding: "5px 12px",
                        borderRadius: 7,
                        border: `1px solid ${accent}55`,
                        background: `${accent}12`,
                        fontSize: 10,
                        color: accent,
                        cursor: "pointer",
                        fontWeight: 700,
                        letterSpacing: "0.04em",
                        transition: "all .15s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = `${accent}22`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = `${accent}12`;
                      }}
                      title="Join this lobby — adds it to Your Lobbies"
                    >
                      + Join
                    </button>
                  )}

                {membership && membership.roleLevel < 5 && (
                  <button
                    onClick={async () => {
                      const ok = await weeredConfirm({
                        title: "Leave this lobby?",
                        body: "You can rejoin anytime — you'll just stop seeing it in your active list.",
                        confirmLabel: "Leave",
                      });
                      if (!ok) return;
                      await fetch(`${API}/lobbies/${encodeURIComponent(lobbyId)}/leave`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", ...authHeaders() },
                      });
                      setMembership(null);
                      setMemberChecked(true);
                    }}
                    style={{
                      marginLeft: 4,
                      padding: "5px 10px",
                      borderRadius: 7,
                      border: "1px solid rgba(239,68,68,0.15)",
                      background: "rgba(239,68,68,0.06)",
                      fontSize: 10,
                      color: "rgba(239,68,68,0.5)",
                      cursor: "pointer",
                      fontWeight: 600,
                      letterSpacing: "0.04em",
                      transition: "all .15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(239,68,68,0.12)";
                      e.currentTarget.style.color = "rgba(239,68,68,0.8)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(239,68,68,0.06)";
                      e.currentTarget.style.color = "rgba(239,68,68,0.5)";
                    }}
                  >
                    Leave
                  </button>
                )}

                {canDesign && !design.designing && (
                  <button
                    onClick={() => design.setDesigning(true)}
                    title="Design mode: arrange this lobby"
                    style={{
                      marginLeft: "auto",
                      padding: "5px 12px",
                      borderRadius: 7,
                      border: "none",
                      background: `linear-gradient(135deg, ${accent || "#7c3aed"}, ${accent || "#7c3aed"}aa)`,
                      color: "#0b0b0f",
                      fontSize: 11,
                      fontWeight: 900,
                      letterSpacing: ".04em",
                      cursor: "pointer",
                      boxShadow: `0 0 14px ${accent || "#7c3aed"}55`,
                    }}
                  >
                    ✦ Design
                  </button>
                )}
                {showAdmin && (
                  <a
                    href={`/lobby/${encodeURIComponent(lobbyId)}/admin`}
                    style={{
                      marginLeft: canDesign && !design.designing ? 6 : "auto",
                      padding: "5px 12px",
                      borderRadius: 7,
                      // Was 60%-opacity slate on a 4% white fill — it read as
                      // disabled text rather than the way into running the
                      // place. Now it takes the accent-outline treatment the
                      // forum uses, so it carries each lobby's own colour and
                      // is legible without shouting over the tabs beside it.
                      border: "1px solid var(--weered-accent-1, #7c3aed)",
                      background: "var(--weered-accent-bg, rgba(124,58,237,.14))",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: ".04em",
                      color: "var(--weered-accent-2, #a78bfa)",
                      textDecoration: "none",
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      transition: "background .15s, border-color .15s, box-shadow .15s",
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.background = "var(--weered-accent-1, #7c3aed)";
                      el.style.color = "#0b0b0f";
                      el.style.boxShadow = "0 0 0 3px var(--weered-accent-bg, rgba(124,58,237,.2))";
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.background = "var(--weered-accent-bg, rgba(124,58,237,.14))";
                      el.style.color = "var(--weered-accent-2, #a78bfa)";
                      el.style.boxShadow = "none";
                    }}
                  >
                    ⚙ Admin
                  </a>
                )}
              </div>

              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflow: view === "modules" && lobbyId !== TIMBOS_LOBBY_ID ? "visible" : "auto",
                  display: "flex",
                  flexDirection: "column",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                {view === "home" && L ? (
                  <LobbyHomeCanvas
                    lobbyId={lobbyId}
                    layout={L}
                    accent={accent || "#7c3aed"}
                    displayFont={displayFont}
                    counts={lobbyInfo?._count}
                    gameEl={hasModules ? modulesPanel : undefined}
                    onNavigate={(t) => setView(t)}
                    designing={design.designing}
                    selectedId={selectedBlock}
                    onSelect={setSelectedBlock}
                    onMove={(from, to) =>
                      design.setDraft((l) => {
                        const blocks = [...l.blocks];
                        const i = blocks.findIndex((b) => b.id === from);
                        if (i < 0) return l;
                        const [m] = blocks.splice(i, 1);
                        const j =
                          to === "__end" ? blocks.length : blocks.findIndex((b) => b.id === to);
                        blocks.splice(j < 0 ? blocks.length : j, 0, m);
                        return { ...l, blocks };
                      })
                    }
                    onDropNew={(type, beforeId) => {
                      const b = newBlock(type as BlockType);
                      design.setDraft((l) => {
                        const blocks = [...l.blocks];
                        const i = beforeId ? blocks.findIndex((x) => x.id === beforeId) : -1;
                        if (i >= 0) blocks.splice(i, 0, b);
                        else blocks.push(b);
                        return { ...l, blocks };
                      });
                      setSelectedBlock(b.id);
                    }}
                  />
                ) : view === "requests" ? (
                  <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: 18 }}>
                    <RequestBoard lobbyId={lobbyId} accent={accent} />
                  </div>
                ) : view === "brackets" && hasStartgg ? (
                  <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "4px 2px" }}>
                    <StartggPanel lobbyId={lobbyId} accent={accent} />
                  </div>
                ) : view === "modules" && hasModules ? (
                  modulesPanel
                ) : view === "rooms" ? (
                  <LobbyHall
                    lobbyId={lobbyId}
                    lobbyName={lobbyInfo?.name}
                    accentColor={accent}
                    bannerUrl={lobbyInfo?.bannerUrl}
                    moduleType={lobbyInfo?.moduleType}
                    style={{ flex: 1, minHeight: 0 }}
                  />
                ) : view === "lfg" && hasLfgBoard ? (
                  <GtaLfgBoard lobbyId={lobbyId} accent={accent} currentUserId={me?.id} />
                ) : view === "reddit" && redditSub ? (
                  <RedditFeedTab sub={redditSub} accent={accent} />
                ) : view === "events" ? (
                  <LobbyEvents
                    lobbyId={lobbyId}
                    accent={accent}
                    canPost={isStaff || isOwner || (membership ? membership.roleLevel >= 4 : false)}
                  />
                ) : view === "feed" && lobbyInfo?.moduleType === "TRADING" ? (
                  <TradingFeed lobbyId={lobbyId} accent={accent} />
                ) : (
                  <ForumPage lobbyId={lobbyId} lobbyName={lobbyInfo?.name} />
                )}
                <LobbyTierCards lobbyId={lobbyId} />
              </div>

              {/* Default closed: the Lobby tab shows the chat inline, so the
                  drawer is for browsing modules / watching video. Its edge tab
                  hides while the inline chat is on screen; "Dial In" there
                  opens this drawer fullscreen. */}
              {dTheme.sparkle && accent && <LobbySparkle accent={accent} />}
              <LobbyChatDrawer
                roomId={lobbyId}
                title={`${lobbyInfo?.name || lobbyId} · Chat`}
                accentColor={accent}
                defaultOpen={false}
                hideTab={view === "rooms"}
              />
            </>
          )}
        </div>
      </div>
      {design.designing && canDesign && (
        <LobbyDesigner
          lobbyId={lobbyId}
          lobbyName={lobbyInfo?.name || lobbyId}
          description={lobbyInfo?.description || ""}
          accent={accent || "#7c3aed"}
          design={design}
          availableTabs={availableTabs}
          hasGame={hasModules}
          selectedId={selectedBlock}
          onSelect={setSelectedBlock}
          onShowTab={(t) => setView(t)}
          domain={domain}
          onDomainChange={setDomain}
          onPublished={() => loadLobby()}
        />
      )}
      <style>{`
        @keyframes weeredEnter-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes weeredEnter-rise { from { opacity: 0; transform: translateY(24px) scale(.985) } to { opacity: 1; transform: none } }
        @keyframes weeredEnter-glitch {
          0% { opacity: 0; transform: translate(0) skewX(0); filter: hue-rotate(0) }
          20% { opacity: 1; transform: translate(-6px, 2px) skewX(-6deg); filter: hue-rotate(90deg) saturate(3) }
          40% { transform: translate(5px, -2px) skewX(4deg); filter: hue-rotate(-60deg) }
          60% { transform: translate(-3px, 1px) skewX(-2deg); filter: none }
          80% { transform: translate(2px, 0) }
          100% { transform: none; filter: none }
        }
        html[data-weered-designing] .weered-lobby-page { padding-top: 58px; padding-bottom: 218px; box-sizing: border-box; }
        @media (min-width: 1100px) { html[data-weered-designing] .weered-lobby-page { padding-left: 240px; } }
        @media (min-width: 1100px) { html[data-weered-inspecting] .weered-lobby-page { padding-right: 300px; } }
      `}</style>
    </>
  );
}

function TabBtn({
  active,
  accent,
  onClick,
  anchor,
  children,
}: {
  active: boolean;
  accent?: string;
  onClick: () => void;
  anchor?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`weered-tab-btn${active ? " is-active" : ""}${anchor ? " is-anchor" : ""}`}
      style={active && accent ? { borderBottomColor: accent } : undefined}
    >
      {children}
    </button>
  );
}

const MODULE_CHIP_LABEL: Record<string, string> = {
  RIOT: "LoL",
  FORTNITE: "Fortnite",
  TWITCH: "Twitch",
  BUNGIE: "Destiny",
  DOTA2: "Dota 2",
  CS2: "CS2",
  PUBG: "PUBG",
  MLB: "MLB",
  PGA: "PGA",
  DND: "D&D",
  POE: "PoE",
  POE2: "PoE2",
  DIVISION2: "D2",
  ASSETTOCORSA: "AC",
  POKER: "Poker",
  TRADING: "Trade",
  NEWS: "News",
  STUDY: "Study",
  MARATHON: "Marathon",
  WINDROSE: "Windrose",
  HEADQUARTERS: "HQ",
  VIRTUAL_AIRLINE: "Crew Hub",
};

function ModulesTab({
  active,
  moduleType,
  label,
  onClick,
}: {
  active: boolean;
  moduleType?: string | null;
  label?: string;
  onClick: () => void;
}) {
  const mt = String(moduleType || "").toUpperCase();
  const chipLabel = MODULE_CHIP_LABEL[mt] || (mt && mt !== "NONE" ? mt : null);
  return (
    <button onClick={onClick} className={`weered-modules-tab${active ? " is-active" : ""}`}>
      <span className="weered-modules-sparkle" aria-hidden>
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6L12 2z"
            fill="currentColor"
          />
        </svg>
      </span>
      {label || "Modules"}
      {chipLabel && <span className="weered-modules-chip">{chipLabel}</span>}
    </button>
  );
}
