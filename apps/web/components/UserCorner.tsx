"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useWeered } from "./WeeredProvider";
import { useOverlay } from "./overlays/OverlayProvider";
import { TierIcon } from "./RoleIcon";
import { avatarBg } from "../lib/avatarColor";
import NotorietyBar from "./NotorietyBar";

// Auto-shrink text to fit. Walks `sizes` largest→smallest until the
// element's scrollWidth fits within its clientWidth. Re-runs whenever
// the text or size sequence changes.
function useFitText(ref: any, text: string, sizes: number[]): number {
  const [size, setSize] = useState(sizes[0]);
  // Reset to the largest size whenever the text changes so we always
  // try the biggest fit first.
  useLayoutEffect(() => {
    setSize(sizes[0]);
  }, [text, sizes[0]]);
  // After each render, if we still overflow and there's a smaller
  // size available, step down. Stops when no overflow or we've hit
  // the smallest size.
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
  const s = String(x || "").trim().toUpperCase();
  if (!s) return "";
  if (s === "GOD")     return "GOD";
  if (s === "SUPPORT") return "SUPPORT";
  if (s === "STAFF")   return "STAFF";
  if (s === "ADMIN")   return "ADMIN";
  if (s === "MOD")     return "MOD";
  if (s === "OWNER")   return "OWNER";
  if (s === "MEMBER")  return "MEMBER";
  return s.slice(0, 14);
}

// Street hierarchy display names — defaults to GTA/mafia.
const ROLE_DISPLAY: Record<string, string> = {
  GOD: "GODFATHER", ADMIN: "LIEUTENANT", STAFF: "ENFORCER", SUPPORT: "BACKUP",
  MOD: "CAPTAIN", OWNER: "FOUNDER", MEMBER: "MEMBER",
};
// Lobby-scoped overrides — Windrose speaks pirate.
const ROLE_DISPLAY_WINDROSE: Record<string, string> = {
  GOD: "ADMIRAL", ADMIN: "FIRST MATE", STAFF: "BOATSWAIN", SUPPORT: "LOOKOUT",
  MOD: "QUARTERMASTER", OWNER: "CAPTAIN", MEMBER: "CREWMATE",
};
function roleDisplay(dbRole: string, lobbyTheme?: string | null): string {
  if (lobbyTheme === "windrose" && ROLE_DISPLAY_WINDROSE[dbRole]) return ROLE_DISPLAY_WINDROSE[dbRole];
  return ROLE_DISPLAY[dbRole] || dbRole;
}

const IconDock = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="14" rx="3" />
    <path d="M7 9.5h10M7 13h6" opacity=".6" />
  </svg>
);

export default function UserCorner() {
  const { me, role, globalRole, currentLobbyId, isAway, setAway } = useWeered() as any;
  const { openSheet } = useOverlay();

  // Reactive lobby-theme detection for vocabulary swap
  const [lobbyTheme, setLobbyTheme] = useState<string | null>(null);
  useEffect(() => {
    const read = () => setLobbyTheme(document.documentElement.getAttribute("data-weered-lobby"));
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-weered-lobby"] });
    return () => obs.disconnect();
  }, []);
  const burnerLabel = lobbyTheme === "windrose" ? "Bottle" : lobbyTheme === "destiny2" ? "Transmat" : "Burner";

  // ── Lobby branding: fetch logoUrl for current lobby ─────────────────────────
  const API_BASE = (process.env.NEXT_PUBLIC_API_BASE as string) || "http://127.0.0.1:4000";
  const [lobbyLogo, setLobbyLogo] = React.useState<string | null>(null);
  const [lobbyAccent, setLobbyAccent] = React.useState<string | null>(null);
  const prevLobbyRef = React.useRef<string>("");
  React.useEffect(() => {
    const lid = currentLobbyId || "";
    if (lid === prevLobbyRef.current) return;
    prevLobbyRef.current = lid;
    if (!lid || lid === "lobby") { setLobbyLogo(null); setLobbyAccent(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/lobbies/${encodeURIComponent(lid)}`);
        const j = await r.json();
        if (!cancelled && j?.ok && j?.lobby) {
          setLobbyLogo(j.lobby.logoUrl || null);
          setLobbyAccent(j.lobby.accentColor || null);
        }
      } catch { if (!cancelled) { setLobbyLogo(null); setLobbyAccent(null); } }
    })();
    return () => { cancelled = true; };
  }, [currentLobbyId]);

  const name = useMemo(() => pickFirstString(me?.name, me?.username, "Guest"), [me]);
  const avatarUrl = me?.avatar || null;

  // Re-render when avatar color changes
  const [, forceUpdate] = React.useState(0);
  React.useEffect(() => {
    const handler = () => forceUpdate(n => n + 1);
    window.addEventListener("weered:avatarColor", handler);
    window.addEventListener("weered:profileColors", handler);
    return () => {
      window.removeEventListener("weered:avatarColor", handler);
      window.removeEventListener("weered:profileColors", handler);
    };
  }, []);

  // Live profile colour overrides — read from localStorage cache so changes
  // from the settings sheet apply instantly without round-tripping the WS.
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

  // Dock unread badge — two sources:
  // 1. weered:dock:unread custom event (Dock fires this when count changes)
  // 2. localStorage "weered:dock:unread" polled every 2s as fallback
  //    (covers the case where the event fired before this component mounted)
  // Dock should write: localStorage.setItem("weered:dock:unread", String(count))
  const [dockUnread, setDockUnread] = React.useState(() => {
    try { return Math.max(0, Number(localStorage.getItem("weered:dock:unread")) || 0); } catch { return 0; }
  });

  React.useEffect(() => {
    // Event listener — instant when Dock dispatches
    const onUnread = (e: Event) => {
      const count = Math.max(0, Number((e as CustomEvent)?.detail?.count) || 0);
      setDockUnread(count);
      try { localStorage.setItem("weered:dock:unread", String(count)); } catch {}
    };
    // Poll localStorage every 10s as fallback for missed events. 2s was
    // overkill — the event listener catches changes instantly and this is
    // only a safety net for cross-tab updates the listener missed.
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

  // Clear badge when dock opens
  React.useEffect(() => {
    const handler = () => {
      setDockUnread(0);
      try { localStorage.setItem("weered:dock:unread", "0"); } catch {}
    };
    window.addEventListener("weered:dock:open",   handler);
    window.addEventListener("weered:dock:toggle", handler);
    return () => {
      window.removeEventListener("weered:dock:open",   handler);
      window.removeEventListener("weered:dock:toggle", handler);
    };
  }, []);

  const gRole    = useMemo(() => normRole(globalRole || ""), [globalRole]);
  const roomRole = useMemo(() => normRole(pickFirstString(role)), [role]);
  const initial  = (name || "G").trim().slice(0, 1).toUpperCase();

  const profileUserId = (me?.id ?? me?.userId ?? me?.name ?? me?.username ?? "me").toString();

  // Primary crew + notoriety rank — used to flesh out the identity card
  // into something that actually feels like an ID badge.
  const [primaryCrew, setPrimaryCrew] = useState<{ id: string; name: string; tag: string; logoUrl: string | null; accentColor: string | null } | null>(null);
  const [notorietyRank, setNotorietyRank] = useState<string>("");
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!me?.id) { setPrimaryCrew(null); setNotorietyRank(""); return; }
    let cancelled = false;
    const token = (typeof window !== "undefined" ? localStorage.getItem("weered_token") : "") || "";
    fetch(`${API_BASE}/profile/${encodeURIComponent(me.id)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).then(r => r.json()).then(j => {
      if (cancelled) return;
      if (j?.primaryCrew) {
        setPrimaryCrew({
          id: j.primaryCrew.id,
          name: j.primaryCrew.name,
          tag: j.primaryCrew.tag || "",
          logoUrl: j.primaryCrew.logoUrl || null,
          accentColor: j.primaryCrew.accentColor || null,
        });
      } else { setPrimaryCrew(null); }
      if (j?.notorietyRank) setNotorietyRank(String(j.notorietyRank));
      if (j?.bannerUrl) setBannerUrl(String(j.bannerUrl)); else setBannerUrl(null);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [me?.id, API_BASE]);

  // Accent color cascade for the ID card: user override > role color > crew accent > neutral.
  // panelAccentColor is the user's own customization (settings sheet color picker).
  const rawPanelAccent = colorOverrides.panelAccentColor || me?.panelAccentColor;
  const rawPanelBg     = colorOverrides.panelBgColor     || me?.panelBgColor;
  const userPanelAccent = (rawPanelAccent && /^#[0-9a-f]{6}$/i.test(rawPanelAccent)) ? rawPanelAccent : null;
  const userPanelBg     = (rawPanelBg     && /^#[0-9a-f]{6}$/i.test(rawPanelBg))     ? rawPanelBg     : null;
  const bestRoleForAccent = gRole || (roomRole && roomRole !== "MEMBER" ? roomRole : "");
  const roleAccentHex =
    bestRoleForAccent === "GOD"     ? "#facc15" :
    bestRoleForAccent === "ADMIN"   ? "#f87171" :
    bestRoleForAccent === "STAFF"   ? "#60a5fa" :
    bestRoleForAccent === "SUPPORT" ? "#34d399" :
    bestRoleForAccent === "OWNER"   ? "#fb923c" :
    bestRoleForAccent === "MOD"     ? "#a78bfa" :
    null;
  const crewAccentHex = primaryCrew?.accentColor && /^#[0-9a-f]{6}$/i.test(primaryCrew.accentColor) ? primaryCrew.accentColor : null;
  const cardAccent = userPanelAccent || roleAccentHex || crewAccentHex || "#7C3AED";

  // Short hash of the user's cuid for the ID badge line — reads "technical"
  // without exposing raw internal IDs.
  const idHash = useMemo(() => {
    const raw = String(me?.id || "");
    if (!raw) return "";
    return raw.slice(-8).toUpperCase();
  }, [me?.id]);

  return (
    <div
      className="weered-usercorner"
      // Theme rules use !important on background / border, so we expose the
      // user's pick via CSS variables that a high-specificity override in
      // globals.css picks up. data-* flags toggle the override on/off.
      data-custom-bg={userPanelBg ? "1" : undefined}
      data-custom-accent={userPanelAccent ? "1" : undefined}
      style={{
        position: "relative",
        borderRadius: 16,
        ...(userPanelBg     && { ["--weered-uc-bg" as any]:     userPanelBg }),
        ...(userPanelAccent && { ["--weered-uc-accent" as any]: cardAccent }),
        // Border: 2px, stronger alpha when user-customized so the accent reads.
        border: `2px solid ${userPanelAccent ? `${cardAccent}aa` : `${cardAccent}30`}`,
        // Background: when the user picks a panelBgColor, lay it down as a
        // solid base — no dark overlay washing it out. When no override,
        // fall back to the original glassy stack.
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
      {/* Technical scan-line overlay — very subtle, adds the "this is my
          rig" feel without overpowering. Pure CSS, no image. Drop it when
          the user picked a panel bg colour so we don't wash the choice out. */}
      {!userPanelBg && (
        <div
          aria-hidden
          style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            backgroundImage: `repeating-linear-gradient(180deg, transparent 0 3px, rgba(255,255,255,.014) 3px 4px)`,
            mixBlendMode: "overlay",
            opacity: 0.6,
          }}
        />
      )}
      {/* Corner bracket marks — four L-shaped ticks in the accent color so
          the card reads as a framed ID badge, not a generic box. */}
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
            width: 11, height: 11,
            borderTop: `2.5px solid ${userPanelAccent ? cardAccent : `${cardAccent}b0`}`,
            borderLeft: `2.5px solid ${userPanelAccent ? cardAccent : `${cardAccent}b0`}`,
            transform: `rotate(${pos.rotate}deg)`,
            pointerEvents: "none",
            ...(pos as any),
          }}
        />
      ))}
      {/* Make corner brackets a touch larger to match the new 2.5px stroke */}
      {/* Lobby logo / brand watermark — small, anchored top-right of card */}
      {lobbyLogo ? (
        <div style={{
          position: "absolute", top: 6, right: 8,
          width: 26, height: 26, borderRadius: 6,
          overflow: "hidden", pointerEvents: "none", userSelect: "none",
          opacity: 0.55,
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 2,
        }}>
          <img
            src={lobbyLogo}
            alt="Lobby logo"
            style={{ width: "100%", height: "100%", objectFit: "contain", filter: "drop-shadow(0 0 6px rgba(0,0,0,.4))" }}
          />
        </div>
      ) : null}

      {/* ─────────────────────────────────────────────────────────────────
          BANNER ZONE — image (user.bannerUrl) or tier-themed gradient.
          Carries crew patch (top-right), tier watermark (bottom-left), and
          embedded notoriety bar (bottom edge). Avatar overlaps the bottom
          edge so the banner and the identity field below read as one card.
          ───────────────────────────────────────────────────────────── */}
      <div style={{
        position: "relative",
        height: 64,
        background: (() => {
          if (bannerUrl) return `url(${bannerUrl}) center / cover no-repeat`;
          const tier = String(me?.tier || "").toLowerCase();
          const tierBanner =
            tier === "kingpin"  ? "/brand/tiers/kingpin.svg" :
            tier === "made_man" || tier === "mademan" ? "/brand/tiers/made_man.svg" :
            tier === "felon"    ? "/brand/tiers/felon.svg" :
            tier === "indicted" ? "/brand/tiers/indicted.svg" :
            "/brand/tiers/innocent.svg";
          return `url(${tierBanner}) center / cover no-repeat, linear-gradient(135deg, ${cardAccent}55 0%, ${cardAccent}15 60%, rgba(0,0,0,.45) 100%)`;
        })(),
        zIndex: 1,
      }}>
        {/* Bottom shade gradient — guarantees text legibility no matter
            what banner image the user picks. */}
        <div aria-hidden style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(0,0,0,.55) 100%)",
          pointerEvents: "none",
        }} />

        {/* TOP-LEFT HEADER ROW — ID hash + tier stencil, single line.
            Reads like the file-folder reference cover line. Merged so the
            bottom edge is reserved for the embedded notoriety bar. */}
        <div style={{
          position: "absolute", top: 8, left: 12,
          display: "flex", alignItems: "center", gap: 8,
          fontFamily: "ui-monospace, 'JetBrains Mono', monospace",
          fontSize: 9, fontWeight: 800, letterSpacing: "1.4px",
          textShadow: "0 1px 2px rgba(0,0,0,.6)",
          pointerEvents: "none",
        }}>
          {idHash && (
            <span style={{ color: "rgba(255,255,255,.55)" }}>ID · {idHash}</span>
          )}
          {(() => {
            const tier = String(me?.tier || "").toUpperCase();
            if (!tier || tier === "INNOCENT") return null;
            const tierColor =
              tier === "KINGPIN"  ? "#fde68a" :
              tier === "FELON"    ? "#fdba74" :
              tier === "INDICTED" ? "rgba(216,180,254,.95)" :
              "rgba(243,244,246,.85)";
            return (
              <>
                {idHash && <span aria-hidden style={{ opacity: 0.4, color: "#fff" }}>·</span>}
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  color: tierColor,
                  fontWeight: 900, letterSpacing: "1.8px",
                }}>
                  <TierIcon tier={tier as any} size={10} />
                  {tier}
                </span>
              </>
            );
          })()}
        </div>

        {/* CREW PATCH — top-right of banner. Reads as a sewn-on insignia.
            Sits left of the lobby logo so they don't collide. */}
        {primaryCrew?.tag && (() => {
          const ca = primaryCrew.accentColor && /^#[0-9a-f]{6}$/i.test(primaryCrew.accentColor) ? primaryCrew.accentColor : cardAccent;
          return (
            <a
              href={`/crew/${encodeURIComponent(primaryCrew.id)}`}
              title={primaryCrew.name || ""}
              style={{
                position: "absolute", top: 8,
                right: lobbyLogo ? 40 : 10,
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "3px 8px",
                fontFamily: "ui-monospace, 'JetBrains Mono', monospace",
                fontSize: 10, fontWeight: 900, letterSpacing: "1.2px",
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

        {/* NOTORIETY BAR — embedded in the bottom edge of the banner like
            a fuel gauge. Component handles its own data; we just wrap it
            in a thin strip so it sits flush against the banner edge. */}
        <div style={{
          position: "absolute", left: 0, right: 0, bottom: 0,
          padding: "0 12px 6px",
          paddingLeft: 78, // leave room for overlapping avatar
        }}>
          <NotorietyBar compact />
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          IDENTITY FIELD — clean surface below the banner. Avatar is
          absolutely positioned so the overlap is layout-stable across
          async data loads (banner img, NotorietyBar mount, FittedName resize).
          ───────────────────────────────────────────────────────────── */}
      <div style={{ position: "relative", padding: "12px 14px 10px 78px", zIndex: 1, minHeight: 56 }}>
        {/* Avatar — absolute, overlaps the banner ↔ field boundary by 28px.
            Sits in the 78px left padding gutter of the parent. */}
        <button
          type="button"
          onClick={() => openSheet("profile", { userId: profileUserId })}
          aria-label="Open profile"
          style={{
            position: "absolute", left: 14, top: -28,
            padding: 0, background: "none", border: "none", cursor: "pointer",
          }}
        >
          <div style={{ position: "relative" }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: avatarUrl ? "rgba(255,255,255,.08)" : avatarBg(name, true),
              boxShadow: `
                0 0 0 3px rgba(10,10,18,.95),
                0 0 0 4px ${cardAccent}80,
                0 0 14px ${cardAccent}50,
                inset 0 2px 0 rgba(255,255,255,.18)
              `,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, fontWeight: 950, color: "#fff",
              overflow: "hidden",
            }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt={name + " avatar"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                initial
              )}
            </div>
            {/* Status dot — bottom-right of avatar. Click toggles AFK. */}
            <span
              role="button"
              tabIndex={0}
              onClick={e => { e.stopPropagation(); if (typeof setAway === "function") setAway(!isAway); }}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); if (typeof setAway === "function") setAway(!isAway); } }}
              title={isAway ? "Lying low — click to come back online." : "Online — click to lie low."}
              aria-label={isAway ? "Set status to online" : "Set status to lying low"}
              style={{
                display: "block",
                position: "absolute", bottom: 0, right: 0,
                width: 14, height: 14, borderRadius: "50%",
                background: isAway ? "#facc15" : "#22c55e",
                boxShadow: isAway ? "0 0 8px rgba(250,204,21,.7)" : "0 0 8px rgba(34,197,94,.8)",
                border: "2.5px solid rgba(10,10,18,.95)",
                cursor: "pointer",
              }}
            />
          </div>
        </button>

        {/* Name + role/tier inline + crew name. Separate button so the text
            column has its own click target (also opens profile) and flows
            naturally inside the field's left padding gutter (78px) clear of
            the absolutely-positioned avatar. */}
        <button
          type="button"
          onClick={() => openSheet("profile", { userId: profileUserId })}
          style={{
            display: "block", width: "100%", padding: 0,
            background: "none", border: "none", cursor: "pointer",
            color: "inherit", textAlign: "left",
            minWidth: 0,
          }}
        >
          <FittedName name={name} />
          {(() => {
            const bestRole = gRole || (roomRole && roomRole !== "MEMBER" ? roomRole : "");
            if (!bestRole) return null;
            const roleColor =
              bestRole === "GOD"     ? "#fde68a" :
              bestRole === "ADMIN"   ? "#fca5a5" :
              bestRole === "STAFF"   ? "#93c5fd" :
              bestRole === "SUPPORT" ? "#6ee7b7" :
              bestRole === "MOD"     ? "rgba(216,180,254,.95)" :
              "rgba(243,244,246,.85)";
            return (
              <div style={{
                marginTop: 4,
                fontFamily: "ui-monospace, 'JetBrains Mono', monospace",
                fontSize: 9, fontWeight: 900, letterSpacing: "1.5px",
                textTransform: "uppercase",
                color: roleColor,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {roleDisplay(bestRole, lobbyTheme)}
              </div>
            );
          })()}
          {primaryCrew?.name && (
            <div style={{
              fontSize: 11, fontStyle: "italic",
              color: "rgba(240,232,214,.62)",
              marginTop: 3,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {primaryCrew.name}
            </div>
          )}
        </button>
      </div>

      {/* Action strip — Burner only; settings/logout live in the W logo menu */}
      <div style={{
        display: "flex", gap: 6, padding: "6px 12px 10px",
        position: "relative", zIndex: 1,
      }}>
        {/* BURNER PHONE — loud, unmissable */}
        <button
          type="button"
          onClick={() => { try { window.dispatchEvent(new CustomEvent("weered:dock:toggle")); } catch {} }}
          title={dockUnread > 0 ? `${dockUnread} unread` : "Messages, friends, crew"}
          className={`weered-uc-action${dockUnread > 0 ? " weered-burner-hot" : ""}`}
          style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
            gap: 7, padding: "9px 14px",
            background: dockUnread > 0
              ? "linear-gradient(135deg, rgba(245,158,11,.18), rgba(239,68,68,.12))"
              : "rgba(88,0,229,.14)",
            border: dockUnread > 0
              ? "1px solid rgba(245,158,11,.40)"
              : "1px solid rgba(88,0,229,.35)",
            borderRadius: 10, cursor: "pointer",
            color: dockUnread > 0 ? "rgba(253,230,138,.95)" : "rgba(243,244,246,.88)",
            fontFamily: "inherit", fontSize: 12, fontWeight: 800,
            letterSpacing: "0.02em",
            transition: "all 0.2s",
            position: "relative",
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.background = dockUnread > 0
              ? "linear-gradient(135deg, rgba(245,158,11,.25), rgba(239,68,68,.18))"
              : "rgba(88,0,229,.22)";
            el.style.borderColor = dockUnread > 0 ? "rgba(245,158,11,.55)" : "rgba(88,0,229,.45)";
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.background = dockUnread > 0
              ? "linear-gradient(135deg, rgba(245,158,11,.18), rgba(239,68,68,.12))"
              : "rgba(88,0,229,.14)";
            el.style.borderColor = dockUnread > 0 ? "rgba(245,158,11,.40)" : "rgba(88,0,229,.35)";
          }}
        >
          {/* Icon — phone by default; bottle for Windrose so the button
              matches the "Bottle" label and the pirate aesthetic. */}
          {lobbyTheme === "windrose" ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ flexShrink: 0 }}>
              {/* bottle neck */}
              <rect x="10" y="2" width="4" height="5" strokeWidth="1.5" />
              {/* bottle shoulder/body */}
              <path d="M9 7 Q7 9 7 11 L7 21 Q7 22 8 22 L16 22 Q17 22 17 21 L17 11 Q17 9 15 7 Z" strokeWidth="1.8" />
              {/* label band */}
              <rect x="8" y="13" width="8" height="5" strokeWidth="1" opacity=".45" />
              {/* cork top highlight */}
              <line x1="10" y1="2" x2="14" y2="2" strokeWidth="1.5" opacity=".65" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ flexShrink: 0 }}>
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

          {/* Unread badge — absolute top-right, floats outside the button edge
              like a classic app-icon notification dot. Doesn't fight the button's
              text for space, so it works regardless of label length / padding. */}
          {dockUnread > 0 && (
            <span style={{
              position: "absolute",
              top: -6, right: -6,
              minWidth: 18, height: 18, borderRadius: 999,
              background: "#f59e0b",
              border: "2px solid rgba(10,10,15,.9)",
              fontSize: 9, fontWeight: 900, color: "#000",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              padding: dockUnread > 9 ? "0 4px" : "0",
              lineHeight: 1,
              boxShadow: "0 0 8px rgba(245,158,11,.5)",
              animation: "weered-burner-badge 2s ease-in-out infinite",
              zIndex: 2,
              pointerEvents: "none",
            }}>
              {dockUnread > 99 ? "99+" : dockUnread}
            </span>
          )}
        </button>
      </div>

      {/* Burner phone animations.
          The hot-state glow used to animate box-shadow directly which is
          CPU-bound (browsers can't GPU-composite shadow changes — esp.
          inset shadows). Swapped to a pseudo-element with a static glow
          + animated opacity, which composites cleanly on the GPU. Same
          visual, fraction of the CPU. */}
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
  flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
  gap: 5, padding: "8px 0",
  background: "none", border: "none", cursor: "pointer",
  color: "rgba(255,255,255,.45)", fontFamily: "inherit",
  transition: "color 0.12s, background 0.12s",
};

// Display name that auto-shrinks to fit its container. Steps from 22 →
// 18 → 16 → 14 px; if the smallest size still overflows, ellipsis kicks
// in as the hard safety net. Uppercase Barlow Condensed bold matches
// the rest of the card chrome.
function FittedName({ name }: { name: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const sizes = useMemo(() => [22, 18, 16, 14], []);
  const fontSize = useFitText(ref, name, sizes);
  return (
    <div
      ref={ref}
      style={{
        fontFamily: "'Barlow Condensed', 'Oswald', ui-sans-serif, sans-serif",
        fontSize, fontWeight: 800, letterSpacing: "0.5px",
        textTransform: "uppercase",
        lineHeight: 1.0,
        color: "rgba(243,244,246,.97)",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}
    >
      {name}
    </div>
  );
}
