"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useWeered } from "./WeeredProvider";
import { useOverlay } from "./overlays/OverlayProvider";
import RoleIcon, { TierIcon } from "./RoleIcon";
import { avatarBg } from "../lib/avatarColor";
import NotorietyBar from "./NotorietyBar";
import FlairBadge from "./FlairBadge";
import { useEquippedFlair } from "../lib/useEquippedFlair";

function useFitText(ref: any, text: string, sizes: number[]): number {
  const [size, setSize] = useState(sizes[0]);
  useLayoutEffect(() => {
    setSize(sizes[0]);
  }, [text, sizes[0]]);
  useLayoutEffect(() => {
    const el = ref.current as HTMLElement | null;
    if (!el) return;
    if (el.scrollWidth > el.clientWidth + 1) {
      const idx = sizes.indexOf(size);
      if (idx >= 0 && idx < sizes.length - 1) {
        setSize(sizes[idx + 1]);
      }
    }
  });
  return size;
}

function pickFirstString(...vals: any[]): string {
  for (const v of vals) if (typeof v === "string" && v.trim()) return v.trim();
  return "";
}

function normRole(x: string) {
  const s = String(x || "")
    .trim()
    .toUpperCase();
  if (!s) return "";
  if (s === "GOD") return "GOD";
  if (s === "SUPPORT") return "SUPPORT";
  if (s === "STAFF") return "STAFF";
  if (s === "ADMIN") return "ADMIN";
  if (s === "MOD") return "MOD";
  if (s === "OWNER") return "OWNER";
  if (s === "MEMBER") return "MEMBER";
  return s.slice(0, 14);
}

const ROLE_DISPLAY: Record<string, string> = {
  GOD: "GODFATHER",
  ADMIN: "LIEUTENANT",
  STAFF: "ENFORCER",
  SUPPORT: "BACKUP",
  MOD: "CAPTAIN",
  OWNER: "FOUNDER",
  MEMBER: "MEMBER",
};
const ROLE_DISPLAY_WINDROSE: Record<string, string> = {
  GOD: "ADMIRAL",
  ADMIN: "FIRST MATE",
  STAFF: "BOATSWAIN",
  SUPPORT: "LOOKOUT",
  MOD: "QUARTERMASTER",
  OWNER: "CAPTAIN",
  MEMBER: "CREWMATE",
};
const ROLE_DISPLAY_HELLDIVERS: Record<string, string> = {
  GOD: "SUPREME COMMANDER",
  ADMIN: "GENERAL",
  STAFF: "COMMANDER",
  SUPPORT: "OFFICER",
  MOD: "DRILL SERGEANT",
  OWNER: "DIVE LEAD",
  MEMBER: "HELLDIVER",
};
function roleDisplay(dbRole: string, lobbyTheme?: string | null): string {
  if (lobbyTheme === "windrose" && ROLE_DISPLAY_WINDROSE[dbRole])
    return ROLE_DISPLAY_WINDROSE[dbRole];
  if (lobbyTheme === "helldivers2" && ROLE_DISPLAY_HELLDIVERS[dbRole])
    return ROLE_DISPLAY_HELLDIVERS[dbRole];
  return ROLE_DISPLAY[dbRole] || dbRole;
}

const IconDock = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="4" width="20" height="14" rx="3" />
    <path d="M7 9.5h10M7 13h6" opacity=".6" />
  </svg>
);

function UserCornerFlair({ userId }: { userId?: string }) {
  const f = useEquippedFlair(userId || null);
  if (!f) return null;
  if (f.kind !== "BADGE" && f.kind !== "NAMEPLATE") return null;
  return (
    <div
      style={{
        marginTop: 4,
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 10,
        fontWeight: 700,
        color: f.color || "rgba(243,244,246,.85)",
      }}
    >
      <FlairBadge flair={f} size="sm" />
      <span style={{ textTransform: "uppercase", letterSpacing: "1px" }}>{f.name}</span>
    </div>
  );
}

export default function UserCorner() {
  const { me, role, globalRole, currentLobbyId, isAway, setAway } = useWeered() as any;
  const { openSheet } = useOverlay();

  const [lobbyTheme, setLobbyTheme] = useState<string | null>(null);
  useEffect(() => {
    const read = () => setLobbyTheme(document.documentElement.getAttribute("data-weered-lobby"));
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-weered-lobby"],
    });
    return () => obs.disconnect();
  }, []);
  const burnerLabel =
    lobbyTheme === "windrose"
      ? "Bottle"
      : lobbyTheme === "destiny2"
        ? "Transmat"
        : lobbyTheme === "helldivers2"
          ? "Comms"
          : "Burner";

  const API_BASE = (process.env.NEXT_PUBLIC_API_BASE as string) || "http://127.0.0.1:4000";
  const [lobbyLogo, setLobbyLogo] = React.useState<string | null>(null);
  const [lobbyAccent, setLobbyAccent] = React.useState<string | null>(null);
  const prevLobbyRef = React.useRef<string>("");
  React.useEffect(() => {
    const lid = currentLobbyId || "";
    if (lid === prevLobbyRef.current) return;
    prevLobbyRef.current = lid;
    if (!lid || lid === "lobby") {
      setLobbyLogo(null);
      setLobbyAccent(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/lobbies/${encodeURIComponent(lid)}`);
        const j = await r.json();
        if (!cancelled && j?.ok && j?.lobby) {
          setLobbyLogo(j.lobby.logoUrl || null);
          setLobbyAccent(j.lobby.accentColor || null);
        }
      } catch {
        if (!cancelled) {
          setLobbyLogo(null);
          setLobbyAccent(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentLobbyId]);

  const name = useMemo(() => pickFirstString(me?.name, me?.username, "Guest"), [me]);
  const [profileAvatar, setProfileAvatar] = useState<string | null | undefined>(undefined);
  const [profileColor, setProfileColor] = useState<string | null | undefined>(undefined);
  const avatarUrl = (profileAvatar !== undefined ? profileAvatar : me?.avatar) || null;

  const [colorOverrides, setColorOverrides] = React.useState<{
    panelBgColor?: string | null;
    panelAccentColor?: string | null;
  }>({});
  React.useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem("weered_user");
        if (!raw) return;
        const u = JSON.parse(raw);
        setColorOverrides({
          panelBgColor: u?.panelBgColor || null,
          panelAccentColor: u?.panelAccentColor || null,
        });
      } catch {}
    };
    read();
    const onColors = () => read();
    window.addEventListener("weered:profileColors", onColors);
    return () => window.removeEventListener("weered:profileColors", onColors);
  }, []);

  const [dockUnread, setDockUnread] = React.useState(() => {
    try {
      return Math.max(0, Number(localStorage.getItem("weered:dock:unread")) || 0);
    } catch {
      return 0;
    }
  });

  React.useEffect(() => {
    const onUnread = (e: Event) => {
      const count = Math.max(0, Number((e as CustomEvent)?.detail?.count) || 0);
      setDockUnread(count);
      try {
        localStorage.setItem("weered:dock:unread", String(count));
      } catch {}
    };
    const poll = () => {
      try {
        const v = Math.max(0, Number(localStorage.getItem("weered:dock:unread")) || 0);
        setDockUnread(v);
      } catch {}
    };
    const interval = setInterval(poll, 10000);
    window.addEventListener("weered:dock:unread", onUnread);
    return () => {
      window.removeEventListener("weered:dock:unread", onUnread);
      clearInterval(interval);
    };
  }, []);

  React.useEffect(() => {
    const handler = () => {
      setDockUnread(0);
      try {
        localStorage.setItem("weered:dock:unread", "0");
      } catch {}
    };
    window.addEventListener("weered:dock:open", handler);
    window.addEventListener("weered:dock:toggle", handler);
    return () => {
      window.removeEventListener("weered:dock:open", handler);
      window.removeEventListener("weered:dock:toggle", handler);
    };
  }, []);

  const gRole = useMemo(() => normRole(globalRole || ""), [globalRole]);
  const roomRole = useMemo(() => normRole(pickFirstString(role)), [role]);
  const initial = (name || "G").trim().slice(0, 1).toUpperCase();

  const profileUserId = (me?.id ?? me?.userId ?? me?.name ?? me?.username ?? "me").toString();

  const [primaryCrew, setPrimaryCrew] = useState<{
    id: string;
    name: string;
    tag: string;
    logoUrl: string | null;
    accentColor: string | null;
  } | null>(null);
  const [notorietyRank, setNotorietyRank] = useState<string>("");
  const [notorietyScore, setNotorietyScore] = useState<number | null>(null);
  const [nameEffect, setNameEffect] = useState<string | null>(null);
  const [avatarFrame, setAvatarFrame] = useState<string | null>(null);

  useEffect(() => {
    if (!avatarFrame) {
      document.documentElement.removeAttribute("data-uc-frame");
      return;
    }
    document.documentElement.setAttribute("data-uc-frame", avatarFrame);
    return () => {
      document.documentElement.removeAttribute("data-uc-frame");
    };
  }, [avatarFrame]);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<{ text: string; emoji: string }>({ text: "", emoji: "" });
  const [editingStatus, setEditingStatus] = useState(false);
  const [draftStatus, setDraftStatus] = useState<{ text: string; emoji: string }>({
    text: "",
    emoji: "",
  });
  const loadProfile = React.useCallback(() => {
    if (!me?.id) {
      setPrimaryCrew(null);
      setNotorietyRank("");
      setProfileAvatar(undefined);
      return () => {};
    }
    let cancelled = false;
    const token = (typeof window !== "undefined" ? localStorage.getItem("weered_token") : "") || "";
    fetch(`${API_BASE}/profile/${encodeURIComponent(me.id)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j?.primaryCrew) {
          setPrimaryCrew({
            id: j.primaryCrew.id,
            name: j.primaryCrew.name,
            tag: j.primaryCrew.tag || "",
            logoUrl: j.primaryCrew.logoUrl || null,
            accentColor: j.primaryCrew.accentColor || null,
          });
        } else {
          setPrimaryCrew(null);
        }
        if (j?.notorietyRank) setNotorietyRank(String(j.notorietyRank));
        if (typeof j?.notoriety === "number") setNotorietyScore(j.notoriety);
        setNameEffect(j?.nameEffect || null);
        setAvatarFrame(j?.avatarFrame || null);
        if (j?.bannerUrl) setBannerUrl(String(j.bannerUrl));
        else setBannerUrl(null);
        setStatus({ text: j?.statusText || "", emoji: j?.statusEmoji || "" });
        setProfileAvatar(
          typeof j?.avatar === "string" && j.avatar
            ? j.avatar
            : j && "avatar" in j
              ? null
              : undefined,
        );
        setProfileColor(typeof j?.avatarColor === "string" && j.avatarColor ? j.avatarColor : null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [me?.id, API_BASE]);

  useEffect(() => {
    let cancel = loadProfile();
    const reload = () => {
      cancel();
      cancel = loadProfile();
    };
    window.addEventListener("weered:profile:updated", reload);
    window.addEventListener("weered:profileColors", reload);
    window.addEventListener("weered:avatarColor", reload);
    return () => {
      cancel();
      window.removeEventListener("weered:profile:updated", reload);
      window.removeEventListener("weered:profileColors", reload);
      window.removeEventListener("weered:avatarColor", reload);
    };
  }, [loadProfile]);

  const liveAvatarColor = profileColor || (me?.avatarColor as string | undefined);
  const [stickyAvatarColor, setStickyAvatarColor] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (typeof liveAvatarColor === "string" && /^#[0-9a-f]{6}$/i.test(liveAvatarColor)) {
      setStickyAvatarColor(liveAvatarColor);
    }
  }, [liveAvatarColor]);

  const rawPanelAccent = colorOverrides.panelAccentColor || me?.panelAccentColor;
  const rawPanelBg = colorOverrides.panelBgColor || me?.panelBgColor;
  const userPanelAccent =
    rawPanelAccent && /^#[0-9a-f]{6}$/i.test(rawPanelAccent) ? rawPanelAccent : null;
  const userPanelBg = rawPanelBg && /^#[0-9a-f]{6}$/i.test(rawPanelBg) ? rawPanelBg : null;
  const bestRoleForAccent = gRole || (roomRole && roomRole !== "MEMBER" ? roomRole : "");
  const roleAccentHex =
    bestRoleForAccent === "GOD"
      ? "#facc15"
      : bestRoleForAccent === "ADMIN"
        ? "#f87171"
        : bestRoleForAccent === "STAFF"
          ? "#60a5fa"
          : bestRoleForAccent === "SUPPORT"
            ? "#34d399"
            : bestRoleForAccent === "OWNER"
              ? "#fb923c"
              : bestRoleForAccent === "MOD"
                ? "#a78bfa"
                : null;
  const crewAccentHex =
    primaryCrew?.accentColor && /^#[0-9a-f]{6}$/i.test(primaryCrew.accentColor)
      ? primaryCrew.accentColor
      : null;
  const cardAccent = userPanelAccent || roleAccentHex || crewAccentHex || "#7C3AED";

  useEffect(() => {
    const r = document.documentElement.style;
    if (userPanelBg) r.setProperty("--weered-user-panel-bg", userPanelBg);
    else r.removeProperty("--weered-user-panel-bg");
    if (userPanelAccent) r.setProperty("--weered-user-panel-accent", cardAccent);
    else r.removeProperty("--weered-user-panel-accent");
    return () => {
      r.removeProperty("--weered-user-panel-bg");
      r.removeProperty("--weered-user-panel-accent");
    };
  }, [userPanelBg, userPanelAccent, cardAccent]);

  const saveStatus = React.useCallback(
    async (text: string, emoji: string) => {
      const token =
        (typeof window !== "undefined" ? localStorage.getItem("weered_token") : "") || "";
      try {
        const r = await fetch(`${API_BASE}/profile/me`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ statusText: text, statusEmoji: emoji }),
        });
        const j = await r.json();
        if (j?.ok) setStatus({ text: j.statusText || "", emoji: j.statusEmoji || "" });
      } catch {}
      setEditingStatus(false);
    },
    [API_BASE],
  );

  const idHash = useMemo(() => {
    const raw = String(me?.id || "");
    if (!raw) return "";
    return raw.slice(-8).toUpperCase();
  }, [me?.id]);

  return (
    <div
      className="weered-usercorner"
      data-custom-bg={userPanelBg ? "1" : undefined}
      data-custom-accent={userPanelAccent ? "1" : undefined}
      style={{
        position: "relative",
        borderRadius: 16,
        ...(userPanelBg && { ["--weered-uc-bg" as any]: userPanelBg }),
        ...(userPanelAccent && { ["--weered-uc-accent" as any]: cardAccent }),
        border: `2px solid ${userPanelAccent ? `${cardAccent}aa` : `${cardAccent}30`}`,
        background: userPanelBg
          ? `${userPanelBg}`
          : `
          linear-gradient(180deg, rgba(255,255,255,.045) 0%, rgba(255,255,255,.015) 40%, rgba(0,0,0,.18) 100%),
          linear-gradient(135deg, ${cardAccent}10 0%, transparent 55%)
        `,
        marginBottom: 4,
        boxShadow: `
          inset 0 1px 0 rgba(255,255,255,.06),
          inset 0 -1px 0 rgba(0,0,0,.35),
          0 0 0 1px rgba(0,0,0,.2),
          0 8px 24px rgba(0,0,0,.25),
          0 0 30px ${cardAccent}08
        `,
        overflow: "hidden",
      }}
    >
      {!userPanelBg && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            backgroundImage: `repeating-linear-gradient(180deg, transparent 0 3px, rgba(255,255,255,.014) 3px 4px)`,
            mixBlendMode: "overlay",
            opacity: 0.6,
          }}
        />
      )}
      {[
        { top: 6, left: 6, rotate: 0 },
        { top: 6, right: 6, rotate: 90 },
        { bottom: 6, right: 6, rotate: 180 },
        { bottom: 6, left: 6, rotate: 270 },
      ].map((pos, i) => (
        <span
          key={i}
          aria-hidden
          style={{
            position: "absolute",
            width: 11,
            height: 11,
            borderTop: `2.5px solid ${userPanelAccent ? cardAccent : `${cardAccent}b0`}`,
            borderLeft: `2.5px solid ${userPanelAccent ? cardAccent : `${cardAccent}b0`}`,
            transform: `rotate(${pos.rotate}deg)`,
            pointerEvents: "none",
            ...(pos as any),
          }}
        />
      ))}
      {lobbyLogo ? (
        <div
          style={{
            position: "absolute",
            top: 6,
            right: 8,
            width: 26,
            height: 26,
            borderRadius: 6,
            overflow: "hidden",
            pointerEvents: "none",
            userSelect: "none",
            opacity: 0.55,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2,
          }}
        >
          <img
            src={lobbyLogo}
            alt="Lobby logo"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              filter: "drop-shadow(0 0 6px rgba(0,0,0,.4))",
            }}
          />
        </div>
      ) : null}

      <div
        className="weered-uc-banner"
        style={{
          position: "relative",
          height: 64,
          background: (() => {
            if (bannerUrl) return `url(${bannerUrl}) center / cover no-repeat`;
            const tier = String(me?.tier || "").toLowerCase();
            const tierBanner =
              tier === "kingpin"
                ? "/brand/tiers/kingpin.svg"
                : tier === "made_man" || tier === "mademan"
                  ? "/brand/tiers/made_man.svg"
                  : tier === "felon"
                    ? "/brand/tiers/felon.svg"
                    : tier === "indicted"
                      ? "/brand/tiers/indicted.svg"
                      : "/brand/tiers/innocent.svg";
            return `url(${tierBanner}) center / cover no-repeat, linear-gradient(135deg, ${cardAccent}55 0%, ${cardAccent}15 60%, rgba(0,0,0,.45) 100%)`;
          })(),
          zIndex: 1,
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(0,0,0,.55) 100%)",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            position: "absolute",
            top: 8,
            left: 12,
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontFamily: "ui-monospace, 'JetBrains Mono', monospace",
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: "1.4px",
            textShadow: "0 1px 2px rgba(0,0,0,.6)",
            pointerEvents: "none",
          }}
        >
          {idHash && <span style={{ color: "rgba(255,255,255,.55)" }}>ID · {idHash}</span>}
          {(() => {
            const tier = String(me?.tier || "").toUpperCase();
            if (!tier || tier === "INNOCENT") return null;
            const tierColor =
              tier === "KINGPIN"
                ? "#fde68a"
                : tier === "FELON"
                  ? "#fdba74"
                  : tier === "INDICTED"
                    ? "rgba(216,180,254,.95)"
                    : "rgba(243,244,246,.85)";
            return (
              <span
                className="weered-uc-banner-tier"
                style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
              >
                {idHash && (
                  <span aria-hidden style={{ opacity: 0.4, color: "#fff" }}>
                    ·
                  </span>
                )}
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    color: tierColor,
                    fontWeight: 900,
                    letterSpacing: "1.8px",
                  }}
                >
                  <TierIcon tier={tier} size={10} />
                  {tier}
                </span>
              </span>
            );
          })()}
          {notorietyScore != null && (
            <span
              className="weered-uc-noto"
              data-tooltip="Notoriety — your reputation XP. Climbs through Innocent, Indicted, Felon, Made Man, Kingpin as you contribute."
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
                color: "#D4A017",
                letterSpacing: "0.06em",
                pointerEvents: "auto",
                cursor: "help",
                position: "relative",
              }}
            >
              <span style={{ fontSize: 11 }}>★</span>
              {notorietyScore.toLocaleString()}
            </span>
          )}
        </div>

        {primaryCrew?.tag &&
          (() => {
            const ca =
              primaryCrew.accentColor && /^#[0-9a-f]{6}$/i.test(primaryCrew.accentColor)
                ? primaryCrew.accentColor
                : cardAccent;
            return (
              <a
                href={`/crew/${encodeURIComponent(primaryCrew.id)}`}
                title={primaryCrew.name || ""}
                style={{
                  position: "absolute",
                  top: 8,
                  right: lobbyLogo ? 40 : 10,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "3px 8px",
                  fontFamily: "ui-monospace, 'JetBrains Mono', monospace",
                  fontSize: 10,
                  fontWeight: 900,
                  letterSpacing: "1.2px",
                  color: ca,
                  background: "rgba(10,10,18,.55)",
                  border: `1px solid ${ca}80`,
                  borderRadius: 4,
                  textDecoration: "none",
                  boxShadow: "0 2px 6px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.08)",
                  backdropFilter: "blur(4px)",
                  WebkitBackdropFilter: "blur(4px)",
                }}
              >
                [{primaryCrew.tag}]
              </a>
            );
          })()}

        <div
          className="weered-uc-notoriety"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            padding: "0 12px 6px",
            paddingLeft: 78,
          }}
        >
          <NotorietyBar compact />
        </div>
      </div>

      <div
        style={{ position: "relative", padding: "12px 14px 10px 78px", zIndex: 1, minHeight: 56 }}
      >
        <button
          type="button"
          onClick={() => openSheet("profile", { userId: profileUserId })}
          aria-label="Open profile"
          style={{
            position: "absolute",
            left: 14,
            top: -28,
            padding: 0,
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          <div style={{ position: "relative" }}>
            <div
              className="weered-avatar"
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                ["--wa-bg" as any]: avatarUrl
                  ? "rgba(255,255,255,.08)"
                  : avatarBg(name, true, stickyAvatarColor),
                background: avatarUrl
                  ? "rgba(255,255,255,.08)"
                  : avatarBg(name, true, stickyAvatarColor),
                boxShadow: `
                0 0 0 3px rgba(10,10,18,.95),
                0 0 0 4px ${cardAccent}80,
                0 0 14px ${cardAccent}50,
                inset 0 2px 0 rgba(255,255,255,.18)
              `,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                fontWeight: 950,
                color: "#fff",
                overflow: "hidden",
              }}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={name + " avatar"}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                initial
              )}
            </div>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                if (typeof setAway === "function") setAway(!isAway);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  if (typeof setAway === "function") setAway(!isAway);
                }
              }}
              title={
                isAway ? "Lying low — click to come back online." : "Online — click to lie low."
              }
              aria-label={isAway ? "Set status to online" : "Set status to lying low"}
              style={{
                display: "block",
                position: "absolute",
                bottom: 0,
                right: 0,
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: isAway ? "#facc15" : "#22c55e",
                boxShadow: isAway ? "0 0 8px rgba(250,204,21,.7)" : "0 0 8px rgba(34,197,94,.8)",
                border: "2.5px solid rgba(10,10,18,.95)",
                cursor: "pointer",
              }}
            />
          </div>
        </button>

        <button
          type="button"
          onClick={() => openSheet("profile", { userId: profileUserId })}
          style={{
            display: "block",
            width: "100%",
            padding: 0,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "inherit",
            textAlign: "left",
            minWidth: 0,
          }}
        >
          <FittedName name={name} effect={nameEffect} />
          {(() => {
            const bestRole = gRole || (roomRole && roomRole !== "MEMBER" ? roomRole : "");
            if (!bestRole || bestRole === "MEMBER" || bestRole === "USER") return null;
            const roleColor =
              bestRole === "GOD"
                ? "#fde68a"
                : bestRole === "ADMIN"
                  ? "#fca5a5"
                  : bestRole === "STAFF"
                    ? "#93c5fd"
                    : bestRole === "SUPPORT"
                      ? "#6ee7b7"
                      : bestRole === "MOD"
                        ? "rgba(216,180,254,.95)"
                        : "rgba(243,244,246,.85)";
            return (
              <div
                style={{
                  marginTop: 5,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontFamily: "ui-monospace, 'JetBrains Mono', monospace",
                  fontSize: 9,
                  fontWeight: 900,
                  letterSpacing: "1.4px",
                  textTransform: "uppercase",
                  color: roleColor,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                <RoleIcon role={bestRole} size={11} />
                {roleDisplay(bestRole, lobbyTheme)}
              </div>
            );
          })()}
          {(() => {
            const tierU = String(me?.tier || "").toUpperCase();
            if (!tierU || tierU === "INNOCENT") return null;
            const tierColor =
              tierU === "KINGPIN"
                ? "#fde68a"
                : tierU === "MADE_MAN" || tierU === "MADEMAN"
                  ? "#f0abfc"
                  : tierU === "FELON"
                    ? "#fdba74"
                    : tierU === "INDICTED"
                      ? "rgba(216,180,254,.95)"
                      : "rgba(243,244,246,.85)";
            return (
              <div
                style={{
                  marginTop: 3,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontFamily: "ui-monospace, 'JetBrains Mono', monospace",
                  fontSize: 9,
                  fontWeight: 900,
                  letterSpacing: "1.4px",
                  textTransform: "uppercase",
                  color: tierColor,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                <TierIcon tier={tierU} size={11} />
                {tierU.replace("_", " ")}
              </div>
            );
          })()}
          {primaryCrew?.name && (
            <div
              className="weered-uc-crew-line"
              onClick={(e) => {
                e.stopPropagation();
                try {
                  window.location.href = `/crew/${encodeURIComponent(primaryCrew.id)}`;
                } catch {}
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  try {
                    window.location.href = `/crew/${encodeURIComponent(primaryCrew.id)}`;
                  } catch {}
                }
              }}
              tabIndex={0}
              role="button"
              title={`${primaryCrew.name} — open crew`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                marginTop: 5,
                cursor: "pointer",
                overflow: "hidden",
                whiteSpace: "nowrap",
              }}
            >
              {primaryCrew.tag && (
                <span
                  style={{
                    fontFamily: "ui-monospace, 'JetBrains Mono', monospace",
                    fontSize: 10,
                    fontWeight: 900,
                    letterSpacing: "1px",
                    color: cardAccent,
                    border: `1px solid ${cardAccent}55`,
                    padding: "1px 5px",
                    flexShrink: 0,
                  }}
                >
                  [{primaryCrew.tag}]
                </span>
              )}
              <span
                style={{
                  fontSize: 12,
                  fontStyle: "italic",
                  color: "rgba(240,232,214,.7)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  paddingRight: 3,
                }}
              >
                {primaryCrew.name}
              </span>
            </div>
          )}
        </button>

        {editingStatus ? (
          <div style={{ display: "flex", gap: 5, marginTop: 7, alignItems: "center" }}>
            <input
              value={draftStatus.emoji}
              onChange={(e) => setDraftStatus((v) => ({ ...v, emoji: e.target.value }))}
              placeholder="\ud83e\udd5e"
              maxLength={8}
              style={{
                width: 30,
                textAlign: "center",
                background: "rgba(255,255,255,.06)",
                border: "1px solid rgba(255,255,255,.14)",
                borderRadius: 4,
                color: "#fff",
                fontSize: 13,
                padding: "4px 0",
              }}
            />
            <input
              value={draftStatus.text}
              onChange={(e) => setDraftStatus((v) => ({ ...v, text: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveStatus(draftStatus.text, draftStatus.emoji);
                if (e.key === "Escape") setEditingStatus(false);
              }}
              placeholder="What's the vibe?"
              maxLength={80}
              autoFocus
              style={{
                flex: 1,
                minWidth: 0,
                background: "rgba(255,255,255,.06)",
                border: "1px solid rgba(255,255,255,.14)",
                borderRadius: 4,
                color: "#fff",
                fontSize: 12,
                padding: "4px 7px",
              }}
            />
            <button
              type="button"
              onClick={() => saveStatus(draftStatus.text, draftStatus.emoji)}
              style={{
                background: "#3b0764",
                border: "none",
                color: "#fff",
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: ".06em",
                padding: "5px 9px",
                cursor: "pointer",
                borderRadius: 0,
                flexShrink: 0,
              }}
            >
              SET
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraftStatus(status);
              setEditingStatus(true);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginTop: 7,
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              color: "inherit",
              textAlign: "left",
              maxWidth: "100%",
            }}
            title="Set a status"
          >
            {status.emoji && <span style={{ fontSize: 13, flexShrink: 0 }}>{status.emoji}</span>}
            <span
              style={{
                fontSize: 11,
                fontStyle: "italic",
                color: status.text ? "rgba(240,232,214,.80)" : "rgba(148,163,184,.5)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                paddingRight: 3,
              }}
            >
              {status.text || "Set a status\u2026"}
            </span>
          </button>
        )}
      </div>

      <div
        style={{
          display: "flex",
          gap: 6,
          padding: "6px 12px 10px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <button
          type="button"
          onClick={() => {
            try {
              window.dispatchEvent(new CustomEvent("weered:dock:toggle"));
            } catch {}
          }}
          title={dockUnread > 0 ? `${dockUnread} unread` : "Messages, friends, crew"}
          className={`weered-uc-action${dockUnread > 0 ? " weered-burner-hot" : ""}`}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
            padding: "9px 14px",
            background:
              dockUnread > 0
                ? "linear-gradient(135deg, rgba(245,158,11,.18), rgba(239,68,68,.12))"
                : "rgba(88,0,229,.14)",
            border:
              dockUnread > 0 ? "1px solid rgba(245,158,11,.40)" : "1px solid rgba(88,0,229,.35)",
            borderRadius: 10,
            cursor: "pointer",
            color: dockUnread > 0 ? "rgba(253,230,138,.95)" : "rgba(243,244,246,.88)",
            fontFamily: "inherit",
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.02em",
            transition: "all 0.2s",
            position: "relative",
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.background =
              dockUnread > 0
                ? "linear-gradient(135deg, rgba(245,158,11,.25), rgba(239,68,68,.18))"
                : "rgba(88,0,229,.22)";
            el.style.borderColor = dockUnread > 0 ? "rgba(245,158,11,.55)" : "rgba(88,0,229,.45)";
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.background =
              dockUnread > 0
                ? "linear-gradient(135deg, rgba(245,158,11,.18), rgba(239,68,68,.12))"
                : "rgba(88,0,229,.14)";
            el.style.borderColor = dockUnread > 0 ? "rgba(245,158,11,.40)" : "rgba(88,0,229,.35)";
          }}
        >
          {lobbyTheme === "windrose" ? (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              style={{ flexShrink: 0 }}
            >
              <rect x="10" y="2" width="4" height="5" strokeWidth="1.5" />
              <path
                d="M9 7 Q7 9 7 11 L7 21 Q7 22 8 22 L16 22 Q17 22 17 21 L17 11 Q17 9 15 7 Z"
                strokeWidth="1.8"
              />
              <rect x="8" y="13" width="8" height="5" strokeWidth="1" opacity=".45" />
              <line x1="10" y1="2" x2="14" y2="2" strokeWidth="1.5" opacity=".65" />
            </svg>
          ) : (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              style={{ flexShrink: 0 }}
            >
              <rect x="6" y="2" width="12" height="20" rx="3" strokeWidth="2" />
              <rect x="9" y="5" width="6" height="6" rx="1.5" strokeWidth="1.5" opacity=".55" />
              <circle cx="10" cy="15" r="1" fill="currentColor" stroke="none" opacity=".45" />
              <circle cx="14" cy="15" r="1" fill="currentColor" stroke="none" opacity=".45" />
              <circle cx="10" cy="18" r="1" fill="currentColor" stroke="none" opacity=".45" />
              <circle cx="14" cy="18" r="1" fill="currentColor" stroke="none" opacity=".45" />
              <circle cx="12" cy="15" r="1" fill="currentColor" stroke="none" opacity=".45" />
              <circle cx="12" cy="18" r="1" fill="currentColor" stroke="none" opacity=".45" />
            </svg>
          )}

          <span>{burnerLabel}</span>

          {dockUnread > 0 && (
            <span
              style={{
                position: "absolute",
                top: -6,
                right: -6,
                minWidth: 18,
                height: 18,
                borderRadius: 999,
                background: "#f59e0b",
                border: "2px solid rgba(10,10,15,.9)",
                fontSize: 9,
                fontWeight: 900,
                color: "#000",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: dockUnread > 9 ? "0 4px" : "0",
                lineHeight: 1,
                boxShadow: "0 0 8px rgba(245,158,11,.5)",
                animation: "weered-burner-badge 2s ease-in-out infinite",
                zIndex: 2,
                pointerEvents: "none",
              }}
            >
              {dockUnread > 99 ? "99+" : dockUnread}
            </span>
          )}
        </button>
      </div>

      <style>{`
        @keyframes weered-burner-badge {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
        @keyframes weered-burner-glow-opacity {
          0%, 100% { opacity: 0.4; }
          50%      { opacity: 1; }
        }
        .weered-burner-hot { position: relative; }
        .weered-burner-hot::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          pointer-events: none;
          box-shadow: 0 0 18px rgba(245,158,11,.30);
          opacity: 0.4;
          animation: weered-burner-glow-opacity 2.5s ease-in-out infinite;
          will-change: opacity;
        }
      `}</style>
    </div>
  );
}

const actionBtn: React.CSSProperties = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 5,
  padding: "8px 0",
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "rgba(255,255,255,.45)",
  fontFamily: "inherit",
  transition: "color 0.12s, background 0.12s",
};

function FittedName({ name, effect }: { name: string; effect?: string | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const sizes = useMemo(() => [22, 18, 16, 14], []);
  const fontSize = useFitText(ref, name, sizes);
  return (
    <div
      ref={ref}
      style={{
        fontFamily: "'Barlow Condensed', 'Oswald', ui-sans-serif, sans-serif",
        fontSize,
        fontWeight: 800,
        letterSpacing: "0.5px",
        textTransform: "uppercase",
        lineHeight: 1.0,
        color: "rgba(243,244,246,.97)",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {effect ? (
        <span
          className={"weered-name-" + effect}
          style={{ display: "inline-block", lineHeight: "inherit" }}
        >
          {name}
        </span>
      ) : (
        name
      )}
    </div>
  );
}
