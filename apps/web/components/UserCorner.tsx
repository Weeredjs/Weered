"use client";

import React, { useMemo } from "react";
import { useWeered } from "./WeeredProvider";
import { useOverlay } from "./overlays/OverlayProvider";
import { TierIcon } from "./RoleIcon";
import { avatarBg } from "../lib/avatarColor";
import NotorietyBar from "./NotorietyBar";
import { NotificationBell } from "./NotificationCenter";

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

// Street hierarchy display names
const ROLE_DISPLAY: Record<string, string> = {
  GOD: "GODFATHER", ADMIN: "LIEUTENANT", STAFF: "ENFORCER", SUPPORT: "BACKUP",
  MOD: "CAPTAIN", OWNER: "FOUNDER", MEMBER: "MEMBER",
};
function roleDisplay(dbRole: string): string { return ROLE_DISPLAY[dbRole] || dbRole; }

const ROLE_COLORS: Record<string, { border: string; bg: string; color: string }> = {
  GOD:     { border: "rgba(250,204,21,.38)",  bg: "rgba(234,179,8,.18)",   color: "#fde68a" },
  ADMIN:   { border: "rgba(248,113,113,.34)", bg: "rgba(239,68,68,.14)",   color: "#fca5a5" },
  STAFF:   { border: "rgba(96,165,250,.34)",  bg: "rgba(59,130,246,.14)",  color: "#93c5fd" },
  SUPPORT: { border: "rgba(52,211,153,.34)",  bg: "rgba(16,185,129,.14)",  color: "#6ee7b7" },
  OWNER:   { border: "rgba(249,115,22,.34)",  bg: "rgba(234,88,12,.14)",   color: "#fdba74" },
  MOD:     { border: "rgba(88,0,229,.34)", bg: "rgba(88,0,229,.18)",  color: "rgba(243,244,246,.85)" },
};

const IconSettings = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <circle cx="12" cy="12" r="2.5" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" />
  </svg>
);

const IconDock = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="14" rx="3" />
    <path d="M7 9.5h10M7 13h6" opacity=".6" />
  </svg>
);

export default function UserCorner() {
  const { me, role, globalRole, currentLobbyId, logout } = useWeered() as any;
  const { openSheet } = useOverlay();

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
    return () => window.removeEventListener("weered:avatarColor", handler);
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
    // Poll localStorage every 2s as fallback for missed events
    const poll = () => {
      try {
        const v = Math.max(0, Number(localStorage.getItem("weered:dock:unread")) || 0);
        setDockUnread(v);
      } catch {}
    };
    const interval = setInterval(poll, 2000);
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

  const chipStyle = (r: string) => {
    const c = ROLE_COLORS[r];
    if (!c) return {};
    return { borderColor: c.border, background: c.bg, color: c.color };
  };

  return (
    <div
      style={{
        position: "relative",
        borderRadius: 16,
        border: "1px solid rgba(148,163,184,.13)",
        background: "rgba(255,255,255,.03)",
        marginBottom: 4,
      }}
    >
      {/* Lobby logo / brand watermark */}
      {lobbyLogo ? (
        <div style={{
          position: "absolute", top: 6, right: 8,
          width: 36, height: 36, borderRadius: 8,
          overflow: "hidden", pointerEvents: "none", userSelect: "none",
          opacity: 0.7,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <img
            src={lobbyLogo}
            alt="Lobby logo"
            style={{ width: "100%", height: "100%", objectFit: "contain", filter: "drop-shadow(0 0 6px rgba(0,0,0,.4))" }}
          />
        </div>
      ) : (
        <div style={{
          position: "absolute", top: 8, right: 10,
          opacity: 0.045, pointerEvents: "none", userSelect: "none",
          fontSize: 11, fontWeight: 900, letterSpacing: "3px", textTransform: "uppercase",
          color: lobbyAccent || undefined,
        }}>
          WEERED
        </div>
      )}

      {/* Main identity row */}
      <button
        type="button"
        onClick={() => openSheet("profile", { userId: profileUserId })}
        style={{
          display: "flex", alignItems: "center", gap: 11,
          width: "100%", padding: "12px 14px 10px",
          background: "none", border: "none", cursor: "pointer",
          color: "inherit", textAlign: "left",
        }}
      >
        {/* Avatar */}
        <div style={{
          width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
          background: avatarUrl ? "rgba(255,255,255,.08)" : avatarBg(name, true),
          boxShadow: `0 0 18px ${avatarBg(name, true)}55`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, fontWeight: 950, color: "#fff",
          overflow: "hidden",
        }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt={name + " avatar"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            initial
          )}
        </div>

        {/* Name + chips */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 900, letterSpacing: "-.1px",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            color: "rgba(243,244,246,.95)",
          }}>
            {name}
          </div>
          <div style={{ display: "flex", gap: 5, marginTop: 4, flexWrap: "wrap" }}>
            {/* Pill 1: Best contextual role (global > room) */}
            {(() => {
              const bestRole = gRole || (roomRole && roomRole !== "MEMBER" ? roomRole : "");
              if (!bestRole) return null;
              return (
                <span style={{
                  fontSize: 10, fontWeight: 900, padding: "2px 7px",
                  borderRadius: 999, border: "1px solid rgba(148,163,184,.22)",
                  background: "rgba(255,255,255,.06)",
                  ...chipStyle(bestRole),
                }}>
                  {roleDisplay(bestRole)}
                </span>
              );
            })()}
            {/* Pill 2: Paid tier */}
            {(() => {
              const tier = String(me?.tier || "").toUpperCase();
              if (!tier || tier === "INNOCENT") return null;
              const tierStyles: Record<string, { border: string; bg: string; color: string; icon: React.ReactNode }> = {
                KINGPIN:  { border: "rgba(252,211,77,.45)",  bg: "rgba(252,211,77,.15)", color: "#fde68a", icon: <TierIcon tier="KINGPIN" size={11} /> },
                FELON:    { border: "rgba(249,115,22,.45)",  bg: "rgba(249,115,22,.15)", color: "#fdba74", icon: <TierIcon tier="FELON" size={11} /> },
                INDICTED: { border: "rgba(88,0,229,.40)",    bg: "rgba(88,0,229,.15)",   color: "rgba(243,244,246,.85)", icon: <TierIcon tier="INDICTED" size={11} /> },
              };
              const s = tierStyles[tier];
              if (!s) return null;
              return (
                <span style={{
                  fontSize: 10, fontWeight: 900, padding: "2px 7px",
                  borderRadius: 999, border: `1px solid ${s.border}`,
                  background: s.bg, color: s.color,
                  display: "inline-flex", alignItems: "center", gap: 3,
                }}>
                  <span style={{ fontSize: 9 }}>{s.icon}</span>
                  {tier}
                </span>
              );
            })()}
          </div>
        </div>
      </button>

      {/* Notoriety XP bar + notification bell */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px 0" }}>
        <div style={{ flex: 1 }}>
          <NotorietyBar compact />
        </div>
        <NotificationBell />
      </div>

      {/* Action strip */}
      <div style={{
        display: "flex", gap: 6, padding: "8px 12px 10px",
        borderTop: "1px solid rgba(255,255,255,.05)",
      }}>
        {/* Settings — visible, with label */}
        <button
          type="button"
          onClick={() => openSheet("settings")}
          title="Settings"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: 6, padding: "8px 14px",
            background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.10)",
            borderRadius: 10, cursor: "pointer",
            color: "rgba(255,255,255,.55)", fontFamily: "inherit",
            fontSize: 11, fontWeight: 700,
            transition: "all 0.15s",
            flexShrink: 0,
          }}
          onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "rgba(255,255,255,.12)"; el.style.borderColor = "rgba(255,255,255,.20)"; el.style.color = "rgba(255,255,255,.80)"; }}
          onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "rgba(255,255,255,.06)"; el.style.borderColor = "rgba(255,255,255,.10)"; el.style.color = "rgba(255,255,255,.55)"; }}
        >
          <IconSettings />
          <span>Settings</span>
        </button>

        {/* Logout */}
        <button
          type="button"
          onClick={() => { if (logout) logout(); else { try { localStorage.removeItem("weered_token"); window.location.href = "/login"; } catch {} } }}
          title="Log out"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "8px 10px",
            background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)",
            borderRadius: 10, cursor: "pointer",
            color: "rgba(239,68,68,.5)", fontFamily: "inherit",
            fontSize: 11, fontWeight: 700,
            transition: "all 0.15s",
            flexShrink: 0,
          }}
          onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "rgba(239,68,68,.1)"; el.style.borderColor = "rgba(239,68,68,.25)"; el.style.color = "rgba(239,68,68,.8)"; }}
          onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "rgba(255,255,255,.04)"; el.style.borderColor = "rgba(255,255,255,.08)"; el.style.color = "rgba(239,68,68,.5)"; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
        </button>

        {/* BURNER PHONE — loud, unmissable */}
        <button
          type="button"
          onClick={() => { try { window.dispatchEvent(new CustomEvent("weered:dock:toggle")); } catch {} }}
          title={dockUnread > 0 ? `${dockUnread} unread` : "Messages, friends, crew"}
          className={dockUnread > 0 ? "weered-burner-hot" : ""}
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
            position: "relative", overflow: "hidden",
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
          {/* Burner phone icon */}
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

          <span>Burner</span>

          {/* Unread badge */}
          {dockUnread > 0 && (
            <span style={{
              minWidth: 18, height: 18, borderRadius: 999,
              background: "#f59e0b",
              border: "2px solid rgba(10,10,15,.9)",
              fontSize: 9, fontWeight: 900, color: "#000",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              padding: dockUnread > 9 ? "0 3px" : "0",
              lineHeight: 1,
              boxShadow: "0 0 8px rgba(245,158,11,.5)",
              animation: "weered-burner-badge 2s ease-in-out infinite",
            }}>
              {dockUnread > 99 ? "99+" : dockUnread}
            </span>
          )}
        </button>
      </div>

      {/* Burner phone animations */}
      <style>{`
        @keyframes weered-burner-badge {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
        @keyframes weered-burner-glow {
          0%, 100% { box-shadow: 0 0 8px rgba(245,158,11,.15), inset 0 0 12px rgba(245,158,11,.05); }
          50% { box-shadow: 0 0 18px rgba(245,158,11,.30), inset 0 0 20px rgba(245,158,11,.08); }
        }
        .weered-burner-hot {
          animation: weered-burner-glow 2.5s ease-in-out infinite !important;
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
