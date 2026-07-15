"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useOverlay } from "./overlays/OverlayProvider";
import { useWeered, useRoomUsers } from "./WeeredProvider";
import UserCorner from "./UserCorner";
import { useUserHover } from "./UserHoverCard";
import RoleIcon, { TierIcon } from "./RoleIcon";
import PresenceRow from "./PresenceRow";
import { useOfficeSkin } from "./useOfficeSkin";
import AdvisorCredentialCard from "./AdvisorCredentialCard";

function pickFirstString(...vals: any[]): string {
  for (const v of vals) if (typeof v === "string" && v.trim()) return v.trim();
  return "";
}

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE as string) || "http://127.0.0.1:4000";

function authHeaders(): Record<string, string> {
  try {
    const t = localStorage.getItem("weered_token") || "";
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
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

function lobbyHref(id: string): string {
  let clean = id || "";
  if (clean.startsWith("room:")) clean = clean.slice(5);
  try {
    clean = decodeURIComponent(clean);
  } catch {}
  if (!clean) return "/lobby";
  const ROOM_PREFIXES = [
    "mtg-", // meeting/office rooms (the consult namespace)
    "stream-",
    "news-",
    "article-",
    "watch-",
    "fakeout-",
    "destiny2-",
    "dnd-",
    "windrose-",
    "mlb-",
    "league-",
    "fortnite-",
    "cs2-",
    "dota2-",
    "pubg-",
    "hq-",
    "poker-",
    "study-",
    "marathon-",
  ];
  if (ROOM_PREFIXES.some((p) => clean.startsWith(p))) return `/room/${encodeURIComponent(clean)}`;
  const isLobbySlug =
    /^[a-z][a-z0-9._/-]*$/.test(clean) || clean.includes(".") || clean.includes("/");
  if (isLobbySlug) return `/lobby/${encodeURIComponent(clean)}`;
  return `/room/${encodeURIComponent(clean)}`;
}

function normRole(x: any) {
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

const ROLE_DISPLAY: Record<string, string> = {
  GOD: "Godfather",
  ADMIN: "Lieutenant",
  STAFF: "Enforcer",
  SUPPORT: "Backup",
  MOD: "Captain",
  OWNER: "Founder",
};
const ROLE_DISPLAY_WINDROSE: Record<string, string> = {
  GOD: "Admiral",
  ADMIN: "First Mate",
  STAFF: "Boatswain",
  SUPPORT: "Lookout",
  MOD: "Quartermaster",
  OWNER: "Captain",
};
const ROLE_DISPLAY_HELLDIVERS: Record<string, string> = {
  GOD: "Supreme Commander",
  ADMIN: "General",
  STAFF: "Commander",
  SUPPORT: "Officer",
  MOD: "Drill Sergeant",
  OWNER: "Dive Lead",
};

const ICON_GOD = <RoleIcon role="GOD" size={14} />;
const ICON_ADMIN = <RoleIcon role="ADMIN" size={14} />;
const ICON_STAFF = <RoleIcon role="STAFF" size={14} />;
const ICON_SUPPORT = <RoleIcon role="SUPPORT" size={14} />;
const ICON_MOD = <RoleIcon role="MOD" size={14} />;
const ICON_OWNER = <RoleIcon role="OWNER" size={14} />;
const ICON_INDICTED = <TierIcon tier="INDICTED" size={12} />;
const ICON_FELON = <TierIcon tier="FELON" size={12} />;
const ICON_KINGPIN_TIER = <TierIcon tier="KINGPIN" size={12} />;

function groupRank(u: any): number {
  const g = normRole(pickFirstString(u?.globalRole, u?.global_role, u?.global));
  const rr = normRole(pickFirstString(u?.role, u?.roomRole, u?.room_role));
  if (g === "GOD") return 0;
  if (rr === "OWNER") return 1;
  if (g === "ADMIN") return 2;
  if (g === "STAFF" || g === "SUPPORT") return 3;
  if (g === "MOD" || rr === "MOD") return 4;
  return 5;
}

const ROOM_ACCENTS = [
  "#7c6af7",
  "#22c55e",
  "#f97316",
  "#60a5fa",
  "#ef4444",
  "#eab308",
  "#ec4899",
  "#14b8a6",
  "#a78bfa",
  "#fb923c",
];
function accentForRoom(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffffff;
  return ROOM_ACCENTS[Math.abs(h) % ROOM_ACCENTS.length];
}

export default function LeftRail() {
  const { openSheet: _openSheet, replaceTop } = useOverlay();
  const pathname = usePathname() || "";
  const router = useRouter();
  const { joinedRoomId, activeRoomId, me, globalRole, currentLobbyId, joinStatus, leave } =
    useWeered() as any;
  const users = useRoomUsers(activeRoomId);
  // The Review Room gate: true only inside /room/mtg-* or on the office host.
  // Every office-context divergence below checks this flag and nothing else.
  const office = useOfficeSkin();

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

  const isWindrose = lobbyTheme === "windrose";
  const isDestiny = lobbyTheme === "destiny2";
  const isDnd = lobbyTheme === "dnd";
  const navLabels = {
    lobby: isWindrose ? "Port" : isDestiny ? "Tower" : isDnd ? "Tavern" : "Lobby",
    home: isWindrose ? "Home" : isDestiny ? "Relay" : isDnd ? "Hearth" : "Home",
    forum: isWindrose ? "Ship's Log" : isDestiny ? "Vanguard Report" : isDnd ? "Tales" : "Forum",
    paper: isWindrose ? "Doubloons" : isDestiny ? "Glimmer" : isDnd ? "Gold" : "Paper",
    locator: isWindrose ? "Sextant" : isDestiny ? "Ghost" : isDnd ? "Compass" : "Locator",
    ops: isWindrose ? "Quartermaster" : isDestiny ? "Vanguard" : isDnd ? "DM Screen" : "Ops",
    communities: isWindrose ? "Fleet" : isDestiny ? "Clans" : isDnd ? "Parties" : "Communities",
  };
  const navIcons = {
    lobby: isWindrose ? "⚓" : isDestiny ? "🛡" : isDnd ? "🍺" : "🏠",
    home: isWindrose ? "🏴‍☠️" : isDestiny ? "🛰" : isDnd ? "🔥" : "📡",
    forum: isWindrose ? "📜" : isDestiny ? "📖" : isDnd ? "📜" : "💬",
    paper: isWindrose ? "🪙" : isDestiny ? "💠" : isDnd ? "🪙" : "💵",
    locator: isWindrose ? "🧭" : isDestiny ? "👁" : isDnd ? "🗺" : "🎯",
    ops: isWindrose ? "🗝" : isDestiny ? "⚔" : isDnd ? "🎲" : "⚙",
  };

  const profileUserId = (me?.id ?? me?.userId ?? me?.name ?? me?.username ?? "me").toString();

  const [q, setQ] = useState("");
  const [paperBal, setPaperBal] = useState<number | null>(null);
  useEffect(() => {
    const tok = typeof localStorage !== "undefined" ? localStorage.getItem("weered_token") : null;
    if (!tok) return;
    fetch("https://api.weered.ca/paper/wallet", { headers: { Authorization: `Bearer ${tok}` } })
      .then((r) => r.json())
      .then((j) => {
        if (typeof j.balance === "number") setPaperBal(j.balance);
      })
      .catch(() => {});
    const iv = setInterval(() => {
      fetch("https://api.weered.ca/paper/wallet", { headers: { Authorization: `Bearer ${tok}` } })
        .then((r) => r.json())
        .then((j) => {
          if (typeof j.balance === "number") setPaperBal(j.balance);
        })
        .catch(() => {});
    }, 30000);
    return () => clearInterval(iv);
  }, []);

  const sub = useMemo(() => {
    const m = pathname.match(/^\/r\/([^/?#]+)/i);
    return m ? `r/${m[1]}` : "";
  }, [pathname]);

  const lobbyHrefMain =
    currentLobbyId && currentLobbyId !== "lobby"
      ? `/lobby/${encodeURIComponent(currentLobbyId)}`
      : sub
        ? `/lobby?sub=${encodeURIComponent(sub)}`
        : "/lobby";

  const isLobbyActive = pathname.startsWith("/lobby");
  const isHomeActive = pathname.startsWith("/home") || pathname === "/";

  const rawRoomKey = pickFirstString(joinedRoomId, activeRoomId, "");
  const roomLabel = useMemo(() => normRoomKey(rawRoomKey), [rawRoomKey]);

  const [lobbyPresence, setLobbyPresence] = useState<any[]>([]);
  const lobbyPresenceId = isLobbyActive ? currentLobbyId || "" : "";

  useEffect(() => {
    if (!lobbyPresenceId || lobbyPresenceId === "lobby") {
      setLobbyPresence([]);
      return;
    }
    let cancelled = false;
    const fetchPresence = async () => {
      try {
        const r = await fetch(
          `${API_BASE}/lobbies/${encodeURIComponent(lobbyPresenceId)}/presence`,
          { headers: authHeaders() },
        );
        const j = await r.json();
        if (!cancelled && j.ok && Array.isArray(j.users)) setLobbyPresence(j.users);
      } catch {}
    };
    fetchPresence();
    const t = setInterval(fetchPresence, 20000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [lobbyPresenceId]);

  const effectiveUsers = useMemo(() => {
    if (!isLobbyActive || !lobbyPresence.length) return users;
    const seen = new Map<string, any>();
    for (const u of lobbyPresence) {
      if (u?.id) seen.set(u.id, u);
    }
    for (const u of Array.isArray(users) ? users : []) {
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

  // Office Reception sub-line: the UNFILTERED room count (the search box must never
  // make "Door open · no one waiting" appear while people are actually in the room).
  const roomCount = useMemo(() => {
    const arr0 = Array.isArray(effectiveUsers) ? effectiveUsers : [];
    try {
      const meId = String(me?.id || "");
      if (meId && !arr0.some((u: any) => String(u?.id || "") === meId)) return arr0.length + 1;
    } catch {}
    return arr0.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, me]);

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

  const FAVS_KEY = "weered:favs:v1";

  const [serverRecents, setServerRecents] = useState<any[]>([]);
  const recentsLoaded = useRef(false);

  useEffect(() => {
    // Auth via the httpOnly cookie (global fetch-patch adds credentials+cookie
    // for api.weered.ca); gate on the user, not the boot-deleted weered_token.
    if (!me?.id) return;
    fetch(`${API_BASE}/recents`)
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j?.recents)) {
          setServerRecents(j.recents);
          recentsLoaded.current = true;
        }
      })
      .catch(() => {});
  }, [me?.id]);

  useEffect(() => {
    const raw = normRoomKey(joinedRoomId || activeRoomId || "");
    if (!raw || raw === "lobby") return;
    const room = raw.startsWith("room:") ? raw.slice(5) : raw;
    if (!me?.id) return;

    const isLobbySlug = /^[a-z][a-z0-9._/-]*$/.test(room) && room.length > 2;
    const body = isLobbySlug ? { lobbyId: room } : { roomId: room };

    fetch(`${API_BASE}/recents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((r) => r.json())
      .then(() => {
        fetch(`${API_BASE}/recents`)
          .then((r) => r.json())
          .then((j) => {
            if (Array.isArray(j?.recents)) setServerRecents(j.recents);
          })
          .catch(() => {});
      })
      .catch(() => {});
  }, [joinedRoomId, activeRoomId, me?.id]);

  const recents = useMemo(
    () => serverRecents.map((r) => r.lobbyId || r.roomId).filter(Boolean),
    [serverRecents],
  );

  const serverRecentMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const r of serverRecents) {
      const id = r.lobbyId || r.roomId;
      if (id) m.set(id, r);
    }
    return m;
  }, [serverRecents]);

  const [favs, setFavs] = useState<string[]>(() => {
    try {
      const r = localStorage.getItem(FAVS_KEY);
      return r ? JSON.parse(r) : [];
    } catch {
      return [];
    }
  });

  const favsSynced = useRef(false);
  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("weered_token") : null;
    if (!token || !me?.id || favsSynced.current) return;
    favsSynced.current = true;
    (async () => {
      try {
        let local: string[] = [];
        try {
          local = JSON.parse(localStorage.getItem(FAVS_KEY) || "[]");
        } catch {}
        const res = await fetch(`${API_BASE}/me/favorites/merge`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ ids: local }),
        });
        const j = await res.json();
        if (j?.ok && Array.isArray(j.ids)) {
          setFavs(j.ids);
          try {
            localStorage.setItem(FAVS_KEY, JSON.stringify(j.ids));
          } catch {}
        }
      } catch {}
    })();
  }, [me?.id]);

  function toggleFav(room: string) {
    setFavs((prev) => {
      const adding = !prev.includes(room);
      const next = adding ? [room, ...prev] : prev.filter((r) => r !== room);
      try {
        localStorage.setItem(FAVS_KEY, JSON.stringify(next));
      } catch {}
      const token = typeof window !== "undefined" ? localStorage.getItem("weered_token") : null;
      if (token) {
        fetch(`${API_BASE}/me/favorites/${encodeURIComponent(room)}`, {
          method: adding ? "POST" : "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }
      return next;
    });
  }

  const recentRooms = recents.filter((r) => !favs.includes(r));

  const [lobbyLogos, setLobbyLogos] = useState<Record<string, string>>({});
  useEffect(() => {
    fetch(`${API_BASE}/lobbies`)
      .then((r) => r.json())
      .then((j) => {
        if (!Array.isArray(j?.lobbies)) return;
        const map: Record<string, string> = {};
        for (const l of j.lobbies) {
          if (l.id && l.logoUrl) map[l.id] = l.logoUrl;
        }
        setLobbyLogos(map);
      })
      .catch(() => {});
  }, []);

  const [roomNameCache, setRoomNameCache] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem("weered:roomnames:v1") || "{}");
    } catch {
      return {};
    }
  });
  useEffect(() => {
    const onFocus = () => {
      try {
        setRoomNameCache(JSON.parse(localStorage.getItem("weered:roomnames:v1") || "{}"));
      } catch {}
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);
  const getRoomName = (id: string) => {
    const sr = serverRecentMap.get(id);
    if (sr?.name && sr.name !== id) return sr.name;
    const v = roomNameCache[id];
    if (!v) return id;
    if (typeof v === "string") return v;
    if (typeof v === "object" && v !== null) return (v as any).name || id;
    return id;
  };
  const getRoomLobby = (id: string): string => {
    const sr = serverRecentMap.get(id);
    if (sr?.lobbyId && sr.lobbyId !== id) return sr.lobbyName || sr.lobbyId;
    if (sr?.lobbyId === id) return "lobby";
    const v = roomNameCache[id];
    if (typeof v === "object" && v !== null) return (v as any).lobbyId || (v as any).lobby || "";
    return "";
  };
  const getRoomSublabel = (id: string): string => {
    const sr = serverRecentMap.get(id);
    if (sr?.lobbyId === id) return id;
    if (sr?.lobbyName) return sr.lobbyName;
    if (sr?.lobbyId) return sr.lobbyId;
    const lobby = getRoomLobby(id);
    if (lobby) return lobby;
    const isLobbySlug = /^[a-z][a-z0-9._-]*$/.test(id) && id.length > 2;
    if (isLobbySlug) return "lobby";
    return "";
  };
  const getLobbyLogo = (id: string): string | null => {
    const sr = serverRecentMap.get(id);
    if (sr?.logoUrl) return sr.logoUrl;
    if (lobbyLogos[id]) return lobbyLogos[id];
    const lobby = getRoomLobby(id);
    if (lobby && lobbyLogos[lobby]) return lobbyLogos[lobby];
    return null;
  };

  const [roomCounts, setRoomCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    const ids = [...new Set([...favs, ...recentRooms])];
    if (!ids.length) return;
    const fetchCounts = async () => {
      try {
        const j = await fetch(`${API_BASE}/rooms`, { headers: authHeaders() }).then((r) =>
          r.json(),
        );
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

  const [pendingRooms, setPendingRooms] = useState<Set<string>>(new Set());
  useEffect(() => {
    const onKnockQueued = (e: Event) => {
      const rid = (e as CustomEvent)?.detail?.roomId;
      if (rid) setPendingRooms((prev) => new Set(prev).add(String(rid)));
    };
    const onAdmitted = (e: Event) => {
      const rid = (e as CustomEvent)?.detail?.roomId;
      if (rid)
        setPendingRooms((prev) => {
          const next = new Set(prev);
          next.delete(String(rid));
          return next;
        });
    };
    const onDenied = (e: Event) => {
      const rid = (e as CustomEvent)?.detail?.roomId;
      if (rid)
        setPendingRooms((prev) => {
          const next = new Set(prev);
          next.delete(String(rid));
          return next;
        });
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

  const pendingFromProvider =
    typeof joinStatus === "object" && joinStatus !== null ? joinStatus : {};
  const isRoomPending = (room: string): boolean => {
    if (pendingRooms.has(room)) return true;
    const clean = room.startsWith("room:") ? room.slice(5) : room;
    if (pendingRooms.has(clean) || pendingRooms.has(`room:${clean}`)) return true;
    if (
      pendingFromProvider[room] === "knocking" ||
      pendingFromProvider[clean] === "knocking" ||
      pendingFromProvider[`room:${clean}`] === "knocking"
    )
      return true;
    return false;
  };

  const _lobbyMod =
    String(currentLobbyId || "").toLowerCase() === "windrose" ? "WINDROSE" : undefined;
  const {
    openHover,
    scheduleClose,
    cancelClose: _cancelClose,
    card: hoverCard,
  } = useUserHover({
    lobbyModuleType: _lobbyMod,
    onViewProfile: (id) => replaceTop("profile", { userId: id }),
    onMessage: (id, name) => {
      try {
        window.dispatchEvent(
          new CustomEvent("weered:dock:open", { detail: { mode: "dm", peer: { id, name } } }),
        );
      } catch {}
    },
  });

  const activeRoomNorm = normRoomKey(joinedRoomId || activeRoomId || "");

  return (
    <div className="weered-left-inner">
      {office ? <AdvisorCredentialCard /> : <UserCorner />}

      <div className="weered-left-section">
        <div className="weered-left-title">{office ? "Practice" : navLabels.communities}</div>

        {(office
          ? [
              {
                href: "/room/mtg-eceb-office",
                label: "The Desk",
                icon: "▤",
                active: pathname.startsWith("/room/mtg-"),
                onClick: undefined as any,
                key: "lobby",
              },
              {
                href: "https://agent.eastcoastemployeebenefits.com",
                label: "Book of Business",
                icon: "☰",
                active: false,
                onClick: undefined as any,
                key: "book",
                target: "_blank",
                rel: "noopener noreferrer",
              },
              ...(globalRole === "GOD" || globalRole === "STAFF" || globalRole === "SUPPORT"
                ? [
                    {
                      href: "/staff",
                      label: "Admin",
                      icon: "⚙",
                      active: pathname.startsWith("/staff"),
                      onClick: undefined as any,
                      key: "ops",
                    },
                  ]
                : []),
            ]
          : [
              {
                href: lobbyHrefMain,
                label: navLabels.lobby,
                icon: navIcons.lobby,
                active: isLobbyActive,
                onClick: undefined as any,
                key: "lobby",
              },
              {
                href: "/home",
                label: navLabels.home,
                icon: navIcons.home,
                active: isHomeActive,
                onClick: (e: any) => {
                  e.preventDefault();
                  try {
                    leave();
                  } catch {}
                  router.push("/home");
                },
                key: "home",
              },
              {
                href: "/forum",
                label: navLabels.forum,
                icon: navIcons.forum,
                active: pathname.startsWith("/forum"),
                onClick: undefined as any,
                key: "forum",
              },
              {
                href: "/store",
                label: navLabels.paper,
                icon: navIcons.paper,
                active: pathname.startsWith("/store"),
                onClick: undefined as any,
                key: "paper",
              },
              {
                href: "/map",
                label: navLabels.locator,
                icon: navIcons.locator,
                active: pathname.startsWith("/map"),
                onClick: undefined as any,
                key: "locator",
              },
              ...(globalRole === "GOD" || globalRole === "STAFF" || globalRole === "SUPPORT"
                ? [
                    {
                      href: "/staff",
                      label: navLabels.ops,
                      icon: navIcons.ops,
                      active: pathname.startsWith("/staff"),
                      onClick: undefined as any,
                      key: "ops",
                    },
                  ]
                : []),
            ]
        ).map((item: any) => (
          <Link
            key={item.key}
            className={
              "weered-left-link rounded-xl border px-3 py-2.5 transition-all flex items-center gap-2.5 " +
              (item.active
                ? "weered-left-link-active border-violet-500/25 bg-violet-500/12"
                : "border-white/[.06] bg-white/[.02] hover:bg-white/[.06] hover:border-white/[.12]")
            }
            href={item.href}
            onClick={item.onClick}
            target={item.target}
            rel={item.rel}
          >
            <span className="text-[15px] opacity-70">{item.icon}</span>
            <span className="flex-1 font-semibold text-[13px]">{item.label}</span>
            {item.key === "paper" && paperBal !== null && (
              <span
                style={{ fontSize: 11, fontWeight: 800, color: "#D4A017", fontFamily: "monospace" }}
              >
                {paperBal.toLocaleString()}
              </span>
            )}
            {item.active && (
              <span className="h-2 w-2 rounded-full bg-violet-400/90 shadow-[0_0_6px_rgba(124,58,237,.4)]" />
            )}
          </Link>
        ))}

        <div className="weered-left-hint mt-2">
          {sub ? (
            <span className="text-[11px] rounded-full border border-white/10 bg-black/10 px-2 py-0.5 opacity-80">
              context: {sub}
            </span>
          ) : null}
        </div>
      </div>

      <div className="weered-presence">
        <div className="weered-presence-head">
          <div className="weered-presence-title">{office ? "Reception" : "Presence"}</div>
          <div className="weered-presence-sub">
            {office ? (
              roomCount > 0 ? (
                `in the room · ${roomCount}`
              ) : (
                "Door open · no one waiting"
              )
            ) : (
              <>
                {isLobbyActive && lobbyPresence.length > 0
                  ? `${lobbyPresenceId} · all rooms`
                  : `context: ${getRoomName(rawRoomKey) || (isLobbyActive ? "lobby" : "—")}`}{" "}
                • {listed.length}
              </>
            )}
          </div>
        </div>

        <input
          className="weered-presence-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search users..."
        />

        <div
          className="weered-presence-list"
          style={{ maxHeight: "calc(100vh - 440px)", overflowY: "auto" }}
        >
          {listed.map((u: any) => {
            const nm = pickFirstString(u?.name, u?.username, "Unknown");
            const rid = pickFirstString(u?.id, nm);
            const you = me?.id && u?.id && me.id === u.id;
            const uid = String(u?.id || u?.userId || "");

            const platforms = {
              steam: !!u?.steamId,
              twitch: !!u?.twitchLogin,
              xbox: !!u?.xboxGamertag,
              psn: !!u?.psnAccountId,
            };

            const isOperator = uid === "operator";
            // Office context only: The Operator presents as the house analyst.
            // Display-level rename; the underlying user object is untouched.
            // Matched STRICTLY on uid/username "operator" (never by display name,
            // so a real user named "The Operator" is never silently renamed).
            const isFathom =
              office && (isOperator || String(u?.username || "").toLowerCase() === "operator");
            const displayName = isFathom ? "Fathom" : nm;
            const secondary: React.ReactNode | undefined = isFathom ? (
              <span style={{ color: "rgba(163,180,202,.72)" }}>Analyst</span>
            ) : isOperator ? (
              <span style={{ color: "rgba(212,160,23,.7)", fontStyle: "italic" }}>
                AI · @operator
              </span>
            ) : undefined;

            return (
              <div
                key={rid}
                onMouseEnter={(e) => {
                  // Fathom's hover card would fetch the real Operator profile
                  // (name, AI badge, tier chrome), breaking the office rename
                  // mid-meeting; suppress it there.
                  if (uid && !isFathom)
                    openHover(uid, displayName, e.currentTarget, { isAway: !!u?.isAway });
                }}
                onMouseLeave={() => scheduleClose(160)}
                style={
                  you && !office
                    ? { background: "rgba(124,58,237,0.04)", borderRadius: 10 }
                    : undefined
                }
                className="weered-presence-row"
              >
                <PresenceRow
                  name={displayName}
                  userId={u?.id}
                  avatar={u?.avatar}
                  avatarColor={u?.avatarColor}
                  globalRole={u?.globalRole}
                  tier={u?.tier}
                  online={true}
                  isAway={!!u?.isAway}
                  livePresence={u?.livePresence}
                  statusText={u?.statusText}
                  statusEmoji={u?.statusEmoji}
                  nameEffect={u?.nameEffect}
                  avatarFrame={u?.avatarFrame}
                  secondaryText={secondary}
                  platforms={platforms}
                  pillBgColor={u?.pillBgColor}
                  pillAccentColor={u?.pillAccentColor}
                  onClick={() =>
                    replaceTop("profile", { userId: String(u?.id ?? rid ?? nm ?? "unknown") })
                  }
                  compact
                />
              </div>
            );
          })}
          {!listed.length ? (
            office ? null : (
              <div className="weered-muted" style={{ padding: 10 }}>
                No users.
              </div>
            )
          ) : null}
        </div>
      </div>

      {hoverCard}

      <div className="weered-left-section">
        {favs.length > 0 && (
          <>
            <div
              className="weered-left-title"
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
            >
              <span>{office ? "Clients" : "Favorites"}</span>
              <span style={{ fontSize: 10, opacity: 0.4 }}>{favs.length}</span>
            </div>
            {favs.map((room) => {
              const href = lobbyHref(room);
              const isActive = activeRoomNorm === room;
              const label = getRoomName(room);
              const accent = accentForRoom(room);
              const count = roomCounts[room] ?? 0;
              const isLive = count > 0;
              return (
                <div
                  key={room}
                  style={{ display: "flex", alignItems: "stretch", gap: 3, marginBottom: 4 }}
                >
                  <Link
                    href={href}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: "block",
                      textDecoration: "none",
                      borderRadius: 10,
                      border: isActive ? `1px solid ${accent}55` : `1px solid ${accent}22`,
                      background: isActive ? `${accent}14` : `${accent}08`,
                      padding: "9px 10px 8px 11px",
                      position: "relative",
                      overflow: "hidden",
                      transition: "background 0.12s, border-color 0.12s",
                      boxShadow: isActive ? `inset 2px 0 0 ${accent}` : `inset 2px 0 0 ${accent}55`,
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.background = isActive ? `${accent}1c` : `${accent}10`;
                      el.style.borderColor = isActive ? `${accent}66` : `${accent}33`;
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.background = isActive ? `${accent}14` : `${accent}08`;
                      el.style.borderColor = isActive ? `${accent}55` : `${accent}22`;
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {(() => {
                        const logo = getLobbyLogo(room);
                        return logo ? (
                          <img
                            src={logo}
                            alt={label + " logo"}
                            style={{
                              width: 16,
                              height: 16,
                              borderRadius: 4,
                              objectFit: "contain",
                              flexShrink: 0,
                              background: "rgba(0,0,0,.3)",
                            }}
                          />
                        ) : null;
                      })()}
                      <div
                        style={{
                          flex: 1,
                          minWidth: 0,
                          fontSize: 12,
                          fontWeight: 700,
                          color: isActive ? "rgba(243,244,246,.98)" : "rgba(203,213,225,.82)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          lineHeight: 1.35,
                        }}
                      >
                        {label}
                      </div>
                      {isLive && (
                        <span
                          style={{
                            flexShrink: 0,
                            fontSize: 9,
                            fontWeight: 700,
                            padding: "1px 5px",
                            borderRadius: 999,
                            letterSpacing: "0.04em",
                            background: "rgba(34,197,94,.10)",
                            border: "1px solid rgba(34,197,94,.25)",
                            color: "rgba(134,239,172,.9)",
                          }}
                        >
                          {count} live
                        </span>
                      )}
                      {isRoomPending(room) && (
                        <span
                          style={{
                            flexShrink: 0,
                            fontSize: 8,
                            fontWeight: 800,
                            padding: "2px 6px",
                            borderRadius: 99,
                            letterSpacing: "0.04em",
                            background: "rgba(245,158,11,.12)",
                            border: "1px solid rgba(245,158,11,.30)",
                            color: "rgba(251,191,36,.9)",
                            animation: "weered-pending-pulse 2s ease-in-out infinite",
                          }}
                        >
                          PENDING
                        </span>
                      )}
                    </div>
                    {(() => {
                      const sub = getRoomSublabel(room);
                      const logo = getLobbyLogo(room);
                      return sub ? (
                        <div
                          style={{
                            fontSize: 10,
                            opacity: 0.32,
                            marginTop: 2,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            fontFamily: "monospace",
                            paddingLeft: logo ? 22 : 0,
                          }}
                        >
                          {sub}
                        </div>
                      ) : null;
                    })()}
                  </Link>
                  <button
                    onClick={() => toggleFav(room)}
                    title="Unpin"
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "4px 7px",
                      flexShrink: 0,
                      color: "#FFD24A",
                      opacity: 0.9,
                      fontSize: 13,
                      lineHeight: 1,
                      transition: "opacity 0.12s",
                      borderRadius: 8,
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.opacity = "1";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.opacity = "0.9";
                    }}
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
            <div
              className="weered-left-title"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: favs.length ? 10 : 0,
              }}
            >
              <span>{office ? "Recent reviews" : "Recent"}</span>
              <span style={{ fontSize: 10, opacity: 0.4 }}>{recentRooms.length}</span>
            </div>
            {recentRooms.map((room) => {
              const href = lobbyHref(room);
              const isActive = activeRoomNorm === room;
              const label = getRoomName(room);
              const count = roomCounts[room] ?? 0;
              const isLive = count > 0;
              return (
                <div
                  key={room}
                  style={{ display: "flex", alignItems: "stretch", gap: 3, marginBottom: 4 }}
                >
                  <Link
                    href={href}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: "block",
                      textDecoration: "none",
                      borderRadius: 10,
                      border: isActive
                        ? "1px solid rgba(124,58,237,.40)"
                        : "1px solid rgba(148,163,184,.09)",
                      background: isActive ? "rgba(124,58,237,.10)" : "rgba(148,163,184,.03)",
                      padding: "9px 10px 8px 11px",
                      position: "relative",
                      overflow: "hidden",
                      transition: "background 0.12s, border-color 0.12s",
                      boxShadow: isActive
                        ? "inset 2px 0 0 #5800E5"
                        : "inset 2px 0 0 rgba(148,163,184,.12)",
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.background = isActive
                        ? "rgba(124,58,237,.14)"
                        : "rgba(255,255,255,.04)";
                      el.style.borderColor = isActive
                        ? "rgba(124,58,237,.50)"
                        : "rgba(148,163,184,.16)";
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.background = isActive
                        ? "rgba(124,58,237,.10)"
                        : "rgba(148,163,184,.03)";
                      el.style.borderColor = isActive
                        ? "rgba(124,58,237,.40)"
                        : "rgba(148,163,184,.09)";
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {(() => {
                        const logo = getLobbyLogo(room);
                        return logo ? (
                          <img
                            src={logo}
                            alt={label + " logo"}
                            style={{
                              width: 16,
                              height: 16,
                              borderRadius: 4,
                              objectFit: "contain",
                              flexShrink: 0,
                              background: "rgba(0,0,0,.3)",
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 5,
                              height: 5,
                              borderRadius: "50%",
                              flexShrink: 0,
                              background: isLive ? "#22c55e" : "rgba(255,255,255,.12)",
                              boxShadow: isLive ? "0 0 4px #22c55e" : "none",
                            }}
                          />
                        );
                      })()}
                      <div
                        style={{
                          flex: 1,
                          minWidth: 0,
                          fontSize: 12,
                          fontWeight: isActive ? 700 : 500,
                          color: isActive ? "rgba(243,244,246,.97)" : "rgba(203,213,225,.72)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          lineHeight: 1.35,
                        }}
                      >
                        {label}
                      </div>
                      {isLive && (
                        <span
                          style={{
                            flexShrink: 0,
                            fontSize: 9,
                            fontWeight: 700,
                            color: "rgba(134,239,172,.8)",
                            fontFamily: "monospace",
                          }}
                        >
                          {count}
                        </span>
                      )}
                      {isRoomPending(room) && (
                        <span
                          style={{
                            flexShrink: 0,
                            fontSize: 8,
                            fontWeight: 800,
                            padding: "2px 6px",
                            borderRadius: 99,
                            letterSpacing: "0.04em",
                            background: "rgba(245,158,11,.12)",
                            border: "1px solid rgba(245,158,11,.30)",
                            color: "rgba(251,191,36,.9)",
                            animation: "weered-pending-pulse 2s ease-in-out infinite",
                          }}
                        >
                          PENDING
                        </span>
                      )}
                    </div>
                    {(() => {
                      const sub = getRoomSublabel(room);
                      const logo = getLobbyLogo(room);
                      return sub ? (
                        <div
                          style={{
                            fontSize: 10,
                            opacity: 0.32,
                            marginTop: 2,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            fontFamily: "monospace",
                            paddingLeft: logo ? 22 : 10,
                          }}
                        >
                          {sub}
                        </div>
                      ) : null;
                    })()}
                  </Link>
                  <button
                    onClick={() => toggleFav(room)}
                    title="Pin to favorites"
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "4px 7px",
                      flexShrink: 0,
                      color: "rgba(255,255,255,.2)",
                      fontSize: 13,
                      lineHeight: 1,
                      transition: "color 0.12s",
                      borderRadius: 8,
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,.55)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,.2)";
                    }}
                  >
                    ☆
                  </button>
                </div>
              );
            })}
          </>
        )}

        {favs.length === 0 && recentRooms.length === 0 && (
          <div style={{ fontSize: 11, opacity: 0.3, padding: "2px 0 4px", fontStyle: "italic" }}>
            {office ? "Reviews you open will appear here" : "Join a room to build your history"}
          </div>
        )}
      </div>

      <div
        style={{
          marginTop: "auto",
          padding: "12px 0 4px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
        }}
      >
        <div
          style={{
            width: "100%",
            height: 1,
            background:
              "linear-gradient(90deg, transparent, var(--weered-border) 20%, var(--weered-border) 80%, transparent)",
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            opacity: 0.25,
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase" as const,
            color: "var(--weered-muted)",
          }}
        >
          <span>Weered</span>
          <span style={{ opacity: 0.4 }}>&middot;</span>
          <span
            style={{ fontWeight: 500, letterSpacing: "0.02em", textTransform: "none" as const }}
          >
            est. 2025
          </span>
        </div>
      </div>

      <style>{`@keyframes weered-pending-pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </div>
  );
}
