"use client";

function WeeredCrownedMark({ size = 44 }: { size?: number }) {
  const s = Math.max(28, Math.min(72, size));
  return (
    <svg width={s} height={s} viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Add your SVG content here */}
    </svg>
  );
}

import { useOverlay } from "./overlays/OverlayProvider";
import React, {useMemo, useState, useRef} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWeered } from "./WeeredProvider";
import UserCorner from "./UserCorner";
import { createPortal } from "react-dom";


function pickFirstString(...vals: any[]): string {
  for (const v of vals) if (typeof v === "string" && v.trim()) return v.trim();
  return "";
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
  icon?: React.ReactNode; // icon next to name
};
function flairFor(u: any): Flair {
  const g = normRole(pickFirstString(u?.globalRole, u?.global_role, u?.global));
  const rr = normRole(pickFirstString(u?.role, u?.roomRole, u?.room_role));
  const paid = isPaidUser(u);

  // Global roles (highest)
  if (g === "GOD")
    return {
      markClass: "weered-mark-god",
      nameClass: "weered-name-god",
      badge: "GOD",
      badgeClass: "weered-badge-god",
      icon: "",
    };

  if (g === "STAFF" || g === "SUPPORT")
    return {
      markClass: "weered-mark-staff",
      nameClass: "weered-name-staff",
      badge: g,
      badgeClass: "weered-badge-staff",
      icon: "",
    };

  if (g === "ADMIN")
    return {
      markClass: "weered-mark-admin",
      nameClass: "weered-name-admin",
      badge: "ADMIN",
      badgeClass: "weered-badge-admin",
      icon: "",
    };

  if (g === "MOD")
    return {
      markClass: "weered-mark-mod",
      nameClass: "weered-name-mod",
      badge: "MOD",
      badgeClass: "weered-badge-mod",
      icon: "",
    };

  // Room roles
  if (rr === "OWNER")
    return {
      markClass: "weered-mark-owner",
      nameClass: "weered-name-owner",
      badge: "OWNER",
      badgeClass: "weered-badge-owner",
      icon: "",
    };

  if (rr === "MOD")
    return {
      markClass: "weered-mark-mod",
      nameClass: "weered-name-mod",
      badge: "MOD",
      badgeClass: "weered-badge-mod",
      icon: "",
    };

  // Paid member (not bucketed separately)
  if (paid)
    return {
      markClass: "weered-mark-paid",
      nameClass: "weered-name-paid",
      icon: "",
    };

  return { markClass: "weered-mark-none" };
}


/**
 * Hard-coded Presence ordering:
 * 0 Room OWNER
 * 1 STAFF/SUPPORT
 * 2 ADMIN
 * 3 MOD (global or room)
 * 4 everyone else
 *
 * NOTE: "paid" is NOT a group; paid users remain scattered naturally.
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
  const [presenceHoverOpen, setPresenceHoverOpen] = useState(false);
  const [presenceHoverXY, setPresenceHoverXY] = useState({ x: 0, y: 0 });
  const [presenceHoverName, setPresenceHoverName] = useState("");
  const [presenceHoverUser, setPresenceHoverUser] = useState<any>(null);
  const presenceHoverTimer = useRef<any>(null);

  const HOVER_W = 260;
  const HOVER_H = 118; // approx card height (keeps us onscreen)

  const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

  const computeHoverXY = (r: DOMRect) => {
    const pad = 10;
    const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;

    // prefer to the right of the row; clamp in viewport
    let x = r.right + 10;
    x = clamp(x, pad, vw - HOVER_W - pad);

    // align to row top; clamp vertically
    let y = r.top;
    y = clamp(y, pad, vh - HOVER_H - pad);

    return { x, y };
  };

  const { openSheet, replaceTop } = useOverlay();// ---- compile-safe fallback (will be replaced with real hover user ref) ----
  const hoverUser: any = null;
  // ---- compile-safe fallback (will be replaced with real hover user ref) ----
const pathname = usePathname() || "";
  const roomFromPath = pathname.startsWith("/room/") ? pathname.slice("/room/".length).split("/")[0] : "";
  const roomCtxLabel = (() => { try { return decodeURIComponent(roomFromPath || ""); } catch { return roomFromPath || "-"; } })();
  const { users, joinedRoomId, activeRoomId, me } = useWeered();



  const profileUserId = (me?.id ?? me?.userId ?? me?.name ?? me?.username ?? "me").toString();
  const railRoomLabel = (() => { try { return decodeURIComponent(String(activeRoomId ?? joinedRoomId ?? "")); } catch { return String(activeRoomId ?? joinedRoomId ?? "-"); } })();
  const [q, setQ] = useState("");

  const sub = useMemo(() => {
    const m = pathname.match(/^\/r\/([^\/?#]+)/i);
    return m ? `r/${m[1]}` : "";
  }, [pathname]);

  const lobbyHref = sub ? `/lobby?sub=${encodeURIComponent(sub)}` : "/lobby";

  const isLobbyActive = pathname.startsWith("/lobby");
  const isHomeActive = pathname.startsWith("/room/@me") || pathname === "/";

  const roomLabel = pickFirstString(joinedRoomId, activeRoomId, "");

  const filtered = useMemo(() => {
    const arr0 = Array.isArray(users) ? users : [];

    // Ensure me is visible even if presence list hasn't populated yet
    const arr = (() => {
      const a = [...arr0];
      try {
        const meId = String(me?.id || "");
        if (meId && !a.some((u: any) => String(u?.id || "") === meId)) {
          a.unshift(me);
        }
      } catch {}
      return a;
    })();
    const qq = q.trim().toLowerCase();
    if (!qq) return arr;
    return arr.filter((u: any) => {
      const nm = pickFirstString(u?.name, u?.username, u?.id).toLowerCase();
      return nm.includes(qq);
    });
  }, [users, q]);

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
    onClick={() => { try { window.dispatchEvent(new CustomEvent("weered:dock:toggle")); } catch {} }}
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
        <div style={{ opacity: 0.70, fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
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
          className={"weered-left-link" + (isLobbyActive ? " weered-left-link-active" : "")}
          href={lobbyHref}
        >
          Lobby
        </Link>

        <Link
          className={"weered-left-link" + (isHomeActive ? " weered-left-link-active" : "")}
          href="/room/@me"
        >
          Home
        </Link>

        <div className="weered-left-hint">
          {sub ? `context: ${sub}` : "context: (no subreddit yet)"}
        </div>
      </div>

      <div className="weered-presence">
        <div className="weered-presence-head">
          <div className="weered-presence-title">Presence</div>
          <div className="weered-presence-sub">
            {roomLabel ? `room: ${roomLabel}` : "room: "} | {listed.length}
          </div>
        </div>

        <input
          className="weered-presence-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search users..."
        />

        <div className="weered-presence-list">
          {listed.map((u: any) => {
            const nm = pickFirstString(u?.name, u?.username, "Unknown");
            const rid = pickFirstString(u?.id, nm);
            const you = me?.id && u?.id && me.id === u.id;
            const f = flairFor(u);

            return (
              <div
  key={rid}
  className="weered-presence-row"
  title={nm}
  onMouseEnter={(e) => {
    const r = (e.currentTarget as any).getBoundingClientRect();
    if (presenceHoverTimer.current) clearTimeout(presenceHoverTimer.current);

    setPresenceHoverXY(computeHoverXY(r));
    setPresenceHoverName(nm);
    setPresenceHoverUser(u);
    setPresenceHoverOpen(true);
  }}
  onMouseLeave={() => {
    if (presenceHoverTimer.current) clearTimeout(presenceHoverTimer.current);
    presenceHoverTimer.current = setTimeout(() => {
      setPresenceHoverOpen(false);
      setPresenceHoverUser(null);
    }, 140);
  }}
>
                <div className="weered-presence-left">
                  <span className={`weered-mark ${f.markClass}`} aria-hidden="true" />
  <div className="weered-presence-namewrap">
    <div className={`weered-presence-name ${f.nameClass || ""}`}>
      <button
        type="button"
        style={{ all: "unset", cursor: "pointer" }}
        className="hover:underline"
        onClick={() => replaceTop("profile", { userId: String(u?.id ?? rid ?? nm ?? "unknown") })}
      >
        {nm}
      </button>
    </div>

    <div className="weered-presence-subline">
      {f.badge ? `role: ${f.badge}` : (you ? "you" : "member")}
    </div>
    {you ? <span className="weered-you"></span> : null}
    {f.icon ? <span className="weered-flairicon" aria-hidden="true">{f.icon}</span> : null}
  </div>
</div>

                {f.badge ? (
                  <span className={`weered-badge ${f.badgeClass || ""}`}>{f.badge}</span>
                ) : null}
              </div>
            );
          })}

          {!listed.length ? (
            <div className="weered-muted" style={{ padding: 10 }}>No users.</div>
          ) : null}
        </div>

              {presenceHoverOpen
  ? createPortal(
      <div
        style={{
          position: "fixed",
          left: presenceHoverXY.x,
          top: presenceHoverXY.y,
          width: 260,
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,.10)",
          background: "rgba(17,24,39,.92)",
          padding: 10,
          boxShadow: "0 14px 40px rgba(0,0,0,.45)",
          zIndex: 20000,
        }}
        onMouseEnter={() => {
          if (presenceHoverTimer.current) clearTimeout(presenceHoverTimer.current);
          setPresenceHoverOpen(true);
        }}
        onMouseLeave={() => setPresenceHoverOpen(false)}
      >
        <div style={{ fontWeight: 950, marginBottom: 4 }}>{pickFirstString(presenceHoverUser?.name, presenceHoverUser?.username, presenceHoverName, "User")}</div>
        <div style={{ fontSize: 12, opacity: 0.78, marginBottom: 10 }}>Quick view (placeholder)</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
  style={{
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(255,255,255,.04)",
    padding: "6px 10px",
    cursor: "pointer",
    color: "rgba(229,231,235,.95)",
    fontWeight: 900,
  }}
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
  style={{
    borderRadius: 10,
    border: "1px solid rgba(124,58,237,.35)",
    background: "rgba(124,58,237,.18)",
    padding: "6px 10px",
    cursor: "pointer",
    color: "rgba(229,231,235,.95)",
    fontWeight: 900,
  }}
  onClick={() => {
    try {
    const peerName = String(presenceHoverUser?.name ?? presenceHoverUser?.username ?? presenceHoverName ?? "").trim();
    const peerId = String(presenceHoverUser?.id ?? presenceHoverUser?.userId ?? "").trim();
    window.dispatchEvent(
      new CustomEvent("weered:dock:open", {
        detail: { mode: "dm", peer: { id: peerId, name: peerName } },
      })
    );
  } catch {}
    setPresenceHoverOpen(false);
    setPresenceHoverUser(null);
  }}
>
  Message
</button>
  <button
    type="button"
    className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
    onClick={() => { try { window.dispatchEvent(new CustomEvent("weered:dock:toggle")); } catch {} }}
    title="Open Dock"
  >
    Dock
  </button>
        </div>
      </div>,
      document.body
    )
  : null}


        <div className="weered-presence-foot">
          <span className="weered-muted">flair:</span>
          <span className="weered-legend">
            <span className="weered-legend-item"><span className="weered-mark weered-mark-paid" /> paid</span>
            <span className="weered-legend-item"><span className="weered-mark weered-mark-owner" /> owner</span>
            <span className="weered-legend-item"><span className="weered-mark weered-mark-mod" /> mod</span>
            <span className="weered-legend-item"><span className="weered-mark weered-mark-admin" /> admin</span>
            <span className="weered-legend-item"><span className="weered-mark weered-mark-staff" /> staff</span>
            <span className="weered-legend-item"><span className="weered-mark weered-mark-god" /> god</span>
          </span>
        </div>
      </div>
    </div>
  );
}








