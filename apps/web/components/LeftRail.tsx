"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createPortal } from "react-dom";

import { useOverlay } from "./overlays/OverlayProvider";
import { useWeered } from "./WeeredProvider";
import UserCorner from "./UserCorner";
import { avatarBg } from "../lib/avatarColor";

function pickFirstString(...vals: any[]): string {
  for (const v of vals) if (typeof v === "string" && v.trim()) return v.trim();
  return "";
}

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE as string) || "http://127.0.0.1:4000";

function authHeaders() {
  try { const t = localStorage.getItem("weered_token") || ""; return t ? { Authorization: `Bearer ${t}` } : {}; } catch { return {}; }
}

function normRoomKey(x: any): string {
  let s = String(x || "").trim();
  if (!s) return "";
  if (s.startsWith("room:")) s = s.slice(5);
  try { s = decodeURIComponent(s); } catch {}
  return String(s || "").trim();
}

// ── FIX: strip room: prefix before routing logic ──────────────────────────────
function lobbyHref(id: string): string {
  let clean = id || "";
  if (clean.startsWith("room:")) clean = clean.slice(5);
  try { clean = decodeURIComponent(clean); } catch {}
  if (!clean) return "/lobby";
  // Lobby slugs: lowercase with hyphens/dots (e.g. cnc-generals, weered.ca, r/gaming)
  // Room hashes: mixed-case alphanumeric (e.g. XlKwIz, MwlnQa, 7AE05O)
  const isLobbySlug = /^[a-z][a-z0-9._/-]*$/.test(clean) || clean.includes(".") || clean.includes("/");
  if (isLobbySlug) return `/lobby/${encodeURIComponent(clean)}`;
  return `/room/${encodeURIComponent(clean)}`;
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

function userTier(u: any): string {
  const t = String(u?.tier || "").toUpperCase();
  if (t === "KINGPIN") return "KINGPIN";
  if (t === "FELON") return "FELON";
  if (t === "INDICTED") return "INDICTED";
  return "INNOCENT";
}
function isPaidUser(u: any) {
  const t = userTier(u);
  return t === "INDICTED" || t === "FELON" || t === "KINGPIN";
}

type Flair = {
  markClass: string;
  nameClass?: string;
  badge?: string;
  badgeClass?: string;
  icon?: React.ReactNode;
};

// ── Role display names (DB value → street name) ─────────────────────────────
const ROLE_DISPLAY: Record<string, string> = {
  GOD: "Godfather", ADMIN: "Lieutenant", STAFF: "Enforcer", SUPPORT: "Lookout",
  MOD: "Captain", OWNER: "Founder",
};
function roleDisplay(dbRole: string): string { return ROLE_DISPLAY[dbRole] || dbRole.toLowerCase(); }

// ── Role icons — emoji, readable at any size ─────────────────────────────────
const ICON_GOD     = <span style={{ fontSize: 12, lineHeight: 1 }}>👑</span>;
const ICON_ADMIN   = <span style={{ fontSize: 12, lineHeight: 1 }}>🔱</span>;
const ICON_STAFF   = <span style={{ fontSize: 12, lineHeight: 1 }}>🛡</span>;
const ICON_SUPPORT = <span style={{ fontSize: 12, lineHeight: 1 }}>💎</span>;
const ICON_MOD     = <span style={{ fontSize: 12, lineHeight: 1 }}>⚡</span>;
const ICON_OWNER   = <span style={{ fontSize: 12, lineHeight: 1 }}>🔑</span>;
const ICON_INDICTED = <span style={{ fontSize: 10, lineHeight: 1 }}>⚖️</span>;
const ICON_FELON    = <span style={{ fontSize: 10, lineHeight: 1 }}>🔥</span>;
const ICON_KINGPIN_TIER = <span style={{ fontSize: 10, lineHeight: 1 }}>💀</span>;

function flairFor(u: any): Flair {
  const g  = normRole(pickFirstString(u?.globalRole, u?.global_role, u?.global));
  const rr = normRole(pickFirstString(u?.role, u?.roomRole, u?.room_role));
  const paid = isPaidUser(u);

  if (g === "GOD")
    return { markClass: "weered-mark-god", nameClass: "weered-name-god", badge: "GOD", badgeClass: "weered-badge-god", icon: ICON_GOD };
  if (g === "ADMIN")
    return { markClass: "weered-mark-admin", nameClass: "weered-name-admin", badge: "ADMIN", badgeClass: "weered-badge-admin", icon: ICON_ADMIN };
  if (g === "STAFF")
    return { markClass: "weered-mark-staff", nameClass: "weered-name-staff", badge: "STAFF", badgeClass: "weered-badge-staff", icon: ICON_STAFF };
  if (g === "SUPPORT")
    return { markClass: "weered-mark-staff", nameClass: "weered-name-staff", badge: "SUPPORT", badgeClass: "weered-badge-staff", icon: ICON_SUPPORT };
  if (g === "MOD")
    return { markClass: "weered-mark-mod", nameClass: "weered-name-mod", badge: "MOD", badgeClass: "weered-badge-mod", icon: ICON_MOD };
  if (rr === "OWNER")
    return { markClass: "weered-mark-owner", nameClass: "weered-name-owner", badge: "OWNER", badgeClass: "weered-badge-owner", icon: ICON_OWNER };
  if (rr === "MOD")
    return { markClass: "weered-mark-mod", nameClass: "weered-name-mod", badge: "MOD", badgeClass: "weered-badge-mod", icon: ICON_MOD };
  const tier = userTier(u);
  if (tier === "KINGPIN") return { markClass: "weered-mark-paid", nameClass: "weered-name-paid", badge: "KINGPIN", badgeClass: "weered-badge-kingpin", icon: ICON_KINGPIN_TIER };
  if (tier === "FELON") return { markClass: "weered-mark-paid", nameClass: "weered-name-paid", badge: "FELON", badgeClass: "weered-badge-felon", icon: ICON_FELON };
  if (tier === "INDICTED") return { markClass: "weered-mark-paid", nameClass: "weered-name-paid", badge: "INDICTED", badgeClass: "weered-badge-indicted", icon: ICON_INDICTED };
  return { markClass: "weered-mark-none" };
}

function groupRank(u: any): number {
  const g  = normRole(pickFirstString(u?.globalRole, u?.global_role, u?.global));
  const rr = normRole(pickFirstString(u?.role, u?.roomRole, u?.room_role));
  if (g === "GOD") return 0;
  if (rr === "OWNER") return 1;
  if (g === "ADMIN") return 2;
  if (g === "STAFF" || g === "SUPPORT") return 3;
  if (g === "MOD" || rr === "MOD") return 4;
  return 5;
}

// ── Simple accent color from room name hash ───────────────────────────────────
const ROOM_ACCENTS = [
  "#7c6af7", "#22c55e", "#f97316", "#60a5fa", "#ef4444",
  "#eab308", "#ec4899", "#14b8a6", "#a78bfa", "#fb923c",
];
function accentForRoom(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffffff;
  return ROOM_ACCENTS[Math.abs(h) % ROOM_ACCENTS.length];
}

export default function LeftRail() {
  const { openSheet, replaceTop } = useOverlay();
  const pathname = usePathname() || "";
  const router = useRouter();
  const { users, joinedRoomId, activeRoomId, me, globalRole, currentLobbyId, joinStatus, leave } = useWeered() as any;

  const profileUserId = (me?.id ?? me?.userId ?? me?.name ?? me?.username ?? "me").toString();

  const [q, setQ] = useState("");

  const sub = useMemo(() => {
    const m = pathname.match(/^\/r\/([^\/?#]+)/i);
    return m ? `r/${m[1]}` : "";
  }, [pathname]);

  const lobbyHrefMain = currentLobbyId && currentLobbyId !== "lobby"
    ? `/lobby/${encodeURIComponent(currentLobbyId)}`
    : sub ? `/lobby?sub=${encodeURIComponent(sub)}` : "/lobby";

  const isLobbyActive = pathname.startsWith("/lobby");
  const isHomeActive  = pathname.startsWith("/home") || pathname === "/";

  const rawRoomKey = pickFirstString(joinedRoomId, activeRoomId, "");
  const roomLabel  = useMemo(() => normRoomKey(rawRoomKey), [rawRoomKey]);

  // ── Lobby-wide presence aggregation ──────────────────────────────────────
  const [lobbyPresence, setLobbyPresence] = useState<any[]>([]);
  const lobbyPresenceId = isLobbyActive ? (currentLobbyId || "") : "";

  useEffect(() => {
    if (!lobbyPresenceId || lobbyPresenceId === "lobby") { setLobbyPresence([]); return; }
    let cancelled = false;
    const fetchPresence = async () => {
      try {
        const r = await fetch(`${API_BASE}/lobbies/${encodeURIComponent(lobbyPresenceId)}/presence`, { headers: authHeaders() as any });
        const j = await r.json();
        if (!cancelled && j.ok && Array.isArray(j.users)) setLobbyPresence(j.users);
      } catch {}
    };
    fetchPresence();
    const t = setInterval(fetchPresence, 6000);
    return () => { cancelled = true; clearInterval(t); };
  }, [lobbyPresenceId]);

  // When on a lobby page, merge lobby-wide presence with WS users
  const effectiveUsers = useMemo(() => {
    if (!isLobbyActive || !lobbyPresence.length) return users;
    // Merge: lobby presence is the primary source, WS users fill gaps
    const seen = new Map<string, any>();
    for (const u of lobbyPresence) { if (u?.id) seen.set(u.id, u); }
    for (const u of (Array.isArray(users) ? users : [])) {
      if (u?.id && !seen.has(u.id)) seen.set(u.id, u);
    }
    return Array.from(seen.values());
  }, [isLobbyActive, lobbyPresence, users]);

  const filtered = useMemo(() => {
    const arr0 = Array.isArray(effectiveUsers) ? effectiveUsers : [];
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
      const ra = groupRank(a); const rb = groupRank(b);
      if (ra !== rb) return ra - rb;
      const na = pickFirstString(a?.name, a?.username, a?.id).toLowerCase();
      const nb = pickFirstString(b?.name, b?.username, b?.id).toLowerCase();
      return na.localeCompare(nb);
    });
    return arr;
  }, [filtered]);

  // ── Recents + Favorites ───────────────────────────────────────────────────
  const RECENTS_KEY = "weered:recents:v1";
  const FAVS_KEY    = "weered:favs:v1";

  const [recents, setRecents] = useState<string[]>(() => {
    try { const r = localStorage.getItem(RECENTS_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
  });
  const [favs, setFavs] = useState<string[]>(() => {
    try { const r = localStorage.getItem(FAVS_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
  });

  useEffect(() => {
    const raw = normRoomKey(joinedRoomId || activeRoomId || "");
    if (!raw || raw === "lobby") return;
    const room = raw.startsWith("room:") ? raw.slice(5) : raw;
    setRecents(prev => {
      const filtered = prev.filter(r => {
        const n = r.startsWith("room:") ? r.slice(5) : r;
        return n !== room;
      });
      const next = [room, ...filtered].slice(0, 8);
      try { localStorage.setItem(RECENTS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
    // Enrich the name cache with lobbyId context if we know which lobby we're in
    if (currentLobbyId && currentLobbyId !== "lobby") {
      try {
        const cache = JSON.parse(localStorage.getItem("weered:roomnames:v1") || "{}");
        const existing = cache[room];
        if (existing && typeof existing === "object") {
          if (!existing.lobbyId) {
            existing.lobbyId = currentLobbyId;
            localStorage.setItem("weered:roomnames:v1", JSON.stringify(cache));
            setRoomNameCache({ ...cache });
          }
        } else if (!existing) {
          cache[room] = { name: room, lobbyId: currentLobbyId, count: 0 };
          localStorage.setItem("weered:roomnames:v1", JSON.stringify(cache));
          setRoomNameCache({ ...cache });
        }
      } catch {}
    }
  }, [joinedRoomId, activeRoomId, currentLobbyId]);

  function toggleFav(room: string) {
    setFavs(prev => {
      const next = prev.includes(room) ? prev.filter(r => r !== room) : [room, ...prev].slice(0, 12);
      try { localStorage.setItem(FAVS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  const recentRooms = recents.filter(r => !favs.includes(r));

  // ── Lobby logo cache (for recents/favs room sublabels) ────────────────────
  const [lobbyLogos, setLobbyLogos] = useState<Record<string, string>>({});
  useEffect(() => {
    fetch(`${API_BASE}/lobbies`).then(r => r.json()).then(j => {
      if (!Array.isArray(j?.lobbies)) return;
      const map: Record<string, string> = {};
      for (const l of j.lobbies) {
        if (l.id && l.logoUrl) map[l.id] = l.logoUrl;
      }
      setLobbyLogos(map);
    }).catch(() => {});
  }, []);

  // ── Room name cache ────────────────────────────────────────────────────────
  const [roomNameCache, setRoomNameCache] = useState<Record<string,string>>(() => {
    try { return JSON.parse(localStorage.getItem("weered:roomnames:v1") || "{}"); } catch { return {}; }
  });
  useEffect(() => {
    const onFocus = () => {
      try { setRoomNameCache(JSON.parse(localStorage.getItem("weered:roomnames:v1") || "{}")); } catch {}
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);
  const getRoomName = (id: string) => {
    const v = roomNameCache[id];
    if (!v) return id;
    if (typeof v === "string") return v;
    if (typeof v === "object" && v !== null) return (v as any).name || id;
    return id;
  };
  const getRoomLobby = (id: string): string => {
    const v = roomNameCache[id];
    if (typeof v === "object" && v !== null) return (v as any).lobbyId || (v as any).lobby || "";
    return "";
  };
  // Sublabel: show parent lobby name for rooms, nothing for lobby slugs in recents
  const getRoomSublabel = (id: string): string => {
    const lobby = getRoomLobby(id);
    if (lobby) return lobby;
    const isLobbySlug = /^[a-z][a-z0-9._-]*$/.test(id) && id.length > 2;
    if (isLobbySlug) return "lobby";
    return "";
  };
  const getLobbyLogo = (id: string): string | null => {
    if (lobbyLogos[id]) return lobbyLogos[id];
    const lobby = getRoomLobby(id);
    if (lobby && lobbyLogos[lobby]) return lobbyLogos[lobby];
    return null;
  };

  // ── Online counts for favs/recents (fetched periodically) ─────────────────
  const [roomCounts, setRoomCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    const ids = [...new Set([...favs, ...recentRooms])];
    if (!ids.length) return;
    const fetchCounts = async () => {
      try {
        const j = await fetch(`${API_BASE}/rooms`, { headers: authHeaders() }).then(r => r.json());
        const rooms = Array.isArray(j?.rooms) ? j.rooms : [];
        const counts: Record<string, number> = {};
        for (const rm of rooms) {
          if (rm.id) counts[rm.id] = Number(rm.onlineCount ?? rm.users ?? rm.memberCount ?? 0);
        }
        setRoomCounts(counts);
      } catch {}
    };
    fetchCounts();
    const t = setInterval(fetchCounts, 20000);
    return () => clearInterval(t);
  }, [favs.length, recentRooms.length]);

  // ── Pending knock indicator ─────────────────────────────────────────────────
  const [pendingRooms, setPendingRooms] = useState<Set<string>>(new Set());
  useEffect(() => {
    const onKnockQueued = (e: Event) => {
      const rid = (e as CustomEvent)?.detail?.roomId;
      if (rid) setPendingRooms(prev => new Set(prev).add(String(rid)));
    };
    const onAdmitted = (e: Event) => {
      const rid = (e as CustomEvent)?.detail?.roomId;
      if (rid) setPendingRooms(prev => { const next = new Set(prev); next.delete(String(rid)); return next; });
    };
    const onDenied = (e: Event) => {
      const rid = (e as CustomEvent)?.detail?.roomId;
      if (rid) setPendingRooms(prev => { const next = new Set(prev); next.delete(String(rid)); return next; });
    };
    window.addEventListener("weered:knock:queued", onKnockQueued);
    window.addEventListener("weered:knock:admitted", onAdmitted);
    window.addEventListener("weered:knock:denied", onDenied);
    return () => {
      window.removeEventListener("weered:knock:queued", onKnockQueued);
      window.removeEventListener("weered:knock:admitted", onAdmitted);
      window.removeEventListener("weered:knock:denied", onDenied);
    };
  }, []);

  const pendingFromProvider = typeof joinStatus === "object" && joinStatus !== null ? joinStatus : {};
  const isRoomPending = (room: string): boolean => {
    if (pendingRooms.has(room)) return true;
    const clean = room.startsWith("room:") ? room.slice(5) : room;
    if (pendingRooms.has(clean) || pendingRooms.has(`room:${clean}`)) return true;
    if (pendingFromProvider[room] === "knocking" || pendingFromProvider[clean] === "knocking" || pendingFromProvider[`room:${clean}`] === "knocking") return true;
    return false;
  };

  // ── Presence popover ───────────────────────────────────────────────────────
  const [presenceHoverOpen, setPresenceHoverOpen] = useState(false);
  const [presenceHoverXY, setPresenceHoverXY] = useState({ x: 0, y: 0 });
  const [presenceHoverName, setPresenceHoverName] = useState("");
  const [presenceHoverUser, setPresenceHoverUser] = useState<any>(null);
  const [friendRequestNote, setFriendRequestNote] = useState("");

  const presenceHoverTimer = useRef<any>(null);
  const presencePopoverRef = useRef<HTMLDivElement | null>(null);
  const presenceAnchorRef  = useRef<HTMLDivElement | null>(null);

  const HOVER_W = 280;
  const HOVER_H = 132;

  const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
  const computeHoverXY = (r: DOMRect) => {
    const pad = 10;
    const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;
    let x = clamp(r.right + 12, pad, vw - HOVER_W - pad);
    let y = clamp(r.top + r.height / 2 - HOVER_H / 2, pad, vh - HOVER_H - pad);
    return { x, y };
  };

  useEffect(() => {
    if (!presenceHoverOpen) return;
    const onDown = (e: MouseEvent) => {
      const pop = presencePopoverRef.current;
      const row = presenceAnchorRef.current;
      const target = e.target as any;
      if (pop && target && pop.contains(target)) return;
      if (row && target && row.contains(target)) return;
      setPresenceHoverOpen(false); setPresenceHoverUser(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setPresenceHoverOpen(false); setPresenceHoverUser(null); }
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey); };
  }, [presenceHoverOpen]);

  const scheduleClose = (ms = 140) => {
    if (presenceHoverTimer.current) clearTimeout(presenceHoverTimer.current);
    presenceHoverTimer.current = setTimeout(() => { setPresenceHoverOpen(false); setPresenceHoverUser(null); }, ms);
  };
  const cancelClose = () => { if (presenceHoverTimer.current) clearTimeout(presenceHoverTimer.current); };

  // ── Active room info for favs/recents ─────────────────────────────────────
  const activeRoomNorm = normRoomKey(joinedRoomId || activeRoomId || "");

  return (
    <div className="weered-left-inner">
      <UserCorner />

      {/* ── Communities ───────────────────────────────────────────────────── */}
      <div className="weered-left-section">
        <div className="weered-left-title">Communities</div>

        <Link
          className={"weered-left-link rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 transition-colors flex items-center justify-between " + (isLobbyActive ? " weered-left-link-active" : "")}
          href={lobbyHrefMain}
        >
          <span>Lobby</span>
          {isLobbyActive ? <span className="h-2 w-2 rounded-full bg-violet-400/90 shadow-[0_0_0_2px_rgba(124,58,237,.18)]" /> : null}
        </Link>

        <button
          type="button"
          className={"weered-left-link rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 transition-colors flex items-center justify-between w-full text-left " + (isHomeActive ? " weered-left-link-active" : "")}
          onClick={() => { try { leave(); } catch {} router.push("/home"); }}
        >
          <span>Home</span>
          {isHomeActive ? <span className="h-2 w-2 rounded-full bg-violet-400/90 shadow-[0_0_0_2px_rgba(124,58,237,.18)]" /> : null}
        </button>

        {(globalRole === "GOD" || globalRole === "STAFF" || globalRole === "SUPPORT") && (
          <Link
            className={"weered-left-link rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 transition-colors flex items-center justify-between " + (pathname.startsWith("/staff") ? " weered-left-link-active" : "")}
            href="/staff"
          >
            <span>Ops</span>
            {pathname.startsWith("/staff") ? <span className="h-2 w-2 rounded-full bg-violet-400/90 shadow-[0_0_0_2px_rgba(124,58,237,.18)]" /> : null}
          </Link>
        )}

        <div className="weered-left-hint mt-2">
          {sub ? <span className="text-[11px] rounded-full border border-white/10 bg-black/10 px-2 py-0.5 opacity-80">context: {sub}</span> : null}
        </div>
      </div>

      {/* ── Presence ──────────────────────────────────────────────────────── */}
      <div className="weered-presence">
        <div className="weered-presence-head">
          <div className="weered-presence-title">Presence</div>
          <div className="weered-presence-sub">{isLobbyActive && lobbyPresence.length > 0 ? `${lobbyPresenceId} · all rooms` : `context: ${getRoomName(rawRoomKey) || (isLobbyActive ? "lobby" : "—")}`} • {listed.length}</div>
        </div>

        <input className="weered-presence-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users..." />

        <div className="weered-presence-list" style={{ maxHeight:"calc(100vh - 440px)", overflowY:"auto", scrollbarWidth:"thin", scrollbarColor:"rgba(148,163,184,.2) transparent" }}>
          {listed.map((u: any) => {
            const nm  = pickFirstString(u?.name, u?.username, "Unknown");
            const rid = pickFirstString(u?.id, nm);
            const you = me?.id && u?.id && me.id === u.id;
            const f   = flairFor(u);

            const label = f.badge ? String(f.badge).toLowerCase() : you ? "you" : "member";
            const cls   =
              label === "owner" || label === "admin"  ? "border-emerald-300/25 bg-emerald-500/10 text-emerald-200"
              : label === "staff" || label === "support" || label === "god" ? "border-amber-300/25 bg-amber-500/10 text-amber-200"
              : label === "mod"   ? "weered-mod"
              : label === "kingpin" ? "weered-tier-kingpin"
              : label === "felon"   ? "weered-tier-felon"
              : label === "indicted" ? "weered-tier-indicted"
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
                {(() => {
                  const roleColors: Record<string,string> = { god: "#fcd34d", staff: "#60a5fa", support: "#60a5fa", admin: "#a78bfa", mod: "#34d399", owner: "#f97316", paid: "#a78bfa" };
                  const aColor = roleColors[label] || avatarBg(nm, label === "you", u?.avatarColor);
                  const userAvatar = u?.avatar || null;
                  return (
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                      background: userAvatar ? "rgba(255,255,255,.08)" : `linear-gradient(135deg, ${aColor}33, ${aColor}66)`,
                      border: `1.5px solid ${aColor}44`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 700, fontSize: 11, color: aColor,
                      position: "relative",
                    }}>
                      <div style={{ width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {userAvatar ? <img src={userAvatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : nm[0]?.toUpperCase() ?? "?"}
                      </div>
                      <div style={{ position: "absolute", bottom: -1, right: -1, width: 8, height: 8, borderRadius: "50%", background: "#22c55e", border: "2px solid var(--weered-bg, #0f1117)", boxShadow: "0 0 4px #22c55e" }} />
                    </div>
                  );
                })()}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: you ? "rgba(243,244,246,0.95)" : "rgba(232,232,236,0.9)", display: "flex", alignItems: "center", gap: 4 }}>
                    {nm}
                    {f.icon && <span style={{ opacity: 0.85, lineHeight: 1 }}>{f.icon}</span>}
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.28)", marginTop: 1, fontFamily: "monospace" }}>
                    {you ? "you" : isLobbyActive && u?.roomName ? `in ${u.roomName}` : roleDisplay(f.badge || "member")}
                  </div>
                </div>
                {f.badge && (() => {
                  // Badge colors by type
                  const tierColors: Record<string, { border: string; bg: string; color: string }> = {
                    "weered-tier-kingpin":  { border: "rgba(252,211,77,0.4)",  bg: "rgba(252,211,77,0.12)", color: "#fde68a" },
                    "weered-tier-felon":    { border: "rgba(249,115,22,0.4)",  bg: "rgba(249,115,22,0.12)", color: "#fdba74" },
                    "weered-tier-indicted": { border: "rgba(88,0,229,0.35)",   bg: "rgba(88,0,229,0.12)",   color: "rgba(243,244,246,0.8)" },
                    "weered-mod":           { border: "rgba(88,0,229,0.35)",   bg: "rgba(88,0,229,0.12)",   color: "rgba(243,244,246,0.8)" },
                  };
                  const roleColors: Record<string, { border: string; bg: string; color: string }> = {
                    emerald: { border: "rgba(52,211,153,0.3)",  bg: "rgba(16,185,129,0.1)",  color: "#6ee7b7" },
                    amber:   { border: "rgba(251,191,36,0.3)",  bg: "rgba(245,158,11,0.1)",  color: "#fcd34d" },
                  };
                  const tc = tierColors[cls] || (cls.includes("emerald") ? roleColors.emerald : cls.includes("amber") ? roleColors.amber : { border: "rgba(255,255,255,0.1)", bg: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" });
                  return (
                    <span style={{
                      fontSize: 9, fontFamily: "monospace", letterSpacing: "0.04em",
                      padding: "2px 6px", borderRadius: 999, flexShrink: 0,
                      border: `1px solid ${tc.border}`, background: tc.bg, color: tc.color,
                    }}>{label === "kingpin" || label === "felon" || label === "indicted" ? label.toUpperCase() : roleDisplay(f.badge || label)}</span>
                  );
                })()}
              </div>
            );
          })}
          {!listed.length ? <div className="weered-muted" style={{ padding: 10 }}>No users.</div> : null}
        </div>
      </div>

      {/* ── Presence popover ──────────────────────────────────────────────── */}
      {presenceHoverOpen
        ? createPortal(
            <div
              ref={presencePopoverRef}
              style={{ position: "fixed", left: presenceHoverXY.x, top: presenceHoverXY.y, width: HOVER_W, zIndex: 20000 }}
              className="rounded-2xl border border-white/10 bg-slate-950/90 shadow-[0_14px_40px_rgba(0,0,0,.45)] backdrop-blur px-3 py-3"
              onMouseEnter={() => { cancelClose(); setPresenceHoverOpen(true); }}
              onMouseLeave={() => scheduleClose(180)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-extrabold tracking-tight leading-tight truncate">
                    {pickFirstString(presenceHoverUser?.name, presenceHoverUser?.username, presenceHoverName, "User")}
                  </div>
                  <div className="text-xs opacity-70">Quick actions</div>
                </div>
                <button type="button" className="text-xs rounded-full border border-white/10 bg-white/5 px-2 py-1 hover:bg-white/10"
                  onClick={() => { setPresenceHoverOpen(false); setPresenceHoverUser(null); }} title="Close">
                  Esc
                </button>
              </div>
              <div className="mt-3 flex gap-2">
                <button type="button"
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 font-semibold"
                  onClick={() => {
                    const uid = String(presenceHoverUser?.id ?? presenceHoverUser?.userId ?? presenceHoverUser?.username ?? presenceHoverName ?? "");
                    if (!uid) return;
                    replaceTop("profile", { userId: uid });
                    setPresenceHoverOpen(false); setPresenceHoverUser(null);
                  }}>
                  View profile
                </button>
                <button type="button"
                  className="flex-1 rounded-xl border border-violet-300/25 bg-violet-500/10 px-3 py-2 text-sm hover:bg-violet-500/15 font-semibold text-violet-100"
                  onClick={() => {
                    try {
                      const peerName = String(presenceHoverUser?.name ?? presenceHoverUser?.username ?? presenceHoverName ?? "").trim();
                      const peerId   = String(presenceHoverUser?.id ?? presenceHoverUser?.userId ?? "").trim();
                      window.dispatchEvent(new CustomEvent("weered:dock:open", { detail: { mode: "dm", peer: { id: peerId, name: peerName } } }));
                    } catch {}
                    setPresenceHoverOpen(false); setPresenceHoverUser(null);
                  }}>
                  Message
                </button>
              </div>
              <div className="mt-2 flex gap-2">
                <button type="button"
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
                  onClick={() => {
                    try { window.dispatchEvent(new CustomEvent("weered:dock:toggle")); } catch {}
                    setPresenceHoverOpen(false); setPresenceHoverUser(null);
                  }}>
                  Dock
                </button>
                {presenceHoverUser?.id !== me?.id && (
                  <button type="button"
                    className="flex-1 rounded-xl border border-emerald-300/25 bg-emerald-500/10 px-3 py-2 text-sm hover:bg-emerald-500/15 font-semibold text-emerald-200"
                    onClick={async () => {
                      const uid = String(presenceHoverUser?.id ?? "").trim();
                      if (!uid) return;
                      try {
                        const r = await fetch(`${API_BASE}/friends/request/${uid}`, { method: "POST", headers: { ...authHeaders() } });
                        const j = await r.json();
                        setFriendRequestNote(j.ok ? "Request sent!" : (j.error || "Failed"));
                      } catch { setFriendRequestNote("Error"); }
                      setTimeout(() => setFriendRequestNote(""), 3000);
                    }}>
                    + Friend
                  </button>
                )}
              </div>
              {friendRequestNote && <div className="mt-2 text-xs text-center opacity-70">{friendRequestNote}</div>}
            </div>,
            document.body
          )
        : null}

      {/* ── Favorites + Recents ───────────────────────────────────────────── */}
      <div className="weered-left-section">

        {favs.length > 0 && (
          <>
            <div className="weered-left-title" style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <span>Favorites</span>
              <span style={{ fontSize:10, opacity:0.4 }}>{favs.length}</span>
            </div>
            {favs.map(room => {
              const href    = lobbyHref(room);
              const isActive = activeRoomNorm === room;
              const label   = getRoomName(room);
              const accent  = accentForRoom(room);
              const count   = roomCounts[room] ?? 0;
              const isLive  = count > 0;
              return (
                <div key={room} style={{ display:"flex", alignItems:"stretch", gap:3, marginBottom:4 }}>
                  <Link
                    href={href}
                    style={{
                      flex:1, minWidth:0, display:"block", textDecoration:"none",
                      borderRadius: 10,
                      border: isActive
                        ? `1px solid ${accent}55`
                        : `1px solid ${accent}22`,
                      background: isActive
                        ? `${accent}14`
                        : `${accent}08`,
                      padding:"9px 10px 8px 11px",
                      position: "relative", overflow: "hidden",
                      transition: "background 0.12s, border-color 0.12s",
                      boxShadow: isActive ? `inset 2px 0 0 ${accent}` : `inset 2px 0 0 ${accent}55`,
                    }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.background = isActive ? `${accent}1c` : `${accent}10`;
                      el.style.borderColor = isActive ? `${accent}66` : `${accent}33`;
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.background = isActive ? `${accent}14` : `${accent}08`;
                      el.style.borderColor = isActive ? `${accent}55` : `${accent}22`;
                    }}
                  >
                    {/* Top row: logo + name + live badge */}
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      {(() => {
                        const logo = getLobbyLogo(room);
                        return logo ? (
                          <img src={logo} alt="" style={{ width: 16, height: 16, borderRadius: 4, objectFit: "contain", flexShrink: 0, background: "rgba(0,0,0,.3)" }} />
                        ) : null;
                      })()}
                      <div style={{ flex:1, minWidth:0, fontSize:12, fontWeight:700, color: isActive ? "rgba(243,244,246,.98)" : "rgba(203,213,225,.82)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", lineHeight:1.35 }}>
                        {label}
                      </div>
                      {isLive && (
                        <span style={{
                          flexShrink:0, fontSize:9, fontWeight:700, padding:"1px 5px",
                          borderRadius:999, letterSpacing:"0.04em",
                          background:"rgba(34,197,94,.10)",
                          border:"1px solid rgba(34,197,94,.25)",
                          color:"rgba(134,239,172,.9)",
                        }}>
                          {count} live
                        </span>
                      )}
                      {isRoomPending(room) && (
                        <span style={{
                          flexShrink:0, fontSize:8, fontWeight:800, padding:"2px 6px",
                          borderRadius:99, letterSpacing:"0.04em",
                          background:"rgba(245,158,11,.12)",
                          border:"1px solid rgba(245,158,11,.30)",
                          color:"rgba(251,191,36,.9)",
                          animation:"weered-pending-pulse 2s ease-in-out infinite",
                        }}>
                          PENDING
                        </span>
                      )}
                    </div>
                    {/* Sub row: lobby context */}
                    {(() => { const sub = getRoomSublabel(room); const logo = getLobbyLogo(room); return sub ? (
                      <div style={{ fontSize:10, opacity:0.32, marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", fontFamily:"monospace", paddingLeft: logo ? 22 : 0 }}>
                        {sub}
                      </div>
                    ) : null; })()}
                  </Link>
                  <button
                    onClick={() => toggleFav(room)}
                    title="Unpin"
                    style={{ background:"none", border:"none", cursor:"pointer", padding:"4px 7px", flexShrink:0, color: accent, opacity: 0.7, fontSize:13, lineHeight:1, transition:"opacity 0.12s", borderRadius:8 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "0.7"; }}
                  >
                    ★
                  </button>
                </div>
              );
            })}
          </>
        )}

        {recentRooms.length > 0 && (
          <>
            <div className="weered-left-title" style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop: favs.length ? 10 : 0 }}>
              <span>Recent</span>
              <span style={{ fontSize:10, opacity:0.4 }}>{recentRooms.length}</span>
            </div>
            {recentRooms.map(room => {
              const href     = lobbyHref(room);
              const isActive = activeRoomNorm === room;
              const label    = getRoomName(room);
              const count    = roomCounts[room] ?? 0;
              const isLive   = count > 0;
              return (
                <div key={room} style={{ display:"flex", alignItems:"stretch", gap:3, marginBottom:4 }}>
                  <Link
                    href={href}
                    style={{
                      flex:1, minWidth:0, display:"block", textDecoration:"none",
                      borderRadius:10,
                      border: isActive
                        ? "1px solid rgba(124,58,237,.40)"
                        : "1px solid rgba(148,163,184,.09)",
                      background: isActive
                        ? "rgba(124,58,237,.10)"
                        : "rgba(148,163,184,.03)",
                      padding:"9px 10px 8px 11px",
                      position:"relative", overflow:"hidden",
                      transition:"background 0.12s, border-color 0.12s",
                      boxShadow: isActive ? "inset 2px 0 0 #5800E5" : "inset 2px 0 0 rgba(148,163,184,.12)",
                    }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.background = isActive ? "rgba(124,58,237,.14)" : "rgba(255,255,255,.04)";
                      el.style.borderColor = isActive ? "rgba(124,58,237,.50)" : "rgba(148,163,184,.16)";
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.background = isActive ? "rgba(124,58,237,.10)" : "rgba(148,163,184,.03)";
                      el.style.borderColor = isActive ? "rgba(124,58,237,.40)" : "rgba(148,163,184,.09)";
                    }}
                  >
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      {/* Lobby logo or live dot */}
                      {(() => {
                        const logo = getLobbyLogo(room);
                        return logo ? (
                          <img src={logo} alt="" style={{ width: 16, height: 16, borderRadius: 4, objectFit: "contain", flexShrink: 0, background: "rgba(0,0,0,.3)" }} />
                        ) : (
                          <div style={{ width:5, height:5, borderRadius:"50%", flexShrink:0, background: isLive ? "#22c55e" : "rgba(255,255,255,.12)", boxShadow: isLive ? "0 0 4px #22c55e" : "none" }} />
                        );
                      })()}
                      <div style={{ flex:1, minWidth:0, fontSize:12, fontWeight: isActive ? 700 : 500, color: isActive ? "rgba(243,244,246,.97)" : "rgba(203,213,225,.72)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", lineHeight:1.35 }}>
                        {label}
                      </div>
                      {isLive && (
                        <span style={{
                          flexShrink:0, fontSize:9, fontWeight:700,
                          color:"rgba(134,239,172,.8)", fontFamily:"monospace",
                        }}>
                          {count}
                        </span>
                      )}
                      {isRoomPending(room) && (
                        <span style={{
                          flexShrink:0, fontSize:8, fontWeight:800, padding:"2px 6px",
                          borderRadius:99, letterSpacing:"0.04em",
                          background:"rgba(245,158,11,.12)",
                          border:"1px solid rgba(245,158,11,.30)",
                          color:"rgba(251,191,36,.9)",
                          animation:"weered-pending-pulse 2s ease-in-out infinite",
                        }}>
                          PENDING
                        </span>
                      )}
                    </div>
                    {(() => { const sub = getRoomSublabel(room); const logo = getLobbyLogo(room); return sub ? (
                      <div style={{ fontSize:10, opacity:0.32, marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", fontFamily:"monospace", paddingLeft: logo ? 22 : 10 }}>
                        {sub}
                      </div>
                    ) : null; })()}
                  </Link>
                  <button
                    onClick={() => toggleFav(room)}
                    title="Pin to favorites"
                    style={{ background:"none", border:"none", cursor:"pointer", padding:"4px 7px", flexShrink:0, color:"rgba(255,255,255,.2)", fontSize:13, lineHeight:1, transition:"color 0.12s", borderRadius:8 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,.55)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,.2)"; }}
                  >
                    ☆
                  </button>
                </div>
              );
            })}
          </>
        )}

        {favs.length === 0 && recentRooms.length === 0 && (
          <div style={{ fontSize:11, opacity:0.3, padding:"2px 0 4px", fontStyle:"italic" }}>
            Join a room to build your history
          </div>
        )}
      </div>

      {/* Pending pill animation */}
      <style>{`@keyframes weered-pending-pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </div>
  );
}
