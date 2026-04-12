"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useWeered } from "../../../components/WeeredProvider";
import LobbyContent from "../../../components/LobbyContent";
import LobbyHeaderBar from "../../../components/LobbyHeaderBar";
import LobbyChatDrawer from "../../../components/LobbyChatDrawer";
import LobbyHeroBar from "../../../components/LobbyHeroBar";
import LobbyModulesPanel from "../../../components/LobbyModulesPanel";
import MarathonModulesPanel from "../../../components/MarathonModulesPanel";
import MlbModulesPanel from "../../../components/MlbModulesPanel";
import PgaModulesPanel from "../../../components/PgaModulesPanel";
import NewsModulesPanel from "../../../components/NewsModulesPanel";
import LeagueModulesPanel from "../../../components/LeagueModulesPanel";
import FortniteModulesPanel from "../../../components/FortniteModulesPanel";
import TradingModulesPanel from "../../../components/TradingModulesPanel";
import PokerTable from "../../../components/PokerTable";
import HeadquartersModulesPanel from "../../../components/HeadquartersModulesPanel";
import CS2ModulesPanel from "../../../components/CS2ModulesPanel";
import ForumPage from "../../../components/forum/ForumPage";
import LobbyRoomDirectory from "../../../components/LobbyRoomDirectory";
import LobbyTierCards from "../../../components/LobbyTierCards";
import LobbyEvents from "../../../components/LobbyEvents";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

function authHeaders(): Record<string, string> {
  try { const t = localStorage.getItem("weered_token") || ""; return t ? { Authorization: `Bearer ${t}` } : {}; } catch { return {}; }
}

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
  MARATHON: "Marathon",
  RIOT: "League of Legends",
  FORTNITE: "Fortnite",
  TRADING: "FakeOut",
  POKER: "Poker",
  HEADQUARTERS: "Headquarters",
  CS2: "Counter-Strike 2",
};

type LobbyInfo = {
  moduleType: string;
  moduleConfig?: { twitchCategory?: string; subreddit?: string } | null;
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
  tiers?: { id: string; name: string; priceMonthly: number; color: string | null; grantLevel: number }[];
};

type Membership = { role: string; roleLevel: number } | null;
type JoinRequestStatus = { status: string; createdAt: string; denyReason?: string | null } | null;

// ── Join Gate Component ───────────────────────────────────────────────────────
function LobbyJoinGate({
  lobbyId, lobbyInfo, joinRequest, onJoined, accent,
}: {
  lobbyId: string; lobbyInfo: LobbyInfo; joinRequest: JoinRequestStatus;
  onJoined: () => void; accent: string;
}) {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingState, setPendingState] = useState<"none" | "pending" | "denied">(
    joinRequest?.status === "PENDING" ? "pending" : joinRequest?.status === "DENIED" ? "denied" : "none"
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
    maxWidth: 420, margin: "0 auto", padding: "32px 28px",
    borderRadius: 16, border: `1px solid ${accent}33`,
    background: `${accent}08`,
    textAlign: "center",
  };

  // PAID mode — show tiers
  if (mode === "PAID") {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={cardStyle}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>💎</div>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: "rgba(243,244,246,0.95)", margin: "0 0 8px" }}>Subscription Required</h3>
          <p style={{ fontSize: 13, color: "rgba(148,163,184,0.6)", margin: "0 0 20px", lineHeight: 1.5 }}>
            This lobby requires an active subscription to join. Choose a tier below to get access.
          </p>
          <LobbyTierCards lobbyId={lobbyId} />
        </div>
      </div>
    );
  }

  // APPROVAL — pending state
  if (pendingState === "pending") {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={cardStyle}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: "rgba(243,244,246,0.95)", margin: "0 0 8px" }}>Request Pending</h3>
          <p style={{ fontSize: 13, color: "rgba(148,163,184,0.6)", margin: 0, lineHeight: 1.5 }}>
            Your join request has been submitted. A lobby admin will review it.
          </p>
        </div>
      </div>
    );
  }

  // APPROVAL — denied (can re-request)
  if (pendingState === "denied") {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={cardStyle}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>❌</div>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: "rgba(243,244,246,0.95)", margin: "0 0 8px" }}>Request Denied</h3>
          {joinRequest?.denyReason && (
            <p style={{ fontSize: 12, color: "rgba(239,68,68,0.7)", margin: "0 0 12px", fontStyle: "italic" }}>
              "{joinRequest.denyReason}"
            </p>
          )}
          <p style={{ fontSize: 13, color: "rgba(148,163,184,0.6)", margin: "0 0 16px", lineHeight: 1.5 }}>
            Your request was denied. You can submit a new one.
          </p>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Add a message (optional)"
            maxLength={500}
            style={{
              width: "100%", padding: "8px 12px", borderRadius: 8, resize: "vertical",
              border: "1px solid rgba(255,255,255,0.10)", background: "rgba(0,0,0,0.3)",
              color: "rgba(243,244,246,0.9)", fontSize: 12, minHeight: 60, boxSizing: "border-box",
              marginBottom: 12, outline: "none",
            }}
          />
          {error && <div style={{ color: "#ef4444", fontSize: 12, marginBottom: 8 }}>{error}</div>}
          <button onClick={handleJoin} disabled={loading} style={{
            padding: "10px 24px", borderRadius: 10, border: `1px solid ${accent}55`,
            background: `${accent}22`, color: "rgba(243,244,246,0.95)",
            fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}>
            {loading ? "Submitting..." : "Re-submit Request"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={cardStyle}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>
          {mode === "PASSWORD" ? "🔒" : mode === "APPROVAL" ? "📋" : "👋"}
        </div>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: "rgba(243,244,246,0.95)", margin: "0 0 8px" }}>
          {mode === "OPEN" ? "Join this Lobby" : mode === "PASSWORD" ? "Password Required" : "Request to Join"}
        </h3>
        <p style={{ fontSize: 13, color: "rgba(148,163,184,0.6)", margin: "0 0 20px", lineHeight: 1.5 }}>
          {mode === "OPEN" && "Become a member to access rooms, chat, and all lobby features."}
          {mode === "PASSWORD" && "This lobby is password protected. Enter the password to join."}
          {mode === "APPROVAL" && "This lobby requires admin approval. Submit a request to join."}
        </p>

        {mode === "PASSWORD" && (
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleJoin()}
            placeholder="Enter lobby password"
            style={{
              width: "100%", padding: "10px 14px", borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.10)", background: "rgba(0,0,0,0.3)",
              color: "rgba(243,244,246,0.9)", fontSize: 13, boxSizing: "border-box",
              marginBottom: 12, outline: "none", textAlign: "center",
            }}
          />
        )}

        {mode === "APPROVAL" && (
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Why do you want to join? (optional)"
            maxLength={500}
            style={{
              width: "100%", padding: "8px 12px", borderRadius: 8, resize: "vertical",
              border: "1px solid rgba(255,255,255,0.10)", background: "rgba(0,0,0,0.3)",
              color: "rgba(243,244,246,0.9)", fontSize: 12, minHeight: 60, boxSizing: "border-box",
              marginBottom: 12, outline: "none",
            }}
          />
        )}

        {error && <div style={{ color: "#ef4444", fontSize: 12, marginBottom: 8 }}>{error}</div>}

        <button onClick={handleJoin} disabled={loading} style={{
          padding: "10px 28px", borderRadius: 10,
          border: `1px solid ${accent}55`, background: `${accent}22`,
          color: "rgba(243,244,246,0.95)", fontSize: 14, fontWeight: 700,
          cursor: loading ? "wait" : "pointer", transition: "background 0.15s",
        }}>
          {loading ? "..." : mode === "APPROVAL" ? "Submit Request" : "Join Lobby"}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function LobbyIdPage() {
  const params  = useParams();
  const lobbyId = decodeURIComponent(String(params?.id ?? "lobby"));
  const isVerified = VERIFIED_DOMAINS.has(lobbyId);

  const { join, globalRole, me } = useWeered() as any;
  const [lobbyInfo, setLobbyInfo] = useState<LobbyInfo | null>(null);
  const [membership, setMembership] = useState<Membership>(null);
  const [joinRequest, setJoinRequest] = useState<JoinRequestStatus>(null);
  const [memberChecked, setMemberChecked] = useState(false);
  const [view, setView] = useState<"rooms" | "feed" | "modules" | "events">("rooms");
  const [feedHasNew, setFeedHasNew] = useState(false);

  // Check for new feed posts
  useEffect(() => {
    const key = `weered:feedSeen:${lobbyId}`;
    fetch(`${API}/forum/posts?lobbyId=${encodeURIComponent(lobbyId)}&sort=new&limit=1`, { headers: authHeaders() })
      .then(r => r.json())
      .then(j => {
        const latest = j?.posts?.[0];
        if (!latest) return;
        const seen = localStorage.getItem(key);
        if (!seen || new Date(latest.createdAt).getTime() > Number(seen)) {
          setFeedHasNew(true);
        }
      })
      .catch(() => {});
  }, [lobbyId]);

  // Mark feed as seen when viewing
  useEffect(() => {
    if (view === "feed") {
      setFeedHasNew(false);
      try { localStorage.setItem(`weered:feedSeen:${lobbyId}`, String(Date.now())); } catch {}
    }
  }, [view, lobbyId]);

  const isStaff = globalRole === "GOD" || globalRole === "STAFF" || globalRole === "ADMIN";
  const isOwner = !!(me?.id && lobbyInfo?.ownerId && me.id === lobbyInfo.ownerId);
  const isMember = !!membership || isStaff || isOwner;

  function loadLobby() {
    fetch(`${API}/lobbies/${encodeURIComponent(lobbyId)}`, { headers: authHeaders() })
      .then(r => r.json())
      .then(j => {
        if (j.ok && j.lobby) {
          setLobbyInfo({
            moduleType:     j.lobby.moduleType,
            moduleConfig:   j.lobby.moduleConfig || null,
            accentColor:    j.lobby.accentColor,
            logoUrl:        j.lobby.logoUrl,
            bannerUrl:      j.lobby.bannerUrl,
            description:    j.lobby.description,
            enabledModules: j.lobby.enabledModules,
            verified:       j.lobby.verified,
            name:           j.lobby.name,
            ownerId:        j.lobby.ownerId || null,
            joinMode:       j.lobby.joinMode || "OPEN",
            _count:         j.lobby._count,
            tiers:          j.lobby.tiers || [],
          });
          if (j.lobby.moduleType === "BUNGIE" || j.lobby.moduleType === "TWITCH" || j.lobby.moduleType === "MARATHON" || j.lobby.moduleType === "MLB" || j.lobby.moduleType === "PGA" || j.lobby.moduleType === "NEWS" || j.lobby.moduleType === "RIOT" || j.lobby.moduleType === "FORTNITE" || j.lobby.moduleType === "TRADING" || j.lobby.moduleType === "POKER" || j.lobby.moduleType === "HEADQUARTERS" || j.lobby.moduleType === "CS2") {
            setView("modules");
          } else {
            setView("rooms");
          }
          setMembership(j.membership || null);
          setJoinRequest(j.joinRequest || null);
          setMemberChecked(true);
        }
      })
      .catch(() => { setMemberChecked(true); });
  }

  useEffect(() => { loadLobby(); }, [lobbyId]);

  // Only join WS room if member (or staff/owner)
  useEffect(() => {
    if (lobbyId && memberChecked && isMember) join(lobbyId);
  }, [lobbyId, memberChecked, isMember]);

  const hasModules = lobbyInfo?.moduleType === "BUNGIE" || lobbyInfo?.moduleType === "TWITCH" || lobbyInfo?.moduleType === "MARATHON" || lobbyInfo?.moduleType === "MLB" || lobbyInfo?.moduleType === "PGA" || lobbyInfo?.moduleType === "NEWS" || lobbyInfo?.moduleType === "RIOT" || lobbyInfo?.moduleType === "FORTNITE" || lobbyInfo?.moduleType === "TRADING" || lobbyInfo?.moduleType === "POKER" || lobbyInfo?.moduleType === "HEADQUARTERS" || lobbyInfo?.moduleType === "CS2";
  const accent     = lobbyInfo?.accentColor || undefined;
  const gameName   = lobbyInfo?.moduleConfig?.twitchCategory || MODULE_GAME_NAMES[lobbyInfo?.moduleType || ""] || lobbyId;
  const showAdmin  = isStaff || isOwner || (membership && membership.roleLevel >= 3);

  return (
    <div
      className="weered-lobby-page"
      style={{
        display: "flex", flexDirection: "column", gap: 8,
        height: "calc(100vh - 16px)", minHeight: 0,
        "--lobby-accent":     accent || "#5800E5",
        "--lobby-accent-dim": accent ? `${accent}22` : "rgba(88,0,229,0.13)",
        "--lobby-accent-mid": accent ? `${accent}55` : "rgba(88,0,229,0.33)",
      } as React.CSSProperties}
    >
      <LobbyHeaderBar
        title={lobbyInfo?.name || lobbyId}
        lobbyId={lobbyId}
        accentColor={accent}
        logoUrl={lobbyInfo?.logoUrl}
        verified={isVerified || lobbyInfo?.verified}
      />

      <div className="weered-lobby-body" style={{
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

        {/* Gate: show join screen if not a member */}
        {memberChecked && !isMember && lobbyInfo ? (
          <LobbyJoinGate
            lobbyId={lobbyId}
            lobbyInfo={lobbyInfo}
            joinRequest={joinRequest}
            accent={accent || "#5800E5"}
            onJoined={loadLobby}
          />
        ) : (
          <>
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
              <TabBtn active={view === "feed"} accent={undefined} onClick={() => setView("feed")}>
                Feed
                {feedHasNew && view !== "feed" && (
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e", display: "inline-block", marginLeft: 5, verticalAlign: "middle" }} />
                )}
              </TabBtn>
              <TabBtn active={view === "events"} accent={accent} onClick={() => setView("events")}>Events</TabBtn>

              {/* Leave button */}
              {membership && membership.roleLevel < 5 && (
                <button
                  onClick={async () => {
                    if (!confirm("Leave this lobby?")) return;
                    await fetch(`${API}/lobbies/${encodeURIComponent(lobbyId)}/leave`, {
                      method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() },
                    });
                    setMembership(null);
                    setMemberChecked(true);
                  }}
                  style={{
                    marginLeft: 4, padding: "5px 10px", borderRadius: 7,
                    border: "1px solid rgba(239,68,68,0.15)", background: "rgba(239,68,68,0.06)",
                    fontSize: 10, color: "rgba(239,68,68,0.5)", cursor: "pointer",
                    fontWeight: 600, letterSpacing: "0.04em",
                    transition: "all .15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.12)"; e.currentTarget.style.color = "rgba(239,68,68,0.8)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(239,68,68,0.06)"; e.currentTarget.style.color = "rgba(239,68,68,0.5)"; }}
                >
                  Leave
                </button>
              )}

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
            <div style={{ flex: 1, minHeight: 0, overflow: "auto", display: "flex", flexDirection: "column" }}>
              {view === "modules" && hasModules ? (
                lobbyInfo?.moduleType === "MARATHON" ? (
                  <MarathonModulesPanel lobbyId={lobbyId} accentColor={accent} style={{ flex: 1, minHeight: 0 }} />
                ) : lobbyInfo?.moduleType === "MLB" ? (
                  <MlbModulesPanel lobbyId={lobbyId} accentColor={accent} style={{ flex: 1, minHeight: 0 }} />
                ) : lobbyInfo?.moduleType === "PGA" ? (
                  <PgaModulesPanel lobbyId={lobbyId} accentColor={accent} style={{ flex: 1, minHeight: 0 }} />
                ) : lobbyInfo?.moduleType === "NEWS" ? (
                  <NewsModulesPanel lobbyId={lobbyId} accentColor={accent} style={{ flex: 1, minHeight: 0 }} />
                ) : lobbyInfo?.moduleType === "RIOT" ? (
                  <LeagueModulesPanel lobbyId={lobbyId} gameName={gameName} accentColor={accent} style={{ flex: 1, minHeight: 0 }} />
                ) : lobbyInfo?.moduleType === "FORTNITE" ? (
                  <FortniteModulesPanel lobbyId={lobbyId} gameName={gameName} accentColor={accent} style={{ flex: 1, minHeight: 0 }} />
                ) : lobbyInfo?.moduleType === "TRADING" ? (
                  <TradingModulesPanel lobbyId={lobbyId} accent={accent} />
                ) : lobbyInfo?.moduleType === "POKER" ? (
                  <PokerTable roomId={lobbyId} myId={me?.id || ""} myName={me?.name || ""} />
                ) : lobbyInfo?.moduleType === "HEADQUARTERS" ? (
                  <HeadquartersModulesPanel lobbyId={lobbyId} accentColor={accent} style={{ flex: 1, minHeight: 0 }} />
                ) : lobbyInfo?.moduleType === "CS2" ? (
                  <CS2ModulesPanel lobbyId={lobbyId} gameName={gameName} accentColor={accent} style={{ flex: 1, minHeight: 0 }} />
                ) : (
                  <LobbyModulesPanel lobbyId={lobbyId} gameName={gameName} accentColor={accent} style={{ flex: 1, minHeight: 0 }} />
                )
              ) : view === "rooms" ? (
                <LobbyRoomDirectory lobbyId={lobbyId} accentColor={accent} bannerUrl={lobbyInfo?.bannerUrl} style={{ flex: 1, minHeight: 0 }} />
              ) : view === "events" ? (
                <LobbyEvents lobbyId={lobbyId} accent={accent} />
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
  );
}

function TabBtn({ active, accent, onClick, children }: { active: boolean; accent?: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: "5px 14px", borderRadius: 7, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer",
      background: active ? (accent ? `${accent}25` : "rgba(88,0,229,.15)") : "transparent",
      color: active ? "rgba(243,244,246,.92)" : "rgba(148,163,184,.6)",
      transition: "background .15s",
      fontFamily: "inherit",
    }}>
      {children}
    </button>
  );
}
