"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";

import { useOverlay } from "./overlays/OverlayProvider";
import { useWeered } from "./WeeredProvider";
import UserCorner from "./UserCorner";

function pickFirstString(...vals: any[]): string {
  for (const v of vals) if (typeof v === "string" && v.trim()) return v.trim();
  return "";
}

function normRoomKey(x: any): string {
  let s = String(x || "").trim();
  if (!s) return "";
  if (s.startsWith("room:")) s = s.slice(5);
  try {
    s = decodeURIComponent(s);
  } catch {}
  return String(s || "").trim();
}

function normRole(x: any) {
  const s = String(x || "").trim().toUpperCase();
  if (!s) return "";
  if (s === "GOD") return "GOD";
  if (s === "SUPPORT") return "SUPPORT";
  if (s === "STAFF") return "STAFF";
  if (s === "ADMIN") return "ADMIN";
  if (s === "MOD") return "MOD";
  if (s === "OWNER") return "OWNER";
  if (s === "MEMBER") return "MEMBER";
  return s.slice(0, 18);
}

function isPaidUser(u: any) {
  const b =
    Boolean(u?.isPaid ?? u?.paid ?? u?.premium ?? u?.supporter ?? u?.plus ?? u?.pro ?? u?.is_pro ?? u?.isPlus) ||
    /paid|plus|premium|pro|supporter/i.test(pickFirstString(u?.tier, u?.plan, u?.membership, u?.entitlement));
  return b;
}

type Flair = {
  markClass: string;
  nameClass?: string;
  badge?: string;
  badgeClass?: string;
  icon?: React.ReactNode;
};

// Inline SVG icons — no emoji, no mojibake
const ICON_GOD = (
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{display:"inline",verticalAlign:"middle"}}>
    <path d="M6 1L7.5 4.5H11L8.5 6.8L9.5 10L6 8L2.5 10L3.5 6.8L1 4.5H4.5L6 1Z" fill="#fcd34d" stroke="#f59e0b" strokeWidth="0.5"/>
  </svg>
);
const ICON_STAFF = (
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{display:"inline",verticalAlign:"middle"}}>
    <circle cx="6" cy="6" r="5" stroke="#60a5fa" strokeWidth="1.2"/>
    <path d="M6 3v3.5L8 8" stroke="#60a5fa" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);
const ICON_ADMIN = (
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{display:"inline",verticalAlign:"middle"}}>
    <path d="M6 1.5L10 4V8L6 10.5L2 8V4L6 1.5Z" stroke="#a78bfa" strokeWidth="1.2" fill="rgba(124,58,237,0.15)"/>
  </svg>
);
const ICON_MOD = (
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{display:"inline",verticalAlign:"middle"}}>
    <path d="M6 1.5L10 4V8L6 10.5L2 8V4L6 1.5Z" stroke="#34d399" strokeWidth="1.2" fill="rgba(16,185,129,0.12)"/>
    <path d="M4 6l1.5 1.5L8 4.5" stroke="#34d399" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const ICON_OWNER = (
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{display:"inline",verticalAlign:"middle"}}>
    <rect x="2" y="5" width="8" height="5" rx="1" stroke="#f97316" strokeWidth="1.1" fill="rgba(249,115,22,0.1)"/>
    <path d="M4 5V4a2 2 0 014 0v1" stroke="#f97316" strokeWidth="1.1"/>
  </svg>
);
const ICON_PAID = (
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{display:"inline",verticalAlign:"middle"}}>
    <circle cx="6" cy="6" r="4.5" stroke="#a78bfa" strokeWidth="1.1" fill="rgba(124,58,237,0.1)"/>
    <path d="M6 3.5v5M4.5 5h2.2a.8.8 0 010 1.6H4.5" stroke="#a78bfa" strokeWidth="1" strokeLinecap="round"/>
  </svg>
);

function flairFor(u: any): Flair {
  const g = normRole(pickFirstString(u?.globalRole, u?.global_role, u?.global));
  const rr = normRole(pickFirstString(u?.role, u?.roomRole, u?.room_role));
  const paid = isPaidUser(u);

  if (g === "GOD")
    return { markClass: "weered-mark-god", nameClass: "weered-name-god", badge: "GOD", badgeClass: "weered-badge-god", icon: ICON_GOD };

  if (g === "STAFF" || g === "SUPPORT")
    return { markClass: "weered-mark-staff", nameClass: "weered-name-staff", badge: g, badgeClass: "weered-badge-staff", icon: ICON_STAFF };

  if (g === "ADMIN")
    return { markClass: "weered-mark-admin", nameClass: "weered-name-admin", badge: "ADMIN", badgeClass: "weered-badge-admin", icon: ICON_ADMIN };

  if (g === "MOD")
    return { markClass: "weered-mark-mod", nameClass: "weered-name-mod", badge: "MOD", badgeClass: "weered-badge-mod", icon: ICON_MOD };

  if (rr === "OWNER")
    return { markClass: "weered-mark-owner", nameClass: "weered-name-owner", badge: "OWNER", badgeClass: "weered-badge-owner", icon: ICON_OWNER };

  if (rr === "MOD")
    return { markClass: "weered-mark-mod", nameClass: "weered-name-mod", badge: "MOD", badgeClass: "weered-badge-mod", icon: ICON_MOD };

  if (paid) return { markClass: "weered-mark-paid", nameClass: "weered-name-paid", icon: ICON_PAID };

  return { markClass: "weered-mark-none" };
}

/**
 * Hard-coded Presence ordering:
 * 0 Room OWNER
 * 1 STAFF/SUPPORT
 * 2 ADMIN
 * 3 MOD (global or room)
 * 4 everyone else
 */
function groupRank(u: any): number {
  const g = normRole(pickFirstString(u?.globalRole, u?.global_role, u?.global));
  const rr = normRole(pickFirstString(u?.role, u?.roomRole, u?.room_role));

  if (rr === "OWNER") return 0;
  if (g === "STAFF" || g === "SUPPORT") return 1;
  if (g === "ADMIN") return 2;
  if (g === "MOD" || rr === "MOD") return 3;
  return 4;
}

export default function LeftRail() {
  const { openSheet, replaceTop } = useOverlay();
  const pathname = usePathname() || "";
  const { users, joinedRoomId, activeRoomId, me, globalRole } = useWeered();

  const profileUserId = (me?.id ?? me?.userId ?? me?.name ?? me?.username ?? "me").toString();

  const [q, setQ] = useState("");

  const sub = useMemo(() => {
    const m = pathname.match(/^\/r\/([^\/?#]+)/i);
    return m ? `r/${m[1]}` : "";
  }, [pathname]);

  const lobbyHref = sub ? `/lobby?sub=${encodeURIComponent(sub)}` : "/lobby";

  const isLobbyActive = pathname.startsWith("/lobby");
  const isHomeActive = pathname.startsWith("/home") || pathname === "/";

  const rawRoomKey = pickFirstString(joinedRoomId, activeRoomId, "");
  const roomLabel = useMemo(() => normRoomKey(rawRoomKey), [rawRoomKey]);

  const filtered = useMemo(() => {
    const arr0 = Array.isArray(users) ? users : [];
    const arr = (() => {
      const a = [...arr0];
      try {
        const meId = String(me?.id || "");
        if (meId && !a.some((u: any) => String(u?.id || "") === meId)) a.unshift(me);
      } catch {}
      return a;
    })();

    const qq = q.trim().toLowerCase();
    if (!qq) return arr;

    return arr.filter((u: any) => {
      const nm = pickFirstString(u?.name, u?.username, u?.id).toLowerCase();
      return nm.includes(qq);
    });
  }, [users, q, me]);

  const listed = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a: any, b: any) => {
      const ra = groupRank(a);
      const rb = groupRank(b);
      if (ra !== rb) return ra - rb;
      const na = pickFirstString(a?.name, a?.username, a?.id).toLowerCase();
      const nb = pickFirstString(b?.name, b?.username, b?.id).toLowerCase();
      return na.localeCompare(nb);
    });
    return arr;
  }, [filtered]);

  // Presence popover state
  const [presenceHoverOpen, setPresenceHoverOpen] = useState(false);
  const [presenceHoverXY, setPresenceHoverXY] = useState({ x: 0, y: 0 });
  const [presenceHoverName, setPresenceHoverName] = useState("");
  const [presenceHoverUser, setPresenceHoverUser] = useState<any>(null);

  const presenceHoverTimer = useRef<any>(null);
  const presencePopoverRef = useRef<HTMLDivElement | null>(null);
  const presenceAnchorRef = useRef<HTMLDivElement | null>(null);

  const HOVER_W = 280;
  const HOVER_H = 132;

  const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

  const computeHoverXY = (r: DOMRect) => {
    const pad = 10;
    const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;

    // Anchor to row's right edge; center vertically on the row (feels “attached”)
    let x = r.right + 12;
    x = clamp(x, pad, vw - HOVER_W - pad);

    let y = r.top + r.height / 2 - HOVER_H / 2;
    y = clamp(y, pad, vh - HOVER_H - pad);

    return { x, y };
  };

  // ESC/outside click closes presence popover (but clicking the row itself should not instantly dismiss)
  useEffect(() => {
    if (!presenceHoverOpen) return;

    const onDown = (e: MouseEvent) => {
      const pop = presencePopoverRef.current;
      const row = presenceAnchorRef.current;
      const target = e.target as any;

      if (pop && target && pop.contains(target)) return;
      if (row && target && row.contains(target)) return;

      setPresenceHoverOpen(false);
      setPresenceHoverUser(null);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPresenceHoverOpen(false);
        setPresenceHoverUser(null);
      }
    };

    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [presenceHoverOpen]);

  const scheduleClose = (ms = 140) => {
    if (presenceHoverTimer.current) clearTimeout(presenceHoverTimer.current);
    presenceHoverTimer.current = setTimeout(() => {
      setPresenceHoverOpen(false);
      setPresenceHoverUser(null);
    }, ms);
  };

  const cancelClose = () => {
    if (presenceHoverTimer.current) clearTimeout(presenceHoverTimer.current);
  };

  return (
    <div className="weered-left-inner">
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
          onClick={() => openSheet("profile", { userId: profileUserId })}
        >
          Profile
        </button>

        <button
          type="button"
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
          onClick={() => openSheet("settings")}
        >
          Settings
        </button>

        <button
          type="button"
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
          onClick={() => {
            try {
              window.dispatchEvent(new CustomEvent("weered:dock:toggle"));
            } catch {}
          }}
          title="Open Dock"
        >
          Dock
        </button>
      </div>

      <div
        className="weered-brand-block"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: 10,
          marginBottom: 10,
          borderRadius: 16,
          border: "1px solid rgba(148,163,184,.16)",
          background: "rgba(255,255,255,.04)",
        }}
      >
        <div className="flex items-center gap-3">
          <img src="/brand/weered-mark.png" alt="Weered" width={72} height={72} style={{ display: "block" }} />
          <div className="min-w-0">
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 1100, letterSpacing: ".2px", lineHeight: 1.1 }}>weered</div>
              <div style={{ opacity: 0.7, fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                communities | presence | rooms
              </div>
            </div>
          </div>
        </div>
      </div>

      <UserCorner />

      <div className="weered-left-section">
        <div className="weered-left-title">Communities</div>

        <Link
          className={
            "weered-left-link rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 transition-colors flex items-center justify-between " +
            (isLobbyActive ? " weered-left-link-active" : "")
          }
          href={lobbyHref}
        >
          <span>Lobby</span>
          {isLobbyActive ? <span className="h-2 w-2 rounded-full bg-violet-400/90 shadow-[0_0_0_2px_rgba(124,58,237,.18)]" /> : null}
        </Link>

        <Link
          className={
            "weered-left-link rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 transition-colors flex items-center justify-between " +
            (isHomeActive ? " weered-left-link-active" : "")
          }
          href="/home"
        >
          <span>Home</span>
          {isHomeActive ? <span className="h-2 w-2 rounded-full bg-violet-400/90 shadow-[0_0_0_2px_rgba(124,58,237,.18)]" /> : null}
        </Link>
          {(globalRole === "GOD" || globalRole === "STAFF" || globalRole === "SUPPORT") && (
        <Link
          className={
            "weered-left-link rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 transition-colors flex items-center justify-between " +
            (pathname.startsWith("/staff") ? " weered-left-link-active" : "")
          }
          href="/staff"
        >
          <span>Ops</span>
          {pathname.startsWith("/staff") ? <span className="h-2 w-2 rounded-full bg-violet-400/90 shadow-[0_0_0_2px_rgba(124,58,237,.18)]" /> : null}
        </Link>
      )}
        <div className="weered-left-hint mt-2">
          {sub ? (
            <span className="text-[11px] rounded-full border border-white/10 bg-black/10 px-2 py-0.5 opacity-80">context: {sub}</span>
          ) : null}
        </div>
      </div>

      <div className="weered-presence">
        <div className="weered-presence-head">
          <div className="weered-presence-title">Presence</div>
          <div className="weered-presence-sub">{`context: ${roomLabel || (isLobbyActive ? "lobby" : "—")}`} • {listed.length}</div>
        </div>

        <input className="weered-presence-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users..." />

        <div className="weered-presence-list">
          {listed.map((u: any) => {
            const nm = pickFirstString(u?.name, u?.username, "Unknown");
            const rid = pickFirstString(u?.id, nm);
            const you = me?.id && u?.id && me.id === u.id;
            const f = flairFor(u);

            const label = f.badge ? String(f.badge).toLowerCase() : you ? "you" : "member";
            const cls =
              label === "owner" || label === "admin"
                ? "border-emerald-300/25 bg-emerald-500/10 text-emerald-200"
                : label === "staff" || label === "support"
                ? "border-amber-300/25 bg-amber-500/10 text-amber-200"
                : label === "god"
                ? "border-amber-300/25 bg-amber-500/10 text-amber-200"
                : label === "mod"
                ? "border-violet-300/25 bg-violet-500/10 text-violet-200"
                : "border-white/10 bg-black/10 text-white/70";

            return (
              <div
                key={rid}
                className="weered-presence-row"
                style={{
                  display: "flex", alignItems: "center", gap: 9,
                  padding: "7px 9px", borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.07)",
                  background: you ? "rgba(124,58,237,0.07)" : "rgba(255,255,255,0.03)",
                  cursor: "pointer", transition: "background 0.12s, border-color 0.12s",
                }}
                title={nm}
                role="button"
                tabIndex={0}
                onClick={() => replaceTop("profile", { userId: String(u?.id ?? rid ?? nm ?? "unknown") })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    replaceTop("profile", { userId: String(u?.id ?? rid ?? nm ?? "unknown") });
                  }
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = you ? "rgba(124,58,237,0.12)" : "rgba(255,255,255,0.06)";
                  el.style.borderColor = "rgba(255,255,255,0.14)";
                  const r = el.getBoundingClientRect();
                  cancelClose();
                  presenceAnchorRef.current = el as any;
                  setPresenceHoverXY(computeHoverXY(r));
                  setPresenceHoverName(nm);
                  setPresenceHoverUser(u);
                  setPresenceHoverOpen(true);
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = you ? "rgba(124,58,237,0.07)" : "rgba(255,255,255,0.03)";
                  el.style.borderColor = "rgba(255,255,255,0.07)";
                  scheduleClose(160);
                }}
              >
                {/* Avatar */}
                {(() => {
                  const avatarColors: Record<string,string> = {
                    god: "#fcd34d", staff: "#60a5fa", support: "#60a5fa",
                    admin: "#a78bfa", mod: "#34d399", owner: "#f97316",
                    paid: "#a78bfa", member: "#6b7280",
                  };
                  const roleKey = label === "you" ? "member" : label;
                  const aColor = avatarColors[roleKey] || "#6b7280";
                  return (
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                      background: `linear-gradient(135deg, ${aColor}33, ${aColor}66)`,
                      border: `1.5px solid ${aColor}44`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 700, fontSize: 11, color: aColor,
                      position: "relative",
                    }}>
                      {nm[0]?.toUpperCase() ?? "?"}
                      {/* Online dot */}
                      <div style={{
                        position: "absolute", bottom: 0, right: 0,
                        width: 7, height: 7, borderRadius: "50%",
                        background: "#22c55e", border: "1.5px solid var(--weered-bg, #0f1117)",
                        boxShadow: "0 0 4px #22c55e",
                      }} />
                    </div>
                  );
                })()}

                {/* Name + role */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 600, fontSize: 12,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    color: you ? "rgba(167,139,250,0.95)" : "rgba(232,232,236,0.9)",
                    display: "flex", alignItems: "center", gap: 4,
                  }}>
                    {nm}
                    {f.icon && <span style={{ opacity: 0.85, lineHeight: 1 }}>{f.icon}</span>}
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.28)", marginTop: 1, fontFamily: "monospace" }}>
                    {you ? "you" : label}
                  </div>
                </div>

                {/* Badge pill — only for elevated roles */}
                {f.badge && (
                  <span style={{
                    fontSize: 9, fontFamily: "monospace", letterSpacing: "0.04em",
                    padding: "2px 6px", borderRadius: 999, flexShrink: 0,
                    border: `1px solid ${cls.includes("emerald") ? "rgba(52,211,153,0.3)" : cls.includes("amber") ? "rgba(251,191,36,0.3)" : cls.includes("violet") ? "rgba(167,139,250,0.3)" : "rgba(255,255,255,0.1)"}`,
                    background: cls.includes("emerald") ? "rgba(16,185,129,0.1)" : cls.includes("amber") ? "rgba(245,158,11,0.1)" : cls.includes("violet") ? "rgba(124,58,237,0.1)" : "rgba(255,255,255,0.05)",
                    color: cls.includes("emerald") ? "#6ee7b7" : cls.includes("amber") ? "#fcd34d" : cls.includes("violet") ? "#c4b5fd" : "rgba(255,255,255,0.5)",
                  }}>{label}</span>
                )}
              </div>
            );
          })}

          {!listed.length ? <div className="weered-muted" style={{ padding: 10 }}>No users.</div> : null}
        </div>

        {presenceHoverOpen
          ? createPortal(
              <div
                ref={presencePopoverRef}
                style={{ position: "fixed", left: presenceHoverXY.x, top: presenceHoverXY.y, width: HOVER_W, zIndex: 20000 }}
                className="rounded-2xl border border-white/10 bg-slate-950/90 shadow-[0_14px_40px_rgba(0,0,0,.45)] backdrop-blur px-3 py-3"
                onMouseEnter={() => {
                  cancelClose();
                  setPresenceHoverOpen(true);
                }}
                onMouseLeave={() => scheduleClose(180)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-extrabold tracking-tight leading-tight truncate">
                      {pickFirstString(presenceHoverUser?.name, presenceHoverUser?.username, presenceHoverName, "User")}
                    </div>
                    <div className="text-xs opacity-70">Quick actions</div>
                  </div>

                  <button
                    type="button"
                    className="text-xs rounded-full border border-white/10 bg-white/5 px-2 py-1 hover:bg-white/10"
                    onClick={() => {
                      setPresenceHoverOpen(false);
                      setPresenceHoverUser(null);
                    }}
                    title="Close"
                  >
                    Esc
                  </button>
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 font-semibold"
                    onClick={() => {
                      const uid = String(presenceHoverUser?.id ?? presenceHoverUser?.userId ?? presenceHoverUser?.username ?? presenceHoverName ?? "");
                      if (!uid) return;
                      replaceTop("profile", { userId: uid });
                      setPresenceHoverOpen(false);
                      setPresenceHoverUser(null);
                    }}
                  >
                    View profile
                  </button>

                  <button
                    type="button"
                    className="flex-1 rounded-xl border border-violet-300/25 bg-violet-500/10 px-3 py-2 text-sm hover:bg-violet-500/15 font-semibold text-violet-100"
                    onClick={() => {
                      try {
                        const peerName = String(presenceHoverUser?.name ?? presenceHoverUser?.username ?? presenceHoverName ?? "").trim();
                        const peerId = String(presenceHoverUser?.id ?? presenceHoverUser?.userId ?? "").trim();
                        window.dispatchEvent(new CustomEvent("weered:dock:open", { detail: { mode: "dm", peer: { id: peerId, name: peerName } } }));
                      } catch {}
                      setPresenceHoverOpen(false);
                      setPresenceHoverUser(null);
                    }}
                  >
                    Message
                  </button>
                </div>

                <div className="mt-2">
                  <button
                    type="button"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
                    onClick={() => {
                      try {
                        window.dispatchEvent(new CustomEvent("weered:dock:toggle"));
                      } catch {}
                      setPresenceHoverOpen(false);
                      setPresenceHoverUser(null);
                    }}
                  >
                    Dock
                  </button>
                </div>
              </div>,
              document.body
            )
          : null}

        <div className="weered-presence-foot">
          <details className="opacity-80">
            <summary className="cursor-pointer select-none text-xs opacity-70 hover:opacity-90">
              flair <span className="opacity-60">(?)</span>
            </summary>
            <div className="mt-2 weered-legend">
              <span className="weered-legend-item"><span className="weered-mark weered-mark-paid" /> paid</span>
              <span className="weered-legend-item"><span className="weered-mark weered-mark-owner" /> owner</span>
              <span className="weered-legend-item"><span className="weered-mark weered-mark-mod" /> mod</span>
              <span className="weered-legend-item"><span className="weered-mark weered-mark-admin" /> admin</span>
              <span className="weered-legend-item"><span className="weered-mark weered-mark-staff" /> staff</span>
              <span className="weered-legend-item"><span className="weered-mark weered-mark-god" /> god</span>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
