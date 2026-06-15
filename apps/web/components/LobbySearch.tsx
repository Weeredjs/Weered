"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const API = "https://api.weered.ca";

type LobbyResult = {
  id: string;
  name: string;
  description?: string;
  verified?: boolean;
  moduleType?: string;
  accentColor?: string | null;
  logoUrl?: string | null;
  keywords?: string[];
  _count?: { rooms?: number; members?: number };
};
type RoomResult = {
  id: string;
  name: string;
  locked?: boolean;
  lobbyId?: string;
  lobby?: { id: string; name: string; accentColor?: string | null; logoUrl?: string | null };
  _count?: { members?: number };
};

const HERO_HINTS = [
  "Find a poker table…",
  "Drop into an EVE fleet…",
  "Roll for initiative in D&D…",
  "Talk Destiny raids…",
  "Paper-trade with FakeOut…",
  "36 lobbies. Find your people.",
];

const HERO_CHIPS: { label: string; logo: string; q: string }[] = [
  { label: "Poker", logo: "/brand/lobbies/poker-logo.png", q: "poker" },
  {
    label: "EVE",
    logo: "https://api.weered.ca/banners/lobby-logo-cmmqq3boa001s76y9a3lpbnxq-1780779044131.jpg",
    q: "eve",
  },
  { label: "D&D", logo: "/brand/lobbies/dnd/shield-04.webp", q: "dnd" },
  { label: "Destiny", logo: "/brand/lobbies/destiny2-logo.png", q: "destiny" },
];

const CHIP_CLIP = "polygon(7px 0, 100% 0, calc(100% - 7px) 100%, 0 100%)";
const CHIP_FACE = "#120c20";
const CHIP_CORONA =
  "conic-gradient(from 12deg at 50% 55%, transparent 0 6deg, rgba(201,185,255,1) 9deg, transparent 13deg 41deg, rgba(188,166,255,.88) 45deg, transparent 49deg 96deg, rgba(201,185,255,1) 100deg, transparent 105deg 151deg, rgba(188,166,255,.82) 155deg, transparent 160deg 211deg, rgba(201,185,255,.97) 215deg, transparent 220deg 271deg, rgba(188,166,255,.88) 275deg, transparent 280deg 331deg, rgba(201,185,255,.95) 335deg, transparent 340deg 360deg)";
const CHIP_MASK =
  "radial-gradient(ellipse at center, #000 8%, rgba(0,0,0,.55) 40%, transparent 76%)";

const FEATURED_PRIORITY = [
  "eve",
  "destiny2",
  "poe",
  "helldivers2",
  "league-of-legends",
  "fakeout",
  "fortnite",
  "windrose",
  "counter-strike-2",
  "dota-2",
  "pubg",
  "mlb",
  "pga",
  "chess",
];
const priIdx = (id: string) => {
  const i = FEATURED_PRIORITY.indexOf(id);
  return i === -1 ? 999 : i;
};

export default function LobbySearch({
  width = 240,
  placeholder = "Search lobbies, rooms, tags… ( / )",
  hero = false,
}: {
  width?: number | string;
  placeholder?: string;
  hero?: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const [lobbies, setLobbies] = useState<LobbyResult[]>([]);
  const [rooms, setRooms] = useState<RoomResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hintIdx, setHintIdx] = useState(0);
  const [hoveredChip, setHoveredChip] = useState<string | null>(null);
  const [allLobbies, setAllLobbies] = useState<LobbyResult[]>([]);

  useEffect(() => {
    if (!hero) return;
    const tok = (() => {
      try {
        return localStorage.getItem("weered_token") || "";
      } catch {
        return "";
      }
    })();
    fetch(`${API}/lobbies`, tok ? { headers: { Authorization: `Bearer ${tok}` } } : {})
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j?.lobbies)) setAllLobbies(j.lobbies);
      })
      .catch(() => {});
  }, [hero]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!hero) return;
    if (focused || q.trim()) return;
    const t = setInterval(() => setHintIdx((i) => (i + 1) % HERO_HINTS.length), 2800);
    return () => clearInterval(t);
  }, [hero, focused, q]);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setLobbies([]);
      setRooms([]);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const token =
          typeof window !== "undefined" ? (localStorage.getItem("weered_token") ?? "") : "";
        const res = await fetch(
          `${API}/lobbies/search?q=${encodeURIComponent(query)}`,
          token ? { headers: { Authorization: `Bearer ${token}` } } : {},
        );
        if (res.ok) {
          const data = await res.json();
          setLobbies(Array.isArray(data.pinned) ? data.pinned : []);
          setRooms(Array.isArray(data.rooms) ? data.rooms : []);
        }
      } catch {
      } finally {
        setSearching(false);
      }
    }, 220);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  type Item = { kind: "lobby"; lobby: LobbyResult } | { kind: "room"; room: RoomResult };
  const items: Item[] = useMemo(() => {
    const out: Item[] = [];
    for (const l of lobbies) out.push({ kind: "lobby", lobby: l });
    for (const r of rooms) out.push({ kind: "room", room: r });
    return out;
  }, [lobbies, rooms]);

  useEffect(() => {
    setIdx(0);
  }, [q]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function choose(i: number) {
    const it = items[i];
    if (!it) return;
    setOpen(false);
    setQ("");
    if (it.kind === "lobby") router.push(`/lobby/${it.lobby.id}`);
    else router.push(`/room/${it.room.id}`);
  }

  function pick(term: string) {
    setQ(term);
    setOpen(true);
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open && e.key === "ArrowDown") {
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIdx((c) => Math.min(c + 1, Math.max(0, items.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIdx((c) => Math.max(0, c - 1));
    } else if (e.key === "Enter" && open && items.length) {
      e.preventDefault();
      choose(idx);
    }
  }

  const browseLobbies = useMemo(() => {
    const term = q.trim().toLowerCase();
    const ranked = [...allLobbies].sort((a, b) => priIdx(a.id) - priIdx(b.id));
    if (!term) return ranked;
    return ranked.filter(
      (l) =>
        (l.name || "").toLowerCase().includes(term) || (l.id || "").toLowerCase().includes(term),
    );
  }, [allLobbies, q]);

  const wantSearch = open && q.trim().length >= 2;
  const wantBrowse = hero && open && q.trim().length < 2 && allLobbies.length > 0;

  const dropdown = (wantSearch || wantBrowse) && (
    <div
      style={{
        position: "absolute",
        top: "calc(100% + 8px)",
        ...(hero ? { left: 0, right: 0 } : { right: 0, width: 340 }),
        maxWidth: "85vw",
        maxHeight: 440,
        overflowY: "auto",
        background: "rgba(18,14,28,.98)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(124,58,237,.25)",
        borderRadius: hero ? 4 : 12,
        boxShadow: "0 16px 48px rgba(0,0,0,.55)",
        zIndex: 50,
        padding: 6,
      }}
    >
      {wantBrowse && (
        <>
          <SectionLabel>
            {q.trim()
              ? `Lobbies · ${browseLobbies.length}`
              : `All lobbies · ${browseLobbies.length}`}
          </SectionLabel>
          {browseLobbies.map((l) => (
            <ResultRow
              key={`b-${l.id}`}
              active={false}
              onMouseEnter={() => {}}
              onClick={() => {
                setOpen(false);
                setQ("");
                router.push(`/lobby/${l.id}`);
              }}
              logo={l.logoUrl}
              accent={l.accentColor}
              name={l.name}
              sub={
                l.verified
                  ? "✓ verified"
                  : l.moduleType && l.moduleType !== "NONE"
                    ? String(l.moduleType).toLowerCase()
                    : "community"
              }
            />
          ))}
          {browseLobbies.length === 0 && (
            <div style={{ padding: "12px 14px", color: "rgba(255,255,255,.4)", fontSize: 12 }}>
              No lobby matches “{q.trim()}”. Keep typing to search rooms…
            </div>
          )}
        </>
      )}
      {wantSearch && searching && items.length === 0 && (
        <div style={{ padding: "12px 14px", color: "rgba(255,255,255,.4)", fontSize: 12 }}>
          Searching…
        </div>
      )}
      {wantSearch && !searching && items.length === 0 && (
        <div style={{ padding: "12px 14px", color: "rgba(255,255,255,.4)", fontSize: 12 }}>
          No matches for “{q.trim()}”.
        </div>
      )}
      {wantSearch && lobbies.length > 0 && <SectionLabel>Lobbies</SectionLabel>}
      {wantSearch &&
        lobbies.map((l, i) => (
          <ResultRow
            key={`l-${l.id}`}
            active={idx === i}
            onMouseEnter={() => setIdx(i)}
            onClick={() => choose(i)}
            logo={l.logoUrl}
            accent={l.accentColor}
            name={l.name}
            sub={`${l._count?.members ?? 0} members · ${l._count?.rooms ?? 0} rooms`}
          />
        ))}
      {rooms.length > 0 && <SectionLabel>Rooms</SectionLabel>}
      {rooms.map((r, i) => {
        const flat = lobbies.length + i;
        return (
          <ResultRow
            key={`r-${r.id}`}
            active={idx === flat}
            onMouseEnter={() => setIdx(flat)}
            onClick={() => choose(flat)}
            logo={r.lobby?.logoUrl}
            accent={r.lobby?.accentColor}
            name={r.name}
            sub={r.lobby?.name ? `in ${r.lobby.name}` : "Room"}
          />
        );
      })}
    </div>
  );

  if (hero) {
    const ph = focused || q ? "Search lobbies, rooms, people, tags…" : HERO_HINTS[hintIdx];
    return (
      <div
        ref={boxRef}
        className="home-topbar-search home-search-hero"
        style={{ width, maxWidth: "100%" }}
      >
        <style>{`@keyframes weeredSearchBreath{0%,100%{box-shadow:0 0 0 1px rgba(124,58,237,.38),0 0 22px rgba(124,58,237,.18)}50%{box-shadow:0 0 0 1px rgba(124,58,237,.58),0 0 38px rgba(124,58,237,.32)}}@keyframes weeredChipCorona{0%{transform:rotate(0deg) scale(.98)}50%{transform:rotate(6deg) scale(1.05)}100%{transform:rotate(0deg) scale(.98)}}`}</style>
        <div style={{ position: "relative" }}>
          <span
            aria-hidden
            style={{
              position: "absolute",
              left: 17,
              top: "50%",
              transform: "translateY(-50%)",
              color: focused ? "#a78bfa" : "rgba(167,139,250,.7)",
              pointerEvents: "none",
              display: "flex",
              transition: "color .2s",
            }}
          >
            <svg
              width="19"
              height="19"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
          </span>
          <input
            ref={inputRef}
            data-weered-search
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => {
              setFocused(true);
              setOpen(true);
            }}
            onBlur={() => setFocused(false)}
            onKeyDown={onKeyDown}
            placeholder={ph}
            style={{
              width: "100%",
              boxSizing: "border-box",
              background: focused ? "rgba(124,58,237,.12)" : "rgba(124,58,237,.05)",
              border: `1.5px solid ${focused ? "rgba(167,139,250,.85)" : "rgba(124,58,237,.40)"}`,
              borderRadius: 4,
              padding: "15px 18px 15px 50px",
              color: "#fff",
              fontSize: 16,
              fontWeight: 500,
              outline: "none",
              fontFamily: "inherit",
              letterSpacing: ".01em",
              boxShadow: focused
                ? "0 0 0 1px rgba(167,139,250,.7), 0 0 34px rgba(124,58,237,.40)"
                : undefined,
              animation: focused ? "none" : "weeredSearchBreath 3.6s ease-in-out infinite",
              transition: "background .2s, border-color .2s",
            }}
          />
          {dropdown}
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 9,
            justifyContent: "center",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: "rgba(167,139,250,.7)",
              marginRight: 2,
            }}
          >
            Staff Picks
          </span>
          {HERO_CHIPS.map((c) => {
            const on = hoveredChip === c.q;
            return (
              <span key={c.q} style={{ position: "relative", display: "inline-flex" }}>
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: -17,
                    bottom: -17,
                    left: -22,
                    right: -22,
                    zIndex: 0,
                    pointerEvents: "none",
                    background: CHIP_CORONA,
                    WebkitMaskImage: CHIP_MASK,
                    maskImage: CHIP_MASK,
                    filter: "blur(2.4px)",
                    opacity: on ? 0.8 : 0.5,
                    transition: "opacity .18s",
                    animation: "weeredChipCorona 80s ease-in-out infinite",
                  }}
                />
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: -2,
                    bottom: -2,
                    left: -2,
                    right: -2,
                    zIndex: 1,
                    pointerEvents: "none",
                    clipPath: CHIP_CLIP,
                    background: `rgba(167,139,250,${on ? 0.95 : 0.72})`,
                    transition: "background .15s",
                  }}
                />
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: -1,
                    bottom: -1,
                    left: -1,
                    right: -1,
                    zIndex: 2,
                    pointerEvents: "none",
                    clipPath: CHIP_CLIP,
                    background:
                      "linear-gradient(135deg, rgba(46,26,78,.96) 0%, rgba(20,11,38,.96) 100%)",
                  }}
                />
                <button
                  type="button"
                  onClick={() => pick(c.q)}
                  onMouseEnter={() => setHoveredChip(c.q)}
                  onMouseLeave={() => setHoveredChip((h) => (h === c.q ? null : h))}
                  style={{
                    position: "relative",
                    zIndex: 3,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "6px 14px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: ".02em",
                    color: on ? "#fff" : "rgba(226,232,240,.85)",
                    background: CHIP_FACE,
                    border: "none",
                    clipPath: CHIP_CLIP,
                    boxShadow: "none",
                    transition: "color .15s",
                    whiteSpace: "nowrap",
                  }}
                >
                  <img
                    src={c.logo}
                    alt=""
                    style={{ width: 16, height: 16, objectFit: "contain", flexShrink: 0 }}
                  />
                  {c.label}
                </button>
              </span>
            );
          })}
          <button
            type="button"
            onClick={() => router.push("/explore")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "6px 14px",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: ".02em",
              color: "rgba(148,163,184,.7)",
              background: "transparent",
              border: "none",
              clipPath: CHIP_CLIP,
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,.10)",
              transition: "color .15s, box-shadow .15s",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => {
              const t = e.currentTarget;
              t.style.color = "#fff";
              t.style.boxShadow = "inset 0 0 0 1px rgba(255,255,255,.26)";
            }}
            onMouseLeave={(e) => {
              const t = e.currentTarget;
              t.style.color = "rgba(148,163,184,.7)";
              t.style.boxShadow = "inset 0 0 0 1px rgba(255,255,255,.10)";
            }}
          >
            Browse all 36 →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={boxRef} className="home-topbar-search" style={{ position: "relative" }}>
      <span
        style={{
          position: "absolute",
          left: 11,
          top: "50%",
          transform: "translateY(-50%)",
          color: "rgba(255,255,255,.25)",
          fontSize: 14,
          pointerEvents: "none",
        }}
      >
        &#8981;
      </span>
      <input
        ref={inputRef}
        data-weered-search
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={(e) => {
          (e.target as HTMLInputElement).style.borderColor = "rgba(255,255,255,.15)";
          if (q.trim().length >= 2) setOpen(true);
        }}
        onBlur={(e) => ((e.target as HTMLInputElement).style.borderColor = "rgba(255,255,255,.07)")}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        style={{
          background: "rgba(255,255,255,.04)",
          border: "1px solid rgba(255,255,255,.07)",
          borderRadius: 10,
          padding: "9px 14px 9px 34px",
          color: "#e8e8ec",
          fontSize: 13,
          width,
          outline: "none",
          fontFamily: "inherit",
          transition: "border-color .15s",
        }}
      />
      {dropdown}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "6px 10px 3px",
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: ".08em",
        textTransform: "uppercase",
        color: "rgba(255,255,255,.35)",
      }}
    >
      {children}
    </div>
  );
}

function ResultRow({
  active,
  onMouseEnter,
  onClick,
  logo,
  accent,
  name,
  sub,
}: {
  active: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
  logo?: string | null;
  accent?: string | null;
  name: string;
  sub: string;
}) {
  return (
    <button
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 10px",
        borderRadius: 8,
        border: "none",
        cursor: "pointer",
        background: active ? "rgba(124,58,237,.18)" : "transparent",
        fontFamily: "inherit",
      }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 7,
          flexShrink: 0,
          overflow: "hidden",
          background: logo
            ? `url(${logo}) center/cover`
            : accent || "linear-gradient(135deg,#7c3aed,#5800e5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          fontWeight: 800,
          color: "#fff",
        }}
      >
        {!logo && (name || "?").charAt(0).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "#e8e8ec",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {name}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,.45)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {sub}
        </div>
      </div>
    </button>
  );
}
