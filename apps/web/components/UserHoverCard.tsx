"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { avatarBg } from "../lib/avatarColor";
import RoleIcon, { TierIcon, getRoleDisplayName, getRoleColor } from "./RoleIcon";
import { SteamIcon, TwitchIcon, XboxIcon, PlaystationIcon } from "./PresenceRow";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

type Profile = {
  id: string; name: string; bio: string;
  notoriety: number; notorietyRank?: string;
  tier: string; globalRole: string;
  joinedAt: string; lastSeen: string;
  roomsHosted: number;
  avatar?: string; avatarColor?: string;
  steamId?: string | null;
  twitchLogin?: string | null;
  xboxGamertag?: string | null;
  primaryCrew?: {
    id: string; name: string; tag: string;
    logoUrl: string | null; accentColor: string | null; role: string;
  } | null;
};

type GuardianInfo = {
  displayName: string;
  characters: {
    className: string; light: number; raceName: string;
    emblemBackgroundPath: string | null;
    dateLastPlayed: string; minutesPlayedTotal: number;
  }[];
};

const TIER_CONFIG: Record<string, { color: string; label: string }> = {
  INNOCENT: { color: "#94a3b8", label: "Innocent" },
  INDICTED: { color: "#a78bfa", label: "Indicted" },
  FELON:    { color: "#f97316", label: "Felon" },
  KINGPIN:  { color: "#eab308", label: "Kingpin" },
};

const ROLE_COLORS: Record<string, string> = {
  GOD: "#facc15", ADMIN: "#f87171", STAFF: "#60a5fa", SUPPORT: "#34d399", MOD: "#a78bfa",
};

function lastSeenText(iso: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 2) return "Online now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function formatPlaytime(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

type UserBadgeDisplay = { id?: string; name?: string; description?: string; iconUrl?: string; rarity?: number; earnedAt?: string };

const BADGE_RARITY_COLORS = ["#94a3b8", "#22c55e", "#3b82f6", "#a855f7", "#f59e0b"]; // common, uncommon, rare, epic, legendary

// ── Cache to avoid re-fetching ──────────────────────────────────────────────
const profileCache = new Map<string, { data: Profile; at: number }>();
const guardianCache = new Map<string, { data: GuardianInfo | null; at: number }>();
const badgeCache = new Map<string, { data: UserBadgeDisplay[]; at: number }>();
const CACHE_TTL = 60_000; // 1 min

export type HoverCardPosition = { x: number; y: number };

export interface UserHoverCardProps {
  userId: string;
  userName: string;
  position: HoverCardPosition;
  lobbyModuleType?: string; // "BUNGIE" to show guardian stats
  isAway?: boolean;         // live AFK flag from presence; profile endpoint doesn't carry this
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onViewProfile?: (userId: string) => void;
  onMessage?: (userId: string, userName: string) => void;
}

export default function UserHoverCard({
  userId, userName, position, lobbyModuleType, isAway,
  onClose, onMouseEnter, onMouseLeave,
  onViewProfile, onMessage,
}: UserHoverCardProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [guardian, setGuardian] = useState<GuardianInfo | null>(null);
  const [badges, setBadges] = useState<UserBadgeDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const cardRef = useRef<HTMLDivElement>(null);

  // Fetch profile
  useEffect(() => {
    if (!userId) return;
    const cached = profileCache.get(userId);
    if (cached && Date.now() - cached.at < CACHE_TTL) {
      setProfile(cached.data);
      setLoading(false);
      return;
    }
    setLoading(true);
    const token = localStorage.getItem("weered_token") || "";
    fetch(`${API}/profile/${userId}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.json())
      .then(d => {
        if (d && !d.error) {
          setProfile(d);
          profileCache.set(userId, { data: d, at: Date.now() });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  // Fetch Bungie guardian if in Destiny lobby
  useEffect(() => {
    if (lobbyModuleType !== "BUNGIE" || !profile?.name) return;
    const cached = guardianCache.get(profile.name);
    if (cached && Date.now() - cached.at < CACHE_TTL) {
      setGuardian(cached.data);
      return;
    }
    fetch(`${API}/bungie/player/${encodeURIComponent(profile.name)}`)
      .then(r => r.json())
      .then(d => {
        if (d?.ok && d.found && d.characters?.length) {
          const info: GuardianInfo = { displayName: d.player?.displayName || profile.name, characters: d.characters };
          setGuardian(info);
          guardianCache.set(profile.name, { data: info, at: Date.now() });
        } else {
          guardianCache.set(profile.name, { data: null, at: Date.now() });
        }
      })
      .catch(() => {});
  }, [lobbyModuleType, profile?.name]);

  // Fetch Windrose mod kit — subtle line, only when the hover is on a
  // Windrose lobby. Nothing fancy; just "Running N mods" if they have any.
  const [modCount, setModCount] = useState<number | null>(null);
  useEffect(() => {
    if (!userId || lobbyModuleType !== "WINDROSE") { setModCount(null); return; }
    fetch(`${API}/users/${encodeURIComponent(userId)}/mods`)
      .then(r => r.json())
      .then(d => setModCount(Array.isArray(d?.installs) ? d.installs.length : 0))
      .catch(() => setModCount(null));
  }, [userId, lobbyModuleType]);

  // Fetch badges
  useEffect(() => {
    if (!userId) return;
    const cached = badgeCache.get(userId);
    if (cached && Date.now() - cached.at < CACHE_TTL) {
      setBadges(cached.data);
      return;
    }
    fetch(`${API}/badges/user/${userId}`)
      .then(r => r.json())
      .then(d => {
        const list = d?.badges || [];
        setBadges(list);
        badgeCache.set(userId, { data: list, at: Date.now() });
      })
      .catch(() => {});
  }, [userId]);

  // Clamp position to viewport
  const [pos, setPos] = useState(position);
  useEffect(() => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    let { x, y } = position;
    if (x + rect.width > window.innerWidth - 12) x = window.innerWidth - rect.width - 12;
    if (y + rect.height > window.innerHeight - 12) y = window.innerHeight - rect.height - 12;
    if (x < 12) x = 12;
    if (y < 12) y = 12;
    setPos({ x, y });
  }, [position, profile, guardian]);

  const tier = TIER_CONFIG[profile?.tier || "INNOCENT"] || TIER_CONFIG.INNOCENT;
  const roleColor = ROLE_COLORS[profile?.globalRole || ""] || null;
  const aColor = profile?.avatarColor || avatarBg(userName);
  const lastSeen = profile?.lastSeen ? lastSeenText(profile.lastSeen) : null;
  const isOnline = lastSeen === "Online now";

  return createPortal(
    <div
      ref={cardRef}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: "fixed",
        left: pos.x, top: pos.y,
        width: 280,
        background: "rgba(12,12,20,.95)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: `1px solid ${tier.color}25`,
        borderRadius: 14,
        boxShadow: `0 16px 48px rgba(0,0,0,.6), 0 0 20px ${tier.color}10`,
        zIndex: 99999,
        overflow: "hidden",
        fontFamily: FONT,
        color: "rgba(243,244,246,.92)",
        animation: "hoverCardIn 0.15s ease",
      }}
    >
      <style>{`@keyframes hoverCardIn { from { opacity: 0; transform: translateY(4px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }`}</style>

      {/* Tier banner */}
      <div style={{
        height: 36, background: `linear-gradient(135deg, ${tier.color}12, transparent 60%)`,
        borderBottom: `1px solid ${tier.color}15`,
        position: "relative",
      }}>
        <div style={{
          position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
          fontSize: 8, fontWeight: 900, letterSpacing: "2px", textTransform: "uppercase",
          color: tier.color, opacity: 0.4,
        }}>
          {tier.label}
        </div>
      </div>

      {/* Avatar + name */}
      <div style={{ padding: "0 14px", marginTop: -18 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginBottom: 8 }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%",
            background: profile?.avatar ? "transparent" : aColor,
            border: `2px solid ${tier.color}`,
            boxShadow: `0 0 10px ${tier.color}30`,
            overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontWeight: 900, color: "#fff", flexShrink: 0,
          }}>
            {profile?.avatar ? (
              <img src={profile.avatar} alt={userName + " avatar"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : userName[0]?.toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0, paddingBottom: 2 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 800 }}>{profile?.name || userName}</span>
              {isOnline && !isAway && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e" }} />}
              {isOnline && isAway && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "1px 6px", borderRadius: 4,
                  background: "rgba(250,204,21,.12)", border: "1px solid rgba(250,204,21,.4)",
                  color: "#fde68a", fontSize: 8, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase",
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#facc15" }} />
                  Lying low
                </span>
              )}
            </div>
            <div style={{ fontSize: 9, opacity: 0.35, marginTop: 1 }}>
              {lastSeen && !isOnline && lastSeen}
              {profile?.globalRole && profile.globalRole !== "USER" && (
                <span style={{ color: roleColor || "inherit", fontWeight: 700, marginLeft: lastSeen && !isOnline ? 6 : 0 }}>
                  {profile.globalRole}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Bio */}
        {profile?.bio && (
          <div style={{
            fontSize: 11, lineHeight: 1.5, opacity: 0.5, marginBottom: 8,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any,
            overflow: "hidden",
          }}>
            {profile.bio}
          </div>
        )}

        {/* Stats row */}
        {profile && (
          <div style={{
            display: "flex", gap: 12, marginBottom: 10, fontSize: 10,
            padding: "6px 0", borderTop: "1px solid rgba(255,255,255,.04)",
          }}>
            <div><span style={{ fontWeight: 800, color: "#D4A017" }}>{profile.notoriety}</span> <span style={{ opacity: 0.35 }}>XP</span></div>
            <div><span style={{ fontWeight: 800 }}>{profile.roomsHosted}</span> <span style={{ opacity: 0.35 }}>rooms</span></div>
            {profile.notorietyRank && (
              <div style={{ marginLeft: "auto", fontWeight: 700, opacity: 0.4, fontStyle: "italic" }}>{(profile as any).notorietyRank}</div>
            )}
          </div>
        )}

        {/* Crew flair — subtle row: icon + name + tag. Links to crew page.
            Hidden if user isn't in a crew so there's no empty slot. */}
        {profile?.primaryCrew && (() => {
          const pc = profile.primaryCrew;
          const accent = pc.accentColor && /^#[0-9a-f]{6}$/i.test(pc.accentColor) ? pc.accentColor : "#c9a066";
          return (
            <a
              href={`/crew/${encodeURIComponent(pc.id)}`}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 8px", marginBottom: 10, borderRadius: 6,
                background: `${accent}10`, border: `1px solid ${accent}22`,
                textDecoration: "none", color: "inherit",
              }}
              title={`${pc.name}${pc.tag ? ` · [${pc.tag}]` : ""}`}
            >
              <div style={{
                width: 22, height: 22, borderRadius: 3, flexShrink: 0,
                backgroundImage: pc.logoUrl ? `url(${pc.logoUrl})` : `linear-gradient(135deg, ${accent}, #8a6b3e)`,
                backgroundSize: "cover", backgroundPosition: "center",
                border: `1px solid ${accent}aa`,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: accent, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {pc.name}
                </div>
                {pc.tag && (
                  <div style={{ fontSize: 9, opacity: 0.55, fontFamily: "ui-monospace, monospace", letterSpacing: "0.5px" }}>
                    [{pc.tag}] · {String(pc.role).toLowerCase()}
                  </div>
                )}
              </div>
            </a>
          );
        })()}

        {/* Identity glossary — role, tier, linked platforms */}
        {profile && (() => {
          const rows: { icon: React.ReactNode; label: string; value?: string; color?: string }[] = [];
          if (profile.globalRole && profile.globalRole !== "USER") {
            rows.push({
              icon: <RoleIcon role={profile.globalRole} size={16} />,
              label: getRoleDisplayName(profile.globalRole),
              value: profile.globalRole,
              color: getRoleColor(profile.globalRole),
            });
          }
          if (profile.tier && profile.tier !== "INNOCENT") {
            rows.push({
              icon: <TierIcon tier={profile.tier} size={16} />,
              label: profile.tier.charAt(0) + profile.tier.slice(1).toLowerCase(),
              value: "tier",
              color: TIER_CONFIG[profile.tier]?.color,
            });
          }
          if (profile.steamId) {
            rows.push({ icon: <SteamIcon size={14} />, label: "Steam", value: "Linked", color: "#66c0f4" });
          }
          if (profile.twitchLogin) {
            rows.push({ icon: <TwitchIcon size={14} />, label: "Twitch", value: profile.twitchLogin, color: "#9146ff" });
          }
          if (profile.xboxGamertag) {
            rows.push({ icon: <XboxIcon size={14} />, label: "Xbox", value: profile.xboxGamertag, color: "#9ee493" });
          }
          if (rows.length === 0) return null;
          return (
            <div style={{
              marginBottom: 10,
              padding: "6px 10px",
              borderRadius: 8,
              background: "rgba(255,255,255,.02)",
              border: "1px solid rgba(255,255,255,.06)",
              display: "flex", flexDirection: "column", gap: 4,
            }}>
              <div style={{ fontSize: 9, fontWeight: 800, opacity: 0.35, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 2 }}>
                Identity
              </div>
              {rows.map((r, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  fontSize: 11,
                }}>
                  <span style={{ display: "inline-flex", width: 18, justifyContent: "center", flexShrink: 0 }}>{r.icon}</span>
                  <span style={{ fontWeight: 700, color: r.color || "rgba(243,244,246,.85)" }}>{r.label}</span>
                  {r.value && r.value !== r.label && (
                    <span style={{ marginLeft: "auto", fontSize: 10, opacity: 0.55, fontFamily: "ui-monospace, monospace" }}>
                      {r.value}
                    </span>
                  )}
                </div>
              ))}
            </div>
          );
        })()}

        {/* Guardian stats (Destiny lobbies only) */}
        {guardian && guardian.characters.length > 0 && (
          <div style={{
            marginBottom: 10, padding: "8px 10px", borderRadius: 8,
            background: "rgba(79,136,198,.08)", border: "1px solid rgba(79,136,198,.15)",
          }}>
            <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: "1.5px", textTransform: "uppercase", opacity: 0.4, marginBottom: 6, color: "#4F88C6" }}>
              Guardian
            </div>
            {guardian.characters.slice(0, 3).map((c, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "3px 0",
                borderBottom: i < Math.min(guardian.characters.length, 3) - 1 ? "1px solid rgba(255,255,255,.04)" : "none",
              }}>
                {c.emblemBackgroundPath && (
                  <img src={c.emblemBackgroundPath} alt={c.className + " emblem"} style={{ width: 32, height: 16, borderRadius: 3, objectFit: "cover" }} />
                )}
                <span style={{ fontSize: 11, fontWeight: 700, flex: 1 }}>{c.className}</span>
                <span style={{ fontSize: 10, opacity: 0.5 }}>{c.raceName}</span>
                <span style={{
                  fontSize: 11, fontWeight: 800, color: "#fcd34d",
                  fontFamily: "monospace",
                }}>
                  {c.light}
                </span>
              </div>
            ))}
            <div style={{ fontSize: 9, opacity: 0.3, marginTop: 4 }}>
              {formatPlaytime(guardian.characters.reduce((s, c) => s + c.minutesPlayedTotal, 0))} played
            </div>
          </div>
        )}

        {/* Badges */}
        {badges.length > 0 && (
          <div style={{
            marginBottom: 10, padding: "6px 10px", borderRadius: 8,
            background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.06)",
          }}>
            <div style={{ fontSize: 9, fontWeight: 800, opacity: 0.35, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 5 }}>
              Badges
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {badges.slice(0, 8).map((b, i) => {
                const color = BADGE_RARITY_COLORS[Math.min((b.rarity || 1) - 1, 4)];
                return (
                  <div key={i} title={`${b.name || "Badge"} — ${b.description || ""}`} style={{
                    display: "flex", alignItems: "center", gap: 3,
                    padding: "2px 6px", borderRadius: 4,
                    background: `${color}10`, border: `1px solid ${color}30`,
                    fontSize: 9, fontWeight: 700, color,
                    cursor: "default",
                  }}>
                    {b.iconUrl ? (
                      <img src={b.iconUrl} alt={(b.name || "Badge") + " icon"} style={{ width: 12, height: 12, borderRadius: 2 }} />
                    ) : (
                      <span style={{ fontSize: 10 }}>🏅</span>
                    )}
                    {b.name || "Badge"}
                  </div>
                );
              })}
              {badges.length > 8 && (
                <span style={{ fontSize: 9, opacity: 0.3, alignSelf: "center" }}>+{badges.length - 8}</span>
              )}
            </div>
          </div>
        )}

        {/* Windrose mod kit — one-line teaser, click to view full list.
            Intentionally quiet: no section header, no chrome. */}
        {lobbyModuleType === "WINDROSE" && modCount !== null && modCount > 0 && (
          <div
            onClick={() => onViewProfile?.(userId)}
            style={{
              marginBottom: 10, padding: "5px 10px", borderRadius: 6,
              fontSize: 10, fontWeight: 600, letterSpacing: "0.3px",
              color: "rgba(201,160,102,0.85)", cursor: "pointer",
              fontStyle: "italic", opacity: 0.82,
            }}
            title="Open profile to see their mod kit"
          >
            Running {modCount} mod{modCount === 1 ? "" : "s"} · view kit
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 6, paddingBottom: 12 }}>
          {onViewProfile && (
            <button onClick={() => onViewProfile(userId)} style={{
              flex: 1, padding: "6px 0", borderRadius: 6,
              border: "1px solid rgba(167,139,250,.2)", background: "rgba(167,139,250,.08)",
              color: "rgba(167,139,250,.8)", fontSize: 10, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
            }}>
              Profile
            </button>
          )}
          {onMessage && (
            <button onClick={() => onMessage(userId, profile?.name || userName)} style={{
              flex: 1, padding: "6px 0", borderRadius: 6,
              border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.04)",
              color: "rgba(255,255,255,.5)", fontSize: 10, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
            }}>
              Message
            </button>
          )}
        </div>
      </div>

      {loading && !profile && (
        <div style={{ padding: "20px 14px", opacity: 0.3, fontSize: 11 }}>Loading...</div>
      )}
    </div>,
    document.body
  );
}

// ── Hook for easy integration ───────────────────────────────────────────────

export function useUserHover(opts?: { lobbyModuleType?: string; onViewProfile?: (id: string) => void; onMessage?: (id: string, name: string) => void }) {
  const [hover, setHover] = useState<{ userId: string; userName: string; pos: HoverCardPosition; isAway?: boolean } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openHover = useCallback((userId: string, userName: string, el: HTMLElement, hints?: { isAway?: boolean }) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const r = el.getBoundingClientRect();
    setHover({ userId, userName, pos: { x: r.right + 8, y: r.top }, isAway: hints?.isAway });
  }, []);

  const scheduleClose = useCallback((ms = 160) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setHover(null), ms);
  }, []);

  const cancelClose = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const card = hover ? (
    <UserHoverCard
      userId={hover.userId}
      userName={hover.userName}
      position={hover.pos}
      lobbyModuleType={opts?.lobbyModuleType}
      isAway={hover.isAway}
      onClose={() => setHover(null)}
      onMouseEnter={cancelClose}
      onMouseLeave={() => scheduleClose(180)}
      onViewProfile={opts?.onViewProfile}
      onMessage={opts?.onMessage}
    />
  ) : null;

  return { openHover, scheduleClose, cancelClose, card };
}
