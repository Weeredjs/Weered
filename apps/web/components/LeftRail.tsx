"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWeered } from "./WeeredProvider";
import UserCorner from "./UserCorner";

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
  icon?: string; // small glyph next to name
};

function flairFor(u: any): Flair {
  const g = normRole(pickFirstString(u?.globalRole, u?.global_role, u?.global));
  const rr = normRole(pickFirstString(u?.role, u?.roomRole, u?.room_role));
  const paid = isPaidUser(u);

  // Global roles (highest)
  if (g === "GOD") return { markClass: "weered-mark-god", nameClass: "weered-name-god", badge: "GOD", badgeClass: "weered-badge-god", icon: "✦" };
  if (g === "STAFF" || g === "SUPPORT") return { markClass: "weered-mark-staff", nameClass: "weered-name-staff", badge: g, badgeClass: "weered-badge-staff", icon: "🛡" };
  if (g === "ADMIN") return { markClass: "weered-mark-admin", nameClass: "weered-name-admin", badge: "ADMIN", badgeClass: "weered-badge-admin", icon: "🔧" };
  if (g === "MOD") return { markClass: "weered-mark-mod", nameClass: "weered-name-mod", badge: "MOD", badgeClass: "weered-badge-mod", icon: "🛡" };

  // Room roles
  if (rr === "OWNER") return { markClass: "weered-mark-owner", nameClass: "weered-name-owner", badge: "OWNER", badgeClass: "weered-badge-owner", icon: "👑" };
  if (rr === "MOD") return { markClass: "weered-mark-mod", nameClass: "weered-name-mod", badge: "MOD", badgeClass: "weered-badge-mod", icon: "🛡" };

  // Paid member (not bucketed separately)
  if (paid) return { markClass: "weered-mark-paid", nameClass: "weered-name-paid", icon: "◆" };

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
  const pathname = usePathname() || "/";
  const { users, joinedRoomId, activeRoomId, me } = useWeered();
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
    const arr = Array.isArray(users) ? users : [];
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
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 12,
          display: "grid",
          placeItems: "center",
          background: "rgba(255,255,255,.06)",
          border: "1px solid rgba(148,163,184,.18)",
          flex: "0 0 auto",
        }}
      >
        <img src="/weered-logo.png" alt="weered" style={{ width: 22, height: 22, objectFit: "contain" }} />
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 1100, letterSpacing: ".2px", lineHeight: 1.1 }}>weered</div>
        <div style={{ opacity: 0.70, fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          communities • presence • rooms
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
            {roomLabel ? `room: ${roomLabel}` : "room: —"} • {listed.length}
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
              <div key={rid} className="weered-presence-row" title={nm}>
                <div className="weered-presence-left">
                  <span className={`weered-mark ${f.markClass}`} aria-hidden="true" />
                  <div className="weered-presence-namewrap">
                    <div className={`weered-presence-name ${f.nameClass || ""}`}>
                      {nm}
                      {you ? <span className="weered-you">(you)</span> : null}
                      {f.icon ? <span className="weered-flairicon" aria-hidden="true">{f.icon}</span> : null}
                    </div>
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