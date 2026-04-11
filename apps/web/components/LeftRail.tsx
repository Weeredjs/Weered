"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useOverlay } from "./overlays/OverlayProvider";
import { useWeered } from "./WeeredProvider";
import UserCorner from "./UserCorner";
import { useUserHover } from "./UserHoverCard";
import RoleIcon, { getRoleDisplayName, TierIcon } from "./RoleIcon";
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
  // Room prefixes: these are always rooms, never lobbies
  const ROOM_PREFIXES = ["stream-", "news-", "article-", "watch-"];
  if (ROOM_PREFIXES.some(p => clean.startsWith(p))) return `/room/${encodeURIComponent(clean)}`;
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
  GOD: "Godfather", ADMIN: "Lieutenant", STAFF: "Enforcer", SUPPORT: "Backup",
  MOD: "Captain", OWNER: "Founder",
};
function roleDisplay(dbRole: string): string { return ROLE_DISPLAY[dbRole] || dbRole.toLowerCase(); }

// ── Role icons — emoji, readable at any size ─────────────────────────────────
// ── Role icons — brand PNGs via RoleIcon component ──────────────────────────
const ICON_GOD     = <RoleIcon role="GOD" size={14} />;
const ICON_ADMIN   = <RoleIcon role="ADMIN" size={14} />;
const ICON_STAFF   = <RoleIcon role="STAFF" size={14} />;
const ICON_SUPPORT = <RoleIcon role="SUPPORT" size={14} />;
const ICON_MOD     = <RoleIcon role="MOD" size={14} />;
const ICON_OWNER   = <RoleIcon role="OWNER" size={14} />;
const ICON_INDICTED = <TierIcon tier="INDICTED" size={12} />;
const ICON_FELON    = <TierIcon tier="FELON" size={12} />;
const ICON_KINGPIN_TIER = <TierIcon tier="KINGPIN" size={12} />;

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
  const [paperBal, setPaperBal] = useState<number | null>(null);
  useEffect(() => {
    const tok = typeof localStorage !== "undefined" ? localStorage.getItem("weered_token") : null;
    if (!tok) return;
    fetch("https://api.weered.ca/paper/wallet", { headers: { Authorization: `Bearer ${tok}` } })
      .then(r => r.json()).then(j => { if (typeof j.balance === "number") setPaperBal(j.balance); }).catch(() => {});
    const iv = setInterval(() => {
      fetch("https://api.weered.ca/paper/wallet", { headers: { Authorization: `Bearer ${tok}` } })
        .then(r => r.json()).then(j => { if (typeof j.balance === "number") setPaperBal(j.balance); }).catch(() => {});
    }, 30000);
    return () => clearInterval(iv);
  }, []);

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

  // ── Recents (server-side) + Favorites (local) ──────────────────────────────
  const FAVS_KEY = "weered:favs:v1";

  // Server-side recents
  const [serverRecents, setServerRecents] = useState<any[]>([]);
  const recentsLoaded = useRef(false);

  // Fetch recents from API on mount + when user authenticates
  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("weered_token") : null;
    if (!token || !me?.id) return;
    fetch(`${API_BASE}/recents`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(j => { if (Array.isArray(j?.recents)) { setServerRecents(j.recents); recentsLoaded.current = true; } })
      .catch(() => {});
  }, [me?.id]);

  // Record visits server-side when navigating
  useEffect(() => {
    const raw = normRoomKey(joinedRoomId || activeRoomId || "");
    if (!raw || raw === "lobby") return;
    const room = raw.startsWith("room:") ? raw.slice(5) : raw;
    const token = typeof window !== "undefined" ? localStorage.getItem("weered_token") : null;
    if (!token) return;

    // Determine if this is a lobby or a room
    const isLobbySlug = /^[a-z][a-z0-9._/-]*$/.test(room) && room.length > 2;
    const body = isLobbySlug ? { lobbyId: room } : { roomId: room };

    fetch(`${API_BASE}/recents`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then(r => r.json())
      .then(() => {
        // Re-fetch recents to get updated list
        fetch(`${API_BASE}/recents`, { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.json())
          .then(j => { if (Array.isArray(j?.recents)) setServerRecents(j.recents); })
          .catch(() => {});
      })
      .catch(() => {});
  }, [joinedRoomId, activeRoomId]);

  // Derive recents as string IDs for compatibility with existing rendering
  const recents = useMemo(() =>
    serverRecents.map(r => r.lobbyId || r.roomId).filter(Boolean),
    [serverRecents]
  );

  // Build a map from ID → server recent data (for name/logo enrichment)
  const serverRecentMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const r of serverRecents) {
      const id = r.lobbyId || r.roomId;
      if (id) m.set(id, r);
    }
    return m;
  }, [serverRecents]);

  const [favs, setFavs] = useState<string[]>(() => {
    try { const r = localStorage.getItem(FAVS_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
  });

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
    // Check server recents first (has enriched name from API)
    const sr = serverRecentMap.get(id);
    if (sr?.name && sr.name !== id) return sr.name;
    const v = roomNameCache[id];
    if (!v) return id;
    if (typeof v === "string") return v;
    if (typeof v === "object" && v !== null) return (v as any).name || id;
    return id;
  };
  const getRoomLobby = (id: string): string => {
    // Check server recents for lobby context
    const sr = serverRecentMap.get(id);
    if (sr?.lobbyId && sr.lobbyId !== id) return sr.lobbyName || sr.lobbyId;
    if (sr?.lobbyId === id) return "lobby";
    const v = roomNameCache[id];
    if (typeof v === "object" && v !== null) return (v as any).lobbyId || (v as any).lobby || "";
    return "";
  };
  // Sublabel: show parent lobby name for rooms, "lobby" for lobby slugs
  const getRoomSublabel = (id: string): string => {
    const sr = serverRecentMap.get(id);
    // If it's a lobby visit, show the slug as sublabel
    if (sr?.lobbyId === id) return id;
    // If it's a room in a lobby, show the lobby name
    if (sr?.lobbyName) return sr.lobbyName;
    if (sr?.lobbyId) return sr.lobbyId;
    const lobby = getRoomLobby(id);
    if (lobby) return lobby;
    const isLobbySlug = /^[a-z][a-z0-9._-]*$/.test(id) && id.length > 2;
    if (isLobbySlug) return "lobby";
    return "";
  };
  const getLobbyLogo = (id: string): string | null => {
    // Check server recents for logo
    const sr = serverRecentMap.get(id);
    if (sr?.logoUrl) return sr.logoUrl;
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
  // User hover card (replaces old presence popover)
  const { openHover, scheduleClose, cancelClose, card: hoverCard } = useUserHover({
    onViewProfile: (id) => replaceTop("profile", { userId: id }),
    onMessage: (id, name) => {
      try { window.dispatchEvent(new CustomEvent("weered:dock:open", { detail: { mode: "dm", peer: { id, name } } })); } catch {}
    },
  });

  // ── Active room info for favs/recents ─────────────────────────────────────
  const activeRoomNorm = normRoomKey(joinedRoomId || activeRoomId || "");

  return (
    <div className="weered-left-inner">
      <UserCorner />

      {/* ── Communities ───────────────────────────────────────────────────── */}
      <div className="weered-left-section">
        <div className="weered-left-title">Communities</div>

        {[
          { href: lobbyHrefMain, label: "Lobby", icon: "🏠", active: isLobbyActive, onClick: undefined as any },
          { href: "/home", label: "Home", icon: "📡", active: isHomeActive, onClick: (e: any) => { e.preventDefault(); try { leave(); } catch {} router.push("/home"); } },
          { href: "/forum", label: "Forum", icon: "💬", active: pathname.startsWith("/forum"), onClick: undefined as any },
          { href: "/store", label: "Paper", icon: "💵", active: pathname.startsWith("/store"), onClick: undefined as any },
          ...((globalRole === "GOD" || globalRole === "STAFF" || globalRole === "SUPPORT")
            ? [{ href: "/staff", label: "Ops", icon: "⚙", active: pathname.startsWith("/staff"), onClick: undefined as any }]
            : []),
        ].map((item) => (
          <Link
            key={item.label}
            className={"weered-left-link rounded-xl border px-3 py-2.5 transition-all flex items-center gap-2.5 " + (item.active
              ? "weered-left-link-active border-violet-500/25 bg-violet-500/12"
              : "border-white/[.06] bg-white/[.02] hover:bg-white/[.06] hover:border-white/[.12]"
            )}
            href={item.href}
            onClick={item.onClick}
          >
            <span className="text-[15px] opacity-70">{item.icon}</span>
            <span className="flex-1 font-semibold text-[13px]">{item.label}</span>
            {item.label === "Paper" && paperBal !== null && (
              <span style={{ fontSize: 11, fontWeight: 800, color: "#D4A017", fontFamily: "monospace" }}>
                {paperBal.toLocaleString()}
              </span>
            )}
            {item.active && <span className="h-2 w-2 rounded-full bg-violet-400/90 shadow-[0_0_6px_rgba(124,58,237,.4)]" />}
          </Link>
        ))}

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
                  const uid = String(u?.id || u?.userId || "");
                  if (uid) openHover(uid, nm, el);
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
                  <div style={{ fontSize: 10, color: (u?.id || u?.userId) === "operator" ? "rgba(212,160,23,.5)" : "rgba(255,255,255,0.28)", marginTop: 1, fontFamily: "monospace" }}>
                    {(u?.id || u?.userId) === "operator" ? "AI \u00b7 @operator" : you ? "you" : isLobbyActive && u?.roomName ? `in ${u.roomName}` : roleDisplay(f.badge || "member")}
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
      {hoverCard}

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
