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
import LobbySplash, {
  WINDROSE_SPLASH_PALETTE,
  DESTINY_SPLASH_PALETTE,
} from "../../../components/LobbySplash";
import LobbyRoomDirectory from "../../../components/LobbyRoomDirectory";
import LobbyTierCards from "../../../components/LobbyTierCards";
import LobbyEvents from "../../../components/LobbyEvents";

const LFG_BOARD_LOBBIES = new Set(["gta6"]);
const REDDIT_TAB_LOBBIES: Record<string, string> = { gta6: "gta6" };
import BungieLinkPill from "../../../components/BungieLinkPill";
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
const CoworkModulesPanel = dynamic(() => import("../../../components/CoworkModulesPanel"), {
  loading: panelLoading,
  ssr: false,
});
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
  WINDROSE: "Windrose",
  EVE: "EVE Online",
  HLL: "Hell Let Loose",
  COWORK: "Co-Work",
};

type LobbyInfo = {
  moduleType: string;
  moduleConfig?: { twitchCategory?: string; subreddit?: string; steamAppId?: number } | null;
  accentColor?: string;
  logoUrl?: string;
  bannerUrl?: string;
  description?: string;
  enabledModules?: string[];
  verified?: boolean;
  name?: string;
  ownerId?: string | null;
  joinMode?: string;
  _count?: { rooms: number; members: number };
  tiers?: {
    id: string;
    name: string;
    priceMonthly: number;
    color: string | null;
    grantLevel: number;
  }[];
  memberPerks?: string[];
};

type Membership = { role: string; roleLevel: number } | null;
type JoinRequestStatus = { status: string; createdAt: string; denyReason?: string | null } | null;

function LobbyJoinGate({
  lobbyId,
  lobbyInfo,
  joinRequest,
  onJoined,
  accent,
}: {
  lobbyId: string;
  lobbyInfo: LobbyInfo;
  joinRequest: JoinRequestStatus;
  onJoined: () => void;
  accent: string;
}) {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingState, setPendingState] = useState<"none" | "pending" | "denied">(
    joinRequest?.status === "PENDING"
      ? "pending"
      : joinRequest?.status === "DENIED"
        ? "denied"
        : "none",
  );

  const mode = lobbyInfo.joinMode || "OPEN";

  async function handleJoin() {
    setError("");
    setLoading(true);
    try {
      const body: any = {};
      if (mode === "PASSWORD") body.password = password;
      if (mode === "APPROVAL") body.message = message;

      const res = await fetch(`${API}/lobbies/${encodeURIComponent(lobbyId)}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
      });
      const j = await res.json();

      if (j.ok) {
        if (j.pending) {
          setPendingState("pending");
        } else {
          onJoined();
        }
      } else {
        setError(j.message || j.error || "Failed to join");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  const cardStyle: React.CSSProperties = {
    maxWidth: 420,
    margin: "0 auto",
    padding: "32px 28px",
    borderRadius: 3,
    border: `1px solid ${accent}33`,
    background: `${accent}08`,
    textAlign: "center",
  };

  if (mode === "PAID") {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div style={cardStyle}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>💎</div>
          <h3
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: "rgba(243,244,246,0.95)",
              margin: "0 0 8px",
            }}
          >
            Subscription Required
          </h3>
          <p
            style={{
              fontSize: 13,
              color: "rgba(148,163,184,0.6)",
              margin: "0 0 20px",
              lineHeight: 1.5,
            }}
          >
            This lobby requires an active subscription to join. Choose a tier below to get access.
          </p>
          <LobbyTierCards lobbyId={lobbyId} />
        </div>
      </div>
    );
  }

  if (pendingState === "pending") {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div style={cardStyle}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          <h3
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: "rgba(243,244,246,0.95)",
              margin: "0 0 8px",
            }}
          >
            Request Pending
          </h3>
          <p style={{ fontSize: 13, color: "rgba(148,163,184,0.6)", margin: 0, lineHeight: 1.5 }}>
            Your join request has been submitted. A lobby admin will review it.
          </p>
        </div>
      </div>
    );
  }

  if (pendingState === "denied") {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div style={cardStyle}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>❌</div>
          <h3
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: "rgba(243,244,246,0.95)",
              margin: "0 0 8px",
            }}
          >
            Request Denied
          </h3>
          {joinRequest?.denyReason && (
            <p
              style={{
                fontSize: 12,
                color: "rgba(239,68,68,0.7)",
                margin: "0 0 12px",
                fontStyle: "italic",
              }}
            >
              "{joinRequest.denyReason}"
            </p>
          )}
          <p
            style={{
              fontSize: 13,
              color: "rgba(148,163,184,0.6)",
              margin: "0 0 16px",
              lineHeight: 1.5,
            }}
          >
            Your request was denied. You can submit a new one.
          </p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Add a message (optional)"
            maxLength={500}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: 8,
              resize: "vertical",
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(0,0,0,0.3)",
              color: "rgba(243,244,246,0.9)",
              fontSize: 12,
              minHeight: 60,
              boxSizing: "border-box",
              marginBottom: 12,
              outline: "none",
            }}
          />
          {error && <div style={{ color: "#ef4444", fontSize: 12, marginBottom: 8 }}>{error}</div>}
          <button
            onClick={handleJoin}
            disabled={loading}
            style={{
              padding: "10px 24px",
              borderRadius: 10,
              border: `1px solid ${accent}55`,
              background: `${accent}22`,
              color: "rgba(243,244,246,0.95)",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {loading ? "Submitting..." : "Re-submit Request"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={cardStyle}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>
          {mode === "PASSWORD" ? "🔒" : mode === "APPROVAL" ? "📋" : "👋"}
        </div>
        <h3
          style={{
            fontSize: 18,
            fontWeight: 800,
            color: "rgba(243,244,246,0.95)",
            margin: "0 0 8px",
          }}
        >
          {mode === "OPEN"
            ? "Join this Lobby"
            : mode === "PASSWORD"
              ? "Password Required"
              : "Request to Join"}
        </h3>
        <p
          style={{
            fontSize: 13,
            color: "rgba(148,163,184,0.6)",
            margin: "0 0 20px",
            lineHeight: 1.5,
          }}
        >
          {mode === "OPEN" && "Become a member to access rooms, chat, and all lobby features."}
          {mode === "PASSWORD" && "This lobby is password protected. Enter the password to join."}
          {mode === "APPROVAL" && "This lobby requires admin approval. Submit a request to join."}
        </p>

        {mode === "PASSWORD" && (
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            placeholder="Enter lobby password"
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(0,0,0,0.3)",
              color: "rgba(243,244,246,0.9)",
              fontSize: 13,
              boxSizing: "border-box",
              marginBottom: 12,
              outline: "none",
              textAlign: "center",
            }}
          />
        )}

        {mode === "APPROVAL" && (
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Why do you want to join? (optional)"
            maxLength={500}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: 8,
              resize: "vertical",
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(0,0,0,0.3)",
              color: "rgba(243,244,246,0.9)",
              fontSize: 12,
              minHeight: 60,
              boxSizing: "border-box",
              marginBottom: 12,
              outline: "none",
            }}
          />
        )}

        {error && <div style={{ color: "#ef4444", fontSize: 12, marginBottom: 8 }}>{error}</div>}

        <button
          onClick={handleJoin}
          disabled={loading}
          style={{
            padding: "10px 28px",
            borderRadius: 10,
            border: `1px solid ${accent}55`,
            background: `${accent}22`,
            color: "rgba(243,244,246,0.95)",
            fontSize: 14,
            fontWeight: 700,
            cursor: loading ? "wait" : "pointer",
            transition: "background 0.15s",
          }}
        >
          {loading ? "..." : mode === "APPROVAL" ? "Submit Request" : "Join Lobby"}
        </button>
      </div>
    </div>
  );
}

export default function LobbyIdPage() {
  const params = useParams();
  const lobbyId = decodeURIComponent(String(params?.id ?? "lobby"));
  const isVerified = VERIFIED_DOMAINS.has(lobbyId);

  const { join, globalRole, me } = useWeered();
  const [lobbyInfo, setLobbyInfo] = useState<LobbyInfo | null>(null);
  const [membership, setMembership] = useState<Membership>(null);
  const [joinRequest, setJoinRequest] = useState<JoinRequestStatus>(null);
  const [memberChecked, setMemberChecked] = useState(false);
  const [view, setView] = useState<"rooms" | "feed" | "modules" | "events" | "lfg" | "reddit">(
    "rooms",
  );

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
            _count: j.lobby._count,
            tiers: j.lobby.tiers || [],
          });
          if (
            j.lobby.moduleType === "BUNGIE" ||
            j.lobby.moduleType === "TWITCH" ||
            j.lobby.moduleType === "MARATHON" ||
            j.lobby.moduleType === "MLB" ||
            j.lobby.moduleType === "PGA" ||
            j.lobby.moduleType === "NEWS" ||
            j.lobby.moduleType === "RIOT" ||
            j.lobby.moduleType === "FORTNITE" ||
            j.lobby.moduleType === "TRADING" ||
            j.lobby.moduleType === "POKER" ||
            j.lobby.moduleType === "HEADQUARTERS" ||
            j.lobby.moduleType === "CS2" ||
            j.lobby.moduleType === "DOTA2" ||
            j.lobby.moduleType === "STUDY" ||
            j.lobby.moduleType === "PUBG" ||
            j.lobby.moduleType === "DND" ||
            j.lobby.moduleType === "POE" ||
            j.lobby.moduleType === "WINDROSE" ||
            j.lobby.moduleType === "HELLDIVERS2" ||
            j.lobby.moduleType === "CHESS" ||
            j.lobby.moduleType === "EVE" ||
            j.lobby.moduleType === "MTG" ||
            j.lobby.moduleType === "HLL" ||
            j.lobby.moduleType === "COWORK"
          ) {
            setView("modules");
          } else {
            setView("rooms");
          }
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

  const THEMEABLE_LOBBIES = ["windrose", "destiny2", "dnd", "helldivers2"];
  const [keepDefaultTheme, setKeepDefaultTheme] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      const raw = localStorage.getItem("weered:settings:v0");
      const s = raw ? JSON.parse(raw) : null;
      return s?.keepDefaultThemeInLobbies !== false;
    } catch {
      return true;
    }
  });
  useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem("weered:settings:v0");
        const s = raw ? JSON.parse(raw) : null;
        setKeepDefaultTheme(s?.keepDefaultThemeInLobbies !== false);
      } catch {}
    };
    read();
    window.addEventListener("weered:settings", read);
    return () => window.removeEventListener("weered:settings", read);
  }, []);

  const wantLobbyTheme =
    THEMEABLE_LOBBIES.includes(lobbyId) && memberChecked && isMember && !keepDefaultTheme;

  useEffect(() => {
    if (!lobbyId) return;
    if (wantLobbyTheme) {
      document.documentElement.setAttribute("data-weered-lobby", lobbyId);
      return () => {
        document.documentElement.removeAttribute("data-weered-lobby");
      };
    }
  }, [lobbyId, wantLobbyTheme]);

  useEffect(() => {
    if (!lobbyId) return;
    const params = new URLSearchParams(window.location.search);
    const forceMin = params.get("chrome") === "min";
    const forceFull = params.get("chrome") === "full";
    const known = !THEMEABLE_LOBBIES.includes(lobbyId) || (!!lobbyInfo && memberChecked);
    if (!known && !forceMin && !forceFull) return;
    const DENSE_CHROME = new Set<string>([
      "BUNGIE",
      "TWITCH",
      "MARATHON",
      "MLB",
      "PGA",
      "NEWS",
      "RIOT",
      "FORTNITE",
      "TRADING",
      "POKER",
      "CS2",
      "DOTA2",
      "STUDY",
      "PUBG",
      "DND",
      "POE",
      "WINDROSE",
      "HELLDIVERS2",
      "CHESS",
      "EVE",
      "MTG",
      "HLL",
      "COWORK",
    ]);
    const mt = lobbyInfo?.moduleType || "";
    void DENSE_CHROME;
    void mt;
    const wantMin = forceMin || (!forceFull && !wantLobbyTheme);
    const d = document.documentElement;
    if (wantMin) d.setAttribute("data-weered-chrome", "min");
    else d.removeAttribute("data-weered-chrome");
  }, [lobbyId, lobbyInfo?.moduleType, lobbyInfo, wantLobbyTheme, memberChecked]);

  useEffect(() => {
    if (lobbyId && memberChecked && isMember) join(lobbyId);
  }, [lobbyId, memberChecked, isMember]);

  const hasModules =
    lobbyInfo?.moduleType === "BUNGIE" ||
    lobbyInfo?.moduleType === "TWITCH" ||
    lobbyInfo?.moduleType === "MARATHON" ||
    lobbyInfo?.moduleType === "MLB" ||
    lobbyInfo?.moduleType === "PGA" ||
    lobbyInfo?.moduleType === "NEWS" ||
    lobbyInfo?.moduleType === "RIOT" ||
    lobbyInfo?.moduleType === "FORTNITE" ||
    lobbyInfo?.moduleType === "TRADING" ||
    lobbyInfo?.moduleType === "POKER" ||
    lobbyInfo?.moduleType === "HEADQUARTERS" ||
    lobbyInfo?.moduleType === "CS2" ||
    lobbyInfo?.moduleType === "DOTA2" ||
    lobbyInfo?.moduleType === "STUDY" ||
    lobbyInfo?.moduleType === "PUBG" ||
    lobbyInfo?.moduleType === "DND" ||
    lobbyInfo?.moduleType === "POE" ||
    lobbyInfo?.moduleType === "WINDROSE" ||
    lobbyInfo?.moduleType === "HELLDIVERS2" ||
    lobbyInfo?.moduleType === "CHESS" ||
    lobbyInfo?.moduleType === "EVE" ||
    lobbyInfo?.moduleType === "MTG" ||
    lobbyInfo?.moduleType === "HLL" ||
    lobbyInfo?.moduleType === "COWORK";
  const hasLfgBoard = LFG_BOARD_LOBBIES.has(lobbyId);
  const redditSub = REDDIT_TAB_LOBBIES[lobbyId];
  const KNOWN_ACCENTS: Record<string, string> = { gta6: "#e84393" };
  const accent = lobbyInfo?.accentColor || KNOWN_ACCENTS[lobbyId] || undefined;
  const gameName =
    lobbyInfo?.moduleConfig?.twitchCategory ||
    MODULE_GAME_NAMES[lobbyInfo?.moduleType || ""] ||
    lobbyId;
  const showAdmin = isStaff || isOwner || (membership && membership.roleLevel >= 3);

  return (
    <>
      {memberChecked && !isMember && lobbyInfo && (
        <JoinLobbyOverlay
          lobbyId={lobbyId}
          lobbyName={lobbyInfo.name || lobbyId}
          themeable={["windrose", "destiny2", "dnd", "helldivers2"].includes(lobbyId)}
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
            height: "calc(100vh - 16px)",
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
            background: "var(--weered-panel2)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
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
                }}
              >
                <TabBtn
                  active={view === "rooms"}
                  accent={accent}
                  anchor
                  onClick={() => setView("rooms")}
                >
                  Rooms
                </TabBtn>
                {hasLfgBoard && (
                  <TabBtn active={view === "lfg"} accent={accent} onClick={() => setView("lfg")}>
                    LFG
                  </TabBtn>
                )}
                {redditSub && (
                  <TabBtn
                    active={view === "reddit"}
                    accent={accent}
                    onClick={() => setView("reddit")}
                  >
                    r/{REDDIT_TAB_LOBBIES[lobbyId] === "gta6" ? "GTA6" : redditSub}
                  </TabBtn>
                )}
                {hasModules && (
                  <ModulesTab
                    active={view === "modules"}
                    moduleType={lobbyInfo?.moduleType}
                    onClick={() => setView("modules")}
                  />
                )}
                <TabBtn active={view === "feed"} accent={accent} onClick={() => setView("feed")}>
                  {lobbyInfo?.moduleType === "TRADING" ? "The Tape" : "Feed"}
                  {feedHasNew && view !== "feed" && (
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
                </TabBtn>
                <TabBtn
                  active={view === "events"}
                  accent={accent}
                  onClick={() => setView("events")}
                >
                  Events
                </TabBtn>
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

                {showAdmin && (
                  <a
                    href={`/lobby/${encodeURIComponent(lobbyId)}/admin`}
                    style={{
                      marginLeft: "auto",
                      padding: "5px 12px",
                      borderRadius: 7,
                      border: "1px solid rgba(255,255,255,.08)",
                      background: "rgba(255,255,255,.04)",
                      fontSize: 11,
                      color: "rgba(148,163,184,.6)",
                      textDecoration: "none",
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      transition: "background .15s, border-color .15s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.08)";
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,.14)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.04)";
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,.08)";
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
                  overflow: view === "modules" ? "visible" : "auto",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {view === "modules" && hasModules ? (
                  lobbyInfo?.moduleType === "MARATHON" ? (
                    <MarathonModulesPanel
                      lobbyId={lobbyId}
                      accentColor={accent}
                      style={{ flex: 1, minHeight: 0 }}
                    />
                  ) : lobbyInfo?.moduleType === "MLB" ? (
                    <MlbModulesPanel
                      lobbyId={lobbyId}
                      accentColor={accent}
                      style={{ flex: 1, minHeight: 0 }}
                    />
                  ) : lobbyInfo?.moduleType === "PGA" ? (
                    <PgaModulesPanel
                      lobbyId={lobbyId}
                      accentColor={accent}
                      style={{ flex: 1, minHeight: 0 }}
                    />
                  ) : lobbyInfo?.moduleType === "NEWS" ? (
                    <NewsModulesPanel
                      lobbyId={lobbyId}
                      accentColor={accent}
                      style={{ flex: 1, minHeight: 0 }}
                    />
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
                    <StudyModulesPanel
                      lobbyId={lobbyId}
                      accentColor={accent}
                      style={{ flex: 1, minHeight: 0 }}
                    />
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
                  )
                ) : view === "rooms" ? (
                  <LobbyRoomDirectory
                    lobbyId={lobbyId}
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
                  <LobbyEvents lobbyId={lobbyId} accent={accent} />
                ) : view === "feed" && lobbyInfo?.moduleType === "TRADING" ? (
                  <TradingFeed lobbyId={lobbyId} accent={accent} />
                ) : (
                  <ForumPage lobbyId={lobbyId} lobbyName={lobbyInfo?.name} />
                )}
                <LobbyTierCards lobbyId={lobbyId} />
              </div>

              <LobbyChatDrawer
                roomId={lobbyId}
                title={`${lobbyInfo?.name || lobbyId} · Chat`}
                accentColor={accent}
              />
            </>
          )}
        </div>
      </div>
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
  POKER: "Poker",
  TRADING: "Trade",
  NEWS: "News",
  STUDY: "Study",
  MARATHON: "Marathon",
  WINDROSE: "Windrose",
  HEADQUARTERS: "HQ",
};

function ModulesTab({
  active,
  moduleType,
  onClick,
}: {
  active: boolean;
  moduleType?: string | null;
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
      Modules
      {chipLabel && <span className="weered-modules-chip">{chipLabel}</span>}
    </button>
  );
}
